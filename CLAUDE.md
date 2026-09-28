@AGENTS.md

## Documentation

Structured docs live in `docs/` (Diataxis framework — tutorial / how-to / reference / explanation). Read the relevant doc before changing a subsystem, and keep it updated when you change load-bearing behavior:

- **Reference** (contracts/signatures): [calc engine](docs/reference-calc-engine.md) · [data model](docs/reference-data-model.md) · [API](docs/reference-api.md) · [auth & admin](docs/reference-auth-admin.md) · [SLD & reports](docs/reference-sld-reports.md) · [MCP tools](docs/reference-mcp.md)
- **Explanation** (why decisions were made): [phase balancing](docs/explanation-phase-balancing.md) · [captured-lead credit gate](docs/explanation-billing-captured-lead.md)
- **How-to / tutorial**: see [`docs/README.md`](docs/README.md) · [connect an AI client](docs/how-to-connect-ai-client.md)

The numbers in the calc engine, API routes, SLD, and reports never drift because they all import from the same pure-TS modules under `src/lib/calculations/`. If you change one, run `npm test` and `recalculate` on a seeded project to verify the others still agree — and update the doc that claims the old behavior.

## MCP server

`POST /api/mcp` exposes ProCal to AI agents via 13 `procal_*` tools (Streamable HTTP, bearer PAT auth). Source: `src/mcp/`, schema in [reference-mcp.md](docs/reference-mcp.md).

Things that will bite you if you don't know them:

- **MCP tools are thin.** They validate with zod and call `src/lib/calculations/`. Never compute engineering values in a tool handler.
- **Every export calls `ensureFresh()` first** (`src/mcp/freshness.ts`). Most report schedules read *stored* `FloorItem` columns, so exporting without it ships a confidently wrong submittal. Don't add an export tool that skips it.
- **Every project-scoped tool goes through `ctx.resolveProject()`** → `verifyProjectAccessAsUser`. That is what stops a token reaching what its owner cannot reach in the UI. There is no other permission path.
- **`src/proxy.ts` needs `api/mcp` in two places** (allow-list *and* the matcher negative lookahead). Removing either turns a bearer 401 into an opaque redirect failure.
- **Drawings are server-rendered** through `src/lib/drawings/`. The riser geometry is shared with the interactive page via `riser-model.ts` + `riser-svg.tsx`; the SLD DSL renders to SVG in Node via schematex's `render()`. Riser pagination (`paginateRiser`) exists because a 20-floor riser is ~4400 units tall and unreadable on one sheet.
- **`page.evaluate` must take a string, not a function.** tsx/esbuild wraps named inner functions in a `__name()` helper that throws inside Chromium.
- **Hand-written HTML passed to `wrapReportMarkup()` needs `class=`, not `className=`** — those strings never pass through React.

Verify end to end with `npx tsx scripts/verify-mcp-e2e.ts` (needs a running server and `PROCAL_MCP_TOKEN`); `npm test` covers the protocol in-process.

## Billing

Stripe is **optional**. With no `STRIPE_SECRET_KEY`, `/api/billing/checkout` returns 503, `/billing` shows the manual credit-request form, and the MCP `procal_create_checkout` tool tells the user to buy credits by hand. Everything else works without it.

The project gate is `canStartProject()` in `src/lib/billing/entitlement.ts` — precedence **admin → active subscription (quota permitting) → credits**. `POST /api/projects`, `GET /api/billing/quota` and the MCP create tool all use it; do not re-inline the rule. Pricing is decided in `docs/ideas/pricing-strategy.md` §4 (note: that directory is gitignored).

Subscription allowances are **1 / 5 / 15 projects per period** by tier, stored in `TIER_PROJECT_ALLOWANCE` next to the prices so the two cannot disagree. The quota gates *creation*, not existence. Two rules worth keeping:

- A spent quota returns `reason: "quota_exhausted"`, **not** `payment_required`, and must never fall back to credits — that would silently convert a paying subscriber into a per-project customer.
- An unrecognised tier **refuses** rather than granting unlimited. Failing open here is a revenue leak.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## Frontend design

When designing or building frontend UI, reach for these before hand-rolling markup/CSS:

- **21st.dev** — `/21st-ai`, `/21st-cli-use`, `/21st-registry`, plus the `mcp__plugin_21st_21st__*` tools. Search the catalog (`search`/`get_inspiration`) and pull a real component (`get_component`) before writing one from scratch; only `generate` when the catalog has nothing close. Catalog = React + shadcn, plus themes/templates.
- **UI UX Pro Max** — `/ui-ux-pro-max:design`, `/ui-ux-pro-max:ui-styling`, `/ui-ux-pro-max:design-system`, `/ui-ux-pro-max:ui-ux-pro-max` for layout, styling, and general UX. Match this repo's existing dark/orange engineering aesthetic (see `src/components/Sidebar.tsx`, `.engineering-table` / `.dense-input` classes in `globals.css`) — don't import a foreign look.
- **Framer Motion** — `/framer-motion` for animation and motion patterns.
- **design-taste-frontend** — anti-slop frontend taste skill, installed *outside* the Claude Code skills tree via `npx skills add Leonxlnx/taste-skill` (lands in `~/.agents/skills/design-taste-frontend/`). Because this harness loads skills from `~/.claude/skills/` + plugins + project `.claude/skills/`, `/design-taste-frontend` may NOT be auto-surfaced — if it isn't in the skill list, read `~/.agents/skills/design-taste-frontend/SKILL.md` directly and follow it. Scope per its own SKILL.md: landing pages, portfolios, redesigns — explicitly **not dashboards, data tables, or multi-step product UI**, so don't reach for it for ProCal's engineering app views; use it for marketing/landing/portfolio surfaces.

Order: 21st for components → UI UX Pro Max for layout/styling polish → framer-motion for motion → design-taste-frontend as the final taste pass (landing/portfolio/redesign only). Match the existing codebase look; don't switch stacks.

## Rules
- For new feature work: create a branch and switch to it first, then develop and commit on it as you go. Push the branch when the work is finished. Only open a PR when one is actually needed — don't open one automatically for every feature branch.
- To find or install a skill that isn't already available, use the `find-skills` skill to discover agent skills from `vercel-labs/skills`, then install with `npx skills add vercel-labs/skills@<skill> -g -y`. Don't hand-roll what an available skill already covers.
