// Motif Stamp Generator for OrnaCAD
// 18 bangles, 172 rows total for Size 2.4 (and scalable to 2.6, 2.8, 2.10)
// Bangles 4 and 15 (24 rows) feature sunflowers with empty circular areas (no holes) for hand-set gold petals

import {
  BANGLE_SIZES,
  SAMPLE_LAYOUT_ROWS,
  DEFAULT_GAP_MM,
  STONE_CELL,
  ROW_SPACING_MM,
  STONE_DIAMETER_MM
} from './constants.js';
import { BangleSheet } from './models/BangleSheet.js';
import { VINTAGE_BANGLES_DATA } from './samples/vintageBanglesData.js';

export function createSampleSheet(sizeKey = '2.4') {
  const sheet = new BangleSheet(sizeKey, DEFAULT_GAP_MM);
  const stones = sheet.stonesPerRow;

  // Initialize all 18 bangles with specified row counts
  sheet.bangles = SAMPLE_LAYOUT_ROWS.map((rows, idx) => {
    return {
      id: `bangle_${idx + 1}`,
      rows,
      data: new Uint8Array(rows * stones)
    };
  });
  sheet.selectedBangleIndex = 0;

  // Populate patterns for each bangle
  for (let b = 0; b < sheet.bangles.length; b++) {
    const bangle = sheet.bangles[b];
    const rows = bangle.rows;
    const bNum = b + 1; // 1-indexed bangle number

    if (bNum === 4 || bNum === 15) {
      // 24-row Sunflower Masterpiece with empty hand-set circular areas
      populateSunflowerBangle(bangle, stones);
    } else if (bNum === 11) {
      // 16-row Regal Peacock / Lotus medallion bangle
      populateRegalMedallionBangle(bangle, stones);
    } else if (rows === 6) {
      // 6-row border or braided bands
      populate6RowBangle(bangle, stones, bNum);
    } else if (rows === 10) {
      // 10-row lattice or floral wave bands
      populate10RowBangle(bangle, stones, bNum);
    } else if (rows === 5) {
      // 5-row micro-pavé spacer bands
      populate5RowBangle(bangle, stones, bNum);
    } else if (rows === 7) {
      // 7-row trellis band
      populate7RowBangle(bangle, stones, bNum);
    } else {
      populateDefaultBangle(bangle, stones);
    }
  }

  return sheet;
}

/**
 * Sunflower Bangle (24 rows)
 * Bangles 4 & 15: Repeat sunflowers around circumference.
 * Empty circular area (no holes) around each sunflower center where large gold petal stones are hand-set!
 * Surrounded by a radiant gold ring, white zircon halo, and green background accents.
 */
function populateSunflowerBangle(bangle, stones) {
  const rows = bangle.rows; // 24
  const data = bangle.data;

  // Repeat sunflowers every 26 stones for 130 stones (5 sunflowers)
  const motifPeriod = Math.round(stones / 5);
  const flowerCount = Math.round(stones / motifPeriod);

  // Background base: fill with White zircon (2) with subtle green accents
  data.fill(STONE_CELL.WHITE);

  // Top & bottom border rows: Gold (3) and Green (1)
  for (let c = 0; c < stones; c++) {
    data[0 * stones + c] = STONE_CELL.GOLD;
    data[1 * stones + c] = (c % 2 === 0) ? STONE_CELL.GREEN : STONE_CELL.WHITE;
    data[(rows - 2) * stones + c] = (c % 2 === 0) ? STONE_CELL.GREEN : STONE_CELL.WHITE;
    data[(rows - 1) * stones + c] = STONE_CELL.GOLD;
  }

  // Generate each sunflower
  for (let f = 0; f < flowerCount; f++) {
    const centerCol = Math.round((f + 0.5) * (stones / flowerCount));
    const centerRow = 11.5; // middle of 24 rows (between row 11 and 12)

    for (let r = 2; r < rows - 2; r++) {
      for (let c = 0; c < stones; c++) {
        // Compute circular distance in mm from sunflower center
        // Col distance (wrap around circular bangle if needed)
        let dCol = Math.abs(c - centerCol);
        if (dCol > stones / 2) dCol = stones - dCol;

        const dxMm = dCol * STONE_DIAMETER_MM + ((r % 2) ? 0.85 : 0);
        const dyMm = (r - centerRow) * ROW_SPACING_MM;
        const distMm = Math.sqrt(dxMm * dxMm + dyMm * dyMm);

        const idx = r * stones + c;

        // Radius < 4.2 mm: EMPTY CIRCULAR AREA (no holes) for hand-set gold petal stones!
        if (distMm <= 4.2) {
          data[idx] = STONE_CELL.EMPTY;
        }
        // Radius between 4.2 mm and 6.0 mm: Radiant Gold ring
        else if (distMm <= 6.0) {
          data[idx] = STONE_CELL.GOLD;
        }
        // Radius between 6.0 mm and 8.0 mm: White halo ring with Green tips
        else if (distMm <= 8.2) {
          // Petal tips
          const angle = Math.atan2(dyMm, dxMm);
          const petalFreq = 8;
          const petalWave = Math.sin(angle * petalFreq);
          data[idx] = petalWave > 0.3 ? STONE_CELL.GREEN : STONE_CELL.WHITE;
        }
        // Inter-sunflower decorative diamond
        else if (distMm <= 10.5) {
          if ((r + c) % 4 === 0) {
            data[idx] = STONE_CELL.GOLD;
          }
        }
      }
    }
  }
}

/**
 * 16-row Regal Peacock / Lotus medallion bangle (Bangle 11)
 */
function populateRegalMedallionBangle(bangle, stones) {
  const rows = bangle.rows;
  const data = bangle.data;

  // Diamond lattice base
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < stones; c++) {
      const idx = r * stones + c;
      const mod = (r * 2 + c) % 8;
      if (r === 0 || r === rows - 1) {
        data[idx] = STONE_CELL.GOLD;
      } else if (r === 1 || r === rows - 2) {
        data[idx] = (c % 3 === 0) ? STONE_CELL.GREEN : STONE_CELL.WHITE;
      } else if (mod === 0 || mod === 4) {
        data[idx] = STONE_CELL.GREEN;
      } else if (mod === 1 || mod === 3) {
        data[idx] = STONE_CELL.GOLD;
      } else {
        data[idx] = STONE_CELL.WHITE;
      }
    }
  }
}

/**
 * 6-row Border or braided bands (Bangles 1, 2, 3, 16, 17, 18)
 */
function populate6RowBangle(bangle, stones, bNum) {
  const rows = bangle.rows;
  const data = bangle.data;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < stones; c++) {
      const idx = r * stones + c;
      if (bNum === 1 || bNum === 18) {
        // Outer borders: Green frame with White & Gold chevron
        if (r === 0 || r === 5) {
          data[idx] = STONE_CELL.GREEN;
        } else if ((r + c) % 2 === 0) {
          data[idx] = STONE_CELL.GOLD;
        } else {
          data[idx] = STONE_CELL.WHITE;
        }
      } else if (bNum === 2 || bNum === 17) {
        // White pavé with alternating Green diamonds
        if (r === 0 || r === 5) {
          data[idx] = STONE_CELL.GOLD;
        } else if ((r === 2 || r === 3) && (c % 6 === 0 || c % 6 === 1)) {
          data[idx] = STONE_CELL.GREEN;
        } else {
          data[idx] = STONE_CELL.WHITE;
        }
      } else {
        // Braided twisted rope
        const wave = (r + Math.floor(c / 2)) % 3;
        data[idx] = wave === 0 ? STONE_CELL.GOLD : (wave === 1 ? STONE_CELL.WHITE : STONE_CELL.GREEN);
      }
    }
  }
}

/**
 * 10-row lattice or floral wave bands (Bangles 5, 6, 9, 13, 14)
 */
function populate10RowBangle(bangle, stones, bNum) {
  const rows = bangle.rows;
  const data = bangle.data;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < stones; c++) {
      const idx = r * stones + c;
      if (r === 0 || r === rows - 1) {
        data[idx] = STONE_CELL.GOLD;
      } else if (r === 1 || r === rows - 2) {
        data[idx] = STONE_CELL.WHITE;
      } else {
        // Chevron diamond wave
        const wave = (r * 2 + c) % 10;
        if (wave === 0 || wave === 5) {
          data[idx] = STONE_CELL.GREEN;
        } else if (wave === 1 || wave === 4 || wave === 6 || wave === 9) {
          data[idx] = STONE_CELL.GOLD;
        } else {
          data[idx] = STONE_CELL.WHITE;
        }
      }
    }
  }
}

/**
 * 5-row micro-pavé spacer bands (Bangles 7, 10, 12)
 */
function populate5RowBangle(bangle, stones, bNum) {
  const rows = bangle.rows;
  const data = bangle.data;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < stones; c++) {
      const idx = r * stones + c;
      if (r === 0 || r === 4) {
        data[idx] = STONE_CELL.GOLD;
      } else if (r === 2) {
        data[idx] = (c % 2 === 0) ? STONE_CELL.GREEN : STONE_CELL.GOLD;
      } else {
        data[idx] = STONE_CELL.WHITE;
      }
    }
  }
}

/**
 * 7-row trellis band (Bangle 8)
 */
function populate7RowBangle(bangle, stones) {
  const rows = bangle.rows;
  const data = bangle.data;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < stones; c++) {
      const idx = r * stones + c;
      if (r === 0 || r === 6) {
        data[idx] = STONE_CELL.GREEN;
      } else {
        const diag = (r + c) % 4;
        data[idx] = diag === 0 ? STONE_CELL.GOLD : (diag === 2 ? STONE_CELL.GREEN : STONE_CELL.WHITE);
      }
    }
  }
}

function populateDefaultBangle(bangle, stones) {
  bangle.data.fill(STONE_CELL.WHITE);
}

/**
 * Motif stamps library for quick decorative stamping
 */
function drawFeather(matrix, start, end, shaftColor, barbColor, accentColor, peacockEye = false) {
  const h = matrix.length;
  const w = matrix[0].length;
  const dr = end.r - start.r;
  const dc = end.c - start.c;
  const length = Math.hypot(dr, dc);
  const steps = Math.max(1, Math.ceil(length * 2));
  const nr = -dc / length;
  const nc = dr / length;
  const set = (r, c, value) => {
    const rr = Math.round(r);
    const cc = Math.round(c);
    if (rr >= 0 && rr < h && cc >= 0 && cc < w) matrix[rr][cc] = value;
  };
  const line = (a, b, value) => {
    const count = Math.max(1, Math.ceil(Math.hypot(b.r - a.r, b.c - a.c) * 2));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      set(a.r + (b.r - a.r) * t, a.c + (b.c - a.c) * t, value);
    }
  };

  line(start, end, shaftColor);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const r = start.r + dr * t;
    const c = start.c + dc * t;
    const spread = Math.sin(Math.PI * t) * Math.min(4, length * 0.27);
    if (spread < 0.7) continue;
    for (const side of [-1, 1]) {
      const tip = { r: r + nr * spread * side, c: c + nc * spread * side };
      line({ r: r - dr / length * 0.35, c: c - dc / length * 0.35 }, tip, i % 3 === 0 ? accentColor : barbColor);
    }
  }

  if (peacockEye) {
    const eyeR = Math.round(end.r);
    const eyeC = Math.round(end.c);
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const radius = x * x + y * y;
        if (radius <= 5) set(eyeR + y, eyeC + x, radius <= 1 ? STONE_CELL.GOLD : (radius <= 3 ? STONE_CELL.WHITE : STONE_CELL.GREEN));
      }
    }
  }
}

export const MOTIF_STAMPS = [
  {
    id: 'sunflower_cutout',
    name: 'Sunflower with Hand-Set Cutout',
    description: 'Empty center (no holes) for large hand-set gold petal stones, surrounded by gold and white halos',
    widthStones: 15,
    heightRows: 15,
    generate(color = STONE_CELL.GOLD) {
      const w = 15;
      const h = 15;
      const matrix = Array.from({ length: h }, () => new Array(w).fill(null));
      const cr = 7;
      const cc = 7;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const dx = (c - cc) * 1.7;
          const dy = (r - cr) * 1.47224;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= 4.2) {
            matrix[r][c] = STONE_CELL.EMPTY; // Cutout for hand set stone
          } else if (dist <= 6.2) {
            matrix[r][c] = STONE_CELL.GOLD;
          } else if (dist <= 8.5) {
            matrix[r][c] = STONE_CELL.WHITE;
          } else if (dist <= 10.0) {
            matrix[r][c] = STONE_CELL.GREEN;
          }
        }
      }
      return matrix;
    }
  },
  {
    id: 'daisy_rosette',
    name: 'Daisy Rosette',
    description: 'Gold center zircon with 6 white petal zircons and green halo',
    widthStones: 7,
    heightRows: 7,
    generate() {
      const w = 7;
      const h = 7;
      const matrix = Array.from({ length: h }, () => new Array(w).fill(null));
      const cr = 3;
      const cc = 3;
      matrix[cr][cc] = STONE_CELL.GOLD;
      const petals = [
        [-1, -1], [-1, 0], [0, -1], [0, 1], [1, 0], [1, 1]
      ];
      for (const [dr, dc] of petals) {
        matrix[cr + dr][cc + dc] = STONE_CELL.WHITE;
      }
      return matrix;
    }
  },
  {
    id: 'diamond_chevron',
    name: 'Diamond Chevron',
    description: 'Geometric interlocking royal diamond motif in gold & green',
    widthStones: 9,
    heightRows: 5,
    generate() {
      const w = 9;
      const h = 5;
      const matrix = Array.from({ length: h }, () => new Array(w).fill(null));
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const dist = Math.abs(c - 4) + Math.abs(r - 2);
          if (dist === 2) matrix[r][c] = STONE_CELL.GOLD;
          else if (dist === 0) matrix[r][c] = STONE_CELL.GREEN;
          else if (dist === 1) matrix[r][c] = STONE_CELL.WHITE;
        }
      }
      return matrix;
    }
  },
  {
    id: 'peacock_feather',
    name: 'Peacock Eye Feather',
    description: 'Emerald feather barbs with a bright eye and gold quill',
    widthStones: 11,
    heightRows: 17,
    generate() {
      const matrix = Array.from({ length: 17 }, () => new Array(11).fill(null));
      drawFeather(matrix, { r: 16, c: 5 }, { r: 2, c: 5 }, STONE_CELL.GOLD, STONE_CELL.GREEN, STONE_CELL.WHITE, true);
      return matrix;
    }
  },
  {
    id: 'gold_feather',
    name: 'Golden Feather',
    description: 'Slim white and gold feather with an emerald center stem',
    widthStones: 9,
    heightRows: 15,
    generate() {
      const matrix = Array.from({ length: 15 }, () => new Array(9).fill(null));
      drawFeather(matrix, { r: 14, c: 4 }, { r: 1, c: 4 }, STONE_CELL.GREEN, STONE_CELL.WHITE, STONE_CELL.GOLD);
      return matrix;
    }
  },
  {
    id: 'feather_spray',
    name: 'Royal Feather Spray',
    description: 'Three sweeping feathers with gold, white, and green stones',
    widthStones: 17,
    heightRows: 17,
    generate() {
      const matrix = Array.from({ length: 17 }, () => new Array(17).fill(null));
      drawFeather(matrix, { r: 16, c: 8 }, { r: 1, c: 8 }, STONE_CELL.GOLD, STONE_CELL.GREEN, STONE_CELL.WHITE, true);
      drawFeather(matrix, { r: 15, c: 7 }, { r: 5, c: 1 }, STONE_CELL.WHITE, STONE_CELL.GREEN, STONE_CELL.GOLD);
      drawFeather(matrix, { r: 15, c: 9 }, { r: 5, c: 15 }, STONE_CELL.WHITE, STONE_CELL.GREEN, STONE_CELL.GOLD);
      return matrix;
    }
  }
];

/**
 * 14-Bangle Royal Peacock & Emerald Lattice (136 Rows)
 */
export function createPeacockSampleSheet(sizeKey = '2.4') {
  const rowList = [8, 8, 16, 10, 8, 12, 10, 10, 12, 8, 10, 16, 8, 8];
  const sheet = new BangleSheet(sizeKey, DEFAULT_GAP_MM);
  const stones = sheet.stonesPerRow;

  sheet.bangles = rowList.map((rows, idx) => ({
    id: `bangle_${idx + 1}`,
    rows,
    data: new Uint8Array(rows * stones)
  }));
  sheet.selectedBangleIndex = 0;

  for (let b = 0; b < sheet.bangles.length; b++) {
    const bangle = sheet.bangles[b];
    if (bangle.rows === 16) {
      populateRegalMedallionBangle(bangle, stones);
    } else if (bangle.rows === 12 || bangle.rows === 10) {
      populate10RowBangle(bangle, stones, b + 1);
    } else {
      populate6RowBangle(bangle, stones, b + 1);
    }
  }
  sheet.spreadGapsToFit();
  return sheet;
}

/**
 * 12-Bangle Modern Geometric Diamond Trellis (112 Rows)
 */
export function createGeometricSampleSheet(sizeKey = '2.4') {
  const rowList = [6, 10, 12, 8, 14, 10, 10, 14, 8, 12, 10, 6];
  const sheet = new BangleSheet(sizeKey, DEFAULT_GAP_MM);
  const stones = sheet.stonesPerRow;

  sheet.bangles = rowList.map((rows, idx) => ({
    id: `bangle_${idx + 1}`,
    rows,
    data: new Uint8Array(rows * stones)
  }));
  sheet.selectedBangleIndex = 0;

  for (let b = 0; b < sheet.bangles.length; b++) {
    const bangle = sheet.bangles[b];
    if (bangle.rows >= 12) {
      populateRegalMedallionBangle(bangle, stones);
    } else if (bangle.rows >= 8) {
      populate10RowBangle(bangle, stones, b + 1);
    } else {
      populate6RowBangle(bangle, stones, b + 1);
    }
  }
  sheet.spreadGapsToFit();
  return sheet;
}

/**
 * 8-Bangle Classic Eternity Micro-Pavé (80 Rows)
 */
export function createClassicPaveSampleSheet(sizeKey = '2.4') {
  const rowList = [10, 10, 10, 10, 10, 10, 10, 10];
  const sheet = new BangleSheet(sizeKey, DEFAULT_GAP_MM);
  const stones = sheet.stonesPerRow;

  sheet.bangles = rowList.map((rows, idx) => ({
    id: `bangle_${idx + 1}`,
    rows,
    data: new Uint8Array(rows * stones)
  }));
  sheet.selectedBangleIndex = 0;

  for (let b = 0; b < sheet.bangles.length; b++) {
    const bangle = sheet.bangles[b];
    populate10RowBangle(bangle, stones, b + 1);
  }
  sheet.spreadGapsToFit();
  return sheet;
}

/**
 * Twin Sunflower Statement Kadas (2 Bangles, 48 Rows)
 */
export function createTwinKadasSampleSheet(sizeKey = '2.4') {
  const rowList = [24, 24];
  const sheet = new BangleSheet(sizeKey, 30.0);
  const stones = sheet.stonesPerRow;

  sheet.bangles = rowList.map((rows, idx) => ({
    id: `bangle_${idx + 1}`,
    rows,
    data: new Uint8Array(rows * stones)
  }));
  sheet.selectedBangleIndex = 0;

  populateSunflowerBangle(sheet.bangles[0], stones);
  populateSunflowerBangle(sheet.bangles[1], stones);
  sheet.spreadGapsToFit();
  return sheet;
}

/**
 * Exact 7-Bangle Royal Scroll Pattern Sheet (extracted directly from reference image)
 * 7 bangles, 104 rows total.
 */
export function createRoyalScrollExactSheet(sizeKey = '2.4') {
  const sheet = BangleSheet.fromJSON(VINTAGE_BANGLES_DATA);
  sheet.spreadGapsToFit();
  if (sizeKey !== '2.4') {
    sheet.resizeKeepStones(sizeKey);
  }
  return sheet;
}

/** Ruby, diamond, and gold floral lattice inspired by the attached reference. */
export function createRubyBloomSheet(sizeKey = '2.4') {
  const sheet = new BangleSheet(sizeKey, DEFAULT_GAP_MM);
  const stones = sheet.stonesPerRow;
  const rows = 24;
  const period = 26;
  const bangle = {
    id: 'ruby_bloom_band',
    rows,
    data: new Uint8Array(rows * stones)
  };

  for (let r = 0; r < rows; r++) {
    const dy = Math.abs(r - (rows - 1) / 2);
    for (let c = 0; c < stones; c++) {
      const phase = ((c + period / 2) % period + period) % period - period / 2;
      const dx = Math.abs(phase);
      let color = STONE_CELL.RUBY;

      // Fine gold-and-white rails frame the band.
      if (r === 0 || r === rows - 1) color = STONE_CELL.GOLD;
      else if (r === 1 || r === rows - 2) color = c % 2 === 0 ? STONE_CELL.GOLD : STONE_CELL.WHITE;
      else {
        // Repeating gold diamond trellis on a ruby pavé field.
        const lattice = dx / (period / 2) + dy / ((rows - 4) / 2);
        if (Math.abs(lattice - 1) < 0.09) color = STONE_CELL.GOLD;
        else if (lattice < 0.82 && (c + 2 * r) % 9 === 0) color = STONE_CELL.WHITE;

        // White blossoms with gold centers repeat every 26 stones.
        const inFlower = dx <= 2 && dy <= 2.5;
        if (inFlower) {
          if (dx === 0 && dy <= 0.5) color = STONE_CELL.GOLD;
          else if ((dx === 0 && dy <= 2) || (dx === 1 && dy <= 1.5) || (dx === 2 && dy <= 0.5)) {
            color = STONE_CELL.WHITE;
          }
        }
      }

      bangle.data[r * stones + c] = color;
    }
  }

  sheet.bangles = [bangle];
  sheet.selectedBangleIndex = 0;
  return sheet;
}

/** Presets intentionally cleared so each project starts from a blank design. */
export const SAMPLE_PRESETS = Object.freeze([]);
