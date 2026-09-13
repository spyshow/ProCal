import React from 'react';
import { createRequire } from 'module';
const requireModule = createRequire(import.meta.url);
const ReactDOMServer = requireModule('react-dom/server');
import type { Project, ProjectRevision } from '@/types';
import { createFindBreaker, type EquipmentItem, type FindBreaker } from '@/lib/calculations/feeders';
import { REPORT_COMPILED_CSS } from './report-css';
import CoverPage from '@/components/report/CoverPage';
import LoadSchedule from '@/components/report/LoadSchedule';
import MDBSchedule from '@/components/report/MDBSchedule';
import CableSchedule from '@/components/report/CableSchedule';
import BreakerSchedule from '@/components/report/BreakerSchedule';
import VDSchedule from '@/components/report/VDSchedule';
import ShortCircuitSchedule from '@/components/report/ShortCircuitSchedule';
import BOMSchedule from '@/components/report/BOMSchedule';
import ReportHeader from '@/components/report/ReportHeader';

export interface RenderReportHtmlOptions {
  project: Project;
  buildingId?: string;
  manufacturer?: string;
  equipment?: EquipmentItem[];
  breakerSettings?: any[];
  revisions?: ProjectRevision[];
  companyName?: string;
  companyLogoUrl?: string;
}

export function renderReportHtml(options: RenderReportHtmlOptions): string {
  const {
    project,
    buildingId,
    manufacturer,
    equipment = [],
    breakerSettings = [],
    revisions = options.revisions ?? (project as any).revisions ?? [],
    companyName = 'ProCal — Low-voltage Electrical design, Solved',
    companyLogoUrl,
  } = options;

  const prefManufacturer = manufacturer || project.preferredManufacturer;

  const findBreaker: FindBreaker = createFindBreaker(
    equipment,
    {
      ACB: project.defaultAcbFamilyId ?? undefined,
      MCCB: project.defaultMccbFamilyId ?? undefined,
      MCB: project.defaultMcbFamilyId ?? undefined,
    },
    prefManufacturer
  );

  const reportMarkup = ReactDOMServer.renderToStaticMarkup(
    <div className="report-root w-full bg-white text-slate-900">
      {/* Page 1: Cover Page */}
      <div className="w-full bg-white text-slate-900 p-2">
        <CoverPage
          project={project}
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
          revisions={revisions}
          findBreaker={findBreaker}
          breakerSettings={breakerSettings}
        />
      </div>

      {/* Page 2: Load Analysis & Balancing */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
        <ReportHeader project={project} companyName={companyName} companyLogoUrl={companyLogoUrl} title={project.name} subtitle="LOAD ANALYSIS & PHASE BALANCING SCHEDULE" />
        <LoadSchedule project={project} buildingId={buildingId} showHeader={false} />
      </div>

      {/* Page 3: Main Distribution Board Schedule */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
        <ReportHeader project={project} companyName={companyName} companyLogoUrl={companyLogoUrl} title={project.name} subtitle="MAIN DISTRIBUTION BOARD (MDB) FEEDER SCHEDULE" />
        <MDBSchedule project={project} buildingId={buildingId} equipment={equipment} findBreaker={findBreaker} showHeader={false} />
      </div>

      {/* Page 4: Cable Sizing & Installation Schedule */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
        <ReportHeader project={project} companyName={companyName} companyLogoUrl={companyLogoUrl} title={project.name} subtitle="CABLE SIZING & INSTALLATION SCHEDULE" />
        <CableSchedule project={project} buildingId={buildingId} equipment={equipment} findBreaker={findBreaker} showHeader={false} />
      </div>

      {/* Page 5: Breakers & Selectivity Protection Schedule */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
        <ReportHeader project={project} companyName={companyName} companyLogoUrl={companyLogoUrl} title={project.name} subtitle="CIRCUIT BREAKERS & SELECTIVITY PROTECTION SCHEDULE" />
        <BreakerSchedule
          project={project}
          buildingId={buildingId}
          manufacturer={prefManufacturer}
          equipment={equipment}
          breakerSettings={breakerSettings}
          findBreaker={findBreaker}
          showHeader={false}
        />
      </div>

      {/* Page 6: Voltage Drop & Compliance Analysis */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
        <ReportHeader project={project} companyName={companyName} companyLogoUrl={companyLogoUrl} title={project.name} subtitle="VOLTAGE DROP & COMPLIANCE ANALYSIS SCHEDULE" />
        <VDSchedule project={project} buildingId={buildingId} equipment={equipment} findBreaker={findBreaker} showHeader={false} />
      </div>

      {/* Page 7: Short-Circuit Fault Analysis */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
        <ReportHeader project={project} companyName={companyName} companyLogoUrl={companyLogoUrl} title={project.name} subtitle="SHORT-CIRCUIT FAULT ANALYSIS SCHEDULE" />
        <ShortCircuitSchedule project={project} buildingId={buildingId} equipment={equipment} findBreaker={findBreaker} showHeader={false} />
      </div>

      {/* Page 8: Bill of Materials & Equipment Procurement */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
        <ReportHeader project={project} companyName={companyName} companyLogoUrl={companyLogoUrl} title={project.name} subtitle="BILL OF MATERIALS & PROCUREMENT SCHEDULE" />
        <BOMSchedule
          project={project}
          buildingId={buildingId}
          equipment={equipment}
          breakerSettings={breakerSettings}
          findBreaker={findBreaker}
          showHeader={false}
        />
      </div>
    </div>
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeXml(project.name)} - Engineering Package</title>
  <style>
    /* Standalone compiled Tailwind stylesheet */
    ${REPORT_COMPILED_CSS}

    /* Print & Typography Standards */
    @page {
      size: A4 landscape;
      margin: 10mm 10mm 10mm 10mm;
    }
    @page :first {
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff !important;
      color: #0f172a !important;
      font-family: Arial, Helvetica, "Nimbus Sans L", sans-serif !important;
      -webkit-font-smoothing: antialiased;
    }
    .font-mono, code, pre, kbd, samp {
      font-family: Consolas, "Courier New", Courier, monospace !important;
    }
    .print-page-container {
      page-break-before: always;
      break-before: page;
      box-sizing: border-box;
      width: 100%;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
  </style>
</head>
<body>
  ${reportMarkup}
</body>
</html>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
