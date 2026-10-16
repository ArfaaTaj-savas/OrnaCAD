// High-Performance 60FPS Canvas 2D Renderer for OrnaCAD
// Millimeter-precision world space, viewport culling, and zircon gem rendering

import {
  SHEET_WIDTH_MM,
  SHEET_HEIGHT_MM,
  SHEET_CENTER_X_MM,
  USABLE_Y_MIN_MM,
  USABLE_Y_MAX_MM,
  STONE_RADIUS_MM,
  STONE_DIAMETER_MM,
  STONE_CELL,
  STONE_COLORS,
  ROW_SPACING_MM,
  ODD_ROW_SHIFT_MM,
  TOOL_TYPES
} from '../constants.js';
import { getStoneLocalPolygon, getShapeBoundingBox } from '../models/HandSetShape.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    // Transform: mm -> Screen Pixels
    this.zoom = 3.0; // pixels per mm (300mm sheet = 900px default)
    this.panX = 50;  // screen pixels
    this.panY = 50;  // screen pixels

    // Display options
    this.stoneOpacity = 1.0;
    this.showEmptyDots = true;
    this.showRulers = true;
    this.showGuides = true;

    // Reference tracing image
    this.referenceImage = null; // HTMLImageElement
    this.referenceConfig = {
      visible: true,
      opacity: 0.5,
      xMm: 0,
      yMm: 0,
      widthMm: 300,
      heightMm: null,
      locked: false
    };

    // Hover & Tool preview state
    this.hoverStone = null; // { bangleIndex, row, col, x, y }
    this.hoverMm = { x: 150, y: 150 };
    this.activeTool = TOOL_TYPES.PAINT;
    this.brushRadiusStones = 1;
    this.previewStones = []; // Array of { bangleIndex, row, col, value }
    this.mirrorLR = false;
    this.mirrorTB = false;
  }

  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.scale(dpr, dpr);
    this.screenWidth = width;
    this.screenHeight = height;
  }

  worldToScreen(xMm, yMm) {
    return {
      x: xMm * this.zoom + this.panX,
      y: yMm * this.zoom + this.panY
    };
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom
    };
  }

  fitSheet() {
    const margin = 40;
    const availW = Math.max(100, this.screenWidth - margin * 2);
    const availH = Math.max(100, this.screenHeight - margin * 2);

    const zoomW = availW / SHEET_WIDTH_MM;
    const zoomH = availH / SHEET_HEIGHT_MM;
    this.zoom = Math.min(zoomW, zoomH);

    this.panX = (this.screenWidth - SHEET_WIDTH_MM * this.zoom) / 2;
    this.panY = (this.screenHeight - SHEET_HEIGHT_MM * this.zoom) / 2;
  }

  fitBangle(bangleIndex, bangleSheet) {
    if (!bangleSheet || bangleIndex < 0 || bangleIndex >= bangleSheet.bangles.length) return;
    const topY = bangleSheet.getBangleTopY(bangleIndex);
    const rows = bangleSheet.bangles[bangleIndex].rows;
    const heightMm = Math.max(10, (rows - 1) * ROW_SPACING_MM + 10);
    const widthMm = bangleSheet.bangleWidthMm + 10;

    const margin = 60;
    const availW = Math.max(100, this.screenWidth - margin * 2);
    const availH = Math.max(100, this.screenHeight - margin * 2);

    this.zoom = Math.min(availW / widthMm, availH / heightMm);
    this.panX = this.screenWidth / 2 - SHEET_CENTER_X_MM * this.zoom;
    this.panY = this.screenHeight / 2 - (topY + heightMm / 2) * this.zoom;
  }

  setZoomAtPoint(newZoom, screenX, screenY) {
    const clampedZoom = Math.max(0.4, Math.min(25.0, newZoom));
    const worldBefore = this.screenToWorld(screenX, screenY);
    this.zoom = clampedZoom;
    this.panX = screenX - worldBefore.x * this.zoom;
    this.panY = screenY - worldBefore.y * this.zoom;
  }

  render(bangleSheet) {
    const ctx = this.ctx;
    const width = this.screenWidth;
    const height = this.screenHeight;

    // Viewport bounds in world mm for culling
    const viewMinX = -this.panX / this.zoom;
    const viewMaxX = (width - this.panX) / this.zoom;
    const viewMinY = -this.panY / this.zoom;
    const viewMaxY = (height - this.panY) / this.zoom;

    // 1. Clear Canvas with dark CNC workshop spoilboard slate
    ctx.fillStyle = '#0f1319';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw 300x300mm Sheet Surface
    const sheetScreen = this.worldToScreen(0, 0);
    const sheetW = SHEET_WIDTH_MM * this.zoom;
    const sheetH = SHEET_HEIGHT_MM * this.zoom;

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#161b22';
    ctx.fillRect(sheetScreen.x, sheetScreen.y, sheetW, sheetH);
    ctx.restore();

    // Sheet metallic border
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sheetScreen.x, sheetScreen.y, sheetW, sheetH);

    // 3. Draw Usable Area (Y 13.815 to Y 286.185)
    if (this.showGuides) {
      const topGuide = this.worldToScreen(0, USABLE_Y_MIN_MM);
      const btmGuide = this.worldToScreen(0, USABLE_Y_MAX_MM);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(56, 178, 172, 0.4)';
      ctx.lineWidth = 1;

      // Top guide
      ctx.beginPath();
      ctx.moveTo(sheetScreen.x, topGuide.y);
      ctx.lineTo(sheetScreen.x + sheetW, topGuide.y);
      ctx.stroke();

      // Bottom guide
      ctx.beginPath();
      ctx.moveTo(sheetScreen.x, btmGuide.y);
      ctx.lineTo(sheetScreen.x + sheetW, btmGuide.y);
      ctx.stroke();

      // Usable bounds tint
      ctx.fillStyle = 'rgba(56, 178, 172, 0.02)';
      ctx.fillRect(sheetScreen.x, topGuide.y, sheetW, btmGuide.y - topGuide.y);
      ctx.restore();
    }

    // 4. Center Axis (X = 150mm)
    if (this.showGuides) {
      const centerGuide = this.worldToScreen(SHEET_CENTER_X_MM, 0);
      ctx.save();
      ctx.strokeStyle = this.mirrorLR ? 'rgba(99, 179, 237, 0.7)' : 'rgba(160, 174, 192, 0.25)';
      ctx.lineWidth = this.mirrorLR ? 1.8 : 1;
      if (this.mirrorLR) {
        ctx.setLineDash([6, 3]);
      } else {
        ctx.setLineDash([3, 3]);
      }
      ctx.beginPath();
      ctx.moveTo(centerGuide.x, sheetScreen.y);
      ctx.lineTo(centerGuide.x, sheetScreen.y + sheetH);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Reference Picture Tracing (under stones)
    if (this.referenceImage && this.referenceConfig.visible) {
      this.drawReferenceImage(ctx);
    }

    // 6. Draw Bangles, Outlines & Stones
    if (bangleSheet) {
      this.drawBanglesAndStones(ctx, bangleSheet, viewMinX, viewMaxX, viewMinY, viewMaxY);
      this.drawHandSetShapes(ctx, bangleSheet);
    }

    // 7. Draw Tool Preview Stones / Rubberband
    if (this.previewStones && this.previewStones.length > 0) {
      this.drawPreviewStones(ctx, bangleSheet);
    }

    // 8. Draw Hover Stone and Brush Radius Ring
    if (this.hoverStone) {
      this.drawHoverFeedback(ctx, bangleSheet);
    }

    // 9. Draw Millimeter Rulers along edges
    if (this.showRulers) {
      this.drawRulers(ctx, width, height);
    }
  }

  drawReferenceImage(ctx) {
    const cfg = this.referenceConfig;
    const img = this.referenceImage;
    if (!img.complete || img.naturalWidth === 0) return;

    const screenPos = this.worldToScreen(cfg.xMm, cfg.yMm);
    const aspect = img.naturalHeight / img.naturalWidth;
    const screenW = cfg.widthMm * this.zoom;
    const imageHeightMm = Number.isFinite(cfg.heightMm) && cfg.heightMm > 0
      ? cfg.heightMm
      : cfg.widthMm * aspect;
    const screenH = imageHeightMm * this.zoom;

    ctx.save();
    ctx.globalAlpha = cfg.opacity;
    ctx.drawImage(img, screenPos.x, screenPos.y, screenW, screenH);
    ctx.restore();
  }

  drawBanglesAndStones(ctx, sheet, viewMinX, viewMaxX, viewMinY, viewMaxY) {
    const selectedIdx = sheet.selectedBangleIndex;
    const stonesPerRow = sheet.stonesPerRow;
    const stoneRadiusPx = STONE_RADIUS_MM * this.zoom;
    const isSimplified = stoneRadiusPx < 1.8; // Far zoom optimization

    for (let b = 0; b < sheet.bangles.length; b++) {
      const bangle = sheet.bangles[b];
      const rows = bangle.rows;
      const topY = sheet.getBangleTopY(b);
      const bottomY = topY + (rows - 1) * ROW_SPACING_MM;

      // Vertical culling: skip if bangle is off-screen
      if (bottomY + STONE_RADIUS_MM < viewMinY || topY - STONE_RADIUS_MM > viewMaxY) {
        continue;
      }

      const isSelected = (b === selectedIdx);

      // Draw Bangle Label & Background Pill
      const labelXMm = sheet.x0Mm - 14;
      const labelScreen = this.worldToScreen(labelXMm, topY + (rows - 1) * ROW_SPACING_MM / 2);

      // Bangle boundary box
      const leftScreen = this.worldToScreen(sheet.x0Mm - 1.5, topY - 1.2);
      const rightScreen = this.worldToScreen(sheet.x0Mm + sheet.bangleWidthMm + 1.5, bottomY + 1.2);

      ctx.save();
      if (isSelected) {
        // Active Bangle soft border and subtle glow
        ctx.strokeStyle = '#e2aa2c';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(226, 170, 44, 0.04)';
        ctx.fillRect(leftScreen.x, leftScreen.y, rightScreen.x - leftScreen.x, rightScreen.y - leftScreen.y);
        ctx.strokeRect(leftScreen.x, leftScreen.y, rightScreen.x - leftScreen.x, rightScreen.y - leftScreen.y);

        // Mirror T/B axis if active
        if (this.mirrorTB) {
          const midRowY = topY + ((rows - 1) / 2) * ROW_SPACING_MM;
          const midScreen = this.worldToScreen(sheet.x0Mm - 1.5, midRowY);
          ctx.strokeStyle = 'rgba(237, 100, 166, 0.8)';
          ctx.setLineDash([4, 2]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(midScreen.x, midScreen.y);
          ctx.lineTo(rightScreen.x, midScreen.y);
          ctx.stroke();
        }
      } else {
        // Inactive bangle subtle bounding guide
        ctx.strokeStyle = 'rgba(74, 85, 104, 0.3)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(leftScreen.x, leftScreen.y, rightScreen.x - leftScreen.x, rightScreen.y - leftScreen.y);
      }
      ctx.restore();

      // Bangle tag on the left
      ctx.save();
      const bNumStr = `B${(b + 1) < 10 ? '0' + (b + 1) : (b + 1)}`;
      ctx.font = isSelected ? 'bold 11px sans-serif' : '10px sans-serif';
      ctx.fillStyle = isSelected ? '#ffd56b' : '#718096';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${bNumStr} (${rows}R)`, leftScreen.x - 6, labelScreen.y);
      ctx.restore();

      // Draw stones for this bangle
      for (let r = 0; r < rows; r++) {
        const rowY = topY + r * ROW_SPACING_MM;
        if (rowY + STONE_RADIUS_MM < viewMinY || rowY - STONE_RADIUS_MM > viewMaxY) {
          continue; // cull row
        }

        const rowXOffset = (r % 2) * ODD_ROW_SHIFT_MM;
        const rowStartIdx = r * stonesPerRow;

        for (let c = 0; c < stonesPerRow; c++) {
          const stoneX = sheet.x0Mm + rowXOffset + c * STONE_DIAMETER_MM;
          if (stoneX + STONE_RADIUS_MM < viewMinX || stoneX - STONE_RADIUS_MM > viewMaxX) {
            continue; // cull stone
          }

          const val = sheet.getEffectiveStone ? sheet.getEffectiveStone(b, r, c) : bangle.data[rowStartIdx + c];
          const pos = this.worldToScreen(stoneX, rowY);

          this.drawSingleStone(ctx, pos.x, pos.y, stoneRadiusPx, val, isSimplified);
        }
      }
    }
  }

  drawHandSetShapes(ctx, sheet) {
    for (const shape of sheet.shapes || []) {
      const selected = shape.id === sheet.selectedShapeId;
      const points = shape._cachedPoly || getStoneLocalPolygon(shape.type, shape.length, shape.width);
      const rot = shape.rotation * Math.PI / 180;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      ctx.save();
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = shape.flipX ? -p.x : p.x;
        const y = shape.flipY ? -p.y : p.y;
        const s = this.worldToScreen(shape.x + x * cos - y * sin, shape.y + x * sin + y * cos);
        if (!i) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 236, 190, 0.25)';
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffd56b' : 'rgba(255, 236, 190, 0.9)';
      ctx.lineWidth = selected ? 2 : 1.4;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (selected) {
        const box = getShapeBoundingBox(shape);
        const corners = [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]];
        ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(255,213,107,.65)'; ctx.lineWidth = 1;
        const topLeft = this.worldToScreen(box.minX, box.minY), bottomRight = this.worldToScreen(box.maxX, box.maxY);
        ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y); ctx.setLineDash([]);
        for (const [x, y] of corners) { const q = this.worldToScreen(x, y); ctx.fillStyle = '#ffd56b'; ctx.fillRect(q.x - 4, q.y - 4, 8, 8); ctx.strokeStyle = '#252a30'; ctx.strokeRect(q.x - 4, q.y - 4, 8, 8); }
        const rotatePoint = this.worldToScreen(shape.x, box.minY - 10);
        const topMid = this.worldToScreen(shape.x, box.minY);
        ctx.strokeStyle = '#ffd56b'; ctx.beginPath(); ctx.moveTo(topMid.x, topMid.y); ctx.lineTo(rotatePoint.x, rotatePoint.y); ctx.stroke();
        ctx.beginPath(); ctx.arc(rotatePoint.x, rotatePoint.y, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffd56b'; ctx.fill();
      }
      const box = getShapeBoundingBox(shape);
      if (shape.id === sheet.selectedShapeId || (this.hoverMm && this.hoverMm.x >= box.minX && this.hoverMm.x <= box.maxX && this.hoverMm.y >= box.minY && this.hoverMm.y <= box.maxY)) {
        const label = this.worldToScreen(shape.x, shape.y);
        ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff1cc';
        ctx.fillText(`${shape.type} · ${shape.length.toFixed(1)} × ${shape.width.toFixed(1)} mm`, label.x, label.y - Math.max(12, box.height * this.zoom / 2 + 10));
      }
      ctx.restore();
    }
  }

  drawSingleStone(ctx, cx, cy, radiusPx, cellValue, isSimplified) {
    if (cellValue === STONE_CELL.EMPTY) {
      if (this.showEmptyDots) {
        // Empty faint dot drill target
        ctx.fillStyle = 'rgba(74, 85, 104, 0.5)';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0.6, radiusPx * 0.28), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    const colorCfg = STONE_COLORS[cellValue];
    if (!colorCfg) return;

    ctx.save();
    ctx.globalAlpha = this.stoneOpacity;

    if (isSimplified) {
      // Zoomed out optimization
      ctx.fillStyle = colorCfg.hex;
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Realistic Zircon Gemstone with metallic bezel & brilliance facet
    // 1. Dark bezel shadow
    ctx.fillStyle = colorCfg.shadowHex;
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.fill();

    // 2. Main gemstone body
    ctx.fillStyle = colorCfg.hex;
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // 3. Facet shine reflection (radial gradient or top-left sparkle)
    if (radiusPx >= 3.5) {
      const grad = ctx.createRadialGradient(
        cx - radiusPx * 0.3, cy - radiusPx * 0.3, radiusPx * 0.1,
        cx, cy, radiusPx * 0.9
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx * 0.88, 0, Math.PI * 2);
      ctx.fill();

      // Precision drill center hole tick
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.6, radiusPx * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawPreviewStones(ctx, sheet) {
    if (!sheet) return;
    const stoneRadiusPx = STONE_RADIUS_MM * this.zoom;

    ctx.save();
    ctx.globalAlpha = 0.75;

    for (const preview of this.previewStones) {
      const pos = sheet.getStonePosition(preview.bangleIndex, preview.row, preview.col);
      const screenPos = this.worldToScreen(pos.x, pos.y);

      if (preview.value === STONE_CELL.EMPTY) {
        ctx.strokeStyle = '#fc8181';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, stoneRadiusPx * 1.1, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const colorCfg = STONE_COLORS[preview.value];
        ctx.fillStyle = colorCfg ? colorCfg.highlightHex : '#ffffff';
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, stoneRadiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawHoverFeedback(ctx, sheet) {
    const hover = this.hoverStone;
    const stoneRadiusPx = STONE_RADIUS_MM * this.zoom;
    const screenPos = this.worldToScreen(hover.x, hover.y);

    ctx.save();
    // Hover stone highlight
    ctx.strokeStyle = '#63b3ed';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, stoneRadiusPx * 1.25, 0, Math.PI * 2);
    ctx.stroke();

    // Brush circle if radius > 1
    if (this.brushRadiusStones > 1) {
      const brushRadiusPx = this.brushRadiusStones * STONE_DIAMETER_MM * this.zoom * 0.85;
      ctx.strokeStyle = 'rgba(99, 179, 237, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, brushRadiusPx, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRulers(ctx, screenW, screenH) {
    const rulerSize = 22; // px

    ctx.save();
    ctx.fillStyle = '#1a202c';
    // Top ruler bar
    ctx.fillRect(0, 0, screenW, rulerSize);
    // Left ruler bar
    ctx.fillRect(0, 0, rulerSize, screenH);

    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerSize);
    ctx.lineTo(screenW, rulerSize);
    ctx.moveTo(rulerSize, 0);
    ctx.lineTo(rulerSize, screenH);
    ctx.stroke();

    // Top Ruler Ticks (X mm from 0 to 300)
    ctx.fillStyle = '#a0aec0';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const stepMm = this.zoom > 5 ? 10 : (this.zoom > 2 ? 20 : 50);

    for (let mm = 0; mm <= SHEET_WIDTH_MM; mm += stepMm) {
      const screenX = mm * this.zoom + this.panX;
      if (screenX < rulerSize || screenX > screenW) continue;

      ctx.beginPath();
      ctx.moveTo(screenX, rulerSize - 8);
      ctx.lineTo(screenX, rulerSize);
      ctx.stroke();
      ctx.fillText(`${mm}`, screenX, 3);
    }

    // Left Ruler Ticks (Y mm from 0 to 300)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let mm = 0; mm <= SHEET_HEIGHT_MM; mm += stepMm) {
      const screenY = mm * this.zoom + this.panY;
      if (screenY < rulerSize || screenY > screenH) continue;

      ctx.beginPath();
      ctx.moveTo(rulerSize - 8, screenY);
      ctx.lineTo(rulerSize, screenY);
      ctx.stroke();
      ctx.fillText(`${mm}`, rulerSize - 10, screenY);
    }

    // Top-left corner box
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, rulerSize, rulerSize);
    ctx.fillStyle = '#e2aa2c';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('mm', rulerSize / 2, rulerSize / 2);

    ctx.restore();
  }
}
