---
trigger: always_on
description: Memory of Hermes E2E audit findings and engineering rules for Main Incomer overload protection (Fix 1) and Demand Factor uniformity (Fix 2).
---

# Hermes E2E Audit Memory & Engineering Rules

## Fix 1: Main Incomer Protection & Overload Trip Elimination
- **Issue Discovered:** Office Tower main incomer calculated design current $I_b = 385.7\text{ A}$. In `BreakerSchedule.tsx`, `irSetting` fell back to `parseFloat((effectiveIncomerIn * 0.9).toFixed(1))`. For a 400A frame, this set $I_r = 360\text{ A} < I_b = 385.7\text{ A}$, causing an immediate overload trip violation ($I_b > I_r$, violating IEC 60364-4-43).
- **Enforced Rule:** The fundamental protection chain $I_b \le I_r \le I_n \le I_z$ must always be respected.
  In `BreakerSchedule.tsx`, `irSetting` defaults to `incomerSaved?.ir ?? mainIncomerSettings.ir ?? effectiveIncomerIn`, and is strictly clamped so that $I_r \ge I_b$ always holds:
  ```ts
  const incomerCurrent = mainIncomerCurrent || mainIncomerSettings.ir || 0;
  const defaultIncomerIr = incomerSaved?.ir ?? mainIncomerSettings.ir ?? effectiveIncomerIn;
  const safeIncomerIr = Math.min(effectiveIncomerIn, Math.max(incomerCurrent, defaultIncomerIr));
  ```
- **Frame Sizing:** If an incomer breaker frame is customized by the user (e.g. 630A frame), cable sizing and protection verification dynamically check $I_z \ge I_n$ and display warning badges if under-protected.

---

## Fix 2: Uniform Apartment Demand Factor Across Towers & Global Recalculate
- **Issue Discovered:**
  1. Identical apartment templates (e.g. Type A) showed differing demand factors (0.50 in R1 with 32 units, 0.55 in R2 with 18 units, 0.70 in Office Tower) because `/api/buildings/[id]/recalculate/route.ts` previously sized branch items solely on isolated building apartment counts.
  2. On `/calculator`, the "Recalculate All Floors" and "Rebalance All" buttons only called the API for `bldg.id` (the currently selected tab), leaving other towers unrecalculated.
- **Enforced Rule:**
  1. **Global Updates:** Clicking "Recalculate All Floors" or "Rebalance All" on `/calculator` must execute across all buildings in `project.buildings` using `Promise.all`.
  2. **Uniform Occupancy Policy:** For residential buildings in a multi-building project, the coincidence factor (IEC 61439-2 Clause 10.10) is evaluated across all residential apartments in the complex ($N_{\text{total}} = N_1 + N_2 + \dots$). When the complex has $\ge 20$ residential units, all residential towers receive the uniform $0.50$ factor. Commercial/office buildings evaluate commercial diversity ($0.80$).

---

## Note on Problem 3 (HVAC & Fire Pump Sizing)
- **User Instruction:** Keep HVAC and Fire Pump sizing as-is. Do NOT apply automated upsizing to HVAC and Fire Pump circuits until explicitly requested.
