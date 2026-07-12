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
  const displayCompany = companyName || "ProCal Engineering";
  const displayTitle = title || `${project.name} — Electrical Design Report`;
  const reportDate = project.date || new Date().toLocaleDateString();

  return (
    <header
      aria-label="Report header"
      className="w-full border-b-2 border-orange-500 bg-white pb-3 mb-4"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Brand + title block */}
        <div className="flex items-start gap-3">
          <LogoMark />
          <div>
            <p className="text-sm font-bold text-orange-600">{displayCompany}</p>
            <h1 className="text-base font-extrabold text-gray-900 leading-tight">
              {displayTitle}
            </h1>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Logo */}
        {displayLogo && (
          <img
            src={displayLogo}
            alt={`${displayCompany} logo`}
            className="h-12 w-auto object-contain flex-shrink-0"
          />
        )}
      </div>

      {/* Metadata row */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
        <MetaItem label="Client" value={project.client} />
        <MetaItem label="Location" value={project.location} />
        <MetaItem label="Engineer" value={project.engineer} />
        <MetaItem label="Date" value={reportDate} />
        <MetaItem
          label="System"
          value={`${project.voltage}V / ${project.frequency}Hz`}
        />
        <MetaItem
          label="Buildings"
          value={project.buildings.map((b) => b.name).join(", ")}
        />
      </div>
    </header>
  );
}
