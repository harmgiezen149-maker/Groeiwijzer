import type { RuleHit } from '@/lib/weather-rules';

const KLEUR: Record<string, string> = {
  'nachtvorst-alarm': 'var(--zinnia)',
  'geen-vorst': 'var(--cornflower)',
  droogte: 'var(--cornflower)',
  'geen-hitte': 'var(--zinnia)',
  groeiseizoen: 'var(--leaf)',
};

const ICOON: Record<string, string> = {
  'nachtvorst-alarm': '❄',
  'geen-vorst': '❄',
  droogte: '💧',
  'geen-hitte': '🔥',
  groeiseizoen: '🌱',
};

/** Weerbanner: alleen tonen als er echt iets aan de hand is. */
export function WeerBanner({ rules }: { rules: RuleHit[] }) {
  if (rules.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {rules.map((regel) => (
        <li
          key={regel.id}
          className="bw-card flex items-start gap-3 p-3 text-sm"
          style={{ borderColor: KLEUR[regel.id] }}
        >
          <span aria-hidden className="text-lg leading-none">
            {ICOON[regel.id]}
          </span>
          <span>{regel.text}</span>
        </li>
      ))}
    </ul>
  );
}
