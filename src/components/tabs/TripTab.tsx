import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDownUp, Navigation2, Fuel } from 'lucide-react';
import type { FuelStation, FuelType } from '../../types';
import { CityAutocomplete } from '../CityAutocomplete';
import { NativeLeafletTripMap } from '../NativeLeafletTripMap';
import { Card, Section, Row, Empty } from '../../design/primitives/Surface';
import { Widget, WidgetGrid } from '../../design/primitives/Widget';
import type { Piano } from '../../domain/viaggio';
import { MOTIVO_TESTO } from '../../domain/viaggio';
import { euro as euroIt, numero, litri as litriIt, chilometri } from '../../lib/formato';
import { Button } from '../../design/primitives/Button';
import { Toggle } from '../../design/primitives/Toggle';
import { BrandLogo } from '../../design/primitives/BrandLogo';
import { PageTitle } from '../../ui/chrome/PageTitle';

interface Props {
  tripStart: string; setTripStart: (v: string) => void;
  tripEnd: string; setTripEnd: (v: string) => void;
  tripKml: number; setTripKml: (v: number) => void;
  tripUnit: 'kml' | 'l100'; setTripUnit: (v: 'kml' | 'l100') => void;
  tankLiters: number; setTankLiters: (v: number) => void;
  tripStrategy: string; setTripStrategy: (v: any) => void;
  tripStatus: string;
  tripDist: number;
  tripCalculated: boolean;
  tripRoute: any;
  tripStops: any[];
  selectedFuel: FuelType;
  cheapestPrice: number;
  calculateTripRoute: () => void;
  userLoc: { lat: number; lng: number } | null;
  stations: FuelStation[];
  tripCurrentFuel: number | null;
  setTripCurrentFuel: (v: number | null) => void;
  tripToll: boolean;
  setTripToll: (v: boolean) => void;
  tripNearby?: any[];
  onStationClick?: (s: FuelStation) => void;
  mapStyle?: 'dark' | 'voyager';
  /** Il piano di rifornimento: dove fermarsi e quanto metterci. */
  piano?: Piano | null;
}

const STRATEGIES = [
  { id: 'balanced', label: 'Bilanciato' },
  { id: 'save', label: 'Risparmio' },
  { id: 'fast', label: 'Veloce' },
] as const;

export function TripTab(p: Props) {
  const kplSicuro = p.tripUnit === 'kml' ? p.tripKml : p.tripKml > 0 ? 100 / p.tripKml : 0;
  const piano = p.piano ?? null;
  // Quanto brucia il viaggio, comprese le deviazioni del piano.
  const litriBruciati = kplSicuro > 0 ? p.tripDist / kplSicuro + (piano?.litriDeviazione ?? 0) : 0;
  const swap = () => { const a = p.tripStart; p.setTripStart(p.tripEnd); p.setTripEnd(a); };
  const kpl = p.tripUnit === 'kml' ? p.tripKml : p.tripKml > 0 ? 100 / p.tripKml : 0;

  // Stima pedaggio: quota autostradale in base alla distanza x tariffa media IT
  const highwayShare = p.tripDist < 50 ? 0 : p.tripDist < 100 ? 0.3 : p.tripDist < 300 ? 0.55 : 0.7;
  const highwayKm = p.tripDist * highwayShare;
  const tollCost = p.tripToll ? highwayKm * 0.077 : 0;

  const currentFuel = p.tripCurrentFuel == null ? p.tankLiters : Math.max(0, Math.min(p.tankLiters, p.tripCurrentFuel));
  const filled = p.tripStart.trim().length > 0 && p.tripEnd.trim().length > 0;

  const [locating, setLocating] = useState(false);
  const autoFillRef = useRef(false);
  const [nearbySort, setNearbySort] = useState<'price' | 'detour' | 'progress'>('price');

  const prezzoRiferimento = (() => {
    if (!p.tripNearby || p.tripNearby.length === 0) return null;
    let min = Infinity;
    for (const s of p.tripNearby) {
      const v = s.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price || 0;
      if (v > 0 && v < min) min = v;
    }
    return min === Infinity ? null : min;
  })();

  const nearbyMinPrice = (() => {
    if (!p.tripNearby || p.tripNearby.length === 0) return null;
    let min = Infinity;
    for (const s of p.tripNearby) {
      const v = s.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price || 0;
      if (v > 0 && v < min) min = v;
    }
    return min === Infinity ? null : min;
  })();

  const sortedNearby = (() => {
    if (!p.tripNearby) return [];
    const arr = p.tripNearby.map((s) => ({
      ...s,
      _price: s.prices?.find((pp: any) => pp.type === p.selectedFuel)?.price || 0,
    }));
    if (nearbySort === 'price') arr.sort((a, b) => (a._price || Infinity) - (b._price || Infinity));
    else if (nearbySort === 'detour') arr.sort((a, b) => a.routeDetourKm - b.routeDetourKm);
    else arr.sort((a, b) => a.routeProgressKm - b.routeProgressKm);
    return arr;
  })();

  const extraCities = useMemo(
    () => Array.from(new Set(p.stations.map((s) => (s.city || '').trim()).filter(Boolean))),
    [p.stations]
  );

  const reverseGeocode = async () => {
    if (!p.userLoc) return;
    setLocating(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.userLoc.lat}&lon=${p.userLoc.lng}&zoom=12&accept-language=it`
      );
      const d = await r.json();
      const a = d.address || {};
      const city = a.city || a.town || a.village || a.municipality || a.county || d.name;
      if (city) p.setTripStart(city);
    } catch { /* ignora */ }
    finally { setLocating(false); }
  };

  useEffect(() => {
    if (autoFillRef.current) return;
    if (!p.userLoc) return;
    const cur = p.tripStart.trim();
    if (cur && cur !== 'Milano') { autoFillRef.current = true; return; }
    autoFillRef.current = true;
    reverseGeocode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.userLoc]);

  const campoNumerico = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    unit: string,
    step?: string
  ) => (
    <div
      className="min-w-0 px-4 py-3"
      style={{ background: 'var(--mf-ground)', border: '1px solid var(--mf-hairline)', borderRadius: 'var(--mf-radius-md)' }}
    >
      <div className="mf-label" style={{ fontSize: 9 }}>{label}</div>
      <div className="flex items-baseline gap-1.5">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value || '0'))}
          className="mf-num min-w-0 flex-1 border-none bg-transparent outline-none"
          style={{ color: 'var(--mf-ink)', fontSize: 22, fontWeight: 600, padding: '2px 0' }}
        />
        <span className="mf-label flex-shrink-0" style={{ fontSize: 10 }}>{unit}</span>
      </div>
    </div>
  );

  return (
    <motion.div
      key="trip"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-5 pb-32"
    >
      <PageTitle eyebrow="viaggio" title="Pianifica il pieno lungo la strada" />

      {/* Partenza e arrivo */}
      <Card pad="none" className="relative z-40">
        <div className="flex items-stretch">
          <div className="min-w-0 flex-1">
            <CityAutocomplete
              value={p.tripStart}
              onChange={p.setTripStart}
              placeholder="Partenza"
              dot={<span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--mf-muted)', flexShrink: 0 }} />}
              extraCities={extraCities}
              onUseLocation={reverseGeocode}
              isLocating={locating}
            />
            <div style={{ borderTop: '1px solid var(--mf-hairline)' }} />
            <CityAutocomplete
              value={p.tripEnd}
              onChange={p.setTripEnd}
              placeholder="Arrivo"
              dot={<span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--mf-accent)', flexShrink: 0 }} />}
              extraCities={extraCities}
            />
          </div>
          <button
            onClick={swap}
            aria-label="Inverti partenza e arrivo"
            className="flex flex-shrink-0 items-center px-4 transition-transform active:scale-90"
            style={{ borderLeft: '1px solid var(--mf-hairline)', color: 'var(--mf-ink-2)' }}
          >
            <ArrowDownUp size={18} />
          </button>
        </div>
      </Card>

      {/* Veicolo */}
      <Section title="la tua auto">
        <Card pad="md">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="mf-label" style={{ fontSize: 9 }}>unità del consumo</span>
            <div
              className="inline-flex p-0.5"
              style={{ background: 'var(--mf-ground)', borderRadius: 'var(--mf-radius-pill)', border: '1px solid var(--mf-hairline)' }}
            >
              {(['kml', 'l100'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => p.setTripUnit(u)}
                  className="px-3 py-1 transition-colors"
                  style={{
                    borderRadius: 'var(--mf-radius-pill)',
                    background: p.tripUnit === u ? 'var(--mf-accent)' : 'transparent',
                    color: p.tripUnit === u ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                    fontFamily: 'var(--mf-font-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {u === 'kml' ? 'km/L' : 'L/100'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {campoNumerico('consumo', p.tripKml, p.setTripKml, p.tripUnit === 'kml' ? 'km/L' : 'L/100', '0.1')}
            {campoNumerico('serbatoio', p.tankLiters, (v) => p.setTankLiters(Math.round(v)), 'L')}
          </div>

          <div
            className="mt-3 px-4 py-3"
            style={{ background: 'var(--mf-ground)', border: '1px solid var(--mf-hairline)', borderRadius: 'var(--mf-radius-md)' }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="mf-label" style={{ fontSize: 9 }}>carburante adesso</span>
              <span className="mf-num" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                <span style={{ color: 'var(--mf-accent)' }}>{currentFuel.toFixed(0)} L</span> di {p.tankLiters} L
                {' · ~'}{Math.round(currentFuel * kpl * 0.8)} km
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={p.tankLiters || 1}
              step={1}
              value={currentFuel}
              onChange={(e) => p.setTripCurrentFuel(parseInt(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--mf-accent)' }}
            />
            <div className="mt-1 flex justify-between">
              <span className="mf-label" style={{ fontSize: 9 }}>vuoto</span>
              <button
                onClick={() => p.setTripCurrentFuel(p.tankLiters)}
                className="mf-label"
                style={{ fontSize: 9, color: 'var(--mf-accent)' }}
              >
                pieno
              </button>
            </div>
          </div>
        </Card>
      </Section>

      {/* Strategia */}
      <Section title="come vuoi viaggiare">
        <Card pad="md">
          <div
            className="mb-3 flex w-full p-0.5"
            style={{ background: 'var(--mf-ground)', borderRadius: 'var(--mf-radius-pill)', border: '1px solid var(--mf-hairline)' }}
          >
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => p.setTripStrategy(s.id)}
                className="flex-1 py-2 transition-colors"
                style={{
                  borderRadius: 'var(--mf-radius-pill)',
                  background: p.tripStrategy === s.id ? 'var(--mf-accent)' : 'transparent',
                  color: p.tripStrategy === s.id ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                  fontFamily: 'var(--mf-font-sans)',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0">
              <div style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}>
                Conta il pedaggio
              </div>
              <div className="mf-num" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                stima su ~{Math.round(highwayKm)} km a 0,077 €/km
              </div>
            </div>
            <Toggle on={p.tripToll} onChange={() => p.setTripToll(!p.tripToll)} ariaLabel="Conta il pedaggio" />
          </div>
        </Card>
      </Section>

      <Button full size="lg" tone="primary" disabled={!filled} onClick={p.calculateTripRoute} icon={<Navigation2 size={18} />}>
        Calcola il percorso
      </Button>

      {p.tripStatus && (
        <p className="text-center" style={{ color: 'var(--mf-ink-2)', fontSize: 12 }}>
          {p.tripStatus}
        </p>
      )}

      {p.tripCalculated && p.tripRoute && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div
            className="relative w-full overflow-hidden"
            style={{ height: 320, borderRadius: 'var(--mf-radius-lg)', border: '1px solid var(--mf-hairline)' }}
          >
            <NativeLeafletTripMap
              tripRoute={p.tripRoute}
              tripStops={p.tripStops}
              tripNearby={p.tripNearby}
              selectedFuel={p.selectedFuel}
              mapStyle={p.mapStyle}
              onStationClick={p.onStationClick}
            />
          </div>

          {piano && !piano.fattibile && (
            <Card pad="md">
              <Empty
                icon={<Fuel size={20} />}
                title="Non riesco a pianificare"
                hint={piano.motivo ? MOTIVO_TESTO[piano.motivo] : 'Manca qualcosa per fare il conto.'}
              />
            </Card>
          )}

          {piano && piano.fattibile && (
            <>
              <Card pad="lg">
                <div className="mf-label" style={{ fontSize: 9 }}>
                  {piano.litriComprati > 0
                    ? 'quanto tiri fuori'
                    : tollCost > 0
                      ? 'ci arrivi col pieno che hai, resta il pedaggio'
                      : 'ci arrivi col pieno che hai'}
                </div>
                <div
                  className="mf-num mt-2"
                  style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.045em', color: 'var(--mf-ink)', lineHeight: 1 }}
                >
                  {euroIt(piano.spesaCarburante + tollCost)}
                </div>
                <p className="mt-2" style={{ color: 'var(--mf-ink-2)', fontSize: 12.5, lineHeight: 1.5 }}>
                  {piano.litriComprati > 0 ? (
                    <>
                      {litriIt(piano.litriComprati)} da comprare
                      {p.tripToll && tollCost > 0 && <> · {euroIt(tollCost)} di pedaggio</>}
                      {piano.soste.length > 0 && <> · {piano.soste.length} {piano.soste.length === 1 ? 'sosta' : 'soste'}</>}
                    </>
                  ) : (
                    <>Non ti serve fermarti: {litriIt(litriBruciati)} escono dal serbatoio che hai già.</>
                  )}
                </p>

                {/* Il viaggio consuma comunque: dirlo solo quando non si compra
                    niente, altrimenti sarebbe un secondo numero che confonde. */}
                {piano.litriComprati === 0 && prezzoRiferimento !== null && (
                  <p className="mt-3" style={{ color: 'var(--mf-muted)', fontSize: 11.5, lineHeight: 1.5 }}>
                    Rimettere quei litri costa circa{' '}
                    <span className="mf-num">{euroIt(litriBruciati * prezzoRiferimento)}</span> al miglior prezzo
                    trovato lungo la strada.
                  </p>
                )}

                {piano.risparmioEur !== null && Math.abs(piano.risparmioEur) > 0.5 && (
                  <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--mf-hairline)' }}>
                    <p style={{ color: 'var(--mf-ink)', fontSize: 13.5, lineHeight: 1.6 }}>
                      {piano.risparmioEur > 0 ? (
                        <>
                          Fermandoti dove dico risparmi{' '}
                          <b className="mf-num" style={{ color: 'var(--mf-price-best)' }}>{euroIt(piano.risparmioEur)}</b>{' '}
                          rispetto a fare il pieno prima di partire ({euroIt(piano.spesaPienoPrima!)}).
                        </>
                      ) : (
                        <>
                          Qui conviene il pieno prima di partire: costerebbe{' '}
                          <b className="mf-num" style={{ color: 'var(--mf-price-best)' }}>{euroIt(piano.spesaPienoPrima!)}</b>,
                          {' '}cioè {euroIt(Math.abs(piano.risparmioEur))} in meno.
                        </>
                      )}
                    </p>
                  </div>
                )}
              </Card>

              <WidgetGrid>
                <Widget
                  label="distanza"
                  value={chilometri(p.tripDist)}
                  sub={p.tripRoute?.durationMin ? `circa ${Math.round(p.tripRoute.durationMin / 60)} h di guida` : undefined}
                />
                <Widget
                  label="arrivi con"
                  value={litriIt(piano.litriAllArrivo)}
                  color={piano.litriAllArrivo < p.tankLiters * 0.1 ? 'var(--mf-price-high)' : 'var(--mf-price-best)'}
                  sub={`${chilometri(piano.litriAllArrivo * kpl)} di autonomia`}
                />
                {piano.kmDeviazione > 0.2 && (
                  <Widget
                    label="deviazioni"
                    value={chilometri(piano.kmDeviazione, 1)}
                    sub={`${litriIt(piano.litriDeviazione)} bruciati per arrivarci`}
                  />
                )}
                <Widget
                  label="al chilometro"
                  value={p.tripDist > 0 ? `${numero((piano.spesaCarburante + tollCost) / p.tripDist, 3)} €` : null}
                  sub="tutto compreso"
                />
              </WidgetGrid>
            </>
          )}

          {piano && piano.fattibile && piano.soste.length > 0 && (
            <Section title="La scaletta" aside={`${piano.soste.length} ${piano.soste.length === 1 ? 'sosta' : 'soste'}`}>
              <Card pad="md">
                <div className="relative">
                  {/* Il filo che tiene insieme le soste: si legge come un viaggio. */}
                  <span
                    className="absolute"
                    style={{ left: 17, top: 12, bottom: 12, width: 2, background: 'var(--mf-hairline)' }}
                  />
                  {piano.soste.map((sosta, i) => {
                    const st = (p.tripNearby || []).find((x: any) => x.id === sosta.tappa.id);
                    return (
                      <button
                        key={sosta.tappa.id}
                        onClick={() => st && p.onStationClick?.(st)}
                        className="relative flex w-full items-start gap-3 py-3 text-left"
                      >
                        <span
                          className="mf-num relative z-10 flex flex-shrink-0 items-center justify-center"
                          style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--mf-accent)', color: 'var(--mf-accent-ink)',
                            fontSize: 13, fontWeight: 600,
                          }}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <BrandLogo brand={sosta.tappa.brand} name={sosta.tappa.nome} size={22} />
                            <span
                              className="truncate"
                              style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14.5, color: 'var(--mf-ink)' }}
                            >
                              {sosta.tappa.brand}
                            </span>
                          </span>
                          <span className="mf-num mt-1 block" style={{ color: 'var(--mf-ink-2)', fontSize: 11.5 }}>
                            al km {numero(sosta.tappa.kmDaPartenza, 0)}
                            {sosta.tappa.deviazioneKm > 0.15 && <> &middot; {numero(sosta.tappa.deviazioneKm * 2, 1)} km di deviazione</>}
                          </span>
                          <span
                            className="mt-1.5 inline-block px-2 py-0.5"
                            style={{
                              borderRadius: 'var(--mf-radius-pill)',
                              background: 'var(--mf-ground)',
                              border: '1px solid var(--mf-hairline)',
                              color: 'var(--mf-ink)',
                              fontSize: 11.5,
                            }}
                          >
                            {sosta.pieno ? 'fai il pieno' : 'metti'} <b className="mf-num">{litriIt(sosta.litri)}</b>
                            {' \u00b7 '}<span className="mf-num">{euroIt(sosta.spesa)}</span>
                          </span>
                        </span>
                        <span className="flex-shrink-0 text-right">
                          <span className="mf-num block" style={{ color: 'var(--mf-price-best)', fontSize: 15, fontWeight: 600 }}>
                            {numero(sosta.tappa.prezzo, 3)}
                          </span>
                          <span className="mf-label block" style={{ fontSize: 9 }}>al litro</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p
                  className="mt-3 pt-3"
                  style={{ borderTop: '1px solid var(--mf-hairline)', color: 'var(--mf-muted)', fontSize: 11, lineHeight: 1.5 }}
                >
                  Dove costa meno di quello che hai in pancia si mette il minimo per arrivare all&rsquo;occasione
                  successiva; dove non c&rsquo;è di meglio si fa il pieno e si va più lontano possibile.
                </p>
              </Card>
            </Section>
          )}

          {sortedNearby.length > 0 && (
            <Section title="impianti lungo la strada" aside={`${sortedNearby.length}`}>
              <div
                className="mb-3 flex p-0.5"
                style={{ background: 'var(--mf-ground)', borderRadius: 'var(--mf-radius-pill)', border: '1px solid var(--mf-hairline)' }}
              >
                {([
                  { id: 'price' as const, label: 'Prezzo' },
                  { id: 'detour' as const, label: 'Deviazione' },
                  { id: 'progress' as const, label: 'Ordine' },
                ]).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setNearbySort(o.id)}
                    className="flex-1 py-1.5 transition-colors"
                    style={{
                      borderRadius: 'var(--mf-radius-pill)',
                      background: nearbySort === o.id ? 'var(--mf-accent)' : 'transparent',
                      color: nearbySort === o.id ? 'var(--mf-accent-ink)' : 'var(--mf-ink-2)',
                      fontFamily: 'var(--mf-font-sans)',
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <Card pad="md">
                <div className="max-h-[460px] overflow-y-auto">
                  {sortedNearby.map((st: any, i: number) => {
                    const isCheapest = nearbyMinPrice !== null && st._price === nearbyMinPrice;
                    const isStop = p.tripStops.some((s) => s.id === st.id);
                    return (
                      <Row key={st.id} first={i === 0} onClick={() => p.onStationClick?.(st)}>
                        <BrandLogo brand={st.brand} name={st.name} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className="truncate"
                              style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--mf-ink)' }}
                            >
                              {st.brand || st.name}
                            </span>
                            {isCheapest && <Tag text="min" color="var(--mf-price-best)" />}
                            {isStop && <Tag text="sosta" color="var(--mf-accent)" />}
                          </span>
                          <span className="mf-num block truncate" style={{ color: 'var(--mf-ink-2)', fontSize: 11 }}>
                            al km {st.routeProgressKm.toFixed(0)} · +{(st.routeDetourKm * 2).toFixed(1)} km di deviazione
                          </span>
                        </span>
                        <span className="flex-shrink-0 text-right">
                          <span
                            className="mf-num block"
                            style={{ color: isCheapest ? 'var(--mf-price-best)' : 'var(--mf-ink)', fontSize: 15, fontWeight: 600 }}
                          >
                            {st._price ? st._price.toFixed(3).replace('.', ',') : '—'}
                          </span>
                        </span>
                      </Row>
                    );
                  })}
                </div>
              </Card>
            </Section>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="mf-label flex-shrink-0 px-1.5 py-0.5"
      style={{
        fontSize: 8,
        color,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        borderRadius: 'var(--mf-radius-pill)',
      }}
    >
      {text}
    </span>
  );
}
