import 'server-only';
import { db } from './redis';
import { keyFor } from './keys';
import { newId } from './ids';

/** Een verwijzing leeft net lang genoeg om het profiel op te halen. */
const TTL_SECONDEN = 30 * 60;

/**
 * De herkenning bewaart de foto en het zorgprofiel vraagt hem daarna op.
 * De browser krijgt alleen deze verwijzing, nooit een adres dat de server
 * blind ophaalt: zo kan niemand de server een willekeurige URL laten
 * bezoeken (§13, dezelfde reden als bij URL-import).
 */
export async function bewaarFotoVerwijzing(gardenId: string, url: string): Promise<string> {
  const ref = newId();
  await db().set(keyFor(gardenId, 'fotoref', ref), url, { ttlSeconds: TTL_SECONDEN });
  return ref;
}

export async function haalFotoVerwijzing(gardenId: string, ref: string): Promise<string | null> {
  if (!/^[0-9a-f]{32}$/.test(ref)) return null;
  return db().get<string>(keyFor(gardenId, 'fotoref', ref));
}

/** Alleen adressen die de app zelf bij Vercel Blob heeft neergezet. */
export function isBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}
