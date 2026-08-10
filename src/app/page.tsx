'use client';

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  Zap,
  Cable,
  CircuitBoard,
  GitBranch,
  FileText,
  Building2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IsometricBuilding } from "@/components/IsometricBuilding";
import { NyyCablePathway } from "@/components/NyyCablePathway";
import { PricingCablePathway } from "@/components/PricingCablePathway";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { SimpleElectricPanel } from "@/components/SimpleElectricPanel";
import { PricingSection } from "@/components/PricingSection";
import { useTranslation } from "@/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";

const heroContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

const cardContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

export default function Home() {
  const { t, isRtl } = useTranslation();

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden bg-grid-pattern selection:bg-orange-500 selection:text-white">
      {/* Background Radial Glow Beams */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[500px] bg-orange-600/15 blur-[120px] rounded-full" />
      <div className="pointer-events-none absolute right-10 top-1/3 w-[400px] h-[400px] bg-amber-500/10 blur-[100px] rounded-full" />
      <div className="pointer-events-none absolute left-10 bottom-10 w-[500px] h-[400px] bg-slate-800/20 blur-[100px] rounded-full" />

      {/* NYY-F 4-Core Armored Power Cable Pathway (Spans behind Hero & Explore sections into PG-48 Gland) */}
      <NyyCablePathway />

      {/* NYY-J 4-Core Power Feeder Pathway (Spans from bottom PG-36 Gland of Panel into Pricing Module Inlet) */}
      <PricingCablePathway />

      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo Mark */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(234,88,12,0.3)] group-hover:scale-105 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"
                  fill="#ea580c"
                  stroke="#f97316"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                {t('common.appName', 'ProCal')}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  PRO
                </span>
              </span>
              <p className="text-[10px] text-slate-400 tracking-wide font-mono uppercase">
                {t('common.appTagline', 'Electrical Calculation Suite')}
              </p>
            </div>
          </Link>

          {/* Action Navigation & Top Language Switcher */}
          <div className="flex items-center gap-3">
            <a
              href="#pricing"
              className="text-xs font-semibold text-slate-300 hover:text-orange-400 transition-colors hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
            >
              <span>{t('nav.pricing', 'Pricing')}</span>
              <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 text-[10px] font-mono">$20 Deal</span>
            </a>
            <LanguageSelector variant="dropdown" />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                {t('auth.signInBtn', 'Sign In')}
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="glow" size="sm" className="gap-2">
                <span>{t('dashboard.title', 'Launch App')}</span>
                {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-16 md:pt-32 md:pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center overflow-visible">
        {/* Cable Origin Anchor Point (Under the Building Foundation / Substation Base) */}
        <div id="building-cable-origin" className="absolute right-[20%] sm:right-[26%] top-[480px] sm:top-[530px] w-4 h-4 pointer-events-none opacity-0 z-0" />

        {/* Isometric 3D Architectural Building in Hero Background */}
        <IsometricBuilding />

        <motion.div
          className="relative z-20"
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={heroItemVariants} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-medium mb-8 shadow-[0_0_15px_rgba(234,88,12,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span>{t('landing.heroBadge', 'Next-Generation Load Calculation & Electrical Design System')}</span>
          </motion.div>

          <motion.h1
            variants={heroItemVariants}
            className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1]"
          >
            {t('landing.heroTitlePrefix', 'Precision Electrical Engineering')}{" "}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
              {t('landing.heroTitleSuffix', 'Automated & Simplified')}
            </span>
          </motion.h1>

          <motion.p
            variants={heroItemVariants}
            className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed"
          >
            {t('landing.heroDesc', 'Streamline building load calculations, cable schedule sizing, breaker coordination, single-line diagrams (SLD), and professional printable PDF reports for industrial projects.')}
          </motion.p>

          {/* Hero CTAs */}
          <motion.div
            variants={heroItemVariants}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="glow" size="lg" className="w-full sm:w-auto gap-2 px-8 py-6 text-base">
                <span>{t('landing.launchApp', 'Open Engineering Dashboard')}</span>
                {isRtl ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              </Button>
            </Link>
            <Link href="/projects" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 px-8 py-6 text-base">
                <Building2 className="w-5 h-5 text-orange-400" />
                <span>{t('landing.manageProjects', 'Manage Projects')}</span>
              </Button>
            </Link>
          </motion.div>

          {/* Feature Pill Highlights */}
          <motion.div
            variants={heroItemVariants}
            className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-slate-400"
          >
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('landing.standards', 'IEC & NEC Standard Calculations')}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('landing.smartSwitchgear', 'Smart Switchgear & Protection Catalog')}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('landing.automatedRiser', 'Automated Riser & SLD Generation')}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('landing.printablePdf', 'Printable PDF Schedules')}
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* Explore ProCal in Action Section (NYY Cable flows under this section) */}
      <HeroSlideshow />

      {/* Electric Panel Enclosure with PG Gland wrapping Precision Electrical Engineering */}
      <section className="relative py-12 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20">
        <SimpleElectricPanel>
          {/* Section Header inside the Electric Panel */}
          <div className="text-center mb-12">
            <Badge variant="glow" className="mb-3">
              {t('common.appName', 'ProCal')} PRO
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {t('landing.heroTitlePrefix', 'Precision Electrical Engineering')}
            </h2>
            <p className="text-slate-400 mt-2 max-w-2xl mx-auto text-sm sm:text-base">
              {t('landing.heroDesc', 'Everything you need from preliminary load sizing to final switchboard single-line diagram output.')}
            </p>
          </div>

          {/* Feature Grid Cards inside the Electric Panel with Motion */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={cardContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <motion.div variants={cardItemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="glow-card border-white/10 bg-slate-900/60 h-full flex flex-col justify-between">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-orange-600/15 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-2">
                    <Zap className="w-6 h-6" />
                  </div>
                  <CardTitle>{t('landing.loadTitle', 'Building Load Calculator')}</CardTitle>
                  <CardDescription>
                    {t('landing.loadDesc', 'Calculate connected, demand, and diversified power requirements across complex multi-building and multi-floor structures.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/calculator" className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300">
                    <span>{t('dashboard.openCalculator', 'Launch Calculator')}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardItemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="glow-card border-white/10 bg-slate-900/60 h-full flex flex-col justify-between">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-amber-600/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
                    <Cable className="w-6 h-6" />
                  </div>
                  <CardTitle>{t('landing.cableTitle', 'Cable Sizing & Voltage Drop')}</CardTitle>
                  <CardDescription>
                    {t('landing.cableDesc', 'Automate conductor sizing, insulation selection, parallel runs, and voltage drop validation for distribution cables.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/cable-schedule" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300">
                    <span>{t('nav.cableSchedule', 'Open Cable Schedule')}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardItemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="glow-card border-white/10 bg-slate-900/60 h-full flex flex-col justify-between">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                    <CircuitBoard className="w-6 h-6" />
                  </div>
                  <CardTitle>{t('landing.breakersTitle', 'Breaker & Protection Selection')}</CardTitle>
                  <CardDescription>
                    {t('landing.breakersDesc', 'Match MCCBs, MCBs, and ACB protection devices with exact trip ratings, breaking capacities, and frame sizes.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/breaker-schedule" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                    <span>{t('nav.breakerSchedule', 'View Breakers')}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardItemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="glow-card border-white/10 bg-slate-900/60 h-full flex flex-col justify-between">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-sky-600/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-2">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <CardTitle>{t('landing.panelTitle', 'Panel & Switchboard Designer')}</CardTitle>
                  <CardDescription>
                    {t('landing.panelDesc', 'Design distribution board layouts, busbar ratings, phase balancing (R-Y-B), and spare circuit allocations.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/panel" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300">
                    <span>{t('landing.configurePanels', 'Configure Panels')}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardItemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="glow-card border-white/10 bg-slate-900/60 h-full flex flex-col justify-between">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2">
                    <GitBranch className="w-6 h-6" />
                  </div>
                  <CardTitle>{t('landing.sldTitle', 'Interactive SLD & Riser Diagrams')}</CardTitle>
                  <CardDescription>
                    {t('landing.sldDesc', 'Generate dynamic single line diagrams and vertical building riser trees automatically linked to project data.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/sld" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                    <span>{t('landing.openSld', 'Open SLD Designer')}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardItemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="glow-card border-white/10 bg-slate-900/60 h-full flex flex-col justify-between">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-rose-600/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
                    <FileText className="w-6 h-6" />
                  </div>
                  <CardTitle>{t('landing.reportsTitle', 'Printable Executive PDF Reports')}</CardTitle>
                  <CardDescription>
                    {t('landing.reportsDesc', 'Export high-resolution cover sheets, bill of materials (BOM), schedule tables, and SLD views ready for submission.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href="/reports" className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300">
                    <span>{t('landing.generateReports', 'Generate Reports')}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </SimpleElectricPanel>
      </section>

      {/* Pricing Section (NYY Feeder Cable from Electric Panel enters here via PG-36 Gland) */}
      <PricingSection />

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-bold">
              ⚡
            </div>
            <span>{t('common.appName', 'ProCal')} &copy; {new Date().getFullYear()} &mdash; {t('common.appTagline', 'Electrical Calculation Platform')}</span>
          </div>

          <div className="flex items-center gap-6">
            <LanguageSelector variant="footer" />
            <a href="#pricing" className="hover:text-white transition-colors">
              {t('nav.pricing', 'Pricing')}
            </a>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              {t('nav.dashboard', 'Dashboard')}
            </Link>
            <Link href="/projects" className="hover:text-white transition-colors">
              {t('nav.projects', 'Projects')}
            </Link>
            <Link href="/settings" className="hover:text-white transition-colors">
              {t('nav.settings', 'Settings')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
