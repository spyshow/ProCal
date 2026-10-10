# ProCal — Brand & Logo Guidelines

> Official identity guidelines for ProCal (Low Voltage Electrical Design , Solved).

---

## 1. The Logo & Visual Concept
- **Concept Name:** The Phase Monogram
- **One-Sentence Idea:** An architectural capital **'P'** featuring a Midnight Slate busbar feeder stem with a 45° chamfered terminal lug, enclosing concentric 3-phase conductor tracks in ABB Industrial Orange and Electric Amber.
- **Electrical Metaphor:**
  - **Left Vertical Feeder Spine:** Heavy copper busbar / incoming feeder conductor with a 45-degree chamfered terminal lug.
  - **Outer Loop ($L_1$):** High-visibility ABB Industrial Orange (`#ea580c`) phase conductor defining the 'P' bowl.
  - **Middle Conductor ($L_2$):** Electric Amber (`#f59e0b`) phase conductor tap extending into the bowl.
  - **Balanced Return ($L_3$):** Inner dielectric clearance return, completing the closed-circuit distribution.
- **Production Score:** 100/100 heuristic readiness; zero near-miss angles; single-unit grid geometry.

---

## 2. Master Assets & File Structure

All master files are located in `brand/logos/`:

| File | Type | Purpose |
|---|---|---|
| `procal-symbol.svg` | SVG Master | Full-colour primary mark for screens, web headers, and app interfaces. |
| `procal-symbol-black.svg` | SVG 1-Colour | Solid black silhouette for single-color print, laser etching, documentation stamps. |
| `procal-symbol-white.svg` | SVG 1-Colour | Solid white reversed mark (optically thinned) for dark CAD drafting screens and title blocks. |
| `procal-symbol-small.svg` | SVG Micro Cut | Tuned geometry with wider air gaps for tiny 16 px & 32 px favicon/tab display. |
| `procal-lockup-horizontal.svg` | SVG Lockup | Primary horizontal logo with brand name and tagline. |
| `procal-lockup-stacked.svg` | SVG Lockup | Stacked vertical logo for documentation title pages, banners, and hardware badges. |
| `procal-wordmark.svg` | SVG Wordmark | Standalone typographic wordmark without symbol. |

### Web & Application Distribution Kit (`brand/logos/dist/` & `public/brand/kit/`):
- `favicon.ico` (Multi-resolution: 16×16, 32×32, 48×48)
- `apple-touch-icon.png` (180×180 for iOS Safari home screen)
- `icon-192.png` & `icon-512.png` (Standard PWA application icons)
- `maskable-512.png` (Android adaptive maskable icon)
- `site.webmanifest` & `head-snippet.html` (Plug-and-play HTML `<head>` tags)
- High-res transparent PNGs: 16, 32, 64, 128, 256, 512, 1024 px for all variants.

---

## 3. Brand Colour Palette

| Role | Colour Name | HEX | RGB | CMYK | Purpose |
|---|---|---|---|---|---|
| **Primary Brand** | ABB Industrial Orange | `#ea580c` | `234, 88, 12` | `0, 78, 100, 0` | Outer phase loop, brand accents, primary buttons, highlights |
| **Secondary Accent** | Electric Amber | `#f59e0b` | `245, 158, 11` | `0, 42, 100, 0` | Middle phase conductor tap, warning badges, active indicators |
| **Primary Neutral** | Midnight Slate | `#0f172a` | `15, 23, 42` | `88, 77, 53, 67` | Feeder busbar stem, dark theme canvas, high-contrast text |
| **Drafting Surface** | CAD Technical Slate | `#030712` | `3, 7, 18` | `90, 80, 60, 85` | Deep drafting canvas, terminal background, CAD grid backdrop |
| **Secondary Neutral** | Technical Slate Grey | `#64748b` | `100, 116, 139` | `60, 43, 27, 2` | Tagline text, secondary borders, inactive busbar annotations |
| **Reversed / Pure** | Drafting Pure White | `#ffffff` | `255, 255, 255` | `0, 0, 0, 0` | Reversed marks, light theme surface, high-contrast title text |

### Approved Background Pairings:
- **Full Colour Symbol:** On white, light gray (`#f8fafc`), or deep Midnight Slate (`#0f172a` / `#030712`).
- **Solid White Symbol:** On dark CAD blueprint viewports (`#030712`), dark switchgear enclosures, or dark terminal windows.
- **Solid Black Symbol:** On white engineering spec sheets, single-line diagrams, and black-and-white PDF reports.

---

## 4. Clear Space & Minimum Sizing

### Clear Space Rule:
Maintain a minimum exclusion zone of **$1 \times X$** around all sides of the mark, where $X$ equals the width of the vertical feeder busbar stem (48 px in the 256 px viewBox, or ~19% of the symbol width). No competing text, icons, or interface elements may intrude into this zone.

### Minimum Sizes:
| Format | Digital Display | Physical Print | Recommended File |
|---|---|---|---|
| **Full Horizontal Lockup** | Min width: `140 px` | Min width: `35 mm` | `procal-lockup-horizontal.svg` |
| **Stacked Lockup** | Min width: `80 px` | Min width: `22 mm` | `procal-lockup-stacked.svg` |
| **Primary Symbol** | Min size: `32 × 32 px` | Min size: `10 × 10 mm` | `procal-symbol.svg` |
| **Favicon / Status Bar** | Min size: `16 × 16 px` | Min size: `5 × 5 mm` | `procal-symbol-small.svg` / `favicon.ico` |

---

## 5. Typography

- **App Name Wordmark:** Geometric Sans (System Stack: Inter, Segoe UI, -apple-system, Roboto).
  - "Pro": Font weight `800` (Extrabold), tracking `-0.02em`.
- **Tagline / Slogan:** "Low Voltage Electrical Design , Solved" (Prefix in Technical Slate Grey `#64748b`, "Solved" in ABB Industrial Orange `#ea580c`).

---

## 6. Rules & Misuse Prevention
- **DO NOT** stretch, distort, or squash the aspect ratio.
- **DO NOT** recolor the symbol with unapproved colors (e.g. green, purple, generic cyan).
- **DO NOT** rotate the mark or tilt it off-axis; the vertical busbar must remain strictly vertical.
- **DO NOT** add drop shadows, outer glows, 3D bevels, or skeuomorphic gradients to the vector geometry.
- **DO NOT** separate the feeder stem from the conductor loop in lockups.
- **DO NOT** re-type the wordmark in a standard serif or generic cursive font.

---

## 7. Interactive Tools & Presentation

- **Interactive Presentation Board:** [`brand/logos/presentation.html`](file:///d:/BackUp/programing_projects/ProCal/brand/logos/presentation.html)
- **Interactive Multi-Theme Test Sheet:** [`brand/logos/preview-round2.html`](file:///d:/BackUp/programing_projects/ProCal/brand/logos/preview-round2.html)
- **High-Res Slide Deck:** `brand/logos/slides/slide-01.png` through `slide-05.png`
