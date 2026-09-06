import { describe, expect, it } from 'vitest';
import { upsertUser, createGarden } from './garden';
import { listLocations } from './locations';
import { createPlant } from './plants';
import { createTasks, listTasks } from './tasks';
import {
  agendaForDay,
  completeOccurrence,
  generateOccurrences,
  loadYear,
} from './occurrences';
import { addDays, todayInAmsterdam } from './dates';
import type { Month } from './types';

/**
 * De agenda gaat over één dag. Van een terugkerende taak staat er hooguit één
 * beurt in beeld; wat daarvoor lag is verlopen, niet blijven staan.
 */

const VANDAAG = todayInAmsterdam();
const JAAR = Number(VANDAAG.slice(0, 4));

async function tuinMet(taak: Parameters<typeof createTasks>[2][number]) {
  const user = await upsertUser({ email: `dag-${Math.random()}@voorbeeld.nl` });
  const garden = await createGarden(user, 'Testtuin');
  const buiten = (await listLocations(garden.id)).find((l) => l.outdoor)!;
  const plant = await createPlant(garden.id, {
    locationId: buiten.id,
    commonName: 'Buxus',
    category: 'struik',
    quantity: 1,
    frostSensitive: false,
    droughtSensitive: false,
    source: 'handmatig',
  });
  await createTasks(garden.id, plant.id, [taak]);
  await generateOccurrences(garden.id, JAAR);
  return { garden, plant };
}

const ELKE_TWEE_DAGEN = {
  type: 'ziektecontrole' as const,
  title: 'Controleren op plagen',
  instructions: 'Kijk onder de bladeren.',
  schedule: { kind: 'interval' as const, startMonth: 1 as Month, endMonth: 12 as Month, intervalDays: 2 },
  weatherRules: [],
  importance: 'aanbevolen' as const,
  source: 'handmatig' as const,
  enabled: true,
};

describe('agenda van één dag', () => {
  it('toont één beurt per taak, hoeveel er ook gepland staan', async () => {
    const { garden } = await tuinMet(ELKE_TWEE_DAGEN);
    const alle = Object.values(await loadYear(garden.id, JAAR));
    expect(alle.length).toBeGreaterThan(150);

    const { vandaag } = await agendaForDay(garden.id, VANDAAG);
    expect(vandaag).toHaveLength(1);
    expect(vandaag[0].occurrence.windowStart <= VANDAAG).toBe(true);
    expect(vandaag[0].occurrence.windowEnd >= VANDAAG).toBe(true);
  });

  it('schrijft gemiste beurten af in plaats van ze te laten staan', async () => {
    const { garden } = await tuinMet(ELKE_TWEE_DAGEN);
    await agendaForDay(garden.id, VANDAAG);

    const alle = Object.values(await loadYear(garden.id, JAAR));
    const voorbij = alle.filter((occ) => occ.windowEnd < VANDAAG);
    expect(voorbij.length).toBeGreaterThan(0);
    expect(voorbij.every((occ) => occ.status === 'verlopen')).toBe(true);
    // Alles na vandaag blijft gewoon staan.
    expect(alle.filter((occ) => occ.windowStart > VANDAAG).every((o) => o.status === 'open')).toBe(
      true,
    );
  });

  it('laat na afvinken vandaag niets meer zien, morgen weer wel', async () => {
    const { garden } = await tuinMet(ELKE_TWEE_DAGEN);
    const { vandaag } = await agendaForDay(garden.id, VANDAAG);
    await completeOccurrence(garden.id, vandaag[0].occurrence.id, 'tester');

    const na = await agendaForDay(garden.id, VANDAAG);
    expect(na.vandaag).toHaveLength(0);

    const overmorgen = await agendaForDay(garden.id, addDays(VANDAAG, 2));
    expect(overmorgen.vandaag).toHaveLength(1);
  });

  it('zet wat er nog moet komen onder binnenkort, één regel per taak', async () => {
    const volgendeMaand = ((Number(VANDAAG.slice(5, 7)) % 12) + 1) as Month;
    const { garden, plant } = await tuinMet({
      ...ELKE_TWEE_DAGEN,
      title: 'Snoeien',
      type: 'snoeien',
      schedule: {
        kind: 'jaarvenster' as const,
        startMonth: volgendeMaand,
        endMonth: volgendeMaand,
        timesPerWindow: 1,
      },
    });
    const taak = (await listTasks(garden.id, plant.id))[0];

    // Ruim vooruit kijken, zodat het venster van volgende maand meetelt.
    const { vandaag, binnenkort } = await agendaForDay(garden.id, VANDAAG, { vooruitDagen: 60 });
    expect(vandaag).toHaveLength(0);
    expect(binnenkort).toHaveLength(1);
    expect(binnenkort[0].task.id).toBe(taak.id);
  });
});
