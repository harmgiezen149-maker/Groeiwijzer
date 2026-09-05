/** Datumhulp op basis van yyyy-mm-dd strings, gerekend in UTC.
 *  De app draait op Europe/Amsterdam maar slaat kale datums op; door
 *  consequent in UTC te rekenen verschuift er niets door zomertijd. */

export const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
] as const;

export const MONTH_SHORT = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
] as const;

export const DAY_SHORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const;

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYmd(value: string): { year: number; month: number; day: number } {
  const [y, m, d] = value.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function toUtc(value: string): number {
  const { year, month, day } = parseYmd(value);
  return Date.UTC(year, month - 1, day);
}

export function fromUtc(ms: number): string {
  const d = new Date(ms);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(value: string, days: number): string {
  return fromUtc(toUtc(value) + days * 86400_000);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86400_000);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Maandag = 0. */
export function weekdayIndex(value: string): number {
  return (new Date(toUtc(value)).getUTCDay() + 6) % 7;
}

/** Vandaag in Europe/Amsterdam, als yyyy-mm-dd. */
export function todayInAmsterdam(nowMs = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(nowMs));
  return parts;
}

export function formatDate(value: string): string {
  const { year, month, day } = parseYmd(value);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatShortDate(value: string): string {
  const { month, day } = parseYmd(value);
  return `${day} ${MONTH_SHORT[month - 1]}`;
}

export function formatRange(start: string, end: string): string {
  if (start === end) return formatShortDate(start);
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${MONTH_SHORT[a.month - 1]}`;
  }
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** Maanden (als {year, month}) die door het venster geraakt worden. */
export function monthsInRange(
  start: string,
  end: string,
): { year: number; month: number }[] {
  const a = parseYmd(start);
  const b = parseYmd(end);
  const out: { year: number; month: number }[] = [];
  let y = a.year;
  let m = a.month;
  for (let guard = 0; guard < 400; guard++) {
    out.push({ year: y, month: m });
    if (y === b.year && m === b.month) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function rangeOverlapsMonth(
  start: string,
  end: string,
  year: number,
  month: number,
): boolean {
  const monthStart = ymd(year, month, 1);
  const monthEnd = ymd(year, month, daysInMonth(year, month));
  return start <= monthEnd && end >= monthStart;
}
