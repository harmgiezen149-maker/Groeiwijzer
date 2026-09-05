import type { RuleHit } from '@/lib/weather-rules';

const URGENT = new Set(['nachtvorst-alarm']);

const KOP: Record<string, string> = {
  'nachtvorst-alarm': 'Nachtvorst binnen 48 uur.',
  'geen-vorst': 'Vorst op komst.',
  droogte: 'Het blijft droog.',
  'geen-hitte': 'Het wordt heet.',
  groeiseizoen: 'Het groeiseizoen begint.',
};

/** Weerbanner: alleen tonen als er echt iets aan de hand is. */
export function WeerBanner({ rules }: { rules: RuleHit[] }) {
  if (rules.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {rules.map((regel) => {
        const urgent = URGENT.has(regel.id);
        return (
          <li key={regel.id} className={`bw-banner ${urgent ? 'bw-banner-urgent' : 'bw-banner-info'}`}>
            <i
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: urgent ? 'var(--ink)' : 'var(--cornflower)' }}
            />
            <span>
              <strong>{KOP[regel.id]}</strong> {regel.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
