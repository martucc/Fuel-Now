import { useState } from 'react';
import { iniziali, logoMarchio } from './marchio';

/**
 * Il logo del marchio in un quadrato arrotondato. I loghi inclusi sono
 * bianchi su nero; per gli altri un monogramma, che sta meglio di un logo
 * sbagliato.
 */
export function LogoMarchio({ marchio, misura = 40 }: { marchio: string; misura?: number }) {
  const file = logoMarchio(marchio);
  const [rotto, setRotto] = useState(false);
  const stile = { width: misura, height: misura, borderRadius: Math.round(misura * 0.28) };
  if (file && !rotto) {
    return (
      <span className="block shrink-0 overflow-hidden bg-black ring-1 ring-mf-hairline" style={stile}>
        <img src={file} alt="" className="h-full w-full object-cover" onError={() => setRotto(true)} draggable={false} />
      </span>
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center bg-mf-surface-2 font-semibold text-mf-ink-2 ring-1 ring-mf-hairline"
      style={{ ...stile, fontSize: Math.round(misura * 0.34) }}
      aria-hidden
    >
      {iniziali(marchio)}
    </span>
  );
}
