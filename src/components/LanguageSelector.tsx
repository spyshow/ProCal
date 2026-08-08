'use client';

import React from 'react';
import { useTranslation, SupportedLanguage } from '@/i18n';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const languages = [
    { code: 'en' as SupportedLanguage, label: 'English', short: 'EN', flag: '🇬🇧' },
    { code: 'de' as SupportedLanguage, label: 'Deutsch', short: 'DE', flag: '🇩🇪' },
    { code: 'it' as SupportedLanguage, label: 'Italiano', short: 'IT', flag: '🇮🇹' },
    { code: 'ar' as SupportedLanguage, label: 'العربية', short: 'عربي', flag: '🇸🇾' },
  ];

  const current = languages.find((l) => l.code === language) || languages[0];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as SupportedLanguage);
  };

  // Compact mode in collapsed sidebar
  if (isCollapsed) {
    return (
      <div className={cn('relative flex justify-center', className)}>
        <select
          value={language}
          onChange={handleChange}
          title={isRtl ? 'تغيير اللغة' : 'Change Language'}
          aria-label={isRtl ? 'تغيير اللغة' : 'Change Language'}
          className="w-9 h-9 opacity-0 absolute inset-0 cursor-pointer z-10"
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code} className="bg-slate-900 text-white">
              {l.flag} {l.label}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-orange-400 bg-slate-900/60 border border-slate-800 hover:border-orange-500/40 pointer-events-none transition-colors">
          <span className="text-xs font-bold text-orange-400 uppercase">{current.short}</span>
        </div>
      </div>
    );
  }

  // Sidebar expanded mode (full width select)
  if (variant === 'compact') {
    return (
      <div className={cn('relative w-full', className)}>
        <Globe size={14} className={cn("absolute top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none z-10 flex-shrink-0", isRtl ? "right-2.5" : "left-2.5")} />
        <select
          value={language}
          onChange={handleChange}
          aria-label={t('common.switchLanguage', 'Switch Language')}
          className={cn(
            "w-full appearance-none bg-slate-900/90 hover:bg-slate-900 text-slate-200 hover:text-white border border-slate-800/80 hover:border-orange-500/30 focus:border-orange-500 rounded-lg py-2 text-xs font-medium cursor-pointer shadow-sm outline-none transition-all",
            isRtl ? "pr-8 pl-7 text-right" : "pl-8 pr-7 text-left"
          )}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code} className="bg-slate-900 text-white py-1">
              {l.flag} {l.label} ({l.short})
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className={cn("absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10", isRtl ? "left-2.5" : "right-2.5")}
        />
      </div>
    );
  }

  // Standard Header / Footer Select Field
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <Globe size={14} className={cn("absolute text-orange-400 pointer-events-none z-10 flex-shrink-0", isRtl ? "right-2.5" : "left-2.5")} />
      <select
        value={language}
        onChange={handleChange}
        aria-label={t('common.switchLanguage', 'Switch Language')}
        className={cn(
          "appearance-none bg-slate-900/90 hover:bg-slate-900 text-slate-200 hover:text-white border border-slate-800 hover:border-orange-500/40 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-lg py-1.5 text-xs font-medium cursor-pointer shadow-sm outline-none transition-all",
          isRtl ? "pr-8 pl-7 text-right" : "pl-8 pr-7 text-left"
        )}
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code} className="bg-slate-900 text-white py-1">
            {l.flag} {l.label} ({l.short})
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className={cn("absolute text-slate-400 pointer-events-none z-10", isRtl ? "left-2" : "right-2")}
      />
    </div>
  );
}
