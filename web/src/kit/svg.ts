type Point = readonly [number, number];

/** An SVG path through `pts`, with each corner rounded to radius `r`. */
export function rounded(pts: readonly Point[], r = 9): string {
  let d = 'M' + pts[0][0] + ',' + pts[0][1];
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    if (!l1 || !l2) continue;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    d += ' L' + (x1 - (x1 - x0) / l1 * rr) + ',' + (y1 - (y1 - y0) / l1 * rr) +
         ' Q' + x1 + ',' + y1 + ' ' + (x1 + (x2 - x1) / l2 * rr) + ',' + (y1 + (y2 - y1) / l2 * rr);
  }
  const l = pts[pts.length - 1];
  return d + ' L' + l[0] + ',' + l[1];
}
