import Link from "next/link";
import {
  Zap,
  Cable,
  CircuitBoard,
  GitBranch,
  FileText,
  Building2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden bg-grid-pattern selection:bg-orange-500 selection:text-white">
      {/* Background Radial Glow Beams */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[500px] bg-orange-600/15 blur-[120px] rounded-full" />
      <div className="pointer-events-none absolute right-10 top-1/3 w-[400px] h-[400px] bg-amber-500/10 blur-[100px] rounded-full" />
      <div className="pointer-events-none absolute left-10 bottom-10 w-[500px] h-[400px] bg-slate-800/20 blur-[100px] rounded-full" />

      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo Mark */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(234,88,12,0.3)] group-hover:scale-105 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"
                  fill="#ea580c"
                  stroke="#f97316"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                ProCal
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  PRO
                </span>
              </span>
              <p className="text-[10px] text-slate-400 tracking-wide font-mono uppercase">
                Electrical Calculation Suite
              </p>
            </div>
          </Link>

          {/* Action Navigation */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign In
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="glow" size="sm" className="gap-2">
                Launch App
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-medium mb-8 shadow-[0_0_15px_rgba(234,88,12,0.2)]">
          <Sparkles className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
          <span>Next-Generation Load Calculation & Electrical Design System</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1]">
          Precision Electrical Engineering{" "}
          <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
            Automated & Simplified
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
          Streamline building load calculations, cable schedule sizing, breaker coordination, single-line diagrams (SLD), and professional printable PDF reports for industrial projects.
        </p>

        {/* Hero CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="glow" size="lg" className="w-full sm:w-auto gap-2 px-8 py-6 text-base">
              Open Engineering Dashboard
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/projects" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 px-8 py-6 text-base">
              <Building2 className="w-5 h-5 text-orange-400" />
              Manage Projects
            </Button>
          </Link>
        </div>

        {/* Feature Pill Highlights */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-slate-400">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> IEC & NEC Standard Calculations
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Smart Switchgear & Protection Catalog
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Automated Riser & SLD Generation
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Printable PDF Schedules
          </span>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <div className="text-center mb-16">
          <Badge variant="glow" className="mb-3">
            Core Modules
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Comprehensive Electrical Engineering Suite
          </h2>
          <p className="text-slate-400 mt-2 max-w-2xl mx-auto">
            Everything you need from preliminary load sizing to final switchboard single-line diagram output.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="glow-card border-white/10">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-orange-600/15 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-2">
                <Zap className="w-6 h-6" />
              </div>
              <CardTitle>Building Load Calculator</CardTitle>
              <CardDescription>
                Calculate connected, demand, and diversified power requirements across complex multi-building and multi-floor structures.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/calculator" className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300">
                Launch Calculator <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>

          <Card className="glow-card border-white/10">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-amber-600/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
                <Cable className="w-6 h-6" />
              </div>
              <CardTitle>Cable Sizing & Voltage Drop</CardTitle>
              <CardDescription>
                Automate conductor sizing, insulation selection, parallel runs, and voltage drop validation for distribution cables.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/cable-schedule" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300">
                Open Cable Schedule <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>

          <Card className="glow-card border-white/10">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                <CircuitBoard className="w-6 h-6" />
              </div>
              <CardTitle>Breaker & Protection Selection</CardTitle>
              <CardDescription>
                Match MCCBs, MCBs, and ACB protection devices with exact trip ratings, breaking capacities, and frame sizes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/breaker-schedule" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                View Breakers <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>

          <Card className="glow-card border-white/10">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-sky-600/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-2">
                <Cpu className="w-6 h-6" />
              </div>
              <CardTitle>Panel & Switchboard Designer</CardTitle>
              <CardDescription>
                Design distribution board layouts, busbar ratings, phase balancing (R-Y-B), and spare circuit allocations.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/panel" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300">
                Configure Panels <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>

          <Card className="glow-card border-white/10">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2">
                <GitBranch className="w-6 h-6" />
              </div>
              <CardTitle>Interactive SLD & Riser Diagrams</CardTitle>
              <CardDescription>
                Generate dynamic single line diagrams and vertical building riser trees automatically linked to project data.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/sld" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                Open SLD Designer <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>

          <Card className="glow-card border-white/10">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-rose-600/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
                <FileText className="w-6 h-6" />
              </div>
              <CardTitle>Printable Executive PDF Reports</CardTitle>
              <CardDescription>
                Export high-resolution cover sheets, bill of materials (BOM), schedule tables, and SLD views ready for submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/reports" className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300">
                Generate Reports <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-bold">
              ⚡
            </div>
            <span>ProCal Electrical Calculation Platform &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/projects" className="hover:text-white transition-colors">
              Projects
            </Link>
            <Link href="/settings" className="hover:text-white transition-colors">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
