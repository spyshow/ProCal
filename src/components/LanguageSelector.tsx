'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation, SupportedLanguage } from '@/i18n';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FlagUK({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={cn("rounded-[2px] shadow-xs shrink-0 overflow-hidden", className)}>
      <clipPath id="uk-clip-ls">
        <path d="M0,0 v30 h60 v-30 z"/>
      </clipPath>
      <clipPath id="uk-diag-ls">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
      </clipPath>
      <g clipPath="url(#uk-clip-ls)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-diag-ls)" stroke="#C8102E" strokeWidth="4"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  );
}

export function FlagGermany({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 5 3" className={cn("rounded-[2px] shadow-xs shrink-0 overflow-hidden", className)}>
      <rect width="5" height="1" y="0" fill="#000000" />
      <rect width="5" height="1" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  );
}

export function FlagItaly({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 3 2" className={cn("rounded-[2px] shadow-xs shrink-0 overflow-hidden", className)}>
      <rect width="1" height="2" x="0" fill="#009246" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#CE2B37" />
    </svg>
  );
}

export function FlagSyria({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 60" className={cn("rounded-[2px] shadow-xs shrink-0 overflow-hidden", className)}>
      <rect width="90" height="20" y="0" fill="#007A3D" />
      <rect width="90" height="20" y="20" fill="#FFFFFF" />
      <rect width="90" height="20" y="40" fill="#000000" />
      <polygon
        points="26,24.5 27.23,28.3 31.23,28.3 28.00,30.65 29.23,34.45 26,32.1 22.77,34.45 24.00,30.65 20.77,28.3 24.77,28.3"
        fill="#CE1126"
      />
      <polygon
        points="45,24.5 46.23,28.3 50.23,28.3 47.00,30.65 48.23,34.45 45,32.1 41.77,34.45 43.00,30.65 39.77,28.3 43.77,28.3"
        fill="#CE1126"
      />
      <polygon
        points="64,24.5 65.23,28.3 69.23,28.3 66.00,30.65 67.23,34.45 64,32.1 60.77,34.45 62.00,30.65 58.77,28.3 62.77,28.3"
        fill="#CE1126"
      />
    </svg>
  );
}

interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  short: string;
  FlagIcon: React.ComponentType<{ className?: string }>;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', short: 'EN', FlagIcon: FlagUK },
  { code: 'de', label: 'Deutsch', short: 'DE', FlagIcon: FlagGermany },
  { code: 'it', label: 'Italiano', short: 'IT', FlagIcon: FlagItaly },
  { code: 'ar', label: 'العربية', short: 'عربي', FlagIcon: FlagSyria },
];

interface LanguageSelectorProps {
  variant?: 'compact' | 'footer' | 'dropdown' | 'select';
  className?: string;
  isCollapsed?: boolean;
}

export function LanguageSelector({
  variant = 'select',
  className,
  isCollapsed = false,
}: LanguageSelectorProps) {
  const { language, setLanguage, isRtl, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  const CurrentFlag = current.FlagIcon;

  // Close dropdown on click outside
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
  };

  // Compact mode in collapsed sidebar
  if (isCollapsed) {
    return (
      <div ref={containerRef} className={cn('relative flex justify-center', className)}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title={isRtl ? 'تغيير اللغة' : 'Change Language'}
          aria-label={isRtl ? 'تغيير اللغة' : 'Change Language'}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] hover:border-orange-500/40 transition-colors cursor-pointer"
        >
          <CurrentFlag className="w-4.5 h-3 border border-black/10 dark:border-white/10" />
        </button>

        {isOpen && (
          <div
            role="listbox"
            className={cn(
              "absolute top-0 z-50 min-w-[170px] py-1 bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-100",
              isRtl ? "right-full mr-2" : "left-full ml-2"
            )}
          >
            {LANGUAGES.map((l) => {
              const isSelected = l.code === language;
              const FlagComp = l.FlagIcon;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(l.code)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                    isRtl ? "text-right" : "text-left",
                    isSelected
                      ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold"
                      : "text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <FlagComp className="w-4 h-3 border border-black/15 dark:border-white/15" />
                    <span>{l.label}</span>
                    <span className="text-[10px] text-[var(--table-header-color,#9ca3af)] uppercase font-mono">({l.short})</span>
                  </div>
                  {isSelected && <Check size={13} className="text-orange-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Sidebar expanded compact variant or full-width button
  if (variant === 'compact') {
    return (
      <div ref={containerRef} className={cn('relative w-full', className)}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={t('common.switchLanguage', 'Switch Language')}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={cn(
            "w-full flex items-center justify-between bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:bg-[var(--card-bg,#0b0f19)] text-[var(--foreground-color,#f8fafc)] border border-[var(--border-color,#1f2937)] hover:border-orange-500/40 rounded-lg py-2 px-3 text-xs font-medium cursor-pointer shadow-sm outline-none transition-all",
            isOpen && "border-orange-500 ring-1 ring-orange-500/30"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CurrentFlag className="w-4 h-3 border border-black/15 dark:border-white/15" />
            <span className="truncate">{current.label}</span>
            <span className="text-[10px] text-[var(--table-header-color,#9ca3af)] uppercase font-mono">({current.short})</span>
          </div>
          <ChevronDown
            size={12}
            className={cn("text-[var(--table-header-color,#9ca3af)] transition-transform duration-150 shrink-0", isOpen && "rotate-180")}
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            className="absolute bottom-full mb-1.5 left-0 right-0 z-50 py-1 bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {LANGUAGES.map((l) => {
              const isSelected = l.code === language;
              const FlagComp = l.FlagIcon;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(l.code)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                    isRtl ? "text-right" : "text-left",
                    isSelected
                      ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold"
                      : "text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <FlagComp className="w-4 h-3 border border-black/15 dark:border-white/15" />
                    <span>{l.label}</span>
                    <span className="text-[10px] text-[var(--table-header-color,#9ca3af)] uppercase font-mono">({l.short})</span>
                  </div>
                  {isSelected && <Check size={13} className="text-orange-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Standard Header (variant === 'select' or 'dropdown' or 'footer')
  const isFooter = variant === 'footer';

  return (
    <div ref={containerRef} className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('common.switchLanguage', 'Switch Language')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center gap-2 bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:bg-[var(--card-bg,#0b0f19)] text-[var(--foreground-color,#f8fafc)] border border-[var(--border-color,#1f2937)] hover:border-orange-500/40 rounded-lg py-1.5 px-2.5 text-xs font-medium cursor-pointer shadow-sm outline-none transition-all",
          isOpen && "border-orange-500 ring-1 ring-orange-500/30"
        )}
      >
        <CurrentFlag className="w-4 h-3 border border-black/15 dark:border-white/15" />
        <span className="hidden sm:inline font-medium">{current.label}</span>
        <span className="sm:hidden font-medium uppercase font-mono">{current.short}</span>
        <ChevronDown
          size={12}
          className={cn("text-[var(--table-header-color,#9ca3af)] transition-transform duration-150 shrink-0", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 min-w-[185px] py-1 bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-100",
            isFooter ? "bottom-full mb-1.5" : "top-full mt-1.5",
            isRtl ? "left-0" : "right-0"
          )}
        >
          {LANGUAGES.map((l) => {
            const isSelected = l.code === language;
            const FlagComp = l.FlagIcon;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(l.code)}
                className={cn(
                  "w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                  isRtl ? "text-right" : "text-left",
                  isSelected
                    ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold"
                    : "text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <FlagComp className="w-4 h-3 border border-black/15 dark:border-white/15" />
                  <span>{l.label}</span>
                  <span className="text-[10px] text-[var(--table-header-color,#9ca3af)] uppercase font-mono">({l.short})</span>
                </div>
                {isSelected && <Check size={13} className="text-orange-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
