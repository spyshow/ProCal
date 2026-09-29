# How to Connect an AI Client to ProCal

ProCal exposes an **MCP (Model Context Protocol)** server, so an AI agent can create
a paid project, fill in its design, and generate the SLD, riser diagram, engineering
report PDF and Excel workbook.

**Tool reference:** [`reference-mcp.md`](./reference-mcp.md) ·
**Verifying a deployment:** [`how-to-verify-mcp-server.md`](./how-to-verify-mcp-server.md)

---

## 1. Create a token

The token page is the **AI Agent Access (MCP)** tab on your **user** settings page —
not Project Settings.

1. Sign in to ProCal.
2. Open **`/settings`** — the user-level settings page, at the root of your app:

   ```
   https://procal-mu.vercel.app/settings
   ```

3. Click the **AI Agent Access (MCP)** tab (the one with the bot icon). It sits
   between **Account & Security** and **Voltage Drop & Standards**.
4. Give the token a name you'll recognise later — e.g. `Codex — work laptop`.
5. Click **Create token**.
6. **Copy it now.** It is shown exactly once and is not recoverable.

The tab is available to every signed-in role, user and admin alike, and is never
hidden by a permission check.

> ⚠️ **Don't use the sidebar's "Project Settings" button.** When a project is
> selected — the usual case while you are working — that button links to
> `/projects/<id>?tab=settings`, which is a *different* page and has no MCP tab.
> It only points at `/settings` when no project is selected. If you cannot see the
> MCP tab, you are almost certainly on Project Settings; go to `/settings`
> directly.

Each client should get its own token, so you can revoke them independently. Tokens
can be revoked at any time from the same screen; revoking takes effect immediately.

---

## 2. Point your client at ProCal

```
https://procal-mu.vercel.app/api/mcp
```

Streamable HTTP, authenticated with a bearer token. Self-hosting or on QA? Only the
host changes — QA is `https://procal.onrender.com/api/mcp`.

### Quick reference

| Client | Transport | Where config lives | Token stored as |
|---|---|---|---|
| **Claude Code** | `http` | `.mcp.json` (local/user/project) | header in config |
| **Claude Desktop** | `http` | `claude_desktop_config.json` | header in config |
| **Codex CLI** | `http` | `~/.codex/config.toml` | **env var** ✅ |
| **Gemini CLI** | `http` | `~/.gemini/settings.json` | header in config |
| **Antigravity** | `http` | `~/.gemini/antigravity/mcp_config.json` | header in config |
| **Cursor** | `http` | `.cursor/mcp.json` | header in config |
| **VS Code** | `http` | `.vscode/mcp.json` | header in config |
| **Zed** | `http` | `.zed/settings.json` | header in config |
| **Windsurf** | `http` | `~/.codeium/windsurf/mcp_config.json` | header in config |
| **Cline / Roo** | `http` | UI, or `cline_mcp_settings.json` | UI field |
| **OpenCode** | `http` | `opencode.json` | header in config |

Wherever a client takes a **header**, the value is always the same single line:

```
Authorization: Bearer YOUR_TOKEN
```

> Only **Codex** keeps the token out of the config file by reading it from an
> environment variable. Every other client below stores the raw token in
> plaintext JSON — see [Security](#security) before committing one.

---

## 3. Claude Code

```bash
claude mcp add --transport http procal https://procal-mu.vercel.app/api/mcp \
  -H "Authorization: Bearer YOUR_TOKEN"
```

`-s local|user|project` picks the scope; the default is `local` (this repo only).
Use `-s user` to make ProCal available everywhere. Confirm with:

```bash
claude mcp list
```

Or hand-write `.mcp.json`:

```json
{
  "mcpServers": {
    "procal": {
      "type": "http",
      "url": "https://procal-mu.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

## 4. Claude Desktop

`claude_desktop_config.json` — same shape, different file:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "procal": {
      "type": "http",
      "url": "https://procal-mu.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

Quit and relaunch Claude Desktop — it does not hot-reload this file.

## 5. Claude on the web (claude.ai)

Add it as a **custom connector**: paste the endpoint URL, choose **HTTP** (not
SSE), and supply the `Authorization: Bearer …` header. Note that connector configs
live in your claude.ai account, not on your machine, so the token is stored on
Anthropic's servers rather than locally.

## 6. Codex CLI

Codex is the one client that **does not** write the token into its config. It stores
only the *name* of an environment variable:

```bash
# PowerShell — set it in the shell you launch Codex from
$env:PROCAL_MCP_TOKEN = "procal_mcp_..."

codex mcp add procal \
  --url https://procal-mu.vercel.app/api/mcp \
  --bearer-token-env-var PROCAL_MCP_TOKEN
```

`~/.codex/config.toml` then contains only:

```toml
[mcp_servers.procal]
url = "https://procal-mu.vercel.app/api/mcp"
bearer_token_env_var = "PROCAL_MCP_TOKEN"
```

Verify with `codex mcp list`, and remove with `codex mcp remove procal`.

> `PROCAL_MCP_TOKEN` must be set **in the environment Codex inherits**. Setting it
> in one terminal and launching Codex from another is the usual cause of a
> mysterious `401`.

## 7. Gemini CLI

```bash
gemini mcp add procal https://procal-mu.vercel.app/api/mcp \
  --transport http \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --scope user
```

`--scope` is `user` or `project`; it defaults to `project`. Confirm with
`gemini mcp list`.

Gemini also lets you trim the toolset, which is worth doing for a 13-tool server:

```bash
gemini mcp add procal https://procal-mu.vercel.app/api/mcp \
  --transport http -H "Authorization: Bearer YOUR_TOKEN" \
  --include-tools procal_list_projects,procal_get_project_brief,procal_get_design_summary
```

Servers land in `~/.gemini/settings.json` under `mcpServers`.

## 8. Antigravity

Edit the MCP config JSON — by default
`~/.gemini/antigravity/mcp_config.json` (use `~/.gemini/config/mcp_config.json`
for all sessions):

```json
{
  "mcpServers": {
    "procal": {
      "url": "https://procal-mu.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

Check what loaded under **Additional Options (…) → MCP Servers**.

> ⚠️ **Use `url`, not `serverUrl`.** Antigravity accepts both, but `serverUrl` is
> the legacy **SSE** key. ProCal's server is POST-only and answers `GET` with
> `405`, so an SSE-style entry silently fails to connect. If a config uses
> `serverUrl` for a modern server, `url` + `headers` is the Streamable HTTP form.

## 9. Cursor, VS Code, Zed, Windsurf, Cline

All take the same `url` + `headers` pair — only the file name differs:

| Client | File |
|---|---|
| Cursor | `.cursor/mcp.json` |
| VS Code (Copilot) | `.vscode/mcp.json` |
| Zed | `.zed/settings.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline / Roo Code | `cline_mcp_settings.json` (or the MCP panel) |

```json
{
  "mcpServers": {
    "procal": {
      "url": "https://procal-mu.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

VS Code also accepts the `"type": "http"` spelling alongside `url`. Restart the
editor after editing.

## 10. OpenCode

```jsonc
// opencode.json
{
  "mcp": {
    "procal": {
      "type": "remote",
      "url": "https://procal-mu.vercel.app/api/mcp",
      "enabled": true,
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

## 11. Clients that only support stdio

Wrap the endpoint in a bridge rather than the other way round — ProCal is HTTP-only
by design, because it needs your account identity and there is no local process to
inherit that from. `mcp-remote` is the usual choice:

```json
{
  "mcpServers": {
    "procal": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://procal-mu.vercel.app/api/mcp",
        "--header", "Authorization: Bearer YOUR_TOKEN"
      ]
    }
  }
}
```

---

## 12. Confirm it's actually connected

Most clients can list their servers:

```bash
claude mcp list
codex  mcp list
gemini mcp list
```

The stronger check is behavioural — ask the agent directly:

> List your available MCP tools. How many are prefixed `procal_`?

You should get **13**. If it reports 0, the token or the transport is wrong — not
the tools.

To verify a *deployment* end-to-end (handshake, all 13 tools, a live call, and
revocation), use [`how-to-verify-mcp-server.md`](./how-to-verify-mcp-server.md):

```bash
PROCAL_MCP_URL=https://procal-mu.vercel.app/api/mcp npx tsx scripts/verify-live-mcp.ts
```

Against a local dev server with a real token and a project to export:

```powershell
$env:PROCAL_MCP_URL   = "http://localhost:3000/api/mcp"
$env:PROCAL_MCP_TOKEN = "procal_mcp_..."
npx tsx scripts/verify-mcp-e2e.ts
```

Add `$env:PROCAL_PROJECT_ID = "<uuid>"` to exercise the export tools.

---

## 13. What the agent can and cannot do

**Can:** create projects (spending a credit or a plan allowance), define apartment
templates, add buildings and floors, attach mechanical loads, recalculate, read the
design, and export the drawings, report and workbook.

**Cannot:** exceed your own permissions. A project member who cannot open the
Reports page in the UI cannot export reports through MCP either — the same
permission check runs on both paths.

---

## 14. Paying

Creating a project costs one project credit, or draws on your subscription's
monthly allowance (**Starter 1 · Professional 5 · Team 15**). Two different refusals
come back, and they need different responses:

- **`payment_required`** — no subscription and no credits. Hand the user the
  checkout link; the work resumes once payment completes.
- **`quota_exhausted`** — a paid plan has used its allowance this period. The user
  already pays, so **do not** offer them credits. Offer an upgrade or a single
  project pass, and note that their existing projects remain fully accessible.

The credit is refunded automatically if project creation fails part-way, so a bad
spec never costs the user a credit. Current allowance is shown on **/billing**.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| No **AI Agent Access (MCP)** tab | You're on Project Settings. The tab is only on `/settings` — see step 1 |
| `401` / "Unauthorized" | Missing, malformed, revoked, or wrong token. `Authorization: Bearer <token>` — not `Basic` |
| `401` only in Codex | `PROCAL_MCP_TOKEN` isn't in the environment Codex inherited |
| `405` on GET | Expected. The server is stateless and POST-only |
| `405` on POST | Client sent a plain `Accept`; Streamable HTTP needs `application/json, text/event-stream` |
| Tools list as 0 | Not connected, not "no tools". Re-run the client's `mcp list` |
| Fails in Antigravity | Used `serverUrl` (SSE) instead of `url` — see step 8 |
| `payment_required` | No project credit. Use the checkout link |
| Tool not found | Older client protocol — update the client |
| Export fails with a Chromium error | The server is cold-starting its browser pack. Retry after ~30s |

### Security

- The token grants full account access to the MCP server. Treat it like a password.
- Prefer one token per client so a leaked laptop token can be revoked alone.
- **Do not commit** any of these config files. Apart from Codex, the raw token sits
  in plaintext JSON. This repo's `.gitignore` already covers `.mcp.json`,
  `cline_mcp_settings.json` and `mcp_config.json`; `.vscode/` and `.zed/` are
  commonly committed, so be deliberate there.
- Revoke anything you ever pasted into a web UI (Claude connectors, and so on).
- The endpoint is unauthenticated at the proxy layer by design — bearer clients
  cannot follow a browser redirect — so it must stay behind HTTPS.
- Artifact downloads are owned per user and expire after 24 hours.

## Related

- [`reference-mcp.md`](./reference-mcp.md) — the 13 tools and their schemas
- [`how-to-verify-mcp-server.md`](./how-to-verify-mcp-server.md) — deployment checks
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — how a commit reaches production
