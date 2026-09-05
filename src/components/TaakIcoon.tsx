import type { TaskType } from '@/lib/types';

/**
 * Eén pictogram per taaktype. Kleur alleen zou te weinig zijn — wie kleuren
 * slecht onderscheidt heeft de vorm nodig (§11). Lijntekeningen, geen emoji,
 * zodat ze op elke maat scherp blijven.
 */
const PADEN: Record<TaskType, React.ReactNode> = {
  snoeien: (
    <>
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="6" cy="18" r="2.6" />
      <path d="M8.1 7.6 20 18M8.1 16.4 20 6" />
    </>
  ),
  bemesten: (
    <>
      <path d="M5 9h14l-1.3 9.4a1.7 1.7 0 0 1-1.7 1.4H8a1.7 1.7 0 0 1-1.7-1.4z" />
      <path d="M9 9V6.6c0-1.4 1.3-2.6 3-2.6s3 1.2 3 2.6V9" />
    </>
  ),
  verpotten: (
    <>
      <path d="M4.5 9.5h15l-1.6 9a1.7 1.7 0 0 1-1.7 1.4H7.8a1.7 1.7 0 0 1-1.7-1.4z" />
      <path d="M12 9.5V6M12 6c-2.2 0-3.4-1-3.4-2.4 2.2 0 3.4 1 3.4 2.4zM12 6c2.2 0 3.4-1 3.4-2.4-2.2 0-3.4 1-3.4 2.4z" />
    </>
  ),
  water: <path d="M12 3.5c3 3.7 5.5 6.8 5.5 9.6A5.5 5.5 0 0 1 12 18.6a5.5 5.5 0 0 1-5.5-5.5C6.5 10.3 9 7.2 12 3.5z" />,
  winterbescherming: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      <path d="M12 6.6 9.8 4.6M12 6.6l2.2-2M12 17.4l-2.2 2M12 17.4l2.2 2" />
    </>
  ),
  ziektecontrole: (
    <>
      <path d="M12 3.5l7 3v5c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5v-5z" />
      <path d="M9.5 11.8l1.8 1.9 3.4-3.6" />
    </>
  ),
  delen: (
    <>
      <path d="M12 4v6M12 10 7.5 15M12 10l4.5 5" />
      <circle cx="7" cy="17.5" r="2.3" />
      <circle cx="17" cy="17.5" r="2.3" />
    </>
  ),
  oogsten: (
    <>
      <path d="M4 10h16l-1.6 8.2a1.6 1.6 0 0 1-1.6 1.3H7.2a1.6 1.6 0 0 1-1.6-1.3z" />
      <path d="M8.6 10 12 4.4 15.4 10" />
    </>
  ),
  planten: (
    <>
      <path d="M12 20v-6.5" />
      <path d="M12 13.5C12 10.4 9.8 8 6.6 8c0 3.1 2.2 5.5 5.4 5.5zM12 13.5c0-3.1 2.2-5.5 5.4-5.5 0 3.1-2.2 5.5-5.4 5.5z" />
      <path d="M7 20h10" />
    </>
  ),
  overig: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 4.2a2.9 2.9 0 0 1 0 5.4M12 19.8a2.9 2.9 0 0 1 0-5.4M4.6 12a2.9 2.9 0 0 1 5 0M19.4 12a2.9 2.9 0 0 1-5 0" />
    </>
  ),
};

export function TaakIcoon({ type, size = 21 }: { type: TaskType; size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PADEN[type]}
    </svg>
  );
}
