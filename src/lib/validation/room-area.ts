/**
 * Domain validator for apartment room areas.
 * Enforces ProCal's 0.5 m² grid rule across both REST API template routes and MCP Zod schemas.
 */
export function isHalfStepArea(val: number): boolean {
  return Number.isFinite(val) && val > 0 && Math.abs(Math.round(val * 2) - val * 2) < 1e-5;
}

export const HALF_STEP_AREA_MESSAGE =
  "Room areaM2 must be an integer or end in .5 (multiples of 0.5 m², e.g. 19 or 19.5). Values like 19.1 or 4.4 are not allowed.";

export function formatRoomHalfStepError(
  roomName: string | undefined,
  area: unknown
): string {
  return `Room "${roomName || "unnamed"}" area (${area} m²) must be an integer or end in .5 (e.g. 19 or 19.5). Decimals like .1 or .4 are not allowed.`;
}
