# API reference

Every JSON route handler in `src/app/api/`. Source of truth: the routes
themselves. Each entry lists the file, method, auth posture, inputs, and the
non-obvious behavior (the parts that would surprise you reading the code cold).

## Conventions

- **Self-auth.** Most routes call `getSessionUser()` and return JSON `401` on
  no session. This is deliberate: it lets client code branch on a status code
  rather than recover from a middleware redirect HTML response.
- **Matcher-excluded API prefixes.** The middleware matcher (see
  [Auth & admin reference](./reference-auth-admin.md)) uses a negative lookahead
  that **excludes** `api/projects|api/buildings|api/cables|api/equipment|api/contact|api/admin`.
  Those prefixes get **no** middleware redirect — so an unauthenticated request
  reaches the handler, which must self-auth. This is why `/api/contact` returns
  JSON 401 itself (an expired session must yield JSON, not a redirect, for the
  billing fetch to branch cleanly), and why every `/api/admin/*` route gates with
  `requireAdmin()`.
- **Routes under other prefixes** (`api/floors`, `api/loads`, `api/templates`,
  `api/settings`, `api/upload`, `api/breaker-*`) are **matcher-protected**: an
  unauthenticated or expired-session request is redirected to `/login` before
  the handler runs. Those handlers still self-auth where they need the user
  object (and to survive a future matcher edit), but they don't *have* to.
- **Ownership checks** look up the parent and compare `*.userId === user.id`,
  returning `404` (not `403`) on mismatch — resource-exists-leak avoidance.
- **`recalculate` is matcher-excluded AND sessionless.** `/api/buildings/[id]/recalculate`
  calls `getSessionUser` *nowhere* and only checks the building exists (404). Since
  `api/buildings` is matcher-excluded, an unauthenticated caller can POST to it.
  It re-sizes apartment items by building id — no data leaks (no user data in the
  response), but it's the one route whose auth posture is neither self-auth nor
  matcher-protected. Documented as a known gap, not a hidden bug.
- **Next 16 async params.** Every dynamic route is
  `{ params }: { params: Promise<{ id: string }> }` then
  `const { id } = await params;`. The old sync form does not compile here.
- **Errors.** `400` validation, `401` unauth, `402` credit gate, `404` not
  owned / not found, `409` dedupe, `500` catch-all `{ error }`.

## Auth & account

### `POST /api/auth/register` · `src/app/api/auth/register/route.ts`
Creates a `User` (bcryptjs hash). Collects `email` at signup (Track 2 of the
billing work) — email is optional on the model but requested here so the billing
form and SMTP `Reply-To` have a value to pre-fill. Returns the session-bearing
shape the client stores.

### `POST /api/auth/login` · `src/app/api/auth/login/route.ts`
Verifies `passwordHash`, sets the session. `disabled: true` users cannot log in
(soft-delete enforcement at the door).

### `GET /api/auth/me` · `src/app/api/auth/me/route.ts`
Returns the current user. This is what `UserContext.refreshUser()` hits after a
`402` or a project-create to self-heal the cached `credits` count. Gated by the
matcher.

### `POST /api/auth/logout` · `src/app/api/auth/logout/route.ts`
Clears the session.

### `POST /api/auth/change-password` · `src/app/api/auth/change-password/route.ts`
Authenticated password change. Validates `currentPassword` against user's password hash and updates to new bcrypt-hashed password (minimum 6 chars). Returns `{ success: true, message }`.

### `GET /api/contact` · `src/app/api/contact/route.ts`
Returns `{ hasOpen }` — whether the caller has an `OPEN` `ContactRequest`. The
billing page uses this to self-disable the form (one open lead per user, CQ-C).
Matcher-excluded, so it self-auths and returns JSON 401 on expired session.

### `POST /api/contact` · `src/app/api/contact/route.ts`
The captured-lead submit. Self-auth 401. Validates `email` + `message`
(non-empty), dedupes against an existing `OPEN` lead → `409` (no second email
sent). Then **D4 send-first-then-persist**: `sendLeadNotification()` is called
*before* any row write; send failure → `502 { error: "Could not send your
request right now. Please try again." }` and **no row** is written. On send
success the `ContactRequest` row is persisted with `status: "OPEN"`. The body's
`requestedCredits` is coerced to `null` if it isn't a positive integer (the
column is `Int?`; a non-numeric or zero value is stored as null, not rejected —
the lead still lands, the credit ask just isn't recorded as a number).

See [Captured-lead credit gate](./explanation-billing-captured-lead.md) for why
the order is inverted.

## Projects

### `GET /api/projects` · `src/app/api/projects/route.ts`
Self-auth. `db.project.findMany({ where: { userId }, include: {
buildings, apartmentTemplates, loadLibraryItems }, orderBy: { updatedAt: desc }
})`. The projects list comes pre-joined with everything the projects page
renders in one round trip.

### `POST /api/projects` · `src/app/api/projects/route.ts`
Self-auth 401. `name` required → 400. **Credit gate** (the load-bearing
constraint):

```
if (user.role !== "ADMIN") {
  const fresh = await db.user.findUnique({ where: { id: user.id }, select: { credits: true } })
  if (!fresh || fresh.credits < 1) return 402 { error: "No credits remaining" }
}
```

The fresh re-fetch (not the cached `user.credits`) is the reactive backstop for
the proactive gate on the projects page — a request that bypasses the disabled
button still hits the server check. Admins bypass the gate entirely. Non-admins
are charged inside a `db.$transaction([ user.update({ credits: { decrement: 1 }
}), project.create(...) ])` so the credit and the project commit atomically;
admins get a plain `project.create` (no decrement). On the client, `402`
triggers `refreshUser()` + `router.push('/billing')`.

### `GET /api/projects/[id]` · `src/app/api/projects/[id]/route.ts`
Self-auth, ownership check, returns the single project with its full graph.

### `PUT /api/projects/[id]` · `src/app/api/projects/[id]/route.ts`
Updates project fields. `voltage`/`powerFactor`/`maxDemandFactor`/breaker-family
defaults flow through here.

### `DELETE /api/projects/[id]` · `src/app/api/projects/[id]/route.ts`
Ownership check, then cascade delete (schema-level `onDelete: Cascade` on
Building / ApartmentTemplate / LoadLibraryItem).

## Buildings

### `POST /api/buildings` · `src/app/api/buildings/route.ts`
Self-auth. `projectId`/`name`/`floors` required → 400. Verifies
`project.userId === user.id` → 404. Creates the building **and auto-creates one
`FloorDesign` per floor** — `for (n in 1..floors + serviceFloors)`. This is why
the floors API never has to create a floor: floors exist the moment the building
does. `serviceFloors` are appended after the numbered floors.

### `GET /api/buildings/[id]` · `src/app/api/buildings/[id]/route.ts`
Async `params`. Ownership check (`building.project.userId === user.id`) → 404.
Includes `floorDesigns.items` and `buildingLoads`.

### `PUT /api/buildings/[id]` · `src/app/api/buildings/[id]/route.ts`
Async params. Ownership check. On floor-count change, **adjusts FloorDesigns**:
creates missing FloorDesigns for new floors, `deleteMany` the excess when floors
shrink. Existing floor items are preserved on grow; the deleted floors cascade.

### `DELETE /api/buildings/[id]` · `src/app/api/buildings/[id]/route.ts`
Cascade delete of `floorDesigns`, `buildingLoads`.

## Floors & floor items

### `PUT /api/floors/[id]` · `src/app/api/floors/[id]/route.ts`
**Matcher-protected (no `getSessionUser` in the handler).** Updates
`hasFloorSubPanels` only. `api/floors` is *not* matcher-excluded, so the
middleware redirects unauthenticated callers to `/login` before this handler
runs. No ownership check inside — trusts the matcher. The trade: less
per-request DB (no parent lookup), paid for by total reliance on the matcher
regex staying correct.

### `PATCH /api/floors/[id]` · `src/app/api/floors/[id]/route.ts`
**Matcher-protected.** Updates `hasFloorSubPanels` + the riser fields
(`riserCableLength`, `riserCableSize`, `riserInstallMethod`,
`riserCableInsulation`). The riser fields only take effect when
`hasFloorSubPanels=true` (the floor draws from a sub-distribution board off the
MDB through a riser, not a direct feeder).

### `POST /api/floors/[id]/items` · `src/app/api/floors/[id]/items/route.ts`
Self-auth. `type` + `name` required → 400. Three item kinds, each sized by a
different path:

- **`APARTMENT`** — reads the linked `ApartmentTemplate`'s rooms, sums
  `connectedLoad/1000` → kW, applies `getApartmentDiversityFactor(apartmentCount)`
  (IEC 60439 ladder), phase-aware current: 3-phase `√3·V·PF`, 1-phase
  `V/√3·PF`. Then `sizeCableAndBreaker`.
- **`LIBRARY`** — uses the `LoadLibraryItem`'s `phase`, `powerFactor`,
  `demandFactor` directly.
- **Manual** — fixed defaults: `SERVICE_PANEL` 15 kW / 0.8 PF, `PUMP_PANEL`
  7.5 kW / 1.0 PF, `ELEVATOR_PANEL` 22 kW / 0.8 PF.

All kinds default to **copper / XLPE / 30 °C / install method C** unless the
request overrides. Stores `calculatedConnectedLoad`, `calculatedMaxDemand`,
`calculatedCurrent`, `breakerSize`, `cableSize`, `voltageDrop`. New single-phase
items get `assignedPhase: null` (auto-assigned on the next `rebalance`).

### `POST /api/floors/[id]/rebalance` · `src/app/api/floors/[id]/rebalance/route.ts`
Self-auth. Calls `phaseBalance(floorDesign.items, project)`, **persists 1-phase
`assignedPhase` assignments** (writes 1/2/3 back to the rows), **and preserves
manual pins** — a set of `pinnedIds` is built from items that already had a
non-null `assignedPhase`, so a user-pinned phase isn't overwritten by the greedy
result. Three-phase items aren't assigned (they draw from all phases). Returns
`{ balance, floorDesign }` where `balance` is the full `PhaseBalance` (per-phase
current/kW, neutral, unbalancePct, `imbalanced?`, flags).

### `DELETE /api/floors/[id]/items/[itemId]` · `src/app/api/floors/[id]/items/[itemId]/route.ts`
Deletes the floor item. A following `rebalance` re-flows the freed capacity.

## Building-wide operations

### `POST /api/buildings/[id]/recalculate` · `src/app/api/buildings/[id]/recalculate/route.ts`
**Sessionless + matcher-excluded — the one unguarded route.** Calls
`getSessionUser` nowhere; the only check is "building exists" (404 otherwise).
Because `api/buildings` is matcher-excluded, an unauthenticated caller can POST
here. Re-applies the IEC apartment-diversity factor for the building's current
apartment count and re-sizes every apartment floor item; returns
`{ success, updated, diversityFactor }`. The response carries no user data, so
no leak — but it is the one route whose auth posture is neither self-auth nor
matcher-protected. Use after changing the apartment count or template rooms.

### `POST /api/buildings/[id]/rebalance` · `src/app/api/buildings/[id]/rebalance/route.ts`
Self-auth. Resets **all** apartment floor-item and building-load `assignedPhase`
to `null` (back to auto), returns `{ success, reset }`. This is the "clear all
manual pins" button. A subsequent read re-assigns greedily.

### `GET /api/buildings/[id]/calculation` · `src/app/api/buildings/[id]/calculation/route.ts`
Returns the full computed result for the building — feeders, panels, riser,
balance. Driven by `computeFeeders` + `phaseBalance` + `computeFloorRiserVd`
(see [Calc engine reference](./reference-calc-engine.md)). This is what the
calculator page and the reports pull from.

## Load library

### `GET /api/loads` · `src/app/api/loads/route.ts`
Self-auth. Lists the project's `LoadLibraryItem`s.

### `POST /api/loads` · `src/app/api/loads/route.ts`
Self-auth. `projectId`/`name`/`category`/`power` required → 400. Computes
`runningCurrent` server-side (`phase===3 ? S/(√3·V) : S/V`) and stores it, so
the stored current is always consistent with the stored power/voltage/phase — a
client typo can't orphan a wrong `runningCurrent`.

## Templates

### `GET /api/templates` · `src/app/api/templates/route.ts`
Self-auth. Lists a project's `ApartmentTemplate`s.

### `POST /api/templates` · `src/app/api/templates/route.ts`
Self-auth. `projectId`/`name`/`rooms` (non-empty array) required → 400. Verifies
project ownership → 404. **Country defaults drive the load**: reads
`getCountryDefaults(project.country)` (invalid country → 400), computes each
room's `connectedLoad` via `calculateRoomLoad(area, loadDensity, hasAc,
acSizingRules)`, auto-sizes AC BTU from the country's `acSizingRules` (largest
rule whose `maxArea >= room.area`, else the last rule). Then applies a fixed
residential `demandFactor = 0.4`, `ib = maxDemandKva / 0.23` (230 V
single-phase), and `sizeCableAndBreaker(ib, false, { copper, XLPE, 30, 1 })` —
the sizing call exercises the cable path, the resulting template is stored with
its rooms' computed `connectedLoad`. `phases` defaults to `1` if falsy.

> The `ib` here is computed for *sizing* the template's implied feeder; the
> per-floor apartment sizing in `/api/floors/[id]/items` recomputes current
> from the template's room loads at insert time. The two paths agree because
> both ultimately call `sizeCableAndBreaker` with the apartment's phase-aware
> current.

## Equipment catalog & breaker families

### `GET /api/equipment` · `src/app/api/equipment/route.ts`
Self-auth. Query filters: `category` (comma-split, uppercased, `in` if >1),
`manufacturer` (post-filter uppercased — applied in JS, not SQL), `minCurrent`/
`maxCurrent` (`ratedCurrent` `gte`/`lte`). `include: { family: true }`, ordered
by manufacturer → category → ratedCurrent. Each row is returned with
`familyId`/`familyName` flattened from the included relation.

### `GET /api/breaker-families` · `src/app/api/breaker-families/route.ts`
Self-auth. Query filters: `category` (uppercased), `manufacturer` — **skipped if
`"MIXED"`** (so the projects page's mixed-manufacturer default returns all
families across manufacturers). Ordered by manufacturer → category → name.

### `GET/POST/PUT/DELETE /api/breaker-families/[id]` · `src/app/api/breaker-families/[id]/`
Family CRUD. The default ACB/MCCB/MCB family pointers on a `Project` reference
these.

### Breaker settings · `src/app/api/breaker-settings/`
Per-feeder protection settings (`BreakerSettings` rows keyed by a design tag
like `"proj1-mdb-main"`). Stores Ir/Tr (required) and the optional S/I/G
long-time-short-time-instantaneous-ground tuples. See `selectivity.ts` (linked
from the calc engine reference) for how the TCC is generated from these.

## Settings & upload

### `GET /api/settings` · `src/app/api/settings/route.ts`
Self-auth. Returns `{ countrySettings, company }`. `countrySettings` is the
in-memory `globalSettings` map (seeded from `COUNTRY_DEFAULTS`); `company` is
read from `data/company.json` (file-based, persists across restarts; empty
defaults on read failure).

### `POST /api/settings` · `src/app/api/settings/route.ts`
Self-auth. Handles two payloads in one route: `data.country` + `data.settings`
(a full `CountryConfig` — `roomDensities` and `acSizingRules` required → 400
otherwise) updates the in-memory map; `data.company` updates the
`company.json` file. Country settings are **in-memory only** — a server
restart reverts them to `COUNTRY_DEFAULTS`. Company settings persist.

> **ponytail:** country settings are in-memory by design (a registry of
> tuning knobs that drift per deployment); if per-deployment persistence
> becomes a real need, promote to a DB table. Until then, no premature table.

### `POST /api/upload` · `src/app/api/upload/route.ts`
Self-auth. `multipart/form-data` with a `file` field. Validates type against
`["image/png", "image/jpeg", "image/webp", "image/svg+xml"]` → 400, size against
2 MB → 400. Writes to `public/uploads/<ts>-<rand>.<ext>`, returns
`{ url: "/uploads/<file>" }`. Used for the project/company logo. The
`/public/uploads/` dir is gitignored.

## Admin

### `GET/POST /api/admin/users` · `src/app/api/admin/users/route.ts`
Admin-only (`requireAdmin`). Listing + credit grants. Granting credits here is
the human fulfillment step of the captured-lead loop — an admin reviews the lead
in `/admin/leads` and tops the user up by hand. See
[Auth & admin reference](./reference-auth-admin.md).

### `GET/POST /api/admin/leads` · `src/app/api/admin/leads/route.ts`
Admin-only. The lead ledger — lists `ContactRequest`s, transitions `OPEN`→
`CLOSED` (sets `closedAt`), reopens (`CLOSED`→`OPEN`, clears `closedAt`).

## Related

- [Calc engine reference](./reference-calc-engine.md) — the pure functions the
  sizing/rebalance routes call into.
- [Data model reference](./reference-data-model.md) — the tables these routes
  read and write.
- [Captured-lead credit gate](./explanation-billing-captured-lead.md) — the
  `/api/contact` + 402 + D4 design.
- [Auth & admin reference](./reference-auth-admin.md) — auth primitives,
  middleware matcher, admin enforcement.
