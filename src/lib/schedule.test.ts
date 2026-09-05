import { describe, expect, it } from 'vitest';
import { mergeOccurrences, plannedOccurrences, windowForYear } from './schedule';
import { rangeOverlapsMonth } from './dates';
import type { CareTask, Schedule, TaskOccurrence } from './types';

function task(schedule: Schedule, overrides: Partial<CareTask> = {}): CareTask {
  return {
    id: 't1',
    plantId: 'p1',
    type: 'snoeien',
    title: 'Snoeien',
    instructions: 'Snoei de plant.',
    schedule,
    weatherRules: [],
    importance: 'aanbevolen',
    source: 'handmatig',
    enabled: true,
    ...overrides,
  };
}

const NOW = '2026-01-01T00:00:00.000Z';

describe('windowForYear', () => {
  it('houdt een gewoon venster binnen het jaar', () => {
    expect(windowForYear({ kind: 'jaarvenster', startMonth: 2, endMonth: 3, timesPerWindow: 1 }, 2027))
      .toEqual({ start: '2027-02-01', end: '2027-03-31' });
  });

  it('laat een venster over de jaargrens doorlopen', () => {
    expect(windowForYear({ kind: 'jaarvenster', startMonth: 11, endMonth: 2, timesPerWindow: 1 }, 2027))
      .toEqual({ start: '2027-11-01', end: '2028-02-29' });
  });
});

describe('plannedOccurrences', () => {
  it('scenario 1: snoeivenster februari–maart valt in maart, niet in juni', () => {
    const [occ] = plannedOccurrences(
      task({ kind: 'jaarvenster', startMonth: 2, endMonth: 3, timesPerWindow: 1 }),
      2027,
      NOW,
    );
    expect(occ.windowStart).toBe('2027-02-01');
    expect(occ.windowEnd).toBe('2027-03-31');
    expect(rangeOverlapsMonth(occ.windowStart, occ.windowEnd, 2027, 3)).toBe(true);
    expect(rangeOverlapsMonth(occ.windowStart, occ.windowEnd, 2027, 6)).toBe(false);
  });

  it('scenario 3: venster november–februari loopt door over de jaargrens', () => {
    const occs = plannedOccurrences(
      task({ kind: 'jaarvenster', startMonth: 11, endMonth: 2, timesPerWindow: 2 }),
      2027,
      NOW,
    );
    expect(occs).toHaveLength(2);
    expect(occs[0].windowStart).toBe('2027-11-01');
    expect(occs[1].windowEnd).toBe('2028-02-29');
    expect(rangeOverlapsMonth(occs[1].windowStart, occs[1].windowEnd, 2028, 1)).toBe(true);
  });

  it('verdeelt timesPerWindow gelijk en zonder gaten of overlap', () => {
    const occs = plannedOccurrences(
      task({ kind: 'jaarvenster', startMonth: 4, endMonth: 9, timesPerWindow: 3 }),
      2027,
      NOW,
    );
    expect(occs).toHaveLength(3);
    expect(occs[0].windowStart).toBe('2027-04-01');
    expect(occs[2].windowEnd).toBe('2027-09-30');
    for (let i = 1; i < occs.length; i++) {
      expect(occs[i].windowStart > occs[i - 1].windowEnd).toBe(true);
    }
  });

  it('interval genereert stappen van intervalDays binnen het venster', () => {
    const occs = plannedOccurrences(
      task({ kind: 'interval', startMonth: 5, endMonth: 5, intervalDays: 7 }, { type: 'water' }),
      2027,
      NOW,
    );
    expect(occs).toHaveLength(5); // 31 dagen / 7
    expect(occs[0].windowStart).toBe('2027-05-01');
    expect(occs[1].windowStart).toBe('2027-05-08');
    expect(occs.at(-1)!.windowEnd).toBe('2027-05-31');
  });

  it('meerjaarlijks slaat tussenliggende jaren over', () => {
    const t = task({
      kind: 'meerjaarlijks',
      startMonth: 3,
      endMonth: 4,
      everyYears: 3,
      anchorYear: 2026,
    });
    expect(plannedOccurrences(t, 2026, NOW)).toHaveLength(1);
    expect(plannedOccurrences(t, 2027, NOW)).toHaveLength(0);
    expect(plannedOccurrences(t, 2029, NOW)).toHaveLength(1);
  });

  it('weer-gestuurd levert niets vooraf op', () => {
    expect(
      plannedOccurrences(task({ kind: 'weer-gestuurd', startMonth: 5, endMonth: 9 }), 2027, NOW),
    ).toHaveLength(0);
  });

  it('uitgezette taken leveren niets op', () => {
    expect(
      plannedOccurrences(
        task({ kind: 'jaarvenster', startMonth: 2, endMonth: 3, timesPerWindow: 1 }, { enabled: false }),
        2027,
        NOW,
      ),
    ).toHaveLength(0);
  });
});

describe('mergeOccurrences', () => {
  it('scenario 4: twee keer genereren geeft geen dubbelingen en houdt afgevinkt afgevinkt', () => {
    const t = task({ kind: 'jaarvenster', startMonth: 2, endMonth: 3, timesPerWindow: 2 });
    const planned = plannedOccurrences(t, 2027, NOW);

    const existing: Record<string, TaskOccurrence> = {};
    const first = mergeOccurrences(existing, planned);
    expect(first.added).toBe(2);
    Object.assign(existing, first.toWrite);

    existing[planned[0].id] = { ...existing[planned[0].id], status: 'gedaan', doneBy: 'u1' };

    const second = mergeOccurrences(existing, plannedOccurrences(t, 2027, NOW));
    expect(second.added).toBe(0);
    expect(Object.keys(second.toWrite)).toHaveLength(0);
    expect(existing[planned[0].id].status).toBe('gedaan');
  });
});
