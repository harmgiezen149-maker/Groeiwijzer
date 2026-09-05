import 'server-only';
import { db } from './redis';
import { weatherKey } from './keys';
import { evaluateRules, ONGUNSTIG_VOOR, type Forecast, type RuleMap } from './weather-rules';
import { todayInAmsterdam } from './dates';
import type { Garden } from './types';

const CACHE_SECONDS = 6 * 60 * 60;

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  daily?: {
    time?: string[];
    temperature_2m_min?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
}

/** Eén call per tuin, zes uur gecached (§7.2). */
export async function getForecast(
  lat: number,
  lon: number,
  opts: { force?: boolean } = {},
): Promise<Forecast | null> {
  const key = weatherKey(lat, lon);
  if (!opts.force) {
    const gecached = await db().get<Forecast>(key);
    if (gecached?.days?.length) return gecached;
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lon.toFixed(4));
  url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max,precipitation_sum');
  url.searchParams.set('past_days', '7');
  url.searchParams.set('forecast_days', '14');
  url.searchParams.set('models', 'knmi_seamless');
  url.searchParams.set('timezone', 'Europe/Amsterdam');

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Open-Meteo gaf ${res.status}`);
    const data = (await res.json()) as OpenMeteoResponse;
    const tijden = data.daily?.time ?? [];
    const forecast: Forecast = {
      lat,
      lon,
      fetchedAt: new Date().toISOString(),
      days: tijden.map((date, i) => ({
        date,
        tmin: data.daily?.temperature_2m_min?.[i] ?? 0,
        tmax: data.daily?.temperature_2m_max?.[i] ?? 0,
        precip: data.daily?.precipitation_sum?.[i] ?? 0,
      })),
    };
    await db().set(key, forecast, { ttlSeconds: CACHE_SECONDS });
    return forecast;
  } catch (error) {
    console.warn('[bloeiwijzer] weer ophalen mislukt', error);
    // Liever een verouderde verwachting dan geen enkele.
    return db().get<Forecast>(key);
  }
}

export interface WeatherState {
  forecast: Forecast | null;
  rules: RuleMap;
  today: string;
}

export async function weatherFor(
  garden: Garden,
  opts: { force?: boolean } = {},
): Promise<WeatherState> {
  const today = todayInAmsterdam();
  const forecast = await getForecast(garden.lat, garden.lon, opts);
  return {
    forecast,
    today,
    rules: forecast ? evaluateRules(forecast, today, garden.disabledWeatherRules ?? []) : {},
  };
}

export { ONGUNSTIG_VOOR };
