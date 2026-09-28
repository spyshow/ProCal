'use client';
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import {
  GitBranch,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { formatCableSizeFor } from '@/lib/calculations/cables';
import { createFindBreaker } from '@/lib/calculations/feeders';
import { useEquipmentCatalog } from '@/hooks/useEquipmentCatalog';
import { buildRiserModel, riserBand, RISER_BAND_COLOR } from '@/lib/drawings/riser-model';
import { RiserSvg, SCREEN_RISER_THEME } from '@/lib/drawings/riser-svg';
import { PageSkeleton } from '@/components/ui/skeleton';
import type { Project } from '@/types';
import WorkflowStepper from '@/components/layout/WorkflowStepper';
import { AccessRestricted } from '@/components/AccessRestricted';
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner';
import { QAReviewDrawer } from '@/components/QAReviewDrawer';

// The per-floor shape (RiserFloorModel) used to be re-declared here as
// `FloorData`. It now comes straight from @/lib/drawings/riser-model, which
// already Omits the string riser fields and re-adds RiserFloorVd's numeric forms.

export default function RiserPage() {
  const { selectedProjectId, selectedProject, loading: contextLoading, canView, canEdit } = useProject();
  const { t, isRtl } = useTranslation();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (selectedProject && selectedProject.id === selectedProjectId) {
      setProject(selectedProject);
      if (!selectedBuilding && selectedProject.buildings.length > 0) {
        setSelectedBuilding(selectedProject.buildings[0].id);
      }
      setLoading(false);
    }
  }, [selectedProject, selectedProjectId, selectedBuilding]);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) { setLoading(false); return; }
    if (selectedProject?.id === selectedProjectId) {
      setProject(selectedProject);
      if (!selectedBuilding && selectedProject.buildings.length > 0) {
        setSelectedBuilding(selectedProject.buildings[0].id);
      }
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (!selectedBuilding && data.buildings.length > 0) setSelectedBuilding(data.buildings[0].id);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedProjectId, selectedProject, selectedBuilding]);

  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      loadProject();
    }
  }, [loadProject, selectedProject, selectedProjectId]);

  // Hooks MUST run unconditionally (before any early return) or React throws
  // "rendered more hooks than during the previous render" (#310) — the guard
  // for missing project data sits after the hook block below.
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (project?.preferredManufacturer && project.preferredManufacturer !== 'MIXED') {
      params.set('manufacturer', project.preferredManufacturer);
    }
    return params.toString();
  }, [project]);
  const { equipment } = useEquipmentCatalog(query);

  const findBreaker = useMemo(
    () =>
      createFindBreaker(
        equipment,
        {
          ACB: project?.defaultAcbFamilyId ?? undefined,
          MCCB: project?.defaultMccbFamilyId ?? undefined,
          MCB: project?.defaultMcbFamilyId ?? undefined,
        },
        project?.preferredManufacturer
      ),
    [equipment, project]
  );

  if (!project && (loading || contextLoading || selectedProjectId)) {
    return <PageSkeleton titleWidth="w-56" rowCount={6} />;
  }

  if (!project || project.buildings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
        <GitBranch size={40} className="text-[var(--text-muted)] mb-3" />
        <p className="text-[var(--text-muted)] text-sm">No project data. Select a project from the sidebar.</p>
      </div>
    );
  }

  // All riser geometry + engineering summary now lives in @/lib/drawings/riser-model
  // so the server-side print path produces an identical drawing (Task 4 Step 2).
  const model = buildRiserModel(project, selectedBuilding, findBreaker);
  const bldg = model?.building ?? project.buildings[0];
  const floorData = model?.floors ?? [];
  const TOTAL_VD_LIMIT = model?.totalVdLimit ?? project.maxVoltageDropPower ?? 4;

  // Band colour for a ΔV cell against its limit (4% total / 1% sub-main / 3% final).
  const bandColor = (pct: number, limit: number, hasData: boolean) =>
    RISER_BAND_COLOR[riserBand(pct, limit, hasData)];

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bldg.name}-riser.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selectedProject && !canView('riserDiagram')) {
    return <AccessRestricted pageTitle={t('nav.riserDiagram', 'Riser Diagram')} />;
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh]">
      {/* Workflow Stepper: Step 6 */}
      <WorkflowStepper currentStep={6} />

      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="riserDiagram" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="riserDiagram" pageTitle="Riser Diagram" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground-color)] flex items-center gap-2">
            <GitBranch size={22} className="text-orange-500" />
            {t('riser.title', 'Vertical Riser Diagram')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{project.name} &mdash; {bldg.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}
            className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] transition-colors cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
            className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] transition-colors cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] transition-colors cursor-pointer"
            title="Reset zoom"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={handleExportSVG}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-white-force text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download size={14} className="text-white" />
            {t('sld.exportSvg', 'Export SVG')}
          </button>
        </div>
      </div>

      {/* Building Selector */}
      {project.buildings.length > 1 && (
        <div className="flex gap-2">
          {project.buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
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

      {/* SVG Riser */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 overflow-auto shadow-xs" style={{ maxHeight: '80vh' }}>
        <div className="w-fit min-w-full flex justify-center py-1">
          <div
            style={{
              width: Math.round((model?.layout.svgWidth ?? 1100) * zoom),
              height: Math.round((model?.layout.svgHeight ?? 700) * zoom),
            }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              {model ? (
                <RiserSvg
                  ref={svgRef}
                  model={model}
                  theme={SCREEN_RISER_THEME}
                  labels={{
                    title: t('riser.title', 'RISER DIAGRAM'),
                    floors: t('calculator.floorsCount', 'Floors'),
                    mdb: t('sld.mdb', 'MDB — Main Distribution Board'),
                    mainBus: t('panel.mainBusbar', 'MAIN BUS'),
                    floor: t('riser.floor', 'FL'),
                    circuits: t('cableSchedule.circuits', 'apt feeders'),
                    legend: t('sld.legend', 'Legend'),
                  }}
                  className="bg-[var(--card-bg-subtle)] rounded-lg shadow-md border border-[var(--border-color)]"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-xs">
        <h3 className="text-sm font-semibold text-[var(--foreground-color)] mb-3">{t('riser.floorSummary', 'Floor Summary')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full engineering-table text-xs text-center border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--card-bg-subtle)]">
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.floor', 'Floor')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.panel', 'Panel')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.demand', 'Demand')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">ΣkVA</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">DF%</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.current', 'Current')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.riserVd', 'Riser ΔV')}<span className="block font-normal opacity-70">{'<1%'}</span></th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.branchVd', 'Branch ΔV')}<span className="block font-normal opacity-70">{'<3%'}</span></th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.totalVd', 'Total ΔV')}<span className="block font-normal opacity-70">{'<'}{TOTAL_VD_LIMIT}%</span></th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.voltage', 'Voltage')}</th>
                <th className="text-center py-2.5 px-3 text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[11px]">{t('riser.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {floorData.map((fd) => (
                <tr key={fd.id} className="border-b border-[var(--border-color)] hover:bg-[var(--card-bg-subtle)] transition-colors">
                  <td className="py-2.5 px-3 text-orange-500 font-semibold text-center">FL {fd.floorNumber}</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.hasFloorSubPanels ? `SDB-${fd.floorNumber}` : 'Direct'}</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.floorDemand.toFixed(1)} kW</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.floorKva.toFixed(1)} kVA</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.diversityPct.toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.floorCurrent.toFixed(0)} A</td>
                  <td className="py-2.5 px-3 text-center" style={{ color: bandColor(fd.riserVdPercent, 1, fd.hasRiser && !fd.riserNoData) }}>
                    {fd.hasRiser ? (fd.riserNoData ? '—' : `${fd.riserVdPercent.toFixed(2)}%`) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center" style={{ color: bandColor(fd.branchVdPercent, 3, !fd.branchNoData) }}>
                    {fd.branchNoData ? '—' : `${fd.branchVdPercent.toFixed(2)}%`}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold" style={{ color: bandColor(fd.totalVdPercent, TOTAL_VD_LIMIT, !fd.totalNoData) }}>
                    {fd.totalNoData ? '—' : `${fd.totalVdPercent.toFixed(2)}%`}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--foreground-color)] text-center">{fd.totalNoData ? '—' : `${fd.actualVoltage.toFixed(1)} V`}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                      fd.totalNoData ? 'bg-[var(--card-bg-subtle)] border-[var(--border-color)] text-[var(--text-muted)]' :
                      fd.isDanger ? 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400' :
                      fd.isWarning ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400' :
                      'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400'
                    }`}>
                      {fd.totalNoData ? 'NO DATA' : fd.isDanger ? 'DANGER' : fd.isWarning ? 'WARNING' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
          Branch ΔV = worst floor branch — apartments at full connected-load design current (undiversified, IEC 60364-5-52 §525; diversity applies to the shared riser only), other loads at their design current. Riser ΔV uses the floor max-loaded-phase current. Cable lengths missing from the project default to 10 m + 5 m per floor above the first, matching the Cable Schedule. Total budget = the project Power ΔV limit ({TOTAL_VD_LIMIT}%).
        </p>
      </div>
    </div>
  );
}
