import 'server-only';
import webpush from 'web-push';
import { db } from './redis';
import { userKey } from './keys';
import { todayInAmsterdam } from './dates';
import type { PushSubscriptionRecord } from './types';

export const pushEnabled = Boolean(
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
);

let ingesteld = false;
function configure() {
  if (ingesteld || !pushEnabled) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ingesteld = true;
}

export async function addSubscription(
  userId: string,
  subscription: PushSubscriptionRecord,
): Promise<void> {
  await db().sadd(userKey.push(userId), JSON.stringify(subscription));
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  const alle = await listSubscriptions(userId);
  const weg = alle.filter((s) => s.endpoint === endpoint);
  if (weg.length) await db().srem(userKey.push(userId), ...weg.map((s) => JSON.stringify(s)));
}

export async function listSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
  const rauw = await db().smembers(userKey.push(userId));
  return rauw
    .map((item) => {
      try {
        return JSON.parse(item) as PushSubscriptionRecord;
      } catch {
        return null;
      }
    })
    .filter((s): s is PushSubscriptionRecord => Boolean(s?.endpoint));
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Sleutel om herhaling te herkennen; dezelfde melding niet twee dagen op rij. */
  tag: string;
}

const lastKey = (userId: string) => `${userKey.push(userId)}:laatst`;

/**
 * Stuurt hooguit één melding per dag per gebruiker en niet twee dagen achter
 * elkaar dezelfde (§8.2). Verlopen abonnementen worden meteen opgeruimd.
 */
export async function sendPush(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; skipped?: string }> {
  if (!pushEnabled) return { sent: 0, skipped: 'Pushmeldingen zijn niet ingesteld' };
  configure();

  const vandaag = todayInAmsterdam();
  const laatst = await db().get<{ date: string; tag: string }>(lastKey(userId));
  if (laatst?.date === vandaag) return { sent: 0, skipped: 'Vandaag al een melding gestuurd' };
  if (laatst?.tag === payload.tag && laatst.date === gisteren(vandaag)) {
    return { sent: 0, skipped: 'Dezelfde melding ging gisteren al' };
  }

  const abonnementen = await listSubscriptions(userId);
  if (abonnementen.length === 0) return { sent: 0, skipped: 'Geen apparaat aangemeld' };

  let verstuurd = 0;
  for (const abonnement of abonnementen) {
    try {
      await webpush.sendNotification(
        { endpoint: abonnement.endpoint, keys: abonnement.keys },
        JSON.stringify(payload),
      );
      verstuurd++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await removeSubscription(userId, abonnement.endpoint);
      } else {
        console.warn('[bloeiwijzer] push mislukt', status, error);
      }
    }
  }

  if (verstuurd > 0) {
    await db().set(lastKey(userId), { date: vandaag, tag: payload.tag }, { ttlSeconds: 7 * 86400 });
  }
  return { sent: verstuurd };
}

function gisteren(datum: string): string {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
