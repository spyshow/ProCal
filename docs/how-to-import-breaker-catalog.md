# How-to: import the breaker catalog from CSV (admin)

Goal: bulk-load `EquipmentCatalog` rows (ABB / Schneider breakers) from a CSV
file, with upsert-by-unique-key and a per-row error report. You need an
`ADMIN` account. Endpoint: `POST /api/admin/breakers/import`
(`requireAdmin`-gated, multipart/form-data).

## When to use this vs the single-row form

- **Import** (this page) — bulk load/upsert from a CSV. Good for seeding
  (ABB Emax 2, Masterpact MTZ, Tmax XT, ComPacT NSX, S200, Acti9 iC60, …) or
  for reconciling after a manufacturer publishes new trip units/breaking
  capacities.
- **Single-row create** — `POST /api/admin/breakers` for one row at a time.
- **Edit/delete** — `/api/admin/breakers/[id]` and the DELETE on
  `/api/admin/breakers` (single `?id=` or `{ ids: [...] }` batch).

## 1. The CSV format

Header row (lowercase, exact match) + data rows. **Required columns:**

```
manufacturer, category, series, model, ratedCurrent, poles,
breakingCapacity, tripUnit, settingsJson, datasheetUrl
```

- `manufacturer` — `ABB` or `SCHNEIDER` (free text stored as-is; families are
  keyed on `manufacturer+category+series`).
- `category` — `ACB|MCCB|MCB|RCCB|RCBO|SPD|CONTACTOR|OVERLOAD|METER|CT`
  (uppercased on import).
- `series` — e.g. `Emax 2`, `Tmax XT4`, `Acti9 iC60`.
- `model` — e.g. `E2.2B 1600`, `iC60N D32`.
- `ratedCurrent` — amps, must be a finite positive number.
- `poles` — positive integer.
- `breakingCapacity` — kA, defaults to 0 if empty.
- `tripUnit`, `settingsJson`, `datasheetUrl` — optional strings (empty → null).
  `settingsJson`, if present, must parse as JSON (`JSON.parse`) or the row is
  rejected.

The parser is a **hand-rolled RFC-4180-ish CSV** (`parseCsv` in the route) —
commas and newlines inside quoted cells are handled. No CSV dep. See
[Auth & admin reference](./reference-auth-admin.md) for why.

## 2. Submit

`/admin` → catalog → import, or directly:

```bash
curl -X POST http://localhost:3000/api/admin/breakers/import \
  -H "Cookie: session_token=<your admin session>" \
  -F "file=@your-catalog.csv"
```

## 3. Understand the response — it's a summary, not a throw

```json
{
  "summary": {
    "totalRows": 120,
    "validRows": 118,
    "applied": 117,
    "validationErrors": [ { "row": 14, "message": "Invalid ratedCurrent" }, ... ],
    "upsertErrors":  [ { "row": 47, "message": "..." }, ... ]
  }
}
```

- **All rows failed validation** (`validRows === 0` with errors) → `400` with
  the errors. Nothing is written.
- **Partial success** → `200` with the summary. Valid rows are upserted; bad
  rows are reported, not rolled back. The import is **not** transactional — a
  partial import is reported, not all-or-nothing (the ponytail choice: a CSV
  with one bad row shouldn't block 117 good ones; the summary tells you which).

## 4. How upsert resolves

Each valid row is upserted on the
`catalogUniqueKey = (manufacturer, category, series, model, ratedCurrent, poles)`
unique constraint. On a match, it updates `breakingCapacity`, `tripUnit`,
`settingsJson`, `datasheetUrl`, and re-resolves `familyId`. On no match, it
creates. So re-importing the same file is idempotent — it reconciles, it
doesn't duplicate.

`BreakerFamily` is **auto-created/reused**: `upsertBreakerFamilies`
(`src/lib/breaker-families.ts`) keys a family from
`manufacturer+category+series` before the row is written, so the row's
`familyId` always resolves. You don't manage families per row — they're a
derived grouping. Projects pick default ACB/MCCB/MCB families by these.

## 5. Export the current catalog / a template

- `GET /api/admin/breakers/export/catalog` — the current catalog as CSV (for
  re-import after edits, or backup).
- `GET /api/admin/breakers/export/template` — the empty CSV header for the
  import format above.

## Related

- [Auth & admin reference](./reference-auth-admin.md) — `requireAdmin`, the
  admin/breakers routes, the CSV parser seam.
- [API reference](./reference-api.md) — `/api/admin/breakers` (single-row
  create/delete), `/api/equipment` (the read path the breaker schedule uses).
- [Data model reference](./reference-data-model.md) — `EquipmentCatalog`
  (`catalogUniqueKey`), `BreakerFamily` (`@@unique([manufacturer, category,
  name])`).
