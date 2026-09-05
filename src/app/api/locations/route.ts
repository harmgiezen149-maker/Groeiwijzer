import { withGarden, readJson } from '@/lib/api';
import { createLocation, listLocations } from '@/lib/locations';
import { locationInput, parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

export const GET = withGarden(async (ctx) => ({
  locations: await listLocations(ctx.garden.id),
}));

export const POST = withGarden(async (ctx, req) => {
  const input = parseOrThrow(locationInput, await readJson(req));
  return { location: await createLocation(ctx.garden.id, input) };
});
