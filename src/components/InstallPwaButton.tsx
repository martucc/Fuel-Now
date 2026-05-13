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
      className="w-10 h-10 flex items-center justify-center bg-blue-500/15 hover:bg-blue-500/25 rounded-full border border-blue-500/30 transition-all active:scale-95 shadow-[0_0_16px_rgba(37,99,235,0.25)]"
      aria-label="Installa app"
      title="Installa MartuccFuel"
    >
      <Download size={18} className="text-blue-400" />
    </button>
  );
}
