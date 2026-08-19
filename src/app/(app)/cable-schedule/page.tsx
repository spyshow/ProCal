'use client';
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import { usePathname, useRouter } from 'next/navigation';
import { recalculateCable } from '@/lib/sld/cable-editor';
import { cablePatchUrl, upsizeBody, fieldEditBody } from '@/lib/sld/cablePersist';
import {
  parseMm2,
  parseCableSize,
  formatCableSize,
  getItemCableLength,
  getBuildingLoadCableLength,
  getRiserCableLength,
} from '@/lib/calculations/cables';
import { isThreePhaseForItem } from '@/lib/calculations/feeders';
import { phaseBalance } from '@/lib/calculations/phaseBalance';
import MethodSelector from '@/components/MethodSelector';
import { useTranslation } from '@/i18n';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Cable, RefreshCw, AlertTriangle, Check, Settings, SlidersHorizontal, Save, HelpCircle, Layers } from 'lucide-react';
import type { Project } from '@/types';
import WorkflowStepper from '@/components/layout/WorkflowStepper';

interface CableEntry {
  id: string;
  name: string;
  cableName: string;
  building: string;
  floor: number;
  length: number;
  cableSize: number;
  parallelRuns: number;
  formattedSize: string;
  current: number;
  isThreePhase: boolean;
  assignedPhase: number | null;
  phaseCurrent: [number, number, number];
  neutralCurrent: number;
  unbalancePct: number;
  imbalanced: boolean;
  newCableSize: number | null;
  newParallelRuns: number;
  newFormattedSize: string;
  newVD: number | null;
  changed: boolean;
  method: string;
  insulation: 'PVC' | 'XLPE';
  material: 'copper' | 'aluminum';
  ambientTemp: number;
  groupingCount: number;
  ampacity: number;
  singleAmpacity: number;
  isOverloaded: boolean;
  kind: 'floor' | 'building' | 'sdb';
}

export default function CableSchedulePage() {
  const { selectedProjectId, selectedProject, loading: contextLoading, refreshProject } = useProject();
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(selectedProject);
  const [loading, setLoading] = useState(!selectedProject);
  const [cables, setCables] = useState<CableEntry[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPhaseDetails, setShowPhaseDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [defaultMaxCableSize, setDefaultMaxCableSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('procal-default-max-cable-size');
      if (saved) return parseInt(saved, 10) || 300;
    }
    return 300;
  });
  const [defaultMethod, setDefaultMethod] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('procal-default-method') || 'C';
    return 'C';
  });
  const [defaultInsulation, setDefaultInsulation] = useState<'PVC' | 'XLPE'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('procal-default-insulation') as 'PVC' | 'XLPE') || 'XLPE';
    return 'XLPE';
  });
  const [defaultMaterial, setDefaultMaterial] = useState<'copper' | 'aluminum'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('procal-default-material') as 'copper' | 'aluminum') || 'copper';
    return 'copper';
  });
  const [defaultAmbientTemp, setDefaultAmbientTemp] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('procal-default-ambient-temp');
      if (saved) return parseFloat(saved) || 30;
    }
    return 30;
  });
  const [defaultGroupingCount, setDefaultGroupingCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('procal-default-grouping-count');
      if (saved) return parseInt(saved) || 1;
    }
    return 1;
  });
  const [showNavDialog, setShowNavDialog] = useState(false);
  const pendingNavigation = useRef<string | null>(null);

  // Derive unsaved changes from cables state
  const hasUnsavedChanges = cables.some(c => c.changed);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept sidebar/navigation clicks
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href]');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href && href !== pathname && !href.startsWith('#')) {
        e.preventDefault();
        e.stopPropagation();
        pendingNavigation.current = href;
        setShowNavDialog(true);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges, pathname]);

  // Sync with context project to avoid duplicate network calls
  useEffect(() => {
    if (selectedProject && selectedProject.id === selectedProjectId) {
      setProject(selectedProject);
      // If a specific building was selected that doesn't exist in the project, reset to all buildings (null)
      if (selectedBuilding && !selectedProject.buildings.some(b => b.id === selectedBuilding)) {
        setSelectedBuilding(null);
      }
      setLoading(false);
    }
  }, [selectedProject, selectedProjectId, selectedBuilding]);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await refreshProject();
      // The context now holds the fresh project; the sync effect above copies
      // it (and validates the selected building) into local state.
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedProjectId, refreshProject]);

  useEffect(() => {
    if (!selectedProject || selectedProject.id !== selectedProjectId) {
      loadProject();
    }
  }, [loadProject, selectedProject, selectedProjectId]);

  useEffect(() => {
    if (!project) return;

    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    // Build cable schedule from project data with pre-calculated VD
    const cableList: CableEntry[] = [];
    for (const bldg of project.buildings) {
      if (selectedBuilding && bldg.id !== selectedBuilding) continue;
      for (const fd of bldg.floorDesigns) {
        const balance = phaseBalance(fd.items as any, project as any);
        const phaseById = new Map(balance.assignments.map((a) => [a.id, a.assignedPhase]));
        fd.items.forEach((item, idx) => {
          const letter = String.fromCharCode(97 + idx);
          const loadTag = `F${fd.floorNumber}-${letter.toUpperCase()}`;
          const cableTag = `Wf${fd.floorNumber}${letter}`;
          const parsed = parseCableSize(item.cableSize);
          const cableSizeNum = parsed?.size ?? 4;
          const runs = parsed?.runs ?? 1;
          const formattedSize = parsed?.formatted ?? `${cableSizeNum} mm²`;
          const isThreePhase = isThreePhaseForItem(item);
          const length = getItemCableLength(item, fd.floorNumber);
          const method = (item as any).installMethod || defaultMethod;
          const insulation = (item as any).cableInsulation || defaultInsulation;
          const material = (item as any).cableMaterial || defaultMaterial;
          const ambientTemp = (item as any).ambientTemp ?? project.ambientTemp ?? defaultAmbientTemp;
          const groupingCount = (item as any).groupingCount ?? project.groupingCount ?? defaultGroupingCount;
          const rawPhase = (item as any).assignedPhase ?? null;
          const resolvedPhase = rawPhase ?? phaseById.get(item.id) ?? 1;
          const phaseCurrent: [number, number, number] = isThreePhase
            ? [item.calculatedCurrent, item.calculatedCurrent, item.calculatedCurrent]
            : [0, 0, 0];
          if (!isThreePhase && resolvedPhase >= 1 && resolvedPhase <= 3) {
            phaseCurrent[resolvedPhase - 1] = item.calculatedCurrent;
          }

          const result = recalculateCable({
            current: item.calculatedCurrent,
            isThreePhase,
            lengthMeters: length,
            existingCableSize: cableSizeNum,
            existingRuns: runs,
            powerFactor: project.powerFactor || 0.85,
            systemVoltage: project.voltage === 400 ? 400 : 230,
            maxVoltageDropPercent: limits.power,
            method,
            insulation,
            material,
            ambientTemp,
            groupingCount,
            maxCableSize: defaultMaxCableSize,
          });

          cableList.push({
            id: item.id || `${fd.floorNumber}-${item.name}`,
            name: loadTag,
            cableName: cableTag,
            building: bldg.name,
            floor: fd.floorNumber,
            length,
            cableSize: cableSizeNum,
            parallelRuns: runs,
            formattedSize,
            current: item.calculatedCurrent,
            isThreePhase,
            assignedPhase: resolvedPhase,
            phaseCurrent,
            neutralCurrent: isThreePhase ? 0 : item.calculatedCurrent,
            unbalancePct: isThreePhase ? 0 : 100,
            imbalanced: false,
            newCableSize: result.cableSize,
            newParallelRuns: result.parallelRuns,
            newFormattedSize: result.formattedCableSize,
            newVD: result.voltageDropPercent,
            changed: result.changed,
            method,
            insulation,
            material,
            ambientTemp,
            groupingCount,
            ampacity: result.ampacity,
            singleAmpacity: result.singleAmpacity,
            isOverloaded: result.isOverloaded,
            kind: 'floor',
          });
        });
      }

      // Building loads (elevator, pumps, AC, fire pump) — attached from the load library.
      const blBalance = phaseBalance((bldg.buildingLoads || []) as any, project as any);
      const blPhaseById = new Map(blBalance.assignments.map((a) => [a.id, a.assignedPhase]));
      (bldg.buildingLoads || []).forEach((bl, idx) => {
        const lib = bl.loadLibraryItem;
        if (!lib) return; // orphaned (library item deleted) — skip
        const letter = String.fromCharCode(97 + idx);
        const loadTag = `BL-${letter.toUpperCase()} ${lib.name}`;
        const cableTag = `Wbl${letter}`;
        const parsed = parseCableSize(bl.cableSize);
        const cableSizeNum = parsed?.size ?? 4;
        const runs = parsed?.runs ?? 1;
        const formattedSize = parsed?.formatted ?? `${cableSizeNum} mm²`;
        const isThreePhase = lib.phase === 3;
        const totalKw = lib.power * bl.quantity;
        const current = isThreePhase
          ? totalKw / (Math.sqrt(3) * (lib.voltage / 1000) * lib.powerFactor)
          : totalKw / ((lib.voltage / 1000) * lib.powerFactor);
        const length = getBuildingLoadCableLength(bl);
        const method = bl.installMethod || defaultMethod;
        const insulation = (bl.cableInsulation as 'PVC' | 'XLPE') || defaultInsulation;
        const material = (bl.cableMaterial as 'copper' | 'aluminum') || defaultMaterial;
        const ambientTemp = bl.ambientTemp ?? project.ambientTemp ?? defaultAmbientTemp;
        const groupingCount = bl.groupingCount ?? project.groupingCount ?? defaultGroupingCount;
        const rawPhase = (bl as any).assignedPhase ?? null;
        const resolvedPhase = rawPhase ?? blPhaseById.get(bl.id) ?? 1;
        const phaseCurrent: [number, number, number] = isThreePhase
          ? [current, current, current]
          : [0, 0, 0];
        if (!isThreePhase && resolvedPhase >= 1 && resolvedPhase <= 3) {
          phaseCurrent[resolvedPhase - 1] = current;
        }

        const result = recalculateCable({
          current,
          isThreePhase,
          lengthMeters: length,
          existingCableSize: cableSizeNum,
          existingRuns: runs,
          powerFactor: project.powerFactor || 0.85,
          systemVoltage: project.voltage === 400 ? 400 : 230,
          maxVoltageDropPercent: limits.power,
          method,
          insulation,
          material,
          ambientTemp,
          groupingCount,
          maxCableSize: defaultMaxCableSize,
        });

        cableList.push({
          id: bl.id,
          name: loadTag,
          cableName: cableTag,
          building: bldg.name,
          floor: 0,
          length,
          cableSize: cableSizeNum,
          parallelRuns: runs,
          formattedSize,
          current,
          isThreePhase,
          assignedPhase: resolvedPhase,
          phaseCurrent,
          neutralCurrent: isThreePhase ? 0 : current,
          unbalancePct: isThreePhase ? 0 : 100,
          imbalanced: false,
          newCableSize: result.cableSize,
          newParallelRuns: result.parallelRuns,
          newFormattedSize: result.formattedCableSize,
          newVD: result.voltageDropPercent,
          changed: result.changed,
          method,
          insulation,
          material,
          ambientTemp,
          groupingCount,
          ampacity: result.ampacity,
          singleAmpacity: result.singleAmpacity,
          isOverloaded: result.isOverloaded,
          kind: 'building',
        });
      });

      // SDBs (Sub-Distribution Boards) for floors with hasFloorSubPanels=true
      for (const fd of bldg.floorDesigns) {
        if (!fd.hasFloorSubPanels) continue;
        const floorDemand = fd.items.reduce((s, item) => s + item.calculatedMaxDemand, 0);
        const floorCurrent = floorDemand / (Math.sqrt(3) * (project.voltage / 1000) * project.powerFactor);
        const parsed = parseCableSize(fd.riserCableSize);
        const cableSizeNum = parsed?.size ?? 120;
        const runs = parsed?.runs ?? 1;
        const formattedSize = parsed?.formatted ?? `${cableSizeNum} mm²`;
        const length = getRiserCableLength(fd);
        const sdbMethod = fd.riserInstallMethod || defaultMethod;
        const sdbInsulation = (fd.riserCableInsulation as 'PVC' | 'XLPE') || defaultInsulation;
        const sdbMaterial = (fd.riserCableMaterial as 'copper' | 'aluminum') || defaultMaterial;
        const ambientTemp = fd.riserAmbientTemp ?? project.ambientTemp ?? defaultAmbientTemp;
        const groupingCount = fd.riserGroupingCount ?? project.groupingCount ?? defaultGroupingCount;

        const result = recalculateCable({
          current: floorCurrent,
          isThreePhase: true,
          lengthMeters: length,
          existingCableSize: cableSizeNum,
          existingRuns: runs,
          powerFactor: project.powerFactor || 0.85,
          systemVoltage: project.voltage === 400 ? 400 : 230,
          maxVoltageDropPercent: limits.power,
          method: sdbMethod,
          insulation: sdbInsulation,
          material: sdbMaterial,
          ambientTemp,
          groupingCount,
          maxCableSize: defaultMaxCableSize,
        });

        cableList.push({
          id: `sdb-${fd.id}`,
          name: `SDB-${fd.floorNumber}`,
          cableName: `Wsdb${fd.floorNumber}`,
          building: bldg.name,
          floor: fd.floorNumber,
          length,
          cableSize: cableSizeNum,
          parallelRuns: runs,
          formattedSize,
          current: floorCurrent,
          isThreePhase: true,
          assignedPhase: null,
          phaseCurrent: [floorCurrent, floorCurrent, floorCurrent],
          neutralCurrent: 0,
          unbalancePct: 0,
          imbalanced: false,
          newCableSize: result.cableSize,
          newParallelRuns: result.parallelRuns,
          newFormattedSize: result.formattedCableSize,
          newVD: result.voltageDropPercent,
          changed: result.changed,
          method: sdbMethod,
          insulation: sdbInsulation,
          material: sdbMaterial,
          ambientTemp,
          groupingCount,
          ampacity: result.ampacity,
          singleAmpacity: result.singleAmpacity,
          isOverloaded: result.isOverloaded,
          kind: 'sdb',
        });
      }
    }
    setCables(cableList);
  }, [project, selectedBuilding, defaultAmbientTemp, defaultGroupingCount, defaultInsulation, defaultMaterial, defaultMethod, defaultMaxCableSize]);

  const updateCableField = (id: string, field: string, value: any) => {
    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    setCables(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newLength = field === 'length' ? value : c.length;
      const newMethod = field === 'method' ? value : c.method;
      const newInsulation = field === 'insulation' ? value : c.insulation;
      const newMaterial = field === 'material' ? value : c.material;
      const newAmbientTemp = field === 'ambientTemp' ? value : c.ambientTemp;
      const newGroupingCount = field === 'groupingCount' ? value : c.groupingCount;
      const targetRuns = field === 'runs' ? parseInt(value, 10) || 1 : undefined;

      const result = recalculateCable({
        current: c.current,
        isThreePhase: c.isThreePhase,
        lengthMeters: newLength,
        existingCableSize: c.cableSize,
        existingRuns: targetRuns ?? c.parallelRuns,
        powerFactor: project?.powerFactor || 0.85,
        systemVoltage: project?.voltage === 400 ? 400 : 230,
        maxVoltageDropPercent: limits.power,
        method: newMethod,
        insulation: newInsulation,
        material: newMaterial,
        ambientTemp: newAmbientTemp,
        groupingCount: newGroupingCount,
        maxCableSize: defaultMaxCableSize,
        targetRuns,
      });

      // Persist to database
      if (field === 'runs') {
        const url = cablePatchUrl(c.kind, id);
        const targetSizeToSave = result.formattedCableSize;
        fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(upsizeBody(targetSizeToSave, c.kind)),
        }).catch(err => console.error('Failed to save runs:', err));
      } else {
        fetch(cablePatchUrl(c.kind, id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fieldEditBody(c.kind, field as any, value)),
        }).catch(err => console.error('Failed to save:', err));
      }

      if (field === 'runs') {
        return {
          ...c,
          cableSize: result.cableSize,
          parallelRuns: result.parallelRuns,
          formattedSize: result.formattedCableSize,
          length: newLength,
          method: newMethod,
          insulation: newInsulation,
          material: newMaterial,
          ambientTemp: newAmbientTemp,
          groupingCount: newGroupingCount,
          newCableSize: result.cableSize,
          newParallelRuns: result.parallelRuns,
          newFormattedSize: result.formattedCableSize,
          newVD: result.voltageDropPercent,
          changed: false,
          ampacity: result.ampacity,
          singleAmpacity: result.singleAmpacity,
          isOverloaded: result.isOverloaded,
        };
      }

      return {
        ...c,
        length: newLength,
        method: newMethod,
        insulation: newInsulation,
        material: newMaterial,
        ambientTemp: newAmbientTemp,
        groupingCount: newGroupingCount,
        newCableSize: result.cableSize,
        newParallelRuns: result.parallelRuns,
        newFormattedSize: result.formattedCableSize,
        newVD: result.voltageDropPercent,
        changed: result.changed,
        ampacity: result.ampacity,
        singleAmpacity: result.singleAmpacity,
        isOverloaded: result.isOverloaded,
      };
    }));
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
        existingRuns: c.parallelRuns,
        powerFactor: project?.powerFactor || 0.85,
        systemVoltage: project?.voltage === 400 ? 400 : 230,
        maxVoltageDropPercent: limits.power,
        method: c.method,
        insulation: c.insulation,
        material: c.material,
        ambientTemp: c.ambientTemp,
        groupingCount: c.groupingCount,
        maxCableSize: defaultMaxCableSize,
      });
      return {
        ...c,
        newCableSize: result.cableSize,
        newParallelRuns: result.parallelRuns,
        newFormattedSize: result.formattedCableSize,
        newVD: result.voltageDropPercent,
        changed: result.changed,
        ampacity: result.ampacity,
        singleAmpacity: result.singleAmpacity,
        isOverloaded: result.isOverloaded,
      };
    }));
  };

  const applyChanges = async () => {
    setSaving(true);
    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };
    const changedCables = cables.filter(c => c.changed && (c.newFormattedSize || c.newCableSize !== null));

    try {
      const results = await Promise.all(changedCables.map(async (c) => {
        const url = cablePatchUrl(c.kind, c.id);
        const targetSizeToSave = c.newFormattedSize || `${c.newCableSize} mm²`;
        const body = upsizeBody(targetSizeToSave, c.kind);
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) console.error('Apply upsize failed:', url, res.status, body);
        return res.ok ? c.id : null;
      }));
      const savedIds = new Set(results.filter((r): r is string => r !== null));

      if (savedIds.size < changedCables.length) {
        alert(`Saved ${savedIds.size} of ${changedCables.length} cable upsize${changedCables.length > 1 ? 's' : ''}. See console for failures.`);
      }

      setCables(prev => prev.map(c => {
        if (savedIds.has(c.id) && (c.newFormattedSize || c.newCableSize !== null)) {
          const newSize = c.newCableSize ?? c.cableSize;
          const newRuns = c.newParallelRuns ?? c.parallelRuns;
          const newFormatted = c.newFormattedSize || formatCableSize(newSize, newRuns);

          const result = recalculateCable({
            current: c.current,
            isThreePhase: c.isThreePhase,
            lengthMeters: c.length,
            existingCableSize: newSize,
            existingRuns: newRuns,
            powerFactor: project?.powerFactor || 0.85,
            systemVoltage: project?.voltage === 400 ? 400 : 230,
            maxVoltageDropPercent: limits.power,
            method: c.method,
            insulation: c.insulation,
            material: c.material,
            ambientTemp: c.ambientTemp,
            groupingCount: c.groupingCount,
            maxCableSize: defaultMaxCableSize,
          });
          return {
            ...c,
            cableSize: newSize,
            parallelRuns: newRuns,
            formattedSize: newFormatted,
            newCableSize: result.cableSize,
            newParallelRuns: result.parallelRuns,
            newFormattedSize: result.formattedCableSize,
            newVD: result.voltageDropPercent,
            changed: result.changed,
            ampacity: result.ampacity,
            singleAmpacity: result.singleAmpacity,
            isOverloaded: result.isOverloaded,
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Failed to apply changes:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setShowNavDialog(false);
    if (pendingNavigation.current) {
      router.push(pendingNavigation.current);
      pendingNavigation.current = null;
    }
  };

  const handleSaveAndNavigate = async () => {
    await applyChanges();
    setShowNavDialog(false);
    if (pendingNavigation.current) {
      router.push(pendingNavigation.current);
      pendingNavigation.current = null;
    }
  };

  const applyDefaultsToAll = async () => {
    setApplyingDefaults(true);
    const savedLimits = localStorage.getItem('procal-vd-limits');
    const limits = savedLimits ? JSON.parse(savedLimits) : { lighting: 3, power: 5 };

    try {
      await Promise.all(cables.map(c => {
        const url = cablePatchUrl(c.kind, c.id);
        const body = c.kind === 'sdb'
          ? {
              riserInstallMethod: defaultMethod,
              riserCableInsulation: defaultInsulation,
              riserCableMaterial: defaultMaterial,
              riserAmbientTemp: defaultAmbientTemp,
              riserGroupingCount: defaultGroupingCount,
            }
          : {
              installMethod: defaultMethod,
              cableInsulation: defaultInsulation,
              cableMaterial: defaultMaterial,
              ambientTemp: defaultAmbientTemp,
              groupingCount: defaultGroupingCount,
            };
        return fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }));

      setCables(prev => prev.map(c => {
        const result = recalculateCable({
          current: c.current,
          isThreePhase: c.isThreePhase,
          lengthMeters: c.length,
          existingCableSize: c.cableSize,
          existingRuns: c.parallelRuns,
          powerFactor: project?.powerFactor || 0.85,
          systemVoltage: project?.voltage === 400 ? 400 : 230,
          maxVoltageDropPercent: limits.power,
          method: defaultMethod,
          insulation: defaultInsulation,
          material: defaultMaterial,
          ambientTemp: defaultAmbientTemp,
          groupingCount: defaultGroupingCount,
          maxCableSize: defaultMaxCableSize,
        });
        return {
          ...c,
          method: defaultMethod,
          insulation: defaultInsulation,
          material: defaultMaterial,
          ambientTemp: defaultAmbientTemp,
          groupingCount: defaultGroupingCount,
          newCableSize: result.cableSize,
          newParallelRuns: result.parallelRuns,
          newFormattedSize: result.formattedCableSize,
          newVD: result.voltageDropPercent,
          changed: result.changed,
          ampacity: result.ampacity,
          singleAmpacity: result.singleAmpacity,
          isOverloaded: result.isOverloaded,
        };
      }));
    } catch (err) {
      console.error('Failed to apply defaults:', err);
    } finally {
      setApplyingDefaults(false);
    }
  };

  const handleLeaveConfirm = () => {
    setShowNavDialog(false);
    if (pendingNavigation.current) {
      router.push(pendingNavigation.current);
    }
  };

  const cablesNeedingUpsize = cables.filter(c => c.changed);

  const cablesByFloor = cables.reduce((acc, cable) => {
    let key: string;
    const subKey = cable.kind === 'building' ? 'Building Loads' : cable.kind === 'sdb' ? 'SDBs' : `Floor ${cable.floor}`;
    if (!selectedBuilding && (project?.buildings.length ?? 0) > 1) {
      key = `${cable.building} — ${subKey}`;
    } else {
      key = subKey;
    }
    if (!acc[key]) acc[key] = [];
    acc[key].push(cable);
    return acc;
  }, {} as Record<string, CableEntry[]>);

  const floorKeys = Object.keys(cablesByFloor).sort((a, b) => {
    if (!selectedBuilding && (project?.buildings.length ?? 0) > 1) {
      const [bldgA, subA] = a.split(' — ');
      const [bldgB, subB] = b.split(' — ');
      if (bldgA !== bldgB) {
        const idxA = project?.buildings.findIndex((b) => b.name === bldgA) ?? -1;
        const idxB = project?.buildings.findIndex((b) => b.name === bldgB) ?? -1;
        return idxA - idxB;
      }
      if (subA === 'Building Loads') return -1;
      if (subB === 'Building Loads') return 1;
      if (subA === 'SDBs') return -1;
      if (subB === 'SDBs') return 1;
      const numA = parseInt(subA?.replace('Floor ', '') || '0', 10);
      const numB = parseInt(subB?.replace('Floor ', '') || '0', 10);
      return numA - numB;
    }

    if (a === 'Building Loads') return -1;
    if (b === 'Building Loads') return 1;
    if (a === 'SDBs') return -1;
    if (b === 'SDBs') return 1;
    return parseInt(a.replace('Floor ', ''), 10) - parseInt(b.replace('Floor ', ''), 10);
  });

  return (
    <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh]">
      {/* Workflow Stepper: Step 4 */}
      <WorkflowStepper currentStep={4} />

      {/* Unsaved Changes Banner */}
      {cablesNeedingUpsize.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-yellow-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-300">
                {cablesNeedingUpsize.length} {t('cableSchedule.warningNeedUpsize', 'cables need upsize')}
              </p>
              <p className="text-xs text-yellow-400/70">
                {t('cableSchedule.clickApply', 'Click "Apply" to save the new cable sizes to the database')}
              </p>
            </div>
          </div>
          <button
            onClick={applyChanges}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-xs font-bold disabled:opacity-50 transition-all"
          >
            <Save size={13} />
            {saving ? t('common.saving', 'Saving…') : t('cableSchedule.apply', 'Apply')}
          </button>
        </div>
      )}

      {/* Header */}
      <div data-tour="cable-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
              <Cable className="text-orange-400" />
              {t('cableSchedule.title', 'Cable Schedule')}
            </h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {project ? `${project.name} — ` : ''}{t('cableSchedule.subtitle', 'Cable lengths & voltage drop calculator')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowPhaseDetails(!showPhaseDetails)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              showPhaseDetails
                ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 font-semibold'
                : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
            title="Toggle per-phase current columns (L1, L2, L3, Neutral)"
          >
            <Layers size={14} />
            {showPhaseDetails ? 'Compact Currents' : 'Phase Details'}
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('trigger-procal-cable-schedule-tour'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold transition-all"
            title="Start page interactive guide"
          >
            <HelpCircle size={14} />
            {t('tour.pageTour', 'Page Tour')}
          </button>
          <button
            data-tour="cable-derating"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-all"
          >
            <SlidersHorizontal size={14} />
            {t('cableSchedule.defaultSettings', 'Default Settings')}
          </button>
          <button
            data-tour="cable-recalc"
            onClick={recalculateAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw size={14} />
            {t('cableSchedule.recalculateAll', 'Recalculate All')}
          </button>
        </div>
      </div>

      {project ? (
        <>
      {/* Default Settings Drawer */}
      {showSettings && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/90 p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Max Size (mm²)
            </label>
            <select
              value={defaultMaxCableSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 300;
                setDefaultMaxCableSize(val);
                if (typeof window !== 'undefined') localStorage.setItem('procal-default-max-cable-size', String(val));
              }}
              className="dense-input w-full rounded text-xs py-1"
            >
              {[120, 150, 185, 240, 300, 400, 500].map((size) => (
                <option key={size} value={size}>{size} mm²</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              {t('cableSchedule.defaultMethod', 'Default Method')}
            </label>
            <MethodSelector
              value={defaultMethod}
              onChange={(method) => {
                setDefaultMethod(method);
                if (typeof window !== 'undefined') localStorage.setItem('procal-default-method', method);
              }}
              compact
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              {t('cableSchedule.defaultInsulation', 'Default Insulation')}
            </label>
            <select
              value={defaultInsulation}
              onChange={(e) => {
                const val = e.target.value as 'PVC' | 'XLPE';
                setDefaultInsulation(val);
                if (typeof window !== 'undefined') localStorage.setItem('procal-default-insulation', val);
              }}
              className="dense-input w-full rounded text-xs py-1"
            >
              <option value="XLPE">XLPE (90°C)</option>
              <option value="PVC">PVC (70°C)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              {t('cableSchedule.defaultMaterial', 'Default Material')}
            </label>
            <select
              value={defaultMaterial}
              onChange={(e) => {
                const val = e.target.value as 'copper' | 'aluminum';
                setDefaultMaterial(val);
                if (typeof window !== 'undefined') localStorage.setItem('procal-default-material', val);
              }}
              className="dense-input w-full rounded text-xs py-1"
            >
              <option value="copper">Copper</option>
              <option value="aluminum">Aluminum</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              {t('cableSchedule.ambientTemp', 'Ambient Temp (°C)')}
            </label>
            <select
              value={defaultAmbientTemp}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 30;
                setDefaultAmbientTemp(val);
                if (typeof window !== 'undefined') localStorage.setItem('procal-default-ambient-temp', String(val));
              }}
              className="dense-input w-full rounded text-xs py-1"
            >
              {[10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((temp) => (
                <option key={temp} value={temp}>{temp}°C</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              {t('cableSchedule.groupingCount', 'Grouping (cables)')}
            </label>
            <select
              value={defaultGroupingCount}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setDefaultGroupingCount(val);
                if (typeof window !== 'undefined') localStorage.setItem('procal-default-grouping-count', String(val));
              }}
              className="dense-input w-full rounded text-xs py-1"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16, 20].map((num) => (
                <option key={num} value={num}>{num} {num === 1 ? 'cable' : 'cables'}</option>
              ))}
            </select>
          </div>

          <button
            onClick={applyDefaultsToAll}
            disabled={applyingDefaults}
            className="w-full py-1.5 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {applyingDefaults ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                {t('common.applying', 'Applying…')}
              </>
            ) : (
              t('cableSchedule.apply', 'Apply to All Cables')
            )}
          </button>
        </div>
      )}

      {/* Building Selector */}
      {project.buildings.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSelectedBuilding(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedBuilding === null ? 'bg-orange-500 text-slate-950 font-bold shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
            {t('cableSchedule.allBuildings', 'All Buildings')}
          </button>
          {project.buildings.map((b) => (
            <button key={b.id} onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedBuilding === b.id ? 'bg-orange-500 text-slate-950 font-bold shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{t('cableSchedule.totalCables', 'TOTAL CABLES')}</p>
          <p className="text-xl font-bold text-white">{cables.length}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{t('cableSchedule.totalLength', 'TOTAL LENGTH')}</p>
          <p className="text-xl font-bold text-white">{cables.reduce((sum, c) => sum + c.length, 0).toFixed(0)}m</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{t('cableSchedule.needUpsize', 'NEED UPSIZE')}</p>
          <p className="text-xl font-bold text-yellow-400">{cables.filter(c => c.changed).length}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{t('cableSchedule.compliant', 'COMPLIANT')}</p>
          <p className="text-xl font-bold text-green-400">
            {cables.filter(c => c.newVD !== null && !c.changed).length}/{cables.filter(c => c.newVD !== null).length || '—'}
          </p>
        </div>
      </div>

      {/* Cable Schedule Table - Grouped by Floor */}
      <div data-tour="cable-table" className="space-y-6">
        {floorKeys.map(key => {
          const groupCables = cablesByFloor[key];
          const displayKey = key === 'Building Loads' ? t('cableSchedule.buildingLoads', 'Building Loads') : key;
          return (
          <div key={key} className="rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
                <span className="text-sm font-bold text-slate-100 tracking-wide">{displayKey}</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/50">
                  {groupCables.length} {t('cableSchedule.circuits', 'circuits')}
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="cable-schedule-table">
                <thead>
                  <tr>
                    <th className="text-start">{t('cableSchedule.load', 'CIRCUIT & TAG')}</th>
                    {showPhaseDetails && (
                      <>
                        <th className="text-end">{t('cableSchedule.l1', 'L1 (A)')}</th>
                        <th className="text-end">{t('cableSchedule.l2', 'L2 (A)')}</th>
                        <th className="text-end">{t('cableSchedule.l3', 'L3 (A)')}</th>
                        <th className="text-end">{t('cableSchedule.neutral', 'N (A)')}</th>
                      </>
                    )}
                    <th className="text-end">{t('cableSchedule.current', 'LOAD (A)')}</th>
                    <th className="text-center">{t('cableSchedule.runs', 'RUNS')}</th>
                    <th className="text-center">{t('cableSchedule.size', 'SIZE')}</th>
                    <th className="text-center">{t('cableSchedule.method', 'METHOD')}</th>
                    <th className="text-center">{t('cableSchedule.insulation', 'INS')}</th>
                    <th className="text-center">{t('cableSchedule.material', 'MAT')}</th>
                    <th className="text-center">{t('cableSchedule.ambientTemp', 'TEMP')}</th>
                    <th className="text-center">{t('cableSchedule.groupingCount', 'GRP')}</th>
                    <th className="text-center">{t('cableSchedule.ampacity', 'AMPACITY (Iz)')}</th>
                    <th className="text-end">{t('cableSchedule.length', 'LENGTH')}</th>
                    <th className="text-center">{t('cableSchedule.newCable', 'NEW CABLE')}</th>
                    <th className="text-center">{t('cableSchedule.vd', 'V.DROP')}</th>
                    <th className="text-center">{t('cableSchedule.status', 'STATUS')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {groupCables.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Circuit Name & Tag combined */}
                      <td className="text-start">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100 text-xs">{c.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-800/70 border border-slate-700/50 px-1.5 py-0.2 rounded">
                              {c.cableName}
                            </span>
                            {!selectedBuilding && (
                              <span className="text-[10px] text-slate-500 font-medium">{c.building}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {showPhaseDetails && (
                        <>
                          <td className="text-end font-mono text-orange-400">{c.phaseCurrent[0].toFixed(1)}</td>
                          <td className="text-end font-mono text-orange-400">{c.phaseCurrent[1].toFixed(1)}</td>
                          <td className="text-end font-mono text-orange-400">{c.phaseCurrent[2].toFixed(1)}</td>
                          <td className="text-end font-mono text-yellow-400">{c.neutralCurrent.toFixed(1)}</td>
                        </>
                      )}

                      {/* Load Current */}
                      <td className="text-end font-mono">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            c.isThreePhase ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`} title={c.isThreePhase ? '3-Phase Balanced' : `Single Phase on L${c.assignedPhase || 1}`}>
                            {c.isThreePhase ? '3Ø' : `L${c.assignedPhase || 1}`}
                          </span>
                          <span className="font-bold text-slate-100 text-xs">{c.current.toFixed(1)}A</span>
                        </div>
                      </td>

                      {/* Runs */}
                      <td className="text-center">
                        <select
                          value={c.parallelRuns || 1}
                          onChange={(e) => updateCableField(c.id, 'runs', parseInt(e.target.value, 10) || 1)}
                          className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-md px-2 py-1 text-xs text-white font-mono font-bold transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                          title="Runs per phase"
                        >
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <option key={num} value={num}>{num}x</option>
                          ))}
                        </select>
                      </td>

                      {/* Size */}
                      <td className="text-center font-mono font-bold text-emerald-400 whitespace-nowrap text-xs">
                        {c.formattedSize || `${c.cableSize} mm²`}
                      </td>

                      {/* Method */}
                      <td className="text-center">
                        <MethodSelector
                          value={c.method}
                          onChange={(method) => updateCableField(c.id, 'method', method)}
                          compact
                        />
                      </td>

                      {/* Insulation */}
                      <td className="text-center">
                        <select
                          value={c.insulation}
                          onChange={(e) => updateCableField(c.id, 'insulation', e.target.value)}
                          className="bg-slate-800/90 border border-slate-700 hover:border-slate-600 rounded-md px-1.5 py-1 text-[11px] text-slate-200 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          <option value="XLPE">XLPE</option>
                          <option value="PVC">PVC</option>
                        </select>
                      </td>

                      {/* Material */}
                      <td className="text-center">
                        <select
                          value={c.material}
                          onChange={(e) => updateCableField(c.id, 'material', e.target.value)}
                          className="bg-slate-800/90 border border-slate-700 hover:border-slate-600 rounded-md px-1.5 py-1 text-[11px] text-slate-200 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                          title="Copper or aluminum conductor"
                        >
                          <option value="copper">Cu</option>
                          <option value="aluminum">Al</option>
                        </select>
                      </td>

                      {/* Temp */}
                      <td className="text-center">
                        <select
                          value={c.ambientTemp}
                          onChange={(e) => updateCableField(c.id, 'ambientTemp', parseFloat(e.target.value) || 30)}
                          className="bg-slate-800/90 border border-slate-700 hover:border-slate-600 rounded-md px-1.5 py-1 text-[11px] text-slate-200 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          {[10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((temp) => (
                            <option key={temp} value={temp}>{temp}°</option>
                          ))}
                        </select>
                      </td>

                      {/* Grouping */}
                      <td className="text-center">
                        <select
                          value={c.groupingCount}
                          onChange={(e) => updateCableField(c.id, 'groupingCount', parseInt(e.target.value) || 1)}
                          className="bg-slate-800/90 border border-slate-700 hover:border-slate-600 rounded-md px-1.5 py-1 text-[11px] text-slate-200 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16, 20].map((num) => (
                            <option key={num} value={num}>{num}x</option>
                          ))}
                        </select>
                      </td>

                      {/* Ampacity */}
                      <td className="text-center font-mono">
                        <div className="flex flex-col items-center justify-center">
                          <span className={`font-bold text-xs ${c.isOverloaded || c.ampacity < c.current ? 'text-rose-400' : 'text-sky-400'}`}
                            title={c.isOverloaded ? `Overloaded! Installed Ampacity (${c.ampacity}A) < Current (${c.current.toFixed(1)}A)` : `Continuous derated ampacity across ${c.parallelRuns || 1} run(s)`}
                          >
                            {c.ampacity}A
                          </span>
                          {c.parallelRuns > 1 && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({c.parallelRuns}×{c.singleAmpacity}A)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Length */}
                      <td className="text-end">
                        <div className="inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700/80 rounded-md px-2 py-0.5">
                          <input
                            type="number"
                            value={c.length}
                            onChange={(e) => updateCableField(c.id, 'length', parseFloat(e.target.value) || (10 + (c.floor - 1) * 5))}
                            className="w-12 bg-transparent text-end text-xs font-mono font-medium text-slate-100 focus:outline-none"
                            min="1"
                          />
                          <span className="text-[10px] text-slate-400 font-medium select-none">m</span>
                        </div>
                      </td>

                      {/* New Cable Proposal */}
                      <td className={`text-center font-mono font-bold whitespace-nowrap text-xs ${c.changed ? 'text-amber-400' : 'text-slate-600'}`}>
                        {c.changed ? (c.newFormattedSize || (c.newCableSize !== null ? `${c.newCableSize} mm²` : '—')) : '—'}
                      </td>

                      {/* Voltage Drop */}
                      <td className="text-center font-mono text-xs">
                        {c.newVD !== null ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded font-semibold ${
                            c.newVD > 5
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : c.newVD > 3
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'text-slate-300'
                          }`}>
                            {c.newVD.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="text-center">
                        {c.isOverloaded || c.ampacity < c.current ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-[11px] shadow-sm" title={`Ampacity ${c.ampacity}A < Current ${c.current.toFixed(1)}A`}>
                            <AlertTriangle size={12} /> OVERLOAD
                          </span>
                        ) : c.changed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-[11px] shadow-sm">
                            <AlertTriangle size={12} /> {t('cableSchedule.upsize', 'UP')}
                          </span>
                        ) : c.newVD !== null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium text-[11px]">
                            <Check size={12} /> {t('cableSchedule.ok', 'OK')}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="text-[10px] text-gray-600 space-y-1">
        <p>• {t('cableSchedule.legend1', 'VD ≤ 3%: Ideal for Lighting & General circuits')}</p>
        <p>• {t('cableSchedule.legend2', 'VD ≤ 5%: Compliant with standard (IEC 60364-5-52 / BS 7671)')}</p>
        <p>• {t('cableSchedule.legend3', 'VD > 5%: Non-compliant — cable needs upsize')}</p>
      </div>

      {/* Unsaved Changes Dialog */}
      {showNavDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-96 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t('cableSchedule.unsavedChanges', 'Unsaved Changes')}</h3>
                <p className="text-sm text-gray-400">{t('cableSchedule.unsavedUpsizesDesc', "You have cable upsizes that haven't been applied.")}</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">
              {t('cableSchedule.saveBeforeLeavingPrompt', 'Do you want to save the new cable sizes before leaving?')}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDiscard}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium"
              >
                {t('common.discard', 'Discard')}
              </button>
              <button
                onClick={handleSaveAndNavigate}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? t('common.saving', 'Saving…') : t('cableSchedule.saveAndLeave', 'Save & Leave')}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      ) : loading || contextLoading ? (
        <PageSkeleton titleWidth="w-56" rowCount={8} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <Cable size={40} className="text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">{t('common.selectProject', 'Select a project first.')}</p>
        </div>
      )}
    </div>
  );
}
