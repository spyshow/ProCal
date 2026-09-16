'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useProject } from '@/context/ProjectContext';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Sparkles,
  Zap,
  RotateCcw,
  Sliders,
  Layers,
  CheckCircle2,
  Activity,
  ArrowRight,
} from 'lucide-react';
import WorkflowStepper from '@/components/layout/WorkflowStepper';
import { AccessRestricted } from '@/components/AccessRestricted';
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner';
import { QAReviewDrawer } from '@/components/QAReviewDrawer';
import {
  generateCurvePoints,
  generateCableDamageCurve,
  verifyCoordination,
  recommendBreakerSettings,
  suggestAlternativeBreaker,
  resolveCatalogBreakerOrAlternative,
  type BreakerCurveSettings,
  type CoordinationResult,
  type CurvePoint,
  type BreakerAlternativeSuggestion,
} from '@/lib/calculations/selectivity';
import { computeFeeders, createFindBreaker, type EquipmentItem, type DefaultFamilies } from '@/lib/calculations/feeders';
import type { Project, PanelFeeder } from '@/types';

type SelectivityStatus = 'FULL' | 'PARTIAL' | 'NONE';

interface ProjectFeederItem extends PanelFeeder {
  id: string;
  buildingId: string;
  buildingName: string;
  floor: number;
}

export default function CoordinationPage() {
  const { t } = useTranslation();
  const { selectedProjectId, selectedProject, loading: contextLoading, preferredManufacturer, refreshProject, canView, canEdit } = useProject();

  const [project, setProject] = useState<Project | null>(selectedProject);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [mode, setMode] = useState<'project' | 'playground'>('project');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFeederName, setSelectedFeederName] = useState<string>('');
  const [selectedFeederKey, setSelectedFeederKey] = useState<string>('');
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const [cableSize, setCableSize] = useState<number>(50);
  const [cableRuns, setCableRuns] = useState<number>(1);
  const [cableInsulation, setCableInsulation] = useState<'XLPE' | 'PVC'>('XLPE');
  const [cableMaterial, setCableMaterial] = useState<'copper' | 'aluminum'>('copper');

  const [defaults] = useState<DefaultFamilies>(() => ({
    ACB: selectedProject?.defaultAcbFamilyId ?? undefined,
    MCCB: selectedProject?.defaultMccbFamilyId ?? undefined,
    MCB: selectedProject?.defaultMcbFamilyId ?? undefined,
  }));
  const [breakerSettings, setBreakerSettings] = useState<any[]>([]);

  // Upstream breaker curve settings
  const [upstream, setUpstream] = useState<BreakerCurveSettings>({
    inRating: 630,
    ir: 500,
    tr: 12,
    isd: 2500,
    tsd: 0.3,
    i2t: false,
    ii: 5000,
    ig: 200,
    tg: 0.2,
    category: 'ACB',
    manufacturer: 'Schneider',
    model: 'MasterPact MTZ1 630A MicroLogic 5.0 X',
  });

  // Downstream breaker curve settings
  const [downstream, setDownstream] = useState<BreakerCurveSettings>({
    inRating: 160,
    ir: 128,
    tr: 12,
    isd: 640,
    tsd: 0.1,
    i2t: true,
    ii: 1280,
    ig: 50,
    tg: 0.1,
    category: 'MCCB',
    manufacturer: 'Schneider',
    model: 'ComPacT NSX160 160A MicroLogic 2.2',
  });

  const [faultCurrent, setFaultCurrent] = useState<number>(25000);
  const [upstreamFeederLabel, setUpstreamFeederLabel] = useState<string>('Main Incomer');
  const [downstreamFeederLabel, setDownstreamFeederLabel] = useState<string>('Downstream Feeder');

  // Load project if needed
  useEffect(() => {
    if (selectedProject && selectedProject.id === selectedProjectId) {
      setProject(selectedProject);
    }
  }, [selectedProject, selectedProjectId]);

  // Load equipment catalog
  const loadEquipment = useCallback(async () => {
    try {
      const res = await fetch(`/api/equipment?category=ACB,MCCB,MCB`);
      if (res.ok) {
        const data = await res.json();
        setEquipment(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadBreakerSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/breaker-settings?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        setBreakerSettings(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  useEffect(() => {
    loadBreakerSettings();
  }, [loadBreakerSettings]);

  const findBreaker = useMemo(
    () => createFindBreaker(equipment, defaults, project?.preferredManufacturer),
    [equipment, defaults, project?.preferredManufacturer]
  );

  const resolveBreakerDisplayName = (savedModel: string | undefined | null, feederModel: string | undefined | null): string => {
    const defaultModel = feederModel || 'Standard Circuit Breaker';
    if (!savedModel) return defaultModel;
    const trimmedSaved = savedModel.trim();
    if (/^(?:ACB|MCCB|MCB)\s+\d+A?$/i.test(trimmedSaved)) {
      return defaultModel;
    }
    const bareTripUnitMatch = trimmedSaved.match(/^(?:ACB|MCCB|MCB)\s+\d+A?\s+(.+)$/i);
    if (bareTripUnitMatch && feederModel) {
      const tripUnit = bareTripUnitMatch[1];
      if (/MicroLogic\s*[\d.]+\s*[a-zA-Z]*/i.test(feederModel)) {
        return feederModel.replace(/MicroLogic\s*[\d.]+\s*[a-zA-Z]*/i, tripUnit);
      }
      if (/Ekip\s*[\w\s]+/i.test(feederModel)) {
        return feederModel.replace(/Ekip\s*[\w\s]+/i, tripUnit);
      }
      return `${feederModel} ${tripUnit}`.trim();
    }
    return savedModel;
  };

  // Compute all real project feeders
  const allProjectFeeders = useMemo(() => {
    if (!project || project.buildings.length === 0) return [];
    const list: ProjectFeederItem[] = [];
    const usedKeys = new Set<string>();

    const getUniqueFeederId = (bldgId: string, f: PanelFeeder, suffix = '') => {
      const base = f.itemId
        ? `${bldgId}-item-${f.itemId}`
        : f.buildingLoadId
        ? `${bldgId}-bload-${f.buildingLoadId}`
        : f.type === 'SMDB'
        ? `${bldgId}-smdb-${f.floorDesignId || f.name}`
        : `${bldgId}-${f.name}${suffix ? `-${suffix}` : ''}`;
      let key = base;
      let counter = 1;
      while (usedKeys.has(key)) {
        counter++;
        key = `${base}__${counter}`;
      }
      usedKeys.add(key);
      return key;
    };

    const normalizeBreakerId = (id: string) => id.replace(/[–—]/g, '-').trim();

    const findSavedBreakerSetting = (f: PanelFeeder) => {
      const normName = normalizeBreakerId(f.name);
      return breakerSettings.find(
        (s) =>
          normalizeBreakerId(s.breakerId) === `${project.id}-${normName}` ||
          (f.itemId && s.breakerId === `${project.id}-${f.itemId}`) ||
          (f.buildingLoadId && s.breakerId === `${project.id}-${f.buildingLoadId}`) ||
          (f.itemId && s.breakerId === f.itemId) ||
          (f.buildingLoadId && s.breakerId === f.buildingLoadId) ||
          normalizeBreakerId(s.breakerId) === normName ||
          s.breakerId === f.name
      );
    };

    for (const bldg of project.buildings) {
      const { mdbFeeders, smdbFloorNumbers, smdbFeeders, mainIncomerSettings } = computeFeeders(bldg, project, findBreaker);

      for (const f of mdbFeeders) {
        const saved = findSavedBreakerSetting(f);
        const effectiveModel = resolveBreakerDisplayName(saved?.model, f.breakerModel);
        let effectiveStatus = f.selectivityStatus;
        let effectiveLimitKa = f.selectivityLimitKa;
        let effectiveReason = f.selectivityReason;
        let effectiveAlternativeSuggestions = f.alternativeSuggestions ?? [];
        let effectiveSuggestedAlternative = f.suggestedAlternative ?? null;

        if (saved) {
          const customDownstream: BreakerCurveSettings = {
            inRating: f.breakerSize,
            ir: saved.ir ?? f.current,
            tr: saved.tr ?? 12,
            isd: saved.isd ?? (f.breakerSize * 4),
            tsd: saved.tsd ?? 0.05,
            ii: saved.ii ?? (f.breakerSize * 10),
            category: f.type === 'SMDB' || f.type === 'SERVICE_PANEL' || f.type === 'PUMP_PANEL' || f.type === 'ELEVATOR_PANEL' ? 'MCCB' : (f.breakerSize <= 63 ? 'MCB' : 'MCCB'),
            manufacturer: saved.manufacturer ?? f.manufacturer ?? project.preferredManufacturer ?? 'Schneider',
            model: effectiveModel,
            isGeneric: false,
          };
          const reCoord = verifyCoordination(
            mainIncomerSettings,
            customDownstream,
            (f.faultCurrentKa || 15) * 1000,
            {
              cableSizeMm2: f.cableSize,
              cableMaterial: 'copper',
              cableInsulation: 'XLPE',
              cableRuns: f.parallelRuns,
              manufacturerPair: {
                upstreamMfg: mainIncomerSettings.manufacturer ?? 'Schneider',
                downstreamMfg: customDownstream.manufacturer ?? 'Schneider',
              },
            }
          );
          effectiveStatus = reCoord.status;
          effectiveLimitKa = reCoord.status === 'PARTIAL' && reCoord.limitCurrent ? reCoord.limitCurrent / 1000 : null;
          effectiveReason = reCoord.overlapDetails;

          if (effectiveStatus !== 'FULL') {
            effectiveAlternativeSuggestions = suggestAlternativeBreaker(
              mainIncomerSettings,
              customDownstream,
              (f.faultCurrentKa || 15) * 1000,
              {
                downstreamLoadCurrent: f.current,
                cableSizeMm2: f.cableSize,
                parentFeederName: f.parentFeederName,
                preferredManufacturer: project.preferredManufacturer,
                equipmentCatalog: equipment,
              }
            );
            effectiveSuggestedAlternative = effectiveAlternativeSuggestions[0]?.title ?? 'Resolve Coordination';
          } else {
            effectiveAlternativeSuggestions = [];
            effectiveSuggestedAlternative = null;
          }
        }

        if (effectiveStatus !== 'FULL') {
          if (!effectiveAlternativeSuggestions || effectiveAlternativeSuggestions.length === 0) {
            const downSettings: BreakerCurveSettings = {
              inRating: f.breakerSize,
              ir: f.current,
              tr: 12,
              isd: f.breakerSize * 4,
              tsd: 0.05,
              ii: f.breakerSize * 10,
              category: f.type === 'SMDB' || f.type === 'SERVICE_PANEL' || f.type === 'PUMP_PANEL' || f.type === 'ELEVATOR_PANEL' ? 'MCCB' : (f.breakerSize <= 63 ? 'MCB' : 'MCCB'),
              manufacturer: f.manufacturer ?? project.preferredManufacturer ?? 'Schneider',
              model: effectiveModel,
              isGeneric: false,
            };
            effectiveAlternativeSuggestions = suggestAlternativeBreaker(
              mainIncomerSettings,
              downSettings,
              (f.faultCurrentKa || 15) * 1000,
              {
                downstreamLoadCurrent: f.current,
                cableSizeMm2: f.cableSize,
                parentFeederName: f.parentFeederName,
                preferredManufacturer: project.preferredManufacturer,
                equipmentCatalog: equipment,
              }
            );
          }
          if (!effectiveSuggestedAlternative) {
            effectiveSuggestedAlternative = effectiveAlternativeSuggestions[0]?.title ?? 'Resolve Coordination';
          }
        } else {
          effectiveAlternativeSuggestions = [];
          effectiveSuggestedAlternative = null;
        }

        list.push({
          ...f,
          id: getUniqueFeederId(bldg.id, f),
          breakerModel: effectiveModel,
          selectivityStatus: effectiveStatus,
          selectivityLimitKa: effectiveLimitKa,
          selectivityReason: effectiveReason,
          suggestedAlternative: effectiveSuggestedAlternative,
          alternativeSuggestions: effectiveAlternativeSuggestions,
          buildingId: bldg.id,
          buildingName: bldg.name,
          floor: 0,
        });
      }

      for (const floorNumber of smdbFloorNumbers) {
        for (const f of smdbFeeders(floorNumber)) {
          const saved = findSavedBreakerSetting(f);
          const effectiveModel = resolveBreakerDisplayName(saved?.model, f.breakerModel);
          let effectiveStatus = f.selectivityStatus;
          let effectiveLimitKa = f.selectivityLimitKa;
          let effectiveReason = f.selectivityReason;
          let effectiveAlternativeSuggestions = f.alternativeSuggestions ?? [];
          let effectiveSuggestedAlternative = f.suggestedAlternative ?? null;

          const upFeeder = mdbFeeders.find(
            (uf) =>
              normalizeBreakerId(uf.name) === normalizeBreakerId(f.parentFeederName || '') ||
              uf.name === `F${floorNumber} – SMDB` ||
              uf.name === `F${floorNumber} - SMDB`
          );
          const upSaved = upFeeder ? findSavedBreakerSetting(upFeeder) : null;
          const upIn = upSaved?.frameSize ? parseInt(upSaved.frameSize) : (upFeeder?.breakerSize ?? 400);
          const upIr = upSaved?.ir ?? Math.max(upFeeder?.current ?? 0, upIn * 0.85);
          const customUpstream: BreakerCurveSettings = {
            inRating: upIn,
            ir: upIr,
            tr: upSaved?.tr ?? 12,
            isd: upSaved?.isd ?? (upIn * 4),
            tsd: upSaved?.tsd ?? 0.3,
            ii: upSaved?.ii ?? (upIn * 10),
            category: upIn >= 630 ? 'ACB' : 'MCCB',
            manufacturer: upSaved?.manufacturer ?? upFeeder?.manufacturer ?? project.preferredManufacturer ?? 'Schneider',
            model: upSaved?.model ?? upFeeder?.breakerModel,
            isGeneric: false,
          };

          const customDownstream: BreakerCurveSettings = {
            inRating: f.breakerSize,
            ir: saved?.ir ?? f.current,
            tr: saved?.tr ?? 12,
            isd: saved?.isd ?? (f.breakerSize * 4),
            tsd: saved?.tsd ?? 0.05,
            ii: saved?.ii ?? (f.breakerSize * 10),
            category: f.breakerSize <= 63 ? 'MCB' : (f.breakerSize >= 630 ? 'ACB' : 'MCCB'),
            manufacturer: saved?.manufacturer ?? f.manufacturer ?? project.preferredManufacturer ?? 'Schneider',
            model: effectiveModel,
            isGeneric: false,
          };

          if (saved) {
            const reCoord = verifyCoordination(
              customUpstream,
              customDownstream,
              (f.faultCurrentKa || 15) * 1000,
              {
                cableSizeMm2: f.cableSize,
                cableMaterial: 'copper',
                cableInsulation: 'XLPE',
                cableRuns: f.parallelRuns,
                manufacturerPair: {
                  upstreamMfg: customUpstream.manufacturer ?? 'Schneider',
                  downstreamMfg: customDownstream.manufacturer ?? 'Schneider',
                },
              }
            );
            effectiveStatus = reCoord.status;
            effectiveLimitKa = reCoord.status === 'PARTIAL' && reCoord.limitCurrent ? reCoord.limitCurrent / 1000 : null;
            effectiveReason = reCoord.overlapDetails;

            if (effectiveStatus !== 'FULL') {
              effectiveAlternativeSuggestions = suggestAlternativeBreaker(
                customUpstream,
                customDownstream,
                (f.faultCurrentKa || 15) * 1000,
                {
                  downstreamLoadCurrent: f.current,
                  cableSizeMm2: f.cableSize,
                  parentFeederName: f.parentFeederName,
                  preferredManufacturer: project.preferredManufacturer,
                  equipmentCatalog: equipment,
                }
              );
              effectiveSuggestedAlternative = effectiveAlternativeSuggestions[0]?.title ?? 'Resolve Coordination';
            } else {
              effectiveAlternativeSuggestions = [];
              effectiveSuggestedAlternative = null;
            }
          }

          if (effectiveStatus !== 'FULL') {
            if (!effectiveAlternativeSuggestions || effectiveAlternativeSuggestions.length === 0) {
              effectiveAlternativeSuggestions = suggestAlternativeBreaker(
                customUpstream,
                customDownstream,
                (f.faultCurrentKa || 15) * 1000,
                {
                  downstreamLoadCurrent: f.current,
                  cableSizeMm2: f.cableSize,
                  parentFeederName: f.parentFeederName,
                  preferredManufacturer: project.preferredManufacturer,
                  equipmentCatalog: equipment,
                }
              );
            }
            if (!effectiveSuggestedAlternative) {
              effectiveSuggestedAlternative = effectiveAlternativeSuggestions[0]?.title ?? 'Resolve Coordination';
            }
          } else {
            effectiveAlternativeSuggestions = [];
            effectiveSuggestedAlternative = null;
          }

          list.push({
            ...f,
            id: getUniqueFeederId(bldg.id, f, `f${floorNumber}`),
            breakerModel: effectiveModel,
            selectivityStatus: effectiveStatus,
            selectivityLimitKa: effectiveLimitKa,
            selectivityReason: effectiveReason,
            suggestedAlternative: effectiveSuggestedAlternative,
            alternativeSuggestions: effectiveAlternativeSuggestions,
            buildingId: bldg.id,
            buildingName: bldg.name,
            floor: floorNumber,
          });
        }
      }
    }
    return list;
  }, [project, findBreaker, breakerSettings, equipment]);

  // Default selection when feeders load
  useEffect(() => {
    if (allProjectFeeders.length > 0) {
      const currentFeeder = allProjectFeeders.find(
        (f) => f.id === selectedFeederKey || (f.name === selectedFeederName && (!selectedBuildingId || f.buildingId === selectedBuildingId))
      );
      if (!currentFeeder) {
        // Find a feeder with non-full selectivity if possible to help user right away
        const interestingFeeder =
          allProjectFeeders.find((f) => f.selectivityStatus === 'NONE') ||
          allProjectFeeders.find((f) => f.selectivityStatus === 'PARTIAL') ||
          allProjectFeeders[0];

        if (interestingFeeder) {
          setSelectedFeederKey(interestingFeeder.id);
          setSelectedBuildingId(interestingFeeder.buildingId);
          setSelectedFeederName(interestingFeeder.name);
        }
      } else if (!selectedFeederKey) {
        setSelectedFeederKey(currentFeeder.id);
      }
    }
  }, [allProjectFeeders, selectedFeederKey, selectedFeederName, selectedBuildingId]);

  const selectedFeeder = useMemo(() => {
    if (selectedFeederKey) {
      const byKey = allProjectFeeders.find((f) => f.id === selectedFeederKey);
      if (byKey) return byKey;
    }
    if (!selectedFeederName) return null;
    return (
      allProjectFeeders.find(
        (f) => f.name === selectedFeederName && (!selectedBuildingId || f.buildingId === selectedBuildingId)
      ) ||
      allProjectFeeders.find((f) => f.name === selectedFeederName) ||
      null
    );
  }, [allProjectFeeders, selectedFeederKey, selectedFeederName, selectedBuildingId]);

  // When selected feeder changes, sync the upstream and downstream breaker settings
  useEffect(() => {
    if (mode !== 'project' || !selectedFeeder) return;

    const feeder = selectedFeeder;

    const parentName = feeder.parentFeederName || 'Main Incomer';
    const upstreamFeeder = allProjectFeeders.find(
      (f) => f.name === parentName && f.buildingId === feeder.buildingId
    );

    const mfg = feeder.manufacturer || project?.preferredManufacturer || 'Schneider';

    // 1. Resolve Upstream Breaker
    const bldg = project?.buildings.find((b) => b.id === feeder.buildingId);
    let computedMainIncomer: BreakerCurveSettings | null = null;
    if (bldg && project) {
      const computed = computeFeeders(bldg, project, findBreaker);
      computedMainIncomer = computed.mainIncomerSettings;
    }

    if (parentName === 'Main Incomer' && computedMainIncomer) {
      const saved = breakerSettings.find(
        (s) =>
          (bldg && (
            s.breakerId === `${project?.id}-main-incomer-${bldg.id}` ||
            s.breakerId === `main-incomer-${bldg.id}` ||
            s.breakerId === `${project?.id}-Main Incomer-${bldg.id}`
          )) ||
          (project?.buildings.length === 1 && (
            s.breakerId === `${project?.id}-main-incomer` ||
            s.breakerId === `${project?.id}-Main Incomer` ||
            s.breakerId === 'Main Incomer' ||
            s.breakerId === 'main-incomer'
          ))
      );
      const effectiveIn = saved ? (parseInt(saved.frameSize) || computedMainIncomer.inRating) : computedMainIncomer.inRating;
      const effectiveIr = saved?.ir ?? computedMainIncomer.ir;
      const effectiveCategory: 'ACB' | 'MCCB' = effectiveIn >= 630 ? 'ACB' : 'MCCB';
      const effectiveModel = saved?.model ?? computedMainIncomer.model;

      setUpstream({
        inRating: effectiveIn,
        ir: parseFloat(effectiveIr.toFixed(1)),
        tr: saved?.tr ?? computedMainIncomer.tr ?? 12,
        isd: saved?.isd ?? computedMainIncomer.isd ?? (effectiveIn * 4),
        tsd: saved?.tsd ?? computedMainIncomer.tsd ?? 0.3,
        i2t: saved?.i2t ?? computedMainIncomer.i2t ?? false,
        ii: saved?.ii ?? computedMainIncomer.ii ?? (effectiveIn * 10),
        category: effectiveCategory,
        manufacturer: saved?.manufacturer ?? computedMainIncomer.manufacturer,
        model: effectiveModel,
        isGeneric: saved ? false : !!computedMainIncomer.isGeneric,
      });
      setUpstreamFeederLabel('Main Incomer');
    } else {
      const upstreamFeeder = allProjectFeeders.find(
        (f) => f.name === parentName && f.buildingId === feeder.buildingId
      );
      const savedUp = upstreamFeeder
        ? breakerSettings.find((s) => s.breakerId === `${project?.id}-${upstreamFeeder.name}` || s.breakerId === upstreamFeeder.name)
        : null;

      const rawUpIn = savedUp ? parseInt(savedUp.frameSize) : upstreamFeeder?.breakerSize ?? (feeder.breakerSize >= 400 ? 630 : 400);
      const upIn = Math.max(1, rawUpIn || 400);
      const rawUpIr = savedUp?.ir ?? (upstreamFeeder ? Math.max(upstreamFeeder.current, upIn * 0.85) : upIn * 0.85);
      const upIr = Math.max(0.5, (rawUpIr && rawUpIr > 0) ? rawUpIr : upIn * 0.85);
      const upCat: 'ACB' | 'MCCB' = upIn >= 630 ? 'ACB' : 'MCCB';
      const upModel = savedUp?.model ?? upstreamFeeder?.breakerModel ?? `${mfg} ${upCat} ${upIn}A`;

      setUpstream({
        inRating: upIn,
        ir: parseFloat(upIr.toFixed(1)),
        tr: savedUp?.tr ?? 12,
        isd: savedUp?.isd ?? (upIn * 4),
        tsd: savedUp?.tsd ?? 0.3,
        i2t: savedUp?.i2t ?? false,
        ii: savedUp?.ii ?? (upIn * 10),
        category: upCat,
        manufacturer: savedUp?.manufacturer ?? mfg,
        model: upModel,
        isGeneric: savedUp ? false : upstreamFeeder?.fallbackType === 'GENERIC_SPEC',
      });
      setUpstreamFeederLabel(parentName);
    }

    // 2. Resolve Downstream Breaker
    const savedDown = breakerSettings.find(
      (s) => s.breakerId === `${project?.id}-${feeder.name}` || s.breakerId === feeder.name || (feeder.itemId && s.breakerId === feeder.itemId)
    );

    const rawDownIn = savedDown ? parseInt(savedDown.frameSize) : feeder.breakerSize;
    const downIn = Math.max(1, rawDownIn || 16);
    const rawDownIr = savedDown?.ir ?? feeder.current;
    const downIr = Math.max(0.5, (rawDownIr && rawDownIr > 0) ? rawDownIr : downIn * 0.8);
    const downCat: 'MCB' | 'MCCB' | 'ACB' = downIn >= 630 ? 'ACB' : (downIn <= 63 && feeder.type === 'APARTMENT') ? 'MCB' : 'MCCB';
    const downModel = savedDown?.model ?? feeder.breakerModel;

    setDownstream({
      inRating: downIn,
      ir: parseFloat(downIr.toFixed(1)),
      tr: savedDown?.tr ?? 12,
      isd: savedDown?.isd ?? (downCat === 'MCCB' ? downIn * 4 : undefined),
      tsd: savedDown?.tsd ?? (downCat === 'MCCB' ? 0.05 : undefined),
      ii: savedDown?.ii ?? (downIn * (downCat === 'MCB' ? 5 : 10)),
      category: downCat,
      manufacturer: savedDown?.manufacturer ?? mfg,
      model: downModel,
      curveType: 'C',
      isGeneric: savedDown ? false : feeder.fallbackType === 'GENERIC_SPEC',
    });
    setDownstreamFeederLabel(feeder.name);

    // Cable & Fault
    setCableSize(Math.max(1.5, feeder.cableSize || 16));
    setCableRuns(Math.max(1, feeder.parallelRuns || 1));
    setFaultCurrent((feeder.faultCurrentKa && feeder.faultCurrentKa > 0 ? feeder.faultCurrentKa : 15) * 1000);
  }, [selectedFeederName, selectedBuildingId, allProjectFeeders, mode, project?.preferredManufacturer, project, findBreaker, breakerSettings]);

  // Safe normalized breaker settings for mathematical calculations
  const safeUpstream = useMemo<BreakerCurveSettings>(() => {
    const inRating = Math.max(1, upstream.inRating || 16);
    const ir = Math.max(0.1, upstream.ir > 0 ? upstream.ir : inRating * 0.8);
    const tr = Math.max(0.1, upstream.tr > 0 ? upstream.tr : 12);
    return { ...upstream, inRating, ir, tr };
  }, [upstream]);

  const safeDownstream = useMemo<BreakerCurveSettings>(() => {
    const inRating = Math.max(1, downstream.inRating || 16);
    const ir = Math.max(0.1, downstream.ir > 0 ? downstream.ir : inRating * 0.8);
    const tr = Math.max(0.1, downstream.tr > 0 ? downstream.tr : 12);
    return { ...downstream, inRating, ir, tr };
  }, [downstream]);

  const safeCableSize = Math.max(1.5, cableSize || 16);
  const safeCableRuns = Math.max(1, cableRuns || 1);
  const safeFaultCurrent = Math.max(100, faultCurrent || 10000);

  // Generate curve data
  const upstreamCurve = useMemo(() => {
    try {
      return generateCurvePoints(safeUpstream);
    } catch (err) {
      console.warn('Failed to generate upstream curve:', err);
      return [];
    }
  }, [safeUpstream]);

  const downstreamCurve = useMemo(() => {
    try {
      return generateCurvePoints(safeDownstream);
    } catch (err) {
      console.warn('Failed to generate downstream curve:', err);
      return [];
    }
  }, [safeDownstream]);

  // Cable damage curve
  const cableDamageCurve = useMemo(() => {
    try {
      return generateCableDamageCurve(safeCableSize, cableMaterial, cableInsulation, safeCableRuns);
    } catch (err) {
      console.warn('Failed to generate cable damage curve:', err);
      return [];
    }
  }, [safeCableSize, cableMaterial, cableInsulation, safeCableRuns]);

  // Live coordination check
  const result: CoordinationResult = useMemo(() => {
    try {
      return verifyCoordination(safeUpstream, safeDownstream, safeFaultCurrent, {
        cableSizeMm2: safeCableSize,
        cableMaterial,
        cableInsulation,
        cableRuns: safeCableRuns,
        manufacturerPair: {
          upstreamMfg: safeUpstream.manufacturer ?? '',
          downstreamMfg: safeDownstream.manufacturer ?? '',
        },
      });
    } catch (err) {
      console.warn('Coordination check calculation error:', err);
      return {
        status: 'NONE',
        cascadingSupported: false,
        cableDamageOk: false,
        currentGradingOk: false,
        timeGradingOk: false,
        overlapDetails: 'Coordination parameters incomplete or zero load current',
      };
    }
  }, [safeUpstream, safeDownstream, safeFaultCurrent, safeCableSize, cableMaterial, cableInsulation]);

  // Alternative suggestions when selectivity is not full
  const alternativeSuggestions: BreakerAlternativeSuggestion[] = useMemo(() => {
    if (result.status === 'FULL') return [];
    try {
      return suggestAlternativeBreaker(safeUpstream, safeDownstream, safeFaultCurrent, {
        downstreamLoadCurrent: safeDownstream.ir,
        cableSizeMm2: safeCableSize,
        parentFeederName: upstreamFeederLabel,
        preferredManufacturer: project?.preferredManufacturer,
        equipmentCatalog: equipment,
      });
    } catch (err) {
      console.warn('Alternative breaker suggestion calculation error:', err);
      return [];
    }
  }, [result.status, safeUpstream, safeDownstream, safeFaultCurrent, safeCableSize, upstreamFeederLabel, project?.preferredManufacturer, equipment]);

  const STATUS_CONFIG: Record<SelectivityStatus, { color: string; bg: string; border: string; icon: typeof CheckCircle; label: string }> = {
    FULL: {
      color: 'text-emerald-800 dark:text-emerald-300',
      bg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
      border: 'border-emerald-600/50 dark:border-emerald-500/40 shadow-xs',
      icon: CheckCircle2,
      label: t('breakers.fullSelectivity', 'Full Selectivity'),
    },
    PARTIAL: {
      color: 'text-amber-900 dark:text-amber-300',
      bg: 'bg-amber-500/15 dark:bg-amber-500/20',
      border: 'border-amber-600/50 dark:border-amber-500/40 shadow-xs',
      icon: AlertTriangle,
      label: t('breakers.partialSelectivity', 'Partial Selectivity'),
    },
    NONE: {
      color: 'text-rose-800 dark:text-rose-300',
      bg: 'bg-rose-500/15 dark:bg-rose-500/20',
      border: 'border-rose-600/50 dark:border-rose-500/40 shadow-xs',
      icon: XCircle,
      label: t('breakers.noSelectivity', 'No Selectivity'),
    },
  };

  const statusConfig = STATUS_CONFIG[result.status];
  const StatusIcon = statusConfig.icon;

  // Apply one-click auto-tuning to achieve full selectivity
  const applyAutoTune = () => {
    // 1. Grade upstream Ir to at least 1.6x downstream Ir
    const validDownIr = Math.max(0.5, downstream.ir);
    const validUpIn = Math.max(16, upstream.inRating);
    const targetUpstreamIr = Math.max(validUpIn * 0.8, validDownIr * 1.6);
    const updatedUpstreamIn = validUpIn < targetUpstreamIr ? Math.ceil(targetUpstreamIr / 100) * 100 : validUpIn;

    setUpstream((prev) => ({
      ...prev,
      inRating: updatedUpstreamIn,
      ir: parseFloat(targetUpstreamIr.toFixed(1)),
      tsd: 0.3,
      isd: targetUpstreamIr * 4,
      ii: updatedUpstreamIn * 10,
    }));

    setDownstream((prev) => ({
      ...prev,
      tsd: prev.category === 'MCCB' ? 0.05 : undefined,
      isd: Math.max(0.1, prev.ir) * 4,
      ii: Math.max(1, prev.inRating) * 8,
    }));
  };

  const handleApplySuggestion = async (sug: BreakerAlternativeSuggestion) => {
    if (!project || !selectedFeeder) return;
    setApplyingId(sug.id);

    try {
      const bldg = project.buildings.find((b) => b.id === selectedFeeder.buildingId) || project.buildings[0];

      if (sug.type === 'UPSTREAM_UPGRADE') {
        const floorMatch = selectedFeeder.parentFeederName?.match(/F(\d+)/i);
        const floorNum = floorMatch ? parseInt(floorMatch[1], 10) : null;
        let floorDesignId = selectedFeeder.floorDesignId;
        if (floorNum && bldg) {
          const fd = (bldg.floorDesigns ?? []).find((f) => f.floorNumber === floorNum);
          if (fd) floorDesignId = fd.id;
        }

        const isSmdb = selectedFeeder.parentFeederName?.includes('SMDB');
        const targetRating = sug.suggestedFrameSize || 400;
        const targetCat = isSmdb ? 'MCCB' : (targetRating >= 630 ? 'ACB' : 'MCCB');
        const prefMfg = project.preferredManufacturer || 'Schneider';
        const resolved = resolveCatalogBreakerOrAlternative(
          targetRating,
          targetCat,
          prefMfg,
          equipment,
          sug.suggestedModel
        );

        if (floorDesignId && isSmdb) {
          await fetch(`/api/floors/${floorDesignId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ riserBreakerSize: resolved.frameSizeFormatted }),
          });
          const upFeeder = allProjectFeeders.find(
            (b) =>
              b.buildingId === selectedFeeder.buildingId &&
              b.name === selectedFeeder.parentFeederName
          );
          if (upFeeder) {
            const stableBreakerId = `${project.id}-${upFeeder.name}`;
            await fetch('/api/breaker-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: project.id,
                breakerId: stableBreakerId,
                model: resolved.model || sug.suggestedModel || upFeeder.breakerModel,
                manufacturer: resolved.manufacturer || upFeeder.manufacturer || 'Schneider',
                frameSize: resolved.frameSizeFormatted,
                ir: resolved.ir,
                tr: 12,
                isd: resolved.ir * 4,
                tsd: 0.3,
                ii: resolved.frameSize * 10,
              }),
            });
          }
        } else {
          await fetch('/api/breaker-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              breakerId: bldg ? `${project.id}-main-incomer-${bldg.id}` : `${project.id}-main-incomer`,
              model: resolved.model || sug.suggestedModel || 'Main Incomer ACB',
              manufacturer: resolved.manufacturer || selectedFeeder.manufacturer || 'Schneider',
              frameSize: resolved.frameSizeFormatted,
              ir: resolved.ir,
              tr: 12,
              isd: resolved.ir * 4,
              tsd: 0.3,
              ii: resolved.frameSize * 10,
            }),
          });
        }
      } else if (sug.type === 'DIRECT_MDB_FEED') {
        let floorDesignId = selectedFeeder.floorDesignId;
        if (!floorDesignId && bldg) {
          const floorMatch = selectedFeeder.parentFeederName?.match(/F(\d+)/i) || selectedFeeder.name.match(/F(\d+)/i);
          const floorNum = floorMatch ? parseInt(floorMatch[1], 10) : selectedFeeder.floor;
          const fd = (bldg.floorDesigns ?? []).find((f) => f.floorNumber === floorNum);
          floorDesignId = fd?.id;
        }
        if (floorDesignId) {
          await fetch(`/api/floors/${floorDesignId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hasFloorSubPanels: false }),
          });
        }
      } else if (sug.type === 'DOWNSTREAM_RESIZE') {
        const isSmdb = selectedFeeder.type === 'SMDB' || selectedFeeder.name.includes('SMDB');
        const targetRating = sug.suggestedFrameSize || selectedFeeder.breakerSize;
        const targetCat = isSmdb ? 'MCCB' : (targetRating > 63 ? 'MCCB' : 'MCB');
        const prefMfg = project.preferredManufacturer || 'Schneider';
        const resolved = resolveCatalogBreakerOrAlternative(
          targetRating,
          targetCat,
          prefMfg,
          equipment,
          sug.suggestedModel
        );

        if (isSmdb) {
          let floorDesignId = selectedFeeder.floorDesignId;
          if (!floorDesignId && bldg) {
            const floorMatch = selectedFeeder.name.match(/F(\d+)/i);
            const floorNum = floorMatch ? parseInt(floorMatch[1], 10) : selectedFeeder.floor;
            const fd = (bldg.floorDesigns ?? []).find((f) => f.floorNumber === floorNum);
            floorDesignId = fd?.id;
          }
          if (floorDesignId) {
            await fetch(`/api/floors/${floorDesignId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ riserBreakerSize: resolved.frameSizeFormatted }),
            });
            const stableBreakerId = `${project.id}-${selectedFeeder.name}`;
            await fetch('/api/breaker-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: project.id,
                breakerId: stableBreakerId,
                model: resolved.model || sug.suggestedModel || selectedFeeder.breakerModel,
                manufacturer: resolved.manufacturer || selectedFeeder.manufacturer || 'Schneider',
                frameSize: resolved.frameSizeFormatted,
                ir: resolved.ir,
                tr: 12,
                isd: resolved.ir * 4,
                tsd: 0.3,
                ii: resolved.frameSize * 10,
              }),
            });
          }
        } else if (selectedFeeder.buildingLoadId) {
          await fetch(`/api/building-loads/${selectedFeeder.buildingLoadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ breakerSize: resolved.frameSizeFormatted }),
          });
        } else {
          let itemId = selectedFeeder.itemId;
          if (!itemId && bldg) {
            for (const fd of bldg.floorDesigns ?? []) {
              for (const it of fd.items ?? []) {
                if (
                  `F${fd.floorNumber} – ${it.name}` === selectedFeeder.name ||
                  `F${fd.floorNumber} - ${it.name}` === selectedFeeder.name ||
                  it.name === selectedFeeder.name
                ) {
                  itemId = it.id;
                  break;
                }
              }
              if (itemId) break;
            }
          }
          if (itemId) {
            await fetch(`/api/floor-items/${itemId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ breakerSize: resolved.frameSizeFormatted }),
            });
          }
        }
      } else if (sug.type === 'SETTINGS_ADJUSTMENT' || sug.type === 'ELECTRONIC_TRIP_UNIT') {
        const isMainIncomer = selectedFeeder.name === 'Main Incomer' || selectedFeeder.type === 'INCOMER';
        const stableBreakerId = isMainIncomer
          ? (bldg ? `${project.id}-main-incomer-${bldg.id}` : `${project.id}-main-incomer`)
          : `${project.id}-${selectedFeeder.name}`;
        const fullModel = resolveBreakerDisplayName(
          sug.suggestedModel || selectedFeeder.breakerModel,
          selectedFeeder.breakerModel
        );
        await fetch('/api/breaker-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            breakerId: stableBreakerId,
            model: fullModel,
            manufacturer: selectedFeeder.manufacturer || 'Schneider',
            frameSize: `${selectedFeeder.breakerSize}A`,
            ir: selectedFeeder.current,
            tr: 12,
            isd: sug.suggestedSettings?.isd ?? selectedFeeder.breakerSize * 4,
            tsd: sug.suggestedSettings?.tsd ?? 0.05,
            ii: sug.suggestedSettings?.ii ?? selectedFeeder.breakerSize * 8,
          }),
        });

        // If this is LSI delay grading and upstream feeder exists, grade upstream electronic breaker to tsd = 0.3s
        const upstreamFeeder = selectedFeeder.parentFeederName
          ? (
              allProjectFeeders.find((f) => f.name === selectedFeeder.parentFeederName) ||
              allProjectFeeders.find((f) => f.name.includes(selectedFeeder.parentFeederName!)) ||
              allProjectFeeders.find((f) => selectedFeeder.parentFeederName!.includes(f.name))
            )
          : null;

        if (sug.id === 'sug-lsi-tuning' && upstreamFeeder) {
          const upstreamSaved = breakerSettings.find(
            (s) => s.breakerId === `${project.id}-${upstreamFeeder.name}` || s.breakerId === upstreamFeeder.name
          );
          const isUpIncomer = upstreamFeeder.name === 'Main Incomer' || upstreamFeeder.type === 'INCOMER';
          const upstreamBreakerId = isUpIncomer
            ? (bldg ? `${project.id}-main-incomer-${bldg.id}` : `${project.id}-main-incomer`)
            : `${project.id}-${upstreamFeeder.name}`;
          await fetch('/api/breaker-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              breakerId: upstreamBreakerId,
              model: upstreamSaved?.model || upstreamFeeder.breakerModel || 'MCCB Electronic',
              manufacturer: upstreamSaved?.manufacturer || upstreamFeeder.manufacturer || 'Schneider',
              frameSize: upstreamSaved?.frameSize || `${upstreamFeeder.breakerSize}A`,
              ir: upstreamSaved?.ir ?? upstreamFeeder.current,
              tr: upstreamSaved?.tr ?? 12,
              isd: upstreamSaved?.isd ?? upstreamFeeder.breakerSize * 4,
              tsd: 0.3,
              ii: upstreamSaved?.ii ?? upstreamFeeder.breakerSize * 10,
            }),
          });
        }

        await loadBreakerSettings();
      }

      await refreshProject();
      const res = await fetch(`/api/projects/${project.id}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const updated = await res.json();
        setProject(updated);
      }
    } catch (err) {
      console.error('Error applying suggestion:', err);
    } finally {
      setApplyingId(null);
    }
  };

  // SVG Chart Geometry
  const svgWidth = 720;
  const svgHeight = 480;
  const plotLeft = 80;
  const plotTop = 35;
  const plotWidth = svgWidth - plotLeft - 35;
  const plotHeight = svgHeight - plotTop - 55;

  const logMinI = Math.log10(10);
  const logMaxI = Math.log10(Math.max(50000, faultCurrent * 1.5));
  const logMinT = Math.log10(0.01);
  const logMaxT = Math.log10(10000);

  const mapX = (current: number) => {
    const clampedI = Math.max(10, Math.min(100000, current));
    return plotLeft + ((Math.log10(clampedI) - logMinI) / (logMaxI - logMinI)) * plotWidth;
  };

  const mapY = (time: number) => {
    const clampedT = Math.max(0.01, Math.min(10000, time));
    return plotTop + plotHeight - ((Math.log10(clampedT) - logMinT) / (logMaxT - logMinT)) * plotHeight;
  };

  const toPath = (points: CurvePoint[]) => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${mapX(p.current).toFixed(1)},${mapY(p.time).toFixed(1)}`).join(' ');
  };

  const currentGridLines = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const timeGridLines = [0.01, 0.1, 1, 10, 60, 300, 3600, 10000];

  const formatTccTimeTick = (tVal: number): string => {
    if (tVal >= 3600) {
      const hours = tVal / 3600;
      return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
    }
    if (tVal >= 60) {
      const mins = tVal / 60;
      return Number.isInteger(mins) ? `${mins}m` : `${mins.toFixed(1)}m`;
    }
    return `${tVal}s`;
  };

  if (selectedProject && !canView('coordination')) {
    return <AccessRestricted pageTitle={t('nav.coordination', 'Coordination & Selectivity')} />;
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 w-full max-w-[1680px] mx-auto min-h-[80vh]">
      {/* Workflow Stepper: Step 3 */}
      <WorkflowStepper currentStep={3} />

      {/* Read-Only Mode Banner */}
      <ReadOnlyBanner pageKey="coordination" />

      {/* Floating QA Review Tool */}
      <QAReviewDrawer pageKey="coordination" pageTitle="Coordination & Selectivity" />

      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-orange-500" />
            <h1 className="text-2xl font-bold text-[var(--foreground-color)]">
              {t('coordination.title', 'Protection Coordination Studio')}
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t('coordination.subtitle', 'Time-Current Characteristic (TCC) analysis & selectivity verification')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[var(--card-bg-subtle)] p-1 rounded-xl border border-[var(--border-color)] text-xs">
            <button
              onClick={() => setMode('project')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                mode === 'project'
                  ? 'bg-orange-600 text-white text-white-force shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground-color)]'
              }`}
            >
              <Layers size={13} />
              Project Feeders
            </button>
            <button
              onClick={() => setMode('playground')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                mode === 'playground'
                  ? 'bg-orange-600 text-white text-white-force shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground-color)]'
              }`}
            >
              <Sliders size={13} />
              Custom Playground
            </button>
          </div>

          {/* Coordination Verdict Badge */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border ${statusConfig.bg} ${statusConfig.border}`}>
            <StatusIcon size={16} className={statusConfig.color} />
            <span className={`text-xs font-bold ${statusConfig.color}`}>
              {statusConfig.label} {result.limitCurrent ? `(${(result.limitCurrent / 1000).toFixed(1)} kA)` : ''}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] italic ml-auto hidden sm:inline">
              Indicative — verify against manufacturer time-current curves before final coordination sign-off
            </span>
          </div>
        </div>
      </div>

      {/* Project Feeder Selection Bar */}
      {mode === 'project' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <label htmlFor="coordination-feeder" className="text-xs font-semibold text-[var(--foreground-color)]">Select Feeder to Analyze:</label>
                <select
                  id="coordination-feeder"
                  value={selectedFeeder?.id || selectedFeederKey || (allProjectFeeders[0]?.id ?? '')}
                  onChange={(e) => {
                    const chosen = allProjectFeeders.find((f) => f.id === e.target.value);
                    if (chosen) {
                      setSelectedFeederKey(chosen.id);
                      setSelectedBuildingId(chosen.buildingId);
                      setSelectedFeederName(chosen.name);
                    }
                  }}
                  className="dense-input rounded-lg text-xs bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground-color)] font-medium min-w-[280px]"
                >
                  {allProjectFeeders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {project && project.buildings.length > 1 ? `[${f.buildingName}] ` : ''}
                      {f.name} ({f.breakerSize}A{f.current ? `, ${f.current.toFixed(1)}A load` : ''}) &mdash; {f.selectivityStatus || 'UNKNOWN'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
              <span>Upstream Parent: <strong className="text-sky-600 dark:text-sky-400">{upstreamFeederLabel}</strong></span>
              <ArrowRight size={12} className="text-[var(--text-muted)]" />
              <span>Downstream: <strong className="text-orange-500 dark:text-orange-400">{downstreamFeederLabel}</strong></span>
            </div>
          </div>

          {/* Feeder Hierarchy Banner */}
          <div className="bg-[var(--card-bg-subtle)] rounded-lg p-2.5 border border-[var(--border-color)] text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Selected Breaker:</span>
              <span className="text-[var(--foreground-color)] font-semibold">{downstream.model || `${downstream.inRating}A`}</span>
            </div>
            <div className="flex items-center gap-4 text-[var(--text-muted)] font-mono">
              <span>Load: <strong className="text-[var(--foreground-color)]">{downstream.ir.toFixed(1)}A</strong></span>
              <span>Frame: <strong className="text-sky-600 dark:text-sky-400">{downstream.inRating}A</strong></span>
              <span>Cable: <strong className="text-emerald-600 dark:text-emerald-400">{cableSize} mm²</strong></span>
              <span>Fault Isc: <strong className="text-orange-500 dark:text-orange-400">{(faultCurrent / 1000).toFixed(2)} kA</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Settings (Left) & TCC Plot (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Panel: Trip Unit Dials & Fault Parameters */}
        <div className="space-y-4">
          {/* Upstream Breaker Card */}
          <div className="rounded-xl border border-sky-500/30 bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-500" />
                <h2 className="text-sm font-bold text-sky-600 dark:text-sky-400">
                  Upstream ({upstreamFeederLabel})
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/30">
                In = {upstream.inRating}A ({upstream.category || 'MCCB'})
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] truncate" title={upstream.model}>
              {upstream.model || 'Standard Electronic Trip Unit'}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label htmlFor="upstream-ir" className="text-[var(--text-muted)] flex justify-between">
                  <span>Ir (A)</span>
                  <span className="text-[var(--text-muted)] font-mono">{(upstream.ir / upstream.inRating).toFixed(2)}x</span>
                </label>
                <input
                  id="upstream-ir"
                  type="number"
                  value={upstream.ir}
                  onChange={(e) => setUpstream({ ...upstream, ir: parseFloat(e.target.value) || 0 })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="upstream-tr" className="text-[var(--text-muted)]">tr (s)</label>
                <input
                  id="upstream-tr"
                  type="number"
                  step="0.5"
                  value={upstream.tr}
                  onChange={(e) => setUpstream({ ...upstream, tr: parseFloat(e.target.value) || 0 })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="upstream-isd" className="text-[var(--text-muted)] flex justify-between">
                  <span>Isd (A)</span>
                  <span className="text-[var(--text-muted)] font-mono">{upstream.isd ? `${(upstream.isd / upstream.ir).toFixed(1)}x` : '—'}</span>
                </label>
                <input
                  id="upstream-isd"
                  type="number"
                  value={upstream.isd ?? ''}
                  onChange={(e) => setUpstream({ ...upstream, isd: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="upstream-tsd" className="text-[var(--text-muted)]">tsd (s)</label>
                <input
                  id="upstream-tsd"
                  type="number"
                  step="0.01"
                  value={upstream.tsd ?? ''}
                  onChange={(e) => setUpstream({ ...upstream, tsd: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="upstream-ii" className="text-[var(--text-muted)]">Ii (A)</label>
                <input
                  id="upstream-ii"
                  type="number"
                  value={upstream.ii ?? ''}
                  onChange={(e) => setUpstream({ ...upstream, ii: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="upstream-i2t" className="text-[var(--text-muted)]">I²t Curve</label>
                <select
                  id="upstream-i2t"
                  value={upstream.i2t ? 'on' : 'off'}
                  onChange={(e) => setUpstream({ ...upstream, i2t: e.target.value === 'on' })}
                  className="dense-input w-full rounded font-mono"
                >
                  <option value="off">OFF (Flat)</option>
                  <option value="on">ON (Inverse)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Downstream Breaker Card */}
          <div className="rounded-xl border border-orange-500/30 bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <h2 className="text-sm font-bold text-orange-500 dark:text-orange-400">
                  Downstream ({downstreamFeederLabel})
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/30">
                In = {downstream.inRating}A ({downstream.category || 'MCCB'})
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] truncate" title={downstream.model}>
              {downstream.model || 'Standard Trip Unit'}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label htmlFor="downstream-ir" className="text-[var(--text-muted)] flex justify-between">
                  <span>Ir (A)</span>
                  <span className="text-[var(--text-muted)] font-mono">{(downstream.ir / downstream.inRating).toFixed(2)}x</span>
                </label>
                <input
                  id="downstream-ir"
                  type="number"
                  value={downstream.ir}
                  onChange={(e) => setDownstream({ ...downstream, ir: parseFloat(e.target.value) || 0 })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="downstream-tr" className="text-[var(--text-muted)]">tr (s)</label>
                <input
                  id="downstream-tr"
                  type="number"
                  step="0.5"
                  value={downstream.tr}
                  onChange={(e) => setDownstream({ ...downstream, tr: parseFloat(e.target.value) || 0 })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="downstream-isd" className="text-[var(--text-muted)] flex justify-between">
                  <span>Isd (A)</span>
                  <span className="text-[var(--text-muted)] font-mono">{downstream.isd ? `${(downstream.isd / downstream.ir).toFixed(1)}x` : '—'}</span>
                </label>
                <input
                  id="downstream-isd"
                  type="number"
                  value={downstream.isd ?? ''}
                  onChange={(e) => setDownstream({ ...downstream, isd: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="downstream-tsd" className="text-[var(--text-muted)]">tsd (s)</label>
                <input
                  id="downstream-tsd"
                  type="number"
                  step="0.01"
                  value={downstream.tsd ?? ''}
                  onChange={(e) => setDownstream({ ...downstream, tsd: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="downstream-ii" className="text-[var(--text-muted)]">Ii (A)</label>
                <input
                  id="downstream-ii"
                  type="number"
                  value={downstream.ii ?? ''}
                  onChange={(e) => setDownstream({ ...downstream, ii: parseFloat(e.target.value) || undefined })}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="downstream-i2t" className="text-[var(--text-muted)]">I²t Curve</label>
                <select
                  id="downstream-i2t"
                  value={downstream.i2t ? 'on' : 'off'}
                  onChange={(e) => setDownstream({ ...downstream, i2t: e.target.value === 'on' })}
                  className="dense-input w-full rounded font-mono"
                >
                  <option value="off">OFF (Flat)</option>
                  <option value="on">ON (Inverse)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fault & Cable Card */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
            <h2 className="text-sm font-semibold text-[var(--foreground-color)] flex items-center justify-between">
              <span>Cable & Fault Parameters</span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs ${
                  result.cableDamageOk
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/50 dark:border-emerald-500/40'
                    : 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-600/50 dark:border-rose-500/40'
                }`}
              >
                {result.cableDamageOk ? '✓ Cable Protected' : '✗ Thermal Damage Risk'}
              </span>
            </h2>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label htmlFor="cable-size" className="text-[var(--text-muted)]">Cable Size (mm²)</label>
                <input
                  id="cable-size"
                  type="number"
                  value={cableSize}
                  onChange={(e) => setCableSize(parseFloat(e.target.value) || 10)}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="cable-runs" className="text-[var(--text-muted)]">Runs</label>
                <input
                  id="cable-runs"
                  type="number"
                  min={1}
                  value={cableRuns}
                  onChange={(e) => setCableRuns(Math.max(1, parseInt(e.target.value) || 1))}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="fault-isc" className="text-[var(--text-muted)]">Fault Isc (A)</label>
                <input
                  id="fault-isc"
                  type="number"
                  value={faultCurrent}
                  onChange={(e) => setFaultCurrent(parseInt(e.target.value) || 15000)}
                  className="dense-input w-full rounded font-mono"
                />
              </div>
            </div>

            {result.overlapDetails && (
              <p className="text-xs text-[var(--text-muted)] leading-relaxed italic bg-[var(--card-bg-subtle)] p-2.5 rounded-lg border border-[var(--border-color)]">
                {result.overlapDetails}
              </p>
            )}
          </div>
        </div>

        {/* Right Panel: TCC Chart & Recommendations */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recommendations Banner (Shown when non-selective) */}
          {result.status !== 'FULL' && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-orange-400" />
                  <h2 className="text-sm font-bold text-[var(--foreground-color)]">
                    Alternative Breaker & Coordination Solutions
                  </h2>
                </div>
                <button
                  onClick={applyAutoTune}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-white-force text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Zap size={13} />
                  Auto-Tune for Full Selectivity
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {alternativeSuggestions.slice(0, 2).map((sug) => (
                  <div key={sug.id} className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex flex-col justify-between gap-2 hover:border-orange-500/40 transition-all shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 dark:text-orange-400 border border-orange-500/20">
                          {sug.badge}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-600/50 dark:border-emerald-500/40 shadow-xs">✓ FULL</span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--foreground-color)]">{sug.title}</p>
                      <p className="text-[11px] text-[var(--text-muted)] leading-snug">{sug.description}</p>
                      {sug.suggestedModel && (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-sky-600 dark:text-sky-400 pt-0.5 flex-wrap">
                          <Zap size={11} className="text-sky-500 shrink-0" />
                          <span>{sug.suggestedModel}</span>
                          {sug.fallbackType === 'OTHER_FAMILY' && (
                            <span className="text-[9px] font-sans font-semibold px-1 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                              Other Family
                            </span>
                          )}
                          {sug.fallbackType === 'OTHER_BRAND' && (
                            <span className="text-[9px] font-sans font-semibold px-1 py-0.2 rounded bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-600/40 dark:border-amber-500/30">
                              Alt Brand
                            </span>
                          )}
                          {sug.fallbackType === 'GENERIC_SPEC' && (
                            <span className="text-[9px] font-sans font-semibold px-1 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                              Generic Spec
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      disabled={Boolean(applyingId)}
                      onClick={() => handleApplySuggestion(sug)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 active:scale-95 disabled:opacity-50 text-white text-white-force font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Zap size={12} className={applyingId === sug.id ? "animate-spin" : ""} />
                      <span>{applyingId === sug.id ? "Saving to Project..." : sug.actionText || "Apply & Save to Project"}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TCC SVG Chart */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--foreground-color)] uppercase tracking-wider">
                {t('coordination.tccTitle', 'Time-Current Characteristic (TCC) — Log-Log Scale')}
              </h2>
              <div className="text-xs text-[var(--text-muted)] font-mono">
                IEC 60947-2 &bull; IEC 60898 &bull; IEC 60364-5-54
              </div>
            </div>

            <div className="bg-[var(--card-bg-subtle)] rounded-xl border border-[var(--border-color)] p-2 overflow-x-auto flex justify-center">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" className="select-none font-mono text-[9px]">
                {/* Plot background */}
                <rect
                  x={plotLeft}
                  y={plotTop}
                  width={plotWidth}
                  height={plotHeight}
                  fill="var(--card-bg)"
                  stroke="var(--border-color)"
                  strokeWidth="1"
                />

                {/* Grid lines - Current (X) */}
                {currentGridLines.map((iVal) => {
                  const x = mapX(iVal);
                  return (
                    <g key={`grid-x-${iVal}`}>
                      <line
                        x1={x}
                        y1={plotTop}
                        x2={x}
                        y2={plotTop + plotHeight}
                        stroke="var(--border-color)"
                        strokeDasharray="2,2"
                      />
                      <text x={x} y={plotTop + plotHeight + 16} fill="currentColor" className="text-[var(--text-muted)]" textAnchor="middle">
                        {iVal >= 1000 ? `${iVal / 1000}k` : iVal}
                      </text>
                    </g>
                  );
                })}

                {/* Grid lines - Time (Y) */}
                {timeGridLines.map((tVal) => {
                  const y = mapY(tVal);
                  return (
                    <g key={`grid-y-${tVal}`}>
                      <line
                        x1={plotLeft}
                        y1={y}
                        x2={plotLeft + plotWidth}
                        y2={y}
                        stroke="var(--border-color)"
                        strokeDasharray="2,2"
                      />
                      <text x={plotLeft - 8} y={y + 3} fill="currentColor" className="text-[var(--text-muted)]" textAnchor="end">
                        {formatTccTimeTick(tVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Axis Labels */}
                <text
                  x={plotLeft + plotWidth / 2}
                  y={plotTop + plotHeight + 35}
                  fill="currentColor"
                  textAnchor="middle"
                  className="text-[var(--foreground-color)] font-sans text-[10px] font-semibold tracking-wider"
                >
                  {t('coordination.currentAmperes', 'Current (Amperes) — Logarithmic Scale')}
                </text>

                {/* Cable Damage Curve (Purple/Red Dashed) */}
                <path
                  d={toPath(cableDamageCurve)}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />

                {/* Upstream Curve (Blue) */}
                <path
                  d={toPath(upstreamCurve)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                />

                {/* Downstream Curve (Orange) */}
                <path
                  d={toPath(downstreamCurve)}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2.5"
                />

                {/* Fault Current Line (Red) */}
                <line
                  x1={mapX(faultCurrent)}
                  y1={plotTop}
                  x2={mapX(faultCurrent)}
                  y2={plotTop + plotHeight}
                  stroke="#dc2626"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />
                <text
                  x={mapX(faultCurrent) + 4}
                  y={plotTop + 14}
                  fill="#ef4444"
                  className="font-bold text-[9px]"
                >
                  Isc: {(faultCurrent / 1000).toFixed(1)}kA
                </text>
              </svg>
            </div>

            {/* Legend & Stats */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--card-bg-subtle)] border border-[var(--border-color)] p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-[#38bdf8] inline-block"></span>
                <span className="text-[var(--foreground-color)] font-medium">Upstream ({upstream.model || `${upstream.inRating}A`})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-[#f97316] inline-block"></span>
                <span className="text-[var(--foreground-color)] font-medium">Downstream ({downstream.model || `${downstream.inRating}A`})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-[#ef4444] inline-block border-b border-dashed border-red-500"></span>
                <span className="text-[var(--text-muted)]">Cable Damage ({cableSize} mm² {cableInsulation})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
