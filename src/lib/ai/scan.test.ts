import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * De tuinfoto: alle planten op één beeld. Een scan die niet klopt mag de
 * gebruiker nooit blokkeren — er komt dan een lege lijst met melding terug.
 */

const create = vi.fn();

vi.mock('./client', () => ({
  aiEnabled: true,
  AI_MODEL: 'test-model',
  anthropic: () => ({
    messages: {
      stream: (...args: unknown[]) => ({ finalMessage: () => create(...args) }),
    },
  }),
  textOf: (message: { content: { type: string; text: string }[] }) =>
    message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1'),
}));

const { scanGardenPhoto } = await import('./scan');

function antwoord(tekst: string) {
  return { content: [{ type: 'text', text: tekst }] };
}

const INVOER = {
  imageBase64: 'aGFsbG8=',
  imageMediaType: 'image/jpeg' as const,
  outdoor: true,
};

describe('scanGardenPhoto', () => {
  beforeEach(() => {
    // mockReset laat de implementatie van de vorige test staan; expliciet
    // leegmaken, anders lekt een antwoord door naar de volgende test.
    create.mockReset();
    create.mockImplementation(() => antwoord('{"plants": []}'));
  });

  it('geeft de zekerste plant bovenaan', async () => {
    create.mockResolvedValue(
      antwoord(
        JSON.stringify({
          plants: [
            { name: 'Buxus', category: 'struik', confidence: 0.4, where: 'links' },
            { name: 'Lavendel', scientificName: 'Lavandula', category: 'vaste plant', confidence: 0.9 },
          ],
        }),
      ),
    );

    const { plants, note } = await scanGardenPhoto(INVOER);

    expect(note).toBeUndefined();
    expect(plants.map((p) => p.name)).toEqual(['Lavendel', 'Buxus']);
    expect(plants[0].scientificName).toBe('Lavandula');
    expect(plants[1].where).toBe('links');
  });

  it('meldt het netjes als er niets herkend is', async () => {
    create.mockResolvedValue(antwoord(JSON.stringify({ plants: [] })));

    const { plants, note } = await scanGardenPhoto(INVOER);

    expect(plants).toEqual([]);
    expect(note).toMatch(/geen plant/i);
  });

  it('valt terug op een melding bij een antwoord dat niet klopt', async () => {
    create.mockResolvedValue(antwoord('{ "plants": [{ "name": "" }] }'));

    const { plants, note } = await scanGardenPhoto(INVOER);

    expect(plants).toEqual([]);
    expect(note).toMatch(/niet te lezen/i);
  });

  it('werpt niet als het model onbereikbaar is', async () => {
    create.mockImplementation(() => {
      throw new Error('Connection error');
    });

    const { plants, note } = await scanGardenPhoto(INVOER);

    expect(plants).toEqual([]);
    expect(note).toMatch(/lukte niet/i);
  });

  it('vraagt niets meer als de tijd al om is', async () => {
    const { plants, note } = await scanGardenPhoto({
      ...INVOER,
      budget: { deadline: Date.now() - 1 },
    });

    expect(create).not.toHaveBeenCalled();
    expect(plants).toEqual([]);
    expect(note).toMatch(/te weinig tijd/i);
  });
});
