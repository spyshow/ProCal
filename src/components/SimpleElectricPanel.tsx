'use client';

import React from 'react';
import { Zap, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface SimpleElectricPanelProps {
  children: React.ReactNode;
}

export function SimpleElectricPanel({ children }: SimpleElectricPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="relative w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 select-none">
      {/* =========================================================================
          TOP PG-48 CABLE GLAND ASSEMBLY (MOUNTED BEHIND / UNDER TOP PANEL LIP)
      ========================================================================= */}
      <div className="relative z-0 flex items-center justify-center -mb-4">
        <div className="flex items-center gap-3 sm:gap-6 px-5 sm:px-8 py-2 rounded-t-2xl bg-gradient-to-b from-[#b8b5a0] to-[#a3a08c] border-t-2 border-x-2 border-[#d5d2bf] shadow-[0_-6px_25px_rgba(0,0,0,0.6)]">
          {/* Left Specification Tag */}
          <div className="hidden sm:flex flex-col text-end font-mono text-[10px] text-slate-900 leading-tight">
            <span className="font-bold">INCOMER FEEDER</span>
            <span className="text-slate-700">NYY-J 4x240 mm²</span>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[#8a8775]" />

          {/* DEAD-CENTER PG-48 GLAND & CABLE ENTRY */}
          <div className="flex flex-col items-center">
            {/* 1. Top Cable Seal Entry Boot (Cable lands directly here!) */}
            <div
              id="pg48-cable-inlet"
              className="w-7 h-3 bg-slate-950 rounded-t-md border-t border-x border-slate-700 shadow-inner flex items-center justify-center -mb-0.5"
            />

            {/* 2. Nickel-Plated Brass Hexagonal PG-48 Body */}
            <div className="relative z-10 px-3.5 py-1 rounded bg-gradient-to-b from-amber-200 via-amber-400 to-yellow-600 border border-yellow-200 shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-center">
              <span className="text-[11px] font-mono font-black text-slate-950 tracking-wider">
                PG-48
              </span>
            </div>

            {/* 3. Rubber Compression Gasket */}
            <div className="w-14 h-1 bg-slate-950 rounded-sm mt-0.5 border-t border-slate-800" />

            {/* 4. 4 Insulated Conductor Breakouts entering into the panel */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded bg-slate-950/80 border border-slate-800 shadow-inner">
              {/* L1 (Brown / Red) */}
              <div className="flex flex-col items-center">
                <span className="w-2 h-3.5 rounded-t-sm bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-red-400">L1</span>
              </div>
              {/* L2 (Black / Amber) */}
              <div className="flex flex-col items-center">
                <span className="w-2 h-3.5 rounded-t-sm bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-amber-400">L2</span>
              </div>
              {/* L3 (Grey / Blue) */}
              <div className="flex flex-col items-center">
                <span className="w-2 h-3.5 rounded-t-sm bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-sky-400">L3</span>
              </div>
              {/* Neutral N (Cyan) */}
              <div className="flex flex-col items-center">
                <span className="w-2 h-3.5 rounded-t-sm bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] animate-pulse" />
                <span className="text-[7px] font-mono font-bold text-cyan-300">N</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[#8a8775]" />

          {/* Right Specification Tag */}
          <div className="hidden sm:flex flex-col text-start font-mono text-[10px] text-slate-900 leading-tight">
            <span className="font-bold">400V 3P+N</span>
            <span className="text-slate-700">GLAND: IP68 BRASS</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN ENCLOSURE FRAME: RAL 7032 (PEBBLE GREY / KIESELGRAU) - OVERLAPS GLANDS
      ========================================================================= */}
      <div className="relative z-20 rounded-3xl p-3 sm:p-5 bg-gradient-to-b from-[#b8b5a0] via-[#aba792] to-[#999580] border-4 border-[#d5d2bf] shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.4)]">
        {/* Left Side Industrial Heavy Door Hinges */}
        <div className="pointer-events-none absolute top-20 -left-2 w-3.5 h-12 bg-gradient-to-r from-slate-700 to-slate-900 rounded-l border-y border-l border-slate-600 shadow-md" />
        <div className="pointer-events-none absolute bottom-20 -left-2 w-3.5 h-12 bg-gradient-to-r from-slate-700 to-slate-900 rounded-l border-y border-l border-slate-600 shadow-md" />

        {/* =========================================================================
            LEFT-SIDE PG-36 OUTLET ASSEMBLY (MOUNTED ON LEFT FLANK / RED AREA)
        ========================================================================= */}
        <div className="absolute -left-12 sm:-left-20 md:-left-24 bottom-24 sm:bottom-32 z-0 flex items-center">
          <div className="flex flex-col items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-l-2xl bg-gradient-to-r from-[#8f8b78] via-[#9e9a85] to-[#aba792] border-y-2 border-l-2 border-[#d5d2bf] shadow-[-12px_12px_30px_rgba(0,0,0,0.7)]">
            {/* Specification Header Tag */}
            <div className="flex flex-col items-center text-center font-mono text-[9px] sm:text-[10px] text-slate-950 font-bold leading-tight">
              <span className="tracking-wider">FEEDER OUT</span>
              <span className="text-[8px] text-slate-800 font-normal">NYY-J 4x35</span>
            </div>

            {/* 4 Conductor Breakouts */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-800 shadow-inner">
              <div className="flex flex-col items-center">
                <span className="w-1.5 h-3 rounded-b-sm bg-red-600 shadow-[0_0_6px_rgba(239,68,68,0.9)] animate-pulse" />
                <span className="text-[6px] font-mono font-bold text-red-400">L1</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-1.5 h-3 rounded-b-sm bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.9)] animate-pulse" />
                <span className="text-[6px] font-mono font-bold text-amber-400">L2</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-1.5 h-3 rounded-b-sm bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.9)] animate-pulse" />
                <span className="text-[6px] font-mono font-bold text-sky-400">L3</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-1.5 h-3 rounded-b-sm bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.9)] animate-pulse" />
                <span className="text-[6px] font-mono font-bold text-cyan-300">N</span>
              </div>
            </div>

            {/* Rubber Compression Gasket */}
            <div className="w-11 h-0.5 bg-slate-950 rounded-sm border-b border-slate-800" />

            {/* Nickel-Plated Brass Hexagonal PG-36 Body */}
            <div className="px-2.5 py-0.5 rounded bg-gradient-to-b from-amber-200 via-amber-400 to-yellow-600 border border-yellow-200 shadow-[0_0_12px_rgba(245,158,11,0.5)] flex items-center justify-center">
              <span className="text-[9px] sm:text-[10px] font-mono font-black text-slate-950 tracking-wider">
                PG-36
              </span>
            </div>

            {/* Bottom Cable Exit Boot with Anchor ID */}
            <div
              id="panel-cable-outlet"
              className="w-6 h-3 bg-slate-950 rounded-b-md border-b border-x border-slate-700 shadow-inner flex items-center justify-center -mt-0.5"
            />
          </div>
        </div>

        {/* Right Side Quarter-Turn Safety Door Latch */}
        <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -right-2 w-3.5 h-14 bg-gradient-to-l from-slate-700 to-slate-900 rounded-r border-y border-r border-slate-600 shadow-md flex items-center justify-center">
          <div className="w-1.5 h-4 bg-slate-400 rounded-full" />
        </div>

        {/* Metallic Corner Screws on the RAL-7032 Enclosure */}
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

        {/* Top Fascia Tag & Phase Pilot Indicator Lights */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 mb-3 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="font-mono font-bold text-white tracking-wide text-xs">
                MAIN DISTRIBUTION BOARD (MDB)
              </span>
              <span className="ms-2 px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-[#c4c1ae] border border-[#8a8775]">
                RAL-7032 ENCLOSURE
              </span>
            </div>
          </div>

          {/* Phase Pilot Lamps (L1, L2, L3) with subtle electrical glow */}
          <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400">Phase:</span>
            {/* L1 */}
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-red-400">L1</span>
            </div>
            {/* L2 */}
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-amber-400">L2</span>
            </div>
            {/* L3 */}
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.9)] animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-sky-400">L3</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            TEMPERED GLASS VIEWING DOOR (SICHTFENSTER)
            - Transparent smoked glass pane through which the user sees the section!
        ========================================================================= */}
        <div className="relative rounded-2xl border-2 border-slate-700/80 bg-slate-950/85 backdrop-blur-xl p-5 sm:p-8 shadow-[inset_0_4px_25px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Specular Diagonal Glass Reflection Sheen */}
          <div
            className="pointer-events-none absolute inset-0 z-20 opacity-35"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0) 100%)',
            }}
          />

          {/* Rubber Gasket Seal Inner Border */}
          <div className="pointer-events-none absolute inset-1 rounded-xl border border-slate-800/60 z-20" />

          {/* Content inside the Glass Door (Precision Electrical Engineering Section) */}
          <div className="relative z-10">
            {children}
          </div>
        </div>

        {/* Bottom Panel Nameplate & Safety Rating */}
        <div className="relative z-20 mt-3 pt-2 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-900 font-semibold px-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-700" />
            <span>PROTECTION DEGREE: IP54 / IK10 • FORM 4b</span>
          </div>

          <div className="flex items-center gap-1 text-slate-900">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
            <span>IEC 61439-2 LOW VOLTAGE SWITCHGEAR</span>
          </div>
        </div>
      </div>
    </div>
  );
}
