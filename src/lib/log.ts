import 'server-only';
import { db } from './redis';
import { g } from './keys';
import { newId } from './ids';
import { getUser } from './garden';
import type { LogEntry, LogKind } from './types';

const MAX_LOG = 200;

export async function addLog(
  gardenId: string,
  entry: {
    plantId: string;
    kind: LogKind;
    text: string;
    by?: string;
    occurrenceId?: string;
    photoUrl?: string;
  },
): Promise<LogEntry> {
  const author = entry.by ? await getUser(entry.by) : null;
  const byName = author?.name ?? author?.email;
  const row: LogEntry = {
    id: newId(),
    at: new Date().toISOString(),
    byName,
    ...entry,
  };
  const key = g.plantLog(gardenId, entry.plantId);
  await db().lpush(key, row);
  await db().ltrim(key, 0, MAX_LOG - 1);
  return row;
}

export async function readLog(
  gardenId: string,
  plantId: string,
  limit = 50,
): Promise<LogEntry[]> {
  return db().lrange<LogEntry>(g.plantLog(gardenId, plantId), 0, limit - 1);
}
