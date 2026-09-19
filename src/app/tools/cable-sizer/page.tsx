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
  Sliders,
  ChevronDown,
  CheckCircle2,
  FileText,
  Info,
  RefreshCw,
  Cpu,
  Layers,
  Thermometer,
  Gauge,
  HelpCircle,
  Activity,
} from 'lucide-react';
import { sizeCableAndBreaker, formatCableSize } from '@/lib/calculations/cables';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MethodSelector from '@/components/MethodSelector';
import ProCalConversionBanner from '@/components/ProCalConversionBanner';

export default function CableSizerPage() {
  // Input states
  const [loadType, setLoadType] = useState<'kW' | 'A'>('kW');
  const [powerKw, setPowerKw] = useState<number>(45);
  const [currentA, setCurrentA] = useState<number>(80);
  const [isThreePhase, setIsThreePhase] = useState<boolean>(true);
  const [voltage, setVoltage] = useState<number>(400);
  const [powerFactor, setPowerFactor] = useState<number>(0.85);

  const [lengthMeters, setLengthMeters] = useState<number>(35);
  const [maxVdPercent, setMaxVdPercent] = useState<number>(4.0);

  const [material, setMaterial] = useState<'copper' | 'aluminum'>('copper');
  const [insulation, setInsulation] = useState<'XLPE' | 'PVC'>('XLPE');
  const [installMethod, setInstallMethod] = useState<string>('C');
  const [ambientTemp, setAmbientTemp] = useState<number>(30);
  const [groupingCount, setGroupingCount] = useState<number>(1);

  const [copied, setCopied] = useState<boolean>(false);

  // Synchronize voltage when toggling phase if it's at standard default
  const handlePhaseChange = (threePhase: boolean) => {
    setIsThreePhase(threePhase);
    if (threePhase && voltage === 230) {
      setVoltage(400);
    } else if (!threePhase && voltage === 400) {
      setVoltage(230);
    }
  };

  // Calculate Design Current (Ib)
  const ib = useMemo(() => {
    if (loadType === 'A') {
      return Math.max(0.1, currentA || 0.1);
    }
    const pf = Math.min(1.0, Math.max(0.1, powerFactor || 0.85));
    const v = Math.max(10, voltage || (isThreePhase ? 400 : 230));
    const pWatts = (powerKw || 0) * 1000;
    if (isThreePhase) {
      return pWatts / (Math.sqrt(3) * v * pf);
    } else {
      return pWatts / (v * pf);
    }
  }, [loadType, powerKw, currentA, isThreePhase, voltage, powerFactor]);

  // Execute Cable Sizing calculation
  const calculationResult = useMemo(() => {
    try {
      const clampedTemp = Math.min(60, Math.max(10, ambientTemp || 30));
      const clampedGrouping = Math.max(1, groupingCount || 1);
      const clampedLength = Math.max(0.5, lengthMeters || 1);
      const clampedMaxVd = Math.max(0.1, maxVdPercent || 4);

      return sizeCableAndBreaker(ib, isThreePhase, {
        material,
        insulation,
        ambientTemp: clampedTemp,
        groupingCount: clampedGrouping,
        installMethod,
        code: 'IEC',
        voltageDrop: {
          lengthMeters: clampedLength,
          powerFactor: Math.min(1, Math.max(0.1, powerFactor || 0.85)),
          systemVoltage: voltage || (isThreePhase ? 400 : 230),
          maxPercent: clampedMaxVd,
        },
      });
    } catch (err: any) {
      return null;
    }
  }, [
    ib,
    isThreePhase,
    material,
    insulation,
    ambientTemp,
    groupingCount,
    installMethod,
    lengthMeters,
    powerFactor,
    voltage,
    maxVdPercent,
  ]);

  // Formatted copy summary
  const copySummaryText = useMemo(() => {
    if (!calculationResult) return '';
    const vdOk = (calculationResult.dropPercent ?? 0) <= maxVdPercent;
    const protOk =
      ib <= calculationResult.breakerSize &&
      calculationResult.breakerSize <= calculationResult.deratedAmpacity;

    return `--- PROCAL IEC 60364 CABLE & BREAKER SIZING ---
Load: ${loadType === 'kW' ? `${powerKw} kW (PF: ${powerFactor})` : `${currentA} A`}
System: ${isThreePhase ? '3-Phase 400V' : '1-Phase 230V'}
Design Current (Ib): ${ib.toFixed(1)} A
Circuit Length: ${lengthMeters} m

Cable Selection: ${calculationResult.formattedCableSize} (${material.toUpperCase()}, ${insulation})
Installation Method: ${installMethod}
Derated Ampacity (Iz): ${calculationResult.deratedAmpacity.toFixed(1)} A (Base: ${calculationResult.nominalAmpacity} A, kt: ${calculationResult.tempFactor.toFixed(2)}, kg: ${calculationResult.groupFactor.toFixed(2)})
Breaker Rating (In): ${calculationResult.breakerSize} A
Neutral: ${calculationResult.neutralSize} mm² | PE / Earth: ${calculationResult.earthSize} mm²
Voltage Drop: ${calculationResult.dropVolts?.toFixed(1) ?? '—'} V (${calculationResult.dropPercent?.toFixed(2) ?? '—'}%) [Limit: ${maxVdPercent}%]

Compliance:
- Overload Protection (Ib <= In <= Iz): ${protOk ? 'PASSED' : 'CHECK SETTINGS'}
- Voltage Drop (ΔV <= ΔVmax): ${vdOk ? 'PASSED' : 'EXCEEDED'}

Generated with ProCal (https://procal.app/tools/cable-sizer)`;
  }, [
    calculationResult,
    loadType,
    powerKw,
    currentA,
    powerFactor,
    isThreePhase,
    ib,
    lengthMeters,
    material,
    insulation,
    installMethod,
    maxVdPercent,
  ]);

  const handleCopy = async () => {
    if (!copySummaryText) return;
    try {
      await navigator.clipboard.writeText(copySummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  const isProtectionOk =
    calculationResult &&
    ib <= calculationResult.breakerSize &&
    calculationResult.breakerSize <= calculationResult.deratedAmpacity;

  const isVoltageDropOk =
    calculationResult && (calculationResult.dropPercent ?? 0) <= maxVdPercent;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Top Header */}
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

      {/* Hero Title */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 mb-3 text-xs">
            IEC 60364-5-52 & IEC 60364-4-43 Verified
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            IEC Cable Sizer & Breaker Selector
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Free online electrical calculator for low-voltage power cables. Automatically sizes cross-section,
            calculates derating factors ($k_t, k_g$), coordinates overcurrent protection ($I_b \le I_n \le I_z$),
            and verifies voltage drop ($\Delta V$).
          </p>
        </div>

        {/* 2-Column Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Parameter Inputs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Section 1: Electrical Load */}
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-orange-500" />
                  1. Electrical Load & System
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Specify the design load and electrical supply parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Load Mode Switcher */}
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
                    Active Power (kW)
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
                    Design Current (Amperes)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {loadType === 'kW' ? (
                    <div>
                      <Label className="text-xs text-slate-300">Active Power (kW)</Label>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={powerKw || ''}
                        onChange={(e) => setPowerKw(parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        placeholder="e.g. 45"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs text-slate-300">Design Current Ib (A)</Label>
                      <Input
                        type="number"
                        min="0.1"
                        step="1"
                        value={currentA || ''}
                        onChange={(e) => setCurrentA(parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        placeholder="e.g. 80"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-slate-300">System Phase & Voltage</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => handlePhaseChange(true)}
                        className={`py-1.5 px-2 text-xs rounded-md border font-medium transition-all ${
                          isThreePhase
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        3-Ph (400V)
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePhaseChange(false)}
                        className={`py-1.5 px-2 text-xs rounded-md border font-medium transition-all ${
                          !isThreePhase
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        1-Ph (230V)
                      </button>
                    </div>
                  </div>

                  {loadType === 'kW' && (
                    <div>
                      <div className="flex justify-between items-center">
                        <Label className="text-xs text-slate-300">Power Factor (cos φ)</Label>
                        <span className="text-xs font-mono text-orange-400">{powerFactor.toFixed(2)}</span>
                      </div>
                      <Input
                        type="number"
                        min="0.5"
                        max="1.0"
                        step="0.01"
                        value={powerFactor || ''}
                        onChange={(e) => setPowerFactor(parseFloat(e.target.value) || 0.85)}
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-slate-300">Operating Voltage (V)</Label>
                    <Input
                      type="number"
                      min="100"
                      max="1000"
                      step="5"
                      value={voltage || ''}
                      onChange={(e) => setVoltage(parseFloat(e.target.value) || 400)}
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Calculated Design Current (Ib):</span>
                  <span className="font-mono font-bold text-orange-400 text-sm">{ib.toFixed(1)} A</span>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Cable Run & Voltage Drop Constraint */}
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-500" />
                  2. Route Length & Voltage Drop Limit
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  IEC 60364-5-52 §525 limits: 3% for lighting, 5% for other uses
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-300">Cable Route Length (meters)</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={lengthMeters || ''}
                      onChange={(e) => setLengthMeters(parseFloat(e.target.value) || 1)}
                      className="mt-1"
                      placeholder="e.g. 35"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Max Allowable Drop (ΔV %)</Label>
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
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Installation & Environmental Conditions */}
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-orange-500" />
                  3. Cable Specification & Installation
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Installation method and ambient correction factors per IEC 60364-5-52
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Conductor Material */}
                  <div>
                    <Label className="text-xs text-slate-300">Conductor Material</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setMaterial('copper')}
                        className={`py-1.5 px-3 text-xs rounded-md border font-medium transition-all ${
                          material === 'copper'
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Copper (Cu)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaterial('aluminum')}
                        className={`py-1.5 px-3 text-xs rounded-md border font-medium transition-all ${
                          material === 'aluminum'
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Aluminum (Al)
                      </button>
                    </div>
                  </div>

                  {/* Insulation Type */}
                  <div>
                    <Label className="text-xs text-slate-300">Insulation Material</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setInsulation('XLPE')}
                        className={`py-1.5 px-3 text-xs rounded-md border font-medium transition-all ${
                          insulation === 'XLPE'
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        XLPE (90°C)
                      </button>
                      <button
                        type="button"
                        onClick={() => setInsulation('PVC')}
                        className={`py-1.5 px-3 text-xs rounded-md border font-medium transition-all ${
                          insulation === 'PVC'
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        PVC (70°C)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Installation Method Dropdown */}
                {/* Installation Method Selector */}
                <div>
                  <Label className="text-xs text-slate-300 mb-1.5 block">
                    Installation Method (IEC 60364-5-52 Table A.52.3)
                  </Label>
                  <MethodSelector
                    value={installMethod}
                    onChange={(val) => setInstallMethod(val)}
                    standard="IEC"
                  />
                </div>

                {/* Ambient Temp & Grouping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs text-slate-300">Ambient Temp (°C)</Label>
                      <span className="text-xs font-mono text-orange-400">{ambientTemp}°C</span>
                    </div>
                    <Input
                      type="number"
                      min="10"
                      max="60"
                      value={ambientTemp || ''}
                      onChange={(e) => setAmbientTemp(parseInt(e.target.value, 10) || 30)}
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs text-slate-300">Grouping Count (Circuits)</Label>
                      <span className="text-xs font-mono text-orange-400">{groupingCount}</span>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={groupingCount || ''}
                      onChange={(e) => setGroupingCount(parseInt(e.target.value, 10) || 1)}
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Results & Engineering Verification */}
          <div className="lg:col-span-5 space-y-6">
            {calculationResult ? (
              <>
                {/* Result Card */}
                <Card className="border-orange-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 rounded-full blur-2xl pointer-events-none" />

                  <CardHeader className="pb-3 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-orange-400 uppercase tracking-wider">
                        Sizing Output
                      </span>
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
                            <span>Copy Report</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white pt-1">
                      {calculationResult.formattedCableSize}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      {material === 'copper' ? 'Copper' : 'Aluminum'} Conductor, {insulation} Insulation (Method {installMethod})
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-5">
                    {/* Compliance Badges */}
                    <div className="space-y-2">
                      <div
                        className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                          isProtectionOk
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${isProtectionOk ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <div>
                          <span className="font-semibold block">
                            {isProtectionOk ? 'Protection Coordinated (IEC 60364-4-43)' : 'Protection Warning'}
                          </span>
                          <span className="text-[11px] opacity-80 font-mono">
                            Ib ({ib.toFixed(1)} A) ≤ In ({calculationResult.breakerSize} A) ≤ Iz ({calculationResult.deratedAmpacity.toFixed(1)} A)
                          </span>
                        </div>
                      </div>

                      <div
                        className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                          isVoltageDropOk
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isVoltageDropOk ? 'text-emerald-400' : 'text-rose-400'}`} />
                        <div>
                          <span className="font-semibold block">
                            {isVoltageDropOk ? 'Voltage Drop Compliant (IEC 60364-5-52)' : 'Voltage Drop Exceeded'}
                          </span>
                          <span className="text-[11px] opacity-80 font-mono">
                            ΔV = {calculationResult.dropPercent?.toFixed(2)}% ({calculationResult.dropVolts?.toFixed(1)} V) [Max: {maxVdPercent}%]
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Engineering Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Protective Breaker (In)</span>
                        <span className="font-mono font-bold text-white text-base">
                          {calculationResult.breakerSize} A
                        </span>
                      </div>

                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Derated Ampacity (Iz)</span>
                        <span className="font-mono font-bold text-emerald-400 text-base">
                          {calculationResult.deratedAmpacity.toFixed(1)} A
                        </span>
                      </div>

                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Base Ampacity (Table)</span>
                        <span className="font-mono font-medium text-slate-200">
                          {calculationResult.nominalAmpacity} A
                        </span>
                      </div>

                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Derating Factor (k = kt × kg)</span>
                        <span className="font-mono font-medium text-slate-200">
                          {(calculationResult.tempFactor * calculationResult.groupFactor).toFixed(2)}
                          <span className="text-[10px] text-slate-500 ml-1">
                            ({calculationResult.tempFactor.toFixed(2)} × {calculationResult.groupFactor.toFixed(2)})
                          </span>
                        </span>
                      </div>

                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Neutral Conductor</span>
                        <span className="font-mono font-medium text-slate-200">
                          {calculationResult.neutralSize} mm²
                        </span>
                      </div>

                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Earth / PE (Table 54.7)</span>
                        <span className="font-mono font-medium text-slate-200">
                          {calculationResult.earthSize} mm²
                        </span>
                      </div>
                    </div>

                    {calculationResult.warnings.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-300/90 space-y-1">
                        <span className="font-semibold flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" /> Engineering Notes:
                        </span>
                        {calculationResult.warnings.map((w, idx) => (
                          <p key={idx}>{w}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400">
                <Info className="w-8 h-8 text-orange-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Please check your inputs to see calculations.</p>
              </Card>
            )}
          </div>
        </div>

        {/* Full-Width Conversion Banner */}
        {calculationResult && (
          <div className="mt-8">
            <ProCalConversionBanner
              toolName="IEC 60364 Cable & Breaker Sizer"
              toolType="cable-sizer"
              calculationData={{
                loadType,
                powerKw,
                currentA,
                isThreePhase,
                voltage,
                powerFactor,
                lengthMeters,
                material,
                insulation,
                installMethod,
                ib,
                cableSize: calculationResult.formattedCableSize,
                breakerSize: calculationResult.breakerSize,
                deratedAmpacity: calculationResult.deratedAmpacity,
                dropPercent: calculationResult.dropPercent,
              }}
              headline="Need to size an entire switchboard or multi-floor riser?"
              description="In ProCal, your cables, breakers, transformer fault levels, and diversity factors are automatically synchronized across multi-floor risers and exportable Single Line Diagrams."
            />
          </div>
        )}

        {/* Technical Explainer / SEO Guide Section */}
        <section className="mt-16 border-t border-slate-800 pt-12 max-w-4xl mx-auto space-y-8 text-slate-300 text-sm leading-relaxed">
          <div>
            <h2 className="text-xl font-bold text-white mb-3">
              How IEC 60364-5-52 Low-Voltage Cable Sizing Works
            </h2>
            <p>
              Cable sizing according to international standard <strong>IEC 60364-5-52</strong> requires
              verifying two core criteria: thermal ampacity under installation conditions, and maximum
              permissible voltage drop across the run.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-400" />
                1. Overload Protection (IEC 60364-4-43)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The continuous current rating of the protective device ($I_n$) and the cable's derated current-carrying
                capacity ($I_z$) must satisfy the fundamental coordination chain:
              </p>
              <div className="my-2 p-2 rounded bg-slate-950 font-mono text-xs text-orange-300 text-center">
                I_b ≤ I_n ≤ I_z
              </div>
              <p className="text-[11px] text-slate-400">
                Where Ib is the circuit design current, In is the nominal rating of the circuit breaker or fuse,
                and Iz = I_base × kt × kg is the effective current-carrying capacity under ambient and grouping derating.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-400" />
                2. Voltage Drop Compliance (Clause 525)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Under normal operating conditions, the voltage drop between the origin of the installation
                and the terminal equipment should not exceed standard limits:
              </p>
              <ul className="list-disc list-inside text-xs text-slate-400 my-2 space-y-1">
                <li><strong>3%</strong> for lighting installations</li>
                <li><strong>5%</strong> for general power and heating</li>
              </ul>
              <p className="text-[11px] text-slate-400">
                For long runs, the cable cross-section must often be upsized beyond the thermal $I_z$ requirement
                to prevent equipment malfunction and excessive line losses.
              </p>
            </div>
          </div>
        </section>
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
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
            <Link href="/login" className="hover:text-white transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
