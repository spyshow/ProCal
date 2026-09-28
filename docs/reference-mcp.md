# ProCal MCP Server — Tool Reference

The ProCal MCP server lets an AI agent read and edit electrical design projects,
and produce submission-ready deliverables. It runs inside the Next.js process and
calls `src/lib/calculations/` directly — **the agent never computes engineering
values; ProCal's engine does.**

- **Endpoint:** `POST {origin}/api/mcp` (Streamable HTTP, stateless)
- **Auth:** `Authorization: Bearer <personal access token>`
- **Tool prefix:** every tool is named `procal_*`
- **Set-up instructions:** [`how-to-connect-ai-client.md`](./how-to-connect-ai-client.md)

---

## The one rule for agents

**Describe the design; let ProCal derive the numbers.**

An agent supplies rooms, areas, quantities, cable lengths and standards. It must
never supply — or guess — a load, current, breaker rating, cable size or voltage
drop. Those come from the IEC 60364-5-52 / IEC 60909 engine, and an invented value
will silently produce a wrong submittal that still looks authoritative.

---

## Typical flow

```
procal_list_projects          → find an existing project, don't duplicate
procal_create_project_from_spec  → one declarative call (requires 1 credit)
procal_get_design_summary     → check the design, read the warnings
procal_export_drawings_pdf    → SLD + riser sheets
procal_export_report_pdf      → the 9-page engineering package
procal_export_excel           → the schedules workbook
```

Fixing up an existing project uses the granular tools instead of the one-shot spec.

---

## Discover and pay

### `procal_list_projects`
Every project the caller can access, most recently updated first. Read-only.

### `procal_get_project_brief`
Compact state of one project — the "where am I?" call.

Returns standards (IEC/NEMA, voltage, power factor, ΔV limits), the buildings with
their floor and circuit counts, apartment templates, `calculationsAreStale`, and a
`missing[]` list of what still needs attention (no buildings, floors with no
circuits, no mechanical loads).

**If `calculationsAreStale` is true, call `procal_recalculate_project` before
exporting.** Export tools do this for you, but the brief tells you why a
recalculation was needed.

### `procal_create_checkout`
Starts a purchase. Returns a `checkoutUrl` for the user to open, plus a
`checkoutUrl: null` with an explanation when Stripe is not configured on the
deployment — in which case ask the user to buy credits manually.

---

## Build

### `procal_create_project_from_spec` — one-shot declarative
Creates standards, buildings, per-floor topology and risers, apartment templates,
and mechanical loads, then recalculates.

**Payment and quota gate first.** Two distinct outcomes matter, and they need
different responses:

| Outcome | Meaning | What to tell the user |
|---|---|---|
| `status: "payment_required"` | No subscription and no credits. | Hand them `checkoutUrl`; retry the same spec after payment. |
| `status: "quota_exhausted"` | On a **paid plan** that has used its project allowance this period. | They already pay — do **not** suggest buying credits. Offer an upgrade, or a single project pass. Mention that existing projects stay accessible. |

A successful create returns a `quota` block (`reason`, `tier`, `allowance`,
`usedThisPeriod`, `remaining`) so the agent can report capacity without a
separate call.

Per-period allowance: **Starter 1 · Professional 5 · Team 15**. The quota gates
project *creation*, not existence — projects started in an earlier period stay
fully accessible forever. If materialization fails midway the credit is refunded.

```ts
{
  spec: {
    name: "Riverside Tower — Phase 1",
    client: "Riverside Developments",
    voltage: 400, frequency: 50, powerFactor: 0.85,
    calculationStandard: "IEC",        // or "NEMA"
    maxVoltageDropLighting: 3,         // % — IEC 60364-5-52
    maxVoltageDropPower: 5,
    apartmentTemplates: [{
      name: "2BR",
      phases: 1,                       // 1 or 3
      rooms: [
        { name: "Living", type: "LIVING_ROOM", area: 24, loadDensity: 100 },
        { name: "Kitchen", type: "KITCHEN", area: 10, loadDensity: 150 },
        { name: "Bedroom", type: "BEDROOM", area: 14, loadDensity: 60 },
        { name: "AC", type: "OTHER", area: 0.1, loadDensity: 0, hasAc: true, acBtu: 12000 }
      ]
    }],
    buildings: [{
      name: "Tower A",
      serviceFloors: 0,
      apartmentsPerFloor: 4,
      earthingSystem: "TN-S",
      transformer: null,                // null = auto-size from demand
      floors: [
        { hasFloorSubPanels: true, riserCableSize: "95 mm²", riserCableLength: 12,
          templateName: "2BR", apartmentCount: 4,
          buildingLoadNames: ["Elevator"], buildingLoadQuantities: [2] }
      ]
    }]
  }
}
```

`loadDensity` is VA/m². Typical values: 100 general, 150 kitchen, 60 bedroom.
AC is usually expressed as a small-area room with `hasAc: true` and `acBtu`.

### `procal_define_apartment_template`
A reusable template. `connectedLoadVA` is returned so you can sanity-check the
figure before assigning it to 20 floors.

### `procal_upsert_building`
Add a building, or change riser/topology of existing floors. Floors are
auto-numbered from the `floorNumber` values given.

### `procal_assign_floor_template`
Populate a floor from a template. **Replaces** the floor's existing circuits, so
pass the full intended count.

### `procal_set_building_loads`
Attach mechanical loads by name from the project load library. The error message
lists the available names when one is not found.

---

## Derive

### `procal_recalculate_project`
Runs the engine over the whole project and stamps the current engine version.
Recomputes apartment connected load, applies the project diversity factor, derives
design current, and **clears any manual breaker or cable that is undersized for
its load**.

### `procal_get_design_summary`
Engineering read-back: per-floor demand, riser current, riser/branch/total ΔV
verdicts, and warnings when a floor exceeds — or comes within 20% of — the
project's ΔV limit. Use it to check a design and to explain it in plain language.

---

## Export

All three call the **freshness guard** first, so they cannot emit a submittal
built from stale stored numbers.

Binaries are returned as a **download URL**, not inline — MCP results are text or
JSON. Artifacts are stored in Postgres and expire after 24 hours. The URL accepts
either the bearer token or a session cookie, so a user can click the link the agent
gave them.

| Tool | Output |
|---|---|
| `procal_export_report_pdf` | Cover + 8 schedules, A4 landscape |
| `procal_export_drawings_pdf` | One sheet per SLD floor + paginated riser sheets |
| `procal_export_excel` | 11 sheets: schedules, 3 BOM variants |

`procal_export_drawings_pdf` returns `sldSheets`, `riserSheets` and `totalSheets`.
A 20-storey tower is 20 SLD sheets plus 4 riser sheets.

---

## Permissions

Every project-scoped tool resolves access through the same
`verifyProjectAccessAsUser` the HTTP routes use, so **a token can only reach what
its owner can reach in the UI.** A project member without `reports: EDIT` cannot
export reports through MCP either. Admins bypass.

---

## Errors

| Shape | Meaning |
|---|---|
| `isError: true` | The call failed. `content[0].text` explains; correct and retry. |
| `status: "payment_required"` | Not an error. No subscription and no credits — show `checkoutUrl` and resume. |
| `status: "quota_exhausted"` | Not an error. A paid plan has used its allowance. Offer an upgrade or a pass; **do not** offer credits. |
| `alreadyEntitled: true` | The account can already create projects; skip the purchase. |

---

## Server implementation notes

- **Stateless.** A fresh server and transport per request, so it scales across
  serverless instances. `GET` and `DELETE` return 405 by design.
- **`src/proxy.ts` excludes `/api/mcp` twice** — once in the allow-list, once in
  the matcher negative lookahead. Removing either breaks bearer clients.
- **Tokens are stored as SHA-256 hashes.** The raw secret is returned once, at
  mint time, and is not recoverable.
- **`page.evaluate` must take a string, not a function** — tsx/esbuild injects a
  `__name()` helper that throws inside Chromium.
