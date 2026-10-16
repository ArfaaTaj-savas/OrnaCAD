// Script to analyze vertical stone density in vintage_scroll_bangles.jpg
import fs from 'fs';
import jpeg from 'jpeg-js';

const buf = fs.readFileSync('public/samples/vintage_scroll_bangles.jpg');
const raw = jpeg.decode(buf, { useTArray: true });
console.log(`Image decoded: ${raw.width} x ${raw.height}`);

const width = raw.width;
const height = raw.height;
const data = raw.data;

// Compute average brightness per row
const rowBrightness = new Float32Array(height);
for (let y = 0; y < height; y++) {
  let sum = 0;
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    sum += (r + g + b) / 3;
  }
  rowBrightness[y] = sum / width;
}

// Find bands where brightness > threshold (stones exist)
const threshold = 18; // background is ~12-14
const bands = [];
let inBand = false;
let startY = 0;

for (let y = 0; y < height; y++) {
  if (rowBrightness[y] > threshold && !inBand) {
    inBand = true;
    startY = y;
  } else if (rowBrightness[y] <= threshold && inBand) {
    inBand = false;
    bands.push({ startY, endY: y - 1, height: y - startY });
  }
}
if (inBand) {
  bands.push({ startY, endY: height - 1, height: height - startY });
}

console.log(`Detected ${bands.length} bands:`);
bands.forEach((b, i) => {
  console.log(`Band ${i + 1}: Y ${b.startY} to ${b.endY} (height: ${b.height}px)`);
});
