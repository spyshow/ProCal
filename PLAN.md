# Plan: Free Tools Theme Correction & Select Input Integration

## Task Summary
Fix the theme styling across the `/tools` landing page and all 7 standalone engineering calculators (resolving dark slate cards with unreadable dark text in the Warm parchment theme), and add a dedicated **Select Input** (`<select>`) that allows engineers to choose and immediately switch between all 7 free tools from both the `/tools` hero and the persistent tools navigation bar.

---

## Steps & Proof

### Step 1: Fix Theme Adaptability in `src/app/globals.css` and Card Tokens
- Ensure `html[data-theme="warm"]` and `html[data-theme="blueprint"]` properly adapt card backgrounds, gradient utilities (`from-slate-900*`, `to-slate-950*`), and text colors so cards render in warm ivory (`#f8f4ec`) with readable espresso ink (`#261e16`) in Warm mode, and crisp white (`#ffffff`) in Blueprint mode.
- **Proof**: In Warm theme, cards on `/tools` render with warm parchment background, warm borders, and crisp high-contrast text matching the design system.

### Step 2: Create Shared `ToolsHeader` with Free Tool `<select>` Switcher, Theme & Language Selectors
- Build `src/components/tools/ToolsHeader.tsx` with:
  1. Official `ProCalLogo` and branding that adapts to light, dark, and warm themes.
  2. A dedicated **"Choose Free Tool" `<select>` input** allowing quick navigation to any of the 7 calculators.
  3. Interactive `ThemeSelector` (`variant="dropdown"`) and `LanguageSelector` (`variant="dropdown"`).
  4. Quick links to Sign In and Dashboard/Sign Up.
- **Proof**: User can choose any tool directly from the select dropdown and switch themes on the fly.

### Step 3: Update `/tools` Index Page (`src/app/tools/page.tsx`)
- Replace hardcoded dark-mode classes with theme tokens (`--background-color`, `--card-bg`, `--border-color`, `--foreground-color`, `--table-header-color`).
- Add a prominent **Quick Tool Select Input** section in the hero where users can choose a tool from a `<select>` dropdown and launch it with one click.
- Fix all 7 tool cards to use theme-aware styling, sharp typography, and proper contrast.
- **Proof**: Visual verification in browser across Dark, Warm, and Blueprint themes.

### Step 4: Update All 7 Free Tool Calculator Pages & `ProCalConversionBanner` (Completed)
- Integrated `ToolsHeader` into all 7 free tool pages (`cable-sizer`, `short-circuit-calculator`, `max-cable-length`, `transformer-generator-sizer`, `max-demand-calculator`, `motor-protection-calculator`, `protection-coordination`).
- Added standard select inputs for presets (e.g. system voltage and tool navigation).
- Sized all containers, cards, tables, inputs, badges, and footers using semantic theme design tokens (`--background-color`, `--card-bg`, `--border-color`, `--foreground-color`, `--table-header-color`).
- `ProCalConversionBanner` updated to adapt cleanly across Dark, Warm, and Blueprint themes.
- **Proof**: `npx tsc --noEmit` passed with 0 errors. `npm test` ran 78 test suites and 870 tests with 100% pass rate. `graphify update .` completed.
