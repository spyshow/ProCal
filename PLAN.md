# Implementation Plan - MCP App Icon & Branding for Google Gemini (v1.6.4)

## Problem Statement
In Google Gemini Connected Apps (`gemini.google.com/apps`), the ProCal MCP server connection displays a broken image icon (`broken_image_grey600_18dp.png`). This occurs because:
1. `serverInfo` returned during the MCP `initialize` handshake does not include the official MCP `icons` metadata array or `iconUrl` fields.
2. If Gemini attempts to resolve relative fallback icon paths (such as `/api/mcp/icon` or `/api/mcp/favicon.ico`), Next.js returns 404.

## Objective
Provide full visual branding and icon support across all MCP client surfaces (specifically Google Gemini Connected Apps) by declaring official MCP `icons` in `serverInfo` and adding rewrite fallbacks for relative icon requests.

---

## Phases & Tasks

### Phase 1: MCP `serverInfo.icons` Specification Support
- **Files**: `src/lib/mcp/server.ts`, `src/lib/mcp/__tests__/server.test.ts`
- **Action**: Add `title: "ProCal"`, `websiteUrl`, `icons` array (with `apple-touch-icon.png`, `icon.svg`, and `favicon.ico`), and fallback `icon`/`iconUrl` properties to `serverInfo` in `initialize` response.
- **Proof**: Unit tests asserting `serverInfo.icons` contains valid `src`, `mimeType`, and size declarations.

### Phase 2: Next.js Relative Icon Rewrites
- **Files**: `next.config.ts`
- **Action**: Add `rewrites()` in `next.config.ts` routing `/api/mcp/icon`, `/api/mcp/icon.png`, `/api/mcp/favicon.ico`, and `/api/favicon.ico` to their respective static image assets.
- **Proof**: Verify Next.js config parses and rewrites route properly.

### Phase 3: Version Bump to 1.6.4
- **Files**: `package.json`, `package-lock.json`, `src/lib/version.ts`, `src/lib/mcp/server.ts`, `src/lib/mcp/__tests__/server.test.ts`
- **Action**: Synchronize version to `1.6.4`.

### Phase 4: Verification, Git Push & Release v1.6.4
- **Action**: Run `npm test` (all 87+ suites), update knowledge graph via `graphify update .`, commit, push `origin/master --tags`, and publish GitHub Release `v1.6.4`.
- **Proof**: 100% test pass rate, verified GitHub release live.
