# ProCal End-to-End Verification — Hermes Verification / 3 Buildings

- **App:** https://procal-mu.vercel.app/ (v1.3.3) · Standard: IEC 60364 · User: `hermes`
- **Project:** "Hermes Verification – 3 Buildings" — Test Client, Damascus, 400V / 50Hz / PF 0.85
- **Date:** 2026-09-06 · Lead Engineer: Eng Hermes · Report Ref: PRJ-52A145
- **Method:** new project → 3 buildings → default templates + library loads → calculator filled floor-by-floor
  (F1 by hand + Copy-to-Floors) → walked all 8 workflow steps → generated Engineering Report → every number
  below was independently hand-calculated (`I1Φ=P/(230·PF)`, `I3Φ=P/(√3·400·PF)`) and compared.

## 1. Project data (audited final state)

| Building | Floors | Apartment template (distinct) | Apts | Connected (kVA) | DF | Demand (kW) | Max phase |
|---|---|---|---|---|---|---|---|
| Tower A | 10 | Type A – 2BR 1Φ, 94 m², 18.27 kW → 93.1 A | 40 (4/fl) | 730.8 = 40×18.27 | 0.50 | **386.9** = 365.4 + 21.5 loads | L1 682.8 A, 4.0% unb. |
| Tower B | 8 | Type B – 3BR 3Φ, 140 m², 30.98 kW | 16 (2/fl) | 495.7 = 16×30.98 | 0.55 | **320.6** = 272.6 + 48.0 loads | 544.4 A, 0.0% unb. |
| Tower C | 6 | Type C – Studio 1Φ, 39 m², 9.37 kW → 47.8 A | 36 (6/fl) | 337.5 = 36×9.37 | 0.50 | **196.7** = 168.7 + 28.0 loads | L1 342.7 A, 2.7% unb. |

Building loads (from Load Library): Tower A = Elevator 11 kW (18.68 A) + Booster pump 7.5 kW (12.74 A, qty 1)
+ Corridor lighting 3 kW/PF 0.95 (13.73 A); Tower B = Fire pump 37 kW (62.84 A) + Elevator 11 kW;
Tower C = Corridor 3 kW + Roof HVAC 25 kW/PF 0.85/DF 0.9 (38.21 A).
Copy-to-Floors auto-rotates 1Φ phases per floor (verified: Tower A F1 L1-heavy → F2 L2-heavy → F3 L3-heavy…).

## 2. Workflow coverage (all 8 steps opened and read)

1. Loads & Demand ✅ · 2. Breaker Schedule (3 incomers + 92 apt + 7 load breakers) ✅ · 3. Coordination/TCC ✅
4. Cable Schedule (102 cables, 2665 m, claimed 102/102 compliant) ✅ · 5. Panel Designer MDB (all 3 towers) ✅
6. Riser ✅ · 7. SLD workstation V4.2 ✅ · 8. Engineering Report generated, all 8 tabs extracted ✅

## 3. Independently VERIFIED correct ✅

- Unit currents, elevator/pump/lighting/HVAC currents — exact.
- Diversity curve (0.5 @ 36–40 units, 0.55 @ 16, 0.8/0.7 floor-level) — sensible.
- Building demands (386.9 / 320.6 / 196.7) and **project total 904.2** — exact to the decimal.
- Incomer breakers next-size-up (342.7→400A, 682.8→800A, 544.4→800-frame/630-trip) ✅.
- Counts reconcile everywhere: 92 apt breakers = 92 apartments; BOM 92+3+7 = 102 devices; cable runs
  2×185 / 2×120 / 1×185 match panel ✅. Tower C per-phase kW 67.6/64.6/64.6 sums exactly ✅.
- SC math: 2Φ = √3/2·3Φ everywhere, peak κ≈1.615 consistent, Icu margins real, fault MVA ties out.
- Unbalance formula = (max−avg)/avg — replicates 4.0% and 2.7% exactly.
- App is honest where it counts: PARTIAL selectivity flagged with LSI-grading guidance, "3φ-apt internal
  imbalance not modeled" disclaimer, and Tower B's own "Iz 644 A < In 800 A — increase cable" warning.

## 4. Findings (ranked)

### 🔴 Critical (safety-relevant — do not build from these values)
1. **F1 apartment breakers systematically oversized vs identical units upstairs** (same Ib, different In):
   Tower C F1 63 A vs 25 A (F2–F6) · Tower B F1 63 A vs 32 A · Tower A F1 **100 A MCCB** vs 50 A-frame.
   "Recalculate All" does NOT fix it → systematic sizing bug, not stale data.
2. **Breaker–cable coordination (`Ib ≤ In ≤ Iz`) violated in ≥5 places while the app reports
   "102/102 COMPLIANT, 0 upsize"** — the compliance check never compares In against Iz:
   F1-C 63 A > 45 A (4 mm²) · F1-A 100 A > 58 A (6 mm²) · Tower A upstairs C63 > 58 A ·
   HVAC 63 A > 52 A · Elevator 25 A > 22 A (1.5 mm²).
3. **Tower A panel current 976 A vs calculator 682.8 A** — exceeds its own 800 A incomer (B/C panels match
   max-phase correctly; Tower A–specific bug).
4. **Neutral conductors are nonsense** in Panel Designer: Tower B **1×1.5 mm² neutral on a 544 A incomer**
   (dangerous if built) · C: 3×185 vs 1×185 phase · A: 5×185 vs 2×185 phase.

### 🟡 Major (report/package integrity)
5. Report "DEMAND (kW)" column = I×0.589 (√3·400·0.85 mash-up), overstating incomers (C: 201.8 vs 196.7,
   A: 402.1 vs 386.9) and producing absurd 1Φ rows (3 kW corridor → "8.1"). Exec summary calls the kW sum
   "904.2 kVA" while the MDB module correctly uses kVA = kW/0.85 — unit confusion.
6. **F1 cable size has four answers**: cable module 4 mm² · panel/report-MDB/breaker/SC tabs 10 mm² ·
   riser blank · report cable-tab blank. (10 mm² is the self-consistent one: 23.9 ≤ 63 ≤ 80 ✓.)
7. **VD tab is stubbed — every row 0.10%** regardless of 15 m/2.5 mm² or 35 m/4 mm² (hand calc ≈ 2–4%);
   F1 rows missing; cable module shows different VD (0.99%) with blank lengths.
8. Tower B incomer trip **Ir 720 A > In 630 A** (settings copy-pasted from Tower A — impossible).
9. **Transformer schizophrenia:** SLD 1000 kVA vs report 1600 kVA vs panels 400+630+630 kVA.
10. Report incomer cable drops parallel runs ("185 mm²" for Tower A instead of 2×185) → reads as undersized.

### 🔵 Minor (cosmetic / methodology opacity)
- BOM labels MCBs as "MCCB 3P" (S200/FAZ series); "50 A … C63" frame/device mismatch repeated in BOM.
- Project total current 1537.2 uses √3≈1.73 (true 1535.2) while the kW column uses full √3 — inconsistent constants.
- Tower C Isc 13.47 kA exceeds the 400 kVA/5% infinite-bus ceiling (11.55 kA); A/B ≈ +5% similar.
- Report F2 phase pins don't show the calculator's floor rotation (stale or divergent logic).
- Incomer cable Tower C: 300 mm² (cable module) vs 185 mm² (panel+report) — both adequate, inconsistent.
- Per-phase currents carry ≈ +1–2% unexplained margin over scalar hand sum (conservative, acceptable).

## 5. Bottom line

**The core load engine is sound** — demands, diversity, currents, breaker frames, SC ratios and all counts
verify cleanly against independent calculation. But **do not build from the F1 breakers, the panel neutral
sizes, or the VD tab** without review: findings 1–4 are safety-relevant, 5–9 will not survive a consultant
review. F1-breakers + missing In≤Iz check smell like one root cause — fix and re-verify those first.

*Process note: Towers B/C each carry two library loads (fire pump+elevator / corridor+HVAC) that appeared
outside the explicitly added Tower A loads; no duplicates resulted and all checks above use the final audited
state. Raw per-floor/per-circuit values backing this file were read live from the app during the session.*
