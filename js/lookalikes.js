// Symbols that handwriting recognizers commonly mix up. Each group is a set of
// symbols that can be confused with each other; a symbol may be in several groups.
// Add your own groups here as you find new mix-ups in your handwriting.

const GROUPS = [
  ["v", "\\nu", "\\vee", "V"],
  ["x", "\\times", "\\chi", "X"],
  ["e", "\\epsilon", "\\varepsilon", "\\in"],
  ["\\phi", "\\varphi", "\\emptyset", "\\Phi", "\\psi"],
  ["o", "0", "O", "\\sigma", "\\circ", "\\theta"],
  ["l", "1", "|", "\\ell", "\\iota", "I"],
  ["|", "\\mid", "\\vert", "\\|", "1"],
  ["u", "\\mu", "\\cup", "U"],
  ["n", "\\eta", "\\cap", "\\pi"],
  ["p", "\\rho", "P"],
  ["w", "\\omega", "W"],
  ["k", "\\kappa", "K"],
  ["d", "\\partial", "\\delta", "2", "8", "\\sigma"],
  ["\\infty", "\\propto", "\\alpha", "8"],
  ["a", "\\alpha", "\\propto"],
  ["B", "\\beta"],
  ["t", "\\tau", "+"],
  ["y", "\\gamma", "\\psi"],
  ["z", "2", "Z"],
  ["s", "5", "S"],
  ["g", "9", "q"],
  ["c", "C", "\\subset", "("],
  ["\\subset", "\\subseteq", "\\in"],
  ["\\supset", "\\supseteq", "\\ni"],
  ["\\ldots", "\\cdots"],
  ["\\cdot", "."],
  ["\\to", "\\mapsto", "\\implies", "\\rightarrow"],
  ["<", "\\le", "\\subset"],
  [">", "\\ge", "\\supset"],
  ["=", "\\equiv", "\\cong", "\\approx", "\\simeq"],
  ["-", "\\sim", "\\neg"],
  ["\\sum", "\\Sigma", "E"],
  ["\\prod", "\\Pi", "\\pi"],
  ["\\setminus", "/", "\\backslash"],
  ["*", "\\ast", "\\star"],
  ["\\exists", "E", "3"],
  ["\\forall", "A", "V"],
  ["\\wedge", "\\land", "\\Lambda", "\\lambda"],
  ["\\vee", "\\lor"],
  ["\\xi", "\\zeta"],
  ["\\theta", "\\Theta", "\\vartheta"],
];

// Different spellings MathLive or MyScript may produce for the same symbol.
const ALIASES = {
  "\\leq": "\\le",
  "\\geq": "\\ge",
  "\\neq": "\\ne",
  "\\rightarrow": "\\to",
  "\\Rightarrow": "\\implies",
  "\\varnothing": "\\emptyset",
  "\\lvert": "|",
  "\\rvert": "|",
  "\\lbrack": "[",
  "\\rbrack": "]",
  "\\times ": "\\times",
};

const normalize = (latex) => {
  const t = latex.trim();
  return ALIASES[t] ?? t;
};

/** @returns {string[]} symbols that `latex` is often confused with */
export function lookalikes(latex) {
  const key = normalize(latex);
  const out = new Set();
  for (const group of GROUPS) {
    if (group.includes(key)) group.forEach((s) => s !== key && out.add(s));
  }
  return [...out];
}
