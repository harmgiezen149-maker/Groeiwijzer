import { describe, expect, it } from 'vitest';
import { evaluateRules, type Forecast, type ForecastDay } from './weather-rules';

function dag(date: string, tmin: number, tmax: number, precip = 0): ForecastDay {
  return { date, tmin, tmax, precip };
}

function forecast(days: ForecastDay[]): Forecast {
  return { lat: 51.977, lon: 5.755, fetchedAt: '2027-03-01T06:00:00.000Z', days };
}

describe('weerregels', () => {
  it('scenario 7: vorst binnen 3 dagen vlagt snoeien en geeft nachtvorstalarm', () => {
    const hits = evaluateRules(
      forecast([
        dag('2027-03-01', 3, 8),
        dag('2027-03-02', -2, 4),
        dag('2027-03-03', 1, 6),
      ]),
      '2027-03-01',
    );
    expect(hits['geen-vorst']?.value).toBe(-2);
    expect(hits['nachtvorst-alarm']?.date).toBe('2027-03-02');
  });

  it('geeft geen vorstmelding als de vorst verder weg ligt dan het venster', () => {
    const hits = evaluateRules(
      forecast([
        dag('2027-03-01', 5, 9),
        dag('2027-03-02', 4, 9),
        dag('2027-03-03', 4, 9),
        dag('2027-03-04', -3, 2),
      ]),
      '2027-03-01',
    );
    expect(hits['geen-vorst']).toBeUndefined();
    expect(hits['nachtvorst-alarm']).toBeUndefined();
  });

  it('scenario 8: zeven droge dagen en 25 graden geeft de droogteregel', () => {
    const dagen = [
      ...Array.from({ length: 7 }, (_, i) =>
        dag(`2027-06-${String(i + 1).padStart(2, '0')}`, 12, 24, 0.2),
      ),
      dag('2027-06-08', 14, 25),
      dag('2027-06-09', 14, 26),
    ];
    const hits = evaluateRules(forecast(dagen), '2027-06-08');
    expect(hits.droogte).toBeDefined();
    expect(hits.droogte?.value).toBeCloseTo(1.4, 1);
  });

  it('geeft geen droogtemelding na een natte week', () => {
    const dagen = [
      ...Array.from({ length: 7 }, (_, i) =>
        dag(`2027-06-${String(i + 1).padStart(2, '0')}`, 12, 24, 3),
      ),
      dag('2027-06-08', 14, 25),
    ];
    expect(evaluateRules(forecast(dagen), '2027-06-08').droogte).toBeUndefined();
  });

  it('vlagt hitte boven 28 graden', () => {
    const hits = evaluateRules(forecast([dag('2027-07-01', 18, 31)]), '2027-07-01');
    expect(hits['geen-hitte']?.value).toBe(31);
  });

  it('meldt het groeiseizoen alleen in februari en maart', () => {
    const dagen = Array.from({ length: 6 }, (_, i) =>
      dag(`2027-03-${String(i + 1).padStart(2, '0')}`, 7, 12),
    );
    expect(evaluateRules(forecast(dagen), '2027-03-03').groeiseizoen).toBeDefined();
    const zomer = Array.from({ length: 6 }, (_, i) =>
      dag(`2027-07-${String(i + 1).padStart(2, '0')}`, 14, 24),
    );
    expect(evaluateRules(forecast(zomer), '2027-07-03').groeiseizoen).toBeUndefined();
  });

  it('respecteert uitgezette regels', () => {
    const dagen = [dag('2027-03-01', -4, 2)];
    const hits = evaluateRules(forecast(dagen), '2027-03-01', ['geen-vorst', 'nachtvorst-alarm']);
    expect(hits['geen-vorst']).toBeUndefined();
    expect(hits['nachtvorst-alarm']).toBeUndefined();
  });
});
