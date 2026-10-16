// CorelDRAW Compatible SVG Exporter (300 x 300 mm)
// Exact millimeter page dimensions and hierarchical stone grouping

import { STONE_CELL, STONE_COLORS, STONE_RADIUS_MM } from '../constants.js';
import { formatBangleId, collectBangleHoles } from '../gcode/gcodeExporter.js';
import { getStoneLocalPolygon } from '../models/HandSetShape.js';

export function generateSvgForCorelDraw(bangleSheet) {
  const size = bangleSheet.sizeKey;
  const groups = [];

  const colorConfigs = [
    { cell: STONE_CELL.GREEN, name: 'Green', fill: STONE_COLORS[STONE_CELL.GREEN].hex },
    { cell: STONE_CELL.WHITE, name: 'White', fill: STONE_COLORS[STONE_CELL.WHITE].hex },
    { cell: STONE_CELL.GOLD, name: 'Gold', fill: STONE_COLORS[STONE_CELL.GOLD].hex },
    { cell: STONE_CELL.RUBY, name: 'Ruby', fill: STONE_COLORS[STONE_CELL.RUBY].hex }
  ];

  for (let b = 0; b < bangleSheet.bangles.length; b++) {
    const bId = formatBangleId(b);
    const subGroups = [];

    for (const { cell, name, fill } of colorConfigs) {
      const holes = collectBangleHoles(bangleSheet, b, cell);
      if (holes.length > 0) {
        const circles = holes.map(h => {
          return `    <circle cx="${h.x.toFixed(3)}" cy="${h.y.toFixed(3)}" r="${STONE_RADIUS_MM.toFixed(2)}" />`;
        }).join('\n');

        const subGroupId = `${bId}_${name}_${size}`;
        subGroups.push(`  <g id="${subGroupId}" fill="${fill}" stroke="none">\n${circles}\n  </g>`);
      }
    }

    if (subGroups.length > 0) {
      groups.push(`<g id="${bId}">\n${subGroups.join('\n')}\n</g>`);
    }
  }

  const handSetPaths = (bangleSheet.shapes || []).map((shape, index) => {
    const poly = shape._cachedPoly || getStoneLocalPolygon(shape.type, shape.length, shape.width);
    const angle = shape.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const d = poly.map((p, i) => {
      const x = shape.flipX ? -p.x : p.x, y = shape.flipY ? -p.y : p.y;
      const px = shape.x + x * cos - y * sin, py = shape.y + x * sin + y * cos;
      return `${i ? 'L' : 'M'} ${px.toFixed(4)} ${py.toFixed(4)}`;
    }).join(' ') + ' Z';
    return `    <path id="HandSet_${index + 1}_${shape.type.replace(/[^a-z0-9]+/gi, '_')}" d="${d}" fill="none" stroke="#222222" stroke-width="0.15" />`;
  }).join('\n');

  const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="300mm" height="300mm"
     viewBox="0 0 300 300"
     version="1.1">
  <desc>Bangle Stone Setting Sheet (CorelDRAW Vector Cut/Drill Guide) - Size ${size}</desc>
  <!-- 300x300 mm Sheet Boundary Guide -->
  <rect x="0" y="0" width="300" height="300" fill="none" stroke="#666666" stroke-width="0.1" stroke-dasharray="1,1" />
${groups.join('\n')}
  <g id="HandSet_Stones" fill="none" stroke="#222222" stroke-width="0.15">
${handSetPaths}
  </g>
</svg>`;

  return svgContent;
}

export function downloadSvgFile(bangleSheet) {
  const svg = generateSvgForCorelDraw(bangleSheet);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SHEET_CorelDRAW_${bangleSheet.sizeKey}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
