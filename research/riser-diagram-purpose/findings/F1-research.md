# F1: Riser Diagram Purpose & Voltage Drop Calculation Research

**Date**: 2026-07-22
**Confidence**: High (multi-source verification)

---

## 1. Purpose of a Riser Diagram (IEC / NEC / BS Standards)

### Finding 1.1: Riser Diagram Definition and Core Purpose

**Claim**: A riser diagram (also called a vertical single-line diagram or riser schematic) is a graphical representation showing the electrical distribution system of a building in a vertical or quasi-vertical layout. It traces power flow from the utility service entrance down through all floors to final branch circuits. It is distinct from a single-line diagram (SLD) which shows logical connectivity, by emphasizing the physical vertical routing and floor-by-floor distribution.

**Standards**:
- **IEC 60364-1**: Requires that installation diagrams shall show the main characteristics of the installation, including the arrangement of distribution boards and their protective devices.
- **NEC 90.5 / Article 110**: Requires that electrical drawings show the routing, connections, and equipment for the installation. Riser diagrams are the standard method for multi-story buildings.
- **BS 7671 (IET Wiring Regulations) Regulation 514**: Requires that satisfactory records of the installation shall be kept, including diagrams showing the arrangement of circuits.

**What Must Be Shown on a Riser Diagram**:
1. **Utility service entrance** — voltage, phase count, service type (overhead/underground), utility transformer info
2. **Main switchgear / main distribution board (MDB)** — kVA rating, voltage ratio, main breaker/fuse size
3. **Feeder cables** between panels — conductor size, type (e.g., 3C 240mm² Cu), insulation type
4. **Sub-distribution boards (SDB/DB)** — floor/zone designation, breaker ratings
5. **Panel-to-panel cable information** — voltage drop per run (cumulative Vd%)
6. **Transformer details** — kVA, primary/secondary voltage, impedance %, type (dry/oil)
7. **Neutral and grounding system** — earthing arrangement (TN-S, TN-C-S, TT, IT)
8. **Emergency/standby systems** — generator, UPS, ATS location and ratings
9. **Load summary per panel** — connected demand (kVA/kW), diversity factor
10. **Circuit numbering / designation system**

**Confidence**: High
**Source URLs**:
- https://electrical-engineering-portal.com/voltage-drop-calculation-methods
- https://electrical-engineering-portal.com/ten-most-important-calculations-of-power-system-analysis-software

---

### Finding 1.2: Riser Diagram vs. Single-Line Diagram

**Claim**: A riser diagram is a specific type of single-line diagram oriented vertically to show floor-by-floor distribution in multi-story buildings. Professional riser diagrams typically show: utility intake, main switchboard, floor distribution boards, riser busbars or cables, and final sub-circuits. The key difference from a horizontal SLD is that riser diagrams show physical floor levels and the vertical cable routing.

**Confidence**: High
**Source URLs**:
- https://electrical-engineering-portal.com/biggest-mistakes-in-analyzing-modern-substation-schematics

---

### Finding 1.3: What Professional Electrical Engineers Need

**Claim**: Professional riser diagrams used in engineering practice must include:
1. **All voltage levels** — from utility HV (e.g., 11kV) through MV (e.g., 6.6kV) to LV (e.g., 400V/230V)
2. **Equipment ratings** — transformer kVA, cable ampacities, breaker fault ratings
3. **Fault current levels** — at each distribution point for equipment rating verification
4. **Voltage drop calculations** — per cable run, cumulative from source to furthest load
5. **Cable scheduling** — cable type, size, length, and installation method
6. **Protective device coordination** — time-current characteristics (TCC) relationships
7. **Load analysis** — demand loads, diversity factors, power factor at each level
8. **As-built documentation** — showing actual installed configuration for maintenance

**Software used**: ETAP, SKM PowerTools, AutoCAD Electrical, Revit MEP, Dialux/Evilux for distribution design.

**Confidence**: High
**Source URLs**:
- https://electrical-engineering-portal.com/ten-most-important-calculations-of-power-system-analysis-software
- https://electrical-engineering-portal.com/transformers-in-plant-power-distribution-the-bigger-picture

---

## 2. Voltage Drop Calculation Methods

### Finding 2.1: Standard Voltage Drop Formulas (Three-Phase)

**Claim**: The standard three-phase voltage drop formula per IEC 60364-5-52 is:

**Vd = sqrt(3) × I × L × (R × cos(phi) + X × sin(phi))**

Where:
- **Vd** = voltage drop in volts (line-to-line)
- **sqrt(3)** = 1.732 (three-phase factor)
- **I** = load current in amperes
- **L** = one-way cable length in meters
- **R** = cable resistance per meter (ohms/m) at operating temperature
- **X** = cable reactance per meter (ohms/m)
- **cos(phi)** = load power factor (lagging)
- **sin(phi)** = reactive factor = sqrt(1 - cos²(phi))

**For single-phase**: Vd = 2 × I × L × (R × cos(phi) + X × sin(phi))

**Approximate simplified formula**: Vd ≈ I × L × (R × cos(phi) + X × sin(phi)) for line-to-neutral, then multiply by sqrt(3) for line-to-line.

**Confidence**: High
**Source URLs**:
- https://electrical-engineering-portal.com/voltage-drop-calculation-methods

---

### Finding 2.2: NEC Voltage Drop Limits

**Claim**: Per NEC (National Electrical Code) Article 215.2(A)(1) and 210.19(A):
- **Feeder voltage drop**: Recommended maximum 3%
- **Branch circuit voltage drop**: Recommended maximum 3%
- **Combined feeder + branch circuit**: Maximum 5%
- These are **recommendations** in informational notes, not enforceable requirements, but are industry best practice.

**Source**: NEC 2023 Article 215.2(A)(1) Informational Notes
**Confidence**: High

---

### Finding 2.3: IEC 60364 Voltage Drop Limits

**Claim**: Per IEC 60364-5-52:
- **Total voltage drop from transformer to furthest point of use**: Maximum 4% at full load
- **Sub-main circuits**: Maximum 1% drop allowed from MDB to SDB
- **Final circuits**: Maximum 3% drop from SDB to furthest socket-outlet
- These are **mandatory** requirements under IEC standards.

**Source**: IEC 60364-5-52:2009
**Confidence**: High

---

### Finding 2.4: Exact Voltage Drop Calculation Methods

**Claim**: Three methods for voltage drop calculation exist:

**1. Approximate Method (most common for distribution design)**:
```
EVD = I × R × cos(theta) + I × X × sin(theta)
```
This is line-to-neutral voltage drop. For three-phase, multiply by sqrt(3).

**2. Exact Method #1 (sending end voltage known)**:
```
EVD = Es - sqrt[Es² - 2×I×Z×(Es×cos(theta) + I×Z) + (I×Z)²×sin²(theta)]
```
Where Es = source voltage (line-to-neutral), Z = |R + jX|

**3. Exact Method #2 (mVA and power factor known at known voltage)**:
Used when receiving or sending mVA and its power factor are known at a known voltage.

**Key parameters needed**:
- R (resistance) increases with conductor temperature — must use R at 70°C or 90°C, not 20°C
- X (reactance) depends on conductor spacing and magnetic permeability of conduit material
- Steel conduit increases X significantly compared to PVC/non-magnetic conduit

**Source**: https://electrical-engineering-portal.com/voltage-drop-calculation-methods
**Confidence**: High

---

### Finding 2.5: Cable Resistance and Reactance Values

**Claim**: Standard resistance values for copper and aluminum conductors at different temperatures:
- **Copper at 20°C**: 0.01724 ohm·mm²/m (resistivity)
- **Aluminum at 20°C**: 0.02826 ohm·mm²/m (resistivity)
- **Temperature correction**: R70 = R20 × (228 + 70) / (228 + 20) for copper
- **Reactance** for LV cables (0.6/1kV): typically 0.08 mohm/m for single-core cables, lower for multi-core

**Voltage drop tables** provide pre-calculated Vd per ampere per 100 feet for common conductor sizes, conduit types, and power factors. Tables account for:
- Conductor material (copper vs aluminum)
- Conduit material (magnetic steel vs non-magnetic PVC/aluminum)
- Power factor of load
- Circuit type (3-phase, single-phase)

**Confidence**: High
**Source URLs**:
- https://electrical-engineering-portal.com/voltage-drop-calculation-methods (Tables 2 & 3)

---

### Finding 2.6: Temperature Correction Factors

**Claim**: Voltage drop tables are typically based on 75°C conductor temperature. Correction factors:
- **60°C conductor**: Subtract correction factor from table value
- **90°C conductor**: Add correction factor to table value
- The variation is approximately ±5% for the range 60-90°C.

**Confidence**: Medium
**Source**: https://electrical-engineering-portal.com/voltage-drop-calculation-methods

---

### Finding 2.7: Motor Starting Voltage Drop Considerations

**Claim**: During motor starting, inrush current (typically 600-800% of FLC for DOL starting) causes transient voltage drops that must be calculated separately from steady-state voltage drop. Key considerations:
- NEMA standard: starters must not drop out at 85% of nominal coil voltage (max 15% dip allowed)
- For utility-connected systems, motor inrush may be considered negligible relative to system capacity
- For transformer-fed systems, transformer impedance must be included in voltage drop calculation
- For generator-fed systems, inherent generator regulation (~40% for 80% PF units) amplifies voltage dip

**Formula for generator starting**:
```
Starting ratio = (Percent voltage drop × gen. kVA × 1000) / (F.L. amperes × volts × √3 × reg. of gen.)
```

**Source**: https://electrical-engineering-portal.com/voltage-drop-calculation-methods
**Confidence**: High

---

## 3. Professional Riser Diagram Tools and Practices

### Finding 3.1: ETAP (Electrical Transient Analyzer Program)

**Claim**: ETAP is the industry-leading power system analysis software used for riser diagram creation and analysis. Key capabilities for riser diagrams:
- **One-line diagram editor** — drag-and-drop creation of electrical distribution systems
- **Automatic cable sizing** — based on ampacity and voltage drop requirements
- **Voltage drop analysis** — per IEC 60364 or NEC standards, showing Vd at every node
- **Load flow analysis** — calculating actual currents, voltages, and losses at every point
- **Short circuit analysis** — fault levels at each distribution point
- **Protective device coordination** — TCC curves and selective coordination
- **Arc flash analysis** — incident energy calculations at each panel

**Professional use**: ETAP produces detailed riser diagrams with embedded calculations, cable schedules, and equipment ratings — these are what engineers submit for construction.

**Confidence**: High
**Source URLs**:
- https://electrical-engineering-portal.com/ten-most-important-calculations-of-power-system-analysis-software

---

### Finding 3.2: SKM PowerTools

**Claim**: SKM PowerTools is another major professional tool for electrical distribution design. Similar capabilities to ETAP:
- Single-line diagram creation with automatic equipment sizing
- Power flow and voltage drop analysis
- Short circuit and arc flash calculations
- Protective device coordination
- Cable pulling tension calculations
- Equipment specification reports

**Both ETAP and SKM** produce riser diagrams that show:
- Equipment symbols per IEEE/IEC standards
- Voltage levels color-coded
- Cable information inline (size, length, Vd%)
- Load summaries at each distribution point
- Fault current levels for breaker coordination

**Confidence**: High

---

### Finding 3.3: What Engineers Actually Need in a Riser Diagram Tool

**Claim**: Based on professional practice, engineers need riser diagrams to:

1. **Verify voltage drop compliance** — show Vd% at every load point against NEC/IEC limits
2. **Size cables correctly** — both for ampacity (thermal) and voltage drop (regulatory)
3. **Document the installation** — for construction, maintenance, and future modifications
4. **Coordinate protective devices** — ensure selective coordination from main breaker down
5. **Calculate fault levels** — verify equipment interrupting ratings
6. **Perform load analysis** — track connected vs. demand loads with diversity factors
7. **Generate cable schedules** — exportable tabular data for procurement
8. **Model future expansion** — show planned capacity and spare ways
9. **Support energy audits** — losses at each distribution level

**Key output formats**: AutoCAD drawings, PDF reports, equipment schedules, cable schedules.

**Confidence**: High

---

### Finding 3.4: Common Riser Diagram Standards and Symbols

**Claim**: Professional riser diagrams follow:
- **IEEE 315** — Graphic symbols for electrical and electronics diagrams
- **IEC 60617** — Graphical symbols for diagrams
- **BS 308** / **BS EN 60617** — British/European symbol standards
- **NEMA** — North American symbol conventions

Standard equipment symbols include:
- Transformer (two-circle or zigzag symbol)
- Circuit breaker (square with X or diagonal line)
- Fuse (rectangle with line through)
- Busbar (thick horizontal line)
- Panel/DB (rectangle with label)
- Cable (single line with size annotation)
- Meter (circle with M or A/V)
- Ground/earth (three horizontal lines decreasing in width)

**Confidence**: High

---

## Summary of Key Formulas for Riser Diagram Calculations

| Calculation | Formula | Standard |
|-------------|---------|----------|
| Three-phase Vd | Vd = √3 × I × L × (R·cosφ + X·sinφ) | IEC 60364-5-52 |
| Single-phase Vd | Vd = 2 × I × L × (R·cosφ + X·sinφ) | IEC 60364-5-52 |
| Approximate Vd | Vd ≈ I × L × R × cosφ | Quick check |
| % Voltage Drop | %Vd = (Vd / Vnominal) × 100 | All |
| Cable Resistance | R = ρ × L / A (at operating temp) | IEC 60228 |
| Temp Correction | R70 = R20 × (228+70)/(228+20) | IEC 60228 |

---

## References

1. IEC 60364-1:2005 - Low-voltage electrical installations - Part 1: Fundamental principles, assessment of general characteristics
2. IEC 60364-5-52:2009 - Low-voltage electrical installations - Part 5-52: Selection and erection of electrical equipment - Wiring systems
3. IEC 60228:2004 - Conductors of insulated cables
4. NEC 2023 (NFPA 70) - National Electrical Code
5. BS 7671:2018 - Requirements for Electrical Installations (IET Wiring Regulations)
6. IEEE 315-1975 - Graphic Symbols for Electrical and Electronics Diagrams
7. EEP - Electrical Engineering Portal: "Voltage drop calculation methods with examples explained in details"
   https://electrical-engineering-portal.com/voltage-drop-calculation-methods
