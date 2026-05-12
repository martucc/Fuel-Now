import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface BottomSheetProps {
  children: React.ReactNode;
  title: string;
}

export function BottomSheet({ children, title }: BottomSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div 
      initial={false}
      animate={{ y: isOpen ? 0 : 'calc(100% - 60px)' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="fixed bottom-0 left-0 right-0 z-[1000] liquid-glass rounded-b-none p-4 pb-8"
      style={{ height: '80vh' }}
    >
      <div 
        className="flex justify-between items-center cursor-pointer pb-4 border-b border-white/10"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {isOpen ? <ChevronDown /> : <ChevronUp />}
      </div>
      <div className="overflow-y-auto h-full pt-4 pb-12">
        {children}
      </div>
    </motion.div>
  );
}
