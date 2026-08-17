'use client';
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import RevisionsPanel from '@/components/report/RevisionsPanel';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { sizeTransformer } from '@/lib/calculations/loads';
import { calculateShortCircuitCurrent, getTypicalImpedance } from '@/lib/calculations/shortCircuit';
import CoverPage from '@/components/report/CoverPage';
import ReportHeader from '@/components/report/ReportHeader';
import BOMSchedule from '@/components/report/BOMSchedule';
import MDBSchedule from '@/components/report/MDBSchedule';
import CableSchedule from '@/components/report/CableSchedule';
import BreakerSchedule from '@/components/report/BreakerSchedule';
import VDSchedule from '@/components/report/VDSchedule';
import type { Project, ProjectRevision, ReportTab } from '@/types';
import { createFindBreaker, type EquipmentItem } from '@/lib/calculations/feeders';
import WorkflowStepper from '@/components/layout/WorkflowStepper';

export default function ReportsPage() {
  const { selectedProjectId, selectedProject, loading: contextLoading, preferredManufacturer, refreshProject } = useProject();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [company, setCompany] = useState<{ companyName: string; logoUrl: string }>({ companyName: "", logoUrl: "" });
  const [revisions, setRevisions] = useState<ProjectRevision[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (selectedProject && selectedProject.id === selectedProjectId) {
      setProject(selectedProject);
      if (!selectedBuilding && selectedProject.buildings.length > 0) {
        setSelectedBuilding(selectedProject.buildings[0].id);
      }
      setLoading(false);
    }
  }, [selectedProject, selectedProjectId, selectedBuilding]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
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
          if (cancelled) return;
          setProject(data);
          if (!selectedBuilding && data.buildings.length > 0) setSelectedBuilding(data.buildings[0].id);
        }
      } catch (err) { console.error(err); } finally { if (!cancelled) setLoading(false); }
    };
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      run();
    }
    return () => { cancelled = true; };
  }, [selectedProjectId, selectedProject, selectedBuilding]);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => { if (data.company) setCompany(data.company); })
      .catch(() => {});
  }, []);

  // Load issued revisions (for the cover-page revision block).
  const loadRevisions = useCallback(async () => {
    if (!project) return;
    try {
      const r = await fetch(`/api/projects/${project.id}/revisions?t=${Date.now()}`, { cache: 'no-store' });
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

  const handleExportExcel = async () => {
    if (!project || exporting) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/equipment?category=ACB,MCCB,MCB`);
      const equipment: EquipmentItem[] = res.ok ? await res.json() : [];
      const findBreaker = createFindBreaker(
        equipment,
        {
          ACB: project.defaultAcbFamilyId ?? undefined,
          MCCB: project.defaultMccbFamilyId ?? undefined,
          MCB: project.defaultMcbFamilyId ?? undefined,
        },
        preferredManufacturer
      );
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
    documentTitle: project?.name ? `${project.name} - Report` : 'Report',
  });

  if (!project && (loading || contextLoading || selectedProjectId)) {
    return <PageSkeleton titleWidth="w-56" rowCount={6} />;
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <FileText size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">{t('projects.selectProjectPrompt', 'No project data. Select a project first.')}</p>
      </div>
    );
  }

  const tabs: { key: ReportTab; label: string; icon: typeof FileText }[] = [
    { key: 'summary', label: t('reports.executiveSummary', 'Project Summary'), icon: FileText },
    { key: 'bom', label: t('reports.billOfMaterials', 'Bill of Materials'), icon: Table },
    { key: 'mdb', label: t('reports.loadSchedules', 'MDB Schedule'), icon: Building2 },
    { key: 'cable', label: t('reports.cableSizingReport', 'Cable Schedule'), icon: Table },
    { key: 'vd', label: t('cables.title', 'Voltage Drop'), icon: Table },
  ];

  const renderSummary = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-bold border-b pb-2">Project Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {[
          ['Project', project.name],
          ['Client', project.client],
          ['Consultant', project.consultant],
          ['Contractor', project.contractor],
          ['Location', project.location],
          ['Engineer', project.engineer],
          ['Date', project.date || new Date().toLocaleDateString()],
          ['System', `${project.voltage}V / ${project.frequency}Hz`],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-gray-500 uppercase">{label}</p>
            <p className="font-semibold">{value || '—'}</p>
          </div>
        ))}
      </div>
      <h3 className="font-bold border-b pb-1 mt-4">Building Summary</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Building</th>
            <th className="border p-2 text-center">Floors</th>
            <th className="border p-2 text-center">Apts/Floor</th>
            <th className="border p-2 text-center">Total Apts</th>
            <th className="border p-2 text-right">Total Demand (kW)</th>
            <th className="border p-2 text-right">Main Current (A)</th>
          </tr>
        </thead>
        <tbody>
          {project.buildings.map((b) => {
            const totalApts = b.floors * b.apartmentsPerFloor;
            const allItems = [
              ...b.floorDesigns.flatMap((fd) => fd.items),
              ...(b.buildingLoads ?? []),
            ];
            const balance = phaseBalance(allItems as any, project as any);
            const totalDemand = balance.totalKw;
            const mainCurrent = balance.maxPhaseCurrent;
            return (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="border p-2 font-semibold">{b.name}</td>
                <td className="border p-2 text-center">{b.floors}</td>
                <td className="border p-2 text-center">{b.apartmentsPerFloor}</td>
                <td className="border p-2 text-center">{totalApts}</td>
                <td className="border p-2 text-right font-mono">{totalDemand.toFixed(1)}</td>
                <td className="border p-2 text-right font-mono text-orange-600">{mainCurrent.toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className="font-bold border-b pb-1 mt-4">Short-Circuit &amp; Earthing Analysis</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Building</th>
            <th className="border p-2 text-center">Earthing System</th>
            <th className="border p-2 text-center">Transformer</th>
            <th className="border p-2 text-right">3Φ Isc (kA)</th>
            <th className="border p-2 text-right">2Φ Isc (kA)</th>
            <th className="border p-2 text-right">P-N / Earth Isc (kA)</th>
            <th className="border p-2 text-left">Protection &amp; Earthing Notes</th>
          </tr>
        </thead>
        <tbody>
          {project.buildings.map((b) => {
            const allItems = [
              ...b.floorDesigns.flatMap((fd) => fd.items),
              ...(b.buildingLoads ?? []),
            ];
            const balance = phaseBalance(allItems as any, project as any);
            const demandKva = balance.totalKw / (project.powerFactor || 0.85);
            const transformerKva = project.transformerSize || sizeTransformer(demandKva);
            const earthingSystem = b.earthingSystem || 'TN-S';
            const sc = calculateShortCircuitCurrent({
              ratedPower: transformerKva,
              voltagePrimary: 11000,
              voltageSecondary: project.voltage,
              impedancePercent: getTypicalImpedance(transformerKva),
              earthingSystem,
            });

            return (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="border p-2 font-semibold">{b.name}</td>
                <td className="border p-2 text-center font-mono font-bold">
                  <span className="px-2 py-0.5 rounded bg-gray-100 border text-xs">
                    {earthingSystem}
                  </span>
                </td>
                <td className="border p-2 text-center font-mono">{transformerKva} kVA</td>
                <td className="border p-2 text-right font-mono text-red-600 font-bold">{sc.threePhaseIsc.toFixed(2)}</td>
                <td className="border p-2 text-right font-mono text-yellow-600">{sc.twoPhaseIsc.toFixed(2)}</td>
                <td className="border p-2 text-right font-mono text-blue-600 font-bold">
                  {sc.itFirstFault ? '0.00' : sc.phaseToNeutralIsc.toFixed(2)}
                </td>
                <td className="border p-2 text-xs text-gray-600">
                  {sc.itFirstFault
                    ? 'Negligible on 1st fault; IMD insulation monitoring required'
                    : earthingSystem.toUpperCase() === 'TT'
                    ? 'Restricted by Z_earth (0.5Ω); RCD protection mandatory'
                    : 'Solid ground (low impedance loop; rapid magnetic trip)'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3 className="font-bold border-b pb-1 mt-4">Apartment Templates</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Template</th>
            <th className="border p-2 text-center">Phase</th>
            <th className="border p-2 text-right">Area (m²)</th>
            <th className="border p-2 text-center">Rooms</th>
            <th className="border p-2 text-right">Connected (kW)</th>
          </tr>
        </thead>
        <tbody>
          {project.apartmentTemplates.map((t) => {
            const totalArea = t.rooms?.reduce((sum, r) => sum + r.area, 0) || 0;
            const totalLoad = t.rooms?.reduce((sum, r) => sum + r.connectedLoad, 0) || 0;
            return (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="border p-2 font-semibold">{t.name}</td>
                <td className="border p-2 text-center font-mono">{t.phases === 3 ? '3Φ' : '1Φ'}</td>
                <td className="border p-2 text-right font-mono">{totalArea.toFixed(1)}</td>
                <td className="border p-2 text-center font-mono">{t.rooms?.length || 0}</td>
                <td className="border p-2 text-right font-mono">{(totalLoad / 1000).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderTabContent = (tab: ReportTab) => {
    switch (tab) {
      case 'summary':
        return renderSummary();
      case 'bom':
        return <BOMSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
      case 'mdb':
        return <MDBSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
      case 'cable':
        return <CableSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
      case 'vd':
        return <VDSchedule project={project} buildingId={selectedBuilding ?? undefined} />;
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto print:p-0 print:w-full print:max-w-none print:m-0">
      {/* Workflow Stepper: Step 8 */}
      <div className="print:hidden">
        <WorkflowStepper currentStep={8} />
      </div>

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText size={22} className="text-orange-500" />
            {t('reports.title', 'Reports & Schedules')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRevisions(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold"
          >
            <History size={14} />
            Revisions
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {exporting ? 'Exporting…' : t('reports.downloadExcel', 'Export Excel')}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
          >
            <FileDown size={14} />
            {t('reports.downloadPdf', 'Export PDF')}
          </button>
        </div>
      </div>

      <RevisionsPanel projectId={project.id} open={showRevisions} onClose={() => setShowRevisions(false)} onChanged={handleRevisionsChanged} />

      {project.buildings.length > 1 && (
        <div className="flex gap-2 print:hidden">
          {project.buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedBuilding === b.id ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-800 print:hidden">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Active tab (screen only) */}
      <div className="screen-only-report bg-white text-gray-900 rounded-xl p-6">
        {renderTabContent(activeTab)}
      </div>

      {/* ========== PRINT-ONLY: FULL REPORT ========== */}
      {/* Always rendered but hidden off-screen; react-to-print clones this into an iframe */}
      <div ref={printRef} id="print-all-tabs" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <CoverPage project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} revisions={revisions} />

        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} />
          <BOMSchedule project={project} buildingId={selectedBuilding ?? undefined} />
        </div>

        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} />
          <MDBSchedule project={project} buildingId={selectedBuilding ?? undefined} />
        </div>

        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} />
          <CableSchedule project={project} buildingId={selectedBuilding ?? undefined} />
        </div>

        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} />
          <BreakerSchedule project={project} buildingId={selectedBuilding ?? undefined} manufacturer={preferredManufacturer} />
        </div>

        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
          <ReportHeader project={project} companyName={company.companyName} companyLogoUrl={company.logoUrl} />
          <VDSchedule project={project} buildingId={selectedBuilding ?? undefined} />
        </div>
      </div>
    </div>
  );
}
