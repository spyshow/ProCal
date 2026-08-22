'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import { SchematexDiagram } from 'schematex/react';
import { generateSLDPages, generateSLD, type SLDPage as SLDPageType } from '@/lib/sld/generator';
import {
  GitBranch,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Printer,
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
  ArrowUpRight,
  ArrowDownRight,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AccessRestricted } from '@/components/AccessRestricted';
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner';
import { QAReviewDrawer } from '@/components/QAReviewDrawer';
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
  upstream?: string[];
  downstream?: string[];
  floorNumber?: number;
  buildingName?: string;
}

export default function SLDPage() {
  const { selectedProjectId, selectedProject, loading: contextLoading, canView, canEdit } = useProject();
  const { t, isRtl } = useTranslation();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [pages, setPages] = useState<SLDPageType[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [activeTab, setActiveTab] = useState<'riser' | 'sld' | 'panels'>('riser');
  const [activeMode, setActiveMode] = useState<'analyze' | 'simulate' | 'library'>('simulate');

  // Explorer Search & Sidebar Collapsible State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedProject && selectedProject.id === selectedProjectId) {
      setProject(selectedProject);
      if (selectedProject.buildings && selectedProject.buildings.length > 0) {
        setSelectedBuildingId(selectedProject.buildings[0].id);
      }
      setLoading(false);
    }
  }, [selectedProject, selectedProjectId]);

  // Load project details from API
  const loadProject = useCallback(async () => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }
    if (selectedProject?.id === selectedProjectId) {
      setProject(selectedProject);
      if (selectedProject.buildings && selectedProject.buildings.length > 0) {
        setSelectedBuildingId(selectedProject.buildings[0].id);
      }
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
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectedProject]);

  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      loadProject();
    }
  }, [loadProject, selectedProject, selectedProjectId]);

  // Generate real SLD Pages from project data
  useEffect(() => {
    if (!project) return;
    const generatedPages = generateSLDPages(project);
    setPages(generatedPages);
    setActivePage(0);

    const txRating = project.transformerSize ? `${project.transformerSize} kVA` : '1000 kVA';
    const txKvaVal = project.transformerSize || 1000;
    setSelectedComponent({
      id: 'xfmr-main',
      name: `${project.name} Main Transformer`,
      type: 'Cast Resin Dy11 Step-Down Transformer',
      rating: txRating,
      voltage: `${project.voltage}V`,
      current: `${Math.round((txKvaVal * 1000) / (Math.sqrt(3) * project.voltage))} A`,
      power: `${txKvaVal} kVA`,
      cableSize: '2x(4x1c 300mm² Cu/XLPE)',
      connections: ['Utility Grid 11kV Incomer', 'Main Switchboard MDB Bus'],
      upstream: ['Utility Grid 11kV Incomer (Substation Supply)'],
      downstream: ['Main Switchboard MDB Busbar (400V Distribution)'],
    });
  }, [project]);

  // Single Line Overview Full DSL
  const overviewDsl = useMemo(() => {
    if (!project) return '';
    return generateSLD(project);
  }, [project]);

  // Select node & auto-switch canvas page if node belongs to a floor
  const handleSelectNode = useCallback(
    (data: ComponentProperty, floorNumber?: number) => {
      setSelectedComponent(data);
      if (floorNumber !== undefined && pages.length > 0) {
        const targetBldg = data.buildingName;

        const pageIdx = pages.findIndex((p) => {
          const matchesFloor = p.floorNumber === floorNumber;
          const matchesBldg =
            !targetBldg ||
            !p.buildingName ||
            targetBldg.toLowerCase().includes(p.buildingName.toLowerCase()) ||
            p.buildingName.toLowerCase().includes(targetBldg.toLowerCase());
          return matchesFloor && matchesBldg;
        });

        const finalIdx =
          pageIdx !== -1
            ? pageIdx
            : pages.findIndex(
                (p) => p.floorNumber === floorNumber || p.title.includes(`F${floorNumber}`)
              );

        if (finalIdx !== -1) {
          setActivePage(finalIdx);
          setActiveTab('riser');
        }
      }
    },
    [pages]
  );

  // Apply zoom to SVG element
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (svg) {
      svg.style.transform = `scale(${zoom / 100})`;
      svg.style.transformOrigin = 'top left';
    }
  }, [zoom, pages, activePage, activeTab]);

  // Extract Real Component Tree from Project Data with Floor Navigation
  const dynamicTree = useMemo(() => {
    if (!project) return [];

    const rootItems: Array<{
      id: string;
      name: string;
      type: string;
      icon: 'zap' | 'cpu' | 'layers' | 'breaker' | 'plug';
      badge?: string;
      floorNumber?: number;
      children?: Array<any>;
      data: ComponentProperty;
    }> = [];

    // 1. Grid Incomer
    const txKva = project.transformerSize || 1000;
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
        cableSize: '3x1c 240mm² XLPE 11kV Feeder',
        connections: ['Main Step-Down Transformer'],
        upstream: ['HV Regional Substation (11kV Utility Grid)'],
        downstream: [`Main Step-Down Transformer (${txKva} kVA)`],
      },
    });

    // 2. Transformer
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
        cableSize: '2x(4x1c 300mm² Cu/XLPE)',
        connections: ['Utility Grid', 'Main Switchboard MDB Bus'],
        upstream: ['Utility Grid 11kV Incomer'],
        downstream: ['Main Switchboard MDB Busbar (400V Distribution)'],
      },
    });

    // 3. Buildings & Floor Switchboards
    if (project.buildings) {
      project.buildings.forEach((bldg) => {
        const bldgChildren: Array<any> = [];

        if (bldg.floorDesigns) {
          const sortedFloors = [...bldg.floorDesigns].sort(
            (a, b) => a.floorNumber - b.floorNumber
          );

          sortedFloors.forEach((fd) => {
            if (!fd.items || fd.items.length === 0) return;
            const floorCurrent = fd.items.reduce((s, i) => s + (i.calculatedCurrent || 0), 0);
            const floorPower = fd.items.reduce((s, i) => s + (i.calculatedMaxDemand || 0), 0);

            const itemChildren = fd.items.map((item, idx) => {
              const itemId = `item-${bldg.id}-${fd.floorNumber}-${idx}`;
              const itemCable =
                item.cableSize ||
                (item.calculatedCurrent && item.calculatedCurrent > 20
                  ? '3x4mm² Cu/PVC'
                  : '3x2.5mm² Cu/PVC');

              return {
                id: itemId,
                name: `${item.name} (${item.breakerSize || 'MCB'})`,
                type: item.type || 'Electrical Load',
                icon: 'plug',
                badge: item.breakerSize,
                floorNumber: fd.floorNumber,
                data: {
                  id: itemId,
                  name: item.name,
                  type: `${item.type || 'Branch Load'} Circuit`,
                  rating: item.breakerSize || '16A MCB',
                  voltage: `${project.voltage}V`,
                  current: `${item.calculatedCurrent?.toFixed(1) || '0.0'} A`,
                  power: `${item.calculatedMaxDemand?.toFixed(1) || '0.0'} kVA`,
                  cableSize: itemCable,
                  connections: [`Floor ${fd.floorNumber} Distribution Bus`],
                  upstream: [`Floor ${fd.floorNumber} Main Panel (DB-F${fd.floorNumber})`],
                  downstream: [`${item.name} End Loads & Outlets`],
                  floorNumber: fd.floorNumber,
                  buildingName: bldg.name,
                },
              };
            });

            const feederCable =
              fd.riserCableSize ||
              (floorCurrent > 200
                ? '4x120mm² Cu/XLPE'
                : floorCurrent > 100
                ? '4x50mm² Cu/XLPE'
                : floorCurrent > 63
                ? '4x25mm² Cu/XLPE'
                : '4x16mm² Cu/XLPE');

            const floorTitle = fd.hasFloorSubPanels
              ? `Floor ${fd.floorNumber} Sub-Panel (${Math.ceil(floorCurrent)}A Main)`
              : `Floor ${fd.floorNumber} (${Math.ceil(floorCurrent)}A Main)`;

            const floorPanelName = fd.hasFloorSubPanels
              ? `Floor ${fd.floorNumber} Sub-Panel (SDB)`
              : `Floor ${fd.floorNumber} Distribution Board (DB)`;

            const floorId = `floor-${bldg.id}-${fd.floorNumber}`;

            bldgChildren.push({
              id: floorId,
              name: floorTitle,
              type: fd.hasFloorSubPanels ? 'Sub-Distribution Board (SDB)' : 'Distribution Board (DB)',
              icon: 'layers',
              badge: `${Math.ceil(floorCurrent)}A`,
              floorNumber: fd.floorNumber,
              children: itemChildren,
              data: {
                id: floorId,
                name: floorPanelName,
                type: fd.hasFloorSubPanels ? 'Sub-Distribution Board (TP&N SDB)' : 'Distribution Board (DB)',
                rating: `${Math.ceil(floorCurrent)}A Main Breaker`,
                voltage: `${project.voltage}V`,
                current: `${floorCurrent.toFixed(1)} A`,
                power: `${floorPower.toFixed(1)} kVA`,
                cableSize: feederCable,
                connections: ['MDB Busbar', ...fd.items.map((i) => i.name)],
                upstream: [`Rising Main Busbar / Feeder from MDB`],
                downstream: fd.items.map((i) => i.name),
                floorNumber: fd.floorNumber,
                buildingName: bldg.name,
              },
            });
          });
        }

        bldgChildren.sort((a, b) => (a.floorNumber ?? 0) - (b.floorNumber ?? 0));

        const riserCable = 'Rising Main Busbar Trunking (800A) / 4x185mm² Cu';

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
            current: 'Variable (Building Total)',
            power: 'Building Total Demand',
            cableSize: riserCable,
            connections: ['MDB Main Switchboard', ...bldgChildren.map((c) => c.name)],
            upstream: ['Main Switchboard MDB Busbar (400V)'],
            downstream: bldgChildren.map((c) => c.name),
          },
        });
      });
    }

    return rootItems;
  }, [project]);

  // Sync selected tree node when page index changes via Prev/Next buttons
  const selectPageFloor = useCallback(
    (pageIndex: number) => {
      setActivePage(pageIndex);
      const targetPage = pages[pageIndex];
      if (!targetPage) return;

      const targetBldgName = targetPage.buildingName;
      const targetFloorNum =
        targetPage.floorNumber ??
        (targetPage.title.match(/F(\d+)/i) ? parseInt(targetPage.title.match(/F(\d+)/i)![1], 10) : undefined);

      for (const item of dynamicTree) {
        const matchesBldg =
          !targetBldgName || item.name.toLowerCase().includes(targetBldgName.toLowerCase());

        if (matchesBldg && item.children) {
          const floorChild = item.children.find(
            (c: any) => c.floorNumber === targetFloorNum
          );
          if (floorChild) {
            setSelectedComponent(floorChild.data);
            setExpandedNodes((prev) => ({ ...prev, [item.id]: true }));
            return;
          }
        }
      }

      // Fallback search across all children if exact building match wasn't found
      if (targetFloorNum !== undefined) {
        for (const item of dynamicTree) {
          if (item.children) {
            const floorChild = item.children.find(
              (c: any) => c.floorNumber === targetFloorNum
            );
            if (floorChild) {
              setSelectedComponent(floorChild.data);
              setExpandedNodes((prev) => ({ ...prev, [item.id]: true }));
              break;
            }
          }
        }
      }
    },
    [pages, dynamicTree]
  );

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

  const projectMetrics = useMemo(() => {
    if (!project || !project.buildings) return { totalPower: 0, totalCurrent: 0, totalCircuits: 0, totalFloors: 0 };
    let totalPower = 0;
    let totalCurrent = 0;
    let totalCircuits = 0;
    let totalFloors = 0;

    project.buildings.forEach((bldg) => {
      if (bldg.floorDesigns) {
        totalFloors += bldg.floorDesigns.length;
        bldg.floorDesigns.forEach((fd) => {
          if (fd.items) {
            totalCircuits += fd.items.length;
            fd.items.forEach((i) => {
              totalPower += i.calculatedMaxDemand || 0;
              totalCurrent += i.calculatedCurrent || 0;
            });
          }
        });
      }
    });

    return { totalPower, totalCurrent, totalCircuits, totalFloors };
  }, [project]);

  const triggerLandscapePrint = () => {
    let styleEl = document.getElementById('print-landscape-override') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'print-landscape-override';
      styleEl.innerHTML = '@page { size: 297mm 210mm !important; margin: 18mm 10mm 15mm 10mm !important; }';
      document.head.appendChild(styleEl);
    }
    window.print();
  };

  const exportPDF = () => {
    setIsPrintingAll(false);
    setTimeout(() => {
      triggerLandscapePrint();
    }, 50);
  };

  const exportPrintAll = () => {
    setIsPrintingAll(true);

    const handleAfterPrint = () => {
      setIsPrintingAll(false);
      window.removeEventListener('afterprint', handleAfterPrint);
    };

    window.addEventListener('afterprint', handleAfterPrint);

    setTimeout(() => {
      triggerLandscapePrint();
    }, 200);
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
    if (activeTab === 'sld') return;
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
  }, [pages, activePage, activeTab]);

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

  if (selectedProject && !canView('sldDesigner')) {
    return <AccessRestricted pageTitle={t('nav.sldDesigner', 'Single Line Diagram')} />;
  }

  const activeStatus = selectedComponent ? getStatus(selectedComponent.id) : 'Closed';

  return (
    <div className="sld-workstation-root flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none print:h-auto print:bg-white print:text-black print:overflow-visible">
      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="sldDesigner" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="sldDesigner" pageTitle="Single Line Diagram (SLD)" />

      {/* Top Workstation Window Bar & Header */}
      <header data-tour="sld-header" className="h-14 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl px-4 flex items-center justify-between z-30 shrink-0 print:hidden">
        {/* Left: App Title & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(234,88,12,0.3)]">
            <GitBranch className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">{t('sld.title', 'Single Line Diagram')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                V4.2 Dynamic
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                {project.name}
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
            {t('sld.modeAnalyze', 'Analyze')}
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
            {t('sld.modeSimulate', 'Simulate Engine')}
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
            {t('sld.modeLibrary', 'Library')}
          </button>
        </div>

        {/* Right: Actions & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Page Tour Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trigger-procal-sld-tour'));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-300 hover:bg-orange-600/30 text-xs font-semibold shadow-sm transition-all"
            title="Interactive SLD Workstation Tour"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
            {t('cableSchedule.pageTour', 'Page Tour')}
          </button>

          {/* Zoom Toolbar */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono text-slate-400 w-10 text-center" dir="ltr">{zoom}%</span>
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
            <span className="hidden sm:inline">{t('sld.exportPng', 'Export PNG')}</span>
          </button>

          <button
            onClick={exportPDF}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs flex items-center gap-1.5"
            title="Export Current Page to PDF/Print"
          >
            <Download size={14} className="text-sky-400" />
            <span className="hidden sm:inline">{t('sld.printPage', 'Print Page')}</span>
          </button>

          <button
            onClick={exportPrintAll}
            className="p-1.5 rounded-lg bg-orange-600/20 border border-orange-500/40 text-orange-300 hover:bg-orange-600/30 text-xs flex items-center gap-1.5 font-medium shadow-[0_0_12px_rgba(234,88,12,0.2)]"
            title="Print Complete Project Package (Executive Summary + All Single Line Diagrams)"
          >
            <Printer size={14} className="text-orange-400" />
            <span className="hidden sm:inline">{t('sld.printAll', 'Print All (Full Package)')}</span>
          </button>
        </div>
      </header>

      {/* Main Workstation 3-Panel Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT PANEL: Collapsible Dynamic Project Explorer */}
        <aside
          data-tour="sld-tree"
          className={`${
            isSidebarCollapsed ? 'w-12' : 'w-72'
          } border-r border-slate-800/80 bg-slate-950 flex flex-col shrink-0 transition-all duration-200 print:hidden relative`}
        >
          {isSidebarCollapsed ? (
            /* Collapsed Icon Bar */
            <div className="flex flex-col items-center py-3 gap-4">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-orange-400 hover:text-white hover:border-slate-700 transition-colors shadow-sm"
                title="Expand Project Explorer Menu"
              >
                <PanelLeftOpen size={16} />
              </button>

              <div className="w-6 h-px bg-slate-800 my-1" />

              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-slate-900 transition-colors"
                title="Project Explorer Tree"
              >
                <FolderTree size={16} />
              </button>

              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-slate-900 transition-colors"
                title="Search Circuits"
              >
                <Search size={16} />
              </button>
            </div>
          ) : (
            /* Full Expanded Explorer Sidebar */
            <>
              <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <FolderTree size={14} className="text-orange-400" />
                  <span>{t('sld.explorerTree', 'Project Explorer Tree')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500">{dynamicTree.length} {t('sld.nodes', 'Nodes')}</span>
                  <button
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                    title="Collapse Explorer Menu"
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-2.5 border-b border-slate-800/60">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder={t('sld.searchPlaceholder', 'Search circuits or panels…')}
                    value={explorerSearch}
                    onChange={(e) => setExplorerSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg ps-8 pe-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
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
                            handleSelectNode(item.data, item.floorNumber);
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
                                    onClick={() => handleSelectNode(child.data, child.floorNumber)}
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
                                            onClick={() => handleSelectNode(sub.data, sub.floorNumber)}
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
            </>
          )}
        </aside>

        {/* CENTER PANEL: Canvas Workstation Viewport */}
        <main
          data-tour="sld-canvas"
          className={`sld-main-viewport flex-1 flex flex-col bg-slate-950 overflow-hidden relative ${
            isPrintingAll ? 'print:hidden' : 'print:bg-white print:overflow-visible print:w-full print:block'
          }`}
        >
          {/* Document View Header */}
          <div className="h-9 border-b border-slate-800/80 bg-slate-900/80 flex items-center px-4 justify-between shrink-0 print:hidden font-sans">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              {isSidebarCollapsed && (
                <button
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="p-1 rounded bg-slate-800 text-orange-400 hover:text-white hover:bg-slate-700 transition-colors mr-1"
                  title="Expand Project Explorer Menu"
                >
                  <PanelLeftOpen size={14} />
                </button>
              )}
              <GitBranch className="w-4 h-4 text-orange-400" />
              <span>Single Line Diagram — {pages[activePage]?.floors || pages[activePage]?.title || 'Floor View'}</span>
            </div>

            {pages.length > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => selectPageFloor(Math.max(0, activePage - 1))}
                  disabled={activePage === 0}
                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-slate-400 font-mono text-[11px]">
                  {activePage + 1} / {pages.length}
                </span>
                <button
                  onClick={() => selectPageFloor(Math.min(pages.length - 1, activePage + 1))}
                  disabled={activePage === pages.length - 1}
                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Canvas Area with Dark Grid Background */}
          <div className="sld-canvas-container-outer flex-1 overflow-auto p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] relative flex items-center justify-center print:bg-white print:p-0 print:m-0 print:block print:w-full">
            {/* Professional Engineering Print Header (Visible ONLY when printing) */}
            <div className="hidden print:flex flex-col border-b-2 border-black pb-2 mb-4 font-sans text-black w-full max-w-full box-border">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-bold uppercase tracking-tight truncate text-black">
                    {project.name}
                  </h1>
                  <p className="text-xs text-gray-700 font-semibold truncate mt-0.5">
                    SINGLE LINE DIAGRAM — {pages[activePage]?.floors || pages[activePage]?.title}
                  </p>
                </div>
                <div className="text-right text-[10px] text-gray-800 font-mono shrink-0 leading-tight space-y-0.5 pr-1">
                  <div><span className="font-bold">{project.voltage}V 3-Phase</span> | <span className="font-bold">{project.frequency || 50}Hz</span></div>
                  <div>Standard: <span className="font-bold">IEC 60364</span> | Date: <span className="font-bold">{new Date().toLocaleDateString()}</span></div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-600 border-t border-gray-200 mt-1.5 pt-1">
                <span>Client: <strong className="text-black">{project.client || 'N/A'}</strong></span>
                <span>Consultant: <strong className="text-black">{project.consultant || 'N/A'}</strong></span>
                <span>Engineer: <strong className="text-black">{project.engineer || 'N/A'}</strong></span>
              </div>
            </div>

            {/* SVG Canvas Container */}
            <div
              ref={svgContainerRef}
              className="sld-canvas-wrapper relative bg-slate-900/70 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.6)] min-w-[750px] transition-all duration-300 print:bg-white print:border-none print:shadow-none print:p-0 print:m-0 print:min-w-0 print:w-full"
            >
              {pages[activePage] && <SchematexDiagram dsl={pages[activePage].dsl} />}
            </div>

            {/* Floating Live Simulation Banner */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/10 text-xs text-slate-300 shadow-lg print:hidden">
              <span
                className={`w-2 h-2 rounded-full ${
                  activeStatus === 'Closed' ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                }`}
              />
              <span>Simulation Status: {activeStatus}</span>
              <span className="text-slate-600">|</span>
              <span className="text-orange-400 font-mono">
                {pages[activePage]?.floors}
              </span>
            </div>
          </div>

          {/* DSL Code View Collapsible Drawer */}
          {showDsl && (
            <div className="border-t border-slate-800 bg-slate-950 p-4 max-h-48 overflow-auto font-mono text-[11px] text-slate-300 print:hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-orange-400">Generated Schematex DSL</span>
                <button onClick={() => setShowDsl(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="text-slate-400">
                {pages[activePage]?.dsl || ''}
              </pre>
            </div>
          )}
        </main>

        {/* RIGHT PANEL: Dynamic Inspector (Switches between Analyze, Simulate, Library) */}
        <aside className="w-80 border-l border-slate-800/80 bg-slate-950 flex flex-col shrink-0 print:hidden">
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              {activeMode === 'analyze' && <Activity size={14} className="text-orange-400" />}
              {activeMode === 'simulate' && <Sliders size={14} className="text-orange-400" />}
              {activeMode === 'library' && <BookOpen size={14} className="text-orange-400" />}
              <span>
                {activeMode === 'analyze' && t('sld.modeAnalyze', 'System Analytics')}
                {activeMode === 'simulate' && t('sld.propertiesInspector', 'Properties Inspector')}
                {activeMode === 'library' && t('sld.symbolLibrary', 'Symbol Library')}
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
                  {t('sld.diagReport', 'IEC 60364 Diagnostic Report')}
                </span>
                <h4 className="text-sm font-extrabold text-white">{t('sld.systemPass', 'System Compliance: PASS')}</h4>
                <p className="text-xs text-slate-300">
                  Calculated voltage drop and short circuit values are within allowable limits.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Key System Metrics
                </span>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">{t('sld.maxLightingVd', 'Max Lighting VD')}</span>
                  <span className="font-mono font-bold text-emerald-400">1.8% (Limit ≤ 3%)</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">{t('sld.maxPowerVd', 'Max Power VD')}</span>
                  <span className="font-mono font-bold text-emerald-400">3.2% (Limit ≤ 5%)</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">{t('sld.shortCircuitRating', 'Short Circuit Rating')}</span>
                  <span className="font-mono font-bold text-amber-400">15.4 kA</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">{t('sld.systemDiversity', 'System Diversity')}</span>
                  <span className="font-mono font-bold text-sky-400">0.75</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">{t('sld.phaseBalanceScore', 'Phase Balance Score')}</span>
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
                    {activeStatus === 'Closed' ? t('sld.activeClosed', 'Active (Closed)') : activeStatus === 'Open' ? t('sld.open', 'Open') : t('sld.tripped', 'Tripped')}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-white">{selectedComponent.name}</h4>
                <p className="text-xs text-slate-400">{selectedComponent.type}</p>
              </div>

              {/* Properties Inputs & Status Simulation Selector */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">{t('sld.protectionRating', 'Protection Rating')}</label>
                  <input
                    type="text"
                    value={selectedComponent.rating}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Cable Conductor Schedule */}
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 flex items-center justify-between">
                    <span>{t('sld.cableConductorSchedule', 'Cable Conductor Schedule')}</span>
                    <span className="text-[10px] text-amber-400/80 font-mono">IEC 60228</span>
                  </label>
                  <input
                    type="text"
                    value={selectedComponent.cableSize || '3x2.5mm² Cu/PVC'}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-medium focus:outline-none shadow-inner"
                  />
                </div>

                {/* Status Simulation Switch */}
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">{t('sld.simulationSwitch', 'Simulation Switch')}</label>
                  <select
                    value={activeStatus}
                    onChange={(e) =>
                      updateStatus(selectedComponent.id, e.target.value as 'Closed' | 'Open' | 'Tripped')
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 cursor-pointer"
                  >
                    <option value="Closed">{t('sld.closedNormal', 'Closed (Normal Power Flow)')}</option>
                    <option value="Open">{t('sld.openManual', 'Open (Manual Disconnect)')}</option>
                    <option value="Tripped">{t('sld.trippedFault', 'Tripped (Simulate Fault)')}</option>
                  </select>
                </div>
              </div>

              {/* Live Measurements Card */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  {t('sld.liveCalculations', 'LIVE PROJECT CALCULATIONS')}
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">{t('sld.currentLoad', 'Current Load')}</span>
                    <span className="font-mono font-bold text-orange-400">
                      {selectedComponent.current}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">{t('common.maxDemand', 'Max Demand')}</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedComponent.power}
                    </span>
                  </div>
                </div>
              </div>

              {/* Upstream & Downstream Connection Paths */}
              <div className="space-y-3 pt-2">
                {/* Upstream Supply Path */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1 font-semibold">
                    <ArrowUpRight className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('sld.upstreamSupplySource', 'UPSTREAM SUPPLY SOURCE')}</span>
                  </span>
                  {selectedComponent.upstream && selectedComponent.upstream.length > 0 ? (
                    selectedComponent.upstream.map((conn, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-sky-950/30 border border-sky-800/40 flex items-center justify-between text-[11px] text-sky-200"
                      >
                        <span className="truncate max-w-[210px]">{conn}</span>
                        <ArrowUpRight className="w-3 h-3 text-sky-400 shrink-0" />
                      </div>
                    ))
                  ) : (
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-500 italic">
                      {t('sld.directGridSupply', 'Direct High-Voltage Grid Supply')}
                    </div>
                  )}
                </div>

                {/* Downstream Distribution Path */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1 font-semibold">
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('sld.downstreamDistribution', 'DOWNSTREAM DISTRIBUTION')} ({selectedComponent.downstream?.length || selectedComponent.connections.length || 0})</span>
                  </span>
                  {(selectedComponent.downstream && selectedComponent.downstream.length > 0) || selectedComponent.connections.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5 no-scrollbar">
                      {(selectedComponent.downstream || selectedComponent.connections).map((conn, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300 hover:border-slate-700 transition-colors"
                        >
                          <span className="truncate max-w-[210px]">{conn}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-500 italic">
                      {t('sld.finalOutlets', 'Final Load Outlets / Equipment')}
                    </div>
                  )}
                </div>
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

      {/* ================= PRINT ALL COMPLETE PROJECT PACKAGE ================= */}
      {isPrintingAll && (
        <div id="print-sld-complete-package" className="hidden print:block bg-white text-black p-0 font-sans">
          {/* PAGE 1: EXECUTIVE PROJECT & ENGINEERING SUMMARY REPORT */}
          <div className="h-[180mm] max-h-[180mm] overflow-hidden flex flex-col justify-between box-border">
            <div>
              {/* Document Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4 bg-slate-900 text-white p-4 rounded-xl shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded uppercase tracking-wider font-mono">
                      Executive Engineering Report
                    </span>
                  </div>
                  <h1 className="text-xl font-black tracking-tight text-white uppercase mt-1">
                    {project.name}
                  </h1>
                  <p className="text-xs font-semibold text-slate-300">
                    EXECUTIVE ELECTRICAL ENGINEERING & SLD PACKAGE
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Prepared in accordance with IEC 60364 & BS 7671 Electrical Regulations
                  </p>
                </div>
                <div className="text-right text-xs space-y-0.5 font-mono text-slate-300">
                  <div className="font-bold text-sm text-amber-400">ProCal Engineering Suite</div>
                  <div>Report Ref: <span className="font-semibold text-white">PRJ-{project.id.slice(-6).toUpperCase()}</span></div>
                  <div>Date: <span className="font-semibold text-white">{new Date().toLocaleDateString()}</span></div>
                </div>
              </div>

              {/* Project Meta Cards */}
              <div className="grid grid-cols-3 gap-3 mb-4 border border-slate-200 rounded-xl p-3 bg-slate-50/80 text-xs">
                <div className="border-r border-slate-200 pr-2">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Client Name</span>
                  <span className="font-bold text-slate-900 text-sm">{project.client || 'N/A'}</span>
                </div>
                <div className="border-r border-slate-200 pr-2">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Consultant</span>
                  <span className="font-bold text-slate-900 text-sm">{project.consultant || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Lead Engineer</span>
                  <span className="font-bold text-slate-900 text-sm">{project.engineer || 'N/A'}</span>
                </div>
              </div>

              {/* Electrical Key Performance Metrics */}
              <h2 className="text-xs font-bold text-slate-900 uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
                1. System Electrical Calculations Summary
              </h2>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="border border-amber-200 rounded-xl p-2.5 text-center bg-amber-50/60">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">Total Max Demand</span>
                  <span className="text-base font-black text-amber-950">{projectMetrics.totalPower.toFixed(1)} kVA</span>
                </div>
                <div className="border border-sky-200 rounded-xl p-2.5 text-center bg-sky-50/60">
                  <span className="text-[10px] font-bold uppercase text-sky-800 block">Calculated Current</span>
                  <span className="text-base font-black text-sky-950">{projectMetrics.totalCurrent.toFixed(1)} A</span>
                </div>
                <div className="border border-emerald-200 rounded-xl p-2.5 text-center bg-emerald-50/60">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">System Voltage</span>
                  <span className="text-base font-black text-emerald-950">{project.voltage}V 3-Phase</span>
                </div>
                <div className="border border-purple-200 rounded-xl p-2.5 text-center bg-purple-50/60">
                  <span className="text-[10px] font-bold uppercase text-purple-800 block">Utility Transformer</span>
                  <span className="text-base font-black text-purple-950">1000 kVA (400V)</span>
                </div>
              </div>

              {/* Buildings & Distribution Structure */}
              <h2 className="text-xs font-bold text-slate-900 uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
                2. Project Distribution Hierarchy & Infrastructure
              </h2>
              <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden mb-4">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-2 border-r border-slate-800">Building / Structure</th>
                    <th className="p-2 border-r border-slate-800">Floors</th>
                    <th className="p-2 border-r border-slate-800">Distribution Panels (SDB/DB)</th>
                    <th className="p-2 border-r border-slate-800">Feeder Cable Specs</th>
                    <th className="p-2">Max Demand (kVA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {project.buildings?.map((bldg, idx) => {
                    const bldgCurrent = bldg.floorDesigns?.reduce(
                      (s, fd) => s + (fd.items?.reduce((is, i) => is + (i.calculatedCurrent || 0), 0) || 0),
                      0
                    ) || 0;
                    const bldgPower = bldg.floorDesigns?.reduce(
                      (s, fd) => s + (fd.items?.reduce((is, i) => is + (i.calculatedMaxDemand || 0), 0) || 0),
                      0
                    ) || 0;

                    return (
                      <tr key={bldg.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                        <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{bldg.name}</td>
                        <td className="p-2 border-r border-slate-200">{bldg.floors} Floors</td>
                        <td className="p-2 border-r border-slate-200">{bldg.floorDesigns?.length || 0} Sub-Panels</td>
                        <td className="p-2 border-r border-slate-200 font-mono text-[10px] text-slate-700">
                          Rising Main Busbar Trunking (800A)
                        </td>
                        <td className="p-2 font-bold text-slate-900">
                          {bldgPower.toFixed(1)} kVA <span className="text-amber-700 font-mono text-[11px]">({bldgCurrent.toFixed(1)}A)</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Included Diagram Pages Index */}
              <h2 className="text-xs font-bold text-slate-900 uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
                3. Single Line Diagram Drawings Index ({pages.length} Pages)
              </h2>
              <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] font-mono border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                {pages.map((p, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 border-b border-slate-200/80 truncate pr-1">
                    <span className="font-bold text-amber-700 shrink-0 mr-1.5">Drawing {String(idx + 1).padStart(2, '0')}:</span>
                    <span className="truncate text-slate-800">{p.floors || p.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cover Page Footer */}
            <div className="border-t border-slate-200 pt-2 text-[10px] text-slate-500 flex justify-between font-mono mt-4">
              <div>ProCal Engineering System — Single Line Diagram Generator</div>
              <div>Page 1 of {pages.length + 1}</div>
            </div>
          </div>

          {/* PAGES 2..N: EVERY FLOOR DIAGRAM PAGE */}
          {pages.map((page, idx) => (
            <div
              key={idx}
              style={{ pageBreakBefore: 'always', breakBefore: 'page', pageBreakInside: 'avoid', breakInside: 'avoid' }}
              className="pt-2 w-full max-w-full box-border max-h-[180mm] overflow-hidden"
            >
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2 mb-2 font-sans text-slate-900 w-full max-w-full box-border">
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-black text-slate-900 uppercase tracking-tight truncate">
                    {project.name}
                  </h1>
                  <p className="text-xs font-bold text-amber-700 truncate mt-0.5">
                    SINGLE LINE DIAGRAM — {page.floors || page.title}
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-800 font-mono shrink-0 leading-tight space-y-0.5 pr-1 bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1">
                  <div><span className="font-bold text-slate-900">{project.voltage}V 3-Phase</span> | <span className="font-bold text-slate-900">IEC 60364</span></div>
                  <div>Drawing: <span className="font-bold text-amber-700">{String(idx + 1).padStart(2, '0')} / {pages.length}</span></div>
                </div>
              </div>

              <div className="sld-canvas-wrapper w-full max-h-[150mm] overflow-hidden">
                <SchematexDiagram dsl={page.dsl} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
