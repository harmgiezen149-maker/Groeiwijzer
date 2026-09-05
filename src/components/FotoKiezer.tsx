'use client';

/**
 * Twee wegen naar dezelfde foto: de camera, of een bestand van het toestel.
 * Eén invoerveld met `capture` opende altijd de camera, en dan kun je geen
 * bestaande foto meer kiezen. Het onzichtbare veld ligt over de knop, zodat
 * het raakvlak de hele knop is.
 */
export function FotoKiezer({
  onKies,
  disabled = false,
  gekozen,
}: {
  onKies: (file: File) => void;
  disabled?: boolean;
  /** Naam van het gekozen bestand, als er al een keuze is. */
  gekozen?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Knop
          label="Camera"
          camera
          variant="bw-btn-primary"
          disabled={disabled}
          onKies={onKies}
        />
        <Knop
          label="Uit galerij"
          variant="bw-btn-secondary"
          disabled={disabled}
          onKies={onKies}
        />
      </div>
      {gekozen ? (
        <p className="truncate text-[12.5px] text-[var(--ink-faint)]">{gekozen}</p>
      ) : null}
    </div>
  );
}

function Knop({
  label,
  camera = false,
  variant,
  disabled,
  onKies,
}: {
  label: string;
  camera?: boolean;
  variant: string;
  disabled: boolean;
  onKies: (file: File) => void;
}) {
  return (
    <label
      className={`bw-btn ${variant} relative flex-1 cursor-pointer focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[var(--cornflower)] ${
        disabled ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      {camera ? <Camera /> : <Galerij />}
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        {...(camera ? { capture: 'environment' as const } : {})}
        disabled={disabled}
        className="absolute -inset-0.5 h-[calc(100%+4px)] w-[calc(100%+4px)] cursor-pointer text-base opacity-0"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Leegmaken, anders komt dezelfde foto een tweede keer niet door.
          event.target.value = '';
          if (file) onKies(file);
        }}
      />
    </label>
  );
}

function Camera() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5h3.2l1.5-2.2h7.6l1.5 2.2h3.2v10H3.5z" />
      <circle cx="12" cy="13.2" r="3.4" />
    </svg>
  );
}

function Galerij() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4.5 16.5 4.2-4 3 2.6 3.4-3.3 4.4 4.2" />
    </svg>
  );
}
