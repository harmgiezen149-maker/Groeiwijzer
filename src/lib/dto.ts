import type { Importance, OccurrenceStatus, TaskType, WeatherFlag } from './types';

/** Wat de client van een agenda-item nodig heeft. Bewust plat en klein. */
export interface AgendaRow {
  id: string;
  plantId: string;
  plantName: string;
  photoUrl?: string;
  locationId: string;
  locationName: string;
  outdoor: boolean;
  taskId: string;
  taskType: TaskType;
  title: string;
  instructions: string;
  importance: Importance;
  windowStart: string;
  windowEnd: string;
  status: OccurrenceStatus;
  weatherFlag?: WeatherFlag;
  note?: string;
  skipReason?: string;
  doneAt?: string;
  doneByName?: string;
  occurrencePhotoUrl?: string;
}
