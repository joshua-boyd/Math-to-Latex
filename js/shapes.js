// Taught shapes: your own handwritten symbols, matched in the browser.
//
// Matching uses the $P point-cloud recognizer (Vatavu, Anthony & Wobbrock, 2012):
// each shape is resampled to a fixed number of points, scaled and centred, and
// compared as a cloud of points, so stroke order and direction don't matter.
// Orientation and proportions do matter, which keeps ∞ and 8 apart.

const N = 32;
export const MIN_SCORE = 0.8; // 0–1; higher is stricter
// Shared shapes were drawn by other people, so they must match more closely.
export const MIN_SCORE_SHARED = 0.86;
export const MAX_GROUP = 4; // most strokes a taught shape can have

// ---------- geometry ----------

function bbox(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (let i = 0; i < s.x.length; i++) {
      minX = Math.min(minX, s.x[i]);
      maxX = Math.max(maxX, s.x[i]);
      minY = Math.min(minY, s.y[i]);
      maxY = Math.max(maxY, s.y[i]);
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function pathLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].id === points[i - 1].id) d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return d;
}

function resample(points, n) {
  const interval = pathLength(points) / (n - 1);
  if (!interval) return Array.from({ length: n }, () => ({ ...points[0] }));
  const pts = points.map((p) => ({ ...p }));
  const out = [{ ...pts[0] }];
  let D = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id !== pts[i - 1].id) continue;
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= interval && d > 0) {
      const t = (interval - D) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y), id: pts[i].id };
      out.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

/** Turn strokes into a normalized point cloud. */
export function toCloud(strokes) {
  const points = [];
  strokes.forEach((s, id) => s.x.forEach((x, i) => points.push({ x, y: s.y[i], id })));
  const r = resample(points, N);
  const b = bbox([{ x: r.map((p) => p.x), y: r.map((p) => p.y) }]);
  const size = Math.max(b.w, b.h) || 1;
  const scaled = r.map((p) => ({ x: (p.x - b.minX) / size, y: (p.y - b.minY) / size }));
  const cx = scaled.reduce((a, p) => a + p.x, 0) / N;
  const cy = scaled.reduce((a, p) => a + p.y, 0) / N;
  return scaled.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

function cloudDistance(a, b, start) {
  const matched = new Array(N).fill(false);
  let sum = 0;
  let i = start;
  do {
    let min = Infinity, index = -1;
    for (let j = 0; j < N; j++) {
      if (matched[j]) continue;
      const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y);
      if (d < min) {
        min = d;
        index = j;
      }
    }
    matched[index] = true;
    const weight = 1 - ((i - start + N) % N) / N;
    sum += weight * min;
    i = (i + 1) % N;
  } while (i !== start);
  return sum;
}

/** $P distance between two point clouds from toCloud (0 = identical). */
export function cloudMatch(a, b) {
  const step = Math.floor(Math.sqrt(N));
  let min = Infinity;
  for (let i = 0; i < N; i += step) {
    min = Math.min(min, cloudDistance(a, b, i), cloudDistance(b, a, i));
  }
  return min;
}

const aspect = (strokes) => {
  const b = bbox(strokes);
  return Math.log((b.w + 1) / (b.h + 1));
};

// ---------- library ----------

/**
 * A shape: { id, latex, samples: [[{x:[], y:[]}, ...strokes], ...], shared? }
 * Samples are kept as raw strokes so they can be exported and re-imported.
 */
export function prepare(shapes) {
  return shapes.map((shape) => ({
    ...shape,
    prepared: shape.samples.map((strokes) => ({
      strokes: strokes.length,
      aspect: aspect(strokes),
      cloud: toCloud(strokes),
    })),
  }));
}

/**
 * Best match for a set of strokes among prepared shapes, or null.
 * Pass `minScore` to override the usual thresholds (e.g. 0 to always get the closest).
 */
export function bestMatch(strokes, prepared, { minScore } = {}) {
  if (!strokes.length || !prepared.length) return null;
  const cloud = toCloud(strokes);
  const ratio = aspect(strokes);
  let best = null;
  for (const shape of prepared) {
    for (const sample of shape.prepared) {
      if (sample.strokes !== strokes.length) continue;
      // Very different proportions (e.g. wide ∞ vs tall 8) can't be the same shape.
      if (Math.abs(sample.aspect - ratio) > 0.6) continue;
      const score = Math.max(0, 1 - cloudMatch(cloud, sample.cloud) / 4);
      const required = minScore ?? (shape.shared ? MIN_SCORE_SHARED : MIN_SCORE);
      if (score < required) continue;
      if (!best || score > best.score) best = { shape, score };
    }
  }
  return best;
}

// ---------- saving, sharing, import/export ----------

const round = (v) => Math.round(v * 10) / 10;

/** Keep only what matching needs, rounded, so exported files stay small. */
export function compactStrokes(strokes) {
  return strokes.map((s) => ({ x: s.x.map(round), y: s.y.map(round) }));
}

export const FILE_FORMAT = "math-to-latex-shapes";

export function toFile(shapes) {
  return JSON.stringify({
    format: FILE_FORMAT,
    version: 1,
    shapes: shapes.map(({ id, latex, samples }) => ({ id, latex, samples })),
  });
}

/** Parse an exported file. Throws with a readable message if it isn't one. */
export function fromFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a shapes file.");
  }
  if (data?.format !== FILE_FORMAT || !Array.isArray(data.shapes)) throw new Error("That file isn't a shapes file.");
  return data.shapes
    .filter((s) => typeof s.latex === "string" && Array.isArray(s.samples))
    .map((s) => ({ id: String(s.id || newId()), latex: s.latex, samples: s.samples }));
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Merge shapes into a list: same LaTeX → samples combined, duplicates dropped. */
export function merge(into, incoming) {
  const out = into.map((s) => ({ ...s, samples: [...s.samples] }));
  for (const shape of incoming) {
    const existing = out.find((s) => s.latex === shape.latex);
    if (!existing) {
      out.push({ id: shape.id, latex: shape.latex, samples: [...shape.samples] });
      continue;
    }
    const seen = new Set(existing.samples.map((s) => JSON.stringify(s)));
    for (const sample of shape.samples) if (!seen.has(JSON.stringify(sample))) existing.samples.push(sample);
  }
  return out;
}

// ---------- finding taught shapes inside a line ----------

function expand(b, m) {
  return { minX: b.minX - m, minY: b.minY - m, maxX: b.maxX + m, maxY: b.maxY + m };
}

function overlapArea(a, b) {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Find taught shapes in a line of ink. Strokes of one symbol are assumed to be
 * written one after another and to sit apart from their neighbours.
 * @returns {{start:number, count:number, shape:object, score:number, box:object}[]}
 */
export function findShapes(strokes, prepared) {
  const boxes = strokes.map((s) => bbox([s]));
  const candidates = [];
  for (let start = 0; start < strokes.length; start++) {
    for (let count = 1; count <= MAX_GROUP && start + count <= strokes.length; count++) {
      const group = strokes.slice(start, start + count);
      const box = bbox(group);
      const size = Math.max(box.w, box.h, 1);

      // Each stroke must touch the ones before it in the group.
      let compact = true;
      for (let k = 1; k < count && compact; k++) {
        const prev = bbox(group.slice(0, k));
        compact = overlapArea(expand(prev, size * 0.15), boxes[start + k]) > 0;
      }
      if (!compact) break;

      // No stroke outside the group may sit mostly inside it (it would be part of this symbol).
      const isolated = boxes.every((b, j) => {
        if (j >= start && j < start + count) return true;
        const area = Math.max((b.maxX - b.minX) * (b.maxY - b.minY), 1);
        return overlapArea(b, box) / area < 0.5;
      });
      if (!isolated) continue;

      const match = bestMatch(group, prepared);
      if (match) candidates.push({ start, count, ...match, box });
    }
  }

  // Keep the best non-overlapping matches.
  candidates.sort((a, b) => b.score - a.score);
  const used = new Set();
  const chosen = [];
  for (const c of candidates) {
    const idx = Array.from({ length: c.count }, (_, k) => c.start + k);
    if (idx.some((i) => used.has(i))) continue;
    idx.forEach((i) => used.add(i));
    chosen.push(c);
  }
  return chosen.sort((a, b) => a.start - b.start);
}

// ---------- stand-in ----------

// MyScript reads a drawn "#" reliably and it almost never appears in proofs, so a
// taught shape is replaced by a "#" of the same size and position; the "\#" in
// MyScript's answer is then swapped for the taught LaTeX.
export const STAND_IN = "\\#";

export function standInStrokes(box, times) {
  const h = Math.max(box.h, 8);
  const w = Math.max(box.w, h * 0.6);
  const x = box.minX + (box.w - w) / 2;
  const y = box.minY + (box.h - h) / 2;
  const t0 = times[0] ?? Date.now();
  const lines = [
    [0.35, 0, 0.25, 1],
    [0.75, 0, 0.65, 1],
    [0, 0.33, 1, 0.33],
    [0, 0.67, 1, 0.67],
  ];
  return lines.map(([a, b, c, d], k) => {
    const s = { pointerType: "pen", x: [], y: [], t: [], p: [] };
    for (let i = 0; i <= 10; i++) {
      s.x.push(x + (a + (c - a) * (i / 10)) * w);
      s.y.push(y + (b + (d - b) * (i / 10)) * h);
      s.t.push(t0 + k * 100 + i * 8);
      s.p.push(0.5);
    }
    return s;
  });
}

/**
 * Replace the chosen shapes' strokes with stand-ins. Only shapes with one LaTeX
 * value can be swapped per conversion (the "\#"s can't be told apart); others are
 * left for MyScript to read as usual.
 */
export function substitute(strokes, matches) {
  const byLatex = new Map();
  for (const m of matches) byLatex.set(m.shape.latex, [...(byLatex.get(m.shape.latex) || []), m]);
  const [latex, group] = [...byLatex.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const out = [];
  let i = 0;
  for (const m of group) {
    out.push(...strokes.slice(i, m.start));
    out.push(...standInStrokes(m.box, strokes[m.start].t));
    i = m.start + m.count;
  }
  out.push(...strokes.slice(i));
  return { strokes: out, latex, count: group.length };
}

/** Put the taught LaTeX back where MyScript wrote "\#". Returns null if the count doesn't match. */
export function restore(result, latex, count) {
  const found = result.split(STAND_IN).length - 1;
  if (found !== count) return null;
  // A trailing space keeps "\partial f" from becoming "\partialf".
  return result.split(STAND_IN).join(`${latex} `).replace(/\s+/g, " ").trim();
}
