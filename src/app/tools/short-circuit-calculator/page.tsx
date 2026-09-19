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
  Activity,
  Layers,
  Cpu,
  CheckCircle2,
  Info,
  Server,
  Cable,
  TrendingDown,
} from 'lucide-react';
import {
  calculateShortCircuitCurrent,
  calculateIscWithCable,
  type TransformerVectorGroup,
} from '@/lib/calculations/shortCircuit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProCalConversionBanner from '@/components/ProCalConversionBanner';

const STANDARD_TRANSFORMER_KVA = [250, 400, 630, 800, 1000, 1250, 1600, 2000, 2500];

const STANDARD_BREAKER_ICU = [16, 25, 36, 50, 65, 70, 85, 100, 150];

export default function ShortCircuitCalculatorPage() {
  // Transformer state
  const [ratedPowerKva, setRatedPowerKva] = useState<number>(1000);
  const [voltagePrimaryKv, setVoltagePrimaryKv] = useState<number>(11);
  const [voltageSecondaryV, setVoltageSecondaryV] = useState<number>(400);
  const [impedancePercent, setImpedancePercent] = useState<number>(6.0);
  const [vectorGroup, setVectorGroup] = useState<TransformerVectorGroup>('Dyn11');
  const [earthingSystem, setEarthingSystem] = useState<string>('TN-S');

  // Downstream feeder cable state
  const [includeCable, setIncludeCable] = useState<boolean>(false);
  const [cableLengthM, setCableLengthM] = useState<number>(25);
  const [cableSizeMm2, setCableSizeMm2] = useState<number>(240);
  const [isCopper, setIsCopper] = useState<boolean>(true);
  const [insulation, setInsulation] = useState<'XLPE' | 'PVC'>('XLPE');
  const [parallelRuns, setParallelRuns] = useState<number>(1);

  const [copied, setCopied] = useState<boolean>(false);

  // Auto-adjust impedance voltage when selecting transformer kVA
  const handleKvaSelect = (kva: number) => {
    setRatedPowerKva(kva);
    if (kva <= 630 && impedancePercent === 6.0) {
      setImpedancePercent(4.0);
    } else if (kva > 630 && impedancePercent === 4.0) {
      setImpedancePercent(6.0);
    }
  };

  // Main transformer short-circuit calculation
  const scResult = useMemo(() => {
    try {
      const kva = Math.max(10, ratedPowerKva || 1000);
      const v1 = Math.max(1, (voltagePrimaryKv || 11) * 1000);
      const v2 = Math.max(100, voltageSecondaryV || 400);
      const uk = Math.max(1, Math.min(20, impedancePercent || 6.0));

      return calculateShortCircuitCurrent({
        ratedPower: kva,
        voltagePrimary: v1,
        voltageSecondary: v2,
        impedancePercent: uk,
        vectorGroup,
        earthingSystem,
      });
    } catch {
      return null;
    }
  }, [ratedPowerKva, voltagePrimaryKv, voltageSecondaryV, impedancePercent, vectorGroup, earthingSystem]);

  // Downstream cable short-circuit calculation
  const downstreamIsc = useMemo(() => {
    if (!includeCable || !scResult) return null;
    try {
      const length = Math.max(1, cableLengthM || 1);
      const size = Math.max(1.5, cableSizeMm2 || 240);
      const runs = Math.max(1, parallelRuns || 1);

      const isc = calculateIscWithCable(
        scResult.threePhaseIsc,
        length,
        size,
        voltageSecondaryV || 400,
        isCopper,
        false,
        insulation,
        runs
      );
      return parseFloat(isc.toFixed(2));
    } catch {
      return null;
    }
  }, [includeCable, scResult, cableLengthM, cableSizeMm2, voltageSecondaryV, isCopper, insulation, parallelRuns]);

  // Minimum recommended breaker Icu
  const recommendedIcuTransformer = useMemo(() => {
    if (!scResult) return 50;
    const required = scResult.threePhaseIsc;
    const match = STANDARD_BREAKER_ICU.find((rating) => rating >= required);
    return match || Math.ceil(required / 10) * 10;
  }, [scResult]);

  const recommendedIcuDownstream = useMemo(() => {
    if (!downstreamIsc) return null;
    const match = STANDARD_BREAKER_ICU.find((rating) => rating >= downstreamIsc);
    return match || Math.ceil(downstreamIsc / 10) * 10;
  }, [downstreamIsc]);

  // Copy technical summary
  const copySummaryText = useMemo(() => {
    if (!scResult) return '';
    return `--- PROCAL IEC 60909 SHORT-CIRCUIT CALCULATION ---
Transformer: ${ratedPowerKva} kVA | ${voltagePrimaryKv} kV / ${voltageSecondaryV} V
Impedance (Uk): ${impedancePercent}% | Vector Group: ${vectorGroup} | Earthing: ${earthingSystem}

Transformer Secondary Terminals:
- Symmetrical 3-Phase Fault (Ik''): ${scResult.threePhaseIsc} kA
- Peak Making Current (Ip): ${scResult.peakCurrent} kA
- Phase-to-Phase Fault (Ik2): ${scResult.twoPhaseIsc} kA
- Phase-to-Neutral Fault (Ik1): ${scResult.phaseToNeutralIsc} kA
- Fault Level: ${scResult.faultMVA} MVA
- Transformer Impedance (Zt): ${scResult.transformerZ} Ω
- Recommended Switchboard Breaker Icu: ≥ ${recommendedIcuTransformer} kA
${
  includeCable && downstreamIsc
    ? `
Downstream Feeder Cable:
- Length: ${cableLengthM} m | Size: ${parallelRuns > 1 ? `${parallelRuns} × ` : ''}${cableSizeMm2} mm² (${isCopper ? 'Cu' : 'Al'}, ${insulation})
- Attenuated Fault Current at Sub-Panel: ${downstreamIsc} kA
- Recommended Sub-Panel Breaker Icu: ≥ ${recommendedIcuDownstream} kA
`
    : ''
}
Generated with ProCal (https://procal.app/tools/short-circuit-calculator)`;
  }, [
    scResult,
    ratedPowerKva,
    voltagePrimaryKv,
    voltageSecondaryV,
    impedancePercent,
    vectorGroup,
    earthingSystem,
    recommendedIcuTransformer,
    includeCable,
    downstreamIsc,
    cableLengthM,
    cableSizeMm2,
    isCopper,
    insulation,
    parallelRuns,
    recommendedIcuDownstream,
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
            IEC 60909 & IEC 60076 Standards
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Short-Circuit & Breaker Breaking Capacity Calculator
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Calculate symmetrical short-circuit current (Ik''), peak making current (Ip),
            and determine the minimum required circuit breaker breaking capacity (Icu / Ics)
            at transformer terminals and downstream sub-distribution boards.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Inputs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Transformer Parameters */}
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-orange-500" />
                  1. Distribution Transformer
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Select rating and impedance specifications
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Standard Rating Pills */}
                <div>
                  <Label className="text-xs text-slate-300 mb-1.5 block">
                    Rated Power (kVA) — Common Ratings
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {STANDARD_TRANSFORMER_KVA.map((kva) => (
                      <button
                        key={kva}
                        type="button"
                        onClick={() => handleKvaSelect(kva)}
                        className={`px-2.5 py-1 text-xs rounded-md border font-mono transition-all ${
                          ratedPowerKva === kva
                            ? 'bg-orange-600 border-orange-500 text-white font-bold shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {kva}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <Input
                      type="number"
                      min="10"
                      step="50"
                      value={ratedPowerKva || ''}
                      onChange={(e) => setRatedPowerKva(parseFloat(e.target.value) || 0)}
                      placeholder="Custom kVA"
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-300">Primary Voltage (kV)</Label>
                    <Input
                      type="number"
                      min="1"
                      step="0.5"
                      value={voltagePrimaryKv || ''}
                      onChange={(e) => setVoltagePrimaryKv(parseFloat(e.target.value) || 11)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Secondary Voltage (V)</Label>
                    <Input
                      type="number"
                      min="100"
                      max="1000"
                      step="10"
                      value={voltageSecondaryV || ''}
                      onChange={(e) => setVoltageSecondaryV(parseFloat(e.target.value) || 400)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs text-slate-300">Impedance Voltage (Uk %)</Label>
                      <span className="text-xs font-mono text-orange-400">{impedancePercent}%</span>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      max="15"
                      step="0.1"
                      value={impedancePercent || ''}
                      onChange={(e) => setImpedancePercent(parseFloat(e.target.value) || 6.0)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Vector Group</Label>
                    <select
                      value={vectorGroup}
                      onChange={(e) => setVectorGroup(e.target.value as TransformerVectorGroup)}
                      className="mt-1 w-full h-9 rounded-md border border-slate-700/80 bg-slate-900/80 px-3 text-xs text-slate-100 shadow-sm focus:border-orange-500 focus:outline-none"
                    >
                      <option value="Dyn11">Dyn11 (Delta / Star with Neutral - Standard)</option>
                      <option value="Dyn5">Dyn5</option>
                      <option value="Yyn0">Yyn0 (Star / Star)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Earthing System</Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {['TN-S', 'TN-C', 'TT', 'IT'].map((sys) => (
                      <button
                        key={sys}
                        type="button"
                        onClick={() => setEarthingSystem(sys)}
                        className={`py-1.5 px-2 text-xs rounded-md border font-medium transition-all ${
                          earthingSystem === sys
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sys}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Optional Downstream Feeder Cable */}
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Cable className="w-4 h-4 text-orange-500" />
                    2. Downstream Feeder Cable (Optional)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Calculates fault current attenuation at sub-distribution board
                  </CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setIncludeCable(!includeCable)}
                  className={`px-3 py-1 text-xs rounded-full border transition-all ${
                    includeCable
                      ? 'bg-orange-600 border-orange-500 text-white font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {includeCable ? 'Enabled' : 'Disabled'}
                </button>
              </CardHeader>
              {includeCable && (
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-300">Feeder Cable Length (m)</Label>
                      <Input
                        type="number"
                        min="1"
                        step="5"
                        value={cableLengthM || ''}
                        onChange={(e) => setCableLengthM(parseFloat(e.target.value) || 1)}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300">Cable Size (mm²)</Label>
                      <Input
                        type="number"
                        min="1.5"
                        step="1"
                        value={cableSizeMm2 || ''}
                        onChange={(e) => setCableSizeMm2(parseFloat(e.target.value) || 240)}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300">Conductor Material</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setIsCopper(true)}
                          className={`py-1.5 text-xs rounded border transition-all ${
                            isCopper
                              ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-semibold'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          Copper (Cu)
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCopper(false)}
                          className={`py-1.5 text-xs rounded border transition-all ${
                            !isCopper
                              ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-semibold'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          Aluminum (Al)
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300">Parallel Runs</Label>
                      <Input
                        type="number"
                        min="1"
                        max="8"
                        value={parallelRuns || ''}
                        onChange={(e) => setParallelRuns(parseInt(e.target.value, 10) || 1)}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-5 space-y-6">
            {scResult ? (
              <>
                <Card className="border-orange-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 rounded-full blur-2xl pointer-events-none" />

                  <CardHeader className="pb-3 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-orange-400 uppercase tracking-wider">
                        Fault Analysis (IEC 60909)
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

                    {/* Primary Highlight */}
                    <div className="pt-2">
                      <span className="text-xs text-slate-400 block">
                        3-Phase Symmetrical Fault Current (Ik'') at Transformer:
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-extrabold text-white font-mono">
                          {scResult.threePhaseIsc} kA
                        </span>
                        <span className="text-xs text-orange-400 font-mono">
                          ({scResult.faultMVA} MVA)
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-5">
                    {/* Minimum Breaker Breaking Capacity Badge */}
                    <div className="p-3.5 rounded-lg border bg-orange-950/30 border-orange-500/30 text-orange-200 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0" />
                        <span className="font-bold text-sm text-white">
                          Required Switchboard Breaker Icu: ≥ {recommendedIcuTransformer} kA
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 pl-6">
                        All main incomer and bus-tie breakers on the Low-Voltage Main Switchboard (MDB) must be rated for at least {recommendedIcuTransformer} kA breaking capacity.
                      </p>
                    </div>

                    {/* Fault Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Peak Making Current (Ip)</span>
                        <span className="font-mono font-bold text-amber-400 text-base">
                          {scResult.peakCurrent} kA
                        </span>
                        <span className="text-[10px] text-slate-500 block">Mechanical busbar stress</span>
                      </div>

                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Phase-to-Phase (Ik2)</span>
                        <span className="font-mono font-bold text-slate-200 text-base">
                          {scResult.twoPhaseIsc} kA
                        </span>
                        <span className="text-[10px] text-slate-500 block">0.866 × Ik''</span>
                      </div>

                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Phase-to-Neutral (Ik1)</span>
                        <span className="font-mono font-bold text-slate-200 text-base">
                          {scResult.phaseToNeutralIsc} kA
                        </span>
                        <span className="text-[10px] text-slate-500 block">Sequence impedance ratio</span>
                      </div>

                      <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Transformer Impedance (Zt)</span>
                        <span className="font-mono font-bold text-slate-200 text-base">
                          {(scResult.transformerZ * 1000).toFixed(2)} mΩ
                        </span>
                        <span className="text-[10px] text-slate-500 block">At {voltageSecondaryV}V secondary</span>
                      </div>
                    </div>

                    {/* Downstream Cable Attenuation Card */}
                    {includeCable && downstreamIsc && (
                      <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                            Attenuated Fault at Sub-Panel:
                          </span>
                          <span className="font-mono font-bold text-emerald-400 text-base">
                            {downstreamIsc} kA
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          After {cableLengthM}m of {parallelRuns > 1 ? `${parallelRuns} × ` : ''}{cableSizeMm2} mm² cable,
                          cable resistance attenuates fault level from {scResult.threePhaseIsc} kA to {downstreamIsc} kA.
                        </p>
                        <div className="pt-1 text-[11px] text-emerald-300 font-medium">
                          → Sub-distribution board breakers can be sized to: <strong>Icu ≥ {recommendedIcuDownstream} kA</strong> (saving switchgear cost).
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400">
                <Info className="w-8 h-8 text-orange-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Please check your transformer inputs.</p>
              </Card>
            )}
          </div>
        </div>

        {/* Full-Width Conversion Banner */}
        {scResult && (
          <div className="mt-8">
            <ProCalConversionBanner
              toolName="IEC 60909 Short-Circuit & Icu Sizer"
              toolType="short-circuit"
              calculationData={{
                transformerKva: ratedPowerKva,
                impedancePercent,
                voltageSecondaryV,
                threePhaseIsc: scResult.threePhaseIsc,
                peakCurrent: scResult.peakCurrent,
                recommendedIcu: recommendedIcuTransformer,
                downstreamIsc: includeCable ? downstreamIsc : null,
              }}
              headline="Coordinate Switchgear Fault Levels & Selectivity in ProCal"
              description="ProCal propagates busbar short-circuit levels down multi-tier risers, verifies breaker Icu ratings and cascading, and generates synchronized Single Line Diagrams."
            />
          </div>
        )}

        {/* Technical Explainer / SEO Guide */}
        <section className="mt-16 border-t border-slate-800 pt-12 max-w-4xl mx-auto space-y-6 text-slate-300 text-sm leading-relaxed">
          <h2 className="text-xl font-bold text-white">
            How IEC 60909 Short-Circuit Currents Are Calculated
          </h2>
          <p>
            Under <strong>IEC 60909</strong>, prospective short-circuit currents are determined using the
            equivalent voltage source method at the fault location:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <h3 className="font-semibold text-white text-xs uppercase tracking-wider text-orange-400">
                1. Transformer Impedance (Zt)
              </h3>
              <div className="p-2 rounded bg-slate-950 font-mono text-xs text-orange-300 text-center">
                Z_t = (u_k% / 100) × (U_n² / S_r)
              </div>
              <p className="text-xs text-slate-400">
                Where $u_k\%$ is the percentage short-circuit impedance voltage, $U_n$ is secondary nominal voltage,
                and $S_r$ is transformer rated apparent power.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <h3 className="font-semibold text-white text-xs uppercase tracking-wider text-orange-400">
                2. Symmetrical Fault Current (Ik'')
              </h3>
              <div className="p-2 rounded bg-slate-950 font-mono text-xs text-orange-300 text-center">
                I_k'' = (c_max × U_n) / (√3 × Z_total)
              </div>
              <p className="text-xs text-slate-400">
                Where c_max = 1.05 (for low-voltage systems) accounts for utility voltage fluctuations.
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
            <Link href="/tools/cable-sizer" className="hover:text-white transition-colors">Cable Sizer</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
