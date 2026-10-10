import math
import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"
os.makedirs(OUT_DIR, exist_ok=True)

# =========================================================================
# CONCEPT 4 (Round 2, Option 1): The Precision Energy Vector (CAD Bolt)
# =========================================================================
def svg_c4():
    """
    Concept 1 (Round 2): The Precision Energy Vector
    An engineered, isometric dual-segment vector bolt.
    Top segment in ABB Industrial Orange (#ea580c).
    Bottom segment in Midnight Slate (#0f172a).
    Separated by a calibrated 12px technical air gap.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c4">
  <title id="title-c4">ProCal Concept 1 - The Precision Energy Vector</title>
  <!-- Background transparent -->
  <g>
    <!-- Upper Incomer Segment (Industrial Orange #ea580c) -->
    <polygon points="144,24 82,136 128,136 102,176 116,176 156,112 118,112 168,24" fill="#ea580c" />
    
    <!-- Lower Ground / Distribution Segment (Midnight Slate #0f172a) -->
    <polygon points="112,232 174,120 128,120 154,80 140,80 100,144 138,144 88,232" fill="#0f172a" />
  </g>
</svg>'''

# Let's also create an architected single-polygon vector bolt with dual-tone split:
def svg_c4_architected():
    """
    Architected CAD Vector Bolt:
    A clean, sharp geometric lightning bolt on a 60° drafting grid.
    Outer contour is a powerful, balanced energy vector.
    Split down the center by a 10px technical calibration cut into Orange & Slate.
    """
    # Classic sharp bolt vertices:
    # Tip Top: (148, 24)
    # Left Waist: (68, 144)
    # Mid Shelf: (124, 144)
    # Bottom Tip: (108, 232)
    # Right Waist: (188, 112)
    # Top Shelf: (132, 112)
    # Center cut runs at 45° or 60°
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c4">
  <title id="title-c4">ProCal Concept 1 - The Precision Energy Vector</title>
  <g>
    <!-- Upper High-Voltage Pulse (ABB Orange #ea580c) -->
    <polygon points="152,24 72,140 122,140 106,168 152,98 126,98 168,24" fill="#ea580c" />
    
    <!-- Lower Grounded Return (Midnight Slate #0f172a) -->
    <polygon points="104,232 184,116 134,116 150,88 104,158 130,158 88,232" fill="#0f172a" />
  </g>
</svg>'''

# Let's test a monolithic precision bolt inside a circular/squircle CAD reticle:
def svg_c4_reticle():
    """
    Precision Energy Vector inside CAD Crosshairs / Reticle:
    A bold industrial bolt with horizontal alignment ticks.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c4">
  <title id="title-c4">ProCal Concept 1 - The Precision Energy Vector</title>
  <g>
    <!-- Central CAD Energy Bolt -->
    <polygon points="148,28 72,138 126,138 108,228 184,118 130,118" fill="#ea580c" />
    <!-- Engineering Calibration Ticks -->
    <rect x="40" y="125" width="20" height="6" rx="2" fill="#0f172a" />
    <rect x="196" y="125" width="20" height="6" rx="2" fill="#0f172a" />
    <rect x="125" y="12" width="6" height="14" rx="2" fill="#0f172a" />
    <rect x="125" y="230" width="6" height="14" rx="2" fill="#0f172a" />
  </g>
</svg>'''

# =========================================================================
# CONCEPT 5 (Round 2, Option 2): The Circuit Monogram (P + C Fusion)
# =========================================================================
def svg_c5():
    """
    Concept 2 (Round 2): The Circuit Monogram
    A continuous electrical circuit loop fusing 'P' and 'C'.
    Upper loop forms 'P' in Industrial Orange (#ea580c).
    Lower curve forms 'C' in Midnight Slate (#0f172a).
    With circular circuit terminal pads at the start and end.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c5">
  <title id="title-c5">ProCal Concept 2 - The Circuit Monogram</title>
  <g>
    <!-- Circuit Terminal Pad 1 (Base of Stem) -->
    <circle cx="68" cy="208" r="20" fill="#0f172a" />
    <circle cx="68" cy="208" r="8" fill="#ffffff" />
    
    <!-- Circuit Stem & P-Loop (Industrial Orange #ea580c) -->
    <path d="
      M 68 188
      V 76
      C 68 50 88 32 114 32
      H 142
      C 174 32 198 54 198 86
      C 198 118 174 140 142 140
      H 96
    " fill="none" stroke="#ea580c" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />
    
    <!-- C-Loop Return (Midnight Slate #0f172a) -->
    <path d="
      M 142 140
      C 174 140 198 162 198 194
      C 198 214 184 224 164 224
      H 136
    " fill="none" stroke="#0f172a" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />
    
    <!-- Circuit Terminal Pad 2 (End of C) -->
    <circle cx="136" cy="224" r="16" fill="#0f172a" />
    <circle cx="136" cy="224" r="6" fill="#ffffff" />
  </g>
</svg>'''

def svg_c5_outlined():
    """
    Outlined pure path version of Concept 2:
    Clean geometric P and C interlocking circuit.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c5">
  <title id="title-c5">ProCal Concept 2 - The Circuit Monogram</title>
  <g>
    <!-- P-Loop Conductor (ABB Industrial Orange #ea580c) -->
    <path fill="#ea580c" fill-rule="evenodd" d="
      M 56 32
      H 148
      C 182 32 208 58 208 92
      C 208 126 182 152 148 152
      H 88
      V 180
      H 56
      Z
      
      M 88 64
      H 142
      C 160 64 174 76 174 92
      C 174 108 160 120 142 120
      H 88
      Z
    " />
    
    <!-- C-Loop Load Return (Midnight Slate #0f172a) -->
    <path fill="#0f172a" fill-rule="evenodd" d="
      M 116 164
      H 156
      C 182 164 204 182 204 204
      C 204 216 196 224 184 224
      H 116
      C 98 224 84 212 84 196
      H 116
      C 116 198 124 200 132 200
      H 168
      C 172 200 176 196 176 192
      C 176 184 166 180 156 180
      H 116
      Z
    " />
    
    <!-- Circuit Terminal Eyelet -->
    <circle cx="72" cy="202" r="16" fill="#ea580c" />
    <circle cx="72" cy="202" r="6" fill="#ffffff" />
  </g>
</svg>'''

# =========================================================================
# CONCEPT 6 (Round 2, Option 3): The 3-Phase Phasor Hexagon
# =========================================================================
def svg_c6():
    """
    Concept 3 (Round 2): The 3-Phase Phasor Hexagon
    An isometric hexagon representing 3-phase power distribution (L1, L2, L3).
    Three dynamic isometric phase facets:
    - Phase 1 (L1, Top): Industrial Orange #ea580c
    - Phase 2 (L2, Bottom Right): Electric Amber #f59e0b
    - Phase 3 (L3, Bottom Left): Midnight Slate #0f172a
    Separated by a clean Y-shaped 12px technical distribution channel,
    with a central circular neutral/calculation terminal node.
    """
    cx, cy = 128.0, 128.0
    # Outer hexagon vertices:
    # R = 104
    # Top: (128, 24)
    # Top-Right: (128 + 104 * cos(30°), 128 - 104 * sin(30°)) = (128 + 90.07, 128 - 52) = (218.07, 76)
    # Bottom-Right: (218.07, 180)
    # Bottom: (128, 232)
    # Bottom-Left: (37.93, 180)
    # Top-Left: (37.93, 76)
    
    # Three diamond / isometric facets:
    # Facet 1 (Top / L1):
    # Outer vertices: (128, 24), (218.07, 76), Top-Left (37.93, 76).
    # Inner vertex: (128, 128).
    # With a 10px gap between facets!
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c6">
  <title id="title-c6">ProCal Concept 3 - The 3-Phase Phasor Hexagon</title>
  <g>
    <!-- Phase L1 (Top Isometric Facet: ABB Orange #ea580c) -->
    <polygon points="128,28 212,76 134,122 122,122 44,76" fill="#ea580c" />
    
    <!-- Phase L2 (Bottom-Right Facet: Electric Amber #f59e0b) -->
    <polygon points="216,84 216,176 134,224 134,132" fill="#f59e0b" />
    
    <!-- Phase L3 (Bottom-Left Facet: Midnight Slate #0f172a) -->
    <polygon points="40,84 122,132 122,224 40,176" fill="#0f172a" />
    
    <!-- Central Calculation / Neutral Node -->
    <circle cx="128" cy="128" r="14" fill="#ffffff" />
    <circle cx="128" cy="128" r="8" fill="#ea580c" />
  </g>
</svg>'''

# Write Round 2 candidate SVGs
with open(os.path.join(OUT_DIR, "c4-symbol.svg"), "w") as f:
    f.write(svg_c4_architected())

with open(os.path.join(OUT_DIR, "c5-symbol.svg"), "w") as f:
    f.write(svg_c5())

with open(os.path.join(OUT_DIR, "c6-symbol.svg"), "w") as f:
    f.write(svg_c6())

print("Round 2 candidate SVGs written.")
