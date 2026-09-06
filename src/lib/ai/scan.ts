import 'server-only';
import { z } from 'zod';
import { AI_MODEL, aiEnabled, anthropic, textOf } from './client';
import { PLANT_CATEGORIES } from '../types';
import type { Budget } from './care-profile';

export const MAX_GEVONDEN = 12;

export const scanSchema = z.object({
  plants: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        scientificName: z.string().trim().max(120).nullish(),
        category: z.enum(PLANT_CATEGORIES),
        confidence: z.coerce.number().min(0).max(1).default(0.5),
        where: z.string().trim().max(80).nullish(),
      }),
    )
    .max(MAX_GEVONDEN),
});

export type ScanTreffer = z.infer<typeof scanSchema>['plants'][number];

export interface ScanResult {
  plants: ScanTreffer[];
  /** Reden waarom er niets gevonden is, om in de interface te tonen. */
  note?: string;
}

/** Vaste systeeminstructie voor het scannen van een stuk tuin. */
export function scanSystemPrompt(outdoor: boolean): string {
  return [
    'Je bent tuinman in Nederland en herkent planten op een foto.',
    'Locatie: Nederland, klimaatzone 8a/8b.',
    'Op de foto staat een stuk van een tuin met meerdere planten.',
    'Noem elke plant die je duidelijk herkent, hooguit ' + MAX_GEVONDEN + '.',
    'Elke plant staat er één keer in, ook als je hem meerdere keren ziet.',
    'Noem geen gras van het gazon, geen onkruid en niets waarvan je de soort niet ziet.',
    'Gebruik de Nederlandse naam. Weet je die niet, gebruik dan de wetenschappelijke.',
    'confidence is hoe zeker je bent: 1 is zeker, onder 0.4 is een gok.',
    'where is een korte plaatsaanduiding in de foto, bijvoorbeeld "links vooraan".',
    outdoor
      ? 'De planten staan buiten.'
      : 'De foto is binnen genomen; het gaat om kamerplanten.',
    'Antwoord uitsluitend met JSON. Geen inleiding, geen uitleg, geen markdown-fences.',
    'Vind je niets, antwoord dan met {"plants": []}.',
    '',
    'JSON-schema:',
    JSON.stringify(
      {
        plants: [
          {
            name: 'string',
            scientificName: 'string of null',
            category: PLANT_CATEGORIES.join(' | '),
            confidence: 'getal 0-1',
            where: 'string of null',
          },
        ],
      },
      null,
      2,
    ),
  ].join('\n');
}

/**
 * Zoekt alle planten op een tuinfoto. Werpt niet: lukt het niet, dan komt er
 * een lege lijst met een melding terug en kan de gebruiker zelf invoeren.
 */
export async function scanGardenPhoto(input: {
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  outdoor: boolean;
  budget?: Budget;
}): Promise<ScanResult> {
  if (!aiEnabled) {
    return { plants: [], note: 'Er is geen AI-sleutel ingesteld. Voeg de planten zelf toe.' };
  }
  const deadline = input.budget?.deadline ?? Date.now() + 40_000;
  const resterend = deadline - Date.now();
  if (resterend < 5_000) {
    return { plants: [], note: 'Er was te weinig tijd om de foto te bekijken.' };
  }

  try {
    const stream = anthropic().messages.stream(
      {
        model: AI_MODEL,
        max_tokens: 2000,
        system: scanSystemPrompt(input.outdoor),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: input.imageMediaType,
                  data: input.imageBase64,
                },
              },
              { type: 'text', text: 'Welke planten staan op deze foto? Geef JSON.' },
            ],
          },
        ],
      },
      { timeout: resterend, maxRetries: 0 },
    );
    const parsed = scanSchema.safeParse(JSON.parse(textOf(await stream.finalMessage())));
    if (!parsed.success) {
      return { plants: [], note: 'Het antwoord over de foto was niet te lezen. Probeer het opnieuw.' };
    }
    // De zekerste bovenaan: die wil je als eerste langslopen.
    const plants = [...parsed.data.plants].sort((a, b) => b.confidence - a.confidence);
    return {
      plants,
      note: plants.length ? undefined : 'Op deze foto is geen plant herkend. Probeer een foto van dichterbij.',
    };
  } catch (error) {
    const melding = error instanceof Error ? error.message : 'onbekende fout';
    console.warn('[bloeiwijzer] tuinfoto scannen mislukt:', melding);
    return {
      plants: [],
      note: /timed out|timeout|abort/i.test(melding)
        ? 'Het bekijken van de foto duurde te lang. Probeer het opnieuw.'
        : 'Het bekijken van de foto lukte niet. Probeer het later opnieuw.',
    };
  }
}
