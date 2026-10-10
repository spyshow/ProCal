import math
import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

# =========================================================================
# CONCEPT 1: The Busbar Monogram (P)
# =========================================================================
def build_concept_1():
    """
    Concept 1: The Busbar Monogram
    A bold architectural 'P' with:
    - 48px heavy feeder stem on the left with a 45° chamfered terminal lug at base
    - 112px engineered bowl with 60px outer radius
    - Negative space: precision calibrated aperture (x: 96..148, y: 64..112, r: 24)
    - A calibrated 45° breaker isolation notch (14px wide) separating the lower bowl
      from the stem, representing a selective circuit breaker contact.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c1">
  <title id="title-c1">ProCal Concept 1 - The Busbar Monogram</title>
  <g fill="#000000">
    <!-- Master Incomer Feeder Stem with 45° Chamfered Terminal Lug -->
    <polygon points="48,28 96,28 96,204 72,228 48,228" />
    
    <!-- Calibrated Breaker Loop (Bowl of P with 45° contact notch) -->
    <path fill-rule="evenodd" d="
      M 96 28
      H 156
      C 189.1 28 216 54.9 216 88
      C 216 121.1 189.1 148 156 148
      H 118
      L 104 162
      H 96
      V 148
      H 96
      Z
      
      M 96 64
      H 150
      C 163.3 64 174 74.7 174 88
      C 174 101.3 163.3 112 150 112
      H 96
      Z
    " />
    
    <!-- Three-Phase Test / Tap Indicator Slots on Stem Base (L1, L2, L3) -->
    <rect x="110" y="180" width="44" height="10" rx="2" />
    <rect x="110" y="198" width="30" height="10" rx="2" />
    <rect x="110" y="216" width="16" height="10" rx="2" />
  </g>
</svg>'''

# Let's also build an ultra-clean version of Concept 1 without the 3 small base slots
# to see which is purer:
def build_concept_1_pure():
    """
    Concept 1 (Pure): The Busbar Monogram
    Pure, monolithic, iconic P.
    Compound single path:
    Stem + Bowl + 45° breaker notch + terminal chamfer.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c1">
  <title id="title-c1">ProCal Concept 1 - The Busbar Monogram</title>
  <path fill="#000000" fill-rule="evenodd" d="
    M 48 28
    H 156
    C 189.1 28 216 54.9 216 88
    C 216 121.1 189.1 148 156 148
    H 112
    L 96 164
    V 204
    L 72 228
    H 48
    Z
    
    M 96 64
    H 150
    C 163.3 64 174 74.7 174 88
    C 174 101.3 163.3 112 150 112
    H 96
    Z
  " />
</svg>'''

# =========================================================================
# CONCEPT 2: The Phase Delta (Equilateral 3-Phase Symbol)
# =========================================================================
def build_concept_2():
    """
    Concept 2: The Phase Delta
    A solid equilateral delta triangle (Δ) enclosing an inverted delta aperture,
    divided into three identical phase conductors (L1, L2, L3) by three clean
    dielectric clearance gaps radiating from the core at 120° angles.
    
    Outer Triangle: Centered at (128, 136), R_outer = 104
    Apex 0 (Top): (128, 32)
    Apex 1 (BR):  (218.1, 188)
    Apex 2 (BL):  (37.9, 188)
    
    Inner Triangle: R_inner = 40
    Inner Apex 0 (Top): (128, 96)
    Inner Apex 1 (BR):  (162.6, 156)
    Inner Apex 2 (BL):  (93.4, 156)
    
    The three cuts:
    Cut 1: vertical cut from Inner Apex 0 up to Outer Apex 0 (width 16)
    Cut 2: cut towards BR (width 16)
    Cut 3: cut towards BL (width 16)
    Each of the 3 resulting segments is an identical trapezoid/chevron!
    """
    # Let's define the 3 segments:
    # Segment 1: Base segment (horizontal at bottom)
    # Segment 2: Left segment (sloping up to apex)
    # Segment 3: Right segment (sloping down from apex)
    # Between them: 3 clean 16px slots at 60°/120°/vertical angles!
    
    # Let's construct Segment 1 (Base):
    # Outer bottom: from x=54 to x=202, y=188
    # Inner bottom: from x=98 to x=158, y=156
    # Left cut: from (54, 188) to (98, 156) -- angle: dx=44, dy=-32
    # Wait, let's make the cuts perpendicular to the edges for pure craft!
    # Perpendicular to base is vertical!
    # A vertical cut at x=68: (68, 188) to (68, 156).
    # A vertical cut at x=188: (188, 188) to (188, 156).
    # Then rotated by 120° and 240°:
    # Each cut is perpendicular to its respective edge!
    # That means:
    # Base segment has two cuts perpendicular to the base (vertical cuts)!
    # Left segment has two cuts perpendicular to the left edge!
    # Right segment has two cuts perpendicular to the right edge!
    # And at the 3 vertices: the two bars meet in a clean apex or have a corner gap!
    
    # Let's test a corner-gap delta where the three bars are identical trapezoids:
    # Segment 1 (Base):
    # (60, 188) -> (196, 188) -> (174, 156) -> (82, 156)
    # Segment 2 (Right slope):
    # (196, 188) rotated by 120°...
    pass

def svg_phase_delta():
    """
    Pure 3-Phase Delta:
    Three bold identical busbars arranged in an equilateral delta.
    Each bar is a 32px thick segment with orthogonal end cuts.
    Clear 16px dielectric gaps separate the three phases.
    """
    # Outer triangle: Apex=(128, 30), BR=(220, 190), BL=(36, 190).
    # Inner triangle: Apex=(128, 98), BR=(167, 158), BL=(89, 158).
    # Three identical trapezoid bars:
    # Bar 1 (Base):
    #   Outer: x: 58..198, y: 190 (length 140)
    #   Inner: x: 80..176, y: 158 (length 96)
    #   End cuts: orthogonal to base (vertical) or at 60°?
    #   At 60°:
    #   Left cut: (58, 190) to (76.5, 158)
    #   Right cut: (198, 190) to (179.5, 158)
    #   Notice: distance along base to corner is:
    #   BL corner is at (36, 190). 58 - 36 = 22 px.
    #   BR corner is at (220, 190). 220 - 198 = 22 px.
    #   So at each corner, there is a symmetrical 22 px notch!
    #   When all 3 bars have this 60° cut, each vertex of the triangle has a clean diamond notch!
    #   Let's check:
    #   At Apex (128, 30):
    #   Left bar ends at (128 - 22*0.5, 30 + 22*0.866) = (117, 49).
    #   Right bar ends at (128 + 11, 49) = (139, 49).
    #   The cut at the top is HORIZONTAL (parallel to the base)!
    #   Look at that!
    #   Bar 1 (Base) has 60° cuts.
    #   Bar 2 (Right) has cuts parallel to left edge.
    #   Bar 3 (Left) has cuts parallel to right edge.
    #   All 3 bars are 100% IDENTICAL when rotated by 120°!
    
    p1 = (58.0, 190.0)
    p2 = (198.0, 190.0)
    p3 = (179.5, 158.0)
    p4 = (76.5, 158.0)
    base_pts = [p1, p2, p3, p4]
    
    cx, cy = 128.0, 136.67 # exact centroid of outer triangle: 190 - 160/3 = 136.67
    
    arms = []
    for angle in [0, 120, 240]:
        rot_pts = []
        for x, y in base_pts:
            rad = math.radians(angle)
            nx = math.cos(rad) * (x - cx) - math.sin(rad) * (y - cy) + cx
            ny = math.sin(rad) * (x - cx) + math.cos(rad) * (y - cy) + cy
            rot_pts.append(f"{nx:.1f},{ny:.1f}")
        arms.append(f'<polygon points="{" ".join(rot_pts)}" />')
        
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c2">
  <title id="title-c2">ProCal Concept 2 - The Phase Delta</title>
  <!-- Three calibrated phase busbars in 120° rotational equilibrium -->
  <g fill="#000000">
    {"".join(arms)}
  </g>
</svg>'''

# =========================================================================
# CONCEPT 3: The Breaker Nexus (Switchgear Enclosure & Contact Bridge)
# =========================================================================
def build_concept_3():
    """
    Concept 3: The Breaker Nexus
    An engineered chamfered switchgear enclosure framing an interlocking
    circuit breaker contact bridge (P + C dynamic flow).
    
    Enclosure: Octagonal / Chamfered frame
    x, y: 32..224, chamfer = 40.
    Outer: M 72 32 H 184 L 224 72 V 184 L 184 224 H 72 L 32 184 V 72 Z
    Inner: M 78 48 L 48 78 V 178 L 78 208 H 178 L 208 178 V 78 L 178 48 Z
    Frame thickness = 16px.
    
    Inside:
    A bold interlocking circuit bridge:
    Top Conductor (Phase Incomer 'P'):
    - Descends from top-left, loops to the right, and cuts back with a 45° contact blade.
    Bottom Conductor (Load Return 'C'):
    - Ascends from bottom-right, forming the lower circuit return and interlocking with the 45° contact blade.
    - Uniform 14px calibrated air gap separates them.
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c3">
  <title id="title-c3">ProCal Concept 3 - The Breaker Nexus</title>
  <g fill="#000000" fill-rule="evenodd">
    <!-- Switchgear Industrial Enclosure Frame -->
    <path d="
      M 72 32 H 184 L 224 72 V 184 L 184 224 H 72 L 32 184 V 72 Z
      M 78 48 L 48 78 V 178 L 78 208 H 178 L 208 178 V 78 L 178 48 Z
    " />
    
    <!-- Upper Incomer Conductor (P-Loop Contact) -->
    <path d="
      M 64 68
      H 146
      C 168 68 184 84 184 104
      C 184 122 172 136 156 139
      L 138 121
      C 144 117 148 111 148 104
      C 148 95 141 88 132 88
      H 96
      V 152
      H 64
      Z
    " />
    
    <!-- Lower Return Conductor (C-Loop Contact) -->
    <path d="
      M 192 188
      H 110
      C 88 188 72 172 72 152
      C 72 134 84 120 100 117
      L 118 135
      C 112 139 108 145 108 152
      C 108 161 115 168 124 168
      H 160
      V 104
      H 192
      Z
    " />
  </g>
</svg>'''

# Write master concept SVGs
with open(os.path.join(OUT_DIR, "concept-1-symbol.svg"), "w") as f:
    f.write(build_concept_1_pure())

with open(os.path.join(OUT_DIR, "concept-2-symbol.svg"), "w") as f:
    f.write(svg_phase_delta())

with open(os.path.join(OUT_DIR, "concept-3-symbol.svg"), "w") as f:
    f.write(build_concept_3())

print("Saved concept-1-symbol.svg, concept-2-symbol.svg, concept-3-symbol.svg")
