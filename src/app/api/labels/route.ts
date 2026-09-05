import { withGarden } from '@/lib/api';
import { listLocations } from '@/lib/locations';
import { listLivePlants } from '@/lib/plants';
import { appUrl } from '@/lib/mail';

export const runtime = 'nodejs';

export const GET = withGarden(async (ctx) => {
  const [plants, locations] = await Promise.all([
    listLivePlants(ctx.garden.id),
    listLocations(ctx.garden.id),
  ]);
  const naam = new Map(locations.map((l) => [l.id, l.name]));
  return {
    labels: plants
      .filter((plant) => plant.labelCode)
      .map((plant) => ({
        plantId: plant.id,
        name: plant.commonName,
        location: naam.get(plant.locationId) ?? '',
        labelCode: plant.labelCode!,
        url: appUrl(`/q/${ctx.garden.id}/${plant.labelCode}`),
      })),
  };
});
