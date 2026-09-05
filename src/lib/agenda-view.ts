import 'server-only';
import { getUser } from './garden';
import { listLocations } from './locations';
import type { AgendaItem } from './occurrences';
import type { AgendaRow } from './dto';

export async function toRows(gardenId: string, items: AgendaItem[]): Promise<AgendaRow[]> {
  const locations = new Map((await listLocations(gardenId)).map((l) => [l.id, l]));
  const names = new Map<string, string>();
  for (const item of items) {
    const by = item.occurrence.doneBy;
    if (by && !names.has(by)) {
      const user = await getUser(by);
      names.set(by, user?.name ?? user?.email ?? 'iemand');
    }
  }

  return items.map(({ occurrence, task, plant }) => {
    const location = locations.get(plant.locationId);
    return {
      id: occurrence.id,
      plantId: plant.id,
      plantName: plant.commonName,
      photoUrl: plant.photoUrl,
      locationId: plant.locationId,
      locationName: location?.name ?? 'Zonder locatie',
      outdoor: location?.outdoor ?? true,
      taskId: task.id,
      taskType: task.type,
      title: task.title,
      instructions: task.instructions,
      importance: task.importance,
      windowStart: occurrence.windowStart,
      windowEnd: occurrence.windowEnd,
      status: occurrence.status,
      weatherFlag: occurrence.weatherFlag,
      note: occurrence.note,
      skipReason: occurrence.skipReason,
      doneAt: occurrence.doneAt,
      doneByName: occurrence.doneBy ? names.get(occurrence.doneBy) : undefined,
      occurrencePhotoUrl: occurrence.photoUrl,
    } satisfies AgendaRow;
  });
}
