// OrnaCAD - Main Application Entrypoint
// Comprehensive CAD Engine for Hexagonal Zircon Jewellery Drilling

import './style.css';
import {
  BANGLE_SIZES,
  STONE_CELL,
  STONE_COLORS,
  TOOL_TYPES,
  BRUSH_SIZES,
  SHEET_WIDTH_MM,
  USABLE_Y_MIN_MM,
  USABLE_HEIGHT_MM,
  DEFAULT_GAP_MM
} from './constants.js';
import { BangleSheet, createBlankSheet } from './models/BangleSheet.js';
import { CanvasRenderer } from './renderer/CanvasRenderer.js';
import { EditorController } from './editor/EditorController.js';
import { MOTIF_STAMPS } from './sampleDesign.js';
import { getBrassOkLength, getGridSizeKey } from './brassSizes.js';
import { HAND_SET_STONE_TYPES, getStoneLocalPolygon } from './models/HandSetShape.js';
import {
  exportSheetZip,
  exportBanglesZip,
  estimateDrillTime,
  formatBangleId,
  downloadSingleTap
} from './gcode/gcodeExporter.js';
import { downloadSvgFile } from './export/svgExporter.js';
import { downloadSheetPng } from './export/pngExporter.js';

// DOM Element References
const canvasEl = document.getElementById('bangle-canvas');
const viewportEl = document.getElementById('viewport-container');
const sizeSelect = document.getElementById('size-select');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const autosaveText = document.getElementById('autosave-text');

// Floating HUD Elements
const hudXMm = document.getElementById('hud-x-mm');
const hudYMm = document.getElementById('hud-y-mm');
const hudBangleInfo = document.getElementById('hud-bangle-info');
const hudCellInfo = document.getElementById('hud-cell-info');
const hudZoomLevel = document.getElementById('hud-zoom-level');
const btnFitSheet = document.getElementById('btn-fit-sheet');
const btnFitBangle = document.getElementById('btn-fit-bangle');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');

// Layout Tab Elements
const heightMeterVal = document.getElementById('height-meter-val');
const heightMeterBar = document.getElementById('height-meter-bar');
const heightAlertBox = document.getElementById('height-alert-box');
const gapSlider = document.getElementById('gap-slider');
const gapInput = document.getElementById('gap-input');
const gapDisplayVal = document.getElementById('gap-display-val');
const btnSpreadGaps = document.getElementById('btn-spread-gaps');
const banglesListEl = document.getElementById('bangle-list');
const banglesCountTag = document.getElementById('bangles-count-tag');
const btnAddBangle = document.getElementById('btn-add-bangle');

// Symmetry & Actions
const chkMirrorLR = document.getElementById('chk-mirror-lr');
const chkMirrorTB = document.getElementById('chk-mirror-tb');
const btnCopyLRSel = document.getElementById('btn-copy-lr-sel');
const btnCopyRLSel = document.getElementById('btn-copy-rl-sel');
const btnCopyLRAll = document.getElementById('btn-copy-lr-all');
const btnCopyRLAll = document.getElementById('btn-copy-rl-all');
const btnFillBangle = document.getElementById('btn-fill-bangle');
const btnClearBangle = document.getElementById('btn-clear-bangle');

// Count Elements
const countSelGreen = document.getElementById('count-sel-green');
const countSelWhite = document.getElementById('count-sel-white');
const countSelGold = document.getElementById('count-sel-gold');
const countSelRuby = document.getElementById('count-sel-ruby');
const countSelTotal = document.getElementById('count-sel-total');
const countSheetGreen = document.getElementById('count-sheet-green');
const countSheetWhite = document.getElementById('count-sheet-white');
const countSheetGold = document.getElementById('count-sheet-gold');
const countSheetRuby = document.getElementById('count-sheet-ruby');
const countSheetTotal = document.getElementById('count-sheet-total');

// Brush & Tools
const brushSizeBtn = document.getElementById('btn-brush-size');
const brushSizeLabel = document.getElementById('brush-size-label');

// Tracing Tab Elements
const traceFileInput = document.getElementById('trace-file-input');
const btnUploadTrace = document.getElementById('btn-upload-trace');
const traceControls = document.getElementById('trace-controls');
const traceVisibleChk = document.getElementById('trace-visible');
const traceOpacitySlider = document.getElementById('trace-opacity');
const traceOpacityVal = document.getElementById('trace-opacity-val');
const traceWidthInput = document.getElementById('trace-width');
const traceHeightInput = document.getElementById('trace-height');
const traceXInput = document.getElementById('trace-x');
const traceYInput = document.getElementById('trace-y');
const btnResetTrace = document.getElementById('btn-reset-trace');
const btnRemoveTrace = document.getElementById('btn-remove-trace');
const stoneOpacitySlider = document.getElementById('stone-opacity-slider');
const stoneOpacityVal = document.getElementById('stone-opacity-val');
const chkEmptyDots = document.getElementById('chk-empty-dots');

// Motifs Tab
const motifsContainer = document.getElementById('motifs-container');
const motifRotateButton = document.getElementById('motif-rotate');
const motifFlipXButton = document.getElementById('motif-flip-x');
const motifFlipYButton = document.getElementById('motif-flip-y');
const motifResetButton = document.getElementById('motif-reset');
const motifOrientation = document.getElementById('motif-orientation');
const btnRepeatMotif = document.getElementById('btn-repeat-motif');
const handSetLibrary = document.getElementById('handset-library');
const stoneSizesTable = document.getElementById('stone-sizes-table');
const allowStoneResize = document.getElementById('allow-stone-resize');
const snapStoneCenters = document.getElementById('snap-stone-centers');
const snapStoneRotation = document.getElementById('snap-stone-rotation');
const stoneClearance = document.getElementById('stone-clearance');
const shapeFieldIds = ['shape-x', 'shape-y', 'shape-length', 'shape-width', 'shape-rotation'];

// Export Tab Elements
const btnExportSheetZip = document.getElementById('btn-export-sheet-zip');
const btnExportBanglesZip = document.getElementById('btn-export-bangles-zip');
const btnExportSvg = document.getElementById('btn-export-svg');
const btnSaveJson = document.getElementById('btn-save-json');
const loadJsonInput = document.getElementById('load-json-input');
const btnLoadJson = document.getElementById('btn-load-json');
const bomDrillTime = document.getElementById('bom-drill-time');
const bomGrossUnits = document.getElementById('bom-gross-units');

// Modal Elements
const modalContainer = document.getElementById('modal-container');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalBtnKeep = document.getElementById('modal-btn-keep');
const modalBtnBlank = document.getElementById('modal-btn-blank');

// Download Center & Prominent Export Elements
const btnHeaderDownload = document.getElementById('btn-header-download');
const downloadModalContainer = document.getElementById('download-modal-container');
const btnCloseDownloadModal = document.getElementById('btn-close-download-modal');

const btnNewDesign = document.getElementById('btn-new-design');
const brassProductSelect = document.getElementById('brass-product-select');
const brassSizeSelect = document.getElementById('brass-size-select');
const brassLengthValue = document.getElementById('brass-length-value');
const btnUseBrassGrid = document.getElementById('btn-use-brass-grid');
const mobileMenuButton = document.getElementById('btn-mobile-menu');
const mobileMenuIcon = document.getElementById('mobile-menu-icon');
const mobileMenuLabel = document.getElementById('mobile-menu-label');
const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');
const mobileSidebar = document.getElementById('mobile-sidebar');
const orientationAssist = document.getElementById('orientation-assist');
const orientationMessage = document.getElementById('orientation-message');
const orientationLockButton = document.getElementById('orientation-lock');
const orientationDismissButton = document.getElementById('orientation-dismiss');

// Quick Download Buttons (Layout tab)
const btnQuickPng = document.getElementById('btn-quick-png');
const btnQuickTap = document.getElementById('btn-quick-tap');
const btnQuickSheetZip = document.getElementById('btn-quick-sheet-zip');
const btnQuickSvg = document.getElementById('btn-quick-svg');

// Export Tab Download Elements
const btnExportPng = document.getElementById('btn-export-png');
const btnTapSheetGold = document.getElementById('btn-tap-sheet-gold');
const btnTapSheetWhite = document.getElementById('btn-tap-sheet-white');
const btnTapSheetGreen = document.getElementById('btn-tap-sheet-green');
const btnTapSheetRuby = document.getElementById('btn-tap-sheet-ruby');
const btnTapSelBangle = document.getElementById('btn-tap-sel-bangle');

// Download Modal Buttons
const modalBtnDownloadPng = document.getElementById('modal-btn-download-png');
const modalBtnTapGold = document.getElementById('modal-btn-tap-gold');
const modalBtnTapWhite = document.getElementById('modal-btn-tap-white');
const modalBtnTapGreen = document.getElementById('modal-btn-tap-green');
const modalBtnTapRuby = document.getElementById('modal-btn-tap-ruby');
const modalBtnTapSel = document.getElementById('modal-btn-tap-sel');
const modalBtnZipSheet = document.getElementById('modal-btn-zip-sheet');
const modalBtnZipBangles = document.getElementById('modal-btn-zip-bangles');
const modalBtnDownloadSvg = document.getElementById('modal-btn-download-svg');
const modalBtnDownloadJson = document.getElementById('modal-btn-download-json');

// Initialize State
let sheet = null;
const renderer = new CanvasRenderer(canvasEl);
let editor = null;

// Space key panning tracker
let isSpacePressed = false;
let pendingSizeChange = null;

// Touch tracking for pinch-zoom
let touchStartDist = 0;
let touchStartZoom = 1;
let orientationAssistDismissed = false;

const mobileWorkspaceQuery = window.matchMedia('(max-width: 860px)');
const touchDeviceQuery = window.matchMedia('(pointer: coarse)');
const portraitQuery = window.matchMedia('(orientation: portrait)');

function updateOrientationAssist() {
  const show = mobileWorkspaceQuery.matches && touchDeviceQuery.matches && portraitQuery.matches && !orientationAssistDismissed;
  const wasHidden = orientationAssist.hidden;
  orientationAssist.hidden = !show;
  document.getElementById('app').inert = show;
  if (show && wasHidden) orientationLockButton.focus();
  if (!show && !wasHidden && orientationAssist.contains(document.activeElement)) canvasEl.focus();
}

async function requestLandscapeMode() {
  let enteredFullscreen = false;
  try {
    if (!screen.orientation || typeof screen.orientation.lock !== 'function') {
      throw new Error('Orientation lock is unavailable in this browser. Rotate your device to landscape.');
    }
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      enteredFullscreen = Boolean(document.fullscreenElement);
    }
    await screen.orientation.lock('landscape');
  } catch (error) {
    if (enteredFullscreen && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (_) {}
    }
    orientationMessage.textContent = error.message?.includes('unavailable')
      ? error.message
      : 'This browser could not rotate automatically. Turn your device sideways and make sure auto-rotate is enabled.';
  }
  updateOrientationAssist();
}

async function initializeDeviceOrientation() {
  // Installed apps can honor the landscape manifest orientation at launch.
  // Try the runtime lock as well; browsers that require a user gesture will reject harmlessly.
  if (touchDeviceQuery.matches) {
    try { await screen.orientation?.lock?.('landscape'); } catch (_) {}
  }
  updateOrientationAssist();
}

orientationLockButton.addEventListener('click', requestLandscapeMode);
orientationDismissButton.addEventListener('click', () => {
  orientationAssistDismissed = true;
  updateOrientationAssist();
});
orientationAssist.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    orientationAssistDismissed = true;
    updateOrientationAssist();
    return;
  }
  if (event.key === 'Tab') {
    const focusable = [orientationLockButton, orientationDismissButton];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
mobileWorkspaceQuery.addEventListener('change', updateOrientationAssist);
portraitQuery.addEventListener('change', updateOrientationAssist);
window.addEventListener('resize', updateOrientationAssist);

function setMobileMenuOpen(open) {
  const isMobile = mobileWorkspaceQuery.matches;
  const shouldOpen = Boolean(open && isMobile);
  document.getElementById('app').classList.toggle('mobile-menu-open', shouldOpen);
  mobileMenuButton.setAttribute('aria-expanded', String(shouldOpen));
  mobileMenuButton.setAttribute('aria-label', shouldOpen ? 'Hide sidebar' : 'Show sidebar');
  mobileMenuButton.title = shouldOpen ? 'Hide sidebar' : 'Show sidebar';
  mobileMenuIcon.textContent = shouldOpen ? '×' : '☰';
  mobileMenuLabel.textContent = shouldOpen ? 'Hide' : 'Menu';
  mobileSidebar.setAttribute('aria-hidden', String(isMobile && !shouldOpen));
  if (shouldOpen) mobileSidebar.querySelector('.tab-btn')?.focus();
  else if (isMobile) mobileMenuButton.focus();
}

mobileMenuButton.addEventListener('click', () => setMobileMenuOpen(mobileMenuButton.getAttribute('aria-expanded') !== 'true'));
mobileMenuBackdrop.addEventListener('click', () => setMobileMenuOpen(false));
mobileSidebar.addEventListener('keydown', event => {
  if (event.key === 'Escape') setMobileMenuOpen(false);
});
mobileWorkspaceQuery.addEventListener('change', event => {
  if (!event.matches) setMobileMenuOpen(false);
});
mobileSidebar.setAttribute('aria-hidden', String(mobileWorkspaceQuery.matches));

function initializeApp() {
  // Restore a saved project, or begin with one empty 24-row design band.
  let loadedSheet = null;
  try {
    const saved = localStorage.getItem('bangle_stone_editor_autosave');
    if (saved) {
      const parsed = JSON.parse(saved);
      loadedSheet = BangleSheet.fromJSON(parsed);
    }
  } catch (err) {
    console.warn('Could not restore autosave, starting a blank design:', err);
  }

  if (!loadedSheet) {
    loadedSheet = createBlankSheet('2.4', 24);
  }

  sheet = loadedSheet;
  editor = new EditorController(sheet, renderer);

  // Bind callbacks
  editor.onAutosaveCallback = (success, timeStr) => {
    if (success) {
      autosaveText.textContent = `Autosaved ${timeStr}`;
    } else {
      autosaveText.textContent = 'Save error';
    }
  };

  editor.onHistoryChangeCallback = (canUndo, canRedo) => {
    btnUndo.disabled = !canUndo;
    btnRedo.disabled = !canRedo;
  };

  editor.onCountsChangeCallback = () => {
    updateCountsAndMeter();
  };

  // Setup Theme
  initTheme();

  // Setup Canvas Sizing
  handleResize();
  window.addEventListener('resize', handleResize);

  // Fit sheet initial view
  setTimeout(() => {
    renderer.fitBangle(sheet.selectedBangleIndex, sheet);
    updateHUD();
  }, 50);

  // Populate UI Lists
  renderBangleList();
  renderMotifsList();
  updateCountsAndMeter();
  syncControlsFromState();

  // Setup All Event Listeners
  setupEventListeners();

  // Start Animation Loop
  startRenderLoop();
}

function handleResize() {
  const rect = viewportEl.getBoundingClientRect();
  renderer.resize(rect.width, rect.height);
}

function startRenderLoop() {
  function loop() {
    renderer.render(editor.sheet);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// --- UI Sync & Renders ---

function syncControlsFromState() {
  sizeSelect.value = editor.sheet.sizeKey;
  gapSlider.value = editor.sheet.gap;
  gapInput.value = editor.sheet.gap;
  gapDisplayVal.textContent = `${editor.sheet.gap.toFixed(3)} mm`;

  chkMirrorLR.checked = editor.mirrorLR;
  chkMirrorTB.checked = editor.mirrorTB;
  renderer.mirrorLR = editor.mirrorLR;
  renderer.mirrorTB = editor.mirrorTB;

  brushSizeLabel.textContent = `${editor.brushSize} st`;
  snapStoneCenters.checked = editor.snapStoneCenters;
  snapStoneRotation.checked = editor.snapStoneRotation;
  allowStoneResize.checked = editor.sheet.allowStoneResizing;
  allowStoneResize.setAttribute('aria-checked', String(allowStoneResize.checked));
  stoneClearance.value = editor.sheet.clearanceMm;
  renderHandSetLibrary();
  renderStoneProperties();
}

function renderHandSetLibrary() {
  handSetLibrary.innerHTML = '';
  Object.values(HAND_SET_STONE_TYPES).forEach(type => {
    const size = editor.sheet.stoneSizes[type];
    const pts = getStoneLocalPolygon(type, size.length, size.width);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${(60 + p.x * 5).toFixed(1)} ${(32 + p.y * 5).toFixed(1)}`).join(' ') + ' Z';
    const card = document.createElement('button');
    card.type = 'button'; card.className = `handset-card ${editor.activeHandSetType === type ? 'active' : ''}`;
    card.innerHTML = `<svg viewBox="0 0 120 64" aria-hidden="true"><path d="${d}" /></svg><strong>${type}</strong><span>${size.length.toFixed(1)} × ${size.width.toFixed(1)} mm</span>`;
    card.addEventListener('click', () => {
      editor.handSetMode = true; editor.activeHandSetType = type;
      selectTool('handset'); renderHandSetLibrary();
    });
    handSetLibrary.appendChild(card);
  });
  stoneSizesTable.innerHTML = Object.values(HAND_SET_STONE_TYPES).map(type => {
    const s = editor.sheet.stoneSizes[type];
    return `<div class="stone-size-row"><span>${type}</span><input type="number" min="0.1" step="0.1" value="${s.length}" data-stone-size="${type}" data-axis="length" aria-label="${type} length mm" ${editor.sheet.allowStoneResizing ? '' : 'disabled'}><span>×</span><input type="number" min="0.1" step="0.1" value="${s.width}" data-stone-size="${type}" data-axis="width" aria-label="${type} width mm" ${editor.sheet.allowStoneResizing ? '' : 'disabled'}></div>`;
  }).join('');
  stoneSizesTable.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
    if (!editor.sheet.allowStoneResizing) { renderHandSetLibrary(); return; }
    const type = input.dataset.stoneSize, axis = input.dataset.axis, value = Number(input.value);
    if (!(value > 0)) { input.value = editor.sheet.stoneSizes[type][axis]; return; }
    editor.saveSnapshot(); editor.sheet.stoneSizes[type][axis] = value; editor.saveSnapshot();
    renderHandSetLibrary();
  }));
}

function renderStoneProperties() {
  const shape = editor.sheet.shapes.find(s => s.id === editor.sheet.selectedShapeId);
  shapeFieldIds.forEach((id, i) => {
    const input = document.getElementById(id); input.value = shape ? [shape.x, shape.y, shape.length, shape.width, shape.rotation][i] : '';
    input.disabled = !shape || ((i === 2 || i === 3) && !editor.sheet.allowStoneResizing);
  });
  ['shape-delete', 'shape-mirror', 'shape-repeat', 'shape-ring'].forEach(id => { document.getElementById(id).disabled = !shape; });
}

function refreshHandSetState() { renderStoneProperties(); updateCountsAndMeter(); }

function updateCountsAndMeter() {
  const currentSheet = editor.sheet;
  const selIdx = currentSheet.selectedBangleIndex;
  const selCounts = currentSheet.getBangleStoneCounts(selIdx);
  const sheetCounts = currentSheet.getSheetStoneCounts();

  countSelGreen.textContent = selCounts[STONE_CELL.GREEN].toLocaleString();
  countSelWhite.textContent = selCounts[STONE_CELL.WHITE].toLocaleString();
  countSelGold.textContent = selCounts[STONE_CELL.GOLD].toLocaleString();
  countSelRuby.textContent = selCounts[STONE_CELL.RUBY].toLocaleString();
  countSelTotal.textContent = selCounts.totalFilled.toLocaleString();

  countSheetGreen.textContent = sheetCounts[STONE_CELL.GREEN].toLocaleString();
  countSheetWhite.textContent = sheetCounts[STONE_CELL.WHITE].toLocaleString();
  countSheetGold.textContent = sheetCounts[STONE_CELL.GOLD].toLocaleString();
  countSheetRuby.textContent = sheetCounts[STONE_CELL.RUBY].toLocaleString();
  countSheetTotal.textContent = sheetCounts.totalFilled.toLocaleString();

  // Height meter
  const totalH = currentSheet.getTotalDesignHeight();
  heightMeterVal.textContent = `${totalH.toFixed(2)} / ${USABLE_HEIGHT_MM.toFixed(2)} mm`;

  const percent = Math.min(100, (totalH / USABLE_HEIGHT_MM) * 100);
  heightMeterBar.style.width = `${percent}%`;

  const isExceeded = currentSheet.isHeightExceeded();
  if (isExceeded) {
    heightMeterBar.className = 'progress-bar-fill exceeded';
    heightMeterVal.style.color = 'var(--accent-red)';
    heightAlertBox.style.display = 'flex';
  } else if (percent > 95) {
    heightMeterBar.className = 'progress-bar-fill warning';
    heightMeterVal.style.color = 'var(--accent-gold)';
    heightAlertBox.style.display = 'none';
  } else {
    heightMeterBar.className = 'progress-bar-fill';
    heightMeterVal.style.color = 'inherit';
    heightAlertBox.style.display = 'none';
  }

  // BOM & Machining Time
  const drillStats = estimateDrillTime(sheetCounts.totalFilled);
  bomDrillTime.textContent = drillStats.formatted;
  const grossUnits = (sheetCounts.totalFilled / 144).toFixed(1);
  bomGrossUnits.textContent = `${grossUnits} Gross (${sheetCounts.totalFilled.toLocaleString()} stones)`;

  banglesCountTag.textContent = currentSheet.bangles.length;
  const handCounts = currentSheet.getHandSetStoneCounts();
  const allTypes = Object.values(HAND_SET_STONE_TYPES);
  document.getElementById('handset-counts').innerHTML = `<div class="handset-count-row header"><span>Stone</span><span>Sheet</span><span>Per bangle</span></div>${allTypes.map(type => {
    const perBangle = Object.keys(handCounts.bangles).map(i => `B${String(Number(i) + 1).padStart(2, '0')}: ${handCounts.bangles[i][type]}`).join(' · ');
    return `<div class="handset-count-row"><span>${type}</span><b>${handCounts.sheet[type]}</b><small>${perBangle || '—'}</small></div>`;
  }).join('')}`;
}

function renderBangleList() {
  const currentSheet = editor.sheet;
  banglesListEl.innerHTML = '';

  currentSheet.bangles.forEach((bangle, idx) => {
    const isSelected = (idx === currentSheet.selectedBangleIndex);
    const item = document.createElement('div');
    item.className = `bangle-row-item ${isSelected ? 'active' : ''}`;

    const bId = formatBangleId(idx);
    const counts = currentSheet.getBangleStoneCounts(idx);

    item.innerHTML = `
      <div class="bangle-item-left">
        <span class="bangle-id-badge">${bId}</span>
        <div class="bangle-row-input-group">
          <input type="number" class="bangle-row-input" min="1" max="60" value="${bangle.rows}" data-idx="${idx}" aria-label="Row count for ${bId}" />
          <span style="font-size: 10px; color: var(--text-muted);">rows</span>
        </div>
        <span style="font-size: 10px; color: var(--text-muted); margin-left: 4px;">(${counts.totalFilled} st)</span>
      </div>
      <div class="bangle-item-actions">
        <button class="btn-bangle-action btn-up" data-idx="${idx}" title="Move Up" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-bangle-action btn-down" data-idx="${idx}" title="Move Down" ${idx === currentSheet.bangles.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn-bangle-action btn-dup" data-idx="${idx}" title="Duplicate Bangle">⧉</button>
        <button class="btn-bangle-action danger btn-del" data-idx="${idx}" title="Delete Bangle" ${currentSheet.bangles.length <= 1 ? 'disabled' : ''}>✕</button>
      </div>
    `;

    // Click to select
    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        currentSheet.selectedBangleIndex = idx;
        renderBangleList();
        updateCountsAndMeter();
        updateHUD();
      }
    });

    // Row input change
    const rowInput = item.querySelector('.bangle-row-input');
    rowInput.addEventListener('change', (e) => {
      editor.saveSnapshot();
      currentSheet.setBangleRows(idx, parseInt(e.target.value, 10));
      renderBangleList();
      updateCountsAndMeter();
    });

    // Action buttons
    item.querySelector('.btn-up').addEventListener('click', (e) => {
      e.stopPropagation();
      editor.saveSnapshot();
      currentSheet.moveBangleUp(idx);
      renderBangleList();
      updateCountsAndMeter();
    });

    item.querySelector('.btn-down').addEventListener('click', (e) => {
      e.stopPropagation();
      editor.saveSnapshot();
      currentSheet.moveBangleDown(idx);
      renderBangleList();
      updateCountsAndMeter();
    });

    item.querySelector('.btn-dup').addEventListener('click', (e) => {
      e.stopPropagation();
      editor.saveSnapshot();
      currentSheet.duplicateBangle(idx);
      renderBangleList();
      updateCountsAndMeter();
    });

    item.querySelector('.btn-del').addEventListener('click', (e) => {
      e.stopPropagation();
      editor.saveSnapshot();
      currentSheet.deleteBangle(idx);
      renderBangleList();
      updateCountsAndMeter();
    });

    banglesListEl.appendChild(item);
  });
}

function renderMotifsList() {
  motifOrientation.textContent = `${editor.motifRotation * 90}°`;
  motifFlipXButton.setAttribute('aria-pressed', String(editor.motifFlipX));
  motifFlipYButton.setAttribute('aria-pressed', String(editor.motifFlipY));
  motifFlipXButton.classList.toggle('active', editor.motifFlipX);
  motifFlipYButton.classList.toggle('active', editor.motifFlipY);
  const controlsDisabled = !editor.activeMotif;
  [motifRotateButton, motifFlipXButton, motifFlipYButton, motifResetButton].forEach(button => { button.disabled = controlsDisabled; });
  btnRepeatMotif.disabled = controlsDisabled;
  motifsContainer.innerHTML = '';
  MOTIF_STAMPS.forEach((motif) => {
    const card = document.createElement('div');
    card.className = `motif-card ${editor.activeMotif === motif ? 'active' : ''}`;
    card.innerHTML = `
      <div class="motif-name">${motif.name}</div>
      <div class="motif-desc">${motif.description}</div>
    `;
    card.addEventListener('click', () => {
      if (editor.activeMotif !== motif) editor.resetMotifTransform();
      editor.activeMotif = motif;
      editor.activeTool = TOOL_TYPES.STAMP;
      selectTool('stamp');
      renderMotifsList();
    });
    motifsContainer.appendChild(card);
  });
}

motifRotateButton.addEventListener('click', () => { editor.rotateMotif(); renderMotifsList(); });
motifFlipXButton.addEventListener('click', () => { editor.flipMotifHorizontal(); renderMotifsList(); });
motifFlipYButton.addEventListener('click', () => { editor.flipMotifVertical(); renderMotifsList(); });
motifResetButton.addEventListener('click', () => { editor.resetMotifTransform(); renderMotifsList(); });
btnRepeatMotif.addEventListener('click', () => {
  if (editor.repeatMotifAcrossBangle(editor.sheet.selectedBangleIndex)) updateCountsAndMeter();
});

snapStoneCenters.addEventListener('change', () => { editor.snapStoneCenters = snapStoneCenters.checked; });
snapStoneRotation.addEventListener('change', () => { editor.snapStoneRotation = snapStoneRotation.checked; });
allowStoneResize.addEventListener('change', () => {
  editor.saveSnapshot();
  editor.sheet.allowStoneResizing = allowStoneResize.checked;
  allowStoneResize.setAttribute('aria-checked', String(allowStoneResize.checked));
  editor.saveSnapshot();
  renderHandSetLibrary();
  renderStoneProperties();
});
stoneClearance.addEventListener('change', () => {
  const value = Math.max(0.5, Math.min(1.5, Number(stoneClearance.value) || 0.85));
  editor.saveSnapshot(); editor.sheet.clearanceMm = value; editor.sheet.invalidateShapeMask(); editor.saveSnapshot(); stoneClearance.value = value; updateCountsAndMeter();
});
shapeFieldIds.forEach((id, i) => document.getElementById(id).addEventListener('change', e => {
  const value = Number(e.target.value); if (!Number.isFinite(value)) return;
  const prop = ['x', 'y', 'length', 'width', 'rotation'][i];
  editor.updateSelectedShape({ [prop]: value }); renderStoneProperties(); updateCountsAndMeter();
}));
document.getElementById('shape-delete').addEventListener('click', () => { editor.deleteSelectedShape(); refreshHandSetState(); });
document.getElementById('shape-mirror').addEventListener('click', () => {
  if (!editor.sheet.selectedShapeId) return; editor.saveSnapshot(); editor.sheet.mirrorShape(editor.sheet.selectedShapeId); editor.saveSnapshot(); refreshHandSetState();
});
document.getElementById('shape-repeat').addEventListener('click', () => {
  if (!editor.sheet.selectedShapeId) return;
  editor.saveSnapshot(); editor.sheet.repeatShape(editor.sheet.selectedShapeId, Number(document.getElementById('shape-repeat-count').value), Number(document.getElementById('shape-repeat-spacing').value)); editor.saveSnapshot(); refreshHandSetState();
});
document.getElementById('shape-ring').addEventListener('click', () => {
  if (!editor.sheet.selectedShapeId) return; editor.saveSnapshot(); editor.sheet.addRingOfStones(editor.sheet.selectedShapeId, Number(document.getElementById('ring-color').value)); editor.saveSnapshot(); refreshHandSetState();
});

let stoneCardPointer = null;
handSetLibrary.addEventListener('pointerdown', e => {
  const card = e.target.closest('.handset-card'); if (!card) return;
  stoneCardPointer = { type: card.querySelector('strong').textContent, x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', e => {
  if (!stoneCardPointer) return;
  const start = stoneCardPointer; stoneCardPointer = null;
  const rect = canvasEl.getBoundingClientRect();
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 8 || e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
  editor.handSetMode = true; editor.activeHandSetType = start.type;
  const p = renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  editor.placeHandSetStone(start.type, p.x, p.y); renderHandSetLibrary(); refreshHandSetState();
});

function updateHUD() {
  const mm = renderer.hoverMm;
  hudXMm.textContent = `${mm.x.toFixed(3)} mm`;
  hudYMm.textContent = `${mm.y.toFixed(3)} mm`;

  const hit = renderer.hoverStone;
  if (hit) {
    const bId = formatBangleId(hit.bangleIndex);
    const bangle = editor.sheet.bangles[hit.bangleIndex];
    hudBangleInfo.textContent = `${bId} (${bangle ? bangle.rows : 0}R)`;
    hudCellInfo.textContent = `Row: ${hit.row + 1} | Stone: ${hit.col + 1}`;
  } else {
    const selIdx = editor.sheet.selectedBangleIndex;
    const bId = formatBangleId(selIdx);
    const bangle = editor.sheet.bangles[selIdx];
    hudBangleInfo.textContent = `${bId} (${bangle ? bangle.rows : 0}R)`;
    hudCellInfo.textContent = `Row: — | Stone: —`;
  }

  const zoomPercent = Math.round((renderer.zoom / 3.0) * 100);
  hudZoomLevel.textContent = `${zoomPercent}%`;
}

// --- Tool & Swatch Selectors ---

function selectTool(toolName) {
  editor.activeTool = toolName;
  editor.handSetMode = toolName === 'handset';
  renderer.activeTool = toolName;
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === toolName);
  });

  if (toolName === TOOL_TYPES.MOVE) {
    viewportEl.classList.add('panning');
  } else {
    viewportEl.classList.remove('panning');
  }
}

function selectColor(colorVal) {
  editor.activeColor = colorVal;
  document.querySelectorAll('.color-swatch-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.color, 10) === colorVal);
  });
  if (editor.activeTool === TOOL_TYPES.ERASE) {
    selectTool(TOOL_TYPES.PAINT);
  }
}

function cycleBrushSize() {
  const currIdx = BRUSH_SIZES.indexOf(editor.brushSize);
  const nextIdx = (currIdx + 1) % BRUSH_SIZES.length;
  editor.brushSize = BRUSH_SIZES[nextIdx];
  brushSizeLabel.textContent = `${editor.brushSize} st`;
}

// --- Theme Management ---

function initTheme() {
  const savedTheme = localStorage.getItem('bangle_stone_editor_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeIcon.textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('bangle_stone_editor_theme', next);
}

// --- Event Listeners Setup ---

function setupEventListeners() {
  btnNewDesign.addEventListener('click', () => {
    const filledStones = editor.sheet.getSheetStoneCounts().totalFilled;
    if ((filledStones > 0 || editor.sheet.shapes.length > 0) && !confirm('Start a blank design? This clears the current project from the canvas.')) return;
    editor.setSheet(createBlankSheet(editor.sheet.sizeKey, 24));
    renderBangleList();
    updateCountsAndMeter();
    syncControlsFromState();
    renderer.fitBangle(editor.sheet.selectedBangleIndex, editor.sheet);
  });

  const refreshBrassLength = () => {
    const length = getBrassOkLength(brassProductSelect.value, brassSizeSelect.value);
    brassLengthValue.textContent = length === null ? '—' : `${length} mm`;
  };
  brassProductSelect.addEventListener('change', refreshBrassLength);
  brassSizeSelect.addEventListener('change', refreshBrassLength);
  btnUseBrassGrid.addEventListener('click', () => {
    const targetSize = getGridSizeKey(brassSizeSelect.value);
    if (!targetSize || targetSize === editor.sheet.sizeKey) return;
    sizeSelect.value = targetSize;
    sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Tool rail clicks
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool) selectTool(tool);
    });
  });

  // Color swatch clicks
  document.querySelectorAll('.color-swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = parseInt(btn.dataset.color, 10);
      if (col) selectColor(col);
    });
  });

  // Brush size click
  brushSizeBtn.addEventListener('click', cycleBrushSize);

  // Undo / Redo buttons
  btnUndo.addEventListener('click', () => {
    editor.undo();
    renderBangleList();
    renderStoneProperties(); renderHandSetLibrary();
    updateCountsAndMeter();
  });

  btnRedo.addEventListener('click', () => {
    editor.redo();
    renderBangleList();
    renderStoneProperties(); renderHandSetLibrary();
    updateCountsAndMeter();
  });

  // Theme toggle
  btnThemeToggle.addEventListener('click', toggleTheme);

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabBtn.classList.add('active');
      tabBtn.setAttribute('aria-selected', 'true');

      const targetId = tabBtn.dataset.tab;
      document.querySelectorAll('.sidebar-tab-content').forEach(content => {
        content.style.display = (content.id === targetId) ? 'flex' : 'none';
      });
    });
  });

  // HUD Controls
  btnFitSheet.addEventListener('click', () => {
    renderer.fitSheet();
    updateHUD();
  });

  btnFitBangle.addEventListener('click', () => {
    renderer.fitBangle(editor.sheet.selectedBangleIndex, editor.sheet);
    updateHUD();
  });

  btnZoomIn.addEventListener('click', () => {
    renderer.setZoomAtPoint(renderer.zoom * 1.25, renderer.screenWidth / 2, renderer.screenHeight / 2);
    updateHUD();
  });

  btnZoomOut.addEventListener('click', () => {
    renderer.setZoomAtPoint(renderer.zoom / 1.25, renderer.screenWidth / 2, renderer.screenHeight / 2);
    updateHUD();
  });

  // Gap controls
  gapSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    gapInput.value = val;
    gapDisplayVal.textContent = `${val.toFixed(3)} mm`;
    editor.sheet.gap = val;
    updateCountsAndMeter();
  });

  gapInput.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value) || 0;
    gapSlider.value = val;
    gapDisplayVal.textContent = `${val.toFixed(3)} mm`;
    editor.saveSnapshot();
    editor.sheet.gap = val;
    updateCountsAndMeter();
  });

  btnSpreadGaps.addEventListener('click', () => {
    editor.saveSnapshot();
    editor.sheet.spreadGapsToFit();
    gapSlider.value = editor.sheet.gap;
    gapInput.value = editor.sheet.gap;
    gapDisplayVal.textContent = `${editor.sheet.gap.toFixed(3)} mm`;
    updateCountsAndMeter();
  });

  btnAddBangle.addEventListener('click', () => {
    editor.saveSnapshot();
    editor.sheet.addBangle(6, editor.sheet.selectedBangleIndex);
    renderBangleList();
    updateCountsAndMeter();
  });

  // Symmetry Checkboxes
  chkMirrorLR.addEventListener('change', (e) => {
    editor.mirrorLR = e.target.checked;
    renderer.mirrorLR = e.target.checked;
  });

  chkMirrorTB.addEventListener('change', (e) => {
    editor.mirrorTB = e.target.checked;
    renderer.mirrorTB = e.target.checked;
  });

  // Half Copy and Fill/Clear actions
  btnCopyLRSel.addEventListener('click', () => {
    editor.saveSnapshot();
    editor.sheet.copyLeftToRight(editor.sheet.selectedBangleIndex);
    updateCountsAndMeter();
  });

  btnCopyRLSel.addEventListener('click', () => {
    editor.saveSnapshot();
    editor.sheet.copyRightToLeft(editor.sheet.selectedBangleIndex);
    updateCountsAndMeter();
  });

  btnCopyLRAll.addEventListener('click', () => {
    editor.saveSnapshot();
    editor.sheet.copyLeftToRight(null);
    updateCountsAndMeter();
  });

  btnCopyRLAll.addEventListener('click', () => {
    editor.saveSnapshot();
    editor.sheet.copyRightToLeft(null);
    updateCountsAndMeter();
  });

  btnFillBangle.addEventListener('click', () => {
    editor.saveSnapshot();
    editor.sheet.fillBangle(editor.sheet.selectedBangleIndex, editor.activeColor);
    updateCountsAndMeter();
  });

  btnClearBangle.addEventListener('click', () => {
    editor.saveSnapshot();
    editor.sheet.clearBangle(editor.sheet.selectedBangleIndex);
    updateCountsAndMeter();
  });

  // Size Selector with Choice Modal
  sizeSelect.addEventListener('change', (e) => {
    const newSize = e.target.value;
    if (newSize === editor.sheet.sizeKey) return;
    pendingSizeChange = newSize;
    modalContainer.style.display = 'flex';
  });

  modalBtnCancel.addEventListener('click', () => {
    modalContainer.style.display = 'none';
    sizeSelect.value = editor.sheet.sizeKey;
    pendingSizeChange = null;
  });

  modalBtnKeep.addEventListener('click', () => {
    if (pendingSizeChange) {
      editor.saveSnapshot();
      editor.sheet.resizeKeepStones(pendingSizeChange);
      renderBangleList();
      renderStoneProperties(); renderHandSetLibrary();
      updateCountsAndMeter();
      renderer.fitSheet();
    }
    modalContainer.style.display = 'none';
    pendingSizeChange = null;
  });

  modalBtnBlank.addEventListener('click', () => {
    if (pendingSizeChange) {
      editor.setSheet(createBlankSheet(pendingSizeChange, 24));
      renderBangleList();
      renderStoneProperties(); renderHandSetLibrary();
      updateCountsAndMeter();
      syncControlsFromState();
      renderer.fitBangle(editor.sheet.selectedBangleIndex, editor.sheet);
    }
    modalContainer.style.display = 'none';
    pendingSizeChange = null;
  });

  // Tracing Reference Picture Handlers
  btnUploadTrace.addEventListener('click', () => {
    traceFileInput.click();
  });

  traceFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        renderer.referenceImage = img;
        renderer.referenceConfig.visible = true;
        renderer.referenceConfig.xMm = 0;
        renderer.referenceConfig.yMm = 0;
        renderer.referenceConfig.widthMm = SHEET_WIDTH_MM;
        renderer.referenceConfig.heightMm = null;
        traceXInput.value = 0;
        traceYInput.value = 0;
        traceWidthInput.value = SHEET_WIDTH_MM;
        traceHeightInput.value = (SHEET_WIDTH_MM * img.naturalHeight / img.naturalWidth).toFixed(1);
        traceControls.style.display = 'flex';
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  traceVisibleChk.addEventListener('change', (e) => {
    renderer.referenceConfig.visible = e.target.checked;
  });

  traceOpacitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    renderer.referenceConfig.opacity = val;
    traceOpacityVal.textContent = `${Math.round(val * 100)}%`;
  });

  traceWidthInput.addEventListener('change', (e) => {
    renderer.referenceConfig.widthMm = parseFloat(e.target.value) || SHEET_WIDTH_MM;
    if (renderer.referenceConfig.heightMm === null && renderer.referenceImage?.naturalWidth) {
      traceHeightInput.value = (renderer.referenceConfig.widthMm * renderer.referenceImage.naturalHeight / renderer.referenceImage.naturalWidth).toFixed(1);
    }
  });

  traceHeightInput.addEventListener('change', (e) => {
    renderer.referenceConfig.heightMm = parseFloat(e.target.value) || SHEET_WIDTH_MM;
  });

  traceXInput.addEventListener('change', (e) => {
    renderer.referenceConfig.xMm = parseFloat(e.target.value) || 0;
  });

  traceYInput.addEventListener('change', (e) => {
    renderer.referenceConfig.yMm = parseFloat(e.target.value) || 0;
  });

  btnResetTrace.addEventListener('click', () => {
    renderer.referenceConfig.xMm = 0;
    renderer.referenceConfig.yMm = USABLE_Y_MIN_MM;
    renderer.referenceConfig.widthMm = SHEET_WIDTH_MM;
    renderer.referenceConfig.heightMm = USABLE_HEIGHT_MM;
    traceXInput.value = 0;
    traceYInput.value = USABLE_Y_MIN_MM;
    traceWidthInput.value = SHEET_WIDTH_MM;
    traceHeightInput.value = USABLE_HEIGHT_MM;
  });

  btnRemoveTrace.addEventListener('click', () => {
    renderer.referenceImage = null;
    traceControls.style.display = 'none';
    traceFileInput.value = '';
  });

  stoneOpacitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    renderer.stoneOpacity = val;
    stoneOpacityVal.textContent = `${Math.round(val * 100)}%`;
  });

  chkEmptyDots.addEventListener('change', (e) => {
    renderer.showEmptyDots = e.target.checked;
  });

  // --- DOWNLOAD & EXPORT CENTER HANDLERS ---

  async function handlePngDownload(btn) {
    if (!btn) return;
    const oldText = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Rendering PNG...</span>';
      await downloadSheetPng(editor.sheet);
    } catch (err) {
      alert('PNG image export failed: ' + err.message);
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  }

  function handleSingleTapDownload(color, bangleIndex = null) {
    try {
      downloadSingleTap(editor.sheet, color, bangleIndex);
    } catch (err) {
      alert(err.message);
    }
  }

  // Open & Close Download Modal
  btnHeaderDownload?.addEventListener('click', () => {
    downloadModalContainer.style.display = 'flex';
  });

  btnCloseDownloadModal?.addEventListener('click', () => {
    downloadModalContainer.style.display = 'none';
  });

  downloadModalContainer?.addEventListener('click', (e) => {
    if (e.target === downloadModalContainer) {
      downloadModalContainer.style.display = 'none';
    }
  });

  // Quick Action Buttons (Layout Tab)
  btnQuickPng?.addEventListener('click', () => handlePngDownload(btnQuickPng));
  btnQuickTap?.addEventListener('click', () => {
    downloadModalContainer.style.display = 'flex';
  });
  btnQuickSheetZip?.addEventListener('click', () => btnExportSheetZip.click());
  btnQuickSvg?.addEventListener('click', () => downloadSvgFile(editor.sheet));

  // Export Tab Specific Buttons
  btnExportPng?.addEventListener('click', () => handlePngDownload(btnExportPng));
  btnTapSheetGold?.addEventListener('click', () => handleSingleTapDownload(STONE_CELL.GOLD, null));
  btnTapSheetWhite?.addEventListener('click', () => handleSingleTapDownload(STONE_CELL.WHITE, null));
  btnTapSheetGreen?.addEventListener('click', () => handleSingleTapDownload(STONE_CELL.GREEN, null));
  btnTapSheetRuby?.addEventListener('click', () => handleSingleTapDownload(STONE_CELL.RUBY, null));
  btnTapSelBangle?.addEventListener('click', () => handleSingleTapDownload(editor.activeColor, editor.sheet.selectedBangleIndex));

  // Modal Dialog Buttons
  modalBtnDownloadPng?.addEventListener('click', () => {
    handlePngDownload(modalBtnDownloadPng);
  });
  modalBtnTapGold?.addEventListener('click', () => handleSingleTapDownload(STONE_CELL.GOLD, null));
  modalBtnTapWhite?.addEventListener('click', () => handleSingleTapDownload(STONE_CELL.WHITE, null));
  modalBtnTapGreen?.addEventListener('click', () => handleSingleTapDownload(STONE_CELL.GREEN, null));
  modalBtnTapRuby?.addEventListener('click', () => handleSingleTapDownload(STONE_CELL.RUBY, null));
  modalBtnTapSel?.addEventListener('click', () => handleSingleTapDownload(editor.activeColor, editor.sheet.selectedBangleIndex));
  modalBtnZipSheet?.addEventListener('click', () => btnExportSheetZip.click());
  modalBtnZipBangles?.addEventListener('click', () => btnExportBanglesZip.click());
  modalBtnDownloadSvg?.addEventListener('click', () => downloadSvgFile(editor.sheet));
  modalBtnDownloadJson?.addEventListener('click', () => btnSaveJson.click());

  // Export Buttons
  btnExportSheetZip.addEventListener('click', async () => {
    try {
      btnExportSheetZip.disabled = true;
      btnExportSheetZip.textContent = '⏳ Packing G-Code Zip...';
      const blob = await exportSheetZip(editor.sheet);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SHEET_${editor.sheet.sizeKey}_DRILL_FILES.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      btnExportSheetZip.disabled = false;
      btnExportSheetZip.textContent = '📦 Download Sheet Zip (3 Drill Files)';
    }
  });

  btnExportBanglesZip.addEventListener('click', async () => {
    try {
      btnExportBanglesZip.disabled = true;
      btnExportBanglesZip.textContent = '⏳ Packing Bangles Zip...';
      const blob = await exportBanglesZip(editor.sheet);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BANGLES_${editor.sheet.sizeKey}_DRILL_FILES.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      btnExportBanglesZip.disabled = false;
      btnExportBanglesZip.textContent = '🗂️ Download Per-Bangle Zip (All Colours)';
    }
  });

  btnExportSvg.addEventListener('click', () => {
    downloadSvgFile(editor.sheet);
  });

  btnSaveJson.addEventListener('click', () => {
    const jsonStr = JSON.stringify(editor.sheet.toJSON(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BANGLE_DESIGN_${editor.sheet.sizeKey}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  btnLoadJson.addEventListener('click', () => {
    loadJsonInput.click();
  });

  loadJsonInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const newSheet = BangleSheet.fromJSON(parsed);
        editor.setSheet(newSheet);
        renderBangleList();
        updateCountsAndMeter();
        syncControlsFromState();
        renderer.fitSheet();
      } catch (err) {
        alert('Invalid JSON file format: ' + err.message);
      }
    };
    reader.readAsText(file);
    loadJsonInput.value = '';
  });

  // Pointer Events on Viewport / Canvas
  canvasEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvasEl.setPointerCapture(e.pointerId);
    const rect = canvasEl.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    editor.handlePointerDown(sx, sy, e.button, isSpacePressed);
    updateHUD();
  });

  canvasEl.addEventListener('pointermove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    editor.handlePointerMove(sx, sy, isSpacePressed, e.shiftKey);
    updateHUD();
  });

  canvasEl.addEventListener('pointerup', (e) => {
    try { canvasEl.releasePointerCapture(e.pointerId); } catch (_) {}
    editor.handlePointerUp();
    renderStoneProperties(); updateCountsAndMeter();
    updateHUD();
  });

  canvasEl.addEventListener('pointercancel', () => {
    editor.handlePointerCancel();
    updateHUD();
  });

  // Context Menu Prevention for Right Click Panning
  canvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Zoom on Wheel and Trackpad Pinch
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    let zoomFactor = 1.0;
    if (e.ctrlKey) {
      // Pinch to zoom on trackpads
      zoomFactor = 1 - e.deltaY * 0.01;
    } else {
      // Standard wheel
      zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    }

    renderer.setZoomAtPoint(renderer.zoom * zoomFactor, sx, sy);
    updateHUD();
  }, { passive: false });

  // Touch Pinch Zoom Support for Phones and Tablets
  canvasEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartZoom = renderer.zoom;
    }
  });

  canvasEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && touchStartDist > 0) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStartDist;
      const rect = canvasEl.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      renderer.setZoomAtPoint(touchStartZoom * ratio, midX, midY);
      updateHUD();
    }
  }, { passive: false });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ignore keystrokes when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    if (e.code === 'Space') {
      isSpacePressed = true;
      viewportEl.classList.add('panning');
      return;
    }

    const key = e.key.toUpperCase();
    if (editor.handSetMode) {
      const shape = editor.sheet.shapes.find(s => s.id === editor.sheet.selectedShapeId);
      if ((e.ctrlKey || e.metaKey) && key === 'D') { e.preventDefault(); editor.duplicateSelectedShape(); renderStoneProperties(); updateCountsAndMeter(); return; }
      if (key === 'DELETE' && shape) { e.preventDefault(); editor.deleteSelectedShape(); refreshHandSetState(); return; }
      if (shape && ['ARROWLEFT', 'ARROWRIGHT', 'ARROWUP', 'ARROWDOWN'].includes(key)) {
        e.preventDefault(); const step = e.shiftKey ? 1 : 0.1;
        editor.updateSelectedShape({ x: shape.x + (key === 'ARROWRIGHT' ? step : key === 'ARROWLEFT' ? -step : 0), y: shape.y + (key === 'ARROWDOWN' ? step : key === 'ARROWUP' ? -step : 0) });
        renderStoneProperties(); updateCountsAndMeter(); return;
      }
      if (shape && (key === '[' || key === ']')) { editor.updateSelectedShape({ rotation: shape.rotation + (key === '[' ? -1 : 1) * (e.altKey ? 1 : 15) }); renderStoneProperties(); return; }
      if (shape && (key === 'H' || key === 'V')) { editor.updateSelectedShape({ [key === 'H' ? 'flipX' : 'flipY']: !(key === 'H' ? shape.flipX : shape.flipY) }); return; }
    }

    // Tools: P, E, F, L, R, I, M
    if (key === 'P') selectTool(TOOL_TYPES.PAINT);
    else if (key === 'E') selectTool(TOOL_TYPES.ERASE);
    else if (key === 'F') selectTool(TOOL_TYPES.FILL);
    else if (key === 'L') selectTool(TOOL_TYPES.LINE);
    else if (key === 'R') selectTool(TOOL_TYPES.RECTANGLE);
    else if (key === 'I') selectTool(TOOL_TYPES.PICKER);
    else if (key === 'M') selectTool(TOOL_TYPES.MOVE);
    else if (key === 'S') selectTool('handset');

    // Colours: 1, 2, 3, 4
    else if (e.key === '1') selectColor(STONE_CELL.GREEN);
    else if (e.key === '2') selectColor(STONE_CELL.WHITE);
    else if (e.key === '3') selectColor(STONE_CELL.GOLD);
    else if (e.key === '4') selectColor(STONE_CELL.RUBY);

    // Undo / Redo: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        editor.redo();
      } else {
        editor.undo();
      }
      renderBangleList();
      updateCountsAndMeter();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      editor.redo();
      renderBangleList();
      updateCountsAndMeter();
    }

    // Zoom: + and -
    else if (e.key === '+' || e.key === '=') {
      renderer.setZoomAtPoint(renderer.zoom * 1.2, renderer.screenWidth / 2, renderer.screenHeight / 2);
      updateHUD();
    } else if (e.key === '-' || e.key === '_') {
      renderer.setZoomAtPoint(renderer.zoom / 1.2, renderer.screenWidth / 2, renderer.screenHeight / 2);
      updateHUD();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpacePressed = false;
      if (editor.activeTool !== TOOL_TYPES.MOVE) {
        viewportEl.classList.remove('panning');
      }
    }
  });
}

// Start application
initializeDeviceOrientation();
initializeApp();
