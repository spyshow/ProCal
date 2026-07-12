'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
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
} from 'lucide-react';
import { RoomList } from '@/components/RoomList';
import type { RoomData } from '@/components/RoomInput';

interface FloorDesign {
  id: string;
  floorNumber: number;
  hasFloorSubPanels: boolean;
  items: any[];
}

interface Building {
  id: string;
  name: string;
  floors: number;
  serviceFloors: number;
  apartmentsPerFloor: number;
  elevators: number;
  waterPumps: number;
  firePump: boolean;
  splitAc: number;
  centralAc: number;
  supplyVoltage: string;
  earthingSystem: string;
  lightningProtection: boolean;
  generator: number | null;
  transformer: number | null;
  mechanicalLoads: string | null;
  floorDesigns: FloorDesign[];
}

interface Project {
  id: string;
  name: string;
  client: string;
  consultant: string;
  contractor: string;
  location: string;
  engineer: string;
  voltage: number;
  frequency: number;
  powerFactor: number;
  maxDemandFactor: number;
  preferredManufacturer: string;
  country: string;
  logoUrl: string | null;
  buildings: Building[];
  apartmentTemplates: any[];
  loadLibraryItems: any[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { selectProject, refreshProject } = useProject();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'buildings' | 'templates' | 'loads'>('buildings');
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
    elevators: 2,
    waterPumps: 2,
    firePump: false,
    splitAc: 0,
    centralAc: 0,
    supplyVoltage: '400V 3-Phase',
    earthingSystem: 'TN-S',
    lightningProtection: false,
    generator: '',
    transformer: '',
    mechanicalLoads: '',
  });

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        selectProject(projectId);
      } else {
        router.push('/projects');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectProject, router]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleSaveProject = async () => {
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectForm),
    });
    setEditingProject(false);
    loadProject();
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
      elevators: b.elevators,
      waterPumps: b.waterPumps,
      firePump: b.firePump,
      splitAc: b.splitAc,
      centralAc: b.centralAc,
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

    const res = await fetch(`/api/buildings/${editingBuilding.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildingForm),
    });

    if (!res.ok) {
      alert('Failed to update building');
      return;
    }

    setEditingBuilding(null);
    loadProject();
    refreshProject();
  };

  const handleNewBuilding = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    data.projectId = projectId;

    await fetch('/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setShowNewBuilding(false);
    loadProject();
    refreshProject();
  };

  // Template CRUD
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templatePhases, setTemplatePhases] = useState('1');
  const [templateRooms, setTemplateRooms] = useState<RoomData[]>([]);

  const handleNewTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName || templateRooms.length === 0) return;

    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateName,
        phases: Number(templatePhases),
        projectId,
        rooms: templateRooms.map(({ id, ...rest }) => rest),
      }),
    });
    setTemplateName('');
    setTemplatePhases('1');
    setTemplateRooms([]);
    setShowNewTemplate(false);
    loadProject();
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    loadProject();
  };

  // Template Edit
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplatePhases, setEditTemplatePhases] = useState('1');
  const [editTemplateRooms, setEditTemplateRooms] = useState<RoomData[]>([]);

  const startEditTemplate = (tpl: any) => {
    setEditingTemplateId(tpl.id);
    setEditTemplateName(tpl.name);
    setEditTemplatePhases(String(tpl.phases || 1));
    setEditTemplateRooms(
      (tpl.rooms || []).map((r: any) => ({
        id: r.id || Math.random().toString(36).substring(2, 9),
        type: r.type,
        name: r.name || '',
        area: r.area || 0,
        hasAc: r.hasAc || false,
        loadDensity: r.loadDensity || 70,
        connectedLoad: r.connectedLoad || 0,
      }))
    );
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplateId || !editTemplateName || editTemplateRooms.length === 0) return;

    const res = await fetch(`/api/templates/${editingTemplateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editTemplateName,
        phases: Number(editTemplatePhases),
        rooms: editTemplateRooms.map(({ id, ...rest }) => rest),
      }),
    });
    if (!res.ok) {
      alert('Failed to update template');
      return;
    }
    setEditingTemplateId(null);
    loadProject();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">Loading project…</div>
      </div>
    );
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
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
          onClick={startEditProject}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
        >
          <Settings size={14} />
          Settings
        </button>
      </div>

      {/* Project Settings Modal */}
      {editingProject && (
        <div className="rounded-xl border border-orange-500/30 bg-gray-900/80 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-orange-400">Project Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['name', 'Project Name'],
              ['client', 'Client'],
              ['consultant', 'Consultant'],
              ['contractor', 'Contractor'],
              ['location', 'Location'],
              ['engineer', 'Engineer'],
              ['voltage', 'Voltage (V)'],
              ['frequency', 'Frequency (Hz)'],
              ['powerFactor', 'Power Factor'],
              ['maxDemandFactor', 'Max Demand Factor'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  value={projectForm[key] || ''}
                  onChange={(e) => setProjectForm({ ...projectForm, [key]: e.target.value })}
                  className="dense-input w-full rounded"
                />
              </div>
            ))}
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Project Logo</label>
            <div className="flex items-center gap-4">
              {projectForm.logoUrl ? (
                <div className="relative">
                  <img
                    src={projectForm.logoUrl}
                    alt="Project logo"
                    className="h-20 w-auto object-contain rounded border border-gray-700 bg-white p-1"
                  />
                  <button
                    type="button"
                    onClick={handleClearProjectLogo}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-500"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-32 h-20 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-orange-500 transition-colors">
                  <span className="text-xs text-gray-500">
                    {projectLogoUploading ? 'Uploading…' : 'Click to upload'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProjectLogoUpload}
                  />
                </label>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-1">PNG, JPG, SVG, or WebP. Max 2MB.</p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSaveProject} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold">
              Save
            </button>
            <button onClick={() => setEditingProject(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {[
          { key: 'buildings' as const, label: 'Buildings', icon: Building2 },
          { key: 'templates' as const, label: 'Apartment Templates', icon: Home },
          { key: 'loads' as const, label: 'Load Library', icon: Zap },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-orange-500 text-orange-400'
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
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewBuilding(!showNewBuilding)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
            >
              <Plus size={14} />
              Add Building
            </button>
          </div>

          {showNewBuilding && (
            <form onSubmit={handleNewBuilding} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-300">New Building</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input name="name" required className="dense-input w-full rounded" placeholder="Tower A" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Floors *</label>
                  <input name="floors" type="number" required defaultValue="10" className="dense-input w-full rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Service Floors</label>
                  <input name="serviceFloors" type="number" defaultValue="0" className="dense-input w-full rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Apartments/Floor</label>
                  <input name="apartmentsPerFloor" type="number" defaultValue="4" className="dense-input w-full rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Elevators</label>
                  <input name="elevators" type="number" defaultValue="2" className="dense-input w-full rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Water Pumps</label>
                  <input name="waterPumps" type="number" defaultValue="2" className="dense-input w-full rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Split AC Units</label>
                  <input name="splitAc" type="number" defaultValue="0" className="dense-input w-full rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Central AC (kW)</label>
                  <input name="centralAc" type="number" step="0.1" defaultValue="0" className="dense-input w-full rounded" />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input name="firePump" type="checkbox" className="accent-orange-500" />
                    Fire Pump
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input name="lightningProtection" type="checkbox" className="accent-orange-500" />
                    Lightning
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold">
                  Create Building
                </button>
                <button type="button" onClick={() => setShowNewBuilding(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {project.buildings.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm rounded-xl border border-gray-800 bg-gray-900/40">
              No buildings added yet
            </div>
          ) : (
            project.buildings.map((bldg) => {
              const expanded = expandedBuilding === bldg.id;
              const totalApts = bldg.floors * bldg.apartmentsPerFloor;
              return (
                <div key={bldg.id} className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
                    onClick={() => setExpandedBuilding(expanded ? null : bldg.id)}
                  >
                    {expanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                    <Building2 size={18} className="text-orange-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-200">{bldg.name}</p>
                      <p className="text-xs text-gray-500">
                        {bldg.floors} floors · {bldg.serviceFloors} service · {totalApts} apartments · {bldg.elevators} elevators · {bldg.waterPumps} pumps
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditBuilding(bldg); }}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-orange-400 hover:bg-orange-500/10"
                        title="Edit building"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(bldg.id); }}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                        title="Delete building"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-gray-800 p-4 space-y-3 bg-gray-900/20">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Floor Designs</h4>
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
                                  {fd.items.reduce((s: number, i: any) => s + (i.calculatedMaxDemand || 0), 0).toFixed(1)} kW
                                </span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const newValue = !fd.hasFloorSubPanels;
                                    await fetch(`/api/floors/${fd.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ hasFloorSubPanels: newValue }),
                                    });
                                    loadProject();
                                  }}
                                  className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                                    fd.hasFloorSubPanels
                                      ? 'bg-orange-600/20 text-orange-400 border border-orange-600/40'
                                      : 'bg-gray-800 text-gray-500 border border-gray-700 hover:border-gray-600'
                                  }`}
                                  title={fd.hasFloorSubPanels ? 'Sub-panel enabled — click to disable' : 'Click to enable sub-panel'}
                                >
                                  <span className={`w-3 h-3 rounded-sm border flex items-center justify-center ${
                                    fd.hasFloorSubPanels
                                      ? 'bg-orange-600 border-orange-500'
                                      : 'border-gray-600'
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
                  <label className="block text-xs text-gray-400 mb-1">Elevators</label>
                  <input
                    type="number"
                    value={buildingForm.elevators}
                    onChange={(e) => setBuildingForm({ ...buildingForm, elevators: Number(e.target.value) })}
                    className="dense-input w-full rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Water Pumps</label>
                  <input
                    type="number"
                    value={buildingForm.waterPumps}
                    onChange={(e) => setBuildingForm({ ...buildingForm, waterPumps: Number(e.target.value) })}
                    className="dense-input w-full rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Split AC Units</label>
                  <input
                    type="number"
                    value={buildingForm.splitAc}
                    onChange={(e) => setBuildingForm({ ...buildingForm, splitAc: Number(e.target.value) })}
                    className="dense-input w-full rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Central AC (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={buildingForm.centralAc}
                    onChange={(e) => setBuildingForm({ ...buildingForm, centralAc: Number(e.target.value) })}
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
                    checked={buildingForm.firePump}
                    onChange={(e) => setBuildingForm({ ...buildingForm, firePump: e.target.checked })}
                    className="accent-orange-500"
                  />
                  Fire Pump
                </label>
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
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewTemplate(!showNewTemplate)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
            >
              <Plus size={14} />
              New Template
            </button>
          </div>

          {showNewTemplate && (
            <form onSubmit={handleNewTemplate} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-300">New Apartment Template</h4>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Template Name *</label>
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                    className="dense-input w-full rounded"
                    placeholder="e.g., Type A – 2BR"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-400 mb-1">Phase</label>
                  <select
                    value={templatePhases}
                    onChange={(e) => setTemplatePhases(e.target.value)}
                    className="dense-input w-full rounded"
                  >
                    <option value="1">1Φ Single</option>
                    <option value="3">3Φ Three</option>
                  </select>
                </div>
              </div>

              <RoomList
                rooms={templateRooms}
                onChange={setTemplateRooms}
                country={project.country}
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!templateName || templateRooms.length === 0}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Create Template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTemplate(false);
                    setTemplateName('');
                    setTemplatePhases('1');
                    setTemplateRooms([]);
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {project.apartmentTemplates.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm rounded-xl border border-gray-800 bg-gray-900/40">
              No templates yet
            </div>
          ) : (
            <div className="space-y-3">
              {project.apartmentTemplates.map((tpl: any) => {
                const totalArea = tpl.rooms?.reduce((sum: number, r: any) => sum + r.area, 0) || 0;
                const totalLoad = tpl.rooms?.reduce((sum: number, r: any) => sum + r.connectedLoad, 0) || 0;
                const roomCounts = tpl.rooms?.reduce((acc: Record<string, number>, r: any) => {
                  acc[r.type] = (acc[r.type] || 0) + 1;
                  return acc;
                }, {}) || {};

                return (
                  <div key={tpl.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                    {editingTemplateId === tpl.id ? (
                      <form onSubmit={handleUpdateTemplate} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-300">Edit Template</h4>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">Template Name *</label>
                            <input
                              value={editTemplateName}
                              onChange={(e) => setEditTemplateName(e.target.value)}
                              required
                              className="dense-input w-full rounded"
                              placeholder="e.g., Type A – 2BR"
                            />
                          </div>
                          <div className="w-32">
                            <label className="block text-xs text-gray-400 mb-1">Phase</label>
                            <select
                              value={editTemplatePhases}
                              onChange={(e) => setEditTemplatePhases(e.target.value)}
                              className="dense-input w-full rounded"
                            >
                              <option value="1">1Φ Single</option>
                              <option value="3">3Φ Three</option>
                            </select>
                          </div>
                        </div>
                        <RoomList
                          rooms={editTemplateRooms}
                          onChange={setEditTemplateRooms}
                          country={project.country}
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={!editTemplateName || editTemplateRooms.length === 0}
                            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTemplateId(null)}
                            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-200">{tpl.name}</h4>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs text-gray-500">
                                {tpl.rooms?.length || 0} rooms · {totalArea.toFixed(1)} m²
                              </span>
                              <span className="text-xs text-orange-400 font-mono">
                                {(totalLoad / 1000).toFixed(2)} kW
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditTemplate(tpl)}
                              className="p-1.5 rounded text-gray-600 hover:text-orange-400 hover:bg-orange-500/10"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {tpl.rooms && tpl.rooms.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-800">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(roomCounts).map(([type, count]) => (
                                <span
                                  key={type}
                                  className="px-2 py-1 rounded bg-gray-800 text-[10px] text-gray-400"
                                >
                                  {count as number}× {type.replace('_', ' ').toLowerCase()}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 text-[10px] text-gray-600">
                              {tpl.rooms.map((r: any) => r.name).filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Load Library Tab */}
      {activeTab === 'loads' && (
        <div className="space-y-3">
          <LoadLibrary projectId={projectId} onRefresh={loadProject} loads={project.loadLibraryItems} />
        </div>
      )}
    </div>
  );
}

function LoadLibrary({ projectId, onRefresh, loads }: { projectId: string; onRefresh: () => void; loads: any[] }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Lighting',
    power: '',
    voltage: '230',
    phase: '1',
    powerFactor: '0.85',
    demandFactor: '1.0',
    quantity: '1',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/loads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, projectId }),
    });
    setForm({ name: '', category: 'Lighting', power: '', voltage: '230', phase: '1', powerFactor: '0.85', demandFactor: '1.0', quantity: '1', notes: '' });
    setShowNew(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this load item?')) return;
    await fetch(`/api/loads/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Lighting',
    power: '',
    voltage: '230',
    phase: '1',
    powerFactor: '0.85',
    demandFactor: '1.0',
    quantity: '1',
    notes: '',
  });

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      power: String(item.power),
      voltage: String(item.voltage),
      phase: String(item.phase),
      powerFactor: String(item.powerFactor),
      demandFactor: String(item.demandFactor),
      quantity: String(item.quantity),
      notes: item.notes || '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const res = await fetch(`/api/loads/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      alert('Failed to update load item');
      return;
    }
    setEditingId(null);
    onRefresh();
  };

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold">
          <Plus size={14} />
          Add Load
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-300">New Load Item</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="dense-input w-full rounded">
                {['Lighting', 'Socket', 'AC', 'Pump', 'Elevator', 'Motor', 'Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Power (kW) *</label>
              <input type="number" step="0.01" value={form.power} onChange={(e) => setForm({ ...form, power: e.target.value })} required className="dense-input w-full rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phase</label>
              <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} className="dense-input w-full rounded">
                <option value="1">1-Phase</option>
                <option value="3">3-Phase</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Quantity</label>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="dense-input w-full rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold">Add</button>
            <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loads.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm rounded-xl border border-gray-800 bg-gray-900/40">No load items yet</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full engineering-table">
            <thead className="bg-gray-900">
              <tr>
                <th className="text-left">Name</th>
                <th className="text-center">Category</th>
                <th className="text-right">Power (kW)</th>
                <th className="text-center">Phase</th>
                <th className="text-right">PF</th>
                <th className="text-right">DF</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Running I (A)</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((item: any) => (
                editingId === item.id ? (
                  <tr key={item.id} className="bg-gray-800/50">
                    <td colSpan={9} className="p-3">
                      <form onSubmit={handleUpdate} className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Name *</label>
                            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required className="dense-input w-full rounded text-xs" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Category</label>
                            <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="dense-input w-full rounded text-xs">
                              {['Lighting', 'Socket', 'AC', 'Pump', 'Elevator', 'Motor', 'Other'].map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Power (kW) *</label>
                            <input type="number" step="0.01" value={editForm.power} onChange={(e) => setEditForm({ ...editForm, power: e.target.value })} required className="dense-input w-full rounded text-xs" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Phase</label>
                            <select value={editForm.phase} onChange={(e) => setEditForm({ ...editForm, phase: e.target.value })} className="dense-input w-full rounded text-xs">
                              <option value="1">1-Phase</option>
                              <option value="3">3-Phase</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Quantity</label>
                            <input type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="dense-input w-full rounded text-xs" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold">Save</button>
                          <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs">Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="hover:bg-gray-800/30">
                    <td className="font-medium text-gray-200">{item.name}</td>
                    <td className="text-center text-xs text-gray-400">{item.category}</td>
                    <td className="text-right font-mono">{item.power}</td>
                    <td className="text-center font-mono">{item.phase}Φ</td>
                    <td className="text-right font-mono">{item.powerFactor}</td>
                    <td className="text-right font-mono">{item.demandFactor}</td>
                    <td className="text-right font-mono">{item.quantity}</td>
                    <td className="text-right font-mono text-orange-400">{item.runningCurrent}A</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => startEdit(item)} className="p-1 rounded text-gray-600 hover:text-orange-400">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 rounded text-gray-600 hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
