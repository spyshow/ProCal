"use client";

import React, { useState, useRef } from "react";
import { TraceDefinition } from "@/lib/calculations/trace-engine";
import { CalculationTracePopover } from "./CalculationTracePopover";

export interface TraceableCellProps {
  children: React.ReactNode;
  getTrace: () => TraceDefinition;
  className?: string;
  badgePosition?: "top-right" | "inline";
  title?: string;
}

export function TraceableCell({
  children,
  getTrace,
  className = "",
  badgePosition = "top-right",
  title = "Click to inspect calculation trace (Show Your Work)",
}: TraceableCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTrace, setCurrentTrace] = useState<TraceDefinition | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cellRef.current) {
      setAnchorRect(cellRef.current.getBoundingClientRect());
    }
    const trace = getTrace();
    setCurrentTrace(trace);
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (cellRef.current) {
        setAnchorRect(cellRef.current.getBoundingClientRect());
      }
      const trace = getTrace();
      setCurrentTrace(trace);
      setIsOpen(true);
    }
  };

  return (
    <>
      <div
        ref={cellRef}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        title={title}
        className={`group/cell relative cursor-pointer select-none rounded transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 hover:bg-orange-500/10 hover:text-orange-300 after:content-['fx'] after:absolute after:-top-1 after:-right-1 after:text-[8px] after:font-mono after:font-bold after:px-0.5 after:rounded after:bg-slate-900/90 after:text-orange-400 after:border after:border-orange-500/40 after:opacity-0 hover:after:opacity-100 after:transition-opacity after:pointer-events-none ${
          isOpen ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40" : ""
        } ${className}`}
      >
        {children}
      </div>

      {isOpen && currentTrace && (
        <CalculationTracePopover
          trace={currentTrace}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          anchorRect={anchorRect}
        />
      )}
    </>
  );
}