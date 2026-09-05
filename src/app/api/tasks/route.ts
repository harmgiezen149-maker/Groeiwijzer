import { withGarden, readJson } from '@/lib/api';
import { requirePlant } from '@/lib/plants';
import { createTask, deleteTask, listTasks, updateTask } from '@/lib/tasks';
import { generateOccurrences } from '@/lib/occurrences';
import { careTaskInput, parseOrThrow } from '@/lib/validation';

export const runtime = 'nodejs';

function plantIdFrom(req: Request): string {
  const id = new URL(req.url).searchParams.get('plantId');
  if (!id) throw Object.assign(new Error('plantId ontbreekt'), { status: 400 });
  return id;
}

export const GET = withGarden(async (ctx, req) => {
  const plantId = plantIdFrom(req);
  await requirePlant(ctx.garden.id, plantId);
  return { tasks: await listTasks(ctx.garden.id, plantId) };
});

export const POST = withGarden(async (ctx, req) => {
  const plantId = plantIdFrom(req);
  await requirePlant(ctx.garden.id, plantId);
  const input = parseOrThrow(careTaskInput, await readJson(req));
  const task = await createTask(ctx.garden.id, plantId, input);
  await generateOccurrences(ctx.garden.id, new Date().getFullYear());
  return { task };
});

export const PATCH = withGarden(async (ctx, req) => {
  const plantId = plantIdFrom(req);
  const taskId = new URL(req.url).searchParams.get('taskId');
  if (!taskId) throw Object.assign(new Error('taskId ontbreekt'), { status: 400 });
  await requirePlant(ctx.garden.id, plantId);
  const patch = parseOrThrow(careTaskInput.partial(), await readJson(req));
  const task = await updateTask(ctx.garden.id, plantId, taskId, patch);
  await generateOccurrences(ctx.garden.id, new Date().getFullYear());
  return { task };
});

export const DELETE = withGarden(async (ctx, req) => {
  const plantId = plantIdFrom(req);
  const taskId = new URL(req.url).searchParams.get('taskId');
  if (!taskId) throw Object.assign(new Error('taskId ontbreekt'), { status: 400 });
  await requirePlant(ctx.garden.id, plantId);
  await deleteTask(ctx.garden.id, plantId, taskId);
  await generateOccurrences(ctx.garden.id, new Date().getFullYear());
  return { ok: true };
});
