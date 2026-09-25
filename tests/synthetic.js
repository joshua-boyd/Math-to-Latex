// Synthetic "handwriting" for testing the reader: rough pen strokes for a few
// dozen symbols, drawn with random wobble, slant and size changes.
// Coordinates are in "em": baseline at y = 0, x-height at y = -1 (up is negative).

export const GLYPHS = {
  a: { w: 0.8, s: [[[0.7, -0.8], [0.4, -1], [0.1, -0.7], [0.1, -0.2], [0.4, 0], [0.7, -0.3], [0.7, -1], [0.7, -0.1], [0.8, 0]]] },
  b: { w: 0.8, s: [[[0.1, -1.6], [0.1, 0], [0.1, -0.5], [0.4, -1], [0.7, -0.7], [0.7, -0.3], [0.4, 0], [0.1, -0.2]]] },
  c: { w: 0.75, s: [[[0.7, -0.85], [0.4, -1], [0.1, -0.7], [0.1, -0.3], [0.4, 0], [0.7, -0.15]]] },
  d: { w: 0.8, s: [[[0.7, -0.8], [0.4, -1], [0.1, -0.7], [0.1, -0.2], [0.4, 0], [0.7, -0.3]], [[0.7, -1.6], [0.7, 0]]] },
  e: { w: 0.8, s: [[[0.1, -0.5], [0.7, -0.5], [0.6, -0.9], [0.4, -1], [0.1, -0.8], [0.05, -0.3], [0.3, 0], [0.7, -0.1]]] },
  f: { w: 0.7, s: [[[0.7, -1.5], [0.45, -1.6], [0.3, -1.3], [0.3, 0.5], [0.1, 0.6]], [[0, -0.9], [0.6, -0.9]]] },
  g: { w: 0.8, s: [[[0.7, -0.8], [0.4, -1], [0.1, -0.8], [0.1, -0.3], [0.4, -0.1], [0.7, -0.4], [0.7, -1], [0.7, 0.4], [0.4, 0.6], [0.1, 0.5]]] },
  i: { w: 0.4, s: [[[0.2, -1], [0.2, 0]], [[0.2, -1.4], [0.21, -1.39]]] },
  j: { w: 0.5, s: [[[0.3, -1], [0.3, 0.4], [0.1, 0.6], [0, 0.5]], [[0.3, -1.4], [0.31, -1.39]]] },
  k: { w: 0.7, s: [[[0, -1.6], [0, 0]], [[0.6, -1], [0, -0.4], [0.6, 0]]] },
  l: { w: 0.4, s: [[[0.25, -1.6], [0.15, -0.3], [0.3, 0]]] },
  m: { w: 1.0, s: [[[0, -1], [0, 0], [0, -0.7], [0.25, -1], [0.45, -0.8], [0.45, 0], [0.45, -0.7], [0.7, -1], [0.9, -0.8], [0.9, 0]]] },
  n: { w: 0.7, s: [[[0, -1], [0, 0], [0, -0.7], [0.3, -1], [0.6, -0.8], [0.6, 0]]] },
  o: { w: 0.8, ellipse: [0.4, -0.5, 0.38, 0.5] },
  s: { w: 0.7, s: [[[0.65, -0.9], [0.35, -1], [0.1, -0.8], [0.3, -0.5], [0.6, -0.3], [0.5, -0.05], [0.2, 0], [0.05, -0.15]]] },
  t: { w: 0.6, s: [[[0.3, -1.4], [0.3, -0.1], [0.5, 0]], [[0, -0.9], [0.6, -0.9]]] },
  x: { w: 0.8, s: [[[0, -1], [0.8, 0]], [[0.8, -1], [0, 0]]] },
  y: { w: 0.8, s: [[[0, -1], [0.4, -0.1]], [[0.8, -1], [0.3, 0.6]]] },
  z: { w: 0.8, s: [[[0.05, -1], [0.75, -1], [0.05, 0], [0.8, 0]]] },
  0: { w: 0.8, ellipse: [0.4, -0.8, 0.35, 0.8] },
  1: { w: 0.5, s: [[[0.1, -1.3], [0.3, -1.6], [0.3, 0]]] },
  2: { w: 0.75, s: [[[0.05, -1.3], [0.3, -1.6], [0.6, -1.4], [0.55, -0.9], [0, 0], [0.7, 0]]] },
  3: { w: 0.7, s: [[[0.05, -1.4], [0.35, -1.6], [0.6, -1.3], [0.3, -0.85], [0.65, -0.5], [0.5, -0.05], [0.2, 0], [0, -0.2]]] },
  "+": { w: 0.8, s: [[[0, -0.5], [0.8, -0.5]], [[0.4, -0.9], [0.4, -0.1]]] },
  "-": { w: 0.7, s: [[[0, -0.5], [0.7, -0.5]]] },
  "=": { w: 0.8, s: [[[0, -0.7], [0.8, -0.7]], [[0, -0.3], [0.8, -0.3]]] },
  "(": { w: 0.45, s: [[[0.4, -1.6], [0.1, -0.7], [0.4, 0.3]]] },
  ")": { w: 0.45, s: [[[0.05, -1.6], [0.35, -0.7], [0.05, 0.3]]] },
  ".": { w: 0.25, s: [[[0.1, -0.03], [0.11, -0.02]]] },
  "\\partial": { w: 0.9, s: [[[0.2, -1.4], [0.5, -1.6], [0.8, -1.3], [0.8, -0.5], [0.5, 0], [0.15, -0.2], [0.1, -0.6], [0.4, -0.9], [0.8, -0.7]]] },
  "\\infty": { w: 1.1, lemniscate: [0.55, -0.5, 0.55, 0.45] },
  "\\to": { w: 0.9, s: [[[0, -0.5], [0.9, -0.5]], [[0.7, -0.75], [0.9, -0.5], [0.7, -0.25]]] },
  "\\sum": { w: 1.1, s: [[[1.0, -1.9], [0, -1.9], [0.55, -0.85], [0, 0.2], [1.0, 0.2]]] },
  "\\int": { w: 0.6, s: [[[0.6, -2.0], [0.4, -2.1], [0.3, -1.6], [0.3, 0.3], [0.2, 0.7], [0, 0.6]]] },
  "\\sqrt": { w: 1.6, s: [[[0, -0.6], [0.15, -0.7], [0.35, 0.1], [0.7, -1.75], [1.6, -1.75]]] },
  "\\alpha": { w: 0.9, s: [[[0.85, -1], [0.55, -0.2], [0.3, 0], [0.05, -0.3], [0.1, -0.8], [0.35, -1], [0.6, -0.7], [0.9, 0]]] },
};

let seed = 1;
export function setSeed(s) {
  seed = s;
}
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
const jitter = (a) => (rand() - 0.5) * 2 * a;

function densify(poly, per = 8) {
  const out = [];
  for (let k = 0; k < poly.length - 1; k++) {
    const [x0, y0] = poly[k], [x1, y1] = poly[k + 1];
    for (let i = 0; i < per; i++) out.push([x0 + ((x1 - x0) * i) / per, y0 + ((y1 - y0) * i) / per]);
  }
  out.push(poly[poly.length - 1]);
  return out;
}

function glyphStrokes(g, extraWidth = 0) {
  if (g.ellipse) {
    const [cx, cy, rx, ry] = g.ellipse;
    const start = jitter(0.4);
    return [Array.from({ length: 41 }, (_, i) => {
      const a = start - Math.PI / 2 - (i / 40) * 2 * Math.PI;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    })];
  }
  if (g.lemniscate) {
    const [cx, cy, a, b] = g.lemniscate;
    return [Array.from({ length: 61 }, (_, i) => {
      const t = (i / 60) * 2 * Math.PI;
      const d = 1 + Math.sin(t) ** 2;
      return [cx + (a * Math.cos(t)) / d, cy + (2 * b * Math.sin(t) * Math.cos(t)) / d];
    })];
  }
  return g.s.map((p) => densify(p));
}

/**
 * Draw one symbol like a person would: random slant, rotation, size and wobble.
 * @returns strokes [{x:[], y:[]}] in pixels, and the advance width in pixels
 */
export function draw(label, x, baseline, em, { wobble = 1 } = {}) {
  const g = GLYPHS[label];
  if (!g) throw new Error(`No synthetic glyph for ${label}`);
  const scale = em * (1 + jitter(0.08 * wobble));
  const shear = jitter(0.12 * wobble);
  const rot = jitter(0.06 * wobble);
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const strokes = glyphStrokes(g).map((poly) => {
    const s = { x: [], y: [] };
    for (const [px, py] of poly) {
      const qx = px + shear * -py + jitter(0.025 * wobble);
      const qy = py + jitter(0.025 * wobble);
      s.x.push(x + scale * (cos * qx - sin * qy));
      s.y.push(baseline + scale * (sin * qx + cos * qy));
    }
    return s;
  });
  return { strokes, advance: g.w * scale + em * 0.15 };
}

/** Three wobbly drawings of every glyph, as the site stores taught shapes. */
export function trainingShapes(reps = 3) {
  return Object.keys(GLYPHS).map((label) => ({
    id: label,
    latex: label,
    samples: Array.from({ length: reps }, () => draw(label, 100, 200, 60).strokes),
  }));
}

/**
 * Lay out an expression. Items: a label string, or
 *   {sub: [...]} / {sup: [...]}  (applies to the previous symbol, can nest)
 *   {frac: [num, den]}, {sqrt: [...]}, {limits: label, below: [...], above: [...]}
 */
export function compose(items, { x = 40, baseline = 160, em = 50 } = {}) {
  const strokes = [];
  const probe = (l, em) =>
    l.reduce((w, it) => {
      if (typeof it === "string") return w + GLYPHS[it].w * em + em * 0.15;
      if (it.frac) return w + Math.max(probe(it.frac[0], em), probe(it.frac[1], em)) + em * 0.5;
      if (it.sub || it.sup) return w + probe(it.sub || it.sup, em * 0.62);
      return w + em * 0.6;
    }, 0);
  function row(list, x, baseline, em) {
    for (const item of list) {
      if (typeof item === "string") {
        const d = draw(item, x, baseline, em);
        strokes.push(...d.strokes);
        x += d.advance;
      } else if (item.sub) {
        x = row(item.sub, x - em * 0.05, baseline + em * 0.45, em * 0.62);
      } else if (item.sup) {
        x = row(item.sup, x - em * 0.05, baseline - em * 0.85, em * 0.62);
      } else if (item.frac) {
        const [num, den] = item.frac;
        const w = Math.max(probe(num, em), probe(den, em)) + em * 0.3;
        // Like a person: the numerator's lowest point and the denominator's highest point
        // sit a small gap from the bar.
        const axis = baseline - em * 0.5;
        const gap = () => em * (0.12 + 0.2 * rand());
        row(num, x + (w - probe(num, em)) / 2, axis - gap() - extent(num).bottom * em, em);
        strokes.push(line(x, axis + jitter(em * 0.05), x + w, axis + jitter(em * 0.05)));
        row(den, x + (w - probe(den, em)) / 2, axis + gap() - extent(den).top * em, em);
        x += w + em * 0.2;
      } else if (item.sqrt) {
        const w = probe(item.sqrt, em) + em * 0.2;
        const hook = em * 0.7;
        strokes.push(poly([[x, baseline - em * 0.6], [x + em * 0.15, baseline - em * 0.7], [x + em * 0.35, baseline + em * 0.1], [x + hook, baseline - em * 1.75], [x + hook + w, baseline - em * 1.75]]));
        x = row(item.sqrt, x + hook + em * 0.1, baseline, em) + em * 0.2;
      } else if (item.limits) {
        const d = draw(item.limits, x, baseline, em);
        strokes.push(...d.strokes);
        const mid = x + d.advance / 2;
        if (item.below) row(item.below, mid - em * 0.5, baseline + em * 1.1, em * 0.6);
        if (item.above) row(item.above, mid - em * 0.3, baseline - em * 2.05, em * 0.6);
        x += d.advance + em * 0.1;
      }
    }
    return x;
  }
  row(items, x, baseline, em);
  return strokes;
}

/** Highest and lowest points (in em, relative to the baseline) of a row's plain symbols. */
function extent(list) {
  let top = 0, bottom = 0;
  for (const it of list) {
    if (typeof it !== "string") {
      top = Math.min(top, -1.6);
      bottom = Math.max(bottom, 0.4);
      continue;
    }
    const g = GLYPHS[it];
    const ys = g.ellipse ? [g.ellipse[1] - g.ellipse[3], g.ellipse[1] + g.ellipse[3]]
      : g.lemniscate ? [g.lemniscate[1] - g.lemniscate[3], g.lemniscate[1] + g.lemniscate[3]]
      : g.s.flat().map((p) => p[1]);
    top = Math.min(top, ...ys);
    bottom = Math.max(bottom, ...ys);
  }
  return { top, bottom };
}

function line(x0, y0, x1, y1) {
  return poly([[x0, y0], [x1, y1]], 12);
}

function poly(points, per = 8) {
  const s = { x: [], y: [] };
  for (const [px, py] of densify(points, per)) {
    s.x.push(px + jitter(1));
    s.y.push(py + jitter(1));
  }
  return s;
}
