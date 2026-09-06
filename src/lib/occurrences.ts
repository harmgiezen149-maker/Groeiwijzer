import 'server-only';
import { db } from './redis';
import { g } from './keys';
import { getMeta, setMeta, NotFoundError } from './garden';
import { listLivePlants, listPlants, requirePlant } from './plants';
import { listLocations } from './locations';
import { listTasks, updateTask, waterPlanning } from './tasks';
import { mergeOccurrences, plannedOccurrences } from './schedule';
import { addDays, rangeOverlapsMonth } from './dates';
import { addLog } from './log';
import type { CareTask, Plant, TaskOccurrence } from './types';

export async function loadYear(
  gardenId: string,
  year: number,
): Promise<Record<string, TaskOccurrence>> {
  return db().hgetall<TaskOccurrence>(g.occurrences(gardenId, year));
}

/**
 * Hoger nummer betekent: de agenda van dit jaar opnieuw opbouwen, ook als hij
 * al gedraaid heeft. Versie 2 haalde het kalendermatige water geven eruit;
 * versie 3 gaf kamerplanten hun wekelijkse beurt terug.
 */
export const GENERATOR_VERSIE = 3;

/**
 * Genereert de occurrences van een jaar (§7.1). Idempotent: bestaande id's
 * blijven staan, `gedaan` en `overgeslagen` worden nooit overschreven.
 * Ruimt daarnaast open occurrences op van taken of planten die weg zijn, en
 * van taken die niets meer plannen.
 */
export async function generateOccurrences(
  gardenId: string,
  year: number,
): Promise<{ added: number; removed: number }> {
  const [plants, locations] = await Promise.all([
    listLivePlants(gardenId),
    listLocations(gardenId),
  ]);
  const buitenPerLocatie = new Map(locations.map((l) => [l.id, l.outdoor]));
  const generatedAt = new Date().toISOString();

  const planned: TaskOccurrence[] = [];
  const liveTaskIds = new Set<string>();
  for (const plant of plants) {
    const buiten = buitenPerLocatie.get(plant.locationId) !== false;
    for (const taak of await listTasks(gardenId, plant.id)) {
      let task = taak;
      // Water geven loopt buiten op het weer en binnen op de week. Profielen
      // van eerder worden hier één keer omgeschreven; de plant houdt zijn
      // uitleg, alleen het ritme verandert.
      const beter = waterPlanning(task, buiten);
      if (beter) {
        task = await updateTask(gardenId, plant.id, task.id, beter);
      }
      liveTaskIds.add(`${plant.id}:${task.id}`);
      planned.push(...plannedOccurrences(task, year, generatedAt));
    }
  }

  const existing = await loadYear(gardenId, year);
  const { toWrite, added } = mergeOccurrences(existing, planned);

  // Opruimen: open occurrences van een taak of plant die niet meer meetelt, en
  // van een taak die deze dagen niet meer plant. Weertaken vallen erbuiten:
  // die worden door de weerregels zelf gezet en opgeruimd.
  const gepland = new Set(planned.map((occ) => occ.id));
  const stale = Object.values(existing).filter(
    (occ) =>
      occ.status === 'open' &&
      !occ.taskId.startsWith('weer-') &&
      (!liveTaskIds.has(`${occ.plantId}:${occ.taskId}`) || !gepland.has(occ.id)),
  );

  if (Object.keys(toWrite).length) {
    await db().hsetMany(g.occurrences(gardenId, year), toWrite);
    await db().sadd(g.openOccurrences(gardenId, year), ...Object.keys(toWrite));
  }
  if (stale.length) {
    const ids = stale.map((o) => o.id);
    await db().hdel(g.occurrences(gardenId, year), ...ids);
    await db().srem(g.openOccurrences(gardenId, year), ...ids);
  }

  await setMeta(gardenId, { lastGeneratedYear: year, generatorVersion: GENERATOR_VERSIE });
  return { added, removed: stale.length };
}

/** Draait de generator als dat voor dit jaar nog niet gebeurd is. */
export async function ensureGenerated(gardenId: string, year: number): Promise<void> {
  const meta = await getMeta(gardenId);
  const bij =
    Number(meta.lastGeneratedYear) === year &&
    Number(meta.generatorVersion ?? 0) >= GENERATOR_VERSIE;
  if (bij) return;
  await generateOccurrences(gardenId, year);
}

export interface AgendaItem {
  occurrence: TaskOccurrence;
  task: CareTask;
  plant: Plant;
}

export interface DagAgenda {
  /** Wat vandaag mag: per taak de beurt die nu aan de beurt is. */
  vandaag: AgendaItem[];
  /** Wat er de komende dagen aankomt: per taak de eerstvolgende beurt. */
  binnenkort: AgendaItem[];
}

/** Hoe ver "binnenkort" vooruitkijkt. */
export const BINNENKORT_DAGEN = 7;

/**
 * De agenda van één dag (§7.1, herzien). Van een terugkerende taak staat
 * hooguit één beurt in beeld: de laatste waarvan het venster is begonnen.
 * Beurten die daarvóór liggen en nooit gedaan zijn, krijgen de status
 * `verlopen` — je kunt gisteren niet meer water geven, en een stapel gemiste
 * beurten helpt niemand.
 */
export async function agendaForDay(
  gardenId: string,
  day: string,
  opts: { vooruitDagen?: number } = {},
): Promise<DagAgenda> {
  const jaar = Number(day.slice(0, 4));
  const jaren = await Promise.all([
    loadYear(gardenId, jaar - 1),
    loadYear(gardenId, jaar),
    loadYear(gardenId, jaar + 1),
  ]);
  const open = jaren.flatMap((set) => Object.values(set)).filter((occ) => occ.status === 'open');

  const grens = addDays(day, opts.vooruitDagen ?? BINNENKORT_DAGEN);
  const groepen = new Map<string, TaskOccurrence[]>();
  for (const occ of open) {
    const sleutel = `${occ.plantId}:${occ.taskId}`;
    const groep = groepen.get(sleutel);
    if (groep) groep.push(occ);
    else groepen.set(sleutel, [occ]);
  }

  const nu: TaskOccurrence[] = [];
  const straks: TaskOccurrence[] = [];
  const verlopen: TaskOccurrence[] = [];

  for (const beurten of groepen.values()) {
    const oplopend = [...beurten].sort((a, b) => a.windowStart.localeCompare(b.windowStart));
    const begonnen = oplopend.filter((occ) => occ.windowStart <= day);
    if (begonnen.length) {
      nu.push(begonnen[begonnen.length - 1]);
      verlopen.push(...begonnen.slice(0, -1));
      continue;
    }
    const eerstvolgende = oplopend[0];
    if (eerstvolgende && eerstvolgende.windowStart <= grens) straks.push(eerstvolgende);
  }

  if (verlopen.length) await markeerVerlopen(gardenId, verlopen);

  const [vandaag, binnenkort] = await Promise.all([
    hydrate(gardenId, nu, {}),
    hydrate(gardenId, straks, {}),
  ]);
  return { vandaag, binnenkort };
}

async function markeerVerlopen(gardenId: string, occurrences: TaskOccurrence[]): Promise<void> {
  const perJaar = new Map<number, TaskOccurrence[]>();
  for (const occ of occurrences) {
    const groep = perJaar.get(occ.year);
    if (groep) groep.push(occ);
    else perJaar.set(occ.year, [occ]);
  }
  for (const [jaar, groep] of perJaar) {
    await db().hsetMany(
      g.occurrences(gardenId, jaar),
      Object.fromEntries(groep.map((occ) => [occ.id, { ...occ, status: 'verlopen' as const }])),
    );
    await db().srem(g.openOccurrences(gardenId, jaar), ...groep.map((occ) => occ.id));
  }
}

/**
 * Occurrences die een maand raken. Vensters over de jaargrens staan onder het
 * jaar waarin ze beginnen, dus het vorige jaar wordt altijd meegelezen.
 */
export async function agendaForMonth(
  gardenId: string,
  year: number,
  month: number,
  opts: { includeDone?: boolean } = {},
): Promise<AgendaItem[]> {
  const [thisYear, lastYear] = await Promise.all([
    loadYear(gardenId, year),
    loadYear(gardenId, year - 1),
  ]);
  const all = [...Object.values(lastYear), ...Object.values(thisYear)].filter((occ) =>
    rangeOverlapsMonth(occ.windowStart, occ.windowEnd, year, month),
  );
  return hydrate(gardenId, all, opts);
}

export async function agendaForYear(
  gardenId: string,
  year: number,
  opts: { includeDone?: boolean } = {},
): Promise<AgendaItem[]> {
  const [thisYear, lastYear] = await Promise.all([
    loadYear(gardenId, year),
    loadYear(gardenId, year - 1),
  ]);
  const all = [...Object.values(lastYear), ...Object.values(thisYear)].filter(
    (occ) => occ.windowStart.slice(0, 4) === String(year) || occ.windowEnd.slice(0, 4) === String(year),
  );
  return hydrate(gardenId, all, opts);
}

async function hydrate(
  gardenId: string,
  occurrences: TaskOccurrence[],
  opts: { includeDone?: boolean },
): Promise<AgendaItem[]> {
  const plants = new Map((await listPlants(gardenId)).map((p) => [p.id, p]));
  const taskCache = new Map<string, Map<string, CareTask>>();

  const items: AgendaItem[] = [];
  for (const occ of occurrences) {
    // Verlopen beurten zijn geen gebeurtenis: ze staan nergens in beeld.
    if (occ.status === 'verlopen') continue;
    if (!opts.includeDone && occ.status !== 'open') continue;
    const plant = plants.get(occ.plantId);
    if (!plant) continue;
    // Dode of verwijderde planten staan niet in de agenda (§4.2).
    if (plant.status !== 'levend' && occ.status === 'open') continue;
    if (!taskCache.has(plant.id)) {
      taskCache.set(plant.id, new Map((await listTasks(gardenId, plant.id)).map((t) => [t.id, t])));
    }
    const task = taskCache.get(plant.id)!.get(occ.taskId);
    if (!task) continue;
    items.push({ occurrence: occ, task, plant });
  }

  return items.sort(
    (a, b) =>
      a.occurrence.windowStart.localeCompare(b.occurrence.windowStart) ||
      a.plant.commonName.localeCompare(b.plant.commonName, 'nl'),
  );
}

/* ------------------------------------------------------------ afvinken enz. */

export async function findOccurrence(
  gardenId: string,
  occurrenceId: string,
): Promise<{ occurrence: TaskOccurrence; year: number }> {
  const year = Number(occurrenceId.split(':')[2]);
  if (!Number.isFinite(year)) throw new NotFoundError('Onbekende taak');
  const occ = await db().hget<TaskOccurrence>(g.occurrences(gardenId, year), occurrenceId);
  if (!occ) throw new NotFoundError('Taak niet gevonden');
  return { occurrence: occ, year };
}

async function save(gardenId: string, year: number, occ: TaskOccurrence) {
  await db().hset(g.occurrences(gardenId, year), occ.id, occ);
  if (occ.status === 'open') await db().sadd(g.openOccurrences(gardenId, year), occ.id);
  else await db().srem(g.openOccurrences(gardenId, year), occ.id);
}

export async function completeOccurrence(
  gardenId: string,
  occurrenceId: string,
  by: string,
  extra: { note?: string; photoUrl?: string } = {},
): Promise<TaskOccurrence> {
  const { occurrence, year } = await findOccurrence(gardenId, occurrenceId);
  const plant = await requirePlant(gardenId, occurrence.plantId);
  const next: TaskOccurrence = {
    ...occurrence,
    status: 'gedaan',
    doneAt: new Date().toISOString(),
    doneBy: by,
    note: extra.note?.trim() || undefined,
    photoUrl: extra.photoUrl || undefined,
    skipReason: undefined,
  };
  await save(gardenId, year, next);
  const task = (await listTasks(gardenId, plant.id)).find((t) => t.id === occurrence.taskId);
  await addLog(gardenId, {
    plantId: plant.id,
    kind: 'gedaan',
    text: task?.title ?? 'Taak afgerond',
    by,
    occurrenceId,
    photoUrl: next.photoUrl,
  });
  if (next.note) {
    await addLog(gardenId, {
      plantId: plant.id,
      kind: 'notitie',
      text: next.note,
      by,
      occurrenceId,
    });
  }
  return next;
}

export async function skipOccurrence(
  gardenId: string,
  occurrenceId: string,
  by: string,
  skipReason: string,
): Promise<TaskOccurrence> {
  const reason = skipReason.trim();
  if (reason.length < 3) {
    throw Object.assign(new Error('Geef een reden van minstens 3 tekens.'), { status: 400 });
  }
  const { occurrence, year } = await findOccurrence(gardenId, occurrenceId);
  const next: TaskOccurrence = {
    ...occurrence,
    status: 'overgeslagen',
    doneAt: new Date().toISOString(),
    doneBy: by,
    skipReason: reason,
  };
  await save(gardenId, year, next);
  const task = (await listTasks(gardenId, occurrence.plantId)).find(
    (t) => t.id === occurrence.taskId,
  );
  await addLog(gardenId, {
    plantId: occurrence.plantId,
    kind: 'overgeslagen',
    text: `${task?.title ?? 'Taak'} — ${reason}`,
    by,
    occurrenceId,
  });
  return next;
}

export async function reopenOccurrence(
  gardenId: string,
  occurrenceId: string,
  by: string,
): Promise<TaskOccurrence> {
  const { occurrence, year } = await findOccurrence(gardenId, occurrenceId);
  const next: TaskOccurrence = {
    ...occurrence,
    status: 'open',
    doneAt: undefined,
    doneBy: undefined,
    skipReason: undefined,
  };
  await save(gardenId, year, next);
  await addLog(gardenId, {
    plantId: occurrence.plantId,
    kind: 'heropend',
    text: 'Afvinken ongedaan gemaakt',
    by,
    occurrenceId,
  });
  return next;
}

/** Bij statuswijziging naar dood of verwijderd: open occurrences weg (§4.2). */
export async function dropOpenOccurrencesForPlant(
  gardenId: string,
  plantId: string,
  years: number[],
): Promise<void> {
  for (const year of years) {
    const all = await loadYear(gardenId, year);
    const ids = Object.values(all)
      .filter((o) => o.plantId === plantId && o.status === 'open')
      .map((o) => o.id);
    if (!ids.length) continue;
    await db().hdel(g.occurrences(gardenId, year), ...ids);
    await db().srem(g.openOccurrences(gardenId, year), ...ids);
  }
}

export async function upsertOccurrence(
  gardenId: string,
  year: number,
  occ: TaskOccurrence,
): Promise<void> {
  await save(gardenId, year, occ);
}
