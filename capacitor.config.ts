import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.martucc.fuel',
  appName: 'Martucc Fuel',
  webDir: 'dist',
  server: {
    // Tutto quello che l'app chiede — tessere, Nominatim, OSRM, Gemini — passa
    // da fetch, e fetch non guarda allowNavigation: quella lista dice solo
    // quali pagine la WebView puo aprire al posto del browser. Lasciarla a '*'
    // significava che qualunque sito raggiunto da un link finiva a girare
    // dentro il contesto del bridge, con i plugin nativi a portata di mano.
    // I link esterni (Google Maps, GitHub) devono uscire nel browser: senza
    // questa voce e esattamente quello che succede.
    androidScheme: 'https',
  },
  plugins: {
    // App tutta scura: icone chiare sulle barre di sistema, e i margini
    // sicuri passati alla pagina come --safe-area-inset-* (vedi tema.css).
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'css',
    },
  },
};

export default config;
