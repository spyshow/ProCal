// Centralizes where cable edits get persisted. The cable-schedule page edits
// three cable kinds — floor circuits, building loads, and SDB risers — that
// live in three tables with different id shapes and field names. Routing was
// previously inlined in two page handlers and the SDB branch was missing from
// the upsize path, so SDB edits silently 404'd. Keeping the dispatch here lets
// one test pin all three kinds against a missing-branch regression.

export type CableKind = 'floor' | 'building' | 'sdb';

/** REST PATCH target for a cable row of the given kind. */
export function cablePatchUrl(kind: CableKind, id: string): string {
  if (kind === 'building') return `/api/building-loads/${id}`;
  if (kind === 'sdb') return `/api/floors/${id.replace(/^sdb-/, '')}`;
  return `/api/floor-items/${id}`;
}

/** One cable "size upsize" — PATCH body for applyChanges. */
export function upsizeBody(newCableSize: number | string, kind: CableKind): Record<string, string> {
  const sizeStr = typeof newCableSize === 'number' ? `${newCableSize}` : newCableSize;
  if (kind === 'sdb') return { riserCableSize: sizeStr };
  return { cableSize: sizeStr };
}

/** Single-field edits (length/method/insulation/material/ambientTemp/groupingCount) — PATCH body for updateCableField. */
export function fieldEditBody(
  kind: CableKind,
  field: 'length' | 'method' | 'insulation' | 'material' | 'ambientTemp' | 'groupingCount',
  value: string | number,
): Record<string, string | number> {
  if (kind === 'sdb') {
    if (field === 'length') return { riserCableLength: value };
    if (field === 'method') return { riserInstallMethod: value };
    if (field === 'insulation') return { riserCableInsulation: value };
    if (field === 'material') return { riserCableMaterial: value };
    if (field === 'ambientTemp') return { riserAmbientTemp: value };
    if (field === 'groupingCount') return { riserGroupingCount: value };
    return {};
  }
  if (field === 'length') return { cableLength: value };
  if (field === 'method') return { installMethod: value };
  if (field === 'insulation') return { cableInsulation: value };
  if (field === 'material') return { cableMaterial: value };
  if (field === 'ambientTemp') return { ambientTemp: value };
  if (field === 'groupingCount') return { groupingCount: value };
  return {};
}
