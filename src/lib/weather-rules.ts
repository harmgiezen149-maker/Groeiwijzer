import { parseYmd } from './dates';
import type { WeatherRuleId } from './types';

export interface ForecastDay {
  date: string; // yyyy-mm-dd
  tmin: number;
  tmax: number;
  precip: number;
}

export interface Forecast {
  lat: number;
  lon: number;
  fetchedAt: string;
  days: ForecastDay[];
}

export interface RuleHit {
  id: WeatherRuleId;
  /** Korte zin voor de gebruiker; actief, zonder uitroeptekens. */
  text: string;
  /** De dag waar de regel op slaat, als die er is. */
  date?: string;
  value?: number;
}

export type RuleMap = Partial<Record<WeatherRuleId, RuleHit>>;

/**
 * De vijf weerregels uit §7.2. Weerregels blokkeren nooit; ze markeren,
 * sorteren en melden. Deze functie is puur zodat hij te testen is.
 */
export function evaluateRules(
  forecast: Forecast,
  today: string,
  disabled: WeatherRuleId[] = [],
): RuleMap {
  const uit = new Set(disabled);
  const hits: RuleMap = {};
  const vooruit = forecast.days.filter((d) => d.date >= today);
  const achteruit = forecast.days.filter((d) => d.date < today);

  // geen-vorst: minimum onder nul binnen 3 dagen
  if (!uit.has('geen-vorst')) {
    const vorst = vooruit.slice(0, 3).find((d) => d.tmin < 0);
    if (vorst) {
      hits['geen-vorst'] = {
        id: 'geen-vorst',
        text: 'Wacht tot de vorst voorbij is',
        date: vorst.date,
        value: vorst.tmin,
      };
    }
  }

  // nachtvorst-alarm: minimum onder 2 graden binnen 48 uur
  if (!uit.has('nachtvorst-alarm')) {
    const nacht = vooruit.slice(0, 2).find((d) => d.tmin < 2);
    if (nacht) {
      hits['nachtvorst-alarm'] = {
        id: 'nachtvorst-alarm',
        text: `Nachtvorst op komst: ${nacht.tmin.toFixed(0)} °C. Dek vorstgevoelige planten af of haal ze binnen.`,
        date: nacht.date,
        value: nacht.tmin,
      };
    }
  }

  // droogte: minder dan 5 mm in 7 dagen en het wordt warmer dan 22 graden
  if (!uit.has('droogte')) {
    const week = achteruit.slice(-7);
    const som = week.reduce((totaal, dag) => totaal + dag.precip, 0);
    const warm = vooruit.slice(0, 3).some((d) => d.tmax > 22);
    if (week.length >= 5 && som < 5 && warm) {
      hits.droogte = {
        id: 'droogte',
        text: `Droog: ${som.toFixed(0)} mm in een week. Geef droogtegevoelige planten water.`,
        value: som,
      };
    }
  }

  // geen-hitte: het wordt warmer dan 28 graden
  if (!uit.has('geen-hitte')) {
    const heet = vooruit.slice(0, 3).find((d) => d.tmax > 28);
    if (heet) {
      hits['geen-hitte'] = {
        id: 'geen-hitte',
        text: `Het wordt ${heet.tmax.toFixed(0)} °C. Bemesten en verpotten kun je beter uitstellen.`,
        date: heet.date,
        value: heet.tmax,
      };
    }
  }

  // groeiseizoen: vijf dagen op rij boven 5 graden minimum, in februari of maart
  if (!uit.has('groeiseizoen')) {
    const maand = parseYmd(today).month;
    if (maand === 2 || maand === 3) {
      const reeks = langsteReeks(forecast.days, (d) => d.tmin > 5);
      if (reeks >= 5) {
        hits.groeiseizoen = {
          id: 'groeiseizoen',
          text: 'Het groeiseizoen komt op gang. Goede tijd om te planten en te bemesten.',
        };
      }
    }
  }

  return hits;
}

function langsteReeks(days: ForecastDay[], test: (d: ForecastDay) => boolean): number {
  let langste = 0;
  let huidig = 0;
  for (const dag of days) {
    huidig = test(dag) ? huidig + 1 : 0;
    if (huidig > langste) langste = huidig;
  }
  return langste;
}

/** Taaktypen waarvoor een regel de vlag `ongunstig` oplevert. */
export const ONGUNSTIG_VOOR: Partial<Record<WeatherRuleId, string[]>> = {
  'geen-vorst': ['snoeien'],
  'geen-hitte': ['bemesten', 'verpotten'],
};
