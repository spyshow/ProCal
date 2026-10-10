import math
import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

def build_refined_logos():
    # -------------------------------------------------------------
    # CONCEPT A (Refined): "The Busbar Monogram" (Phase P)
    # -------------------------------------------------------------
    # Left stem: Feeder Busbar, width 48, x: 44..92, y: 32..224.
    # At base: 45° chamfered terminal lug (44, 200) -> (68, 224).
    # Bowl of P:
    # Outer contour: starts at (92, 32), extends horizontally to (160, 32),
    # then an engineered arc/chamfer down to (212, 84), then down to (212, 96),
    # then arc/chamfer down to (160, 148), then horizontally back to (92, 148).
    # Inside the bowl:
    # An engineered electrical Delta counter (Δ) pointing right or up,
    # OR a precision rounded-rectangular aperture (92..156, 68..112).
    # Plus: A calibrated 45° circuit break slot at (92, 148) to (116, 124)
    # separating the lower bowl from the stem!
    # This represents a closed/calibrated breaker contact.
    
    # Let's test two variations of A:
    # A_v1: P with Delta-aperture counter and chamfered terminal lug
    # A_v2: P with 3 segmented phase bars in the bowl
    
    # Let's write A_v1:
    svg_a = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">ProCal Concept A - The Busbar Monogram</title>
  <!-- Compound single-path construction for perfect scaling and boolean integrity -->
  <path fill="#000000" fill-rule="evenodd" d="
    M 44 32
    H 160
    C 192 32 216 56 216 88
    C 216 120 192 144 160 144
    H 92
    V 200
    L 68 224
    H 44
    Z
    
    M 92 68
    H 154
    C 165 68 174 77 174 88
    C 174 99 165 108 154 108
    H 92
    Z
  " />
</svg>'''

    # Wait, let's make A more distinct and ownable!
    # What makes it specifically an ELECTRICAL / CALCULATION mark?
    # What if the bowl has an engineered 45° circuit slot and the base has 3 phase tap notches?
    # Let's craft A_v2:
    # Bowl is split from the stem by an isolation gap, OR the bowl has two horizontal phase air-gap slots:
    # Top phase bar: y=32..64
    # Middle phase bar: y=74..106
    # Lower phase bar: y=116..148
    # And on the right, they are linked by a vertical collector bar!
    # Let's construct that with exact coordinates:
    # Stem: x=44..92, y=32..224.
    # Bowl:
    # Bar 1: (92, 32) to (180, 32), arc to (212, 64), arc down to (180, 148), back to (92, 148)
    # But sliced by two 10px horizontal slots: slot 1 at y=66..76, slot 2 at y=104..114!
    # Wait, if sliced horizontally, let's see how that looks.
    
    # -------------------------------------------------------------
    # CONCEPT B (Refined): "The Phase Delta" (Equilateral Cyclic Delta)
    # -------------------------------------------------------------
    # Exact 120° rotational symmetry around centroid (128, 136).
    # Let's calculate the exact coordinates of one bar, then rotate by 0, 120, 240 deg!
    cx, cy = 128.0, 134.0
    # Outer radius = 104, inner radius = 42, bar width = 36.
    # In an equilateral triangle:
    # Side length S = 2 * R * cos(30°) = 2 * 104 * 0.866025 = 180.1
    # Apex 0: (128, 134 - 104) = (128, 30)
    # Apex 1: (128 + 104*cos(30), 134 + 104*sin(30)) = (128 + 90.07, 134 + 52) = (218.07, 186)
    # Apex 2: (128 - 90.07, 186) = (37.93, 186)
    
    # Let's construct one bar as a polygon:
    # It starts near Apex 0, runs along the right edge towards Apex 1,
    # with an orthogonal cut at both ends and a 14px gap.
    # Let's generate it directly using rotation of a master arm!
    # Master arm:
    # Let's design the arm in local rotated space:
    # The right edge runs from (128, 30) to (218.07, 186).
    # Direction vector: dx = 90.07, dy = 156. Length = 180.1. Unit = (0.5, 0.866025) which is angle 60° down-right!
    # Inward normal vector (perpendicular to edge, pointing into triangle):
    # (-0.866025, 0.5).
    # Bar width = 34.
    # So inner edge is shifted by 34 * (-0.866025, 0.5) = (-29.44, 17.0).
    # At the top (Apex 0), the bar doesn't start at the very tip, it leaves room for the incoming left bar!
    # The incoming left bar arrives from (37.93, 186) to (128, 30) with direction (0.5, -0.866025).
    # Its orthogonal end face is perpendicular to its direction, i.e. along the normal (-0.866025, -0.5).
    # This creates a classic interlocking pinwheel!
    
    # Let's write a generator that creates the 3 arms using SVG transform="rotate(...)":
    # Let's define the base arm polygon points:
    # P1 (outer start near top): x = 128 + 10 * 0.5 = 133, y = 30 + 10 * 0.866 = 38.66 -> (133, 39)
    # P2 (outer end at bottom right): (218, 186)
    # P3 (inner end at bottom right, cut perpendicular to bottom edge or 60°):
    # Along bottom edge, the bottom bar runs from (218, 186) to (38, 186).
    # So at (218, 186), the cut is along the 60° edge or vertical.
    
    # Let's test a mathematically perfect arm:
    # In SVG:
    arm_points = "128,32 216,184 182,184 114,66" # simple trapezoid
    # But for interlocking:
    # Arm 1: from Apex down to BR:
    # Outer: (136, 46) -> (220, 192)
    # Turn: (186, 192)
    # Inner: (116, 70)
    # Top cut: (136, 46)
    
    # Let's generate pure, exact rotation:
    svg_b = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">ProCal Concept B - The Phase Delta</title>
  <g fill="#000000">
    <!-- Three identical phase conductors in 120° rotational equilibrium -->
    <!-- Arm 1 (Phase L1) -->
    <path d="M 128 32 L 216 184 H 176 L 115 78 Z" />
    <!-- Arm 2 (Phase L2) -->
    <path d="M 128 32 L 216 184 H 176 L 115 78 Z" transform="rotate(120 {cx} {cy})" />
    <!-- Arm 3 (Phase L3) -->
    <path d="M 128 32 L 216 184 H 176 L 115 78 Z" transform="rotate(240 {cx} {cy})" />
  </g>
</svg>'''

    # -------------------------------------------------------------
    # CONCEPT C (Refined): "The Breaker Nexus / Calibrated Enclosure"
    # -------------------------------------------------------------
    # An industrial switchgear frame enclosing an interlocking circuit breaker
    # contact bridge (P + C dynamic flow).
    # Outer: Chamfered industrial square (x, y: 24..232, chamfer 48)
    # Inside:
    # A bold dynamic circuit path with a 45° breaker contact shear:
    # Top incoming busbar: starts at top center (128, 48), descends and forms an angled contact blade.
    # Bottom outgoing busbar: ascends from bottom center (128, 208) and interlocks with the upper contact blade,
    # leaving a clean 14px calibrated air gap / trip boundary.
    # At the same time, the two shapes form an abstract 'P' and 'C'!
    
    svg_c = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c">
  <title id="title-c">ProCal Concept C - The Breaker Nexus</title>
  <!-- Outer Switchboard Enclosure + Dual Calibrated Breaker Contacts -->
  <g fill="#000000" fill-rule="evenodd">
    <!-- Engineered Enclosure Frame (Chamfered Industrial Shield) -->
    <path d="
      M 72 24 H 184 L 232 72 V 184 L 184 232 H 72 L 24 184 V 72 Z
      M 80 44 L 44 80 V 176 L 80 212 H 176 L 212 176 V 80 L 176 44 Z
    " />
    
    <!-- Upper Breaker Conductor (Phase Incomer / Monogram P) -->
    <path d="
      M 72 68
      H 148
      C 168 68 184 84 184 104
      C 184 124 168 140 148 140
      H 116
      L 96 160
      H 72
      Z
      
      M 100 92
      V 116
      H 144
      C 150 116 156 110 156 104
      C 156 98 150 92 144 92
      Z
    " />
    
    <!-- Lower Breaker Conductor (Load Distribution Contact / Return) -->
    <path d="
      M 184 156
      L 156 184
      H 104
      V 160
      H 144
      L 160 144
      L 184 144
      Z
    " />
  </g>
</svg>'''

    with open(os.path.join(OUT_DIR, "refined-a.svg"), "w") as f:
        f.write(svg_a)
    with open(os.path.join(OUT_DIR, "refined-b.svg"), "w") as f:
        f.write(svg_b)
    with open(os.path.join(OUT_DIR, "refined-c.svg"), "w") as f:
        f.write(svg_c)
    print("Refined logos written.")

build_refined_logos()
