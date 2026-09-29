'use client';

import { useEffect } from 'react';
import { createFindBreaker, type EquipmentItem } from '@/lib/calculations/feeders';
import type { Project, ProjectRevision } from '@/types';
import type { BreakerSettingItem } from '@/lib/reports/aggregates';
import CoverPage from '@/components/report/CoverPage';
import LoadSchedule from '@/components/report/LoadSchedule';
import MDBSchedule from '@/components/report/MDBSchedule';
import CableSchedule from '@/components/report/CableSchedule';
import BreakerSchedule from '@/components/report/BreakerSchedule';
import VDSchedule from '@/components/report/VDSchedule';
import ShortCircuitSchedule from '@/components/report/ShortCircuitSchedule';
import BOMSchedule from '@/components/report/BOMSchedule';
import ReportHeader from '@/components/report/ReportHeader';

export interface PrintReportClientProps {
  project: Project;
  equipment: EquipmentItem[];
  breakerSettings: BreakerSettingItem[];
  revisions: ProjectRevision[];
  companyName: string;
  companyLogoUrl?: string;
  buildingId?: string;
  manufacturer?: string;
}

/**
 * Renders the engineering package for headless printing.
 *
 * This mirrors the `print-all-tabs` block in `reports/page.tsx` exactly, so the
 * PDF the export tools produce is the same document the browser exports. The one
 * difference: every collection the schedules would otherwise fetch for itself
 * (`equipment`, `breakerSettings`, `findBreaker`) arrives as a prop. That skips
 * the client fetches entirely, so the DOM is complete on first paint and the
 * print ticket never needs API access from inside Chromium.
 *
 * The schedules stay client components on purpose — `TraceableCell` owns the
 * "Show Your Work" popover, which is why this page exists instead of a
 * `renderToStaticMarkup` call on the server.
 */
export default function PrintReportClient(props: PrintReportClientProps) {
  const { project, equipment, breakerSettings, revisions, companyName, companyLogoUrl, buildingId } = props;

  const prefManufacturer = props.manufacturer || project.preferredManufacturer;

  // Built here rather than passed in: a server component cannot hand a function
  // across the RSC boundary. createFindBreaker is pure, so this is safe.
  const findBreaker = createFindBreaker(
    equipment,
    {
      ACB: project.defaultAcbFamilyId ?? undefined,
      MCCB: project.defaultMccbFamilyId ?? undefined,
      MCB: project.defaultMcbFamilyId ?? undefined,
    },
    prefManufacturer
  );

  // Signal readiness only after the effect that marks the page interactive has
  // run, so Chromium never lifts a half-hydrated DOM.
  useEffect(() => {
    const id = window.setTimeout(() => {
      (window as unknown as { __PRINT_READY__?: boolean }).__PRINT_READY__ = true;
    }, 250);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="w-full bg-white text-slate-900">
      <div id="print-all-tabs" className="w-full">
        {/* Page 1: Executive Cover Page */}
        <CoverPage
          project={project}
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
          revisions={revisions}
          findBreaker={findBreaker}
          breakerSettings={breakerSettings}
        />

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
          <ReportHeader project={project} companyName={companyName} companyLogoUrl={companyLogoUrl} title={project.name} subtitle="SHORT CIRCUIT FAULT ANALYSIS SCHEDULE" />
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
    </div>
  );
}
