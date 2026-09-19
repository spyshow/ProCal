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
  Activity,
  Gauge,
  HelpCircle,
  TrendingDown,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  verifyCoordination,
  suggestAlternativeBreaker,
  BreakerCurveSettings,
} from '@/lib/calculations/selectivity';
import ProCalConversionBanner from '@/components/ProCalConversionBanner';

const STANDARD_BREAKER_RATINGS = [
  16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200,
];

export default function ProtectionCoordinationPage() {
  // Upstream Breaker States (e.g. Main Incomer or Distribution Feeder)
  const [upIn, setUpIn] = useState<number>(400);
  const [upCategory, setUpCategory] = useState<'MCCB' | 'ACB'>('MCCB');
  const [upIrRatio, setUpIrRatio] = useState<number>(1.0); // Ir / In
  const [upTr, setUpTr] = useState<number>(12); // Long-time delay (s)
  const [upIsdRatio, setUpIsdRatio] = useState<number>(6.0); // Isd / Ir
  const [upTsd, setUpTsd] = useState<number>(0.2); // Short-time delay (s)
  const [upIiRatio, setUpIiRatio] = useState<number>(10.0); // Ii / In
  const [upMfg, setUpMfg] = useState<string>('Schneider');

  // Downstream Breaker States (e.g. Sub-feeder or Branch MCB)
  const [downIn, setDownIn] = useState<number>(63);
  const [downCategory, setDownCategory] = useState<'MCB' | 'MCCB'>('MCB');
  const [downCurveType, setDownCurveType] = useState<'B' | 'C' | 'D'>('C');
  const [downIrRatio, setDownIrRatio] = useState<number>(1.0);
  const [downMfg, setDownMfg] = useState<string>('Schneider');

  // Circuit & Prospective Fault parameters
  const [faultCurrentKa, setFaultCurrentKa] = useState<number>(25); // 25 kA
  const [cableSizeMm2, setCableSizeMm2] = useState<number>(16);
  const [cableMaterial, setCableMaterial] = useState<'copper' | 'aluminum'>('copper');
  const [cableInsulation, setCableInsulation] = useState<'XLPE' | 'PVC'>('XLPE');

  const [copied, setCopied] = useState<boolean>(false);

  // Sync category defaults
  const handleUpCategoryChange = (cat: 'MCCB' | 'ACB') => {
    setUpCategory(cat);
    if (cat === 'ACB' && upIn < 800) {
      setUpIn(800);
    } else if (cat === 'MCCB' && upIn > 630) {
      setUpIn(400);
    }
  };

  const handleDownCategoryChange = (cat: 'MCB' | 'MCCB') => {
    setDownCategory(cat);
    if (cat === 'MCB' && downIn > 63) {
      setDownIn(63);
    } else if (cat === 'MCCB' && downIn < 100) {
      setDownIn(160);
    }
  };

  // Construct Breaker Settings
  const upstreamSettings = useMemo<BreakerCurveSettings>(() => {
    const ir = upIn * upIrRatio;
    return {
      inRating: upIn,
      ir: parseFloat(ir.toFixed(1)),
      tr: upTr,
      isd: parseFloat((ir * upIsdRatio).toFixed(1)),
      tsd: upTsd,
      i2t: false,
      ii: parseFloat((upIn * upIiRatio).toFixed(1)),
      category: upCategory,
      curveType: 'LSI',
      manufacturer: upMfg,
    };
  }, [upIn, upIrRatio, upTr, upIsdRatio, upTsd, upIiRatio, upCategory, upMfg]);

  const downstreamSettings = useMemo<BreakerCurveSettings>(() => {
    const ir = downIn * downIrRatio;
    if (downCategory === 'MCB') {
      return {
        inRating: downIn,
        ir: parseFloat(ir.toFixed(1)),
        tr: 10,
        category: 'MCB',
        curveType: downCurveType,
        manufacturer: downMfg,
      };
    } else {
      return {
        inRating: downIn,
        ir: parseFloat(ir.toFixed(1)),
        tr: 12,
        isd: parseFloat((ir * 6).toFixed(1)),
        tsd: 0.1,
        i2t: false,
        ii: parseFloat((downIn * 10).toFixed(1)),
        category: 'MCCB',
        curveType: 'TM',
        manufacturer: downMfg,
      };
    }
  }, [downIn, downIrRatio, downCategory, downCurveType, downMfg]);

  // Execute Coordination Evaluation
  const coordinationResult = useMemo(() => {
    const faultAmps = Math.max(100, (faultCurrentKa || 1) * 1000);
    return verifyCoordination(upstreamSettings, downstreamSettings, faultAmps, {
      cableSizeMm2,
      cableMaterial,
      cableInsulation,
      manufacturerPair: { upstreamMfg: upMfg, downstreamMfg: downMfg },
    });
  }, [
    upstreamSettings,
    downstreamSettings,
    faultCurrentKa,
    cableSizeMm2,
    cableMaterial,
    cableInsulation,
    upMfg,
    downMfg,
  ]);

  // Breaker Alternative Suggestions (if not FULL)
  const suggestions = useMemo(() => {
    if (coordinationResult.status === 'FULL') return [];
    return suggestAlternativeBreaker(
      upstreamSettings,
      downstreamSettings,
      Math.max(100, (faultCurrentKa || 1) * 1000),
      {
        cableSizeMm2,
        preferredManufacturer: upMfg,
      }
    );
  }, [coordinationResult.status, upstreamSettings, downstreamSettings, faultCurrentKa, cableSizeMm2, upMfg]);

  // Formatted copy summary
  const copySummaryText = useMemo(() => {
    const limitKa = coordinationResult.limitCurrent
      ? (coordinationResult.limitCurrent / 1000).toFixed(1)
      : 'None';

    return `--- PROCAL PROTECTION COORDINATION & SELECTIVITY STUDY ---
IEC Standards: IEC 60947-2 (Low-Voltage Switchgear) & IEC 60898-1 (MCBs)

Upstream Device:
- Rating: ${upstreamSettings.inRating}A ${upstreamSettings.category} (${upstreamSettings.manufacturer})
- Settings: Ir=${upstreamSettings.ir}A, Isd=${upstreamSettings.isd ?? '—'}A, tsd=${upstreamSettings.tsd ?? '—'}s, Ii=${upstreamSettings.ii ?? '—'}A

Downstream Device:
- Rating: ${downstreamSettings.inRating}A ${downstreamSettings.category} (${downstreamSettings.manufacturer}, ${downstreamSettings.curveType ?? 'C'} Curve)
- Setting: Ir=${downstreamSettings.ir}A

Prospective Fault Current (Isc): ${faultCurrentKa} kA
Feeder Cable: ${cableSizeMm2} mm² ${cableMaterial.toUpperCase()} / ${cableInsulation}

Coordination Verdict:
- Selectivity Status: ${coordinationResult.status}
- Discrimination Limit (Is): ${limitKa} kA (Prospective Isc: ${faultCurrentKa} kA)
- Current Grading (Ir,up >= 1.6 Ir,down): ${coordinationResult.currentGradingOk ? 'PASSED' : 'FAILED'}
- Time Grading (Margin >= 0.25s): ${coordinationResult.timeGradingOk ? 'PASSED' : 'FAILED'} (Margin: ${coordinationResult.timeMarginSeconds?.toFixed(2) ?? '—'}s)
- Energy Selectivity (I²t) Applied: ${coordinationResult.energySelectivityApplied ? 'YES (Tested Manufacturer Table)' : 'NO'}
- Cable Thermal Withstand (k²S² >= I²t): ${coordinationResult.cableDamageOk ? 'PASSED' : 'DAMAGED UNDER FAULT'}

Details:
${coordinationResult.overlapDetails || 'No curve overlap detected.'}

Generated with ProCal (https://procal.app/tools/protection-coordination)`;
  }, [
    upstreamSettings,
    downstreamSettings,
    faultCurrentKa,
    cableSizeMm2,
    cableMaterial,
    cableInsulation,
    coordinationResult,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copySummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const statusColor =
    coordinationResult.status === 'FULL'
      ? 'emerald'
      : coordinationResult.status === 'PARTIAL'
      ? 'amber'
      : 'rose';

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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Breadcrumb & Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Link href="/tools" className="hover:text-orange-400 transition-colors">
              Tools
            </Link>
            <span>/</span>
            <span className="text-slate-200">Protection Coordination & Selectivity</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                Protection Coordination & Selectivity
                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[10px] font-mono">
                  IEC 60947-2
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Verify upstream/downstream circuit breaker discrimination, current & time grading, energy selectivity tables, and cable thermal withstand.
              </p>
            </div>

            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs gap-2 shrink-0 self-start md:self-auto"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy Study Summary'}
            </Button>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Upstream & Downstream Settings (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Upstream Breaker Card */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-orange-400" />
                    Upstream Protective Device
                  </CardTitle>
                  <span className="text-[10px] uppercase font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Source Side
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                {/* Category & Frame */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">Device Type</Label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleUpCategoryChange('MCCB')}
                        className={`py-1 rounded font-medium text-center transition-colors ${
                          upCategory === 'MCCB' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        MCCB
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpCategoryChange('ACB')}
                        className={`py-1 rounded font-medium text-center transition-colors ${
                          upCategory === 'ACB' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ACB
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">Rated Current (In)</Label>
                    <div className="relative">
                      <select
                        value={upIn}
                        onChange={(e) => setUpIn(parseInt(e.target.value, 10))}
                        className="w-full h-8 rounded-md bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200 appearance-none"
                      >
                        {STANDARD_BREAKER_RATINGS.filter((r) => (upCategory === 'ACB' ? r >= 630 : r >= 100 && r <= 630)).map(
                          (r) => (
                            <option key={r} value={r}>
                              {r} A Frame
                            </option>
                          )
                        )}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Trip Unit Settings (LSI) */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">Overload Ir</span>
                        <span className="font-mono text-orange-400 font-bold">{upstreamSettings.ir} A</span>
                      </div>
                      <input
                        type="range"
                        min="0.7"
                        max="1.0"
                        step="0.05"
                        value={upIrRatio}
                        onChange={(e) => setUpIrRatio(parseFloat(e.target.value))}
                        className="w-full accent-orange-500 cursor-pointer h-1 bg-slate-800 rounded"
                      />
                      <span className="text-[10px] text-slate-500">{(upIrRatio * 100).toFixed(0)}% of In</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">Delay tr</span>
                        <span className="font-mono text-white">{upTr} s</span>
                      </div>
                      <select
                        value={upTr}
                        onChange={(e) => setUpTr(parseFloat(e.target.value))}
                        className="w-full h-7 rounded bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200"
                      >
                        <option value={3}>3 s</option>
                        <option value={6}>6 s</option>
                        <option value={12}>12 s (Standard)</option>
                        <option value={18}>18 s</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">Short-Time Isd</span>
                        <span className="font-mono text-orange-400 font-bold">{upstreamSettings.isd} A</span>
                      </div>
                      <input
                        type="range"
                        min="2.0"
                        max="10.0"
                        step="0.5"
                        value={upIsdRatio}
                        onChange={(e) => setUpIsdRatio(parseFloat(e.target.value))}
                        className="w-full accent-orange-500 cursor-pointer h-1 bg-slate-800 rounded"
                      />
                      <span className="text-[10px] text-slate-500">{upIsdRatio}x Ir</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">Delay tsd</span>
                        <span className="font-mono text-white">{upTsd} s</span>
                      </div>
                      <select
                        value={upTsd}
                        onChange={(e) => setUpTsd(parseFloat(e.target.value))}
                        className="w-full h-7 rounded bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200"
                      >
                        <option value={0.05}>0.05 s (Instantaneous)</option>
                        <option value={0.1}>0.1 s</option>
                        <option value={0.2}>0.2 s (Standard Grading)</option>
                        <option value={0.3}>0.3 s</option>
                        <option value={0.4}>0.4 s</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">Instantaneous Ii</span>
                        <span className="font-mono text-white">{upstreamSettings.ii} A</span>
                      </div>
                      <input
                        type="range"
                        min="6.0"
                        max="15.0"
                        step="1.0"
                        value={upIiRatio}
                        onChange={(e) => setUpIiRatio(parseFloat(e.target.value))}
                        className="w-full accent-orange-500 cursor-pointer h-1 bg-slate-800 rounded"
                      />
                      <span className="text-[10px] text-slate-500">{upIiRatio}x In</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-300 block">Manufacturer</span>
                      <select
                        value={upMfg}
                        onChange={(e) => setUpMfg(e.target.value)}
                        className="w-full h-7 rounded bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200"
                      >
                        <option value="Schneider">Schneider Electric (NSX/MTZ)</option>
                        <option value="ABB">ABB (Tmax/Emax)</option>
                        <option value="Generic">Generic (Parametric Only)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Downstream Breaker Card */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-orange-400" />
                    Downstream Protective Device
                  </CardTitle>
                  <span className="text-[10px] uppercase font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Load Side
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                {/* Category & Frame */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">Device Type</Label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleDownCategoryChange('MCB')}
                        className={`py-1 rounded font-medium text-center transition-colors ${
                          downCategory === 'MCB' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        MCB (IEC 60898)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownCategoryChange('MCCB')}
                        className={`py-1 rounded font-medium text-center transition-colors ${
                          downCategory === 'MCCB' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        MCCB
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">Rated Current (In)</Label>
                    <div className="relative">
                      <select
                        value={downIn}
                        onChange={(e) => setDownIn(parseInt(e.target.value, 10))}
                        className="w-full h-8 rounded-md bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200 appearance-none"
                      >
                        {STANDARD_BREAKER_RATINGS.filter((r) => (downCategory === 'MCB' ? r <= 63 : r <= upIn)).map(
                          (r) => (
                            <option key={r} value={r}>
                              {r} A
                            </option>
                          )
                        )}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {downCategory === 'MCB' ? (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div className="space-y-1">
                      <Label className="text-slate-300 text-xs font-medium">Trip Curve Characteristic</Label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[10px]">
                        {(['B', 'C', 'D'] as const).map((curve) => (
                          <button
                            key={curve}
                            type="button"
                            onClick={() => setDownCurveType(curve)}
                            className={`py-1 rounded font-bold text-center transition-colors ${
                              downCurveType === curve ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Curve {curve}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {downCurveType === 'B' ? '3–5x In (Domestic)' : downCurveType === 'C' ? '5–10x In (Standard)' : '10–20x In (Motors)'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-slate-300 text-xs font-medium">Manufacturer</Label>
                      <select
                        value={downMfg}
                        onChange={(e) => setDownMfg(e.target.value)}
                        className="w-full h-7 rounded bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200"
                      >
                        <option value="Schneider">Schneider (Acti9 iC60)</option>
                        <option value="ABB">ABB (System Pro M S200)</option>
                        <option value="Generic">Generic (Standard IEC 60898)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">Overload Ir</span>
                        <span className="font-mono text-orange-400 font-bold">{downstreamSettings.ir} A</span>
                      </div>
                      <input
                        type="range"
                        min="0.7"
                        max="1.0"
                        step="0.05"
                        value={downIrRatio}
                        onChange={(e) => setDownIrRatio(parseFloat(e.target.value))}
                        className="w-full accent-orange-500 cursor-pointer h-1 bg-slate-800 rounded"
                      />
                      <span className="text-[10px] text-slate-500">{(downIrRatio * 100).toFixed(0)}% of In</span>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-slate-300 text-xs font-medium">Manufacturer</Label>
                      <select
                        value={downMfg}
                        onChange={(e) => setDownMfg(e.target.value)}
                        className="w-full h-7 rounded bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200"
                      >
                        <option value="Schneider">Schneider Electric</option>
                        <option value="ABB">ABB</option>
                        <option value="Generic">Generic</option>
                      </select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Circuit Fault Level & Cable Parameters */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-400" />
                  Prospective Fault Level & Feeder Cable
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-xs font-medium">Prospective Fault (Isc)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={faultCurrentKa}
                        onChange={(e) => setFaultCurrentKa(parseFloat(e.target.value) || 1)}
                        className="bg-slate-950 border-slate-800 font-mono text-xs pr-8"
                      />
                      <span className="absolute right-2.5 top-2 text-slate-500 font-mono text-[10px]">kA</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-300 text-xs font-medium">Cable Size (mm²)</Label>
                    <div className="relative">
                      <select
                        value={cableSizeMm2}
                        onChange={(e) => setCableSizeMm2(parseFloat(e.target.value))}
                        className="w-full h-8 rounded bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200"
                      >
                        {[2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300].map((s) => (
                          <option key={s} value={s}>
                            {s} mm²
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Coordination Verdict & Alternative Suggestions (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Primary Verdict Banner */}
            <div
              className={`p-5 rounded-xl border ${
                coordinationResult.status === 'FULL'
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : coordinationResult.status === 'PARTIAL'
                  ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                  : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
              } shadow-xl relative overflow-hidden`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        coordinationResult.status === 'FULL'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : coordinationResult.status === 'PARTIAL'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {coordinationResult.status} SELECTIVITY
                    </Badge>
                    {coordinationResult.energySelectivityApplied && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
                        Energy Selectivity Table Applied
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight pt-1">
                    {coordinationResult.status === 'FULL'
                      ? 'Total Discrimination Guaranteed'
                      : coordinationResult.status === 'PARTIAL'
                      ? `Partial Discrimination up to ${coordinationResult.limitCurrent ? `${(coordinationResult.limitCurrent / 1000).toFixed(1)} kA` : '—'}`
                      : 'No Selectivity (Curve Conflict)'}
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                    {coordinationResult.overlapDetails}
                  </p>
                </div>
              </div>
            </div>

            {/* 4-Phase Engineering Verification Checklist */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-orange-400" />
                  IEC 60947-2 Coordination Verification Stages
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Step-by-step evaluation of thermal grading, time delays, energy let-through, and cable protection
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                {/* 1. Current Grading */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">
                      1. Overload Current Grading (Ir,up &ge; 1.6 x Ir,down)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Upstream Ir ({upstreamSettings.ir}A) vs Downstream Ir ({downstreamSettings.ir}A). Ratio: {(upstreamSettings.ir / downstreamSettings.ir).toFixed(2)}x
                    </span>
                  </div>
                  <Badge
                    className={`shrink-0 text-[10px] ${
                      coordinationResult.currentGradingOk
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {coordinationResult.currentGradingOk ? 'PASSED' : 'FAILED'}
                  </Badge>
                </div>

                {/* 2. Time Grading */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">
                      2. Short-Time Discrimination Margin (at 10x In)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Evaluated time separation between trip curves: {coordinationResult.timeMarginSeconds?.toFixed(2) ?? '—'}s (Margin required &ge; 0.25s)
                    </span>
                  </div>
                  <Badge
                    className={`shrink-0 text-[10px] ${
                      coordinationResult.timeGradingOk
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {coordinationResult.timeGradingOk ? 'PASSED' : 'FAILED'}
                  </Badge>
                </div>

                {/* 3. Energy Selectivity */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">
                      3. Energy Selectivity (I²t) / Tested Manufacturer Tables
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {coordinationResult.energySelectivityApplied
                        ? `Tested combination certified by ${upMfg} (ABB DOC / Schneider ECODIAL tables applied).`
                        : 'Parametric evaluation only (devices from differing manufacturers or generic specs).'}
                    </span>
                  </div>
                  <Badge
                    className={`shrink-0 text-[10px] ${
                      coordinationResult.energySelectivityApplied
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {coordinationResult.energySelectivityApplied ? 'CERTIFIED' : 'PARAMETRIC'}
                  </Badge>
                </div>

                {/* 4. Cable Thermal Withstand */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">
                      4. Cable Short-Circuit Withstand (k²S² &ge; I²t)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      IEC 60364-4-43 thermal damage check on {cableSizeMm2} mm² feeder under {faultCurrentKa} kA prospective fault.
                    </span>
                  </div>
                  <Badge
                    className={`shrink-0 text-[10px] ${
                      coordinationResult.cableDamageOk
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {coordinationResult.cableDamageOk ? 'PASSED' : 'DAMAGED'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Alternative Suggestions (if not full) */}
            {suggestions.length > 0 && (
              <Card className="border-orange-500/30 bg-orange-950/10 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    ProCal Intelligent Selectivity Fix Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {suggestions.map((sug) => (
                    <div key={sug.id} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-orange-400">
                          {sug.title}
                        </span>
                        <Badge className="bg-slate-800 text-slate-300 text-[9px] font-mono">
                          {sug.suggestedModel || sug.badge}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-300">{sug.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Full-Width Conversion Banner */}
        <div className="mt-8">
          <ProCalConversionBanner
            toolName="Protection Coordination & Selectivity"
            toolType="protection-coordination"
            calculationData={{
              upstream: upstreamSettings,
              downstream: downstreamSettings,
              faultCurrentKa,
              cableSizeMm2,
              status: coordinationResult.status,
              limitCurrent: coordinationResult.limitCurrent,
            }}
            headline="Avoid Total Blackouts with Automated Substation Selectivity"
            description="In ProCal, breaker settings across Main MV/LV Transformers, Sub-Distribution Panels (SMDB), and Floor Distribution Boards (DB) are continuously audited for 100% selective discrimination and cascading back-up protection."
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
            <Link href="/tools/motor-protection-calculator" className="hover:text-white transition-colors">Motor Protection</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
