# Work Journal

## Reliability fixes — 2026-10-16

**Objective:** Fix the row-count/buffer mismatch, keep verification read-only, and expose the checks through npm.

**Changes:**
- `BangleSheet.addBangle()` now clamps row count once and allocates the matching buffer.
- `test_verify.js` checks row bounds and JSON round-tripping without writing sample fixtures.
- Added `npm test` and a finalized scope spec in `.gsd/SPEC.md`.
- Documented `npm test` and corrected README sample gallery counts to match all six actual presets.
- Restored `public/sample_design_2.4.json` to match `sample_design_2.4.json` after the prior verifier had rewritten it.

**Verification evidence:**
- `npm test` exit code 0; output ended with `--- ALL BACKEND/FORMAT & SAMPLE PRESET TESTS PASSED! ---`.
- Regression output: `Bangle row normalization and buffer sizing verified`.
- Serialization output: `Project JSON round-trip verified (size: 27436 bytes)`.
- `npm run build` exit code 0; Vite transformed 16 modules and emitted production assets.
- Public sample SHA-256 after test: `DC5BA75B50434162635B47A8F13B32E0EBC1033A68C32324E6C2B54AD079D32C`, matching the root sample fixture.

**Repository note:** Git status could not be captured because this workspace has no `.git` directory.

## Hex line tool and feather stamps — 2026-10-16

**Objective:** Fix plus/line drawing behavior and add feather motifs.

**Changes:**
- Replaced physical-coordinate sampling with cube-coordinate hex interpolation for continuous, connected line paths.
- Show the line start cell immediately; preserve the last valid endpoint if the pointer leaves the bangle; discard canceled pointer gestures.
- Added Peacock Eye Feather, Golden Feather, and Royal Feather Spray stamps.
- Extended `test_verify.js` with connected-path, preview/commit, and motif-matrix checks.

**Verification evidence:**
- `npm test` exit code 0; output included `Hex line continuity and preview commit verified (21 cells)`, `Feather motif matrices verified (3 motifs)`, and `--- ALL BACKEND/FORMAT & SAMPLE PRESET TESTS PASSED! ---`.
- `npm run build` exit code 0; Vite transformed 16 modules and emitted the production bundle.
- Browser screenshot validation was attempted but stopped by Computer Use because the active browser URL could not be verified.

## Reference image fit — 2026-10-16

**Objective:** Correct the reference overlay sizing shown in the attached screenshot.

**Finding:** The 1024×667 vintage reference image was drawn at 300 mm wide using its natural aspect ratio, so it occupied only about 195 mm vertically while the bangle stack spans the 272.37 mm usable height.

**Changes:**
- Added independent reference-image height control while preserving aspect-ratio sizing for newly uploaded images by default.
- Preset reference images and “Fit Usable Area” now span the sheet width and usable bangle height, starting at `USABLE_Y_MIN_MM`.
- Updated the verification script to check explicit height and natural-aspect fallback.

**Verification evidence:**
- `npm test` exit code 0; output included `Reference image usable-area sizing and aspect fallback verified` and the full sample/G-code/SVG checks passed.
- `npm run build` exit code 0; Vite transformed 16 modules and emitted the production bundle.

## Ruby floral lattice sample — 2026-10-16

**Objective:** Add a bangle design in the style of the user's ruby, diamond, and gold reference.

**Changes:**
- Added a 24-row repeating ruby bloom and gold diamond-lattice sample preset.
- Added ruby as a fourth stone color in the picker, keyboard shortcut, live counts, PNG legend, SVG groups, single TAP downloads, and ZIP exports.
- Updated the README with the new sample and color.

**Verification evidence:**
- `npm test` exit code 0; output included `Ruby sample counts, JSON round-trip, and CNC/SVG/ZIP exports verified (1971 ruby holes)` and `Testing 7 sample presets...`.
- `npm run build` exit code 0; Vite transformed 16 modules and emitted the production bundle.

## Motif stamp orientation controls — 2026-10-16

**Objective:** Upgrade stamp placement so motifs can be reused in different orientations.

**Changes:**
- Added 90-degree clockwise rotation, horizontal and vertical flips, and a reset action to the motif panel.
- Applied transforms to the stamp matrix before placement, preserving empty cells and handling rectangular motifs.
- Reset orientation when switching to another selected motif, and expose current angle and flip states in the controls.
- Added deterministic matrix placement checks for all transforms.

**Verification evidence:**
- `npm test` exit code 0; output included `Motif rotation, horizontal/vertical flips, and reset verified` and all existing sample/export checks passed.
- `npm run build` exit code 0; Vite transformed 16 modules and emitted the production bundle.

## Blank-first design workflow and Brass OK sizing — 2026-10-16

**Objective:** Clear the bundled sample gallery, simplify the first-use workflow, and support the layered repeating ornament reference.

**Changes:**
- Cleared the sample preset registry and removed sample-gallery/reload controls from the UI.
- Fresh installs start with one empty 24-row band; added a confirmed **New Design** action and a blank-band option when changing the grid size. Existing saved projects still restore.
- Added an accessible Brass OK selector for KADA, BB, CP, and CHURI with all 16 reference millimeter values and a matching standard grid-size action.
- Added an action to tile the active rotated/flipped motif across the selected bangle, with the complete band placed as one undoable edit.
- Added a blank-first workflow guide, more readable size controls, and fit-to-band startup framing.

**Verification evidence:**
- `npm test` exit code 0; output included `Blank start and all 16 Brass OK measurements verified`, `Motif tiling across the bangle and single-step undo verified`, and all project format checks passed.
- `npm run build` exit code 0; Vite transformed 17 modules and emitted the production bundle.
- Browser accessibility tree and screenshot showed the blank 24-row canvas, the Brass OK box at `215 mm`, no Samples tab, and a New Design control.
