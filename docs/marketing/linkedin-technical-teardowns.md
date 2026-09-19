# LinkedIn Technical Teardown Campaign for ProCal

This playbook contains 3 ready-to-publish, peer-level engineering posts for LinkedIn, designed to establish technical authority among MEP consultants, electrical design engineers, and panel builders.

---

## Campaign Overview

- **Target Audience:** MEP Consulting Principals, Senior Electrical Engineers, Switchboard Builders, MEP Project Managers.
- **Tone:** Peer-to-peer, deeply technical, non-salesy, practical problem-solving.
- **Core Call-to-Action:** Direct traffic to the free tool (`procal.app/tools/cable-sizer`) or invite DMs for pilot project reviews.
- **Posting Cadence:** 1 post every 4–5 days (Tuesday or Thursday mornings, 8:00 AM – 10:00 AM local time).

---

## Post 1: The Incomer Overload Tripping Trap ($I_b \le I_r \le I_n \le I_z$)

### Copy Draft

```text
Why do 400A main switchboard incomers trip under full load when the calculations "passed" in Excel?

Here is an error we catch in almost every manual calculation sheet:

Under IEC 60364-4-43, the fundamental protection coordination chain is:
Ib ≤ Ir ≤ In ≤ Iz

Where:
• Ib = Design continuous load current
• Ir = Adjustable thermal trip setting of the breaker
• In = Nominal breaker frame rating
• Iz = Cable derated current-carrying capacity

The problem?
Most engineers select an MCCB frame (say, In = 400A) and leave the thermal dial at the typical default setting of 0.9 × In.

0.9 × 400A = 360A.

If your building's design current Ib is 385A:
Ib (385A) > Ir (360A).

Your 400A breaker will thermally trip under continuous full design load, despite the 400A frame and 2 × 185 mm² cables having plenty of capacity.

To guarantee zero nuisance trips while fully protecting the downstream busbar and feeder cables:
1. Ir must be strictly clamped so that Ir ≥ Ib.
2. Iz must still satisfy Iz ≥ In (or Iz ≥ Ir where adjustable protection is certified).

We built this verification rule directly into ProCal so our sizing engine automatically checks Ib ≤ Ir ≤ In ≤ Iz in real time.

What is your firm’s rule of thumb for incomer Ir settings on variable load profiles?

PS: You can test your circuit ampacity, derating factors, and breaker coordination on our free IEC 60364 sizer here: https://procal.app/tools/cable-sizer

#ElectricalEngineering #MEPEngineering #IEC60364 #Switchboard #PowerDistribution #BuildingServices
```

### Visual Recommendation
- **Format:** Carousel or Side-by-Side Image.
- **Left side:** Screenshot of a typical Excel schedule showing `Ib = 385.7A`, `In = 400A`, `Ir = 360A` with a red highlight: ❌ *Violation: Overload trip at full load ($I_b > I_r$)*.
- **Right side:** Screenshot of ProCal’s `BreakerSchedule` showing green verification badge: ✅ *Compliant: $I_b (385.7\text{A}) \le I_r (386\text{A}) \le I_n (400\text{A}) \le I_z (440\text{A})$*.

---

## Post 2: The Multi-Building Coincidence Factor Fallacy (IEC 61439-2 Clause 10.10)

### Copy Draft

```text
Are you oversizing main substation transformers by 25% across multi-tower residential developments?

Here is what happens when load diversity is calculated in silos:

Consider a residential complex with 2 towers:
• Tower 1: 32 apartments
• Tower 2: 18 apartments
Total: 50 apartments.

If an engineer calculates each tower in isolation using typical IEC / national diversity tables:
• Tower 1 (32 units) gets a coincidence factor of ~0.50.
• Tower 2 (18 units) gets a coincidence factor of ~0.55.

When calculating the main substation intake or transformer, many consultants simply sum the two individual tower maximum demands:
Total Peak = Peak(Tower 1) + Peak(Tower 2).

This ignores IEC 61439-2 Clause 10.10!

At the complex level, you have 50 units sharing the same transformer. The combined coincidence factor across 50 apartments is 0.50 (or lower), not the weighted sum of isolated towers.

The financial impact:
Over-specifying transformer capacity by 100 kVA – 250 kVA, upsizing main incomer busbars, and increasing client CapEx by tens of thousands of dollars for copper that will never see current.

In ProCal, we automated campus-wide diversity aggregation so coincidence factors are evaluated across all apartments in the complex simultaneously.

How does your team handle campus-level diversity vs. individual riser diversity in your load schedules?

#ElectricalDesign #MEP #PowerEngineering #IEC61439 #Substation #Transformers #CapEx
```

### Visual Recommendation
- **Format:** Diagram / infographic.
- **Top:** Two separate towers with arrows showing isolated sum: $P_1 + P_2 = \text{Oversized Transformer (1000 kVA)}$.
- **Bottom:** Unified complex evaluation showing aggregate diversity: $\text{True Peak} \rightarrow \text{Optimized 800 kVA Transformer (-20% Cost)}$.

---

## Post 3: The Copper Waste in Cable Grouping (IEC 60364-5-52 Table B.52.17)

### Copy Draft

```text
How poor cable tray spacing is costing your MEP clients 30% more in copper:

When sizing low-voltage power cables, the two most common derating factors are:
1. Ambient Temperature (kt)
2. Grouping / Bunching Factor (kg)

Most engineers know temperature derating. But grouping derating on perforated cable trays is where budgets get blown.

Under IEC 60364-5-52:
• If 6 multi-core cables are laid touching on a single tray (Method E), the grouping factor kg drops to 0.72.
• If they are bunched in conduit (Method B2), kg plummets to 0.57.

What this means in practice:
A 95 mm² XLPE copper cable rated for 275A in free air drops to:
Iz = 275A × 0.72 = 198A.

To carry a 220A load, the engineer is forced to upsize to 150 mm² or run twin parallel cables.

The simple design fix:
Maintaining a spacing of ≥ 1 cable diameter (De) between cables on perforated trays restores the grouping factor to kg = 1.0.

That single layout detail avoids jumping two standard cable sizes, saves tons of copper weight on the containment, and speeds up pulling labor.

We've made it effortless to check the exact impact of installation method, spacing, and grouping on our free interactive cable sizer:
👉 Try it here: https://procal.app/tools/cable-sizer

What’s your default specification for cable tray spacing in riser shafts?

#CableSizing #ElectricalEngineering #IEC60364 #ValueEngineering #Copper #MEPDesign
```

### Visual Recommendation
- **Format:** Clean diagram comparing:
  - Bunching (touching): $k_g = 0.72 \rightarrow 150\text{ mm}^2$ required.
  - Spaced ($\ge 1 \times D_e$): $k_g = 1.00 \rightarrow 95\text{ mm}^2$ required.

---

## 4. Engagement & Conversion Workflow

1. **First 60 Minutes:**
   - Respond to every comment with an insightful follow-up question.
   - Example: *"Great point on harmonics! Are you seeing high THD-I on your commercial LED drivers that pushes you to upsize the neutral as well?"*

2. **DM Inbound / Outbound Outreach:**
   - For anyone who likes or comments on the posts (especially Senior Engineers / MEP Heads):
   ```text
   Hi [Name], thanks for chiming in on the IEC 60364 cable sizing post! 
   We built ProCal specifically to eliminate those manual spreadsheet edge cases. 
   If you ever want to run a past project schedule through it to compare notes with your firm's Excel template, I’d be happy to set you up with a full access account.
   ```
