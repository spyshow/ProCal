'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Home, Plus, Pencil, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { RoomList } from '@/components/RoomList';
import type { RoomData } from '@/components/RoomInput';
import type { ProjectDetailModel } from './project-detail-types';

export interface TemplatesTabPanelProps {
  projectId: string;
  project: ProjectDetailModel;
  isReadOnly: boolean;
  onRefresh: () => void | Promise<void>;
}

export function TemplatesTabPanel({ projectId, project, isReadOnly, onRefresh }: TemplatesTabPanelProps) {
  const { t } = useTranslation();

  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templatePhases, setTemplatePhases] = useState('1');
  const [templateRooms, setTemplateRooms] = useState<RoomData[]>([]);
  const [isSeedingDefaults, setIsSeedingDefaults] = useState(false);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplatePhases, setEditTemplatePhases] = useState('1');
  const [editTemplateRooms, setEditTemplateRooms] = useState<RoomData[]>([]);

  const handleSeedDefaults = async (type: 'all' | 'templates' | 'loads' = 'templates') => {
    setIsSeedingDefaults(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/seed-defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || (type === 'loads' ? 'Failed to generate default service loads' : 'Failed to generate default templates'));
        return;
      }
      await onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSeedingDefaults(false);
    }
  };

  const handleNewTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName || templateRooms.length === 0) return;

    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateName,
        phases: Number(templatePhases),
        projectId,
        rooms: templateRooms.map(({ id, ...rest }) => rest),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to create template');
      return;
    }
    setTemplateName('');
    setTemplatePhases('1');
    setTemplateRooms([]);
    setShowNewTemplate(false);
    await onRefresh();
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const startEditTemplate = (tpl: any) => {
    setEditingTemplateId(tpl.id);
    setEditTemplateName(tpl.name);
    setEditTemplatePhases(String(tpl.phases || 1));
    setEditTemplateRooms(
      (tpl.rooms || []).map((r: any) => ({
        id: r.id || Math.random().toString(36).substring(2, 9),
        type: r.type,
        name: r.name || '',
        area: r.area != null ? Math.round(Number(r.area) * 2) / 2 : 0,
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
    await onRefresh();
  };

  return (
    <div className="space-y-3">
      {!isReadOnly && (
        <div className="flex justify-end items-center gap-2">
          {project.apartmentTemplates.length === 0 && (
            <button
              type="button"
              disabled={isSeedingDefaults}
              onClick={() => handleSeedDefaults('templates')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium border border-gray-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSeedingDefaults ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              )}
              {t('projects.loadDefaultTemplates', 'Load Default Templates')}
            </button>
          )}
          <button
            onClick={() => setShowNewTemplate(!showNewTemplate)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold cursor-pointer"
          >
            <Plus size={14} />
            New Template
          </button>
        </div>
      )}

      {showNewTemplate && !isReadOnly && (
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
            roomDensities={project.countryDefaults?.roomDensities}
            acRules={project.countryDefaults?.acSizingRules}
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
        <div className="text-center py-12 text-gray-400 text-sm rounded-xl border border-gray-800 bg-gray-900/40 p-6 flex flex-col items-center justify-center gap-3">
          <Home className="w-10 h-10 text-gray-600" />
          <div>
            <p className="font-semibold text-gray-200">No apartment templates yet</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              Create custom apartment layouts or generate standard default templates (2BR, 3BR, Studio) configured with regional electrical sizing rules.
            </p>
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                disabled={isSeedingDefaults}
                onClick={() => handleSeedDefaults('templates')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
              >
                {isSeedingDefaults ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Generate Default Templates
              </button>
              <button
                type="button"
                onClick={() => setShowNewTemplate(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium border border-gray-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Custom Template
              </button>
            </div>
          )}
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
                {editingTemplateId === tpl.id && !isReadOnly ? (
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
                      roomDensities={project.countryDefaults?.roomDensities}
                      acRules={project.countryDefaults?.acSizingRules}
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
                            {(totalLoad / 1000).toFixed(2)} kVA
                          </span>
                        </div>
                      </div>
                      {!isReadOnly && (
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
                      )}
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
  );
}
