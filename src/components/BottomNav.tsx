import { motion } from "motion/react";
import { Home, Map as MapIcon, Route, Car, TrendingUp } from "lucide-react";
import { triggerHaptic } from "../lib/haptics";


type Tab = "home" | "map" | "trip" | "veicolo" | "analysis" | "alerts" | "pieno";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  visible?: boolean;
}

/* Cinque schede, cinque mestieri diversi. Garage e Pieno erano la stessa
   cosa spezzata in due: l'auto di la, i suoi pieni di qua. */
const tabs = [
  { id: "home" as const, icon: Home, label: "HOME" },
  { id: "map" as const, icon: MapIcon, label: "MAPPA" },
  { id: "trip" as const, icon: Route, label: "VIAGGIO" },
  { id: "veicolo" as const, icon: Car, label: "AUTO" },
  { id: "analysis" as const, icon: TrendingUp, label: "MERCATO" },
];

export function BottomNav({ activeTab, onTabChange, visible = true }: BottomNavProps) {
  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 z-[1000] px-2 pt-1 safe-bottom pointer-events-none" 
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      /*
        L'initial va dichiarato. Senza, motion prende come punto di partenza
        quello che trova nel DOM — opacita 1 — e anima VERSO il nascosto:
        durante il caricamento la barra faceva in tempo a comparire e poi
        scivolare via, che e il lampeggio che si vedeva.
      */
      initial={{ y: visible ? 0 : 120, opacity: visible ? 1 : 0 }}
      animate={{
        y: visible ? 0 : 120,
        opacity: visible ? 1 : 0
      }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {/* Sfumatura che stacca la pillola dal contenuto che le scorre sotto */}
      <div
        className="absolute inset-x-0 bottom-0 h-24 -z-10"
        style={{ background: 'linear-gradient(to top, var(--mf-ground) 45%, transparent)' }}
      />
      
      <motion.nav 
        className="relative backdrop-blur-xl px-1 py-1.5 flex items-center justify-around max-w-lg mx-auto pointer-events-auto"
        style={{
          background: 'color-mix(in srgb, var(--mf-surface-raised) 70%, transparent)',
          border: '1px solid var(--mf-hairline)',
          borderRadius: 'var(--mf-radius-pill)',
          boxShadow: '0 8px 32px rgba(0,0,0,.45)',
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => {
                triggerHaptic('light');
                onTabChange(tab.id);
              }}
              className="relative flex flex-col items-center justify-center px-2 py-2 rounded-full transition-colors min-w-[50px]"
              style={{ color: isActive ? 'var(--mf-accent)' : 'var(--mf-ink-2)' }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'color-mix(in srgb, var(--mf-accent) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--mf-accent) 28%, transparent)',
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon 
                className={`relative z-10 w-5 h-5 transition-transform duration-300 ${isActive ? "scale-110" : "scale-100"}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span 
                className="relative z-10 text-[8px] font-black tracking-widest mt-1 transition-opacity duration-200"
                style={{ opacity: isActive ? 1 : 0.6, fontFamily: 'var(--mf-font-sans)' }}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div 
                  className="absolute -bottom-1.5 w-1 h-1 rounded-full"
                  style={{ background: 'var(--mf-accent)' }}
                  layoutId="activeDot"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.nav>
    </motion.div>
  );
}
