/**
 * Foto van een plant in de organische lijst uit het ontwerp.
 * Zonder foto blijft de vorm staan met het gestreepte vulpatroon,
 * zodat een lijst zonder foto's niet uit elkaar valt.
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
        className={`block ${vorm} ${className}`}
        style={
          vierkant
            ? {
                background:
                  'repeating-linear-gradient(135deg,#EDE6D3 0 10px,#E3DAC4 10px 20px)',
              }
            : undefined
        }
      />
    );
  }

  // Bewust geen next/image: foto's komen van Blob of van het lokale
  // uploadpad, en optimalisatie voegt hier weinig toe.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading="lazy" className={`${vorm} object-cover ${className}`} />;
}
