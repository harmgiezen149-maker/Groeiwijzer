import { z } from 'zod';
import { withGarden, readJson } from '@/lib/api';
import { assertOwner, listMembers, saveGarden } from '@/lib/garden';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

const gardenPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  postcode: z.string().trim().max(12).optional(),
  disabledWeatherRules: z
    .array(
      z.enum(['geen-vorst', 'nachtvorst-alarm', 'droogte', 'geen-hitte', 'groeiseizoen']),
    )
    .optional(),
});

export const GET = withGarden(async (ctx) => ({
  garden: ctx.garden,
  members: await listMembers(ctx.garden.id),
  membership: ctx.membership,
}));

export const PATCH = withGarden(async (ctx, req) => {
  await assertOwner(ctx.user.id, ctx.garden.id);
  const patch = parseOrThrow(gardenPatch, await readJson(req));
  const garden = { ...ctx.garden, ...patch };
  await saveGarden(garden);
  return { garden };
});
