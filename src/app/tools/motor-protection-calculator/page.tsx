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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sizeCableAndBreaker, calculateVoltageDrop } from '@/lib/calculations/cables';
import ProCalConversionBanner from '@/components/ProCalConversionBanner';

// Standard AC-3 Contactor Ratings (Amperes)
const STANDARD_CONTACTOR_RATINGS = [
  9, 12, 18, 25, 32, 38, 40, 50, 65, 80, 95, 115, 150, 185, 225, 265, 330, 400, 500, 630, 800,
];

// Standard MPCB Thermal Overload Ranges [min, max] in Amperes
const STANDARD_MPCB_RANGES: [number, number][] = [
  [0.1, 0.16],
  [0.16, 0.25],
  [0.25, 0.4],
  [0.4, 0.63],
  [0.63, 1.0],
  [1.0, 1.6],
  [1.6, 2.5],
  [2.5, 4.0],
  [4.0, 6.3],
  [6.3, 10.0],
  [9.0, 14.0],
  [13.0, 18.0],
  [17.0, 23.0],
  [20.0, 25.0],
  [24.0, 32.0],
  [32.0, 40.0],
  [40.0, 50.0],
  [50.0, 65.0],
  [65.0, 80.0],
  [70.0, 100.0],
];

export default function MotorProtectionCalculatorPage() {
  // Input states
  const [powerUnit, setPowerUnit] = useState<'kW' | 'HP'>('kW');
  const [powerInput, setPowerInput] = useState<string>('37'); // 37 kW (~50 HP) default
  const [voltage, setVoltage] = useState<number>(400);
  const [isThreePhase, setIsThreePhase] = useState<boolean>(true);
  const [efficiencyClass, setEfficiencyClass] = useState<'IE1' | 'IE2' | 'IE3' | 'IE4' | 'CUSTOM'>('IE3');
  const [customEfficiencyInput, setCustomEfficiencyInput] = useState<string>('93.5');
  const [powerFactor, setPowerFactor] = useState<number>(0.86);

  // Starting method
  const [startingMethod, setStartingMethod] = useState<'DOL' | 'STAR_DELTA' | 'SOFT_STARTER' | 'VFD'>('DOL');

  // Cable parameters
  const [lengthInput, setLengthInput] = useState<string>('40');
  const [cableMaterial, setCableMaterial] = useState<'copper' | 'aluminum'>('copper');
  const [cableInsulation, setCableInsulation] = useState<'XLPE' | 'PVC'>('XLPE');
  const [maxStartingVdPercent, setMaxStartingVdPercent] = useState<number>(15.0);
  const [maxRunningVdPercent, setMaxRunningVdPercent] = useState<number>(3.0);

  const [copied, setCopied] = useState<boolean>(false);

  // Derived numeric inputs
  const powerValue = useMemo(() => {
    const val = parseFloat(powerInput);
    return isNaN(val) ? 0 : val;
  }, [powerInput]);

  const lengthMeters = useMemo(() => {
    const val = parseFloat(lengthInput);
    return isNaN(val) || val <= 0 ? 1 : val;
  }, [lengthInput]);

  const customEfficiency = useMemo(() => {
    const val = parseFloat(customEfficiencyInput);
    return isNaN(val) ? 90 : val;
  }, [customEfficiencyInput]);

  // Synchronize voltage when phase toggles
  const handlePhaseChange = (threePhase: boolean) => {
    setIsThreePhase(threePhase);
    if (threePhase && voltage === 230) {
      setVoltage(400);
    } else if (!threePhase && voltage === 400) {
      setVoltage(230);
    }
  };

  // Convert power value when toggling unit between kW and HP
  const handleUnitChange = (newUnit: 'kW' | 'HP') => {
    if (newUnit === powerUnit) return;
    const currentVal = parseFloat(powerInput);
    if (!isNaN(currentVal) && currentVal > 0) {
      if (newUnit === 'HP') {
        setPowerInput((currentVal / 0.7457).toFixed(1).replace(/\.0$/, ''));
      } else {
        setPowerInput((currentVal * 0.7457).toFixed(1).replace(/\.0$/, ''));
      }
    }
    setPowerUnit(newUnit);
  };

  // Resolve Motor Active Power in kW
  const powerKw = useMemo(() => {
    if (powerUnit === 'HP') {
      return (powerValue || 0) * 0.7457;
    }
    return powerValue || 0;
  }, [powerUnit, powerValue]);

  // Resolve Motor Efficiency (%)
  const efficiencyPercent = useMemo(() => {
    if (efficiencyClass === 'IE1') return 87.0;
    if (efficiencyClass === 'IE2') return 90.5;
    if (efficiencyClass === 'IE3') return 93.5;
    if (efficiencyClass === 'IE4') return 95.5;
    return Math.min(99.9, Math.max(50, customEfficiency || 90));
  }, [efficiencyClass, customEfficiency]);

  // Calculations
  const results = useMemo(() => {
    const pKw = Math.max(0.1, powerKw);
    const eta = Math.min(0.999, Math.max(0.5, efficiencyPercent / 100));
    const pf = Math.min(0.99, Math.max(0.6, powerFactor || 0.85));
    const v = Math.max(100, voltage || 400);

    // Motor Input Power
    const inputKw = pKw / eta;
    const inputKva = inputKw / pf;

    // Full Load Current (FLC)
    const flc = isThreePhase
      ? (inputKw * 1000) / (Math.sqrt(3) * v * pf)
      : (inputKw * 1000) / (v * pf);

    // Starting Inrush Multipliers
    let inrushMultiplier = 6.5;
    let startingPf = 0.35;
    if (startingMethod === 'STAR_DELTA') {
      inrushMultiplier = 2.2; // 1/3 of DOL
      startingPf = 0.35;
    } else if (startingMethod === 'SOFT_STARTER') {
      inrushMultiplier = 3.2;
      startingPf = 0.5;
    } else if (startingMethod === 'VFD') {
      inrushMultiplier = 1.1;
      startingPf = 0.95;
    }

    const startingCurrent = flc * inrushMultiplier;

    // Protection Sizing per IEC 60947-4-1
    // MPCB / Overload Setting: Ir = 1.0 * FLC
    const recommendedIr = flc;
    const irMin = flc * 0.95;
    const irMax = flc * 1.05;

    // Find suitable MPCB range
    let recommendedMpcbRange: [number, number] | null = null;
    if (flc <= 100) {
      for (const [min, max] of STANDARD_MPCB_RANGES) {
        if (flc >= min && flc <= max) {
          recommendedMpcbRange = [min, max];
          break;
        }
      }
    }

    // Magnetic Trip Setting (Instantaneous / Short-Circuit)
    // DOL needs ~12x FLC to avoid nuisance trip on starting surge
    const magMultiplier = startingMethod === 'DOL' ? 13 : startingMethod === 'STAR_DELTA' ? 9 : 8;
    const magneticTripA = flc * magMultiplier;

    // Contactor Sizing (AC-3 Duty)
    const nextContactor = (targetCurrent: number) => {
      const match = STANDARD_CONTACTOR_RATINGS.find((r) => r >= targetCurrent);
      return match || STANDARD_CONTACTOR_RATINGS[STANDARD_CONTACTOR_RATINGS.length - 1];
    };

    let contactorMain: number;
    let contactorDelta: number | null = null;
    let contactorStar: number | null = null;

    if (startingMethod === 'STAR_DELTA') {
      // Main & Delta carry I_FLC / sqrt(3) = 0.58 * I_FLC
      contactorMain = nextContactor(flc / Math.sqrt(3));
      contactorDelta = contactorMain;
      // Star contactor carries I_FLC / 3 = 0.33 * I_FLC
      contactorStar = nextContactor(flc / 3);
    } else {
      // DOL, Soft-Starter, VFD
      contactorMain = nextContactor(flc);
    }

    // Cable & Breaker Sizing (Running only baseline)
    let runningOnlySizing = null;
    try {
      runningOnlySizing = sizeCableAndBreaker(flc, isThreePhase, {
        material: cableMaterial,
        insulation: cableInsulation,
        ambientTemp: 30,
        groupingCount: 1,
        installMethod: 'C',
        code: 'IEC',
        voltageDrop: {
          lengthMeters: Math.max(1, lengthMeters),
          powerFactor: pf,
          systemVoltage: v,
          maxPercent: maxRunningVdPercent,
        },
      });
    } catch {
      runningOnlySizing = null;
    }

    // Cable & Breaker Sizing with Starting Inrush Voltage Drop Enforcement
    let cableSizing = null;
    try {
      cableSizing = sizeCableAndBreaker(flc, isThreePhase, {
        material: cableMaterial,
        insulation: cableInsulation,
        ambientTemp: 30,
        groupingCount: 1,
        installMethod: 'C',
        code: 'IEC',
        voltageDrop: {
          lengthMeters: Math.max(1, lengthMeters),
          powerFactor: pf,
          systemVoltage: v,
          maxPercent: maxRunningVdPercent,
        },
        startingVoltageDrop: {
          startingCurrent,
          powerFactor: startingPf,
          maxPercent: maxStartingVdPercent,
        },
      });
    } catch {
      cableSizing = null;
    }

    const sizedForStarting =
      cableSizing && runningOnlySizing
        ? cableSizing.cableSize > runningOnlySizing.cableSize || cableSizing.parallelRuns > runningOnlySizing.parallelRuns
        : false;

    // Starting Voltage Drop Check
    let startingVdResult = null;
    if (cableSizing) {
      if (cableSizing.startingDropPercent !== undefined && cableSizing.startingDropVolts !== undefined) {
        startingVdResult = {
          dropPercent: cableSizing.startingDropPercent,
          dropVolts: cableSizing.startingDropVolts,
        };
      } else {
        startingVdResult = calculateVoltageDrop(
          startingCurrent,
          Math.max(1, lengthMeters),
          cableSizing.cableSize,
          startingPf,
          isThreePhase,
          v,
          cableSizing.parallelRuns,
          cableMaterial,
          cableInsulation
        );
      }
    }

    return {
      powerKw,
      flc,
      startingCurrent,
      inrushMultiplier,
      startingPf,
      inputKw,
      inputKva,
      recommendedIr,
      irMin,
      irMax,
      recommendedMpcbRange,
      magneticTripA,
      contactorMain,
      contactorDelta,
      contactorStar,
      cableSizing,
      runningOnlySizing,
      sizedForStarting,
      startingVdResult,
    };
  }, [
    powerKw,
    efficiencyPercent,
    powerFactor,
    voltage,
    isThreePhase,
    startingMethod,
    lengthMeters,
    cableMaterial,
    cableInsulation,
    maxRunningVdPercent,
    maxStartingVdPercent,
  ]);

  // Copy Summary text
  const copySummaryText = useMemo(() => {
    return `--- PROCAL MOTOR & HVAC ELECTRICAL SIZING (IEC 60947-4-1) ---
Motor Rating: ${powerKw.toFixed(1)} kW (${(powerKw / 0.7457).toFixed(1)} HP)
Voltage: ${voltage}V ${isThreePhase ? '3-Phase' : '1-Phase'}
Efficiency: ${efficiencyPercent}% (${efficiencyClass}) | Power Factor: ${powerFactor}
Starting Method: ${startingMethod.replace('_', ' ')}

Operating Current & Surge:
- Full Load Current (FLC): ${results.flc.toFixed(1)} A
- Starting Inrush Current: ${results.startingCurrent.toFixed(1)} A (${results.inrushMultiplier}x FLC)
- Input Active / Apparent Power: ${results.inputKw.toFixed(1)} kW / ${results.inputKva.toFixed(1)} kVA

Switchgear & Protection (IEC 60947-4-1):
- Thermal Overload (Ir): Set to ${results.recommendedIr.toFixed(1)} A (Dial range: ${results.recommendedMpcbRange ? `${results.recommendedMpcbRange[0]}–${results.recommendedMpcbRange[1]} A` : 'MCCB Electronic Trip'})
- Magnetic Trip (Im): ${results.magneticTripA.toFixed(0)} A
- Contactor AC-3: ${
      startingMethod === 'STAR_DELTA'
        ? `KM1 (Main): ${results.contactorMain}A | KM2 (Delta): ${results.contactorDelta}A | KM3 (Star): ${results.contactorStar}A`
        : `Main Contactor: ${results.contactorMain}A (AC-3)`
    }

Cable & Voltage Drop:
- Feeder Cable: ${results.cableSizing?.formattedCableSize ?? '—'} (${cableMaterial.toUpperCase()} / ${cableInsulation})
- Running Voltage Drop: ${results.cableSizing?.dropVolts?.toFixed(1) ?? '—'} V (${results.cableSizing?.dropPercent?.toFixed(2) ?? '—'}%)
- Starting Voltage Drop: ${results.startingVdResult?.dropVolts.toFixed(1) ?? '—'} V (${results.startingVdResult?.dropPercent.toFixed(2) ?? '—'}%) [Limit: ${maxStartingVdPercent}%]

Generated with ProCal (https://procal.app/tools/motor-protection-calculator)`;
  }, [
    powerKw,
    voltage,
    isThreePhase,
    efficiencyPercent,
    efficiencyClass,
    powerFactor,
    startingMethod,
    results,
    cableMaterial,
    cableInsulation,
    maxStartingVdPercent,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copySummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const startingVdOk = (results.startingVdResult?.dropPercent ?? 0) <= maxStartingVdPercent;
  const runningVdOk = (results.cableSizing?.dropPercent ?? 0) <= maxRunningVdPercent;

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
            <span className="text-slate-200">Motor & HVAC Protection</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                Motor & HVAC Protection Sizer
                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[10px] font-mono">
                  IEC 60947-4-1
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Full Load Current (FLC), starting inrush spikes, MPCB / overload dial settings, AC-3 contactors, and motor feeder cable run.
              </p>
            </div>

            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs gap-2 shrink-0 self-start md:self-auto"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy Sizing Summary'}
            </Button>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Inputs (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-orange-400" />
                  Motor Nameplate Specifications
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Mechanical shaft power, voltage supply, and efficiency rating
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {/* Power input with kW/HP toggle */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-xs font-medium">Rated Mechanical Power</Label>
                    <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => handleUnitChange('kW')}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          powerUnit === 'kW' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        kW
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitChange('HP')}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          powerUnit === 'HP' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        HP
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={powerInput}
                      onChange={(e) => setPowerInput(e.target.value)}
                      className="bg-slate-950 border-slate-800 font-mono text-sm pr-12 focus:border-orange-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                      {powerUnit}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Equivalent: {powerUnit === 'kW' ? `${(powerValue / 0.7457).toFixed(1)} HP` : `${(powerValue * 0.7457).toFixed(1)} kW`}
                  </span>
                </div>

                {/* Supply Voltage & Phase */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">System Phase</Label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handlePhaseChange(true)}
                        className={`py-1.5 rounded font-medium text-center transition-colors ${
                          isThreePhase ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        3-Phase
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePhaseChange(false)}
                        className={`py-1.5 rounded font-medium text-center transition-colors ${
                          !isThreePhase ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        1-Phase
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-medium">Voltage (V)</Label>
                    <div className="relative">
                      <select
                        value={voltage}
                        onChange={(e) => setVoltage(parseInt(e.target.value, 10))}
                        className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 px-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-orange-500 appearance-none"
                      >
                        {isThreePhase ? (
                          <>
                            <option value={400}>400 V (Standard EU/IEC)</option>
                            <option value={380}>380 V (Standard MEA/Asia)</option>
                            <option value={415}>415 V (UK Standard)</option>
                            <option value={690}>690 V (Heavy Industrial)</option>
                          </>
                        ) : (
                          <>
                            <option value={230}>230 V (Single Phase EU)</option>
                            <option value={220}>220 V (Single Phase MEA)</option>
                            <option value={240}>240 V (Single Phase UK)</option>
                          </>
                        )}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Efficiency Class */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs font-medium">Efficiency Class (IEC 60034-30-1)</Label>
                  <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[10px]">
                    {(['IE1', 'IE2', 'IE3', 'IE4', 'CUSTOM'] as const).map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setEfficiencyClass(cls)}
                        className={`py-1 rounded font-medium text-center transition-colors ${
                          efficiencyClass === cls ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>Effective η: {efficiencyPercent}%</span>
                    {efficiencyClass === 'CUSTOM' && (
                      <div className="w-24">
                        <Input
                          type="number"
                          step="0.5"
                          min="50"
                          max="99"
                          value={customEfficiencyInput}
                          onChange={(e) => setCustomEfficiencyInput(e.target.value)}
                          className="h-6 text-[10px] bg-slate-950 border-slate-800 text-right"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Power Factor */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-slate-300 text-xs font-medium">Power Factor (cos φ)</Label>
                    <span className="font-mono text-xs text-orange-400">{powerFactor.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.70"
                    max="0.95"
                    step="0.01"
                    value={powerFactor}
                    onChange={(e) => setPowerFactor(parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.70 (Small Induction)</span>
                    <span>0.86 (Typical 30kW+)</span>
                    <span>0.95 (High PF)</span>
                  </div>
                </div>

                {/* Starting Method */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <Label className="text-slate-300 text-xs font-medium flex items-center justify-between">
                    <span>Starting Method & Inrush Control</span>
                    <span className="text-[10px] text-orange-400 font-mono">
                      {startingMethod === 'DOL'
                        ? '6.5x Inrush'
                        : startingMethod === 'STAR_DELTA'
                        ? '2.2x Inrush (1/3)'
                        : startingMethod === 'SOFT_STARTER'
                        ? '3.2x Ramp'
                        : '1.1x No Inrush'}
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStartingMethod('DOL')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        startingMethod === 'DOL'
                          ? 'border-orange-500/60 bg-orange-600/10 text-white'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold block text-xs">Direct-On-Line (DOL)</span>
                      <span className="text-[10px] text-slate-500">6–8x FLC inrush spike</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStartingMethod('STAR_DELTA')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        startingMethod === 'STAR_DELTA'
                          ? 'border-orange-500/60 bg-orange-600/10 text-white'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold block text-xs">Star-Delta (Y-Δ)</span>
                      <span className="text-[10px] text-slate-500">2–2.5x inrush, 3 contactors</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStartingMethod('SOFT_STARTER')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        startingMethod === 'SOFT_STARTER'
                          ? 'border-orange-500/60 bg-orange-600/10 text-white'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold block text-xs">Solid-State Soft Starter</span>
                      <span className="text-[10px] text-slate-500">3–3.5x voltage ramp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStartingMethod('VFD')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        startingMethod === 'VFD'
                          ? 'border-orange-500/60 bg-orange-600/10 text-white'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold block text-xs">Variable Speed (VFD)</span>
                      <span className="text-[10px] text-slate-500">1.0–1.2x continuous ramp</span>
                    </button>
                  </div>
                </div>

                {/* Cable parameters */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-xs font-medium">Feeder Cable Run</Label>
                    <span className="text-[10px] text-slate-400 font-mono">{lengthMeters} meters</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 block">Length (m)</span>
                      <Input
                        type="number"
                        min="1"
                        value={lengthInput}
                        onChange={(e) => setLengthInput(e.target.value)}
                        className="bg-slate-950 border-slate-800 font-mono text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 block">Conductor</span>
                      <select
                        value={cableMaterial}
                        onChange={(e) => setCableMaterial(e.target.value as any)}
                        className="w-full h-8 rounded-md bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200"
                      >
                        <option value="copper">Copper (Cu)</option>
                        <option value="aluminum">Aluminum (Al)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 block">Insulation</span>
                      <select
                        value={cableInsulation}
                        onChange={(e) => setCableInsulation(e.target.value as any)}
                        className="w-full h-8 rounded-md bg-slate-950 border border-slate-800 px-2 text-xs font-mono text-slate-200"
                      >
                        <option value="XLPE">XLPE (90°C)</option>
                        <option value="PVC">PVC (70°C)</option>
                      </select>
                    </div>
                  </div>

                  {/* Voltage Drop Threshold Selectors */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Max Running ΔV</span>
                        <span className="font-mono text-orange-400">{maxRunningVdPercent}%</span>
                      </span>
                      <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[10px]">
                        {[3.0, 5.0].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setMaxRunningVdPercent(pct)}
                            className={`py-1 rounded font-medium text-center transition-colors ${
                              maxRunningVdPercent === pct
                                ? 'bg-orange-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Max Starting ΔV</span>
                        <span className="font-mono text-orange-400">{maxStartingVdPercent}%</span>
                      </span>
                      <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-[10px]">
                        {[10.0, 15.0, 20.0].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setMaxStartingVdPercent(pct)}
                            className={`py-1 rounded font-medium text-center transition-colors ${
                              maxStartingVdPercent === pct
                                ? 'bg-orange-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Sizing Results & Switchgear Specifications (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Primary KPI Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <span className="text-[11px] text-slate-400 block mb-0.5">Full Load Current</span>
                <span className="text-xl font-bold font-mono text-white">
                  {results.flc.toFixed(1)}{' '}
                  <span className="text-xs text-orange-400 font-normal">A</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  cos φ = {powerFactor}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <span className="text-[11px] text-slate-400 block mb-0.5">Starting Inrush</span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {results.startingCurrent.toFixed(1)}{' '}
                  <span className="text-xs text-amber-400/80 font-normal">A</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {results.inrushMultiplier}x FLC peak
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <span className="text-[11px] text-slate-400 block mb-0.5">Input Power</span>
                <span className="text-xl font-bold font-mono text-slate-200">
                  {results.inputKw.toFixed(1)}{' '}
                  <span className="text-xs text-slate-400 font-normal">kW</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {results.inputKva.toFixed(1)} kVA Apparent
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-md">
                <span className="text-[11px] text-slate-400 block mb-0.5">Contactor AC-3</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {results.contactorMain}{' '}
                  <span className="text-xs text-emerald-400/80 font-normal">A</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  IEC 60947-4-1
                </span>
              </div>
            </div>

            {/* Switchgear & Protection Detailed Card */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-orange-400" />
                      Motor Protection Switchgear (IEC 60947-4-1)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      MPCB thermal setting dial, magnetic trip threshold, and contactor ratings
                    </CardDescription>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                    Type 2 Coordinated
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Thermal Overload Setting */}
                  <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">MPCB Thermal Overload (Ir)</span>
                      <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 font-mono text-[10px]">
                        1.0 x FLC
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-orange-400">
                        {results.recommendedIr.toFixed(1)} A
                      </span>
                      <span className="text-xs text-slate-400">dial setting</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {results.recommendedMpcbRange ? (
                        <>
                          Recommended MPCB thermal range:{' '}
                          <span className="font-mono text-white font-semibold">
                            {results.recommendedMpcbRange[0]} A – {results.recommendedMpcbRange[1]} A
                          </span>
                          . Adjust dial to exactly {results.recommendedIr.toFixed(1)} A.
                        </>
                      ) : (
                        <>
                          For FLC &gt; 100A, use an MCCB with an electronic motor protection trip unit (IEC 60947-2 Annex A).
                        </>
                      )}
                    </p>
                  </div>

                  {/* Magnetic Trip Setting */}
                  <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Magnetic Short-Circuit (Im)</span>
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700 font-mono text-[10px]">
                        Instantaneous
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-white">
                        {results.magneticTripA.toFixed(0)} A
                      </span>
                      <span className="text-xs text-slate-400">trip threshold</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Sized above starting inrush current ({results.startingCurrent.toFixed(1)} A) to prevent nuisance tripping during motor acceleration.
                    </p>
                  </div>
                </div>

                {/* Contactor Scheme */}
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Contactor Configuration (AC-3 Utilization Category)</span>
                    <span className="text-[10px] text-slate-400 font-mono">IEC 60947-4-1</span>
                  </div>

                  {startingMethod === 'STAR_DELTA' ? (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">KM1 (Main)</span>
                        <span className="text-base font-bold font-mono text-emerald-400">
                          {results.contactorMain} A
                        </span>
                        <span className="text-[9px] text-slate-500 block">0.58 x FLC</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">KM2 (Delta)</span>
                        <span className="text-base font-bold font-mono text-emerald-400">
                          {results.contactorDelta} A
                        </span>
                        <span className="text-[9px] text-slate-500 block">0.58 x FLC</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">KM3 (Star)</span>
                        <span className="text-base font-bold font-mono text-emerald-400">
                          {results.contactorStar} A
                        </span>
                        <span className="text-[9px] text-slate-500 block">0.33 x FLC</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                      <div>
                        <span className="text-xs font-medium text-white block">
                          Main Line Contactor (KM1)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Rated continuous AC-3 breaking capacity &ge; {results.flc.toFixed(1)} A
                        </span>
                      </div>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {results.contactorMain} A AC-3
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Feeder Cable & Voltage Drop Card */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-orange-400" />
                      Motor Feeder Cable Sizing & Starting Drop Verification
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      Continuous ampacity (Iz &ge; In) and starting voltage drop (&le; {maxStartingVdPercent}%) per IEC 60364-5-52
                    </CardDescription>
                  </div>
                  {results.sizedForStarting ? (
                    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-mono">
                      Upsized for Starting Inrush
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono">
                      Running Sizing Governs
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Selected Feeder Cable</span>
                    <span className="text-base font-bold font-mono text-white">
                      {results.cableSizing?.formattedCableSize ?? '—'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Iz = {results.cableSizing?.deratedAmpacity.toFixed(1) ?? '—'} A
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 block">Running ΔV</span>
                      <span className={`text-[10px] font-bold ${runningVdOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {runningVdOk ? 'PASSED' : 'EXCEEDED'}
                      </span>
                    </div>
                    <span className="text-base font-bold font-mono text-slate-200">
                      {results.cableSizing?.dropPercent?.toFixed(2) ?? '—'}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {results.cableSizing?.dropVolts?.toFixed(1) ?? '—'} V (Limit: {maxRunningVdPercent}%)
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 block">Starting ΔV</span>
                      <span className={`text-[10px] font-bold ${startingVdOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {startingVdOk ? 'PASSED' : 'EXCEEDED'}
                      </span>
                    </div>
                    <span className={`text-base font-bold font-mono ${startingVdOk ? 'text-amber-400' : 'text-rose-400'}`}>
                      {results.startingVdResult?.dropPercent.toFixed(2) ?? '—'}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {results.startingVdResult?.dropVolts.toFixed(1) ?? '—'} V (Limit: {maxStartingVdPercent}%)
                    </span>
                  </div>
                </div>

                {/* Sizing Context Information */}
                {results.sizedForStarting && startingVdOk && (
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      <strong className="font-semibold text-amber-300">Auto-Upsized for Motor Inrush:</strong> Continuous running ampacity requires only{' '}
                      <span className="font-mono font-bold text-white">{results.runningOnlySizing?.formattedCableSize}</span>. However, to prevent starting voltage sag from exceeding{' '}
                      <span className="font-mono font-bold text-white">{maxStartingVdPercent}%</span> during {startingMethod.replace('_', ' ')} inrush ({results.startingCurrent.toFixed(1)} A), the feeder cable has been automatically upsized to{' '}
                      <span className="font-mono font-bold text-white">{results.cableSizing?.formattedCableSize}</span>.
                    </p>
                  </div>
                )}

                {!startingVdOk && (
                  <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-rose-200 leading-relaxed">
                      <strong className="font-semibold">Starting Voltage Drop Exceeded:</strong> At {results.startingCurrent.toFixed(1)} A inrush, starting voltage drop ({results.startingVdResult?.dropPercent.toFixed(2)}%) exceeds the {maxStartingVdPercent}% threshold even with the largest available conductor arrangement. Recommendation: Switch from {startingMethod.replace('_', ' ')} to a Star-Delta (2.2x inrush), Soft Starter (3.2x inrush), or VFD (1.1x inrush) to reduce starting current and avoid excessive voltage dip.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full-Width Conversion Banner */}
        <div className="mt-8">
          <ProCalConversionBanner
            toolName="Motor & HVAC Electrical Sizer"
            toolType="motor-protection"
            calculationData={{
              powerKw,
              voltage,
              isThreePhase,
              efficiencyPercent,
              powerFactor,
              startingMethod,
              flc: results.flc,
              startingCurrent: results.startingCurrent,
              recommendedIr: results.recommendedIr,
              contactorMain: results.contactorMain,
              cableSize: results.cableSizing?.formattedCableSize,
            }}
            headline="Integrate Motor Loads Directly into Building Risers & SLDs"
            description="In ProCal, mechanical equipment schedules (chillers, AHUs, pumps, lifts) automatically sync to their respective MCC panels, calculate starting inrush on standby generators, and reflect on interactive Single Line Diagrams."
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
            <Link href="/tools/transformer-generator-sizer" className="hover:text-white transition-colors">Transformer Sizer</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
