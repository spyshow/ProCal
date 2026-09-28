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

- [x] **Step 1: Resolve the working tree** — DONE

Tree was clean at the time of branching (the uncommitted files were swept into `6badf5e` by the auto-commit agent). Branched:

```bash
git checkout -b feat/mcp-server
```

- [x] **Step 2: Gate the zod version — CLEARED, no blocker**

```bash
npm view @modelcontextprotocol/sdk version peerDependencies
# version = '1.30.1'
# peerDependencies = { zod: '^3.25 || ^4.0', '@cfworker/json-schema': '^4.1.1' }
```

SDK 1.30.1 accepts **zod 4**, so the existing `zod ^4.4.3` is used as-is. No version pinning, no rewrite of the `ZodError` import in `src/lib/api-errors.ts:3`.

**Note:** `@cfworker/json-schema ^4.1.1` is also a peer dependency and must be installed explicitly.

- [x] **Step 3: Settle the pricing model (DONE 2026-09-28)**

The landing page previously advertised "first project $20, then flat $100 per project, zero recurring fees" — which contradicted `docs/ideas/pricing-strategy.md` and priced the product **3-10x above** every option in that doc. The subscription model is now canonical.

**Decided tiers** (all with 1 seat baseline; `+$39/seat/mo` thereafter):

| Plan | Price | Projects / month | Seats | $ / project |
|---|---|---|---|---|
| Free trial | $0 | 1 (one-time, watermarked PDF) | 1 | — |
| Starter | $29/mo | 1 | 1 | $29.00 |
| Single Project Pass | $49 one-time | 1 | 1 | $49.00 |
| Professional | $89/mo | 5 | 2 | $17.80 |
| Team | $249/mo | 15 | 5 | $16.60 |

Three rules that the schema must enforce:

1. **The pass must be the most expensive way to buy a project.** At $30 it made Professional ($89 for 3) pointless against 3 passes ($90). This is the whole conversion lever.
2. **Every plan includes 1 seat.** A $29 Starter with 0 included seats means a solo user pays $68.
3. **Seats do not apply to the pass** — it is a one-time, single-user purchase.

**Entitlement semantics:** the quota gates project **creation**, not project **existence**. Once created, a project stays accessible forever. This is mandatory for MCP: an agent creates a project once and must never be locked out of its own work mid-session. `User.credits` already models this, so no new accounting concept is needed.

**No volume bundles.** The old $69/5 and $149/15 packs ran $9.93-13.80/project, undercutting Starter and becoming a subscription bypass.

**"Unlimited projects" is retired everywhere** — a heavy user consuming 20 projects for $89 destroys cost-to-serve.

Implemented in this pass: `docs/ideas/pricing-strategy.md` rewritten, plus the `pricing` block in all four locales (`en`/`ar`/`de`/`it`) and `src/components/PricingSection.tsx` rebuilt to render free trial + 3 tiers + pass.

**Still to build in Task 3:** `Subscription` (per plan) and `CheckoutIntent.kind` (`SUBSCRIPTION | CREDIT_PACK`). Credit packs become the $49 pass, so the pack products are $29/$89/$249 recurring and one $49 one-time.

---

## Task 1: Spike — can we draw on the server?

**Covers:** The riskiest assumption in the plan, validated before anything is built

**Files:**
- Create: `scripts/spike-drawings-pdf.ts` (throwaway — delete after Task 4)

**Interfaces:**
- Consumes: `generateSLDPages()` from `src/lib/sld/generator.ts`, `render()` from `schematex`, `generateServerPdf()` from `src/lib/reports/server-pdf.ts`
- Produces: a validated answer to "can the SLD be printed server-side?"

- [x] **Step 1: Prove the SLD renders to a string in Node** — CONFIRMED

`render(page.dsl)` returns a plain SVG string with no DOM. `generateSLDPages()` is also pure and needs no database, so the whole path is testable with synthetic project data.

- [x] **Step 2: Post-process inside Chromium** — CONFIRMED

`extendCables` / `repositionLabels` stringify and evaluate cleanly in the page realm. `viewBox` was rewritten on **20/20** sheets (594 → 686), proving `getBBox()`-dependent code runs.

- [x] **Step 3: Print 20 landscape pages** — CONFIRMED

`page.pdf({ format: 'A4', landscape: true, preferCSSPageSize: true })` over one `.sheet` container per floor.

- [x] **Step 4: Test on a 20-floor tower** — CONFIRMED

Result: **20 pages, 94 KB, no clipping, no overlap.** Verified visually by screenshotting F1 (direct feed), F3 (sub-panel), and F20 (highest floor). Both floor topologies render correctly and output quality does not degrade with floor number.

- [x] **Step 5: Record the outcome** — **PASS**, proceed to Task 4

> **API correction for Task 4:** `renderResult()` returns `status: "valid"`, **not** `"ok"`. Do not gate on a magic string — read the `diagnostics` array and fail only when a diagnostic is an error.

### Defects found during the spike (both pre-existing, both in the client SLD too)

1. **Duplicate breaker ratings.** `generator.ts` sets *both* `label` and `rating` to the same `item.breakerSize`, so schematex draws each ampacity twice. After `repositionLabels` moves one copy beside the breaker, a ghost copy remains in grey at the original position. Every branch shows its rating twice.
2. **Repositioned labels collide with the cable-tag row.** `repositionLabels` sets `x = rightX + 14`, which lands on the `Wf20a / 6 mm²` row on wide sheets. On the sub-panel sheets the bold breaker labels visibly overlap the cable tags.

Neither blocks the MCP work, but both are visible in a submittal PDF. Fix them **in the export post-processing path only** (`src/lib/drawings/sld-render.ts`) so the interactive SLD page is not changed. Add a de-duplication pass plus a vertical nudge to the label-repositioning step, and re-screenshot to confirm.

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

- [x] **Step 1: Add the `McpToken` model** — DONE

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

- [x] **Step 2: Extract the user-agnostic core of `project-auth.ts`** — DONE

Shipped as `ProjectAuthSuccess` / `AuthedUser` / `ProjectAccessOptions` exports so the MCP context and every future caller share one permission implementation and one options type.

`verifyProjectAccess` currently calls `getSessionUser()` internally. Split it so the permission logic has one implementation shared by both auth paths — this is what keeps MCP bound to the same permissions as the UI.

```ts
export async function verifyProjectAccessAsUser(user, projectId, options) { /* current body, minus the getSessionUser() call */ }
export async function verifyProjectAccess(projectId, options) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return verifyProjectAccessAsUser(user, projectId, options);
}
```

- [x] **Step 3: Update `src/proxy.ts` — two changes, both required** — DONE

Add `/api/mcp` to the top-level allow-list **and** to the matcher negative lookahead at `src/proxy.ts:61`. Miss the matcher and the endpoint 302-redirects to `/login`, which MCP clients fail on opaquely.

```ts
pathname.startsWith("/api/mcp") ||   // in the allow-list

"/((?!api/projects|api/buildings|api/cables|api/equipment|api/contact|api/admin|api/invites|api/mcp|...).*)"
```

- [x] **Step 4: Implement `src/lib/mcp-auth.ts`** — DONE

Revoked tokens and disabled users are filtered **in the query** rather than after it, so the selected shape is already exactly `McpUser` and no field has to be stripped. `lastUsedAt` is a fire-and-forget write that cannot fail the request. No constant-time compare: the lookup is an exact indexed hash match, so an attacker would have to *collide* with a stored hash rather than be compared against one.

- [x] **Step 5: Add token endpoints and the settings UI** — DONE

`GET/POST/DELETE /api/mcp/tokens` plus a new "AI Agent Access (MCP)" tab (`src/components/settings/McpTokensTab.tsx`) with a one-time reveal, copy button, revoke, and a copy-paste client config.

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
// active Subscription          → allowed within the tier's projects/month allowance
// sufficient credits (pass)    → allowed
// otherwise                    → { allowed: false, reason: "payment_required", checkoutUrl }
```

Point `src/app/api/projects/route.ts` at it. The existing 402 response and client redirect to `/billing` must keep working unchanged.

The allowance counts **projects created in the current billing period**, not currently-open projects — see Task 0 Step 3, entitlement semantics.

**DONE.** `TIER_PROJECT_ALLOWANCE` (1 / 5 / 15 by tier) lives in `src/lib/stripe.ts`
next to the prices so a tier's price and its allowance cannot disagree. The count is
`Project.count({ createdAt: { gte: currentPeriodStart } })`.

`Subscription.currentPeriodStart` was added because deriving the period start from
`currentPeriodEnd` drifts on anniversary billing. The webhook populates it on both
`checkout.session.completed` and `customer.subscription.updated` — the renewal is
the event that resets the allowance.

Three deliberate edge-case decisions:

- **A spent quota never falls back to credits.** It returns
  `reason: "quota_exhausted"`, not `payment_required`. Falling back would silently
  convert an $89 subscriber into a per-project customer without them agreeing to
  it. The message says "upgrade or buy a pass", and the MCP tool's `nextStep`
  explicitly tells the agent *not* to offer credits.
- **An unrecognised tier refuses rather than granting unlimited.** Failing open on
  data drift is a revenue leak; failing closed is a visible, fixable error.
- **A missing `currentPeriodStart` falls back to a rolling 30-day window** and logs
  a warning, so our own bookkeeping can never lock out a paying customer.

Surfaced in three places, so the explanation always matches the decision:
`GET /api/billing/quota` (the `/billing` usage meter), the `402` body from
`POST /api/projects` (`reason` + `tier` + `allowance` + `usedThisPeriod`), and a
`quota` block on a successful MCP create.

Coverage: 10 tests in `billing.test.ts` (per-tier caps, period-boundary query,
no-credit-fallback, unknown-tier refusal, rolling-window fallback) and 1 MCP
protocol test asserting `quota_exhausted` reaches the agent as a non-error.

**Regression caught while implementing this:** centralising the gate initially sent
`admin_bypass` down the credit-spend branch, so admins got a 402. The existing
`POST /api/projects` test failed. Both `admin_bypass` and `subscription` now skip
the spend.

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

- [x] **Step 1: Move the SLD post-processors out of the client component** — DONE

`src/lib/sld/svg-postprocess.ts` holds both functions verbatim; the SLD page imports them. The module documents the self-contained constraint (they are stringified into the browser, so no imports and no closure over module scope).

- [x] **Step 2: Extract the riser geometry** — DONE

`src/lib/drawings/riser-model.ts` → `buildRiserModel(project, buildingId, findBreaker)`. The page's inline `FloorData` interface and the duplicate circuit-label IIFE are gone; the model now supplies `circuits[]` so the component stays presentational.

**Dropped as dead code:** the page computed a `mdbSizing = sizeCableAndBreaker(...)` result and then rendered the MDB box from `computeFeeders` output instead, so it was never displayed. Not carried forward.

- [x] **Step 3: Make the riser SVG server-renderable** — DONE

`src/lib/drawings/riser-svg.tsx` takes `model`, optional `sheet`, a `theme` (`SCREEN_RISER_THEME` uses the app's CSS variables, `PRINT_RISER_THEME` uses concrete hex) and a `labels` override. No hooks, no i18next. The page passes translated labels; the print path passes `DEFAULT_RISER_LABELS`. `ref` is a normal prop (React 19).

- [x] **Step 4: Build the landscape sheets** — DONE, plus **riser pagination** (see finding 3)

`renderDrawingsHtml()` reuses `wrapReportMarkup()`, so the drawings inherit the report's exact stylesheet. `ReportHeader` was **not** used — it needs a full `Project` with a different prop shape, and the drawings build their own `.drawing-head` / `.drawing-foot` in the same visual language, which keeps `drawings-html` free of a hard dependency on the report component set.

- [x] **Step 5: Pool the Chromium instance** — DONE

`src/lib/drawings/chromium-pool.ts`. Measured on the 20-floor tower: **1.0s first call, 0.6s second** (browser reused), against a 3-8s launch per call. Failures never poison the queue.

- [x] **Step 6: Rewire the riser page and re-run the scenario** — DONE

- Page renders from the shared model + component; `tsc`, `eslint` and the visual check all pass.
- `scripts/verify-drawings.ts` is the permanent regression check: 20-floor tower → asserts the PDF page count, prints the pool timings, and writes sheet screenshots to `scratch/`.
- Test suite: **800 passing** (779 before this plan + 21 new).
- `npm run build` green.

### Findings from Task 4 — carry these forward

1. **`page.evaluate` must take a string, not a function.** tsx/esbuild wraps named inner functions in a `__name()` helper; serialising such a function into Chromium throws `ReferenceError: __name is not defined`. `page.evaluate('document.fonts.ready')` and the stringified post-processor both work. Any future `page.evaluate` in this repo must avoid inner function expressions.
2. **Raw HTML strings need `class=`, not `className=`.** The sheet markup is a template string, so it never passes through React. `wrapReportMarkup` injects it verbatim. Using `className=` produced markup with no `class` attribute at all — no styling, no page breaks, and a 24-page PDF for 21 sheets. Anything hand-written into `wrapReportMarkup` must use plain HTML attributes.
3. **A tall riser must paginate.** A 20-floor riser is 1100 × ~4400 SVG user units. Fitted to a landscape A4 body (~1047 × 597 px) that is a **14% scale — illegible**. `paginateRiser()` now splits floors into ~880-unit sheets (≈5 floors each), draws the transformer/incomer/MDB block on the first sheet only, and labels continuations. Result: 4 readable riser sheets instead of 1 unreadable one. `generateDrawingsPdf` reports the paginated count.
4. **The two spike defects are fixed, print-path only.** `stripDuplicateMcbLabels()` drops the redundant `rating` when it equals the `label` (dropping the *label* instead is wrong — schematex then renders a literal "MCB"), and the export post-processor nudges repositioned labels off the cable-tag row. Confirmed by screenshot: each breaker now shows its rating once, clear of the `Wf1a / 6 mm²` annotations. The interactive page is unchanged.

**Known cosmetic item, not addressed:** schematex renders the floor-breaker `rating` (e.g. "81A") with a very thin "1", which reads as a gap at print scale. Pre-existing in the client SLD as well, and it comes from schematex's own text layout, not from this refactor.

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

- [x] **Step 1: Stand up the endpoint** — DONE

`WebStandardStreamableHTTPServerTransport` (Web-standards, so it drops straight into a Next route handler) with `sessionIdGenerator: undefined` for stateless operation and `enableJsonResponse: true`. `GET`/`DELETE` return JSON-RPC 405. Unauthenticated requests get a JSON-RPC 401 with `WWW-Authenticate: Bearer` — not a redirect.

- [x] **Step 2: Build `McpCtx`** — DONE

`createMcpCtx(user)` in `src/mcp/context.ts`. `resolveProject()` throws a structured `McpToolError` rather than returning a `NextResponse`, so a tool cannot leak an HTTP object into an MCP result. A test asserts every project-scoped tool takes a `projectId`.

- [x] **Step 3: Implement the freshness guard — the highest-value correctness rule** — DONE

`src/mcp/freshness.ts`. `ensureFresh()` short-circuits when `engineVersion === ENGINE_VERSION`; otherwise it replays the recalculate logic from `POST /api/buildings/[id]/recalculate` (whole-project residential unit count for the diversity factor, undersized manual breakers cleared, 0.1 voltage-drop placeholders reset) and stamps the engine. All three export tools call it before rendering. Also exports `loadProjectForDesign()` and `summariseRiser()`.

- [x] **Step 4: Register the tools** — DONE, **13 not 14**

`procal_create_project` was folded into `procal_create_project_from_spec` rather than shipped as a thin wrapper, since the spec form subsumes it.

- [x] **Step 5: Add artifact delivery** — DONE

`McpArtifact` holds the bytes; `GET /api/mcp/artifacts/[id]` accepts **either** the bearer token or the session cookie, so the agent can fetch the file and the user can click the link. Ownership and expiry are both enforced; an expired row is deleted on access. 24-hour default TTL.

- [x] **Step 6: Stamp the audit log** — DONE

Mutating tools call `logProjectActivity` with `details: { source: "mcp" }`.

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
- **Pricing model** — **settled** (Task 0 Step 3): subscription-first, capped allowances, $49 one-time pass as the escape hatch. `Subscription` + `CheckoutIntent` are now unambiguous. The real remaining risk is the 20% discount for annual billing, which is asserted on the landing page but not yet priced into the Stripe products — do that in Task 3.
- **Vercel serverless** — the existing PDF route already sets `maxDuration = 60`, so there is precedent, but Chromium cold-start inflates a 50 MB pack on first call. Pre-warm or budget for a slow first export.
- **schematex is AGPL-3.0-only** — pre-existing, but record an explicit decision before shipping MCP commercially.
- **20+ page PDFs** — memory and time in a single render; Task 1 Step 4 is where this surfaces.
- **Stale stored numbers** — the single most likely way this ships broken. Task 5 Step 3 is the mitigation; do not skip it.

## Suggested execution order

`Task 0 → 1 → 4 → 2 → 5 → 3 → 6`

Payments last: the tools can ship against the existing credits gate returning `payment_required` plus a checkout URL, and Stripe then lands independently without touching any tool contract.
