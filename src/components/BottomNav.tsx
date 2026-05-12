import { motion } from "motion/react";
import { Home, Map as MapIcon, Route, Car, Brain, Bell } from "lucide-react";

type Tab = "home" | "map" | "trip" | "veicolo" | "analysis" | "alerts";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs = [
  { id: "home" as const, icon: Home, label: "HOME" },
  { id: "map" as const, icon: MapIcon, label: "MAPPA" },
  { id: "trip" as const, icon: Route, label: "TRIP" },
  { id: "veicolo" as const, icon: Car, label: "GARAGE" },
  { id: "analysis" as const, icon: Brain, label: "INTEL" },
  { id: "alerts" as const, icon: Bell, label: "ALERT" },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-2 pt-1 safe-bottom pointer-events-none">
      {/* Gradient fade */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/80 to-transparent -z-10" />
      
      <motion.nav 
        className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-1 py-1.5 flex items-center justify-around max-w-lg mx-auto pointer-events-auto"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center px-2 py-2 rounded-full transition-colors min-w-[50px] ${
                isActive ? "text-blue-500" : "text-gray-500 hover:text-gray-300"
              }`}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-blue-500/10 rounded-full border border-blue-500/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon 
                className={`relative z-10 w-5 h-5 transition-transform duration-300 ${
                  isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "scale-100"
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span 
                className={`relative z-10 text-[8px] font-black tracking-widest mt-1 transition-opacity duration-200 ${
                  isActive ? "opacity-100 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "opacity-60"
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div 
                  className="absolute -bottom-1.5 w-1 h-1 bg-blue-500 rounded-full drop-shadow-[0_0_5px_rgba(59,130,246,1)]"
                  layoutId="activeDot"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.nav>
    </div>
  );
}
