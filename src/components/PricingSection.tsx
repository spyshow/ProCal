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
  Clock,
  CheckCircle2,
  Flame,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n';

export function PricingSection() {
  const { t, isRtl } = useTranslation();

  return (
    <section id="pricing" className="relative mt-12 sm:mt-24 mb-16 sm:mb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20">
      {/* =========================================================================
          TOP PG-36 CABLE GLAND INLET (MOUNTED BEHIND / UNDER TOP PRICING PANEL LIP)
      ========================================================================= */}
      <div className="relative z-0 flex items-center justify-center -mb-4">
        <div className="flex items-center gap-3 sm:gap-6 px-5 sm:px-8 py-2 rounded-t-2xl bg-gradient-to-b from-[#b8b5a0] to-[#a3a08c] border-t-2 border-x-2 border-[#d5d2bf] shadow-[0_-6px_25px_rgba(0,0,0,0.6)]">
          {/* Left Tag */}
          <div className="hidden sm:flex flex-col text-end font-mono text-[10px] text-slate-900 leading-tight">
            <span className="font-bold">INCOMER FEEDER</span>
            <span className="text-slate-800">NYY-J 4x35 mm²</span>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[#8a8775]" />

          {/* DEAD-CENTER PG-36 GLAND & CABLE ENTRY */}
          <div className="flex flex-col items-center">
            {/* 1. Top Cable Seal Entry Boot (Cable lands here!) */}
            <div
              id="pricing-cable-inlet"
              className="w-7 h-3 bg-slate-950 rounded-t-md border-t border-x border-slate-700 shadow-inner flex items-center justify-center -mb-0.5"
            />

            {/* 2. Nickel-Plated Brass Hexagonal PG-36 Body */}
            <div className="relative z-10 px-3.5 py-1 rounded bg-gradient-to-b from-amber-200 via-amber-400 to-yellow-600 border border-yellow-200 shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-center">
              <span className="text-[11px] font-mono font-black text-slate-950 tracking-wider">
                PG-36
              </span>
            </div>

            {/* 3. Rubber Compression Gasket */}
            <div className="w-14 h-1 bg-slate-950 rounded-sm mt-0.5 border-t border-slate-800" />

            {/* 4. 4 Insulated Conductor Breakouts entering the pricing meter */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded bg-slate-950/80 border border-slate-800 shadow-inner">
              <div className="flex flex-col items-center">
                <span className="w-2 h-3 rounded-t-sm bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-red-400">L1</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-2 h-3 rounded-t-sm bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-amber-400">L2</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-2 h-3 rounded-t-sm bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-sky-400">L3</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-2 h-3 rounded-t-sm bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-cyan-300">N</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[#8a8775]" />

          {/* Right Tag */}
          <div className="hidden sm:flex flex-col text-start font-mono text-[10px] text-slate-900 leading-tight">
            <span className="font-bold">PROJECT TARIFF METER</span>
            <span className="text-slate-800">PAY-PER-PROJECT</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PRICING ENCLOSURE FRAME: RAL 7032 INDUSTRIAL HOUSING - OVERLAPS GLANDS
      ========================================================================= */}
      <div className="relative z-20 rounded-3xl p-4 sm:p-7 md:p-10 bg-gradient-to-b from-[#b8b5a0] via-[#aba792] to-[#999580] border-4 border-[#d5d2bf] shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.4)]">
        {/* Metal Corner Fasteners */}
        <div className="pointer-events-none absolute top-3 left-3 w-3.5 h-3.5 rounded-full bg-[#8f8c79] border border-[#d5d2bf] shadow-inner flex items-center justify-center">
          <div className="w-2 h-0.5 bg-[#4a483d]" />
        </div>
        <div className="pointer-events-none absolute top-3 right-3 w-3.5 h-3.5 rounded-full bg-[#8f8c79] border border-[#d5d2bf] shadow-inner flex items-center justify-center">
          <div className="w-2 h-0.5 bg-[#4a483d]" />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 w-3.5 h-3.5 rounded-full bg-[#8f8c79] border border-[#d5d2bf] shadow-inner flex items-center justify-center">
          <div className="w-2 h-0.5 bg-[#4a483d]" />
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 w-3.5 h-3.5 rounded-full bg-[#8f8c79] border border-[#d5d2bf] shadow-inner flex items-center justify-center">
          <div className="w-2 h-0.5 bg-[#4a483d]" />
        </div>

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
                PER-PROJECT PRICING
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-300 font-mono text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{t('pricing.noSubscription', 'Zero Recurring Fees • Pay Per Job')}</span>
          </div>
        </div>

        {/* Inner Glass Display Panel */}
        <div className="relative rounded-2xl border-2 border-slate-700/80 bg-slate-950/90 backdrop-blur-xl p-5 sm:p-8 shadow-[inset_0_4px_25px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Glass diagonal specular sheen */}
          <div
            className="pointer-events-none absolute inset-0 z-20 opacity-30"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.03) 60%, rgba(255,255,255,0) 100%)',
            }}
          />

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
              <Badge variant="glow" className="mb-3.5 px-3 py-1 text-xs inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                {t('pricing.badge', 'Simple Pay-Per-Project Pricing')}
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                {t('pricing.headingPrefix', 'Pay As You Build')} &mdash;{' '}
                <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
                  {t('pricing.headingSuffix', 'No Monthly Lock-in')}
                </span>
              </h2>
              <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                {t(
                  'pricing.subheading',
                  'Start with a 100% free one-time trial. Enjoy an 80% launch discount on your first full-scale project ($20), then a flat $100 per project with lifetime access.'
                )}
              </p>
            </div>

            {/* 2-Section Grid: Free Trial (Col 1) + Merged Full Project (Cols 2 & 3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
              
              {/* =========================================================================
                  1. FREE TRIAL TIER (1 Column)
              ========================================================================= */}
              <motion.div
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex"
              >
                <Card className="flex-1 flex flex-col justify-between rounded-2xl border-white/10 bg-slate-900/70 backdrop-blur-md hover:border-slate-700 transition-all shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                        <Layers className="w-5 h-5" />
                      </div>
                      <Badge variant="outline" className="text-[11px] font-mono border-slate-700 text-slate-400">
                        {t('pricing.freeTrial.badge', 'One-Time Trial')}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl font-bold text-white">
                      {t('pricing.freeTrial.title', 'Free Starter Trial')}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      {t('pricing.freeTrial.desc', 'Test-drive the engine on a sample residential project.')}
                    </CardDescription>

                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl sm:text-5xl font-black text-white font-mono">$0</span>
                        <span className="text-xs text-slate-400 font-mono">/ {t('pricing.project', 'project')}</span>
                      </div>
                      <p className="text-[11px] text-emerald-400 font-medium mt-1">
                        {t('pricing.freeTrial.cardNote', 'No credit card required')}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 py-2 flex-1">
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                      {t('pricing.includedScope', 'Included Scope:')}
                    </div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>1 Project</strong> ({t('pricing.freeTrial.limitProjects', 'One-time trial allocation')})</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>1 Building</strong> &amp; <strong>up to 2 Floors</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{t('pricing.freeTrial.feature1', 'Apartment templates & floor load calculator')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{t('pricing.freeTrial.feature2', 'Connected load & demand diversity engine')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{t('pricing.freeTrial.feature3', 'Cable sizing & voltage drop calculations')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{t('pricing.freeTrial.feature4', 'Single Line Diagram (SLD) interactive preview')}</span>
                      </li>
                    </ul>
                  </CardContent>

                  <CardFooter className="pt-4 border-t border-slate-800/80">
                    <Link href="/dashboard" className="w-full">
                      <Button variant="outline" className="w-full gap-2 text-xs font-semibold border-slate-700 hover:bg-slate-800">
                        <span>{t('pricing.freeTrial.cta', 'Start Free Trial')}</span>
                        {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>

              {/* =========================================================================
                  2. FULL ENGINEERING PROJECT (Merged Section: Spans 2 Columns)
                  - Flawlessly aligned, fully bounded layout (Zero overflow on any screen)
              ========================================================================= */}
              <motion.div
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex lg:col-span-2 relative min-w-0"
              >
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 opacity-70 blur-md pointer-events-none" />
                <Card className="relative flex-1 flex flex-col justify-between rounded-2xl border-2 border-orange-500/60 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 shadow-[0_0_40px_rgba(234,88,12,0.25)] p-5 sm:p-7 md:p-8 overflow-hidden w-full">
                  <div className="min-w-0">
                    {/* Header Row: Title & Clean Integrated Price Block */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-orange-500/20">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                            <Zap className="w-4 h-4" />
                          </div>
                          <Badge variant="glow" className="text-xs font-mono">
                            {t('pricing.fullProject.tag', 'Full Engineering Suite')}
                          </Badge>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                          {t('pricing.fullProject.title', 'Full Engineering Project')}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed max-w-xl">
                          {t(
                            'pricing.fullProject.desc',
                            'Complete industrial calculations, breaker coordination, SLD risers, and submission-ready PDF packages.'
                          )}
                        </p>
                      </div>

                      {/* PROMINENT PRICE DISPLAY (Clean, bounded, responsive) */}
                      <div className="w-full xl:w-auto xl:min-w-[280px] bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-slate-950/90 border border-orange-500/40 rounded-2xl p-4 sm:p-5 shadow-lg">
                        {/* 1st Project Promo Heading with 80% OFF Badge */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-orange-300">
                            {t('pricing.fullProject.firstProjectHeader', '1st Full Project Promo')}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-sm animate-pulse">
                            80% OFF
                          </span>
                        </div>

                        {/* Large $20 Hero Price with $100 Strikethrough */}
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 font-mono tracking-tight">
                            $20
                          </span>
                          <span className="text-xl sm:text-2xl text-slate-500 line-through font-mono font-bold">
                            $100
                          </span>
                          <span className="text-xs text-orange-200/80 font-mono">
                            / {t('pricing.firstProject', 'first project')}
                          </span>
                        </div>

                        {/* Standard Price After Notice */}
                        <div className="mt-2.5 pt-2 border-t border-orange-500/20 text-[11px] text-slate-300 font-mono flex items-center justify-between gap-2">
                          <span className="text-slate-400">{t('pricing.fullProject.standardAfter', 'Standard price after:')}</span>
                          <span className="text-white font-bold">$100 / project</span>
                        </div>
                      </div>
                    </div>

                    {/* Launch Special Highlight Strip */}
                    <div className="mt-5 p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/15 border border-orange-500/30 flex items-center gap-3 shadow-inner">
                      <div className="w-8 h-8 rounded-lg bg-orange-500 text-slate-950 flex items-center justify-center shrink-0 font-black text-sm">
                        $20
                      </div>
                      <div className="min-w-0 text-xs sm:text-sm text-slate-200 leading-snug">
                        <strong className="text-white font-bold">{t('pricing.fullProject.discountTitle', 'Special First Full Project Launch Offer')}: </strong>
                        <span className="text-orange-200/90">{t('pricing.fullProject.discountAmount', 'Get complete unlimited access for your very first project for only $20 instead of $100.')}</span>
                      </div>
                    </div>

                    {/* Full Capabilities in 2 Sub-Columns */}
                    <div className="mt-6">
                      <div className="text-xs font-semibold text-orange-300 uppercase tracking-wider font-mono mb-3">
                        {t('pricing.everythingPlus', 'Full Unlimited Capabilities:')}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 text-xs text-slate-200">
                        {/* Column 1: Calculations & Sizing */}
                        <div className="space-y-2.5">
                          <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-orange-400" />
                            {t('pricing.fullProject.col1Title', 'Calculations & Sizing')}
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>Unlimited Buildings &amp; Multi-Level Floors</strong></span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>3-Phase Automatic Load Balancing</strong> (R-Y-B)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>IEC 60364-5-52 Cable Sizing &amp; Derating</strong></span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>Short-Circuit Withstand (kA) &amp; Thermal Stress</strong></span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>Protection Selectivity &amp; TCC Curves</strong></span>
                          </div>
                        </div>

                        {/* Column 2: Protection, SLD & Deliverables */}
                        <div className="space-y-2.5">
                          <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <FileCheck2 className="w-3.5 h-3.5 text-orange-400" />
                            {t('pricing.fullProject.col2Title', 'Protection, SLD & Reports')}
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>Smart Switchgear Catalog</strong> (MCB, MCCB, ACB)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>Interactive Vertical Riser &amp; SLD Diagrams</strong></span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>Executive Printable PDF Packages</strong> &amp; BOM</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>Multi-Building Sub-Distribution (SMDB / DB)</strong></span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <span><strong>Lifetime Project Cloud Storage</strong> &amp; Re-export</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Footer Row */}
                  <div className="mt-8 pt-6 border-t border-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{t('pricing.fullProject.footerNote', 'Pay per project • Lifetime cloud access • No monthly fees')}</span>
                    </div>

                    <Link href="/billing" className="w-full sm:w-auto">
                      <Button variant="glow" size="lg" className="w-full sm:w-auto gap-2 text-sm font-bold shadow-xl px-8 py-6">
                        <span>{t('pricing.fullProject.cta', 'Claim 1st Project for $20')}</span>
                        {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>

            </div>

            {/* Bottom Reassurance Feature Grid */}
            <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">{t('pricing.reassurance.r1Title', 'No Monthly Lock-in')}</div>
                  <div className="text-[11px] text-slate-400">{t('pricing.reassurance.r1Desc', 'Pay only when you start a project')}</div>
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
