// Writing area: records Apple Pencil (or mouse) strokes and draws them as ink.

import { getStroke } from "../vendor/perfect-freehand/perfect-freehand.mjs";

const INK = {
  size: 3.2,
  thinning: 0.55,
  smoothing: 0.5,
  streamline: 0.4,
};

function outlineToPath(outline) {
  const path = new Path2D();
  if (!outline.length) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

export class InkPad {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{onStrokeEnd?: () => void, onStrokeStart?: () => void}} callbacks
   */
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks;
    this.strokes = [];
    this.current = null;
    this.penOnly = false;
    this.erasing = false;
    this.pending = false;

    new ResizeObserver(() => this.#resize()).observe(canvas);
    canvas.addEventListener("pointerdown", (e) => this.#down(e));
    canvas.addEventListener("pointermove", (e) => this.#move(e));
    canvas.addEventListener("pointerup", (e) => this.#up(e));
    canvas.addEventListener("pointercancel", (e) => this.#up(e));
    // Stop iPad Safari from treating a long press as text selection / magnifier.
    canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  get isEmpty() {
    return this.strokes.length === 0;
  }

  getStrokes() {
    return this.strokes.map((s) => ({
      pointerType: s.pointerType,
      x: s.points.map((p) => Math.round(p[0] * 10) / 10),
      y: s.points.map((p) => Math.round(p[1] * 10) / 10),
      p: s.points.map((p) => Math.round(p[2] * 100) / 100),
      t: s.times,
    }));
  }

  undo() {
    this.strokes.pop();
    this.#draw();
  }

  /** Show strokes from elsewhere (e.g. the main pad), scaled to fit this pad. */
  load(strokes) {
    const { width, height } = this.canvas.getBoundingClientRect();
    const xs = strokes.flatMap((s) => s.x);
    const ys = strokes.flatMap((s) => s.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const w = Math.max(...xs) - minX || 1, h = Math.max(...ys) - minY || 1;
    const k = Math.min((width - 40) / w, (height - 40) / h, 3);
    const ox = (width - w * k) / 2, oy = (height - h * k) / 2;
    this.strokes = strokes.map((s) => ({
      pointerType: s.pointerType || "pen",
      points: s.x.map((x, i) => [ox + (x - minX) * k, oy + (s.y[i] - minY) * k, s.p?.[i] ?? 0.5]),
      times: s.t ?? s.x.map((_, i) => i * 8),
    }));
    this.#draw();
  }

  removeFirst(n) {
    this.strokes.splice(0, n);
    this.#draw();
  }

  clear() {
    this.strokes = [];
    this.current = null;
    this.#draw();
  }

  #allowed(e) {
    if (this.penOnly && e.pointerType === "touch") return false;
    return e.isPrimary || e.pointerType === "pen";
  }

  #point(e) {
    const r = this.canvas.getBoundingClientRect();
    const pressure = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5;
    return [e.clientX - r.left, e.clientY - r.top, pressure];
  }

  #down(e) {
    if (!this.#allowed(e)) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {}
    if (this.erasing) {
      this.#eraseAt(this.#point(e));
      this.current = { erasing: true, pointerId: e.pointerId };
      return;
    }
    this.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType || "mouse",
      points: [this.#point(e)],
      times: [Date.now()],
    };
    this.callbacks.onStrokeStart?.();
    this.#requestDraw();
  }

  #move(e) {
    const c = this.current;
    if (!c || c.pointerId !== e.pointerId) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      if (c.erasing) this.#eraseAt(this.#point(ev));
      else {
        c.points.push(this.#point(ev));
        c.times.push(Date.now());
      }
    }
    this.#requestDraw();
  }

  #up(e) {
    const c = this.current;
    if (!c || c.pointerId !== e.pointerId) return;
    this.current = null;
    if (c.erasing) return;
    // A tap still counts as a stroke (dots on i, j, decimal points...).
    if (c.points.length === 1) {
      const [x, y, p] = c.points[0];
      c.points.push([x + 0.5, y + 0.5, p]);
      c.times.push(c.times[0] + 1);
    }
    this.strokes.push(c);
    this.#requestDraw();
    this.callbacks.onStrokeEnd?.();
  }

  #eraseAt([x, y]) {
    const radius = 10;
    const before = this.strokes.length;
    this.strokes = this.strokes.filter(
      (s) => !s.points.some(([px, py]) => Math.hypot(px - x, py - y) < radius),
    );
    if (this.strokes.length !== before) {
      this.#requestDraw();
      this.callbacks.onStrokeEnd?.();
    }
  }

  #resize() {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#draw();
  }

  #requestDraw() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.#draw();
    });
  }

  #draw() {
    const { ctx, canvas } = this;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    // A faint baseline helps keep subscripts visibly smaller and lower.
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(12, height * 0.62);
    ctx.lineTo(width - 12, height * 0.62);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#111";
    const all = this.current && !this.current.erasing ? [...this.strokes, this.current] : this.strokes;
    for (const s of all) {
      const outline = getStroke(s.points, {
        ...INK,
        simulatePressure: s.pointerType !== "pen",
        last: s !== this.current,
      });
      ctx.fill(outlineToPath(outline));
    }
  }
}
