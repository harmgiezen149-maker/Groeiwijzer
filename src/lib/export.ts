import 'server-only';
import { getGarden, listMembers } from './garden';
import { listLocations } from './locations';
import { listPhotos, listPlants } from './plants';
import { listTasks } from './tasks';
import { loadYear } from './occurrences';
import { readLog } from './log';
import { beschrijfPlanningTekst } from './schedule-text';
import type { CareTask, Garden, Location, LogEntry, Plant, TaskOccurrence } from './types';

export interface GardenExport {
  exportedAt: string;
  garden: Garden;
  members: { userId: string; role: string; email: string; joinedAt: string }[];
  locations: Location[];
  plants: (Plant & { tasks: CareTask[]; photos: { url: string; takenAt: string }[]; log: LogEntry[] })[];
  occurrences: Record<string, TaskOccurrence[]>;
}

export async function buildExport(gardenId: string, years: number[]): Promise<GardenExport> {
  const garden = await getGarden(gardenId);
  if (!garden) throw Object.assign(new Error('Tuin niet gevonden'), { status: 404 });

  const [members, locations, plants] = await Promise.all([
    listMembers(gardenId),
    listLocations(gardenId),
    listPlants(gardenId),
  ]);

  const verrijkt = await Promise.all(
    plants.map(async (plant) => ({
      ...plant,
      tasks: await listTasks(gardenId, plant.id),
      photos: await listPhotos(gardenId, plant.id),
      log: await readLog(gardenId, plant.id, 200),
    })),
  );

  const occurrences: Record<string, TaskOccurrence[]> = {};
  for (const year of years) {
    occurrences[String(year)] = Object.values(await loadYear(gardenId, year));
  }

  return {
    exportedAt: new Date().toISOString(),
    garden,
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      email: m.user?.email ?? '',
      joinedAt: m.joinedAt,
    })),
    locations,
    plants: verrijkt,
    occurrences,
  };
}

/* --------------------------------------------------------------------- CSV */

export function toCsv(rows: Record<string, string | number | undefined>[]): string {
  if (rows.length === 0) return '';
  const kolommen = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const regels = [kolommen.join(';')];
  for (const row of rows) {
    regels.push(kolommen.map((k) => veld(row[k])).join(';'));
  }
  // BOM zodat Excel de accenten goed leest.
  return '﻿' + regels.join('\r\n') + '\r\n';
}

function veld(waarde: string | number | undefined): string {
  if (waarde === undefined || waarde === null) return '';
  const tekst = String(waarde);
  return /[";\r\n]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

export function plantenCsv(data: GardenExport): string {
  const locatie = new Map(data.locations.map((l) => [l.id, l.name]));
  return toCsv(
    data.plants.map((plant) => ({
      naam: plant.commonName,
      wetenschappelijk: plant.scientificName ?? '',
      cultivar: plant.cultivar ?? '',
      soort: plant.category,
      locatie: locatie.get(plant.locationId) ?? '',
      aantal: plant.quantity,
      status: plant.status,
      vorstgevoelig: plant.frostSensitive ? 'ja' : 'nee',
      droogtegevoelig: plant.droughtSensitive ? 'ja' : 'nee',
      winterhardheid: plant.hardiness ?? '',
      labelcode: plant.labelCode ?? '',
      toegevoegd: plant.createdAt.slice(0, 10),
    })),
  );
}

export function takenCsv(data: GardenExport): string {
  const rijen = data.plants.flatMap((plant) =>
    plant.tasks.map((taak) => ({
      plant: plant.commonName,
      soortWerk: taak.type,
      titel: taak.title,
      planning: beschrijfPlanningTekst(taak.schedule),
      belang: taak.importance,
      weerregels: taak.weatherRules.join(' '),
      actief: taak.enabled ? 'ja' : 'nee',
      uitleg: taak.instructions,
    })),
  );
  return toCsv(rijen);
}

export function agendaCsv(data: GardenExport): string {
  const plant = new Map(data.plants.map((p) => [p.id, p]));
  const taak = new Map(data.plants.flatMap((p) => p.tasks.map((t) => [t.id, t] as const)));
  const rijen = Object.values(data.occurrences)
    .flat()
    .map((occ) => ({
      jaar: occ.year,
      plant: plant.get(occ.plantId)?.commonName ?? '',
      taak: taak.get(occ.taskId)?.title ?? occ.taskId,
      van: occ.windowStart,
      tot: occ.windowEnd,
      status: occ.status,
      gedaanOp: occ.doneAt?.slice(0, 10) ?? '',
      reden: occ.skipReason ?? '',
      notitie: occ.note ?? '',
    }))
    .sort((a, b) => a.van.localeCompare(b.van));
  return toCsv(rijen);
}

export function logboekCsv(data: GardenExport): string {
  const rijen = data.plants.flatMap((plant) =>
    plant.log.map((regel) => ({
      plant: plant.commonName,
      wanneer: regel.at.slice(0, 10),
      soort: regel.kind,
      tekst: regel.text,
      door: regel.byName ?? '',
    })),
  );
  return toCsv(rijen);
}
