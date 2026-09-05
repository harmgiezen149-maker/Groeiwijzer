import 'server-only';
import { put } from '@vercel/blob';
import { newId } from './ids';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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
 * zonder token (lokale bouw) naar `public/uploads`, zodat de flow te testen is.
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

  if (process.env.BLOB_READ_WRITE_TOKEN) {
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
