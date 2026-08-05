'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InstallationMethodOption {
  id: string;
  number: number;
  code: string;
  name: string;
  description: string;
  svg: string;
}

const METHOD_SVGS: Record<string, string> = {
  A1: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="100" height="60" rx="2" fill="#374151" stroke="#6b7280"/>
    <rect x="20" y="20" width="80" height="40" rx="1" fill="#1f2937" stroke="#9ca3af" stroke-dasharray="2 2"/>
    <circle cx="45" cy="40" r="8" fill="#ea580c" stroke="#f97316"/>
    <circle cx="75" cy="40" r="8" fill="#ea580c" stroke="#f97316"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">In Conduit</text>
  </svg>`,
  A2: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="100" height="60" rx="2" fill="#374151" stroke="#6b7280"/>
    <rect x="25" y="25" width="70" height="30" rx="3" fill="#1f2937" stroke="#9ca3af"/>
    <circle cx="45" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <circle cx="60" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <circle cx="75" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Multi-core in Conduit</text>
  </svg>`,
  B1: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="15" width="20" height="50" fill="#6b7280"/>
    <rect x="30" y="25" width="15" height="30" rx="2" fill="#374151" stroke="#9ca3af"/>
    <circle cx="37" cy="40" r="5" fill="#ea580c" stroke="#f97316"/>
    <rect x="60" y="25" width="15" height="30" rx="2" fill="#374151" stroke="#9ca3af"/>
    <circle cx="67" cy="40" r="5" fill="#ea580c" stroke="#f97316"/>
    <rect x="90" y="25" width="15" height="30" rx="2" fill="#374151" stroke="#9ca3af"/>
    <circle cx="97" cy="40" r="5" fill="#ea580c" stroke="#f97316"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">In Conduit on Wall</text>
  </svg>`,
  B2: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="15" width="20" height="50" fill="#6b7280"/>
    <rect x="35" y="20" width="50" height="40" rx="3" fill="#374151" stroke="#9ca3af"/>
    <circle cx="50" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <circle cx="65" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <circle cx="80" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Multi-core in Conduit</text>
  </svg>`,
  C: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="15" width="20" height="50" fill="#6b7280"/>
    <circle cx="40" cy="40" r="8" fill="#ea580c" stroke="#f97316"/>
    <line x1="48" y1="40" x2="55" y2="40" stroke="#9ca3af" stroke-width="2"/>
    <circle cx="65" cy="40" r="8" fill="#ea580c" stroke="#f97316"/>
    <line x1="73" y1="40" x2="80" y2="40" stroke="#9ca3af" stroke-width="2"/>
    <circle cx="90" cy="40" r="8" fill="#ea580c" stroke="#f97316"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Clipped Directly</text>
  </svg>`,
  E: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="55" width="100" height="8" fill="#4b5563"/>
    <circle cx="45" cy="40" r="8" fill="#10b981" stroke="#059669"/>
    <circle cx="75" cy="40" r="8" fill="#10b981" stroke="#059669"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">In Free Air / Tray</text>
  </svg>`,
  F: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="55" width="100" height="8" fill="#4b5563"/>
    <circle cx="35" cy="35" r="7" fill="#ea580c" stroke="#f97316"/>
    <circle cx="60" cy="35" r="7" fill="#ea580c" stroke="#f97316"/>
    <circle cx="85" cy="35" r="7" fill="#ea580c" stroke="#f97316"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Single-core Free Air</text>
  </svg>`,
  G: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="55" width="100" height="8" fill="#4b5563"/>
    <circle cx="40" cy="30" r="6" fill="#ea580c" stroke="#f97316"/>
    <circle cx="60" cy="30" r="6" fill="#ea580c" stroke="#f97316"/>
    <circle cx="80" cy="30" r="6" fill="#ea580c" stroke="#f97316"/>
    <circle cx="50" cy="42" r="6" fill="#ea580c" stroke="#f97316"/>
    <circle cx="70" cy="42" r="6" fill="#ea580c" stroke="#f97316"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Laid Spaced Free Air</text>
  </svg>`,
  D1: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="100" height="60" fill="#92400e" opacity="0.3"/>
    <rect x="30" y="25" width="60" height="30" rx="3" fill="#1f2937" stroke="#9ca3af"/>
    <circle cx="45" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <circle cx="60" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <circle cx="75" cy="40" r="6" fill="#10b981" stroke="#059669"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Multi-core Underground</text>
  </svg>`,
  D2: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="100" height="60" fill="#92400e" opacity="0.3"/>
    <circle cx="40" cy="40" r="8" fill="#ea580c" stroke="#f97316"/>
    <circle cx="60" cy="40" r="8" fill="#ea580c" stroke="#f97316"/>
    <circle cx="80" cy="40" r="8" fill="#ea580c" stroke="#f97316"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Single-core Underground</text>
  </svg>`,
};

export const INSTALLATION_METHODS: InstallationMethodOption[] = [
  { id: 'A1', number: 1, code: 'A1', name: 'Method A1', description: 'Insulated conductors in conduit in a thermally insulated wall', svg: METHOD_SVGS.A1 },
  { id: 'A2', number: 2, code: 'A2', name: 'Method A2', description: 'Multi-core cable in conduit in a thermally insulated wall', svg: METHOD_SVGS.A2 },
  { id: 'B1', number: 3, code: 'B1', name: 'Method B1', description: 'Insulated conductors in conduit on a wooden wall', svg: METHOD_SVGS.B1 },
  { id: 'B2', number: 4, code: 'B2', name: 'Method B2', description: 'Multi-core cable in conduit on a wooden wall', svg: METHOD_SVGS.B2 },
  { id: 'C', number: 5, code: 'C', name: 'Method C', description: 'Single-core or multi-core cable on a wooden wall', svg: METHOD_SVGS.C },
  { id: 'E', number: 6, code: 'E', name: 'Method E', description: 'Multi-core cable in free air', svg: METHOD_SVGS.E },
  { id: 'F', number: 7, code: 'F', name: 'Method F', description: 'Single-core cables touching in free air', svg: METHOD_SVGS.F },
  { id: 'G', number: 8, code: 'G', name: 'Method G', description: 'Single-core cables spaced in free air', svg: METHOD_SVGS.G },
  { id: 'D1', number: 9, code: 'D1', name: 'Method D1', description: 'Multi-core cable in underground conduit', svg: METHOD_SVGS.D1 },
  { id: 'D2', number: 10, code: 'D2', name: 'Method D2', description: 'Single-core cable in underground conduit', svg: METHOD_SVGS.D2 },
];

interface MethodSelectorProps {
  value: string;
  onChange: (methodId: string) => void;
}

export default function MethodSelector({ value, onChange }: MethodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = INSTALLATION_METHODS.find((m) => m.id === value) || INSTALLATION_METHODS[2];

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 320;
      const dropdownHeight = 300;
      let left = rect.left;
      let top = rect.bottom + 4;
      if (left + dropdownWidth > window.innerWidth) left = window.innerWidth - dropdownWidth - 16;
      if (top + dropdownHeight > window.innerHeight && rect.top - dropdownHeight > 0) top = rect.top - dropdownHeight - 4;
      setPosition({ top, left });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => {
      if (isOpen) updatePosition();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white hover:border-orange-500/50 transition-all duration-150 shadow-sm"
      >
        <div
          className="w-8 h-6 flex-shrink-0"
          dangerouslySetInnerHTML={{ __html: selected.svg }}
        />
        <span className="font-mono font-bold text-orange-400">{selected.code}</span>
        <ChevronDown size={12} className={cn("transition-transform text-slate-400", isOpen && "rotate-180 text-orange-400")} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-80 bg-slate-950/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
          style={{ top: position.top, left: position.left }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Installation Method</span>
            <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div
            className="max-h-64 overflow-y-auto overscroll-contain custom-scrollbar"
            onWheel={(e) => e.stopPropagation()}
          >
            {INSTALLATION_METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  onChange(method.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-slate-800/60 last:border-b-0",
                  value === method.id
                    ? "bg-orange-600/20 text-orange-300 font-semibold"
                    : "hover:bg-slate-800/60 text-slate-300"
                )}
              >
                <div
                  className="w-16 h-12 flex-shrink-0 bg-slate-900 rounded border border-slate-700 p-0.5"
                  dangerouslySetInnerHTML={{ __html: method.svg }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{method.number} — {method.code}</span>
                    {value === method.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.8)]" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{method.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
