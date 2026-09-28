'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  Building2,
  Layers,
  ArrowRight,
  ArrowLeft,
  FileCheck2,
  Cpu,
  Receipt,
  HelpCircle,
  CheckCircle2,
  Tag,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n';

type TierAccent = 'sky' | 'orange' | 'emerald';

interface TierConfig {
  i18nKey: string;
  name: string;
  tagline: string;
  price: string;
  allowance: string;
  seats: string;
  features: string[];
  cta: string;
  accent: TierAccent;
  icon: React.ComponentType<{ className?: string }>;
  featured?: boolean;
}

const ACCENT: Record<TierAccent, {
  iconBg: string;
  iconText: string;
  priceText: string;
  bullet: string;
  ctaVariant: 'outline' | 'glow' | 'default';
  borderHover: string;
}> = {
  sky: {
    iconBg: 'bg-sky-500/15 border-sky-500/40',
    iconText: 'text-sky-400',
    priceText: 'text-sky-300',
    bullet: 'text-sky-400',
    ctaVariant: 'outline',
    borderHover: 'hover:border-sky-500/50',
  },
  orange: {
    iconBg: 'bg-orange-500/20 border-orange-500/50',
    iconText: 'text-orange-400',
    priceText: 'text-orange-300',
    bullet: 'text-orange-400',
    ctaVariant: 'glow',
    borderHover: 'hover:border-orange-500/50',
  },
  emerald: {
    iconBg: 'bg-emerald-500/15 border-emerald-500/40',
    iconText: 'text-emerald-400',
    priceText: 'text-emerald-300',
    bullet: 'text-emerald-400',
    ctaVariant: 'default',
    borderHover: 'hover:border-emerald-500/50',
  },
};

export function PricingSection() {
  const { t, isRtl } = useTranslation();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const tiers: TierConfig[] = [
    {
      i18nKey: 'starter',
      name: t('pricing.starter.name', 'Starter'),
      tagline: t('pricing.starter.tagline', 'Solo engineers and occasional small jobs.'),
      price: t('pricing.starter.price', '29'),
      allowance: t('pricing.starter.allowance', '1 project / month'),
      seats: t('pricing.starter.seats', '1 seat included'),
      features: [
        t('pricing.starter.f1', 'Core IEC 60364-5-52 load & cable engine'),
        t('pricing.starter.f2', '3-phase automatic load balancing'),
        t('pricing.starter.f3', 'Standard PDF report export'),
        t('pricing.starter.f4', 'Full ABB / Schneider catalog match'),
      ],
      cta: t('pricing.starter.cta', 'Start with Starter'),
      accent: 'sky',
      icon: Zap,
    },
    {
      i18nKey: 'professional',
      name: t('pricing.professional.name', 'Professional'),
      tagline: t('pricing.professional.tagline', 'Practicing consultants running a steady pipeline.'),
      price: t('pricing.professional.price', '89'),
      allowance: t('pricing.professional.allowance', '5 projects / month'),
      seats: t('pricing.professional.seats', '2 seats included'),
      features: [
        t('pricing.professional.f1', 'Everything in Starter'),
        t('pricing.professional.f2', 'Print-ready SLD & riser diagram export'),
        t('pricing.professional.f3', 'Protection selectivity & TCC curves'),
        t('pricing.professional.f4', 'Short-circuit & thermal withstand analysis'),
        t('pricing.professional.f5', 'Custom company branding on reports'),
        t('pricing.professional.f6', 'AI agent access via MCP server'),
      ],
      cta: t('pricing.professional.cta', 'Choose Professional'),
      accent: 'orange',
      icon: Cpu,
      featured: true,
    },
    {
      i18nKey: 'team',
      name: t('pricing.team.name', 'Team'),
      tagline: t('pricing.team.tagline', 'Consultancies and EPCs working as a firm.'),
      price: t('pricing.team.price', '249'),
      allowance: t('pricing.team.allowance', '15 projects / month'),
      seats: t('pricing.team.seats', '5 seats included'),
      features: [
        t('pricing.team.f1', 'Everything in Professional'),
        t('pricing.team.f2', 'Central breaker catalog manager (CSV import)'),
        t('pricing.team.f3', 'Shared project workspaces & team roles'),
        t('pricing.team.f4', 'Priority engineering support'),
      ],
      cta: t('pricing.team.cta', 'Choose Team'),
      accent: 'emerald',
      icon: Building2,
    },
  ];

  return (
    <section id="pricing" className="relative mt-12 sm:mt-24 mb-16 sm:mb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20">
      {/* =========================================================================
          TOP PG-36 CABLE GLAND INLET
      ========================================================================= */}
      <div className="relative z-0 flex items-center justify-center -mb-4">
        <div className="flex items-center gap-3 sm:gap-6 px-5 sm:px-8 py-2 rounded-t-2xl bg-gradient-to-b from-[#b8b5a0] to-[#a3a08c] border-t-2 border-x-2 border-[#d5d2bf] shadow-[0_-6px_25px_rgba(0,0,0,0.6)]">
          <div className="hidden sm:flex flex-col text-end font-mono text-[10px] text-slate-900 leading-tight">
            <span className="font-bold">INCOMER FEEDER</span>
            <span className="text-slate-800">NYY-J 4x35 mm²</span>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[#8a8775]" />

          <div className="flex flex-col items-center">
            <div className="w-7 h-3 bg-slate-950 rounded-t-md border-t border-x border-slate-700 shadow-inner flex items-center justify-center -mb-0.5" />

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
            <span className="font-bold">PROJECT TARIFF METER</span>
            <span className="text-slate-800">SUBSCRIPTION + PASS</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PRICING ENCLOSURE FRAME: RAL 7032 INDUSTRIAL HOUSING
      ========================================================================= */}
      <div className="relative z-20 rounded-3xl p-4 sm:p-7 md:p-10 bg-gradient-to-b from-[#b8b5a0] via-[#aba792] to-[#999580] border-4 border-[#d5d2bf] shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.4)]">
        {[
          'top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3',
        ].map((pos) => (
          <div key={pos} className={`pointer-events-none absolute ${pos} w-3.5 h-3.5 rounded-full bg-[#8f8c79] border border-[#d5d2bf] shadow-inner flex items-center justify-center`}>
            <div className="w-2 h-0.5 bg-[#4a483d]" />
          </div>
        ))}

        {/* Fascia Nameplate */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 mb-6 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="font-mono font-bold text-white tracking-wide text-xs">
                PROJECT LICENSING &amp; TARIFF UNIT
              </span>
              <span className="ms-2 px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-[#c4c1ae] border border-[#8a8775]">
                MONTHLY + ONE-TIME
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-300 font-mono text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>20% off annual billing</span>
          </div>
        </div>

        {/* Inner Glass Display Panel */}
        <div className="relative rounded-2xl border-2 border-slate-700/80 bg-slate-950/90 backdrop-blur-xl p-5 sm:p-8 shadow-[inset_0_4px_25px_rgba(0,0,0,0.8)] overflow-hidden">
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
              <Badge variant="glow" className="mb-3.5 px-3 py-1 text-xs inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                {t('pricing.badge', 'Project-Based Pricing')}
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                {t('pricing.headingPrefix', 'Pay As You Build')}{' '}
                <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
                  {t('pricing.headingSuffix', 'Cancel Anytime')}
                </span>
              </h2>
              <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                {t(
                  'pricing.subheading',
                  'Start with a free watermarked trial project. Upgrade when you need print-ready deliverables — or buy a single project pass and never pay a monthly fee.'
                )}
              </p>
            </div>

            {/* Free Trial — full width horizontal card */}
            <motion.div whileHover={{ y: -3, transition: { duration: 0.2 } }} className="mb-6">
              <Card className="rounded-2xl border-white/10 bg-slate-900/70 backdrop-blur-md hover:border-slate-700 transition-all shadow-xl">
                <CardHeader className="pb-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-xl font-bold text-white">
                            {t('pricing.freeTrial.title', 'Free Starter Trial')}
                          </CardTitle>
                          <Badge variant="outline" className="text-[11px] font-mono border-slate-700 text-slate-400">
                            {t('pricing.freeTrial.badge', 'One-Time Trial')}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-slate-400 mt-1">
                          {t('pricing.freeTrial.desc', 'Build a real project end-to-end before you spend anything.')}
                        </CardDescription>
                        <p className="text-[11px] text-slate-400 font-mono mt-2">
                          {t('pricing.freeTrial.cardNote', 'No credit card required • 1 Project • 1 Building • 2 Floors')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 lg:gap-7 shrink-0">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-white font-mono">$0</span>
                      </div>
                      <Link href="/dashboard" className="shrink-0">
                        <Button variant="outline" className="gap-2 text-xs font-semibold border-slate-700 hover:bg-slate-800">
                          <span>{t('pricing.freeTrial.cta', 'Start Free Trial')}</span>
                          <Arrow className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-300">
                    {(['feature1', 'feature2', 'feature3', 'feature4', 'feature5'] as const).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          {t(
                            `pricing.freeTrial.${f}`,
                            f === 'feature1' ? 'Apartment templates & floor load calculator'
                              : f === 'feature2' ? 'Connected load & demand diversity engine'
                              : f === 'feature3' ? 'Cable sizing & voltage drop calculations'
                              : f === 'feature4' ? 'Interactive SLD & riser diagram preview'
                              : 'Watermarked PDF report export'
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                    {t(
                      'pricing.watermarkNote',
                      'Free trial exports carry a “Generated by ProCal” watermark. Print-ready PDF, SLD, and riser exports unlock on any paid plan.'
                    )}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* 3 Subscription Tiers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {tiers.map((tier) => {
                const a = ACCENT[tier.accent];
                const Icon = tier.icon;
                return (
                  <motion.div
                    key={tier.i18nKey}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={`flex min-w-0 relative ${tier.featured ? 'lg:-mt-4 lg:mb-[-1rem]' : ''}`}
                  >
                    {tier.featured && (
                      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 opacity-60 blur-md pointer-events-none" />
                    )}
                    <Card
                      className={`relative flex-1 flex flex-col rounded-2xl shadow-xl transition-all ${
                        tier.featured
                          ? 'border-2 border-orange-500/60 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 shadow-[0_0_40px_rgba(234,88,12,0.2)]'
                          : `border-white/10 bg-slate-900/70 backdrop-blur-md ${a.borderHover}`
                      }`}
                    >
                      {tier.featured && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <Badge variant="glow" className="text-[10px] font-mono uppercase tracking-wider whitespace-nowrap">
                            {t('pricing.mostPopular', 'Most Popular')}
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${a.iconBg} ${a.iconText}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <CardTitle className="text-xl font-bold text-white">{tier.name}</CardTitle>
                        </div>
                        <CardDescription className="text-xs text-slate-400 min-h-[2rem]">
                          {tier.tagline}
                        </CardDescription>

                        <div className="mt-4 pt-4 border-t border-slate-800 flex items-end justify-between gap-3">
                          <div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xs text-slate-400 font-mono align-top mt-1.5">$</span>
                              <span className={`text-4xl font-black font-mono tracking-tight ${a.priceText}`}>
                                {tier.price}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                {t('pricing.perMonth', '/mo')}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 font-mono mt-1.5">{tier.allowance}</p>
                          </div>
                          <div className="text-end">
                            <div className="flex items-center gap-1 text-[11px] text-slate-300 justify-end">
                              <UserPlus className="w-3 h-3 text-slate-500" />
                              <span>{tier.seats}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-1.5">
                              {t('pricing.extraSeat', '+$39 /seat /mo')}
                            </p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-2.5 py-2 flex-1">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                          {t('pricing.includedScope', 'Included Scope:')}
                        </div>
                        <ul className="space-y-2 text-xs text-slate-300">
                          {tier.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${a.bullet}`} />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>

                      <CardFooter className="pt-4 border-t border-slate-800/80">
                        <Link href="/billing" className="w-full">
                          <Button
                            variant={a.ctaVariant}
                            className={`w-full gap-2 text-xs font-semibold ${tier.featured ? 'py-6 shadow-xl' : 'border-slate-700 hover:bg-slate-800'}`}
                          >
                            <span>{tier.cta}</span>
                            <Arrow className="w-4 h-4" />
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Single Project Pass — no-subscription escape hatch */}
            <motion.div whileHover={{ y: -2, transition: { duration: 0.2 } }} className="mt-6">
              <Card className="rounded-2xl border-slate-700/60 bg-slate-900/50 backdrop-blur-md hover:border-slate-600 transition-all">
                <CardContent className="py-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
                        <Tag className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg font-bold text-white">
                            {t('pricing.pass.title', 'Single Project Pass')}
                          </CardTitle>
                          <Badge variant="outline" className="text-[11px] font-mono border-slate-700 text-slate-400">
                            {t('pricing.pass.badge', 'No Subscription?')}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                          {t(
                            'pricing.pass.desc',
                            'One project, one user, every paid feature. No commitment, no renewal, no seat upsell.'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-400 font-mono align-top mt-1.5">$</span>
                        <span className="text-3xl font-black font-mono text-amber-300">
                          {t('pricing.pass.price', '49')}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {t('pricing.oneTime', 'one-time')}
                        </span>
                      </div>
                      <Link href="/billing" className="shrink-0">
                        <Button variant="outline" className="gap-2 text-xs font-semibold border-slate-700 hover:bg-slate-800">
                          <span>{t('pricing.pass.cta', 'Buy a Single Project')}</span>
                          <Arrow className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Bottom Reassurance Feature Grid */}
            <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">{t('pricing.reassurance.r1Title', 'Free Watermarked Trial')}</div>
                  <div className="text-[11px] text-slate-400">{t('pricing.reassurance.r1Desc', 'Build and review before you pay')}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                <FileCheck2 className="w-5 h-5 text-orange-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">{t('pricing.reassurance.r2Title', 'IEC & NEC Standards')}</div>
                  <div className="text-[11px] text-slate-400">{t('pricing.reassurance.r2Desc', '100% calculation compliance')}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                <Cpu className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">{t('pricing.reassurance.r3Title', 'Instant Export')}</div>
                  <div className="text-[11px] text-slate-400">{t('pricing.reassurance.r3Desc', 'Printable PDF packages & BOM')}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">{t('pricing.reassurance.r4Title', 'Need Custom Help?')}</div>
                  <div className="text-[11px] text-slate-400">
                    <Link href="/contact" className="text-amber-400 hover:underline">
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
