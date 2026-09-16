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
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { sizeTransformer } from '@/lib/calculations/loads';
import { formatCableSizeFor } from '@/lib/calculations/cables';
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
import { createFindBreaker, computeFeeders, type EquipmentItem, type FindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import { resolveBuildingIncomer } from '@/lib/reports/aggregates';
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
      const wb = buildReportWorkbook(project, findBreaker);
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

  const allProjectItems = project.buildings.flatMap((b) => [
    ...b.floorDesigns.flatMap((fd) => fd.items),
    ...(b.buildingLoads ?? []),
  ]);
  const totalBalance = phaseBalance(allProjectItems as never, project as never);
  const totalDemandKw = totalBalance.totalKw;
  const totalCurrentA = totalBalance.maxPhaseCurrent;
  const reportPf = project.powerFactor || 0.85;
  const demandKva = totalDemandKw / reportPf;
  // Size on the worst-loaded winding so an unbalanced multi-building portfolio
  // is not under-provisioned (same rule as computeFeeders and the panel page).
  const perPhaseKva: [number, number, number] = [
    totalBalance.phaseKw[0] / reportPf,
    totalBalance.phaseKw[1] / reportPf,
    totalBalance.phaseKw[2] / reportPf,
  ];
  const transformerKva = project.transformerSize || sizeTransformer(demandKva, 1.2, perPhaseKva);

  const renderSummary = () => (
    <div className="space-y-6 font-sans text-[var(--foreground-color)]">
      {/* Top Banner Matching SLD Header */}
      <div className="flex items-center justify-between border-b-2 border-orange-500/40 pb-3 bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-[var(--foreground-color)] p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded uppercase tracking-wider font-mono">
              Executive Engineering Report
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-[var(--foreground-color)] uppercase mt-1">
            {project.name}
          </h1>
          <p className="text-xs font-semibold text-[var(--text-muted)]">
            EXECUTIVE ELECTRICAL ENGINEERING &amp; INFRASTRUCTURE PACKAGE
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
            Prepared in accordance with IEC 60364 &amp; BS 7671 Electrical Regulations
          </p>
        </div>
        <div className="text-right text-xs space-y-0.5 font-mono text-[var(--text-muted)]">
          <div className="font-bold text-sm text-amber-500 dark:text-amber-400">ProCal Engineering Suite</div>
          <div>Report Ref: <span className="font-semibold text-[var(--foreground-color)]">PRJ-{project.id.slice(-6).toUpperCase()}</span></div>
          <div>Date: <span className="font-semibold text-[var(--foreground-color)]">{project.date || new Date().toLocaleDateString()}</span></div>
        </div>
      </div>

      {/* Project Meta 3-Card Grid */}
      <div className="grid grid-cols-3 gap-3 border border-[var(--border-color)] rounded-xl p-3 bg-[var(--card-bg-subtle)] text-xs shadow-xs">
        <div className="border-r border-[var(--border-color)] pr-2">
          <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold tracking-wider">Client Name</span>
          <span className="font-bold text-[var(--foreground-color)] text-sm">{project.client || 'N/A'}</span>
        </div>
        <div className="border-r border-[var(--border-color)] pr-2">
          <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold tracking-wider">Consultant</span>
          <span className="font-bold text-[var(--foreground-color)] text-sm">{project.consultant || 'N/A'}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold tracking-wider">Lead Engineer</span>
          <span className="font-bold text-[var(--foreground-color)] text-sm">{project.engineer || 'N/A'}</span>
        </div>
      </div>

      {/* 1. System Electrical Calculations Summary (4 KPI Cards) */}
      <div>
        <h2 className="text-xs font-bold text-[var(--foreground-color)] uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
          1. System Electrical Calculations Summary
        </h2>
        <div className="grid grid-cols-4 gap-3 mb-2">
          <div className="border border-amber-500/30 rounded-xl p-2.5 text-center bg-amber-500/10 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block">Total Max Demand</span>
            <span className="text-base font-black text-[var(--foreground-color)] font-mono">{demandKva.toFixed(1)} kVA</span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 font-mono block mt-0.5">
              {totalDemandKw.toFixed(1)} kW <span className="text-[var(--text-muted)] font-normal">(PF {reportPf})</span>
            </span>
          </div>
          <div className="border border-sky-500/30 rounded-xl p-2.5 text-center bg-sky-500/10 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 block">Calculated Current</span>
            <span className="text-base font-black text-[var(--foreground-color)] font-mono">{totalCurrentA.toFixed(1)} A</span>
          </div>
          <div className="border border-emerald-500/30 rounded-xl p-2.5 text-center bg-emerald-500/10 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">System Voltage</span>
            <span className="text-base font-black text-[var(--foreground-color)] font-mono">{project.voltage}V 3-Phase</span>
          </div>
          <div className="border border-purple-500/30 rounded-xl p-2.5 text-center bg-purple-500/10 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 block">Utility Transformer</span>
            <span className="text-base font-black text-[var(--foreground-color)] font-mono">{transformerKva} kVA ({project.voltage}V)</span>
          </div>
        </div>
      </div>

      {/* 2. Project Distribution Hierarchy & Infrastructure */}
      <div>
        <h2 className="text-xs font-bold text-[var(--foreground-color)] uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
          2. Project Distribution Hierarchy &amp; Infrastructure
        </h2>
        <table className="w-full text-left text-xs border border-[var(--border-color)] rounded-lg overflow-hidden mb-2 shadow-xs">
          <thead>
            <tr className="bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border-color)]">
              <th className="p-2 border-r border-[var(--border-color)]">Building / Structure</th>
              <th className="p-2 border-r border-[var(--border-color)] text-center">Floors</th>
              <th className="p-2 border-r border-[var(--border-color)] text-center">Main Incomer Breaker</th>
              <th className="p-2 border-r border-[var(--border-color)] text-center">Main Feeder Cable</th>
              <th className="p-2 border-r border-[var(--border-color)] text-center">Sub-Panels (DB/SMDB)</th>
              <th className="p-2 text-right">Max Demand (kVA / kW / Amps)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)] text-[var(--foreground-color)]">
            {project.buildings?.map((bldg, idx) => {
              const bldgItems = [
                ...bldg.floorDesigns.flatMap((fd) => fd.items),
                ...(bldg.buildingLoads ?? []),
              ];
              const bldgBalance = phaseBalance(bldgItems as never, project as never);
              const incomer = resolveBuildingIncomer(bldg, project, findBreaker, breakerSettings);

              return (
                <tr key={bldg.id} className={idx % 2 === 0 ? 'bg-[var(--card-bg)]' : 'bg-[var(--card-bg-subtle)]/50'}>
                  <td className="p-2 border-r border-[var(--border-color)] font-bold text-[var(--foreground-color)]">{bldg.name}</td>
                  <td className="p-2 border-r border-[var(--border-color)] text-center font-mono">{bldg.floors}</td>
                  <td className="p-2 border-r border-[var(--border-color)] text-center font-mono font-bold text-[var(--foreground-color)]">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                      {incomer.breakerRating}A {incomer.breakerCategory}
                    </span>
                  </td>
                  <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-[11px] text-[var(--text-muted)]">
                    {incomer.cableSpec}
                  </td>
                  <td className="p-2 border-r border-[var(--border-color)] text-center font-mono text-[var(--text-muted)]">
                    {bldg.floorDesigns?.length || 0} Panels
                  </td>
                  <td className="p-2 text-right font-bold text-[var(--foreground-color)] font-mono">
                    {(bldgBalance.totalKw / reportPf).toFixed(1)} kVA{' '}
                    <span className="text-[var(--text-muted)] font-normal text-[11px]">
                      ({bldgBalance.totalKw.toFixed(1)} kW)
                    </span>{' '}
                    <span className="text-amber-600 dark:text-amber-400 font-normal text-[11px]">
                      [{bldgBalance.maxPhaseCurrent.toFixed(1)}A]
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {project.buildings && project.buildings.length > 1 && (
            <tfoot>
              <tr className="bg-amber-500/10 border-t-2 border-amber-500/30 font-bold text-[var(--foreground-color)]">
                <td className="p-2 border-r border-amber-500/20 font-black">Total Project Infrastructure</td>
                <td className="p-2 border-r border-amber-500/20 text-center font-mono">
                  {project.buildings.reduce((sum, b) => sum + b.floors, 0)}
                </td>
                <td className="p-2 border-r border-amber-500/20 text-center font-mono text-xs text-amber-600 dark:text-amber-400">
                  Main Distribution Board
                </td>
                <td className="p-2 border-r border-amber-500/20 text-center font-mono text-[11px] text-[var(--text-muted)]">
                  Utility Feeder
                </td>
                <td className="p-2 border-r border-amber-500/20 text-center font-mono">
                  {project.buildings.reduce((sum, b) => sum + (b.floorDesigns?.length || 0), 0)} Panels
                </td>
                <td className="p-2 text-right font-black font-mono text-amber-600 dark:text-amber-400">
                  {demandKva.toFixed(1)} kVA{' '}
                  <span className="text-[var(--text-muted)] font-normal text-[11px]">
                    ({totalDemandKw.toFixed(1)} kW)
                  </span>{' '}
                  <span className="text-amber-600 dark:text-amber-400 font-normal text-[11px]">
                    [{totalCurrentA.toFixed(1)}A]
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 3. Document Revisions Block */}
      <div>
        <h2 className="text-xs font-bold text-[var(--foreground-color)] uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
          3. Document Revisions History
        </h2>
        <table className="w-full text-left text-xs border border-[var(--border-color)] rounded-lg overflow-hidden shadow-xs">
          <thead>
            <tr className="bg-[var(--card-bg-subtle)] text-[var(--foreground-color)] text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border-color)]">
              <th className="p-2 border-r border-[var(--border-color)] w-16">Rev</th>
              <th className="p-2 border-r border-[var(--border-color)] w-28">Date</th>
              <th className="p-2 border-r border-[var(--border-color)]">Description</th>
              <th className="p-2 w-36">Prepared By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)] text-[var(--foreground-color)]">
            {revisions.length === 0 ? (
              <tr>
                <td className="p-2 border-r border-[var(--border-color)] font-mono font-bold">R0</td>
                <td className="p-2 border-r border-[var(--border-color)] font-mono">{project.date || new Date().toLocaleDateString()}</td>
                <td className="p-2 border-r border-[var(--border-color)]">Initial issue and engineering baseline</td>
                <td className="p-2 font-medium">{project.engineer || 'Lead Engineer'}</td>
              </tr>
            ) : (
              [...revisions]
                .sort((a, b) => (a.rev > b.rev ? -1 : 1))
                .map((r, idx) => (
                  <tr key={r.id} className={idx === 0 ? 'bg-amber-500/10 font-semibold' : ''}>
                    <td className="p-2 border-r border-[var(--border-color)] font-mono font-bold text-[var(--foreground-color)]">{r.rev}</td>
                    <td className="p-2 border-r border-[var(--border-color)] font-mono">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-2 border-r border-[var(--border-color)]">{r.description}</td>
                    <td className="p-2">{r.createdByUsername}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTabContent = (tab: ReportTab) => {
    switch (tab) {
      case 'summary':
        return renderSummary();
      case 'loads':
        return <LoadSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
      case 'mdb':
        return <MDBSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
      case 'cable':
        return <CableSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
      case 'breaker':
        return <BreakerSchedule project={project} buildingId={selectedBuilding ?? undefined} manufacturer={preferredManufacturer} />;
      case 'vd':
        return <VDSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
      case 'shortCircuit':
        return <ShortCircuitSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
      case 'bom':
        return <BOMSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
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
      <div className="screen-only-report bg-[var(--card-bg)] text-[var(--foreground-color)] rounded-xl p-6 shadow-xs border border-[var(--border-color)]">
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
