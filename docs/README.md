# ProCal documentation

ProCal is a multi-tenant electrical-design app: load calculations, per-phase
balancing, cable/breaker sizing, short-circuit and coordination studies,
single-line and riser diagrams, and printable engineering schedules — against
a catalog of real ABB / Schneider breakers.

These docs are organized by the **Diataxis framework** — four quadrants by what
you're trying to *do*:

- **Tutorial** — learn the app by walking through it (you're new).
- **How-to** — accomplish a specific task (you know what you want).
- **Reference** — look up a contract or fact (you need the detail).
- **Explanation** — understand *why* something is shaped the way it is.

## Tutorial

- [Your first ProCal project](./tutorial-getting-started.md) — install → run →
  project → building → apartment template → floors → balance → panels → SLD →
  PDF report.

## How-to guides

- [Run ProCal locally](./how-to-run-locally.md) — docker-compose, env, migrate,
  seed, dev, test, plus verifying the billing loop end-to-end.
- [Add a load to a floor](./how-to-add-a-load.md) — apartment / library / manual
  panel item paths, recalculate, rebalance.
- [Grant credits & work the lead ledger (admin)](./how-to-grant-credits-admin.md) —
  read leads, grant credits, close, the loop's human-fulfillment half.
- [Import the breaker catalog from CSV (admin)](./how-to-import-breaker-catalog.md) —
  bulk upsert, the CSV format, the per-row summary, family auto-creation.

## Reference

- [Calc engine](./reference-calc-engine.md) — `phaseBalance`, `feeders`,
  `cables`, `shortCircuit`, `selectivity`, `riser`, `loads`: signatures,
  standards, algorithms, module map.
- [Data model](./reference-data-model.md) — every Prisma model, field/type/
  default/relation/index; the enums-as-strings convention; migrations.
- [API](./reference-api.md) — every route handler: method, auth posture, inputs,
  and the non-obvious behavior. The matcher-exclusion list and the one
  sessionless route.
- [Auth & admin](./reference-auth-admin.md) — auth primitives, the middleware
  matcher regex, `requireAdmin`, admin routes, `UserContext`, country defaults.
- [SLD & reports](./reference-sld-reports.md) — the Schematex-DSL generator,
  the in-browser SVG post-processing, the schedule components, how the printed
  output stays consistent with the calculator.

## Explanation

- [Phase balancing](./explanation-phase-balancing.md) — why the neutral uses
  the total angle (not PF alone), why unbalance is a current proxy (not a
  literal 2 %), why assignment is on read (no backfill), why the 2× guard only.
- [Captured-lead credit gate](./explanation-billing-captured-lead.md) — why
  there's a credit loop without a payment processor, the D4 send-first gate,
  one-OPEN-per-user, the reactive 402 + self-heal, the Reply-To envelope.

---

## How the quadrants fit together

```
   learning ────────────── understanding
        │                       │
   Tutorial                Explanation
   (walk)                   (why)
        │                       │
   How-to                  Reference
   (do)                     (what)
        │                       │
   doing ─────────────────── looking
```

- **New to ProCal?** Start with the [tutorial](./tutorial-getting-started.md).
- **Have a task?** Grab a [how-to](#how-to-guides).
- **Need a contract or signature?** Use a [reference](#reference).
- **Wondering why a decision was made?** Read an [explanation](#explanation).

## Cross-cutting note

Every reference and explanation doc ends with a **Related** section linking the
others it touches. The numbers in the calc engine, the API routes, the SLD, and
the reports never drift because they all import from the same pure-TS calc
modules under `src/lib/calculations/`. If you change one, run `npm test` (the
Vitest self-checks) and `recalculate` on a seeded project to verify the others
still agree.
