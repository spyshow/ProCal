# 🗺️ Strategic Product Roadmap: ProCal

> **Vision:** ProCal — Low-voltage Electrical Design, Solved. End-to-end IEC 60364 & NEC load calculations, vector phase balancing, ABB/Schneider selectivity, Schematex SLD generation, and AI-native MCP engineering workflows with verifiable mathematical provenance.

**Generated:** 10/31/2026 | **Framework:** MoSCoW | **Version:** 1.0.0

## 🎯 Target Audience
- **Primary Persona:** Primary users

## 📊 MoSCoW Feature Distribution
- **Must Have (MVP Critical):** 3 features
- **Should Have (Competitive Parity):** 3 features
- **Could Have (Market Differentiators):** 2 features
- **Won't Have (Post-Launch Scope):** 0 features

## 📅 Phased Execution Plan

### Phase 1: Core Hardening, Security & Runtime Velocity (33% complete)
*Core multi-standard calculation engine, Free Trial gating, multi-tenant MCP security hardening, and high-impact PDF/Prisma runtime optimizations.*

#### [x] [FEAT-01] Multi-Standard Calculation Core (IEC 60364 / NEC), Vector Phase Balancing & Free Trial Gating `(MUST)`
Deterministic calculation engine for cable ampacity, voltage drop, IEC 60909 short-circuit fault currents, true 120° vector neutral balancing, and 1-building/4-level Free Trial onboarding with encrypted PDF exports.

- **Status:** `completed` | **Complexity:** `high` | **Impact:** `high`
- **Addresses Competitor Pain Points:** `CP-01`, `CP-03`, `CP-05`, `CP-07`
- **Rationale:** Core engineering physics foundation and frictionless SaaS trial onboarding.
- **User Story:**
  - *"As an MEP Consultant, I want automated IEC/NEC cable and breaker sizing with a risk-free 1-building Free Trial so that I can validate calculation accuracy before purchasing credits."*
- **Acceptance Criteria:**
  - [ ] IEC 60364-5-52 installation method multipliers, ambient temperature, and grouping derating pass all test suites
  - [ ] Fundamental protection chain Ib <= Ir <= In <= Iz enforced across main incomers and feeders (BreakerSchedule.tsx)
  - [ ] Uniform occupancy coincidence factor (IEC 61439-2 Clause 10.10) applied across multi-building residential complexes
  - [ ] 1-building, 4-level Free Trial gating with atomic transaction claim and Muhammara-encrypted watermarked PDF export

#### [ ] [FEAT-02] Multi-Tenant MCP Authorization Guard, Atomic Credit Deduction & PDF Route Hardening (sec-001..003, cq-003) `(MUST)`
Enforce unified owner/ProjectMember authorization across all 10 MCP tools, atomic conditional credit deduction (credits >= 1) in db.$transaction to prevent TOCTOU negative balances, and server-side watermark style integrity on PDF routes.

- **Status:** `planned` | **Complexity:** `medium` | **Impact:** `high`
- **Addresses Competitor Pain Points:** `CP-01`, `CP-02`
- **Rationale:** Eliminates remaining IDOR (sec-001), TOCTOU credit race conditions (sec-002), and client HTML watermark suppression (sec-003) before scaling multi-tenant traffic.
- **User Story:**
  - *"As a SaaS Platform Operator, I want every MCP tool and credit transaction guarded atomically so that tenant data and credit balances remain strictly isolated under concurrent load."*
- **Acceptance Criteria:**
  - [ ] assertMcpProjectAccess(projectId, ctx) enforced across check_project_compliance, check_project_selectivity, update_project_cables, and get_project_bom in src/lib/mcp/server.ts
  - [ ] Paid project creation (POST /api/projects, createProjectFromSpec) and trial upgrade (POST /api/projects/[id]/upgrade-trial) use atomic conditional updateMany({ where: { id: user.id, credits: { gte: 1 } } }) inside db.$transaction
  - [ ] POST /api/projects/[id]/pdf sanitizes untrusted <style>/<script> tags so .trial-watermark-overlay cannot be suppressed via CSS injection
  - [ ] Dedicated unit test suite src/app/api/projects/[id]/pdf/route.test.ts verifies signed JWT report tokens and CWE-22 path containment

#### [ ] [FEAT-03] Warm Chromium PDF Pool, Bulk Prisma createMany() Spec Builder & Foreign-Key Indexing (perf-001..003) `(MUST)`
Eliminate cold Chromium launch overhead via a warm singleton browser pool in server-pdf.ts, replace sequential room/item INSERT loops in build-project.ts with batched createMany(), and index foreign keys in prisma/schema.prisma.

- **Status:** `planned` | **Complexity:** `medium` | **Impact:** `high`
- **Addresses Competitor Pain Points:** `CP-02`, `CP-03`
- **Rationale:** Directly addresses the top runtime and database bottlenecks identified in the codebase ideation audit (perf-001, perf-002, perf-003).
- **User Story:**
  - *"As an Electrical Engineer exporting submittals or building multi-tower specs via AI, I want sub-second database transactions and fast PDF rendering without timeouts."*
- **Acceptance Criteria:**
  - [ ] src/lib/reports/server-pdf.ts maintains a warm singleton Chromium Browser instance using isolated per-request BrowserContext pages, cutting PDF export latency by 50–65%
  - [ ] createProjectFromSpec and updateProjectSpec in src/lib/agent/build-project.ts batch room and floor item inserts via tx.apartmentRoom.createMany and tx.floorItem.createMany, reducing multi-building build latency to <400ms
  - [ ] prisma/schema.prisma adds @@index([buildingId, floorNumber]) on FloorDesign, @@index([floorDesignId]) on FloorItem, and @@index([templateId]) on ApartmentRoom

### Phase 2: AI Agent Parity & Advanced IEC Protection Verification (0% complete)
*Full MCP agent trial parity, unified 8-section executive report rendering, IEC 60364-4-43 adiabatic thermal withstand (I²t <= k²S²), and modular codebase refactoring.*

#### [ ] [FEAT-04] MCP Agent Free Trial Provisioning, In-Chat Trial Upgrade & Unified 8-Section Base64 Report (ci-001, ci-002) `(SHOULD)`
Enable zero-credit Free Trial project creation directly through create_project_from_spec, add an in-chat upgrade_trial_project MCP tool, and unify get_project_report Base64 exports with the full 8-section renderReportHtml pipeline.

- **Status:** `planned` | **Complexity:** `medium` | **Impact:** `high`
- **Addresses Competitor Pain Points:** `CP-01`, `CP-02`, `CP-06`
- **Rationale:** Completes parity between the web UI and the 5-stage MCP AI workflow (ci-001, ci-002).
- **User Story:**
  - *"As an Engineer using Claude or Cursor with ProCal MCP, I want to start my Free Trial project, inspect the full 8-section PDF report, and upgrade my trial directly from chat."*
- **Acceptance Criteria:**
  - [ ] createProjectFromSpec in src/lib/agent/build-project.ts provisions a Free Trial project (isTrial: true) when credits < 1 and canStartTrial(user) is true, enforcing TRIAL_MAX_BUILDINGS (1) and TRIAL_MAX_LEVELS (4)
  - [ ] New upgrade_trial_project MCP tool in src/lib/mcp/server.ts atomically deducts 1 credit and unlocks isTrial: false in-chat
  - [ ] get_project_report (when includeBase64=true) renders the full 8-section executive report via renderReportHtml(reportData) instead of the simplified fallback header

#### [ ] [FEAT-05] IEC 60364-4-43 Adiabatic Short-Circuit Thermal Withstand (I²t <= k²S²) Engine (ci-003) `(SHOULD)`
Extend short-circuit and cable sizing engines to verify conductor adiabatic thermal withstand (I²t <= k²S²) against ABB and Schneider breaker let-through energy limits per IEC 60364-4-43.

- **Status:** `planned` | **Complexity:** `medium` | **Impact:** `high`
- **Addresses Competitor Pain Points:** `CP-04`, `CP-06`
- **Rationale:** Completes the IEC 60364-4-43 protection verification chain alongside overload (Ib <= Ir <= In <= Iz) and breaking capacity (Icu >= Isc) checks (ci-003).
- **User Story:**
  - *"As a Senior Electrical Engineer, I want ProCal to verify that fault let-through energy (I²t) does not exceed cable insulation thermal limits (k²S²) during short-circuit conditions."*
- **Acceptance Criteria:**
  - [ ] checkAdiabaticThermalWithstand(cable, breaker, faultCurrentKa) in src/lib/calculations/cables.ts verifies I²t <= k²S² using k=115 (PVC Cu) and k=143 (XLPE Cu) per IEC 60364-4-43
  - [ ] ShortCircuitScheduleTable.tsx and Calculation Trace popovers display let-through energy margins and minimum adiabatic cross-section S_min (mm²)
  - [ ] check_project_compliance MCP tool includes adiabatic thermal withstand pass/fail status in its compliance report

#### [ ] [FEAT-06] Domain View Decomposition, Shared Trial Upgrade Hook & Centralized 0.5 m² Validator (cq-001, cq-002) `(SHOULD)`
Modularize 1,600+ line page views and agent spec builders into focused components/modules, share the useUpgradeTrialProject hook, and unify the 0.5 m² room area validator across REST and MCP schemas.

- **Status:** `planned` | **Complexity:** `medium` | **Impact:** `medium`
- **Addresses Competitor Pain Points:** `CP-03`
- **Rationale:** Pays down structural technical debt (cq-001, cq-002) and prevents validation drift between REST APIs and MCP tools.
- **User Story:**
  - *"As a ProCal Developer, I want modular <500 LOC files and a single source of truth for domain validation rules so that new features can be shipped rapidly without regression risk."*
- **Acceptance Criteria:**
  - [ ] Extract shared useUpgradeTrialProject hook used by both TopHeader.tsx and projects/[id]/page.tsx
  - [ ] Centralize 0.5 m² room area validation (isHalfStepArea) into src/lib/validation/room-area.ts and reuse across project-spec-schema.ts and /api/templates routes
  - [ ] Decompose projects/[id]/page.tsx (1,978 LOC), sld/page.tsx (1,678 LOC), and build-project.ts (1,613 LOC) into focused domain sub-modules

### Phase 3: CAD Ecosystem Integration & Autonomous Optimization (50% complete)
*Native AutoCAD DXF schematic exports, imbalance-aware transformer kVA sizing, combinatorial phase optimization, and multi-tenant team revision workflows.*

#### [x] [FEAT-07] Native AutoCAD DXF Vector Export for Single-Line & Vertical Riser Diagrams (ci-004) `(COULD)`
Serialize Schematex Single-Line Diagram (SLD) and Vertical Riser geometry directly into layered ASCII AutoCAD .dxf drawings for seamless import into consultant title blocks and Revit workflows.

- **Status:** `completed` | **Complexity:** `medium` | **Impact:** `high`
- **Addresses Competitor Pain Points:** `CP-08`
- **Rationale:** Directly solves CP-08 and GAP-04 by bridging ProCal's automatic schematic layout engine with enterprise CAD deliverables (ci-004).
- **User Story:**
  - *"As an MEP CAD Coordinator, I want to export Single-Line and Riser diagrams directly as layered AutoCAD .DXF files so that I can drop them into our firm's DWG sheet sets without redrawing."*
- **Acceptance Criteria:**
  - [ ] SLD (src/app/(app)/sld/page.tsx) and Riser (src/app/(app)/riser/page.tsx) views expose an "Export AutoCAD (.DXF)" action alongside SVG and PDF exports
  - [ ] Generated ASCII .dxf files organize busbars, breakers, cables, and text annotations into standard AIA/ISO CAD layers (E-SLD-BUS, E-SLD-BRKR, E-SLD-TEXT)
  - [ ] DXF export is gated behind non-trial project status (isTrial === false) consistent with SVG and Excel export gating

#### [ ] [FEAT-08] Imbalance-Aware Transformer Sizing, Combinatorial Phase Optimizer & Team Revision Snapshots `(COULD)`
Account for per-phase imbalance in main transformer kVA sizing, normalize FloorItem.calculatedCurrent derivation across all item types, and add combinatorial per-phase load optimization with team revision snapshots.

- **Status:** `planned` | **Complexity:** `high` | **Impact:** `high`
- **Addresses Competitor Pain Points:** `CP-02`, `CP-07`
- **Rationale:** Resolves known engineering backlog items (P2 transformer sizing under phase imbalance & calculatedCurrent normalization) while scaling team collaboration.
- **User Story:**
  - *"As a Lead Electrical Engineer, I want transformer sizing to automatically account for per-phase load imbalance so that the most heavily loaded phase never overloads the supply transformer."*
- **Acceptance Criteria:**
  - [ ] Normalize FloorItem.calculatedCurrent derivation across all load categories and evaluate transformer kVA sizing under worst-case per-phase imbalance (L1/L2/L3 max phase current)
  - [ ] Simulated annealing / combinatorial phase optimizer achieves <3% phase deviation across 100+ circuit panelboards in <50ms
  - [ ] Interactive multi-user project collaboration with role-based permissions (Owner, Editor, Viewer) and revision snapshot comparison

---
*Generated autonomously by Antigravity Tools — Built with MoSCoW & Competitor Analysis Architecture.*