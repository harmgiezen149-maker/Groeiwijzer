import { describe, expect, it } from 'vitest';
import { upsertUser, createGarden } from './garden';
import { listLocations } from './locations';
import { createPlant } from './plants';
import { createTasks, listTasks, alleenBijDroogte, waterPlanning } from './tasks';
import { generateOccurrences, loadYear } from './occurrences';

/**
 * Water geven hoort niet in de agenda: een schema van elke drie dagen levert
 * honderden regels op en overstemt de rest. De taak blijft op de plant staan,
 * maar dan gestuurd door droogte.
 */

const JAAR = new Date().getFullYear();

async function tuinMetWatertaak(binnen = false) {
  const user = await upsertUser({ email: `water-${Math.random()}@voorbeeld.nl` });
  const garden = await createGarden(user, 'Testtuin');
  const locatie = (await listLocations(garden.id)).find((l) => l.outdoor !== binnen)!;
  const plant = await createPlant(garden.id, {
    locationId: locatie.id,
    commonName: binnen ? 'Krulvaren' : 'Winterheide',
    category: binnen ? 'kamerplant' : 'struik',
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
  const kalender = { kind: 'interval', startMonth: 4, endMonth: 9, intervalDays: 3 } as const;

  it('stuurt water buiten op het weer en binnen op de week', () => {
    const buiten = waterPlanning(
      { type: 'water', source: 'ai', schedule: kalender, weatherRules: [] },
      true,
    );
    expect(buiten?.schedule.kind).toBe('weer-gestuurd');

    const binnen = waterPlanning(
      { type: 'water', source: 'ai', schedule: kalender, weatherRules: [] },
      false,
    );
    expect(binnen?.schedule).toEqual({
      kind: 'interval',
      startMonth: 1,
      endMonth: 12,
      intervalDays: 7,
    });
  });

  it('laat andere taken en eigen instellingen met rust', () => {
    expect(
      waterPlanning({ type: 'snoeien', source: 'ai', schedule: kalender, weatherRules: [] }, true),
    ).toBeNull();
    expect(
      waterPlanning(
        { type: 'water', source: 'handmatig', schedule: kalender, weatherRules: [] },
        true,
      ),
    ).toBeNull();
    expect(
      waterPlanning(
        {
          type: 'water',
          source: 'ai',
          schedule: { kind: 'weer-gestuurd', startMonth: 4, endMonth: 9 },
          weatherRules: ['droogte'],
        },
        true,
      ),
    ).toBeNull();
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

  it('geeft een kamerplant elke week een herinnering', async () => {
    const { garden, plant } = await tuinMetWatertaak(true);
    await generateOccurrences(garden.id, JAAR);

    const water = (await listTasks(garden.id, plant.id)).find((t) => t.type === 'water')!;
    expect(water.schedule).toEqual({
      kind: 'interval',
      startMonth: 1,
      endMonth: 12,
      intervalDays: 7,
    });

    const beurten = Object.values(await loadYear(garden.id, JAAR)).filter(
      (r) => r.taskId === water.id,
    );
    // Het jaar rond, dus rond de tweeënvijftig.
    expect(beurten.length).toBeGreaterThanOrEqual(50);
    expect(beurten.length).toBeLessThanOrEqual(53);
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
