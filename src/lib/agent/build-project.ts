/**
 * Public facade barrel for ProCal MCP project-builder services.
 * Decomposed into focused domain modules under src/lib/agent/ (CQ-001)
 * while preserving the @/lib/agent/build-project import surface.
 */
export type { ProjectCreatedResult } from "./spec-helpers";
export type { UpgradeTrialResult } from "./create-project-spec";
export { createProjectFromSpec, upgradeProjectFromTrial } from "./create-project-spec";
export { updateProjectLoads, updateProjectSpec } from "./update-project-spec";
export { getProjectComplianceSummary, checkProjectSelectivity } from "./selectivity-compliance";
export { updateProjectCables } from "./update-project-cables";
export { getProjectBOM } from "./project-bom";
