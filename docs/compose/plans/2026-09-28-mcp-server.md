# ProCal MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose ProCal as an MCP server so an AI agent can create a paid project, populate its design data, and generate the SLD, riser diagram, PDF report, and Excel workbook — all server-side, reusing the existing calculation engine untouched.

**Architecture:** A Streamable-HTTP MCP endpoint at `/api/mcp` runs inside the existing Next.js process and calls `src/lib/calculations/` and `src/lib/reports/` directly — no HTTP round-trips, no duplicated engineering logic. Tool handlers stay thin: zod-validate input, call an existing pure module, return structured JSON. Auth is per-user Personal Access Tokens (bearer), resolved to the same user shape `getSessionUser()` returns and passed through one shared permission check. Client-only drawing renderers are extracted into shared modules so the SLD and riser can be produced server-side and printed with the same stylesheet as the main report.

**Tech Stack:** `@modelcontextprotocol/sdk`, Next.js 16.2.10, React 19, Prisma 7 + PostgreSQL, zod 4, schematex 0.9.14, puppeteer-core + `@sparticuz/chromium`, SheetJS `xlsx`, Stripe, Vitest

## Global Constraints

- **The calculation engine is the crown jewel.** Every new surface must import from `src/lib/calculations/`. If you change one of those modules, run `npm test` and `recalculate` on a seeded project. Do not fork, wrap, or reimplement sizing math in MCP handlers.
- **TypeScript strict mode, no `any` in new code.**
- Next.js 16 async params: `{ params }: { params: Promise<{ id: string }> }` then `await params`. The sync form does not compile.
- MCP tool handlers must reuse `verifyProjectAccess` so a role that cannot see a page in the UI cannot drive that page through MCP.
- Next 16.2.10's built-in `/_next/mcp` is **dev-only devtools** (errors, logs, routes for coding agents). It is not a business-logic MCP server. Do not try to extend it.
- `schematex`'s `render(dsl)` is pure string→string and safe in Node. Its `/browser` and `/export` subpaths require a DOM and must never be imported server-side.
- Schematex is AGPL-3.0-only. Pre-existing, but record an explicit decision before shipping MCP commercially.
- Every MCP mutation writes an audit-log entry stamped `source: "mcp"`, or MCP edits become invisible in the trail.
- Respect the "Ponytail" convention: hand-roll a small pure helper over adding a dependency where a swap point can be documented.

---

## File Structure

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add `McpToken`, `CreditTransaction`, `PromoCode`, `CheckoutIntent`, `Subscription`, `McpArtifact` |
| `package.json` | Add `@modelcontextprotocol/sdk`, `stripe` |
| `src/lib/project-auth.ts` | **Modify** — extract user-agnostic core (Task 2) |
| `src/proxy.ts` | **Modify** — allow-list + matcher exclusion for `/api/mcp` (Task 2) |
| `src/lib/mcp-auth.ts` | **New** — PAT hash, mint, verify, `resolveMcpActor` |
| `src/app/api/mcp/route.ts` | **New** — Streamable HTTP MCP endpoint |
| `src/app/api/mcp/tokens/route.ts` | **New** — mint / list / revoke PATs |
| `src/app/api/mcp/artifacts/[id]/route.ts` | **New** — download generated PDF/XLSX |
| `src/mcp/context.ts` | **New** — `McpCtx`, project resolution bound to the actor |
| `src/mcp/registry.ts` | **New** — tool table (zod schemas + handlers) |
| `src/mcp/freshness.ts` | **New** — `ensureFresh()` recalculation guard |
| `src/lib/billing/entitlement.ts` | **New** — "may this user start a project?" gate |
| `src/lib/stripe.ts` | **New** — Stripe client + webhook signature verify |
| `src/app/api/billing/checkout/route.ts` | **New** — create Checkout Session |
| `src/app/api/billing/webhook/route.ts` | **New** — idempent credit/subscription grant |
| `src/app/api/billing/portal/route.ts` | **New** — Stripe Customer Portal session |
| `src/app/api/billing/redeem/route.ts` | **New** — promo code redemption |
| `src/app/api/admin/promo-codes/route.ts` | **New** — promo code CRUD |
| `src/lib/sld/svg-postprocess.ts` | **New** — `extendCables` + `repositionLabels`, lifted verbatim |
| `src/lib/drawings/riser-model.ts` | **New** — pure riser geometry from project data |
| `src/lib/drawings/riser-svg.tsx` | **New** — presentational riser SVG (print \| screen) |
| `src/lib/drawings/sld-render.ts` | **New** — DSL → SVG string via schematex `render` |
| `src/lib/drawings/drawings-html.tsx` | **New** — landscape A4 sheets, report styling |
| `src/lib/drawings/drawings-pdf.ts` | **New** — Chromium render → PDF buffer |
| `src/lib/drawings/chromium-pool.ts` | **New** — singleton browser + concurrency gate |
| `src/app/(app)/riser/page.tsx` | **Modify** — consume extracted model/component |
| `src/app/(app)/sld/page.tsx` | **Modify** — import post-process fns from shared module |
| `src/app/(app)/billing/page.tsx` | **Modify** — real checkout (keep lead form as fallback) |
| `src/app/(app)/settings/page.tsx` | **Modify** — MCP token manager |
| `src/app/api/projects/route.ts` | **Modify** — project gate reads `canStartProject()` |
| `src/app/api/admin/users/[id]/route.ts` | **Modify** — write credit ledger rows |
| `scripts/spike-drawings-pdf.ts` | **New, throwaway** — risk spike (Task 1) |
| `scripts/verify-mcp-e2e.ts` | **New** — end-to-end MCP verification |
| `docs/reference-mcp.md` | **New** — tool reference |
| `docs/how-to-connect-ai-client.md` | **New** — client setup guide |

---

## Task 0: Preflight

**Covers:** Branch hygiene and the zod compatibility gate

- [ ] **Step 1: Resolve the working tree**

`master` has 15 uncommitted files and deploys run from `master` / `production`. Commit or stash them, then branch:

```bash
git checkout -b feat/mcp-server
```

- [ ] **Step 2: Gate the zod version — do this before writing any tool code**

You are on zod `^4.4.3`. The MCP SDK historically declares a zod `^3.23` peer. Check the actual requirement of the version you intend to install, then pick one:

```bash
npm view @modelcontextprotocol/sdk version peerDependencies
```

- SDK supports zod 4 → proceed as written.
- SDK requires zod 3 only → either use a release with v4 support, or pin zod 3 and update the single `ZodError` import in `src/lib/api-errors.ts:3`.

This decision determines how all of Task 5 is built. Do not defer it.

- [ ] **Step 3: Note a pre-existing pricing contradiction**

`docs/ideas/pricing-strategy.md` specifies a **subscription-first** model (Free → Starter $29 → Professional $89 → Team $249 per month, with credit packs as a pay-as-you-go add-on), and its own Phase 3 calls for exactly the Stripe Checkout + webhook work in Task 3.

The landing page copy at `src/i18n/locales/en.json:901-933` instead advertises "first project $20, then flat $100 per project, zero recurring fees," and `PricingSection.tsx` renders that. The credit counter in the database matches the strategy doc, not the copy.

Decide which is canonical **before** Task 3, because the `Subscription` model only makes sense under the strategy doc. This plan assumes the strategy doc wins and the landing copy gets corrected. If the per-project model wins instead, drop `Subscription` and keep the credit ledger alone — nothing else in this plan changes.

---

## Task 1: Spike — can we draw on the server?

**Covers:** The riskiest assumption in the plan, validated before anything is built

**Files:**
- Create: `scripts/spike-drawings-pdf.ts` (throwaway — delete after Task 4)

**Interfaces:**
- Consumes: `generateSLDPages()` from `src/lib/sld/generator.ts`, `render()` from `schematex`, `generateServerPdf()` from `src/lib/reports/server-pdf.ts`
- Produces: a validated answer to "can the SLD be printed server-side?"

- [ ] **Step 1: Prove the SLD renders to a string in Node**

```ts
import { render } from 'schematex';
const svg = render(page.dsl);   // string, no DOM required
```

Confirm this works outside a browser before building anything on it.

- [ ] **Step 2: Post-process inside Chromium**

`extendCables` and `repositionLabels` (currently at `src/app/(app)/sld/page.tsx:600-705`) depend on `getBBox()`, so they need a laid-out DOM. Stringify them and run them in the browser you already have:

```ts
await page.evaluate(`${extendCables.toString()}; extendCables(document.querySelector('svg'));`);
```

- [ ] **Step 3: Print 20 landscape pages**

One `page-break-before: always` block per SLD page, then:

```ts
await page.pdf({ format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
```

- [ ] **Step 4: Test on a 20-floor tower — the case that matters**

Assert exactly 20 pages, one per floor, nothing clipped or overlapping. A big tower is where layout breaks.

- [ ] **Step 5: Record the outcome**

- **Success** → proceed to Task 4 as written.
- **Post-processing flaky** → drop `extendCables`/`repositionLabels` from the export path. They are cosmetic; the schematic still prints correctly, just with shorter stub cables and MCB labels in their default position.

---

## Task 2: Personal Access Token authentication

**Covers:** How an MCP client proves who it is

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/project-auth.ts` (extract core)
- Modify: `src/proxy.ts`
- Create: `src/lib/mcp-auth.ts`
- Create: `src/app/api/mcp/tokens/route.ts`
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Produces: `resolveMcpActor(request) → McpUser | null`, `verifyProjectAccessAsUser(user, projectId, opts) → VerifyProjectAccessResult`

- [ ] **Step 1: Add the `McpToken` model**

Store only the hash. `prefix` is shown in the UI so a user can tell tokens apart; the raw value is displayed exactly once at mint time.

```prisma
model McpToken {
  id         String    @id @default(uuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String
  tokenHash  String    @unique
  prefix     String
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Extract the user-agnostic core of `project-auth.ts`**

`verifyProjectAccess` currently calls `getSessionUser()` internally. Split it so the permission logic has one implementation shared by both auth paths — this is what keeps MCP bound to the same permissions as the UI.

```ts
export async function verifyProjectAccessAsUser(user, projectId, options) { /* current body, minus the getSessionUser() call */ }
export async function verifyProjectAccess(projectId, options) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return verifyProjectAccessAsUser(user, projectId, options);
}
```

- [ ] **Step 3: Update `src/proxy.ts` — two changes, both required**

Add `/api/mcp` to the top-level allow-list **and** to the matcher negative lookahead at `src/proxy.ts:61`. Miss the matcher and the endpoint 302-redirects to `/login`, which MCP clients fail on opaquely.

```ts
pathname.startsWith("/api/mcp") ||   // in the allow-list

"/((?!api/projects|api/buildings|api/cables|api/equipment|api/contact|api/admin|api/invites|api/mcp|...).*)"
```

- [ ] **Step 4: Implement `src/lib/mcp-auth.ts`**

SHA-256 the presented token, look it up, reject if `revokedAt` is set or the user is `disabled`. Return the same user shape `getSessionUser()` returns so downstream code is identical on both paths. Update `lastUsedAt` on success.

- [ ] **Step 5: Add token endpoints and the settings UI**

`GET` list (prefix + created + last used, never the token), `POST` mint (returns the raw token once), `DELETE` revoke.

---

## Task 3: Payments — Stripe plus admin grants

**Covers:** "The project should be created first as the user should pay for it"

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/stripe.ts`
- Create: `src/lib/billing/entitlement.ts`
- Create: `src/app/api/billing/checkout/route.ts`
- Create: `src/app/api/billing/webhook/route.ts`
- Create: `src/app/api/billing/portal/route.ts`
- Create: `src/app/api/billing/redeem/route.ts`
- Create: `src/app/api/admin/promo-codes/route.ts`
- Create: `src/app/api/admin/promo-codes/[id]/route.ts`
- Modify: `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/(app)/billing/page.tsx`
- Modify: `src/app/(admin)/admin/users/page.tsx`

**Interfaces:**
- Produces: `canStartProject(user) → { allowed, reason?, checkoutUrl? }`, `materializeProjectFromSpec(userId, spec) → projectId`

- [ ] **Step 1: Do not create the `Project` row until payment lands**

Storing the AI's spec on a `CheckoutIntent` and materializing it in the webhook means the agent's work survives the payment round-trip, and **no existing route needs to learn about a pending-project state** — which would otherwise have rippled through the dashboard, list, and permission checks.

```prisma
model CheckoutIntent {
  id              String   @id @default(uuid())
  userId          String
  kind            String            // SUBSCRIPTION | CREDIT_PACK
  credits         Int
  tier            String?           // starter | professional | team
  specJson        String?           // MCP project spec, materialized on payment
  projectId       String?           // set once materialized
  stripeSessionId String?  @unique // webhook idempotency key
  status          String   @default("PENDING")   // PENDING | PAID | EXPIRED | CANCELED
  createdAt       DateTime @default(now())
  expiresAt       DateTime
}
```

- [ ] **Step 2: Add the credit ledger and subscription state**

Credits are currently a bare integer decrement. Make every change auditable.

```prisma
model CreditTransaction {
  id               String   @id @default(uuid())
  userId           String
  delta            Int
  reason           String            // PURCHASE | PROMO | ADMIN_GRANT | ADMIN_ADJUST | PROJECT_SPENT
  stripeSessionId  String?
  actorId          String?           // admin who granted, if applicable
  note             String?
  createdAt        DateTime @default(now())

  @@index([userId])
}

model Subscription {
  id                   String    @id @default(uuid())
  userId               String
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tier                 String    // starter | professional | team
  status               String    @default("active")   // active | past_due | canceled
  stripeCustomerId     String?
  stripeSubscriptionId String?   @unique
  currentPeriodEnd     DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@index([userId])
}
```

- [ ] **Step 3: Centralize the project gate**

The gate is currently hard-coded at `src/app/api/projects/route.ts:182-188` (credits only) and again at `:214-221` (the transaction). Extract it so the HTTP route and the MCP tool cannot drift:

```ts
export async function canStartProject(user): Promise<{ allowed: boolean; reason?: string; checkoutUrl?: string }>
// ADMIN                        → allowed
// active Subscription          → allowed
// credits >= 1                 → allowed
// otherwise                    → { allowed: false, reason: "payment_required", checkoutUrl }
```

Point `src/app/api/projects/route.ts` at it. The existing 402 response and client redirect to `/billing` must keep working unchanged.

- [ ] **Step 4: Checkout + webhook + portal**

`POST /api/billing/checkout` creates a Checkout Session with `metadata.userId` and `metadata.intentId`. `POST /api/billing/webhook` verifies the signature, then in one transaction: apply credits or upsert the subscription, write a ledger row, mark the intent `PAID`, and — if `specJson` is present — call `materializeProjectFromSpec()`. Idempotent on the unique `stripeSessionId`, so Stripe's retries cannot double-grant. Handle `customer.subscription.updated` and `customer.subscription.deleted` to keep `Subscription.status` honest.

- [ ] **Step 5: Promo codes and bulk grants**

`PromoCode` (`code`, `credits`, `maxRedemptions`, `redemptions`, `expiresAt`, `active`) with CRUD under `/api/admin/promo-codes`, plus `POST /api/billing/redeem`. Extend the existing `PATCH /api/admin/users/[id]` credit setter to write a ledger row, and add a bulk-grant action in the admin users UI. This gives you both **offers** (promo) and **individual** free credits.

- [ ] **Step 6: Make `/billing` a real checkout page**

It currently renders only a lead-capture form. Add Stripe Checkout and the Customer Portal as the primary paths; keep the existing form as the no-card fallback so the manual flow still works.

---

## Task 4: Server-renderable drawings

**Covers:** Making the SLD and riser printable without a browser

**Files:**
- Create: `src/lib/sld/svg-postprocess.ts`
- Create: `src/lib/drawings/riser-model.ts`
- Create: `src/lib/drawings/riser-svg.tsx`
- Create: `src/lib/drawings/sld-render.ts`
- Create: `src/lib/drawings/drawings-html.tsx`
- Create: `src/lib/drawings/drawings-pdf.ts`
- Create: `src/lib/drawings/chromium-pool.ts`
- Modify: `src/app/(app)/riser/page.tsx`
- Modify: `src/app/(app)/sld/page.tsx`
- Delete: `scripts/spike-drawings-pdf.ts`

**Interfaces:**
- Produces: `buildRiserModel(project, buildingId, findBreaker) → RiserModel`, `renderSldPageSvg(page) → string`, `renderDrawingsHtml(opts) → string`, `generateDrawingsPdf(opts) → Buffer`

- [ ] **Step 1: Move the SLD post-processors out of the client component**

Copy `extendCables` and `repositionLabels` verbatim from `src/app/(app)/sld/page.tsx:600-705` into `src/lib/sld/svg-postprocess.ts` and import them back. Pure DOM, no React state, no behavior change — verify the client SLD page renders identically.

- [ ] **Step 2: Extract the riser geometry**

Lift lines 130-234 of `src/app/(app)/riser/page.tsx` into a pure `buildRiserModel()`. Every input is already a pure function from `src/lib/calculations/`, so this is a move, not a rewrite.

- [ ] **Step 3: Make the riser SVG server-renderable**

The current JSX calls `t()` for i18n and references `var(--card-bg)`, neither of which resolves during server printing. Produce `riser-svg.tsx` taking `RiserModel` plus `theme: 'print' | 'screen'`: no hooks, literal English strings, concrete hex colors in print mode. This de-duplicates the renderer and is a net win for the codebase.

- [ ] **Step 4: Build the landscape sheets**

`renderDrawingsHtml()` must reuse **`wrapReportMarkup()`** so the styling is literally the report's, with `ReportHeader` on every sheet and a "Sheet N of M" footer. Each SLD page gets its own `.print-page-container` (which already sets `page-break-before: always`) so 20 floors becomes 20 landscape pages. Constrain each SVG to the landscape text block with a max-height guard.

- [ ] **Step 5: Pool the Chromium instance**

Each launch costs 3-8s and hundreds of MB. Use a module-level singleton with a one-concurrent gate rather than launching per call.

- [ ] **Step 6: Rewire the riser page and re-run the spike scenario**

Confirm the on-screen riser is visually unchanged, then re-run the 20-floor case as a permanent test.

---

## Task 5: MCP server and tools

**Covers:** The endpoint and the tool surface

**Files:**
- Create: `src/app/api/mcp/route.ts`
- Create: `src/mcp/context.ts`
- Create: `src/mcp/registry.ts`
- Create: `src/mcp/freshness.ts`
- Create: `src/app/api/mcp/artifacts/[id]/route.ts`

**Interfaces:**
- Consumes: `verifyProjectAccessAsUser`, `canStartProject`, `renderReportHtml`, `buildReportWorkbook`, `generateDrawingsPdf`
- Produces: 14 tools, all `procal_`-prefixed

- [ ] **Step 1: Stand up the endpoint**

Streamable HTTP, stateless — a fresh server and transport per request, no session state, so it scales and survives serverless recycling.

```ts
export const maxDuration = 120;
export const dynamic = "force-dynamic";
```

`GET`/`DELETE` return 405. Authenticate with `resolveMcpActor` before handling anything.

- [ ] **Step 2: Build `McpCtx`**

Bind the resolved actor to the project so every tool resolves access the same way:

```ts
resolveProject(projectId, { pageKey, requiredAction }) // → verifyProjectAccessAsUser
```

- [ ] **Step 3: Implement the freshness guard — the highest-value correctness rule**

Most report schedules (cable, MDB, BOM, voltage drop) read **stored** `FloorItem` columns, not live math, so they go stale until `recalculate` runs. Without this guard the agent will confidently export a wrong submittal. Every export tool calls it first:

```ts
export async function ensureFresh(projectId) {
  const p = await db.project.findUnique({ where: { id: projectId }, select: { engineVersion: true } });
  if (p?.engineVersion !== ENGINE_VERSION) await recalculate(projectId);
}
```

- [ ] **Step 4: Register the tools**

*Discover and pay* — `procal_list_projects`, `procal_get_project_brief` (compact state, what is missing, engine staleness), `procal_create_checkout`

*Build* — `procal_create_project_from_spec` (one-shot declarative: buildings, floors, templates, rooms, mechanical loads, then auto-recalculate) plus the granular set for editing an existing project: `procal_upsert_building`, `procal_define_apartment_template`, `procal_assign_floor_template`, `procal_set_building_loads`

*Derive* — `procal_recalculate_project`, `procal_get_design_summary` (transformer kVA, MDB main, per-floor kW/kVA/ΔV, warnings)

*Export* — `procal_export_report_pdf`, `procal_export_excel`, `procal_export_drawings_pdf`

`create_project` returns a structured `{ status: "payment_required", checkoutUrl, creditsRequired }` rather than an error, so the agent can hand the user a link and resume once the webhook fires.

- [ ] **Step 5: Add artifact delivery**

MCP results are text/JSON, so binaries cannot come back inline. Add `McpArtifact` (bytes in Postgres `Bytes` — PDFs are 1-3 MB, Excel ~200 KB) and `GET /api/mcp/artifacts/[id]` guarded by an expiring signed token. Disk is not durable on Vercel serverless, so `Bytes` is the correct choice. Tools return a URL.

- [ ] **Step 6: Stamp the audit log**

Every mutation calls `logProjectActivity` with `source: "mcp"`. Cheap now, painful to retrofit.

---

## Task 6: Tests and documentation

**Covers:** Proving it works and documenting it

**Files:**
- Create: `scripts/verify-mcp-e2e.ts`
- Create: `docs/reference-mcp.md`
- Create: `docs/how-to-connect-ai-client.md`
- Modify: `docs/reference-api.md`
- Modify: `docs/reference-data-model.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Unit tests**

Per tool: zod rejection. Plus the credit gate returns the payment-required shape for an unpaid user and allows a subscribed one; a non-PM member is denied; the freshness guard fires on a stale `engineVersion`; a riser-model golden test against the seeded project; and a pagination test asserting N sheets for N floors.

- [ ] **Step 2: End-to-end script**

Follow the existing `scripts/verify-*.ts` convention: list tools → create from spec → recalculate → export all three artifacts → assert non-trivial file sizes.

- [ ] **Step 3: Documentation**

New `docs/reference-mcp.md` (every tool, every schema) and `docs/how-to-connect-ai-client.md` (Claude Desktop, Claude Code, Cursor config). While there, fix the stale `docs/reference-data-model.md` and `docs/reference-api.md`; add the MCP surface to `CLAUDE.md` so future agents know it exists.

---

## Risks

- **zod 4 vs SDK** — Task 0 Step 2 is a gate, not a formality; it determines how Task 5 is built.
- **Pricing contradiction** — the landing copy and the strategy doc disagree. Task 0 Step 3 must be settled before Task 3.
- **Vercel serverless** — the existing PDF route already sets `maxDuration = 60`, so there is precedent, but Chromium cold-start inflates a 50 MB pack on first call. Pre-warm or budget for a slow first export.
- **schematex is AGPL-3.0-only** — pre-existing, but record an explicit decision before shipping MCP commercially.
- **20+ page PDFs** — memory and time in a single render; Task 1 Step 4 is where this surfaces.
- **Stale stored numbers** — the single most likely way this ships broken. Task 5 Step 3 is the mitigation; do not skip it.

## Suggested execution order

`Task 0 → 1 → 4 → 2 → 5 → 3 → 6`

Payments last: the tools can ship against the existing credits gate returning `payment_required` plus a checkout URL, and Stripe then lands independently without touching any tool contract.
