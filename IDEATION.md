# 💡 Codebase Ideation & Audit Report: procal

**Generated:** 11/25/2026 | **Files Analyzed:** 508 | **Estimated Lines:** ~195019

## 🩺 Project Health Dashboard

| Dimension | Score | Status | Description |
| :--- | :--- | :--- | :--- |
| 🛡️ **Security Posture** | **74/100** | 🟡 Needs Hardening | Vulnerability scan & risk assessment |
| ⚡ **Runtime Performance** | **70/100** | 🟡 Optimization Opportunities | I/O, bundle size, and algorithmic bottlenecks |
| 🧹 **Code Quality** | **72/100** | 🟡 Technical Debt | Modularity, test coverage, and design patterns |
| 🚀 **Innovation Index** | **98/100** | 🌟 High Potential | Code-revealed feature extension opportunities |

## 🚀 Code-Revealed Feature Discoveries (5)
*Opportunities that naturally emerge from existing patterns, architecture, and extension points.*

### [CI-001] MCP Agent Free Trial Provisioning & In-Chat Trial Upgrade Tool ✅ COMPLETED
Allow AI agents calling create_project_from_spec to automatically provision a zero-credit Free Trial project (isTrial: true) when canStartTrial(user) holds, and expose an upgrade_trial_project MCP tool to unlock full projects in-chat.

- **Effort:** `SMALL` | **Status:** `completed`
- **Builds Upon:** `src/lib/trial.ts`, `src/app/api/projects/[id]/upgrade/route.ts`, `src/lib/agent/build-project.ts`
- **Affected Files:** `src/lib/agent/build-project.ts`, `src/lib/mcp/server.ts`, `src/lib/trial.ts`
- **Rationale:** POST /api/projects (src/app/api/projects/route.ts:197-244) and POST /api/projects/[id]/upgrade/route.ts already support atomic lifetime Free Trial onboarding and 1-credit upgrades in the web UI, whereas createProjectFromSpec (src/lib/agent/build-project.ts:178) still rejects non-admin users with credits < 1.
- **Implementation Approach:** Update createProjectFromSpec in src/lib/agent/build-project.ts to check canStartTrial(freshUser) when credits < 1, enforce TRIAL_MAX_BUILDINGS and TRIAL_MAX_LEVELS inside db.$transaction, and register upgrade_trial_project in src/lib/mcp/server.ts.

### [CI-002] Unified Full 8-Section Executive Report Rendering for MCP Base64 & Stdio Exports ✅ COMPLETED
Wire get_project_report (when includeBase64=true or outputFilePath is set) in src/lib/mcp/server.ts to render the full 8-section executive engineering report via renderReportHtml(reportData) instead of the placeholder header.

- **Effort:** `SMALL` | **Status:** `completed`
- **Builds Upon:** `src/lib/reports/render-report-html.tsx`, `src/app/api/projects/[id]/pdf/route.ts`, `src/lib/mcp/server.ts`
- **Affected Files:** `src/lib/mcp/server.ts`, `src/app/api/projects/[id]/pdf/route.ts`, `src/lib/reports/render-report-html.tsx`
- **Rationale:** src/lib/mcp/server.ts already imports renderReportHtml and getCompanySettings (lines 23-24), yet lines 649-653 still wrap a minimal '<h1>Project</h1><p>Executive Report</p>' stub while GET /api/projects/[id]/pdf renders the full 8-section package.
- **Implementation Approach:** Extract a shared buildExecutiveReportHtml(projectId, options) helper used by both GET /api/projects/[id]/pdf and get_project_report in src/lib/mcp/server.ts so Base64/stdio MCP exports match signed-URL PDFs byte-for-byte.

### [CI-003] Combinatorial Min-Neutral Per-Phase Optimizer & 3-Phase Apartment Room Decomposition
Extend phaseBalance.ts beyond single-pass greedy LPT with a fast combinatorial swap/annealing solver that minimizes 120-degree vector neutral current (IN) and optionally decomposes 3-phase apartment templates across room loads.

- **Effort:** `MEDIUM` | **Status:** `draft`
- **Builds Upon:** `src/lib/calculations/phaseBalance.ts`, `src/app/api/floors/[id]/rebalance/route.ts`
- **Affected Files:** `src/lib/calculations/phaseBalance.ts`, `src/app/api/floors/[id]/rebalance/route.ts`, `src/app/(app)/calculator/page.tsx`
- **Rationale:** src/lib/calculations/phaseBalance.ts currently assigns null phases via single-pass greedy kW order and flags 3-phase apartments with internalImbalanceNotModeled: true (lines 24-34). A swap refinement pass over phasor angles (120 deg + arccos PF) achieves <3% current unbalance and minimal neutral current in <5ms.
- **Implementation Approach:** Add optimizePhaseAssignments(items, project) in phaseBalance.ts using pairwise/3-way Kempe-chain swaps minimizing maxPhaseCurrent and vector neutralCurrent, wired to the existing Rebalance endpoints.

### [CI-004] MCP Native AutoCAD DXF Schematic Export Tool (get_project_dxf) ✅ COMPLETED
Expose ProCal v1.8.0's new SVG-to-DXF CAD serializer (src/lib/dxf/svg-to-dxf.ts) through the MCP server so AI agents can export layered AutoCAD .dxf Single-Line and Riser drawings directly in chat.

- **Effort:** `SMALL` | **Status:** `completed`
- **Builds Upon:** `src/lib/dxf/svg-to-dxf.ts`, `src/lib/mcp/server.ts`, `src/lib/sld/generator.ts`
- **Affected Files:** `src/lib/mcp/server.ts`, `src/lib/dxf/svg-to-dxf.ts`
- **Rationale:** ProCal v1.8.0 shipped client-side AutoCAD DXF export in src/lib/dxf/svg-to-dxf.ts (1,167 LOC), and get_project_sld in src/lib/mcp/server.ts (lines 586-597) already generates standalone Schematex SVGs server-side. Bridging the two gives Claude/Cursor agents native CAD deliverables.
- **Implementation Approach:** Add includeDxf / outputDxfPath options on get_project_sld (or a dedicated get_project_dxf MCP tool) that converts rendered overview/floor SVGs via svg-to-dxf.ts while rejecting trial projects with a clear upgrade prompt.

### [CI-005] Engineering Revision Diff Comparison & Pre-Mutation MCP Snapshot Tool
Surface side-by-side engineering delta tables (load totals, breaker frames, cable sizes, voltage drop changes) between ProjectRevision snapshots and add an MCP snapshot tool before bulk spec updates.

- **Effort:** `MEDIUM` | **Status:** `draft`
- **Builds Upon:** `src/lib/audit-diff.ts`, `src/app/api/projects/[id]/revisions/route.ts`, `src/lib/mcp/server.ts`
- **Affected Files:** `src/lib/audit-diff.ts`, `src/app/api/projects/[id]/revisions/route.ts`, `src/lib/mcp/server.ts`
- **Rationale:** ProjectRevision (prisma/schema.prisma:183-195) stores full project JSON snapshots and src/lib/audit-diff.ts (901 LOC) already computes structured entity diffs, but engineers and MCP agents cannot yet compare R0 vs R1 schedules side-by-side or checkpoint before update_project_spec.
- **Implementation Approach:** Build a computeRevisionScheduleDiff(revA, revB) helper over snapshotJson payloads and expose both a Revision Diff drawer on /projects/[id] and a create_project_revision MCP tool.

## ⚡ Performance Optimizations (4)
*Bottlenecks, synchronous I/O, and bundle efficiency gains.*

### [PERF-001] Warm Singleton Chromium Browser Pool for Server-Side PDF Generation ✅ COMPLETED
Reuse a warm module-scoped Puppeteer Browser instance in src/lib/reports/server-pdf.ts with isolated BrowserContext pages per export instead of cold-launching Chromium on every request.

- **Status:** `completed`

- **Impact:** `HIGH` | **Category:** `runtime` | **Effort:** `small`
- **Current Metric:** Cold puppeteer.launch() + browser.close() per PDF request (~2.5s-3.5s total latency)
- **Expected Improvement:** Cuts warm PDF generation latency by 50-65% (~0.9s-1.2s) and bounds concurrent Chromium memory usage via semaphore
- **Implementation:** Cache a singleton Promise<Browser> with disconnect recovery and allocate an isolated browser.createBrowserContext() per PDF render guarded by a max-concurrency semaphore.

### [PERF-002] Bulk createMany() Batching for Rooms & Floor Items in MCP Spec Builders ✅ COMPLETED
Replace sequential per-room tx.apartmentRoom.create and per-item tx.floorItem.create loops inside createProjectFromSpec and updateProjectSpec with batched createMany() inserts.

- **Status:** `completed`

- **Impact:** `HIGH` | **Category:** `io` | **Effort:** `small`
- **Current Metric:** 150-400 sequential INSERT round-trips per multi-tower MCP spec build (~2.5s-4.5s)
- **Expected Improvement:** Reduces multi-building transaction time by 70-85% (<450ms) and eliminates interactive transaction timeout pressure
- **Implementation:** Pre-compute ApartmentRoom and FloorItem row arrays in memory with generated UUIDs and execute single tx.apartmentRoom.createMany and tx.floorItem.createMany calls per batch.

### [PERF-003] Add Missing PostgreSQL Foreign-Key & Composite Indexes on Core Hierarchy Tables ✅ COMPLETED
Add @@index declarations on Building(projectId), FloorDesign(buildingId, floorNumber), FloorItem(floorDesignId), FloorItem(apartmentTemplateId), BuildingLoad(buildingId), and ApartmentRoom(templateId) in prisma/schema.prisma.

- **Status:** `completed`

- **Impact:** `MEDIUM` | **Category:** `io` | **Effort:** `trivial`
- **Current Metric:** Sequential table scans across FloorItem, FloorDesign, and ApartmentRoom joins on nested project queries
- **Expected Improvement:** Sub-5ms index scans on deep project fetches, PDF report queries, and ON DELETE CASCADE operations
- **Implementation:** Add @@index([projectId]) on Building, @@index([buildingId, floorNumber]) on FloorDesign, @@index([floorDesignId]) and @@index([apartmentTemplateId]) on FloorItem, @@index([buildingId]) on BuildingLoad, and @@index([templateId]) on ApartmentRoom.

### [PERF-004] In-Memory TTL Cache for Static EquipmentCatalog & CompanySettings Queries ✅ COMPLETED
Cache db.equipmentCatalog.findMany({ include: { family: true } }) in memory with TTL and admin-mutation invalidation instead of re-querying all ABB/Schneider breaker rows on every PDF export and selectivity run.

- **Status:** `completed`

- **Impact:** `LOW` | **Category:** `network` | **Effort:** `trivial`
- **Current Metric:** Full EquipmentCatalog + BreakerFamily table transfer on every report and selectivity invocation
- **Expected Improvement:** Zero DB round-trips for warm catalog reads (<0.1ms lookup) with instant invalidation on admin edits
- **Implementation:** Create getCachedEquipmentCatalog() with a 5-minute TTL and explicit invalidateEquipmentCatalogCache() hook called by admin breaker CRUD routes.

## 🛡️ Security Vulnerabilities & Hardening (4)
*Identified risks, authorization gaps, input validation, and credential handling.*

### [SEC-001] Missing Tenant & ProjectMember Authorization Guard on MCP Tools (IDOR) `(HIGH SEVERITY)` ✅ COMPLETED
Enforce a unified assertMcpProjectAccess(projectId, authUser, requiredRole) check across check_project_compliance, check_project_selectivity, get_project_bom, get_project_sld, and get_project_report.

- **Status:** `completed`

- **Vulnerability:** CWE-639: Authorization Bypass Through User-Controlled Key (IDOR)
- **Current Risk:** Any authenticated MCP API-key holder who knows or guesses another tenant's projectId UUID can read its BOM/compliance summary or trigger selectivity trip-unit mutations.
- **Remediation:** Create assertMcpProjectAccess(projectId, user, { allowMembers: true, requireWrite?: boolean }) verifying owner, ADMIN, or ProjectMember access before executing any project-scoped MCP tool.
- **Compliance Standards:** OWASP Top 10 A01:2021 - Broken Access Control, CWE-639
- **Affected Files:** `src/lib/mcp/server.ts`, `src/lib/agent/build-project.ts`, `src/lib/project-auth.ts`

### [SEC-002] Non-Conditional Credit Decrement Race Condition (TOCTOU) on Paid Project Creation `(MEDIUM SEVERITY)` ✅ COMPLETED
Replace unconditional user.update({ credits: { decrement: 1 } }) in POST /api/projects and createProjectFromSpec with an atomic conditional updateMany({ where: { id: user.id, credits: { gte: 1 } } }) inside the creation transaction.

- **Status:** `completed`

- **Vulnerability:** CWE-367: Time-of-Check Time-of-Use (TOCTOU) Race Condition
- **Current Risk:** Concurrent REST or MCP paid project creation requests from an account with 1 credit can both pass the pre-check and drive User.credits negative.
- **Remediation:** Inside db.$transaction, execute tx.user.updateMany({ where: { id: user.id, credits: { gte: 1 } }, data: { credits: { decrement: 1 } } }) and abort with 402 if count !== 1.
- **Compliance Standards:** OWASP Top 10 A04:2021 - Insecure Design, CWE-367
- **Affected Files:** `src/app/api/projects/route.ts`, `src/lib/agent/build-project.ts`

### [SEC-003] Client-Supplied HTML/CSS Watermark Suppression in POST /api/projects/[id]/pdf `(MEDIUM SEVERITY)` ✅ COMPLETED
Sanitize untrusted <style>/<script> blocks in POST /api/projects/[id]/pdf or render trial PDFs exclusively server-side via renderReportHtml so trial watermarks cannot be hidden via CSS injection.

- **Status:** `completed`

- **Vulnerability:** CWE-284: Improper Access Control / Client-Side Enforcement of Trial Watermark
- **Current Risk:** Authenticated Free Trial users can craft a POST /api/projects/[id]/pdf payload with custom CSS rules to suppress visual 'FREE TRIAL — NOT FOR CONSTRUCTION' watermarks.
- **Remediation:** When project.isTrial is true, ignore client-supplied body.html and render server-authoritative HTML via renderReportHtml (matching GET /api/projects/[id]/pdf), and strip <script> tags on all POST payloads.
- **Compliance Standards:** OWASP Top 10 A03:2021 - Injection, CWE-284
- **Affected Files:** `src/app/api/projects/[id]/pdf/route.ts`, `src/lib/reports/render-report-html.tsx`

### [SEC-004] API Key Exposure Risk in MCP Query-String URLs (?key=procal_sk_...) `(LOW SEVERITY)`
Read Authorization: Bearer and x-api-key directly from Request headers in /api/mcp and deprecate ?key=procal_sk_... query-parameter authentication in user-facing error prompts.

- **Vulnerability:** CWE-598: Use of GET/POST Request Method With Sensitive Query Strings
- **Current Risk:** Long-lived procal_sk_ API keys passed via ?key= are recorded in plaintext HTTP request logs on reverse proxies and hosting providers.
- **Remediation:** Extract Bearer/x-api-key headers directly on the incoming Request in POST /api/mcp, update onboarding docs/error messages to recommend header auth first, and redact key=/apiKey= in any server log middleware.
- **Compliance Standards:** OWASP Top 10 A02:2021 - Cryptographic & Credential Hygiene, CWE-598
- **Affected Files:** `src/app/api/mcp/route.ts`, `src/lib/mcp/server.ts`

## 🧹 Code Quality & Technical Debt (4)
*Large files, code duplication, and architectural anti-patterns.*

### [CQ-001] Decompose 1,470–1,887 LOC Monolithic Views & Agent Spec Builder Modules
Split the five largest multi-responsibility files — projects/[id]/page.tsx (1,887 LOC), cable-schedule/page.tsx (1,771 LOC), sld/page.tsx (1,639 LOC), coordination/page.tsx (1,516 LOC), and build-project.ts (1,478 LOC) — into focused sub-modules.

- **Severity:** `MAJOR` | **Category:** `large_files` | **Effort:** `medium`
- **Best Practice:** Single Responsibility Principle & Bounded Module Size (<500 LOC)
- **Proposed Change:** Split src/lib/agent/build-project.ts into create-spec.ts, update-spec.ts, cables-spec.ts, selectivity-check.ts, and bom.ts (re-exported via index.ts), and extract feature panels/hooks from the 4 largest page controllers.
- **Affected Files:** `src/app/(app)/projects/[id]/page.tsx`, `src/app/(app)/cable-schedule/page.tsx`, `src/app/(app)/sld/page.tsx`, `src/app/(app)/coordination/page.tsx`, `src/lib/agent/build-project.ts`

### [CQ-002] Centralize 0.5 m² Room Area Validator (isHalfStep) Across REST Routes & MCP Schemas ✅ COMPLETED
Share the 0.5 m² room area step validator (isHalfStep) between MCP Zod schemas (src/lib/agent/project-spec-schema.ts) and REST apartment template routes (/api/templates).

- **Status:** `completed`

- **Severity:** `MINOR` | **Category:** `duplication` | **Effort:** `small`
- **Best Practice:** Single Source of Truth for Domain Invariants
- **Proposed Change:** Extract isHalfStepArea and HALF_STEP_AREA_MESSAGE into src/lib/validation/room-area.ts and validate every room area in both /api/templates routes and project-spec-schema.ts.
- **Affected Files:** `src/lib/agent/project-spec-schema.ts`, `src/app/api/templates/route.ts`, `src/app/api/templates/[id]/route.ts`

### [CQ-003] Eliminate Unused Imports & Duplicate Report Data Assembly in MCP Server ✅ COMPLETED
Remove dead imports (renderReportHtml, getCompanySettings) in src/lib/mcp/server.ts by extracting a shared report-assembly service reused by both GET /api/projects/[id]/pdf and MCP get_project_report.

- **Status:** `completed`

- **Severity:** `MINOR` | **Category:** `duplication` | **Effort:** `small`
- **Best Practice:** DRY Service Layer & Zero Unused Imports
- **Proposed Change:** Extract loadProjectReportHtml(projectId, opts) into src/lib/reports/load-project-report.ts and consume it from both the REST PDF endpoint and MCP get_project_report.
- **Affected Files:** `src/lib/mcp/server.ts`, `src/app/api/projects/[id]/pdf/route.ts`

### [CQ-004] Add Route-Level Security & Regression Unit Tests for /api/projects/[id]/pdf ✅ COMPLETED
Create src/app/api/projects/[id]/pdf/route.test.ts covering signed JWT report download tokens, CWE-22 path-traversal containment in inlineImagesInHtml, and trial encryption/watermark flags.

- **Status:** `completed`

- **Severity:** `MINOR` | **Category:** `test_coverage` | **Effort:** `small`
- **Best Practice:** Automated Boundary & Security Regression Testing
- **Proposed Change:** Add src/app/api/projects/[id]/pdf/route.test.ts mocking generateServerPdf to verify 401 on expired/cross-project tokens, traversal rejection on '../' image paths, and isTrial propagation.
- **Affected Files:** `src/app/api/projects/[id]/pdf/route.ts`, `src/lib/reports/server-pdf.ts`

---
*Generated by Antigravity AI Agent (Code-Aware v1.8.0 Audit) — Inspired by Aperant.*
