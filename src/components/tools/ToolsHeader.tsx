'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Wrench,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSelector } from '@/components/ThemeSelector';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ProCalLogo } from '@/components/brand/ProCalLogo';
import { useTranslation } from '@/i18n';

export interface ToolOption {
  href: string;
  name: string;
  shortName: string;
  icon?: string;
  badge?: string;
}

export const FREE_TOOLS: ToolOption[] = [
  {
    href: '/tools/cable-sizer',
    name: 'IEC 60364 Cable & Breaker Sizer',
    shortName: 'Cable Sizer',
    icon: '⚡',
  },
  {
    href: '/tools/short-circuit-calculator',
    name: 'Short-Circuit & Breaker Icu Sizer',
    shortName: 'Short-Circuit',
    icon: '⚠️',
  },
  {
    href: '/tools/max-cable-length',
    name: 'Maximum Cable Run Length Matrix',
    shortName: 'Max Length',
    icon: '📉',
  },
  {
    href: '/tools/transformer-generator-sizer',
    name: 'Transformer & Generator Sizing',
    shortName: 'Transformer/Gen',
    icon: '🔌',
  },
  {
    href: '/tools/max-demand-calculator',
    name: 'Maximum Demand & Coincidence (IEC 61439)',
    shortName: 'Max Demand',
    icon: '🏢',
  },
  {
    href: '/tools/motor-protection-calculator',
    name: 'Motor & HVAC Electrical Protection',
    shortName: 'Motor & HVAC',
    icon: '⚙️',
  },
  {
    href: '/tools/protection-coordination',
    name: 'Protection Coordination & Selectivity',
    shortName: 'Selectivity (TCC)',
    icon: '🛡️',
  },
];

interface ToolsHeaderProps {
  currentPath?: string;
}

export function ToolsHeader({ currentPath }: ToolsHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, isRtl } = useTranslation();
  const activePath = currentPath || pathname;

  const handleToolSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const target = e.target.value;
    if (target && target !== activePath) {
      router.push(target);
    }
  };

  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)]/90 backdrop-blur-xl transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Lockup */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-600/15 border border-orange-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(234,88,12,0.2)] group-hover:scale-105 transition-transform">
            <ProCalLogo size={22} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base sm:text-lg tracking-tight text-[var(--foreground-color,#f8fafc)] flex items-center gap-1.5">
              {t('common.appName', 'ProCal')}
              <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.2 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 font-mono">
                FREE TOOLS
              </span>
            </span>
            <span className="text-[10px] text-[var(--table-header-color,#94a3b8)] font-mono tracking-wider uppercase -mt-0.5 hidden xs:inline">
              IEC &amp; NEC Calculators
            </span>
          </div>
        </Link>

        {/* Center: Interactive Tool Select Input Dropdown */}
        <div className="flex items-center gap-2 max-w-xs sm:max-w-sm md:max-w-md flex-1 mx-1 sm:mx-4">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-orange-500 dark:text-orange-400">
              <Wrench className="w-3.5 h-3.5" />
            </div>
            <select
              id="header-free-tool-select"
              aria-label="Choose a free electrical calculator"
              value={activePath || '/tools'}
              onChange={handleToolSelect}
              className="w-full pl-8 pr-7 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-color,#1f2937)] bg-[var(--card-bg-subtle,#111827)] text-[var(--foreground-color,#f8fafc)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all cursor-pointer truncate shadow-xs appearance-none"
            >
              <option value="/tools">All 7 Free Engineering Calculators</option>
              {FREE_TOOLS.map((tool) => (
                <option key={tool.href} value={tool.href}>
                  {tool.icon} {tool.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[var(--table-header-color,#94a3b8)]">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Right Action Items: Theme, Language, Auth */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <Link
            href="/tools"
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors hidden md:inline-flex items-center gap-1 border ${
              activePath === '/tools'
                ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30'
                : 'text-[var(--table-header-color,#94a3b8)] hover:text-[var(--foreground-color,#f8fafc)] border-transparent hover:bg-[var(--card-bg-subtle,#111827)]'
            }`}
          >
            <span>Overview</span>
          </Link>

          <ThemeSelector variant="dropdown" />
          <LanguageSelector variant="dropdown" />

          <Link href="/login" className="hidden lg:inline-flex">
            <Button variant="ghost" size="sm" className="text-xs text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,#111827)]">
              {t('auth.signInBtn', 'Sign In')}
            </Button>
          </Link>

          <Link href="/dashboard" className="inline-flex">
            <Button variant="glow" size="sm" className="h-8 px-2.5 sm:px-3 text-xs gap-1 sm:gap-1.5">
              <span className="hidden sm:inline">{t('dashboard.title', 'Launch App')}</span>
              <span className="sm:hidden">App</span>
              <Arrow className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default ToolsHeader;
