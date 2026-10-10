import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

def build_lockups():
    # Load the 3 symbols
    with open(os.path.join(OUT_DIR, "c1-symbol.svg"), "r") as f:
        sym1 = f.read()
    with open(os.path.join(OUT_DIR, "c2-symbol.svg"), "r") as f:
        sym2 = f.read()
    with open(os.path.join(OUT_DIR, "c3-symbol.svg"), "r") as f:
        sym3 = f.read()

    # Extract paths from each symbol
    # For a lockup on viewBox="0 0 880 256":
    # Symbol placed at scale 0.76 or 0.8:
    # Symbol box: x=40..216 (width 176), centered vertically (y=40..216)
    # Wordmark starts at x=250, baseline y=150
    # "ProCal"
    # Font: bold geometric sans
    
    # Wordmark text:
    # <text x="250" y="152" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, 'Helvetica Neue', sans-serif" font-size="108" font-weight="800" letter-spacing="-1" fill="#000000">Pro<tspan font-weight="400">Cal</tspan></text>
    # <text x="254" y="188" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif" font-size="20" font-weight="600" letter-spacing="4" fill="#64748b">ELECTRICAL DESIGN</text>
    
    def make_lockup(symbol_inner, name):
        return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="{name}-title">
  <title id="{name}-title">ProCal Lockup - {name}</title>
  <!-- Symbol scaled and optically positioned on left -->
  <g transform="translate(36, 36) scale(0.72)">
    {symbol_inner}
  </g>
  <!-- Engineered Wordmark -->
  <g fill="#000000">
    <text x="248" y="150" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, 'Helvetica Neue', sans-serif" font-size="104" font-weight="800" letter-spacing="-2" fill="#000000">Pro<tspan font-weight="500">Cal</tspan></text>
    <text x="252" y="186" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif" font-size="17" font-weight="700" letter-spacing="4.5" fill="#64748b">LOW-VOLTAGE ELECTRICAL DESIGN</text>
  </g>
</svg>'''

    # Extract inner content between <svg> and </svg> (skipping <title>)
    def get_inner(svg_str):
        start = svg_str.find("<title")
        if start != -1:
            end_title = svg_str.find("</title>", start) + 8
            content = svg_str[end_title:svg_str.rfind("</svg>")]
        else:
            content = svg_str[svg_str.find(">") + 1:svg_str.rfind("</svg>")]
        return content.strip()

    l1 = make_lockup(get_inner(sym1), "Concept-1")
    l2 = make_lockup(get_inner(sym2), "Concept-2")
    l3 = make_lockup(get_inner(sym3), "Concept-3")

    with open(os.path.join(OUT_DIR, "c1-lockup.svg"), "w") as f:
        f.write(l1)
    with open(os.path.join(OUT_DIR, "c2-lockup.svg"), "w") as f:
        f.write(l2)
    with open(os.path.join(OUT_DIR, "c3-lockup.svg"), "w") as f:
        f.write(l3)

    print("Lockups generated.")

build_lockups()
