'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
import { useUser } from '@/context/UserContext';
import { useTranslation } from '@/i18n';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Settings,
  Zap,
  Home,
  Shield,
  Sparkles,
  RefreshCw,
  Users,
  ClipboardCheck,
  History,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useUpgradeTrialProject } from '@/hooks/useUpgradeTrialProject';
import type { ProjectFloorDesign as FloorDesign, ProjectBuildingLoad as BuildingLoad, ProjectBuilding as Building, ProjectDetailModel as Project, ProjectDetailTab } from '@/components/projects/project-detail-types';
import { ProjectSettingsModal } from '@/components/projects/ProjectSettingsModal';
import { TemplatesTabPanel } from '@/components/projects/TemplatesTabPanel';
import { LoadLibraryPanel } from '@/components/projects/LoadLibraryPanel';
import { ProjectTeamTab } from '@/components/settings/ProjectTeamTab';
import { QAReviewTab } from '@/components/settings/QAReviewTab';
import { ActivityLogTab } from '@/components/settings/ActivityLogTab';
import { ProjectSettingsTab } from '@/components/settings/ProjectSettingsTab';


export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { selectedProject, selectedProjectId, selectProject, refreshProject, mutateProject, isQA, canEdit, isProjectManager, currentMemberRole } = useProject();
  const { user } = useUser();
  const { t, isRtl } = useTranslation();

  const isReadOnly = isQA || !canEdit('calculator') || currentMemberRole === 'QA';

  const [project, setProject] = useState<Project | null>(() => {
    if (selectedProject && selectedProject.id === projectId) {
      return selectedProject as any;
    }
    return null;
  });
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(() => !(selectedProject && selectedProject.id === projectId));
  const { upgrading, upgradeTrialProject } = useUpgradeTrialProject({ onUpgraded: () => loadProject() });
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>(() => {
    const tabParam = searchParams?.get('tab');
    const subtabParam = searchParams?.get('subtab');
    if (tabParam === 'team') return 'team';
    if (tabParam === 'qa' || tabParam === 'review') return 'qa';
    if (tabParam === 'activity' || tabParam === 'audit') return 'activity';
    if (tabParam === 'templates') return 'templates';
    if (tabParam === 'loads') return 'loads';
    if (
      tabParam === 'settings' ||
      tabParam === 'engineering' ||
      tabParam === 'standards' ||
      tabParam === 'company' ||
      subtabParam === 'engineering' ||
      subtabParam === 'standards' ||
      subtabParam === 'company'
    ) return 'settings';
    return 'buildings';
  });

  // Sync tab if URL query changes
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    const subtabParam = searchParams?.get('subtab');
    if (tabParam === 'team') setActiveTab('team');
    else if (tabParam === 'qa' || tabParam === 'review') setActiveTab('qa');
    else if (tabParam === 'activity' || tabParam === 'audit') setActiveTab('activity');
    else if (tabParam === 'templates') setActiveTab('templates');
    else if (tabParam === 'loads') setActiveTab('loads');
    else if (
      tabParam === 'settings' ||
      tabParam === 'engineering' ||
      tabParam === 'standards' ||
      tabParam === 'company' ||
      subtabParam === 'engineering' ||
      subtabParam === 'standards' ||
      subtabParam === 'company'
    ) setActiveTab('settings');
    else if (tabParam === 'buildings') setActiveTab('buildings');
  }, [searchParams]);

  const handleTabChange = (key: ProjectDetailTab) => {
    setActiveTab(key);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (key === 'buildings') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', key);
      }
      window.history.replaceState(null, '', url.toString());
      window.dispatchEvent(new CustomEvent('procal-tab-change', { detail: key }));
    }
  };
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [showNewBuilding, setShowNewBuilding] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState<Record<string, string>>({});
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [projectLogoUploading, setProjectLogoUploading] = useState(false);
  const [buildingForm, setBuildingForm] = useState({
    name: '',
    floors: 10,
    serviceFloors: 0,
    apartmentsPerFloor: 4,
    supplyVoltage: '400V 3-Phase',
    earthingSystem: 'TN-S',
    lightningProtection: false,
    generator: '',
    transformer: '',
    mechanicalLoads: '',
  });

  async function loadProject() {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (!selectedProjectId) {
          selectProject(projectId);
        }
      } else {
        router.push('/projects');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // If the user selects a different project in the sidebar while viewing /projects/[id],
  // navigate to that newly selected project rather than overriding their selection.
  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== projectId) {
      router.push(`/projects/${selectedProjectId}`);
    }
  }, [selectedProjectId, projectId, router]);

  useEffect(() => {
    if (selectedProject && selectedProject.id === projectId) {
      setProject(selectedProject as any);
      setLoading(false);
    } else if (projectId) {
      loadProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedProject?.id]);

  const handleSaveProject = async () => {
    // 1. Prepare typed values from projectForm
    const updatedFields: Record<string, any> = { ...projectForm };
    if (projectForm.voltage) updatedFields.voltage = parseFloat(projectForm.voltage) || project?.voltage;
    if (projectForm.frequency) updatedFields.frequency = parseFloat(projectForm.frequency) || project?.frequency;
    if (projectForm.powerFactor) updatedFields.powerFactor = parseFloat(projectForm.powerFactor) || project?.powerFactor;
    if (projectForm.maxDemandFactor) updatedFields.maxDemandFactor = parseFloat(projectForm.maxDemandFactor) || project?.maxDemandFactor;
    if (projectForm.maxVoltageDropLighting) updatedFields.maxVoltageDropLighting = parseFloat(projectForm.maxVoltageDropLighting) || project?.maxVoltageDropLighting;
    if (projectForm.maxVoltageDropPower) updatedFields.maxVoltageDropPower = parseFloat(projectForm.maxVoltageDropPower) || project?.maxVoltageDropPower;

    // 2. Optimistic local update: instant 0ms UI update
    setProject((prev: any) => (prev ? { ...prev, ...updatedFields } : null));
    mutateProject((prev) => (prev ? ({ ...prev, ...updatedFields } as any) : null));
    setEditingProject(false);

    // 3. Background asynchronous save with keepalive: true so browser persists even if user leaves page
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm),
        keepalive: true,
      });
      if (res.ok) {
        const data = await res.json();
        setProject((prev: any) => (prev ? { ...prev, ...data } : null));
        mutateProject((prev) => (prev ? ({ ...prev, ...data } as any) : null));
      } else {
        console.error('Failed to save project settings, reloading');
        loadProject();
        refreshProject();
      }
    } catch (err) {
      console.error('Save project error:', err);
      loadProject();
      refreshProject();
    }
  };

  const handleDeleteBuilding = async (buildingId: string) => {
    if (!confirm('Delete this building and all its floor designs?')) return;
    await fetch(`/api/buildings/${buildingId}`, { method: 'DELETE' });
    loadProject();
    refreshProject();
  };

  const startEditBuilding = (b: Building) => {
    setEditingBuilding(b);
    setBuildingForm({
      name: b.name,
      floors: b.floors,
      serviceFloors: b.serviceFloors,
      apartmentsPerFloor: b.apartmentsPerFloor,
      supplyVoltage: b.supplyVoltage,
      earthingSystem: b.earthingSystem,
      lightningProtection: b.lightningProtection,
      generator: b.generator != null ? String(b.generator) : '',
      transformer: b.transformer != null ? String(b.transformer) : '',
      mechanicalLoads: b.mechanicalLoads || '',
    });
  };

  const handleUpdateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuilding) return;

    const bldgId = editingBuilding.id;
    const formSnapshot = { ...buildingForm };

    setEditingBuilding(null);
    setProject((prev: any) => {
      if (!prev) return null;
      return {
        ...prev,
        buildings: (prev.buildings || []).map((b: Building) =>
          b.id === bldgId
            ? {
                ...b,
                ...formSnapshot,
                floors: Number(formSnapshot.floors),
                serviceFloors: Number(formSnapshot.serviceFloors),
                apartmentsPerFloor: Number(formSnapshot.apartmentsPerFloor),
              }
            : b
        ),
      };
    });

    try {
      const res = await fetch(`/api/buildings/${bldgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formSnapshot),
        keepalive: true,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to update building');
        loadProject();
        refreshProject();
        return;
      }
      loadProject();
      refreshProject();
    } catch (err) {
      console.error(err);
      loadProject();
      refreshProject();
    }
  };

  const handleNewBuilding = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    data.projectId = projectId;

    const res = await fetch('/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to create building');
      return;
    }
    setShowNewBuilding(false);
    loadProject();
    refreshProject();
  };

  // Building Loads (attach load-library items to a building)
  const [showAddBuildingLoad, setShowAddBuildingLoad] = useState<string | null>(null);
  const [buildingLoadForm, setBuildingLoadForm] = useState({ loadLibraryItemId: '', quantity: 1 });

  const handleAddBuildingLoad = async (buildingId: string) => {
    if (!buildingLoadForm.loadLibraryItemId) {
      alert('Select a load from the library first');
      return;
    }
    const res = await fetch(`/api/buildings/${buildingId}/loads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildingLoadForm),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to attach building load');
      return;
    }
    setBuildingLoadForm({ loadLibraryItemId: '', quantity: 1 });
    setShowAddBuildingLoad(null);
    loadProject();
  };

  const handleDeleteBuildingLoad = async (loadId: string) => {
    await fetch(`/api/building-loads/${loadId}`, { method: 'DELETE' });
    loadProject();
  };

  const handleUpdateBuildingLoadPhase = async (loadId: string, assignedPhase: number | null) => {
    const updateFn = (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        buildings: prev.buildings.map((b: any) => ({
          ...b,
          buildingLoads: (b.buildingLoads || []).map((bl: any) =>
            bl.id === loadId ? { ...bl, assignedPhase } : bl
          ),
        })),
      };
    };

    setProject(updateFn);
    if (mutateProject) {
      mutateProject(updateFn);
    }

    try {
      const res = await fetch(`/api/building-loads/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedPhase }),
      });
      if (!res.ok) throw new Error('Failed to update building load phase');
    } catch (err) {
      console.error('Failed to update building load phase:', err);
      loadProject();
    }
  };

  if (loading) {
    return <PageSkeleton titleWidth="w-72" subtitleWidth="w-96" rowCount={5} />;
  }

  if (!project) return null;

  const startEditProject = () => {
    setProjectForm({
      name: project.name,
      client: project.client,
      consultant: project.consultant,
      contractor: project.contractor,
      location: project.location,
      engineer: project.engineer,
      voltage: String(project.voltage),
      frequency: String(project.frequency),
      powerFactor: String(project.powerFactor),
      maxDemandFactor: String(project.maxDemandFactor),
      calculationStandard: project.calculationStandard || 'IEC',
      maxVoltageDropLighting: String(project.maxVoltageDropLighting),
      maxVoltageDropPower: String(project.maxVoltageDropPower),
      logoUrl: project.logoUrl || '',
    });
    setEditingProject(true);
  };

  const handleProjectLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProjectLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setProjectForm({ ...projectForm, logoUrl: data.url });
      }
    } finally {
      setProjectLogoUploading(false);
    }
  };

  const handleClearProjectLogo = () => {
    setProjectForm({ ...projectForm, logoUrl: '' });
  };

  return (
    <div className="p-3 sm:p-5 space-y-6 w-full max-w-[1680px] mx-auto min-h-[80vh]">
      {/* Free Trial Project Banner */}
      {project.isTrial && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-200">
                Free Trial Evaluation Project
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Limited to 1 building and up to 2 floors total. Official PDF reports and drawing exports include evaluation watermarks.
              </p>
            </div>
          </div>
          {(project.isOwner !== false || user?.role === 'ADMIN') && (
            <button
              onClick={() => upgradeTrialProject(project.id)}
            disabled={upgrading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Sparkles size={13} className={upgrading ? "animate-spin" : ""} />
            <span>{upgrading ? 'Upgrading…' : 'Upgrade to Full Project'}</span>
          </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {project.client && `${project.client} · `}
            {project.location || 'No location'} · {project.voltage}V {project.frequency}Hz
          </p>
        </div>
        <button
          onClick={() => handleTabChange('settings')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors cursor-pointer"
        >
          <Settings size={14} />
          {t('projects.settings', 'Settings')}
        </button>
      </div>

      {/* Project Settings Modal */}
      {editingProject && (
        <ProjectSettingsModal
          projectForm={projectForm}
          setProjectForm={setProjectForm}
          isReadOnly={isReadOnly}
          projectLogoUploading={projectLogoUploading}
          onLogoUpload={handleProjectLogoUpload}
          onClearLogo={handleClearProjectLogo}
          onSave={handleSaveProject}
          onClose={() => setEditingProject(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 overflow-x-auto custom-scrollbar">
        {[
          { key: 'buildings' as const, label: t('projects.buildings', 'Buildings'), icon: Building2 },
          { key: 'templates' as const, label: t('projects.apartmentTemplates', 'Apartment Templates'), icon: Home },
          { key: 'loads' as const, label: t('projects.loadLibrary', 'Service Load Library'), icon: Zap },
          { key: 'team' as const, label: t('settings.team', 'Project Team'), icon: Users },
          { key: 'qa' as const, label: t('settings.qa', 'QA & Compliance'), icon: ClipboardCheck },
          { key: 'activity' as const, label: t('settings.activity', 'Activity Log'), icon: History },
          { key: 'settings' as const, label: t('projects.projectSettings', 'Project Settings'), icon: Settings },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === key
                ? 'border-orange-500 text-orange-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Buildings Tab */}
      {activeTab === 'buildings' && (
        <div className="space-y-3">
          {!isReadOnly && (
            <div className="flex items-center justify-between gap-3">
              {project.isTrial && (
                <div className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <Sparkles size={14} className="shrink-0" />
                  <span>Free Trial Limit: 1 building, up to 2 floors total.</span>
                </div>
              )}
              <div className="ms-auto">
                {project.isTrial && (project.buildings?.length || 0) >= 1 ? (
                  <button
                    disabled
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-500 text-sm font-semibold cursor-not-allowed opacity-60"
                    title="Free trial projects are limited to 1 building. Upgrade project to add more."
                  >
                    <Plus size={14} />
                    {t('projects.addBuilding', 'Add Building')} (Limit Reached)
                  </button>
                ) : (
                  <button
                    onClick={() => setShowNewBuilding(!showNewBuilding)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold cursor-pointer"
                  >
                    <Plus size={14} />
                    {t('projects.addBuilding', 'Add Building')}
                  </button>
                )}
              </div>
            </div>
          )}

          {showNewBuilding && !isReadOnly && (
            <form onSubmit={handleNewBuilding} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-300">{t('projects.newBuilding', 'New Building')}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('projects.buildingName', 'Building Name')} *</label>
                  <input name="name" required className="dense-input w-full rounded" placeholder="Tower A" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('projects.floorsCount', 'Floors')} *</label>
                  <input name="floors" type="number" required defaultValue="10" className="dense-input w-full rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('projects.serviceFloors', 'Service Floors')}</label>
                  <input name="serviceFloors" type="number" defaultValue="0" className="dense-input w-full rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('projects.apartmentsPerFloor', 'Apartments/Floor')}</label>
                  <input name="apartmentsPerFloor" type="number" defaultValue="4" className="dense-input w-full rounded" />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input name="lightningProtection" type="checkbox" className="accent-orange-500" />
                    {t('projects.lightningProtection', 'Lightning Protection')}
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold">
                  {t('projects.createBuilding', 'Create Building')}
                </button>
                <button type="button" onClick={() => setShowNewBuilding(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </form>
          )}

          {project.buildings.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm rounded-xl border border-gray-800 bg-gray-900/40">
              {t('projects.noBuildings', 'No buildings added yet')}
            </div>
          ) : (
            project.buildings.map((bldg) => {
              const expanded = expandedBuilding === bldg.id;
              const totalApts = bldg.floors * bldg.apartmentsPerFloor;
              return (
                <div
                  key={bldg.id}
                  className={`rounded-xl border border-[var(--border-color,#1f2937)] hover:border-orange-500/50 bg-[var(--card-bg,#0b0f19)] overflow-hidden transition-all ${
                    expanded ? '' : 'hover:bg-[var(--card-bg-subtle)] cursor-pointer'
                  }`}
                >
                  <div
                    className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                      expanded ? 'hover:bg-[var(--card-bg-subtle)] rounded-t-xl' : 'rounded-xl'
                    }`}
                    onClick={() => setExpandedBuilding(expanded ? null : bldg.id)}
                  >
                    {expanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                    <Building2 size={18} className="text-orange-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--foreground-color,#f8fafc)]">{bldg.name}</p>
                      <p className="text-xs text-gray-500">
                        {bldg.floors} {t('projects.floorsCount', 'floors')} · {bldg.serviceFloors} {t('projects.serviceFloors', 'service')} · {totalApts} {t('projects.apartments', 'apartments')} · {bldg.buildingLoads?.length || 0} {t('cableSchedule.buildingLoads', 'building loads')}
                      </p>
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditBuilding(bldg); }}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-orange-400 hover:bg-orange-500/10"
                          title={t('common.edit', 'Edit building')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(bldg.id); }}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                          title={t('common.delete', 'Delete building')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {expanded && (
                    <div className="border-t border-gray-800 p-4 space-y-3 bg-gray-900/20">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('projects.floorDesigns', 'Floor Designs')}</h4>
                      {bldg.floorDesigns.length === 0 ? (
                        <p className="text-xs text-gray-600">No floor designs</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {bldg.floorDesigns
                            .sort((a, b) => b.floorNumber - a.floorNumber)
                            .map((fd) => (
                              <div
                                key={fd.id}
                                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-800 bg-gray-800/30 hover:border-gray-700"
                              >
                                <span
                                  className="text-xs font-mono text-orange-400 w-16 cursor-pointer"
                                  onClick={() => router.push(`/calculator?floor=${fd.id}`)}
                                >
                                  F{fd.floorNumber}
                                </span>
                                <span
                                  className="text-xs text-gray-400 flex-1 cursor-pointer"
                                  onClick={() => router.push(`/calculator?floor=${fd.id}`)}
                                >
                                  {fd.items.length} item{fd.items.length !== 1 ? 's' : ''}
                                </span>
                                <span className="text-[10px] text-gray-600">
                                  {fd.items.reduce((s: number, i: any) => s + (i.calculatedMaxDemand || 0), 0).toFixed(1)} kVA
                                </span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (isReadOnly) return;
                                    const newValue = !fd.hasFloorSubPanels;

                                    // 1. Instant optimistic UI update in local state (0ms user latency)
                                    setProject((prev: any) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        buildings: prev.buildings?.map((b: any) => ({
                                          ...b,
                                          floorDesigns: b.floorDesigns?.map((f: any) =>
                                            f.id === fd.id ? { ...f, hasFloorSubPanels: newValue } : f
                                          ),
                                        })),
                                      };
                                    });

                                    // 2. Also keep global ProjectContext in sync
                                    mutateProject((prev: any) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        buildings: prev.buildings?.map((b: any) => ({
                                          ...b,
                                          floorDesigns: b.floorDesigns?.map((f: any) =>
                                            f.id === fd.id ? { ...f, hasFloorSubPanels: newValue } : f
                                          ),
                                        })),
                                      };
                                    });

                                    // 3. Persist in background without blocking or re-fetching whole project
                                    try {
                                      const res = await fetch(`/api/floors/${fd.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ hasFloorSubPanels: newValue }),
                                      });
                                      if (!res.ok) {
                                        throw new Error('Failed to update sub-panel setting');
                                      }
                                    } catch (err) {
                                      console.error('Error toggling floor sub-panel:', err);
                                      // Revert on error
                                      setProject((prev: any) => {
                                        if (!prev) return prev;
                                        return {
                                          ...prev,
                                          buildings: prev.buildings?.map((b: any) => ({
                                            ...b,
                                            floorDesigns: b.floorDesigns?.map((f: any) =>
                                              f.id === fd.id ? { ...f, hasFloorSubPanels: !newValue } : f
                                            ),
                                          })),
                                        };
                                      });
                                      mutateProject((prev: any) => {
                                        if (!prev) return prev;
                                        return {
                                          ...prev,
                                          buildings: prev.buildings?.map((b: any) => ({
                                            ...b,
                                            floorDesigns: b.floorDesigns?.map((f: any) =>
                                              f.id === fd.id ? { ...f, hasFloorSubPanels: !newValue } : f
                                            ),
                                          })),
                                        };
                                      });
                                    }
                                  }}
                                  disabled={isReadOnly}
                                  className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                                    fd.hasFloorSubPanels
                                      ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                                      : 'bg-[var(--card-bg-subtle)] text-[var(--table-header-color)] border border-[var(--border-color)] hover:border-orange-500/40'
                                  } ${isReadOnly ? 'cursor-default opacity-80' : ''}`}
                                  title={fd.hasFloorSubPanels ? 'Sub-panel enabled' : 'Sub-panel disabled'}
                                >
                                  <span className={`w-3 h-3 rounded-sm border flex items-center justify-center ${
                                    fd.hasFloorSubPanels
                                      ? 'bg-orange-600 border-orange-500'
                                      : 'border-[var(--border-color)]'
                                  }`}>
                                    {fd.hasFloorSubPanels && (
                                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                        <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                  </span>
                                  Sub-Panel
                                </button>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Building Loads — attach load-library items (elevator, pumps, AC, fire pump) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Building Loads</h4>
                          {!isReadOnly && (
                            <button
                              onClick={() => {
                                setBuildingLoadForm({ loadLibraryItemId: '', quantity: 1 });
                                setShowAddBuildingLoad(showAddBuildingLoad === bldg.id ? null : bldg.id);
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-orange-400"
                            >
                              <Plus size={12} />
                              Add Building Load
                            </button>
                          )}
                        </div>

                        {(bldg.buildingLoads?.length || 0) === 0 ? (
                          <p className="text-xs text-gray-600">
                            No building loads. Add elevator, pumps, AC, and fire pump from the load library.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {bldg.buildingLoads.map((bl) => (
                              <div
                                key={bl.id}
                                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-800 bg-gray-800/30"
                              >
                                <Zap size={14} className="text-orange-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-200 truncate">
                                    {bl.loadLibraryItem?.name ?? '(deleted)'}
                                  </p>
                                  <p className="text-[10px] text-gray-500">
                                    {bl.loadLibraryItem?.category ?? '—'} · {bl.quantity} × {(bl.loadLibraryItem?.power ?? 0).toFixed(1)} kW
                                  </p>
                                </div>
                                {!isReadOnly && (bl.loadLibraryItem?.phase ?? 3) !== 3 && (
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={() => handleUpdateBuildingLoadPhase(bl.id, null)}
                                      className={`px-1.5 py-0.5 text-[10px] rounded font-mono ${bl.assignedPhase === null ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
                                      title="Auto-assign phase"
                                    >A</button>
                                    {[1, 2, 3].map((p) => (
                                      <button
                                        key={p}
                                        onClick={() => handleUpdateBuildingLoadPhase(bl.id, p)}
                                        className={`px-1.5 py-0.5 text-[10px] rounded font-mono ${bl.assignedPhase === p ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
                                        title={`Assign to L${p}`}
                                      >L{p}</button>
                                    ))}
                                  </div>
                                )}
                                {!isReadOnly && (
                                  <button
                                    onClick={() => handleDeleteBuildingLoad(bl.id)}
                                    className="p-1 rounded text-gray-600 hover:text-red-400"
                                    title="Remove building load"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {showAddBuildingLoad === bldg.id && (
                          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 space-y-2">
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <label className="block text-[10px] text-gray-500 mb-1">From Library</label>
                                <select
                                  value={buildingLoadForm.loadLibraryItemId}
                                  onChange={(e) => setBuildingLoadForm({ ...buildingLoadForm, loadLibraryItemId: e.target.value })}
                                  className="dense-input w-full rounded"
                                >
                                  <option value="">Select load…</option>
                                  <optgroup label="From Library">
                                    {(project?.loadLibraryItems || []).map((l: any) => (
                                      <option key={l.id} value={l.id}>
                                        {l.name} — {l.power}kW ({l.category})
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-500 mb-1">Qty</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={buildingLoadForm.quantity}
                                  onChange={(e) => setBuildingLoadForm({ ...buildingLoadForm, quantity: parseInt(e.target.value) || 1 })}
                                  className="dense-input w-16 rounded"
                                />
                              </div>
                              <button
                                onClick={() => handleAddBuildingLoad(bldg.id)}
                                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => setShowAddBuildingLoad(null)}
                                className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Edit Building Modal */}
      {editingBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <Building2 size={20} className="text-orange-500" />
              <h2 className="text-lg font-semibold text-white">Edit Building</h2>
            </div>

            <form onSubmit={handleUpdateBuilding} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    value={buildingForm.name}
                    onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                    required
                    className="dense-input w-full rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Floors *</label>
                  <input
                    type="number"
                    value={buildingForm.floors}
                    onChange={(e) => setBuildingForm({ ...buildingForm, floors: Number(e.target.value) })}
                    required
                    className="dense-input w-full rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Service Floors</label>
                  <input
                    type="number"
                    value={buildingForm.serviceFloors}
                    onChange={(e) => setBuildingForm({ ...buildingForm, serviceFloors: Number(e.target.value) })}
                    className="dense-input w-full rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Apartments/Floor</label>
                  <input
                    type="number"
                    value={buildingForm.apartmentsPerFloor}
                    onChange={(e) => setBuildingForm({ ...buildingForm, apartmentsPerFloor: Number(e.target.value) })}
                    className="dense-input w-full rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Supply Voltage</label>
                  <select
                    value={buildingForm.supplyVoltage}
                    onChange={(e) => setBuildingForm({ ...buildingForm, supplyVoltage: e.target.value })}
                    className="dense-input w-full rounded"
                  >
                    <option value="400V 3-Phase">400V 3-Phase</option>
                    <option value="230V 1-Phase">230V 1-Phase</option>
                    <option value="415V 3-Phase">415V 3-Phase</option>
                    <option value="380V 3-Phase">380V 3-Phase</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Earthing System</label>
                  <select
                    value={buildingForm.earthingSystem}
                    onChange={(e) => setBuildingForm({ ...buildingForm, earthingSystem: e.target.value })}
                    className="dense-input w-full rounded"
                  >
                    <option value="TN-S">TN-S</option>
                    <option value="TN-C-S">TN-C-S</option>
                    <option value="TT">TT</option>
                    <option value="IT">IT</option>
                    <option value="TNC">TNC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Generator (kVA)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={buildingForm.generator}
                    onChange={(e) => setBuildingForm({ ...buildingForm, generator: e.target.value })}
                    className="dense-input w-full rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Transformer (kVA)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={buildingForm.transformer}
                    onChange={(e) => setBuildingForm({ ...buildingForm, transformer: e.target.value })}
                    className="dense-input w-full rounded"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <input
                    type="checkbox"
                    checked={buildingForm.lightningProtection}
                    onChange={(e) => setBuildingForm({ ...buildingForm, lightningProtection: e.target.checked })}
                    className="accent-orange-500"
                  />
                  Lightning Protection
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
                >
                  Save Building
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBuilding(null)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <TemplatesTabPanel
          projectId={projectId}
          project={project}
          isReadOnly={isReadOnly}
          onRefresh={loadProject}
        />
      )}

      {/* Service Load Library Tab */}
      {activeTab === 'loads' && (
        <div className="space-y-3">
          <LoadLibraryPanel projectId={projectId} onRefresh={loadProject} loads={project.loadLibraryItems} isReadOnly={isReadOnly} />
        </div>
      )}

      {/* Project Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <ProjectTeamTab projectId={projectId} />
        </div>
      )}

      {/* QA & Compliance Tab */}
      {activeTab === 'qa' && (
        <div className="space-y-4">
          <QAReviewTab projectId={projectId} />
        </div>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <ActivityLogTab projectId={projectId} />
        </div>
      )}

      {/* Project Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <ProjectSettingsTab
            projectId={projectId}
            initialSubtab={
              searchParams?.get('tab') === 'engineering' ||
              searchParams?.get('tab') === 'standards' ||
              searchParams?.get('subtab') === 'engineering' ||
              searchParams?.get('subtab') === 'standards'
                ? 'engineering'
                : searchParams?.get('tab') === 'company' || searchParams?.get('subtab') === 'company'
                ? 'company'
                : 'general'
            }
            onProjectUpdated={loadProject}
          />
        </div>
      )}
    </div>
  );
}

