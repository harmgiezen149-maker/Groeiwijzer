import { withCron } from '@/lib/cron';
import { listAllGardens } from '@/lib/garden';
import { generateOccurrences } from '@/lib/occurrences';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** 1 januari: de occurrences voor het nieuwe jaar klaarzetten. */
export const GET = withCron(async () => {
  const jaar = new Date().getFullYear();
  const gardens = await listAllGardens();
  const verslag = [];
  for (const garden of gardens) {
    verslag.push({ tuin: garden.name, ...(await generateOccurrences(garden.id, jaar)) });
  }
  return { jaar, verslag };
});
