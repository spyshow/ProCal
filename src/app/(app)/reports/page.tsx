'use client';
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  FileText,
  FileDown,
  FileSpreadsheet,
  Table,
  Building2,
  History,
  Loader2,
  Zap,
  ShieldCheck,
  Activity,
  Layers,
  Printer,
} from 'lucide-react';
import RevisionsPanel from '@/components/report/RevisionsPanel';
import CoverPage from '@/components/report/CoverPage';
import ReportHeader from '@/components/report/ReportHeader';
import LoadSchedule from '@/components/report/LoadSchedule';
import BOMSchedule from '@/components/report/BOMSchedule';
import MDBSchedule from '@/components/report/MDBSchedule';
import CableSchedule from '@/components/report/CableSchedule';
import BreakerSchedule from '@/components/report/BreakerSchedule';
import VDSchedule from '@/components/report/VDSchedule';
import ShortCircuitSchedule from '@/components/report/ShortCircuitSchedule';
import type { Project, ProjectRevision, ReportTab } from '@/types';
import { createFindBreaker, type FindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import WorkflowStepper from '@/components/layout/WorkflowStepper';
import { AccessRestricted } from '@/components/AccessRestricted';
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner';
import { QAReviewDrawer } from '@/components/QAReviewDrawer';

export default function ReportsPage() {
  const { selectedProjectId, selectedProject, loading: contextLoading, preferredManufacturer, refreshProject, canView, canEdit } = useProject();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const lastProjectIdRef = useRef<string | null>(null);
  const [company, setCompany] = useState<{ companyName: string; logoUrl: string }>({ companyName: "", logoUrl: "" });
  const [revisions, setRevisions] = useState<ProjectRevision[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (selectedProject && selectedProject.id === selectedProjectId) {
      setProject(selectedProject);
      if (lastProjectIdRef.current !== selectedProject.id) {
        lastProjectIdRef.current = selectedProject.id;
        setSelectedBuilding(null);
      }
      setLoading(false);
    }
  }, [selectedProject, selectedProjectId]);

  // The project comes from ProjectContext (which dedupes concurrent fetches).
  // On a stale/missing context copy, refresh through the context rather than
  // fetching the (large) payload again — the sync effect above copies the result.
  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      refreshProject();
    }
  }, [selectedProjectId, selectedProject, refreshProject]);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(async (data) => {
        if (!data.company) return;
        const companyObj = { ...data.company };
        if (companyObj.logoUrl && (companyObj.logoUrl.startsWith('/api/assets/') || companyObj.logoUrl.startsWith('/uploads/'))) {
          try {
            const res = await fetch(companyObj.logoUrl);
            if (res.ok) {
              const blob = await res.blob();
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  setCompany({ ...companyObj, logoUrl: reader.result });
                } else {
                  setCompany(companyObj);
                }
              };
              reader.readAsDataURL(blob);
              return;
            }
          } catch {
            // fallback
          }
        }
        setCompany(companyObj);
      })
      .catch(() => {});
  }, []);

  // Load issued revisions (for the cover-page revision block).
  const loadRevisions = useCallback(async () => {
    if (!project) return;
    try {
      // Summary mode — the cover block only needs rev/date/description/author;
      // omitting snapshotJson keeps this (historically ~500KB) fetch tiny.
      const r = await fetch(`/api/projects/${project.id}/revisions?summary=true&t=${Date.now()}`, { cache: 'no-store' });
      const data = await r.json();
      if (Array.isArray(data)) setRevisions(data);
    } catch { /* ignore */ }
  }, [project?.id]);

  // After a restore the whole project state changed — reload the revisions list
  // and the project itself so every schedule and the cover reflect the restore.
  const handleRevisionsChanged = useCallback(async () => {
    await loadRevisions();
    await refreshProject();
  }, [loadRevisions, refreshProject]);

  useEffect(() => {
    loadRevisions();
  }, [loadRevisions]);

  const [breakerSettings, setBreakerSettings] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/breaker-settings?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBreakerSettings(data))
      .catch(() => {});
  }, []);

  const catalogQuery = useMemo(() => {
    const params = new URLSearchParams();
    const m = preferredManufacturer || project?.preferredManufacturer;
    if (m && m !== 'MIXED') {
      params.set('manufacturer', m);
    }
    return params.toString();
  }, [preferredManufacturer, project?.preferredManufacturer]);

  const { equipment } = useEquipmentCatalog(catalogQuery);

  const findBreaker: FindBreaker = useMemo(
    () =>
      createFindBreaker(
        equipment,
        {
          ACB: project?.defaultAcbFamilyId ?? undefined,
          MCCB: project?.defaultMccbFamilyId ?? undefined,
          MCB: project?.defaultMcbFamilyId ?? undefined,
        },
        preferredManufacturer || project?.preferredManufacturer
      ),
    [equipment, project, preferredManufacturer]
  );

  const handleExportExcel = async () => {
    if (!project || exporting) return;
    setExporting(true);
    try {
      const [{ buildReportWorkbook }, XLSX] = await Promise.all([
        import('@/lib/reports/excel'),
        import('xlsx'),
      ]);
      const wb = buildReportWorkbook(project, findBreaker, breakerSettings);
      XLSX.writeFile(wb, `${project.name.replace(/[^\w\- ]+/g, '').trim() || 'Project'} - Schedules.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Excel export failed');
    } finally {
      setExporting(false);
    }
  };

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: project?.name ? `${project.name} - Executive Engineering Package` : 'Report',
    pageStyle: `
      @page {
        size: 297mm 210mm;
        margin: 15mm 12mm 15mm 12mm;
      }
      @media print {
        @page {
          size: 297mm 210mm;
          margin: 15mm 12mm 15mm 12mm;
        }
        *, *::before, *::after {
          box-sizing: border-box !important;
        }
        html, body {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background-color: white !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
        }
        .font-mono, [class*="font-mono"], code, pre, kbd, samp {
          font-family: Consolas, Menlo, "Courier New", Courier, monospace !important;
          font-feature-settings: normal !important;
          font-variation-settings: normal !important;
        }
        #print-all-tabs {
          display: block !important;
          position: static !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .print-page-container {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          padding: 0 !important;
        }
        .cover-page {
          width: 100% !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        thead {
          display: table-header-group !important;
        }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        /* Universal High-Contrast Technical Document Zebra Striping */
        table tbody tr:nth-child(even):not([class*="bg-amber"]):not([class*="bg-sky"]):not([class*="bg-yellow"]) {
          background-color: #f1f5f9 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table tbody tr:nth-child(even):not([class*="bg-amber"]):not([class*="bg-sky"]):not([class*="bg-yellow"]) td {
          background-color: #f1f5f9 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table tbody tr:nth-child(odd):not([class*="bg-amber"]):not([class*="bg-sky"]):not([class*="bg-yellow"]) {
          background-color: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table tbody tr:nth-child(odd):not([class*="bg-amber"]):not([class*="bg-sky"]):not([class*="bg-yellow"]) td {
          background-color: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table tbody tr.bg-slate-100 td,
        table tbody tr[class*="bg-slate-100"] td {
          background-color: #f1f5f9 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table tbody tr[class*="bg-amber"] td {
          background-color: #fef3c7 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table tbody tr[class*="bg-sky"] td {
          background-color: #f0f9ff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Buttons vs Table Content */
        button:not(td *):not(th *),
        [role="button"]:not(td *):not(th *),
        input[type="button"] {
          display: none !important;
        }
        td [role="button"], th [role="button"], .group\\/cell, .traceable-cell {
          display: inline-block !important;
          position: static !important;
          cursor: default !important;
          user-select: text !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .group\\/cell::after, td [role="button"]::after, th [role="button"]::after, [class*="after:content-['fx']"]::after {
          display: none !important;
          content: none !important;
        }
      }
    `,
  });

  const handleDownloadPdf = async () => {
    if (!project) return;
    setDownloadingPdf(true);
    try {
      const printElement = printRef.current;
      if (!printElement) {
        throw new Error('Report contents are not ready yet. Please wait a moment and try again.');
      }

      // Clone the print DOM and convert any relative img sources to data URIs
      const clone = printElement.cloneNode(true) as HTMLElement;
      const images = Array.from(clone.querySelectorAll('img'));
      for (const img of images) {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
          try {
            const res = await fetch(src);
            if (res.ok) {
              const blob = await res.blob();
              const dataUri = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              if (dataUri) {
                img.setAttribute('src', dataUri);
              }
            }
          } catch {
            // Keep original src; server will resolve via database
          }
        }
      }

      const html = clone.innerHTML;
      if (!html) {
        throw new Error('Report contents are not ready yet. Please wait a moment and try again.');
      }

      const res = await fetch(`/api/projects/${project.id}/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html }),
      });

      if (!res.ok) {
        let errDetail = `${res.status} ${res.statusText}`;
        try {
          const body = await res.json();
          if (body?.details) errDetail = body.details;
          else if (body?.error) errDetail = body.error;
        } catch {
          // ignore
        }
        throw new Error(errDetail);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeName}_Executive_Engineering_Package.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Server PDF export failed:', err);
      alert(`PDF Package download failed: ${err?.message || 'Server error'}. If needed, use the adjacent Print button.`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const pageHeader = (
    <div className="flex items-center justify-between print:hidden">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground-color)] flex items-center gap-2">
          <FileText size={22} className="text-orange-500" />
          {t('reports.title', 'Executive Reports & Schedules')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{project ? project.name : ''}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowRevisions(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] text-sm font-semibold transition-all cursor-pointer shadow-xs"
        >
          <History size={14} />
          {t('reports.revisions', 'Revisions')}
        </button>
        <button
          onClick={handleExportExcel}
          disabled={exporting || !project}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-white-force text-sm font-semibold disabled:opacity-50 shadow-xs transition-all cursor-pointer"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
          {exporting ? t('common.exporting', 'Exporting…') : t('reports.downloadExcel', 'Export Excel')}
        </button>
        <button
          onClick={handlePrint}
          disabled={!project}
          title={t('reports.printTooltip', 'Print to physical paper / printer')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] text-sm font-semibold disabled:opacity-50 transition-all cursor-pointer shadow-xs"
        >
          <Printer size={14} />
          {t('reports.print', 'Print')}
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={downloadingPdf || !project}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-white-force text-sm font-semibold disabled:opacity-50 shadow-sm transition-all cursor-pointer"
        >
          {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          {downloadingPdf ? t('reports.generatingPdf', 'Generating PDF…') : t('reports.downloadPdf', 'Download PDF Package')}
        </button>
      </div>
    </div>
  );

  // Header renders immediately (server HTML) — only the schedules below wait
  // for the project payload, so first paint isn't gated behind the fetch.
  if (!project) {
    return (
      <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh] print:p-0 print:w-full print:max-w-none print:m-0">
        <div className="print:hidden">
          <WorkflowStepper currentStep={8} />
        </div>
        {pageHeader}
        {loading || contextLoading || selectedProjectId ? (
          <PageSkeleton titleWidth="w-56" rowCount={6} />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
            <FileText size={40} className="text-[var(--text-muted)] mb-3" />
            <p className="text-[var(--text-muted)] text-sm">{t('projects.selectProjectPrompt', 'No project data. Select a project first.')}</p>
          </div>
        )}
      </div>
    );
  }

  const tabs: { key: ReportTab; label: string; icon: typeof FileText }[] = [
    { key: 'summary', label: t('reports.tabSummary', '1. Executive Summary'), icon: FileText },
    { key: 'loads', label: t('reports.tabLoads', '2. Load & Balancing'), icon: Activity },
    { key: 'mdb', label: t('reports.tabMdb', '3. MDB Schedule'), icon: Building2 },
    { key: 'cable', label: t('reports.tabCable', '4. Cable Sizing'), icon: Table },
    { key: 'breaker', label: t('reports.tabBreaker', '5. Breakers & Selectivity'), icon: ShieldCheck },
    { key: 'vd', label: t('reports.tabVd', '6. Voltage Drop'), icon: Layers },
    { key: 'shortCircuit', label: t('reports.tabShortCircuit', '7. Short-Circuit'), icon: Zap },
    { key: 'bom', label: t('reports.tabBom', '8. Bill of Materials'), icon: Table },
  ];

  const renderTabContent = (tab: ReportTab) => {
    switch (tab) {
      case 'summary':
        return (
          <CoverPage
            project={project}
            companyName={company.companyName}
            companyLogoUrl={company.logoUrl}
            revisions={revisions}
            findBreaker={findBreaker}
            breakerSettings={breakerSettings}
          />
        );
      case 'loads':
        return (
          <div className="space-y-6">
            <ReportHeader
              project={project}
              companyName={company.companyName}
              companyLogoUrl={company.logoUrl}
              title={project.name}
              subtitle="LOAD ANALYSIS & PHASE BALANCING SCHEDULE"
            />
            <LoadSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
          </div>
        );
      case 'mdb':
        return (
          <div className="space-y-6">
            <ReportHeader
              project={project}
              companyName={company.companyName}
              companyLogoUrl={company.logoUrl}
              title={project.name}
              subtitle="MAIN DISTRIBUTION BOARD (MDB) FEEDER SCHEDULE"
            />
            <MDBSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
          </div>
        );
      case 'cable':
        return (
          <div className="space-y-6">
            <ReportHeader
              project={project}
              companyName={company.companyName}
              companyLogoUrl={company.logoUrl}
              title={project.name}
              subtitle="CABLE SIZING & INSTALLATION SCHEDULE"
            />
            <CableSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
          </div>
        );
      case 'breaker':
        return (
          <div className="space-y-6">
            <ReportHeader
              project={project}
              companyName={company.companyName}
              companyLogoUrl={company.logoUrl}
              title={project.name}
              subtitle="CIRCUIT BREAKERS & SELECTIVITY PROTECTION SCHEDULE"
            />
            <BreakerSchedule
              project={project}
              buildingId={selectedBuilding ?? undefined}
              manufacturer={preferredManufacturer}
              showHeader={false}
            />
          </div>
        );
      case 'vd':
        return (
          <div className="space-y-6">
            <ReportHeader
              project={project}
              companyName={company.companyName}
              companyLogoUrl={company.logoUrl}
              title={project.name}
              subtitle="VOLTAGE DROP & COMPLIANCE ANALYSIS SCHEDULE"
            />
            <VDSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
          </div>
        );
      case 'shortCircuit':
        return (
          <div className="space-y-6">
            <ReportHeader
              project={project}
              companyName={company.companyName}
              companyLogoUrl={company.logoUrl}
              title={project.name}
              subtitle="SHORT-CIRCUIT FAULT ANALYSIS SCHEDULE"
            />
            <ShortCircuitSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
          </div>
        );
      case 'bom':
        return (
          <div className="space-y-6">
            <ReportHeader
              project={project}
              companyName={company.companyName}
              companyLogoUrl={company.logoUrl}
              title={project.name}
              subtitle="BILL OF MATERIALS & PROCUREMENT SCHEDULE"
            />
            <BOMSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
          </div>
        );
    }
  };

  if (selectedProject && !canView('reports')) {
    return <AccessRestricted pageTitle={t('nav.reports', 'Reports & Revisions')} />;
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh] print:p-0 print:w-full print:max-w-none print:m-0">
      {/* Workflow Stepper: Step 8 */}
      <div className="print:hidden">
        <WorkflowStepper currentStep={8} />
      </div>

      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="reports" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="reports" pageTitle="Reports & Revisions" />

      {pageHeader}

      <RevisionsPanel projectId={project.id} open={showRevisions} onClose={() => setShowRevisions(false)} onChanged={handleRevisionsChanged} />

      {project.buildings.length > 1 && (
        <div className="flex gap-2 print:hidden items-center">
          <span className="text-xs text-[var(--text-muted)] font-semibold uppercase">Building Filter:</span>
          <button
            onClick={() => setSelectedBuilding(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedBuilding === null
                ? 'bg-orange-600 text-white text-white-force shadow-xs'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--foreground-color)]'
            }`}
          >
            All Buildings ({project.buildings.length})
          </button>
          {project.buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedBuilding === b.id
                  ? 'bg-orange-600 text-white text-white-force shadow-xs'
                  : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--foreground-color)]'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Tab Navigation (8 Modules) */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border-color)] print:hidden">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === key
                ? 'border-orange-500 text-orange-400 bg-orange-500/10 rounded-t-lg'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground-color)] hover:bg-[var(--card-bg)] rounded-t-lg'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Active tab container (screen only) */}
      <div className="screen-only-report bg-white text-slate-900 rounded-xl p-4 sm:p-6 shadow-md border border-slate-200 overflow-x-auto ring-1 ring-black/5">
        {renderTabContent(activeTab)}
      </div>

      {/* ========== PRINT-ONLY: FULL COMPREHENSIVE REPORT PACKAGE ========== */}
      {/* Rendered into react-to-print iframe with clean A4 page breaks */}
      <div ref={printRef} id="print-all-tabs" className="hidden print:block w-full">
        {/* Page 1: Executive Cover Page */}
          <CoverPage
            project={project}
            companyName={company.companyName}
            companyLogoUrl={company.logoUrl}
            revisions={revisions}
            findBreaker={findBreaker}
            breakerSettings={breakerSettings}
          />

        {/* Page 2: Load Analysis & Balancing */}
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} title={project.name} subtitle="LOAD ANALYSIS & PHASE BALANCING SCHEDULE" />
          <LoadSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
        </div>

        {/* Page 3: Main Distribution Board Schedule */}
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} title={project.name} subtitle="MAIN DISTRIBUTION BOARD (MDB) FEEDER SCHEDULE" />
          <MDBSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
        </div>

        {/* Page 4: Cable Sizing & Installation Schedule */}
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} title={project.name} subtitle="CABLE SIZING & INSTALLATION SCHEDULE" />
          <CableSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
        </div>

        {/* Page 5: Breakers & Selectivity Protection Schedule */}
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} title={project.name} subtitle="CIRCUIT BREAKERS & SELECTIVITY PROTECTION SCHEDULE" />
          <BreakerSchedule project={project} buildingId={selectedBuilding ?? undefined} manufacturer={preferredManufacturer} showHeader={false} />
        </div>

        {/* Page 6: Voltage Drop & Compliance Analysis */}
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} title={project.name} subtitle="VOLTAGE DROP & COMPLIANCE ANALYSIS SCHEDULE" />
          <VDSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
        </div>

        {/* Page 7: Short-Circuit Fault Analysis */}
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} title={project.name} subtitle="SHORT-CIRCUIT FAULT ANALYSIS SCHEDULE" />
          <ShortCircuitSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
        </div>

        {/* Page 8: Bill of Materials & Equipment Procurement */}
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="print-page-container w-full p-2 bg-white text-slate-900">
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} title={project.name} subtitle="BILL OF MATERIALS & PROCUREMENT SCHEDULE" />
          <BOMSchedule project={project} buildingId={selectedBuilding ?? undefined} showHeader={false} />
        </div>
      </div>
    </div>
  );
}
