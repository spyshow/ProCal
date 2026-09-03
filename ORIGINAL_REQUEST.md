# Original User Request

## 2026-09-03T05:25:59Z

Conduct a comprehensive code audit of the ProCal electrical engineering web application to identify calculation errors, misapplied or missing electrical standards (IEC 60364-5-52, IEC 60909, IEC 60076, IEC/EN 50160, NEMA), and UI/UX usability flaws through both source code inspection and live runtime browser verification. Deliver a structured diagnostic audit report with severity classifications, exact standard citations, formula comparisons, and actionable remediation steps.

Working directory: d:/BackUp/programing_projects/ProCal
Integrity mode: development

## Requirements

### R1. Electrical Calculations & Standards Audit
Audit all calculation modules in src/lib/calculations/ (including phase balancing, cable ampacity and derating, voltage drop, short circuit currents, breaker sizing, and protection curve coordination) against stated standards (IEC 60364-5-52, IEC 60909, IEC 60076, IEC/EN 50160, NEMA). Identify any incorrect equations, wrong lookups, unhandled edge cases, or standard misinterpretations.

### R2. UI & UX Runtime and Static Usability Evaluation
Perform both static code analysis and live browser-based runtime testing of the user interface across key routes (/calculator, /panel, /riser, /sld, /coordination, /reports). Evaluate for visual layout bugs, interactive friction, form validation behavior, feedback clarity on invalid inputs, and workflow smoothness.

### R3. Diagnostic Audit Report
Compile all findings into a structured markdown report (AUDIT_REPORT.md in the project root) structured by severity (Critical, Major, Minor, Informational). Each calculation finding must detail the affected file and line range, the current code logic, the standard-compliant requirement/equation, and the recommended remediation. Each UI/UX finding must include reproduction context and suggested UX improvement.

## Acceptance Criteria

### Electrical Calculations & Standards
- [ ] All calculation files in src/lib/calculations/ are reviewed against relevant IEC/NEMA standards.
- [ ] Every identified calculation discrepancy includes the current formula, the correct standard formula, and the standard clause reference.
- [ ] Existing test suites (
pm test) are executed, and coverage gaps or false-positive assertions in calculation tests are documented.

### UI & UX Runtime Testing
- [ ] Key workflows (project creation, adding loads, floor copying, phase balancing, breaker/cable selection, and report generation) are tested live in a running dev environment.
- [ ] Visual anomalies, unhandled error states, and responsive layout issues are identified and cataloged with clear reproduction notes.

### Deliverable Completeness
- [ ] A complete AUDIT_REPORT.md is generated with an executive summary, categorized issues table, detailed findings breakdown, and prioritized remediation roadmap.
