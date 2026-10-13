import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Sheet } from '../../design/primitives/Sheet';
import { Button } from '../../design/primitives/Button';
import { Home, Search, Loader2, Check, Trash2, Navigation } from 'lucide-react';
import type { LatLng } from '../../domain/geo';

interface Props {
  show: boolean;
  onClose: () => void;
  currentAddress: string;
  currentLoc: LatLng | null;
  userLoc: LatLng | null;
  onSave: (address: string, loc: LatLng) => void;
  onRemove?: () => void;
}

export function HomeAddressModal({
  show,
  onClose,
  currentAddress,
  userLoc,
  onSave,
  onRemove,
}: Props) {
  const [addressInput, setAddressInput] = useState(currentAddress || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const geocodeAddress = async () => {
    if (!addressInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const query = addressInput.trim();
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=1&countrycodes=it&accept-language=it`
      );
      const data = await res.json();
      if (!data || data.length === 0) {
        throw new Error('Indirizzo non trovato in Italia. Prova specificando anche il comune (es. Via Roma 10, Lugo).');
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      const label = data[0].display_name.split(',').slice(0, 3).join(', ');
      
      setAddressInput(label);
      onSave(label, { lat, lng });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Errore durante la ricerca');
    } finally {
      setLoading(false);
    }
  };

  const useCurrentGpsAsHome = async () => {
    if (!userLoc) {
      setError('Posizione GPS non disponibile al momento.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLoc.lat}&lon=${userLoc.lng}&zoom=18&accept-language=it`
      );
      const data = await res.json();
      const label = data?.display_name
        ? data.display_name.split(',').slice(0, 3).join(', ')
        : 'La mia posizione attuale';
      
      setAddressInput(label);
      onSave(label, userLoc);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch {
      const label = 'Posizione GPS Attuale';
      setAddressInput(label);
      onSave(label, userLoc);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <Sheet onClose={onClose} title="Indirizzo di Casa">
          <div className="space-y-4 px-1 py-2">
            <p style={{ color: 'var(--mf-ink-2)', fontSize: 13, lineHeight: 1.5 }}>
              Imposta il tuo indirizzo di casa: quando attivi la modalità{' '}
              <strong style={{ color: 'var(--mf-accent)' }}>Direzione Casa</strong> nella Home, l&apos;algoritmo
              calcolerà il miglior distributore considerando la <strong style={{ color: 'var(--mf-ink)' }}>deviazione marginale</strong>{' '}
              dal tuo punto attuale verso casa.
            </p>

            {/* Input box */}
            <div
              className="flex items-center gap-2 px-3 py-2.5"
              style={{
                background: 'var(--mf-surface-raised)',
                borderRadius: 'var(--mf-radius-md)',
                border: '1px solid var(--mf-hairline)',
              }}
            >
              <Home size={18} style={{ color: 'var(--mf-accent)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Es. Via Baracca 5, Lugo oppure Bagnacavallo"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') geocodeAddress();
                }}
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: 'var(--mf-ink)' }}
              />
            </div>

            {error && (
              <p style={{ color: 'var(--mf-price-worst)', fontSize: 12 }}>
                {error}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                tone="primary"
                size="md"
                onClick={geocodeAddress}
                disabled={loading || !addressInput.trim()}
                className="w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Cerco coordinate...
                  </>
                ) : success ? (
                  <>
                    <Check size={16} /> Salvato!
                  </>
                ) : (
                  <>
                    <Search size={16} /> Salva Indirizzo
                  </>
                )}
              </Button>

              {userLoc && (
                <Button
                  tone="quiet"
                  size="md"
                  onClick={useCurrentGpsAsHome}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Navigation size={15} style={{ color: 'var(--mf-accent)' }} />
                  Imposta Posizione GPS attuale come Casa
                </Button>
              )}

              {currentAddress && onRemove && (
                <button
                  onClick={() => {
                    onRemove();
                    setAddressInput('');
                    onClose();
                  }}
                  className="mt-2 flex items-center justify-center gap-1.5 py-2 text-xs transition-opacity hover:opacity-80 active:scale-95"
                  style={{ color: 'var(--mf-price-worst)' }}
                >
                  <Trash2 size={13} /> Rimuovi indirizzo di casa
                </button>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </AnimatePresence>
  );
}
