// OrnaCAD - Constants and Grid Specifications
// Exact physical parameters for zircon SS 4.5 stones and CNC drilling

export const STONE_DIAMETER_MM = 1.7;
export const STONE_RADIUS_MM = 0.85;

// Row spacing in hexagonal close packing: 1.7 * sqrt(3) / 2 = 1.472243... mm
export const ROW_SPACING_MM = 1.47224;

// Odd row horizontal shift
export const ODD_ROW_SHIFT_MM = 0.85;

// Physical CNC Sheet specifications (300 x 300 mm)
export const SHEET_WIDTH_MM = 300.0;
export const SHEET_HEIGHT_MM = 300.0;
export const SHEET_CENTER_X_MM = 150.0;

// Usable stone area
export const USABLE_Y_MIN_MM = 13.815;
export const USABLE_Y_MAX_MM = 286.185;
export const USABLE_HEIGHT_MM = 272.37; // 286.185 - 13.815

// Default gap between bangles to fill 272.37 mm with 172 rows across 18 bangles
export const DEFAULT_GAP_MM = 2.685;

// Bangle sizes (stones per circumference row)
export const BANGLE_SIZES = {
  '2.4': {
    id: '2.4',
    name: '2.4',
    stones: 130,
    label: 'Size 2.4 (130 stones)',
    description: 'Circumference: 130 stones (~221.85 mm width)'
  },
  '2.6': {
    id: '2.6',
    name: '2.6',
    stones: 134,
    label: 'Size 2.6 (134 stones)',
    description: 'Circumference: 134 stones (~228.65 mm width)'
  },
  '2.8': {
    id: '2.8',
    name: '2.8',
    stones: 140,
    label: 'Size 2.8 (140 stones)',
    description: 'Circumference: 140 stones (~238.85 mm width)'
  },
  '2.10': {
    id: '2.10',
    name: '2.10',
    stones: 150,
    label: 'Size 2.10 (150 stones)',
    description: 'Circumference: 150 stones (~255.85 mm width)'
  }
};

// Stone cell values
export const STONE_CELL = {
  EMPTY: 0,
  GREEN: 1,
  WHITE: 2,
  GOLD: 3,
  RUBY: 4
};

// Stone metadata
export const STONE_COLORS = {
  [STONE_CELL.EMPTY]: {
    id: STONE_CELL.EMPTY,
    name: 'Empty',
    code: 'Empty',
    hex: 'transparent',
    dotHex: '#4a5568',
    description: 'No drill hole'
  },
  [STONE_CELL.GREEN]: {
    id: STONE_CELL.GREEN,
    name: 'Green',
    code: 'Green',
    hex: '#106238',
    highlightHex: '#1e8e52',
    shadowHex: '#083920',
    description: 'Green Zircon (SS 4.5)'
  },
  [STONE_CELL.WHITE]: {
    id: STONE_CELL.WHITE,
    name: 'White',
    code: 'White',
    hex: '#F6F6FA',
    highlightHex: '#ffffff',
    shadowHex: '#c7c7d4',
    description: 'White Zircon (SS 4.5)'
  },
  [STONE_CELL.GOLD]: {
    id: STONE_CELL.GOLD,
    name: 'Gold',
    code: 'Gold',
    hex: '#E2AA2C',
    highlightHex: '#ffd56b',
    shadowHex: '#996f13',
    description: 'Gold Zircon (SS 4.5)'
  },
  [STONE_CELL.RUBY]: {
    id: STONE_CELL.RUBY,
    name: 'Ruby',
    code: 'Ruby',
    hex: '#9F1239',
    highlightHex: '#F43F5E',
    shadowHex: '#4C0519',
    dotHex: '#BE123C',
    description: 'Ruby Red Zircon (SS 4.5)'
  }
};

// Sample layout: 18 bangles, 172 rows total
export const SAMPLE_LAYOUT_ROWS = [
  6, 6, 6, 24, 10, 10, 5, 7, 10, 5, 16, 5, 10, 10, 24, 6, 6, 6
];

// Tools enum
export const TOOL_TYPES = {
  PAINT: 'paint',
  ERASE: 'erase',
  FILL: 'fill',
  LINE: 'line',
  RECTANGLE: 'rectangle',
  PICKER: 'picker',
  MOVE: 'move',
  STAMP: 'stamp',
  SELECT_STONE: 'select_stone'
};

export const BRUSH_SIZES = [1, 2, 3, 5, 8];

