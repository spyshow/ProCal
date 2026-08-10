'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Zap,
  Cable,
  CircuitBoard,
  GitBranch,
  FileText,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Maximize2,
  Compass,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '@/i18n';

interface FeatureView {
  id: string;
  titleKey: string;
  defaultTitle: string;
  category: string;
  badge: string;
  tagline: string;
  image: string;
  icon: React.ElementType;
  accent: {
    text: string;
    border: string;
    bg: string;
    glow: string;
  };
  metrics: { label: string; value: string }[];
  href: string;
}

const FEATURE_VIEWS: FeatureView[] = [
  {
    id: 'load-calc',
    titleKey: 'slideshow.loadCalc.title',
    defaultTitle: 'Building Load & Phase Balancing',
    category: 'CALCULATION ENGINE',
    badge: 'IEC 60364-5-52 / NEC',
    tagline: 'Automated 3-Phase Vector Load Balancing',
    image: '/slides/slide_load_calc.jpg',
    icon: Zap,
    accent: {
      text: 'text-orange-400',
      border: 'border-orange-500/40',
      bg: 'bg-orange-500/10',
      glow: 'rgba(234, 88, 12, 0.4)',
    },
    metrics: [
      { label: 'Demand Factor', value: '84.2%' },
      { label: 'Unbalance', value: '0.8% (Optimal)' },
      { label: 'Standard', value: 'IEC 60364' },
    ],
    href: '/calculator',
  },
  {
    id: 'sld-diagram',
    titleKey: 'slideshow.sld.title',
    defaultTitle: 'Single Line Diagram (SLD) & Risers',
    category: 'SCHEMATIC DESIGNER',
    badge: 'Real-Time Vector CAD',
    tagline: 'Multi-Floor Distribution Riser Architecture',
    image: '/slides/slide_sld_diagram.jpg',
    icon: GitBranch,
    accent: {
      text: 'text-sky-400',
      border: 'border-sky-500/40',
      bg: 'bg-sky-500/10',
      glow: 'rgba(56, 189, 248, 0.4)',
    },
    metrics: [
      { label: 'Busbar Rating', value: '1600A Cu' },
      { label: 'Feeders', value: '24 Circuits' },
      { label: 'Sync Status', value: 'Live' },
    ],
    href: '/sld',
  },
  {
    id: 'breaker-schedule',
    titleKey: 'slideshow.breaker.title',
    defaultTitle: 'Smart Breakers & TCC Selectivity',
    category: 'PROTECTION CATALOG',
    badge: 'ABB & Schneider Electric',
    tagline: 'Trip Curve Time-Current Discrimination',
    image: '/slides/slide_breaker_schedule.jpg',
    icon: CircuitBoard,
    accent: {
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-500/10',
      glow: 'rgba(16, 185, 129, 0.4)',
    },
    metrics: [
      { label: 'Short Circuit Icu', value: '50 kA' },
      { label: 'Selectivity', value: '100% Total' },
      { label: 'Trip Unit', value: 'MicroLogic 2.2' },
    ],
    href: '/breaker-schedule',
  },
  {
    id: 'cable-sizing',
    titleKey: 'slideshow.cableSizing.title',
    defaultTitle: 'Cable Schedule & Derating',
    category: 'CONDUCTOR SIZING',
    badge: 'XLPE / PVC Copper & Al',
    tagline: 'Voltage Drop & Grouping Derating Checks',
    image: '/slides/slide_cable_sizing.jpg',
    icon: Cable,
    accent: {
      text: 'text-amber-400',
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/10',
      glow: 'rgba(245, 158, 11, 0.4)',
    },
    metrics: [
      { label: 'Max Voltage Drop', value: '1.42% (Pass)' },
      { label: 'Conductor', value: '4x240 mm² XLPE' },
      { label: 'Derating', value: 'k = 0.82' },
    ],
    href: '/cable-schedule',
  },
  {
    id: 'pdf-reports',
    titleKey: 'slideshow.reports.title',
    defaultTitle: 'Executive Engineering Reports',
    category: 'SUBMISSION READY',
    badge: 'High-Res Landscape PDF',
    tagline: 'Bill of Materials & Regulatory Coversheets',
    image: '/slides/slide_pdf_reports.jpg',
    icon: FileText,
    accent: {
      text: 'text-rose-400',
      border: 'border-rose-500/40',
      bg: 'bg-rose-500/10',
      glow: 'rgba(244, 63, 94, 0.4)',
    },
    metrics: [
      { label: 'Format', value: 'ISO A3/A4' },
      { label: 'BOM Summary', value: 'Detailed' },
      { label: 'Authority Ready', value: 'Yes' },
    ],
    href: '/reports',
  },
];

export function ScrollMorph3DHero() {
  const { t, isRtl } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto morph slideshow (every 4.5 seconds unless user hovers)
  useEffect(() => {
    if (!isAutoPlaying || isHovering) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % FEATURE_VIEWS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isAutoPlaying, isHovering]);

  // Scroll perspective calculation
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate progress of container entering and crossing viewport
      const start = windowHeight;
      const end = -rect.height * 0.5;
      const current = rect.top;

      const progress = Math.max(0, Math.min(1, (start - current) / (start - end)));
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mouse Parallax movement
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  }, []);

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => {
    setIsHovering(false);
    setMousePos({ x: 0, y: 0 });
  };

  const activeFeature = FEATURE_VIEWS[activeTab];

  // Dynamic 3D transform computation:
  // Starts with pitch angle (rotateX ~16deg) at top of page and levels out to 0deg as you scroll down
  const basePitch = (1 - scrollProgress) * 16;
  const baseScale = 0.94 + scrollProgress * 0.06;
  const baseTranslateZ = (1 - scrollProgress) * -40;

  // Add subtle mouse tilt
  const tiltX = isHovering ? -mousePos.y * 12 : 0;
  const tiltY = isHovering ? mousePos.x * 12 : 0;

  const cardTransform = `
    perspective(1200px)
    rotateX(${basePitch + tiltX}deg)
    rotateY(${tiltY}deg)
    scale3d(${baseScale}, ${baseScale}, 1)
    translateZ(${baseTranslateZ}px)
  `;

  // Dynamic specular sheen reflection position
  const sheenX = isHovering ? 50 + mousePos.x * 60 : 50;
  const sheenY = isHovering ? 50 + mousePos.y * 60 : 30;

  return (
    <div ref={containerRef} className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 select-none">
      {/* Dynamic Background Glow reacting to active feature color */}
      <div
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-[700px] h-[450px] blur-[130px] rounded-full transition-all duration-700 opacity-60"
        style={{ backgroundColor: activeFeature.accent.glow }}
      />

      {/* View Switcher Chips Navigation */}
      <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 mb-6">
        {FEATURE_VIEWS.map((feature, idx) => {
          const Icon = feature.icon;
          const isActive = idx === activeTab;
          return (
            <button
              key={feature.id}
              onClick={() => {
                setActiveTab(idx);
                setIsAutoPlaying(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300 backdrop-blur-md cursor-pointer ${
                isActive
                  ? `bg-slate-900 border ${feature.accent.border} ${feature.accent.text} shadow-[0_0_20px_${feature.accent.glow}] scale-105`
                  : 'bg-slate-950/70 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t(feature.titleKey, feature.defaultTitle)}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor] animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* 3D Morphing Card Container */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: cardTransform,
          transition: isHovering ? 'transform 0.1s ease-out' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transformStyle: 'preserve-3d',
        }}
        className="relative rounded-2xl border border-white/15 bg-slate-950/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden group backdrop-blur-xl"
      >
        {/* Specular Light Sheen Highlight */}
        <div
          className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-300 opacity-60 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle 500px at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.08), transparent 70%)`,
          }}
        />

        {/* Mac OS / Engineering Browser Window Top Bar */}
        <div className="relative z-20 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-400/40" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-400/40" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-400/40" />
            <span className="ms-2 text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <span className="text-slate-600">https://</span>
              <span className="text-slate-300">procal.app/{activeFeature.id}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${activeFeature.accent.bg} ${activeFeature.accent.text} border ${activeFeature.accent.border}`}>
              {activeFeature.badge}
            </span>
            <Link
              href={activeFeature.href}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-orange-400 transition-colors ps-2"
            >
              <span>{t('landing.openModule', 'Open Module')}</span>
              {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </Link>
          </div>
        </div>

        {/* Photo Viewport with Layered Crossfade Morph */}
        <div className="relative aspect-[16/9] w-full bg-slate-950 overflow-hidden">
          {FEATURE_VIEWS.map((feature, index) => {
            const isSelected = index === activeTab;
            return (
              <div
                key={feature.id}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                  isSelected
                    ? 'opacity-100 scale-100 blur-0 z-10'
                    : 'opacity-0 scale-105 blur-sm pointer-events-none z-0'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={feature.image}
                  alt={feature.defaultTitle}
                  className="w-full h-full object-cover object-top"
                  loading={index === 0 ? "eager" : "lazy"}
                />

                {/* Subtle dark vignette gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/20" />
              </div>
            );
          })}

          {/* Floating 3D Telemetry HUD (Elevated in Z Space) */}
          <div
            style={{ transform: 'translateZ(30px)' }}
            className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/85 border border-white/10 backdrop-blur-xl shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${activeFeature.accent.bg} border ${activeFeature.accent.border} flex items-center justify-center ${activeFeature.accent.text} shrink-0`}>
                <activeFeature.icon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  {activeFeature.category}
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                  {t(activeFeature.titleKey, activeFeature.defaultTitle)}
                </h4>
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="flex items-center gap-2 sm:gap-4 font-mono text-[11px]">
              {activeFeature.metrics.map((metric, i) => (
                <div key={i} className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-1.5">
                  <span className="text-slate-500 text-[10px]">{metric.label}:</span>
                  <span className="text-slate-200 font-semibold">{metric.value}</span>
                </div>
              ))}
            </div>

            <Link
              href={activeFeature.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-md transition-all shrink-0 flex items-center gap-1.5`}
            >
              <span>{t('landing.tryInteractive', 'Try Live')}</span>
              {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </Link>
          </div>
        </div>

        {/* Bottom Interactive Progress Bar */}
        <div className="relative z-20 h-1 w-full bg-slate-900">
          <div
            className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 transition-all duration-300"
            style={{
              width: `${((activeTab + 1) / FEATURE_VIEWS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Floating 3D Pill Callouts */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 shadow-sm">
          <Compass className="w-3.5 h-3.5 text-orange-400" />
          <span>{t('landing.scrollTiltNote', 'Scroll down to level the 3D perspective • Hover to tilt')}</span>
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 shadow-sm">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>{t('landing.layersNote', '5 Synchronized Electrical Calculation Modules')}</span>
        </span>
      </div>
    </div>
  );
}
