# How to verify a deployed ProCal MCP server

> **Goal:** confirm that a deployed ProCal instance is serving a working MCP
> server — correct endpoint, working auth, all 13 tools, and revocable tokens —
> without hand-rolling a client.
>
> Use this after every production release, and whenever an AI client suddenly
> stops connecting.

The ProCal MCP server runs inside the Next.js process and calls
`src/lib/calculations/` directly. The agent declares a design; ProCal's IEC
60364-5-52 / IEC 60909 engine derives every load, current, breaker rating and
cable size. **No engineering value is ever computed inside a tool handler.**

| Environment | Endpoint |
|---|---|
| **Production** | `https://procal-mu.vercel.app/api/mcp` |
| **QA / staging** | `https://procal.onrender.com/api/mcp` |

> The production Vercel project is **`procal-mu`**. Do not verify against
> `procal.vercel.app` — it serves a different application ("CalPro") and will
> give you a misleading 404.

---

## 1. Run the smoke test

The repository ships a script that drives a **real MCP client** (the official
`@modelcontextprotocol/sdk` client, not a hand-rolled HTTP request) against a
**deployed** endpoint:

```bash
PROCAL_MCP_URL=https://procal-mu.vercel.app/api/mcp npx tsx scripts/verify-live-mcp.ts
```

Swap in the QA host to test staging:

```bash
PROCAL_MCP_URL=https://procal.onrender.com/api/mcp npx tsx scripts/verify-live-mcp.ts
```

Requirements: the production `DATABASE_URL` in `.env` (the script needs to mint
a token) and a `npx`-reachable checkout of the repo.

---

## 2. What it asserts

Five checks, in order:

| # | Check | Passes when |
|---|---|---|
| 1 | `initialize` handshake | the server names itself and advertises the `tools` capability |
| 2 | `tools/list` over the wire | exactly **13** tools, each with a JSON-Schema object and a `readOnlyHint` |
| 3 | A real `tools/call` | `procal_list_projects` returns parseable JSON |
| 4 | Server-side input validation | a malformed UUID is rejected by the server, not the client |
| 5 | Token revocation | once revoked, the **same** token is refused immediately |

Check 5 is the one most worth keeping: it proves revocation is enforced on
**every** request rather than at mint time.

### Expected output

```
Using disposable account: engineer_1787123708544 (USER, 0 credits)
Minted token procal_m…

=== 1. handshake ===
  PASS  initialize succeeds — server procal v1.0.0
  PASS  tools capability advertised

=== 2. tool list over the wire ===
  PASS  13 tools advertised — 13
    procal_list_projects                 read=true  schema=object
    ...

=== 3. dispatch a real tool ===
  PASS  procal_list_projects returns without error
  PASS  returns parseable JSON — count=0

=== 4. input validation is enforced remotely ===
  PASS  malformed uuid rejected server-side

=== 5. a revoked token stops working immediately ===
  PASS  revoked token is refused

LIVE SMOKE OK

Cleaned up token 0c760b34-...
```

Exit code is `0` on success, `1` on any failure — so it drops straight into CI:

```yaml
- name: Verify live MCP server
  env:
    PROCAL_MCP_URL: https://procal-mu.vercel.app/api/mcp
  run: npx tsx scripts/verify-live-mcp.ts
```

---

## 3. The script does not pollute the database

It mints a token for a **disposable auto-generated QA account** (the oldest
`qa_*` / `engineer_1*` user), then revokes and **hard-deletes** the token row in a
`finally` block — so it cleans up even when a check throws.

After a run you should still see zeros:

```ts
await db.mcpToken.count();          // 0
await db.mcpArtifact.count();       // 0
await db.subscription.count();      // 0
await db.promoCode.count();         // 0
await db.checkoutIntent.count();    // 0
await db.creditTransaction.count(); // 0
```

> **Note:** it uses a real account because MCP resolves permissions against the
> same tables the UI uses. It never creates or modifies a project, so no credit
> is spent.

---

## 4. Manual probes, when you can't run the script

Two `curl` calls tell you most of what you need.

**The route exists and rejects the wrong verb** (expect `405`):

```bash
curl -i https://procal-mu.vercel.app/api/mcp
# HTTP/2 405
# {"jsonrpc":"2.0","error":{"code":-32601,"message":"MCP is stateless here.
#   Use POST for initialize, tools/list and tools/call."},"id":null}
```

**Auth is enforced** (expect `401` + a `WWW-Authenticate` header):

```bash
curl -i -X POST https://procal-mu.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
       "params":{"protocolVersion":"2025-06-18","capabilities":{},
                  "clientInfo":{"name":"probe","version":"1.0"}}}'
# HTTP/2 401
# WWW-Authenticate: Bearer realm="procal-mcp"
```

A `401` here is the **correct** result. An empty token is still rejected.

A full authenticated `initialize` needs a Personal Access Token, minted from the
**AI Agent Access (MCP)** tab on `/settings` (user settings — *not* Project
Settings, which has no such tab).

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `404` on `/api/mcp` | You're on the wrong host, or the deploy predates the MCP release | Use `procal-mu.vercel.app`. Confirm `production` moved to the tagged commit |
| `405` on `POST` | Missing the Streamable HTTP `Accept` header | Send `Accept: application/json, text/event-stream` (what the MCP SDK sends) |
| `401` with a valid token | Server clock skew, or token revoked | Check the token isn't revoked; confirm `revokedAt` is null |
| `401` that won't clear | Proxy is stripping the header | `src/proxy.ts` must exclude `/api/mcp` **twice** — see below |
| Tools appear but calls fail `payment_required` | Account has no subscription and no credits | Expected — see the quota table in the tool reference |
| Tools report `quota_exhausted` | Paid plan used its project allowance | Expected — offer an upgrade or a pass, **never** credits |

> **Fragile spot:** `src/proxy.ts` excludes `/api/mcp` twice — once in the
> allow-list, once in the matcher negative lookahead. Deleting either one breaks
> every bearer client while leaving cookie-based UI sessions working, so it fails
> quietly. If browser sessions work but no AI client can authenticate, check
> this first.

---

## Related

- [`reference-mcp.md`](./reference-mcp.md) — the 13 tools, argument schemas,
  quota outcomes, errors, and server implementation notes.
- [`how-to-connect-ai-client.md`](./how-to-connect-ai-client.md) — mint a token
  and wire up Claude Code, Codex, or any MCP client.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — the release pipeline that gets a commit
  onto `production` in the first place.
