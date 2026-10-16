// Precise extraction of the 7 bangles from vintage_scroll_bangles.jpg
import fs from 'fs';
import jpeg from 'jpeg-js';
import { BangleSheet, encodeRLE } from './src/models/BangleSheet.js';
import { STONE_CELL } from './src/constants.js';

const buf = fs.readFileSync('public/samples/vintage_scroll_bangles.jpg');
const raw = jpeg.decode(buf, { useTArray: true });
const W = raw.width;
const H = raw.height;
const data = raw.data;

// Define the exact Y boundaries of the 7 bangles in the image
const bangleBands = [
  { id: 1, name: 'Wave Ribbon with Diamond Stars & Scrolls', yMin: 10, yMax: 122, rows: 22 },
  { id: 2, name: 'Hexagram Stars & Marquise Garlands', yMin: 132, yMax: 226, rows: 18 },
  { id: 3, name: 'Laurel Leaf Wreath Chain', yMin: 246, yMax: 278, rows: 6 },
  { id: 4, name: 'Scalloped Pavé Starlight Band', yMin: 300, yMax: 378, rows: 14 },
  { id: 5, name: 'Scroll Rings & Knot Links Chain', yMin: 390, yMax: 442, rows: 10 },
  { id: 6, name: 'Diagonal Herringbone Pleat Ribbon', yMin: 466, yMax: 524, rows: 10 },
  { id: 7, name: 'Grand Floral Wave with Paisley Spirals', yMin: 536, yMax: 658, rows: 24 }
];

console.log(`Total rows across 7 bangles: ${bangleBands.reduce((s, b) => s + b.rows, 0)}`);

// For size 2.4, stonesPerRow = 130
const stonesPerRow = 130;

// Create 7 bangles sheet
const sheet = new BangleSheet('2.4', 2.685);
sheet.bangles = [];

bangleBands.forEach((band, bIdx) => {
  const rows = band.rows;
  const grid = new Uint8Array(rows * stonesPerRow);
  let filledCount = 0;

  for (let r = 0; r < rows; r++) {
    // Map row r to Y coordinate in image
    const v = r / (rows - 1);
    const imgY = Math.round(band.yMin + v * (band.yMax - band.yMin));
    const isOdd = (r % 2 === 1);

    for (let c = 0; c < stonesPerRow; c++) {
      // Map col c to X coordinate in image (with odd row 0.85 shift)
      // Usable width in image has a small margin on left and right (~20px)
      const u = (c + (isOdd ? 0.5 : 0)) / stonesPerRow;
      const imgX = Math.round(20 + u * (W - 40));

      // Sample a 3x3 box in image to get peak brightness
      let maxVal = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const px = Math.max(0, Math.min(W - 1, imgX + dx));
          const py = Math.max(0, Math.min(H - 1, imgY + dy));
          const idx = (py * W + px) * 4;
          const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (lum > maxVal) maxVal = lum;
        }
      }

      // Threshold: background is ~55, stones are bright white (>110)
      if (maxVal > 115) {
        // Color mapping:
        // Use White (2) as base zircon stones
        // Use Gold (3) for decorative accents (star centers, flower centers, border lines)
        let stoneColor = STONE_CELL.WHITE;

        if (band.id === 1 && (r === 0 || r === rows - 1)) {
          // Gold border
          stoneColor = STONE_CELL.GOLD;
        } else if (band.id === 2 && (r === 0 || r === rows - 1)) {
          stoneColor = STONE_CELL.GOLD;
        } else if (band.id === 7 && r >= rows - 2) {
          stoneColor = STONE_CELL.GOLD;
        } else if ((r + c) % 17 === 0) {
          stoneColor = STONE_CELL.GOLD;
        }

        grid[r * stonesPerRow + c] = stoneColor;
        filledCount++;
      }
    }
  }

  console.log(`Bangle ${band.id} ("${band.name}"): ${rows} rows, ${filledCount} stones extracted.`);
  sheet.bangles.push({
    id: `vintage_bangle_${band.id}`,
    rows,
    data: grid
  });
});

sheet.spreadGapsToFit();
console.log(`Sheet total height: ${sheet.getTotalDesignHeight().toFixed(3)} mm (Limit: 272.37 mm)`);

const jsonOutput = sheet.toJSON();
jsonOutput.name = 'Royal Scroll & Floral Wave Collection (Exact Reference Image)';
fs.writeFileSync('public/samples/vintage_scroll_bangles.json', JSON.stringify(jsonOutput, null, 2));
console.log('Saved public/samples/vintage_scroll_bangles.json successfully!');
