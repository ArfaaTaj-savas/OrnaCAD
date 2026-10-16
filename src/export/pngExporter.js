// High-Resolution PNG Exporter (300 x 300 mm Sheet Render)
// Generates a crisp, print-quality PNG image of the entire sheet with gemstones and measurements

import {
  SHEET_WIDTH_MM,
  SHEET_HEIGHT_MM,
  SHEET_CENTER_X_MM,
  USABLE_Y_MIN_MM,
  USABLE_Y_MAX_MM,
  ROW_SPACING_MM,
  ODD_ROW_SHIFT_MM,
  STONE_DIAMETER_MM,
  STONE_RADIUS_MM,
  STONE_CELL,
  STONE_COLORS
} from '../constants.js';
import { formatBangleId } from '../gcode/gcodeExporter.js';

export function generateSheetPngBlob(bangleSheet, scalePxPerMm = 8) {
  return new Promise((resolve) => {
    // 300mm at 8px/mm = 2400 x 2400 pixels
    const widthPx = SHEET_WIDTH_MM * scalePxPerMm;
    const heightPx = SHEET_HEIGHT_MM * scalePxPerMm;

    const offscreen = document.createElement('canvas');
    offscreen.width = widthPx;
    offscreen.height = heightPx;
    const ctx = offscreen.getContext('2d');

    // 1. Dark Spoilboard Background
    ctx.fillStyle = '#0f1319';
    ctx.fillRect(0, 0, widthPx, heightPx);

    // 2. Sheet Surface (300 x 300 mm)
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, widthPx, heightPx);

    // Border
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 2 * (scalePxPerMm / 3);
    ctx.strokeRect(0, 0, widthPx, heightPx);

    // 3. Usable Area Guides (Y 13.815 to Y 286.185)
    const topYPx = USABLE_Y_MIN_MM * scalePxPerMm;
    const btmYPx = USABLE_Y_MAX_MM * scalePxPerMm;

    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(56, 178, 172, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, topYPx);
    ctx.lineTo(widthPx, topYPx);
    ctx.moveTo(0, btmYPx);
    ctx.lineTo(widthPx, btmYPx);
    ctx.stroke();

    // Center vertical axis (X = 150mm)
    const centerXPx = SHEET_CENTER_X_MM * scalePxPerMm;
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.4)';
    ctx.beginPath();
    ctx.moveTo(centerXPx, 0);
    ctx.lineTo(centerXPx, heightPx);
    ctx.stroke();
    ctx.restore();

    // 4. Draw Bangles and Stones
    const stoneRadiusPx = STONE_RADIUS_MM * scalePxPerMm;
    const stonesPerRow = bangleSheet.stonesPerRow;

    for (let b = 0; b < bangleSheet.bangles.length; b++) {
      const bangle = bangleSheet.bangles[b];
      const rows = bangle.rows;
      const bangleTopY = bangleSheet.getBangleTopY(b);
      const bId = formatBangleId(b);

      // Bangle bounding box outline
      const leftXPx = (bangleSheet.x0Mm - 1.5) * scalePxPerMm;
      const rightXPx = (bangleSheet.x0Mm + bangleSheet.bangleWidthMm + 1.5) * scalePxPerMm;
      const topRowYPx = (bangleTopY - 1.2) * scalePxPerMm;
      const btmRowYPx = (bangleTopY + (rows - 1) * ROW_SPACING_MM + 1.2) * scalePxPerMm;

      ctx.strokeStyle = 'rgba(74, 85, 104, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(leftXPx, topRowYPx, rightXPx - leftXPx, btmRowYPx - topRowYPx);

      // Bangle tag
      ctx.save();
      ctx.font = `bold ${Math.round(11 * (scalePxPerMm / 3))}px sans-serif`;
      ctx.fillStyle = '#ffd56b';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const midYPx = (topRowYPx + btmRowYPx) / 2;
      ctx.fillText(`${bId} (${rows}R)`, leftXPx - 12, midYPx);
      ctx.restore();

      // Render Stones
      for (let r = 0; r < rows; r++) {
        const rowY = bangleTopY + r * ROW_SPACING_MM;
        const rowYPx = rowY * scalePxPerMm;
        const rowXOffset = (r % 2) * ODD_ROW_SHIFT_MM;

        for (let c = 0; c < stonesPerRow; c++) {
          const val = bangle.data[r * stonesPerRow + c];
          const stoneX = bangleSheet.x0Mm + rowXOffset + c * STONE_DIAMETER_MM;
          const stoneXPx = stoneX * scalePxPerMm;

          if (val === STONE_CELL.EMPTY) {
            // Empty faint dot
            ctx.fillStyle = 'rgba(74, 85, 104, 0.4)';
            ctx.beginPath();
            ctx.arc(stoneXPx, rowYPx, Math.max(1, stoneRadiusPx * 0.25), 0, Math.PI * 2);
            ctx.fill();
            continue;
          }

          const colorCfg = STONE_COLORS[val];
          if (!colorCfg) continue;

          // Outer bezel shadow
          ctx.fillStyle = colorCfg.shadowHex;
          ctx.beginPath();
          ctx.arc(stoneXPx, rowYPx, stoneRadiusPx, 0, Math.PI * 2);
          ctx.fill();

          // Main gemstone
          ctx.fillStyle = colorCfg.hex;
          ctx.beginPath();
          ctx.arc(stoneXPx, rowYPx, stoneRadiusPx * 0.88, 0, Math.PI * 2);
          ctx.fill();

          // Highlight shine
          const grad = ctx.createRadialGradient(
            stoneXPx - stoneRadiusPx * 0.3, rowYPx - stoneRadiusPx * 0.3, stoneRadiusPx * 0.1,
            stoneXPx, rowYPx, stoneRadiusPx * 0.9
          );
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
          grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.2)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(stoneXPx, rowYPx, stoneRadiusPx * 0.88, 0, Math.PI * 2);
          ctx.fill();

          // Drill center point
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.arc(stoneXPx, rowYPx, Math.max(1, stoneRadiusPx * 0.2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. Header / Legend Watermark
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(13 * (scalePxPerMm / 3))}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`ORNACAD — SIZE ${bangleSheet.sizeKey} (${bangleSheet.stonesPerRow} STONES/ROW)`, 24, 30);

    const counts = bangleSheet.getSheetStoneCounts();
    ctx.font = `${Math.round(10 * (scalePxPerMm / 3))}px sans-serif`;
    ctx.fillStyle = '#8b949e';
    ctx.fillText(`Green: ${counts[STONE_CELL.GREEN].toLocaleString()} | White: ${counts[STONE_CELL.WHITE].toLocaleString()} | Gold: ${counts[STONE_CELL.GOLD].toLocaleString()} | Ruby: ${counts[STONE_CELL.RUBY].toLocaleString()} | Total: ${counts.totalFilled.toLocaleString()} holes`, 24, 52);
    ctx.restore();

    offscreen.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

export async function downloadSheetPng(bangleSheet) {
  const blob = await generateSheetPngBlob(bangleSheet, 8);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BANGLE_SHEET_${bangleSheet.sizeKey}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
