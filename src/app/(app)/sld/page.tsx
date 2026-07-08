'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import { SchematexDiagram } from 'schematex/react';
import { generateSLD } from '@/lib/sld/generator';
import { recalculateCable } from '@/lib/sld/cable-editor';
import { GitBranch, ZoomIn, ZoomOut, RotateCcw, RefreshCw, Download, FileImage } from 'lucide-react';
import type { Project } from '@/types';

interface CableEntry {
  id: string;
  name: string;
  cableName: string;
  floor: number;
  length: number;
  cableSize: number;
  current: number;
  isThreePhase: boolean;
  newCableSize: number | null;
  newVD: number | null;
  changed: boolean;
}

export default function SLDPage() {
  const { selectedProjectId } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [dsl, setDsl] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [cables, setCables] = useState<CableEntry[]>([]);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Apply zoom to the SVG element directly, not the container
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (svg) {
      svg.style.transform = `scale(${zoom / 100})`;
      svg.style.transformOrigin = 'top left';
    }
  }, [zoom, dsl]);

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

    // Build cable schedule from project data
    const cableList: CableEntry[] = [];
    for (const bldg of project.buildings) {
      for (const fd of bldg.floorDesigns) {
        fd.items.forEach((item, idx) => {
          const letter = String.fromCharCode(97 + idx);
          const loadTag = `F${fd.floorNumber}-${letter.toUpperCase()}`;
          const cableTag = `Wf${fd.floorNumber}${letter}`;
          const cableSizeNum = parseFloat(item.cableSize) || 4;
          cableList.push({
            id: item.id || `${fd.floorNumber}-${item.name}`,
            name: loadTag,
            cableName: cableTag,
            floor: fd.floorNumber,
            length: (item as any).cableLength || 30,
            cableSize: cableSizeNum,
            current: item.calculatedCurrent,
            isThreePhase: item.type !== 'APARTMENT' || (item as any).apartmentTemplate?.phases === 3,
            newCableSize: null,
            newVD: null,
            changed: false,
          });
        });
      }
    }
    setCables(cableList);
  }, [project]);

  const updateCableLength = (id: string, length: number) => {
    setCables(prev => prev.map(c => c.id === id ? { ...c, length, newCableSize: null, newVD: null, changed: false } : c));
  };

  const recalculateAll = () => {
    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    setCables(prev => prev.map(c => {
      const result = recalculateCable({
        current: c.current,
        isThreePhase: c.isThreePhase,
        lengthMeters: c.length,
        existingCableSize: c.cableSize,
        powerFactor: project?.powerFactor || 0.85,
        systemVoltage: project?.voltage === 400 ? 400 : 230,
        maxVoltageDropPercent: limits.power,
      });
      return {
        ...c,
        newCableSize: result.cableSize,
        newVD: result.voltageDropPercent,
        changed: result.changed,
      };
    }));
  };

  const exportPNG = async () => {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (!svg) return;

    // Get full SVG dimensions from viewBox or getBBox
    const viewBox = svg.getAttribute('viewBox');
    let fullWidth: number;
    let fullHeight: number;

    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      fullWidth = parts[2] || svg.clientWidth;
      fullHeight = parts[3] || svg.clientHeight;
    } else {
      const bbox = svg.getBBox();
      fullWidth = bbox.width || svg.clientWidth;
      fullHeight = bbox.height || svg.clientHeight;
    }

    // Ensure minimum dimensions
    fullWidth = Math.max(fullWidth, 800);
    fullHeight = Math.max(fullHeight, 600);

    // Clone SVG and set explicit dimensions
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('width', String(fullWidth));
    clonedSvg.setAttribute('height', String(fullHeight));
    clonedSvg.style.transform = 'none';

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const scale = 2; // 2x for retina
      const canvas = document.createElement('canvas');
      canvas.width = fullWidth * scale;
      canvas.height = fullHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, fullWidth, fullHeight);
      ctx.drawImage(img, 0, 0, fullWidth, fullHeight);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${project?.name || 'sld'}-diagram.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');

      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const exportPDF = () => {
    window.print();
  };

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>;
  if (!project) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm">Select a project first.</p></div>;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch size={22} className="text-orange-500" />
            SLD Designer
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportPNG} title="Export as PNG"
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-green-400"><FileImage size={14} /></button>
          <button onClick={exportPDF} title="Export as PDF"
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-blue-400"><Download size={14} /></button>
          <div className="w-px h-5 bg-gray-700" />
          <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white"><ZoomOut size={14} /></button>
          <span className="text-xs text-gray-500 font-mono w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white"><ZoomIn size={14} /></button>
          <button onClick={() => setZoom(100)} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white"><RotateCcw size={14} /></button>
        </div>
      </div>

      {/* Building Selector */}
      {project.buildings.length > 1 && (
        <div className="flex gap-2 print:hidden">
          {project.buildings.map((b) => (
            <button key={b.id} onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedBuilding === b.id ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* SLD Diagram */}
      <div ref={svgContainerRef} className="bg-white rounded-xl p-6 overflow-auto">
        {dsl && <SchematexDiagram dsl={dsl} />}
      </div>

      {/* Cable Schedule */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-300">Cable Schedule — Edit Lengths &amp; Recalculate</h2>
          <button onClick={recalculateAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">
            <RefreshCw size={12} />
            Recalculate All
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full engineering-table text-xs">
            <thead>
              <tr>
                <th className="text-left">Load</th>
                <th className="text-left">Cable</th>
                <th className="text-center">Floor</th>
                <th className="text-right">Current (A)</th>
                <th className="text-center">Size (mm²)</th>
                <th className="text-right" style={{ width: '100px' }}>Length (m)</th>
                <th className="text-center">New Cable</th>
                <th className="text-center">VD (%)</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {cables.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/30">
                  <td className="text-gray-200 font-mono font-semibold">{c.name}</td>
                  <td className="text-gray-400 font-mono text-xs">{c.cableName}</td>
                  <td className="text-center font-mono text-orange-400">F{c.floor}</td>
                  <td className="text-right font-mono">{c.current.toFixed(1)}</td>
                  <td className="text-center font-mono text-green-400">{c.cableSize} mm²</td>
                  <td className="text-right">
                    <input
                      type="number"
                      value={c.length}
                      onChange={(e) => updateCableLength(c.id, parseFloat(e.target.value) || 30)}
                      className="dense-input w-20 rounded text-right text-xs"
                      min="1"
                    />
                  </td>
                  <td className={`text-center font-mono ${c.changed ? 'text-yellow-400 font-bold' : 'text-gray-500'}`}>
                    {c.newCableSize !== null ? `${c.newCableSize} mm²` : '—'}
                  </td>
                  <td className={`text-center font-mono ${c.newVD !== null && c.newVD > 5 ? 'text-red-400' : c.newVD !== null && c.newVD > 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {c.newVD !== null ? `${c.newVD.toFixed(2)}%` : '—'}
                  </td>
                  <td className="text-center">
                    {c.changed ? (
                      <span className="text-yellow-400 font-semibold">⚠ UP</span>
                    ) : c.newVD !== null ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-gray-600">
          Edit cable lengths (meters) and click "Recalculate All" to check voltage drop compliance.
          IEC 60364-5-52 limits: 3% lighting, 5% power. ⚠ UP = cable upsized to meet VD limit.
        </p>
      </div>

      {/* DSL Source */}
      <details className="text-xs text-gray-500 print:hidden">
        <summary className="cursor-pointer hover:text-gray-300">View Generated DSL</summary>
        <pre className="mt-2 p-4 bg-gray-900 rounded-lg overflow-auto font-mono text-[10px]">{dsl}</pre>
      </details>
    </div>
  );
}
