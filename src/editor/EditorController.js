// Editor Controller for OrnaCAD
// Handles tools (Paint, Erase, Fill, Line, Rect, Pick, Stamp), stroke interpolation,
// mirroring, undo/redo history stacks, and robust autosave

import {
  TOOL_TYPES,
  STONE_CELL,
  BRUSH_SIZES,
  ROW_SPACING_MM,
  STONE_DIAMETER_MM,
  ODD_ROW_SHIFT_MM
} from '../constants.js';
import { HAND_SET_STONE_TYPES, getStoneLocalPolygon, pointInPolygon, getShapeBoundingBox } from '../models/HandSetShape.js';

export class EditorController {
  constructor(bangleSheet, renderer) {
    this.sheet = bangleSheet;
    this.renderer = renderer;

    // Active state
    this.activeTool = TOOL_TYPES.PAINT;
    this.activeColor = STONE_CELL.GREEN;
    this.brushSize = 1;

    // Symmetry settings
    this.mirrorLR = false;
    this.mirrorTB = false;

    // Active stamp
    this.activeMotif = null;
    this.handSetMode = false;
    this.activeHandSetType = null;
    this.snapStoneCenters = true;
    this.snapStoneRotation = true;
    this.draggingShapeId = null;
    this.motifRotation = 0;
    this.motifFlipX = false;
    this.motifFlipY = false;

    // Mouse / Pointer interaction state
    this.isDragging = false;
    this.isPanning = false;
    this.dragStartStone = null; // { bangleIndex, row, col, x, y }
    this.dragEndStone = null;
    this.lastDragMm = null;     // { x, y }
    this.panStart = { x: 0, y: 0 };
    this.panStartPos = { x: 0, y: 0 };
    this.hasDrawnInStroke = false;

    // Undo / Redo history
    this.historyStack = [];
    this.redoStack = [];
    this.maxHistory = 60;
    this.saveSnapshot(); // Initial state

    // Autosave timer
    this.autosaveTimer = null;
    this.lastAutosavedTime = null;
    this.onAutosaveCallback = null;
    this.onHistoryChangeCallback = null;
    this.onCountsChangeCallback = null;
  }

  setSheet(newSheet) {
    this.sheet = newSheet;
    this.historyStack = [];
    this.redoStack = [];
    this.saveSnapshot();
    this.notifyHistoryChanged();
    this.triggerAutosave();
  }

  saveSnapshot() {
    if (!this.sheet) return;
    const snapshot = this.sheet.clone();
    this.historyStack.push(snapshot);
    if (this.historyStack.length > this.maxHistory) {
      this.historyStack.shift();
    }
    this.redoStack = []; // Clear redo on new action
    this.notifyHistoryChanged();
    this.triggerAutosave();
    if (this.onCountsChangeCallback) this.onCountsChangeCallback();
  }

  undo() {
    if (this.historyStack.length <= 1) return false;
    const current = this.historyStack.pop();
    this.redoStack.push(current);

    const prevSnapshot = this.historyStack[this.historyStack.length - 1];
    this.sheet = prevSnapshot.clone();
    this.notifyHistoryChanged();
    this.triggerAutosave();
    if (this.onCountsChangeCallback) this.onCountsChangeCallback();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const nextSnapshot = this.redoStack.pop();
    this.historyStack.push(nextSnapshot);
    this.sheet = nextSnapshot.clone();
    this.notifyHistoryChanged();
    this.triggerAutosave();
    if (this.onCountsChangeCallback) this.onCountsChangeCallback();
    return true;
  }

  canUndo() {
    return this.historyStack.length > 1;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  notifyHistoryChanged() {
    if (this.onHistoryChangeCallback) {
      this.onHistoryChangeCallback(this.canUndo(), this.canRedo());
    }
  }

  triggerAutosave() {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.performAutosave();
    }, 400);
  }

  performAutosave() {
    try {
      if (!this.sheet) return;
      const jsonStr = JSON.stringify(this.sheet.toJSON());
      localStorage.setItem('bangle_stone_editor_autosave', jsonStr);
      this.lastAutosavedTime = new Date().toLocaleTimeString();
      if (this.onAutosaveCallback) {
        this.onAutosaveCallback(true, this.lastAutosavedTime);
      }
    } catch (err) {
      console.warn('Autosave to localStorage failed:', err);
      if (this.onAutosaveCallback) {
        this.onAutosaveCallback(false, null, err.message);
      }
    }
  }

  loadAutosave() {
    try {
      const saved = localStorage.getItem('bangle_stone_editor_autosave');
      if (saved) {
        const obj = JSON.parse(saved);
        return obj;
      }
    } catch (err) {
      console.warn('Error loading autosave:', err);
    }
    return null;
  }

  // --- Pointer & Tool Handling ---

  handlePointerDown(screenX, screenY, button = 0, isSpacePressed = false) {
    // Right mouse button (2) or Space drag -> Pan
    if (button === 2 || this.activeTool === TOOL_TYPES.MOVE || isSpacePressed) {
      this.isPanning = true;
      this.panStart = { x: screenX, y: screenY };
      this.panStartPos = { x: this.renderer.panX, y: this.renderer.panY };
      return;
    }

    if (button !== 0) return; // Only primary button for drawing

    const world = this.renderer.screenToWorld(screenX, screenY);
    if (this.handSetMode) {
      if (this.activeHandSetType) {
        this.placeHandSetStone(this.activeHandSetType, world.x, world.y);
        return;
      }
      const directHit = this.hitTestHandSet(world.x, world.y);
      const priorSelection = this.sheet.shapes.find(s => s.id === this.sheet.selectedShapeId);
      let isHandleHit = false;
      if (!directHit && priorSelection) {
        const box = getShapeBoundingBox(priorSelection);
        const handles = [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY], [priorSelection.x, box.minY - 10]];
        isHandleHit = handles.some(([x, y]) => Math.hypot(screenX - this.renderer.worldToScreen(x, y).x, screenY - this.renderer.worldToScreen(x, y).y) <= 10);
      }
      const hitShape = directHit || (isHandleHit ? priorSelection : null);
      this.sheet.selectedShapeId = hitShape?.id || null;
      if (hitShape) {
        this.saveSnapshot();
        this.draggingShapeId = hitShape.id;
        this.isDragging = true;
        const box = getShapeBoundingBox(hitShape);
        const corners = [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]];
        const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        const screen = { x: screenX, y: screenY };
        const cornerIndex = corners.findIndex(([x, y]) => d2(screen, this.renderer.worldToScreen(x, y)) <= 10 ** 2);
        const rotateHandle = this.renderer.worldToScreen(hitShape.x, box.minY - 10);
        if (d2(screen, rotateHandle) <= 10 ** 2) {
          this.shapeDragMode = 'rotate';
          this.shapeStartAngle = Math.atan2(world.y - hitShape.y, world.x - hitShape.x) * 180 / Math.PI;
          this.shapeStartRotation = hitShape.rotation;
        } else if (cornerIndex >= 0) {
          this.shapeDragMode = 'resize'; this.shapeStart = { ...hitShape };
        } else {
          this.shapeDragMode = 'move';
          this.shapeDragOffset = { x: world.x - hitShape.x, y: world.y - hitShape.y };
        }
      }
      return;
    }
    const hit = this.sheet.hitTest(world.x, world.y);

    if (hit) {
      // Auto-select bangle on click
      this.sheet.selectedBangleIndex = hit.bangleIndex;
    }

    if (this.activeTool === TOOL_TYPES.PICKER) {
      if (hit && hit.value !== STONE_CELL.EMPTY) {
        this.activeColor = hit.value;
        this.activeTool = TOOL_TYPES.PAINT;
      }
      return;
    }

    if (this.activeTool === TOOL_TYPES.FILL) {
      if (hit) {
        this.saveSnapshot();
        this.performFloodFill(hit.bangleIndex, hit.row, hit.col, this.activeColor);
        if (this.onCountsChangeCallback) this.onCountsChangeCallback();
      }
      return;
    }

    if (this.activeTool === TOOL_TYPES.STAMP) {
      if (hit && this.activeMotif) {
        this.saveSnapshot();
        this.applyStampAt(hit.bangleIndex, hit.row, hit.col, this.activeMotif);
        if (this.onCountsChangeCallback) this.onCountsChangeCallback();
      }
      return;
    }

    if (this.activeTool === TOOL_TYPES.LINE || this.activeTool === TOOL_TYPES.RECTANGLE) {
      if (hit) {
        this.isDragging = true;
        this.dragStartStone = hit;
        this.dragEndStone = hit;
        this.renderer.previewStones = this.activeTool === TOOL_TYPES.LINE
          ? this.calculateLineStones(hit.bangleIndex, hit.row, hit.col, hit.row, hit.col, this.activeColor)
          : [];
      }
      return;
    }

    if (this.activeTool === TOOL_TYPES.PAINT || this.activeTool === TOOL_TYPES.ERASE) {
      this.isDragging = true;
      this.hasDrawnInStroke = false;
      this.dragStartStone = hit;
      this.lastDragMm = { x: world.x, y: world.y };

      if (hit) {
        this.saveSnapshot();
        const drawColor = (this.activeTool === TOOL_TYPES.ERASE) ? STONE_CELL.EMPTY : this.activeColor;
        this.applyBrushAt(hit.bangleIndex, hit.row, hit.col, drawColor);
        this.hasDrawnInStroke = true;
      }
    }
  }

  handlePointerMove(screenX, screenY, isSpacePressed = false, shiftKey = false) {
    if (this.isPanning) {
      const dx = screenX - this.panStart.x;
      const dy = screenY - this.panStart.y;
      this.renderer.panX = this.panStartPos.x + dx;
      this.renderer.panY = this.panStartPos.y + dy;
      return;
    }

    const world = this.renderer.screenToWorld(screenX, screenY);
    this.renderer.hoverMm = world;
    const hit = this.sheet.hitTest(world.x, world.y);
    this.renderer.hoverStone = hit;
    this.renderer.brushRadiusStones = this.brushSize;

    if (this.draggingShapeId && this.isDragging) {
      const shape = this.sheet.shapes.find(s => s.id === this.draggingShapeId);
      if (this.shapeDragMode === 'move') this.sheet.updateShape(this.draggingShapeId, { x: world.x - this.shapeDragOffset.x, y: world.y - this.shapeDragOffset.y });
      else if (this.shapeDragMode === 'rotate') {
        let rotation = this.shapeStartRotation + Math.atan2(world.y - shape.y, world.x - shape.x) * 180 / Math.PI - this.shapeStartAngle;
        if (this.snapStoneRotation) rotation = Math.round(rotation / 15) * 15;
        this.sheet.updateShape(this.draggingShapeId, { rotation });
      } else if (this.shapeDragMode === 'resize') {
        const a = -shape.rotation * Math.PI / 180, dx = world.x - shape.x, dy = world.y - shape.y;
        const localX = dx * Math.cos(a) - dy * Math.sin(a), localY = dx * Math.sin(a) + dy * Math.cos(a);
        let length = Math.max(0.5, Math.abs(localX) * 2), width = Math.max(0.5, Math.abs(localY) * 2);
        if (shiftKey) { const ratio = this.shapeStart.length / this.shapeStart.width; if (length / width > ratio) width = length / ratio; else length = width * ratio; }
        this.sheet.updateShape(this.draggingShapeId, { length, width });
      }
      return;
    }
    if (!this.isDragging) return;

    if (this.activeTool === TOOL_TYPES.LINE && this.dragStartStone) {
      if (hit && hit.bangleIndex === this.dragStartStone.bangleIndex) {
        this.dragEndStone = hit;
        const val = this.activeColor;
        this.renderer.previewStones = this.calculateLineStones(
          this.dragStartStone.bangleIndex,
          this.dragStartStone.row,
          this.dragStartStone.col,
          hit.row,
          hit.col,
          val
        );
      }
      return;
    }

    if (this.activeTool === TOOL_TYPES.RECTANGLE && this.dragStartStone) {
      if (hit && hit.bangleIndex === this.dragStartStone.bangleIndex) {
        const val = this.activeColor;
        this.renderer.previewStones = this.calculateRectStones(
          this.dragStartStone.bangleIndex,
          this.dragStartStone.row,
          this.dragStartStone.col,
          hit.row,
          hit.col,
          val
        );
      }
      return;
    }

    if (this.activeTool === TOOL_TYPES.PAINT || this.activeTool === TOOL_TYPES.ERASE) {
      const drawColor = (this.activeTool === TOOL_TYPES.ERASE) ? STONE_CELL.EMPTY : this.activeColor;

      // Continuous path interpolation between lastDragMm and current world to prevent skipped stones
      if (this.lastDragMm) {
        const dx = world.x - this.lastDragMm.x;
        const dy = world.y - this.lastDragMm.y;
        const dist = Math.hypot(dx, dy);
        const stepSize = 0.8; // mm (half a stone width)
        const steps = Math.max(1, Math.ceil(dist / stepSize));

        for (let s = 1; s <= steps; s++) {
          const interpX = this.lastDragMm.x + (dx * s) / steps;
          const interpY = this.lastDragMm.y + (dy * s) / steps;
          const stepHit = this.sheet.hitTest(interpX, interpY);
          if (stepHit) {
            if (!this.hasDrawnInStroke) {
              this.saveSnapshot();
              this.hasDrawnInStroke = true;
            }
            this.applyBrushAt(stepHit.bangleIndex, stepHit.row, stepHit.col, drawColor);
          }
        }
      } else if (hit) {
        if (!this.hasDrawnInStroke) {
          this.saveSnapshot();
          this.hasDrawnInStroke = true;
        }
        this.applyBrushAt(hit.bangleIndex, hit.row, hit.col, drawColor);
      }

      this.lastDragMm = { x: world.x, y: world.y };
    }
  }

  handlePointerUp() {
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (!this.isDragging) return;
    if (this.draggingShapeId) {
      this.isDragging = false;
      this.draggingShapeId = null;
      this.shapeDragOffset = null;
      this.saveSnapshot();
      if (this.onCountsChangeCallback) this.onCountsChangeCallback();
      return;
    }
    this.isDragging = false;
    this.lastDragMm = null;

    if (this.activeTool === TOOL_TYPES.LINE && this.renderer.previewStones.length > 0) {
      this.saveSnapshot();
      for (const st of this.renderer.previewStones) {
        this.applyStoneWithSymmetry(st.bangleIndex, st.row, st.col, st.value);
      }
      this.renderer.previewStones = [];
      if (this.onCountsChangeCallback) this.onCountsChangeCallback();
    } else if (this.activeTool === TOOL_TYPES.RECTANGLE && this.renderer.previewStones.length > 0) {
      this.saveSnapshot();
      for (const st of this.renderer.previewStones) {
        this.applyStoneWithSymmetry(st.bangleIndex, st.row, st.col, st.value);
      }
      this.renderer.previewStones = [];
      if (this.onCountsChangeCallback) this.onCountsChangeCallback();
    }

    this.dragStartStone = null;
    this.dragEndStone = null;
    if (this.hasDrawnInStroke && this.onCountsChangeCallback) {
      this.onCountsChangeCallback();
    }
  }

  handlePointerCancel() {
    this.isPanning = false;
    this.isDragging = false;
    this.lastDragMm = null;
    this.dragStartStone = null;
    this.dragEndStone = null;
    this.hasDrawnInStroke = false;
    this.renderer.previewStones = [];
    this.draggingShapeId = null;
    this.shapeDragOffset = null;
  }

  hitTestHandSet(x, y) {
    for (let i = (this.sheet.shapes || []).length - 1; i >= 0; i--) {
      const shape = this.sheet.shapes[i];
      const dx = x - shape.x, dy = y - shape.y, a = -shape.rotation * Math.PI / 180;
      let lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (shape.flipX) lx = -lx; if (shape.flipY) ly = -ly;
      if (pointInPolygon(lx, ly, shape._cachedPoly || getStoneLocalPolygon(shape.type, shape.length, shape.width))) return shape;
    }
    return null;
  }

  placeHandSetStone(type, x, y) {
    if (!Object.values(HAND_SET_STONE_TYPES).includes(type)) return null;
    if (this.snapStoneCenters) {
      const hit = this.sheet.hitTest(x, y, 1.25);
      if (hit) { x = hit.x; y = hit.y; }
    }
    this.saveSnapshot();
    const shape = this.sheet.addShape({ type, x, y });
    this.activeHandSetType = null;
    this.handSetMode = true;
    this.sheet.selectedShapeId = shape.id;
    this.saveSnapshot();
    if (this.onCountsChangeCallback) this.onCountsChangeCallback();
    return shape;
  }

  updateSelectedShape(props) {
    const id = this.sheet.selectedShapeId;
    if (!id) return false;
    this.saveSnapshot();
    const shape = this.sheet.shapes.find(s => s.id === id);
    const next = { ...props };
    if (next.rotation !== undefined && this.snapStoneRotation) next.rotation = Math.round(next.rotation / 15) * 15;
    const ok = this.sheet.updateShape(id, next);
    if (ok) this.saveSnapshot();
    if (ok && this.onCountsChangeCallback) this.onCountsChangeCallback();
    return ok;
  }

  deleteSelectedShape() {
    if (!this.sheet.selectedShapeId) return false;
    this.saveSnapshot();
    const ok = this.sheet.deleteShape(this.sheet.selectedShapeId);
    if (ok) this.saveSnapshot();
    if (ok && this.onCountsChangeCallback) this.onCountsChangeCallback();
    return ok;
  }

  duplicateSelectedShape() {
    if (!this.sheet.selectedShapeId) return null;
    this.saveSnapshot();
    const duplicate = this.sheet.duplicateShape(this.sheet.selectedShapeId);
    if (duplicate) this.saveSnapshot();
    return duplicate;
  }

  // --- Brush & Stroke Application ---

  applyBrushAt(bangleIndex, centerRow, centerCol, color) {
    if (this.brushSize === 1) {
      this.applyStoneWithSymmetry(bangleIndex, centerRow, centerCol, color);
      return;
    }

    const bangle = this.sheet.bangles[bangleIndex];
    if (!bangle) return;

    const stonesPerRow = this.sheet.stonesPerRow;
    const centerPos = this.sheet.getStonePosition(bangleIndex, centerRow, centerCol);
    const brushRadiusMm = (this.brushSize * STONE_DIAMETER_MM) * 0.58;

    const rowRange = Math.ceil(brushRadiusMm / ROW_SPACING_MM);
    const colRange = Math.ceil(brushRadiusMm / STONE_DIAMETER_MM);

    for (let dr = -rowRange; dr <= rowRange; dr++) {
      const r = centerRow + dr;
      if (r < 0 || r >= bangle.rows) continue;

      for (let dc = -colRange; dc <= colRange; dc++) {
        const c = centerCol + dc;
        if (c < 0 || c >= stonesPerRow) continue;

        const pos = this.sheet.getStonePosition(bangleIndex, r, c);
        const dist = Math.hypot(pos.x - centerPos.x, pos.y - centerPos.y);

        if (dist <= brushRadiusMm) {
          this.applyStoneWithSymmetry(bangleIndex, r, c, color);
        }
      }
    }
  }

  applyStoneWithSymmetry(bangleIndex, row, col, color) {
    const bangle = this.sheet.bangles[bangleIndex];
    if (!bangle) return;
    const stones = this.sheet.stonesPerRow;
    const rows = bangle.rows;

    // 1. Primary Stone
    this.sheet.setStone(bangleIndex, row, col, color);

    // 2. Left-to-Right Mirroring
    if (this.mirrorLR) {
      const mirrorCol = stones - 1 - col;
      if (mirrorCol >= 0 && mirrorCol < stones) {
        this.sheet.setStone(bangleIndex, row, mirrorCol, color);
      }
    }

    // 3. Top-to-Bottom Mirroring
    if (this.mirrorTB) {
      const mirrorRow = (rows - 1) - row;
      if (mirrorRow >= 0 && mirrorRow < rows) {
        this.sheet.setStone(bangleIndex, mirrorRow, col, color);

        // 4. Quad symmetry if both mirrors active
        if (this.mirrorLR) {
          const mirrorCol = stones - 1 - col;
          if (mirrorCol >= 0 && mirrorCol < stones) {
            this.sheet.setStone(bangleIndex, mirrorRow, mirrorCol, color);
          }
        }
      }
    }
  }

  // --- Flood Fill Algorithm on Hex Grid ---

  performFloodFill(bangleIndex, startRow, startCol, targetColor) {
    const bangle = this.sheet.bangles[bangleIndex];
    if (!bangle) return;

    const stones = this.sheet.stonesPerRow;
    const rows = bangle.rows;
    const startVal = this.sheet.getStone(bangleIndex, startRow, startCol);
    if (startVal === targetColor) return;

    const visited = new Uint8Array(rows * stones);
    const queue = [[startRow, startCol]];
    visited[startRow * stones + startCol] = 1;

    while (queue.length > 0) {
      const [r, c] = queue.shift();
      this.sheet.setStone(bangleIndex, r, c, targetColor);

      // Hex neighbors:
      // Same row:
      const neighbors = [
        [r, c - 1],
        [r, c + 1]
      ];

      // Row above:
      if (r > 0) {
        if (r % 2 === 0) {
          neighbors.push([r - 1, c - 1], [r - 1, c]);
        } else {
          neighbors.push([r - 1, c], [r - 1, c + 1]);
        }
      }

      // Row below:
      if (r < rows - 1) {
        if (r % 2 === 0) {
          neighbors.push([r + 1, c - 1], [r + 1, c]);
        } else {
          neighbors.push([r + 1, c], [r + 1, c + 1]);
        }
      }

      for (const [nr, nc] of neighbors) {
        if (nr >= 0 && nr < rows && nc >= 0 && nc < stones) {
          const nIdx = nr * stones + nc;
          if (!visited[nIdx] && bangle.data[nIdx] === startVal) {
            visited[nIdx] = 1;
            queue.push([nr, nc]);
          }
        }
      }
    }
  }

  // --- Line & Rectangle Calculators ---

  calculateLineStones(bangleIndex, r1, c1, r2, c2, val) {
    const bangle = this.sheet.bangles[bangleIndex];
    if (!bangle) return [];

    // Interpolate in cube coordinates on the odd-row hex grid, then round back
    // to offset coordinates. This gives a connected path without millimeter
    // sampling gaps or hit-test-dependent endpoint drift.
    const toCube = (row, col) => {
      const x = col - (row - (row & 1)) / 2;
      const z = row;
      return { x, y: -x - z, z };
    };
    const a = toCube(r1, c1);
    const b = toCube(r2, c2);
    const distance = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
    const result = [];

    for (let step = 0; step <= distance; step++) {
      const t = distance === 0 ? 0 : step / distance;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const z = a.z + (b.z - a.z) * t;
      let rx = Math.round(x);
      let ry = Math.round(y);
      let rz = Math.round(z);
      const xDiff = Math.abs(rx - x);
      const yDiff = Math.abs(ry - y);
      const zDiff = Math.abs(rz - z);
      if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
      else if (yDiff > zDiff) ry = -rx - rz;
      else rz = -rx - ry;

      const row = rz;
      const col = rx + (row - (row & 1)) / 2;
      if (row >= 0 && row < bangle.rows && col >= 0 && col < this.sheet.stonesPerRow) {
        result.push({ bangleIndex, row, col, value: val });
      }
    }
    return result;
  }

  calculateRectStones(bangleIndex, r1, c1, r2, c2, val) {
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);
    const stones = [];

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        stones.push({
          bangleIndex,
          row: r,
          col: c,
          value: val
        });
      }
    }
    return stones;
  }

  applyStampAt(bangleIndex, centerRow, centerCol, motif) {
    const matrix = this.getTransformedMotifMatrix(motif);
    const h = matrix.length;
    const w = matrix[0].length;
    const halfH = Math.floor(h / 2);
    const halfW = Math.floor(w / 2);

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const val = matrix[r][c];
        if (val !== null) {
          const targetR = centerRow + (r - halfH);
          const targetC = centerCol + (c - halfW);
          this.applyStoneWithSymmetry(bangleIndex, targetR, targetC, val);
        }
      }
    }
  }

  rotateMotif() {
    this.motifRotation = (this.motifRotation + 1) % 4;
  }

  flipMotifHorizontal() {
    this.motifFlipX = !this.motifFlipX;
  }

  flipMotifVertical() {
    this.motifFlipY = !this.motifFlipY;
  }

  resetMotifTransform() {
    this.motifRotation = 0;
    this.motifFlipX = false;
    this.motifFlipY = false;
  }

  getTransformedMotifMatrix(motif) {
    let matrix = motif.generate(this.activeColor).map(row => [...row]);
    if (this.motifFlipX) matrix = matrix.map(row => [...row].reverse());
    if (this.motifFlipY) matrix.reverse();
    for (let turn = 0; turn < this.motifRotation; turn++) {
      const rotated = Array.from({ length: matrix[0].length }, () => Array(matrix.length).fill(null));
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) rotated[c][matrix.length - 1 - r] = matrix[r][c];
      }
      matrix = rotated;
    }
    return matrix;
  }

  repeatMotifAcrossBangle(bangleIndex, motif = this.activeMotif) {
    const bangle = this.sheet.bangles[bangleIndex];
    if (!bangle || !motif) return false;
    const matrix = this.getTransformedMotifMatrix(motif);
    if (!matrix.length || !matrix[0]?.length) return false;
    const motifHeight = matrix.length;
    const motifWidth = matrix[0].length;
    const repeatCount = Math.max(1, Math.floor(this.sheet.stonesPerRow / motifWidth));
    const availableSpan = Math.max(0, this.sheet.stonesPerRow - motifWidth);
    const repeatRows = Math.max(1, Math.floor(bangle.rows / motifHeight));
    const availableRows = Math.max(0, bangle.rows - motifHeight);
    this.saveSnapshot();
    for (let repeatRow = 0; repeatRow < repeatRows; repeatRow++) {
      const startRow = repeatRows === 1 ? Math.floor(availableRows / 2) : Math.round(repeatRow * availableRows / (repeatRows - 1));
      for (let repeat = 0; repeat < repeatCount; repeat++) {
        const startCol = repeatCount === 1 ? Math.floor(availableSpan / 2) : Math.round(repeat * availableSpan / (repeatCount - 1));
        this.applyStampAt(bangleIndex, startRow + Math.floor(motifHeight / 2), startCol + Math.floor(motifWidth / 2), motif);
      }
    }
    this.triggerAutosave();
    if (this.onCountsChangeCallback) this.onCountsChangeCallback();
    return true;
  }
}
