import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Scenario 15: geeft het model ongeldige JSON, dan één nieuwe poging en
 * daarna een leeg profiel met melding — nooit een crash.
 */

const create = vi.fn();

vi.mock('./client', () => ({
  aiEnabled: true,
  AI_MODEL: 'test-model',
  anthropic: () => ({ messages: { create } }),
  textOf: (message: { content: { type: string; text: string }[] }) =>
    message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1'),
}));

const { requestCareProfile } = await import('./care-profile');

function antwoord(tekst: string) {
  return { content: [{ type: 'text', text: tekst }] };
}

const GELDIG = JSON.stringify({
  commonName: 'Hortensia',
  scientificName: 'Hydrangea macrophylla',
  category: 'struik',
  confidence: 0.86,
  frostSensitive: true,
  droughtSensitive: true,
  hardiness: 'winterhard tot ongeveer -15 °C',
  tasks: [
    {
      type: 'snoeien',
      title: 'Uitgebloeide bloemen wegknippen',
      instructions: 'Knip de oude bloemhoofden weg. Laat ze in de winter staan.',
      schedule: { kind: 'jaarvenster', startMonth: 3, endMonth: 4, timesPerWindow: 1 },
      weatherRules: ['geen-vorst'],
      importance: 'aanbevolen',
    },
  ],
});

describe('zorgprofiel opvragen', () => {
  beforeEach(() => create.mockReset());

  it('leest een geldig antwoord, ook met markdown-fences eromheen', async () => {
    create.mockResolvedValueOnce(antwoord('```json\n' + GELDIG + '\n```'));
    const { profile, note } = await requestCareProfile({ name: 'Hortensia', outdoor: true });
    expect(note).toBeUndefined();
    expect(profile?.commonName).toBe('Hortensia');
    expect(profile?.tasks).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('probeert het na ongeldige JSON precies één keer opnieuw', async () => {
    create.mockResolvedValueOnce(antwoord('Natuurlijk! Hier is je profiel:'));
    create.mockResolvedValueOnce(antwoord(GELDIG));
    const { profile } = await requestCareProfile({ name: 'Hortensia', outdoor: true });
    expect(create).toHaveBeenCalledTimes(2);
    expect(profile?.commonName).toBe('Hortensia');
  });

  it('geeft na twee mislukte pogingen een leeg profiel met melding', async () => {
    create.mockResolvedValue(antwoord('geen JSON'));
    const { profile, note } = await requestCareProfile({ name: 'Hortensia', outdoor: true });
    expect(create).toHaveBeenCalledTimes(2);
    expect(profile).toBeNull();
    expect(note).toContain('zelf in');
  });

  it('haalt bij een binnenlocatie de buitentaken weg', async () => {
    create.mockResolvedValueOnce(
      antwoord(
        JSON.stringify({
          commonName: 'Monstera',
          category: 'kamerplant',
          confidence: 0.9,
          frostSensitive: true,
          droughtSensitive: false,
          tasks: [
            {
              type: 'winterbescherming',
              title: 'Afdekken tegen vorst',
              instructions: 'Dek de plant af.',
              schedule: { kind: 'jaarvenster', startMonth: 11, endMonth: 2, timesPerWindow: 1 },
              weatherRules: ['nachtvorst-alarm'],
              importance: 'noodzakelijk',
            },
            {
              type: 'water',
              title: 'Water geven',
              instructions: 'Geef water als de bovenlaag droog is.',
              schedule: { kind: 'interval', startMonth: 1, endMonth: 12, intervalDays: 7 },
              weatherRules: ['droogte'],
              importance: 'noodzakelijk',
            },
          ],
        }),
      ),
    );
    const { profile } = await requestCareProfile({ name: 'Monstera', outdoor: false });
    expect(profile?.frostSensitive).toBe(false);
    expect(profile?.tasks.map((t) => t.type)).toEqual(['water']);
    expect(profile?.tasks[0].weatherRules).toEqual([]);
  });

  it('probeert niets opnieuw bij een sleutelfout', async () => {
    create.mockImplementationOnce(async () => {
      throw new Error('401 invalid x-api-key');
    });
    const { profile, note } = await requestCareProfile({ name: 'Hortensia', outdoor: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(profile).toBeNull();
    expect(note).toBeTruthy();
  });
});
