// "Learn my handwriting": shows one symbol at a time and saves each drawing of it.
// Symbols come round in rounds (every symbol once, then again...), so stopping
// early still leaves every chosen symbol with some drawings.

import { convertLatexToMarkup } from "../vendor/mathlive/mathlive.min.mjs";
import { InkPad } from "./inkpad.js";
import { SETS, NAMES } from "./symbols.js";

const $ = (id) => document.getElementById(id);
const PAUSE_MS = 1300;

/**
 * @param {{
 *   penOnly: () => boolean,
 *   countFor: (latex: string) => number,
 *   onSample: (latex: string, strokes: object[]) => void,
 *   onFinish: (saved: number) => void,
 * }} hooks
 */
export function setupTrainer(hooks) {
  const dialog = $("trainer");
  let queue = [];
  let index = 0;
  let saved = 0;
  let timer = 0;

  const pad = new InkPad($("trainer-pad"), {
    onStrokeStart: () => clearTimeout(timer),
    onStrokeEnd: () => {
      clearTimeout(timer);
      if ($("trainer-auto").checked) timer = setTimeout(next, PAUSE_MS);
    },
  });

  function renderSetup() {
    $("trainer-sets").replaceChildren(
      ...SETS.map((set) => {
        const label = document.createElement("label");
        label.className = "check";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = set.id;
        box.checked = set.on;
        const taught = set.symbols.filter((s) => hooks.countFor(s) > 0).length;
        label.append(box, ` ${set.name}`);
        if (taught) {
          const note = document.createElement("span");
          note.className = "badge";
          note.textContent = `${taught}/${set.symbols.length} taught`;
          label.append(note);
        }
        return label;
      }),
    );
    $("trainer-setup").hidden = false;
    $("trainer-run").hidden = true;
    $("trainer-done").hidden = true;
  }

  function start() {
    const reps = Number($("trainer-reps").value) || 3;
    const onlyNew = $("trainer-only-new").checked;
    const chosen = [...$("trainer-sets").querySelectorAll("input:checked")].map((b) => b.value);
    const symbols = SETS.filter((s) => chosen.includes(s.id)).flatMap((s) => s.symbols);
    queue = [];
    for (let round = 0; round < reps; round++) {
      for (const latex of symbols) {
        const have = hooks.countFor(latex);
        if (onlyNew && have + round >= reps) continue;
        queue.push({ latex, round });
      }
    }
    if (!queue.length) {
      $("trainer-setup-note").textContent = "Everything you picked is already taught. Untick “only symbols I haven't finished” to add more drawings.";
      return;
    }
    index = 0;
    saved = 0;
    pad.penOnly = hooks.penOnly();
    $("trainer-setup").hidden = true;
    $("trainer-run").hidden = false;
    show();
  }

  function show() {
    clearTimeout(timer);
    pad.clear();
    if (index >= queue.length) return finish();
    const { latex } = queue[index];
    $("trainer-symbol").innerHTML = convertLatexToMarkup(latex);
    $("trainer-name").textContent = NAMES[latex] ? `(${NAMES[latex]})` : "";
    const symbolsLeft = new Set(queue.slice(index).map((q) => q.latex)).size;
    $("trainer-progress").textContent = `${index + 1} of ${queue.length} · ${symbolsLeft} symbol${symbolsLeft === 1 ? "" : "s"} to go`;
  }

  function next() {
    clearTimeout(timer);
    if (index >= queue.length) return;
    if (!pad.isEmpty) {
      hooks.onSample(queue[index].latex, pad.getStrokes());
      saved++;
    }
    index++;
    show();
  }

  function skip() {
    const { latex } = queue[index];
    queue = queue.filter((q, i) => i <= index || q.latex !== latex);
    index++;
    show();
  }

  function finish() {
    clearTimeout(timer);
    $("trainer-run").hidden = true;
    $("trainer-done").hidden = false;
    $("trainer-summary").textContent = saved
      ? `Saved ${saved} drawing${saved === 1 ? "" : "s"}. The site now reads math with your handwriting. When it gets a symbol wrong, tap that symbol in the pad with your finger to correct it; it learns from every correction.`
      : "Nothing was saved.";
    hooks.onFinish(saved);
  }

  $("trainer-start").addEventListener("click", start);
  $("trainer-next").addEventListener("click", next);
  $("trainer-redo").addEventListener("click", () => {
    clearTimeout(timer);
    pad.clear();
  });
  $("trainer-skip").addEventListener("click", skip);
  $("trainer-stop").addEventListener("click", finish);
  dialog.addEventListener("close", () => clearTimeout(timer));

  return {
    open() {
      $("trainer-setup-note").textContent = "";
      renderSetup();
      dialog.showModal();
    },
  };
}
