import React from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface BottomSheetProps {
  children: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export function BottomSheet({ children, title, isOpen, onToggle }: BottomSheetProps) {
  return (
    <motion.div 
      initial={false}
      animate={{ y: isOpen ? 0 : 'calc(100% - 100px)' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="fixed bottom-0 left-0 right-0 z-[1000] liquid-glass rounded-b-none p-4 pb-8"
      style={{ height: '85vh' }}
    >
      <div 
        className="flex flex-col items-center cursor-pointer pb-4 border-b border-white/5"
        onClick={() => onToggle(!isOpen)}
      >
        <div className="w-12 h-1.5 bg-white/10 rounded-full mb-4" />
        <div className="flex justify-between items-center w-full px-2">
           <h2 className="text-lg font-black uppercase italic tracking-tighter text-white">{title}</h2>
           {isOpen ? <ChevronDown className="text-blue-500" /> : <ChevronUp className="text-blue-500" />}
        </div>
      </div>
      <div className="overflow-y-auto h-full pt-6 pb-24 no-scrollbar">
        {children}
      </div>
    </motion.div>
  );
}
