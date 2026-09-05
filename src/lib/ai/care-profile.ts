import 'server-only';
import { AI_MODEL, aiEnabled, anthropic, textOf } from './client';
import { careProfileSchema, type CareProfile } from './schema';
import type { PlantCandidate } from '../types';

/** Vaste systeeminstructie voor het zorgprofiel (OVERDRACHT §6.5). */
export function systemPrompt(outdoor: boolean): string {
  return [
    'Je bent tuinman in Nederland en stelt onderhoudsschema\'s op.',
    'Locatie: Nederland, klimaatzone 8a/8b, gematigd maritiem klimaat.',
    'Antwoord uitsluitend met JSON. Geen inleiding, geen uitleg, geen markdown-fences.',
    'Maanden zijn getallen van 1 tot en met 12. Maximaal 8 taken per plant.',
    'Het veld instructions bevat 2 tot 5 zinnen in het Nederlands, praktisch en concreet.',
    'Weet je iets niet, gebruik dan null. Nooit gokken.',
    outdoor
      ? 'De plant staat buiten; weerafhankelijke taken zijn toegestaan.'
      : 'De plant staat BINNEN. Geef geen taken die op buitenweer slaan: geen winterbescherming, geen vorstbescherming, en geen weerregels die met vorst of hitte buiten te maken hebben.',
    '',
    'JSON-schema:',
    JSON.stringify(
      {
        commonName: 'string',
        scientificName: 'string of null',
        category:
          'boom | struik | haag | vaste plant | eenjarige | bolgewas | klimplant | gras | kruid | groente | fruit | kamerplant | overig',
        confidence: 'getal 0-1',
        frostSensitive: 'boolean',
        droughtSensitive: 'boolean',
        hardiness: 'string of null',
        tasks: [
          {
            type:
              'snoeien | bemesten | verpotten | water | winterbescherming | ziektecontrole | delen | oogsten | planten | overig',
            title: 'string',
            instructions: 'string, 2-5 zinnen',
            schedule:
              '{ kind: "jaarvenster", startMonth, endMonth, timesPerWindow } of { kind: "interval", startMonth, endMonth, intervalDays } of { kind: "meerjaarlijks", startMonth, endMonth, everyYears, anchorYear } of { kind: "weer-gestuurd", startMonth, endMonth }',
            weatherRules:
              'array met nul of meer van: geen-vorst, nachtvorst-alarm, droogte, geen-hitte, groeiseizoen',
            importance: 'noodzakelijk | aanbevolen | optioneel',
          },
        ],
      },
      null,
      2,
    ),
  ].join('\n');
}

export interface ProfileResult {
  profile: CareProfile | null;
  /** Reden waarom er geen profiel is, om in de interface te tonen. */
  note?: string;
}

export interface ProfileInput {
  name?: string;
  category?: string;
  outdoor: boolean;
  /** Kandidaten van PlantNet, als tweede bron. */
  candidates?: PlantCandidate[];
  /** Tekst van een productpagina bij URL-import. */
  pageText?: string;
  imageBase64?: string;
  imageMediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Vraagt het zorgprofiel op. Bij een schemafout één nieuwe poging, daarna een
 * leeg profiel met melding (§6.5). Deze functie werpt niet bij een AI-fout:
 * de gebruiker moet altijd verder kunnen met handmatig invullen.
 */
export async function requestCareProfile(input: ProfileInput): Promise<ProfileResult> {
  if (!aiEnabled) {
    return { profile: null, note: 'Er is geen AI-sleutel ingesteld. Vul het onderhoud zelf in.' };
  }

  const blocks: Parameters<typeof buildUserMessage>[0] = input;
  let laatsteFout = '';

  for (let poging = 0; poging < 2; poging++) {
    try {
      const message = await anthropic().messages.create({
        model: AI_MODEL,
        max_tokens: 3000,
        system: systemPrompt(input.outdoor),
        messages: [{ role: 'user', content: buildUserMessage(blocks, poging > 0) }],
      });
      const parsed = careProfileSchema.safeParse(JSON.parse(textOf(message)));
      if (parsed.success) {
        return { profile: normalise(parsed.data, input.outdoor) };
      }
      laatsteFout = parsed.error.issues[0]?.message ?? 'schema klopt niet';
    } catch (error) {
      laatsteFout = error instanceof Error ? error.message : 'onbekende fout';
      // Een netwerk- of sleutelfout heeft geen tweede poging nodig.
      if (poging === 0 && /api key|401|403/i.test(laatsteFout)) break;
    }
  }

  console.warn('[bloeiwijzer] zorgprofiel mislukt:', laatsteFout);
  return {
    profile: null,
    note: 'Het onderhoudsvoorstel lukte niet. Vul de taken zelf in of probeer het later opnieuw.',
  };
}

type UserBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
    };

function buildUserMessage(input: ProfileInput, herhaling: boolean): UserBlock[] {
  const blocks: UserBlock[] = [];

  if (input.imageBase64) {
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.imageMediaType ?? 'image/jpeg',
        data: input.imageBase64,
      },
    });
  }

  const regels: string[] = [];
  if (input.name) regels.push(`Naam volgens de gebruiker: ${input.name}`);
  if (input.category) regels.push(`Categorie volgens de gebruiker: ${input.category}`);
  regels.push(`Standplaats: ${input.outdoor ? 'buiten' : 'binnen'}`);

  if (input.candidates?.length) {
    regels.push(
      'Kandidaten uit PlantNet (naam en score), gebruik deze als tweede bron:',
      ...input.candidates
        .slice(0, 5)
        .map((c) => `- ${c.name}${c.scientificName ? ` (${c.scientificName})` : ''} — ${(c.score * 100).toFixed(0)}%`),
    );
  }

  if (input.pageText) {
    regels.push('Tekst van de productpagina:', input.pageText.slice(0, 6000));
  }

  regels.push(
    '',
    'Bepaal de plant en geef het onderhoudsprofiel als JSON volgens het schema.',
  );
  if (herhaling) {
    regels.push(
      'Je vorige antwoord voldeed niet aan het schema. Geef nu alleen geldige JSON, zonder tekst eromheen.',
    );
  }

  blocks.push({ type: 'text', text: regels.join('\n') });
  return blocks;
}

/** Vangnet: binnen betekent binnen, ook als het model zich vergist. */
function normalise(profile: CareProfile, outdoor: boolean): CareProfile {
  if (outdoor) return profile;
  return {
    ...profile,
    frostSensitive: false,
    tasks: profile.tasks
      .filter((task) => task.type !== 'winterbescherming')
      .map((task) => ({ ...task, weatherRules: [] })),
  };
}
