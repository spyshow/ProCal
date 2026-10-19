# Implementation Plan - In-Place Project Correction & Update via MCP

## Problem Statement
When an external AI agent creates a project in ProCal via MCP and the user subsequently asks to correct an entry (e.g. adjust a room area, template load, floor assignment, or voltage), the agent currently creates a brand new project using `create_project_from_spec`. This occurs because:
1. `update_project_loads` only accepts mechanical building loads and lacks support for apartment templates, rooms, floors, or project parameters.
2. The MCP server lacks explicit instructions and tool descriptions preventing duplicate creation and guiding agents on in-place corrections.

## Objective
Provide a unified, robust `update_project_spec` MCP tool that modifies existing projects in-place (upserting templates, rooms, floor schedules, building loads, and project parameters) with automatic complex-wide recalculation, and enforce agent behavior through tool descriptions, prompts, and return instructions.

---

## Phases & Tasks

### Phase 1: Schema Definition [COMPLETED]
- **File**: `src/lib/agent/project-spec-schema.ts`
- **Result**: `UpdateProjectSpecSchema`, `UpdateProjectSpec`, and `UpdateProjectSpecInput` defined, exported, and verified.

### Phase 2: In-Place Update Engine Implementation [COMPLETED]
- **File**: `src/lib/agent/build-project.ts`
- **Result**: `updateProjectSpec(user, rawSpec)` implemented with transactional upserts for electrical parameters, apartment templates, rooms, floor counts, floor items, and mechanical loads, with automated complex-wide recalculation (`recalculateProjectBuildings`). Added `instructionsForUpdates` to `createProjectFromSpec`.

### Phase 3: MCP Server Integration & Anti-Duplication Guardrails [COMPLETED]
- **File**: `src/lib/mcp/server.ts`
- **Result**: Registered `update_project_spec` in `MCP_TOOLS` and `executeTool`. Added strict anti-duplication warnings in `create_project_from_spec` description and prompt `drawing-to-procal-workflow`.

### Phase 4: Local MCP Definitions & Instructions [COMPLETED]
- **Files**: `C:\Users\jihad.kherfan.MCGI\.gemini\antigravity\mcp\procal\` (`instructions.md`, `create_project_from_spec.json`, `update_project_spec.json`).
- **Result**: Updated local Antigravity MCP tool schemas and instructions with anti-duplication warnings and `update_project_spec`.

### Phase 5: Verification & Regression Testing [COMPLETED]
- **Result**: 87 test files passed (929 tests total, 100% pass rate). Knowledge graph updated via `graphify update .`.
