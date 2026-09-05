import { z } from 'zod';
import { withGarden, readJson } from '@/lib/api';
import { saveMembership } from '@/lib/garden';
import { parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

const notifyInput = z.object({ email: z.boolean().optional(), push: z.boolean().optional() });

/** Meldingsvoorkeuren van het ingelogde lid; nooit van een ander lid. */
export const PATCH = withGarden(async (ctx, req) => {
  const patch = parseOrThrow(notifyInput, await readJson(req));
  const membership = { ...ctx.membership, notify: { ...ctx.membership.notify, ...patch } };
  await saveMembership(membership);
  return { membership };
});
