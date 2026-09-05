import 'server-only';
import { db } from './redis';
import { g } from './keys';
import { newId, newLabelCode } from './ids';
import { NotFoundError } from './garden';
import { requireLocation } from './locations';
import type { Plant, PlantPhoto } from './types';

export const MAX_PLANTS_PER_GARDEN = 300;
export const MAX_PHOTOS_PER_PLANT = 20;

export async function listPlants(gardenId: string): Promise<Plant[]> {
  const map = await db().hgetall<Plant>(g.plants(gardenId));
  return Object.values(map).sort((a, b) => a.commonName.localeCompare(b.commonName, 'nl'));
}

/** Alleen levende planten: die tellen mee voor agenda en standaardlijst. */
export async function listLivePlants(gardenId: string): Promise<Plant[]> {
  return (await listPlants(gardenId)).filter((p) => p.status === 'levend');
}

export async function getPlant(gardenId: string, id: string): Promise<Plant | null> {
  return db().hget<Plant>(g.plants(gardenId), id);
}

export async function requirePlant(gardenId: string, id: string): Promise<Plant> {
  const plant = await getPlant(gardenId, id);
  if (!plant) throw new NotFoundError('Plant niet gevonden');
  return plant;
}

async function uniqueLabelCode(gardenId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = newLabelCode();
    const taken = await db().get<string>(g.label(gardenId, code));
    if (!taken) return code;
  }
  return newLabelCode(6);
}

export type NewPlant = Omit<
  Plant,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'labelCode'
> & { status?: Plant['status'] };

export async function createPlant(gardenId: string, input: NewPlant): Promise<Plant> {
  const count = Object.keys(await db().hgetall<Plant>(g.plants(gardenId))).length;
  if (count >= MAX_PLANTS_PER_GARDEN) {
    throw Object.assign(new Error(`Maximaal ${MAX_PLANTS_PER_GARDEN} planten per tuin.`), {
      status: 409,
    });
  }
  await requireLocation(gardenId, input.locationId);
  const now = new Date().toISOString();
  const plant: Plant = {
    ...input,
    id: newId(),
    status: input.status ?? 'levend',
    labelCode: await uniqueLabelCode(gardenId),
    createdAt: now,
    updatedAt: now,
  };
  await db().hset(g.plants(gardenId), plant.id, plant);
  await db().sadd(g.locationPlants(gardenId, plant.locationId), plant.id);
  await db().set(g.label(gardenId, plant.labelCode!), plant.id);
  return plant;
}

export async function updatePlant(
  gardenId: string,
  id: string,
  patch: Partial<Omit<Plant, 'id' | 'createdAt'>>,
): Promise<Plant> {
  const current = await requirePlant(gardenId, id);
  if (patch.locationId && patch.locationId !== current.locationId) {
    await requireLocation(gardenId, patch.locationId);
    await db().srem(g.locationPlants(gardenId, current.locationId), id);
    await db().sadd(g.locationPlants(gardenId, patch.locationId), id);
  }
  const next: Plant = {
    ...current,
    ...patch,
    id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await db().hset(g.plants(gardenId), id, next);
  return next;
}

export async function deletePlant(gardenId: string, id: string): Promise<void> {
  const plant = await requirePlant(gardenId, id);
  await db().hdel(g.plants(gardenId), id);
  await db().srem(g.locationPlants(gardenId, plant.locationId), id);
  if (plant.labelCode) await db().del(g.label(gardenId, plant.labelCode));
  await db().del(g.plantTasks(gardenId, id), g.plantLog(gardenId, id), g.plantPhotos(gardenId, id));
}

export async function findPlantByLabel(
  gardenId: string,
  labelCode: string,
): Promise<Plant | null> {
  const id = await db().get<string>(g.label(gardenId, labelCode));
  return id ? getPlant(gardenId, String(id)) : null;
}

/* -------------------------------------------------------------------- foto's */

export async function listPhotos(gardenId: string, plantId: string): Promise<PlantPhoto[]> {
  return db().lrange<PlantPhoto>(g.plantPhotos(gardenId, plantId), 0, MAX_PHOTOS_PER_PLANT - 1);
}

export async function addPhoto(
  gardenId: string,
  plantId: string,
  photo: PlantPhoto,
): Promise<void> {
  const key = g.plantPhotos(gardenId, plantId);
  const current = await db().lrange<PlantPhoto>(key, 0, -1);
  if (current.length >= MAX_PHOTOS_PER_PLANT) {
    throw Object.assign(new Error(`Maximaal ${MAX_PHOTOS_PER_PLANT} foto's per plant.`), {
      status: 409,
    });
  }
  await db().lpush(key, photo);
}

export async function removePhoto(
  gardenId: string,
  plantId: string,
  url: string,
): Promise<void> {
  const key = g.plantPhotos(gardenId, plantId);
  const current = await db().lrange<PlantPhoto>(key, 0, -1);
  const kept = current.filter((p) => p.url !== url);
  await db().del(key);
  if (kept.length) await db().lpush(key, ...[...kept].reverse());
}
