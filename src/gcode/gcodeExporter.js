// G-Code Generator for CNC Drill (.tap files)
// Strictly follows jewellery industry CNC drill specification with CRLF endings and modal G0 moves

import { STONE_CELL, STONE_COLORS } from '../constants.js';
import JSZip from 'jszip';

const CRLF = '\r\n';

/**
 * Generates G-code string for a list of physical holes
 * holes: Array of { x: number, y: number }
 */
export function generateGcodeForHoles(holes) {
  if (!holes || holes.length === 0) {
    return null; // Do not write file if no stones
  }

  const lines = [];

  // Header lines
  lines.push('T1M6');
  lines.push('G0Z3.000');
  lines.push('G0X0.000Y0.000S15000M3');

  let prevX = '0.000';
  let prevY = '0.000';

  for (let i = 0; i < holes.length; i++) {
    const hole = holes[i];
    const currX = hole.x.toFixed(3);
    const currY = hole.y.toFixed(3);

    let moveLine = 'G0';
    const xChanged = (currX !== prevX);
    const yChanged = (currY !== prevY);

    if (xChanged) moveLine += `X${currX}`;
    if (yChanged) moveLine += `Y${currY}`;

    // Add Z3.000 on the first hole only
    if (i === 0) {
      moveLine += 'Z3.000';
    }

    lines.push(moveLine);

    // Drilling plunge cycle
    lines.push('G0Z2.000');
    lines.push('G1Z-2.000F3000.0');
    lines.push('G0Z3.000');

    prevX = currX;
    prevY = currY;
  }

  // Footer lines
  lines.push('G0X0.000Y0.000');
  lines.push('G0Z3.000');
  lines.push('G0X0Y0');
  lines.push('M30');

  // Return CRLF string
  return lines.join(CRLF) + CRLF;
}

/**
 * Collects holes for a single bangle and specific colour,
 * ordered row by row: left-to-right on even rows, right-to-left on odd rows
 */
export function collectBangleHoles(bangleSheet, bangleIndex, targetColor) {
  const bangle = bangleSheet.bangles[bangleIndex];
  if (!bangle) return [];

  const holes = [];
  const stonesPerRow = bangleSheet.stonesPerRow;

  for (let r = 0; r < bangle.rows; r++) {
    const isEvenRow = (r % 2 === 0);
    if (isEvenRow) {
      // Left to right
      for (let c = 0; c < stonesPerRow; c++) {
        if (bangle.data[r * stonesPerRow + c] === targetColor) {
          const pos = bangleSheet.getStonePosition(bangleIndex, r, c);
          if (bangleSheet.isCellBlocked ? !bangleSheet.isCellBlocked(bangleIndex, r, c) : (!bangleSheet.isHoleBlocked || !bangleSheet.isHoleBlocked(pos.x, pos.y))) {
            holes.push(pos);
          }
        }
      }
    } else {
      // Right to left
      for (let c = stonesPerRow - 1; c >= 0; c--) {
        if (bangle.data[r * stonesPerRow + c] === targetColor) {
          const pos = bangleSheet.getStonePosition(bangleIndex, r, c);
          if (bangleSheet.isCellBlocked ? !bangleSheet.isCellBlocked(bangleIndex, r, c) : (!bangleSheet.isHoleBlocked || !bangleSheet.isHoleBlocked(pos.x, pos.y))) {
            holes.push(pos);
          }
        }
      }
    }
  }

  return holes;
}

/**
 * Collects holes for the entire sheet for a specific colour
 */
export function collectSheetHoles(bangleSheet, targetColor) {
  const allHoles = [];
  for (let b = 0; b < bangleSheet.bangles.length; b++) {
    const bangleHoles = collectBangleHoles(bangleSheet, b, targetColor);
    for (let i = 0; i < bangleHoles.length; i++) {
      allHoles.push(bangleHoles[i]);
    }
  }
  return allHoles;
}

/**
 * Helper to pad bangle index e.g. 0 -> 'B01', 3 -> 'B04'
 */
export function formatBangleId(index) {
  const num = index + 1;
  return `B${num < 10 ? '0' + num : num}`;
}

/**
 * Export drill files for whole sheet as a zip with 3 files (one per colour)
 */
export async function exportSheetZip(bangleSheet) {
  const zip = new JSZip();
  const size = bangleSheet.sizeKey;
  let fileCount = 0;

  const colorKeys = [
    { cell: STONE_CELL.GREEN, name: 'Green' },
    { cell: STONE_CELL.WHITE, name: 'White' },
    { cell: STONE_CELL.GOLD, name: 'Gold' },
    { cell: STONE_CELL.RUBY, name: 'Ruby' }
  ];

  for (const { cell, name } of colorKeys) {
    const holes = collectSheetHoles(bangleSheet, cell);
    if (holes.length > 0) {
      const gcode = generateGcodeForHoles(holes);
      if (gcode) {
        zip.file(`SHEET_${name}_${size}.tap`, gcode);
        fileCount++;
      }
    }
  }

  if (fileCount === 0) {
    throw new Error('No drilled stones found to export in sheet.');
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Export drill files per bangle and colour as a zip
 * Filenames like B04_Gold_2.4.tap
 */
export async function exportBanglesZip(bangleSheet) {
  const zip = new JSZip();
  const size = bangleSheet.sizeKey;
  let fileCount = 0;

  const colorKeys = [
    { cell: STONE_CELL.GREEN, name: 'Green' },
    { cell: STONE_CELL.WHITE, name: 'White' },
    { cell: STONE_CELL.GOLD, name: 'Gold' },
    { cell: STONE_CELL.RUBY, name: 'Ruby' }
  ];

  for (let b = 0; b < bangleSheet.bangles.length; b++) {
    const bId = formatBangleId(b);
    for (const { cell, name } of colorKeys) {
      const holes = collectBangleHoles(bangleSheet, b, cell);
      if (holes.length > 0) {
        const gcode = generateGcodeForHoles(holes);
        if (gcode) {
          zip.file(`${bId}_${name}_${size}.tap`, gcode);
          fileCount++;
        }
      }
    }
  }

  if (fileCount === 0) {
    throw new Error('No drilled stones found to export.');
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Estimates CNC machining time for given holes count
 */
export function estimateDrillTime(holeCount, travelDistanceEstimateMm = 0) {
  if (holeCount === 0) return { seconds: 0, formatted: '0s' };
  // Per hole cycle:
  // G0 Z3 -> Z2 (1mm rapid @ 10000 mm/min = 0.006s)
  // G1 Z2 -> -2 (4mm @ F3000 = 4 / 50 = 0.080s)
  // G0 Z-2 -> Z3 (5mm rapid @ 10000 mm/min = 0.030s)
  // Plus spindle dwell & motor acceleration ~0.15s
  // Total ~0.266s per hole + rapid positioning
  const timePerHoleSeconds = 0.27;
  const rapidTravelSeconds = (holeCount * 1.7) / (8000 / 60); // average jump ~1.7mm
  const totalSeconds = Math.round(holeCount * timePerHoleSeconds + rapidTravelSeconds);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let formatted = '';
  if (hours > 0) formatted += `${hours}h `;
  if (minutes > 0 || hours > 0) formatted += `${minutes}m `;
  formatted += `${seconds}s`;

  return { seconds: totalSeconds, formatted };
}

/**
 * Downloads a single .tap drill file directly without zip
 */
export function downloadSingleTap(bangleSheet, color, bangleIndex = null) {
  const size = bangleSheet.sizeKey;
  const colorNames = {
    [STONE_CELL.GREEN]: 'Green',
    [STONE_CELL.WHITE]: 'White',
    [STONE_CELL.GOLD]: 'Gold',
    [STONE_CELL.RUBY]: 'Ruby'
  };
  const colorName = colorNames[color] || 'Drill';

  let holes = [];
  let filename = '';

  if (bangleIndex !== null) {
    const bId = formatBangleId(bangleIndex);
    holes = collectBangleHoles(bangleSheet, bangleIndex, color);
    filename = `${bId}_${colorName}_${size}.tap`;
  } else {
    holes = collectSheetHoles(bangleSheet, color);
    filename = `SHEET_${colorName}_${size}.tap`;
  }

  if (holes.length === 0) {
    throw new Error(`No ${colorName} stones found to export.`);
  }

  const gcode = generateGcodeForHoles(holes);
  const blob = new Blob([gcode], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
