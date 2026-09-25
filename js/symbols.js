// The symbols "Learn my handwriting" asks you to write, in groups you can pick.

const letters = (s) => [...s];

export const SETS = [
  { id: "digits", name: "Digits 0–9", on: true, symbols: letters("0123456789") },
  { id: "lower", name: "Lowercase letters a–z", on: true, symbols: letters("abcdefghijklmnopqrstuvwxyz") },
  {
    id: "ops",
    name: "Operators and relations (+ − = < ≤ → …)",
    on: true,
    symbols: ["+", "-", "=", "\\times", "\\cdot", "/", "<", ">", "\\le", "\\ge", "\\ne", "\\approx", "\\sim", "\\pm", "\\to", "\\implies", "\\iff", "\\mapsto"],
  },
  {
    id: "brackets",
    name: "Brackets and punctuation",
    on: true,
    symbols: ["(", ")", "[", "]", "\\{", "\\}", "|", ",", ".", "'", "!"],
  },
  {
    id: "calculus",
    name: "Calculus (∂ ∇ ∞ ∑ ∏ ∫ √)",
    on: true,
    symbols: ["\\partial", "\\nabla", "\\infty", "\\sum", "\\prod", "\\int", "\\sqrt"],
  },
  {
    id: "greek",
    name: "Greek letters (α β γ δ ε θ λ μ π σ φ ω …)",
    on: false,
    symbols: [
      "\\alpha", "\\beta", "\\gamma", "\\delta", "\\varepsilon", "\\epsilon", "\\zeta", "\\eta", "\\theta",
      "\\kappa", "\\lambda", "\\mu", "\\nu", "\\xi", "\\pi", "\\rho", "\\sigma", "\\tau", "\\varphi", "\\phi",
      "\\chi", "\\psi", "\\omega",
    ],
  },
  {
    id: "sets",
    name: "Sets and logic (∈ ⊂ ∪ ∩ ∅ ∀ ∃ …)",
    on: false,
    symbols: ["\\in", "\\notin", "\\subset", "\\subseteq", "\\cup", "\\cap", "\\setminus", "\\emptyset", "\\forall", "\\exists", "\\neg", "\\land", "\\lor"],
  },
  { id: "upper", name: "Capital letters A–Z", on: false, symbols: letters("ABCDEFGHIJKLMNOPQRSTUVWXYZ") },
  {
    id: "greekupper",
    name: "Capital Greek (Γ Δ Θ Λ Π Σ Φ Ψ Ω)",
    on: false,
    symbols: ["\\Gamma", "\\Delta", "\\Theta", "\\Lambda", "\\Pi", "\\Sigma", "\\Phi", "\\Psi", "\\Omega"],
  },
];

// What to call symbols that are easy to mix up, so you write the one that's meant.
export const NAMES = {
  0: "digit zero",
  1: "digit one",
  l: "letter l",
  o: "letter o",
  x: "letter x",
  "-": "minus sign (also used as the fraction bar)",
  "\\times": "times sign",
  "\\cdot": "multiplication dot, halfway up",
  ".": "period, on the line",
  ",": "comma",
  "'": "prime",
  "|": "vertical bar",
  "/": "slash",
  "\\sqrt": "root sign with its top bar, as if covering something",
  "\\sum": "sum sign, full size",
  "\\prod": "product sign, full size",
  "\\int": "integral sign, full size",
  "\\varepsilon": "epsilon (the curly one)",
  "\\epsilon": "epsilon (the straight one)",
  "\\varphi": "phi (the curly one)",
  "\\phi": "phi (the straight one)",
  "\\{": "left brace",
  "\\}": "right brace",
};

// How each symbol is shown under your ink in the pad.
const UNICODE = {
  "\\times": "×", "\\cdot": "·", "\\le": "≤", "\\ge": "≥", "\\ne": "≠", "\\approx": "≈", "\\sim": "∼",
  "\\pm": "±", "\\to": "→", "\\implies": "⇒", "\\iff": "⇔", "\\mapsto": "↦", "\\{": "{", "\\}": "}",
  "\\partial": "∂", "\\nabla": "∇", "\\infty": "∞", "\\sum": "∑", "\\prod": "∏", "\\int": "∫", "\\sqrt": "√",
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ", "\\varepsilon": "ε", "\\epsilon": "ϵ",
  "\\zeta": "ζ", "\\eta": "η", "\\theta": "θ", "\\kappa": "κ", "\\lambda": "λ", "\\mu": "μ", "\\nu": "ν",
  "\\xi": "ξ", "\\pi": "π", "\\rho": "ρ", "\\sigma": "σ", "\\tau": "τ", "\\varphi": "φ", "\\phi": "ϕ",
  "\\chi": "χ", "\\psi": "ψ", "\\omega": "ω", "\\in": "∈", "\\notin": "∉", "\\subset": "⊂",
  "\\subseteq": "⊆", "\\cup": "∪", "\\cap": "∩", "\\setminus": "∖", "\\emptyset": "∅", "\\forall": "∀",
  "\\exists": "∃", "\\neg": "¬", "\\land": "∧", "\\lor": "∨", "\\Gamma": "Γ", "\\Delta": "Δ",
  "\\Theta": "Θ", "\\Lambda": "Λ", "\\Pi": "Π", "\\Sigma": "Σ", "\\Phi": "Φ", "\\Psi": "Ψ", "\\Omega": "Ω",
  "-": "−",
};

export function display(latex) {
  return UNICODE[latex] ?? latex.replace(/^\\/, "");
}
