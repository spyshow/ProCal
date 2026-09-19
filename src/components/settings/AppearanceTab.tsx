'use client';

import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/i18n';
import { Moon, Sun, Coffee, Check, Laptop, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { ThemeMode } from '@/lib/theme';

export function AppearanceTab() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t, isRtl } = useTranslation();
  const [hoveredTheme, setHoveredTheme] = useState<'dark' | 'blueprint' | 'warm' | null>(null);

  const isSystem = theme === 'system';
  const effectivePreviewTheme: 'dark' | 'blueprint' | 'warm' = hoveredTheme || resolvedTheme || 'dark';

  const themeStyles: Record<'dark' | 'blueprint' | 'warm', {
    cardBg: string;
    borderColor: string;
    fgColor: string;
    headerBg: string;
    headerColor: string;
    tableBorder: string;
    zebraBg: string;
    rowHover: string;
    primary: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }> = {
    dark: {
      cardBg: '#0b0f19',
      borderColor: '#1f2937',
      fgColor: '#f8fafc',
      headerBg: 'rgba(17, 24, 39, 0.85)',
      headerColor: '#9ca3af',
      tableBorder: 'rgba(31, 41, 55, 0.8)',
      zebraBg: 'rgba(255, 255, 255, 0.028)',
      rowHover: 'rgba(255, 255, 255, 0.065)',
      primary: '#ea580c',
      badgeBg: 'rgba(16, 185, 129, 0.1)',
      badgeText: '#34d399',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
    },
    blueprint: {
      cardBg: '#ffffff',
      borderColor: '#cbd5e1',
      fgColor: '#0f172a',
      headerBg: '#e2e8f0',
      headerColor: '#334155',
      tableBorder: '#cbd5e1',
      zebraBg: 'rgba(241, 245, 249, 0.75)',
      rowHover: 'rgba(226, 232, 240, 0.85)',
      primary: '#ea580c',
      badgeBg: '#ecfdf5',
      badgeText: '#059669',
      badgeBorder: '#a7f3d0',
    },
    warm: {
      cardBg: '#f8f4ec',
      borderColor: '#cbb9a3',
      fgColor: '#261e16',
      headerBg: '#dfd3c0',
      headerColor: '#4a3e31',
      tableBorder: '#cbb9a3',
      zebraBg: 'rgba(223, 211, 192, 0.35)',
      rowHover: 'rgba(223, 211, 192, 0.75)',
      primary: '#c66928',
      badgeBg: 'rgba(16, 185, 129, 0.12)',
      badgeText: '#047857',
      badgeBorder: 'rgba(16, 185, 129, 0.35)',
    },
  };

  const curThemeStyle = themeStyles[effectivePreviewTheme];

  const themes: {
    id: 'dark' | 'blueprint' | 'warm';
    title: string;
    tag: string;
    desc: string;
    icon: React.ElementType;
    previewBg: string;
    previewCard: string;
    previewBorder: string;
    previewText: string;
    previewAccent: string;
  }[] = [
    {
      id: 'dark',
      title: t('theme.darkTitle', 'Midnight CAD'),
      tag: t('theme.darkTag', 'Default Dark'),
      desc: t(
        'theme.darkDesc',
        'Signature ProCal midnight palette with ABB industrial orange. Low glare for CAD drafting and night engineering.'
      ),
      icon: Moon,
      previewBg: '#030712',
      previewCard: '#0b0f19',
      previewBorder: '#1f2937',
      previewText: '#f8fafc',
      previewAccent: '#ea580c',
    },
    {
      id: 'blueprint',
      title: t('theme.blueprintTitle', 'Technical CAD Blueprint'),
      tag: t('theme.blueprintTag', 'Precision Light'),
      desc: t(
        'theme.blueprintDesc',
        'Crisp off-white drafting canvas with sharp slate gridlines and deep ink typography for bright ambient spaces.'
      ),
      icon: Sun,
      previewBg: '#eef2f6',
      previewCard: '#ffffff',
      previewBorder: '#cbd5e1',
      previewText: '#0f172a',
      previewAccent: '#ea580c',
    },
    {
      id: 'warm',
      title: t('theme.warmTitle', 'Drafting Warm'),
      tag: t('theme.warmTag', 'Drafting Parchment'),
      desc: t(
        'theme.warmDesc',
        'Rich architectural drafting parchment with warm ivory panels and sepia borders to reduce glare during long calculation sessions.'
      ),
      icon: Coffee,
      previewBg: '#ede4d4',
      previewCard: '#f8f4ec',
      previewBorder: '#cbb9a3',
      previewText: '#261e16',
      previewAccent: '#c66928',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground-color,#f8fafc)] flex items-center gap-2">
          <Sparkles size={18} className="text-orange-500" />
          {t('theme.title', 'Appearance & Theme')}
        </h2>
        <p className="text-xs text-[var(--table-header-color,#9ca3af)] mt-1">
          {t(
            'theme.subtitle',
            'Customize your visual workspace across dark, CAD blueprint light, and warm drafting aesthetics'
          )}
        </p>
      </div>

      {/* OS Auto-sync Card */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Laptop size={18} className="text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground-color,#f8fafc)]">
              {t('theme.systemPreference', 'Match Operating System Preference')}
            </p>
            <p className="text-xs text-[var(--table-header-color,#9ca3af)]">
              {t(
                'theme.systemPreferenceDesc',
                'Automatically switch between dark and blueprint light based on your OS settings'
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isSystem}
          onClick={() => setTheme(isSystem ? resolvedTheme : 'system')}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
            isSystem ? 'bg-orange-600' : 'bg-slate-700'
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isSystem ? (isRtl ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Theme Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {themes.map((item) => {
          const isSelected = !isSystem && theme === item.id;
          const isCurrentlyActive = resolvedTheme === item.id;
          const isHovered = hoveredTheme === item.id;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              onClick={() => setTheme(item.id)}
              onMouseEnter={() => setHoveredTheme(item.id)}
              onMouseLeave={() => setHoveredTheme(null)}
              className={`group relative rounded-2xl border-2 p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                isSelected
                  ? 'border-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.2)] bg-[var(--card-bg,#0b0f19)]'
                  : isHovered
                  ? 'border-orange-500/80 shadow-[0_0_15px_rgba(234,88,12,0.15)] bg-[var(--card-bg,#0b0f19)]'
                  : 'border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] hover:border-orange-500/50'
              }`}
            >
              {/* Top Row: Icon & Tag */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: `${item.previewAccent}15`,
                        borderColor: `${item.previewAccent}30`,
                        borderWidth: 1,
                      }}
                    >
                      <Icon size={16} style={{ color: item.previewAccent }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground-color,#f8fafc)] leading-none">
                        {item.title}
                      </h3>
                      <span className="text-[10px] text-orange-400 font-medium">{item.tag}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                      <Check size={11} strokeWidth={3} />
                      {t('theme.activeBadge', 'Active')}
                    </span>
                  )}
                  {isSystem && isCurrentlyActive && (
                    <span className="text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">
                      {t('theme.system', 'System Auto')}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed mb-4">
                  {item.desc}
                </p>

                {/* Visual Mockup Box */}
                <div
                  className="rounded-xl p-3 border text-xs select-none shadow-inner"
                  style={{
                    backgroundColor: item.previewBg,
                    borderColor: item.previewBorder,
                    color: item.previewText,
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-2 border-b"
                    style={{ borderColor: item.previewBorder }}
                  >
                    <span className="font-mono text-[11px] font-semibold tracking-tight">ProCal 400V</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: item.previewAccent }}
                    >
                      {item.tag.split(' ')[0]}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 font-mono text-[10px]">
                    <div
                      className="flex items-center justify-between p-1.5 rounded"
                      style={{
                        backgroundColor: item.previewCard,
                        border: `1px solid ${item.previewBorder}`,
                      }}
                    >
                      <span className="opacity-80">MDB-FEEDER</span>
                      <span className="font-bold" style={{ color: item.previewAccent }}>
                        630A
                      </span>
                    </div>
                    <div
                      className="flex items-center justify-between p-1.5 rounded"
                      style={{
                        backgroundColor: item.previewCard,
                        border: `1px solid ${item.previewBorder}`,
                      }}
                    >
                      <span className="opacity-80">VD: 0.8%</span>
                      <span className="text-emerald-500 font-bold">PASS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Button */}
              <div className="mt-4 pt-3 border-t border-[var(--border-color,#1f2937)] flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--table-header-color,#9ca3af)]">
                  {isSelected ? t('theme.activeBadge', 'Active Theme') : t('theme.select', 'Select Theme')}
                </span>
                <button
                  type="button"
                  className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors ${
                    isSelected
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isSelected ? t('common.saved', 'Active') : t('common.actions', 'Apply')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Interactive Engineering Preview */}
      <div
        data-theme={effectivePreviewTheme}
        className="p-4 rounded-xl border transition-all duration-300 shadow-sm"
        style={{
          backgroundColor: curThemeStyle.cardBg,
          borderColor: curThemeStyle.borderColor,
          color: curThemeStyle.fgColor,
          ['--card-bg' as string]: curThemeStyle.cardBg,
          ['--border-color' as string]: curThemeStyle.borderColor,
          ['--foreground-color' as string]: curThemeStyle.fgColor,
          ['--table-header-bg' as string]: curThemeStyle.headerBg,
          ['--table-header-color' as string]: curThemeStyle.headerColor,
          ['--table-border' as string]: curThemeStyle.tableBorder,
          ['--table-zebra-bg' as string]: curThemeStyle.zebraBg,
          ['--table-row-hover' as string]: curThemeStyle.rowHover,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={16} style={{ color: curThemeStyle.primary }} />
            <span
              className="text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{ color: curThemeStyle.fgColor }}
            >
              {t('theme.previewTitle', 'Live Engineering Preview')}
            </span>
            {hoveredTheme && (
              <span
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1.5"
                style={{
                  backgroundColor: `${curThemeStyle.primary}18`,
                  color: curThemeStyle.primary,
                  border: `1px solid ${curThemeStyle.primary}40`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: curThemeStyle.primary }} />
                {t('theme.previewing', 'Previewing')}: {themes.find((th) => th.id === hoveredTheme)?.title}
              </span>
            )}
          </div>
          <span
            className="text-[10px] transition-colors"
            style={{ color: curThemeStyle.headerColor }}
          >
            {hoveredTheme
              ? t('theme.previewHoverNotice', 'Showing how engineering schedules look in this theme')
              : t('theme.previewDesc', 'Real-time preview of engineering table elements and badges in the selected theme')}
          </span>
        </div>

        <div
          className="overflow-x-auto rounded-lg border transition-colors duration-300"
          style={{ borderColor: curThemeStyle.borderColor }}
        >
          <table
            className="cable-schedule-table text-xs w-full transition-colors duration-300"
            style={{
              backgroundColor: curThemeStyle.cardBg,
            }}
          >
            <thead>
              <tr>
                <th>Circuit Ref</th>
                <th>Load (A)</th>
                <th>Conductor Spec</th>
                <th>Length (m)</th>
                <th>Voltage Drop</th>
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-semibold transition-colors" style={{ color: curThemeStyle.primary }}>
                  MDB-TOWER-1
                </td>
                <td className="font-mono transition-colors">385.7 A</td>
                <td className="font-mono transition-colors">4 x (1C x 240 mm² Cu/XLPE)</td>
                <td className="font-mono transition-colors">45.0 m</td>
                <td className="font-mono font-semibold transition-colors" style={{ color: curThemeStyle.badgeText }}>
                  1.12% (&lt; 3%)
                </td>
                <td>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
                    style={{
                      backgroundColor: curThemeStyle.badgeBg,
                      color: curThemeStyle.badgeText,
                      border: `1px solid ${curThemeStyle.badgeBorder}`,
                    }}
                  >
                    <ShieldCheck size={12} />
                    IEC 60364 PASS
                  </span>
                </td>
              </tr>
              <tr>
                <td className="font-mono font-semibold transition-colors" style={{ color: curThemeStyle.primary }}>
                  SMDB-FL01
                </td>
                <td className="font-mono transition-colors">68.4 A</td>
                <td className="font-mono transition-colors">4 x (1C x 25 mm² Cu/XLPE)</td>
                <td className="font-mono transition-colors">18.0 m</td>
                <td className="font-mono font-semibold transition-colors" style={{ color: curThemeStyle.badgeText }}>
                  0.74% (&lt; 3%)
                </td>
                <td>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
                    style={{
                      backgroundColor: curThemeStyle.badgeBg,
                      color: curThemeStyle.badgeText,
                      border: `1px solid ${curThemeStyle.badgeBorder}`,
                    }}
                  >
                    <ShieldCheck size={12} />
                    IEC 60364 PASS
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
