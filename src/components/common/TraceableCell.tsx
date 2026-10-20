import React from "react";
import type { TraceDefinition } from "@/lib/calculations/trace-engine";
import { TraceableCellClient } from "./TraceableCellClient";

export interface TraceableCellProps {
  children: React.ReactNode;
  getTrace: () => TraceDefinition;
  className?: string;
  badgePosition?: "top-right" | "inline";
  title?: string;
}

/**
 * Isomorphic TraceableCell component:
 * - On the server (e.g. during static HTML generation for PDF via renderToStaticMarkup),
 *   renders plain children inside a container without running client-side hooks.
 * - In the browser, renders interactive TraceableCellClient with popover inspection.
 */
export function TraceableCell(props: TraceableCellProps) {
  if (typeof window === "undefined") {
    return <span className={`traceable-cell ${props.className || ""}`}>{props.children}</span>;
  }
  return <TraceableCellClient {...props} />;
}
