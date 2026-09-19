'use client';

import React from 'react';
import Link from 'next/link';
import {
  Zap,
  Cable,
  Activity,
  Cpu,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  Server,
  TrendingDown,
  Gauge,
  AlertTriangle,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ToolsIndexPage() {
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 mb-3 text-xs">
            Free Electrical Engineering Utilities
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Online Calculators for MEP & Electrical Engineers
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Fast, standards-compliant web tools built on verified IEC 60364, IEC 60909, IEC 61439, and IEC 60947 calculation engines.
            Zero friction, no login required.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tool 1: Cable Sizer (Live) */}
          <Card className="border-orange-500/40 bg-gradient-to-b from-slate-900/80 to-slate-950 border relative overflow-hidden group hover:border-orange-500/80 transition-all shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-400 group-hover:scale-110 transition-transform">
                <Cable className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg text-white">
                IEC 60364 Cable & Breaker Sizer
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Automatic conductor cross-section, derating factors (kt, kg), breaker coordination (Ib ≤ In ≤ Iz), and voltage drop compliance.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60364-5-52</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60364-4-43</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">58+ Methods</span>
              </div>
              <Link href="/tools/cable-sizer">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2">
                  Launch Cable Sizer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 2: Short Circuit (Live) */}
          <Card className="border-orange-500/40 bg-gradient-to-b from-slate-900/80 to-slate-950 border relative overflow-hidden group hover:border-orange-500/80 transition-all shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-400 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg text-white">
                Short-Circuit & Breaker Icu Sizer
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Transformer prospective fault current (Ik''), peak making current (Ip), downstream feeder cable attenuation, and breaker Icu sizing.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60909</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60076</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Cable Attenuation</span>
              </div>
              <Link href="/tools/short-circuit-calculator">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2">
                  Launch Fault Calculator
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 3: Max Cable Length (Live) */}
          <Card className="border-orange-500/40 bg-gradient-to-b from-slate-900/80 to-slate-950 border relative overflow-hidden group hover:border-orange-500/80 transition-all shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-400 group-hover:scale-110 transition-transform">
                <TrendingDown className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg text-white">
                Maximum Cable Run Length Matrix
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Calculate maximum permissible circuit length across all standard cable sizes before exceeding voltage drop limits (3%, 4%, 5%).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60364-5-52 §525</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Distance Matrix</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Thermal Gate</span>
              </div>
              <Link href="/tools/max-cable-length">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2">
                  Launch Length Matrix
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 4: Transformer & Generator Sizing (Live) */}
          <Card className="border-orange-500/40 bg-gradient-to-b from-slate-900/80 to-slate-950 border relative overflow-hidden group hover:border-orange-500/80 transition-all shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-400 group-hover:scale-110 transition-transform">
                <Server className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg text-white">
                Transformer & Generator Sizing
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Substation transformer (kVA) and standby diesel generator rating selection with motor starting surge analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60076</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Standby Gen</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Inrush Sizing</span>
              </div>
              <Link href="/tools/transformer-generator-sizer">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2">
                  Launch Transformer Sizer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 5: Maximum Demand & Coincidence Factor (Live) */}
          <Card className="border-orange-500/40 bg-gradient-to-b from-slate-900/80 to-slate-950 border relative overflow-hidden group hover:border-orange-500/80 transition-all shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-400 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg text-white">
                Maximum Demand & Coincidence
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                IEC 61439-2 Clause 10.10 coincidence factor and main incomer design current (Ib) for residential and commercial multi-building complexes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 61439-2 §10.10</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">NF C 14-100</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Multi-Unit</span>
              </div>
              <Link href="/tools/max-demand-calculator">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2">
                  Launch Demand Sizer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 6: Motor & HVAC Protection Sizer (Live) */}
          <Card className="border-orange-500/40 bg-gradient-to-b from-slate-900/80 to-slate-950 border relative overflow-hidden group hover:border-orange-500/80 transition-all shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-400 group-hover:scale-110 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg text-white">
                Motor & HVAC Electrical Protection
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Full Load Current (FLC), starting inrush spikes, MPCB / overload dial settings, AC-3 contactors, and motor feeder cable run.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60947-4-1</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">AC-3 Sizing</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Starting ΔV</span>
              </div>
              <Link href="/tools/motor-protection-calculator">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2">
                  Launch Motor Sizer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 7: Protection Coordination & Selectivity (Live) */}
          <Card className="border-orange-500/40 bg-gradient-to-b from-slate-900/80 to-slate-950 border relative overflow-hidden group hover:border-orange-500/80 transition-all shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-400 group-hover:scale-110 transition-transform">
                <Workflow className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg text-white">
                Protection Coordination & Selectivity
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Verify upstream/downstream circuit breaker discrimination, current & time grading, energy selectivity tables, and cable thermal withstand.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60947-2</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">IEC 60898-1</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Energy (I²t)</span>
              </div>
              <Link href="/tools/protection-coordination">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2">
                  Launch Selectivity Tool
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Banner */}
        <div className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold text-white">Ready for complete electrical load schedules?</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              ProCal connects all your calculations: multi-floor apartment schedules, commercial diversity,
              riser voltage drop distribution, breaker discrimination, and automated Single Line Diagrams.
            </p>
          </div>
          <Link href="/signup" className="shrink-0">
            <Button className="bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm px-6 py-2 shadow-lg shadow-orange-600/30 gap-2">
              Start Free ProCal Project
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
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
            <Link href="/tools/cable-sizer" className="hover:text-white transition-colors">Cable Sizer</Link>
            <Link href="/tools/short-circuit-calculator" className="hover:text-white transition-colors">Short Circuit</Link>
            <Link href="/tools/max-cable-length" className="hover:text-white transition-colors">Max Length</Link>
            <Link href="/tools/transformer-generator-sizer" className="hover:text-white transition-colors">Transformers</Link>
            <Link href="/tools/max-demand-calculator" className="hover:text-white transition-colors">Max Demand</Link>
            <Link href="/tools/motor-protection-calculator" className="hover:text-white transition-colors">Motor Sizer</Link>
            <Link href="/tools/protection-coordination" className="hover:text-white transition-colors">Selectivity</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
