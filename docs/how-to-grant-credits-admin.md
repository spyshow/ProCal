# How-to: grant credits & work the lead ledger (admin)

Goal: review a captured-lead credit request, grant the user credits, and close
the lead — the human fulfillment half of the captured-lead billing loop. You
need an `ADMIN` account.

## The loop in one paragraph

A non-admin runs out of project credits → their projects page hides "New
Project" and shows "Get credits" → they submit the `/billing` form →
`POST /api/contact` sends an SMTP email (D4, hard gate) and persists an `OPEN`
`ContactRequest` → you, the admin, see it in `/admin/leads`, grant credits in
`/admin/users`, then close the lead. No payment processor is wired up — this
*is* the fulfillment. See
[Captured-lead credit gate](./explanation-billing-captured-lead.md) for the
*why*.

## 1. Read the lead ledger

`/admin/leads` — backed by `GET /api/admin/leads`
(`requireAdmin`-gated, matcher-excluded so it returns JSON 401/403, never a
redirect). Each row includes the requester's `{ id, username, name, email }`
so you can reply directly with no second lookup. Sorted `createdAt desc`.

The email envelope is `From: LEADS_TO_ADDRESS`, `Reply-To: <requester's email>`
— and the email is **also in the body**, so even if a relay strips `Reply-To`
the address survives. In dev, read the emails in the Mailpit inbox at
`http://localhost:8025`.

## 2. Grant the credits

`/admin/users` → PATCH the user. Behind it: `PATCH /api/admin/users/[id]` with
`{ credits }` (and/or `role`, `disabled`).

**Hardening to know about (OV-δ):**
- `credits` must be a **non-negative integer** → 400 otherwise. You can't
  half-grant. A bad value is rejected, not silently coerced.
- `role` is allow-listed (`ADMIN`/`USER`) → 400 on anything else.
- An empty patch → 400 "Nothing to update".
- `passwordHash` is never in the select — no path returns it.

The grant is the fulfillment step. The user's next `refreshUser()` (after they
hit a 402, or on next page load) picks up the new count — the proactive gate on
their projects page re-enables "New Project" without a manual reload.

## 3. Close the lead

`/admin/leads` → close it. Behind it: `PATCH /api/admin/leads/[id]` with
`{ status: "CLOSED" }`.

- `status` is allow-listed (`OPEN`/`CLOSED`) → 400 on anything else. No
  arbitrary string lands on the row.
- Closing sets `closedAt = now()`. **Reopening clears it** — so an `OPEN` row
  with a `closedAt` can't exist (that would be a lie).
- A missing lead (Prisma `P2025`) → 404.

Reopen with `{ status: "OPEN" }` if you need to re-engage the requester.

## 4. (Optional) Stats sanity-check

`/admin` dashboard — `GET /api/admin/stats` reports users
(`{ total, enabled, disabled, admins }`), project count, total credits held
across all users (`user.aggregate _sum credits`), and catalog item count. A
grant you just made is reflected in the credits-held total on next page load.

## Edge cases

- **One OPEN lead per user (CQ-C).** A user can't open a second lead while one
  is OPEN — `/api/contact` returns 409 and sends no second email. To handle a
  follow-up, close the open lead first (or just grant credits — the lead stays
  OPEN until you close it).
- **Disable, don't delete.** `disabled: true` denies login (403 "Account
  disabled"). `ContactRequest.user` is `onDelete: Restrict` — a hard user
  delete would orphan the lead ledger against `Project.user`'s `Cascade`. Use
  `disabled`, not a DB delete, to retire an account.
- **Admins bypass the credit gate.** `role === "ADMIN"` skips the `credits < 1`
  check at `POST /api/projects` entirely and decrements no credit. You don't
  need to grant yourself credits.

## Related

- [Auth & admin reference](./reference-auth-admin.md) — `requireAdmin`,
  `/api/admin/users`, `/api/admin/leads`, `/api/admin/stats`.
- [Captured-lead credit gate](./explanation-billing-captured-lead.md) — the
  D4/CQ-C/reactive-gate design this process fulfills.
- [API reference](./reference-api.md) — `POST /api/contact` (the lead submit),
  `GET /api/auth/me` (the self-heal the grant triggers).
