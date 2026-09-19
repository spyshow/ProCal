'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Layers,
  GitBranch,
  FileSpreadsheet,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ProCalConversionBannerProps {
  toolName: string;
  toolType: string;
  calculationData: Record<string, any>;
  headline?: string;
  description?: string;
}

export default function ProCalConversionBanner({
  toolName,
  toolType,
  calculationData,
  headline = 'Stop re-typing calculations into manual spreadsheets',
  description = 'In ProCal, your cables, breakers, transformer fault levels, and diversity factors are automatically synchronized across multi-floor risers and exportable Single Line Diagrams.',
}: ProCalConversionBannerProps) {
  const router = useRouter();

  const handleOpenInWorkspace = () => {
    try {
      const payload = {
        sourceTool: toolName,
        sourceType: toolType,
        timestamp: new Date().toISOString(),
        data: calculationData,
      };
      localStorage.setItem('procal_pending_import', JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
    router.push(`/signup?from=${encodeURIComponent(toolType)}`);
  };

  return (
    <Card className="border-orange-500/30 bg-gradient-to-br from-orange-950/30 via-slate-900 to-slate-950 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-cyan-400 tracking-wider">
            ProCal : Low-Voltage Electrical Design, Solved
          </span>
        </div>

        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            {headline}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Feature comparison highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-2">
            <Layers className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block text-[11px]">Multi-Floor Risers</span>
              <span className="text-[10px] text-slate-400">IEC 61439-2 automated diversity across towers</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-2">
            <GitBranch className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block text-[11px]">Dynamic SLD Generation</span>
              <span className="text-[10px] text-slate-400">Interactive Single Line Diagram with live breaker sync</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-2">
            <FileSpreadsheet className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block text-[11px]">1-Click Export</span>
              <span className="text-[10px] text-slate-400">Compliant PDF & Excel calculation schedules</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <Button
            onClick={handleOpenInWorkspace}
            className="w-full sm:w-auto flex-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-lg shadow-orange-600/30 gap-2 h-9"
          >
            <Zap className="w-3.5 h-3.5" />
            Import this calculation into ProCal Workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Link href="/signup" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto text-xs border-slate-700 hover:bg-slate-800 text-slate-300 h-9"
            >
              Sign Up Free
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
