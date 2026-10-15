import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type Tocco = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error';

/**
 * Un tocco che si sente, uno solo. Prima ogni pressione faceva un impatto e
 * poi anche una vibrazione da 15 ms: due colpi, effetto ronzio. Adesso: un
 * impatto per i bottoni, il «clic» di selezione per schede e segmenti, la
 * notifica per esiti riusciti o falliti.
 */
export async function triggerHaptic(stile: Tocco): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    switch (stile) {
      case 'selection':
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await Haptics.selectionEnd();
        break;
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        break;
    }
  } catch {
    /* senza vibrazione l'app funziona uguale */
  }
}
