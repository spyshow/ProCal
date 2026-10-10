# Plan: Eliminate Flash of Dark Theme on Login and Initial Load

## Diagnosis
When a user specifies light theme (CAD Blueprint) and logs in, the page flashes dark for ~500ms because:
1. `/api/auth/login` only issues a `session_token` cookie and does not set the `procal_theme` cookie with the user's chosen theme.
2. `RootLayout` (`src/app/layout.tsx`) does not inspect the logged-in user's `theme` from `getSessionUser()`, defaulting server-side rendering (SSR) to `dark` (`<html data-theme="dark" className="... dark">`).
3. There is no synchronous blocking script in `<head>` to read cookies/localStorage and apply `data-theme` to `document.documentElement` before the browser paints `<body>`.
4. `UserProvider` is currently nested inside `src/app/(app)/layout.tsx` underneath `ThemeProvider` in `RootLayout`, making `useOptionalUser()` inside `ThemeProvider` unreachable.
5. In `ThemeContext.tsx`, `systemPrefersDark` initializes to `true` and only adjusts in a client `useEffect`, forcing an initial dark resolution before re-rendering in light.

---

## Steps to Implement

### Step 1: Login API & Login Page Theme Sync
- **Files**: `src/app/api/auth/login/route.ts`, `src/app/login/page.tsx`
- **Changes**:
  - In `src/app/api/auth/login/route.ts`: Upon successful authentication, set the `procal_theme` cookie using `user.theme` (or any `theme` passed in the login body). If a theme is explicitly supplied in the login request, update `user.theme` in the database.
  - In `src/app/login/page.tsx`: Pass the current active theme from `useTheme()` in the login request body so user preference selected on the login page is preserved on the server.
- **Proof**: Call `/api/auth/login` and verify response headers contain `Set-Cookie: procal_theme=...`.

### Step 2: Root Layout SSR & Blocking Theme Script
- **Files**: `src/app/layout.tsx`
- **Changes**:
  - In `src/app/layout.tsx`: Fetch `getSessionUser()` to determine `initialTheme` using `user?.theme || cookieTheme || DEFAULT_THEME`.
  - Add a lightweight synchronous `<script>` in `<head>` that reads the cookie/localStorage and immediately sets `document.documentElement.dataset.theme` and toggles `.dark` class before the first paint.
  - Wrap `ThemeProvider` with `UserProvider` at the root layout so both app and auth routes share consistent user state.
- **Proof**: Make an HTTP request to `/login` and `/dashboard` with `procal_theme=blueprint` cookie; verify raw HTML contains `<html data-theme="blueprint">` and no `dark` class on first paint.

### Step 3: ThemeContext Initialization & Sync
- **Files**: `src/context/ThemeContext.tsx`, `src/app/(app)/layout.tsx`
- **Changes**:
  - Update `ThemeContext.tsx` to initialize `systemPrefersDark` safely without flashing dark, and sync with `user?.theme` and `localStorage`.
  - Remove duplicate `UserProvider` in `src/app/(app)/layout.tsx` if hoisted to `RootLayout`.
- **Proof**: Run `npm test` to verify all 70 test suites pass.

### Step 4: End-to-End Browser Verification
- **Tool**: Chrome DevTools MCP
- **Proof**:
  1. Open `/login` in Chrome with light theme selected.
  2. Log in with credentials.
  3. Verify via DevTools that `document.documentElement.dataset.theme === 'blueprint'`, `classList` does not contain `dark`, and the transition has 0ms flash of dark mode.
