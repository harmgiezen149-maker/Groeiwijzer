import { withCron } from '@/lib/cron';
import { listAllGardens, listMembers, setMeta } from '@/lib/garden';
import { ensureGenerated } from '@/lib/occurrences';
import { weatherFor } from '@/lib/weather';
import { applyWeather } from '@/lib/weather-apply';
import { sendPush } from '@/lib/push';
import { appUrl } from '@/lib/mail';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Dagelijks 05:00 UTC — 07:00 in de Nederlandse zomertijd, 06:00 in de winter.
 * Zet zo nodig de agenda van het nieuwe jaar klaar, haalt het weer op, past de
 * regels toe, en stuurt alleen bij nachtvorst of urgent werk een pushmelding.
 */
export const GET = withCron(async () => {
  const gardens = await listAllGardens();
  const verslag: Record<string, unknown>[] = [];

  const jaar = new Date().getFullYear();

  for (const garden of gardens) {
    // De jaarwissel loopt hier mee: `ensureGenerated` doet niets zolang het
    // jaar al gedraaid is, en op 1 januari vult hij de nieuwe agenda. Zo
    // blijven er twee geplande taken over, wat op het Hobby-plan het maximum is.
    await ensureGenerated(garden.id, jaar);

    const state = await weatherFor(garden, { force: true });
    const resultaat = await applyWeather(garden, state);
    await setMeta(garden.id, { lastWeatherSync: new Date().toISOString() });

    let gepusht = 0;
    const alarm = state.rules['nachtvorst-alarm'];
    if (alarm && resultaat.urgent.length > 0) {
      const namen = resultaat.urgent.map((u) => u.plantName);
      const body =
        namen.length === 1
          ? `${namen[0]} moet afgedekt of naar binnen.`
          : `${namen.length} planten moeten afgedekt of naar binnen: ${namen.slice(0, 3).join(', ')}${namen.length > 3 ? '…' : ''}`;

      for (const lid of await listMembers(garden.id)) {
        if (!lid.notify.push) continue;
        const { sent } = await sendPush(lid.userId, {
          title: 'Nachtvorst op komst',
          body,
          url: appUrl('/'),
          tag: 'nachtvorst',
        });
        gepusht += sent;
      }
    }

    verslag.push({ tuin: garden.name, ...resultaat, gepusht });
  }

  return { jaar, gardens: gardens.length, verslag };
});
