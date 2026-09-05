import 'server-only';
import { db } from './redis';
import { g } from './keys';
import { newId } from './ids';
import { NotFoundError } from './garden';
import type { CareTask } from './types';

export const MAX_TASKS_PER_PLANT = 8;

/**
 * Water geven wordt anders gepland dan de rest (§7.2).
 *
 * Buiten: door het weer. Een schema van "elke drie dagen" levert honderd
 * regels per zomer op en dat overstemt de rest, terwijl de regenmeter beter
 * weet wanneer er water bij moet.
 *
 * Binnen: geen enkele weerregel geldt daar, dus daar doet de kalender het —
 * één herinnering per week, het jaar rond.
 */
export const WATER_INTERVAL_BINNEN = 7;

/** Dezelfde taak, maar dan gestuurd door droogte in plaats van de kalender. */
export function alleenBijDroogte<T extends Pick<CareTask, 'schedule' | 'weatherRules'>>(
  task: T,
): T {
  return {
    ...task,
    schedule: {
      kind: 'weer-gestuurd',
      startMonth: task.schedule.startMonth,
      endMonth: task.schedule.endMonth,
    },
    weatherRules: task.weatherRules.includes('droogte')
      ? task.weatherRules
      : [...task.weatherRules, 'droogte'],
  };
}

/** Elke week, het hele jaar door. Voor kamerplanten. */
export function elkeWeek<T extends Pick<CareTask, 'schedule' | 'weatherRules'>>(task: T): T {
  return {
    ...task,
    schedule: {
      kind: 'interval',
      startMonth: 1,
      endMonth: 12,
      intervalDays: WATER_INTERVAL_BINNEN,
    },
    weatherRules: [],
  };
}

/**
 * Hoe de waterbeurt van deze plant hoort te lopen. Geeft null terug als er
 * niets aan te passen valt: geen watertaak, met de hand gezet, of al goed.
 */
export function waterPlanning<T extends Pick<CareTask, 'type' | 'source' | 'schedule' | 'weatherRules'>>(
  task: T,
  buiten: boolean,
): T | null {
  if (task.type !== 'water') return null;
  // Wat iemand zelf heeft ingesteld blijft staan.
  if (task.source !== 'ai') return null;

  if (buiten) {
    return task.schedule.kind === 'weer-gestuurd' ? null : alleenBijDroogte(task);
  }
  const goed =
    task.schedule.kind === 'interval' &&
    task.schedule.intervalDays === WATER_INTERVAL_BINNEN &&
    task.schedule.startMonth === 1 &&
    task.schedule.endMonth === 12;
  return goed ? null : elkeWeek(task);
}

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
