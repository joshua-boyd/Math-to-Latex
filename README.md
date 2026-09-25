# Math → LaTeX

A website for writing math proofs by hand on an iPad and getting LaTeX that compiles.

You write with Apple Pencil, [MyScript](https://developer.myscript.com) reads the handwriting,
and the result goes into an editable math line ([MathLive](https://mathlive.io)). Buttons
fix the things handwriting readers get wrong: subscripts, nesting, accents, fonts and
look-alike symbols.

Everything is free: MathLive and perfect-freehand are open source (MIT) and included in
`vendor/`, and MyScript's free tier covers 2,000 recognition requests a month. There is no
server, no build step and no AI.

## Setup

1. **Get free MyScript keys.** Create an account at
   <https://developer.myscript.com/getting-started/web> and copy your **application key** and
   **HMAC key**.
2. **Open the site** (see below), tap **Settings** and paste both keys. They are saved only in
   that browser, never in the site's code.
3. On iPad, use Safari's **Share → Add to Home Screen** so it opens full screen like an app.

### Running it

The site is plain HTML and JavaScript, so any static web server works.

- **On this Mac:** `python3 -m http.server 8123`, then open <http://localhost:8123>.
- **On the iPad:** publish it with GitHub Pages (repo **Settings → Pages → Deploy from branch →
  `main` / root**). It will be at `https://<user>.github.io/Math-to-Latex/`.

## How to use it

- **Write first, fix after.** Write a whole expression in the pad. When you pause it is
  converted into the active line, and then you fix anything that's wrong.
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
- **Text lines** are for the words of the proof. Handwriting there is read as text, and you can
  type inline math as `$x_i$`. Inside a math line, the **abc** button adds `\text{…}`.
- **Export LaTeX** gives a complete `.tex` file (copy it, download it, or open it in Overleaf).
  Consecutive math lines become one `gather*` block. It warns you about empty boxes you haven't
  filled.

Your document is saved automatically in the browser. **New** starts over, so export first.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | Page layout |
| `js/app.js` | Document lines, convert flow, dialogs |
| `js/inkpad.js` | Writing area (Pencil input, ink drawing, eraser) |
| `js/myscript.js` | Calls MyScript's recognition service |
| `js/toolbar.js` | Every button and what it inserts |
| `js/lookalikes.js` | Groups of easily confused symbols |
| `js/export.js` | Builds the `.tex` file |
| `vendor/` | MathLive 0.110.0 and perfect-freehand 1.2.3, unmodified |
