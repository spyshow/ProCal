'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n';
import { ThemeMode } from '@/lib/theme';
import { Moon, Sun, Coffee, Laptop, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  variant?: 'compact' | 'footer' | 'dropdown' | 'select';
  className?: string;
  isCollapsed?: boolean;
}

export function ThemeSelector({
  variant = 'compact',
  className,
  isCollapsed = false,
}: ThemeSelectorProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t, isRtl } = useTranslation();

  const themes: {
    id: ThemeMode;
    label: string;
    short: string;
    icon: React.ElementType;
  }[] = [
    {
      id: 'dark',
      label: `${t('theme.dark', 'Midnight CAD')} (Dark)`,
      short: 'Dark',
      icon: Moon,
    },
    {
      id: 'blueprint',
      label: `${t('theme.blueprint', 'CAD Blueprint')} (Light)`,
      short: 'Light',
      icon: Sun,
    },
    {
      id: 'warm',
      label: `${t('theme.warm', 'Drafting Warm')} (Parchment)`,
      short: 'Warm',
      icon: Coffee,
    },
    {
      id: 'system',
      label: t('theme.system', 'System Auto'),
      short: 'Auto',
      icon: Laptop,
    },
  ];

  const current = themes.find((th) => th.id === theme) || themes[0];

  // Active icon depends on either explicit theme or system resolution
  const ActiveIcon =
    theme === 'system'
      ? Laptop
      : resolvedTheme === 'warm'
      ? Coffee
      : resolvedTheme === 'blueprint'
      ? Sun
      : Moon;

  const activeIconColor =
    resolvedTheme === 'warm'
      ? 'text-amber-600'
      : resolvedTheme === 'blueprint'
      ? 'text-sky-600 dark:text-sky-400'
      : 'text-orange-400';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as ThemeMode);
  };

  // Compact icon mode in collapsed sidebar
  if (isCollapsed) {
    return (
      <div className={cn('relative flex justify-center', className)}>
        <select
          value={theme}
          onChange={handleChange}
          title={`${t('theme.title', 'Appearance & Theme')}: ${current.label}`}
          aria-label={t('theme.title', 'Appearance & Theme')}
          className="w-9 h-9 opacity-0 absolute inset-0 cursor-pointer z-10"
        >
          {themes.map((th) => (
            <option key={th.id} value={th.id} className="bg-[var(--card-bg,#0b0f19)] text-[var(--foreground-color,#f8fafc)]">
              {th.label}
            </option>
          ))}
        </select>
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg border transition-all pointer-events-none",
            "bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:bg-[var(--card-bg,#0b0f19)]",
            "border-[var(--border-color,#1f2937)] hover:border-orange-500/40"
          )}
        >
          <ActiveIcon size={16} className={cn("transition-transform", activeIconColor)} />
        </div>
      </div>
    );
  }

  // Expanded Sidebar Select Input
  return (
    <div className={cn('relative w-full', className)}>
      <ActiveIcon
        size={14}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 pointer-events-none z-10 flex-shrink-0 transition-colors",
          activeIconColor,
          isRtl ? "right-2.5" : "left-2.5"
        )}
      />
      <select
        value={theme}
        onChange={handleChange}
        aria-label={t('theme.title', 'Appearance & Theme')}
        className={cn(
          "w-full appearance-none rounded-lg py-1.5 text-xs font-medium cursor-pointer shadow-sm outline-none transition-all",
          "bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:bg-[var(--card-bg,#0b0f19)]",
          "text-[var(--foreground-color,#f8fafc)]",
          "border border-[var(--border-color,#1f2937)] hover:border-orange-500/40 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30",
          isRtl ? "pr-8 pl-7 text-right" : "pl-8 pr-7 text-left"
        )}
      >
        {themes.map((th) => (
          <option
            key={th.id}
            value={th.id}
            className="bg-[var(--card-bg,#0b0f19)] text-[var(--foreground-color,#f8fafc)] py-1"
          >
            {th.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-[var(--table-header-color,#9ca3af)] pointer-events-none z-10",
          isRtl ? "left-2.5" : "right-2.5"
        )}
      />
    </div>
  );
}

export default ThemeSelector;
