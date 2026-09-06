import { withGardenParams, readJson } from '@/lib/api';
import { deletePlant, listPhotos, requirePlant, updatePlant } from '@/lib/plants';
import { listTasks } from '@/lib/tasks';
import { dropOpenOccurrencesForPlant, generateOccurrences } from '@/lib/occurrences';
import { addLog } from '@/lib/log';
import { parseOrThrow, plantPatch } from '@/lib/validation';

export const runtime = 'nodejs';

export const GET = withGardenParams<{ id: string }, unknown>(async (ctx, _req, params) => {
  const plant = await requirePlant(ctx.garden.id, params.id);
  return { plant, tasks: await listTasks(ctx.garden.id, plant.id) };
});

export const PATCH = withGardenParams<{ id: string }, unknown>(async (ctx, req, params) => {
  const patch = parseOrThrow(plantPatch, await readJson(req));
  const current = await requirePlant(ctx.garden.id, params.id);
  const statusWijzigt = patch.status && patch.status !== current.status;

  // Een hoofdfoto moet een foto van deze plant zijn, geen willekeurig adres.
  if (patch.photoUrl !== undefined && patch.photoUrl !== current.photoUrl) {
    const eigen = await listPhotos(ctx.garden.id, params.id);
    if (!eigen.some((foto) => foto.url === patch.photoUrl)) {
      throw Object.assign(new Error('Die foto hoort niet bij deze plant.'), { status: 400 });
    }
  }

  const plant = await updatePlant(ctx.garden.id, params.id, {
    ...patch,
    ...(statusWijzigt ? { statusChangedAt: new Date().toISOString() } : {}),
  });

  const jaar = new Date().getFullYear();
  if (statusWijzigt) {
    await addLog(ctx.garden.id, {
      plantId: plant.id,
      kind: 'status',
      text: `Status: ${plant.status}${plant.statusReason ? ` — ${plant.statusReason}` : ''}`,
      by: ctx.user.id,
    });
    if (plant.status === 'levend') {
      // Weer in gebruik: de agenda opnieuw vullen.
      await generateOccurrences(ctx.garden.id, jaar);
    } else {
      // Open taken verdwijnen; afgevinkte blijven staan (§4.2).
      await dropOpenOccurrencesForPlant(ctx.garden.id, plant.id, [jaar - 1, jaar, jaar + 1]);
    }
  }
  return { plant };
});

export const DELETE = withGardenParams<{ id: string }, unknown>(async (ctx, _req, params) => {
  await dropOpenOccurrencesForPlant(ctx.garden.id, params.id, [
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
  ]);
  await deletePlant(ctx.garden.id, params.id);
  return { ok: true };
});
