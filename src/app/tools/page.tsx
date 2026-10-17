'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Cable,
  TrendingDown,
  Server,
  Layers,
  Cpu,
  Workflow,
  AlertTriangle,
  ArrowRight,
  Wrench,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToolsHeader, FREE_TOOLS } from '@/components/tools/ToolsHeader';

export default function ToolsIndexPage() {
  const router = useRouter();
  const [selectedTool, setSelectedTool] = useState<string>('/tools/cable-sizer');

  const handleLaunchSelected = () => {
    if (selectedTool) {
      router.push(selectedTool);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background-color,#030712)] text-[var(--foreground-color,#f8fafc)] selection:bg-orange-500 selection:text-white transition-colors duration-200">
      {/* Top Header with Logo, Tool Switcher Select Input, Theme & Language Selectors */}
      <ToolsHeader currentPath="/tools" />

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 px-3 py-1 mb-3 text-xs font-mono">
            Free Electrical Engineering Utilities
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--foreground-color,#f8fafc)] tracking-tight mb-4">
            Online Calculators for MEP &amp; Electrical Engineers
          </h1>
          <p className="text-[var(--table-header-color,#9ca3af)] text-sm sm:text-base leading-relaxed">
            Fast, standards-compliant web tools built on verified IEC 60364, IEC 60909, IEC 61439, and IEC 60947 calculation engines.
            Zero friction, no login required.
          </p>

          {/* Dedicated Tool Selector Input Bar */}
          <div className="mt-8 p-3 sm:p-4 rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] shadow-lg max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 pl-2 text-orange-500 shrink-0">
              <Wrench className="w-4 h-4" />
              <label htmlFor="hero-tool-select" className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-color,#f8fafc)] whitespace-nowrap">
                Choose Free Tool:
              </label>
            </div>
            <select
              id="hero-tool-select"
              aria-label="Choose a free electrical calculator to launch"
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="w-full flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg-subtle,#111827)] text-[var(--foreground-color,#f8fafc)] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all cursor-pointer shadow-xs"
            >
              {FREE_TOOLS.map((tool) => (
                <option key={tool.href} value={tool.href}>
                  {tool.icon} {tool.name}
                </option>
              ))}
            </select>
            <Button
              onClick={handleLaunchSelected}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs px-4 py-2 h-9 shadow-md shadow-orange-600/20 shrink-0 gap-1.5"
            >
              <span>Launch Tool</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tool 1: Cable Sizer (Live) */}
          <Card className="rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] relative overflow-hidden group hover:border-orange-500/60 transition-all shadow-md hover:shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <Cable className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-[var(--foreground-color,#f8fafc)]">
                IEC 60364 Cable &amp; Breaker Sizer
              </CardTitle>
              <CardDescription className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed">
                Automatic conductor cross-section, derating factors (kt, kg), breaker coordination (Ib ≤ In ≤ Iz), and voltage drop compliance.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-[var(--table-header-color,#9ca3af)] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60364-5-52</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60364-4-43</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">58+ Methods</span>
              </div>
              <Link href="/tools/cable-sizer">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2 font-semibold">
                  Launch Cable Sizer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 2: Short Circuit (Live) */}
          <Card className="rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] relative overflow-hidden group hover:border-orange-500/60 transition-all shadow-md hover:shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-[var(--foreground-color,#f8fafc)]">
                Short-Circuit &amp; Breaker Icu Sizer
              </CardTitle>
              <CardDescription className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed">
                Transformer prospective fault current (Ik&apos;&apos;), peak making current (Ip), downstream feeder cable attenuation, and breaker Icu sizing.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-[var(--table-header-color,#9ca3af)] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60909</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60076</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">Cable Attenuation</span>
              </div>
              <Link href="/tools/short-circuit-calculator">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2 font-semibold">
                  Launch Fault Calculator
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 3: Max Cable Length (Live) */}
          <Card className="rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] relative overflow-hidden group hover:border-orange-500/60 transition-all shadow-md hover:shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <TrendingDown className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-[var(--foreground-color,#f8fafc)]">
                Maximum Cable Run Length Matrix
              </CardTitle>
              <CardDescription className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed">
                Calculate maximum permissible circuit length across all standard cable sizes before exceeding voltage drop limits (3%, 4%, 5%).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-[var(--table-header-color,#9ca3af)] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60364-5-52 §525</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">Distance Matrix</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">Thermal Gate</span>
              </div>
              <Link href="/tools/max-cable-length">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2 font-semibold">
                  Launch Length Matrix
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 4: Transformer & Generator Sizing (Live) */}
          <Card className="rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] relative overflow-hidden group hover:border-orange-500/60 transition-all shadow-md hover:shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <Server className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-[var(--foreground-color,#f8fafc)]">
                Transformer &amp; Generator Sizing
              </CardTitle>
              <CardDescription className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed">
                Substation transformer (kVA) and standby diesel generator rating selection with motor starting surge analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-[var(--table-header-color,#9ca3af)] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60076</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">Standby Gen</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">Inrush Sizing</span>
              </div>
              <Link href="/tools/transformer-generator-sizer">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2 font-semibold">
                  Launch Transformer Sizer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 5: Maximum Demand & Coincidence Factor (Live) */}
          <Card className="rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] relative overflow-hidden group hover:border-orange-500/60 transition-all shadow-md hover:shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-[var(--foreground-color,#f8fafc)]">
                Maximum Demand &amp; Coincidence
              </CardTitle>
              <CardDescription className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed">
                IEC 61439-2 Clause 10.10 coincidence factor and main incomer design current (Ib) for residential and commercial complexes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-[var(--table-header-color,#9ca3af)] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 61439-2 §10.10</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">NF C 14-100</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">Multi-Unit</span>
              </div>
              <Link href="/tools/max-demand-calculator">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2 font-semibold">
                  Launch Demand Sizer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 6: Motor & HVAC Protection Sizer (Live) */}
          <Card className="rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] relative overflow-hidden group hover:border-orange-500/60 transition-all shadow-md hover:shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-[var(--foreground-color,#f8fafc)]">
                Motor &amp; HVAC Electrical Protection
              </CardTitle>
              <CardDescription className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed">
                Full Load Current (FLC), starting inrush spikes, MPCB / overload dial settings, AC-3 contactors, and motor feeder cable run.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-[var(--table-header-color,#9ca3af)] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60947-4-1</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">AC-3 Sizing</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">Starting ΔV</span>
              </div>
              <Link href="/tools/motor-protection-calculator">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2 font-semibold">
                  Launch Motor Sizer
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tool 7: Protection Coordination & Selectivity (Live) */}
          <Card className="rounded-2xl border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] relative overflow-hidden group hover:border-orange-500/60 transition-all shadow-md hover:shadow-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white uppercase rounded-bl-lg tracking-wider">
              Live
            </div>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-2 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <Workflow className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-[var(--foreground-color,#f8fafc)]">
                Protection Coordination &amp; Selectivity
              </CardTitle>
              <CardDescription className="text-xs text-[var(--table-header-color,#9ca3af)] leading-relaxed">
                Verify upstream/downstream circuit breaker discrimination, current &amp; time grading, energy selectivity tables, and cable thermal withstand.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-[var(--table-header-color,#9ca3af)] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60947-2</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">IEC 60898-1</span>
                <span className="px-2 py-0.5 rounded bg-[var(--card-bg-subtle,#111827)] border border-[var(--border-color,#1f2937)]">Energy (I²t)</span>
              </div>
              <Link href="/tools/protection-coordination">
                <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs gap-2 font-semibold">
                  Launch Selectivity Tool
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Banner */}
        <div className="mt-16 p-6 sm:p-8 rounded-2xl bg-[var(--card-bg,#0b0f19)] border border-orange-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold text-[var(--foreground-color,#f8fafc)]">
              Ready for complete electrical load schedules?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--table-header-color,#9ca3af)] max-w-xl">
              ProCal connects all your calculations: multi-floor apartment schedules, commercial diversity,
              riser voltage drop distribution, breaker discrimination, and automated Single Line Diagrams.
            </p>
          </div>
          <Link href="/signup" className="shrink-0">
            <Button className="bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm px-6 py-2 shadow-lg shadow-orange-600/30 gap-2">
              Start Free ProCal Project
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)] py-8 text-center text-xs text-[var(--table-header-color,#9ca3af)] mt-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-[var(--foreground-color,#f8fafc)] font-semibold">ProCal</span> — Low Voltage Electrical Design, <span className="text-orange-500 font-semibold">Solved</span>.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[var(--table-header-color,#9ca3af)]">
            <Link href="/" className="hover:text-[var(--foreground-color,#f8fafc)] transition-colors">Home</Link>
            <Link href="/tools/cable-sizer" className="hover:text-[var(--foreground-color,#f8fafc)] transition-colors">Cable Sizer</Link>
            <Link href="/tools/short-circuit-calculator" className="hover:text-[var(--foreground-color,#f8fafc)] transition-colors">Short Circuit</Link>
            <Link href="/tools/max-cable-length" className="hover:text-[var(--foreground-color,#f8fafc)] transition-colors">Max Length</Link>
            <Link href="/tools/transformer-generator-sizer" className="hover:text-[var(--foreground-color,#f8fafc)] transition-colors">Transformers</Link>
            <Link href="/tools/max-demand-calculator" className="hover:text-[var(--foreground-color,#f8fafc)] transition-colors">Max Demand</Link>
            <Link href="/tools/motor-protection-calculator" className="hover:text-[var(--foreground-color,#f8fafc)] transition-colors">Motor Sizer</Link>
            <Link href="/tools/protection-coordination" className="hover:text-[var(--foreground-color,#f8fafc)] transition-colors">Selectivity</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
