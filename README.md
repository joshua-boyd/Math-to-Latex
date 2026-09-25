# Math → LaTeX

A website for writing math proofs by hand on an iPad and getting LaTeX that compiles.

You write with Apple Pencil, the site reads your handwriting, and the result goes into an
editable math line ([MathLive](https://mathlive.io)). Buttons fix what a reader gets wrong:
subscripts, nesting, accents, fonts and look-alike symbols.

It reads your writing in one of two ways (choose in **Settings**):

- **My handwriting** (default): compares what you write with your own drawings of each symbol.
  It runs entirely in the browser, works offline, and learns from every correction.
- **MyScript**: MyScript's free online recognizer (2,000 requests a month, needs free keys).

Everything is free: MathLive and perfect-freehand are open source (MIT) and included in
`vendor/`. There is no server, no build step and no AI.

## Setup

1. **Open the site** (see below). On iPad, use Safari's **Share → Add to Home Screen** so it
   opens full screen like an app, and do everything below in that home-screen version.
2. **Teach it your handwriting:** **My handwriting → Learn my handwriting**. It shows one symbol
   at a time; write each one the way you normally do. Three drawings of the basic symbols take
   about 10 minutes, and you can stop at any point.
3. *(Only for the MyScript reader)* create free keys at
   <https://developer.myscript.com/getting-started/web> and paste them into **Settings**.

### Running it

The site is plain HTML and JavaScript, so any static web server works.

- **On this Mac:** `python3 -m http.server 8123`, then open <http://localhost:8123>.
- **On the iPad:** publish it with GitHub Pages (repo **Settings → Pages → Deploy from branch →
  `main` / root**). It will be at `https://<user>.github.io/Math-to-Latex/`.

## How to use it

- **Write first, fix after.** Write an expression in the pad. When you pause it is converted
  into the active line.
- **Correct it and it learns.** With the My handwriting reader, each symbol's reading is shown
  under your ink. If one is wrong, tap it with your finger (or tap **Fix a symbol**, then the
  symbol), and pick or type what it actually is. That drawing is saved, so the same mistake gets
  less likely every time you correct it.
- **Pausing is fine.** Converted ink stays in the pad in gray. If you keep writing (a fraction
  bar and denominator, an exponent, more terms), everything is read again and replaces the
  earlier result. Auto-convert also waits while a fraction bar has writing on only one side.
  **Clear** starts the next part fresh; so do tapping a button, moving the cursor or switching
  lines.
- **Structure first, fill in the boxes.** Tap a button such as subscript, fraction or sum. An
  empty box appears and is selected. Write what goes in it, and it fills that box (then jumps
  to the next empty box). Tap subscript again inside a subscript to nest: `x`, subscript, `i`,
  subscript, `j` gives `x_{i_{j}}`.
- **Fix structure.** Select part of a line, then:
  - **x□** moves the selection into a subscript of the symbol before it (`x_{ij}` → `x_{i_{j}}`);
  - **⤴ out** moves it out of the box it's in (`x_{ij}` → `x_{i}j`);
  - accent and font buttons wrap the selection (`\hat`, `\tilde`, `\vec`, `\mathbb`, `\mathcal`…).
- **Swap look-alikes.** The yellow strip shows symbols that are often confused with the one
  before the cursor (or the selection): v/ν/∨, ε/∈, φ/∅, l/1/|, u/∪… Tap one to swap. Add your own
  pairs in [`js/lookalikes.js`](js/lookalikes.js).
- **Type LaTeX.** The **Type LaTeX** button opens a box for typing LaTeX, which is inserted at the
  cursor (or into the selected box). The **TeX** button on a line shows its whole LaTeX source
  for editing; tap **Done** to go back to the rendered math.
- **Text lines** are for the words of the proof. Handwriting there is read as text, and you can
  type inline math as `$x_i$`. Inside a math line, the **abc** button adds `\text{…}`.
- **Export LaTeX** gives a complete `.tex` file (copy it, download it, or open it in Overleaf).
  Consecutive math lines become one `gather*` block. It warns you about empty boxes you haven't
  filled.

Your document is saved automatically in the browser. **New** starts over, so export first.

## Your handwriting data

Your drawings of each symbol are saved in the browser. In **My handwriting**, **Export** saves
them to a small file (keep a copy in iCloud Drive) and **Import** loads it on another device or
after browser data is cleared. **Teach one symbol** adds a symbol that isn't in the guided
lesson: type its LaTeX and draw it a few times.

### How the My handwriting reader works

[`js/recognizer.js`](js/recognizer.js):

1. **Symbols.** Strokes are grouped into symbols of 1–4 strokes (strokes of one symbol overlap
   or touch; a late i-dot is joined to its stem) and each group is compared with your drawings,
   by shape ($P point-cloud match) and by how it was drawn. Dynamic programming picks the
   grouping that matches best overall. Fraction bars are found first so they can't merge with
   neighbours. Dots, commas and primes are told apart by size and height.
2. **Layout.** Fraction bars with writing above and below become `\frac`, writing inside a root
   sign goes under `\sqrt`, writing above and below ∑/∏/lim becomes limits, and smaller writing
   raised or lowered next to a symbol becomes a superscript or subscript, nested as deep as you
   write it. Each symbol's own shape is taken into account (a g hangs below the line, a d rises
   above it). Letters spelling sin, log, lim… become `\sin`, `\log`, `\lim`.

`tests/recognizer.html` runs the reader on synthetic handwriting (open it through the local
server) and reports what it gets right.

### Taught shapes with MyScript

With the MyScript reader, your drawings still help: a taught symbol is swapped for a stand-in `#`
of the same size and position before the ink goes to MyScript, then replaced with your LaTeX.
Shapes in [`shapes/shared.json`](shapes/shared.json) are used by everyone who opens the site in
MyScript mode. To add to it, export your shapes, run
`python3 tools/merge_shapes.py my-shapes.json`, and commit `shapes/shared.json`.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | Page layout |
| `js/app.js` | Document lines, convert flow, corrections, dialogs |
| `js/recognizer.js` | The My handwriting reader |
| `js/trainer.js`, `js/symbols.js` | Learn my handwriting, and the symbols it teaches |
| `js/inkpad.js` | Writing area (Pencil input, ink drawing, eraser, symbol labels) |
| `js/fraction.js` | Holds back auto-convert while a fraction is half written |
| `js/myscript.js` | Calls MyScript's recognition service |
| `js/shapes.js` | Shape matching, taught shapes for MyScript, import/export |
| `js/toolbar.js` | Every button and what it inserts |
| `js/lookalikes.js` | Groups of easily confused symbols |
| `js/export.js` | Builds the `.tex` file |
| `shapes/shared.json` | Shared shapes (MyScript mode) |
| `tools/merge_shapes.py` | Adds exported shape files to the shared library |
| `tests/` | Synthetic handwriting and the reader test page |
| `vendor/` | MathLive 0.110.0 and perfect-freehand 1.2.3, unmodified |
