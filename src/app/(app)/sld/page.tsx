'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import { SchematexDiagram } from 'schematex/react';
import { generateSLD, generateSLDPages, type SLDPage as SLDPageType } from '@/lib/sld/generator';
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
  const [pages, setPages] = useState<SLDPageType[]>([]);
  const [activePage, setActivePage] = useState(0);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Apply zoom to the SVG element directly, not the container
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (svg) {
      svg.style.transform = `scale(${zoom / 100})`;
      svg.style.transformOrigin = 'top left';
    }
  }, [zoom, pages, activePage]);

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
    const generatedPages = generateSLDPages(project);
    setPages(generatedPages);
    setActivePage(0);

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
        a.download = pages.length > 1
          ? `${project?.name || 'sld'}-page${activePage + 1}.png`
          : `${project?.name || 'sld'}-diagram.png`;
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

  // Extend vertical cables for ladder-step spacing
  const extendCables = (svg: SVGSVGElement) => {
    const allLines = svg.querySelectorAll('line');
    const allPaths = svg.querySelectorAll('path');
    const EXTRA = 80;

    // Find horizontal bus lines
    const busLines: number[] = [];
    allLines.forEach((line) => {
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      if (y1 === y2 && Math.abs(x2 - x1) > 200) {
        busLines.push(y1);
      }
    });

    // Extend short vertical lines
    allLines.forEach((line) => {
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');
      if (x1 === x2 && y1 !== y2) {
        const topY = Math.min(y1, y2);
        const botY = Math.max(y1, y2);
        if (busLines.some(b => Math.abs(b - topY) < 5) && botY - topY < 100) {
          line.setAttribute('y2', String(botY + EXTRA));
        }
      }
    });

    // Extend short vertical paths
    allPaths.forEach((path) => {
      const d = path.getAttribute('d') || '';
      const match = d.match(/^M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)$/);
      if (match) {
        const [, x1, y1, x2, y2] = match.map(Number);
        if (x1 === x2 && Math.abs(y2 - y1) < 100) {
          const topY = Math.min(y1, y2);
          if (busLines.some(b => Math.abs(b - topY) < 5)) {
            path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${Math.max(y1, y2) + EXTRA}`);
          }
        }
      }
    });

    // Resize viewBox
    const bbox = svg.getBBox();
    svg.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height + EXTRA * 2}`);
    svg.style.height = 'auto';
  };

  // Reposition labels to the right side of their nearest cable
  const repositionLabels = (svg: SVGSVGElement) => {
    const texts = svg.querySelectorAll('text');
    if (texts.length === 0) return;

    // Collect all line elements (vertical cables + diagonal MCBs + horizontal bus segments)
    const allLines = svg.querySelectorAll('line');
    const lineElements: { el: SVGLineElement; cx: number; cy: number; isVertical: boolean; isDiagonal: boolean }[] = [];
    allLines.forEach((line) => {
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const isVert = x1 === x2 && Math.abs(y2 - y1) > 10;
      const isDiag = x1 !== x2 && y1 !== y2 && Math.abs(y2 - y1) > 5 && Math.abs(x2 - x1) > 5;
      if (isVert || isDiag) {
        lineElements.push({ el: line, cx, cy, isVertical: isVert, isDiagonal: isDiag });
      }
    });

    // Also collect paths
    svg.querySelectorAll('path').forEach((path) => {
      const d = path.getAttribute('d') || '';
      const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)/);
      if (m) {
        const [, x1, y1, x2, y2] = m.map(Number);
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const isVert = x1 === x2 && Math.abs(y2 - y1) > 10;
        const isDiag = x1 !== x2 && y1 !== y2;
        if (isVert || isDiag) {
          lineElements.push({ el: path as any, cx, cy, isVertical: isVert, isDiagonal: isDiag });
        }
      }
    });

    if (lineElements.length === 0) return;

    texts.forEach((text) => {
      const bbox = text.getBBox();
      const tx = bbox.x + bbox.width / 2;
      const ty = bbox.y + bbox.height / 2;
      const content = text.textContent?.trim() || '';

      // Skip headers and bus labels
      if (content.includes('Single Line') || content.includes('MDB Bus') ||
          content.includes('Utility') || content.includes('400V') ||
          content.includes('Sub-Panel') || content === 'DB') return;

      // Find nearest line element (vertical cable or diagonal MCB)
      let best: typeof lineElements[0] | null = null;
      let bestDist = Infinity;
      for (const le of lineElements) {
        const dx = Math.abs(tx - le.cx);
        const dy = Math.abs(ty - le.cy);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80 && dist < bestDist) {
          bestDist = dist;
          best = le;
        }
      }

      if (best) {
        if (best.isVertical) {
          // Vertical cable: put text to the RIGHT of the cable line
          text.setAttribute('x', String(best.cx + 15));
          text.setAttribute('text-anchor', 'start');
        } else if (best.isDiagonal) {
          // Diagonal MCB: put text to the RIGHT of the MCB center
          text.setAttribute('x', String(best.cx + 20));
          text.setAttribute('text-anchor', 'start');
        }
      }
    });
  };

  // Post-process SVG after render
  useEffect(() => {
    if (!pages[activePage]) return;

    const processSVG = () => {
      if (!svgContainerRef.current) return;
      const svg = svgContainerRef.current.querySelector('svg');
      if (!svg) return;

      const texts = svg.querySelectorAll('text');
      if (texts.length === 0) {
        // SVG not ready yet — retry
        setTimeout(processSVG, 500);
        return;
      }

      extendCables(svg);
      repositionLabels(svg);
    };

    const timer = setTimeout(processSVG, 200);
    return () => clearTimeout(timer);
  }, [pages, activePage]);

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

      {/* Page Navigation */}
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-3 print:hidden">
          <button onClick={() => setActivePage(p => Math.max(0, p - 1))} disabled={activePage === 0}
            className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 text-sm">
            ← Previous
          </button>
          <div className="flex gap-1">
            {pages.map((_, i) => (
              <button key={i} onClick={() => setActivePage(i)}
                className={`w-8 h-8 rounded text-xs font-medium ${i === activePage ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <button onClick={() => setActivePage(p => Math.min(pages.length - 1, p + 1))} disabled={activePage === pages.length - 1}
            className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 text-sm">
            Next →
          </button>
          <span className="text-xs text-gray-500 ml-2">
            {pages[activePage]?.floors}
          </span>
        </div>
      )}

      {/* SLD Diagram */}
      <div ref={svgContainerRef} className="bg-white rounded-xl p-6 overflow-auto">
        {pages[activePage] && <SchematexDiagram dsl={pages[activePage].dsl} />}
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
        <pre className="mt-2 p-4 bg-gray-900 rounded-lg overflow-auto font-mono text-[10px]">{pages[activePage]?.dsl || ''}</pre>
      </details>
    </div>
  );
}
