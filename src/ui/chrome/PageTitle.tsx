interface Props {
  /** Occhiello mono maiuscolo sopra al titolo. */
  eyebrow: string;
  title: string;
  /** Riga sotto: contesto, non decorazione. */
  sub?: string;
}

/** Intestazione di schermata: stessa forma in tutte le tab. */
export function PageTitle({ eyebrow, title, sub }: Props) {
  return (
    <header className="px-1 pt-1">
      <p className="mf-label" style={{ fontSize: 10 }}>
        {eyebrow}
      </p>
      <h1
        className="mt-1.5"
        style={{
          fontFamily: 'var(--mf-font-sans)',
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          color: 'var(--mf-ink)',
        }}
      >
        {title}
      </h1>
      {sub && (
        <p className="mt-1.5" style={{ color: 'var(--mf-ink-2)', fontSize: 12, lineHeight: 1.5, maxWidth: '34ch' }}>
          {sub}
        </p>
      )}
    </header>
  );
}
