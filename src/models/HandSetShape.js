// Hand-Set Fancy Stones Geometry and Mathematics
// Generates parametric 96+ point polygons for:
// Rectangle, Four-lobed clover, Pear, Diamond, Triangle

export const HAND_SET_STONE_TYPES = {
  RECTANGLE: 'Rectangle',
  FOUR_LOBED_CLOVER: 'Four-lobed clover',
  PEAR: 'Pear',
  DIAMOND: 'Diamond',
  TRIANGLE: 'Triangle'
};

export const DEFAULT_STONE_SIZES = {
  [HAND_SET_STONE_TYPES.RECTANGLE]: { length: 12.3, width: 4.5 },
  [HAND_SET_STONE_TYPES.FOUR_LOBED_CLOVER]: { length: 9.8, width: 8.9 },
  [HAND_SET_STONE_TYPES.PEAR]: { length: 12.3, width: 6.0 },
  [HAND_SET_STONE_TYPES.DIAMOND]: { length: 10.0, width: 8.5 },
  [HAND_SET_STONE_TYPES.TRIANGLE]: { length: 10.0, width: 9.6 }
};

export const DEFAULT_CLEARANCE_MM = 0.85; // Default radius of 1.7mm drill stone
export const MIN_CLEARANCE_MM = 0.5;
export const MAX_CLEARANCE_MM = 1.5;

/**
 * 1. Rectangle: emerald/baguette cut L x W with 45-deg chamfer c = 0.22 * W
 */
export function generateRectanglePolygon(L, W, targetPoints = 128) {
  const c = Math.min(0.22 * W, L * 0.45, W * 0.45);
  const halfL = L / 2;
  const halfW = W / 2;

  // 8 key vertices of the chamfered rectangle
  const vertices = [
    { x: -halfL + c, y: -halfW },
    { x: halfL - c, y: -halfW },
    { x: halfL, y: -halfW + c },
    { x: halfL, y: halfW - c },
    { x: halfL - c, y: halfW },
    { x: -halfL + c, y: halfW },
    { x: -halfL, y: halfW - c },
    { x: -halfL, y: -halfW + c }
  ];

  // Subdivide evenly into at least targetPoints
  const ptsPerSeg = Math.max(12, Math.ceil(targetPoints / 8));
  const poly = [];

  for (let i = 0; i < 8; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % 8];
    for (let s = 0; s < ptsPerSeg; s++) {
      const t = s / ptsPerSeg;
      poly.push({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
      });
    }
  }

  return poly;
}

/**
 * 2. Four-lobed clover: union of 4 ellipses at (+-0.22 L, +-0.22 W),
 * each with radii (0.28 L, 0.28 W), plus central ellipse (0.30 L, 0.30 W).
 */
export function generateCloverPolygon(L, W, targetPoints = 128) {
  const numPoints = Math.max(96, targetPoints);
  const ellipses = [
    // Center ellipse
    { cx: 0, cy: 0, a: 0.30 * L, b: 0.30 * W },
    // 4 Corner lobes
    { cx: 0.22 * L, cy: 0.22 * W, a: 0.28 * L, b: 0.28 * W },
    { cx: -0.22 * L, cy: 0.22 * W, a: 0.28 * L, b: 0.28 * W },
    { cx: -0.22 * L, cy: -0.22 * W, a: 0.28 * L, b: 0.28 * W },
    { cx: 0.22 * L, cy: -0.22 * W, a: 0.28 * L, b: 0.28 * W }
  ];

  const rawPoly = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < numPoints; i++) {
    const theta = (i * 2 * Math.PI) / numPoints;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    let maxR = 0;
    for (const e of ellipses) {
      // Find intersection of ray (r * cosT, r * sinT) with ellipse:
      // ((r*cosT - cx)/a)^2 + ((r*sinT - cy)/b)^2 = 1
      const invA = 1 / e.a;
      const invB = 1 / e.b;
      const u = cosT * invA;
      const v = sinT * invB;
      const A = u * u + v * v;
      const B = -2 * (e.cx * invA * u + e.cy * invB * v);
      const C = (e.cx * invA) * (e.cx * invA) + (e.cy * invB) * (e.cy * invB) - 1;

      const discr = B * B - 4 * A * C;
      if (discr >= 0) {
        const r1 = (-B + Math.sqrt(discr)) / (2 * A);
        if (r1 > maxR) maxR = r1;
      }
    }

    const px = maxR * cosT;
    const py = maxR * sinT;
    rawPoly.push({ x: px, y: py });
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  // Normalize scale to exact L and W bounds
  const rawW = maxX - minX || 1;
  const rawH = maxY - minY || 1;
  const scaleX = L / rawW;
  const scaleY = W / rawH;

  return rawPoly.map(p => ({
    x: p.x * scaleX,
    y: p.y * scaleY
  }));
}

/**
 * 3. Pear: round end with semicircle radius W/2 centred at (-L/2 + W/2, 0),
 * tip at (+L/2, 0) rounded with radius 0.8 mm.
 * Gently convex curves connect round end to tip.
 * Bounding box is exactly L x W.
 */
export function generatePearPolygon(L, W, targetPoints = 128) {
  const halfL = L / 2;
  const halfW = W / 2;
  const r1 = halfW; // Semicircle radius W/2
  const c1x = -halfL + r1; // Semicircle center x
  const rTip = Math.min(0.8, W * 0.25, L * 0.15); // 0.8 mm tip radius
  const cTipX = halfL - rTip; // Tip circle center x

  const poly = [];
  const arcPoints = Math.floor(targetPoints * 0.4); // 40% points on back semicircle
  const sidePoints = Math.floor((targetPoints - arcPoints) / 2); // 30% each side

  // 1. Semicircle: from angle PI/2 (top: c1x, -r1) counter-clockwise through PI (left: -halfL, 0) to 3*PI/2 (bottom: c1x, +r1)
  // In screen coords (+y down): angle -PI/2 is top (c1x, -halfW), PI is left, +PI/2 is bottom (c1x, +halfW)
  for (let i = 0; i < arcPoints; i++) {
    const t = i / (arcPoints - 1);
    const theta = -Math.PI / 2 - t * Math.PI; // -PI/2 -> -3PI/2 (which is +PI/2)
    poly.push({
      x: c1x + r1 * Math.cos(theta),
      y: r1 * Math.sin(theta)
    });
  }

  // Tip top tangent and bottom tangent
  // Angle of tangent from c1 to tip circle:
  const dx = cTipX - c1x;
  const dyR = r1 - rTip;
  const alpha = Math.asin(Math.max(-0.99, Math.min(0.99, dyR / dx)));
  
  // Tangent point on tip circle:
  const tipTopX = cTipX + rTip * Math.sin(alpha);
  const tipTopY = -rTip * Math.cos(alpha);
  const tipBtmX = tipTopX;
  const tipBtmY = -tipTopY;

  // 2. Bottom connecting curve: from (c1x, +halfW) to (tipBtmX, tipBtmY)
  // With gentle convex curvature (bulge outward by 0.12 * W)
  const pBottomStart = { x: c1x, y: halfW };
  const pBottomEnd = { x: tipBtmX, y: tipBtmY };
  // Control point for subtle convex bulge
  const cpBottom1 = { x: c1x + dx * 0.45, y: halfW * 0.85 };
  const cpBottom2 = { x: c1x + dx * 0.80, y: tipBtmY * 1.35 };

  for (let i = 1; i <= sidePoints; i++) {
    const t = i / (sidePoints + 1);
    // Cubic bezier
    const mt = 1 - t;
    const px = mt*mt*mt * pBottomStart.x + 3*mt*mt*t * cpBottom1.x + 3*mt*t*t * cpBottom2.x + t*t*t * pBottomEnd.x;
    const py = mt*mt*mt * pBottomStart.y + 3*mt*mt*t * cpBottom1.y + 3*mt*t*t * cpBottom2.y + t*t*t * pBottomEnd.y;
    poly.push({ x: px, y: py });
  }

  // 3. Tip rounded arc: from tipBtm to tipTop via rightmost point (+halfL, 0)
  const tipArcPoints = 12;
  const startAng = Math.atan2(tipBtmY, tipBtmX - cTipX);
  const endAng = Math.atan2(tipTopY, tipTopX - cTipX) + (Math.atan2(tipTopY, tipTopX - cTipX) < startAng ? 2 * Math.PI : 0);
  for (let i = 0; i <= tipArcPoints; i++) {
    const t = i / tipArcPoints;
    const ang = startAng + t * (endAng - startAng);
    poly.push({
      x: cTipX + rTip * Math.cos(ang),
      y: rTip * Math.sin(ang)
    });
  }

  // 4. Top connecting curve: from (tipTopX, tipTopY) back to (c1x, -halfW)
  const cpTop1 = { x: cpBottom2.x, y: -cpBottom2.y };
  const cpTop2 = { x: cpBottom1.x, y: -cpBottom1.y };

  for (let i = 1; i <= sidePoints; i++) {
    const t = i / (sidePoints + 1);
    const mt = 1 - t;
    const px = mt*mt*mt * tipTopX + 3*mt*mt*t * cpTop1.x + 3*mt*t*t * cpTop2.x + t*t*t * c1x;
    const py = mt*mt*mt * tipTopY + 3*mt*mt*t * cpTop1.y + 3*mt*t*t * cpTop2.y + t*t*t * (-halfW);
    poly.push({ x: px, y: py });
  }

  // Ensure exact bounding box clamping to L x W
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const curW = maxX - minX || 1;
  const curH = maxY - minY || 1;
  const sX = L / curW;
  const sY = W / curH;

  return poly.map(p => ({
    x: (p.x - (minX + maxX) / 2) * sX,
    y: (p.y - (minY + maxY) / 2) * sY
  }));
}

/**
 * 4. Diamond: rhombus with vertices at (+-L/2, 0) and (0, +-W/2),
 * with all four corners rounded with radius 0.6 mm.
 */
export function generateDiamondPolygon(L, W, targetPoints = 128) {
  const halfL = L / 2;
  const halfW = W / 2;
  const rCorner = Math.min(0.6, L * 0.2, W * 0.2);

  // Rhombus vertices in clockwise order starting from Right (+halfL, 0)
  const V = [
    { x: halfL, y: 0 },
    { x: 0, y: halfW },
    { x: -halfL, y: 0 },
    { x: 0, y: -halfW }
  ];

  const poly = [];
  const ptsPerCorner = Math.max(8, Math.floor(targetPoints / 8));

  for (let i = 0; i < 4; i++) {
    const prev = V[(i + 3) % 4];
    const curr = V[i];
    const next = V[(i + 1) % 4];

    // Direction vectors
    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const len1 = Math.hypot(v1.x, v1.y) || 1;
    const u1 = { x: v1.x / len1, y: v1.y / len1 };

    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const len2 = Math.hypot(v2.x, v2.y) || 1;
    const u2 = { x: v2.x / len2, y: v2.y / len2 };

    // Half angle between edges
    const dot = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    const halfAngle = Math.acos(dot) / 2;
    const dTangent = rCorner / Math.tan(halfAngle);

    // Tangent points on both sides of corner
    const t1 = { x: curr.x + u1.x * dTangent, y: curr.y + u1.y * dTangent };
    const t2 = { x: curr.x + u2.x * dTangent, y: curr.y + u2.y * dTangent };

    // Corner center
    const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bLen = Math.hypot(bisector.x, bisector.y) || 1;
    const cDist = rCorner / Math.sin(halfAngle);
    const center = {
      x: curr.x + (bisector.x / bLen) * cDist,
      y: curr.y + (bisector.y / bLen) * cDist
    };

    // Circular arc from t1 to t2
    const a1 = Math.atan2(t1.y - center.y, t1.x - center.x);
    let a2 = Math.atan2(t2.y - center.y, t2.x - center.x);

    // Ensure shortest / clockwise arc
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;

    for (let s = 0; s < ptsPerCorner; s++) {
      const t = s / ptsPerCorner;
      const ang = a1 + t * da;
      poly.push({
        x: center.x + rCorner * Math.cos(ang),
        y: center.y + rCorner * Math.sin(ang)
      });
    }

    // Connect from t2 to next corner's incoming tangent point
    const nextIdx = (i + 1) % 4;
    const nextV = V[nextIdx];
    const n_v1 = { x: curr.x - nextV.x, y: curr.y - nextV.y };
    const n_len1 = Math.hypot(n_v1.x, n_v1.y) || 1;
    const n_u1 = { x: n_v1.x / n_len1, y: n_v1.y / n_len1 };
    const nextT1 = { x: nextV.x + n_u1.x * dTangent, y: nextV.y + n_u1.y * dTangent };

    for (let s = 0; s < ptsPerCorner; s++) {
      const t = s / ptsPerCorner;
      poly.push({
        x: t2.x + (nextT1.x - t2.x) * t,
        y: t2.y + (nextT1.y - t2.y) * t
      });
    }
  }

  // Normalize scale to exact L and W caliper bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const curW = maxX - minX || 1;
  const curH = maxY - minY || 1;
  const sX = L / curW;
  const sY = W / curH;

  return poly.map(p => ({
    x: (p.x - (minX + maxX) / 2) * sX,
    y: (p.y - (minY + maxY) / 2) * sY
  }));
}

/**
 * 5. Triangle: Apex at (0, -W/2), Base corners at (+-L/2, +W/2).
 * Corners rounded with radius 1.2 mm.
 * Each side bulges outward by 0.35 mm.
 */
export function generateTrianglePolygon(L, W, targetPoints = 128) {
  const halfL = L / 2;
  const halfW = W / 2;
  const bulge = 0.35; // mm outward bulge
  const rCorner = Math.min(1.2, L * 0.2, W * 0.2);

  // 3 vertices: Apex (top), Bottom-Right, Bottom-Left
  const V = [
    { x: 0, y: -halfW },       // Apex
    { x: halfL, y: halfW },    // Bottom-right
    { x: -halfL, y: halfW }    // Bottom-left
  ];

  const poly = [];
  const ptsPerEdge = Math.max(16, Math.floor(targetPoints / 3));

  for (let i = 0; i < 3; i++) {
    const p1 = V[i];
    const p2 = V[(i + 1) % 3];

    // Midpoint and normal for outward bulge
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    // Outward normal (+y down)
    let nx = -dy / len;
    let ny = dx / len;

    // Verify it points away from origin (0, 0)
    if (mx * nx + my * ny < 0) {
      nx = -nx;
      ny = -ny;
    }

    const bulgeMid = {
      x: mx + nx * bulge,
      y: my + ny * bulge
    };

    const cp = {
      x: 2 * bulgeMid.x - 0.5 * (p1.x + p2.x),
      y: 2 * bulgeMid.y - 0.5 * (p1.y + p2.y)
    };

    for (let s = 0; s < ptsPerEdge; s++) {
      const t = s / ptsPerEdge;
      const mt = 1 - t;
      const px = mt * mt * p1.x + 2 * mt * t * cp.x + t * t * p2.x;
      const py = mt * mt * p1.y + 2 * mt * t * cp.y + t * t * p2.y;
      poly.push({ x: px, y: py });
    }
  }

  // Smooth/round corners using moving average filter over corner zones
  const roundedPoly = [];
  const n = poly.length;
  const smoothRadius = Math.max(2, Math.floor(rCorner * 4));

  for (let i = 0; i < n; i++) {
    let sumX = 0, sumY = 0, count = 0;
    for (let k = -smoothRadius; k <= smoothRadius; k++) {
      const idx = (i + k + n) % n;
      const weight = 1 - Math.abs(k) / (smoothRadius + 1);
      sumX += poly[idx].x * weight;
      sumY += poly[idx].y * weight;
      count += weight;
    }
    roundedPoly.push({ x: sumX / count, y: sumY / count });
  }

  // Normalize scale to exact L and W caliper bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of roundedPoly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const curW = maxX - minX || 1;
  const curH = maxY - minY || 1;
  const sX = L / curW;
  const sY = W / curH;

  return roundedPoly.map(p => ({
    x: (p.x - (minX + maxX) / 2) * sX,
    y: (p.y - (minY + maxY) / 2) * sY
  }));
}

/**
 * Dispatcher to get the 2D polygon for any stone shape
 */
export function getStoneLocalPolygon(type, length, width) {
  switch (type) {
    case HAND_SET_STONE_TYPES.RECTANGLE:
      return generateRectanglePolygon(length, width);
    case HAND_SET_STONE_TYPES.FOUR_LOBED_CLOVER:
      return generateCloverPolygon(length, width);
    case HAND_SET_STONE_TYPES.PEAR:
      return generatePearPolygon(length, width);
    case HAND_SET_STONE_TYPES.DIAMOND:
      return generateDiamondPolygon(length, width);
    case HAND_SET_STONE_TYPES.TRIANGLE:
      return generateTrianglePolygon(length, width);
    default:
      return generateRectanglePolygon(length, width);
  }
}

/**
 * Ray casting algorithm for Point-in-Polygon
 */
export function pointInPolygon(px, py, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Minimum Euclidean distance from point (px, py) to polygon perimeter
 */
export function distanceToPolygon(px, py, polygon) {
  let minDistSq = Infinity;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0.0000001) {
      t = ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    const distSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);

    if (distSq < minDistSq) {
      minDistSq = distSq;
    }
  }

  return Math.sqrt(minDistSq);
}

/**
 * Check if a physical hole position (holeX, holeY in mm) is blocked by a placed stone
 * A hole is blocked if its center is inside the outline, or closer to the outline than clearanceMm.
 */
export function isHoleBlockedByShape(holeX, holeY, shape, clearanceMm = DEFAULT_CLEARANCE_MM) {
  // 1. Fast bounding circle/box rejection
  const maxDim = Math.max(shape.length, shape.width) / 2 + clearanceMm + 0.5;
  const dx = holeX - shape.x;
  const dy = holeY - shape.y;
  if (dx * dx + dy * dy > maxDim * maxDim) {
    return false;
  }

  // 2. Transform hole into shape's local coordinate space:
  // Undo rotation and flips
  const rotRad = (-shape.rotation * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  let localX = dx * cosR - dy * sinR;
  let localY = dx * sinR + dy * cosR;

  if (shape.flipX) localX = -localX;
  if (shape.flipY) localY = -localY;

  // 3. Get cached local polygon
  const poly = shape._cachedPoly || getStoneLocalPolygon(shape.type, shape.length, shape.width);

  // Check if inside
  if (pointInPolygon(localX, localY, poly)) {
    return true;
  }

  // Check clearance distance
  const dist = distanceToPolygon(localX, localY, poly);
  return dist <= clearanceMm;
}

/**
 * Compute the bounding box of a placed stone in world mm
 */
export function getShapeBoundingBox(shape, padding = 0) {
  const poly = shape._cachedPoly || getStoneLocalPolygon(shape.type, shape.length, shape.width);
  const rotRad = (shape.rotation * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const p of poly) {
    let lx = shape.flipX ? -p.x : p.x;
    let ly = shape.flipY ? -p.y : p.y;
    const wx = shape.x + lx * cosR - ly * sinR;
    const wy = shape.y + lx * sinR + ly * cosR;

    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }

  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding,
    width: maxX - minX,
    height: maxY - minY
  };
}
