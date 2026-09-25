// Keeps auto-convert from sending a fraction before it's finished.
// MyScript reads a whole fraction well, but numerator + bar alone comes back as
// \frac{1}{}, and the denominator then ends up outside the fraction.

function bbox(s) {
  return {
    minX: Math.min(...s.x),
    maxX: Math.max(...s.x),
    minY: Math.min(...s.y),
    maxY: Math.max(...s.y),
  };
}

/** A long, flat stroke: a fraction bar (or a minus sign). */
function isBar(b) {
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  return w >= 25 && h <= Math.max(8, w * 0.2);
}

/**
 * True if some bar has writing above it but not below, or below but not above.
 * A minus sign has nothing above or below it, so it doesn't count.
 */
export function hasOpenFraction(strokes) {
  const boxes = strokes.map(bbox);
  return boxes.some((bar, i) => {
    if (!isBar(bar)) return false;
    const y = (bar.minY + bar.maxY) / 2;
    const margin = (bar.maxX - bar.minX) * 0.1;
    let above = false;
    let below = false;
    boxes.forEach((b, j) => {
      if (j === i) return;
      const cx = (b.minX + b.maxX) / 2;
      if (cx < bar.minX - margin || cx > bar.maxX + margin) return;
      if (b.maxY < y) above = true;
      else if (b.minY > y) below = true;
    });
    return above !== below;
  });
}

/** Read a {...} group starting at `i` (skipping spaces); returns [content, index after]. */
function group(latex, i) {
  while (latex[i] === " ") i++;
  if (latex[i] !== "{") return [null, i];
  let depth = 0;
  for (let j = i; j < latex.length; j++) {
    if (latex[j] === "\\") j++;
    else if (latex[j] === "{") depth++;
    else if (latex[j] === "}" && --depth === 0) return [latex.slice(i + 1, j), j + 1];
  }
  return [null, latex.length];
}

/** True if MyScript's answer has a fraction with an empty top or bottom. */
export function hasEmptyFraction(latex) {
  for (let i = latex.indexOf("\\frac"); i !== -1; i = latex.indexOf("\\frac", i + 1)) {
    const [top, next] = group(latex, i + 5);
    const [bottom] = group(latex, next);
    if (top?.trim() === "" || bottom?.trim() === "") return true;
  }
  return false;
}
