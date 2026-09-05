import 'server-only';
import { db } from './redis';
import { g } from './keys';
import { newId } from './ids';
import { NotFoundError } from './garden';
import type { CareTask } from './types';

export const MAX_TASKS_PER_PLANT = 8;

export async function listTasks(gardenId: string, plantId: string): Promise<CareTask[]> {
  const map = await db().hgetall<CareTask>(g.plantTasks(gardenId, plantId));
  return Object.values(map).sort(
    (a, b) => a.schedule.startMonth - b.schedule.startMonth || a.title.localeCompare(b.title, 'nl'),
  );
}

export async function getTask(
  gardenId: string,
  plantId: string,
  taskId: string,
): Promise<CareTask | null> {
  return db().hget<CareTask>(g.plantTasks(gardenId, plantId), taskId);
}

export async function requireTask(
  gardenId: string,
  plantId: string,
  taskId: string,
): Promise<CareTask> {
  const task = await getTask(gardenId, plantId, taskId);
  if (!task) throw new NotFoundError('Taak niet gevonden');
  return task;
}

export async function createTask(
  gardenId: string,
  plantId: string,
  input: Omit<CareTask, 'id' | 'plantId'>,
): Promise<CareTask> {
  const existing = await listTasks(gardenId, plantId);
  if (existing.length >= MAX_TASKS_PER_PLANT) {
    throw Object.assign(new Error(`Maximaal ${MAX_TASKS_PER_PLANT} taken per plant.`), {
      status: 409,
    });
  }
  const task: CareTask = { ...input, id: newId(), plantId };
  await db().hset(g.plantTasks(gardenId, plantId), task.id, task);
  return task;
}

export async function createTasks(
  gardenId: string,
  plantId: string,
  inputs: Omit<CareTask, 'id' | 'plantId'>[],
): Promise<CareTask[]> {
  const tasks = inputs.slice(0, MAX_TASKS_PER_PLANT).map<CareTask>((input) => ({
    ...input,
    id: newId(),
    plantId,
  }));
  await db().hsetMany(
    g.plantTasks(gardenId, plantId),
    Object.fromEntries(tasks.map((t) => [t.id, t])),
  );
  return tasks;
}

export async function updateTask(
  gardenId: string,
  plantId: string,
  taskId: string,
  patch: Partial<Omit<CareTask, 'id' | 'plantId'>>,
): Promise<CareTask> {
  const current = await requireTask(gardenId, plantId, taskId);
  const next: CareTask = { ...current, ...patch, id: taskId, plantId };
  await db().hset(g.plantTasks(gardenId, plantId), taskId, next);
  return next;
}

export async function deleteTask(
  gardenId: string,
  plantId: string,
  taskId: string,
): Promise<void> {
  await db().hdel(g.plantTasks(gardenId, plantId), taskId);
}

/** Alle taken van de tuin, gegroepeerd per plant. Eén call per plant. */
export async function tasksByPlant(
  gardenId: string,
  plantIds: string[],
): Promise<Map<string, CareTask[]>> {
  const entries = await Promise.all(
    plantIds.map(async (id) => [id, await listTasks(gardenId, id)] as const),
  );
  return new Map(entries);
}

/**
 * Taak met een vaste id, voor taken die de app zelf beheert (weer-gestuurd).
 * Idempotent: bestaat hij al, dan blijft de tekst van de gebruiker staan.
 */
export async function ensureTask(
  gardenId: string,
  plantId: string,
  taskId: string,
  input: Omit<CareTask, 'id' | 'plantId'>,
): Promise<CareTask> {
  const bestaand = await getTask(gardenId, plantId, taskId);
  if (bestaand) return bestaand;
  const task: CareTask = { ...input, id: taskId, plantId };
  await db().hset(g.plantTasks(gardenId, plantId), taskId, task);
  return task;
}
