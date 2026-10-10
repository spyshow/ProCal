import math
import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

def build_perfect_concept_1():
    """
    Concept 1: The Busbar Monogram (P)
    Optically and geometrically perfected:
    Canvas: 256x256
    Stem: x: 44..92, y: 28..228 (margins L44, R44, T28, B28)
    Bowl: x: 92..212, y: 28..148
    Chamfer at base: (44, 204) -> (68, 228) -> (92, 228)
    Breaker notch: (92, 164) -> (108, 148)
    Counter: x: 92..152, y: 64..112 (radius 24)
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-p">
  <title id="title-p">ProCal Concept 1 - The Busbar Monogram</title>
  <!-- Single compound path for boolean integrity and flawless reproduction -->
  <path fill="#000000" fill-rule="evenodd" d="
    M 44 28
    H 152
    C 185.1 28 212 54.9 212 88
    C 212 121.1 185.1 148 152 148
    H 108
    L 92 164
    V 204
    L 68 228
    H 44
    Z
    
    M 92 64
    H 146
    C 159.3 64 170 74.7 170 88
    C 170 101.3 159.3 112 146 112
    H 92
    Z
  " />
</svg>'''

def build_perfect_concept_2():
    """
    Concept 2: The Phase Delta (3-Phase Corner Chevrons)
    Optically centered in 256x256.
    Triangular height = 180 (from y=26 to y=206).
    Centroid at y = 146 (optical center).
    Side length = 207.8.
    Margins: L24.1, R24.1, T26.0, B50.0 (ideal for equilateral triangle).
    """
    # Outer triangle:
    # Apex = (128.0, 26.0)
    # BR   = (231.9, 206.0)
    # BL   = (24.1, 206.0)
    # Centroid: (128.0, 146.0)
    # Edge length: 207.8
    # Gap G = 18 px.
    # Leg length along edge: (207.8 - 18) / 2 = 94.9 px.
    # Bar width W = 36 px.
    
    # Outer Apex: (128.0, 26.0)
    # Outer Right End: (128 + 94.9 * 0.5, 26 + 94.9 * 0.866025) = (175.45, 108.19)
    # Normal to right edge (-0.866025, 0.5):
    # Inner Right End: (175.45 - 36 * 0.866025, 108.19 + 36 * 0.5) = (144.27, 126.19)
    # Inner Apex: (128.0, 26 + 36 / 0.5) = (128.0, 98.0)
    # Inner Left End: (128 - (144.27 - 128), 126.19) = (111.73, 126.19)
    # Outer Left End: (128 - (175.45 - 128), 108.19) = (80.55, 108.19)
    
    chevron1_pts = [
        (128.0, 26.0),
        (175.5, 108.2),
        (144.3, 126.2),
        (128.0, 98.0),
        (111.7, 126.2),
        (80.5, 108.2)
    ]
    
    cx, cy = 128.0, 146.0
    chevrons = []
    for angle in [0, 120, 240]:
        rot_pts = []
        for x, y in chevron1_pts:
            rad = math.radians(angle)
            nx = math.cos(rad) * (x - cx) - math.sin(rad) * (y - cy) + cx
            ny = math.sin(rad) * (x - cx) + math.cos(rad) * (y - cy) + cy
            rot_pts.append(f"{nx:.1f},{ny:.1f}")
        chevrons.append(f'<polygon points="{" ".join(rot_pts)}" />')
        
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-delta">
  <title id="title-delta">ProCal Concept 2 - The Phase Delta</title>
  <!-- Three calibrated phase busbars in 120° rotational equilibrium -->
  <g fill="#000000">
    {"".join(chevrons)}
  </g>
</svg>'''

def build_perfect_concept_3():
    """
    Concept 3: The Breaker Nexus (Switchgear Enclosure & Dual Contact Flow)
    Optically centered in 256x256.
    Frame: x, y: 28..228, chamfer 44 (margins 28 on all sides, perfectly square).
    Inside:
    - Upper P-shaped Incomer Conductor
    - Lower C-shaped Return Conductor
    - Calibrated 45° diagonal breaker isolation gap
    """
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-nexus">
  <title id="title-nexus">ProCal Concept 3 - The Breaker Nexus</title>
  <g fill="#000000" fill-rule="evenodd">
    <!-- Heavy-Duty Switchgear Enclosure Profile (DIN / MDB Enclosure) -->
    <path d="
      M 72 28 H 184 L 228 72 V 184 L 184 228 H 72 L 28 184 V 72 Z
      M 78 46 L 46 78 V 178 L 78 210 H 178 L 210 178 V 78 L 178 46 Z
    " />
    
    <!-- Upper Incomer Conductor (Phase Feeder / P Contact) -->
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
    
    <!-- Lower Return Conductor (Load Distribution / C Contact) -->
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

with open(os.path.join(OUT_DIR, "c1-symbol.svg"), "w") as f:
    f.write(build_perfect_concept_1())

with open(os.path.join(OUT_DIR, "c2-symbol.svg"), "w") as f:
    f.write(build_perfect_concept_2())

with open(os.path.join(OUT_DIR, "c3-symbol.svg"), "w") as f:
    f.write(build_perfect_concept_3())

print("c1-symbol.svg, c2-symbol.svg, c3-symbol.svg written.")
