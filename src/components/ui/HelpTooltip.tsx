import React from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  text: string;
  label?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ text, label }) => (
  <span className="relative inline-flex items-center gap-1 group">
    {label && <span>{label}</span>}
    <HelpCircle
      className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help"
      aria-hidden="true"
    />
    <span className="absolute top-full left-0 mt-1.5 px-2 py-1.5 text-[11px] leading-snug text-white bg-slate-800 rounded-lg shadow-lg normal-case tracking-normal whitespace-normal w-max max-w-[240px] opacity-0 group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none z-30">
      {text}
    </span>
  </span>
);

export default HelpTooltip;
