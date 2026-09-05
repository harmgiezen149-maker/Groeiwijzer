import 'server-only';
import { get, put } from '@vercel/blob';
import { newId } from './ids';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Vercel Blob is gekoppeld. */
export const blobEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/**
 * Op Vercel is de schijf alleen-lezen; daar kan alleen Blob de foto bewaren.
 * Lokaal mag `public/uploads` het overnemen, zodat de flow te bouwen is
 * zonder token.
 */
export const fotoOpslagBeschikbaar = blobEnabled || !process.env.VERCEL;

export const GEEN_OPSLAG =
  'Foto-opslag is niet ingesteld. Koppel Vercel Blob aan het project; dan wordt de foto bewaard.';

const SIGNATURES: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  {
    type: 'image/jpeg',
    ext: 'jpg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/png',
    ext: 'png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

/** Type wordt op magic bytes gecontroleerd, niet op de meegestuurde mimetype (§13). */
export function sniffImage(bytes: Uint8Array): { type: string; ext: string } {
  const match = SIGNATURES.find((s) => s.test(bytes));
  if (!match) {
    throw Object.assign(new Error('Alleen JPEG, PNG of WebP.'), { status: 400 });
  }
  return { type: match.type, ext: match.ext };
}

export interface StoredFile {
  /** Waar de app de foto opvraagt: het CDN-adres, of de eigen route. */
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

/** Pad waarop de app een besloten foto zelf uitserveert. */
export const FOTO_ROUTE = '/api/foto/';

/**
 * Een Blob-opslag is openbaar of besloten; dat staat vast bij het aanmaken.
 * Welke van de twee blijkt pas bij de eerste upload, dus die onthouden we
 * voor de rest van het proces.
 */
let toegang: 'public' | 'private' | null = null;

/**
 * Slaat een afbeelding op. Met BLOB_READ_WRITE_TOKEN gaat dat naar Vercel Blob;
 * zonder token en buiten Vercel naar `public/uploads`, zodat de flow lokaal te
 * testen is. Op Vercel zonder Blob is er geen plek om te schrijven: dan een
 * duidelijke melding in plaats van een schijffout.
 */
export async function storeImage(
  bytes: Uint8Array,
  prefix: string,
): Promise<StoredFile> {
  if (bytes.byteLength === 0) {
    throw Object.assign(new Error('Leeg bestand.'), { status: 400 });
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('Bestand is groter dan 5 MB.'), { status: 413 });
  }
  const { type, ext } = sniffImage(bytes);
  const name = `${prefix}/${newId()}.${ext}`;

  if (!fotoOpslagBeschikbaar) {
    throw Object.assign(new Error(GEEN_OPSLAG), { status: 503 });
  }

  if (blobEnabled) {
    const opties = { contentType: type, addRandomSuffix: false } as const;
    try {
      const blob = await put(name, Buffer.from(bytes), { access: toegang ?? 'public', ...opties });
      toegang ??= 'public';
      return { url: blob.url, pathname: name, contentType: type, size: bytes.byteLength };
    } catch (error) {
      // Een besloten opslag weigert 'public'. Dan gaat de foto er besloten in
      // en serveert de app hem zelf uit, achter de tuincontrole.
      if (toegang !== null || !isBeslotenOpslag(error)) throw error;
      await put(name, Buffer.from(bytes), { access: 'private', ...opties });
      toegang = 'private';
      return {
        url: `${FOTO_ROUTE}${name}`,
        pathname: name,
        contentType: type,
        size: bytes.byteLength,
      };
    }
  }

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const target = path.join(process.cwd(), 'public', 'uploads', name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  return { url: `/uploads/${name}`, pathname: name, contentType: type, size: bytes.byteLength };
}

function isBeslotenOpslag(error: unknown): boolean {
  return /private (access|store)/i.test(error instanceof Error ? error.message : String(error));
}

/**
 * Leest een foto die de app zelf heeft opgeslagen. Het adres zegt zelf hoe:
 * de eigen route betekent besloten, een volledig adres betekent openbaar.
 * Er wordt nooit een adres uit de browser opgehaald (§13).
 */
export async function readStoredImage(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith(FOTO_ROUTE)) {
      const gevonden = await get(url.slice(FOTO_ROUTE.length), { access: 'private' });
      if (!gevonden || gevonden.statusCode !== 200) return null;
      return new Uint8Array(await new Response(gevonden.stream).arrayBuffer());
    }
    if (!isBlobUrl(url)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (error) {
    console.warn('[bloeiwijzer] foto lezen mislukt', error);
    return null;
  }
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

/**
 * Zelfde als storeImage, maar zonder te werpen. Herkenning mag niet stuklopen
 * op een ontbrekende foto-opslag: de soort en het zorgprofiel zijn de kern,
 * de bewaarde foto is een extra (§6.1).
 */
export async function tryStoreImage(
  bytes: Uint8Array,
  prefix: string,
): Promise<{ stored: StoredFile | null; note?: string }> {
  if (!fotoOpslagBeschikbaar) {
    return { stored: null, note: `${GEEN_OPSLAG} De herkenning gaat gewoon door.` };
  }
  try {
    return { stored: await storeImage(bytes, prefix) };
  } catch (error) {
    console.warn('[bloeiwijzer] foto bewaren mislukt', error);
    return { stored: null, note: 'De foto kon niet worden bewaard; de herkenning gaat door.' };
  }
}
