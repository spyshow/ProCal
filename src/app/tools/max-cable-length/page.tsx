'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Zap,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Cable,
  TrendingDown,
  Info,
  CheckCircle2,
  Gauge,
  Sliders,
} from 'lucide-react';
import { calculateVoltageDrop } from '@/lib/calculations/cables';
import { CABLE_CATALOG } from '@/lib/calculations/cablesData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProCalConversionBanner from '@/components/ProCalConversionBanner';

export default function MaxCableLengthPage() {
  // Inputs
  const [loadType, setLoadType] = useState<'kW' | 'A'>('kW');
  const [powerKw, setPowerKw] = useState<number>(30);
  const [currentA, setCurrentA] = useState<number>(50);
  const [isThreePhase, setIsThreePhase] = useState<boolean>(true);
  const [voltage, setVoltage] = useState<number>(400);
  const [powerFactor, setPowerFactor] = useState<number>(0.85);

  const [maxVdPercent, setMaxVdPercent] = useState<number>(4.0);
  const [material, setMaterial] = useState<'copper' | 'aluminum'>('copper');
  const [insulation, setInsulation] = useState<'XLPE' | 'PVC'>('XLPE');

  // Target run to highlight
  const [targetDistanceM, setTargetDistanceM] = useState<number>(50);
  const [copied, setCopied] = useState<boolean>(false);

  // Synchronize voltage
  const handlePhaseChange = (threePhase: boolean) => {
    setIsThreePhase(threePhase);
    if (threePhase && voltage === 230) setVoltage(400);
    else if (!threePhase && voltage === 400) setVoltage(230);
  };

  // Calculated Ib
  const ib = useMemo(() => {
    if (loadType === 'A') return Math.max(0.1, currentA || 0.1);
    const pf = Math.min(1.0, Math.max(0.1, powerFactor || 0.85));
    const v = Math.max(10, voltage || (isThreePhase ? 400 : 230));
    const pWatts = (powerKw || 0) * 1000;
    return isThreePhase ? pWatts / (Math.sqrt(3) * v * pf) : pWatts / (v * pf);
  }, [loadType, powerKw, currentA, isThreePhase, voltage, powerFactor]);

  // Max allowable drop in volts
  const maxVdVolts = useMemo(() => {
    return ((voltage || 400) * (maxVdPercent || 4)) / 100;
  }, [voltage, maxVdPercent]);

  // Catalog filtered for material constraints (Aluminum >= 16 mm² per IEC 60364-5-52)
  const availableCables = useMemo(() => {
    const minSize = material === 'aluminum' ? 16 : 1.5;
    return CABLE_CATALOG.filter((c) => c.size >= minSize && c.size <= 300);
  }, [material]);

  // Matrix calculation for every cable size
  const matrixResults = useMemo(() => {
    return availableCables.map((cable) => {
      // 1. Get base ampacity
      const baseAmp =
        material === 'copper'
          ? isThreePhase
            ? insulation === 'XLPE'
              ? cable.copperXlpe3Ph
              : cable.copperPvc3Ph
            : insulation === 'XLPE'
            ? cable.copperXlpe1Ph
            : cable.copperPvc1Ph
          : isThreePhase
          ? insulation === 'XLPE'
            ? cable.alXlpe3Ph
            : cable.alPvc3Ph
          : insulation === 'XLPE'
          ? cable.alXlpe1Ph
          : cable.alPvc1Ph;

      const isThermalOverload = baseAmp < ib;

      // 2. Invert calculateVoltageDrop: find drop for 100m, then scale linearly
      let maxDistance = 0;
      let targetVdPercent = 0;
      let targetVdVolts = 0;

      try {
        const testDrop = calculateVoltageDrop(
          ib,
          100,
          cable.size,
          powerFactor || 0.85,
          isThreePhase,
          voltage || 400,
          1,
          material,
          insulation
        );

        if (testDrop.dropPercent > 0) {
          maxDistance = Math.floor((100 * maxVdPercent) / testDrop.dropPercent);
        }

        const targetDrop = calculateVoltageDrop(
          ib,
          targetDistanceM || 1,
          cable.size,
          powerFactor || 0.85,
          isThreePhase,
          voltage || 400,
          1,
          material,
          insulation
        );
        targetVdPercent = targetDrop.dropPercent;
        targetVdVolts = targetDrop.dropVolts;
      } catch {
        // Fallback
      }

      const isTargetCompliant = !isThermalOverload && targetVdPercent <= maxVdPercent;

      return {
        size: cable.size,
        baseAmp,
        isThermalOverload,
        maxDistance,
        targetVdPercent,
        targetVdVolts,
        isTargetCompliant,
      };
    });
  }, [
    availableCables,
    material,
    insulation,
    isThreePhase,
    ib,
    powerFactor,
    voltage,
    maxVdPercent,
    targetDistanceM,
  ]);

  // Recommended minimum cable size for target distance
  const recommendedForTarget = useMemo(() => {
    return matrixResults.find((r) => r.isTargetCompliant) || null;
  }, [matrixResults]);

  // Copy report
  const copySummaryText = useMemo(() => {
    return `--- PROCAL MAXIMUM CABLE RUN LENGTH MATRIX ---
Load: ${loadType === 'kW' ? `${powerKw} kW (PF: ${powerFactor})` : `${currentA} A`} | System: ${isThreePhase ? '3-Ph 400V' : '1-Ph 230V'}
Design Current (Ib): ${ib.toFixed(1)} A | Voltage Drop Limit: ${maxVdPercent}% (${maxVdVolts.toFixed(1)} V)
Material: ${material.toUpperCase()} | Insulation: ${insulation}
${
  recommendedForTarget
    ? `Recommended for ${targetDistanceM} m: ${recommendedForTarget.size} mm² (ΔV = ${recommendedForTarget.targetVdPercent.toFixed(2)}%, Max run = ${recommendedForTarget.maxDistance} m)`
    : ''
}

Cable Sizes & Max Lengths:
${matrixResults
  .map(
    (r) =>
      `- ${r.size.toString().padStart(3)} mm²: Max ${r.maxDistance.toString().padStart(4)} m | Base ${r.baseAmp}A ${
        r.isThermalOverload ? '[OVERLOAD]' : ''
      }`
  )
  .join('\n')}

Generated with ProCal (https://procal.app/tools/max-cable-length)`;
  }, [
    loadType,
    powerKw,
    currentA,
    powerFactor,
    isThreePhase,
    ib,
    maxVdPercent,
    maxVdVolts,
    material,
    insulation,
    recommendedForTarget,
    targetDistanceM,
    matrixResults,
  ]);

  const handleCopy = async () => {
    if (!copySummaryText) return;
    try {
      await navigator.clipboard.writeText(copySummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(234,88,12,0.3)] group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                ProCal
              </span>
              <span className="text-[10px] text-orange-400 font-mono tracking-wider uppercase -mt-1">
                Engineering Tools
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/tools" className="text-xs text-slate-400 hover:text-slate-200 transition-colors hidden sm:inline-block">
              All Tools
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white text-xs">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs shadow-lg shadow-orange-600/20">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 mb-3 text-xs">
            IEC 60364-5-52 §525 Voltage Drop Matrix
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Maximum Cable Run Length Calculator
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Find the maximum permissible distance for every cable cross-section before exceeding voltage drop limits,
            or enter your target run length to identify the minimum compliant cable size.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Inputs */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-orange-500" />
                  Circuit Load & Specifications
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Define load current, voltage, and permissible drop
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Mode toggle */}
                <div className="flex items-center justify-between p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setLoadType('kW')}
                    className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
                      loadType === 'kW'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Power (kW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoadType('A')}
                    className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
                      loadType === 'A'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Current (A)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {loadType === 'kW' ? (
                    <div>
                      <Label className="text-xs text-slate-300">Active Power (kW)</Label>
                      <Input
                        type="number"
                        min="0.1"
                        step="1"
                        value={powerKw || ''}
                        onChange={(e) => setPowerKw(parseFloat(e.target.value) || 0)}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs text-slate-300">Current Ib (A)</Label>
                      <Input
                        type="number"
                        min="0.1"
                        step="1"
                        value={currentA || ''}
                        onChange={(e) => setCurrentA(parseFloat(e.target.value) || 0)}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-slate-300">System Phase</Label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => handlePhaseChange(true)}
                        className={`py-1.5 px-2 text-xs rounded border transition-all ${
                          isThreePhase
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        3-Ph
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePhaseChange(false)}
                        className={`py-1.5 px-2 text-xs rounded border transition-all ${
                          !isThreePhase
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        1-Ph
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Power Factor</Label>
                    <Input
                      type="number"
                      min="0.5"
                      max="1.0"
                      step="0.01"
                      value={powerFactor || ''}
                      onChange={(e) => setPowerFactor(parseFloat(e.target.value) || 0.85)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Voltage (V)</Label>
                    <Input
                      type="number"
                      value={voltage || ''}
                      onChange={(e) => setVoltage(parseFloat(e.target.value) || 400)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Design Current (Ib):</span>
                  <span className="font-mono font-bold text-orange-400 text-sm">{ib.toFixed(1)} A</span>
                </div>

                {/* Voltage Drop Limit */}
                <div>
                  <Label className="text-xs text-slate-300">Max Permissible Drop (ΔV %)</Label>
                  <div className="flex gap-1.5 mt-1">
                    {[3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setMaxVdPercent(val)}
                        className={`flex-1 py-1.5 text-xs rounded border transition-all ${
                          maxVdPercent === val
                            ? 'bg-orange-600 border-orange-500 text-white font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                    <Input
                      type="number"
                      min="0.5"
                      max="15"
                      step="0.1"
                      value={maxVdPercent || ''}
                      onChange={(e) => setMaxVdPercent(parseFloat(e.target.value) || 4)}
                      className="w-20 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Conductor & Insulation */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-300">Conductor</Label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setMaterial('copper')}
                        className={`py-1.5 text-xs rounded border transition-all ${
                          material === 'copper'
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        Copper
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaterial('aluminum')}
                        className={`py-1.5 text-xs rounded border transition-all ${
                          material === 'aluminum'
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        Alum
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Insulation</Label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setInsulation('XLPE')}
                        className={`py-1.5 text-xs rounded border transition-all ${
                          insulation === 'XLPE'
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        XLPE
                      </button>
                      <button
                        type="button"
                        onClick={() => setInsulation('PVC')}
                        className={`py-1.5 text-xs rounded border transition-all ${
                          insulation === 'PVC'
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        PVC
                      </button>
                    </div>
                  </div>
                </div>

                {/* Target Distance Finder */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs text-slate-300">Target Run Distance (meters)</Label>
                    <span className="text-xs font-mono text-orange-400">{targetDistanceM} m</span>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    step="5"
                    value={targetDistanceM || ''}
                    onChange={(e) => setTargetDistanceM(parseFloat(e.target.value) || 1)}
                    className="text-xs font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Funnel Card */}
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-950/20 via-slate-900 to-slate-950 shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                    Full Riser Distribution
                  </span>
                </div>
                <CardTitle className="text-base text-white">
                  Multi-Floor Riser Voltage Drop
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-300">
                <p className="leading-relaxed text-slate-400">
                  ProCal calculates cumulative voltage drop across building risers, tap-off boxes,
                  and apartment sub-panels with diversity factors.
                </p>
                <div className="pt-2">
                  <Link href="/signup" className="block">
                    <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs shadow-lg shadow-orange-600/30 gap-2">
                      Design Full Riser in ProCal
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Matrix Table */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-2xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Cable className="w-4 h-4 text-orange-500" />
                    Maximum Permissible Length Matrix
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Matrix</span>
                      </>
                    )}
                  </Button>
                </div>
                <CardDescription className="text-xs text-slate-400">
                  Distance limit before exceeding {maxVdPercent}% ({maxVdVolts.toFixed(1)} V) voltage drop at {ib.toFixed(1)} A
                </CardDescription>

                {/* Target Distance Banner */}
                {recommendedForTarget && (
                  <div className="mt-3 p-3 rounded-lg border bg-emerald-950/30 border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        For <strong>{targetDistanceM} meters</strong>, minimum size is:{' '}
                        <strong className="text-white text-sm">{recommendedForTarget.size} mm²</strong>
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-400">
                      ΔV = {recommendedForTarget.targetVdPercent.toFixed(2)}%
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-4 p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px]">
                        <th className="py-2.5 px-4">Size (mm²)</th>
                        <th className="py-2.5 px-3">Base Iz (A)</th>
                        <th className="py-2.5 px-3">Max Run (m)</th>
                        <th className="py-2.5 px-3">Drop at {targetDistanceM}m</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {matrixResults.map((row) => {
                        const isSelected = recommendedForTarget?.size === row.size;
                        return (
                          <tr
                            key={row.size}
                            className={`transition-colors ${
                              isSelected
                                ? 'bg-orange-950/40 border-l-2 border-orange-500 font-semibold'
                                : row.isThermalOverload
                                ? 'opacity-40 hover:opacity-70'
                                : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-2.5 px-4 text-slate-200">
                              {row.size} mm²
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {row.baseAmp} A
                            </td>
                            <td className="py-2.5 px-3 font-bold text-orange-400">
                              {row.maxDistance} m
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {row.targetVdPercent.toFixed(2)}% ({row.targetVdVolts.toFixed(1)} V)
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {row.isThermalOverload ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-rose-950/60 text-rose-400 border border-rose-800/40 font-sans">
                                  Iz &lt; Ib
                                </span>
                              ) : row.targetVdPercent <= maxVdPercent ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-sans">
                                  {isSelected ? '★ Recommended' : 'Compliant'}
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-400 border border-amber-800/40 font-sans">
                                  Exceeds ΔV
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full-Width Conversion Banner */}
        <div className="mt-8">
          <ProCalConversionBanner
            toolName="Maximum Cable Run Length Matrix"
            toolType="max-cable-length"
            calculationData={{
              loadType,
              powerKw,
              currentA,
              isThreePhase,
              voltage,
              powerFactor,
              maxVdPercent,
              material,
              insulation,
              targetDistanceM,
              recommendedSize: recommendedForTarget?.size,
            }}
            headline="Manage Building-Wide Voltage Drop Distribution in ProCal"
            description="Eliminate cable sizing guesswork. ProCal balances voltage drop budgets across multi-tier distribution: from MV/LV transformer to main switchboard, sub-panels, and final circuit outlets."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 text-center text-xs text-slate-500 mt-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-slate-300 font-semibold">ProCal</span> — Low-Voltage Electrical Design, Solved.
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/tools" className="hover:text-white transition-colors">Tools</Link>
            <Link href="/tools/cable-sizer" className="hover:text-white transition-colors">Cable Sizer</Link>
            <Link href="/tools/short-circuit-calculator" className="hover:text-white transition-colors">Short Circuit</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
