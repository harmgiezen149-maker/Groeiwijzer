import { describe, expect, it } from 'vitest';
import { upsertUser, createGarden } from './garden';
import { listLocations } from './locations';
import { createPlant } from './plants';
import { createTasks, listTasks, alleenBijDroogte, isKalenderWater } from './tasks';
import { generateOccurrences, loadYear } from './occurrences';

/**
 * Water geven hoort niet in de agenda: een schema van elke drie dagen levert
 * honderden regels op en overstemt de rest. De taak blijft op de plant staan,
 * maar dan gestuurd door droogte.
 */

const JAAR = new Date().getFullYear();

async function tuinMetWatertaak() {
  const user = await upsertUser({ email: `water-${Math.random()}@voorbeeld.nl` });
  const garden = await createGarden(user, 'Testtuin');
  const buiten = (await listLocations(garden.id)).find((l) => l.outdoor)!;
  const plant = await createPlant(garden.id, {
    locationId: buiten.id,
    commonName: 'Winterheide',
    category: 'struik',
    quantity: 1,
    frostSensitive: false,
    droughtSensitive: true,
    source: 'handmatig',
  });
  await createTasks(garden.id, plant.id, [
    {
      type: 'water',
      title: 'Regelmatig watergeven in droge periodes',
      instructions: 'Geef water bij de voet.',
      schedule: { kind: 'interval', startMonth: 4, endMonth: 9, intervalDays: 3 },
      weatherRules: [],
      importance: 'aanbevolen',
      source: 'ai',
      enabled: true,
    },
    {
      type: 'snoeien',
      title: 'Terugknippen na de bloei',
      instructions: 'Knip uitgebloeide takken terug.',
      schedule: { kind: 'jaarvenster', startMonth: 4, endMonth: 5, timesPerWindow: 1 },
      weatherRules: [],
      importance: 'aanbevolen',
      source: 'ai',
      enabled: true,
    },
  ]);
  return { garden, plant };
}

describe('water geven', () => {
  it('herkent een kalendermatige waterbeurt', () => {
    const schedule = { kind: 'interval', startMonth: 4, endMonth: 9, intervalDays: 3 } as const;
    expect(isKalenderWater({ type: 'water', schedule })).toBe(true);
    expect(isKalenderWater({ type: 'snoeien', schedule })).toBe(false);
    expect(
      isKalenderWater({
        type: 'water',
        schedule: { kind: 'weer-gestuurd', startMonth: 4, endMonth: 9 },
      }),
    ).toBe(false);
  });

  it('houdt het venster vast bij het omzetten naar droogte', () => {
    const om = alleenBijDroogte({
      schedule: { kind: 'interval', startMonth: 4, endMonth: 9, intervalDays: 3 },
      weatherRules: [],
    });
    expect(om.schedule).toEqual({ kind: 'weer-gestuurd', startMonth: 4, endMonth: 9 });
    expect(om.weatherRules).toEqual(['droogte']);
  });

  it('zet geen enkele waterbeurt in de agenda, wel de rest', async () => {
    const { garden, plant } = await tuinMetWatertaak();
    await generateOccurrences(garden.id, JAAR);

    const rijen = Object.values(await loadYear(garden.id, JAAR));
    expect(rijen.length).toBeGreaterThan(0);
    const taken = await listTasks(garden.id, plant.id);
    const water = taken.find((t) => t.type === 'water')!;
    expect(rijen.some((r) => r.taskId === water.id)).toBe(false);
    expect(rijen.some((r) => r.taskId === taken.find((t) => t.type === 'snoeien')!.id)).toBe(true);
  });

  it('schrijft een bestaande waterbeurt om naar weer-gestuurd', async () => {
    const { garden, plant } = await tuinMetWatertaak();
    await generateOccurrences(garden.id, JAAR);

    const water = (await listTasks(garden.id, plant.id)).find((t) => t.type === 'water')!;
    expect(water.schedule.kind).toBe('weer-gestuurd');
    expect(water.weatherRules).toContain('droogte');
    // De uitleg en het venster blijven staan: de kennis gaat niet verloren.
    expect(water.schedule.startMonth).toBe(4);
    expect(water.instructions).toBe('Geef water bij de voet.');
  });
});
