# SPEC.md — OrnaCAD Reliability and Feature Upgrades

> **Status**: `FINALIZED`

## Vision
Keep the browser based bangle design editor reliable when creating bangles and validating bundled sample designs.

## Goals
1. Normalize bangle row counts to the supported 1–60 range and allocate matching stone data.
2. Make the existing verification script safe to run without modifying application fixtures.
3. Expose the verification script through the standard npm test command.
4. Make line drawing previews and committed lines follow a continuous path on the hex grid.
5. Add several feather and peacock feather motif stamps.
6. Fit reference images to the usable sheet area so tracing content spans the full bangle layout.
7. Add a reusable ruby, diamond, and gold lattice bangle sample matching the attached reference style.
8. Support ruby stones consistently in editing, counts, persistence, and all export formats.

## Non-Goals
- Changing sample designs, CNC output formats, or production geometry.

## Constraints
- Preserve the current Vite and Node.js setup.
- Keep existing sample presets and export behavior unchanged.

## Success Criteria
- [ ] `addBangle` produces a row count between 1 and 60 and a data buffer of exactly `rows * stonesPerRow` for out-of-range inputs.
- [ ] `npm test` passes the existing verification coverage plus the row-boundary regression checks.
- [ ] Running verification does not rewrite the public sample JSON fixture.
- [ ] `npm run build` succeeds.
- [ ] Line drawing displays its start cell immediately, follows an adjacent-cell path, and commits the last valid in-bangle endpoint.
- [ ] Feather stamps are available in the motif picker and return valid, non-empty matrices.
- [ ] Reference images can be sized independently in width and height, and the fit action maps them to the 300 mm sheet width and 272.37 mm usable height.
- [ ] The sample gallery includes a repeating ruby floral lattice with white diamond accents and gold borders.
- [ ] Ruby stones render, count, save/load, and export as SVG, PNG, and CNC drill files.

## Technical Requirements
- Use the existing `test_verify.js` verification script.
- Keep checks deterministic and avoid test-time writes to project fixtures.

---

*Last updated: 2026-10-16*

## Upgrade Addendum (2026-10-16)

9. Let users rotate and flip the selected motif stamp before placing it, with a clear reset action and orientation that resets when selecting a different motif.

## Additional Success Criteria
- [x] Stamp rotate/flip/reset actions update subsequent placements, including rectangular motif dimensions and null spaces.
- [x] `npm test` covers rotation, both flips, and reset behavior.
- [x] `npm run build` succeeds after the stamp controls are added.

## Brass sizing and empty-start UX (2026-10-16)

10. Replace bundled sample designs in the app with a clean blank project and an informative empty state.
11. Improve the design workflow for tracing and building layered repeating ornament bands similar to the user's reference.
12. Add a Brass OK size lookup for KADA, BB, CP, and CHURI using the supplied four size rows and exact millimeter measurements.
13. Keep standard sheet sizing and exports compatible with existing project files.

## Additional Success Criteria
- [x] Fresh project has no prefilled sample stones, and sample gallery entry points are removed or replaced with a useful empty state.
- [x] Brass OK lookup displays the exact table value for all 16 category/size combinations and applies the matching standard bangle size option.
- [x] Users can make repeated ornament bands with their active motif across a row, supporting the reference's layered pattern workflow.
- [x] `npm test` passes the remaining project model/export checks and new lookup/repeat-band checks.
- [x] `npm run build` succeeds and key UI flows receive a browser check.

## Hand-set stone library (2026-10-16)

14. Provide five editable-size hand-set stone shapes with canvas placement, selection, movement, resize/rotate handles, flips, duplication, mirroring, repeats, and stone-ring placement.
15. Apply clearance masking as a reversible geometric mask. Masked holes are hidden and excluded from counts, TAP, and SVG while the underlying grid remains intact.
16. Persist shapes, size settings, and clearance; retain compatibility with older projects; include edits in undo/redo.

**Additional Success Criteria**
- [x] All five library cards are drawn to scale and have the exact requested names, default sizes, and estimated-size note.
- [x] Click-to-place, drag-to-place, selected-shape movement, resize handles, rotate handle, numeric geometry, keyboard transforms, mirror, repeat, and ring controls are available.
- [x] Mask calculation examines only the bangle cells in each shape's clearance bounding box; render/count/export consume the same cached mask.
- [x] TAP and SVG omit blocked holes; SVG includes `HandSet_Stones` paths; empty-mask TAP bytes are pinned by a golden-format regression.
- [x] JSON round-trip and legacy files without shapes work; all shape edit operations can undo and redo.
- [x] `npm test` covers mask/restore, exports, geometry, persistence, compatibility, and undo/redo; `npm run build` succeeds.

## Stone resize lock (2026-10-16)

17. Add an off-by-default switch to control all hand-set stone dimension editing. When off, library dimension inputs, selected-shape length/width fields, and canvas resize handles are unavailable; movement and rotation remain available. When on, all size editing is enabled.
18. Persist the switch in project JSON and undo/redo snapshots; legacy projects default to locked sizing.

**Additional Success Criteria**
- [x] New and legacy sheets default to locked sizing; JSON round-trip, clone, undo, and redo preserve the switch state.
- [x] The off state disables dimension controls and suppresses canvas resize handles and drag-resize; rotation and movement still work.
- [x] The on state enables dimension controls and resize handles; direct dimension updates are rejected while off.
- [x] `npm test` and `npm run build` succeed.

**Verification evidence:** `npm test` exit code 0, including locked sizing, legacy JSON, clone/round-trip, and switch undo/redo regression coverage. `npm run build` exit code 0. Browser screenshot verification was unavailable: the app did not load in the in-app browser (`ERR_CONNECTION_TIMED_OUT` on 127.0.0.1:5174; existing 5173 tab reported connection refused).

## Mobile landscape workspace (2026-10-16)

19. Prefer landscape orientation for OrnaCAD on phones and tablets, and give the editor a usable side-by-side layout while landscape.
20. Request a landscape orientation lock on launch where the browser allows it; for browsers requiring a user gesture, provide a fullscreen landscape action and a manual-rotation fallback.
21. On phones, hide the settings sidebar by default and provide a menu button and dismissible drawer so the design canvas remains visible.

**Additional Success Criteria**
- [x] Installed app manifest requests landscape orientation.
- [x] Touch devices in portrait receive an accessible landscape prompt with automatic, manual, and continue-in-portrait paths.
- [x] Touch devices in landscape use a full-height canvas with compact tool rail and sidebar.
- [x] Phone settings tabs are hidden behind a persistent Menu/Hide toggle button and open in a dismissible side drawer.
- [x] `npm test` and `npm run build` succeed.

**Verification evidence:** `npm test` exit code 0. `npm run build` exit code 0. Mobile drawer and orientation behavior were reviewed in the responsive rules and event wiring; an in-app browser screenshot could not be captured because local preview URLs are unreachable in that browser.

**Verification evidence:** Manifest parsed successfully and reports `display: standalone`, `orientation: landscape`. `npm test` exit code 0. `npm run build` exit code 0. Physical-device orientation behavior still depends on the browser and device auto-rotate settings; the web UI could not be opened in the in-app browser for screenshot inspection.

**Verification evidence:**
- `npm test` exit code 0; hand-set acceptance passed: 3120 filled → 3087 under the Triangle mask → 3120 restored after moving it away; TAP/SVG masks, exact Pear bounds, 90° Rectangle bounds, JSON and legacy load, and undo/redo passed.
- `npm run build` exit code 0. The in-app browser inspection was blocked by the browser URL security policy during this turn.

