/**
 * Foto van een plant in de organische lijst uit het ontwerp.
 * Zonder foto blijft de vorm staan, gevuld met een zacht kleurvlak en een
 * getekende bloem, zodat een lijst zonder foto's niet uit elkaar valt.
 */
export function PlantFoto({
  url,
  alt,
  className = '',
  variant = 1,
  vierkant = false,
}: {
  url?: string;
  alt: string;
  className?: string;
  variant?: 1 | 2 | 3;
  /** Voor de brede kop op de plantpagina: rechte hoeken, geen blob. */
  vierkant?: boolean;
}) {
  const vorm = vierkant ? '' : `bw-blob ${variant === 2 ? 'bw-blob-2' : variant === 3 ? 'bw-blob-3' : ''}`;

  if (!url) {
    return (
      <span
        aria-hidden
        className={`grid place-items-center ${vorm} ${className}`}
        style={{
          background:
            'linear-gradient(150deg, var(--tint-dahlia) 0%, #fdeee2 45%, var(--tint-leaf) 100%)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgb(35 55 43 / 0.3)"
          strokeWidth="1.4"
          strokeLinecap="round"
          className={vierkant ? 'size-10' : 'size-1/3'}
        >
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 3.4a3.1 3.1 0 0 1 0 6.2M12 20.6a3.1 3.1 0 0 1 0-6.2M4.1 12a3.1 3.1 0 0 1 5.4 0M19.9 12a3.1 3.1 0 0 1-5.4 0" />
        </svg>
      </span>
    );
  }

  // Bewust geen next/image: foto's komen van Blob of van het lokale
  // uploadpad, en optimalisatie voegt hier weinig toe.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading="lazy" className={`${vorm} object-cover ${className}`} />;
}
