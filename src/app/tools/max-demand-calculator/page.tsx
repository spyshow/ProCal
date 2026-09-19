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
  Layers,
  Building2,
  TrendingDown,
  Info,
  CheckCircle2,
  Gauge,
  Sliders,
} from 'lucide-react';
import {
  getApartmentDiversityFactor,
  getBuildingDiversityFactor,
  calculateThreePhaseCurrent,
} from '@/lib/calculations/loads';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProCalConversionBanner from '@/components/ProCalConversionBanner';

export default function MaxDemandCalculatorPage() {
  const [occupancyType, setOccupancyType] = useState<'residential' | 'commercial' | 'retail'>('residential');
  const [unitCount, setUnitCount] = useState<number>(32);
  const [loadPerUnitKw, setLoadPerUnitKw] = useState<number>(12);
  const [powerFactor, setPowerFactor] = useState<number>(0.85);
  const [voltage, setVoltage] = useState<number>(400);

  // Common area loads
  const [commonLoadsKw, setCommonLoadsKw] = useState<number>(45);

  const [copied, setCopied] = useState<boolean>(false);

  // Calculations
  const results = useMemo(() => {
    const units = Math.max(1, unitCount || 1);
    const kwPerUnit = Math.max(0.1, loadPerUnitKw || 1);
    const pf = Math.min(1.0, Math.max(0.1, powerFactor || 0.85));
    const v = Math.max(100, voltage || 400);
    const commonKw = Math.max(0, commonLoadsKw || 0);

    const unitsConnectedKw = units * kwPerUnit;
    const totalConnectedKw = unitsConnectedKw + commonKw;
    const totalConnectedKva = totalConnectedKw / pf;

    // Coincidence Factor
    let coincidenceFactor = 0.5;
    if (occupancyType === 'residential') {
      coincidenceFactor = getApartmentDiversityFactor(units);
    } else if (occupancyType === 'commercial') {
      coincidenceFactor = getBuildingDiversityFactor(units, 'OFFICE');
    } else {
      coincidenceFactor = getBuildingDiversityFactor(units, 'RETAIL');
    }

    const diversifiedUnitsKw = unitsConnectedKw * coincidenceFactor;
    // Common area loads typically have 0.90 diversity
    const diversifiedCommonKw = commonKw * 0.9;
    const totalDemandKw = diversifiedUnitsKw + diversifiedCommonKw;
    const totalDemandKva = totalDemandKw / pf;

    const undiversifiedIb = calculateThreePhaseCurrent(totalConnectedKva, v);
    const diversifiedIb = calculateThreePhaseCurrent(totalDemandKva, v);

    const savedKva = totalConnectedKva - totalDemandKva;
    const savedIb = undiversifiedIb - diversifiedIb;
    const savingsPercent = ((savedKva / totalConnectedKva) * 100).toFixed(1);

    return {
      totalConnectedKw,
      totalConnectedKva,
      coincidenceFactor,
      totalDemandKw,
      totalDemandKva,
      undiversifiedIb,
      diversifiedIb,
      savedKva,
      savedIb,
      savingsPercent,
    };
  }, [occupancyType, unitCount, loadPerUnitKw, powerFactor, voltage, commonLoadsKw]);

  // Copy report
  const copySummaryText = useMemo(() => {
    return `--- PROCAL MAXIMUM DEMAND & COINCIDENCE FACTOR (IEC 61439-2) ---
Occupancy: ${occupancyType.toUpperCase()} | Units/Floors: ${unitCount}
Load per Unit: ${loadPerUnitKw} kW | Power Factor: ${powerFactor}
Common Area Loads: ${commonLoadsKw} kW

Summary:
- Total Connected Load: ${results.totalConnectedKw.toFixed(1)} kW (${results.totalConnectedKva.toFixed(1)} kVA)
- IEC 61439-2 Coincidence Factor (ks): ${results.coincidenceFactor.toFixed(2)}
- Maximum Diversified Demand: ${results.totalDemandKw.toFixed(1)} kW (${results.totalDemandKva.toFixed(1)} kVA)
- Design Incomer Current (Ib): ${results.diversifiedIb.toFixed(1)} A (vs ${results.undiversifiedIb.toFixed(1)} A without diversity)
- Substation Capacity Saved: ${results.savedKva.toFixed(1)} kVA (-${results.savingsPercent}%)

Generated with ProCal (https://procal.app/tools/max-demand-calculator)`;
  }, [occupancyType, unitCount, loadPerUnitKw, powerFactor, commonLoadsKw, results]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copySummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
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
            IEC 61439-2 Clause 10.10 & NF C 14-100
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Maximum Demand & Coincidence Factor Calculator
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Calculate diversified peak power and main incomer design current ($I_b$) for residential towers,
            commercial offices, and retail complexes per international electrical diversity standards.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Inputs */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  Building Load Profile
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Select occupancy profile and specify unit loads
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Occupancy Selector */}
                <div>
                  <Label className="text-xs text-slate-300">Occupancy Profile</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setOccupancyType('residential')}
                      className={`py-2 px-2 text-xs rounded-md border font-medium transition-all ${
                        occupancyType === 'residential'
                          ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      Residential
                    </button>
                    <button
                      type="button"
                      onClick={() => setOccupancyType('commercial')}
                      className={`py-2 px-2 text-xs rounded-md border font-medium transition-all ${
                        occupancyType === 'commercial'
                          ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      Commercial Office
                    </button>
                    <button
                      type="button"
                      onClick={() => setOccupancyType('retail')}
                      className={`py-2 px-2 text-xs rounded-md border font-medium transition-all ${
                        occupancyType === 'retail'
                          ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      Retail / Mall
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-300">Number of Units / Tenants</Label>
                    <Input
                      type="number"
                      min="1"
                      value={unitCount || ''}
                      onChange={(e) => setUnitCount(parseInt(e.target.value, 10) || 1)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Load per Unit (kW)</Label>
                    <Input
                      type="number"
                      min="1"
                      step="0.5"
                      value={loadPerUnitKw || ''}
                      onChange={(e) => setLoadPerUnitKw(parseFloat(e.target.value) || 1)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Power Factor (cos φ)</Label>
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
                    <Label className="text-xs text-slate-300">System Voltage (V)</Label>
                    <Input
                      type="number"
                      value={voltage || ''}
                      onChange={(e) => setVoltage(parseFloat(e.target.value) || 400)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Common Area Loads */}
                <div>
                  <Label className="text-xs text-slate-300">Common Area Services (kW)</Label>
                  <p className="text-[11px] text-slate-500 mb-1">
                    Lifts, corridor lighting, booster pumps, and common HVAC
                  </p>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    value={commonLoadsKw || ''}
                    onChange={(e) => setCommonLoadsKw(parseFloat(e.target.value) || 0)}
                    className="text-xs font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="border-orange-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 rounded-full blur-2xl pointer-events-none" />

              <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-orange-400 uppercase tracking-wider">
                    Diversity Analysis Output
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

                <div className="pt-2">
                  <span className="text-xs text-slate-400 block">Maximum Diversified Demand:</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      {results.totalDemandKva.toFixed(1)} kVA
                    </span>
                    <span className="text-xs text-orange-400 font-mono">
                      ({results.totalDemandKw.toFixed(1)} kW)
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-5">
                {/* Savings Banner */}
                <div className="p-3.5 rounded-lg border bg-emerald-950/30 border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-sm text-white">
                      Capacity Saved by Diversity: {results.savedKva.toFixed(1)} kVA (-{results.savingsPercent}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-6">
                    Without diversity, the connected load is {results.totalConnectedKva.toFixed(1)} kVA ({results.undiversifiedIb.toFixed(1)} A). Diversity reduces the required main switchboard incomer to {results.diversifiedIb.toFixed(1)} A.
                  </p>
                </div>

                {/* Engineering Breakdown Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Coincidence Factor (ks)</span>
                    <span className="font-mono font-bold text-orange-400 text-base">
                      {results.coincidenceFactor.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {occupancyType === 'residential' ? 'IEC 61439-2 Table 101' : 'Standard diversity'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Incomer Design Current (Ib)</span>
                    <span className="font-mono font-bold text-white text-base">
                      {results.diversifiedIb.toFixed(1)} A
                    </span>
                    <span className="text-[10px] text-slate-500 block">At 400V 3-Phase</span>
                  </div>

                  <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Connected Load (Sum)</span>
                    <span className="font-mono font-bold text-slate-300 text-base">
                      {results.totalConnectedKw.toFixed(1)} kW
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {results.totalConnectedKva.toFixed(1)} kVA undiversified
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Recommended Transformer</span>
                    <span className="font-mono font-bold text-emerald-400 text-base">
                      {results.totalDemandKva <= 400
                        ? '400 kVA'
                        : results.totalDemandKva <= 630
                        ? '630 kVA'
                        : results.totalDemandKva <= 800
                        ? '800 kVA'
                        : results.totalDemandKva <= 1000
                        ? '1000 kVA'
                        : results.totalDemandKva <= 1250
                        ? '1250 kVA'
                        : results.totalDemandKva <= 1600
                        ? '1600 kVA'
                        : '2000 kVA+'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">With ~20% growth margin</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full-Width Conversion Banner */}
        <div className="mt-8">
          <ProCalConversionBanner
            toolName="Maximum Demand & Coincidence Factor Sizer"
            toolType="max-demand"
            calculationData={{
              occupancyType,
              unitCount,
              loadPerUnitKw,
              powerFactor,
              voltage,
              commonLoadsKw,
              coincidenceFactor: results.coincidenceFactor,
              totalConnectedKw: results.totalConnectedKw,
              totalDemandKw: results.totalDemandKw,
              totalDemandKva: results.totalDemandKva,
              diversifiedIb: results.diversifiedIb,
            }}
            headline="Unify Multi-Tower Diversity Factors into One Shared Electrical Model"
            description="Stop running disconnected apartment calculations. In ProCal, residential coincidence factors (IEC 61439-2) and commercial diversity are evaluated holistically across your entire project with live transformer and riser sync."
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
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
