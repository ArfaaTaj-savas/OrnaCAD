// BangleSheet Data Model
// Manages the stack of bangles, stone grid arrays, RLE serialization, and geometry

import {
  STONE_DIAMETER_MM,
  STONE_RADIUS_MM,
  ROW_SPACING_MM,
  ODD_ROW_SHIFT_MM,
  SHEET_WIDTH_MM,
  SHEET_HEIGHT_MM,
  SHEET_CENTER_X_MM,
  USABLE_Y_MIN_MM,
  USABLE_Y_MAX_MM,
  USABLE_HEIGHT_MM,
  DEFAULT_GAP_MM,
  BANGLE_SIZES,
  STONE_CELL,
  SAMPLE_LAYOUT_ROWS
} from '../constants.js';
import {
  HAND_SET_STONE_TYPES,
  DEFAULT_STONE_SIZES,
  DEFAULT_CLEARANCE_MM,
  isHoleBlockedByShape,
  getStoneLocalPolygon,
  distanceToPolygon,
  getShapeBoundingBox
} from './HandSetShape.js';

/**
 * Encodes a Uint8Array into a Run-Length Encoded (RLE) string.
 * Format: "vCount,vCount,..." e.g. "13,24,3120"
 */
export function encodeRLE(arr) {
  if (!arr || arr.length === 0) return '';
  const tokens = [];
  let currentVal = arr[0];
  let currentCount = 1;

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === currentVal) {
      currentCount++;
    } else {
      tokens.push(`${currentVal}${currentCount}`);
      currentVal = arr[i];
      currentCount = 1;
    }
  }
  tokens.push(`${currentVal}${currentCount}`);
  return tokens.join(',');
}

/**
 * Decodes an RLE string back into a Uint8Array.
 */
export function decodeRLE(str, expectedLength) {
  const arr = new Uint8Array(expectedLength);
  if (!str) return arr;

  const tokens = str.split(',');
  let destIdx = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token) continue;
    const val = parseInt(token.charAt(0), 10);
    const count = parseInt(token.substring(1), 10);
    if (isNaN(val) || isNaN(count)) continue;

    const fillEnd = Math.min(destIdx + count, expectedLength);
    arr.fill(val, destIdx, fillEnd);
    destIdx = fillEnd;
    if (destIdx >= expectedLength) break;
  }
  return arr;
}

export class BangleSheet {
  constructor(sizeKey = '2.4', gap = DEFAULT_GAP_MM) {
    this.sizeKey = sizeKey;
    this.gap = gap;
    this.bangles = [];
    this.selectedBangleIndex = 0;

    // Hand-Set Fancy Stones Library State
    this.shapes = []; // Array of { id, type, x, y, length, width, rotation, flipX, flipY }
    this.stoneSizes = JSON.parse(JSON.stringify(DEFAULT_STONE_SIZES));
    this.clearanceMm = DEFAULT_CLEARANCE_MM;
    this.selectedShapeId = null;
    this._shapeGeometryRevision = 0;
    this._blockedCellCache = new Map();
  }

  get sizeInfo() {
    return BANGLE_SIZES[this.sizeKey] || BANGLE_SIZES['2.4'];
  }

  get stonesPerRow() {
    return this.sizeInfo.stones;
  }

  get bangleWidthMm() {
    return (this.stonesPerRow - 1) * STONE_DIAMETER_MM + ODD_ROW_SHIFT_MM;
  }

  get x0Mm() {
    return SHEET_CENTER_X_MM - this.bangleWidthMm / 2;
  }

  get totalRowCount() {
    return this.bangles.reduce((sum, b) => sum + b.rows, 0);
  }

  /**
   * Calculates the top Y coordinate in mm for a given bangle index
   */
  getBangleTopY(bangleIndex) {
    let y = USABLE_Y_MIN_MM;
    for (let i = 0; i < bangleIndex && i < this.bangles.length; i++) {
      const rows = this.bangles[i].rows;
      const height = (rows - 1) * ROW_SPACING_MM;
      y += height + this.gap;
    }
    return y;
  }

  /**
   * Calculates the bottom Y coordinate (last stone row center) for a given bangle
   */
  getBangleBottomY(bangleIndex) {
    if (bangleIndex < 0 || bangleIndex >= this.bangles.length) return 0;
    const top = this.getBangleTopY(bangleIndex);
    const rows = this.bangles[bangleIndex].rows;
    return top + (rows - 1) * ROW_SPACING_MM;
  }

  /**
   * Total height of the design from first stone center to last stone center
   */
  getTotalDesignHeight() {
    if (this.bangles.length === 0) return 0;
    let height = 0;
    for (let i = 0; i < this.bangles.length; i++) {
      height += (this.bangles[i].rows - 1) * ROW_SPACING_MM;
      if (i < this.bangles.length - 1) {
        height += this.gap;
      }
    }
    return height;
  }

  /**
   * Checks if total design height exceeds usable sheet area (272.37 mm)
   */
  isHeightExceeded() {
    return this.getTotalDesignHeight() > USABLE_HEIGHT_MM + 0.02;
  }

  /**
   * Spread gaps evenly so total height matches exactly 272.37 mm
   */
  spreadGapsToFit() {
    if (this.bangles.length <= 1) return;
    let rowSpacingSum = 0;
    for (const b of this.bangles) {
      rowSpacingSum += (b.rows - 1) * ROW_SPACING_MM;
    }
    const gapsCount = this.bangles.length - 1;
    const requiredGap = (USABLE_HEIGHT_MM - rowSpacingSum) / gapsCount;
    // Floor to 3 decimals to ensure we never exceed 272.37 mm
    this.gap = Math.max(0, Math.floor(requiredGap * 1000) / 1000);
  }

  /**
   * Get physical (x, y) coordinates for a stone
   */
  getStonePosition(bangleIndex, row, col) {
    const x = this.x0Mm + (row % 2) * ODD_ROW_SHIFT_MM + col * STONE_DIAMETER_MM;
    const bangleTop = this.getBangleTopY(bangleIndex);
    const y = bangleTop + row * ROW_SPACING_MM;
    return { x, y };
  }

  /**
   * Fast hit test to find which bangle, row, col is near (sheetX, sheetY)
   */
  hitTest(sheetX, sheetY, hitRadiusMm = 0.95) {
    if (this.bangles.length === 0) return null;
    const stonesPerRow = this.stonesPerRow;
    const x0 = this.x0Mm;

    // Check each bangle Y bounds
    for (let b = 0; b < this.bangles.length; b++) {
      const topY = this.getBangleTopY(b);
      const rows = this.bangles[b].rows;
      const bottomY = topY + (rows - 1) * ROW_SPACING_MM;

      // Generous bounding box check
      if (sheetY < topY - hitRadiusMm * 1.5 || sheetY > bottomY + hitRadiusMm * 1.5) {
        continue;
      }

      // Estimate nearest row
      const estimatedRow = Math.round((sheetY - topY) / ROW_SPACING_MM);
      if (estimatedRow < 0 || estimatedRow >= rows) continue;

      const rowY = topY + estimatedRow * ROW_SPACING_MM;
      const rowXOffset = (estimatedRow % 2) * ODD_ROW_SHIFT_MM;

      // Estimate nearest col
      const estimatedCol = Math.round((sheetX - x0 - rowXOffset) / STONE_DIAMETER_MM);
      if (estimatedCol < 0 || estimatedCol >= stonesPerRow) continue;

      const stoneX = x0 + rowXOffset + estimatedCol * STONE_DIAMETER_MM;
      const dx = sheetX - stoneX;
      const dy = sheetY - rowY;

      if (dx * dx + dy * dy <= hitRadiusMm * hitRadiusMm) {
        return {
          bangleIndex: b,
          row: estimatedRow,
          col: estimatedCol,
          x: stoneX,
          y: rowY,
          value: this.getStone(b, estimatedRow, estimatedCol)
        };
      }
    }
    return null;
  }

  /**
   * Stone accessors
   */
  getStone(bangleIndex, row, col) {
    const bangle = this.bangles[bangleIndex];
    if (!bangle) return STONE_CELL.EMPTY;
    if (row < 0 || row >= bangle.rows || col < 0 || col >= this.stonesPerRow) {
      return STONE_CELL.EMPTY;
    }
    return bangle.data[row * this.stonesPerRow + col];
  }

  setStone(bangleIndex, row, col, value) {
    const bangle = this.bangles[bangleIndex];
    if (!bangle) return false;
    if (row < 0 || row >= bangle.rows || col < 0 || col >= this.stonesPerRow) {
      return false;
    }
    const idx = row * this.stonesPerRow + col;
    if (bangle.data[idx] === value) return false;
    bangle.data[idx] = value;
    return true;
  }

  /**
   * Hand-set stone masking:
   * A hole position is blocked when its center is inside a shape outline
   * or closer to the outline than clearanceMm.
   */
  isHoleBlocked(sheetX, sheetY) {
    if (!this.shapes || this.shapes.length === 0) return false;
    for (let i = 0; i < this.shapes.length; i++) {
      if (isHoleBlockedByShape(sheetX, sheetY, this.shapes[i], this.clearanceMm)) {
        return true;
      }
    }
    return false;
  }

  isCellBlocked(bangleIndex, row, col) {
    if (!this.shapes || this.shapes.length === 0) return false;
    const bangle = this.bangles[bangleIndex];
    if (!bangle) return false;
    const topYForKey = this.getBangleTopY(bangleIndex);
    const key = `${bangle.id}:${bangle.rows}:${topYForKey}:${this._shapeGeometryRevision}:${this.clearanceMm}`;
    let mask = this._blockedCellCache.get(key);
    if (!mask) {
      mask = new Uint8Array(bangle.data.length);
      const topY = topYForKey;
      for (const shape of this.shapes) {
        const box = getShapeBoundingBox(shape, this.clearanceMm);
        const firstRow = Math.max(0, Math.floor((box.minY - topY) / ROW_SPACING_MM) - 1);
        const lastRow = Math.min(bangle.rows - 1, Math.ceil((box.maxY - topY) / ROW_SPACING_MM) + 1);
        for (let r = firstRow; r <= lastRow; r++) {
          const y = topY + r * ROW_SPACING_MM;
          if (y < box.minY || y > box.maxY) continue;
          const rowOffset = (r % 2) * ODD_ROW_SHIFT_MM;
          const firstCol = Math.max(0, Math.floor((box.minX - this.x0Mm - rowOffset) / STONE_DIAMETER_MM) - 1);
          const lastCol = Math.min(this.stonesPerRow - 1, Math.ceil((box.maxX - this.x0Mm - rowOffset) / STONE_DIAMETER_MM) + 1);
          for (let c = firstCol; c <= lastCol; c++) {
            const pos = this.getStonePosition(bangleIndex, r, c);
            if (isHoleBlockedByShape(pos.x, pos.y, shape, this.clearanceMm)) mask[r * this.stonesPerRow + c] = 1;
          }
        }
      }
      this._blockedCellCache.set(key, mask);
    }
    return mask[row * this.stonesPerRow + col] === 1;
  }

  invalidateShapeMask() { this._shapeGeometryRevision++; this._blockedCellCache.clear(); }

  getEffectiveStone(bangleIndex, row, col) {
    if (this.isCellBlocked(bangleIndex, row, col)) {
      return STONE_CELL.EMPTY;
    }
    return this.getStone(bangleIndex, row, col);
  }

  /**
   * Shape Management Methods
   */
  addShape(shape) {
    const id = shape.id || ('shape_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    const defaultDim = this.stoneSizes[shape.type] || { length: 10, width: 10 };
    const newShape = {
      id,
      type: shape.type,
      x: shape.x ?? SHEET_CENTER_X_MM,
      y: shape.y ?? (USABLE_Y_MIN_MM + USABLE_HEIGHT_MM / 2),
      length: shape.length ?? defaultDim.length,
      width: shape.width ?? defaultDim.width,
      rotation: shape.rotation ?? 0,
      flipX: !!shape.flipX,
      flipY: !!shape.flipY
    };
    newShape._cachedPoly = getStoneLocalPolygon(newShape.type, newShape.length, newShape.width);
    this.shapes.push(newShape);
    this.invalidateShapeMask();
    this.selectedShapeId = id;
    return newShape;
  }

  updateShape(id, props) {
    const shape = this.shapes.find(s => s.id === id);
    if (!shape) return false;

    let polyDirty = false;
    if (props.type !== undefined && props.type !== shape.type) {
      shape.type = props.type;
      polyDirty = true;
    }
    if (props.length !== undefined && props.length !== shape.length) {
      shape.length = props.length;
      polyDirty = true;
    }
    if (props.width !== undefined && props.width !== shape.width) {
      shape.width = props.width;
      polyDirty = true;
    }
    if (props.x !== undefined) shape.x = props.x;
    if (props.y !== undefined) shape.y = props.y;
    if (props.rotation !== undefined) shape.rotation = props.rotation;
    if (props.flipX !== undefined) shape.flipX = !!props.flipX;
    if (props.flipY !== undefined) shape.flipY = !!props.flipY;

    if (polyDirty || !shape._cachedPoly) {
      shape._cachedPoly = getStoneLocalPolygon(shape.type, shape.length, shape.width);
    }
    this.invalidateShapeMask();
    return true;
  }

  deleteShape(id) {
    const idx = this.shapes.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.shapes.splice(idx, 1);
    this.invalidateShapeMask();
    if (this.selectedShapeId === id) {
      this.selectedShapeId = this.shapes.length > 0 ? this.shapes[this.shapes.length - 1].id : null;
    }
    return true;
  }

  duplicateShape(id, offsetMm = 2.0) {
    const orig = this.shapes.find(s => s.id === id);
    if (!orig) return null;
    const duplicated = {
      id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: orig.type,
      x: orig.x + offsetMm,
      y: orig.y + offsetMm,
      length: orig.length,
      width: orig.width,
      rotation: orig.rotation,
      flipX: orig.flipX,
      flipY: orig.flipY
    };
    duplicated._cachedPoly = getStoneLocalPolygon(duplicated.type, duplicated.length, duplicated.width);
    this.shapes.push(duplicated);
    this.invalidateShapeMask();
    this.selectedShapeId = duplicated.id;
    return duplicated;
  }

  mirrorShape(id, axisXMm = SHEET_CENTER_X_MM) {
    const shape = this.shapes.find(s => s.id === id);
    if (!shape) return false;
    // Mirror position across X = 150mm
    shape.x = 2 * axisXMm - shape.x;
    shape.rotation = (-shape.rotation + 360) % 360;
    shape.flipX = !shape.flipX;
    this.invalidateShapeMask();
    return true;
  }

  repeatShape(id, count = 3, spacingMm = 15.0) {
    const orig = this.shapes.find(s => s.id === id);
    count = Math.max(0, Math.min(100, parseInt(count, 10) || 0));
    if (!orig || count <= 0) return [];

    const newShapes = [];
    for (let i = 1; i <= count; i++) {
      const copy = {
        id: 'shape_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 6),
        type: orig.type,
        x: orig.x + i * spacingMm,
        y: orig.y,
        length: orig.length,
        width: orig.width,
        rotation: orig.rotation,
        flipX: orig.flipX,
        flipY: orig.flipY
      };
      copy._cachedPoly = getStoneLocalPolygon(copy.type, copy.length, copy.width);
      this.shapes.push(copy);
      newShapes.push(copy);
    }
    this.invalidateShapeMask();
    return newShapes;
  }

  /**
   * Ring of stones around a selected hand-set shape:
   * Fills unblocked positions just outside the clearance with chosen colour.
   */
  addRingOfStones(shapeId, color = STONE_CELL.GOLD) {
    const shape = this.shapes.find(s => s.id === shapeId);
    if (!shape) return false;

    const poly = shape._cachedPoly || getStoneLocalPolygon(shape.type, shape.length, shape.width);
    shape._cachedPoly = poly;

    const searchMargin = this.clearanceMm + STONE_DIAMETER_MM * 1.5;
    const bbox = getShapeBoundingBox(shape, searchMargin);

    const rotRad = (-shape.rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    let changed = false;

    for (let b = 0; b < this.bangles.length; b++) {
      const topY = this.getBangleTopY(b);
      const rows = this.bangles[b].rows;
      const btmY = topY + (rows - 1) * ROW_SPACING_MM;

      if (btmY < bbox.minY || topY > bbox.maxY) continue;

      for (let r = 0; r < rows; r++) {
        const rowY = topY + r * ROW_SPACING_MM;
        if (rowY < bbox.minY || rowY > bbox.maxY) continue;

        const rowXOffset = (r % 2) * ODD_ROW_SHIFT_MM;
        for (let c = 0; c < this.stonesPerRow; c++) {
          const stoneX = this.x0Mm + rowXOffset + c * STONE_DIAMETER_MM;
          if (stoneX < bbox.minX || stoneX > bbox.maxX) continue;

          // Blocked by ANY shape outline/clearance? Skip!
          if (this.isHoleBlocked(stoneX, rowY) || this.getStone(b, r, c) !== STONE_CELL.EMPTY) continue;

          // Check distance to THIS shape
          const dx = stoneX - shape.x;
          const dy = rowY - shape.y;
          let lx = dx * cosR - dy * sinR;
          let ly = dx * sinR + dy * cosR;
          if (shape.flipX) lx = -lx;
          if (shape.flipY) ly = -ly;

          const dist = distanceToPolygon(lx, ly, poly);
          if (dist > this.clearanceMm && dist <= this.clearanceMm + STONE_DIAMETER_MM + 0.15) {
            this.setStone(b, r, c, color);
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  /**
   * Count of hand-set stone shapes needed per bangle and for whole sheet
   */
  getHandSetStoneCounts() {
    const types = Object.values(HAND_SET_STONE_TYPES);
    const sheetCounts = {};
    for (const t of types) sheetCounts[t] = 0;

    const bangleCounts = {};
    for (let b = 0; b < this.bangles.length; b++) {
      bangleCounts[b] = {};
      for (const t of types) bangleCounts[b][t] = 0;
    }

    for (const s of this.shapes) {
      if (sheetCounts[s.type] !== undefined) {
        sheetCounts[s.type]++;
      }
      let bestB = 0;
      let minDist = Infinity;
      for (let b = 0; b < this.bangles.length; b++) {
        const topY = this.getBangleTopY(b);
        const rows = this.bangles[b].rows;
        const midY = topY + ((rows - 1) * ROW_SPACING_MM) / 2;
        const d = Math.abs(s.y - midY);
        if (d < minDist) {
          minDist = d;
          bestB = b;
        }
      }
      if (bangleCounts[bestB] && bangleCounts[bestB][s.type] !== undefined) {
        bangleCounts[bestB][s.type]++;
      }
    }

    return {
      sheet: sheetCounts,
      bangles: bangleCounts,
      totalShapes: this.shapes.length
    };
  }

  /**
   * Bangle management
   */
  addBangle(rows = 6, afterIndex = this.selectedBangleIndex) {
    const stonesPerRow = this.stonesPerRow;
    const normalizedRows = Math.max(1, Math.min(60, parseInt(rows, 10) || 1));
    const newBangle = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      rows: normalizedRows,
      data: new Uint8Array(normalizedRows * stonesPerRow)
    };

    if (afterIndex >= 0 && afterIndex < this.bangles.length) {
      this.bangles.splice(afterIndex + 1, 0, newBangle);
      this.selectedBangleIndex = afterIndex + 1;
    } else {
      this.bangles.push(newBangle);
      this.selectedBangleIndex = this.bangles.length - 1;
    }
    return newBangle;
  }

  duplicateBangle(index) {
    if (index < 0 || index >= this.bangles.length) return;
    const original = this.bangles[index];
    const copyData = new Uint8Array(original.data);
    const duplicated = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      rows: original.rows,
      data: copyData
    };
    this.bangles.splice(index + 1, 0, duplicated);
    this.selectedBangleIndex = index + 1;
  }

  deleteBangle(index) {
    if (this.bangles.length <= 1) return; // Keep at least one bangle
    if (index < 0 || index >= this.bangles.length) return;
    this.bangles.splice(index, 1);
    if (this.selectedBangleIndex >= this.bangles.length) {
      this.selectedBangleIndex = this.bangles.length - 1;
    }
  }

  moveBangleUp(index) {
    if (index <= 0 || index >= this.bangles.length) return;
    const temp = this.bangles[index];
    this.bangles[index] = this.bangles[index - 1];
    this.bangles[index - 1] = temp;
    this.selectedBangleIndex = index - 1;
  }

  moveBangleDown(index) {
    if (index < 0 || index >= this.bangles.length - 1) return;
    const temp = this.bangles[index];
    this.bangles[index] = this.bangles[index + 1];
    this.bangles[index + 1] = temp;
    this.selectedBangleIndex = index + 1;
  }

  setBangleRows(index, newRowCount) {
    const bangle = this.bangles[index];
    if (!bangle) return;
    newRowCount = Math.max(1, Math.min(60, parseInt(newRowCount, 10) || 1));
    if (bangle.rows === newRowCount) return;

    const oldRows = bangle.rows;
    const oldData = bangle.data;
    const stonesPerRow = this.stonesPerRow;
    const newData = new Uint8Array(newRowCount * stonesPerRow);

    const copyRows = Math.min(oldRows, newRowCount);
    newData.set(oldData.subarray(0, copyRows * stonesPerRow));

    bangle.rows = newRowCount;
    bangle.data = newData;
  }

  /**
   * Stone counts
   */
  getBangleStoneCounts(index) {
    const counts = { [STONE_CELL.EMPTY]: 0, [STONE_CELL.GREEN]: 0, [STONE_CELL.WHITE]: 0, [STONE_CELL.GOLD]: 0, [STONE_CELL.RUBY]: 0, totalFilled: 0 };
    const bangle = this.bangles[index];
    if (!bangle) return counts;

    for (let i = 0; i < bangle.data.length; i++) {
      const row = Math.floor(i / this.stonesPerRow);
      const col = i % this.stonesPerRow;
      const v = this.getEffectiveStone(index, row, col);
      if (counts[v] !== undefined) counts[v]++;
      if (v !== STONE_CELL.EMPTY) counts.totalFilled++;
    }
    return counts;
  }

  getSheetStoneCounts() {
    const counts = { [STONE_CELL.EMPTY]: 0, [STONE_CELL.GREEN]: 0, [STONE_CELL.WHITE]: 0, [STONE_CELL.GOLD]: 0, [STONE_CELL.RUBY]: 0, totalFilled: 0 };
    for (let b = 0; b < this.bangles.length; b++) {
      const bCounts = this.getBangleStoneCounts(b);
      for (const v of [STONE_CELL.EMPTY, STONE_CELL.GREEN, STONE_CELL.WHITE, STONE_CELL.GOLD, STONE_CELL.RUBY]) counts[v] += bCounts[v];
      counts.totalFilled += bCounts.totalFilled;
    }
    return counts;
  }

  /**
   * Symmetry and Editing Tools
   */
  copyLeftToRight(bangleIndex = null) {
    const targetBangles = bangleIndex !== null ? [this.bangles[bangleIndex]].filter(Boolean) : this.bangles;
    const stones = this.stonesPerRow;
    const half = Math.floor(stones / 2);

    for (const bangle of targetBangles) {
      for (let r = 0; r < bangle.rows; r++) {
        const rowStart = r * stones;
        for (let c = 0; c < half; c++) {
          const mirrorCol = stones - 1 - c;
          bangle.data[rowStart + mirrorCol] = bangle.data[rowStart + c];
        }
      }
    }
  }

  copyRightToLeft(bangleIndex = null) {
    const targetBangles = bangleIndex !== null ? [this.bangles[bangleIndex]].filter(Boolean) : this.bangles;
    const stones = this.stonesPerRow;
    const half = Math.floor(stones / 2);

    for (const bangle of targetBangles) {
      for (let r = 0; r < bangle.rows; r++) {
        const rowStart = r * stones;
        for (let c = 0; c < half; c++) {
          const rightCol = stones - 1 - c;
          bangle.data[rowStart + c] = bangle.data[rowStart + rightCol];
        }
      }
    }
  }

  fillBangle(bangleIndex, color) {
    const bangle = this.bangles[bangleIndex];
    if (!bangle) return;
    bangle.data.fill(color);
  }

  clearBangle(bangleIndex) {
    this.fillBangle(bangleIndex, STONE_CELL.EMPTY);
  }

  /**
   * Resize sheet to new size key
   * mode: 'keep' (preserves stones, new positions filled with green)
   */
  resizeKeepStones(newSizeKey) {
    const newStones = BANGLE_SIZES[newSizeKey]?.stones;
    if (!newStones || newSizeKey === this.sizeKey) return;

    const oldStones = this.stonesPerRow;
    this.sizeKey = newSizeKey;

    for (const bangle of this.bangles) {
      const oldData = bangle.data;
      const newData = new Uint8Array(bangle.rows * newStones);

      for (let r = 0; r < bangle.rows; r++) {
        const oldRowStart = r * oldStones;
        const newRowStart = r * newStones;

        const copyCols = Math.min(oldStones, newStones);
        newData.set(oldData.subarray(oldRowStart, oldRowStart + copyCols), newRowStart);

        // Fill newly added columns with GREEN as required
        if (newStones > oldStones) {
          for (let c = oldStones; c < newStones; c++) {
            newData[newRowStart + c] = STONE_CELL.GREEN;
          }
        }
      }
      bangle.data = newData;
    }
  }

  /**
   * JSON Serialization with RLE encoded strings, shapes and stone sizes
   */
  toJSON() {
    return {
      version: 1,
      appName: 'OrnaCAD',
      size: this.sizeKey,
      stonesPerRow: this.stonesPerRow,
      gap: this.gap,
      clearanceMm: this.clearanceMm,
      stoneSizes: this.stoneSizes,
      shapes: (this.shapes || []).map(s => ({
        id: s.id,
        type: s.type,
        x: s.x,
        y: s.y,
        length: s.length,
        width: s.width,
        rotation: s.rotation || 0,
        flipX: !!s.flipX,
        flipY: !!s.flipY
      })),
      bangles: this.bangles.map(b => ({
        id: b.id,
        rows: b.rows,
        rle: encodeRLE(b.data)
      }))
    };
  }

  /**
   * Load from JSON
   */
  static fromJSON(jsonObj) {
    const sheet = new BangleSheet(jsonObj.size || '2.4', jsonObj.gap ?? DEFAULT_GAP_MM);
    sheet.clearanceMm = (jsonObj.clearanceMm !== undefined) ? jsonObj.clearanceMm : DEFAULT_CLEARANCE_MM;
    sheet.stoneSizes = jsonObj.stoneSizes
      ? JSON.parse(JSON.stringify(jsonObj.stoneSizes))
      : JSON.parse(JSON.stringify(DEFAULT_STONE_SIZES));

    sheet.shapes = (jsonObj.shapes || []).map(s => {
      const copy = {
        id: s.id || ('shape_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
        type: s.type,
        x: s.x,
        y: s.y,
        length: s.length,
        width: s.width,
        rotation: s.rotation || 0,
        flipX: !!s.flipX,
        flipY: !!s.flipY
      };
      copy._cachedPoly = getStoneLocalPolygon(copy.type, copy.length, copy.width);
      return copy;
    });

    sheet.selectedShapeId = sheet.shapes.length > 0 ? sheet.shapes[0].id : null;

    sheet.bangles = (jsonObj.bangles || []).map((b, idx) => {
      const rows = b.rows || 6;
      const expectedLen = rows * sheet.stonesPerRow;
      const data = b.rle ? decodeRLE(b.rle, expectedLen) : new Uint8Array(expectedLen);
      return {
        id: b.id || `b_${idx}_${Date.now()}`,
        rows,
        data
      };
    });
    if (sheet.bangles.length === 0) {
      sheet.addBangle(6);
    }
    sheet.selectedBangleIndex = 0;
    return sheet;
  }

  /**
   * Deep clone for Undo/Redo snapshots
   */
  clone() {
    const copy = new BangleSheet(this.sizeKey, this.gap);
    copy.selectedBangleIndex = this.selectedBangleIndex;
    copy.clearanceMm = this.clearanceMm;
    copy.stoneSizes = JSON.parse(JSON.stringify(this.stoneSizes));
    copy.selectedShapeId = this.selectedShapeId;
    copy.shapes = (this.shapes || []).map(s => ({
      id: s.id,
      type: s.type,
      x: s.x,
      y: s.y,
      length: s.length,
      width: s.width,
      rotation: s.rotation,
      flipX: s.flipX || false,
      flipY: s.flipY || false,
      _cachedPoly: s._cachedPoly
    }));
    copy.bangles = this.bangles.map(b => ({
      id: b.id,
      rows: b.rows,
      data: new Uint8Array(b.data)
    }));
    return copy;
  }
}

export function createBlankSheet(sizeKey = '2.4', bandRows = 24) {
  const sheet = new BangleSheet(sizeKey);
  sheet.addBangle(bandRows, -1);
  return sheet;
}

