# Implementation Plan - Multi-Apartment Single Floor Consolidation & SLD Generator Fix

## Problem Statement
When a project is created via MCP with multiple apartment templates assigned to the same floor (e.g., Floor 1 having both "Apartment 1 (Upper Unit)" and "Apartment 2 (Lower Unit)"):
1. `src/lib/agent/build-project.ts` iterates over `bldg.floorAssignments` and executes `tx.floorDesign.create` for every entry. This creates multiple `FloorDesign` database records with the same `floorNumber: 1`. In the UI calculator table, this displays two separate "F1" cards (each with 1 circuit) instead of one unified "F1" card containing both apartment circuits.
2. `src/lib/sld/generator.ts` generates floor buses keyed by `floor_bus_${bldgPrefix}_${fd.floorNumber}`. When multiple `FloorDesign` records share the same `floorNumber`, it outputs duplicate bus nodes (e.g. `floor_bus_..._1`), causing Mermaid/SLD parsers to crash with `Duplicate node id`.
3. In existing project `264592a9-d23f-40da-8f1e-9e838be9ac60`, Floor 1 is currently split into two duplicate F1 records, causing both the UI duplicate cards and the SLD error.

## Objective
1. Consolidate `FloorDesign` creation in `build-project.ts` (in both `create_project_from_spec` and `update_project_spec`) so all apartment assignments for a given `floorNumber` in a building are mapped to a single `FloorDesign` record.
2. Group floors by `floorNumber` in `src/lib/sld/generator.ts` so duplicate node IDs are physically impossible even if legacy data has duplicate floor designs.
3. Update project `264592a9-d23f-40da-8f1e-9e838be9ac60` using ProCal MCP tools so Floor 1 contains both apartments under one single F1 panel with balanced phases.
4. Verify with full unit test suite (`npm test`), verify SLD generation for `264592a9-d23f-40da-8f1e-9e838be9ac60`, and update knowledge graph.

---

## Phases & Tasks

### Phase 1: Consolidate FloorDesign in `build-project.ts`
- **Files**: `src/lib/agent/build-project.ts`, `src/lib/agent/__tests__/build-project.test.ts`
- **Action**:
  - In `create_project_from_spec`: Maintain a `floorDesignsMap = new Map<number, FloorDesign>()` per building. For each `fa` in `bldg.floorAssignments`, check if a `FloorDesign` for `fa.floorNumber` already exists. If not, create it. If it does, reuse it and append `FloorItem`s to that floor design.
  - In `update_project_spec`: Similarly, ensure when creating or updating floors from `floorAssignments`, entries with the same `floorNumber` share the same `FloorDesign` and do not create duplicate floor records.
- **Proof**: Unit tests with multiple apartment templates on the same floor verifying exactly 1 `FloorDesign` record is created per floor number.

### Phase 2: SLD Generator Floor Grouping
- **Files**: `src/lib/sld/generator.ts`, `src/lib/sld/__tests__/generator.test.ts` (or relevant SLD tests)
- **Action**:
  - Group `bldg.floorDesigns` by `floorNumber` (combining items) before emitting Mermaid bus nodes.
  - Ensure unique node IDs and consistent single bus per floor level.
- **Proof**: Run SLD generator on project specs with multiple floor design entries; verify no duplicate IDs.

### Phase 3: Update Existing Project via MCP
- **Action**:
  - Use `procal` MCP tool `update_project_spec` on project `264592a9-d23f-40da-8f1e-9e838be9ac60` with consolidated floor assignments.
  - Verify `check_project_compliance` and `get_project_sld` return 200 without duplicate node error.
  - Check phase balance and report download.

### Phase 4: Verification & Test Suite
- **Action**: Run `npm test` across all 87 test files to ensure 100% pass rate with no regressions.
- **Proof**: All 939+ tests pass.
