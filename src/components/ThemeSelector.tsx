'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n';
import { ThemeMode } from '@/lib/theme';
import { Moon, Sun, Coffee, Laptop, ChevronDown, Check } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      short: 'Parchment',
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
      ? 'text-amber-600 dark:text-amber-400'
      : resolvedTheme === 'blueprint'
      ? 'text-sky-600 dark:text-sky-400'
      : 'text-orange-400';

  // Close dropdown on click outside or Escape key
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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as ThemeMode);
  };

  const handleSelect = (selectedTheme: ThemeMode) => {
    setTheme(selectedTheme);
    setIsOpen(false);
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

  // Footer or Dropdown Variant with interactive popup
  if (variant === 'footer' || variant === 'dropdown') {
    const isFooter = variant === 'footer';
    return (
      <div ref={containerRef} className={cn('relative inline-flex items-center', className)}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={t('theme.title', 'Appearance & Theme')}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={cn(
            "flex items-center gap-2 bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:bg-[var(--card-bg,#0b0f19)] text-[var(--foreground-color,#f8fafc)] border border-[var(--border-color,#1f2937)] hover:border-orange-500/40 rounded-lg py-1.5 px-2.5 text-xs font-medium cursor-pointer shadow-sm outline-none transition-all",
            isOpen && "border-orange-500 ring-1 ring-orange-500/30"
          )}
        >
          <ActiveIcon size={14} className={cn("shrink-0", activeIconColor)} />
          <span className="hidden sm:inline font-medium">{current.short}</span>
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
              "absolute z-50 min-w-[210px] py-1 bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)] rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-100",
              isFooter ? "bottom-full mb-1.5" : "top-full mt-1.5",
              isRtl ? "left-0" : "right-0"
            )}
          >
            {themes.map((th) => {
              const isSelected = th.id === theme;
              const Icon = th.icon;
              return (
                <button
                  key={th.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(th.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                    isRtl ? "text-right" : "text-left",
                    isSelected
                      ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold"
                      : "text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className="shrink-0 text-[var(--table-header-color,#9ca3af)]" />
                    <span>{th.label}</span>
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
