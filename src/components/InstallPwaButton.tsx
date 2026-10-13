import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallPwaButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-ignore - iOS Safari
      window.navigator.standalone === true ||
      document.referrer.startsWith('android-app://');
    if (standalone) return;
    const dismissed = localStorage.getItem('mf_install_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400_000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => setHidden(true);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (hidden || !deferred) return null;

  const click = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'dismissed') {
      localStorage.setItem('mf_install_dismissed', String(Date.now()));
    }
    setHidden(true);
    setDeferred(null);
  };

  return (
    <button
      onClick={click}
      className="flex items-center justify-center transition-transform active:scale-95"
      style={{
        width: 38,
        height: 38,
        borderRadius: 'var(--mf-radius-pill)',
        background: 'var(--mf-ground)',
        border: '1px solid var(--mf-hairline)',
        color: 'var(--mf-accent)',
      }}
      aria-label="Installa l app"
      title="Installa MartuccFuel"
    >
      <Download size={17} />
    </button>
  );
}
