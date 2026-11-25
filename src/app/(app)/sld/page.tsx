'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import { SchematexDiagram } from 'schematex/react';
import { generateSLDPages, generateSLD, resolveBreakerRating, type SLDPage as SLDPageType } from '@/lib/sld/generator';
import { render as renderSchematexSvg } from 'schematex';
import {
  convertSvgElementToDxf,
  convertSvgStringToDxf,
  convertMultipleSvgStringsToDxf,
  downloadDxfFile,
} from '@/lib/dxf/svg-to-dxf';
import { sizeTransformer } from '@/lib/calculations/loads';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { codeOf } from '@/lib/calculations/codes';
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
import type { ComponentProperty, HierarchyItem } from '@/components/sld/sld-types';
import { SldExplorerSidebar } from '@/components/sld/SldExplorerSidebar';
import { SldInspectorPanel } from '@/components/sld/SldInspectorPanel';
import { SldPrintPackage } from '@/components/sld/SldPrintPackage';

export type { ComponentProperty, HierarchyItem };

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

    let calculatedTx = 1000;
    const allProjectItems = project.buildings?.flatMap((b) => [
      ...(b.floorDesigns?.flatMap((fd) => fd.items || []) || []),
      ...(b.buildingLoads || []),
    ]) || [];
    if (allProjectItems.length > 0) {
      const balance = phaseBalance(allProjectItems as unknown as Parameters<typeof phaseBalance>[0], project);
      const pf = project.powerFactor || 0.85;
      const demandKva = balance.totalKw / pf;
      const perPhaseKva: [number, number, number] = [
        balance.phaseKw[0] / pf,
        balance.phaseKw[1] / pf,
        balance.phaseKw[2] / pf,
      ];
      calculatedTx = sizeTransformer(demandKva || 500, 1.2, perPhaseKva);
    }
    const txKvaVal = project.transformerSize || calculatedTx;
    const txRating = `${txKvaVal} kVA`;
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

    const rootItems: HierarchyItem[] = [];

    // 1. Grid Incomer
    let dynamicTx = 1000;
    const allItems = project.buildings?.flatMap((b) => [
      ...(b.floorDesigns?.flatMap((fd) => fd.items || []) || []),
      ...(b.buildingLoads || []),
    ]) || [];
    if (allItems.length > 0) {
      const balance = phaseBalance(allItems as unknown as Parameters<typeof phaseBalance>[0], project);
      const pf = project.powerFactor || 0.85;
      const demandKva = balance.totalKw / pf;
      const perPhaseKva: [number, number, number] = [
        balance.phaseKw[0] / pf,
        balance.phaseKw[1] / pf,
        balance.phaseKw[2] / pf,
      ];
      dynamicTx = sizeTransformer(demandKva || 500, 1.2, perPhaseKva);
    }
    const txKva = project.transformerSize || dynamicTx;
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
        const bldgChildren: HierarchyItem[] = [];

        if (bldg.floorDesigns) {
          const sortedFloors = [...bldg.floorDesigns].sort(
            (a, b) => a.floorNumber - b.floorNumber
          );
          const code = codeOf(project.calculationStandard);

          sortedFloors.forEach((fd) => {
            if (!fd.items || fd.items.length === 0) return;
            const floorBalance = phaseBalance(fd.items as unknown as Parameters<typeof phaseBalance>[0], project);
            const floorDesignCurrent = floorBalance.maxPhaseCurrent || fd.items.reduce((s, i) => s + (i.calculatedCurrent || 0), 0);
            const floorCurrent = fd.items.reduce((s, i) => s + (i.calculatedCurrent || 0), 0);
            const floorPower = fd.items.reduce((s, i) => s + (i.calculatedMaxDemand || 0), 0);
            const floorCbRating = resolveBreakerRating(fd.riserBreakerSize, floorDesignCurrent, code);

            const itemChildren: HierarchyItem[] = fd.items.map((item, idx) => {
              const itemId = `item-${bldg.id}-${fd.floorNumber}-${idx}`;
              const itemCable =
                item.cableSize ||
                (item.calculatedCurrent && item.calculatedCurrent > 20
                  ? '3x4mm² Cu/PVC'
                  : '3x2.5mm² Cu/PVC');
              const itemCbRating = resolveBreakerRating(item.breakerSize, item.calculatedCurrent || 0, code);

              return {
                id: itemId,
                name: `${item.name} (${itemCbRating})`,
                type: item.type || 'Electrical Load',
                icon: 'plug' as const,
                badge: itemCbRating,
                floorNumber: fd.floorNumber,
                data: {
                  id: itemId,
                  name: item.name,
                  type: `${item.type || 'Branch Load'} Circuit`,
                  rating: `${itemCbRating} MCB`,
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
              (floorDesignCurrent > 200
                ? '4x120mm² Cu/XLPE'
                : floorDesignCurrent > 100
                ? '4x50mm² Cu/XLPE'
                : floorDesignCurrent > 63
                ? '4x25mm² Cu/XLPE'
                : '4x16mm² Cu/XLPE');

            const floorTitle = fd.hasFloorSubPanels
              ? `Floor ${fd.floorNumber} Sub-Panel (${floorCbRating} Main)`
              : `Floor ${fd.floorNumber} (${floorCbRating} Main)`;

            const floorPanelName = fd.hasFloorSubPanels
              ? `Floor ${fd.floorNumber} Sub-Panel (SDB)`
              : `Floor ${fd.floorNumber} Distribution Board (DB)`;

            const floorId = `floor-${bldg.id}-${fd.floorNumber}`;

            bldgChildren.push({
              id: floorId,
              name: floorTitle,
              type: fd.hasFloorSubPanels ? 'Sub-Distribution Board (SDB)' : 'Distribution Board (DB)',
              icon: 'layers',
              badge: floorCbRating,
              floorNumber: fd.floorNumber,
              children: itemChildren,
              data: {
                id: floorId,
                name: floorPanelName,
                type: fd.hasFloorSubPanels ? 'Sub-Distribution Board (TP&N SDB)' : 'Distribution Board (DB)',
                rating: `${floorCbRating} Main Breaker`,
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
            (c) => c.floorNumber === targetFloorNum
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
              (c) => c.floorNumber === targetFloorNum
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
  const [dxfMenuOpen, setDxfMenuOpen] = useState(false);
  const exportDXF = () => {
    setDxfMenuOpen(false);
    if (!project || project.isTrial) return;
    const currentPage = pages[activePage];
    if (currentPage?.dsl) {
      const rawSvg = renderSchematexSvg(currentPage.dsl);
      const dxfContent = convertSvgStringToDxf(rawSvg, {
        isTrial: Boolean(project.isTrial),
        title: `${project.name || 'SLD'} - ${currentPage.floors || currentPage.title}`,
      });
      downloadDxfFile(dxfContent, `${project.name || 'sld'}-page${activePage + 1}.dxf`);
      return;
    }
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (!svg) return;
    const dxfContent = convertSvgElementToDxf(svg, {
      isTrial: Boolean(project.isTrial),
      title: `${project.name || 'SLD'} - Page ${activePage + 1}`,
    });
    downloadDxfFile(dxfContent, `${project.name || 'sld'}-page${activePage + 1}.dxf`);
  };

  const exportAllDXF = () => {
    setDxfMenuOpen(false);
    if (!project || project.isTrial || pages.length === 0) return;

    const sheets = pages.map((p) => ({
      title: `${p.floors || p.title}`,
      subtitle: `${project.name} | ${project.voltage}V 3-Phase | ${project.frequency || 50}Hz | ${project.calculationStandard || 'IEC 60364'}`,
      svgMarkup: renderSchematexSvg(p.dsl),
    }));

    const dxfContent = convertMultipleSvgStringsToDxf(sheets, {
      isTrial: Boolean(project.isTrial),
      title: `${project.name} - Complete SLD Package`,
    });
    downloadDxfFile(dxfContent, `${project.name || 'sld'}-all-sld-pages.dxf`);
  };

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

      if (project?.isTrial) {
        ctx.save();
        ctx.translate(fullWidth / 2, fullHeight / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.font = 'bold 36px monospace';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.textAlign = 'center';
        ctx.fillText('PROCAL FREE TRIAL — NOT FOR CONSTRUCTION', 0, 0);
        ctx.fillText('EVALUATION ONLY — NOT FOR CONSTRUCTION', 0, 50);
        ctx.restore();
      }

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
    if (!project || !project.buildings) return { totalPower: 0, totalPowerKw: 0, totalCurrent: 0, totalCircuits: 0, totalFloors: 0 };
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

    const pf = project.powerFactor || 0.85;
    const totalPowerKw = totalPower;
    const totalPowerKva = totalPowerKw / pf;

    return { totalPower: totalPowerKva, totalPowerKw, totalCurrent, totalCircuits, totalFloors };
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
    const padX = 28;
    const minX = Math.min(0, bbox.x) - padX;
    const minY = Math.min(0, bbox.y) - 12;
    svg.setAttribute('viewBox', `${minX} ${minY} ${bbox.width + padX * 2 + Math.abs(Math.min(0, bbox.x))} ${bbox.height + EXTRA * 2}`);
    svg.style.height = 'auto';
  };

  const repositionLabels = (svg: SVGSVGElement) => {
    const texts = svg.querySelectorAll('text');
    if (texts.length === 0) return;

    const busLines: number[] = [];
    const mcbSymbols: { cx: number; cy: number; topY: number; botY: number; rightX: number }[] = [];
    svg.querySelectorAll('line').forEach((line) => {
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');
      if (y1 === y2 && Math.abs(x2 - x1) > 200) {
        busLines.push(y1);
      }
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

      // Prevent cable tags (e.g. Wf1a, Wf1b) and their dash placeholders from overlapping horizontal feeder paths (y≈281)
      if (/^Wf\d+[a-z]$/i.test(content)) {
        const currentY = parseFloat(text.getAttribute('y') || String(ty));
        text.setAttribute('y', String(currentY - 10));
        return;
      }
      if (content === '—') {
        text.setAttribute('opacity', '0');
        return;
      }

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
      <div className="flex items-center justify-center min-h-screen bg-[var(--background-color)] text-[var(--foreground-color)]">
        <Sparkles className="w-6 h-6 animate-spin text-orange-500 mr-2" />
        <p className="text-sm font-medium">Loading SLD Workstation Environment…</p>
      </div>
    );

  if (!project)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background-color)] text-[var(--foreground-color)] p-6 text-center">
        <GitBranch className="w-12 h-12 text-[var(--text-secondary)] mb-3" />
        <h2 className="text-xl font-bold text-[var(--foreground-color)] mb-2">No Active Project Selected</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6">
          Please select or create a project first from the dashboard to launch the Single Line Diagram workstation.
        </p>
      </div>
    );

  if (selectedProject && !canView('sldDesigner')) {
    return <AccessRestricted pageTitle={t('nav.sldDesigner', 'Single Line Diagram')} />;
  }

  const activeStatus = selectedComponent ? getStatus(selectedComponent.id) : 'Closed';

  return (
    <div className="sld-workstation-root flex flex-col h-screen bg-[var(--background-color)] text-[var(--foreground-color)] overflow-hidden font-sans select-none print:h-auto print:bg-white print:text-black print:overflow-visible">
      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="sldDesigner" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="sldDesigner" pageTitle="Single Line Diagram (SLD)" />

      {/* Top Workstation Window Bar & Header */}
      <header data-tour="sld-header" className="min-h-14 py-1.5 border-b border-[var(--border-color)] bg-[var(--card-bg)] backdrop-blur-xl px-3 flex flex-wrap items-center justify-between gap-2 z-30 shrink-0 print:hidden shadow-xs">
        {/* Left: App Title & Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(234,88,12,0.25)] shrink-0">
            <GitBranch className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-bold text-[var(--foreground-color)] tracking-tight whitespace-nowrap">{t('sld.title', 'Single Line Diagram')}</span>
              <span className="hidden xl:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30 font-semibold whitespace-nowrap">
                V4.2 Dynamic
              </span>
              <span className="text-[var(--border-color)] hidden lg:inline">|</span>
              <span className="hidden lg:inline text-xs text-[var(--text-secondary)] font-medium truncate max-w-[140px] xl:max-w-[200px]">
                {project.name}
              </span>
              {project.isTrial && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 font-bold whitespace-nowrap">
                  FREE TRIAL
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Mode Toggles */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-xs shadow-inner shrink-0">
          <button
            onClick={() => setActiveMode('analyze')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeMode === 'analyze'
                ? 'bg-[var(--card-bg)] text-[var(--foreground-color)] border border-[var(--border-color)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--foreground-color)]'
            }`}
          >
            {t('sld.modeAnalyze', 'Analyze')}
          </button>
          <button
            onClick={() => setActiveMode('simulate')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeMode === 'simulate'
                ? 'bg-orange-600 text-white shadow-xs shadow-orange-600/25 text-white-force'
                : 'text-[var(--text-secondary)] hover:text-[var(--foreground-color)]'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            {t('sld.modeSimulate', 'Simulate Engine')}
          </button>
          <button
            onClick={() => setActiveMode('library')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeMode === 'library'
                ? 'bg-[var(--card-bg)] text-[var(--foreground-color)] border border-[var(--border-color)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--foreground-color)]'
            }`}
          >
            <BookOpen className="w-3 h-3 text-[var(--text-secondary)]" />
            {t('sld.modeLibrary', 'Library')}
          </button>
        </div>

        {/* Right: Actions & Zoom Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Page Tour Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trigger-procal-sld-tour'));
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--card-bg-subtle)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] hover:text-orange-600 dark:hover:text-orange-400 text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
            title="Interactive SLD Workstation Tour"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <span className="hidden xl:inline">{t('cableSchedule.pageTour', 'Page Tour')}</span>
          </button>

          {/* Zoom Toolbar */}
          <div className="flex items-center gap-0.5 bg-[var(--card-bg-subtle)] border border-[var(--border-color)] rounded-lg p-1 shadow-xs">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--foreground-color)] hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono text-[var(--foreground-color)] font-semibold w-9 text-center" dir="ltr">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--foreground-color)] hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--foreground-color)] hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="w-px h-5 bg-[var(--border-color)]" />

          <button
            onClick={exportPNG}
            className="p-1.5 rounded-lg bg-[var(--card-bg-subtle)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] text-xs flex items-center gap-1 font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
            title="Export PNG Diagram"
          >
            <FileImage size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="hidden lg:inline">{t('sld.exportPng', 'Export PNG')}</span>
          </button>

          <button
            onClick={() => {
              if (!project.isTrial) setDxfMenuOpen((prev) => !prev);
            }}
            disabled={Boolean(project.isTrial)}
            className={`p-1.5 rounded-lg bg-[var(--card-bg-subtle)] border border-[var(--border-color)] text-xs flex items-center gap-1 font-semibold shadow-xs transition-all whitespace-nowrap ${
              project.isTrial
                ? 'opacity-50 cursor-not-allowed text-[var(--text-muted)]'
                : 'hover:border-orange-500/50 text-[var(--foreground-color)] cursor-pointer'
            }`}
            title={
              project.isTrial
                ? t('sld.dxfLockedTrial', 'AutoCAD DXF export is locked on Free Trial projects — upgrade to unlock CAD drawings')
                : t('sld.exportDxf', 'Export AutoCAD (.DXF)')
            }
          >
            <FileCode size={14} className="text-amber-500 dark:text-amber-400" />
            <span className="hidden lg:inline">{t('sld.exportDxf', 'Export AutoCAD (.DXF)')}</span>
            <ChevronDown size={12} className="text-[var(--text-muted)]" />
          </button>

          {dxfMenuOpen && !project.isTrial && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDxfMenuOpen(false)}
              />
              <div className="absolute top-12 end-24 mt-1 w-64 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xl py-1.5 z-50 text-xs">
                <button
                  onClick={exportDXF}
                  className="w-full px-3 py-2 text-start hover:bg-orange-500/10 flex items-center justify-between gap-2 text-[var(--foreground-color)] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileCode size={14} className="text-amber-500 shrink-0" />
                    <span>{t('sld.exportDxfPage', 'Current SLD Page (.DXF)')}</span>
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    P{activePage + 1}
                  </span>
                </button>
                <button
                  onClick={exportAllDXF}
                  className="w-full px-3 py-2 text-start hover:bg-orange-500/10 flex items-center justify-between gap-2 text-[var(--foreground-color)] transition-colors cursor-pointer border-t border-[var(--border-color)]/60"
                >
                  <span className="flex items-center gap-2 font-semibold text-orange-500 dark:text-orange-400">
                    <Layers size={14} className="text-orange-500 shrink-0" />
                    <span>{t('sld.exportDxfAll', 'All SLD Pages in One File (.DXF)')}</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-500 font-bold">
                    {pages.length}
                  </span>
                </button>
              </div>
            </>
          )}

          <button
            onClick={exportPDF}
            className="p-1.5 rounded-lg bg-[var(--card-bg-subtle)] border border-[var(--border-color)] hover:border-orange-500/50 text-[var(--foreground-color)] text-xs flex items-center gap-1 font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
            title="Export Current Page to PDF/Print"
          >
            <Download size={14} className="text-sky-600 dark:text-sky-400" />
            <span className="hidden lg:inline">{t('sld.printPage', 'Print Page')}</span>
          </button>

          <button
            onClick={exportPrintAll}
            className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-white-force text-xs flex items-center gap-1.5 font-semibold shadow-sm shadow-orange-600/25 transition-all cursor-pointer whitespace-nowrap"
            title="Print Complete Project Package (Executive Summary + All Single Line Diagrams)"
          >
            <Printer size={14} className="text-white shrink-0" />
            <span>{t('sld.printAllShort', 'Print All')}</span>
          </button>
        </div>
      </header>

      {/* Main Workstation 3-Panel Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT PANEL: Collapsible Dynamic Project Explorer */}
        <SldExplorerSidebar
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          dynamicTree={dynamicTree}
          explorerSearch={explorerSearch}
          setExplorerSearch={setExplorerSearch}
          expandedNodes={expandedNodes}
          toggleNode={toggleNode}
          selectedComponent={selectedComponent}
          handleSelectNode={handleSelectNode}
          getStatus={getStatus}
        />

        {/* CENTER PANEL: Canvas Workstation Viewport */}
        <main
          data-tour="sld-canvas"
          className={`sld-main-viewport flex-1 min-w-0 flex flex-col bg-[var(--background-color)] overflow-hidden relative ${
            isPrintingAll ? 'print:hidden' : 'print:bg-white print:overflow-visible print:w-full print:block'
          }`}
        >
          {/* Document View Header */}
          <div className="h-9 border-b border-[var(--border-color)] bg-[var(--card-bg-subtle)] flex items-center px-3 justify-between gap-2 shrink-0 print:hidden font-sans">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground-color)] min-w-0 flex-1">
              {isSidebarCollapsed && (
                <button
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="p-1 rounded bg-[var(--card-bg)] border border-[var(--border-color)] text-orange-400 hover:text-[var(--foreground-color)] transition-colors mr-1 cursor-pointer shrink-0"
                  title="Expand Project Explorer Menu"
                >
                  <PanelLeftOpen size={14} />
                </button>
              )}
              <GitBranch className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="truncate">Single Line Diagram — {pages[activePage]?.floors || pages[activePage]?.title || 'Floor View'}</span>
            </div>

            {pages.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs shrink-0 whitespace-nowrap">
                <button
                  onClick={() => selectPageFloor(Math.max(0, activePage - 1))}
                  disabled={activePage === 0}
                  className="px-2 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] hover:border-orange-500/50 disabled:opacity-30 transition-colors cursor-pointer whitespace-nowrap"
                >
                  ← Prev
                </button>
                <span className="text-[var(--text-muted)] font-mono text-[11px] whitespace-nowrap px-1">
                  {activePage + 1} / {pages.length}
                </span>
                <button
                  onClick={() => selectPageFloor(Math.min(pages.length - 1, activePage + 1))}
                  disabled={activePage === pages.length - 1}
                  className="px-2 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] hover:border-orange-500/50 disabled:opacity-30 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Canvas Area with Theme Grid Background */}
          <div className="sld-canvas-container-outer flex-1 overflow-auto p-4 sm:p-6 bg-[radial-gradient(var(--border-color)_1px,transparent_1px)] [background-size:16px_16px] relative flex flex-col items-start gap-3 print:bg-white print:p-0 print:m-0 print:block print:w-full">
            {/* Floating Live Simulation Banner */}
            <div className="z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--card-bg)]/95 backdrop-blur-md border border-[var(--border-color)] text-xs text-[var(--foreground-color)] shadow-sm print:hidden">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  activeStatus === 'Closed' ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                }`}
              />
              <span className="whitespace-nowrap">Simulation Status: {activeStatus}</span>
              <span className="text-[var(--border-color)]">|</span>
              <span className="text-orange-400 font-mono truncate">
                {pages[activePage]?.floors}
              </span>
            </div>

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
              className="sld-canvas-wrapper relative bg-[var(--card-bg)] backdrop-blur-md rounded-2xl border border-[var(--border-color)] p-4 sm:p-6 shadow-lg w-full min-w-[480px] my-auto transition-all duration-300 print:bg-white print:border-none print:shadow-none print:p-0 print:m-0 print:min-w-0 print:w-full"
            >
              {pages[activePage] && <SchematexDiagram dsl={pages[activePage].dsl} />}
            </div>
          </div>

          {/* DSL Code View Collapsible Drawer */}
          {showDsl && (
            <div className="border-t border-[var(--border-color)] bg-[var(--card-bg-subtle)] p-4 max-h-48 overflow-auto font-mono text-[11px] text-[var(--foreground-color)] print:hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-orange-400">Generated Schematex DSL</span>
                <button onClick={() => setShowDsl(false)} className="text-[var(--text-muted)] hover:text-[var(--foreground-color)] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="text-[var(--text-muted)]">
                {pages[activePage]?.dsl || ''}
              </pre>
            </div>
          )}
        </main>

        {/* RIGHT PANEL: Dynamic Inspector (Switches between Analyze, Simulate, Library) */}
        <SldInspectorPanel
          activeMode={activeMode}
          showDsl={showDsl}
          setShowDsl={setShowDsl}
          selectedComponent={selectedComponent}
          activeStatus={activeStatus}
          updateStatus={updateStatus}
        />
      </div>

      {/* ================= PRINT ALL COMPLETE PROJECT PACKAGE ================= */}
      <SldPrintPackage
        project={project}
        pages={pages}
        isPrintingAll={isPrintingAll}
        projectMetrics={projectMetrics}
      />
    </div>
  );
}
