import { withGarden, readJson } from '@/lib/api';
import { createPlant, listPlants } from '@/lib/plants';
import { createTasks } from '@/lib/tasks';
import { generateOccurrences } from '@/lib/occurrences';
import { addLog } from '@/lib/log';
import { parseOrThrow, plantInput } from '@/lib/validation';

export const runtime = 'nodejs';

export const GET = withGarden(async (ctx, req) => {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('locationId');
  const category = url.searchParams.get('category');
  const archief = url.searchParams.get('archief') === '1';
  const zoek = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  let plants = await listPlants(ctx.garden.id);
  plants = plants.filter((p) => (archief ? p.status !== 'levend' : p.status === 'levend'));
  if (locationId) plants = plants.filter((p) => p.locationId === locationId);
  if (category) plants = plants.filter((p) => p.category === category);
  if (zoek) {
    plants = plants.filter((p) =>
      [p.commonName, p.scientificName, p.cultivar]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(zoek)),
    );
  }
  return { plants };
});

export const POST = withGarden(async (ctx, req) => {
  const { tasks, identification, photoCaption, ...rest } = parseOrThrow(
    plantInput,
    await readJson(req),
  );
  const plant = await createPlant(
    ctx.garden.id,
    {
      ...rest,
      identification: identification
        ? { ...identification, confirmedBy: ctx.user.id }
        : undefined,
    },
    { photoCaption },
  );
  const created = tasks?.length ? await createTasks(ctx.garden.id, plant.id, tasks) : [];
  await addLog(ctx.garden.id, {
    plantId: plant.id,
    kind: 'aangemaakt',
    text: `${plant.commonName} toegevoegd`,
    by: ctx.user.id,
  });
  if (created.length) await generateOccurrences(ctx.garden.id, new Date().getFullYear());
  return { plant, tasks: created };
});
