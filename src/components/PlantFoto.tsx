/** Foto van een plant, met een rustige plaatshouder als er nog geen is. */
export function PlantFoto({
  url,
  alt,
  className = '',
}: {
  url?: string;
  alt: string;
  className?: string;
}) {
  if (!url) {
    return (
      <span
        aria-hidden
        className={`grid place-items-center bg-[var(--paper-sunken)] text-2xl ${className}`}
      >
        🌿
      </span>
    );
  }
  // Bewust geen next/image: foto's komen van Blob of van het lokale
  // uploadpad, en optimalisatie voegt hier weinig toe.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}
