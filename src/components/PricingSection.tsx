'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  Building2,
  ArrowRight,
  ArrowLeft,
  FileCheck2,
  Cpu,
  Receipt,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  Calculator,
  Users,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n';

type PackAccent = 'sky' | 'orange' | 'emerald';

interface CreditPackConfig {
  id: 'single' | 'pack3' | 'pack10';
  credits: 1 | 3 | 10;
  name: string;
  tagline: string;
  price: string;
  priceSuffix: string;
  unitNote: string;
  validityNote: string;
  savingBadge?: string;
  cta: string;
  accent: PackAccent;
  icon: React.ComponentType<{ className?: string }>;
  featured?: boolean;
}

const ACCENT: Record<PackAccent, {
  iconBg: string;
  iconText: string;
  priceText: string;
  unitPill: string;
  bullet: string;
  ctaVariant: 'outline' | 'glow' | 'default';
  borderHover: string;
}> = {
  sky: {
    iconBg: 'bg-sky-500/15 border-sky-500/40',
    iconText: 'text-sky-500 dark:text-sky-400',
    priceText: 'text-sky-600 dark:text-sky-300',
    unitPill: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30',
    bullet: 'text-sky-500 dark:text-sky-400',
    ctaVariant: 'outline',
    borderHover: 'hover:border-sky-500/50',
  },
  orange: {
    iconBg: 'bg-orange-500/20 border-orange-500/50',
    iconText: 'text-orange-500 dark:text-orange-400',
    priceText: 'text-orange-600 dark:text-orange-300',
    unitPill: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/40',
    bullet: 'text-orange-500 dark:text-orange-400',
    ctaVariant: 'glow',
    borderHover: 'hover:border-orange-500/50',
  },
  emerald: {
    iconBg: 'bg-emerald-500/15 border-emerald-500/40',
    iconText: 'text-emerald-500 dark:text-emerald-400',
    priceText: 'text-emerald-600 dark:text-emerald-300',
    unitPill: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    bullet: 'text-emerald-500 dark:text-emerald-400',
    ctaVariant: 'default',
    borderHover: 'hover:border-emerald-500/50',
  },
};

export function PricingSection() {
  const { t, isRtl } = useTranslation();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const sharedFeatures = [
    t('pricing.sharedFeatures.f1', 'Full IEC 60364-5-52 & NEC load, cable & voltage drop engine'),
    t('pricing.sharedFeatures.f2', 'Multi-building complex & 3-phase automatic load balancing'),
    t('pricing.sharedFeatures.f3', 'Full ABB, Schneider & Siemens catalog + TCC selectivity curves'),
    t('pricing.sharedFeatures.f4', "Short-circuit (Ik'') & thermal withstand (I²t ≤ k²S²) verification"),
    t('pricing.sharedFeatures.f5', 'Print-ready CAD SLD, riser diagram, PDF report & Excel BOM'),
    t('pricing.sharedFeatures.f6', 'Custom company branding & up to 5 team collaboration seats'),
  ];

  const packs: CreditPackConfig[] = [
    {
      id: 'single',
      credits: 1,
      name: t('pricing.single.name', 'Single Project'),
      tagline: t('pricing.single.tagline', 'One project. Try it once. No commitment.'),
      price: t('pricing.single.price', '49'),
      priceSuffix: t('pricing.perProject', '/ project'),
      unitNote: t('pricing.single.unitNote', '1 project credit • $49 a project'),
      validityNote: t('pricing.single.validityNote', 'Valid for 24 months • No renewal'),
      cta: t('pricing.single.cta', 'Get started'),
      accent: 'sky',
      icon: Zap,
    },
    {
      id: 'pack3',
      credits: 3,
      name: t('pricing.pack3.name', '3 Projects'),
      tagline: t('pricing.pack3.tagline', 'For practicing consultants and multi-client workloads.'),
      price: t('pricing.pack3.price', '99'),
      priceSuffix: t('pricing.oneTime', 'one-off'),
      unitNote: t('pricing.pack3.unitNote', '3 projects • $33 a project • save 33%'),
      validityNote: t('pricing.pack3.validityNote', 'Valid for 24 months • Share with up to 5 seats'),
      savingBadge: 'Save 33%',
      cta: t('pricing.pack3.cta', 'Buy the pack'),
      accent: 'orange',
      icon: Cpu,
      featured: true,
    },
    {
      id: 'pack10',
      credits: 10,
      name: t('pricing.pack10.name', '10 Projects'),
      tagline: t('pricing.pack10.tagline', 'For MEP consultancies, contractors, and EPC firms.'),
      price: t('pricing.pack10.price', '249'),
      priceSuffix: t('pricing.oneTime', 'one-off'),
      unitNote: t('pricing.pack10.unitNote', '10 projects • $25 a project • save 49%'),
      validityNote: t('pricing.pack10.validityNote', 'Valid for 24 months • Share with up to 5 seats'),
      savingBadge: 'Save 49%',
      cta: t('pricing.pack10.cta', 'Buy the pack'),
      accent: 'emerald',
      icon: Building2,
    },
  ];

  const comparisonRows = [
    {
      label: t('pricing.compare.rowPrice', 'Price'),
      single: '$49',
      pack3: '$99',
      pack10: '$249',
      isMono: true,
    },
    {
      label: t('pricing.compare.rowProjects', 'Projects included'),
      single: '1',
      pack3: '3',
      pack10: '10',
      isMono: true,
    },
    {
      label: t('pricing.compare.rowPerProject', 'Price per project'),
      single: '$49',
      pack3: '$33',
      pack10: '$25',
      isMono: true,
    },
    {
      label: t('pricing.compare.rowSaving', 'Saving'),
      single: '—',
      pack3: '33%',
      pack10: '49%',
      isHighlightSaving: true,
    },
    {
      label: t('pricing.compare.rowEngine', 'Full IEC & NEC calculation engine'),
      single: t('pricing.compare.valIncluded', 'Included'),
      pack3: t('pricing.compare.valIncluded', 'Included'),
      pack10: t('pricing.compare.valIncluded', 'Included'),
      isIncluded: true,
    },
    {
      label: t('pricing.compare.rowDeliverables', 'Print-ready SLD, Riser, PDF & Excel BOM'),
      single: t('pricing.compare.valIncluded', 'Included'),
      pack3: t('pricing.compare.valIncluded', 'Included'),
      pack10: t('pricing.compare.valIncluded', 'Included'),
      isIncluded: true,
    },
    {
      label: t('pricing.compare.rowCatalog', 'Breaker selectivity, TCC & short-circuit'),
      single: t('pricing.compare.valIncluded', 'Included'),
      pack3: t('pricing.compare.valIncluded', 'Included'),
      pack10: t('pricing.compare.valIncluded', 'Included'),
      isIncluded: true,
    },
    {
      label: t('pricing.compare.rowSeats', 'Team collaboration seats'),
      single: t('pricing.compare.valSeats', 'Up to 5 / project'),
      pack3: t('pricing.compare.valSeats', 'Up to 5 / project'),
      pack10: t('pricing.compare.valSeats', 'Up to 5 / project'),
    },
    {
      label: t('pricing.compare.rowValidity', 'Credit validity'),
      single: t('pricing.compare.valValidity', '24 months'),
      pack3: t('pricing.compare.valValidity', '24 months'),
      pack10: t('pricing.compare.valValidity', '24 months'),
    },
    {
      label: t('pricing.compare.rowRenewal', 'Automatic renewal'),
      single: t('pricing.compare.valNo', 'No'),
      pack3: t('pricing.compare.valNo', 'No'),
      pack10: t('pricing.compare.valNo', 'No'),
      isNoRenewal: true,
    },
  ];

  const faqItems = [
    {
      q: t('pricing.faq.q1', 'How do project credits work?'),
      a: t(
        'pricing.faq.a1',
        'One credit unlocks one complete electrical engineering project in ProCal — including unlimited buildings, floors, apartment templates, riser panels, SLD generation, and PDF/Excel exports for that project.'
      ),
    },
    {
      q: t('pricing.faq.q2', 'Do packs renew automatically?'),
      a: t(
        'pricing.faq.a2',
        'No. Every credit pack is a one-off purchase with zero recurring billing or hidden subscriptions. You only buy more credits when you take on new projects.'
      ),
    },
    {
      q: t('pricing.faq.q3', 'When do my credits expire?'),
      a: t(
        'pricing.faq.a3',
        'All project credits are valid for 24 months from the purchase date. Once a project is created with a credit, that project remains accessible in your workspace permanently.'
      ),
    },
    {
      q: t('pricing.faq.q4', 'Does every pack include all engineering modules and exports?'),
      a: t(
        'pricing.faq.a4',
        'Yes. Whether you buy 1 project or 10 projects, every credit unlocks 100% of ProCal: IEC/NEC cable sizing, 3-phase load balancing, TCC selectivity curves, short-circuit thermal withstand, CAD SLD, riser diagram, and print-ready PDF & Excel BOM.'
      ),
    },
    {
      q: t('pricing.faq.q5', 'Can a single project include multiple buildings or towers?'),
      a: t(
        'pricing.faq.a5',
        'Yes. One ProCal project can model an entire multi-building complex (e.g., Residential Tower A, Tower B, and Retail Podium) with uniform complex diversity and per-building schedules.'
      ),
    },
    {
      q: t('pricing.faq.q6', 'Can I collaborate with my engineering team?'),
      a: t(
        'pricing.faq.a6',
        'Yes. Each project supports up to 5 team collaboration seats with role-based permissions and real-time QA review comments at no extra seat fee.'
      ),
    },
    {
      q: t('pricing.faq.q7', 'Can I test ProCal before purchasing a credit?'),
      a: t(
        'pricing.faq.a7',
        'Absolutely. You can use all 7 standalone IEC & NEC engineering calculators at /tools for free without logging in, or explore our interactive demo workspace.'
      ),
    },
  ];

  return (
    <section id="pricing" className="relative mt-12 sm:mt-24 mb-16 sm:mb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20">
      {/* =========================================================================
          TOP PG-36 CABLE GLAND INLET
      ========================================================================= */}
      <div className="relative z-30 flex items-center justify-center -mb-2.5 sm:-mb-3.5">
        <div className="flex items-center gap-3 sm:gap-6 px-5 sm:px-8 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-b from-[#b8b5a0] via-[#aba792] to-[#999580] border-2 border-[#d5d2bf] gland-shadow-pricing">
          <div className="hidden sm:flex flex-col text-end font-mono text-[10px] text-slate-900 leading-tight">
            <span className="font-bold">INCOMER FEEDER</span>
            <span className="text-slate-800">NYY-J 4x35 mm²</span>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[#8a8775]" />

          <div className="flex flex-col items-center">
            <div
              id="pricing-cable-inlet"
              className="w-7 h-3 bg-slate-950 rounded-t-md border-t border-x border-slate-700 shadow-inner flex items-center justify-center -mb-0.5"
            />

            <div className="relative z-10 px-3.5 py-1 rounded bg-gradient-to-b from-amber-200 via-amber-400 to-yellow-600 border border-yellow-200 shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-center">
              <span className="text-[11px] font-mono font-black text-slate-950 tracking-wider">PG-36</span>
            </div>

            <div className="w-14 h-1 bg-slate-950 rounded-sm mt-0.5 border-t border-slate-800" />

            <div className="flex items-center gap-1 px-2 py-0.5 mt-1 rounded bg-slate-950/80 border border-slate-800 shadow-inner">
              <div className="flex items-center gap-1">
                <span className="w-2 h-3 rounded-t-sm bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-red-400">L1</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-3 rounded-t-sm bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-amber-400">L2</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-3 rounded-t-sm bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-sky-400">L3</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-3 rounded-t-sm bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-cyan-300">N</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[#8a8775]" />

          <div className="hidden sm:flex flex-col text-start font-mono text-[10px] text-slate-900 leading-tight">
            <span className="font-bold">PROJECT CREDIT METER</span>
            <span className="text-slate-800">ONE-OFF • NO RENEWAL</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PRICING ENCLOSURE FRAME: RAL 7032 INDUSTRIAL HOUSING
      ========================================================================= */}
      <div className="relative z-20 rounded-3xl p-4 sm:p-7 md:p-10 bg-gradient-to-b from-[#b8b5a0] via-[#aba792] to-[#999580] border-4 border-[#d5d2bf] panel-enclosure-shadow">
        {[
          'top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3',
        ].map((pos) => (
          <div key={pos} className={`pointer-events-none absolute ${pos} w-3.5 h-3.5 rounded-full bg-[#8f8c79] border border-[#d5d2bf] shadow-inner flex items-center justify-center`}>
            <div className="w-2 h-0.5 bg-[#4a483d]" />
          </div>
        ))}

        {/* Fascia Nameplate */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 mb-6 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-sm text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-mono font-bold text-[var(--foreground-color)] tracking-wide text-xs">
                PROJECT CREDIT &amp; TARIFF UNIT
              </span>
              <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle)] text-[10px] font-mono text-[var(--table-header-color)] border border-[var(--border-color)]">
                ONE-OFF PACKS • NO SUBSCRIPTION
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[var(--table-header-color)] font-mono text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-medium text-[var(--foreground-color)]">Save up to 49% per project • Valid 24 months</span>
          </div>
        </div>

        {/* Inner Glass Display Panel */}
        <div className="relative rounded-2xl border-2 border-[var(--border-color)] bg-[var(--card-bg-subtle)]/90 backdrop-blur-xl p-5 sm:p-8 inner-panel-shadow overflow-hidden transition-colors duration-200">
          <div
            className="pointer-events-none absolute inset-0 z-20 opacity-30"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.03) 60%, rgba(255,255,255,0) 100%)',
            }}
          />

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-10">
              <Badge variant="glow" className="mb-3.5 px-3 py-1 text-xs inline-flex items-center gap-1.5 bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400">
                <Sparkles className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                {t('pricing.badge', 'Transparent Pricing')}
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[var(--foreground-color)] tracking-tight">
                {t('pricing.headingPrefix', 'Pricing That Scales')}{' '}
                <span
                  className="bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 dark:from-orange-400 dark:via-amber-300 dark:to-orange-500 bg-clip-text"
                  style={{
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {t('pricing.headingSuffix', 'With You')}
                </span>
              </h2>
              <p className="mt-3 text-[var(--table-header-color)] text-sm sm:text-base leading-relaxed">
                {t(
                  'pricing.subheading',
                  'Start with a single project, or buy a pack and pay less per project. All credits are valid for 24 months. No subscription, no automatic renewal.'
                )}
              </p>
            </div>

            {/* 3 One-Off Credit Pack Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {packs.map((pack) => {
                const a = ACCENT[pack.accent];
                const Icon = pack.icon;
                return (
                  <motion.div
                    key={pack.id}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={`flex min-w-0 relative ${pack.featured ? 'lg:-mt-4 lg:mb-[-1rem]' : ''}`}
                  >
                    {pack.featured && (
                      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 opacity-25 dark:opacity-60 blur-md pointer-events-none" />
                    )}
                    <Card
                      className={`relative flex-1 flex flex-col rounded-2xl shadow-xl transition-all ${
                        pack.featured
                          ? 'border-2 border-orange-500 bg-[var(--card-bg)] shadow-[0_0_35px_rgba(234,88,12,0.18)] ring-1 ring-orange-500/30'
                          : `border-[var(--border-color)] bg-[var(--card-bg)] backdrop-blur-md ${a.borderHover}`
                      }`}
                    >
                      {pack.featured && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-600 text-white border border-orange-400 font-mono text-[10px] font-bold uppercase tracking-wider shadow-md shadow-orange-500/30 whitespace-nowrap">
                            <Sparkles className="w-3 h-3 text-amber-200" />
                            <span className="text-white-force">{t('pricing.mostPopular', 'Most popular')}</span>
                          </div>
                        </div>
                      )}

                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${a.iconBg} ${a.iconText}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <CardTitle className="text-xl font-bold text-[var(--foreground-color)]">{pack.name}</CardTitle>
                          </div>
                          {pack.savingBadge && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                              {pack.savingBadge}
                            </span>
                          )}
                        </div>
                        <CardDescription className="text-xs text-[var(--table-header-color)] min-h-[2rem]">
                          {pack.tagline}
                        </CardDescription>

                        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-[var(--table-header-color)] font-mono align-top mt-1.5">$</span>
                            <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${a.priceText}`}>
                              {pack.price}
                            </span>
                            <span className="text-xs text-[var(--table-header-color)] font-mono">
                              {pack.priceSuffix}
                            </span>
                          </div>

                          <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold ${a.unitPill}`}>
                            <span>{pack.unitNote}</span>
                          </div>

                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--table-header-color)] font-mono">
                            <Clock className="w-3.5 h-3.5 text-[var(--table-header-color)] shrink-0" />
                            <span>{pack.validityNote}</span>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-2.5 py-2 flex-1">
                        <div className="text-[11px] font-semibold text-[var(--table-header-color)] uppercase tracking-wider font-mono">
                          {t('pricing.includedScope', 'Every project credit includes:')}
                        </div>
                        <ul className="space-y-2 text-xs text-[var(--foreground-color)]">
                          {sharedFeatures.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${a.bullet}`} />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>

                      <CardFooter className="pt-4 border-t border-[var(--border-color)]">
                        <Link href={`/billing?credits=${pack.credits}`} className="w-full">
                          <Button
                            variant={a.ctaVariant}
                            className={`w-full gap-2 text-xs font-semibold ${
                              pack.featured
                                ? 'py-6 shadow-xl'
                                : 'border-[var(--border-color)] hover:bg-[var(--card-bg-subtle)] text-[var(--foreground-color)]'
                            }`}
                          >
                            <span>{pack.cta}</span>
                            <Arrow className="w-4 h-4" />
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Free Engineering Calculators — Zero-Login Exploration Strip */}
            <motion.div whileHover={{ y: -2, transition: { duration: 0.2 } }} className="mt-8">
              <Card className="rounded-2xl border-[var(--border-color)] bg-[var(--card-bg)] backdrop-blur-md hover:border-orange-500/40 transition-all shadow-md">
                <CardContent className="py-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500 dark:text-orange-400 shrink-0">
                        <Calculator className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base sm:text-lg font-bold text-[var(--foreground-color)]">
                            {t('pricing.freeToolsBanner.title', '7 Free Standalone IEC & NEC Calculators')}
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                            {t('pricing.freeToolsBanner.badge', 'Zero-Login Engineering Tools')}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--table-header-color)] mt-1 leading-relaxed max-w-2xl">
                          {t(
                            'pricing.freeToolsBanner.desc',
                            'Run quick cable sizing, voltage drop, short-circuit, power factor, breaker trip, conduit fill, and kVA conversions immediately in your browser.'
                          )}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--table-header-color)] mt-1.5">
                          {t('pricing.freeToolsBanner.cardNote', 'No account required • Instant engineering verification • 100% Free')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Link href="/tools">
                        <Button variant="outline" className="gap-2 text-xs font-semibold border-[var(--border-color)] hover:bg-[var(--card-bg-subtle)] text-[var(--foreground-color)]">
                          <span>{t('pricing.freeToolsBanner.cta', 'Open Free Calculators')}</span>
                          <Arrow className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* =====================================================================
                COMPARE PLANS — EVERYTHING SIDE BY SIDE
            ===================================================================== */}
            <div className="mt-14 pt-10 border-t border-[var(--border-color)]">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <span className="text-xs font-mono uppercase tracking-widest text-orange-500 dark:text-orange-400 font-bold">
                  {t('pricing.compare.badge', 'Compare plans')}
                </span>
                <h3 className="mt-1.5 text-2xl sm:text-3xl font-extrabold text-[var(--foreground-color)] tracking-tight">
                  {t('pricing.compare.title', 'Everything side by side')}
                </h3>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-lg">
                <table className="w-full text-start border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--card-bg-subtle)]/70">
                      <th className="py-4 px-5 text-start text-xs font-mono uppercase tracking-wider text-[var(--table-header-color)]">
                        {t('pricing.compare.colFeature', 'Feature')}
                      </th>
                      <th className="py-4 px-5 text-center text-sm font-bold text-[var(--foreground-color)]">
                        {t('pricing.compare.colSingle', 'Single Project')}
                      </th>
                      <th className="py-4 px-5 text-center text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-500/5 border-x border-orange-500/20">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{t('pricing.compare.colPack3', '3 Projects')}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-orange-500/20 text-orange-600 dark:text-orange-300">
                            {t('pricing.mostPopular', 'Most popular')}
                          </span>
                        </div>
                      </th>
                      <th className="py-4 px-5 text-center text-sm font-bold text-[var(--foreground-color)]">
                        {t('pricing.compare.colPack10', '10 Projects')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] text-xs sm:text-sm">
                    {comparisonRows.map((row) => (
                      <tr key={row.label} className="hover:bg-[var(--card-bg-subtle)]/40 transition-colors">
                        <td className="py-3.5 px-5 font-medium text-[var(--foreground-color)]">
                          {row.label}
                        </td>
                        <td className={`py-3.5 px-5 text-center ${row.isMono ? 'font-mono font-bold text-[var(--foreground-color)]' : 'text-[var(--table-header-color)]'}`}>
                          {row.isIncluded ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <Check className="w-4 h-4" />
                              {row.single}
                            </span>
                          ) : (
                            row.single
                          )}
                        </td>
                        <td className={`py-3.5 px-5 text-center bg-orange-500/5 border-x border-orange-500/20 ${row.isMono ? 'font-mono font-bold text-orange-600 dark:text-orange-300' : 'text-[var(--foreground-color)] font-medium'}`}>
                          {row.isHighlightSaving ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              {row.pack3}
                            </span>
                          ) : row.isIncluded ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <Check className="w-4 h-4" />
                              {row.pack3}
                            </span>
                          ) : (
                            row.pack3
                          )}
                        </td>
                        <td className={`py-3.5 px-5 text-center ${row.isMono ? 'font-mono font-bold text-emerald-600 dark:text-emerald-400' : 'text-[var(--table-header-color)]'}`}>
                          {row.isHighlightSaving ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              {row.pack10}
                            </span>
                          ) : row.isIncluded ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <Check className="w-4 h-4" />
                              {row.pack10}
                            </span>
                          ) : (
                            row.pack10
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* =====================================================================
                COMMON QUESTIONS — GOOD TO KNOW (INTERACTIVE FAQ ACCORDION)
            ===================================================================== */}
            <div className="mt-14 pt-10 border-t border-[var(--border-color)]">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <span className="text-xs font-mono uppercase tracking-widest text-orange-500 dark:text-orange-400 font-bold">
                  {t('pricing.faq.badge', 'Common questions')}
                </span>
                <h3 className="mt-1.5 text-2xl sm:text-3xl font-extrabold text-[var(--foreground-color)] tracking-tight">
                  {t('pricing.faq.title', 'Good to know')}
                </h3>
              </div>

              <div className="max-w-3xl mx-auto space-y-3">
                {faqItems.map((item, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={item.q}
                      className={`rounded-2xl border transition-all ${
                        isOpen
                          ? 'border-orange-500/50 bg-[var(--card-bg)] shadow-md'
                          : 'border-[var(--border-color)] bg-[var(--card-bg)]/80 hover:border-orange-500/30'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-start text-sm sm:text-base font-bold text-[var(--foreground-color)] focus:outline-none"
                      >
                        <span>{item.q}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-orange-500 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 pt-0 text-xs sm:text-sm text-[var(--table-header-color)] leading-relaxed border-t border-[var(--border-color)]/60 mt-1 pt-3">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* =====================================================================
                READY TO GET STARTED? BOTTOM CONVERSION BANNER
            ===================================================================== */}
            <div className="mt-14 pt-10 border-t border-[var(--border-color)]">
              <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border border-orange-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-start">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--foreground-color)]">
                    {t('pricing.ctaBanner.title', 'Ready to get started?')}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-[var(--table-header-color)]">
                    {t('pricing.ctaBanner.desc', 'Try a single project for $49, or buy a pack and save up to 49% per project.')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
                  <Link href="/billing?credits=1">
                    <Button variant="outline" className="gap-2 text-xs font-semibold border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-subtle)] text-[var(--foreground-color)]">
                      <span>{t('pricing.ctaBanner.primaryCta', 'Buy 1 credit for $49')}</span>
                    </Button>
                  </Link>
                  <Link href="/billing?credits=3">
                    <Button variant="glow" className="gap-2 text-xs font-semibold">
                      <span>{t('pricing.ctaBanner.secondaryCta', 'Buy the 3-project pack')}</span>
                      <Arrow className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Reassurance Feature Grid */}
            <div className="mt-10 pt-8 border-t border-[var(--border-color)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
                <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-[var(--foreground-color)]">{t('pricing.reassurance.r1Title', 'No Auto-Renewal')}</div>
                  <div className="text-[11px] text-[var(--table-header-color)]">{t('pricing.reassurance.r1Desc', 'One-off credit packs, valid 24 months')}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
                <FileCheck2 className="w-5 h-5 text-orange-500 dark:text-orange-400 shrink-0" />
                <div>
                  <div className="font-bold text-[var(--foreground-color)]">{t('pricing.reassurance.r2Title', 'IEC & NEC Standards')}</div>
                  <div className="text-[11px] text-[var(--table-header-color)]">{t('pricing.reassurance.r2Desc', '100% calculation compliance')}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
                <Users className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
                <div>
                  <div className="font-bold text-[var(--foreground-color)]">{t('pricing.reassurance.r3Title', 'Instant Export')}</div>
                  <div className="text-[11px] text-[var(--table-header-color)]">{t('pricing.reassurance.r3Desc', 'Printable PDF packages, CAD SLD & BOM')}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
                <HelpCircle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-[var(--foreground-color)]">{t('pricing.reassurance.r4Title', 'Need Custom Help?')}</div>
                  <div className="text-[11px] text-[var(--table-header-color)]">
                    <Link href="/contact" className="text-amber-600 dark:text-amber-400 hover:underline">
                      {t('pricing.reassurance.r4Link', 'Contact Engineering Team')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Safety / Rating Banner on Enclosure */}
        <div className="relative z-20 mt-3 pt-2 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-900 font-semibold px-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-700" />
            <span>TARIFF METER ENCLOSURE • FORM 4b • IP54</span>
          </div>

          <div className="flex items-center gap-1 text-slate-900">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
            <span>SECURE CHECKOUT &amp; INSTANT PROJECT ACTIVATION</span>
          </div>
        </div>
      </div>
    </section>
  );
}

