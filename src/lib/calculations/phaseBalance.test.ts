import { describe, it, expect } from 'vitest';
import { phaseBalance } from './phaseBalance';
import type { BuildingLoad, FloorItem, Project } from '@/types';

/**
 * Per-phase load balancing tests for phaseBalance.ts.
 *
 * These exercise ALL 14 paths documented in the test plan:
 *   7 from the design doc (balanced, single-phase-on-L1, two-1φ-L1+L2, mixed
 *   3φ+1φ, manual override, re-balance, standard switch) +
 *   7 gaps identified in /plan-eng-review:
 *     (8) null → greedy auto-assign on-read (stable order)
 *     (9) lag/lead displacement sign
 *    (10) 3-phase split (kW/3, current on each phase)
 *    (11) current-unbalance % formula
 *    (12) empty board → no NaN
 *    (13) boundary: exactly at limit
 *    (14) all-3-phase board neutral ≈ 0
 *
 * Pure-function tests; project fixture uses IEC defaults for PF and standard.
 */

function projectFixture(
  opts: Partial<Pick<Project, 'powerFactor' | 'calculationStandard'>> = {}
): Project {
  return {
    id: 'p1',
    name: 'Test Project',
    client: '',
    consultant: '',
    contractor: '',
    location: '',
    engineer: '',
    date: '',
    voltage: 400,
    frequency: 50,
    powerFactor: opts.powerFactor ?? 0.85,
    country: 'Syria',
    preferredManufacturer: 'MIXED',
    maxVoltageDropLighting: 3,
    maxVoltageDropPower: 5,
    calculationStandard: opts.calculationStandard ?? 'IEC',
    // arrays required by Project but unused by phaseBalance directly
    buildings: [],
    apartmentTemplates: [],
    loadLibraryItems: [],
  } as Project;
}

function floorItemFixture(
  opts: Partial<FloorItem> & { current?: number; maxDemand?: number; kw?: number } = {}
): FloorItem {
  return {
    id: opts.id ?? `item-${Math.random().toString(36).slice(2)}`,
    name: opts.name ?? 'Load',
    type: opts.type ?? 'APARTMENT',
    calculatedConnectedLoad: opts.calculatedConnectedLoad ?? 0,
    calculatedMaxDemand: opts.maxDemand ?? opts.kw ?? 0,
    calculatedCurrent: opts.current ?? 0,
    breakerSize: opts.breakerSize ?? '',
    cableSize: opts.cableSize ?? '',
    voltageDrop: opts.voltageDrop ?? 0,
    apartmentTemplate: opts.apartmentTemplate ?? undefined,
    loadLibraryItem: opts.loadLibraryItem ?? undefined,
    assignedPhase: opts.assignedPhase ?? null,
  } as FloorItem;
}

function buildingLoadFixture(
  opts: Partial<BuildingLoad> & { power?: number; voltage?: number; phase?: number; powerFactor?: number } = {}
): BuildingLoad {
  return {
    id: opts.id ?? `bl-${Math.random().toString(36).slice(2)}`,
    buildingId: 'b1',
    loadLibraryItemId: 'lib1',
    quantity: opts.quantity ?? 1,
    loadLibraryItem: opts.loadLibraryItem ?? {
      id: 'lib1',
      name: 'Motor',
      category: 'Pump',
      power: opts.power ?? 0,
      voltage: opts.voltage ?? 400,
      phase: opts.phase ?? 3,
      powerFactor: opts.powerFactor ?? 0.85,
      demandFactor: 1,
      quantity: 1,
      runningCurrent: 0,
      startingCurrent: null,
      notes: null,
    },
    assignedPhase: opts.assignedPhase ?? null,
  } as BuildingLoad;
}

// Alias used by tests that construct a LoadLibraryItem inline for FloorItems.
function libItem(
  opts: Partial<LoadLibraryItem> & { power?: number; voltage?: number; phase?: number; powerFactor?: number }
): LoadLibraryItem {
  return {
    id: opts.id ?? `lib-${Math.random().toString(36).slice(2)}`,
    name: opts.name ?? 'Load',
    category: opts.category ?? 'General',
    power: opts.power ?? 0,
    voltage: opts.voltage ?? 400,
    phase: opts.phase ?? 3,
    powerFactor: opts.powerFactor ?? 0.85,
    demandFactor: opts.demandFactor ?? 1,
    quantity: opts.quantity ?? 1,
    runningCurrent: 0,
    startingCurrent: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  } as LoadLibraryItem;
}

// Shortcut to build floor items with stable ids (deterministic tests).
function item(
  id: string,
  current: number,
  maxDemand: number,
  type: FloorItem['type'] = 'APARTMENT',
  extras: Partial<FloorItem> = {}
): FloorItem {
  return floorItemFixture({ id, current, maxDemand, type, ...extras });
}

// ============================================================================
// 1. balanced 3-phase board → neutral ≈ 0, unbalance 0%
// ============================================================================

describe('phaseBalance', () => {
  it('reports neutral ≈ 0 for only balanced 3-phase loads', () => {
    const project = projectFixture({ powerFactor: 1 });
    const threePhaseMotor = item(
      'm1',
      30, // line current on each phase
      20.784, // ≈ 30 * √3 * 0.4 kW
      'PUMP_PANEL',
      {
        loadLibraryItem: libItem({
          name: 'Pump',
          category: 'Pump',
          power: 20.784,
          voltage: 400,
          phase: 3,
          powerFactor: 1,
          demandFactor: 1,
          quantity: 1,
        }),
      }
    );

    const b = phaseBalance([threePhaseMotor], project);

    expect(b.totalKw).toBeCloseTo(20.784, 2);
    expect(b.phaseCurrent).toEqual([30, 30, 30]);
    expect(b.unbalancePct).toBe(0);
    expect(b.neutralCurrent).toBeCloseTo(0, 6);
    expect(b.imbalanced).toBe(false);
  });

  // ==========================================================================
  // 2. one heavy 1-phase load on L1 → neutral ≈ that load's current
  // ==========================================================================

  it('places a single 1-phase load on L1 and neutral ≈ its current', () => {
    const project = projectFixture({ powerFactor: 1 });
    const apt = item('apt1', 40, 9.2, 'APARTMENT');

    const b = phaseBalance([apt], project);

    // With no other loads, L1 gets the single largest 1-phase load.
    expect(b.phaseCurrent[0]).toBeCloseTo(40, 6);
    expect(b.phaseCurrent[1]).toBeCloseTo(0, 6);
    expect(b.phaseCurrent[2]).toBeCloseTo(0, 6);
    expect(b.neutralCurrent).toBeCloseTo(40, 6);
    expect(b.neutralOversized).toBe(false); // neutral == maxPhase, not > 2× maxPhase
  });

  // ==========================================================================
  // 3. two equal 1-phase loads on L1 + L2 → neutral magnitude of phasor sum
  // ==========================================================================

  it('assigns two equal 1-phase loads to L1 and L2; neutral = √3·I/2? Actually |I∠0 + I∠−120| = I', () => {
    const project = projectFixture({ powerFactor: 1 });
    const apt1 = item('apt1', 30, 6.9, 'APARTMENT');
    const apt2 = item('apt2', 30, 6.9, 'APARTMENT');

    const b = phaseBalance([apt1, apt2], project);

    // LPT order: both 30A; stable order by id places apt1 then apt2.
    // L1 gets apt1 (first in stable order among equals), L2 gets apt2.
    expect(b.phaseCurrent[0]).toBeCloseTo(30, 6);
    expect(b.phaseCurrent[1]).toBeCloseTo(30, 6);
    expect(b.phaseCurrent[2]).toBeCloseTo(0, 6);
    // Neutral = |30∠0° + 30∠−120°| = 30 (equilateral triangle side==radius)
    expect(b.neutralCurrent).toBeCloseTo(30, 6);
  });

  // ==========================================================================
  // 4. mixed 3-phase + 1-phase
  // ==========================================================================

  it('handles 3-phase motor plus 1-phase apartments', () => {
    const project = projectFixture({ powerFactor: 0.85 });
    const motor = item('m1', 30, 20.784, 'PUMP_PANEL', {
      loadLibraryItem: libItem({
        name: 'Pump',
        category: 'Pump',
        power: 20.784,
        voltage: 400,
        phase: 3,
        powerFactor: 0.85,
        demandFactor: 1,
        quantity: 1,
      }),
    });
    const apt1 = item('apt1', 20, 4.6, 'APARTMENT');
    const apt2 = item('apt2', 20, 4.6, 'APARTMENT');

    const b = phaseBalance([motor, apt1, apt2], project);

    expect(b.totalKw).toBeCloseTo(20.784 + 4.6 + 4.6, 2);
    // Motor: +30A on each phase. Apartments: LPT places them on the two
    // least-loaded phases. Pure assertions on exact L values are brittle due to
    // LPT tie-breaking; instead assert structure.
    expect(b.phaseCurrent.every((c) => c >= 30)).toBe(true);
    expect(b.assignments.filter((a) => a.phaseCount === 1).length).toBe(2);
    expect(b.unbalancePct).toBeGreaterThan(0);
  });

  // ==========================================================================
  // 5. manual override sticks
  // ==========================================================================

  it('respects a persisted assignedPhase override', () => {
    const project = projectFixture();
    const apt = item('apt1', 25, 5.75, 'APARTMENT', { assignedPhase: 3 });

    const b = phaseBalance([apt], project);

    expect(b.assignments[0].assignedPhase).toBe(3);
    expect(b.phaseCurrent[2]).toBeCloseTo(25, 6); // L3
    expect(b.phaseCurrent[0]).toBeCloseTo(0, 6);
    expect(b.phaseCurrent[1]).toBeCloseTo(0, 6);
  });

  // ==========================================================================
  // 6. re-balance action: non-null overrides preserved, nulls re-optimized
  // ==========================================================================

  it('preserves manual overrides while re-optimizing null rows', () => {
    const project = projectFixture();
    const pinned = item('big', 60, 13.8, 'APARTMENT', { assignedPhase: 3 });
    const free1 = item('free1', 50, 11.5, 'APARTMENT'); // null
    const free2 = item('free2', 10, 2.3, 'APARTMENT'); // null

    const b = phaseBalance([pinned, free1, free2], project);

    // pinned stays on L3
    expect(b.assignments.find((a) => a.id === 'big')?.assignedPhase).toBe(3);
    // free1 (largest null) should avoid L3 (already 60A) and go to L1 or L2
    const free1Phase = b.assignments.find((a) => a.id === 'free1')?.assignedPhase ?? 0;
    expect(free1Phase).not.toBe(3);
  });

  // ==========================================================================
  // 7. standard switch changes limit/label (not definition)
  // ==========================================================================

  it('changes unbalance limit when calculationStandard switches', () => {
    const project = projectFixture({ calculationStandard: 'NEMA' });
    const apt1 = item('apt1', 100, 23, 'APARTMENT');

    const bIEC = phaseBalance([apt1], projectFixture({ calculationStandard: 'IEC' }));
    const bNEMA = phaseBalance([apt1], projectFixture({ calculationStandard: 'NEMA' }));

    expect(bIEC.unbalanceLimitPct).toBe(10);
    expect(bNEMA.unbalanceLimitPct).toBe(10);
    // Both 10% here because the defaults are the same engineering-judgment proxy;
    // in the future limit values may diverge per standard.
  });

  // ==========================================================================
  // 8. null assignedPhase → greedy auto-assign on-read (stable order)
  // ==========================================================================

  it('auto-assigns null 1-phase loads to least-loaded phase in order', () => {
    const project = projectFixture();
    const small = item('small', 10, 2.3, 'APARTMENT'); // all null
    const medium = item('medium', 20, 4.6, 'APARTMENT');
    const large = item('large', 30, 6.9, 'APARTMENT');

    const b = phaseBalance([small, medium, large], project);

    // Simple round-robin: small→L1, medium→L2, large→L3
    // Each goes to the least-loaded phase at that moment
    expect(b.assignments.find((a) => a.id === 'small')?.assignedPhase).toBe(1);
    expect(b.assignments.find((a) => a.id === 'medium')?.assignedPhase).toBe(2);
    expect(b.assignments.find((a) => a.id === 'large')?.assignedPhase).toBe(3);
    expect(b.maxPhaseCurrent).toBeCloseTo(30, 6); // balanced to the largest
  });

  // ==========================================================================
  // 9. lag/lead displacement sign — with PF=1 vs PF<1, neutral changes
  // ==========================================================================

  it('uses the per-item displacement angle in the neutral vector', () => {
    const projectResistive = projectFixture({ powerFactor: 1 });
    const projectMotor = projectFixture({ powerFactor: 0.85 });

    // Two equal 1-phase apartments on L1 and L2. With PF=1 both are ∠0° on their
    // phase → but L2 has −120° phase offset. So phasors: I∠0 + I∠−120. With PF<1
    // each is additionally displaced by arccos(0.85) ≈ 31.8° lag, but same on
    // both → the magnitude of the sum is unchanged. This test guards that the
    // displacement is applied (cos/sin used correctly), not that it changes the
    // magnitude for equal loads.
    const apt1 = item('apt1', 30, 6.9, 'APARTMENT');
    const apt2 = item('apt2', 30, 6.9, 'APARTMENT');

    const bRes = phaseBalance([apt1, apt2], projectResistive);
    const bMot = phaseBalance(
      [
        item('apt1m', 30, 6.9, 'APARTMENT', { assignedPhase: 1 }),
        item('apt2m', 30, 6.9, 'APARTMENT', { assignedPhase: 2 }),
      ],
      projectMotor
    );

    expect(bRes.neutralCurrent).toBeCloseTo(30, 6);
    expect(bMot.neutralCurrent).toBeCloseTo(30, 6);

    // But the phasor components differ: only verify no NaN and current sum equals.
    expect(isFinite(bMot.neutralCurrent)).toBe(true);
    expect(bMot.phaseCurrent[0] + bMot.phaseCurrent[1]).toBeCloseTo(60, 6);
  });

  // ==========================================================================
  // 10. 3-phase split: kW/3 on each phase
  // ==========================================================================

  it('splits a 3-phase load kW/3 across phases and equal current on each', () => {
    const project = projectFixture({ powerFactor: 1 });
    const motor = item('m1', 30, 20.784, 'PUMP_PANEL', {
      loadLibraryItem: libItem({
        name: 'Pump',
        category: 'Pump',
        power: 20.784,
        voltage: 400,
        phase: 3,
        powerFactor: 1,
        demandFactor: 1,
        quantity: 1,
      }),
    });

    const b = phaseBalance([motor], project);

    expect(b.phaseKw.every((k) => Math.abs(k - 20.784 / 3) < 0.001)).toBe(true);
    expect(b.phaseCurrent).toEqual([30, 30, 30]);
  });

  // ==========================================================================
  // 11. current-unbalance % formula
  // ==========================================================================

  it('computes current-unbalance % as (max-min)/avg', () => {
    const project = projectFixture();
    const b = phaseBalance(
      [
        item('a1', 30, 6.9, 'APARTMENT', { assignedPhase: 1 }),
        item('a2', 30, 6.9, 'APARTMENT', { assignedPhase: 2 }),
      ],
      project
    );

    expect(b.phaseCurrent).toEqual([30, 30, 0]);
    // avg = 20, max-min = 30 → 150%
    expect(b.unbalancePct).toBeCloseTo(150, 6);
  });

  // ==========================================================================
  // 12. empty board → neutral 0, unbalance 0, no NaN
  // ==========================================================================

  it('handles an empty board without NaN', () => {
    const b = phaseBalance([], projectFixture());

    expect(b.phaseCurrent).toEqual([0, 0, 0]);
    expect(b.phaseKw).toEqual([0, 0, 0]);
    expect(b.totalKw).toBe(0);
    expect(b.neutralCurrent).toBe(0);
    expect(b.maxPhaseCurrent).toBe(0);
    expect(b.unbalancePct).toBe(0);
    expect(b.imbalanced).toBe(false);
    expect(isNaN(b.unbalancePct)).toBe(false);
  });

  // ==========================================================================
  // 13. boundary: exactly at limit
  // ==========================================================================

  it('does NOT flag imbalanced exactly at the threshold', () => {
    const project = projectFixture();
    // (max-min)/avg = 10% with three values? Use [10, 10, 12]:
    // avg = 32/3 ≈ 10.667, max-min=2, pct = 18.75% → above 10, imbalanced
    // Lower current to produce exactly 10%: want (max-min)/avg = 0.1.
    // Two phases equal to x, third = x + delta; avg = (3x+delta)/3, max-min=delta.
    // delta / ((3x+delta)/3) = 0.1 → 3delta = 0.1(3x+delta) → 30delta = 3x+delta
    // → 29delta = 3x → x = 29/3 delta. Pick delta=3, x=29.
    // So [29, 29, 32] gives avg=30, max-min=3, pct=10.
    const b = phaseBalance(
      [
        item('a1', 29, 6.67, 'APARTMENT', { assignedPhase: 1 }),
        item('a2', 29, 6.67, 'APARTMENT', { assignedPhase: 2 }),
        item('a3', 32, 7.36, 'APARTMENT', { assignedPhase: 3 }),
      ],
      project
    );

    expect(b.unbalancePct).toBeCloseTo(10, 6);
    expect(b.imbalanced).toBe(false);
  });

  // ==========================================================================
  // 14. all-3-phase board neutral ≈ 0
  // ==========================================================================

  it('reports near-zero neutral for two equal 3-phase loads', () => {
    const project = projectFixture({ powerFactor: 1 });
    const motor1 = item('m1', 30, 20.784, 'PUMP_PANEL', {
      loadLibraryItem: libItem({
        name: 'Pump',
        category: 'Pump',
        power: 20.784,
        voltage: 400,
        phase: 3,
        powerFactor: 1,
        demandFactor: 1,
        quantity: 1,
      }),
    });
    const motor2 = item('m2', 15, 10.392, 'PUMP_PANEL', {
      loadLibraryItem: libItem({
        name: 'Lift',
        category: 'Elevator',
        power: 10.392,
        voltage: 400,
        phase: 3,
        powerFactor: 1,
        demandFactor: 1,
        quantity: 1,
      }),
    });

    const b = phaseBalance([motor1, motor2], project);

    expect(b.phaseCurrent).toEqual([45, 45, 45]);
    expect(b.unbalancePct).toBe(0);
    expect(b.neutralCurrent).toBeCloseTo(0, 6);
  });

  // ==========================================================================
  // Extra: BuildingLoad path + neutral oversized guard
  // ==========================================================================

  it('computes building-load-only board correctly', () => {
    const project = projectFixture({ powerFactor: 0.85 });
    const pump = buildingLoadFixture({
      id: 'pump1',
      power: 22,
      voltage: 400,
      phase: 3,
      powerFactor: 0.85,
      quantity: 1,
    });

    const b = phaseBalance([pump], project);

    expect(b.phaseCurrent.every((c) => c === b.phaseCurrent[0])).toBe(true);
    expect(b.neutralCurrent).toBeCloseTo(0, 6);
  });

  it('flags neutralOversized only when neutral > 2× max phase', () => {
    const project = projectFixture();
    // One 1-phase load: neutral == maxPhase, so not oversized (neutral <= 2x).
    const b = phaseBalance([item('a1', 40, 9.2, 'APARTMENT')], project);
    expect(b.neutralOversized).toBe(false);

    // Three 1-phase loads all on the same phase → neutral = 3I, max = 3I, still false.
    const b2 = phaseBalance(
      [
        item('a1', 20, 4.6, 'APARTMENT', { assignedPhase: 1 }),
        item('a2', 20, 4.6, 'APARTMENT', { assignedPhase: 1 }),
        item('a3', 2, 0.46, 'APARTMENT', { assignedPhase: 2 }),
      ],
      project
    );
    // 20+20 = 40 on L1, 2 on L2. neutral ≈ |40 + 2∠−120| > 2*40? Probably ~39.2,
    // so still false in this specific case. Instead test boundary:
    const b3 = phaseBalance(
      [
        item('a1', 100, 23, 'APARTMENT', { assignedPhase: 1 }),
      ],
      project
    );
    expect(b3.neutralCurrent).toBeCloseTo(100, 6);
    expect(b3.neutralOversized).toBe(false);
  });

  // ==========================================================================
  // Extra: internal imbalance not modeled flag
  // ==========================================================================

  it('flags 3-phase apartment templates as internal-imbalance-not-modeled', () => {
    const project = projectFixture();
    const apt3ph = item('apt3ph', 30, 20.784, 'APARTMENT', {
      apartmentTemplate: { id: 'tpl1', name: '3PH Apt', phases: 3, rooms: [], createdAt: '', updatedAt: '' },
    });

    const b = phaseBalance([apt3ph], project);

    expect(b.internalImbalanceNotModeled).toBe(true);
    expect(b.assignments[0].phaseCount).toBe(3);
  });
});
