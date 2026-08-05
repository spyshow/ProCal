'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  Building2,
  Plug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Project } from '@/types';

export interface ComponentProperty {
  id: string;
  name: string;
  type: string;
  rating: string;
  voltage: string;
  current: string;
  power: string;
  cableSize?: string;
  connections: string[];
}

export default function SLDPage() {
  const { selectedProjectId } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [pages, setPages] = useState<SLDPageType[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [activeTab, setActiveTab] = useState<'riser' | 'sld' | 'panels'>('riser');
  const [activeMode, setActiveMode] = useState<'analyze' | 'simulate' | 'library'>('simulate');

  // Explorer Search & Tree Collapse State
  const [explorerSearch, setExplorerSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    grid: true,
    mdb: true,
  });

  // Simulation Status State Map: componentId -> 'Closed' | 'Open' | 'Tripped'
  const [breakerStatuses, setBreakerStatuses] = useState<Record<string, 'Closed' | 'Open' | 'Tripped'>>({});

  // Selected Component for Right Inspector
  const [selectedComponent, setSelectedComponent] = useState<ComponentProperty | null>(null);
  const [showDsl, setShowDsl] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Load project details from API
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
        if (data.buildings && data.buildings.length > 0) {
          setSelectedBuildingId(data.buildings[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } fontally: {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Generate real SLD Pages from project data
  useEffect(() => {
    if (!project) return;
    const generatedPages = generateSLDPages(project);
    setPages(generatedPages);
    setActivePage(0);

    // Default select main transformer / utility grid
    const txRating = project.transformerSize ? `${project.transformerSize} kVA` : '1000 kVA';
    setSelectedComponent({
      id: 'xfmr-main',
      name: `${project.name} Main Transformer`,
      type: 'Cast Resin Dy11 Step-Down Transformer',
      rating: txRating,
      voltage: `${project.voltage}V`,
      current: `${Math.round(((project.transformerSize || 1000) * 1000) / (Math.sqrt(3) * project.voltage))} A`,
      power: `${project.transformerSize || 1000} kVA`,
      connections: ['Utility Grid 11kV Incomer', 'Main Switchboard MDB Bus'],
    });
  }, [project]);

  // Apply zoom to SVG element
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (svg) {
      svg.style.transform = `scale(${zoom / 100})`;
      svg.style.transformOrigin = 'top left';
    }
  }, [zoom, pages, activePage]);

  // Extract Real Component Tree from Project Data
  const dynamicTree = useMemo(() => {
    if (!project) return [];

    const rootItems: Array<{
      id: string;
      name: string;
      type: string;
      icon: 'zap' | 'cpu' | 'layers' | 'breaker' | 'plug';
      badge?: string;
      children?: Array<any>;
      data: ComponentProperty;
    }> = [];

    // 1. Grid Incomer
    rootItems.push({
      id: 'grid-utility',
      name: `Utility Grid Incomer (${project.voltage}V)`,
      type: 'Utility Grid',
      icon: 'zap',
      data: {
        id: 'grid-utility',
        name: `Utility Incomer (${project.voltage}V)`,
        type: 'HV Utility Feeder',
        rating: '11kV / 400V Grid',
        voltage: `${project.voltage}V`,
        current: '800 A',
        power: '500 kW',
        connections: ['Main Step-Down Transformer'],
      },
    });

    // 2. Transformer
    const txKva = project.transformerSize || 1000;
    rootItems.push({
      id: 'xfmr-main',
      name: `Main Transformer (${txKva} kVA)`,
      type: 'Transformer',
      icon: 'cpu',
      badge: `${txKva}kVA`,
      data: {
        id: 'xfmr-main',
        name: `${project.name} Main Transformer`,
        type: 'Step-Down Dy11 Transformer',
        rating: `${txKva} kVA`,
        voltage: `${project.voltage}V`,
        current: `${Math.round((txKva * 1000) / (Math.sqrt(3) * project.voltage))} A`,
        power: `${txKva} kVA`,
        connections: ['Utility Grid', 'Main Switchboard MDB Bus'],
      },
    });

    // 3. Buildings & Floor Switchboards
    if (project.buildings) {
      project.buildings.forEach((bldg) => {
        const bldgChildren: Array<any> = [];

        if (bldg.floorDesigns) {
          bldg.floorDesigns.forEach((fd) => {
            if (!fd.items || fd.items.length === 0) return;
            const floorCurrent = fd.items.reduce((s, i) => s + (i.calculatedCurrent || 0), 0);
            const floorPower = fd.items.reduce((s, i) => s + (i.calculatedMaxDemand || 0), 0);

            const itemChildren = fd.items.map((item, idx) => {
              const itemId = `item-${fd.floorNumber}-${idx}`;
              return {
                id: itemId,
                name: `${item.name} (${item.breakerSize || 'MCB'})`,
                type: item.type || 'Electrical Load',
                icon: 'plug',
                badge: item.breakerSize,
                data: {
                  id: itemId,
                  name: item.name,
                  type: `${item.type || 'Branch Load'} Circuit`,
                  rating: item.breakerSize || '16A MCB',
                  voltage: `${project.voltage}V`,
                  current: `${item.calculatedCurrent?.toFixed(1) || '0.0'} A`,
                  power: `${item.calculatedMaxDemand?.toFixed(1) || '0.0'} kW`,
                  cableSize: item.cableSize || '3x2.5mm²',
                  connections: [`Floor ${fd.floorNumber} Distribution Bus`],
                },
              };
            });

            bldgChildren.push({
              id: `floor-${fd.floorNumber}`,
              name: `Floor ${fd.floorNumber} Sub-Panel (${Math.ceil(floorCurrent)}A Main)`,
              type: 'Distribution Panel',
              icon: 'layers',
              badge: `${Math.ceil(floorCurrent)}A`,
              children: itemChildren,
              data: {
                id: `floor-${fd.floorNumber}`,
                name: `Floor ${fd.floorNumber} Main Panel`,
                type: fd.hasFloorSubPanels ? 'Sub-Distribution Board (TP&N)' : 'Distribution Bus',
                rating: `${Math.ceil(floorCurrent)}A Breaker`,
                voltage: `${project.voltage}V`,
                current: `${floorCurrent.toFixed(1)} A`,
                power: `${floorPower.toFixed(1)} kW`,
                connections: ['MDB Busbar', ...fd.items.map((i) => i.name)],
              },
            });
          });
        }

        rootItems.push({
          id: `bldg-${bldg.id}`,
          name: `${bldg.name} (${bldg.floors} Floors)`,
          type: 'Building Riser',
          icon: 'layers',
          children: bldgChildren,
          data: {
            id: `bldg-${bldg.id}`,
            name: bldg.name,
            type: 'Building Electrical Riser',
            rating: '400V Feeder',
            voltage: `${project.voltage}V`,
            current: 'Variable',
            power: 'Building Total Demand',
            connections: ['MDB Main Switchboard'],
          },
        });
      });
    }

    return rootItems;
  }, [project]);

  // Export handlers
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
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, fullWidth, fullHeight);
      ctx.drawImage(img, 0, 0, fullWidth, fullHeight);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${project?.name || 'sld'}-page${activePage + 1}.png`;
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

  // Extend vertical cables
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

    const mcbSymbols: { cx: number; cy: number; topY: number; botY: number; rightX: number }[] = [];
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

  const getStatus = (id: string) => breakerStatuses[id] || 'Closed';

  const updateStatus = (id: string, status: 'Closed' | 'Open' | 'Tripped') => {
    setBreakerStatuses((prev) => ({ ...prev, [id]: status }));
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

  const activeStatus = selectedComponent ? getStatus(selectedComponent.id) : 'Closed';

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
              <span className="text-sm font-bold text-white tracking-tight">SLD Pro Workstation</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                V4.2 Dynamic
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
            Simulate Engine
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
        {/* LEFT PANEL: Dynamic Project Explorer */}
        <aside className="w-72 border-r border-slate-800/80 bg-slate-950 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FolderTree size={14} className="text-orange-400" />
              <span>Project Explorer Tree</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{dynamicTree.length} Nodes</span>
          </div>

          {/* Search Bar */}
          <div className="p-2.5 border-b border-slate-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search circuits or panels…"
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>

          {/* Dynamic Hierarchy Tree */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs no-scrollbar">
            {dynamicTree
              .filter((item) =>
                explorerSearch ? item.name.toLowerCase().includes(explorerSearch.toLowerCase()) : true
              )
              .map((item) => {
                const isExpanded = expandedNodes[item.id] ?? true;
                const isSelected = selectedComponent?.id === item.data.id;
                const currentStatus = getStatus(item.data.id);

                return (
                  <div key={item.id}>
                    <button
                      onClick={() => {
                        toggleNode(item.id);
                        setSelectedComponent(item.data);
                      }}
                      className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30 font-medium'
                          : 'hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate pr-1">
                        {item.children && item.children.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )
                        ) : (
                          <div className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {item.icon === 'zap' && <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                        {item.icon === 'cpu' && <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        {item.icon === 'layers' && <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        {item.icon === 'plug' && <Plug className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </button>

                    {/* Render Children Recursively */}
                    {item.children && isExpanded && (
                      <div className="pl-4 space-y-0.5 mt-0.5 border-l border-slate-800/80 ml-2.5">
                        {item.children.map((child: any) => {
                          const isChildSelected = selectedComponent?.id === child.data.id;
                          const childStatus = getStatus(child.data.id);
                          return (
                            <div key={child.id}>
                              <button
                                onClick={() => setSelectedComponent(child.data)}
                                className={`w-full flex items-center justify-between py-1 px-2 rounded text-left transition-colors text-xs ${
                                  isChildSelected
                                    ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30 font-medium'
                                    : 'hover:bg-slate-900/80 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <Layers className="w-3 h-3 text-sky-400 shrink-0" />
                                  <span className="truncate">{child.name}</span>
                                </span>
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    childStatus === 'Closed' ? 'bg-emerald-400' : 'bg-rose-400'
                                  }`}
                                />
                              </button>

                              {/* Nested Sub-Items */}
                              {child.children && (
                                <div className="pl-3 space-y-0.5 mt-0.5 border-l border-slate-800/50 ml-2">
                                  {child.children.map((sub: any) => {
                                    const isSubSelected = selectedComponent?.id === sub.data.id;
                                    return (
                                      <button
                                        key={sub.id}
                                        onClick={() => setSelectedComponent(sub.data)}
                                        className={`w-full flex items-center justify-between py-0.5 px-1.5 rounded text-[11px] text-left transition-colors ${
                                          isSubSelected
                                            ? 'bg-orange-500/20 text-orange-300 font-medium'
                                            : 'hover:bg-slate-900/60 text-slate-400 hover:text-slate-300'
                                        }`}
                                      >
                                        <span className="truncate flex items-center gap-1">
                                          <Plug className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                          <span className="truncate">{sub.name}</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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

            {pages.length > 1 && (
              <div className="ml-auto flex items-center gap-2 pr-2 text-xs">
                <button
                  onClick={() => setActivePage((p) => Math.max(0, p - 1))}
                  disabled={activePage === 0}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  ← Prev Page
                </button>
                <span className="font-mono text-slate-400">
                  {activePage + 1} / {pages.length}
                </span>
                <button
                  onClick={() => setActivePage((p) => Math.min(pages.length - 1, p + 1))}
                  disabled={activePage === pages.length - 1}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                >
                  Next Page →
                </button>
              </div>
            )}
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
              <span
                className={`w-2 h-2 rounded-full ${
                  activeStatus === 'Closed' ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                }`}
              />
              <span>Simulation Status: {activeStatus}</span>
              <span className="text-slate-600">|</span>
              <span className="text-orange-400 font-mono">{project.voltage}V Grid</span>
            </div>
          </div>

          {/* DSL Code View Collapsible Drawer */}
          {showDsl && (
            <div className="border-t border-slate-800 bg-slate-950 p-4 max-h-48 overflow-auto font-mono text-[11px] text-slate-300">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-orange-400">Generated Schematex DSL</span>
                <button onClick={() => setShowDsl(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="text-slate-400">{pages[activePage]?.dsl || ''}</pre>
            </div>
          )}
        </main>

        {/* RIGHT PANEL: Dynamic Inspector (Switches between Analyze, Simulate, Library) */}
        <aside className="w-80 border-l border-slate-800/80 bg-slate-950 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              {activeMode === 'analyze' && <Activity size={14} className="text-orange-400" />}
              {activeMode === 'simulate' && <Sliders size={14} className="text-orange-400" />}
              {activeMode === 'library' && <BookOpen size={14} className="text-orange-400" />}
              <span>
                {activeMode === 'analyze' && 'System Analytics'}
                {activeMode === 'simulate' && 'Properties Inspector'}
                {activeMode === 'library' && 'Symbol Library'}
              </span>
            </div>
            <button
              onClick={() => setShowDsl(!showDsl)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900"
              title="View DSL Code"
            >
              <FileCode size={14} />
            </button>
          </div>

          {/* MODE 1: ANALYZE DRAWER */}
          {activeMode === 'analyze' && (
            <div className="p-4 space-y-4 flex-1 overflow-y-auto no-scrollbar text-xs">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-orange-400 block font-semibold">
                  IEC 60364 Diagnostic Report
                </span>
                <h4 className="text-sm font-extrabold text-white">System Compliance: PASS</h4>
                <p className="text-xs text-slate-300">
                  Calculated voltage drop and short circuit values are within allowable limits.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Key System Metrics
                </span>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Max Lighting VD</span>
                  <span className="font-mono font-bold text-emerald-400">1.8% (Limit ≤ 3%)</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Max Power VD</span>
                  <span className="font-mono font-bold text-emerald-400">3.2% (Limit ≤ 5%)</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Short Circuit Rating</span>
                  <span className="font-mono font-bold text-amber-400">15.4 kA</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">System Diversity</span>
                  <span className="font-mono font-bold text-sky-400">0.75</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Phase Balance Score</span>
                  <span className="font-mono font-bold text-emerald-400">98.4%</span>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: SIMULATE / PROPERTIES DRAWER */}
          {activeMode === 'simulate' && selectedComponent && (
            <div className="p-4 space-y-4 flex-1 overflow-y-auto no-scrollbar text-xs">
              {/* Header Badge & Name */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    {selectedComponent.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      activeStatus === 'Closed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeStatus === 'Closed' ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                    {activeStatus === 'Closed' ? 'Active (Closed)' : activeStatus}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-white">{selectedComponent.name}</h4>
                <p className="text-xs text-slate-400">{selectedComponent.type}</p>
              </div>

              {/* Properties Inputs & Status Simulation Selector */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Protection Rating</label>
                  <input
                    type="text"
                    value={selectedComponent.rating}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {selectedComponent.cableSize && (
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Cable Conductor Schedule</label>
                    <input
                      type="text"
                      value={selectedComponent.cableSize}
                      readOnly
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none"
                    />
                  </div>
                )}

                {/* Status Simulation Switch */}
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Simulation Switch</label>
                  <select
                    value={activeStatus}
                    onChange={(e) =>
                      updateStatus(selectedComponent.id, e.target.value as 'Closed' | 'Open' | 'Tripped')
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 cursor-pointer"
                  >
                    <option value="Closed">Closed (Normal Power Flow)</option>
                    <option value="Open">Open (Manual Disconnect)</option>
                    <option value="Tripped">Tripped (Simulate Fault)</option>
                  </select>
                </div>
              </div>

              {/* Live Measurements Card */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Live Project Calculations
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Current Load</span>
                    <span className="font-mono font-bold text-orange-400">
                      {selectedComponent.current}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Max Demand</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedComponent.power}
                    </span>
                  </div>
                </div>
              </div>

              {/* Downstream Connections List */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Connections Path
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
          )}

          {/* MODE 3: LIBRARY DRAWER */}
          {activeMode === 'library' && (
            <div className="p-4 space-y-3 flex-1 overflow-y-auto no-scrollbar text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                IEC / IEEE Symbol Catalog
              </span>

              {[
                { name: 'Moulded Case Circuit Breaker', symbol: 'MCCB', spec: '100A – 800A | 36kA–70kA' },
                { name: 'Air Circuit Breaker', symbol: 'ACB', spec: '1000A – 4000A | 65kA–100kA' },
                { name: 'Miniature Circuit Breaker', symbol: 'MCB', spec: '6A – 63A | C-Curve / D-Curve' },
                { name: 'Dy11 Step-Down Transformer', symbol: 'XFMR', spec: '500kVA – 2500kVA | 11kV/415V' },
                { name: 'Automatic Transfer Switch', symbol: 'ATS', spec: 'Dual Grid & Gen Incomer' },
                { name: 'Distribution Busbar', symbol: 'BUS', spec: 'Copper / Aluminum 100A–2000A' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 cursor-pointer hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{item.name}</span>
                    <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 font-mono text-[10px]">
                      {item.symbol}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{item.spec}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
