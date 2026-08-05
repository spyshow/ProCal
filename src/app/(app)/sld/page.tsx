'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import { SchematexDiagram } from 'schematex/react';
import { generateSLDPages, type SLDPage as SLDPageType } from '@/lib/sld/generator';
import {
  GitBranch,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  FileImage,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Search,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Layers,
  BookOpen,
  Sliders,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  FileCode,
  X,
  Play,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Project } from '@/types';

interface TreeItem {
  id: string;
  name: string;
  type: 'feeder' | 'transformer' | 'breaker' | 'panel' | 'bus';
  subLabel?: string;
  status?: 'Active' | 'Tripped' | 'Open';
  children?: TreeItem[];
}

export default function SLDPage() {
  const { selectedProjectId } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [pages, setPages] = useState<SLDPageType[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [activeTab, setActiveTab] = useState<'riser' | 'sld' | 'panels'>('riser');
  const [activeMode, setActiveMode] = useState<'analyze' | 'simulate' | 'library'>('simulate');
  
  // Left Explorer Drawer State
  const [explorerSearch, setExplorerSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    riserA: true,
    transformers: true,
    msb1: true,
    distribution: true,
  });

  // Right Properties Inspector State
  const [selectedComponent, setSelectedComponent] = useState<{
    id: string;
    name: string;
    type: string;
    rating: string;
    status: 'Closed' | 'Open' | 'Tripped';
    voltage: string;
    current: string;
    power: string;
    connections: string[];
  }>({
    id: 'MCCB-04',
    name: 'MCCB-04 Main Incomer',
    type: 'Eaton 400A MCCB',
    rating: '400A',
    status: 'Closed',
    voltage: '415V',
    current: '3.2 A',
    power: '200 kW',
    connections: ['Main Switchboard MSB-1', 'Panel DP-1 (415V)', 'Panel DP-2 (415V)'],
  });

  const [showDsl, setShowDsl] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Apply zoom to the SVG element directly
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (svg) {
      svg.style.transform = `scale(${zoom / 100})`;
      svg.style.transformOrigin = 'top left';
    }
  }, [zoom, pages, activePage]);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (!selectedBuilding && data.buildings.length > 0) {
          setSelectedBuilding(data.buildings[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectedBuilding]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (!project) return;
    const generatedPages = generateSLDPages(project);
    setPages(generatedPages);
    setActivePage(0);
  }, [project]);

  const exportPNG = async () => {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (!svg) return;

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

    fullWidth = Math.max(fullWidth, 1000);
    fullHeight = Math.max(fullHeight, 700);

    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('width', String(fullWidth));
    clonedSvg.setAttribute('height', String(fullHeight));
    clonedSvg.style.transform = 'none';

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = fullWidth * scale;
      canvas.height = fullHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#020617'; // Dark background
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

  // Extend vertical cables and apply neon dark styling
  const extendCables = (svg: SVGSVGElement) => {
    const allLines = svg.querySelectorAll('line');
    const allPaths = svg.querySelectorAll('path');
    const EXTRA = 80;

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

    allLines.forEach((line) => {
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');
      if (x1 === x2 && y1 !== y2) {
        const topY = Math.min(y1, y2);
        const botY = Math.max(y1, y2);
        if (busLines.some((b) => Math.abs(b - topY) < 5) && botY - topY < 100) {
          line.setAttribute('y2', String(botY + EXTRA));
        }
      }
    });

    allPaths.forEach((path) => {
      const d = path.getAttribute('d') || '';
      const match = d.match(/^M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)$/);
      if (match) {
        const [, x1, y1, x2, y2] = match.map(Number);
        if (x1 === x2 && Math.abs(y2 - y1) < 100) {
          const topY = Math.min(y1, y2);
          if (busLines.some((b) => Math.abs(b - topY) < 5)) {
            path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${Math.max(y1, y2) + EXTRA}`);
          }
        }
      }
    });

    const bbox = svg.getBBox();
    svg.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height + EXTRA * 2}`);
    svg.style.height = 'auto';
  };

  const repositionLabels = (svg: SVGSVGElement) => {
    const texts = svg.querySelectorAll('text');
    if (texts.length === 0) return;

    const mcbSymbols: { cx: number; cy: number; topY: number; botY: number; leftX: number; rightX: number }[] = [];
    svg.querySelectorAll('line').forEach((line) => {
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');
      if (x1 !== x2 && y1 !== y2 && Math.abs(y2 - y1) > 5 && Math.abs(x2 - x1) > 5) {
        mcbSymbols.push({
          cx: (x1 + x2) / 2,
          cy: (y1 + y2) / 2,
          topY: Math.min(y1, y2),
          botY: Math.max(y1, y2),
          leftX: Math.min(x1, x2),
          rightX: Math.max(x1, x2),
        });
      }
    });

    if (mcbSymbols.length === 0) return;

    texts.forEach((text) => {
      const bbox = text.getBBox();
      const tx = bbox.x + bbox.width / 2;
      const ty = bbox.y + bbox.height / 2;
      const content = text.textContent?.trim() || '';

      if (
        content.includes('Single Line') ||
        content.includes('MDB Bus') ||
        content.includes('Utility') ||
        content.includes('400V') ||
        content.includes('Sub-Panel') ||
        content === 'DB'
      )
        return;

      let nearestMCB: (typeof mcbSymbols)[0] | null = null;
      let minDist = Infinity;
      for (const mcb of mcbSymbols) {
        const dx = Math.abs(tx - mcb.cx);
        const dy = Math.abs(ty - mcb.cy);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100 && dist < minDist) {
          minDist = dist;
          nearestMCB = mcb;
        }
      }

      if (nearestMCB) {
        text.setAttribute('x', String(nearestMCB.rightX + 14));
        text.setAttribute('text-anchor', 'start');
      }
    });
  };

  useEffect(() => {
    if (!pages[activePage]) return;

    const processSVG = () => {
      if (!svgContainerRef.current) return;
      const svg = svgContainerRef.current.querySelector('svg');
      if (!svg) return;

      const texts = svg.querySelectorAll('text');
      if (texts.length === 0) {
        setTimeout(processSVG, 500);
        return;
      }

      extendCables(svg);
      repositionLabels(svg);
    };

    const timer = setTimeout(processSVG, 200);
    return () => clearTimeout(timer);
  }, [pages, activePage]);

  const toggleNode = (key: string) => {
    setExpandedNodes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-300">
        <Sparkles className="w-6 h-6 animate-spin text-orange-500 mr-2" />
        <p className="text-sm">Loading SLD Workstation Environment…</p>
      </div>
    );

  if (!project)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-300 p-6 text-center">
        <GitBranch className="w-12 h-12 text-slate-600 mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">No Active Project Selected</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Please select or create a project first from the dashboard to launch the Single Line Diagram workstation.
        </p>
      </div>
    );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Workstation Window Bar & Header */}
      <header className="h-14 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left: App Title & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(234,88,12,0.3)]">
            <GitBranch className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">SLD Pro</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                V4.2
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                Project: {project.name}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Mode Toggles */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveMode('analyze')}
            className={`px-3 py-1.2 rounded-lg font-medium transition-all ${
              activeMode === 'analyze'
                ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Analyze
          </button>
          <button
            onClick={() => setActiveMode('simulate')}
            className={`px-3 py-1.2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeMode === 'simulate'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-[0_0_12px_rgba(234,88,12,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3 h-3 text-orange-400 fill-orange-400" />
            Simulate
          </button>
          <button
            onClick={() => setActiveMode('library')}
            className={`px-3 py-1.2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeMode === 'library'
                ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3 h-3 text-slate-400" />
            Library
          </button>
        </div>

        {/* Right: Actions & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom Toolbar */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono text-slate-400 w-10 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Reset Zoom"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="w-px h-5 bg-slate-800" />

          <button
            onClick={exportPNG}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs flex items-center gap-1.5"
            title="Export PNG Diagram"
          >
            <FileImage size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Export PNG</span>
          </button>

          <button
            onClick={exportPDF}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs flex items-center gap-1.5"
            title="Export PDF Document"
          >
            <Download size={14} className="text-sky-400" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
        </div>
      </header>

      {/* Main Workstation 3-Panel Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT PANEL: Project Explorer & Riser Tree */}
        <aside className="w-72 border-r border-slate-800/80 bg-slate-950 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FolderTree size={14} className="text-orange-400" />
              <span>Project Explorer</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-2.5 border-b border-slate-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter nodes or panels…"
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>

          {/* Riser & Switchboard Hierarchy Tree */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs no-scrollbar">
            {/* Tree Section: Riser A */}
            <div>
              <button
                onClick={() => toggleNode('riserA')}
                className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-900 text-slate-300 font-semibold text-left"
              >
                {expandedNodes['riserA'] ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
                <GitBranch className="w-3.5 h-3.5 text-orange-400" />
                <span>Building Riser: Riser A</span>
              </button>

              {expandedNodes['riserA'] && (
                <div className="pl-4 space-y-0.5 mt-0.5 border-l border-slate-800/80 ml-2.5">
                  <button
                    onClick={() =>
                      setSelectedComponent({
                        id: 'INCOMER-11KV',
                        name: '11kV Main Incomer Feeder',
                        type: 'High Voltage Utility Feeder',
                        rating: '11kV',
                        status: 'Closed',
                        voltage: '11,000 V',
                        current: '120 A',
                        power: '2280 kW',
                        connections: ['Transformer T1 (11/0.415kV)', 'Transformer T2 (11/0.415kV)'],
                      })
                    }
                    className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-orange-400" /> 11kV Main Incomer
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </button>

                  <button
                    onClick={() =>
                      setSelectedComponent({
                        id: 'TRANSFORMER-T1',
                        name: 'Transformer T1 (2500kVA)',
                        type: 'Cast Resin Dy11 Transformer',
                        rating: '2500 kVA',
                        status: 'Closed',
                        voltage: '11kV / 415V',
                        current: '3470 A',
                        power: '2125 kW',
                        connections: ['11kV Bus', 'Main Switchboard MSB-1', 'Panel DP-1'],
                      })
                    }
                    className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-amber-400" /> T1 (2500kVA 11kV/415V)
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </button>

                  <button
                    onClick={() =>
                      setSelectedComponent({
                        id: 'MCCB-04',
                        name: 'MCCB-04 Main Incomer',
                        type: 'Eaton 400A MCCB',
                        rating: '400A',
                        status: 'Closed',
                        voltage: '415V',
                        current: '3.2 A',
                        power: '200 kW',
                        connections: ['Main Switchboard MSB-1', 'Panel DP-1', 'Panel DP-2'],
                      })
                    }
                    className="w-full flex items-center justify-between py-1 px-2 rounded bg-orange-500/10 text-orange-300 font-medium border border-orange-500/30 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-orange-400" /> MCCB-04 (400A)
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </button>
                </div>
              )}
            </div>

            {/* Tree Section: Main Switchboard MSB-1 */}
            <div className="pt-1">
              <button
                onClick={() => toggleNode('msb1')}
                className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-900 text-slate-300 font-semibold text-left"
              >
                {expandedNodes['msb1'] ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Main Switchboard: MSB-1</span>
              </button>

              {expandedNodes['msb1'] && (
                <div className="pl-4 space-y-0.5 mt-0.5 border-l border-slate-800/80 ml-2.5">
                  <button
                    onClick={() =>
                      setSelectedComponent({
                        id: 'PANEL-DP1',
                        name: 'Distribution Panel DP-1',
                        type: 'Sub-Distribution Panel (TP&N)',
                        rating: '250A Busbar',
                        status: 'Closed',
                        voltage: '415V / 230V',
                        current: '145 A',
                        power: '95 kW',
                        connections: ['MCCB-04', 'Floor 1 Lighting', 'Floor 1 Power'],
                      })
                    }
                    className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-sky-400" /> Panel DP-1 (415V)
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </button>

                  <button
                    onClick={() =>
                      setSelectedComponent({
                        id: 'PANEL-DP2',
                        name: 'Distribution Panel DP-2',
                        type: 'Sub-Distribution Panel (TP&N)',
                        rating: '250A Busbar',
                        status: 'Closed',
                        voltage: '415V / 230V',
                        current: '160 A',
                        power: '105 kW',
                        connections: ['MCCB-04', 'Floor 2 HVAC', 'Floor 2 Sockets'],
                      })
                    }
                    className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-sky-400" /> Panel DP-2 (415V)
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </button>

                  <button
                    onClick={() =>
                      setSelectedComponent({
                        id: 'PANEL-DP3',
                        name: 'Distribution Panel DP-3',
                        type: 'Sub-Distribution Panel (TP&N)',
                        rating: '160A Busbar',
                        status: 'Closed',
                        voltage: '415V / 230V',
                        current: '110 A',
                        power: '72 kW',
                        connections: ['MCCB-04', 'Floor 3 Power'],
                      })
                    }
                    className="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-sky-400" /> Panel DP-3 (415V)
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* CENTER PANEL: Canvas Workstation Viewport */}
        <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
          {/* Document View Tabs */}
          <div className="h-9 border-b border-slate-800/80 bg-slate-900/80 flex items-center px-2 gap-1 overflow-x-auto shrink-0">
            <button
              onClick={() => setActiveTab('riser')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium border-t border-x transition-colors ${
                activeTab === 'riser'
                  ? 'bg-slate-950 text-white border-slate-700 shadow-sm'
                  : 'bg-slate-900/50 text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-orange-400" />
              <span>Riser Tree Canvas</span>
            </button>
            <button
              onClick={() => setActiveTab('sld')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium border-t border-x transition-colors ${
                activeTab === 'sld'
                  ? 'bg-slate-950 text-white border-slate-700 shadow-sm'
                  : 'bg-slate-900/50 text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Single Line Overview</span>
            </button>
          </div>

          {/* Canvas Area with Dark Grid Background */}
          <div className="flex-1 overflow-auto p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] relative flex items-center justify-center">
            {/* SVG Canvas Container */}
            <div
              ref={svgContainerRef}
              className="relative bg-slate-900/70 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.6)] min-w-[750px] transition-all duration-300"
            >
              {pages[activePage] && <SchematexDiagram dsl={pages[activePage].dsl} />}
            </div>

            {/* Floating Live Simulation Banner */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/10 text-xs text-slate-300 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Live Power Flow Active</span>
              <span className="text-slate-600">|</span>
              <span className="text-orange-400 font-mono">11kV Feeder A</span>
            </div>
          </div>

          {/* DSL Code View Collapsible Drawer */}
          {showDsl && (
            <div className="border-t border-slate-800 bg-slate-950 p-4 max-h-48 overflow-auto font-mono text-[11px] text-slate-300">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-orange-400">Generated Schematex DSL</span>
                <button
                  onClick={() => setShowDsl(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="text-slate-400">{pages[activePage]?.dsl || ''}</pre>
            </div>
          )}
        </main>

        {/* RIGHT PANEL: Properties & Simulation Inspector */}
        <aside className="w-80 border-l border-slate-800/80 bg-slate-950 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Sliders size={14} className="text-orange-400" />
              <span>Properties Inspector</span>
            </div>
            <button
              onClick={() => setShowDsl(!showDsl)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900"
              title="View DSL Code"
            >
              <FileCode size={14} />
            </button>
          </div>

          {/* Component Details Form & Live Control */}
          <div className="p-4 space-y-4 flex-1 overflow-y-auto no-scrollbar text-xs">
            {/* Header Badge & Name */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  {selectedComponent.id}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    selectedComponent.status === 'Closed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedComponent.status === 'Closed' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  {selectedComponent.status === 'Closed' ? 'Active (Closed)' : 'Tripped'}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-white">{selectedComponent.name}</h4>
              <p className="text-xs text-slate-400">{selectedComponent.type}</p>
            </div>

            {/* Properties Inputs & Status Simulation Selector */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Protection Type</label>
                <input
                  type="text"
                  value={selectedComponent.type}
                  onChange={(e) =>
                    setSelectedComponent({ ...selectedComponent, type: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Trip Rating</label>
                  <input
                    type="text"
                    value={selectedComponent.rating}
                    onChange={(e) =>
                      setSelectedComponent({ ...selectedComponent, rating: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Voltage Rating</label>
                  <input
                    type="text"
                    value={selectedComponent.voltage}
                    onChange={(e) =>
                      setSelectedComponent({ ...selectedComponent, voltage: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              {/* Status Simulation Switch */}
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Simulation Status</label>
                <select
                  value={selectedComponent.status}
                  onChange={(e) =>
                    setSelectedComponent({
                      ...selectedComponent,
                      status: e.target.value as 'Closed' | 'Open' | 'Tripped',
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                >
                  <option value="Closed">Closed (Active Power)</option>
                  <option value="Open">Open (Manual Disconnect)</option>
                  <option value="Tripped">Tripped (Fault Alert)</option>
                </select>
              </div>
            </div>

            {/* Live Measurements Card */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Live Load Telemetry
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Current Draw</span>
                  <span className="font-mono font-bold text-orange-400">
                    {selectedComponent.current}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Active Power</span>
                  <span className="font-mono font-bold text-amber-400">
                    {selectedComponent.power}
                  </span>
                </div>
              </div>
            </div>

            {/* Downstream Connections List */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Connected Downstream
              </span>
              {selectedComponent.connections.map((conn, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300"
                >
                  <span className="truncate max-w-[190px]">{conn}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
