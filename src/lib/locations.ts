import 'server-only';
import { db } from './redis';
import { g } from './keys';
import { newId } from './ids';
import { NotFoundError } from './garden';
import type { Location } from './types';

export async function listLocations(gardenId: string): Promise<Location[]> {
  const map = await db().hgetall<Location>(g.locations(gardenId));
  return Object.values(map).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'nl'),
  );
}

export async function getLocation(gardenId: string, id: string): Promise<Location | null> {
  return db().hget<Location>(g.locations(gardenId), id);
}

export async function requireLocation(gardenId: string, id: string): Promise<Location> {
  const loc = await getLocation(gardenId, id);
  if (!loc) throw new NotFoundError('Locatie niet gevonden');
  return loc;
}

export async function createLocation(
  gardenId: string,
  input: Omit<Location, 'id' | 'sortOrder'> & { sortOrder?: number },
): Promise<Location> {
  const existing = await listLocations(gardenId);
  const location: Location = {
    ...input,
    id: newId(),
    sortOrder: input.sortOrder ?? existing.length,
  };
  await db().hset(g.locations(gardenId), location.id, location);
  return location;
}

export async function updateLocation(
  gardenId: string,
  id: string,
  patch: Partial<Omit<Location, 'id'>>,
): Promise<Location> {
  const current = await requireLocation(gardenId, id);
  const next: Location = { ...current, ...patch, id };
  await db().hset(g.locations(gardenId), id, next);
  return next;
}

/** Verwijderen kan alleen als er geen planten meer op de locatie staan. */
export async function deleteLocation(gardenId: string, id: string): Promise<void> {
  await requireLocation(gardenId, id);
  const plantIds = await db().smembers(g.locationPlants(gardenId, id));
  if (plantIds.length > 0) {
    throw Object.assign(
      new Error(`Deze locatie heeft nog ${plantIds.length} plant(en). Verplaats die eerst.`),
      { status: 409 },
    );
  }
  await db().hdel(g.locations(gardenId), id);
}
