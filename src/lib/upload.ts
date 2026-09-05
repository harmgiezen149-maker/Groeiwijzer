import 'server-only';
import { put } from '@vercel/blob';
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
  url: string;
  contentType: string;
  size: number;
}

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
    const blob = await put(name, Buffer.from(bytes), {
      access: 'public',
      contentType: type,
      addRandomSuffix: false,
    });
    return { url: blob.url, contentType: type, size: bytes.byteLength };
  }

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const target = path.join(process.cwd(), 'public', 'uploads', name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  return { url: `/uploads/${name}`, contentType: type, size: bytes.byteLength };
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
