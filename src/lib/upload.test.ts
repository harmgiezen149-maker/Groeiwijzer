import { afterEach, describe, expect, it, vi } from 'vitest';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

/** De vlaggen worden bij het laden bepaald, dus per geval opnieuw importeren. */
async function laad(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [sleutel, waarde] of Object.entries(env)) {
    if (waarde === undefined) delete process.env[sleutel];
    else process.env[sleutel] = waarde;
  }
  return import('./upload');
}

afterEach(() => {
  delete process.env.VERCEL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  vi.resetModules();
});

describe('foto-opslag', () => {
  it('meldt op Vercel zonder Blob dat de opslag ontbreekt, in plaats van de schijf te proberen', async () => {
    const { storeImage, fotoOpslagBeschikbaar } = await laad({
      VERCEL: '1',
      BLOB_READ_WRITE_TOKEN: undefined,
    });
    expect(fotoOpslagBeschikbaar).toBe(false);
    await expect(storeImage(JPEG, 'tuin/t1')).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('Vercel Blob'),
    });
  });

  it('laat herkenning doorgaan als de foto niet bewaard kan worden', async () => {
    const { tryStoreImage } = await laad({ VERCEL: '1', BLOB_READ_WRITE_TOKEN: undefined });
    const uitkomst = await tryStoreImage(JPEG, 'tuin/t1');
    expect(uitkomst.stored).toBeNull();
    expect(uitkomst.note).toContain('herkenning');
  });

  it('gebruikt de schijf buiten Vercel', async () => {
    const { fotoOpslagBeschikbaar, blobEnabled } = await laad({
      VERCEL: undefined,
      BLOB_READ_WRITE_TOKEN: undefined,
    });
    expect(blobEnabled).toBe(false);
    expect(fotoOpslagBeschikbaar).toBe(true);
  });

  it('gebruikt Blob zodra het token er is', async () => {
    const { fotoOpslagBeschikbaar, blobEnabled } = await laad({
      VERCEL: '1',
      BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test',
    });
    expect(blobEnabled).toBe(true);
    expect(fotoOpslagBeschikbaar).toBe(true);
  });

  it('weigert een bestand dat geen afbeelding is', async () => {
    const { sniffImage } = await laad({});
    expect(() => sniffImage(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toThrow(/JPEG/);
  });
});
