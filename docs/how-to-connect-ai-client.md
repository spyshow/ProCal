# How to Connect an AI Client to ProCal

ProCal exposes an **MCP (Model Context Protocol)** server, so an AI agent can create
a paid project, fill in its design, and generate the SLD, riser diagram, engineering
report PDF and Excel workbook.

**Tool reference:** [`reference-mcp.md`](./reference-mcp.md)

---

## 1. Create a token

1. Sign in to ProCal.
2. Go to **Settings → AI Agent Access (MCP)**.
3. Give the token a name you'll recognise later — e.g. `Claude Code — laptop`.
4. Click **Create token**.
5. **Copy it now.** It is shown exactly once and is not recoverable.

Each client should get its own token, so you can revoke them independently. Tokens
can be revoked at any time from the same screen; revoking takes effect immediately.

---

## 2. Point your client at ProCal

The endpoint is:

```
https://procal-mu.vercel.app/api/mcp
```

It speaks **Streamable HTTP** and authenticates with a bearer token.

> Self-hosting, or using QA? The endpoint path is always `/api/mcp`; only the host
> changes (QA is `https://procal.onrender.com/api/mcp`).

### Claude Code

```bash
claude mcp add --transport http procal https://procal-mu.vercel.app/api/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

Or edit `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "procal": {
      "type": "http",
      "url": "https://procal-mu.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "procal": {
      "type": "http",
      "url": "https://procal-mu.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

Restart Claude Desktop after editing.

### Cursor / VS Code

`.cursor/mcp.json` or the equivalent MCP settings file, same shape as above.

### Clients that only support stdio

Wrap the HTTP endpoint in a small bridge, or use a client that supports HTTP
transports. The ProCal server is HTTP-only by design — it needs your ProCal
account's identity, and there is no local process to inherit that from.

---

## 3. Verify

From the repo:

```powershell
$env:PROCAL_MCP_URL   = "http://localhost:3000/api/mcp"
$env:PROCAL_MCP_TOKEN = "procal_mcp_..."
npx tsx scripts/verify-mcp-e2e.ts
```

It lists the tools, calls the read tools, optionally runs the exports against a
project, downloads each artifact and checks the byte counts, and confirms that bad
input is rejected rather than crashing.

Add `$env:PROCAL_PROJECT_ID = "<uuid>"` to exercise the export tools.

---

## 4. What the agent can and cannot do

**Can:** create projects (spending a credit), define apartment templates, add
buildings and floors, attach mechanical loads, recalculate, read the design, and
export the drawings, report and workbook.

**Cannot:** exceed your own permissions. A project member who cannot open the
Reports page in the UI cannot export reports through MCP either — the same
permission check runs on both paths.

---

## 5. Paying

Creating a project costs one project credit, or draws on your subscription's
monthly allowance (**Starter 1 · Professional 5 · Team 15**). Two different refusals
come back, and they need different responses:

- **`payment_required`** — no subscription and no credits. Hand the user the
  checkout link; the work resumes once payment completes.
- **`quota_exhausted`** — a paid plan has used its allowance this period. The user
  already pays, so **do not** offer them credits. Offer an upgrade or a single
  project pass, and note that their existing projects remain fully accessible.

The credit is refunded automatically if project creation fails part-way, so a bad
spec never costs the user a credit. Your current allowance is shown on
**/billing**.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401` / "Unauthorized" | Missing, malformed, revoked, or wrong token. `Authorization: Bearer <token>` — not `Basic`. |
| `405` on GET | Expected. The server is stateless and POST-only. |
| `payment_required` | No project credit. Use the checkout link. |
| Tool not found | Older client protocol. Update the client, or re-check the URL. |
| Export fails with a Chromium error | The server is cold-starting its browser pack. Retry after ~30s. |

### Security notes

- The token grants full account access to the MCP server. Treat it like a password.
- Prefer a token per client so a leaked laptop token can be revoked alone.
- The endpoint is unauthenticated at the proxy layer by design (bearer clients
  cannot follow a browser redirect), so it must stay behind HTTPS.
- Downloads are owned per user and expire after 24 hours.
