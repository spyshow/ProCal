# How-to: run ProCal locally

Goal: from a clean clone to a running dev server with a database, mail relay,
seeded admin + catalog, and a passing test suite.

## 1. Start the backing services

ProCal needs Postgres and (for the captured-lead billing loop) an SMTP relay.
Both are docker-compose services:

```bash
docker compose up -d
```

This starts:
- `procal-db` — Postgres 16 on `localhost:5432` (user/db/pass all `procal`).
- `procal-mail` — **Mailpit** on SMTP `localhost:1025` + web inbox
  `http://localhost:8025`. Lead notifications land here in dev; open the inbox
  to read captured `ContactRequest` emails.

## 2. Install dependencies

```bash
npm install
```

## 3. Configure `.env`

Copy `.env.example` → `.env` and fill in. The full set:

```env
DATABASE_URL="postgresql://procal:procal@localhost:5432/procal?schema=public"
JWT_SECRET="<generate a long random hex string>"
# Captured-lead notification (dev = Mailpit on :1025; prod = your real relay)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
LEADS_TO_ADDRESS=leads@procal.local
```

`JWT_SECRET` is read at module load — the app hard-crashes on boot without it
(see [Auth & admin reference](./reference-auth-admin.md)). The `SMTP_*` +
`LEADS_TO_ADDRESS` keys drive `src/lib/notify.ts`; without them the credit-
request 502s (D4 send-first gate). See
[Captured-lead credit gate](./explanation-billing-captured-lead.md).

## 4. Database: migrate + generate the client

```bash
npx prisma migrate dev     # apply all migrations in prisma/migrations/
npx prisma generate        # regenerate the client into src/generated/prisma
```

> **Prisma 7 gotcha.** `migrate dev` does **not** regenerate the client in
> Prisma 7 — you must run `npx prisma generate` afterward. The client is
> imported as `from "../generated/prisma/client"` (see
> [Data model reference](./reference-data-model.md)). Connection uses the
> `PrismaPg` driver adapter (`prisma.config.ts`), not the legacy datasource URL
> block.

## 5. Seed the admin + equipment catalog

```bash
npx tsx prisma/seed.ts
```

The seed creates an `engineer` ADMIN (with the full equipment catalog) using
`SEED_ADMIN_PASSWORD` from your `.env`. If that variable is unset, a random
one-time password is generated and printed to the console exactly once.
Re-running the seed is safe: it skips the admin entirely once any ADMIN
account exists. (The old hardcoded `engineer / password123` was removed — a
publicly-known admin password must never be re-seeded.)

Optional — a full mixed-use demo project (towers + mall, 112 apartments):

```bash
npx tsx prisma/seed-test-project.ts
```

## 6. Run

```bash
npm run dev     # http://localhost:3000 → redirects to /login (or /dashboard)
npm run build   # production build
npm start       # production start
```

Log in as `engineer` / `password123`, or self-register at `/signup` (username
≥ 3 chars, password ≥ 6, plus a replyable email — required for the credit
loop).

## 7. Lint & test

```bash
npm run lint       # eslint
npm test           # vitest run (the calc engine + sld + reports self-checks)
npm run test:watch # vitest watch
```

The calculation engine is pure TS with Vitest self-checks under
`src/lib/calculations/*.test.ts` (plus `sld/` and `reports/`). Run them after
any change to a calc module — they're the cheap guard against silent drift
between the calculator, the routes, and the reports.

## Verify the billing loop end-to-end

With the mail relay up, request credits as a zero-credit non-admin:

1. Log in as a non-admin with `credits === 0` (create one at `/signup`, or as
   admin set a user's credits to 0 in `/admin/users`).
2. Hit the projects page — the "New Project" button is hidden ("Get credits"
   link to `/billing` shows instead). That's the proactive gate.
3. POST a project anyway (`/api/projects` direct, or the UI if you re-enable
   it) → `402 Payment Required`. The reactive backstop.
4. On `/billing`, submit the credit-request form → `POST /api/contact` sends the
   SMTP email first (D4), then persists the `ContactRequest` row on success.
5. Open `http://localhost:8025` — the lead email is in the Mailpit inbox
   (`From: leads@procal.local`, `Reply-To: <your email>`).
6. As admin, `/admin/leads` shows the OPEN lead; `/admin/users` grants credits
   (the human fulfillment step); close the lead in `/admin/leads`.

If step 4 returns "Could not send your request right now" (502), Mailpit isn't
running or the `SMTP_*`/`LEADS_TO_ADDRESS` env is missing — the D4 send gate is
correctly refusing to persist a row for an undelivered email.

## Related

- [Tutorial: your first project](./tutorial-getting-started.md) — the guided
  walk from running to a printed report.
- [Auth & admin reference](./reference-auth-admin.md) — the session/middleware/
  admin primitives behind these steps.
- [Captured-lead credit gate](./explanation-billing-captured-lead.md) — why
  the mail relay is a hard prerequisite.
