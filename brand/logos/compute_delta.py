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

cx, cy = 128.0, 136.0

# Outer vertex:
V_BR = (218.93, 188.5)
# Inner vertex:
v_BR = (164.37, 157.0)

# Cut position on base:
# Outer cut point A:
A_outer = (110.0, 188.5)
# Inner cut point F (60° cut, dx = -18.19, dy = -31.5):
F_inner = (110.0 - 18.19, 157.0) # (91.81, 157.0)

# Now on the right edge:
# The next cut (un-shifted) is A and F rotated by 120°:
next_A = rot_point(A_outer[0], A_outer[1], 120, cx, cy)
next_F = rot_point(F_inner[0], F_inner[1], 120, cx, cy)

# Shift next_A and next_F back along the right edge by gap distance
# Direction of right edge from V_BR towards Apex is:
# dx = 128.0 - 218.93 = -90.93, dy = 31.0 - 188.5 = -157.5
# Unit vector: (-0.5, -0.866025)
# Shift back means in opposite direction (+0.5, +0.866025) or away from Apex towards V_BR:
# Wait, next_A is near the Apex. The end of Arm 1 should stop BEFORE next_A by gap G = 16px!
# Unit vector from Apex towards V_BR is (0.5, 0.866025).
# So shift towards V_BR:
G = 16.0
shift_x = G / 0.866025 * 0.5 # along edge: 16 / sin(60°) * cos(60°) = 9.24
# Normal gap G = 16:
# Distance along edge is G / sin(60°) = 16 / 0.866025 = 18.475
shift_x = 18.475 * 0.5
shift_y = 18.475 * 0.866025

C_outer = (next_A[0] + shift_x, next_A[1] + shift_y)
D_inner = (next_F[0] + shift_x, next_F[1] + shift_y)

# Piece 1 polygon:
# A_outer -> V_BR -> C_outer -> D_inner -> v_BR -> F_inner
arm1_pts = [A_outer, V_BR, C_outer, D_inner, v_BR, F_inner]

arms = []
for rot in [0, 120, 240]:
    pts = [rot_point(px, py, rot, cx, cy) for px, py in arm1_pts]
    pts_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    arms.append(f'<polygon points="{pts_str}" />')

svg_delta = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-delta">
  <title id="title-delta">ProCal Concept B - The Phase Delta</title>
  <!-- Three interlocking phase conductors in balanced 120° rotational equilibrium -->
  <g fill="#000000">
    {"".join(arms)}
  </g>
</svg>'''

with open(os.path.join(OUT_DIR, "final-delta.svg"), "w") as f:
    f.write(svg_delta)

print("final-delta.svg written.")
