import 'server-only';
import { usingUpstash } from './redis';
import { blobEnabled, fotoOpslagBeschikbaar } from './upload';
import { aiEnabled } from './ai/client';
import { plantnetEnabled } from './ai/plantnet';

export interface Voorziening {
  naam: string;
  aan: boolean;
  /** Wat er werkt, of wat er ontbreekt om het aan te zetten. */
  uitleg: string;
}

/**
 * Wat er in deze omgeving aanstaat. Zonder dit overzicht is een ontbrekende
 * sleutel pas te merken als een handeling stilvalt; nu staat het op één plek.
 */
export function voorzieningen(): Voorziening[] {
  const push = Boolean(
    (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY) &&
      process.env.VAPID_PRIVATE_KEY,
  );
  const mail = Boolean(process.env.AUTH_RESEND_KEY && process.env.RESEND_FROM);

  return [
    {
      naam: 'Database',
      aan: usingUpstash,
      uitleg: usingUpstash
        ? 'Upstash Redis is gekoppeld.'
        : 'Geen Redis gekoppeld; gegevens blijven niet bewaard.',
    },
    {
      naam: 'Plantherkenning',
      aan: plantnetEnabled,
      uitleg: plantnetEnabled
        ? 'PlantNet bepaalt de soort uit de foto.'
        : 'Zet PLANTNET_API_KEY om de soort door PlantNet te laten bepalen.',
    },
    {
      naam: 'Zorgprofiel',
      aan: aiEnabled,
      uitleg: aiEnabled
        ? 'Claude stelt het onderhoud voor.'
        : 'Zet ANTHROPIC_API_KEY om onderhoud te laten voorstellen.',
    },
    {
      naam: 'Foto bewaren',
      aan: fotoOpslagBeschikbaar,
      uitleg: blobEnabled
        ? 'Foto’s gaan naar Vercel Blob.'
        : fotoOpslagBeschikbaar
          ? 'Foto’s gaan naar de schijf van deze installatie.'
          : 'Koppel Vercel Blob; nu worden foto’s niet bewaard.',
    },
    {
      naam: 'E-mail',
      aan: mail,
      uitleg: mail
        ? 'Inloglink, uitnodiging en maandbericht gaan de deur uit.'
        : 'Zet AUTH_RESEND_KEY en RESEND_FROM voor inloglink, uitnodiging en maandbericht.',
    },
    {
      naam: 'Meldingen',
      aan: push,
      uitleg: push
        ? 'Pushmeldingen kunnen worden verstuurd.'
        : 'Zet VAPID_PUBLIC_KEY en VAPID_PRIVATE_KEY voor pushmeldingen.',
    },
  ];
}
