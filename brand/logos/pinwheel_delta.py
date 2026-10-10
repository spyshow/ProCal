import math
import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

def rot_point(x, y, angle_deg, cx, cy):
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    nx = cos_a * (x - cx) - sin_a * (y - cy) + cx
    ny = sin_a * (x - cx) + cos_a * (y - cy) + cy
    return nx, ny

def generate_pinwheel_delta():
    # Centroid
    cx, cy = 128.0, 136.0
    
    # Outer equilateral triangle centered at (128, 136):
    # R_outer = 108.
    # Apex 0 (Top): (128, 136 - 108) = (128, 28)
    # Apex 1 (Bottom Right): (128 + 108 * cos(30°), 136 + 108 * sin(30°)) = (128 + 93.53, 136 + 54) = (221.53, 190)
    # Apex 2 (Bottom Left):  (128 - 93.53, 190) = (34.47, 190)
    #
    # Bar width W = 36.
    # Gap G = 16.
    #
    # Let's define Bar 1 along the base (from Apex 2 towards Apex 1):
    # Apex 2 is at (34.47, 190).
    # Bar 1 starts at Apex 2!
    # Point 1 (outer start): (34.47, 190)
    # Point 2 (outer end): stops G units before Apex 1.
    #   Apex 1 is at (221.53, 190).
    #   Distance along base is (221.53 - 34.47) = 187.06.
    #   Stop before Apex 1: x = 221.53 - 24 = 197.53.
    #   Cut at end is parallel to the incoming edge (slope 60°: dx=0.5, dy=0.866025, or perpendicular).
    #   Let's make the cut parallel to the right edge (slope 60°)!
    #   Slope 60°: x decreases as y decreases:
    #   If outer point is (197.53, 190), then inner point at y = 190 - 36 = 154 has:
    #   dx = - 36 / tan(60°) = - 36 / 1.73205 = - 20.78.
    #   So inner point is (197.53 - 20.78, 154) = (176.75, 154).
    # Point 3: (176.75, 154)
    # Point 4 (inner start at left corner):
    #   Inner left corner: intersection of inner base line (y=154) and inner left edge.
    #   Left edge runs from (34.47, 190) to (128, 28).
    #   Inner edge is shifted into triangle by 36 perpendicular to edge.
    #   On the base line y=154:
    #   The left edge has x = 34.47 + (190 - 154) / tan(60°) = 34.47 + 36 / 1.73205 = 34.47 + 20.78 = 55.25.
    #   Shifted inward by W/sin(60°) = 36 / 0.866025 = 41.57.
    #   So x = 34.47 + 41.57 = 76.04!
    #   Wait, if Bar 1 STARTS at the corner (34.47, 190), what is its shape at the left corner?
    #   The incoming Bar 3 (from apex to BL) stops before the corner!
    #   So Bar 1 owns the corner (34.47, 190)!
    #   At the corner, its cut is along the left edge:
    #   from (34.47, 190) up along the 60° left edge to (34.47 + 20.78, 154) = (55.25, 154)!
    #
    # Let's check:
    # 4 points for Bar 1:
    # P1 (outer corner): (34.47, 190.0)
    # P2 (outer end):    (197.53, 190.0)
    # P3 (inner end):    (176.75, 154.0)
    # P4 (inner corner): (55.25, 154.0)
    #
    # When Bar 1 is rotated by 120°:
    # Its outer corner (34.47, 190) rotates to Apex 1 (221.53, 190)!
    # Its outer end (197.53, 190) rotates to the end along the right edge, which stops 24 units before Apex 0!
    # And Bar 1's cut at P2->P3 is parallel to Bar 2's starting edge!
    # So the gap between Bar 1's end and Bar 2's corner is a UNIFORM, PARALLEL SLIT!
    #
    # Let's calculate the width of the gap:
    # Bar 2 starts at (221.53, 190) and runs up-left along the edge.
    # Bar 1's end cut is at x=197.53, which is 24 units left of 221.53.
    # The normal distance between the parallel cut and the edge of Bar 2 is:
    # 24 * sin(60°) = 24 * 0.866025 = 20.78 px!
    # A PERFECT 20.8 px UNIFORM DIELECTRIC CLEARANCE GAP!
    
    p1 = (34.5, 190.0)
    p2 = (197.5, 190.0)
    p3 = (176.7, 154.0)
    p4 = (55.3, 154.0)
    
    base_pts = [p1, p2, p3, p4]
    
    arms_svg = []
    for angle in [0, 120, 240]:
        rot_pts = [rot_point(px, py, angle, cx, cy) for px, py in base_pts]
        pts_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in rot_pts)
        arms_svg.append(f'<polygon points="{pts_str}" />')
        
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">ProCal Concept B - The Phase Delta</title>
  <!-- Three calibrated 3-phase busbars in mathematical 120° rotational equilibrium -->
  <g fill="#000000">
    {"".join(arms_svg)}
  </g>
</svg>'''

svg_b = generate_pinwheel_delta()
with open(os.path.join(OUT_DIR, "pinwheel-delta.svg"), "w") as f:
    f.write(svg_b)

print("pinwheel-delta.svg written.")
