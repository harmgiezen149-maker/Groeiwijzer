import { withGardenParams, readJson } from '@/lib/api';
import { deleteLocation, updateLocation } from '@/lib/locations';
import { locationInput, parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

export const PATCH = withGardenParams<{ id: string }, unknown>(async (ctx, req, params) => {
  const patch = parseOrThrow(locationInput.partial(), await readJson(req));
  return { location: await updateLocation(ctx.garden.id, params.id, patch) };
});

export const DELETE = withGardenParams<{ id: string }, unknown>(async (ctx, _req, params) => {
  await deleteLocation(ctx.garden.id, params.id);
  return { ok: true };
});
