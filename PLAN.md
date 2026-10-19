# Implementation Plan - Google Gemini Custom Connected Apps (MCP) Support

## Problem Statement
When connecting ProCal's remote MCP server to **Google Gemini Apps** (Custom Connected Apps via `https://gemini.google.com/apps`), users encounter connection failures or missing credential fields:
1. Gemini does not offer custom HTTP header inputs (`Authorization: Bearer ...` or `x-api-key`). It only supports an MCP Server URL input and optional OAuth 2.0 fields.
2. ProCal's `/api/mcp` currently rejects any request missing an `Authorization` or `x-api-key` header with `401 Unauthorized`, causing Gemini's initial probe to fail.
3. ProCal does not check URL query parameters (`?key=...` or `?apiKey=...`), preventing Gemini from passing API keys via the server URL.

## Objective
Enable full compatibility between ProCal's remote MCP server and Google Gemini Custom Connected Apps by:
1. Supporting URL query parameter API keys (`?key=procal_sk_...` or `?apiKey=...`).
2. Allowing public handshake and discovery (`initialize`, `ping`, `notifications/initialized`, `tools/list`) and catalog queries (`get_engineering_catalog`) without pre-authentication.
3. Providing clear, user-friendly error guidance when mutating tools are called without a configured key.
4. Adding a dedicated **Google Gemini** configuration tab in `ApiKeysModal.tsx` with a one-click copyable server URL and setup instructions.

---

## Phases & Tasks

### Phase 1: Authentication Helper & Query Parameter Support [COMPLETED]
- **Files**: `src/lib/auth.ts`, `src/lib/__tests__/auth-api-key.test.ts`
- **Result**: Exported `getUserByApiKey(rawKey: string): Promise<User | null>`. Added unit tests verifying valid keys return active users, while invalid, revoked, or disabled user keys return null.

### Phase 2: MCP Server Anonymous Discovery & Tool Guard [COMPLETED]
- **Files**: `src/lib/mcp/server.ts`, `src/lib/mcp/__tests__/server.test.ts`
- **Result**: Made `user` optional in `handleMcpRequest`. Handled anonymous `initialize`, `ping`, `notifications/initialized`, `tools/list`, and `get_engineering_catalog`. Added `requireAuth` guard on mutating tools (`create_project_from_spec`, `update_project_spec`, etc.) returning clear instructions to configure `?key=procal_sk_...`.

### Phase 3: Route Handler Query Parameter & Discovery Wiring [COMPLETED]
- **Files**: `src/app/api/mcp/route.ts`, `src/app/api/mcp/__tests__/route.test.ts`
- **Result**: Wired query parameter extraction (`key` and `apiKey`) through `getUserByApiKey`. Replaced premature 401 gate with protocol discovery pass-through. Updated GET description. Verified with comprehensive route tests.

### Phase 4: UI Google Gemini Format Preset [COMPLETED]
- **Files**: `src/components/ApiKeysModal.tsx`, `src/components/__tests__/ApiKeysModal.test.tsx`
- **Result**: Configured Gemini tab to render the exact direct URL `${origin}/api/mcp?key=${activeKeyForConfig}` with clear instructions to leave "Additional settings" (OAuth) blank and click Next. Verified in UI tests.

### Phase 5: Verification & Knowledge Graph [COMPLETED]
- **Result**: 87 test files passed (939 tests, 100% pass rate). Knowledge graph updated via `graphify update .`.
