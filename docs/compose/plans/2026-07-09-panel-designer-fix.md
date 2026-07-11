# Panel Designer Fix & Breaker Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Panel Designer functional with correct MDB/SMDB distribution logic, accurate breaker sizing from Load Calculator, and add a Breaker Schedule page.

**Architecture:** 
- MDB shows: sub-panel feeders (floors with sub-panels) + direct apartment feeders (floors without) + other load feeders (pumps, elevators, etc.)
- SMDB shows: per-floor sub-panel feeding apartments on that floor only
- Breaker Schedule is a separate page under Cable Schedule with building filter

**Tech Stack:** Next.js App Router, React, SVG, Prisma/SQLite

---

## Task 1: Fix MDB Feeders Logic

**Covers:** Correct MDB distribution showing sub-panels + direct apartments + other loads

**Files:**
- Modify: `src/app/(app)/panel/page.tsx:88-115`

**Interfaces:**
- Consumes: `project.buildings[].floorDesigns[].items[]`, `project.buildings[].floorDesigns[].hasFloorSubPanels`
- Produces: `mdbFeeders: PanelFeeder[]` with correct types

- [ ] **Step 1: Replace the feeder aggregation logic**

Replace lines 90-115 with:

```typescript
// Aggregate feeders for MDB
const mdbFeeders: PanelFeeder[] = [];

for (const fd of bldg.floorDesigns) {
  if (fd.hasFloorSubPanels) {
    // Floor has sub-panel: one feeder for the SMDB
    const floorDemand = fd.items.reduce((s, i) => s + i.calculatedCurrent, 0);
    const floorSizing = sizeCableAndBreaker(floorDemand, true, {
      material: 'copper',
      insulation: 'XLPE',
      ambientTemp: 30,
      groupingCount: 1,
    });
    const mccb = findBreaker(floorSizing.breakerSize, 'MCCB');
    mdbFeeders.push({
      name: `Floor ${fd.floorNumber} — SMDB`,
      type: 'SUB_PANEL',
      current: floorDemand,
      breakerSize: floorSizing.breakerSize,
      cableSize: floorSizing.cableSize,
      breakerModel: mccb ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}` : `MCCB ${floorSizing.breakerSize}`,
    });
  } else {
    // Floor has no sub-panel: direct feeders to each apartment
    for (const item of fd.items) {
      const sizing = sizeCableAndBreaker(item.calculatedCurrent, item.type === 'APARTMENT', {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 30,
        groupingCount: 2,
      });
      const mccb = findBreaker(sizing.breakerSize, 'MCCB');
      mdbFeeders.push({
        name: `F${fd.floorNumber} — ${item.name}`,
        type: item.type,
        current: item.calculatedCurrent,
        breakerSize: sizing.breakerSize,
        cableSize: sizing.cableSize,
        breakerModel: mccb ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}` : `MCCB ${sizing.breakerSize}`,
      });
    }
  }
}

// Add other building loads (pumps, elevators, etc.)
if (bldg.elevators > 0) {
  const elevCurrent = bldg.elevators * 30; // Assume 30A per elevator
  const elevSizing = sizeCableAndBreaker(elevCurrent, true, {
    material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1,
  });
  const mccb = findBreaker(elevSizing.breakerSize, 'MCCB');
  mdbFeeders.push({
    name: 'Elevator',
    type: 'ELEVATOR',
    current: elevCurrent,
    breakerSize: elevSizing.breakerSize,
    cableSize: elevSizing.cableSize,
    breakerModel: mccb ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}` : `MCCB ${elevSizing.breakerSize}`,
  });
}

if (bldg.waterPumps > 0) {
  const pumpCurrent = bldg.waterPumps * 15; // Assume 15A per pump
  const pumpSizing = sizeCableAndBreaker(pumpCurrent, true, {
    material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1,
  });
  const mccb = findBreaker(pumpSizing.breakerSize, 'MCCB');
  mdbFeeders.push({
    name: 'Water Pump',
    type: 'PUMP_PANEL',
    current: pumpCurrent,
    breakerSize: pumpSizing.breakerSize,
    cableSize: pumpSizing.cableSize,
    breakerModel: mccb ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}` : `MCCB ${pumpSizing.breakerSize}`,
  });
}

if (bldg.firePump) {
  const fireCurrent = 40; // Assume 40A for fire pump
  const fireSizing = sizeCableAndBreaker(fireCurrent, true, {
    material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1,
  });
  const mccb = findBreaker(fireSizing.breakerSize, 'MCCB');
  mdbFeeders.push({
    name: 'Fire Pump',
    type: 'PUMP_PANEL',
    current: fireCurrent,
    breakerSize: fireSizing.breakerSize,
    cableSize: fireSizing.cableSize,
    breakerModel: mccb ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}` : `MCCB ${fireSizing.breakerSize}`,
  });
}

if (bldg.splitAc > 0) {
  const acCurrent = bldg.splitAc * 10; // Assume 10A per split AC
  const acSizing = sizeCableAndBreaker(acCurrent, true, {
    material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1,
  });
  const mccb = findBreaker(acSizing.breakerSize, 'MCCB');
  mdbFeeders.push({
    name: 'Split AC',
    type: 'SERVICE_PANEL',
    current: acCurrent,
    breakerSize: acSizing.breakerSize,
    cableSize: acSizing.cableSize,
    breakerModel: mccb ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}` : `MCCB ${acSizing.breakerSize}`,
  });
}

if (bldg.centralAc > 0) {
  const casCurrent = bldg.centralAc * 50; // Assume 50A for central AC
  const casSizing = sizeCableAndBreaker(casCurrent, true, {
    material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1,
  });
  const mccb = findBreaker(casSizing.breakerSize, 'MCCB');
  mdbFeeders.push({
    name: 'Central AC',
    type: 'SERVICE_PANEL',
    current: casCurrent,
    breakerSize: casSizing.breakerSize,
    cableSize: casSizing.cableSize,
    breakerModel: mccb ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}` : `MCCB ${casSizing.breakerSize}`,
  });
}
```

- [ ] **Step 2: Update references from `allFeeders` to `mdbFeeders`**

Replace all occurrences of `allFeeders` with `mdbFeeders` in the JSX section.

- [ ] **Step 3: Test MDB view**

Navigate to Panel Designer, select a building. Verify:
- Floors with sub-panels show single "Floor X — SMDB" feeder
- Floors without sub-panels show individual apartment feeders
- Other loads (elevators, pumps) appear as separate feeders

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/panel/page.tsx
git commit -m "fix: implement correct MDB feeder logic with sub-panels and other loads"
```

---

## Task 2: Implement SMDB Feeders Logic

**Covers:** SMDB view showing per-floor sub-panel feeding apartments

**Files:**
- Modify: `src/app/(app)/panel/page.tsx`

**Interfaces:**
- Consumes: `project.buildings[].floorDesigns[].items[]`
- Produces: `smdbFeeders: PanelFeeder[]` for selected floor

- [ ] **Step 1: Add floor selector state and SMDB feeder logic**

After the `panelType` state, add:

```typescript
const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
```

After the MDB feeder logic block, add SMDB logic:

```typescript
// SMDB feeders - only for floors with sub-panels
const smdbFloors = bldg.floorDesigns.filter(fd => fd.hasFloorSubPanels);
const activeSmdbFloor = selectedFloor || (smdbFloors.length > 0 ? smdbFloors[0].floorNumber : null);

const smdbFeeders: PanelFeeder[] = [];
if (activeSmdbFloor) {
  const fd = bldg.floorDesigns.find(f => f.floorNumber === activeSmdbFloor);
  if (fd) {
    for (const item of fd.items) {
      const sizing = sizeCableAndBreaker(item.calculatedCurrent, item.type === 'APARTMENT', {
        material: 'copper',
        insulation: 'XLPE',
        ambientTemp: 30,
        groupingCount: 2,
      });
      const mccb = findBreaker(sizing.breakerSize, 'MCCB');
      smdbFeeders.push({
        name: item.name,
        type: item.type,
        current: item.calculatedCurrent,
        breakerSize: sizing.breakerSize,
        cableSize: sizing.cableSize,
        breakerModel: mccb ? `${mccb.manufacturer} ${mccb.series} ${mccb.model}` : `MCCB ${sizing.breakerSize}`,
      });
    }
  }
}

// Use appropriate feeders based on panel type
const activeFeeders = panelType === 'MDB' ? mdbFeeders : smdbFeeders;
```

- [ ] **Step 2: Add floor selector for SMDB view**

In the JSX, after the building selector, add:

```tsx
{/* Floor Selector for SMDB */}
{panelType === 'SMDB' && smdbFloors.length > 0 && (
  <div className="flex gap-2">
    {smdbFloors.map(fd => (
      <button
        key={fd.floorNumber}
        onClick={() => setSelectedFloor(fd.floorNumber)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          activeSmdbFloor === fd.floorNumber ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
        }`}
      >
        Floor {fd.floorNumber}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3: Update all `allFeeders` references to `activeFeeders`**

Replace remaining `allFeeders` with `activeFeeders` in SVG and table sections.

- [ ] **Step 4: Test SMDB view**

Click SMDB toggle. Verify:
- Floor selector appears showing floors with sub-panels
- Feeders show individual apartments on selected floor
- Switching floors updates the feeders

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/panel/page.tsx
git commit -m "feat: implement SMDB view with per-floor apartment feeders"
```

---

## Task 3: Add Floor Selector to SVG Title

**Covers:** Clear visual indication of which floor SMDB is shown

**Files:**
- Modify: `src/app/(app)/panel/page.tsx` (SVG title section)

- [ ] **Step 1: Update SVG title for SMDB**

Replace the Panel Title text in SVG:

```tsx
{/* Panel Title */}
<text x="400" y="50" textAnchor="middle" fill="#9ca3af" fontSize="14" fontWeight="600">
  {panelType} — {bldg.name} — {panelType === 'SMDB' && activeSmdbFloor ? `Floor ${activeSmdbFloor}` : ''} — {preferredManufacturer}
</text>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/panel/page.tsx
git commit -m "fix: show floor number in SMDB panel title"
```

---

## Task 4: Create Breaker Schedule Page

**Covers:** New page under Cable Schedule listing all breakers filterable by building

**Files:**
- Create: `src/app/(app)/breaker-schedule/page.tsx`
- Modify: `src/components/Sidebar.tsx` (add nav item)

**Interfaces:**
- Consumes: project data from API
- Produces: Breaker Schedule page with building filter

- [ ] **Step 1: Create breaker-schedule page**

Create `src/app/(app)/breaker-schedule/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import { CircuitBoard, Filter } from 'lucide-react';
import { sizeCableAndBreaker } from '@/lib/calculations/cables';
import type { Project } from '@/types';

interface BreakerEntry {
  id: string;
  name: string;
  type: string;
  floor: number;
  building: string;
  current: number;
  breakerSize: number;
  cableSize: number;
  isThreePhase: boolean;
}

export default function BreakerSchedulePage() {
  const { selectedProjectId, preferredManufacturer } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [breakers, setBreakers] = useState<BreakerEntry[]>([]);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedProjectId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  useEffect(() => {
    if (!project) return;

    const breakerList: BreakerEntry[] = [];

    for (const bldg of project.buildings) {
      for (const fd of bldg.floorDesigns) {
        if (fd.hasFloorSubPanels) {
          // Add SMDB main breaker
          const floorDemand = fd.items.reduce((s, i) => s + i.calculatedCurrent, 0);
          const sizing = sizeCableAndBreaker(floorDemand, true, {
            material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 1,
          });
          breakerList.push({
            id: `smdb-${bldg.id}-${fd.floorNumber}`,
            name: `Floor ${fd.floorNumber} — SMDB`,
            type: 'SUB_PANEL',
            floor: fd.floorNumber,
            building: bldg.name,
            current: floorDemand,
            breakerSize: sizing.breakerSize,
            cableSize: sizing.cableSize,
            isThreePhase: true,
          });
        }

        for (const item of fd.items) {
          const isThreePhase = item.type !== 'APARTMENT' || (item as any).apartmentTemplate?.phases === 3;
          const sizing = sizeCableAndBreaker(item.calculatedCurrent, isThreePhase, {
            material: 'copper', insulation: 'XLPE', ambientTemp: 30, groupingCount: 2,
          });
          breakerList.push({
            id: item.id,
            name: `F${fd.floorNumber} — ${item.name}`,
            type: item.type,
            floor: fd.floorNumber,
            building: bldg.name,
            current: item.calculatedCurrent,
            breakerSize: sizing.breakerSize,
            cableSize: sizing.cableSize,
            isThreePhase,
          });
        }
      }
    }

    setBreakers(breakerList);
  }, [project]);

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>;
  if (!project) return <div className="flex items-center justify-center h-full"><p className="text-gray-400 text-sm">Select a project first.</p></div>;

  const filteredBreakers = selectedBuilding === 'all'
    ? breakers
    : breakers.filter(b => b.building === project.buildings.find(bldg => bldg.id === selectedBuilding)?.name);

  // Group by type
  const grouped = filteredBreakers.reduce((acc, b) => {
    if (!acc[b.type]) acc[b.type] = [];
    acc[b.type].push(b);
    return acc;
  }, {} as Record<string, BreakerEntry[]>);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CircuitBoard size={22} className="text-orange-500" />
            Breaker Schedule
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name} — {preferredManufacturer}</p>
        </div>
      </div>

      {/* Building Filter */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-gray-500" />
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedBuilding('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedBuilding === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            All Buildings
          </button>
          {project.buildings.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedBuilding === b.id ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* Breaker Tables by Type */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <h3 className="text-sm font-bold text-orange-400 mb-3">{type.replace('_', ' ')}</h3>
          <table className="w-full engineering-table text-xs">
            <thead>
              <tr>
                <th className="text-left">Feeder</th>
                <th className="text-left">Building</th>
                <th className="text-center">Floor</th>
                <th className="text-right">Current (A)</th>
                <th className="text-center">Breaker (A)</th>
                <th className="text-center">Cable (mm²)</th>
                <th className="text-center">Phase</th>
              </tr>
            </thead>
            <tbody>
              {items.map(b => (
                <tr key={b.id} className="hover:bg-gray-800/30">
                  <td className="text-gray-200 font-semibold">{b.name}</td>
                  <td className="text-gray-400">{b.building}</td>
                  <td className="text-center font-mono text-orange-400">F{b.floor}</td>
                  <td className="text-right font-mono">{b.current.toFixed(1)}</td>
                  <td className="text-center font-mono text-blue-400">{b.breakerSize}</td>
                  <td className="text-center font-mono text-green-400">{b.cableSize}</td>
                  <td className="text-center font-mono">{b.isThreePhase ? '3Φ' : '1Φ'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Summary */}
      <div className="text-[10px] text-gray-600">
        <p>Total breakers: {filteredBreakers.length} | {preferredManufacturer} series</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add navigation item**

In `src/components/Sidebar.tsx`, add `CircuitBoard` import and nav item after Cable Schedule:

```tsx
import { ..., CircuitBoard } from "lucide-react";

const NAV_ITEMS: NavItem[] = [
  ...
  { label: "Cable Schedule",   href: "/cable-schedule", icon: Cable           },
  { label: "Breaker Schedule", href: "/breaker-schedule", icon: CircuitBoard  },
  { label: "Panel Designer",   href: "/panel",          icon: Cpu             },
  ...
];
```

- [ ] **Step 3: Test Breaker Schedule**

Navigate to Breaker Schedule. Verify:
- Lists all breakers from all buildings
- Building filter works
- Shows SMDB main breakers and individual apartment breakers
- Correct breaker sizes from Load Calculator

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/breaker-schedule/page.tsx src/components/Sidebar.tsx
git commit -m "feat: add Breaker Schedule page with building filter"
```

---

## Task 5: Clean Up Debug Logging

**Covers:** Remove console.log statements added for debugging

**Files:**
- Modify: `src/app/(app)/cable-schedule/page.tsx`
- Modify: `src/app/api/floor-items/[id]/route.ts`

- [ ] **Step 1: Remove debug logs from cable-schedule page**

Remove the `console.log` and `.then(data => console.log(...))` lines from `updateCableField`.

- [ ] **Step 2: Remove debug logs from API route**

Remove the `console.log` lines from the PATCH handler.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/cable-schedule/page.tsx src/app/api/floor-items/\[id\]/route.ts
git commit -m "chore: remove debug logging from cable schedule and API"
```

---

## Self-Review

1. **Spec coverage:** MDB feeders (Task 1), SMDB feeders (Task 2), SVG title (Task 3), Breaker Schedule page (Task 4), cleanup (Task 5) — all covered.

2. **Placeholder scan:** No TBDs or TODOs found. All code blocks are complete.

3. **Type consistency:** `PanelFeeder` interface used consistently. `activeFeeders` variable used in JSX.
