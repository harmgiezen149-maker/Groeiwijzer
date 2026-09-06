import 'server-only';
import type { PlantCandidate } from '../types';

export const plantnetEnabled = Boolean(process.env.PLANTNET_API_KEY);

const ENDPOINT = 'https://my-api.plantnet.org/v2/identify/all';

interface PlantNetResponse {
  results?: {
    score?: number;
    species?: {
      scientificNameWithoutAuthor?: string;
      commonNames?: string[];
    };
    images?: {
      author?: string;
      license?: string;
      url?: { o?: string; m?: string; s?: string };
    }[];
  }[];
}

/** De naamsvermelding die bij een foto van PlantNet hoort. */
function bronvermelding(image: { author?: string; license?: string }): string {
  const delen = ['PlantNet'];
  if (image.author) delen.push(image.author);
  if (image.license) delen.push(image.license);
  return delen.join(' · ');
}

/**
 * PlantNet bepaalt de soort uit de foto. Valt hij weg, dan draait alleen
 * Claude en meldt de app dat de tweede controle ontbrak (§6.1).
 */
export async function identifyWithPlantNet(
  bytes: Uint8Array,
  contentType: string,
): Promise<{ candidates: PlantCandidate[]; note?: string }> {
  if (!plantnetEnabled) {
    return { candidates: [], note: 'PlantNet is niet ingesteld; alleen de AI-controle is gedaan.' };
  }

  try {
    const form = new FormData();
    form.append('images', new Blob([new Uint8Array(bytes)], { type: contentType }), 'plant.jpg');
    form.append('organs', 'auto');

    const url = `${ENDPOINT}?api-key=${encodeURIComponent(process.env.PLANTNET_API_KEY!)}&lang=nl&nb-results=5&include-related-images=true`;
    const res = await fetch(url, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return {
        candidates: [],
        note: `PlantNet gaf geen antwoord (${res.status}); alleen de AI-controle is gedaan.`,
      };
    }
    const data = (await res.json()) as PlantNetResponse;
    const candidates = (data.results ?? [])
      .slice(0, 5)
      .map<PlantCandidate>((result) => {
        const image = result.images?.find((i) => i.url?.m ?? i.url?.o ?? i.url?.s);
        return {
          name:
            result.species?.commonNames?.[0] ??
            result.species?.scientificNameWithoutAuthor ??
            'Onbekend',
          scientificName: result.species?.scientificNameWithoutAuthor,
          score: Math.max(0, Math.min(1, result.score ?? 0)),
          source: 'plantnet',
          imageUrl: image ? (image.url!.m ?? image.url!.o ?? image.url!.s) : undefined,
          credit: image ? bronvermelding(image) : undefined,
        };
      })
      .filter((c) => c.name !== 'Onbekend');
    return { candidates };
  } catch (error) {
    console.warn('[bloeiwijzer] PlantNet mislukt', error);
    return { candidates: [], note: 'PlantNet was niet bereikbaar; alleen de AI-controle is gedaan.' };
  }
}
