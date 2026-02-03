import React from 'react';

interface Props {
  label: string;
  addr: string;
  onCopy: (s: string) => void;
  isCopied: boolean;
}

const CryptoItem: React.FC<Props> = ({ label, addr, onCopy, isCopied }) => {
  return (
    <div 
      className={`group relative cursor-pointer px-4 py-2 rounded-xl border transition-all flex items-center gap-4 ${isCopied ? 'border-primary bg-primary/5' : 'border-[#333] hover:border-secondary bg-surface'}`}
      onClick={() => onCopy(addr)}
    >
      <span className="text-[10px] font-black text-primary w-24 text-left">{label}</span>
      <span className="text-[10px] font-mono text-secondary truncate max-w-[120px] md:max-w-none">
        {isCopied ? 'COPIED TO CLIPBOARD' : addr}
      </span>
      
      {/* Restored hover description */}
      <div className="absolute left-1/2 -top-8 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-[#333] px-2 py-1 rounded text-[9px] pointer-events-none whitespace-nowrap z-10 shadow-xl">
        支持通过 {label} 链接收 USDT
      </div>
    </div>
  );
};

export default CryptoItem;
