'use client';

import { useEffect, useState, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { SchematexDiagram } from 'schematex/react';
import { generateSLD } from '@/lib/sld/generator';
import { recalculateCable } from '@/lib/sld/cable-editor';
import { GitBranch, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { Project } from '@/types';

export default function SLDPage() {
  const { selectedProjectId } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [dsl, setDsl] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [editingCable, setEditingCable] = useState<{
    floorNumber: number;
    itemName: string;
    currentLength: number;
    currentCableSize: number;
    current: number;
    isThreePhase: boolean;
  } | null>(null);
  const [newLength, setNewLength] = useState('');
  const [zoom, setZoom] = useState(100);
  const [recalcResult, setRecalcResult] = useState<{
    cableSize: number;
    breakerSize: number;
    voltageDropPercent: number;
    changed: boolean;
  } | null>(null);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (!selectedBuilding && data.buildings.length > 0) setSelectedBuilding(data.buildings[0].id);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedProjectId, selectedBuilding]);

  useEffect(() => { loadProject(); }, [loadProject]);

  useEffect(() => {
    if (!project) return;
    const generated = generateSLD(project);
    setDsl(generated);
  }, [project]);

  const handleCableRecalculate = () => {
    if (!editingCable || !newLength) return;
    const length = parseFloat(newLength);
    if (isNaN(length) || length <= 0) return;

    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    const result = recalculateCable({
      current: editingCable.current,
      isThreePhase: editingCable.isThreePhase,
      lengthMeters: length,
      existingCableSize: editingCable.currentCableSize,
      powerFactor: project?.powerFactor || 0.85,
      systemVoltage: project?.voltage === 400 ? 400 : 230,
      maxVoltageDropPercent: limits.power,
    });

    setRecalcResult(result);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>;
  if (!project) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm">Select a project first.</p></div>;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch size={22} className="text-orange-500" />
            SLD Designer
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white"><ZoomOut size={14} /></button>
          <span className="text-xs text-gray-500 font-mono w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white"><ZoomIn size={14} /></button>
          <button onClick={() => setZoom(100)} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white"><RotateCcw size={14} /></button>
        </div>
      </div>

      {project.buildings.length > 1 && (
        <div className="flex gap-2">
          {project.buildings.map((b) => (
            <button key={b.id} onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedBuilding === b.id ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl p-6 overflow-auto" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
        {dsl && <SchematexDiagram dsl={dsl} />}
      </div>

      {editingCable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-96 space-y-4 border border-gray-700">
            <h3 className="text-lg font-bold text-white">Edit Cable Length</h3>
            <p className="text-sm text-gray-400">
              {editingCable.itemName} — Floor {editingCable.floorNumber}
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Length (meters)</label>
              <input type="number" value={newLength} onChange={(e) => { setNewLength(e.target.value); setRecalcResult(null); }}
                className="dense-input w-full rounded" placeholder="e.g., 50" />
            </div>
            <div className="text-xs text-gray-500">
              Current: {editingCable.currentCableSize} mm², {editingCable.current.toFixed(1)}A
            </div>

            {recalcResult && (
              <div className={`p-3 rounded-lg text-sm ${recalcResult.changed ? 'bg-yellow-900/30 border border-yellow-600/40' : 'bg-green-900/30 border border-green-600/40'}`}>
                <p className="font-semibold text-white">{recalcResult.changed ? '⚠️ Cable Upsized' : '✅ Within Limits'}</p>
                <p className="text-gray-300">New cable: {recalcResult.cableSize} mm²</p>
                <p className="text-gray-300">VD: {recalcResult.voltageDropPercent.toFixed(2)}%</p>
                <p className="text-gray-300">Breaker: {recalcResult.breakerSize}A</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleCableRecalculate}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold">
                Recalculate
              </button>
              <button onClick={() => { setEditingCable(null); setNewLength(''); setRecalcResult(null); }}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300">View Generated DSL</summary>
        <pre className="mt-2 p-4 bg-gray-900 rounded-lg overflow-auto font-mono text-[10px]">{dsl}</pre>
      </details>
    </div>
  );
}
