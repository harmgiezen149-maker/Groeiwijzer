import 'server-only';
import { db } from './redis';
import { g, gardenKey, inviteKey, userKey } from './keys';
import { newId, newToken } from './ids';
import type { Garden, GardenMeta, Invite, Location, Membership, User } from './types';

/** Standaardlocatie van de tuin: postcode 6866 EH, Heelsum. */
export const DEFAULT_GARDEN_LOCATION = { lat: 51.977, lon: 5.755, postcode: '6866 EH' };

const DEFAULT_LOCATIONS: Omit<Location, 'id'>[] = [
  { name: 'Voortuin', outdoor: true, sun: 'zon', sortOrder: 0 },
  { name: 'Achtertuin', outdoor: true, sun: 'halfschaduw', sortOrder: 1 },
  { name: 'Terras', outdoor: true, sun: 'zon', sortOrder: 2 },
  { name: 'Binnen', outdoor: false, sun: 'halfschaduw', sortOrder: 3 },
];

/** Registratie van alle tuinen, zodat de geplande taken erlangs kunnen. */
const ALL_GARDENS = 'gardens:all';

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = 'Geen toegang tot deze tuin') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  status = 404;
  constructor(message = 'Niet gevonden') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/* ---------------------------------------------------------------- gebruikers */

export async function getUser(userId: string): Promise<User | null> {
  return db().get<User>(userKey.profile(userId));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const id = await db().get<string>(userKey.byEmail(email));
  return id ? getUser(String(id)) : null;
}

export async function upsertUser(input: {
  email: string;
  name?: string;
  image?: string;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const existing = await getUserByEmail(email);
  if (existing) {
    const merged: User = {
      ...existing,
      name: input.name ?? existing.name,
      image: input.image ?? existing.image,
    };
    await db().set(userKey.profile(existing.id), merged);
    return merged;
  }
  const user: User = { id: newId(), email, name: input.name, image: input.image, createdAt: now() };
  await db().set(userKey.profile(user.id), user);
  await db().set(userKey.byEmail(email), user.id);
  return user;
}

/** Zorgt dat de gebruiker minstens één tuin heeft; geeft de tuinen terug. */
export async function ensureGardenForUser(user: User): Promise<Garden[]> {
  const gardens = await listGardensForUser(user.id);
  if (gardens.length > 0) return gardens;
  const garden = await createGarden(user, 'Mijn tuin');
  return [garden];
}

/* --------------------------------------------------------------------- tuin */

export async function createGarden(owner: User, name: string): Promise<Garden> {
  const garden: Garden = {
    id: newId(),
    name,
    ownerId: owner.id,
    ...DEFAULT_GARDEN_LOCATION,
    createdAt: now(),
  };
  await db().set(gardenKey.root(garden.id), garden);
  await db().sadd(ALL_GARDENS, garden.id);
  await addMember(garden.id, owner.id, 'eigenaar');
  await seedDefaultLocations(garden.id);
  return garden;
}

export async function seedDefaultLocations(gardenId: string): Promise<void> {
  const entries: Record<string, Location> = {};
  for (const base of DEFAULT_LOCATIONS) {
    const loc: Location = { id: newId(), ...base };
    entries[loc.id] = loc;
  }
  await db().hsetMany(g.locations(gardenId), entries);
}

export async function getGarden(gardenId: string): Promise<Garden | null> {
  return db().get<Garden>(gardenKey.root(gardenId));
}

export async function saveGarden(garden: Garden): Promise<void> {
  await db().set(gardenKey.root(garden.id), garden);
}

export async function listGardensForUser(userId: string): Promise<Garden[]> {
  const ids = await db().smembers(userKey.gardens(userId));
  const gardens = await Promise.all(ids.map((id) => getGarden(id)));
  const gevonden = gardens
    .filter((x): x is Garden => x !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  await Promise.all(gevonden.map((garden) => registerGarden(garden.id)));
  return gevonden;
}

/**
 * Zorgt dat een tuin in het register staat. Zelfherstellend voor tuinen die
 * ouder zijn dan het register; per serverinstantie hooguit één keer per tuin.
 */
const geregistreerd = new Set<string>();

export async function registerGarden(gardenId: string): Promise<void> {
  if (geregistreerd.has(gardenId)) return;
  geregistreerd.add(gardenId);
  await db().sadd(ALL_GARDENS, gardenId);
}

export async function listAllGardens(): Promise<Garden[]> {
  const ids = await db().smembers(ALL_GARDENS);
  const gardens = await Promise.all(ids.map((id) => getGarden(id)));
  return gardens.filter((x): x is Garden => x !== null);
}

/* -------------------------------------------------------------- lidmaatschap */

export async function addMember(
  gardenId: string,
  userId: string,
  role: Membership['role'],
): Promise<Membership> {
  const membership: Membership = {
    gardenId,
    userId,
    role,
    joinedAt: now(),
    notify: { email: true, push: true },
  };
  await db().hset(gardenKey.members(gardenId), userId, membership);
  await db().sadd(userKey.gardens(userId), gardenId);
  return membership;
}

export async function getMembership(
  gardenId: string,
  userId: string,
): Promise<Membership | null> {
  return db().hget<Membership>(gardenKey.members(gardenId), userId);
}

export async function listMembers(gardenId: string): Promise<(Membership & { user: User | null })[]> {
  const map = await db().hgetall<Membership>(gardenKey.members(gardenId));
  const rows = Object.values(map);
  const users = await Promise.all(rows.map((m) => getUser(m.userId)));
  return rows
    .map((m, i) => ({ ...m, user: users[i] }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

export async function saveMembership(membership: Membership): Promise<void> {
  await db().hset(gardenKey.members(membership.gardenId), membership.userId, membership);
}

export async function removeMember(gardenId: string, userId: string): Promise<void> {
  await db().hdel(gardenKey.members(gardenId), userId);
  await db().srem(userKey.gardens(userId), gardenId);
}

/**
 * Beveiligingsregel uit §3: elke serveractie begint hiermee.
 * Een gardenId uit de request wordt nooit vertrouwd zonder deze controle.
 */
export async function assertMember(userId: string, gardenId: string): Promise<Membership> {
  const membership = await getMembership(gardenId, userId);
  if (!membership) throw new ForbiddenError();
  return membership;
}

export async function assertOwner(userId: string, gardenId: string): Promise<Membership> {
  const membership = await assertMember(userId, gardenId);
  if (membership.role !== 'eigenaar') {
    throw new ForbiddenError('Alleen de eigenaar van de tuin kan dit');
  }
  return membership;
}

/* ------------------------------------------------------------- uitnodigingen */

const INVITE_DAYS = 14;

export async function createInvite(
  gardenId: string,
  email: string,
  invitedBy: string,
): Promise<Invite> {
  const invite: Invite = {
    token: newToken(32),
    gardenId,
    email: email.trim().toLowerCase(),
    invitedBy,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86400_000).toISOString(),
  };
  await db().set(inviteKey(invite.token), invite, { ttlSeconds: INVITE_DAYS * 86400 });
  return invite;
}

export async function getInvite(token: string): Promise<Invite | null> {
  return db().get<Invite>(inviteKey(token));
}

export type InviteResult =
  | { ok: true; gardenId: string }
  | { ok: false; reason: 'onbekend' | 'verlopen' | 'gebruikt' | 'ander-adres' };

/** Accepteert een uitnodiging. Token is eenmalig en gebonden aan het e-mailadres. */
export async function acceptInvite(token: string, user: User): Promise<InviteResult> {
  const invite = await getInvite(token);
  if (!invite) return { ok: false, reason: 'onbekend' };
  if (invite.acceptedAt) return { ok: false, reason: 'gebruikt' };
  if (new Date(invite.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'verlopen' };
  if (invite.email !== user.email.trim().toLowerCase()) {
    return { ok: false, reason: 'ander-adres' };
  }
  const existing = await getMembership(invite.gardenId, user.id);
  if (!existing) await addMember(invite.gardenId, user.id, 'lid');
  await db().set(
    inviteKey(token),
    { ...invite, acceptedAt: now() } satisfies Invite,
    { ttlSeconds: 3600 },
  );
  return { ok: true, gardenId: invite.gardenId };
}

/* --------------------------------------------------------------------- meta */

export async function getMeta(gardenId: string): Promise<GardenMeta> {
  return (await db().hgetall<never>(g.meta(gardenId))) as unknown as GardenMeta;
}

export async function setMeta(gardenId: string, patch: Partial<GardenMeta>): Promise<void> {
  await db().hsetMany(g.meta(gardenId), patch as Record<string, unknown>);
}

function now() {
  return new Date().toISOString();
}
