# Plan: Permanent Regression Test Suite for Theme Switching & Persistence

## Task Summary
User requested comprehensive regression tests so that the theme switching failure (theme always remaining dark or snapping back) can never occur again undetected.

The test suite will cover:
1. `ThemeContext` state machine:
   - Initial load fallback to `DEFAULT_THEME` (`'dark'`) or `initialTheme`.
   - Explicit non-reversion when logged-in user profile has `theme: 'dark'`.
   - Multi-way switching (`dark` -> `blueprint` -> `warm` -> `system` -> `dark`).
   - Cross-tab `storage` event synchronization.
   - API synchronization with `PATCH /api/auth/me` and awaiting `refreshUser()`.
   - Cookie (`procal_theme`) and `localStorage` persistence.
   - Invalid theme value rejection.
2. `ThemeSelector` component:
   - Rendering with `variant="select"` (TopHeader default) and custom button with icons.
   - Popover open/close on click and Escape key.
   - Selection of themes updating the context and DOM.
   - Native select with `variant="compact"`.
   - Collapsed mode icon indicator.
3. Integration with `TopHeader`:
   - Ensuring `TopHeader` renders `<ThemeSelector variant="select" />` and permits seamless switching.

---

## Steps & Proof

### Step 1: Expand `src/context/ThemeContext.test.tsx`
- **File**: `src/context/ThemeContext.test.tsx`
- Add comprehensive test cases covering:
  1. Initialization with default, initialTheme, and localStorage.
  2. Prevention of reversion when user profile is loaded with 'dark'.
  3. Seamless cycle through all 4 supported themes (`dark`, `blueprint`, `warm`, `system`).
  4. Cross-tab synchronization via `window.dispatchEvent(new StorageEvent('storage', ...))`.
  5. Persistence to cookies, localStorage, and `/api/auth/me` background update.
  6. Rejection of invalid theme inputs.
- **Proof**: Run `npm test src/context/ThemeContext.test.tsx` and ensure all tests pass.

### Step 2: Create `src/components/ThemeSelector.test.tsx`
- **File**: `src/components/ThemeSelector.test.tsx`
- Add component test cases covering:
  1. Header dropdown variant (`variant="select"`):
     - Displays current active theme label and icon.
     - Opens menu on click with options: `Midnight CAD (Dark)`, `CAD Blueprint (Light)`, `Drafting Warm (Parchment)`, `System Auto`.
     - Clicking an option calls `setTheme` with the selected theme id.
     - Active item has checkmark and highlight styling.
  2. Native select variant (`variant="compact"`):
     - Renders select element with proper options.
     - Triggers `setTheme` on select change.
  3. Collapsed variant (`isCollapsed={true}`):
     - Renders accessible collapsed icon selector.
  4. Keyboard accessibility:
     - Closes listbox on Escape key press.
  5. Full integrated flow with `<ThemeProvider>`:
     - Selecting a theme changes `document.documentElement.dataset.theme`.
- **Proof**: Run `npm test src/components/ThemeSelector.test.tsx` and ensure all tests pass.

### Step 3: Run Full Test Suite & Validation
- Run `npm test` across all suites (77+ files, 860+ tests).
- Run `npx tsc --noEmit` to verify type safety.
- Run `graphify update .`.
