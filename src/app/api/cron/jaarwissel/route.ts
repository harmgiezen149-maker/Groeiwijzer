import { withCron } from '@/lib/cron';
import { listAllGardens } from '@/lib/garden';
import { generateOccurrences } from '@/lib/occurrences';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * De occurrences voor het lopende jaar klaarzetten. Staat niet meer in
 * vercel.json: de dagelijkse weertaak doet dit inmiddels zelf, en het Hobby-plan
 * staat maar twee geplande taken toe. De route blijft bestaan om hem met de
 * hand of vanuit een eigen planner aan te roepen.
 */
export const GET = withCron(async () => {
  const jaar = new Date().getFullYear();
  const gardens = await listAllGardens();
  const verslag = [];
  for (const garden of gardens) {
    verslag.push({ tuin: garden.name, ...(await generateOccurrences(garden.id, jaar)) });
  }
  return { jaar, verslag };
});
