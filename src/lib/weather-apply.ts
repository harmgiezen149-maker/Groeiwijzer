import 'server-only';
import { db } from './redis';
import { g } from './keys';
import { listLocations } from './locations';
import { listLivePlants } from './plants';
import { ensureTask, listTasks } from './tasks';
import { loadYear, upsertOccurrence } from './occurrences';
import { addDays, daysBetween, ymd } from './dates';
import { ONGUNSTIG_VOOR } from './weather-rules';
import type { WeatherState } from './weather';
import type { CareTask, Garden, Plant, TaskOccurrence, WeatherFlag } from './types';

export const WEER_TAAK = {
  vorst: 'weer-vorst',
  droogte: 'weer-droogte',
} as const;

export interface WeatherApplyResult {
  gevlagd: number;
  nieuweTaken: number;
  urgent: { plantId: string; plantName: string; titel: string }[];
}

/**
 * Zet de weervlaggen op openstaande taken en maakt weer-gestuurde taken aan.
 * Regels gelden uitsluitend voor planten op een locatie met outdoor: true;
 * een kamerplant krijgt nooit een vorstwaarschuwing (§4.1, §7.2).
 */
export async function applyWeather(
  garden: Garden,
  state: WeatherState,
): Promise<WeatherApplyResult> {
  const { today, rules } = state;
  const jaar = Number(today.slice(0, 4));

  const [locations, plants] = await Promise.all([
    listLocations(garden.id),
    listLivePlants(garden.id),
  ]);
  const buiten = new Map(locations.map((l) => [l.id, l.outdoor]));
  const isBuiten = (plant: Plant) => buiten.get(plant.locationId) === true;

  const resultaat: WeatherApplyResult = { gevlagd: 0, nieuweTaken: 0, urgent: [] };

  /* ---------------------------------------------------- vlaggen bijwerken */

  const taakCache = new Map<string, Map<string, CareTask>>();
  async function taakVan(plantId: string, taskId: string) {
    if (!taakCache.has(plantId)) {
      taakCache.set(plantId, new Map((await listTasks(garden.id, plantId)).map((t) => [t.id, t])));
    }
    return taakCache.get(plantId)!.get(taskId);
  }

  const plantById = new Map(plants.map((p) => [p.id, p]));
  const horizon = addDays(today, 14);

  for (const kalenderjaar of [jaar - 1, jaar, jaar + 1]) {
    const occurrences = await loadYear(garden.id, kalenderjaar);
    for (const occ of Object.values(occurrences)) {
      if (occ.status !== 'open') continue;
      if (occ.windowEnd < today || occ.windowStart > horizon) continue;
      const plant = plantById.get(occ.plantId);
      if (!plant) continue;

      const vlag = await bepaalVlag(plant, occ, isBuiten(plant), rules, taakVan);
      if (vlag !== occ.weatherFlag) {
        await upsertOccurrence(garden.id, kalenderjaar, { ...occ, weatherFlag: vlag });
        resultaat.gevlagd++;
      }
    }
  }

  /* ------------------------------------------ weer-gestuurde taken maken */

  const vorst = rules['nachtvorst-alarm'];
  if (vorst) {
    for (const plant of plants) {
      if (!plant.frostSensitive || !isBuiten(plant)) continue;
      const gemaakt = await zetWeerTaak(garden.id, plant, jaar, {
        taskId: WEER_TAAK.vorst,
        type: 'winterbescherming',
        titel: 'Afdekken of binnenhalen',
        uitleg:
          'Er komt nachtvorst aan. Dek de plant af met vliesdoek of zet de pot tegen de gevel of binnen. Haal de bescherming weg zodra het weer boven nul blijft.',
        regel: 'nachtvorst-alarm',
        vanaf: today,
        tot: vorst.date ?? addDays(today, 1),
        vlag: 'urgent',
      });
      if (gemaakt) {
        resultaat.nieuweTaken++;
        resultaat.urgent.push({
          plantId: plant.id,
          plantName: plant.commonName,
          titel: 'Afdekken of binnenhalen',
        });
      }
    }
  }

  const droogte = rules.droogte;
  if (droogte) {
    for (const plant of plants) {
      if (!plant.droughtSensitive || !isBuiten(plant)) continue;
      const gemaakt = await zetWeerTaak(garden.id, plant, jaar, {
        taskId: WEER_TAAK.droogte,
        type: 'water',
        titel: 'Water geven',
        uitleg:
          'Het is een week droog gebleven en het wordt warm. Geef ruim water bij de voet van de plant, liefst in de ochtend of avond.',
        regel: 'droogte',
        vanaf: today,
        tot: addDays(today, 2),
      });
      if (gemaakt) resultaat.nieuweTaken++;
    }
  }

  return resultaat;
}

async function bepaalVlag(
  plant: Plant,
  occ: TaskOccurrence,
  buiten: boolean,
  rules: WeatherState['rules'],
  taakVan: (plantId: string, taskId: string) => Promise<CareTask | undefined>,
): Promise<WeatherFlag | undefined> {
  // Binnen geldt geen enkele weerregel.
  if (!buiten) return undefined;
  const taak = await taakVan(plant.id, occ.taskId);
  if (!taak) return undefined;
  if (occ.weatherFlag === 'urgent' && occ.taskId.startsWith('weer-')) return 'urgent';

  for (const [regel, typen] of Object.entries(ONGUNSTIG_VOOR)) {
    if (!rules[regel as keyof typeof rules]) continue;
    if (typen.includes(taak.type)) return 'ongunstig';
  }
  return undefined;
}

async function zetWeerTaak(
  gardenId: string,
  plant: Plant,
  jaar: number,
  input: {
    taskId: string;
    type: CareTask['type'];
    titel: string;
    uitleg: string;
    regel: CareTask['weatherRules'][number];
    vanaf: string;
    tot: string;
    vlag?: WeatherFlag;
  },
): Promise<boolean> {
  await ensureTask(gardenId, plant.id, input.taskId, {
    type: input.type,
    title: input.titel,
    instructions: input.uitleg,
    schedule: { kind: 'weer-gestuurd', startMonth: 1, endMonth: 12 },
    weatherRules: [input.regel],
    importance: 'noodzakelijk',
    source: 'ai',
    enabled: true,
  });

  // Deterministische id op basis van de dag, zodat één droge periode of
  // één vorstnacht niet elke cron-run een nieuwe taak oplevert.
  const seq = daysBetween(ymd(jaar, 1, 1), input.vanaf);
  const id = `${plant.id}:${input.taskId}:${jaar}:${seq}`;
  const bestaand = await db().hget<TaskOccurrence>(g.occurrences(gardenId, jaar), id);
  if (bestaand) return false;

  await upsertOccurrence(gardenId, jaar, {
    id,
    plantId: plant.id,
    taskId: input.taskId,
    year: jaar,
    seq,
    windowStart: input.vanaf,
    windowEnd: input.tot,
    status: 'open',
    weatherFlag: input.vlag,
    generatedAt: new Date().toISOString(),
  });
  return true;
}
