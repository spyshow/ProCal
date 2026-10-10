import math
import os
import subprocess

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"
SCRIPTS_DIR = r"C:\Users\jihad.kherfan.MCGI\.gemini\config\skills\logo-design\scripts"

# =========================================================================
# CONCEPT A: The Busbar Monogram (P)
# Variations to test:
# A1: Monolithic P with 3 horizontal phase busbar blades in the bowl & chamfered base
# A2: 3-Track continuous concentric phase conductors forming a precision P
# A3: Bold geometric P with negative-space Delta (Δ) core and breaker notch
# =========================================================================

def svg_a1():
    """
    A1: The 3-Phase Busbar P
    Solid engineered P. The vertical stem is the main incomer feeder.
    The bowl is articulated into three stacked phase conductors (L1, L2, L3)
    with clean 8px isolation slots and an outer engineered radius.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept A1: The 3-Phase Busbar P</title>
  <g fill="#000000">
    <!-- Vertical Incomer Feeder Stem with 45° chamfered terminal lug at base -->
    <path d="M48 32 H96 V200 L72 224 H48 Z" />
    
    <!-- Phase L1 (Top Busbar) -->
    <path d="M108 32 H176 C198 32 216 50 216 72 V74 H172 C172 63 163 54 152 54 H108 Z" />
    
    <!-- Phase L2 (Middle Busbar) -->
    <path d="M108 84 H154 C165 84 174 93 174 104 C174 115 165 124 154 124 H108 V146 H160 C183 146 202 127 202 104 C202 81 183 62 160 62 H108 Z" />
    
    <!-- Phase L3 (Bottom Return / Terminal) -->
    <path d="M108 134 H140 C146 134 152 140 152 146 V158 H108 Z" />
  </g>
</svg>'''

def svg_a2():
    """
    A2: The Triple-Conductor Monogram
    Three parallel phase busbars (L1, L2, L3) with consistent 16px tracks and 12px air gaps,
    flowing down from the vertical spine and sweeping around to form the P.
    Pure monoline / multi-track geometry.
    """
    # Track 1 (Outer): y=32..52, x sweeps to 216, curves down to 148, back to 104
    # Track 2 (Mid): y=64..84, x sweeps to 184, curves down to 116, back to 104
    # Track 3 (Inner): y=96..116, x sweeps to 152, curves down to 84, back to 104
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept A2: Triple Conductor P</title>
  <!-- Outlined tracks converted to filled paths -->
  <g fill="#000000" fill-rule="evenodd">
    <!-- Common Stem Feeder on Left -->
    <path d="M44 32 H88 V224 H44 Z" />
    <!-- Phase 1: Top Bar & Outer Loop -->
    <path d="M98 32 H170 C198 32 220 54 220 82 C220 110 198 132 170 132 H98 V114 H168 C186 114 200 100 200 82 C200 64 186 50 168 50 H98 Z" />
    <!-- Phase 2: Middle Concentric Loop -->
    <path d="M98 62 H156 C167 62 176 71 176 82 C176 93 167 102 156 102 H98 V86 H152 C154 86 156 84 156 82 C156 80 154 78 152 78 H98 Z" />
    <!-- Phase 3: Lower Distribution Blade -->
    <path d="M98 144 H180 V162 H98 Z" />
  </g>
</svg>'''

def svg_a3():
    """
    A3: The Architectural Monogram P
    A massive, authoritative, perfectly balanced P.
    Left stem is 48px wide. The bowl is 120px wide with a clean 48px radius.
    Negative space is an engineered Delta/Aperture.
    A single 45-degree calibrated circuit cut separates the lower bowl from the stem,
    signifying calibrated breaker contact / selective protection.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept A3: Architectural Monogram P</title>
  <g fill="#000000">
    <!-- Solid Master Stem (Feeder Busbar) -->
    <path d="M48 28 H96 V228 H48 Z" />
    <!-- Engineered Bowl with 45° breaker isolation notch and delta-tuned aperture -->
    <path fill-rule="evenodd" d="M96 28 H164 C195 28 220 53 220 84 C220 115 195 140 164 140 H116 L100 156 H96 V140 H96 Z M96 68 H160 C169 68 176 75 176 84 C176 93 169 100 160 100 H96 Z" />
    <!-- 3 Phase Stagger Calibrator at base (L1, L2, L3 test taps) -->
    <rect x="112" y="168" width="40" height="12" rx="2" />
    <rect x="112" y="190" width="28" height="12" rx="2" />
    <rect x="112" y="212" width="16" height="12" rx="2" />
  </g>
</svg>'''

def svg_a4():
    """
    A4: The Precision Busbar Monogram (P) - The pure, clean version.
    Stem = 48 wide (x: 48..96, y: 28..228).
    Loop = x: 96..212, y: 28..152.
    The loop has three distinct parallel phase cutouts (L1, L2, L3) that slice
    horizontally through the bowl, creating an unmistakable 3-phase busbar assembly
    inside an iconic, solid capital P silhouette.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept A: The Busbar Monogram</title>
  <!-- Single compound path for flawless scaling & single-color rendering -->
  <path fill="#000000" fill-rule="evenodd" d="
    M 48 28
    H 160
    C 193.1 28 220 54.9 220 88
    C 220 121.1 193.1 148 160 148
    H 96
    V 228
    H 48
    Z
    
    M 96 60
    H 156
    C 171.5 60 184 72.5 184 88
    C 184 103.5 171.5 116 156 116
    H 96
    Z
    
    M 194 72
    H 220
    V 84
    H 194
    Z
    
    M 194 92
    H 220
    V 104
    H 194
    Z
  " />
</svg>'''

# =========================================================================
# CONCEPT B: The Phase Delta (Equilateral 3-Phase Delta)
# The universal 3-phase delta (Δ) transformed into an interlocking
# modular busbar nexus with 120-degree cyclic symmetry.
#
# Three identical conductor arms:
# Rotated by 0°, 120°, 240° around centroid (128, 136).
# =========================================================================

def build_interlocking_delta(arm_width=36, outer_radius=96, inner_radius=36, gap=14):
    """
    Construct 3 identical interlocking arms in 120° rotational symmetry.
    Arm geometry:
    An L-shaped or angled busbar segment.
    """
    cx, cy = 128.0, 136.0 # optically adjusted centroid
    
    # Let's define one arm in local coordinates, then rotate by 0, 120, 240 deg.
    # In an equilateral triangle:
    # Top vertex: (128, cy - outer_radius)
    # Bottom right: (128 + outer_radius * cos(30), cy + outer_radius * sin(30))
    # Bottom left: (128 - outer_radius * cos(30), cy + outer_radius * sin(30))
    # 
    # For a modular busbar delta:
    # Side 1: Top to Bottom-Right
    # Side 2: Bottom-Right to Bottom-Left
    # Side 3: Bottom-Left to Top
    # Each arm is a thick trapezoid/parallelogram bar with orthogonal ends and a gap.
    pass

def svg_b1():
    """
    B1: The Calibrated 3-Phase Delta
    An equilateral delta formed by three bold interlocking phase conductors.
    Each arm has a width of 34px, with precise 14px dielectric clearance gaps.
    In the center, an inverted equilateral delta negative space forms the calculation core.
    """
    # Let's calculate the coordinates for 3 interlocking bars forming a delta:
    # Outer triangle vertices:
    # V_top = (128, 30)
    # V_br  = (220, 190)   -- height = 160, base = 184 (aspect ~ 0.866)
    # V_bl  = (36, 190)
    #
    # Bar 1 (Left leg: from bottom-left up towards top):
    # Bar 2 (Right leg: from top down towards bottom-right):
    # Bar 3 (Base leg: from bottom-right across to bottom-left):
    # Let's make each bar start slightly set back and extend past the vertex (pinwheel / interlocking):
    # Bar 1: from (68, 190) along bottom-left edge up to (128, 30), terminating with a cut perpendicular to the edge.
    # Bar 2: from (142, 54) down along right edge to (220, 190)...
    # Bar 3: from (194, 190) left along base to (36, 190)...
    # This creates the famous engineered pinwheel delta!
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept B: The Phase Delta</title>
  <g fill="#000000">
    <!-- Arm 1 (Phase L1: Left to Apex) -->
    <polygon points="128,32 152,74 86,188 54,188 34,154 98,44" />
    <!-- Arm 2 (Phase L2: Apex to Bottom Right) -->
    <polygon points="222,154 202,188 70,188 70,152 172,152 202,100" />
    <!-- Arm 3 (Phase L3: Bottom to Apex Return) -->
    <polygon points="128,212 108,178 174,64 206,64 226,98 162,208" />
  </g>
</svg>'''

def svg_b2():
    """
    B2: The Balanced Nexus Delta (Pure Mathematical 120° Symmetry)
    Three identical folded conductor bars that interlock seamlessly.
    """
    # Center = (128, 136).
    # Angles of 3 vertices from center: -90° (top), 30° (bottom right), 150° (bottom left).
    # R_outer = 110, R_inner = 42.
    # Let's generate the exact path for one arm and rotate by 0, 120, 240 deg.
    cx, cy = 128.0, 134.0
    # Arm 1: A bold polygon
    # Let's test a very clean, robust geometry:
    paths = []
    for rot in [0, 120, 240]:
        paths.append(f'<g transform="rotate({rot} {cx} {cy})"><polygon points="128,28 158,80 134,80 118,52 86,108 62,94" /></g>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept B2: Rotary Delta Nexus</title>
  <g fill="#000000">
    {''.join(paths)}
  </g>
</svg>'''

def svg_b3():
    """
    B3: The Interlocking Busbar Delta (Penrose / Isometric Circuit Delta)
    A heavy isometric three-phase loop.
    Three solid bars with exact 60°/120° angles, forming a continuous delta circuit
    with 12px technical separation gaps.
    """
    # Outer delta:
    # Apex: (128, 28)
    # BR: (224, 194)
    # BL: (32, 194)
    # Bar width = 36
    # Let's define the 3 bars with precise boolean cuts:
    # Bar 1 (Top-Right):
    # Starts at Apex (128, 28), goes down-right to (224, 194), cut at (192, 194), up-left to (128, 83), cut at 128,28.
    # But with interlocking offset:
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept B3: The Interlocking Busbar Delta</title>
  <g fill="#000000">
    <!-- Bar 1 (Phase L1: Left slope) -->
    <polygon points="128,32 108,66 64,142 46,174 72,174 110,108 128,76" />
    <!-- Bar 2 (Phase L2: Right slope) -->
    <polygon points="128,32 146,64 190,140 210,174 184,174 148,110 128,76" />
    <!-- Bar 3 (Phase L3: Bottom bar) -->
    <polygon points="56,194 200,194 182,162 74,162" />
  </g>
</svg>'''

# =========================================================================
# CONCEPT C: The Breaker Nexus (Emblem / Enclosure / Dual P+C)
# C1: An engineered octagonal switchgear frame containing an interlocking P+C contact bridge
# C2: Chamfered enclosure with calibrated breaker trip curve / selective flow
# =========================================================================

def svg_c1():
    """
    C1: The Breaker Enclosure (P + C Interlock)
    An engineered industrial chamfered enclosure (MDB switchgear profile).
    Inside: A bold interlocking P (top-left) and C (bottom-right) forming a closed circuit.
    Reads as:
    1. An official IEC / engineering certification shield.
    2. ProCal (P + C) interlocking monogram.
    3. Closed circuit switchgear contact.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept C1: The Breaker Enclosure</title>
  <g fill="#000000" fill-rule="evenodd">
    <!-- Outer Chamfered Switchgear Shield -->
    <path d="
      M 76 28 H 180 L 228 76 V 180 L 180 228 H 76 L 28 180 V 76 Z
      M 84 48 L 48 84 V 172 L 84 208 H 172 L 208 172 V 84 L 172 48 Z
    " />
    
    <!-- Central P Conductor (Top Left) -->
    <path d="M 72 72 H 136 C 152 72 164 84 164 100 C 164 116 152 128 136 128 H 96 V 164 H 72 Z M 96 92 V 108 H 134 C 140 108 144 104 144 100 C 144 96 140 92 134 92 Z" />
    
    <!-- Central C Conductor (Bottom Right: Calibrated Load Return) -->
    <path d="M 176 136 H 152 V 156 H 112 V 180 H 160 C 170 180 176 174 176 164 Z" />
  </g>
</svg>'''

def svg_c2():
    """
    C2: The Calibrated Nexus (The Protection Shield)
    An authoritative diamond/hexagonal engineering shield with a central
    lightning-caliper dynamic path and 3-phase balancing lines.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>ProCal - Concept C2: The Protection Nexus</title>
  <g fill="#000000">
    <!-- Chamfered Industrial Shield Frame -->
    <path fill-rule="evenodd" d="
      M 128 24
      L 224 80
      V 176
      L 128 232
      L 32 176
      V 80
      Z
      
      M 128 48
      L 52 92
      V 164
      L 128 208
      L 204 164
      V 92
      Z
    " />
    
    <!-- Central Calibrated Breaker / Delta Flow -->
    <polygon points="128,70 168,114 140,114 152,166 100,122 124,122" />
  </g>
</svg>'''

# Save all candidate SVGs
candidates = {
    "concept-a1.svg": svg_a1(),
    "concept-a2.svg": svg_a2(),
    "concept-a3.svg": svg_a3(),
    "concept-a4.svg": svg_a4(),
    "concept-b1.svg": svg_b1(),
    "concept-b2.svg": svg_b2(),
    "concept-b3.svg": svg_b3(),
    "concept-c1.svg": svg_c1(),
    "concept-c2.svg": svg_c2(),
}

for name, content in candidates.items():
    filepath = os.path.join(OUT_DIR, name)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print(f"Wrote {name}")

print("All candidates written.")
