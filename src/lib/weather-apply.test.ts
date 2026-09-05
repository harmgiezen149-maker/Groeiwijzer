import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './redis';
import { weatherKey } from './keys';
import { createGarden, upsertUser } from './garden';
import { listLocations } from './locations';
import { createPlant } from './plants';
import { createTasks } from './tasks';
import { generateOccurrences, loadYear } from './occurrences';
import { weatherFor } from './weather';
import { applyWeather } from './weather-apply';
import type { Forecast, ForecastDay } from './weather-rules';
import type { Garden, Location } from './types';

/**
 * Integratietest over de echte datalaag (in-memory store), met een
 * voorgekookte weersverwachting in de cache. Dekt scenario 6, 7 en 8.
 */

function dag(date: string, tmin: number, tmax: number, precip = 0): ForecastDay {
  return { date, tmin, tmax, precip };
}

async function seedForecast(garden: Garden, days: ForecastDay[]) {
  const forecast: Forecast = {
    lat: garden.lat,
    lon: garden.lon,
    fetchedAt: new Date().toISOString(),
    days,
  };
  await db().set(weatherKey(garden.lat, garden.lon), forecast, { ttlSeconds: 3600 });
}

async function opzet() {
  const user = await upsertUser({ email: `test-${Math.random()}@voorbeeld.nl` });
  const garden = await createGarden(user, 'Testtuin');
  const locaties = await listLocations(garden.id);
  const buiten = locaties.find((l) => l.outdoor)!;
  const binnen = locaties.find((l) => !l.outdoor)!;
  return { garden, buiten, binnen };
}

async function plantMet(
  gardenId: string,
  locatie: Location,
  naam: string,
  opties: { frost?: boolean; drought?: boolean } = {},
) {
  const plant = await createPlant(gardenId, {
    locationId: locatie.id,
    commonName: naam,
    category: locatie.outdoor ? 'struik' : 'kamerplant',
    quantity: 1,
    frostSensitive: opties.frost ?? false,
    droughtSensitive: opties.drought ?? false,
    source: 'handmatig',
  });
  await createTasks(gardenId, plant.id, [
    {
      type: 'snoeien',
      title: 'Snoeien',
      instructions: 'Snoei de plant terug.',
      schedule: { kind: 'jaarvenster', startMonth: 1, endMonth: 12, timesPerWindow: 1 },
      weatherRules: ['geen-vorst'],
      importance: 'aanbevolen',
      source: 'handmatig',
      enabled: true,
    },
  ]);
  return plant;
}

const VANDAAG = new Date().toISOString().slice(0, 10);
const jaar = Number(VANDAAG.slice(0, 4));

function komendeDagen(maker: (index: number) => ForecastDay): ForecastDay[] {
  return Array.from({ length: 10 }, (_, i) => maker(i));
}

function datumOver(dagen: number): string {
  const d = new Date(`${VANDAAG}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

describe('weerregels toepassen op de tuin', () => {
  let omgeving: Awaited<ReturnType<typeof opzet>>;

  beforeEach(async () => {
    omgeving = await opzet();
  });

  it('scenario 6: een kamerplant binnen krijgt bij vorst geen waarschuwing of taak', async () => {
    const { garden, binnen, buiten } = omgeving;
    const kamerplant = await plantMet(garden.id, binnen, 'Monstera', { frost: true });
    const buitenplant = await plantMet(garden.id, buiten, 'Hortensia', { frost: true });
    await generateOccurrences(garden.id, jaar);

    await seedForecast(
      garden,
      komendeDagen((i) => dag(datumOver(i - 3), i >= 3 && i <= 4 ? -3 : 6, 8)),
    );

    const state = await weatherFor(garden);
    await applyWeather(garden, state);

    const occurrences = Object.values(await loadYear(garden.id, jaar));
    const binnenOcc = occurrences.filter((o) => o.plantId === kamerplant.id);
    const buitenOcc = occurrences.filter((o) => o.plantId === buitenplant.id);

    expect(binnenOcc.every((o) => o.weatherFlag === undefined)).toBe(true);
    expect(binnenOcc.some((o) => o.taskId.startsWith('weer-'))).toBe(false);
    // De buitenplant krijgt hem wél, dus het verschil komt echt van outdoor.
    expect(buitenOcc.some((o) => o.taskId === 'weer-vorst')).toBe(true);
  });

  it('scenario 7: vorst vlagt snoeien als ongunstig en maakt één urgente taak', async () => {
    const { garden, buiten } = omgeving;
    const plant = await plantMet(garden.id, buiten, 'Vijg', { frost: true });
    await generateOccurrences(garden.id, jaar);
    await seedForecast(
      garden,
      komendeDagen((i) => dag(datumOver(i - 3), i === 3 || i === 4 ? -2 : 5, 8)),
    );

    const state = await weatherFor(garden);
    const eerste = await applyWeather(garden, state);
    expect(eerste.urgent).toHaveLength(1);

    const occurrences = Object.values(await loadYear(garden.id, jaar));
    const snoei = occurrences.find((o) => o.plantId === plant.id && o.taskId !== 'weer-vorst');
    expect(snoei?.weatherFlag).toBe('ongunstig');

    const urgent = occurrences.find((o) => o.taskId === 'weer-vorst');
    expect(urgent?.weatherFlag).toBe('urgent');

    // Nog een keer draaien maakt geen tweede urgente taak aan.
    const tweede = await applyWeather(garden, await weatherFor(garden));
    expect(tweede.nieuweTaken).toBe(0);
  });

  it('scenario 8: zeven droge dagen en 25 graden geeft een watertaak voor buiten', async () => {
    const { garden, buiten, binnen } = omgeving;
    const droog = await plantMet(garden.id, buiten, 'Rododendron', { drought: true });
    const kamer = await plantMet(garden.id, binnen, 'Ficus', { drought: true });
    await generateOccurrences(garden.id, jaar);

    await seedForecast(garden, [
      ...Array.from({ length: 7 }, (_, i) => dag(datumOver(i - 7), 12, 24, 0)),
      dag(VANDAAG, 14, 25),
      dag(datumOver(1), 14, 26),
    ]);

    await applyWeather(garden, await weatherFor(garden));

    const occurrences = Object.values(await loadYear(garden.id, jaar));
    expect(occurrences.some((o) => o.plantId === droog.id && o.taskId === 'weer-droogte')).toBe(true);
    expect(occurrences.some((o) => o.plantId === kamer.id && o.taskId === 'weer-droogte')).toBe(false);
  });

  it('haalt de vlag weer weg zodra het weer omslaat', async () => {
    const { garden, buiten } = omgeving;
    const plant = await plantMet(garden.id, buiten, 'Buxus');
    await generateOccurrences(garden.id, jaar);

    await seedForecast(garden, komendeDagen((i) => dag(datumOver(i - 3), i === 3 ? -2 : 5, 8)));
    await applyWeather(garden, await weatherFor(garden));
    let occ = Object.values(await loadYear(garden.id, jaar)).find((o) => o.plantId === plant.id);
    expect(occ?.weatherFlag).toBe('ongunstig');

    await seedForecast(garden, komendeDagen((i) => dag(datumOver(i - 3), 6, 12)));
    await applyWeather(garden, await weatherFor(garden));
    occ = Object.values(await loadYear(garden.id, jaar)).find((o) => o.plantId === plant.id);
    expect(occ?.weatherFlag).toBeUndefined();
  });
});
