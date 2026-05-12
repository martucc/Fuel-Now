import { motion } from 'motion/react';
import { Zap } from 'lucide-react';

export function SplashScreen() {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }}
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-400/10 blur-[80px] rounded-full" />
      </div>

      {/* Logo Section */}
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 1,
            ease: "easeOut",
            scale: { type: "spring", damping: 15, stiffness: 100 }
          }}
          className="relative w-32 h-32 mb-8"
        >
          {/* Outer Glow Ring */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-[38px] border-2 border-blue-500/20 border-t-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.2)]"
          />
          
          {/* Inner Logo Shape */}
          <div className="absolute inset-2 bg-gradient-to-br from-blue-600 to-blue-900 rounded-[32px] flex items-center justify-center shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                filter: ["drop-shadow(0 0 5px rgba(255,255,255,0.5))", "drop-shadow(0 0 15px rgba(255,255,255,0.8))", "drop-shadow(0 0 5px rgba(255,255,255,0.5))"]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap size={56} className="text-white fill-white" />
            </motion.div>
            
            {/* Scan Line Effect */}
            <motion.div 
              animate={{ top: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent pointer-events-none"
            />
          </div>
        </motion.div>

        {/* Brand Name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase mb-1">
            Martucc<span className="text-blue-500">Fuel</span>
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.5em] ml-1">
              Neural Intelligence
            </p>
          </div>
        </motion.div>
      </div>

      {/* Loading Progress */}
      <div className="absolute bottom-20 left-12 right-12 max-w-xs mx-auto space-y-4">
        <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
          />
        </div>
        <motion.p 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-[9px] font-black text-[#8e8e93] text-center uppercase tracking-[0.3em]"
        >
          Sincronizzazione Nucleo Operativo...
        </motion.p>
      </div>

      {/* Background Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />
    </motion.div>
  );
}
