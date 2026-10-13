/**
 * Il gesto indietro di Android, in un posto solo.
 *
 * Chi apre qualcosa che si deve chiudere col gesto (un foglio, una scheda
 * diversa dalla Home) si mette in cima alla pila; il gesto chiude l'ultimo
 * arrivato. Con la pila vuota l'app esce, come ogni app Android.
 */

const pila: Array<() => void> = [];
let montato = false;

function chiudiUltimo(): boolean {
  const ultimo = pila[pila.length - 1];
  if (!ultimo) return false;
  ultimo();
  return true;
}

function monta(): void {
  if (montato || typeof window === 'undefined') return;
  montato = true;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chiudiUltimo()) e.preventDefault();
  });
  import('@capacitor/app')
    .then(({ App }) =>
      App.addListener('backButton', () => {
        if (!chiudiUltimo()) void App.exitApp();
      }),
    )
    .catch(() => { /* sul web resta Escape */ });
}

/** Registra chi va chiuso dal gesto indietro. Restituisce come togliersi. */
export function aggiungiIndietro(chiudi: () => void): () => void {
  monta();
  pila.push(chiudi);
  return () => {
    const i = pila.lastIndexOf(chiudi);
    if (i >= 0) pila.splice(i, 1);
  };
}
