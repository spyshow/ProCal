# 💡 Codebase Ideation & Audit Report: procal

**Generated:** 10/31/2026 | **Files Analyzed:** 444 | **Estimated Lines:** ~162258

## 🩺 Project Health Dashboard

| Dimension | Score | Status | Description |
| :--- | :--- | :--- | :--- |
| 🛡️ **Security Posture** | **76/100** | 🟢 Good | Vulnerability scan & risk assessment |
| ⚡ **Runtime Performance** | **70/100** | 🟡 Optimization Opportunities | I/O, bundle size, and algorithmic bottlenecks |
| 🧹 **Code Quality** | **76/100** | 🟡 Technical Debt | Modularity, test coverage, and design patterns |
| 🚀 **Innovation Index** | **92/100** | 🌟 High Potential | Code-revealed feature extension opportunities |

## 🚀 Code-Revealed Feature Discoveries (4)
*Opportunities that naturally emerge from existing patterns, architecture, and extension points.*

### [CI-001] MCP Agent Free Trial Provisioning & In-Chat Trial Upgrade Tool
Allow AI agents using create_project_from_spec to automatically provision a 1-building, 4-level Free Trial project when a user has 0 credits and hasUsedTrial === false, and add an upgrade_trial_project MCP tool to unlock full capabilities in-chat.

- **Effort:** `SMALL` | **Status:** `draft`
- **Builds Upon:** `src/lib/trial.ts`, `src/app/api/projects/[id]/upgrade-trial/route.ts`, `src/lib/agent/build-project.ts`
- **Affected Files:** `src/lib/agent/build-project.ts`, `src/lib/mcp/server.ts`, `src/lib/trial.ts`
- **Rationale:** Currently POST /api/projects supports zero-credit trial onboarding via canStartTrial(), whereas createProjectFromSpec rejects any non-admin with credits < 1. Aligning the MCP spec builder removes onboarding friction for Claude/Cursor users.
- **Implementation Approach:** Update createProjectFromSpec in src/lib/agent/build-project.ts to evaluate canStartTrial(user) when credits < 1, enforce TRIAL_MAX_BUILDINGS and TRIAL_MAX_LEVELS inside a Prisma $transaction, and register upgrade_trial_project in src/lib/mcp/server.ts.

### [CI-002] Unified Full 8-Section Executive Report Rendering for MCP Base64 Exports
Wire get_project_report (when includeBase64=true) in src/lib/mcp/server.ts to render the complete 8-section engineering report via renderReportHtml(reportData) instead of the simplified fallback HTML header.

- **Effort:** `SMALL` | **Status:** `draft`
- **Builds Upon:** `src/lib/reports/render-report-html.tsx`, `src/lib/reports/server-pdf.ts`
- **Affected Files:** `src/lib/mcp/server.ts`, `src/lib/reports/render-report-html.tsx`
- **Rationale:** The token-authenticated GET /api/projects/[id]/pdf route already renders the full executive report via renderReportHtml, while the direct Base64 MCP fallback renders a minimal placeholder header. Unifying both paths guarantees identical submittal PDFs.
- **Implementation Approach:** Assemble the full ReportData payload inside get_project_report and pass renderReportHtml(reportData) into wrapReportMarkup before invoking generateServerPdf.

### [CI-003] IEC 60364-4-43 Adiabatic Short-Circuit Thermal Withstand (I²t <= k²S²) Engine
Extend cable and breaker verification to check prospective adiabatic short-circuit thermal withstand (I²t <= k²S²) against manufacturer breaker let-through energy curves per IEC 60364-4-43.

- **Effort:** `MEDIUM` | **Status:** `draft`
- **Builds Upon:** `src/lib/calculations/cables.ts`, `src/lib/breaker-families.ts`
- **Affected Files:** `src/lib/calculations/cables.ts`, `src/lib/breaker-families.ts`, `src/components/report/ShortCircuitScheduleTable.tsx`
- **Rationale:** ProCal already computes prospective fault currents (Isc) and breaker breaking capacities (Icu/Ics). Adding adiabatic thermal withstand verification completes the IEC 60364-4-43 protection chain alongside Ib <= Ir <= In <= Iz.
- **Implementation Approach:** Add checkAdiabaticThermalWithstand(cable, breaker, faultCurrentKa) in src/lib/calculations/cables.ts using k=115 (PVC Cu) and k=143 (XLPE Cu) constants and surface pass/fail badges in ShortCircuitScheduleTable.tsx.

### [CI-004] Native AutoCAD DXF Vector Export for SLD & Vertical Riser Diagrams
Add native AutoCAD DXF vector export alongside SVG/PDF exports for Single-Line Diagrams (SLD) and Vertical Riser Diagrams, gated behind non-trial project status.

- **Effort:** `MEDIUM` | **Status:** `draft`
- **Builds Upon:** `src/app/(app)/sld/page.tsx`, `src/app/(app)/riser/page.tsx`
- **Affected Files:** `src/app/(app)/sld/page.tsx`, `src/app/(app)/riser/page.tsx`
- **Rationale:** MEP consultants routinely import SLD and riser schematics into AutoCAD/Revit title blocks. Because ProCal already computes deterministic X/Y coordinates for busbars, breakers, and feeders, DXF serialization is a natural high-value extension.
- **Implementation Approach:** Serialize the computed Schematex node/edge layout geometry into standard ASCII DXF entities (LINE, LWPOLYLINE, TEXT, INSERT blocks) for direct consultant CAD import.

## ⚡ Performance Optimizations (3)
*Bottlenecks, synchronous I/O, and bundle efficiency gains.*

### [PERF-001] Warm Singleton Chromium Browser Pool for Server-Side PDF Generation
Maintain a warm singleton Puppeteer Browser instance in src/lib/reports/server-pdf.ts and allocate isolated BrowserContext pages per PDF export request.

- **Impact:** `HIGH` | **Category:** `runtime` | **Effort:** `small`
- **Current Metric:** Cold browser.launch() + browser.close() on every PDF generation (~1.2s–2.5s startup overhead per export)
- **Expected Improvement:** Cuts server-side PDF generation latency by 50–65% (from ~3.0s to ~1.1s per report) and reduces memory spikes under concurrent exports
- **Implementation:** Cache a module-scoped Promise<Browser> with automatic reconnect on disconnect, and use browser.createBrowserContext() per generateServerPdf call with a concurrency semaphore.

### [PERF-002] Bulk createMany() for Apartment Rooms & Floor Items in MCP Spec Builders
Replace sequential per-room tx.apartmentRoom.create and per-item tx.floorItem.create loops in createProjectFromSpec and updateProjectSpec with batched tx.apartmentRoom.createMany and tx.floorItem.createMany calls.

- **Impact:** `HIGH` | **Category:** `runtime` | **Effort:** `small`
- **Current Metric:** Sequential awaits (150–400 individual INSERT queries) inside interactive transaction when creating multi-building projects
- **Expected Improvement:** Reduces MCP multi-building spec build transaction time by 70–85% (from 2.5–4.0s down to <400ms) and prevents interactive transaction timeouts
- **Implementation:** Pre-compute room and floorItem payload arrays in memory and execute a single createMany() per template/floor inside the Prisma transaction.

### [PERF-003] PostgreSQL Foreign-Key & Composite Indexes on FloorDesign, FloorItem, and ApartmentRoom
Add composite and foreign-key indexes @@index([buildingId, floorNumber]) on FloorDesign, @@index([floorDesignId]) on FloorItem, and @@index([templateId]) on ApartmentRoom in prisma/schema.prisma.

- **Impact:** `MEDIUM` | **Category:** `runtime` | **Effort:** `small`
- **Current Metric:** Sequential index scans on FloorDesign and FloorItem foreign keys during full-building recalculation and cascade deletes
- **Expected Improvement:** Sub-5ms indexed lookups during /api/buildings/[id]/recalculate and multi-building load aggregation
- **Implementation:** Add @@index annotations to FloorDesign, FloorItem, and ApartmentRoom models in prisma/schema.prisma and apply via migration.

## 🛡️ Security Vulnerabilities & Hardening (3)
*Identified risks, authorization gaps, input validation, and credential handling.*

### [SEC-001] Unified Tenant & Team-Member Authorization Guard Across All Project-Scoped MCP Tools `(HIGH SEVERITY)`
Enforce a shared assertMcpProjectAccess(projectId, ctx) guard across all project-scoped MCP tools (check_project_compliance, check_project_selectivity, update_project_cables, get_project_bom) supporting both owner and ProjectMember access.

- **Vulnerability:** CWE-639: Authorization Bypass Through User-Controlled Key (IDOR) in Remaining MCP Tools
- **Current Risk:** check_project_compliance, check_project_selectivity, update_project_cables, and get_project_bom query by projectId without verifying that ctx.userId owns or is a member of the project.
- **Remediation:** Extract a reusable authorization helper in src/lib/mcp/server.ts that verifies project.userId === ctx.userId, ADMIN role, or ProjectMember membership before reading or mutating project data.
- **Compliance Standards:** OWASP Top 10 A01:2021 - Broken Access Control, CWE-639
- **Affected Files:** `src/lib/mcp/server.ts`, `src/lib/project-auth.ts`

### [SEC-002] Atomic Conditional Credit Decrement (credits >= 1) on Paid Project Creation & Trial Upgrade `(MEDIUM SEVERITY)`
Replace non-conditional credit decrement (credits: { decrement: 1 }) with an atomic conditional updateMany({ where: { id: user.id, credits: { gte: 1 } } }) inside a single database transaction with project creation/upgrade.

- **Vulnerability:** CWE-367: Time-of-Check Time-of-Use (TOCTOU) Race Condition on Credit Balance Deduction
- **Current Risk:** Concurrent paid project creation or trial upgrade requests with 1 remaining credit can pass the initial credits >= 1 check simultaneously and decrement credits below zero.
- **Remediation:** Wrap paid project creation and trial upgrade in db.$transaction and verify that user.updateMany({ where: { id: user.id, credits: { gte: 1 } }, data: { credits: { decrement: 1 } } }) returns count === 1.
- **Compliance Standards:** OWASP Top 10 A04:2021 - Insecure Design (Race Condition / TOCTOU), CWE-367
- **Affected Files:** `src/app/api/projects/route.ts`, `src/lib/agent/build-project.ts`, `src/app/api/projects/[id]/upgrade-trial/route.ts`

### [SEC-003] Server-Driven HTML Rendering & Watermark Style Integrity in POST /api/projects/[id]/pdf `(MEDIUM SEVERITY)`
Sanitize or reject untrusted <style>/<script> overrides in POST /api/projects/[id]/pdf when project.isTrial is true, or render report HTML exclusively server-side via renderReportHtml(projectId).

- **Vulnerability:** CWE-284: Client-Supplied HTML/CSS Watermark Suppression in POST /api/projects/[id]/pdf
- **Current Risk:** An authenticated trial user calling POST /api/projects/[id]/pdf directly with crafted HTML/CSS could inject a <style>.trial-watermark-overlay { display: none !important; }</style> rule to hide the visual trial watermark.
- **Remediation:** Strip user-supplied <script> tags and disallow CSS selectors targeting .trial-watermark-overlay in POST /api/projects/[id]/pdf, or deprecate raw client HTML submission in favor of server-rendered report markup.
- **Compliance Standards:** OWASP Top 10 A03:2021 - Injection, CWE-79
- **Affected Files:** `src/app/api/projects/[id]/pdf/route.ts`

## 🧹 Code Quality & Technical Debt (3)
*Large files, code duplication, and architectural anti-patterns.*

### [CQ-001] Decompose 1,600+ Line Monolithic Views & Extract Shared Trial Upgrade Hook
Split 1,600+ line monolithic views and agent spec builders into focused domain modules and extract a shared useUpgradeTrialProject hook used by both TopHeader and ProjectDetailPage.

- **Severity:** `MAJOR` | **Category:** `large_files` | **Effort:** `medium`
- **Best Practice:** Single Responsibility Principle & Modular Feature Composition
- **Proposed Change:** Extract BuildingListPanel, TemplateManagerModal, and BoqSummarySection from projects/[id]/page.tsx; split createProjectFromSpec and updateProjectSpec into dedicated modules under src/lib/agent/; share useUpgradeTrialProject.
- **Affected Files:** `src/app/(app)/projects/[id]/page.tsx`, `src/app/(app)/sld/page.tsx`, `src/lib/agent/build-project.ts`, `src/components/TopHeader.tsx`

### [CQ-002] Centralize 0.5 m² Room Area Validator (isHalfStep) Across REST Routes & MCP Schemas
Consolidate the 0.5 m² room area step validator (isHalfStep) into a single shared validation helper imported by both REST API routes and MCP Zod schemas.

- **Severity:** `MINOR` | **Category:** `duplication` | **Effort:** `small`
- **Best Practice:** DRY Domain Validation Primitives
- **Proposed Change:** Export isHalfStepArea and HALF_STEP_AREA_ERROR from src/lib/validation/room-area.ts and reuse across all template and spec endpoints.
- **Affected Files:** `src/lib/agent/project-spec-schema.ts`, `src/app/api/templates/route.ts`, `src/app/api/templates/[id]/route.ts`

### [CQ-003] Add Dedicated Route Unit Tests for /api/projects/[id]/pdf & Image Inlining
Add dedicated Vitest unit tests for GET/POST /api/projects/[id]/pdf covering signed report token verification, trial flag propagation, and inlineImagesInHtml path-traversal containment.

- **Severity:** `MINOR` | **Category:** `test_coverage` | **Effort:** `small`
- **Best Practice:** Automated Security & Regression Boundary Testing
- **Proposed Change:** Create src/app/api/projects/[id]/pdf/route.test.ts with mocked generateServerPdf and filesystem fixtures verifying CWE-22 traversal rejection and trial encryption error handling.
- **Affected Files:** `src/app/api/projects/[id]/pdf/route.ts`, `src/lib/reports/server-pdf.ts`

---
*Generated autonomously by Antigravity Tools Ideation Engine — Inspired by Aperant.*