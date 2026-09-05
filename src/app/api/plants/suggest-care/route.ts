import { z } from 'zod';
import { withGarden, readJson } from '@/lib/api';
import { requireLocation } from '@/lib/locations';
import { requestCareProfile } from '@/lib/ai/care-profile';
import { assertWithinLimit } from '@/lib/ratelimit';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const input = z.object({
  name: z.string().trim().min(1, 'Vul eerst een naam in').max(120),
  category: z.string().trim().max(40).optional(),
  locationId: z.string().trim().min(1),
});

export const POST = withGarden(async (ctx, req) => {
  await assertWithinLimit(ctx.user.id, 'suggest-care');
  const { name, category, locationId } = parseOrThrow(input, await readJson(req));
  const location = await requireLocation(ctx.garden.id, locationId);
  return requestCareProfile({ name, category, outdoor: location.outdoor });
});
