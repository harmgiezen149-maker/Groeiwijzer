/**
 * Alle Redis-sleutels lopen via deze helpers (OVERDRACHT §5).
 * Nooit een sleutel met de hand samenstellen: elke tuinsleutel is
 * geprefixt met de gardenId zodat data van tuinen nooit kan mengen.
 */

function safe(part: string, what: string): string {
  if (!part || /[:\s]/.test(part)) throw new Error(`Ongeldige ${what}: ${JSON.stringify(part)}`);
  return part;
}

export const userKey = {
  profile: (userId: string) => `user:${safe(userId, 'userId')}`,
  byEmail: (email: string) => `user:byEmail:${email.trim().toLowerCase()}`,
  gardens: (userId: string) => `user:${safe(userId, 'userId')}:gardens`,
  push: (userId: string) => `push:${safe(userId, 'userId')}`,
};

export const gardenKey = {
  root: (gardenId: string) => `garden:${safe(gardenId, 'gardenId')}`,
  members: (gardenId: string) => `garden:${safe(gardenId, 'gardenId')}:members`,
};

export const inviteKey = (token: string) => `invite:${safe(token, 'token')}`;

export const weatherKey = (lat: number, lon: number) =>
  `weather:${lat.toFixed(3)}:${lon.toFixed(3)}`;

/** Sleutels binnen één tuin. */
export function keyFor(gardenId: string, ...parts: (string | number)[]): string {
  const g = safe(gardenId, 'gardenId');
  return ['g', g, ...parts.map((p) => safe(String(p), 'sleuteldeel'))].join(':');
}

export const g = {
  locations: (gid: string) => keyFor(gid, 'locations'),
  plants: (gid: string) => keyFor(gid, 'plants'),
  locationPlants: (gid: string, locationId: string) => keyFor(gid, 'loc', locationId, 'plants'),
  label: (gid: string, labelCode: string) => keyFor(gid, 'label', labelCode.toUpperCase()),
  plantTasks: (gid: string, plantId: string) => keyFor(gid, 'plant', plantId, 'tasks'),
  occurrences: (gid: string, year: number) => keyFor(gid, 'occ', year),
  openOccurrences: (gid: string, year: number) => keyFor(gid, 'occ', year, 'open'),
  plantLog: (gid: string, plantId: string) => keyFor(gid, 'plant', plantId, 'log'),
  plantPhotos: (gid: string, plantId: string) => keyFor(gid, 'plant', plantId, 'photos'),
  meta: (gid: string) => keyFor(gid, 'meta'),
};
