// Turns the document's lines into a complete .tex file.

const EMPTY_BOX = /\\placeholder(\[[^\]]*\])?\{[^}]*\}/g;

/** Line numbers (1-based) of math lines that still have empty boxes. */
export function linesWithEmptyBoxes(lines) {
  return lines
    .map((line, i) => (line.kind === "math" && line.value.includes("\\placeholder") ? i + 1 : 0))
    .filter(Boolean);
}

const clean = (latex) => latex.replace(EMPTY_BOX, "{}").trim();

/** The body only: paragraphs of text and display math. */
export function buildBody(lines) {
  const parts = [];
  let mathRun = [];
  const flushMath = () => {
    if (mathRun.length === 1) parts.push(`\\[\n  ${mathRun[0]}\n\\]`);
    else if (mathRun.length > 1) parts.push(`\\begin{gather*}\n  ${mathRun.join(" \\\\\n  ")}\n\\end{gather*}`);
    mathRun = [];
  };
  for (const line of lines) {
    if (line.kind === "math") {
      const latex = clean(line.value);
      if (latex) mathRun.push(latex);
    } else {
      flushMath();
      const text = line.value.trim();
      if (text) parts.push(text);
    }
  }
  flushMath();
  return parts.join("\n\n");
}

export function buildDocument(lines, { proofEnvironment = true } = {}) {
  const body = buildBody(lines);
  const packages = ["amsmath", "amssymb", "amsthm"];
  if (body.includes("\\mathscr")) packages.push("mathrsfs");
  // MathLive writes \boldsymbol as \bm.
  if (body.includes("\\bm")) packages.push("bm");
  const content = proofEnvironment ? `\\begin{proof}\n${body}\n\\end{proof}` : body;
  return [
    "\\documentclass{article}",
    ...packages.map((p) => `\\usepackage{${p}}`),
    "",
    "\\begin{document}",
    "",
    content,
    "",
    "\\end{document}",
    "",
  ].join("\n");
}
