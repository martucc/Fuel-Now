import { motion } from 'motion/react';
import type { FuelStation, FuelType } from '../../types';
import { VehicleTab } from './VehicleTab';
import { PienoTab } from './PienoTab';
import { VehicleExpenses } from '../VehicleExpenses';
import { VehicleDeadlines } from '../VehicleDeadlines';
import { PageTitle } from '../../ui/chrome/PageTitle';
import { Riepilogo } from '../../ui/auto/Riepilogo';
import { SCHERMATA, BLOCCO } from '../../design/motion';

interface Props {
  cars: any[];
  selectedCar: any;
  setSelectedCar: (c: any) => void;
  carSearchQuery: string;
  setCarSearchQuery: (q: string) => void;
  handleSelectCar: (c: any) => void;
  setTab: (t: any) => void;
  stations: FuelStation[];
  selectedFuel: FuelType;
  userLoc: { lat: number; lng: number } | null;
}

/**
 * Tutto quello che riguarda la tua auto, in una schermata sola.
 *
 * Erano due — Garage e Pieno — che parlavano della stessa cosa: l'auto
 * stava di la, i suoi pieni di qua, e per capire quanto ti costa dovevi
 * saltare avanti e indietro. L'ordine qui e quello dell'uso: prima cosa
 * succede adesso (prossimo pieno, quanto hai risparmiato, budget), poi
 * quello che hai fatto (i pieni), poi l'amministrazione (spese, scadenze).
 */
export function AutoTab(p: Props) {
  return (
    <motion.div
      key="auto"
      variants={SCHERMATA}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5 pb-32"
    >
      <PageTitle
        eyebrow="auto"
        title={p.selectedCar ? 'La tua auto' : 'Scegli l’auto'}
        sub={
          p.selectedCar
            ? 'Serbatoio, consumo reale e spese: da qui esce quanto ti costa davvero'
            : 'Serve a calcolare litri, consumo e costo del viaggio sui tuoi numeri'
        }
      />

      <motion.div variants={BLOCCO}>
        <VehicleTab
          embedded
          cars={p.cars}
          selectedCar={p.selectedCar}
          setSelectedCar={p.setSelectedCar}
          carSearchQuery={p.carSearchQuery}
          setCarSearchQuery={p.setCarSearchQuery}
          handleSelectCar={p.handleSelectCar}
        />
      </motion.div>

      {p.selectedCar && (
        <>
          {/* Il colpo d'occhio, prima del dettaglio: le quattro cose che si
              vogliono sapere aprendo la scheda dell'auto. */}
          <Riepilogo
            carModel={p.selectedCar.model}
            wltpKml={p.selectedCar.kml}
            tankLiters={p.selectedCar.liters}
          />

          <PienoTab
            embedded
            selectedCar={p.selectedCar}
            setTab={p.setTab}
            stations={p.stations}
            selectedFuel={p.selectedFuel}
            userLoc={p.userLoc}
          />

          <VehicleExpenses carModel={p.selectedCar.model} />
          <VehicleDeadlines carModel={p.selectedCar.model} />
        </>
      )}
    </motion.div>
  );
}
