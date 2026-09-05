import { withGardenParams } from '@/lib/api';
import { assertOwner, removeMember } from '@/lib/garden';

export const runtime = 'nodejs';

export const DELETE = withGardenParams<{ userId: string }, unknown>(
  async (ctx, _req, params) => {
    await assertOwner(ctx.user.id, ctx.garden.id);
    if (params.userId === ctx.garden.ownerId) {
      throw Object.assign(new Error('De eigenaar kan niet verwijderd worden.'), { status: 400 });
    }
    await removeMember(ctx.garden.id, params.userId);
    return { ok: true };
  },
);
