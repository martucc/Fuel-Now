import { Haptics, ImpactStyle } from '@capacitor/haptics';

export async function triggerHaptic(style: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error') {
  try {
    // Controlla se l'utente ha disattivato il feedback tattile nelle impostazioni
    const hapticsDisabled = localStorage.getItem('mf_haptics_disabled') === 'true';
    if (hapticsDisabled) return;

    // Controlla se siamo in esecuzione in un ambiente Capacitor nativo
    const isCapacitorAvailable = typeof window !== 'undefined' && 'Capacitor' in (window as any);

    if (isCapacitorAvailable) {
      switch (style) {
        case 'light':
        case 'selection':
          try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
          try { await Haptics.vibrate({ duration: 15 }); } catch {}
          break;
        case 'medium':
          try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
          try { await Haptics.vibrate({ duration: 30 }); } catch {}
          break;
        case 'heavy':
          try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
          try { await Haptics.vibrate({ duration: 60 }); } catch {}
          break;
        case 'success':
          try { await Haptics.notification({ type: 'SUCCESS' as any }); } catch {}
          try {
            await Haptics.vibrate({ duration: 30 });
            setTimeout(() => { Haptics.vibrate({ duration: 30 }).catch(() => {}); }, 80);
          } catch {}
          break;
        case 'error':
          try { await Haptics.notification({ type: 'ERROR' as any }); } catch {}
          try {
            await Haptics.vibrate({ duration: 70 });
            setTimeout(() => { Haptics.vibrate({ duration: 120 }).catch(() => {}); }, 120);
          } catch {}
          break;
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Fallback per PWA standard sul browser mobile usando la Web Vibration API
      switch (style) {
        case 'light':
        case 'selection':
          navigator.vibrate(12); // Micro-vibrazione reattiva premium
          break;
        case 'medium':
          navigator.vibrate(25); // Feedback intermedio per azioni principali
          break;
        case 'heavy':
          navigator.vibrate(50); // Feedback forte
          break;
        case 'success':
          navigator.vibrate([30, 45, 30]); // Elegantissimo doppio impulso premium (successo)
          break;
        case 'error':
          navigator.vibrate([60, 40, 120]); // Pattern asincrono forte per notificare errori
          break;
      }
    }
  } catch (err) {
    console.debug('Haptics/Vibration engine fallback error:', err);
  }
}
