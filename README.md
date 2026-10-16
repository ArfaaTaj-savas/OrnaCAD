# OrnaCAD 💎

A professional in-browser CAD tool for designing zircon stone-setting sheets for CNC drilling machines.

---

## 🌟 Overview & Purpose

Jewellery manufacturers and master stone-setters design sheets of drilled holes for bangle production. This application allows setting every individual zircon stone in four colours (**Green**, **White**, **Gold**, **Ruby**), and exports modal G-code drill files (`.tap`), CorelDRAW compatible vector sheets (`.svg`), and project state files (`.json`).

---

## ⚙️ Grid & Stone Specifications

| Parameter | Value | Description |
|---|---|---|
| **Stone Type** | Round Zircon SS 4.5 | ~1.6 mm to 1.7 mm diameter |
| **Grid Packing** | Hexagonal close-packing | Along-row spacing: `1.7 mm` |
| **Row Spacing** | `1.47224 mm` | Exact: $1.7 \times \frac{\sqrt{3}}{2}$ mm |
| **Odd Row Shift** | `0.85 mm` | Shifted right by half-pitch |
| **Sheet Size** | `300 × 300 mm` | Horizontally centered at $X = 150\text{ mm}$ |
| **Usable Area** | $Y = 13.815\text{ mm}$ to $Y = 286.185\text{ mm}$ | Total vertical height: `272.37 mm` |
| **Bangle Sizes** | 2.4 (130 st), 2.6 (134 st), 2.8 (140 st), 2.10 (150 st) | Width formula: $(\text{stones} - 1) \times 1.7 + 0.85\text{ mm}$ |
| **New Project** | 1 blank 24-row band | Add or duplicate bands as needed |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### 1. Installation
Clone or navigate to the project root directory:
```bash
npm install
```

### 2. Run Locally in Development Mode
Start the Vite local development server:
```bash
npm run dev
```
Open your browser at **`http://localhost:5173/`**.

### 3. Build for Production
Generate the production-ready static bundle:
```bash
npm run build
```
The compiled, minified bundle will be output to the `dist/` directory.

### Run Verification Checks
```bash
npm test
```
This verifies blank project setup, Brass OK measurements, motif transforms/repetition, serialization, SVG output, and CNC G-code formatting.

### 4. Preview Production Build Locally
```bash
npm run preview
```

---

## 🌐 Deployment Instructions

Because **OrnaCAD** is a pure client-side Single Page Application (SPA) requiring zero backend server:

### Deploy to Vercel
1. Install the Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory, or link the GitHub repository to [Vercel](https://vercel.com).
3. Build command: `npm run build`, Output directory: `dist`.

### Deploy to Netlify
1. Drag and drop the `dist/` folder onto [Netlify Drop](https://app.netlify.com/drop).
2. Or configure `netlify.toml`:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
   ```

### Deploy to GitHub Pages
1. Build the production site: `npm run build`
2. Push the contents of `dist/` to the `gh-pages` branch.

---

## 🛠️ Key Features

- **60 FPS Canvas 2D Engine**: Viewport culling and millimeter-coordinate mapping handles over 30,000 stones with smooth zooming and panning.
- **Tools**:
  - `Paint` (P), `Erase` (E)
  - `Fill Area` (F): Hexagonal flood-fill within the selected bangle
  - `Line Tool` (L): Rubberband preview and Bresenham hex interpolation
  - `Rectangle Tool` (R): Box fill
  - `Eyedropper` (I): Colour picker
  - `Pan / Move` (M or Space + Drag)
- **Brush Sizes**: 1, 2, 3, 5, and 8 stones.
- **Symmetry Modes**:
  - Left-to-Right Mirroring ($X = 150\text{ mm}$ axis)
  - Top-to-Bottom Mirroring (displays notice that it is exact for odd row counts)
- **Half-Copy Actions**: `Copy L → R` and `Copy R → L` for individual bangles or all bangles.
- **Reference Picture Tracing**: Load reference images under stones with independent width and height controls, millimeter placement, opacity, and a fit-to-usable-area action.
- **Sheet Layout & Height Meter**:
  - Dynamic stack of bangles with individual row count editors, duplicate, reorder, and delete buttons.
  - Height progress meter with green/warning/red indicators if exceeding 272.37 mm.
  - "Spread Gaps to Fill 272.37 mm" button.
- **Blank-first workflow**: New projects start with one empty 24-row band. Use **New Design** to clear the canvas, upload your own artwork in Tracing, then build layered bands with the drawing tools or repeat a selected motif across a band.
- **Brass OK size box**: Choose KADA, BB, CP, or CHURI and a size code to see the supplied millimeter reference and select the matching grid preset.
- **Exports & Direct Downloads**:
  - **📸 High-Resolution Image (.png)**: 300 × 300 mm at 300 DPI (2400 × 2400 px) with gem bevels, facet shine, rulers, and BOM legend.
  - **⚙️ Direct .TAP Drill Files**: 1-click downloads for Gold, White, Green, Ruby, and active Bangle `.tap` files without unzipping.
  - **Sheet Zip**: One drill file per colour with stones (`SHEET_Green_2.4.tap`, `SHEET_White_2.4.tap`, `SHEET_Gold_2.4.tap`, `SHEET_Ruby_2.4.tap`).
  - **Per-Bangle Zip**: Individual `.tap` files per bangle and colour (e.g. `B04_Gold_2.4.tap`).
  - **CorelDRAW SVG**: 300 × 300 mm vector document with 0.85 mm radius circles grouped hierarchically (`B01 > B01_Green_2.4`).
  - **Run-Length Encoded JSON**: Compact `.json` project save and load.
- **Autosave**: Safe `localStorage` persistence with error handling.

---

## ⚠️ Known Limits & CNC Safety Notice

1. **Hand-set stones are not drilled automatically.** Place those stones separately after CNC drilling where your design calls for them.
2. **The tool places only 1.7 mm stones (SS 4.5)**, so fine detail such as thin gold wire is not reproduced in the drilled holes.
3. **Always run a test file on scrap material before real production** to verify spindle clearance, clamping, and zero calibration.

---

## Brass OK reference values

| Size | KADA | BB | CP | CHURI |
|---|---:|---:|---:|---:|
| 2/4 | 215 mm | 216 mm | 204 mm | 202 mm |
| 2/6 | 234 mm | 223 mm | 218 mm | 216 mm |
| 2/8 | 244 mm | 231 mm | 224.5 mm | 223 mm |
| 2/10 | 253 mm | 243 mm | 235 mm | 233 mm |
