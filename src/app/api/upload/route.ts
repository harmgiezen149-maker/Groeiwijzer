import { withGarden } from '@/lib/api';
import { MAX_UPLOAD_BYTES, storeImage } from '@/lib/upload';

export const runtime = 'nodejs';

export const POST = withGarden(async (ctx, req) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw Object.assign(new Error('Geen bestand meegestuurd.'), { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('Bestand is groter dan 5 MB.'), { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await storeImage(bytes, `tuin/${ctx.garden.id}`);
  return stored;
});
