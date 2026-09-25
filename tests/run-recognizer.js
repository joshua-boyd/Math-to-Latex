// Runs the reader on synthetic handwriting and reports what it got right.
// Open tests/recognizer.html in a browser (served from the repo folder).

import { prepareAlphabet, readMath } from "../js/recognizer.js";
import { setSeed, trainingShapes, compose, draw, GLYPHS } from "./synthetic.js";

export const EXPRESSIONS = [
  { items: ["x", { sub: ["i", { sub: ["j"] }] }], latex: "x_{i_{j}}" },
  { items: ["x", { sub: ["i", "j"] }], latex: "x_{ij}" },
  { items: [{ frac: [["\\partial", "f"], ["\\partial", "g"]] }], latex: "\\frac{\\partial f}{\\partial g}" },
  { items: ["x", { sup: ["2"] }, "+", "y", { sup: ["2"] }, "=", "1"], latex: "x^{2}+y^{2}=1" },
  { items: [{ limits: "\\sum", below: ["i", "=", "1"], above: ["n"] }, "a", { sub: ["i"] }], latex: "\\sum_{i=1}^{n}a_{i}" },
  { items: ["e", { sup: ["-", "x"] }], latex: "e^{-x}" },
  { items: [{ sqrt: ["x", "+", "1"] }], latex: "\\sqrt{x+1}" },
  { items: [{ frac: [["1"], ["2"]] }, "+", { frac: [["a"], ["b"]] }], latex: "\\frac{1}{2}+\\frac{a}{b}" },
  { items: ["l", "i", "m", "a", { sub: ["n"] }], latex: "\\lim a_{n}" },
  { items: ["f", "(", "x", ")", "=", "3", "x", { sup: ["2"] }], latex: "f(x)=3x^{2}" },
  { items: ["a", { sub: ["n"] }, "\\to", "\\infty"], latex: "a_{n}\\to\\infty" },
  { items: ["y", { sub: ["k", { sup: ["2"] }] }], latex: "y_{k^{2}}" },
  { items: [{ frac: [[{ frac: [["1"], ["x"]] }], ["2"]] }], latex: "\\frac{\\frac{1}{x}}{2}" },
  { items: ["\\alpha", { sub: ["0"] }, "=", "d", "t"], latex: "\\alpha_{0}=dt" },
];

const squash = (s) => s.replace(/\s+/g, "");

export function run({ seed = 7, trials = 5 } = {}) {
  setSeed(seed);
  const alphabet = prepareAlphabet(trainingShapes(3));
  const t0 = performance.now();

  // Single symbols
  let symbolsRight = 0, symbolsTotal = 0;
  const symbolMisses = {};
  for (const label of Object.keys(GLYPHS)) {
    if (label === "\\sqrt") continue;
    for (let t = 0; t < trials; t++) {
      const r = readMath(draw(label, 100, 200, 60).strokes, alphabet);
      symbolsTotal++;
      if (r && squash(r.latex) === squash(label)) symbolsRight++;
      else (symbolMisses[label] ||= []).push(r?.latex);
    }
  }

  // Expressions
  const results = EXPRESSIONS.map(({ items, latex }) => {
    const got = [];
    for (let t = 0; t < trials; t++) got.push(readMath(compose(items), alphabet)?.latex ?? "(nothing)");
    const right = got.filter((g) => squash(g) === squash(latex)).length;
    return { want: latex, right, of: trials, wrong: [...new Set(got.filter((g) => squash(g) !== squash(latex)))] };
  });
  const ms = Math.round((performance.now() - t0) / (symbolsTotal + EXPRESSIONS.length * trials));
  return {
    symbols: `${symbolsRight}/${symbolsTotal}`,
    symbolMisses,
    expressions: `${results.reduce((a, r) => a + r.right, 0)}/${results.reduce((a, r) => a + r.of, 0)}`,
    results,
    msPerRead: ms,
  };
}
