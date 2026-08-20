"use client";

import type { ReactNode } from "react";
import type { Project } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportHeaderProps {
  project: Project;
  companyName?: string;
  companyLogoUrl?: string;
  title?: string;
  subtitle?: string;
}

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** ProCal orange lightning-bolt logo mark. */
function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"
        fill="#ea580c"
        stroke="#ea580c"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Single piece of header metadata. */
function MetaItem({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="text-[11px] leading-snug">
      <span className="font-semibold uppercase text-gray-500">{label}: </span>
      <span className="text-gray-900">{value || "—"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

/**
 * Printable section title with optional subtitle and trailing controls.
 *
 * Mirrors the section headings used in the schedule tables (e.g. "MDB Feeder
 * Schedule") and adds a clean bottom rule for printed pages.
 */
export function SectionHeader({
  title,
  subtitle,
  children,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 border-b border-gray-200 pb-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Header
// ---------------------------------------------------------------------------

/**
 * Printable report header with company branding, project metadata and logo.
 *
 * Intended to be reused at the top of each printed schedule page so the report
 * stays identifiable when exported to PDF.
 */
export default function ReportHeader({
  project,
  companyName,
  companyLogoUrl,
  title,
  subtitle,
}: ReportHeaderProps) {
  const displayLogo = project.logoUrl || companyLogoUrl;
  const displayCompany = companyName || "ProCal Engineering Suite";
  const displayTitle = title || project.name;
  const reportDate = project.date || new Date().toLocaleDateString();

  return (
    <header
      aria-label="Report header"
      className="report-header w-full border-b-2 border-slate-900 bg-slate-900 text-white p-2.5 rounded-lg shadow-sm mb-2.5 box-border"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-black tracking-tight text-white uppercase">
            {displayTitle}
          </h1>
          <p className="text-[11px] font-semibold text-slate-300">
            {subtitle || "ELECTRICAL DESIGN & SCHEDULE PACKAGE"}
          </p>
          <p className="text-[9px] text-slate-400">
            Prepared in accordance with IEC 60364 &amp; BS 7671 Electrical Regulations
          </p>
        </div>
        <div className="text-right text-[10px] space-y-0.5 font-mono text-slate-300 flex flex-col items-end">
          {displayLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayLogo}
              alt={`${displayCompany} logo`}
              className="h-6 w-auto object-contain mb-0.5 bg-white/90 p-0.5 rounded"
            />
          ) : (
            <div className="font-bold text-xs text-amber-400">{displayCompany}</div>
          )}
          <div>Ref: <span className="font-semibold text-white">PRJ-{project.id.slice(-6).toUpperCase()}</span></div>
          <div>Date: <span className="font-semibold text-white">{reportDate}</span></div>
        </div>
      </div>
    </header>
  );
}
