import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { impostazioni } from '../app/impostazioni';
import { comeVibrare } from '../domain/vibrazione';
import type { Tocco, ToccoSistema } from '../domain/vibrazione';

export type { Tocco } from '../domain/vibrazione';

interface PluginVibrazione {
  tocca(opzioni: { tipo: ToccoSistema }): Promise<void>;
}
const Vibrazione = registerPlugin<PluginVibrazione>('Vibrazione');

/**
 * Un tocco che si sente, uno solo, al livello scelto nelle impostazioni
 * (vedi domain/vibrazione.ts). «Leggera» passa dal tocco di sistema di
 * Android; «Decisa» dagli impatti del plugin Haptics.
 */
export async function triggerHaptic(tocco: Tocco): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  // Il livello si legge subito: chi cambia l'impostazione sente il nuovo.
  const v = comeVibrare(impostazioni().vibrazione, tocco);
  if (!v) return;
  try {
    if (v.via === 'sistema') {
      await Vibrazione.tocca({ tipo: v.tipo });
      return;
    }
    switch (v.tipo) {
      case 'impatto-leggero':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'impatto-medio':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'impatto-forte':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'successo':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'errore':
        await Haptics.notification({ type: NotificationType.Error });
        break;
    }
  } catch {
    /* senza vibrazione l'app funziona uguale */
  }
}
