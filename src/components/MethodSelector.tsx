'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

export interface InstallationMethodOption {
  id: string;
  number: number;
  code: string;
  name: string;
  description: string;
  svg: string;
}

// SVG diagrams for each installation method
const METHOD_SVGS: Record<string, string> = {
  A1: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="100" height="60" rx="2" fill="#374151" stroke="#6b7280"/>
    <rect x="20" y="20" width="80" height="40" rx="1" fill="#1f2937" stroke="#9ca3af" stroke-dasharray="2 2"/>
    <circle cx="45" cy="40" r="8" fill="#f59e0b" stroke="#d97706"/>
    <circle cx="75" cy="40" r="8" fill="#f59e0b" stroke="#d97706"/>
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
    <circle cx="37" cy="40" r="5" fill="#f59e0b" stroke="#d97706"/>
    <rect x="60" y="25" width="15" height="30" rx="2" fill="#374151" stroke="#9ca3af"/>
    <circle cx="67" cy="40" r="5" fill="#f59e0b" stroke="#d97706"/>
    <rect x="90" y="25" width="15" height="30" rx="2" fill="#374151" stroke="#9ca3af"/>
    <circle cx="97" cy="40" r="5" fill="#f59e0b" stroke="#d97706"/>
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
    <circle cx="40" cy="40" r="8" fill="#f59e0b" stroke="#d97706"/>
    <line x1="48" y1="40" x2="55" y2="40" stroke="#9ca3af" stroke-width="2"/>
    <circle cx="65" cy="40" r="8" fill="#f59e0b" stroke="#d97706"/>
    <line x1="73" y1="40" x2="80" y2="40" stroke="#9ca3af" stroke-width="2"/>
    <circle cx="90" cy="40" r="8" fill="#f59e0b" stroke="#d97706"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Clipped Directly</text>
  </svg>`,
  E: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="15" width="20" height="50" fill="#6b7280"/>
    <line x1="40" y1="30" x2="40" y2="50" stroke="#9ca3af" stroke-width="2"/>
    <circle cx="40" cy="40" r="8" fill="#f59e0b" stroke="#d97706"/>
    <line x1="70" y1="30" x2="70" y2="50" stroke="#9ca3af" stroke-width="2"/>
    <circle cx="70" cy="40" r="8" fill="#f59e0b" stroke="#d97706"/>
    <line x1="100" y1="30" x2="100" y2="50" stroke="#9ca3af" stroke-width="2"/>
    <circle cx="100" cy="40" r="8" fill="#f59e0b" stroke="#d97706"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">Spaced from Surface</text>
  </svg>`,
  F: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="35" width="100" height="8" fill="#6b7280"/>
    <line x1="15" y1="35" x2="15" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="25" y1="35" x2="25" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="35" y1="35" x2="35" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="45" y1="35" x2="45" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="55" y1="35" x2="55" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="65" y1="35" x2="65" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="75" y1="35" x2="75" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="85" y1="35" x2="85" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="95" y1="35" x2="95" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <line x1="105" y1="35" x2="105" y2="43" stroke="#9ca3af" stroke-width="1"/>
    <circle cx="30" cy="28" r="6" fill="#f59e0b" stroke="#d97706"/>
    <circle cx="50" cy="28" r="6" fill="#f59e0b" stroke="#d97706"/>
    <circle cx="70" cy="28" r="6" fill="#f59e0b" stroke="#d97706"/>
    <circle cx="90" cy="28" r="6" fill="#f59e0b" stroke="#d97706"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">On Cable Tray</text>
  </svg>`,
  G: `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="30" width="5" height="25" fill="#6b7280"/>
    <rect x="100" y="30" width="5" height="25" fill="#6b7280"/>
    <line x1="17" y1="32" x2="102" y2="32" stroke="#9ca3af" stroke-width="2"/>
    <line x1="17" y1="55" x2="102" y2="55" stroke="#9ca3af" stroke-width="2"/>
    <circle cx="40" cy="43" r="6" fill="#f59e0b" stroke="#d97706"/>
    <circle cx="60" cy="43" r="6" fill="#f59e0b" stroke="#d97706"/>
    <circle cx="80" cy="43" r="6" fill="#f59e0b" stroke="#d97706"/>
    <text x="60" y="75" text-anchor="middle" fill="#9ca3af" font-size="8">On Ladder</text>
  </svg>`,
};

export const INSTALLATION_METHODS: InstallationMethodOption[] = [
  {
    id: 'A1',
    number: 1,
    code: 'A1',
    name: 'Method A1',
    description: 'Insulated conductors or single-core cables in conduit in a thermally insulated wall',
    svg: METHOD_SVGS.A1,
  },
  {
    id: 'A2',
    number: 2,
    code: 'A2',
    name: 'Method A2',
    description: 'Multi-core cables in conduit in a thermally insulated wall',
    svg: METHOD_SVGS.A2,
  },
  {
    id: 'B1',
    number: 4,
    code: 'B1',
    name: 'Method B1',
    description: 'Insulated conductors or single-core cables in conduit on a wooden or masonry wall',
    svg: METHOD_SVGS.B1,
  },
  {
    id: 'B2',
    number: 5,
    code: 'B2',
    name: 'Method B2',
    description: 'Multi-core cables in conduit on a wooden or masonry wall',
    svg: METHOD_SVGS.B2,
  },
  {
    id: 'C',
    number: 20,
    code: 'C',
    name: 'Method C',
    description: 'Single-core or multi-core cables clipped directly on a wall or surface',
    svg: METHOD_SVGS.C,
  },
  {
    id: 'E',
    number: 22,
    code: 'E',
    name: 'Method E',
    description: 'Single-core or multi-core cables spaced from wall or ceiling surface',
    svg: METHOD_SVGS.E,
  },
  {
    id: 'F',
    number: 31,
    code: 'F',
    name: 'Method F',
    description: 'Single-core or multi-core cables on perforated cable tray',
    svg: METHOD_SVGS.F,
  },
  {
    id: 'G',
    number: 34,
    code: 'G',
    name: 'Method G',
    description: 'Single-core or multi-core cables on ladder or insulators',
    svg: METHOD_SVGS.G,
  },
];

interface MethodSelectorProps {
  value: string;
  onChange: (method: string) => void;
}

export default function MethodSelector({ value, onChange }: MethodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const selected = INSTALLATION_METHODS.find(m => m.id === value) || INSTALLATION_METHODS[2]; // Default to C

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = (event: Event) => {
      // Only close if scroll is outside the dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
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
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white hover:border-gray-600 transition-colors"
      >
        <div
          className="w-8 h-6 flex-shrink-0"
          dangerouslySetInnerHTML={{ __html: selected.svg }}
        />
        <span className="font-mono font-semibold">{selected.code}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl"
          style={{ top: position.top, left: position.left }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Installation Method</span>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div
            className="max-h-64 overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            {INSTALLATION_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => {
                  onChange(method.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-gray-800 last:border-b-0 ${
                  value === method.id
                    ? 'bg-orange-600/20 text-orange-300'
                    : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <div
                  className="w-16 h-12 flex-shrink-0 bg-gray-800 rounded border border-gray-700 p-0.5"
                  dangerouslySetInnerHTML={{ __html: method.svg }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{method.number} — {method.code}</span>
                    {value === method.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{method.description}</p>
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
