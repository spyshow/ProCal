'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search, Check, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  INSTALLATION_METHODS,
  InstallationMethod,
  MethodCategory,
  resolveReferenceMethod,
} from '@/lib/calculations/installationMethods';

export interface InstallationMethodOption extends InstallationMethod {
  svg: string;
}

// Archetypal Vector Illustrations matching IEC 60364-5-52 installation figures
const ARCHETYPE_SVGS: Record<string, string> = {
  // Conduit in thermally insulated wall
  'conduit-insulated-wall': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="90" height="55" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
    <path d="M12 12 L88 12 M12 20 L88 20 M12 28 L88 28 M12 36 L88 36 M12 44 L88 44 M12 52 L88 52" stroke="#334155" stroke-width="1" stroke-dasharray="3 3"/>
    <rect x="25" y="15" width="50" height="35" rx="4" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="42" cy="32.5" r="6" fill="#f97316" stroke="#ea580c"/>
    <circle cx="58" cy="32.5" r="6" fill="#f97316" stroke="#ea580c"/>
  </svg>`,

  // Multi-core in thermally insulated wall
  'multicore-insulated-wall': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="90" height="55" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
    <path d="M12 12 L88 12 M12 20 L88 20 M12 28 L88 28 M12 36 L88 36 M12 44 L88 44 M12 52 L88 52" stroke="#334155" stroke-width="1" stroke-dasharray="3 3"/>
    <circle cx="50" cy="32.5" r="14" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="44" cy="30" r="4.5" fill="#10b981"/>
    <circle cx="56" cy="30" r="4.5" fill="#10b981"/>
    <circle cx="50" cy="39" r="4.5" fill="#10b981"/>
  </svg>`,

  // Conduit on wooden / masonry wall
  'conduit-wall': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="8" width="16" height="50" fill="#334155" stroke="#475569"/>
    <rect x="30" y="15" width="32" height="35" rx="4" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="40" cy="32.5" r="5" fill="#f97316"/>
    <circle cx="52" cy="32.5" r="5" fill="#f97316"/>
  </svg>`,

  // Multi-core in conduit on wall
  'multicore-conduit-wall': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="8" width="16" height="50" fill="#334155" stroke="#475569"/>
    <rect x="30" y="14" width="36" height="37" rx="4" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="48" cy="32.5" r="11" fill="#1e293b" stroke="#64748b"/>
    <circle cx="44" cy="30" r="3.5" fill="#10b981"/>
    <circle cx="52" cy="30" r="3.5" fill="#10b981"/>
    <circle cx="48" cy="37" r="3.5" fill="#10b981"/>
  </svg>`,

  // Cable trunking on wall
  'trunking-wall': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="8" width="14" height="50" fill="#334155" stroke="#475569"/>
    <rect x="25" y="14" width="55" height="37" rx="2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
    <line x1="52" y1="14" x2="52" y2="51" stroke="#475569" stroke-width="1"/>
    <circle cx="38" cy="27" r="4.5" fill="#f97316"/>
    <circle cx="38" cy="39" r="4.5" fill="#f97316"/>
    <circle cx="66" cy="33" r="5" fill="#10b981"/>
  </svg>`,

  // Suspended trunking
  'suspended-trunking': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="50" y1="4" x2="50" y2="18" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2 2"/>
    <rect x="28" y="18" width="44" height="36" rx="2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="42" cy="36" r="5" fill="#f97316"/>
    <circle cx="58" cy="36" r="5" fill="#f97316"/>
  </svg>`,

  // Clipped directly on wall / ceiling
  'clipped-surface': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="8" width="16" height="50" fill="#334155" stroke="#475569"/>
    <circle cx="36" cy="32.5" r="7" fill="#f97316" stroke="#ea580c"/>
    <path d="M21 32.5 Q28 22 36 22 Q44 22 44 32.5" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
    <circle cx="58" cy="32.5" r="7" fill="#f97316" stroke="#ea580c"/>
    <circle cx="80" cy="32.5" r="7" fill="#f97316" stroke="#ea580c"/>
  </svg>`,

  // Spaced from surface
  'spaced-surface': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="8" width="14" height="50" fill="#334155" stroke="#475569"/>
    <line x1="19" y1="32.5" x2="32" y2="32.5" stroke="#94a3b8" stroke-width="2"/>
    <circle cx="45" cy="32.5" r="8" fill="#10b981" stroke="#059669"/>
    <circle cx="68" cy="32.5" r="8" fill="#10b981" stroke="#059669"/>
  </svg>`,

  // Perforated cable tray (multi-core)
  'tray-multicore': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="44" width="80" height="6" fill="#334155" stroke="#64748b"/>
    <circle cx="25" cy="47" r="1.5" fill="#0f172a"/>
    <circle cx="45" cy="47" r="1.5" fill="#0f172a"/>
    <circle cx="65" cy="47" r="1.5" fill="#0f172a"/>
    <circle cx="35" cy="32" r="8" fill="#10b981" stroke="#059669"/>
    <circle cx="62" cy="32" r="8" fill="#10b981" stroke="#059669"/>
  </svg>`,

  // Perforated cable tray (single-core touching)
  'tray-single-touch': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="44" width="80" height="6" fill="#334155" stroke="#64748b"/>
    <circle cx="20" cy="47" r="1.5" fill="#0f172a"/>
    <circle cx="50" cy="47" r="1.5" fill="#0f172a"/>
    <circle cx="80" cy="47" r="1.5" fill="#0f172a"/>
    <circle cx="33" cy="34" r="7" fill="#f97316" stroke="#ea580c"/>
    <circle cx="47" cy="34" r="7" fill="#f97316" stroke="#ea580c"/>
    <circle cx="61" cy="34" r="7" fill="#f97316" stroke="#ea580c"/>
  </svg>`,

  // Perforated cable tray (single-core trefoil)
  'tray-single-trefoil': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="46" width="80" height="6" fill="#334155" stroke="#64748b"/>
    <circle cx="30" cy="49" r="1.5" fill="#0f172a"/>
    <circle cx="70" cy="49" r="1.5" fill="#0f172a"/>
    <circle cx="43" cy="37" r="6.5" fill="#f97316" stroke="#ea580c"/>
    <circle cx="57" cy="37" r="6.5" fill="#f97316" stroke="#ea580c"/>
    <circle cx="50" cy="25" r="6.5" fill="#f97316" stroke="#ea580c"/>
  </svg>`,

  // Cable ladder
  'cable-ladder': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="15" y1="46" x2="85" y2="46" stroke="#64748b" stroke-width="3"/>
    <line x1="25" y1="46" x2="25" y2="52" stroke="#64748b" stroke-width="2"/>
    <line x1="50" y1="46" x2="50" y2="52" stroke="#64748b" stroke-width="2"/>
    <line x1="75" y1="46" x2="75" y2="52" stroke="#64748b" stroke-width="2"/>
    <circle cx="35" cy="34" r="8" fill="#10b981" stroke="#059669"/>
    <circle cx="65" cy="34" r="8" fill="#10b981" stroke="#059669"/>
  </svg>`,

  // Wire mesh tray / brackets
  'wire-mesh': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 25 L15 48 L85 48 L85 25" stroke="#64748b" stroke-width="2" fill="none"/>
    <line x1="32" y1="28" x2="32" y2="48" stroke="#475569" stroke-width="1.5"/>
    <line x1="50" y1="28" x2="50" y2="48" stroke="#475569" stroke-width="1.5"/>
    <line x1="68" y1="28" x2="68" y2="48" stroke="#475569" stroke-width="1.5"/>
    <circle cx="38" cy="36" r="7" fill="#f97316"/>
    <circle cx="62" cy="36" r="7" fill="#f97316"/>
  </svg>`,

  // Insulators
  'insulators': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="48" width="90" height="8" fill="#334155"/>
    <rect x="25" y="32" width="10" height="16" fill="#e2e8f0" stroke="#94a3b8"/>
    <circle cx="30" cy="26" r="6" fill="#f97316"/>
    <rect x="65" y="32" width="10" height="16" fill="#e2e8f0" stroke="#94a3b8"/>
    <circle cx="70" cy="26" r="6" fill="#f97316"/>
  </svg>`,

  // Building void / ceiling void
  'building-void': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="84" height="49" fill="#0f172a" stroke="#475569" stroke-width="1.5" stroke-dasharray="3 3"/>
    <circle cx="40" cy="32.5" r="7" fill="#f97316"/>
    <circle cx="60" cy="32.5" r="7" fill="#f97316"/>
    <text x="50" y="52" text-anchor="middle" fill="#64748b" font-size="7">Building Void</text>
  </svg>`,

  // Flush floor / trunking
  'flush-floor': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="5" y1="18" x2="25" y2="18" stroke="#64748b" stroke-width="2"/>
    <line x1="75" y1="18" x2="95" y2="18" stroke="#64748b" stroke-width="2"/>
    <rect x="25" y="18" width="50" height="35" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="42" cy="35" r="6" fill="#10b981"/>
    <circle cx="58" cy="35" r="6" fill="#10b981"/>
  </svg>`,

  // Conduit / direct in ground
  'ground-duct': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="90" height="55" rx="2" fill="#78350f" fill-opacity="0.25" stroke="#92400e" stroke-width="1"/>
    <line x1="5" y1="12" x2="95" y2="12" stroke="#b45309" stroke-width="1.5" stroke-dasharray="4 2"/>
    <circle cx="50" cy="36" r="14" fill="#0f172a" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="44" cy="33" r="4.5" fill="#10b981"/>
    <circle cx="56" cy="33" r="4.5" fill="#10b981"/>
    <circle cx="50" cy="42" r="4.5" fill="#10b981"/>
  </svg>`,

  // Direct buried in ground
  'ground-direct': `<svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="90" height="55" rx="2" fill="#78350f" fill-opacity="0.3" stroke="#92400e" stroke-width="1"/>
    <line x1="5" y1="14" x2="95" y2="14" stroke="#b45309" stroke-width="1.5" stroke-dasharray="4 2"/>
    <circle cx="35" cy="36" r="8" fill="#f97316" stroke="#ea580c"/>
    <circle cx="65" cy="36" r="8" fill="#f97316" stroke="#ea580c"/>
  </svg>`,
};

function getMethodSvg(method: InstallationMethod): string {
  const { id, category, code } = method;
  if (category === 'ground') {
    return id.startsWith('70') || id.startsWith('71') ? ARCHETYPE_SVGS['ground-duct'] : ARCHETYPE_SVGS['ground-direct'];
  }
  if (category === 'void') {
    return ARCHETYPE_SVGS['building-void'];
  }
  if (id === '1' || id === '2' || id === '3') {
    return id === '2' ? ARCHETYPE_SVGS['multicore-insulated-wall'] : ARCHETYPE_SVGS['conduit-insulated-wall'];
  }
  if (id === '4' || id === '5' || id === '59' || id === '60') {
    return id === '5' || id === '60' ? ARCHETYPE_SVGS['multicore-conduit-wall'] : ARCHETYPE_SVGS['conduit-wall'];
  }
  if (id === '6' || id === '8' || id === '10' || id === '11') {
    return id.startsWith('10') || id.startsWith('11') ? ARCHETYPE_SVGS['suspended-trunking'] : ARCHETYPE_SVGS['trunking-wall'];
  }
  if (id.startsWith('50') || id.startsWith('51') || id.startsWith('52') || id.startsWith('53')) {
    return ARCHETYPE_SVGS['flush-floor'];
  }
  if (id.startsWith('31')) {
    if (id.includes('tref')) return ARCHETYPE_SVGS['tray-single-trefoil'];
    if (id.includes('touch')) return ARCHETYPE_SVGS['tray-single-touch'];
    return ARCHETYPE_SVGS['tray-multicore'];
  }
  if (id.startsWith('32')) {
    return ARCHETYPE_SVGS['wire-mesh'];
  }
  if (id.startsWith('34')) {
    return ARCHETYPE_SVGS['cable-ladder'];
  }
  if (id.startsWith('36')) {
    return ARCHETYPE_SVGS['insulators'];
  }
  if (code.includes('E') || id.startsWith('22') || id.startsWith('33')) {
    return ARCHETYPE_SVGS['spaced-surface'];
  }
  return ARCHETYPE_SVGS['clipped-surface'];
}

interface MethodSelectorProps {
  value: string;
  onChange: (methodId: string) => void;
  compact?: boolean;
}

const CATEGORY_TABS: { key: MethodCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tray', label: 'Tray & Ladder' },
  { key: 'conduit', label: 'Conduit & Trunking' },
  { key: 'surface', label: 'Surface & Direct' },
  { key: 'ground', label: 'Underground / Buried' },
  { key: 'void', label: 'Building Voids' },
];

export default function MethodSelector({ value, onChange, compact }: MethodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MethodCategory | 'all'>('all');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Match current selected method
  const selectedMethod = useMemo(() => {
    return (
      INSTALLATION_METHODS.find((m) => m.id === value) ||
      INSTALLATION_METHODS.find((m) => m.code === value) ||
      INSTALLATION_METHODS.find((m) => m.refMethod === resolveReferenceMethod(value)) ||
      INSTALLATION_METHODS[18] // default Method 31-E
    );
  }, [value]);

  const filteredMethods = useMemo(() => {
    return INSTALLATION_METHODS.filter((m) => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        String(m.number).includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.refMethod.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery]);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const modalWidth = Math.min(540, window.innerWidth - 32);
      const modalHeight = 440;
      let left = rect.left;
      let top = rect.bottom + 6;

      if (left + modalWidth > window.innerWidth - 16) {
        left = window.innerWidth - modalWidth - 16;
      }
      if (left < 16) left = 16;

      if (top + modalHeight > window.innerHeight && rect.top - modalHeight > 10) {
        top = rect.top - modalHeight - 6;
      }
      setPosition({ top, left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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
      window.addEventListener('resize', updatePosition);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const triggerSvg = useMemo(() => getMethodSvg(selectedMethod), [selectedMethod]);

  const getRefBadgeColor = (refCode: string) => {
    switch (refCode) {
      case 'A1':
      case 'A2':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'B1':
      case 'B2':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'C':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'E':
      case 'F':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'G':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'D1':
      case 'D2':
        return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/40';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "inline-flex items-center justify-between bg-slate-900/90 border border-slate-700 hover:border-orange-500/60 rounded-md transition-all duration-150 shadow-sm cursor-pointer group focus:outline-none focus:ring-1 focus:ring-orange-500",
          compact
            ? "gap-1.5 px-2 py-1 text-[11px] min-w-[110px]"
            : "gap-2.5 px-3 py-2 text-xs rounded-lg min-w-[170px]"
        )}
        title={`${selectedMethod.name} — ${selectedMethod.description}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={cn("flex-shrink-0 bg-slate-950/80 rounded border border-slate-800 p-0.5", compact ? "w-5 h-4" : "w-7 h-5")}
            dangerouslySetInnerHTML={{ __html: triggerSvg }}
          />
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-mono font-bold text-orange-400 truncate">
              {selectedMethod.number} · {selectedMethod.code}
            </span>
          </div>
        </div>
        <ChevronDown
          size={compact ? 11 : 13}
          className={cn("flex-shrink-0 transition-transform text-slate-400 group-hover:text-orange-400", isOpen && "rotate-180 text-orange-400")}
        />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-[500px] max-w-[calc(100vw-32px)] bg-slate-950/98 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 flex flex-col overflow-hidden text-slate-200"
          style={{ top: position.top, left: position.left }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800/90 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" />
              <h4 className="text-xs font-bold text-white tracking-wide">
                IEC 60364-5-52 Installation Methods
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by method number, reference code, or keyword (e.g. 31, tray, trefoil, duct, ground)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-0.5 custom-scrollbar">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedCategory(tab.key)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors",
                    selectedCategory === tab.key
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                      : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Methods List */}
          <div
            className="max-h-[300px] overflow-y-auto overscroll-contain divide-y divide-slate-800/60 custom-scrollbar p-1.5"
            onWheel={(e) => e.stopPropagation()}
          >
            {filteredMethods.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No installation methods match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredMethods.map((method) => {
                const isSelected = value === method.id || (method.refMethod === value && value === selectedMethod.refMethod);
                const svg = getMethodSvg(method);

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      onChange(method.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 p-2.5 text-left transition-all rounded-lg my-0.5",
                      isSelected
                        ? "bg-orange-950/40 border border-orange-500/40 text-orange-200 shadow-sm"
                        : "hover:bg-slate-900/80 text-slate-300 border border-transparent"
                    )}
                  >
                    {/* SVG Illustration */}
                    <div
                      className="w-14 h-10 flex-shrink-0 bg-slate-900 rounded border border-slate-700/80 p-0.5 flex items-center justify-center overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />

                    {/* Method Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-bold text-xs text-white">
                          {method.number} — {method.code}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold border",
                            getRefBadgeColor(method.refMethod)
                          )}
                        >
                          Ref {method.refMethod}
                        </span>
                        {isSelected && (
                          <span className="ml-auto flex items-center text-[10px] font-semibold text-orange-400 gap-1">
                            <Check size={12} className="text-orange-400" />
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {method.description}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Note */}
          <div className="px-3.5 py-2 bg-slate-900/80 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
            <span>Showing {filteredMethods.length} of {INSTALLATION_METHODS.length} methods</span>
            <span className="font-mono">IEC 60364-5-52 Table A.52.3</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
