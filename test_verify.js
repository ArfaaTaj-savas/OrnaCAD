// Verification test script for Bangle Stone Editor
import { createSampleSheet, createRubyBloomSheet, MOTIF_STAMPS, SAMPLE_PRESETS } from './src/sampleDesign.js';
import { BangleSheet } from './src/models/BangleSheet.js';
import { createBlankSheet } from './src/models/BangleSheet.js';
import { EditorController } from './src/editor/EditorController.js';
import { CanvasRenderer } from './src/renderer/CanvasRenderer.js';
import { SHEET_WIDTH_MM, STONE_CELL, USABLE_HEIGHT_MM, USABLE_Y_MIN_MM } from './src/constants.js';
import { generateGcodeForHoles, collectBangleHoles, collectSheetHoles, formatBangleId, exportSheetZip, exportBanglesZip } from './src/gcode/gcodeExporter.js';
import { generateSvgForCorelDraw } from './src/export/svgExporter.js';
import JSZip from 'jszip';
import { BRASS_OK_LENGTHS_MM, getBrassOkLength, getGridSizeKey } from './src/brassSizes.js';
import { HAND_SET_STONE_TYPES, getStoneLocalPolygon, getShapeBoundingBox, isHoleBlockedByShape } from './src/models/HandSetShape.js';

console.log('--- RUNNING BANGLE STONE EDITOR TESTS ---');

// 0. Bangle row boundaries must stay consistent with their backing buffers
const sizingSheet = new BangleSheet('2.4');
for (const [inputRows, expectedRows] of [[0, 1], [-5, 1], [6, 6], [75, 60]]) {
  const bangle = sizingSheet.addBangle(inputRows, -1);
  if (bangle.rows !== expectedRows) throw new Error(`Expected ${inputRows} rows to normalize to ${expectedRows}`);
  if (bangle.data.length !== expectedRows * sizingSheet.stonesPerRow) {
    throw new Error(`Bangle data length does not match its ${expectedRows} rows`);
  }
  sizingSheet.deleteBangle(sizingSheet.bangles.length - 1);
}
console.log('Bangle row normalization and buffer sizing verified');

// 0b. Hex line drawing must preview immediately and follow an adjacent-cell path
const lineSheet = new BangleSheet('2.4');
lineSheet.addBangle(60, -1);
const lineRenderer = { previewStones: [], screenToWorld: (x, y) => ({ x, y }) };
const lineEditor = new EditorController(lineSheet, lineRenderer);
lineEditor.performAutosave = () => {}; // This unit check has no browser localStorage.
lineEditor.activeTool = 'line';
const lineStart = lineSheet.getStonePosition(0, 2, 5);
const lineEnd = lineSheet.getStonePosition(0, 15, 18);
lineEditor.handlePointerDown(lineStart.x, lineStart.y);
if (lineRenderer.previewStones.length !== 1) throw new Error('Line preview should include its start cell immediately');
lineEditor.handlePointerMove(lineEnd.x, lineEnd.y);
const linePreview = [...lineRenderer.previewStones];
const toCube = ({ row, col }) => ({ x: col - (row - (row & 1)) / 2, z: row });
for (let i = 1; i < linePreview.length; i++) {
  const a = toCube(linePreview[i - 1]);
  const b = toCube(linePreview[i]);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dy = -dx - dz;
  if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) > 1) throw new Error('Line path contains a gap on the hex grid');
}
lineEditor.handlePointerMove(-100, -100); // leaving the bangle keeps the last valid endpoint
if (lineRenderer.previewStones.length !== linePreview.length) throw new Error('Line preview changed after pointer left the bangle');
lineEditor.handlePointerUp();
clearTimeout(lineEditor.autosaveTimer);
if (!linePreview.every(({ row, col }) => lineSheet.getStone(0, row, col) === lineEditor.activeColor)) {
  throw new Error('Committed line differs from its preview');
}
console.log(`Hex line continuity and preview commit verified (${linePreview.length} cells)`);

// 0c. Motif transforms preserve the matrix pattern while rotating/flipping its placement
const stampEditor = new EditorController(new BangleSheet('2.4'), {});
stampEditor.performAutosave = () => {};
clearTimeout(stampEditor.autosaveTimer);
stampEditor.activeColor = STONE_CELL.GREEN;
const stampPositions = [];
stampEditor.applyStoneWithSymmetry = (bangleIndex, row, col, value) => stampPositions.push([row, col, value]);
const asymmetricStamp = { generate: () => [[1, 2, 3], [4, null, 5]] };
const collectStamp = () => { stampPositions.length = 0; stampEditor.applyStampAt(0, 10, 10, asymmetricStamp); return stampPositions.map(([r, c, v]) => [r - 10, c - 10, v]); };
const sortedStamp = values => values.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
stampEditor.rotateMotif();
const rotatedStamp = sortedStamp(collectStamp());
if (JSON.stringify(rotatedStamp) !== JSON.stringify([[-1, -1, 4], [-1, 0, 1], [0, 0, 2], [1, -1, 5], [1, 0, 3]])) {
  throw new Error('Stamp rotation did not rotate a rectangular motif clockwise');
}
stampEditor.resetMotifTransform();
stampEditor.flipMotifHorizontal();
const flippedStamp = sortedStamp(collectStamp());
if (JSON.stringify(flippedStamp) !== JSON.stringify([[-1, -1, 3], [-1, 0, 2], [-1, 1, 1], [0, -1, 5], [0, 1, 4]])) {
  throw new Error('Horizontal stamp flip did not mirror its pattern');
}
stampEditor.resetMotifTransform();
stampEditor.flipMotifVertical();
const verticalStamp = sortedStamp(collectStamp());
if (JSON.stringify(verticalStamp) !== JSON.stringify([[-1, -1, 4], [-1, 1, 5], [0, -1, 1], [0, 0, 2], [0, 1, 3]])) {
  throw new Error('Vertical stamp flip did not mirror its pattern');
}
stampEditor.resetMotifTransform();
if (stampEditor.motifRotation !== 0 || stampEditor.motifFlipX || stampEditor.motifFlipY) throw new Error('Stamp reset did not clear orientation');
console.log('Motif rotation, horizontal/vertical flips, and reset verified');

// 0c. Feather stamps must expose valid decorative matrices
const featherMotifs = MOTIF_STAMPS.filter(({ id }) => id.includes('feather'));
if (featherMotifs.length < 3) throw new Error('Expected at least three feather motifs');
for (const motif of featherMotifs) {
  const matrix = motif.generate();
  if (matrix.length !== motif.heightRows || matrix.some(row => row.length !== motif.widthStones)) {
    throw new Error(`Motif ${motif.id} dimensions do not match its metadata`);
  }
  if (!matrix.some(row => row.some(cell => cell !== null))) throw new Error(`Motif ${motif.id} is empty`);
}
console.log(`Feather motif matrices verified (${featherMotifs.length} motifs)`);

// 0d. Fresh projects are blank and Brass OK lookup matches all supplied values
const blankSheet = createBlankSheet('2.4', 24);
if (blankSheet.bangles.length !== 1 || blankSheet.bangles[0].rows !== 24 || blankSheet.getSheetStoneCounts().totalFilled !== 0) {
  throw new Error('Fresh design sheet must start as one empty 24-row band');
}
const brassProducts = Object.keys(BRASS_OK_LENGTHS_MM);
const brassCodes = ['2/4', '2/6', '2/8', '2/10'];
for (const product of brassProducts) {
  brassCodes.forEach((sizeCode, index) => {
    if (getBrassOkLength(product, sizeCode) !== BRASS_OK_LENGTHS_MM[product][index]) {
      throw new Error(`Brass OK lookup mismatch for ${product} ${sizeCode}`);
    }
  });
}
if (getBrassOkLength('UNKNOWN', '2/4') !== null || getGridSizeKey('2/10') !== '2.10' || getGridSizeKey('invalid') !== null) {
  throw new Error('Brass size lookup validation failed');
}
console.log('Blank start and all 16 Brass OK measurements verified');

// 0e. Repeat motif tiles the selected band and can be undone as one edit
const repeatSheet = createBlankSheet('2.4', 24);
const repeatEditor = new EditorController(repeatSheet, {});
repeatEditor.performAutosave = () => {};
clearTimeout(repeatEditor.autosaveTimer);
const tileMotif = { generate: () => [[1, null], [2, 3]] };
if (!repeatEditor.repeatMotifAcrossBangle(0, tileMotif)) throw new Error('Repeat motif action was not applied');
clearTimeout(repeatEditor.autosaveTimer);
const repeatedCounts = repeatEditor.sheet.getSheetStoneCounts();
if (repeatedCounts.totalFilled === 0 || repeatEditor.sheet.bangles[0].data.filter(value => value !== STONE_CELL.EMPTY).length !== repeatedCounts.totalFilled) {
  throw new Error('Repeat motif did not place a full band of motif stones');
}
if (!repeatEditor.undo() || repeatEditor.sheet.getSheetStoneCounts().totalFilled !== 0) throw new Error('Repeated motif should undo as one action');
clearTimeout(repeatEditor.autosaveTimer);
console.log('Motif tiling across the bangle and single-step undo verified');

// 0d. Reference tracing supports sheet-width / usable-height mapping
let referenceDrawArgs = null;
const referenceContext = { save() {}, restore() {}, drawImage(...args) { referenceDrawArgs = args; } };
const referenceRenderer = new CanvasRenderer({ getContext: () => referenceContext });
referenceRenderer.zoom = 1;
referenceRenderer.panX = 0;
referenceRenderer.panY = 0;
referenceRenderer.referenceImage = { complete: true, naturalWidth: 1024, naturalHeight: 667 };
referenceRenderer.referenceConfig = {
  visible: true, opacity: 0.5, xMm: 0, yMm: USABLE_Y_MIN_MM,
  widthMm: SHEET_WIDTH_MM, heightMm: USABLE_HEIGHT_MM
};
referenceRenderer.drawReferenceImage(referenceContext);
if (referenceDrawArgs?.[3] !== SHEET_WIDTH_MM || referenceDrawArgs?.[4] !== USABLE_HEIGHT_MM) {
  throw new Error('Reference image did not fit the requested usable sheet bounds');
}
referenceRenderer.referenceConfig.heightMm = null;
referenceRenderer.drawReferenceImage(referenceContext);
if (Math.abs(referenceDrawArgs[4] - SHEET_WIDTH_MM * 667 / 1024) > 0.001) {
  throw new Error('Reference image aspect-ratio fallback changed unexpectedly');
}
console.log('Reference image usable-area sizing and aspect fallback verified');

// 0e. Ruby sample colors must survive counting, JSON, CNC and SVG exports
const rubySheet = createRubyBloomSheet('2.4');
const rubyCounts = rubySheet.getSheetStoneCounts();
if (rubySheet.bangles.length !== 1 || rubySheet.bangles[0].rows !== 24 || rubyCounts[STONE_CELL.RUBY] === 0) {
  throw new Error('Ruby lattice sample is missing its expected band or ruby stones');
}
const rubyRoundTrip = BangleSheet.fromJSON(rubySheet.toJSON());
if (rubyRoundTrip.getSheetStoneCounts()[STONE_CELL.RUBY] !== rubyCounts[STONE_CELL.RUBY]) {
  throw new Error('Ruby stones were not preserved in project JSON');
}
const rubyHoles = collectSheetHoles(rubySheet, STONE_CELL.RUBY);
const rubyGcode = generateGcodeForHoles(rubyHoles);
const rubySvg = generateSvgForCorelDraw(rubySheet);
if (!rubyGcode || !rubySvg.includes('id="B01_Ruby_2.4"') || !rubySvg.includes('fill="#9F1239"')) {
  throw new Error('Ruby drill or SVG export is missing');
}
const rubySheetZip = await JSZip.loadAsync(await exportSheetZip(rubySheet));
const rubyBangleZip = await JSZip.loadAsync(await exportBanglesZip(rubySheet));
if (!rubySheetZip.file('SHEET_Ruby_2.4.tap') || !rubyBangleZip.file('B01_Ruby_2.4.tap')) {
  throw new Error('Ruby drill file is missing from a ZIP export');
}
if (SAMPLE_PRESETS.length !== 0) throw new Error('Sample gallery should be empty as requested');
console.log(`Ruby sample counts, JSON round-trip, and CNC/SVG/ZIP exports verified (${rubyHoles.length} ruby holes)`);

// 1. Create sample sheet
const sheet = createSampleSheet('2.4');
console.log(`Bangles count: ${sheet.bangles.length} (Expected: 18)`);
console.log(`Total rows: ${sheet.totalRowCount} (Expected: 172)`);
console.log(`Total design height: ${sheet.getTotalDesignHeight().toFixed(3)} mm (Limit: ${USABLE_HEIGHT_MM} mm)`);

if (sheet.bangles.length !== 18) throw new Error('Expected 18 bangles');
if (sheet.totalRowCount !== 172) throw new Error('Expected 172 rows');
if (sheet.isHeightExceeded()) throw new Error('Height exceeded!');

// 2. Test Sunflower cutout empty areas in Bangles 4 and 15
const b4 = sheet.bangles[3]; // 0-indexed 3 is B04
const b15 = sheet.bangles[14]; // 0-indexed 14 is B15

let b4EmptyCount = 0;
for (let i = 0; i < b4.data.length; i++) {
  if (b4.data[i] === STONE_CELL.EMPTY) b4EmptyCount++;
}
console.log(`B04 Sunflower empty cutout holes: ${b4EmptyCount}`);
if (b4EmptyCount === 0) throw new Error('B04 should have empty holes for hand-set sunflowers');

// 3. Test G-code generator for B04 Gold
const b4GoldHoles = collectBangleHoles(sheet, 3, STONE_CELL.GOLD);
console.log(`B04 Gold holes count: ${b4GoldHoles.length}`);
const b4GoldGcode = generateGcodeForHoles(b4GoldHoles);

// Verify CRLF line endings
if (!b4GoldGcode.includes('\r\n')) throw new Error('G-code must use CRLF');

// Verify header
const headerCheck = b4GoldGcode.startsWith('T1M6\r\nG0Z3.000\r\nG0X0.000Y0.000S15000M3\r\n');
console.log('Header matches exact spec:', headerCheck);
if (!headerCheck) throw new Error('Header does not match specification');

// Verify footer
const footerCheck = b4GoldGcode.endsWith('G0X0.000Y0.000\r\nG0Z3.000\r\nG0X0Y0\r\nM30\r\n');
console.log('Footer matches exact spec:', footerCheck);
if (!footerCheck) throw new Error('Footer does not match specification');

// Verify first hole has Z3.000
const lines = b4GoldGcode.split('\r\n');
const firstMove = lines[3];
console.log('First hole move line:', firstMove);
if (!firstMove.endsWith('Z3.000')) throw new Error('First hole must have Z3.000');

// Verify drill cycle
if (lines[4] !== 'G0Z2.000' || lines[5] !== 'G1Z-2.000F3000.0' || lines[6] !== 'G0Z3.000') {
  throw new Error('Drill plunge cycle mismatch');
}
console.log('Drill cycle verified: G0Z2.000, G1Z-2.000F3000.0, G0Z3.000');

// 4. Test RLE serialization & deserialization
const jsonOutput = sheet.toJSON();
const jsonStr = JSON.stringify(jsonOutput);
const roundTripped = BangleSheet.fromJSON(JSON.parse(jsonStr));
if (roundTripped.bangles.length !== sheet.bangles.length || roundTripped.totalRowCount !== sheet.totalRowCount) {
  throw new Error('Project JSON round-trip mismatch');
}
console.log('Project JSON round-trip verified (size:', jsonStr.length, 'bytes)');

// 5. Test SVG generation
const svg = generateSvgForCorelDraw(sheet);
if (!svg.includes('width="300mm"') || !svg.includes('height="300mm"')) {
  throw new Error('SVG dimensions mismatch');
}
if (!svg.includes('id="B04"')) {
  throw new Error('SVG missing B04 group');
}
console.log('SVG verified for CorelDRAW 300x300mm');

// 6. Hand-set stone acceptance: mask, restore, geometry, history, persistence, and exports.
const handSheet = new BangleSheet('2.4'); handSheet.addBangle(24, -1); handSheet.fillBangle(0, STONE_CELL.GOLD);
const beforeMask = handSheet.getBangleStoneCounts(0).totalFilled;
const anchor = handSheet.getStonePosition(0, 12, 65);
const triangleOriginalX = anchor.x;
const triangle = handSheet.addShape({ type: HAND_SET_STONE_TYPES.TRIANGLE, x: anchor.x, y: anchor.y });
const afterMask = handSheet.getBangleStoneCounts(0).totalFilled;
if (afterMask >= beforeMask || handSheet.isHoleBlocked(anchor.x, anchor.y) !== true) throw new Error('Hand-set triangle did not mask filled hole positions');
const maskedTap = collectBangleHoles(handSheet, 0, STONE_CELL.GOLD);
if (maskedTap.some(p => handSheet.isHoleBlocked(p.x, p.y))) throw new Error('TAP hole collector included a blocked position');
handSheet.updateShape(triangle.id, { x: triangleOriginalX + 500 });
const restoredMask = handSheet.getBangleStoneCounts(0).totalFilled;
if (restoredMask !== beforeMask) throw new Error('Moving a hand-set stone did not restore holes beneath its old position');
handSheet.updateShape(triangle.id, { x: triangleOriginalX });
const pearPoly = getStoneLocalPolygon(HAND_SET_STONE_TYPES.PEAR, 12, 6);
const pearBox = { minX: Math.min(...pearPoly.map(p => p.x)), maxX: Math.max(...pearPoly.map(p => p.x)), minY: Math.min(...pearPoly.map(p => p.y)), maxY: Math.max(...pearPoly.map(p => p.y)) };
if (Math.abs(pearBox.maxX - pearBox.minX - 12) > 1e-8 || Math.abs(pearBox.maxY - pearBox.minY - 6) > 1e-8) throw new Error('Pear local bounding box is not exactly 12 × 6 mm');
const rectangle = handSheet.addShape({ type: HAND_SET_STONE_TYPES.RECTANGLE, x: 80, y: 100 });
const rect0 = getShapeBoundingBox(rectangle);
handSheet.updateShape(rectangle.id, { rotation: 90 });
const rect90 = getShapeBoundingBox(rectangle);
if (Math.abs(rect0.width - rect90.height) > 1e-6 || Math.abs(rect0.height - rect90.width) > 1e-6) throw new Error('Rectangle 90° rotation did not swap canvas bounds');
handSheet.stoneSizes[HAND_SET_STONE_TYPES.PEAR] = { length: 12, width: 6 };
handSheet.clearanceMm = 1.1;
const handReload = BangleSheet.fromJSON(JSON.parse(JSON.stringify(handSheet.toJSON())));
if (handReload.shapes.length !== 2 || handReload.clearanceMm !== 1.1 || handReload.stoneSizes.Pear.length !== 12 || handReload.allowStoneResizing !== false) throw new Error('Hand-set settings or default locked sizing did not survive JSON round trip');
const legacyHandReload = BangleSheet.fromJSON({ size: '2.4', bangles: [{ rows: 1, rle: '01' }] });
if (legacyHandReload.shapes.length !== 0 || legacyHandReload.allowStoneResizing !== false) throw new Error('Legacy project without shapes failed to open with locked sizing');
handSheet.allowStoneResizing = true;
if (!handSheet.clone().allowStoneResizing || !BangleSheet.fromJSON(handSheet.toJSON()).allowStoneResizing) throw new Error('Enabled stone resizing did not survive clone/JSON persistence');
const svgWithStones = generateSvgForCorelDraw(handSheet);
if (!svgWithStones.includes('id="HandSet_Stones"') || !svgWithStones.includes('HandSet_1_Triangle')) throw new Error('SVG missing hand-set stone group/path');
const noShapeOneHole = new BangleSheet('2.4'); noShapeOneHole.addBangle(1, -1); noShapeOneHole.setStone(0, 0, 0, STONE_CELL.GOLD);
const noShapeTap = generateGcodeForHoles(collectSheetHoles(noShapeOneHole, STONE_CELL.GOLD));
const expectedNoShapeTap = 'T1M6\r\nG0Z3.000\r\nG0X0.000Y0.000S15000M3\r\nG0X39.925Y13.815Z3.000\r\nG0Z2.000\r\nG1Z-2.000F3000.0\r\nG0Z3.000\r\nG0X0.000Y0.000\r\nG0Z3.000\r\nG0X0Y0\r\nM30\r\n';
// Pin the legacy no-mask output bytes by comparing the exporter to its exact format for this fixture.
if (noShapeTap !== expectedNoShapeTap) throw new Error('No-shape TAP output changed from the legacy byte sequence');

const historySheet = new BangleSheet('2.4'); historySheet.addBangle(4, -1);
const historyEditor = new EditorController(historySheet, { previewStones: [], screenToWorld: (x, y) => ({ x, y }) }); historyEditor.performAutosave = () => {};
const histShape = historyEditor.placeHandSetStone(HAND_SET_STONE_TYPES.DIAMOND, 100, 100);
if (!historyEditor.undo() || historyEditor.sheet.shapes.length !== 0 || !historyEditor.redo() || historyEditor.sheet.shapes.length !== 1) throw new Error('Hand-set place undo/redo failed');
historyEditor.sheet.selectedShapeId = historyEditor.sheet.shapes[0].id;
const lockedLength = historyEditor.sheet.shapes[0].length;
if (historyEditor.updateSelectedShape({ length: lockedLength + 2 }) || historyEditor.sheet.shapes[0].length !== lockedLength) throw new Error('Locked stone dimensions accepted a direct size update');
const lockedX = historyEditor.sheet.shapes[0].x, lockedRotation = historyEditor.sheet.shapes[0].rotation;
if (!historyEditor.updateSelectedShape({ x: lockedX + 2 }) || !historyEditor.updateSelectedShape({ rotation: lockedRotation + 15 }) || historyEditor.sheet.shapes[0].x !== lockedX + 2 || historyEditor.sheet.shapes[0].rotation !== lockedRotation + 15) throw new Error('Moving or rotating a locked-size stone was disabled');
historyEditor.saveSnapshot(); historyEditor.sheet.allowStoneResizing = true; historyEditor.saveSnapshot();
if (!historyEditor.undo() || historyEditor.sheet.allowStoneResizing || !historyEditor.redo() || !historyEditor.sheet.allowStoneResizing) throw new Error('Stone resize switch undo/redo failed');
const oldX = historyEditor.sheet.shapes[0].x; historyEditor.updateSelectedShape({ x: oldX + 5 });
if (!historyEditor.undo() || historyEditor.sheet.shapes[0].x !== oldX || !historyEditor.redo() || historyEditor.sheet.shapes[0].x !== oldX + 5) throw new Error('Hand-set move undo/redo failed');
historyEditor.updateSelectedShape({ length: 14 });
if (!historyEditor.undo() || historyEditor.sheet.shapes[0].length === 14 || !historyEditor.redo() || historyEditor.sheet.shapes[0].length !== 14) throw new Error('Hand-set resize undo/redo failed');
historyEditor.updateSelectedShape({ rotation: 45 });
if (!historyEditor.undo() || historyEditor.sheet.shapes[0].rotation === 45 || !historyEditor.redo() || historyEditor.sheet.shapes[0].rotation !== 45) throw new Error('Hand-set rotate undo/redo failed');
historyEditor.deleteSelectedShape();
if (!historyEditor.undo() || historyEditor.sheet.shapes.length !== 1 || !historyEditor.redo() || historyEditor.sheet.shapes.length !== 0) throw new Error('Hand-set delete undo/redo failed');
historyEditor.saveSnapshot(); historyEditor.sheet.stoneSizes.Pear.length = 12; historyEditor.saveSnapshot();
if (!historyEditor.undo() || historyEditor.sheet.stoneSizes.Pear.length === 12 || !historyEditor.redo() || historyEditor.sheet.stoneSizes.Pear.length !== 12) throw new Error('Hand-set size settings undo/redo failed');
historyEditor.saveSnapshot(); historyEditor.sheet.clearanceMm = 1.2; historyEditor.saveSnapshot();
if (!historyEditor.undo() || historyEditor.sheet.clearanceMm === 1.2 || !historyEditor.redo() || historyEditor.sheet.clearanceMm !== 1.2) throw new Error('Hand-set clearance undo/redo failed');
clearTimeout(historyEditor.autosaveTimer);
console.log(`Hand-set acceptance verified: mask ${beforeMask}→${afterMask}→${restoredMask}, TAP/SVG masks, pear bounds, 90° rotation, JSON/legacy, resize lock/persistence, and undo/redo`);

// 6. The preset gallery is intentionally empty; designs start blank.
import('./src/sampleDesign.js').then(({ SAMPLE_PRESETS }) => {
  if (SAMPLE_PRESETS.length !== 0) throw new Error('Preset registry must remain empty');
  console.log('Sample preset registry is empty');
  console.log('--- ALL BACKEND/FORMAT & DESIGN WORKFLOW TESTS PASSED! ---');
});
