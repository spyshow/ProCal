# Implementation Plan: 5-Stage Conversational AI Project Creation Workflow

## Summary of User Goal
Implement an interactive, 5-stage conversational workflow for AI agents creating projects in ProCal via the MCP server:
1. **Stage 1 (Country & Load Demand Defaults)**: Prompt user for the country, display standard regional electrical parameters and load densities (voltage, frequency, power factor, IEC/NEMA, VA/m², AC sizing), and pause for user confirmation or adjustments.
2. **Stage 2 (Project Architecture & Setup)**: Atomically create the project with confirmed parameters (`create_project_from_spec`), establishing buildings, apartment templates, floor assignments, and mechanical/service loads.
3. **Stage 3 (Breaker Manufacturer & Selectivity)**: Prompt user for preferred circuit breaker manufacturer (Schneider, ABB, Siemens, etc.), apply authentic catalog models, and automatically grade trip settings ($I_r, I_{sd}, t_{sd}$) to eliminate curve overlaps, alerting only if physical coordination limits prevent full selectivity.
4. **Stage 4 (Cable Defaults & Circuit Lengths)**: Present cable configuration defaults (Copper, XLPE, ambient temp, installation method) with an auto-estimated circuit length table; allow single-word confirmation or custom length/parameter overrides via a dedicated `update_project_cables` MCP tool.
5. **Stage 5 (Global Recalculate & Deliverables)**: Trigger complex-wide recalculation across all buildings and return the complete engineering package (load & demand summary, compliance audit, selectivity status, BOM takeoff, SLD preview/links, and signed PDF report download link).

---

## Phases & Tasks

### Phase 1: New MCP Tool `update_project_cables`
- **File**: `src/lib/mcp/server.ts`, `src/lib/agent/build-project.ts`
- **Action**:
  - Add `update_project_cables` MCP tool schema and handler.
  - Parameters: `projectId`, `defaults` (material, insulation, installationMethod, ambientTemp), and array `circuitLengths` (specifying circuit type: incomer, riser, apartment/floorItem, or buildingLoad with their respective lengths in meters).
  - Atomically update database records for buildings, floors, floor items, and building loads, then invoke global complex-wide recalculation.
- **Proof**: Unit tests in `src/lib/mcp/__tests__/server.test.ts` verifying cable lengths and parameters are persisted and reflected in recalculation and BOM.

### Phase 2: Breaker Manufacturer Setting & Automatic Selectivity Grading in MCP
- **File**: `src/lib/mcp/server.ts`, `src/lib/agent/build-project.ts`, `src/lib/calculations/selectivity.ts`
- **Action**:
  - Support setting/updating preferred breaker manufacturer in `update_project_spec`.
  - Expose selectivity verification in `check_project_compliance` (or `check_project_selectivity`), checking upstream/downstream coordination curves using catalog curves and tested manufacturer matrices (ABB DOC / Schneider ECODIAL), and adjusting settings to resolve overlaps where feasible.
- **Proof**: Unit test verifying manufacturer preference persistence and coordination checks returning status and limits.

### Phase 3: Update `drawing-to-procal-workflow` System Prompt
- **File**: `src/lib/mcp/server.ts`
- **Action**:
  - Rewrite `drawing-to-procal-workflow` prompt to strictly enforce the 5-stage conversational interview protocol for any AI agent interacting with ProCal via MCP.
  - Ensure clear step-by-step gates where the agent must stop and await user input before proceeding to subsequent stages.
- **Proof**: Verify prompt definition returns the structured 5-stage instructions.

### Phase 4: Full Test Suite Verification & Quality Assurance
- **Action**:
  - Run all unit and integration tests (`npm test`).
  - Verify all 87+ test suites pass with 0 errors.
- **Proof**: Full test runner output clean.
