import { withGardenParams } from '@/lib/api';
import { addPhoto, listPhotos, removePhoto, requirePlant, updatePlant } from '@/lib/plants';
import { addLog } from '@/lib/log';
import { MAX_UPLOAD_BYTES, storeImage } from '@/lib/upload';

export const runtime = 'nodejs';

export const GET = withGardenParams<{ id: string }, unknown>(async (ctx, _req, params) => ({
  photos: await listPhotos(ctx.garden.id, params.id),
}));

export const POST = withGardenParams<{ id: string }, unknown>(async (ctx, req, params) => {
  const plant = await requirePlant(ctx.garden.id, params.id);
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw Object.assign(new Error('Geen bestand meegestuurd.'), { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('Bestand is groter dan 5 MB.'), { status: 413 });
  }
  const stored = await storeImage(
    new Uint8Array(await file.arrayBuffer()),
    `tuin/${ctx.garden.id}/plant/${plant.id}`,
  );
  const caption = String(form.get('caption') ?? '').trim() || undefined;
  await addPhoto(ctx.garden.id, plant.id, {
    url: stored.url,
    takenAt: new Date().toISOString(),
    caption,
  });
  if (!plant.photoUrl || form.get('hoofdfoto') === '1') {
    await updatePlant(ctx.garden.id, plant.id, { photoUrl: stored.url });
  }
  await addLog(ctx.garden.id, {
    plantId: plant.id,
    kind: 'foto',
    text: caption ?? 'Foto toegevoegd',
    by: ctx.user.id,
    photoUrl: stored.url,
  });
  return { photo: { url: stored.url, takenAt: new Date().toISOString(), caption } };
});

export const DELETE = withGardenParams<{ id: string }, unknown>(async (ctx, req, params) => {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) throw Object.assign(new Error('Geen foto opgegeven.'), { status: 400 });
  await removePhoto(ctx.garden.id, params.id, url);
  const plant = await requirePlant(ctx.garden.id, params.id);
  if (plant.photoUrl === url) {
    const rest = await listPhotos(ctx.garden.id, params.id);
    await updatePlant(ctx.garden.id, params.id, { photoUrl: rest[0]?.url });
  }
  return { ok: true };
});
