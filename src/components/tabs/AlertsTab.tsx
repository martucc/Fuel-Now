import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, X, TrendingUp, Flame, Fuel, AlertCircle, Send, Plus, Target, CalendarClock, Wallet } from 'lucide-react';
import type { FuelType, Alert } from '../../types';
import { Capacitor } from '@capacitor/core';
import {
  loadPrefs, savePrefs, requestPermission, permissionState, fireTest,
  type NotifPrefs, type NotifCategory,
} from '../../services/notificationService';
import { Card, Section, Empty, Row } from '../../design/primitives/Surface';
import { Button, IconButton } from '../../design/primitives/Button';
import { Toggle } from '../../design/primitives/Toggle';
import { PageTitle } from '../../ui/chrome/PageTitle';

interface Props {
  selectedFuel: FuelType;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
}

const FUELS: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];

function autoPrice(v: string): string {
  if (/[.,]/.test(v)) return v;
  const digits = v.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length === 1) return digits;
  return digits[0] + '.' + digits.slice(1, 4);
}

const CATEGORIES: { id: NotifCategory; icon: any; label: string; desc: string }[] = [
  { id: 'priceThresholds', icon: Target, label: 'Soglia prezzo', desc: 'Quando un carburante scende sotto il prezzo che imposti tu' },
  { id: 'dailyTrend', icon: TrendingUp, label: 'Andamento del giorno', desc: 'Una volta al giorno, di quanto è cambiato rispetto a ieri' },
  { id: 'bestDealZone', icon: Flame, label: 'Occasioni in zona', desc: 'Quando un impianto sta almeno il 4% sotto la media nazionale' },
  { id: 'pienoReminder', icon: Fuel, label: 'Promemoria pieno', desc: 'Quando il serbatoio è probabilmente in riserva (serve lo storico dei pieni)' },
  { id: 'deadlineReminder', icon: CalendarClock, label: 'Scadenze auto', desc: 'Revisione, bollo, assicurazione: a 30, 7 e 1 giorno dalla scadenza' },
  { id: 'budgetAlert', icon: Wallet, label: 'Budget mensile', desc: 'Al 75%, al 90% e quando lo superi' },
];

export function AlertsTab({ selectedFuel, alerts, setAlerts }: Props) {
  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadPrefs());
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => permissionState());
  const [thresholdInput, setThresholdInput] = useState('1.750');
  const [thresholdFuel, setThresholdFuel] = useState<FuelType>(selectedFuel);

  useEffect(() => { setThresholdFuel(selectedFuel); }, [selectedFuel]);

  useEffect(() => {
    const h = () => setPrefs(loadPrefs());
    window.addEventListener('mf-notif-prefs', h);
    return () => window.removeEventListener('mf-notif-prefs', h);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
        LocalNotifications.checkPermissions().then((status: any) => {
          const result = status.display === 'granted' ? 'granted' : 'denied';
          localStorage.setItem('mf_native_notif_perm', result);
          setPerm(result);
        });
      });
    }
  }, []);

  const updatePrefs = (patch: Partial<NotifPrefs> | ((p: NotifPrefs) => Partial<NotifPrefs>)) => {
    setPrefs(prev => {
      const p = typeof patch === 'function' ? patch(prev) : patch;
      const next = { ...prev, ...p };
      savePrefs(next);
      return next;
    });
  };

  const toggleMaster = async () => {
    if (!prefs.enabled) {
      const res = await requestPermission();
      setPerm(res);
      if (res === 'granted') {
        updatePrefs({ enabled: true });
        await fireTest();
      } else {
        updatePrefs({ enabled: false });
      }
    } else {
      updatePrefs({ enabled: false });
    }
  };

  const toggleCategory = (id: NotifCategory) => {
    updatePrefs(p => ({ categories: { ...p.categories, [id]: !p.categories[id] } }));
  };

  const addThreshold = () => {
    const v = parseFloat(thresholdInput.replace(',', '.'));
    if (!isFinite(v) || v <= 0) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setAlerts(prev => [...prev, { id, fuelType: thresholdFuel, threshold: v, active: true }]);
  };

  const toggleAlert = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const removeAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  const denied = perm === 'denied';
  const unsupported = perm === 'unsupported';

  return (
    <motion.div
      key="alerts"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-5 pb-32"
    >
      <PageTitle eyebrow="allerte" title="Quando avvisarti" />

      <Card pad="lg">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mf-label flex items-center gap-2" style={{ fontSize: 9 }}>
              {prefs.enabled ? <Bell size={11} /> : <BellOff size={11} />} stato
            </div>
            <div
              className="mt-2"
              style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 700, fontSize: 20, color: 'var(--mf-ink)', letterSpacing: '-0.02em' }}
            >
              {prefs.enabled ? 'Notifiche attive' : 'Notifiche spente'}
            </div>
            <p className="mt-1.5" style={{ color: 'var(--mf-ink-2)', fontSize: 12, lineHeight: 1.5 }}>
              {unsupported
                ? 'Questo browser non le supporta.'
                : denied
                  ? 'Hai negato il permesso: va riabilitato nelle impostazioni del sito.'
                  : prefs.enabled
                    ? 'Arrivano solo per le categorie che scegli qui sotto.'
                    : 'Accendile per ricevere avvisi su prezzi e scadenze.'}
            </p>
          </div>
          <Toggle
            on={prefs.enabled}
            onChange={toggleMaster}
            disabled={unsupported || denied}
            ariaLabel="Attiva o spegni le notifiche"
          />
        </div>

        {denied && (
          <div
            className="mt-4 flex items-start gap-3 p-4"
            style={{
              background: 'color-mix(in srgb, var(--mf-price-worst) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--mf-price-worst) 30%, transparent)',
              borderRadius: 'var(--mf-radius-md)',
            }}
          >
            <AlertCircle size={16} style={{ color: 'var(--mf-price-worst)', flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: 'var(--mf-price-worst)', fontSize: 12, lineHeight: 1.5 }}>
              Apri le impostazioni del browser per questo sito, riabilita le notifiche e ricarica.
            </p>
          </div>
        )}

        {prefs.enabled && (
          <div className="mt-4">
            <Button full tone="quiet" icon={<Send size={14} />} onClick={fireTest}>
              Mandami una notifica di prova
            </Button>
          </div>
        )}
      </Card>

      <Section title="cosa notificare">
        <Card pad="md">
          {CATEGORIES.map((c, i) => {
            const Icon = c.icon;
            const on = prefs.categories[c.id];
            const disabled = !prefs.enabled;
            return (
              <Row key={c.id} first={i === 0} muted={disabled}>
                <span
                  className="flex flex-shrink-0 items-center justify-center"
                  style={{
                    width: 38, height: 38, borderRadius: 'var(--mf-radius-pill)',
                    background: on && !disabled ? 'color-mix(in srgb, var(--mf-accent) 14%, transparent)' : 'var(--mf-ground)',
                    border: '1px solid var(--mf-hairline)',
                    color: on && !disabled ? 'var(--mf-accent)' : 'var(--mf-ink-2)',
                  }}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block"
                    style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}
                  >
                    {c.label}
                  </span>
                  <span className="block" style={{ color: 'var(--mf-ink-2)', fontSize: 11, lineHeight: 1.45 }}>
                    {c.desc}
                  </span>
                </span>
                <Toggle size="sm" on={!!on} onChange={() => toggleCategory(c.id)} disabled={disabled} ariaLabel={c.label} />
              </Row>
            );
          })}
        </Card>
      </Section>

      {prefs.enabled && (
        <Section title="per quali carburanti">
          <Card pad="md">
            <div className="grid grid-cols-2 gap-2">
              {FUELS.map((f) => {
                const catId = `fuel${f}` as NotifCategory;
                const on = prefs.categories[catId] !== false;
                return (
                  <button
                    key={f}
                    onClick={() => toggleCategory(catId)}
                    className="flex items-center justify-between gap-2 p-3 transition-colors"
                    style={{
                      borderRadius: 'var(--mf-radius-md)',
                      border: `1px solid ${on ? 'color-mix(in srgb, var(--mf-accent) 35%, transparent)' : 'var(--mf-hairline)'}`,
                      background: on ? 'color-mix(in srgb, var(--mf-accent) 8%, transparent)' : 'transparent',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--mf-font-sans)',
                        fontWeight: 600,
                        fontSize: 13,
                        color: on ? 'var(--mf-ink)' : 'var(--mf-ink-2)',
                      }}
                    >
                      {f}
                    </span>
                    <Toggle size="sm" on={on} onChange={() => toggleCategory(catId)} ariaLabel={f} />
                  </button>
                );
              })}
            </div>
          </Card>
        </Section>
      )}

      <AnimatePresence>
        {prefs.categories.priceThresholds && prefs.enabled && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Section title="soglie di prezzo" aside={`${alerts.length} attive`}>
              <Card pad="md">
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {FUELS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setThresholdFuel(f)}
                      className="py-2 transition-colors"
                      style={{
                        borderRadius: 'var(--mf-radius-pill)',
                        border: `1px solid ${thresholdFuel === f ? 'transparent' : 'var(--mf-hairline)'}`,
                        background: thresholdFuel === f ? 'var(--mf-accent)' : 'transparent',
                        color: thresholdFuel === f ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                        fontFamily: 'var(--mf-font-sans)',
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {f === 'Benzina' ? 'Benz' : f === 'Metano' ? 'Met' : f}
                    </button>
                  ))}
                </div>

                <div className="flex items-end gap-3">
                  <div
                    className="min-w-0 flex-1 px-4 py-2.5"
                    style={{ background: 'var(--mf-ground)', border: '1px solid var(--mf-hairline)', borderRadius: 'var(--mf-radius-md)' }}
                  >
                    <div className="mf-label" style={{ fontSize: 9 }}>avvisami sotto</div>
                    <div className="flex items-baseline gap-1">
                      <input
                        inputMode="decimal"
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(autoPrice(e.target.value))}
                        placeholder="1.750"
                        className="mf-num min-w-0 flex-1 border-none bg-transparent outline-none"
                        style={{ color: 'var(--mf-ink)', fontSize: 20, fontWeight: 600, padding: '2px 0' }}
                      />
                      <span className="mf-label" style={{ fontSize: 10 }}>€/L</span>
                    </div>
                  </div>
                  <IconButton tone="primary" size={48} ariaLabel="Aggiungi soglia" onClick={addThreshold}>
                    <Plus size={20} strokeWidth={2.5} />
                  </IconButton>
                </div>

                <div className="mt-2">
                  {alerts.length === 0 ? (
                    <Empty title="Nessuna soglia" hint="Imposta un prezzo: ti avviso appena un impianto ci scende sotto." />
                  ) : (
                    alerts.map((a, i) => (
                      <Row key={a.id} first={i === 0} muted={!a.active}>
                        <Toggle size="sm" on={a.active} onChange={() => toggleAlert(a.id)} ariaLabel={`Soglia ${a.fuelType}`} />
                        <span className="min-w-0 flex-1">
                          <span
                            className="block"
                            style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}
                          >
                            {a.fuelType}
                          </span>
                          <span className="mf-num block" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                            sotto {a.threshold.toFixed(3).replace('.', ',')} €/L
                          </span>
                        </span>
                        <IconButton size={32} ariaLabel="Elimina soglia" onClick={() => removeAlert(a.id)}>
                          <X size={14} />
                        </IconButton>
                      </Row>
                    ))
                  )}
                </div>
              </Card>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="px-3 text-center" style={{ color: 'var(--mf-muted)', fontSize: 11, lineHeight: 1.6 }}>
        Gli avvisi partono quando l'app è aperta o è stata usata da poco. Per riceverli sempre,
        installala sulla schermata iniziale.
      </p>
    </motion.div>
  );
}
