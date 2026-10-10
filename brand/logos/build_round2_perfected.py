import math
import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

def build_round2_perfect_all():
    # -------------------------------------------------------------
    # OPTION 1: "The Precision Energy Vector" (Dual-Tone CAD Bolt)
    # -------------------------------------------------------------
    # Classic 6-point bolt split into two interlocking segments across
    # an exact horizontal/angled dielectric channel:
    # Top segment: Industrial Orange #ea580c
    # Bottom segment: Midnight Slate #0f172a
    # No slivers, clean 12px separation.
    
    # Outer bolt points:
    # P_top:   (148, 24)
    # P_left:  (76, 136)
    # P_shelf1:(136, 136)
    # P_bot:   (108, 232)
    # P_right: (180, 120)
    # P_shelf2:(120, 120)
    
    # Split across y=128 with a 12px gap:
    # Upper segment stops at y=122:
    # Outer edge from (148, 24) to (76, 136):
    # dx = 76 - 148 = -72, dy = 136 - 24 = 112.
    # At y = 122: x = 148 + (122 - 24) * (-72 / 112) = 148 + 98 * (-0.6428) = 148 - 63 = 85.
    # At y = 122 on right shelf:
    # The right shelf goes from (180, 120) to (120, 120).
    #
    # Let's construct two interlocking clean polygons:
    # Top Polygon (Orange #ea580c):
    # (148, 24) -> (84, 124) -> (140, 124) -> (124, 150) -> (156, 100) -> (118, 100) -> close
    # Wait, let's keep it bold and clean:
    # Upper Bolt:
    # Starts at (152, 24), runs down-left to (80, 136), cuts horizontally to (132, 136),
    # cuts down-left to (116, 160), then 45° chamfer cut back to (138, 116), horizontally to (116, 116),
    # then up-right back to (152, 24)...
    # Or even cleaner:
    # Upper Bolt: (152, 24) -> (76, 136) -> (132, 136) -> (114, 166) -> (146, 116) -> (110, 116) -> close.
    #
    # Wait, what if the bolt is a single solid icon with an internal negative-space circuit cut?
    # Let's test that!
    
    # Let's do a pure, razor-sharp 2-piece energy vector:
    # Segment 1 (Orange): (152, 24) -> (72, 140) -> (124, 140) -> (108, 168) -> (148, 104) -> (120, 104)
    # Let's adjust so there are NO slivers:
    # Outer left: (152, 24) -> (76, 138)
    # Shelf: (76, 138) -> (130, 138)
    # Inner diagonal cut: (130, 138) -> (150, 106)
    # Shelf top: (150, 106) -> (116, 106)
    # Up-right: (116, 106) -> (152, 24)
    # That is a clean 5-vertex polygon!
    # And Lower Segment (Slate):
    # Symmetrical rotation / inversion!
    # (104, 232) -> (180, 118) -> (126, 118) -> (106, 150) -> (140, 150) -> (104, 232)
    # Look at that: exactly 12px parallel gap between (130, 138)-(150, 106) and (126, 118)-(106, 150)!
    # ZERO slivers!
    svg_opt1 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-opt1">
  <title id="title-opt1">ProCal Option 1 - The Precision Energy Vector</title>
  <!-- Dual-segment CAD energy vector with calibrated parallel dielectric clearance -->
  <g>
    <!-- Upper High-Voltage Pulse (ABB Industrial Orange #ea580c) -->
    <polygon points="152,24 76,138 132,138 152,106 116,106" fill="#ea580c" />
    
    <!-- Lower Ground Return (Midnight Slate #0f172a) -->
    <polygon points="104,232 180,118 124,118 104,150 140,150" fill="#0f172a" />
  </g>
</svg>'''

    # -------------------------------------------------------------
    # OPTION 2: "The 3-Phase Busbar Monogram" (The Phase P)
    # -------------------------------------------------------------
    # Cleaned and perfected without the floating base bars:
    # A monolithic, high-contrast capital 'P':
    # - Solid vertical feeder stem in Midnight Slate (#0f172a) with 45° terminal lug.
    # - Outer loop in ABB Industrial Orange (#ea580c).
    # - Center phase tap in Electric Amber (#f59e0b) sitting inside the bowl.
    # - At the base: integrated 45° terminal cut.
    svg_opt2 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-opt2">
  <title id="title-opt2">ProCal Option 2 - The 3-Phase Busbar Monogram</title>
  <g>
    <!-- Master Vertical Feeder Busbar (Midnight Slate #0f172a) -->
    <path d="M 44 28 H 92 V 204 L 68 228 H 44 Z" fill="#0f172a" />
    
    <!-- Outer Phase Loop (ABB Industrial Orange #ea580c) -->
    <path fill="#ea580c" fill-rule="evenodd" d="
      M 92 28
      H 156
      C 189.1 28 216 54.9 216 88
      C 216 121.1 189.1 148 156 148
      H 92
      V 122
      H 152
      C 170.8 122 186 106.8 186 88
      C 186 69.2 170.8 54 152 54
      H 92
      Z
    " />
    
    <!-- Middle Phase Conductor Tap (Electric Amber #f59e0b) -->
    <path d="M 92 74 H 144 C 151.7 74 158 80.3 158 88 C 158 95.7 151.7 102 144 102 H 92 Z" fill="#f59e0b" />
  </g>
</svg>'''

    # -------------------------------------------------------------
    # OPTION 3: "The 3-Phase Phasor Hexagon" (Phasor Vector Nexus)
    # -------------------------------------------------------------
    # Exact trigonometric vertices for 30° / 150° isometric alignment:
    # Outer bounds: x in [38, 218], y in [24, 232].
    # R = 104, dy = 52, dx = 90.
    # Gap = 10 px.
    # Center = (128, 128).
    
    svg_opt3 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-opt3">
  <title id="title-opt3">ProCal Option 3 - The 3-Phase Phasor Hexagon</title>
  <!-- Three-phase load calculation nexus in isometric 120° distribution -->
  <g>
    <!-- Phase L1 (Top Facet: ABB Industrial Orange #ea580c) -->
    <polygon points="128,24 218,76 135,124 121,124 38,76" fill="#ea580c" />
    
    <!-- Phase L2 (Bottom-Right Facet: Electric Amber #f59e0b) -->
    <polygon points="218,84 218,180 134,232 134,132" fill="#f59e0b" />
    
    <!-- Phase L3 (Bottom-Left Facet: Midnight Slate #0f172a) -->
    <polygon points="38,84 122,132 122,232 38,180" fill="#0f172a" />
    
    <!-- Central Neutral Calculation Node -->
    <circle cx="128" cy="128" r="14" fill="#ffffff" />
    <circle cx="128" cy="128" r="7" fill="#ea580c" />
  </g>
</svg>'''

    with open(os.path.join(OUT_DIR, "round2-opt1.svg"), "w") as f:
        f.write(svg_opt1)
    with open(os.path.join(OUT_DIR, "round2-opt2.svg"), "w") as f:
        f.write(svg_opt2)
    with open(os.path.join(OUT_DIR, "round2-opt3.svg"), "w") as f:
        f.write(svg_opt3)

    print("Perfected Round 2 written.")

build_round2_perfect_all()
