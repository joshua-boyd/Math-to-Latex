// Button definitions. `latex` is the button's label (rendered as math).
// Templates use MathLive's placeholders:
//   #0  the current selection, or an empty box if nothing is selected
//   #?  an empty box to fill in

// How an empty box is drawn on a button label.
const B = "\\square";

/** Insert as math even when the cursor is inside \text{...}. */
export const put = (mf, latex, options) => mf.insert(latex, { mode: "math", format: "latex", ...options });

/** Wrap the selection (or an empty box) in a template. */
const wrap = (template) => (mf) => put(mf, template, { selectionMode: "placeholder" });

/**
 * Put the selection into a sub/superscript of the symbol before it.
 * With nothing selected, open an empty sub/superscript on the symbol before the cursor.
 */
function script(command) {
  return (mf) => {
    if (mf.selectionIsCollapsed) {
      mf.executeCommand(command);
      return;
    }
    const moved = mf.getValue(mf.selection, "latex");
    mf.executeCommand("deleteBackward");
    mf.executeCommand(command);
    put(mf, moved, { selectionMode: "after" });
  };
}

/** Move the selection (or the cursor) out of the box it is in, to just after that box's owner. */
function raise(mf) {
  if (mf.selectionIsCollapsed) {
    mf.executeCommand("moveAfterParent");
    return;
  }
  const moved = mf.getValue(mf.selection, "latex");
  mf.executeCommand("deleteBackward");
  mf.executeCommand("moveAfterParent");
  put(mf, moved, { selectionMode: "after" });
}

/** Attach a mark (prime, ^{-1}, ...) to the selection, or to the symbol before the cursor. */
const suffix = (latex) => (mf) =>
  put(mf, mf.selectionIsCollapsed ? latex : `#0${latex}`, { selectionMode: "after" });

const cmd = (command) => (mf) => mf.executeCommand(command);
const sym = (latex) => ({ latex, title: latex, run: (mf) => put(mf, latex, { selectionMode: "after" }) });

export const TABS = [
  {
    name: "Structure",
    buttons: [
      { latex: `x_{${B}}`, title: "Subscript (with a selection: move it into a subscript)", run: script("moveToSubscript") },
      { latex: `x^{${B}}`, title: "Superscript (with a selection: move it into a superscript)", run: script("moveToSuperscript") },
      {
        latex: `x_{${B}}^{${B}}`,
        title: "Subscript and superscript",
        run: (mf) => put(mf, mf.selectionIsCollapsed ? "_{#?}^{#?}" : "#0_{#?}^{#?}", { selectionMode: "placeholder" }),
      },
      { text: "⤴ out", title: "Move out of this box (e.g. x_{ij} → x_i j when j is selected)", run: raise },
      { latex: `\\frac{${B}}{${B}}`, title: "Fraction", run: wrap("\\frac{#0}{#?}") },
      { latex: `\\sqrt{${B}}`, title: "Square root", run: wrap("\\sqrt{#0}") },
      { latex: `\\sqrt[${B}]{${B}}`, title: "nth root", run: wrap("\\sqrt[#?]{#0}") },
      { latex: `\\left(${B}\\right)`, title: "Parentheses", run: wrap("\\left(#0\\right)") },
      { latex: `\\left[${B}\\right]`, title: "Brackets", run: wrap("\\left[#0\\right]") },
      { latex: `\\left\\{${B}\\right\\}`, title: "Braces", run: wrap("\\left\\{#0\\right\\}") },
      { latex: `\\left|${B}\\right|`, title: "Absolute value", run: wrap("\\left|#0\\right|") },
      { latex: `\\left\\lVert${B}\\right\\rVert`, title: "Norm", run: wrap("\\left\\lVert #0\\right\\rVert") },
      { latex: `\\left\\langle${B},${B}\\right\\rangle`, title: "Inner product", run: wrap("\\left\\langle #0,#?\\right\\rangle") },
      { latex: `\\left\\{${B}\\mid${B}\\right\\}`, title: "Set-builder", run: wrap("\\left\\{#0\\mid #?\\right\\}") },
      { latex: `\\sum_{${B}}^{${B}}`, title: "Sum", run: wrap("\\sum_{#?}^{#?}#0") },
      { latex: `\\prod_{${B}}^{${B}}`, title: "Product", run: wrap("\\prod_{#?}^{#?}#0") },
      { latex: `\\int_{${B}}^{${B}}`, title: "Integral", run: wrap("\\int_{#?}^{#?}#0") },
      { latex: `\\lim_{${B}\\to${B}}`, title: "Limit", run: wrap("\\lim_{#?\\to #?}#0") },
      { latex: `\\bigcup_{${B}}`, title: "Big union", run: wrap("\\bigcup_{#?}#0") },
      { latex: `\\bigcap_{${B}}`, title: "Big intersection", run: wrap("\\bigcap_{#?}#0") },
      { latex: `\\begin{pmatrix}${B}&${B}\\\\${B}&${B}\\end{pmatrix}`, title: "2×2 matrix", run: wrap(`\\begin{pmatrix}#0&#?\\\\#?&#?\\end{pmatrix}`) },
      { latex: `\\text{abc}`, title: "Words inside math", run: wrap("\\text{#0}") },
    ],
  },
  {
    name: "Accents",
    buttons: [
      { latex: `\\hat{${B}}`, title: "hat", run: wrap("\\hat{#0}") },
      { latex: `\\widehat{${B}}`, title: "wide hat", run: wrap("\\widehat{#0}") },
      { latex: `\\tilde{${B}}`, title: "tilde", run: wrap("\\tilde{#0}") },
      { latex: `\\widetilde{${B}}`, title: "wide tilde", run: wrap("\\widetilde{#0}") },
      { latex: `\\bar{${B}}`, title: "bar", run: wrap("\\bar{#0}") },
      { latex: `\\overline{${B}}`, title: "overline", run: wrap("\\overline{#0}") },
      { latex: `\\underline{${B}}`, title: "underline", run: wrap("\\underline{#0}") },
      { latex: `\\vec{${B}}`, title: "vector arrow", run: wrap("\\vec{#0}") },
      { latex: `\\dot{${B}}`, title: "dot", run: wrap("\\dot{#0}") },
      { latex: `\\ddot{${B}}`, title: "double dot", run: wrap("\\ddot{#0}") },
      { latex: `${B}'`, title: "prime", run: suffix("'") },
      { latex: `${B}^{*}`, title: "star (conjugate / dual)", run: suffix("^{*}") },
      { latex: `${B}^{-1}`, title: "inverse", run: suffix("^{-1}") },
      { latex: `${B}^{c}`, title: "complement", run: suffix("^{c}") },
      { latex: `${B}^{T}`, title: "transpose", run: suffix("^{T}") },
    ],
  },
  {
    name: "Fonts",
    buttons: [
      { latex: "\\mathbb{R}", title: "Blackboard bold (ℝ, ℕ, ℤ…)", run: wrap("\\mathbb{#0}") },
      { latex: "\\mathcal{F}", title: "Calligraphic", run: wrap("\\mathcal{#0}") },
      { latex: "\\mathscr{F}", title: "Script (adds \\usepackage{mathrsfs} on export)", run: wrap("\\mathscr{#0}") },
      { latex: "\\mathfrak{g}", title: "Fraktur", run: wrap("\\mathfrak{#0}") },
      { latex: "\\mathbf{v}", title: "Bold", run: wrap("\\mathbf{#0}") },
      { latex: "\\boldsymbol{\\alpha}", title: "Bold symbol (bold Greek)", run: wrap("\\boldsymbol{#0}") },
      { latex: "\\mathrm{d}", title: "Upright", run: wrap("\\mathrm{#0}") },
      { latex: "\\operatorname{op}", title: "Operator name (e.g. rank, tr)", run: wrap("\\operatorname{#0}") },
    ],
  },
  {
    name: "Symbols",
    buttons: [
      "\\in", "\\notin", "\\subset", "\\subseteq", "\\supseteq", "\\cup", "\\cap", "\\setminus", "\\emptyset",
      "\\forall", "\\exists", "\\neg", "\\land", "\\lor", "\\implies", "\\iff", "\\to", "\\mapsto",
      "\\le", "\\ge", "\\ne", "\\approx", "\\equiv", "\\sim", "\\cong", "\\propto",
      "\\infty", "\\partial", "\\nabla", "\\cdot", "\\times", "\\circ", "\\otimes", "\\oplus",
      "\\ldots", "\\cdots", "\\mid", "\\nmid", "\\perp", "\\parallel",
      "\\alpha", "\\beta", "\\gamma", "\\delta", "\\varepsilon", "\\epsilon", "\\zeta", "\\eta",
      "\\theta", "\\kappa", "\\lambda", "\\mu", "\\nu", "\\xi", "\\pi", "\\rho", "\\sigma", "\\tau",
      "\\varphi", "\\phi", "\\chi", "\\psi", "\\omega", "\\Gamma", "\\Delta", "\\Theta", "\\Lambda",
      "\\Sigma", "\\Phi", "\\Psi", "\\Omega",
    ].map(sym),
  },
];

// Always-visible editing controls.
export const EDIT_BUTTONS = [
  { text: "◀", title: "Move left", run: cmd("moveToPreviousChar") },
  { text: "▶", title: "Move right", run: cmd("moveToNextChar") },
  { text: "Next box", title: "Jump to the next empty box", run: cmd("moveToNextPlaceholder") },
  { text: "⌫", title: "Delete", run: cmd("deleteBackward") },
  { text: "Undo", title: "Undo", run: cmd("undo") },
  { text: "Redo", title: "Redo", run: cmd("redo") },
];
