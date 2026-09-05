import { z } from 'zod';
import { withGarden, readJson } from '@/lib/api';
import { addSubscription, pushEnabled, removeSubscription } from '@/lib/push';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

const subscriptionInput = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().max(300).optional(),
});

export const POST = withGarden(async (ctx, req) => {
  if (!pushEnabled) {
    throw Object.assign(new Error('Pushmeldingen zijn nog niet ingesteld.'), { status: 503 });
  }
  const input = parseOrThrow(subscriptionInput, await readJson(req));
  await addSubscription(ctx.user.id, { ...input, createdAt: new Date().toISOString() });
  return { ok: true };
});

export const DELETE = withGarden(async (ctx, req) => {
  const endpoint = new URL(req.url).searchParams.get('endpoint');
  if (!endpoint) throw Object.assign(new Error('endpoint ontbreekt'), { status: 400 });
  await removeSubscription(ctx.user.id, endpoint);
  return { ok: true };
});
