import math
import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

def rot_point(x, y, angle_deg, cx=128.0, cy=138.67):
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    nx = cos_a * (x - cx) - sin_a * (y - cy) + cx
    ny = sin_a * (x - cx) + cos_a * (y - cy) + cy
    return nx, ny

# Equilateral triangle vertices:
# V_top = (128.0, 32.0)
# V_br  = (220.0, 192.0)
# V_bl  = (36.0, 192.0)
# Centroid: (128.0, 138.67)

# Side length: S = 220.0 - 36.0 = 184.0.
# Height: H = 192.0 - 32.0 = 160.0. (184 * sqrt(3)/2 = 159.35 ~= 160)

# Bar thickness W = 32 px.
# Gap G = 16 px.

# Chevron 1 is at V_top (128, 32).
# It has two legs:
# Leg 1 goes down-left along the left edge.
# Leg 2 goes down-right along the right edge.
#
# How long are the legs?
# Total edge length = 184 px.
# At the midpoint of the edge is the gap G = 16 px.
# So each leg extends from the corner towards the midpoint:
# Leg length along edge = (184 - 16) / 2 = 84 px!
#
# Let's calculate the coordinates of Chevron 1:
# Outer Apex: (128.0, 32.0)
# Outer Right End: (128 + 84 * 0.5, 32 + 84 * 0.866025) = (170.0, 104.75)
# Right End cut is perpendicular to the right edge:
# Right edge direction: (0.5, 0.866025).
# Normal pointing inward: (-0.866025, 0.5).
# Inner Right End = (170.0 - 32 * 0.866025, 104.75 + 32 * 0.5) = (142.29, 120.75)
#
# Inner Apex:
# Intersection of inner right edge and inner left edge:
# The inner apex sits below the outer apex along the vertical axis by W / sin(30°) = 32 / 0.5 = 64 px!
# So Inner Apex = (128.0, 32 + 64) = (128.0, 96.0).
#
# Inner Left End:
# Symmetrical to Inner Right End across x = 128:
# x = 128 - (142.29 - 128) = 113.71, y = 120.75.
#
# Outer Left End:
# Symmetrical to Outer Right End:
# x = 128 - (170.0 - 128) = 86.0, y = 104.75.
#
# Let's check the points of Chevron 1 in order:
# 1. Outer Apex:      (128.0, 32.0)
# 2. Outer Right End: (170.0, 104.8)
# 3. Inner Right End: (142.3, 120.8)
# 4. Inner Apex:      (128.0, 96.0)
# 5. Inner Left End:  (113.7, 120.8)
# 6. Outer Left End:  (86.0, 104.8)

chevron1_pts = [
    (128.0, 32.0),
    (170.0, 104.8),
    (142.3, 120.8),
    (128.0, 96.0),
    (113.7, 120.8),
    (86.0, 104.8)
]

cx, cy = 128.0, 138.67

chevrons = []
for angle in [0, 120, 240]:
    rot_pts = []
    for x, y in chevron1_pts:
        nx, ny = rot_point(x, y, angle, cx, cy)
        rot_pts.append(f"{nx:.1f},{ny:.1f}")
    chevrons.append(f'<polygon points="{" ".join(rot_pts)}" />')

svg_chevron_delta = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-delta">
  <title id="title-delta">ProCal Concept 2 - The Phase Delta</title>
  <!-- Three calibrated phase corner chevrons in 120° rotational equilibrium -->
  <g fill="#000000">
    {"".join(chevrons)}
  </g>
</svg>'''

with open(os.path.join(OUT_DIR, "chevron-delta.svg"), "w") as f:
    f.write(svg_chevron_delta)

print("chevron-delta.svg written.")
