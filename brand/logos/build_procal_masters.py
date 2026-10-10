"""
Build production-grade vector masters for ProCal:
The Phase Monogram (Concept B)
"""

import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"
os.makedirs(OUT_DIR, exist_ok=True)

# 1. Master Full Colour Symbol
# Stem: Midnight Slate #0f172a
# Outer Loop: ABB Industrial Orange #ea580c
# Inner Phase Tap: Electric Amber #f59e0b
def get_symbol_color():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="procal-sym-title">
  <title id="procal-sym-title">ProCal Symbol</title>
  <!-- Master Vertical Feeder Busbar (Midnight Slate) -->
  <path d="M 44 28 H 92 V 204 L 68 228 H 44 Z" fill="#0f172a" />
  
  <!-- Outer Phase Loop (ABB Industrial Orange) -->
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
  
  <!-- Middle Phase Conductor Tap (Electric Amber) -->
  <path d="M 92 74 H 144 C 151.7 74 158 80.3 158 88 C 158 95.7 151.7 102 144 102 H 92 Z" fill="#f59e0b" />
</svg>'''

# 2. Solid One-Colour Black Symbol
def get_symbol_black():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="procal-sym-black-title">
  <title id="procal-sym-black-title">ProCal Symbol - Black</title>
  <path fill="#000000" fill-rule="evenodd" d="
    M 44 28
    H 156
    C 189.1 28 216 54.9 216 88
    C 216 121.1 189.1 148 156 148
    H 92
    V 204
    L 68 228
    H 44
    Z
    
    M 92 54
    H 152
    C 170.8 54 186 69.2 186 88
    C 186 106.8 170.8 122 152 122
    H 92
    V 102
    H 144
    C 151.7 102 158 95.7 158 88
    C 158 80.3 151.7 74 144 74
    H 92
    Z
  " />
</svg>'''

# 3. Solid One-Colour White Symbol (Thinned for optical irradiation on dark backgrounds)
def get_symbol_white():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="procal-sym-white-title">
  <title id="procal-sym-white-title">ProCal Symbol - White</title>
  <path fill="#ffffff" fill-rule="evenodd" d="
    M 44 28
    H 156
    C 189.1 28 216 54.9 216 88
    C 216 121.1 189.1 148 156 148
    H 92
    V 204
    L 68 228
    H 44
    Z
    
    M 92 54
    H 152
    C 170.8 54 186 69.2 186 88
    C 186 106.8 170.8 122 152 122
    H 92
    V 102
    H 144
    C 151.7 102 158 95.7 158 88
    C 158 80.3 151.7 74 144 74
    H 92
    Z
  " />
</svg>'''

# 4. Small-Size Micro Cut (16px / 32px Favicon)
# Optimized with bold proportions and wider dielectric clearance
def get_symbol_small():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="procal-small-title">
  <title id="procal-small-title">ProCal Symbol - Small Cut</title>
  <!-- Thicker stem and outer loop with wider internal gap for 16px fidelity -->
  <path d="M 36 20 H 92 V 204 L 64 236 H 36 Z" fill="#0f172a" />
  <path fill="#ea580c" fill-rule="evenodd" d="
    M 92 20
    H 160
    C 195 20 224 49 224 88
    C 224 127 195 156 160 156
    H 92
    V 124
    H 156
    C 176 124 192 108 192 88
    C 192 68 176 52 156 52
    H 92
    Z
  " />
  <path d="M 92 72 H 146 C 155 72 162 79 162 88 C 162 97 155 104 146 104 H 92 Z" fill="#f59e0b" />
</svg>'''

# 5. Master Horizontal Lockup
# Canvas: 880 x 256
def get_lockup_horizontal():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="procal-lockup-h-title">
  <title id="procal-lockup-h-title">ProCal Horizontal Lockup</title>
  <!-- Symbol placed on left at scale 0.74 -->
  <g transform="translate(36, 34) scale(0.74)">
    <path d="M 44 28 H 92 V 204 L 68 228 H 44 Z" fill="#0f172a" />
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
    <path d="M 92 74 H 144 C 151.7 74 158 80.3 158 88 C 158 95.7 151.7 102 144 102 H 92 Z" fill="#f59e0b" />
  </g>
  
  <!-- Wordmark -->
  <g fill="#0f172a">
    <text x="248" y="150" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, 'Helvetica Neue', sans-serif" font-size="104" font-weight="800" letter-spacing="-2">Pro<tspan fill="#ea580c" font-weight="500">Cal</tspan></text>
    <text x="252" y="186" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif" font-size="16" font-weight="600" letter-spacing="1.5" fill="#64748b">Low Voltage Electrical Design , <tspan fill="#ea580c" font-weight="700">Solved</tspan></text>
  </g>
</svg>'''

# 6. Master Stacked Lockup
# Canvas: 512 x 512
def get_lockup_stacked():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-labelledby="procal-lockup-s-title">
  <title id="procal-lockup-s-title">ProCal Stacked Lockup</title>
  <!-- Symbol centered on top -->
  <g transform="translate(136, 40) scale(0.94)">
    <path d="M 44 28 H 92 V 204 L 68 228 H 44 Z" fill="#0f172a" />
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
    <path d="M 92 74 H 144 C 151.7 74 158 80.3 158 88 C 158 95.7 151.7 102 144 102 H 92 Z" fill="#f59e0b" />
  </g>
  
  <!-- Wordmark centered underneath -->
  <g text-anchor="middle">
    <text x="256" y="372" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, 'Helvetica Neue', sans-serif" font-size="92" font-weight="800" letter-spacing="-2" fill="#0f172a">Pro<tspan fill="#ea580c" font-weight="500">Cal</tspan></text>
    <text x="256" y="416" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif" font-size="14" font-weight="600" letter-spacing="1.2" fill="#64748b">Low Voltage Electrical Design , <tspan fill="#ea580c" font-weight="700">Solved</tspan></text>
  </g>
</svg>'''

# 7. Standalone Wordmark
def get_wordmark():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 180" width="620" height="180" role="img" aria-labelledby="procal-wordmark-title">
  <title id="procal-wordmark-title">ProCal Wordmark</title>
  <g fill="#0f172a">
    <text x="20" y="112" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, 'Helvetica Neue', sans-serif" font-size="108" font-weight="800" letter-spacing="-2">Pro<tspan fill="#ea580c" font-weight="500">Cal</tspan></text>
    <text x="24" y="152" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif" font-size="16" font-weight="600" letter-spacing="1.5" fill="#64748b">Low Voltage Electrical Design , <tspan fill="#ea580c" font-weight="700">Solved</tspan></text>
  </g>
</svg>'''

files = {
    "procal-symbol.svg": get_symbol_color(),
    "procal-symbol-black.svg": get_symbol_black(),
    "procal-symbol-white.svg": get_symbol_white(),
    "procal-symbol-small.svg": get_symbol_small(),
    "procal-lockup-horizontal.svg": get_lockup_horizontal(),
    "procal-lockup-stacked.svg": get_lockup_stacked(),
    "procal-wordmark.svg": get_wordmark(),
}

for name, content in files.items():
    with open(os.path.join(OUT_DIR, name), "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print(f"Wrote {name}")

print("All master files written successfully.")
