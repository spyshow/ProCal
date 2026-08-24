"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Calculator,
  Copy,
  Check,
  Pin,
  PinOff,
  X,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  TraceDefinition,
  formatTraceAsPlainText,
} from "@/lib/calculations/trace-engine";

export interface CalculationTracePopoverProps {
  trace: TraceDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

export function CalculationTracePopover({
  trace,
  isOpen,
  onClose,
  anchorRect,
}: CalculationTracePopoverProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-close on escape key if not pinned
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPinned) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPinned, onClose]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !isPinned
      ) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isPinned, onClose]);

  if (!isOpen || !trace || !mounted) return null;

  const handleCopy = async () => {
    try {
      const text = formatTraceAsPlainText(trace);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Smart positioning calculation relative to anchor element or viewport center
  let stylePosition: React.CSSProperties = {
    position: "fixed",
    zIndex: 99999,
  };

  if (anchorRect) {
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    const popoverWidth = 480;
    const popoverHeight = 520;

    let top = anchorRect.bottom + 8;
    let left = anchorRect.left;

    // Flip to top if overflowing bottom
    if (top + popoverHeight > viewportHeight - 20) {
      top = Math.max(20, anchorRect.top - popoverHeight - 8);
    }

    // Shift left if overflowing right
    if (left + popoverWidth > viewportWidth - 20) {
      left = Math.max(20, viewportWidth - popoverWidth - 20);
    }

    stylePosition = {
      ...stylePosition,
      top: `${top}px`,
      left: `${left}px`,
    };
  } else {
    stylePosition = {
      ...stylePosition,
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const content = (
    <div
      ref={popoverRef}
      style={stylePosition}
      className="w-[92vw] sm:w-[480px] max-h-[85vh] flex flex-col rounded-2xl border border-orange-500/40 bg-slate-950/95 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(234,88,12,0.15)] text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Popover Header */}
      <div className="p-3.5 px-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0 shadow-xs">
            <Calculator size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white tracking-tight truncate flex items-center gap-1.5">
              <span>{trace.title}</span>
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">
                {trace.metric}: {trace.resultValue}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg border transition-all text-xs flex items-center gap-1 ${
              copied
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
            }`}
            title="Copy formula & calculation trace to clipboard"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span className="text-[11px] font-medium hidden sm:inline">
              {copied ? "Copied" : "Copy Math"}
            </span>
          </button>

          <button
            onClick={() => setIsPinned(!isPinned)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isPinned
                ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title={isPinned ? "Unpin popover" : "Pin popover to stay open"}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Governing Standard Citation Bar */}
      <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-400">
          <BookOpen size={12} className="text-amber-400 shrink-0" />
          <span className="font-medium text-slate-300">{trace.standardCitation}</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          IEC Standards Verified
        </span>
      </div>

      {/* Scrollable Body */}
      <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)] custom-scrollbar">
        {/* Step-by-step Math Formulas */}
        <div className="space-y-3">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles size={12} className="text-orange-400" />
            <span>Mathematical Formula & Substituted Values</span>
          </h5>

          <div className="space-y-2">
            {trace.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-1.5 shadow-inner"
              >
                {step.label && (
                  <div className="text-[11px] font-semibold text-orange-300/90 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 text-[9px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{step.label}</span>
                  </div>
                )}

                {/* Symbolic Formula */}
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800/60 font-mono text-xs text-slate-200 overflow-x-auto tracking-wide whitespace-pre">
                  {step.formula}
                </div>

                {/* Substituted Numerical Values */}
                <div className="px-2.5 py-1.5 rounded-lg bg-orange-950/20 border border-orange-900/30 font-mono text-xs text-orange-200 overflow-x-auto tracking-wide font-medium whitespace-pre">
                  {step.substituted}
                </div>

                {step.description && (
                  <p className="text-[10px] text-slate-400 italic pt-0.5 leading-tight">
                    {step.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Input Parameters & Provenance Table */}
        {trace.parameters.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers size={12} className="text-amber-400" />
              <span>Input Parameters & Source Provenance</span>
            </h5>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden text-[11px]">
              <table className="w-full text-center">
                <thead className="bg-slate-900/90 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 px-3 text-center">Parameter</th>
                    <th className="py-1.5 px-2 text-center">Symbol</th>
                    <th className="py-1.5 px-2 text-center">Value</th>
                    <th className="py-1.5 px-3 text-center">Source / Origin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {trace.parameters.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-1.5 px-3 font-medium text-white text-center">{p.name}</td>
                      <td className="py-1.5 px-2 font-mono text-orange-400 text-center">{p.symbol}</td>
                      <td className="py-1.5 px-2 font-mono text-slate-100 text-center">
                        {p.value} {p.unit ? <span className="text-slate-400 text-[10px]">{p.unit}</span> : null}
                      </td>
                      <td className="py-1.5 px-3 text-[10px] text-center text-slate-400">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 inline-block truncate max-w-[150px]" title={p.source}>
                          {p.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Compliance / Safety Margin Banner */}
        {trace.compliance && (
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              trace.compliance.status === "PASS"
                ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
                : trace.compliance.status === "WARN"
                ? "bg-amber-950/40 border-amber-800/60 text-amber-200"
                : "bg-rose-950/40 border-rose-800/60 text-rose-200"
            }`}
          >
            {trace.compliance.status === "PASS" ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : trace.compliance.status === "WARN" ? (
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            )}

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 border border-current">
                  {trace.compliance.status}
                </span>
                <span className="font-semibold text-xs text-white">
                  Compliance Rule: <code className="font-mono text-[11px] text-orange-300">{trace.compliance.rule}</code>
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Calculated Value: <strong>{trace.compliance.actual}</strong> vs Limit: <strong>{trace.compliance.limit}</strong>
                {trace.compliance.margin ? ` (${trace.compliance.margin})` : ""}
              </p>
            </div>
          </div>
        )}

        {/* Engineering Notes */}
        {trace.notes && trace.notes.length > 0 && (
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 space-y-1">
            {trace.notes.map((note, idx) => (
              <p key={idx} className="text-[10px] text-slate-400 leading-tight">
                • {note}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}