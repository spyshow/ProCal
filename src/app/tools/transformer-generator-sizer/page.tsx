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
  Server,
  Activity,
  Cpu,
  CheckCircle2,
  Gauge,
  TrendingDown,
} from 'lucide-react';
import {
  sizeTransformer,
  sizeGenerator,
  STANDARD_TRANSFORMERS,
  STANDARD_GENERATORS,
  calculateThreePhaseCurrent,
} from '@/lib/calculations/loads';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProCalConversionBanner from '@/components/ProCalConversionBanner';

export default function TransformerGeneratorSizerPage() {
  const [demandKva, setDemandKva] = useState<number>(650);
  const [voltage, setVoltage] = useState<number>(400);
  const [trafoMargin, setTrafoMargin] = useState<number>(20); // 20% margin

  // Generator inputs
  const [essentialPercent, setEssentialPercent] = useState<number>(40); // 40% essential load
  const [largestMotorKw, setLargestMotorKw] = useState<number>(75); // e.g. 75 kW fire pump or chiller
  const [motorStartingMethod, setMotorStartingMethod] = useState<'DOL' | 'StarDelta' | 'SoftStarter' | 'VFD'>('StarDelta');

  const [copied, setCopied] = useState<boolean>(false);

  // Starting factor based on method
  const startingFactor = useMemo(() => {
    switch (motorStartingMethod) {
      case 'DOL':
        return 6.0;
      case 'StarDelta':
        return 2.5;
      case 'SoftStarter':
        return 2.5;
      case 'VFD':
        return 1.2;
      default:
        return 3.0;
    }
  }, [motorStartingMethod]);

  // Calculations
  const sizingResults = useMemo(() => {
    const sDemand = Math.max(10, demandKva || 100);
    const v = Math.max(100, voltage || 400);
    const trafoSafetyMultiplier = 1 + Math.max(0, trafoMargin || 0) / 100;

    // 1. Sizing Transformer
    const trafoKva = sizeTransformer(sDemand, trafoSafetyMultiplier);
    const trafoLoadingPercent = ((sDemand / trafoKva) * 100).toFixed(1);
    const trafoIncomerCurrent = calculateThreePhaseCurrent(trafoKva, v);

    // 2. Sizing Generator
    const essentialKva = (sDemand * (essentialPercent || 40)) / 100;
    // Motor kW to kVA (assuming typical 0.85 PF)
    const motorKva = (largestMotorKw || 0) / 0.85;

    let genKva = 100;
    try {
      genKva = sizeGenerator(essentialKva, motorKva, startingFactor, 1.15);
    } catch {
      genKva = Math.ceil((essentialKva + motorKva * startingFactor) / 100) * 100;
    }

    const genLoadingPercent = ((essentialKva / genKva) * 100).toFixed(1);
    const genIncomerCurrent = calculateThreePhaseCurrent(genKva, v);
    const motorStartingKva = (motorKva * startingFactor).toFixed(1);

    return {
      trafoKva,
      trafoLoadingPercent,
      trafoIncomerCurrent,
      essentialKva,
      motorKva,
      motorStartingKva,
      genKva,
      genLoadingPercent,
      genIncomerCurrent,
    };
  }, [demandKva, voltage, trafoMargin, essentialPercent, largestMotorKw, startingFactor]);

  // Copy report
  const copySummaryText = useMemo(() => {
    return `--- PROCAL TRANSFORMER & GENERATOR SIZING ---
Total Peak Demand: ${demandKva} kVA | Voltage: ${voltage} V

Distribution Transformer:
- Recommended Rating: ${sizingResults.trafoKva} kVA
- Continuous Loading: ${sizingResults.trafoLoadingPercent}%
- Full Load Incomer Current (In): ${sizingResults.trafoIncomerCurrent} A

Standby Diesel Generator:
- Essential Load (${essentialPercent}%): ${sizingResults.essentialKva.toFixed(1)} kVA
- Largest Motor: ${largestMotorKw} kW (${motorStartingMethod}, Starting surge: ${sizingResults.motorStartingKva} kVA)
- Recommended Generator Rating: ${sizingResults.genKva} kVA
- Continuous Essential Loading: ${sizingResults.genLoadingPercent}%
- Generator Incomer Current (In): ${sizingResults.genIncomerCurrent} A

Generated with ProCal (https://procal.app/tools/transformer-generator-sizer)`;
  }, [
    demandKva,
    voltage,
    essentialPercent,
    largestMotorKw,
    motorStartingMethod,
    sizingResults,
  ]);

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
            IEC 60076 & ISO 8528 Standards
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Transformer & Standby Generator Sizing
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Determine standard distribution transformer ratings (kVA) and standby diesel generator capacity
            accounting for continuous demand, motor starting inrush transients, and reserve margins.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Inputs */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-orange-500" />
                  1. Substation Load & Transformer
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Peak diversified demand and desired expansion margin
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-300">Peak Demand (kVA)</Label>
                    <Input
                      type="number"
                      min="10"
                      step="25"
                      value={demandKva || ''}
                      onChange={(e) => setDemandKva(parseFloat(e.target.value) || 0)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Growth Margin (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={trafoMargin || ''}
                      onChange={(e) => setTrafoMargin(parseFloat(e.target.value) || 0)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-500" />
                  2. Standby Generator & Essential Loads
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Emergency power requirements and motor starting surge
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs text-slate-300">Essential Load Ratio</Label>
                      <span className="text-xs font-mono text-orange-400">{essentialPercent}%</span>
                    </div>
                    <Input
                      type="number"
                      min="10"
                      max="100"
                      value={essentialPercent || ''}
                      onChange={(e) => setEssentialPercent(parseFloat(e.target.value) || 40)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Largest Motor (kW)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={largestMotorKw || ''}
                      onChange={(e) => setLargestMotorKw(parseFloat(e.target.value) || 0)}
                      className="mt-1 text-xs font-mono"
                      placeholder="e.g. 75 kW"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-300">Motor Starting Method</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    {[
                      { id: 'DOL', label: 'DOL (6×)' },
                      { id: 'StarDelta', label: 'Star-Delta (2.5×)' },
                      { id: 'SoftStarter', label: 'Soft Start (2.5×)' },
                      { id: 'VFD', label: 'VFD (1.2×)' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMotorStartingMethod(m.id as any)}
                        className={`py-1.5 px-2 text-xs rounded-md border font-medium transition-all ${
                          motorStartingMethod === m.id
                            ? 'bg-orange-950/60 border-orange-500/80 text-orange-300 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-6 space-y-6">
            {/* Transformer Sizing Card */}
            <Card className="border-orange-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur shadow-2xl relative overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-orange-400 uppercase tracking-wider">
                    Recommended Equipment Ratings
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
              </CardHeader>

              <CardContent className="pt-4 space-y-5">
                {/* Transformer Result */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-semibold">
                      <Server className="w-4 h-4 text-orange-400" />
                      Distribution Transformer:
                    </span>
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 font-mono text-sm">
                      {sizingResults.trafoKva} kVA
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Continuous Loading</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {sizingResults.trafoLoadingPercent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Incomer Current (In)</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {sizingResults.trafoIncomerCurrent} A
                      </span>
                    </div>
                  </div>
                </div>

                {/* Generator Result */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-semibold">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Standby Diesel Generator:
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-mono text-sm">
                      {sizingResults.genKva} kVA
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Essential Demand</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {sizingResults.essentialKva.toFixed(1)} kVA
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Motor Starting Surge</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {sizingResults.motorStartingKva} kVA
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Continuous Loading</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {sizingResults.genLoadingPercent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Generator Breaker (In)</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {sizingResults.genIncomerCurrent} A
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full-Width Conversion Banner */}
        <div className="mt-8">
          <ProCalConversionBanner
            toolName="Transformer & Standby Generator Sizer"
            toolType="transformer-generator"
            calculationData={{
              demandKva,
              voltage,
              trafoMargin,
              essentialPercent,
              largestMotorKw,
              motorStartingMethod,
              trafoKva: sizingResults.trafoKva,
              genKva: sizingResults.genKva,
              trafoIncomerCurrent: sizingResults.trafoIncomerCurrent,
              genIncomerCurrent: sizingResults.genIncomerCurrent,
            }}
            headline="Automate Substation Design & ATS Changeover in ProCal"
            description="In ProCal, utility transformer capacities and standby generator sizing dynamically recalculate as you adjust loads across building floors, ensuring continuous emergency compliance and optimized capital cost."
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
