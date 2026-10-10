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

def generate_delta_arms(gap=14, bar_w=32):
    # Centroid
    cx, cy = 128.0, 136.0
    
    # Let's define the base arm (Arm 1 along bottom and turning up-right)
    # The bottom edge is horizontal: y = 196.
    # Triangle vertices:
    # Apex: (128, 32)
    # BR:   (128 + 94.68, 196) = (222.68, 196)
    # BL:   (128 - 94.68, 196) = (33.32, 196)
    # Base arm runs from BL towards BR, then turns up along the edge (slope 60°: dx = -0.5, dy = -0.866025).
    #
    # Let's define the 6 vertices of Arm 1 (bent busbar):
    # Outer bottom-left: starts after a gap from Arm 3.
    # Arm 3 comes down the left edge (slope 60°).
    #
    # Let's compute precisely:
    # Outer base line: y = 196. x goes from ~60 to 216.
    # At BR corner (216, 196), it turns along the 60° edge towards apex:
    # Edge unit vector: (-cos(60°), -sin(60°)) = (-0.5, -0.866025)
    # Arm 1 outer contour:
    # 1. P_start: (68, 196)
    # 2. P_corner_outer: (216, 196)
    # 3. P_turn_outer: (216 - 70*0.5, 196 - 70*0.866025) = (181.0, 135.38)
    # 4. P_turn_inner: perpendicular cut of width bar_w (32):
    #    Normal to edge (-0.5, -0.866025) pointing inward: (-0.866025, 0.5)
    #    So P_turn_inner = (181.0 - 32*0.866025, 135.38 + 32*0.5) = (153.29, 151.38)
    # 5. P_corner_inner: intersection of inner base line (y = 196 - 32 = 164) and inner edge.
    #    Inner edge line: through (153.29, 151.38) with direction (0.5, 0.866025).
    #    y = 151.38 + t * 0.866025 = 164  => t = (164 - 151.38)/0.866025 = 14.57
    #    x = 153.29 + 14.57 * 0.5 = 160.58.
    #    So P_corner_inner = (160.58, 164).
    # 6. P_end_inner: (68 + 32/math.tan(math.radians(60)), 164) = (68 + 18.48, 164) = (86.48, 164).
    # 7. Then back to P_start (68, 196) with a 60° cut.
    #
    # Let's verify:
    # Does this form a clean, closed polygon? Yes!
    # Let's write this out and check how the 3 arms tile!
    p1 = (68.0, 196.0)
    p2 = (216.0, 196.0)
    p3 = (181.0, 135.38)
    p4 = (153.29, 151.38)
    p5 = (160.58, 164.0)
    p6 = (86.48, 164.0)
    
    base_pts = [p1, p2, p3, p4, p5, p6]
    
    arms_svg = []
    for angle in [0, 120, 240]:
        rot_pts = [rot_point(px, py, angle, cx, cy) for px, py in base_pts]
        pts_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in rot_pts)
        arms_svg.append(f'<polygon points="{pts_str}" />')
        
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">ProCal Concept B - The Phase Delta</title>
  <g fill="#000000">
    {"".join(arms_svg)}
  </g>
</svg>'''

svg_b_clean = generate_delta_arms()
with open(os.path.join(OUT_DIR, "test-delta.svg"), "w") as f:
    f.write(svg_b_clean)

print("test-delta.svg written.")
