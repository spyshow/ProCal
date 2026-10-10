import os

OUT_DIR = r"d:\BackUp\programing_projects\ProCal\brand\logos"

def build_lockups():
    with open(os.path.join(OUT_DIR, "round2-opt1.svg"), "r") as f:
        sym1 = f.read()
    with open(os.path.join(OUT_DIR, "round2-opt2.svg"), "r") as f:
        sym2 = f.read()
    with open(os.path.join(OUT_DIR, "round2-opt3.svg"), "r") as f:
        sym3 = f.read()

    def get_inner(svg_str):
        start = svg_str.find("<title")
        if start != -1:
            end_title = svg_str.find("</title>", start) + 8
            content = svg_str[end_title:svg_str.rfind("</svg>")]
        else:
            content = svg_str[svg_str.find(">") + 1:svg_str.rfind("</svg>")]
        return content.strip()

    def make_lockup(symbol_inner, name):
        return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="{name}-title">
  <title id="{name}-title">ProCal Lockup - {name}</title>
  <!-- Symbol scaled and optically positioned on left -->
  <g transform="translate(36, 36) scale(0.72)">
    {symbol_inner}
  </g>
  <!-- Engineered Wordmark with ABB Orange Accent -->
  <g fill="#0f172a">
    <text x="248" y="150" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, 'Helvetica Neue', sans-serif" font-size="104" font-weight="800" letter-spacing="-2">Pro<tspan fill="#ea580c" font-weight="500">Cal</tspan></text>
    <text x="252" y="186" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif" font-size="17" font-weight="700" letter-spacing="4.5" fill="#64748b">LOW-VOLTAGE ELECTRICAL DESIGN</text>
  </g>
</svg>'''

    l1 = make_lockup(get_inner(sym1), "Round2-Option1")
    l2 = make_lockup(get_inner(sym2), "Round2-Option2")
    l3 = make_lockup(get_inner(sym3), "Round2-Option3")

    with open(os.path.join(OUT_DIR, "round2-opt1-lockup.svg"), "w") as f:
        f.write(l1)
    with open(os.path.join(OUT_DIR, "round2-opt2-lockup.svg"), "w") as f:
        f.write(l2)
    with open(os.path.join(OUT_DIR, "round2-opt3-lockup.svg"), "w") as f:
        f.write(l3)

    print("Round 2 lockups generated.")

build_lockups()
