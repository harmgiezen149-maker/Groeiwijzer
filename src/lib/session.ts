import 'server-only';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import {
  ForbiddenError,
  assertMember,
  ensureGardenForUser,
  getUser,
  listGardensForUser,
} from './garden';
import type { Garden, Membership, User } from './types';

export const ACTIVE_GARDEN_COOKIE = 'bw_tuin';

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = 'Niet ingelogd') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface Context {
  user: User;
  garden: Garden;
  membership: Membership;
  gardens: Garden[];
}

/** De ingelogde gebruiker, of null. */
export async function currentUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUser(session.user.id);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Actieve tuin van de ingelogde gebruiker. De cookie is niet meer dan een
 * voorkeur: het lidmaatschap wordt altijd server-side getoetst.
 */
export async function requireContext(gardenIdFromRequest?: string): Promise<Context> {
  const user = await requireUser();
  const gardens = await ensureGardenForUser(user);

  const jar = await cookies();
  const wanted = gardenIdFromRequest ?? jar.get(ACTIVE_GARDEN_COOKIE)?.value;

  let garden = wanted ? gardens.find((x) => x.id === wanted) : undefined;
  if (wanted && !garden) {
    // Expliciet gevraagde tuin waar deze gebruiker geen lid van is: 403.
    if (gardenIdFromRequest) throw new ForbiddenError();
    garden = undefined;
  }
  garden ??= gardens[0];
  if (!garden) throw new ForbiddenError('Geen tuin gevonden');

  const membership = await assertMember(user.id, garden.id);
  return { user, garden, membership, gardens };
}

export async function listGardens(userId: string) {
  return listGardensForUser(userId);
}
