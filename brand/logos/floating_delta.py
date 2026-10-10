import math
import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

def rot_point(x, y, angle_deg, cx=128.0, cy=136.0):
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    nx = cos_a * (x - cx) - sin_a * (y - cy) + cx
    ny = sin_a * (x - cx) + cos_a * (y - cy) + cy
    return nx, ny

# Let's construct ONE segment of the 3-phase delta directly:
# The delta has 3 identical segments: Bottom segment, Right segment, Left segment.
# Let's design the Bottom segment:
# It runs horizontally along the bottom (y=190).
# Bar thickness W = 32px (y from 158 to 190).
# On the left: it terminates at x = 70. Cut angle is 60°: (70, 190) to (88.5, 158).
# On the right: it extends past the inner corner to form the pinwheel step,
# or it terminates at x = 186 with a 60° cut: (186, 190) to (204.5, 158).
#
# But wait! For an interlocking pinwheel:
# One end extends all the way to the outer vertex, and the other end stops short!
# Let's calculate:
# Outer Triangle:
# V0 (Apex): (128, 28)
# V1 (BR):   (221.5, 190)
# V2 (BL):   (34.5, 190)
#
# Inner Triangle (concentric, centroid at 128, 136):
# Shift each edge inward by 34px:
# Inner Base: y = 190 - 34 = 156.
# Inner Apex: y = 28 + 34 / sin(30°) = 28 + 68 = 96. (128, 96).
# Inner BR: x = 221.5 - 34 / sin(60°) = 221.5 - 39.26 = 182.24, y = 156.
# Inner BL: x = 34.5 + 39.26 = 73.76, y = 156.
#
# Now let's place a 14px dielectric gap slot cutting from Inner BL to Outer BL:
# The slot is parallel to the left edge (slope 60°: dx=0.5, dy=0.866025).
# Slot width = 14px.
# Shifted by distance D from the vertex.
# If the slot cuts through the left edge, then:
# Bottom bar starts at the slot:
# Outer start: x = 34.5 + D / sin(60°) = 34.5 + 24 = 58.5, y = 190.
# Inner start: x = 73.76 + 24 = 97.76, y = 156.
# Bottom bar runs all the way to the BR vertex (221.5, 190)!
# And at the BR vertex, it continues UP along the right edge until the next slot!
# Next slot cuts across the right edge at D units from BR:
# Outer cut: (221.5 - 24 * 0.5, 190 - 24 * 0.866) = (209.5, 169.2)
# Inner cut: ...
#
# Let's test this in code with precise coordinates and inspect the rendered image:

def make_perfect_pinwheel_delta(gap=16, bar_w=32):
    cx, cy = 128.0, 136.0
    
    # Let's define the base arm (Arm 1):
    # Bottom bar from (64, 190) to (200, 190), turning up-left to (170, 138),
    # then cut perpendicular to edge, down to (142, 154), then to (82, 158)...
    #
    # Wait, what if each arm is a straight trapezoid with angled ends?
    # Arm 1: Base bar
    # (64, 190) -> (194, 190) -> (174, 158) -> (84, 158)
    # Then rotated by 120° and 240°:
    # Let's see:
    # Outer base: x from 64 to 194 (length 130).
    # Triangle base: x from 34.5 to 221.5 (length 187).
    # So there is a gap of 64 - 34.5 = 29.5 at the left, and 221.5 - 194 = 27.5 at the right!
    # Because each of the 3 arms stops 28 units before the vertex,
    # the 3 vertices have OPEN, FLOATING CUTS!
    # That creates a floating 3-phase Delta!
    p1 = (62.0, 190.0)
    p2 = (194.0, 190.0)
    p3 = (175.5, 158.0)
    p4 = (80.5, 158.0)
    
    base_pts = [p1, p2, p3, p4]
    arms = []
    for angle in [0, 120, 240]:
        pts = [rot_point(x, y, angle, cx, cy) for x, y in base_pts]
        pts_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        arms.append(f'<polygon points="{pts_str}" />')
        
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">ProCal Concept B - The Phase Delta</title>
  <g fill="#000000">
    {"".join(arms)}
  </g>
</svg>'''

svg_b = make_perfect_pinwheel_delta()
with open(os.path.join(OUT_DIR, "floating-delta.svg"), "w") as f:
    f.write(svg_b)

print("floating-delta.svg written.")
