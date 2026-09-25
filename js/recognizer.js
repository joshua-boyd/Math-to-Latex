// "My handwriting": reads math using only your own drawings of each symbol.
// Everything runs in the browser; nothing is sent anywhere.
//
// 1. Symbols: the strokes (in writing order) are split into groups of 1–4 strokes
//    and each group is compared with your drawings. Dynamic programming picks the
//    split whose groups match best overall.
// 2. Layout: fractions, roots, limits and sub/superscripts (nested too) come from
//    the symbols' sizes and positions, relative to each symbol's own shape (a "g"
//    hangs below the line, a "d" rises above it, a "+" sits in the middle).

import { toCloud, cloudMatch } from "./shapes.js";

const N = 32; // points per resampled shape (matches shapes.js)
const MAX_GROUP = 4; // most strokes in one symbol
const GROUP_COST = 0.06; // cost per symbol; stops the reader splitting shapes needlessly
const SHORTLIST = 28; // drawings compared in full for each candidate group

// ---------- geometry ----------

function boxOf(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (let i = 0; i < s.x.length; i++) {
      if (s.x[i] < minX) minX = s.x[i];
      if (s.x[i] > maxX) maxX = s.x[i];
      if (s.y[i] < minY) minY = s.y[i];
      if (s.y[i] > maxY) maxY = s.y[i];
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function union(a, b) {
  const minX = Math.min(a.minX, b.minX), maxX = Math.max(a.maxX, b.maxX);
  const minY = Math.min(a.minY, b.minY), maxY = Math.max(a.maxY, b.maxY);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function overlaps(a, b, m = 0) {
  return a.minX - m <= b.maxX && b.minX - m <= a.maxX && a.minY - m <= b.maxY && b.minY - m <= a.maxY;
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const percentile = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

// ---------- features ----------

/** The ink in writing order, jumps between strokes included, resampled and normalized. */
function orderedPath(strokes) {
  const pts = [];
  for (const s of strokes) for (let i = 0; i < s.x.length; i++) pts.push([s.x[i], s.y[i]]);
  if (pts.length === 1) pts.push([pts[0][0] + 0.1, pts[0][1] + 0.1]);
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const step = length / (N - 1) || 1;
  const out = [pts[0]];
  let acc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length && out.length < N; i++) {
    let cur = pts[i];
    let d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + d >= step && out.length < N) {
      const t = (step - acc) / d;
      const q = [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])];
      out.push(q);
      prev = q;
      d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      acc = 0;
    }
    acc += d;
    prev = cur;
  }
  while (out.length < N) out.push(pts[pts.length - 1]);
  return normalize(out);
}

function normalize(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const scaled = pts.map(([x, y]) => [(x - minX) / size, (y - minY) / size]);
  const cx = scaled.reduce((a, p) => a + p[0], 0) / scaled.length;
  const cy = scaled.reduce((a, p) => a + p[1], 0) / scaled.length;
  return scaled.map(([x, y]) => [x - cx, y - cy]);
}

/** Where the ink is, on a 6×6 grid: a cheap, order-free first comparison. */
function grid(path) {
  const g = new Float32Array(36);
  for (const [x, y] of path) {
    const i = Math.min(5, Math.max(0, Math.floor((x + 0.5) * 6)));
    const j = Math.min(5, Math.max(0, Math.floor((y + 0.5) * 6)));
    g[j * 6 + i] += 1 / path.length;
  }
  return g;
}

function features(strokes) {
  const box = boxOf(strokes);
  const path = orderedPath(strokes);
  return {
    count: strokes.length,
    aspect: Math.log((box.w + 1) / (box.h + 1)),
    size: Math.max(box.w, box.h),
    path,
    grid: grid(path),
    cloud: toCloud(strokes),
  };
}

function pathDistance(a, b) {
  let d = 0;
  for (let i = 0; i < N; i++) d += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
  return d / N;
}

function gridDistance(a, b) {
  let d = 0;
  for (let i = 0; i < 36; i++) d += Math.abs(a[i] - b[i]);
  return d / 2;
}

// ---------- your alphabet ----------

/**
 * Prepare your drawings ({latex, samples}[] as stored by the site) for matching.
 * Also learns how big you draw each symbol compared with the rest, which tells
 * dots and commas apart from letters.
 */
export function prepareAlphabet(shapes) {
  const samples = [];
  for (const shape of shapes) {
    for (const strokes of shape.samples) {
      if (!strokes.length) continue;
      samples.push({ label: shape.latex, ...features(strokes) });
    }
  }
  const overall = median(samples.map((s) => s.size)) || 1;
  const sizes = new Map();
  for (const s of samples) sizes.set(s.label, [...(sizes.get(s.label) || []), s.size]);
  const relSize = new Map([...sizes].map(([label, list]) => [label, median(list) / overall]));
  return { samples, relSize, labels: [...sizes.keys()], cache: new Map() };
}

const strokePenalty = (a, b) => 0.12 * Math.abs(a - b);
const aspectPenalty = (a, b) => Math.max(0, Math.abs(a - b) - 0.35) * 0.25;
function sizePenalty(rel, labelRel) {
  if (!labelRel || !rel) return 0;
  return Math.max(0, Math.abs(Math.log(rel / labelRel)) - Math.log(2.5)) * 0.3;
}

/** Your symbols ranked by how well they match a group of strokes (lower d = better). */
function classify(f, alphabet, rel) {
  // Dots and commas are told apart from letters by size, not shape: at that size the
  // shape is just noise.
  const tinyLabel = (label) => (alphabet.relSize.get(label) ?? 1) < 0.3;
  const tiny = rel < 0.25;
  let pool = alphabet.samples.filter((s) => tinyLabel(s.label) === tiny);
  if (!pool.length) pool = alphabet.samples;
  const quick = pool.map((s) => ({
    s,
    path: pathDistance(f.path, s.path),
    grid: gridDistance(f.grid, s.grid),
  }));
  const pick = new Set([
    ...[...quick].sort((a, b) => a.path - b.path).slice(0, SHORTLIST / 2),
    ...[...quick].sort((a, b) => a.grid - b.grid).slice(0, SHORTLIST / 2),
  ]);
  const best = new Map();
  for (const { s, path } of pick) {
    const cloud = cloudMatch(f.cloud, s.cloud) / (N / 2);
    const d =
      0.45 * path +
      0.55 * cloud +
      strokePenalty(f.count, s.count) +
      aspectPenalty(f.aspect, s.aspect) +
      sizePenalty(rel, alphabet.relSize.get(s.label));
    if (!best.has(s.label) || d < best.get(s.label)) best.set(s.label, d);
  }
  return [...best].map(([label, d]) => ({ label, d })).sort((a, b) => a.d - b.d);
}

// ---------- splitting ink into symbols ----------

/** Dots written late (like the dot of an i) are moved to just after the stroke they sit on. */
function writingOrder(strokes, boxes, ref) {
  const order = strokes.map((_, i) => i);
  strokes.forEach((_, t) => {
    const b = boxes[t];
    if (Math.max(b.w, b.h) > ref * 0.22) return;
    let host = -1;
    let best = Infinity;
    boxes.forEach((s, i) => {
      if (i === t || Math.max(s.w, s.h) <= ref * 0.22) return;
      const gap = s.minY - b.maxY;
      const within = b.cx >= s.minX - s.h * 0.3 && b.cx <= s.maxX + s.h * 0.3;
      if (!within || gap <= -s.h * 0.2 || gap >= Math.max(s.h, ref * 0.5)) return;
      // Nearest stroke below, counting sideways distance too (an i dot next to a j).
      const sideways = Math.max(0, s.minX - b.cx, b.cx - s.maxX);
      const distance = Math.max(0, gap) + 1.5 * sideways;
      if (distance < best) {
        best = distance;
        host = i;
      }
    });
    if (host === -1) return;
    order.splice(order.indexOf(t), 1);
    order.splice(order.indexOf(host) + 1, 0, t);
  });
  return order;
}

const overlap1d = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

/**
 * Strokes of one symbol either sit over each other (the two lines of =, the dot of
 * an i, the bar of a t) or touch side by side (the arms of a k). Neighbouring
 * letters in a word do neither.
 */
function compact(boxes, ref) {
  let u = boxes[0];
  for (let k = 1; k < boxes.length; k++) {
    const b = boxes[k];
    const xo = overlap1d(u.minX, u.maxX, b.minX, b.maxX);
    const yo = overlap1d(u.minY, u.maxY, b.minY, b.maxY);
    const narrow = Math.max(Math.min(u.w, b.w), ref * 0.05);
    const short = Math.max(Math.min(u.h, b.h), ref * 0.05);
    const size = Math.max(u.w, u.h, b.w, b.h, ref * 0.3);
    // A dot drifts sideways from its stem when you write quickly or slant.
    const dot = Math.max(b.w, b.h) < ref * 0.25 || Math.max(u.w, u.h) < ref * 0.25;
    const stacked = xo >= (dot ? -size * 0.3 : narrow * 0.3) && -yo <= size * 0.65;
    const touching = xo >= -ref * 0.12 && yo >= short * 0.3;
    if (!stacked && !touching) return false;
    u = union(u, b);
  }
  return true;
}

/**
 * A flat stroke with writing both above and below it is a fraction bar. It's kept
 * on its own, so it can't be mistaken for part of a neighbouring symbol.
 */
function fractionBars(strokes, boxes, ref) {
  return boxes.map((b, i) => {
    if (b.w < ref * 0.6 || b.h > b.w * 0.2) return false;
    let above = null, below = null;
    boxes.forEach((o, j) => {
      if (j === i || o.cx < b.minX || o.cx > b.maxX) return;
      if (o.cy < b.cy - ref * 0.1) above = above ? union(above, o) : o;
      else if (o.cy > b.cy + ref * 0.1) below = below ? union(below, o) : o;
    });
    // A fraction bar is about as wide as what it divides; the top line of an "="
    // written under a ∑ is not.
    return !!above && !!below && b.w >= Math.max(above.w, below.w) * 0.7;
  });
}

/**
 * Split strokes into symbols and name each one.
 * @param strokes [{x:[], y:[], id?}]
 * @returns {{groups: {indices:number[], label:string, alternatives:{label,d}[], box}[], ref:number} | null}
 */
export function readSymbols(strokes, alphabet) {
  if (!strokes.length || !alphabet.samples.length) return null;
  const boxes = strokes.map((s) => boxOf([s]));
  const ref = percentile(boxes.map((b) => Math.max(b.w, b.h)), 0.6) || 1;
  const order = writingOrder(strokes, boxes, ref);
  const bars = fractionBars(strokes, boxes, ref);
  const n = order.length;
  const cost = new Array(n + 1).fill(Infinity);
  const back = new Array(n + 1);
  cost[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let k = 1; k <= Math.min(MAX_GROUP, j); k++) {
      const i = j - k;
      if (cost[i] === Infinity) continue;
      const indices = order.slice(i, j);
      if (k > 1 && indices.some((x) => bars[x])) continue;
      if (k > 1 && !compact(indices.map((x) => boxes[x]), ref)) continue;
      const ranked = k === 1 && bars[indices[0]] ? [{ label: "-", d: 0 }] : rank(indices, strokes, boxes, ref, alphabet);
      if (!ranked.length) continue;
      const c = cost[i] + ranked[0].d + GROUP_COST;
      if (c < cost[j]) {
        cost[j] = c;
        back[j] = { i, indices, ranked };
      }
    }
  }
  const groups = [];
  for (let j = n; j > 0; j = back[j].i) {
    const { indices, ranked } = back[j];
    const box = indices.map((x) => boxes[x]).reduce(union);
    groups.unshift({ indices: [...indices].sort((a, b) => a - b), label: ranked[0].label, alternatives: ranked.slice(0, 8), box });
  }
  return { groups, ref };
}

function rank(indices, strokes, boxes, ref, alphabet) {
  const ids = indices.map((i) => strokes[i].id ?? `${i}:${strokes[i].x[0]},${strokes[i].y[0]}`);
  const key = `${ids.join("|")}@${Math.round(ref)}`;
  const hit = alphabet.cache.get(key);
  if (hit) return hit;
  const group = indices.map((i) => strokes[i]);
  const box = indices.map((i) => boxes[i]).reduce(union);
  const ranked = classify(features(group), alphabet, Math.max(box.w, box.h) / ref);
  alphabet.cache.set(key, ranked);
  return ranked;
}

// ---------- layout ----------

const XHEIGHT = new Set([
  ..."acemnorsuvwxz",
  "\\alpha", "\\epsilon", "\\varepsilon", "\\iota", "\\kappa", "\\nu", "\\pi",
  "\\sigma", "\\tau", "\\upsilon", "\\omega", "\\infty",
]);
const DESCENDER = new Set([..."gpqy", "\\gamma", "\\eta", "\\mu", "\\rho", "\\varphi", "\\chi", "\\psi"]);
const BOTH = new Set(["f", "j", "\\beta", "\\zeta", "\\xi", "\\phi"]);
const OPERATORS = new Set([
  "+", "-", "=", "\\times", "\\cdot", "\\pm", "<", ">", "\\le", "\\ge", "\\ne", "\\approx", "\\sim",
  "\\equiv", "\\to", "\\implies", "\\iff", "\\mapsto", "\\in", "\\notin", "\\subset", "\\subseteq",
  "\\supset", "\\supseteq", "\\cup", "\\cap", "\\setminus", "\\neg", "\\land", "\\lor", "/", "\\ast", "*",
]);
const OPENING = new Set(["(", "[", "\\{", "\\langle"]);
const CLOSING = new Set([")", "]", "\\}", "\\rangle", "|", "\\|"]);
const BIG = new Set(["\\sum", "\\prod", "\\int", "\\bigcup", "\\bigcap", "\\sqrt"]);
const LIMITS = new Set(["\\sum", "\\prod", "\\bigcup", "\\bigcap", "\\lim", "\\max", "\\min", "\\sup", "\\inf"]);
const LOW = new Set([".", ","]);
const PRIME = new Set(["'", "\\prime"]);
const CASE_PAIRS = new Set([..."ckopsuvwxz"]);

const FUNCTIONS = [
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "sin", "cos", "tan", "sec", "csc", "cot",
  "log", "ln", "exp", "lim", "max", "min", "sup", "inf", "det", "dim", "ker", "deg", "gcd", "arg",
];

function kindOf(node) {
  if (node.kind !== "sym") return "block";
  const l = node.label;
  if (XHEIGHT.has(l)) return "x";
  if (DESCENDER.has(l)) return "desc";
  if (BOTH.has(l)) return "both";
  if (OPERATORS.has(l)) return "op";
  if (OPENING.has(l)) return "open";
  if (CLOSING.has(l)) return "close";
  if (BIG.has(l)) return "big";
  if (LOW.has(l)) return "low";
  if (PRIME.has(l)) return "prime";
  return "asc"; // capitals, digits, b d h k l t, δ θ λ ∂ ...
}

/** Baseline and x-height implied by a symbol's box and shape. */
function metric(node, X) {
  const { box } = node;
  const h = Math.max(box.h, 1);
  switch (kindOf(node)) {
    case "x": return { base: box.maxY, xh: h };
    case "asc": return { base: box.maxY, xh: h * 0.62 };
    case "desc": return { base: box.minY + h * 0.62, xh: h * 0.62 };
    case "both": return { base: box.minY + h * 0.7, xh: h * 0.45 };
    case "op": {
      const s = Math.max(box.h, box.w * 0.8, X * 0.3);
      return { base: box.cy + 0.5 * s, xh: s };
    }
    case "low": return { base: box.maxY, xh: X };
    default: {
      // brackets, big operators, fractions, roots: centered on the math axis
      const axis = node.axis ?? box.cy;
      return { base: axis + 0.5 * X, xh: X };
    }
  }
}

function xHeight(nodes, ref) {
  const letters = nodes.filter((n) => ["x", "asc", "desc", "both"].includes(kindOf(n)));
  const xs = letters.map((n) => metric(n, ref).xh);
  return median(xs) || median(nodes.map((n) => Math.max(n.box.h, n.box.w) * 0.6)) || ref * 0.6;
}

/** How `n` relates to the symbol `b` before it: same line, superscript or subscript. */
function relation(b, n, X) {
  const kb = kindOf(b);
  const kn = kindOf(n);
  if (kn === "prime") return "sup";
  if (kn === "low" || kb === "op" || kb === "open" || kb === "low") return "right";
  if (kb === "big" || kb === "close") {
    // ∫ and ) take scripts at their top and bottom corners
    if (n.box.h > b.box.h * 0.75) return "right";
    if (n.box.cy < b.box.minY + b.box.h * 0.3) return "sup";
    if (n.box.cy > b.box.maxY - b.box.h * 0.25) return "sub";
    return "right";
  }
  const mb = b.m, mn = n.m;
  const size = mn.xh / mb.xh;
  const dy = (mn.base - mb.base) / mb.xh; // positive = lower
  if ((dy <= -0.5 && size < 0.9) || dy <= -0.95) return "sup";
  if ((dy >= 0.3 && size < 0.9) || dy >= 0.75) return "sub";
  return "right";
}

const center = (n) => n.box.cx;
const within = (n, box, pad) => center(n) >= box.minX - pad && center(n) <= box.maxX + pad;

/** Fraction bars with writing above and below them become fractions (widest first). */
function groupFractions(nodes, X) {
  const bars = nodes.filter((n) => n.kind === "sym" && n.label === "-").sort((a, b) => b.box.w - a.box.w);
  for (const bar of bars) {
    if (!nodes.includes(bar)) continue;
    const pad = bar.box.w * 0.08;
    const near = (n) => n !== bar && within(n, bar.box, pad) && Math.abs(n.box.cy - bar.box.cy) < X * 4;
    const above = nodes.filter((n) => near(n) && n.box.cy < bar.box.cy - X * 0.1);
    const below = nodes.filter((n) => near(n) && n.box.cy > bar.box.cy + X * 0.1);
    if (!above.length || !below.length) continue;
    const width = (list) => list.map((n) => n.box).reduce(union).w;
    if (bar.box.w < Math.max(width(above), width(below)) * 0.7) continue;
    const parts = [bar, ...above, ...below];
    nodes = nodes.filter((n) => !parts.includes(n));
    nodes.push({ kind: "frac", num: above, den: below, box: parts.map((p) => p.box).reduce(union), axis: bar.box.cy });
  }
  return nodes;
}

/** Everything inside a root sign goes under it. */
function groupRoots(nodes) {
  const roots = nodes.filter((n) => n.kind === "sym" && n.label === "\\sqrt").sort((a, b) => b.box.w - a.box.w);
  for (const root of roots) {
    if (!nodes.includes(root)) continue;
    const b = root.box;
    const inside = nodes.filter(
      (n) => n !== root && n.box.cx > b.minX + b.w * 0.15 && n.box.cx < b.maxX && n.box.cy > b.minY && n.box.cy < b.maxY,
    );
    if (!inside.length) continue;
    nodes = nodes.filter((n) => n !== root && !inside.includes(n));
    nodes.push({ kind: "sqrt", content: inside, box: [root.box, ...inside.map((n) => n.box)].reduce(union), axis: b.cy });
  }
  return nodes;
}

/** Letters spelling sin, log, lim, ... become one function name. */
function groupWords(nodes, X) {
  const sorted = [...nodes].sort((a, b) => a.box.minX - b.box.minX);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    let matched = null;
    for (const word of FUNCTIONS) {
      const run = sorted.slice(i, i + word.length);
      if (run.length < word.length) continue;
      if (!run.every((n, k) => n.kind === "sym" && n.label === word[k])) continue;
      const sameLine = run.every((n, k) => {
        if (k === 0) return true;
        const gap = n.box.minX - run[k - 1].box.maxX;
        return relation(run[k - 1], n, X) === "right" && gap < X * 1.2;
      });
      if (sameLine) {
        matched = { word, run };
        break;
      }
    }
    if (matched) {
      out.push({ kind: "sym", label: `\\${matched.word}`, box: matched.run.map((n) => n.box).reduce(union), word: true });
      i += matched.word.length - 1;
    } else out.push(sorted[i]);
  }
  return out;
}

/** Limits written directly above or below ∑, ∏, lim, ... */
function groupLimits(nodes, X) {
  const ops = nodes.filter((n) => n.kind === "sym" && LIMITS.has(n.label));
  for (const op of ops) {
    const b = op.box;
    const pad = Math.max(b.w * 0.3, X * 0.3);
    const reach = Math.max(b.h, X) * 1.6;
    const below = nodes.filter((n) => n !== op && within(n, b, pad) && n.box.minY > b.maxY - b.h * 0.15 && n.box.minY - b.maxY < reach);
    const above = op.word
      ? []
      : nodes.filter((n) => n !== op && within(n, b, pad) && n.box.maxY < b.minY + b.h * 0.15 && b.minY - n.box.maxY < reach);
    if (!below.length && !above.length) continue;
    nodes = nodes.filter((n) => !below.includes(n) && !above.includes(n));
    const i = nodes.indexOf(op);
    nodes[i] = { ...op, kind: "limits", below, above, axis: b.cy };
  }
  return nodes;
}

/** Pick lower or upper case (c/C, o/O, x/X, ...) by size, since the shapes are the same. */
function fixCase(node, X) {
  if (node.kind !== "sym") return node;
  const l = node.label;
  const lower = l.toLowerCase();
  if (!CASE_PAIRS.has(lower)) return node;
  const other = l === lower ? l.toUpperCase() : lower;
  const alt = node.alternatives?.find((a) => a.label === other);
  const cur = node.alternatives?.find((a) => a.label === l);
  if (!alt || !cur || alt.d - cur.d > 0.06) return node;
  const tall = node.box.h > X * 1.3;
  const label = tall ? lower.toUpperCase() : lower;
  return label === l ? node : { ...node, label };
}

/**
 * Dots and small marks look alike; their height on the line decides what they are:
 * on the line "." or ",", halfway up "\cdot", up high a prime.
 */
function placeMarks(nodes, X) {
  const line = nodes.filter((n) => ["x", "asc", "desc", "both"].includes(kindOf(n)));
  if (!line.length) return nodes;
  const base = median(line.map((n) => n.m.base));
  return nodes.map((n) => {
    if (n.kind !== "sym") return n;
    const high = n.box.cy < base - X * 0.7;
    const middle = n.box.cy < base - X * 0.3;
    if (n.label === "." || n.label === "\\cdot") return { ...n, label: middle ? "\\cdot" : "." };
    if (n.label === "," || n.label === "'") return { ...n, label: high ? "'" : "," };
    return n;
  });
}

function rowLatex(nodes, depth = 0) {
  if (!nodes.length) return "";
  if (depth > 12) return nodes.map((n) => n.label ?? "").join(" ");
  const ref = median(nodes.map((n) => Math.max(n.box.w, n.box.h))) || 1;
  let X = xHeight(nodes, ref);
  const measure = () => nodes.forEach((n) => (n.m = metric(n, X)));
  nodes = groupFractions(nodes, X);
  nodes = groupRoots(nodes);
  measure();
  nodes = groupWords(nodes, X);
  nodes = groupLimits(nodes, X);
  X = xHeight(nodes, ref);
  nodes = nodes.map((n) => fixCase(n, X));
  measure();
  nodes = placeMarks(nodes, X);
  measure();
  nodes.sort((a, b) => a.box.minX - b.box.minX);

  const items = [];
  let current = null;
  let lastScript = null; // { node, list }
  for (const n of nodes) {
    if (current) {
      // A script of the last script (y_{k^2}) belongs with it, even if it comes
      // back up near the main line.
      if (
        lastScript &&
        kindOf(n) !== "op" &&
        n.m.xh < lastScript.node.m.xh * 0.9 &&
        relation(lastScript.node, n, X) !== "right"
      ) {
        current[lastScript.list].push(n);
        lastScript = { node: lastScript.node, list: lastScript.list };
        continue;
      }
      const rel = relation(current.base, n, X);
      if (rel !== "right") {
        current[rel].push(n);
        lastScript = { node: n, list: rel };
        continue;
      }
    }
    current = { base: n, sub: [], sup: [] };
    lastScript = null;
    items.push(current);
  }

  const out = items.map((item) => {
    let base = nodeLatex(item.base, depth);
    const primes = item.sup.filter((n) => kindOf(n) === "prime");
    const sup = item.sup.filter((n) => kindOf(n) !== "prime");
    base += "'".repeat(primes.length);
    if (item.sub.length) base += `_{${rowLatex(item.sub, depth + 1)}}`;
    if (sup.length) base += `^{${rowLatex(sup, depth + 1)}}`;
    return base;
  });
  return out.join(" ");
}

function nodeLatex(n, depth) {
  switch (n.kind) {
    case "frac":
      return `\\frac{${rowLatex(n.num, depth + 1)}}{${rowLatex(n.den, depth + 1)}}`;
    case "sqrt":
      return `\\sqrt{${rowLatex(n.content, depth + 1)}}`;
    case "limits": {
      let s = n.label;
      if (n.below.length) s += `_{${rowLatex(n.below, depth + 1)}}`;
      if (n.above.length) s += `^{${rowLatex(n.above, depth + 1)}}`;
      return s;
    }
    default:
      return n.label;
  }
}

/** For tests only. */
export const _internal = { boxOf, compact, writingOrder, fractionBars, rank, percentile };

/**
 * Read math.
 * @returns {{latex: string, groups: object[]} | null}
 */
export function readMath(strokes, alphabet) {
  const read = readSymbols(strokes, alphabet);
  if (!read) return null;
  const nodes = read.groups.map((g) => ({ kind: "sym", label: g.label, alternatives: g.alternatives, box: g.box }));
  return { latex: rowLatex(nodes).replace(/\s+/g, " ").trim(), groups: read.groups };
}

/** Read words (for text lines): symbols left to right, spaces where the gaps are wide. */
export function readText(strokes, alphabet) {
  const read = readSymbols(strokes, alphabet);
  if (!read) return null;
  const groups = [...read.groups].sort((a, b) => a.box.minX - b.box.minX);
  const X = median(groups.map((g) => g.box.h)) || read.ref;
  let text = "";
  groups.forEach((g, i) => {
    if (i && g.box.minX - groups[i - 1].box.maxX > X * 0.45) text += " ";
    text += g.label.startsWith("\\") ? `$${g.label}$` : g.label;
  });
  return { text, groups: read.groups };
}
