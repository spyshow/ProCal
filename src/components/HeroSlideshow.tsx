"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import {
  Zap,
  Cable,
  GitBranch,
  CircuitBoard,
  FileText,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Maximize2,
  X,
  Activity,
  Layers,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";

import slideLoadCalc from "../../public/slides/slide_load_calc.jpg";
import slideCableSizing from "../../public/slides/slide_cable_sizing.jpg";
import slideSldDiagram from "../../public/slides/slide_sld_diagram.jpg";
import slideBreakerSchedule from "../../public/slides/slide_breaker_schedule.jpg";
import slidePdfReports from "../../public/slides/slide_pdf_reports.jpg";

interface SlideData {
  id: string;
  title: string;
  tabLabel: string;
  badge: string;
  tagline: string;
  description: string;
  highlights: string[];
  icon: React.ElementType;
  accentColor: string;
  accentBorder: string;
  accentBg: string;
  image: StaticImageData | string;
  href: string;
  ctaText: string;
  fallbackIcon: React.ElementType;
}

export function HeroSlideshow() {
  const { t, isRtl } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [modalImage, setModalImage] = useState<StaticImageData | string | null>(null);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});

  const slides: SlideData[] = useMemo(
    () => [
      {
        id: "load-calc",
        title: t("slideshow.loadCalc.title", "Building Load & Phase Balancing"),
        tabLabel: t("slideshow.loadCalc.tab", "Building Load"),
        badge: t("slideshow.loadCalc.badge", "IEC 60364 / NEC Compliant"),
        tagline: t("slideshow.loadCalc.tagline", "Total Load Demand & Diversity Engine"),
        description: t(
          "slideshow.loadCalc.description",
          "Calculate connected and diversified power across complex multi-floor structures. Automatically balance loads across R-Y-B phases with real-time total kVA and current demand updates."
        ),
        highlights: [
          t("slideshow.loadCalc.h1", "Multi-building & multi-room load breakdown"),
          t("slideshow.loadCalc.h2", "Automatic 3-Phase balancing (Phase R, Y, B)"),
          t("slideshow.loadCalc.h3", "Standard demand & diversity factor presets"),
        ],
        icon: Zap,
        accentColor: "text-orange-400",
        accentBorder: "border-orange-500/40",
        accentBg: "bg-orange-500/10",
        image: slideLoadCalc,
        href: "/calculator",
        ctaText: t("slideshow.loadCalc.cta", "Launch Load Calculator"),
        fallbackIcon: Activity,
      },
      {
        id: "cable-sizing",
        title: t("slideshow.cableSizing.title", "Cable Schedule & Voltage Drop Sizing"),
        tabLabel: t("slideshow.cableSizing.tab", "Cable Schedule"),
        badge: t("slideshow.cableSizing.badge", "Automated Conductor Sizing"),
        tagline: t("slideshow.cableSizing.tagline", "Ampacity & Voltage Loss Validation"),
        description: t(
          "slideshow.cableSizing.description",
          "Automate conductor sizing, insulation selection, and derating factors. Validates allowable voltage drop percentages for feeder and branch circuits automatically."
        ),
        highlights: [
          t("slideshow.cableSizing.h1", "XLPE & PVC insulation ampacity calculations"),
          t("slideshow.cableSizing.h2", "Parallel run conductor load distribution"),
          t("slideshow.cableSizing.h3", "Exact voltage drop % & thermal stress limits"),
        ],
        icon: Cable,
        accentColor: "text-amber-400",
        accentBorder: "border-amber-500/40",
        accentBg: "bg-amber-500/10",
        image: slideCableSizing,
        href: "/cable-schedule",
        ctaText: t("slideshow.cableSizing.cta", "Open Cable Schedule"),
        fallbackIcon: Layers,
      },
      {
        id: "sld-diagram",
        title: t("slideshow.sldDiagram.title", "Interactive Single Line Diagrams (SLD)"),
        tabLabel: t("slideshow.sldDiagram.tab", "Interactive Single Line Diagrams (SLD)"),
        badge: t("slideshow.sldDiagram.badge", "Auto Schematic Canvas"),
        tagline: t("slideshow.sldDiagram.tagline", "Dynamic Riser & Switchboard Generation"),
        description: t(
          "slideshow.sldDiagram.description",
          "Convert load schedules into high-resolution single line diagrams and building vertical risers linked directly to circuit protection parameters and busbars."
        ),
        highlights: [
          t("slideshow.sldDiagram.h1", "Automated Main Switchboard (MSB) layout"),
          t("slideshow.sldDiagram.h2", "Multi-level building vertical riser tree"),
          t("slideshow.sldDiagram.h3", "Real-time schematic updates from schedule data"),
        ],
        icon: GitBranch,
        accentColor: "text-sky-400",
        accentBorder: "border-sky-500/40",
        accentBg: "bg-sky-500/10",
        image: slideSldDiagram,
        href: "/sld",
        ctaText: t("slideshow.sldDiagram.cta", "Open SLD Designer"),
        fallbackIcon: GitBranch,
      },
      {
        id: "breaker-schedule",
        title: t("slideshow.breakerSchedule.title", "Circuit Breaker & Protection Selection"),
        tabLabel: t("slideshow.breakerSchedule.tab", "Circuit Breaker"),
        badge: t("slideshow.breakerSchedule.badge", "Smart Switchgear Catalog"),
        tagline: t("slideshow.breakerSchedule.tagline", "MCCB, MCB & ACB Protection Matching"),
        description: t(
          "slideshow.breakerSchedule.description",
          "Match protection devices against calculated short circuit currents (kA). Select exact trip frame sizes, breaking capacities, and thermal-magnetic trip curves."
        ),
        highlights: [
          t("slideshow.breakerSchedule.h1", "MCCB, MCB, ACB, and ELCB/RCD catalog match"),
          t("slideshow.breakerSchedule.h2", "Short-circuit breaking capacity (Icu / Ics) check"),
          t("slideshow.breakerSchedule.h3", "Custom trip setting and frame size selection"),
        ],
        icon: CircuitBoard,
        accentColor: "text-emerald-400",
        accentBorder: "border-emerald-500/40",
        accentBg: "bg-emerald-500/10",
        image: slideBreakerSchedule,
        href: "/breaker-schedule",
        ctaText: t("slideshow.breakerSchedule.cta", "View Protection Catalog"),
        fallbackIcon: ShieldCheck,
      },
      {
        id: "pdf-reports",
        title: t("slideshow.pdfReports.title", "Printable PDF Reports & Bill of Materials"),
        tabLabel: t("slideshow.pdfReports.tab", "Printable PDF Reports"),
        badge: t("slideshow.pdfReports.badge", "Executive Export Ready"),
        tagline: t("slideshow.pdfReports.tagline", "Professional Engineering Submissions"),
        description: t(
          "slideshow.pdfReports.description",
          "Generate submission-ready PDF packages including calculation covers, schedule tables, bill of materials (BOM), and high-resolution SLD diagrams in seconds."
        ),
        highlights: [
          t("slideshow.pdfReports.h1", "Customizable project cover page & approval stamps"),
          t("slideshow.pdfReports.h2", "Detailed Bill of Materials (BOM) export"),
          t("slideshow.pdfReports.h3", "Printable high-res vector PDF diagrams & schedules"),
        ],
        icon: FileText,
        accentColor: "text-rose-400",
        accentBorder: "border-rose-500/40",
        accentBg: "bg-rose-500/10",
        image: slidePdfReports,
        href: "/reports",
        ctaText: t("slideshow.pdfReports.cta", "Generate PDF Reports"),
        fallbackIcon: BarChart3,
      },
    ],
    [t]
  );

  const activeSlide = slides[activeIndex] || slides[0];

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!isPlaying || isHovered) return;
    const timer = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(timer);
  }, [isPlaying, isHovered, handleNext]);

  const hasError = imageError[activeSlide.id];

  return (
    <section className="relative my-8 md:my-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header Title */}
      <div className="text-center mb-8">
        <Badge variant="glow" className="mb-3.5 px-3 py-1 text-xs inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange-400 inline animate-spin" />
          {t("slideshow.badge", "Interactive Feature Showcase")}
        </Badge>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          {t("slideshow.heading", "Explore ProCal in Action")}
        </h2>
        <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-2xl mx-auto">
          {t(
            "slideshow.subheading",
            "Click through the core functions below to see how ProCal streamlines complex electrical design tasks."
          )}
        </p>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 pt-1 no-scrollbar mb-6">
        {slides.map((slide, idx) => {
          const Icon = slide.icon;
          const isActive = idx === activeIndex;
          return (
            <button
              key={slide.id}
              onClick={() => setActiveIndex(idx)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-300 whitespace-nowrap cursor-pointer ${
                isActive
                  ? `bg-slate-900 border ${slide.accentBorder} text-white shadow-[0_0_20px_rgba(234,88,12,0.2)] scale-[1.02]`
                  : "bg-slate-950/60 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isActive ? slide.accentBg : "bg-slate-900"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? slide.accentColor : "text-slate-400"}`} />
              </div>
              <span>{slide.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Main Slideshow Container */}
      <div
        className="relative bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Background Ambient Glow */}
        <div
          className={`pointer-events-none absolute -right-20 -bottom-20 w-96 h-96 ${activeSlide.accentBg} blur-[120px] rounded-full transition-all duration-700`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Left Column: UI Mockup Visual */}
          <div className="lg:col-span-7 group relative">
            <div className="relative aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden border border-white/15 bg-slate-950 shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]">
              {!hasError ? (
                <Image
                  src={activeSlide.image}
                  alt={activeSlide.title}
                  fill
                  priority
                  unoptimized
                  onError={() => setImageError((prev) => ({ ...prev, [activeSlide.id]: true }))}
                  className="object-cover object-top transition-opacity duration-500"
                  sizes="(max-width: 1024px) 100vw, 58vw"
                />
              ) : (
                /* Fallback Rich Vector UI Container */
                <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-center relative overflow-hidden">
                  <div
                    className={`w-16 h-16 rounded-2xl ${activeSlide.accentBg} border ${activeSlide.accentBorder} flex items-center justify-center mb-4 shadow-xl animate-pulse`}
                  >
                    <activeSlide.fallbackIcon className={`w-8 h-8 ${activeSlide.accentColor}`} />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">{activeSlide.title}</h4>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">{activeSlide.tagline}</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono">
                      {activeSlide.badge}
                    </span>
                  </div>
                </div>
              )}

              {/* Floating Badge Overlay */}
              <div className="absolute top-3 start-3 sm:top-4 sm:start-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-200 shadow-lg">
                  <span className={`w-2 h-2 rounded-full ${activeSlide.accentBg} animate-ping`} />
                  {activeSlide.badge}
                </span>
              </div>

              {/* Expand Zoom Button Overlay */}
              {!hasError && (
                <button
                  onClick={() => setModalImage(activeSlide.image)}
                  className="absolute bottom-3 end-3 sm:bottom-4 sm:end-4 z-10 p-2.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/20 text-slate-300 hover:text-white hover:bg-slate-900 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                  title={t("slideshow.expandImage", "Expand Preview Image")}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Slide Info & Actions */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl ${activeSlide.accentBg} border ${activeSlide.accentBorder} flex items-center justify-center`}
                >
                  <activeSlide.icon className={`w-5 h-5 ${activeSlide.accentColor}`} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {activeSlide.tagline}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                {activeSlide.title}
              </h3>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{activeSlide.description}</p>

              {/* Key Bullet Highlights */}
              <ul className="space-y-2.5 pt-2">
                {activeSlide.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${activeSlide.accentColor}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Slide Action Button & Controls */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <Link href={activeSlide.href}>
                <Button variant="glow" size="lg" className="w-full sm:w-auto gap-2 text-sm font-semibold">
                  {activeSlide.ctaText}
                  {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              </Link>

              {/* Carousel Navigation Toolbar */}
              <div className="flex items-center justify-between sm:justify-end gap-3 text-slate-400">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={isRtl ? handleNext : handlePrev}
                    className="w-8 h-8 rounded-lg hover:bg-slate-800 hover:text-white"
                  >
                    {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-800 hover:text-white"
                    title={isPlaying ? t("slideshow.pause", "Pause Slideshow") : t("slideshow.play", "Play Slideshow")}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={isRtl ? handlePrev : handleNext}
                    className="w-8 h-8 rounded-lg hover:bg-slate-800 hover:text-white"
                  >
                    {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>

                <span className="text-xs font-mono text-slate-500" dir="ltr">
                  <span className="text-white font-bold">{String(activeIndex + 1).padStart(2, "0")}</span> /{" "}
                  {String(slides.length).padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Slide Progress Line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/60">
          <div
            className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 transition-all duration-500"
            style={{ width: `${((activeIndex + 1) / slides.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Lightbox Image Preview Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-w-5xl w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            <Image
              src={modalImage}
              alt="Expanded Slide Preview"
              fill
              unoptimized
              className="object-contain bg-slate-950"
            />
            <button
              onClick={() => setModalImage(null)}
              className="absolute top-4 end-4 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
