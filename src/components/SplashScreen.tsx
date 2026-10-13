import { motion } from 'motion/react';

/**
 * Le cinque fasce della scala del prezzo, che salgono a turno.
 *
 * I ritardi sono corti apposta. Lo schermo di apertura non carica niente —
 * i prezzi li scarica getStations, e l'attesa vera e quella — quindi ogni
 * decimo speso qui e un decimo tolto all'app. La sequenza si chiude in
 * meno di mezzo secondo: si vede che le barre salgono, e basta.
 */
const BARRE = [
  { color: 'var(--mf-price-best)', h: 34, d: 0 },
  { color: 'var(--mf-price-good)', h: 52, d: 0.05 },
  { color: 'var(--mf-price-normal)', h: 40, d: 0.10 },
  { color: 'var(--mf-price-high)', h: 62, d: 0.15 },
  { color: 'var(--mf-price-worst)', h: 28, d: 0.20 },
];

/**
 * Il caricamento non racconta una favola tecnologica: mostra la cosa che
 * l'app fa, cioe mettere in fila dei prezzi e trovare il piu basso. La
 * barra verde e l'unica che resta alta.
 */
export function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--mf-ground)' }}
    >
      {/* Alone dell'accento, appena percettibile */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--mf-accent) 16%, transparent), transparent 68%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative flex flex-col items-center">
        {/* L'istogramma dei prezzi che si forma */}
        <div className="mb-9 flex items-end gap-2" style={{ height: 72 }}>
          {BARRE.map((b, i) => (
            <motion.span
              key={i}
              initial={{ height: 6, opacity: 0 }}
              animate={{ height: b.h, opacity: 1 }}
              transition={{ delay: b.d, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: 12, borderRadius: 6, background: b.color, display: 'block' }}
            />
          ))}
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.26 }}
          style={{
            fontFamily: 'var(--mf-font-sans)',
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: '-0.045em',
            color: 'var(--mf-ink)',
          }}
        >
          Martucc<span style={{ color: 'var(--mf-accent)' }}>Fuel</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24, duration: 0.24 }}
          className="mf-label mt-2"
          style={{ fontSize: 10, letterSpacing: '0.24em' }}
        >
          dove conviene davvero
        </motion.p>
      </div>

      <div className="absolute inset-x-12 bottom-16 mx-auto max-w-[240px]">
        <div
          className="h-[2px] w-full overflow-hidden"
          style={{ background: 'var(--mf-hairline)', borderRadius: 2 }}
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
            style={{ height: '100%', width: '55%', background: 'var(--mf-accent)', borderRadius: 2 }}
          />
        </div>
        <p className="mf-label mt-4 text-center" style={{ fontSize: 9 }}>
          leggo i prezzi di oggi
        </p>
      </div>
    </motion.div>
  );
}
