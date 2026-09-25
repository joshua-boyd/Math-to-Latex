import { MathfieldElement, convertLatexToMarkup, validateLatex } from "../vendor/mathlive/mathlive.min.mjs";
import { InkPad } from "./inkpad.js";
import { recognize } from "./myscript.js";
import { TABS, EDIT_BUTTONS, put } from "./toolbar.js";
import { lookalikes } from "./lookalikes.js";
import { buildDocument, linesWithEmptyBoxes } from "./export.js";
import * as Shapes from "./shapes.js";
import { hasOpenFraction, hasEmptyFraction } from "./fraction.js";
import { prepareAlphabet, readMath, readText } from "./recognizer.js";
import { setupTrainer } from "./trainer.js";
import { display } from "./symbols.js";

MathfieldElement.fontsDirectory = new URL("../vendor/mathlive/fonts/", import.meta.url).href;
MathfieldElement.soundsDirectory = null;

const $ = (id) => document.getElementById(id);

// ---------- saved state ----------

const DOC_KEY = "m2l-doc";
const SETTINGS_KEY = "m2l-settings";

const settings = {
  applicationKey: "",
  hmacKey: "",
  penOnly: true,
  autoConvert: true,
  delay: 1.2,
  jumpNext: true,
  useShared: true,
  proofEnv: true,
  // "mine" (your own handwriting, in the browser) or "myscript"; chosen at startup if unset.
  reader: null,
  ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
};
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

/** @type {{id:string, kind:"math"|"text", value:string, el?:HTMLElement}[]} */
let lines = JSON.parse(localStorage.getItem(DOC_KEY) || "[]");
let activeId = null;
let nextId = Date.now();

const saveDoc = () =>
  localStorage.setItem(DOC_KEY, JSON.stringify(lines.map(({ id, kind, value }) => ({ id, kind, value }))));

const activeLine = () => lines.find((l) => l.id === activeId);
const activeMathfield = () => {
  const line = activeLine();
  return line?.kind === "math" && !line.source ? line.el : null;
};

// ---------- document lines ----------

function createLineElement(line) {
  const li = document.createElement("li");
  li.className = `line line-${line.kind}`;
  li.dataset.id = line.id;

  const tag = document.createElement("button");
  tag.type = "button";
  tag.className = "line-kind";
  tag.title = "Switch between math and text";
  tag.textContent = line.kind === "math" ? "Math" : "Text";
  tag.addEventListener("click", () => switchKind(line));

  let field;
  if (line.kind === "math" && line.source) {
    // Editing the line's LaTeX source directly.
    field = document.createElement("textarea");
    field.className = "line-source";
    field.rows = 1;
    field.value = line.value;
    field.autocapitalize = "off";
    field.spellcheck = false;
    field.setAttribute("autocorrect", "off");
    const error = document.createElement("span");
    error.className = "line-error";
    const wrap = document.createElement("div");
    wrap.className = "line-field";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.append(field, error);
    li.append(tag, wrap);
    const check = () => {
      const errors = validateLatex(field.value);
      li.classList.toggle("invalid", errors.length > 0);
      error.textContent = errors.length ? `Not valid LaTeX yet (${errors[0].code})` : "";
    };
    field.addEventListener("input", () => {
      line.value = field.value;
      saveDoc();
      autoGrow(field);
      check();
    });
    requestAnimationFrame(() => autoGrow(field));
    check();
  } else if (line.kind === "math") {
    field = new MathfieldElement();
    field.className = "line-field";
    li.append(tag, field);
    field.mathVirtualKeyboardPolicy = "manual";
    field.smartMode = false;
    field.value = line.value;
    field.addEventListener("input", () => {
      line.value = field.value;
      saveDoc();
      updateSwap();
    });
    field.addEventListener("selection-change", updateSwap);
  } else {
    field = document.createElement("textarea");
    field.className = "line-field line-textarea";
    field.rows = 1;
    field.placeholder = "Text (you can type inline math as $x_i$)";
    field.value = line.value;
    li.append(tag, field);
    field.addEventListener("input", () => {
      line.value = field.value;
      saveDoc();
      autoGrow(field);
    });
    requestAnimationFrame(() => autoGrow(field));
  }
  line.el = field;

  const actions = document.createElement("div");
  actions.className = "line-actions";
  if (line.kind === "math") {
    const source = iconButton(line.source ? "Done" : "TeX", "Edit this line as LaTeX code", () => {
      line.source = !line.source;
      refreshLine(line);
    });
    actions.append(source);
  }
  const copy = iconButton("Copy", "Copy this line's LaTeX", async () => {
    await navigator.clipboard.writeText(line.value);
    setStatus("Copied line");
  });
  const remove = iconButton("✕", "Delete line", () => deleteLine(line));
  actions.append(copy, remove);
  li.append(actions);

  li.addEventListener("focusin", () => setActive(line.id));
  li.addEventListener("pointerdown", () => setActive(line.id));
  return li;
}

/** MathLive doesn't always fire "input" for changes made from code, so save explicitly. */
function syncField(mf) {
  const line = lines.find((l) => l.el === mf);
  if (line && line.value !== mf.value) {
    line.value = mf.value;
    saveDoc();
  }
  updateSwap();
}

function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * Call before removing a math field. MathLive (0.110) remembers the focused field and
 * only lets go on a DOM blur event; if a field is removed while it still counts as
 * focused, focusing any other field afterwards throws. So make it let go explicitly.
 */
function releaseField(el) {
  if (!(el instanceof MathfieldElement)) return;
  el.blur();
  const inner = el._mathfield;
  if (inner && !inner.blurred) {
    inner.focusBlurInProgress = false;
    inner.onBlur({ dispatchEvents: false });
  }
}

function refreshLine(line) {
  const old = $("lines").querySelector(`[data-id="${line.id}"]`);
  endSession();
  releaseField(line.el);
  old.replaceWith(createLineElement(line));
  highlightActive();
  updateSwap();
  // A new math field isn't ready to take focus until it has rendered.
  requestAnimationFrame(() => line.el.focus());
}

function iconButton(text, title, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

function renderLines() {
  const ol = $("lines");
  endSession();
  ol.querySelectorAll("math-field").forEach(releaseField);
  ol.replaceChildren(...lines.map(createLineElement));
  if (!lines.some((l) => l.id === activeId)) activeId = lines.at(-1)?.id ?? null;
  highlightActive();
}

function addLine(kind, afterId = activeId) {
  const line = { id: String(nextId++), kind, value: "" };
  const at = lines.findIndex((l) => l.id === afterId);
  lines.splice(at === -1 ? lines.length : at + 1, 0, line);
  saveDoc();
  const el = createLineElement(line);
  const prev = at === -1 ? null : $("lines").children[at];
  prev ? prev.after(el) : $("lines").append(el);
  setActive(line.id);
  line.el.focus();
  el.scrollIntoView({ block: "nearest" });
  return line;
}

function deleteLine(line) {
  if (line.value.trim() && !confirm("Delete this line?")) return;
  const i = lines.indexOf(line);
  lines.splice(i, 1);
  saveDoc();
  if (activeId === line.id) activeId = lines[Math.min(i, lines.length - 1)]?.id ?? null;
  renderLines();
}

function switchKind(line) {
  if (line.value.trim() && !confirm("Switch this line between math and text? Its content stays as LaTeX source.")) return;
  line.kind = line.kind === "math" ? "text" : "math";
  saveDoc();
  renderLines();
  setActive(line.id);
}

function setActive(id) {
  if (activeId === id) return;
  endSession();
  activeId = id;
  highlightActive();
  updateSwap();
}

function highlightActive() {
  for (const li of $("lines").children) li.classList.toggle("active", li.dataset.id === activeId);
}

// ---------- toolbar ----------

let currentTab = 0;

function makeToolButton(def) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tool";
  b.title = def.title;
  if (def.latex) b.innerHTML = convertLatexToMarkup(def.latex);
  else b.textContent = def.text;
  // Keep the math line focused (and its selection intact) while tapping buttons.
  b.addEventListener("pointerdown", (e) => e.preventDefault());
  b.addEventListener("click", () => {
    const mf = activeMathfield();
    if (!mf) {
      setStatus("Tap a math line first", true);
      return;
    }
    endSession();
    def.run(mf);
    syncField(mf);
    mf.focus();
  });
  return b;
}

function renderTabs() {
  const tabs = $("tabs");
  tabs.replaceChildren(
    ...TABS.map((tab, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.textContent = tab.name;
      b.setAttribute("aria-selected", String(i === currentTab));
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        currentTab = i;
        renderTabs();
      });
      return b;
    }),
  );
  $("tab-buttons").replaceChildren(...TABS[currentTab].buttons.map(makeToolButton));
}

$("edit-buttons").replaceChildren(...EDIT_BUTTONS.map(makeToolButton));

// ---------- look-alike swaps ----------

function currentSymbol(mf) {
  if (!mf.selectionIsCollapsed) {
    return { range: mf.selection.ranges[0], latex: mf.getValue(mf.selection, "latex") };
  }
  const p = mf.position;
  if (p <= 0) return null;
  return { range: [p - 1, p], latex: mf.getValue(p - 1, p, "latex") };
}

function updateSwap() {
  const mf = activeMathfield();
  const sym = mf && currentSymbol(mf);
  const options = sym ? lookalikes(sym.latex) : [];
  $("swap").hidden = options.length === 0;
  if (!options.length) return;
  $("swap-current").innerHTML = convertLatexToMarkup(sym.latex);
  $("swap-options").replaceChildren(
    ...options.map((alt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tool";
      b.title = alt;
      b.innerHTML = convertLatexToMarkup(alt);
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        mf.selection = { ranges: [sym.range] };
        endSession();
        put(mf, alt, { selectionMode: "item" });
        syncField(mf);
        mf.focus();
      });
      return b;
    }),
  );
}

// ---------- writing pad ----------

const pad = new InkPad($("pad"), {
  onStrokeStart() {
    clearTimeout(convertTimer);
    $("pad-hint").hidden = true;
  },
  onStrokeEnd() {
    clearTimeout(convertTimer);
    hideFix();
    if (settings.autoConvert && !pad.isEmpty) scheduleAutoConvert();
  },
  onTap: (x, y) => openFix(x, y),
});
let convertTimer = 0;
let converting = false;

function scheduleAutoConvert() {
  clearTimeout(convertTimer);
  convertTimer = setTimeout(() => convert({ auto: true }), settings.delay * 1000);
}

const WAITING_FOR_FRACTION = "Waiting for the rest of the fraction… (tap Convert to insert it as is)";

// Tapping the pad must not blur the math line (that would lose its selection).
$("pad").addEventListener("pointerdown", (e) => e.preventDefault());

function applySettingsToPad() {
  pad.penOnly = settings.penOnly;
  $("pad-hint").textContent = settings.penOnly
    ? "Write here with Apple Pencil"
    : "Write here (pencil, finger or mouse)";
  // With the pencil-only setting, a finger tap corrects a symbol; otherwise use the button.
  $("pad-fix").hidden = settings.reader !== "mine";
}

let lastInk = [];

// ---------- ink sessions ----------
//
// Converted ink stays in the pad (in gray). If you keep writing, all of it is read
// again and the new result replaces the old one, so a fraction bar, denominator or
// exponent added after a pause joins the expression instead of landing after it.
// A session ends (the gray ink is cleared) when the line is changed any other way:
// a button, typing, switching lines, filling a box, or Clear.

/** @type {null | {line: object, el: HTMLElement, before: object, after: string, version: number}} */
let session = null;

function captureState(el) {
  return el instanceof MathfieldElement
    ? { value: el.value, selection: { ranges: el.selection.ranges.map((r) => [...r]) } }
    : { value: el.value, start: el.selectionStart, end: el.selectionEnd };
}

function restoreState(el, state) {
  el.value = state.value;
  if (el instanceof MathfieldElement) el.selection = state.selection;
  else el.setSelectionRange(state.start, state.end);
}

/** Start fresh: forget the converted ink (anything not yet converted stays). */
function endSession() {
  session = null;
  if (pad.convertedCount) pad.removeConverted();
}

const selectionKey = (el) =>
  el instanceof MathfieldElement ? JSON.stringify(el.selection.ranges) : `${el.selectionStart},${el.selectionEnd}`;

/** The session continues only if its line (and cursor) haven't changed since the last conversion. */
function sessionContinues(line) {
  return (
    session &&
    session.line === line &&
    session.el === line.el &&
    line.el.value === session.after &&
    selectionKey(line.el) === session.afterSelection
  );
}

function syncLine(line) {
  if (line.el instanceof MathfieldElement) syncField(line.el);
  else line.el.dispatchEvent(new Event("input"));
}

/**
 * @param {{auto?: boolean}} options  auto: started by the pause timer rather than the Convert button.
 *   Auto-convert holds back fractions that are only half written; Convert always goes ahead.
 */
async function convert({ auto = false } = {}) {
  clearTimeout(convertTimer);
  if (converting) return;
  let line = activeLine() ?? addLine("math");
  if (session && !sessionContinues(line)) endSession();
  if (pad.isEmpty) {
    // All of the session's ink was undone or erased: undo its result too.
    if (session) {
      restoreState(line.el, session.before);
      syncLine(line);
      session = null;
    }
    return;
  }
  if (session && session.version === pad.version) return; // nothing new since last time
  const strokes = pad.getStrokes();
  const version = pad.version;
  const mathInk = line.kind === "math" && (line.source || line.el.mode !== "text");
  if (auto && mathInk && hasOpenFraction(strokes)) {
    setStatus(WAITING_FOR_FRACTION, false, { sticky: true });
    return;
  }
  converting = true;
  setStatus("Converting…", false, { sticky: true });
  // Inside \text{...} on a math line, read the handwriting as words.
  const wordsInMath = line.kind === "math" && !line.source && line.el.mode === "text";
  try {
    let result;
    let raw = false;
    let groups = null;
    if (settings.reader === "mine") {
      const read = readWithMine(strokes, wordsInMath || line.kind === "text");
      result = read.value;
      groups = read.groups;
      raw = true; // text results already have $…$ around any math symbols
    } else {
      const whole = line.kind === "text" ? Shapes.bestMatch(strokes, taught()) : null;
      if (whole) {
        // A taught shape written by itself on a text line becomes inline math.
        result = `$${whole.shape.latex}$`;
        raw = true;
      } else if (wordsInMath || line.kind === "text") {
        result = await recognize(strokes, "text", settings);
      } else {
        result = await recognizeMath(strokes);
      }
    }
    lastInk = strokes;
    if (!result) {
      setStatus("Nothing recognized — try writing a little larger", true);
      return;
    }
    if (auto && !wordsInMath && line.kind === "math" && hasEmptyFraction(result)) {
      // Keep the ink and wait for the rest of the fraction.
      setStatus(WAITING_FOR_FRACTION, false, { sticky: true });
      return;
    }
    // The line may have been changed (or switched) while MyScript was working.
    if (activeLine() !== line || (session && !sessionContinues(line))) {
      if (session) endSession();
      return;
    }

    // Replace the previous result from this same ink, or remember where we started.
    const before = session ? session.before : captureState(line.el);
    if (session) restoreState(line.el, session.before);

    let filledBox = false;
    if (wordsInMath) {
      line.el.insert(result, { mode: "text", selectionMode: "after" });
      syncField(line.el);
    } else if (line.kind === "math" && line.source) insertText(line.el, result, { raw: true });
    else if (line.kind === "math") filledBox = insertMath(line.el, result);
    else insertText(line.el, result, { raw });

    const sent = strokes.length;
    if (filledBox) {
      // Filling a box is one step; the next writing goes into the next box.
      session = null;
      pad.markConverted(sent);
      pad.removeConverted();
      setStatus("");
    } else {
      session = { line, el: line.el, before, after: line.el.value, afterSelection: selectionKey(line.el), version };
      pad.markConverted(sent);
      if (groups) {
        // Show what each symbol was read as, so a wrong one can be tapped and corrected.
        lastRead = { strokes, groups };
        pad.setLabels(groups.map((g) => ({ box: g.box, text: display(g.label) })));
        setStatus(`Wrong symbol? Tap it with your finger${settings.penOnly ? "" : " (after Fix a symbol)"}. Keep writing to add more.`);
      } else {
        setStatus("Keep writing to add to this, or tap Clear to start the next part");
      }
    }
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    converting = false;
    // Only go again if the ink changed while this conversion was running. Retrying
    // the same ink (after an error or a held-back fraction) would just repeat the
    // same request and use up the free quota.
    if (pad.version !== version && !pad.isEmpty && settings.autoConvert) scheduleAutoConvert();
  }
}

// ---------- reading with your own handwriting ----------

let alphabetCache = null;
const alphabet = () => (alphabetCache ??= prepareAlphabet(myShapes));

/** @returns {{value: string, groups: object[]}} */
function readWithMine(strokes, asText) {
  const a = alphabet();
  if (!a.samples.length) {
    throw new Error("Teach the site your handwriting first: My handwriting → Learn my handwriting.");
  }
  const read = asText ? readText(strokes, a) : readMath(strokes, a);
  return { value: asText ? read.text : read.latex, groups: read.groups };
}

function addSample(latex, strokes) {
  let shape = myShapes.find((s) => s.latex === latex);
  if (!shape) myShapes.push((shape = { id: Shapes.newId(), latex, samples: [] }));
  shape.samples.push(Shapes.compactStrokes(strokes));
  saveShapes();
}

// ---------- correcting a symbol in the pad ----------

/** The last ink read with your handwriting, and how it was split into symbols. */
let lastRead = null;
let fixTarget = null;

function openFix(x, y) {
  if (settings.reader !== "mine" || !lastRead || !pad.labels.length) {
    setStatus("Convert first, then tap a symbol to correct it", true);
    return;
  }
  // The symbol you tapped inside (or its label, just below it), else the nearest one.
  const distance = ({ box: b }) => Math.hypot(Math.max(0, b.minX - x, x - b.maxX), Math.max(0, b.minY - y, y - b.maxY - 20));
  const nearest = [...lastRead.groups].sort((a, b) => distance(a) - distance(b))[0];
  if (!nearest || distance(nearest) > 25) {
    setStatus("Tap right on the symbol you want to correct", true);
    return;
  }
  fixTarget = nearest;
  $("fix-current").innerHTML = convertLatexToMarkup(fixTarget.label);
  $("fix-options").replaceChildren(
    ...fixTarget.alternatives
      .filter((a) => a.label !== fixTarget.label)
      .slice(0, 7)
      .map((a) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tool";
        b.title = a.label;
        b.innerHTML = convertLatexToMarkup(a.label);
        b.addEventListener("click", () => applyFix(a.label));
        return b;
      }),
  );
  $("fix-input").value = "";
  const pop = $("fix-popover");
  pop.hidden = false;
  const padBox = $("pad").getBoundingClientRect();
  const left = Math.max(4, Math.min(fixTarget.box.cx - pop.offsetWidth / 2, padBox.width - pop.offsetWidth - 4));
  const below = fixTarget.box.maxY + 26;
  const top = below + pop.offsetHeight < padBox.height ? below : Math.max(4, fixTarget.box.minY - pop.offsetHeight - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

function hideFix() {
  $("fix-popover").hidden = true;
  fixTarget = null;
}

/** Save the tapped symbol's ink as a drawing of `latex`, then read the ink again. */
function applyFix(latex) {
  const target = fixTarget;
  hideFix();
  latex = latex.trim();
  if (!target || !latex) return;
  if (validateLatex(latex).length) {
    setStatus("That LaTeX isn't valid", true);
    return;
  }
  addSample(latex, target.indices.map((i) => lastRead.strokes[i]));
  if (session) session.version = -1;
  convert();
}

$("fix-ok").addEventListener("click", () => applyFix($("fix-input").value));
$("fix-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    applyFix($("fix-input").value);
  }
});
$("fix-cancel").addEventListener("click", hideFix);
$("pad-fix").addEventListener("click", (e) => {
  pad.tapMode = !pad.tapMode;
  e.currentTarget.setAttribute("aria-pressed", String(pad.tapMode));
});

/** Math recognition that knows about your taught shapes. */
async function recognizeMath(strokes) {
  const shapes = taught();
  const matches = shapes.length ? Shapes.findShapes(strokes, shapes) : [];
  // Just one taught shape by itself: no need to ask MyScript at all.
  if (matches.length === 1 && matches[0].count === strokes.length) return matches[0].shape.latex;
  if (matches.length) {
    const swap = Shapes.substitute(strokes, matches);
    const result = await recognize(swap.strokes, "math", settings);
    const restored = Shapes.restore(result, swap.latex, swap.count);
    if (restored !== null) return restored;
    // MyScript didn't place every stand-in; fall back to reading the ink as written.
  }
  return recognize(strokes, "math", settings);
}

/** @returns {boolean} whether this filled an empty box */
function insertMath(mf, latex, { focus = true } = {}) {
  const fillingBox = !mf.selectionIsCollapsed && mf.getValue(mf.selection, "latex").includes("\\placeholder");
  put(mf, latex, { insertionMode: "replaceSelection", selectionMode: "after" });
  if (fillingBox && settings.jumpNext && mf.value.includes("\\placeholder")) {
    mf.executeCommand("moveToNextPlaceholder");
  }
  syncField(mf);
  if (focus) mf.focus();
  return fillingBox;
}

function insertText(textarea, text, { raw = false } = {}) {
  const escaped = raw ? text : text.replace(/([&%#_$])/g, "\\$1");
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  const before = value.slice(0, s);
  const spacer = before && !/\s$/.test(before) ? " " : "";
  textarea.setRangeText(spacer + escaped, s, e, "end");
  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
}

$("convert").addEventListener("click", () => convert());
$("pad-undo").addEventListener("click", () => {
  pad.undo();
  // Re-read what's left so the line matches the ink.
  if (session) scheduleAutoConvert();
});
$("pad-clear").addEventListener("click", () => {
  clearTimeout(convertTimer);
  session = null;
  lastRead = null;
  hideFix();
  pad.clear();
  setStatus("");
});
$("pad-erase").addEventListener("click", (e) => {
  pad.erasing = !pad.erasing;
  e.currentTarget.setAttribute("aria-pressed", String(pad.erasing));
});
for (const id of ["convert", "pad-undo", "pad-clear", "pad-erase"]) {
  $(id).addEventListener("pointerdown", (e) => e.preventDefault());
}

// ---------- status ----------

let statusTimer = 0;
function setStatus(text, isError = false, { sticky = false } = {}) {
  const el = $("status");
  el.textContent = text;
  el.classList.toggle("error", isError);
  clearTimeout(statusTimer);
  if (text && !sticky) statusTimer = setTimeout(() => (el.textContent = ""), isError ? 6000 : 2000);
}

// ---------- settings dialog ----------

const settingInputs = {
  reader: [$("reader"), "value"],
  applicationKey: [$("app-key"), "value"],
  hmacKey: [$("hmac-key"), "value"],
  penOnly: [$("pen-only"), "checked"],
  autoConvert: [$("auto-convert"), "checked"],
  delay: [$("delay"), "value"],
  jumpNext: [$("jump-next"), "checked"],
  useShared: [$("use-shared"), "checked"],
  proofEnv: [$("proof-env"), "checked"],
};

$("open-settings").addEventListener("click", () => {
  for (const [key, [input, prop]] of Object.entries(settingInputs)) input[prop] = settings[key];
  $("settings").showModal();
});
$("settings").addEventListener("close", () => {
  for (const [key, [input, prop]] of Object.entries(settingInputs)) {
    settings[key] = prop === "checked" ? input.checked : input.value.trim();
  }
  settings.delay = Math.min(5, Math.max(0.3, Number(settings.delay) || 1.2));
  saveSettings();
  applySettingsToPad();
  preparedShapes = null;
  lastRead = null;
  pad.setLabels([]);
  if (settings.reader === "myscript" && settings.applicationKey && settings.hmacKey) setStatus("Keys saved");
  else setStatus("");
});

// ---------- export dialog ----------

$("open-export").addEventListener("click", () => {
  const empty = linesWithEmptyBoxes(lines);
  const warning = $("export-warning");
  warning.hidden = empty.length === 0;
  warning.textContent = empty.length
    ? `Line${empty.length > 1 ? "s" : ""} ${empty.join(", ")} still ${empty.length > 1 ? "have" : "has"} empty boxes. They are left blank in the LaTeX.`
    : "";
  $("export-text").value = buildDocument(lines, { proofEnvironment: settings.proofEnv });
  $("export").showModal();
});
$("copy-tex").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("export-text").value);
  $("copy-tex").textContent = "Copied";
  setTimeout(() => ($("copy-tex").textContent = "Copy"), 1500);
});
function download(text, filename, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  // Safari needs the link to stay valid for a moment after the click.
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

$("download-tex").addEventListener("click", () => download($("export-text").value, "proof.tex", "application/x-tex"));
$("overleaf").addEventListener("click", () => {
  $("overleaf-snip").value = $("export-text").value;
  $("overleaf-form").submit();
});

// ---------- typing LaTeX ----------

$("toggle-tex").addEventListener("click", () => {
  const bar = $("tex-bar");
  bar.hidden = !bar.hidden;
  $("toggle-tex").setAttribute("aria-pressed", String(!bar.hidden));
  if (!bar.hidden) $("tex-input").focus();
});
$("toggle-tex").addEventListener("pointerdown", (e) => e.preventDefault());

$("tex-input").addEventListener("input", () => {
  const latex = $("tex-input").value.trim();
  $("tex-preview").innerHTML = latex ? convertLatexToMarkup(latex) : "";
});

function insertTypedLatex() {
  const latex = $("tex-input").value.trim();
  if (!latex) return;
  endSession();
  const line = activeLine() ?? addLine("math");
  if (line.kind === "math" && !line.source) {
    if (validateLatex(latex).length) {
      setStatus("That LaTeX isn't valid yet", true);
      return;
    }
    // Keep the keyboard up for more typing.
    insertMath(line.el, latex, { focus: false });
  } else {
    insertText(line.el, latex, { raw: true });
  }
  $("tex-input").value = "";
  $("tex-preview").innerHTML = "";
}
$("tex-insert").addEventListener("click", insertTypedLatex);
$("tex-insert").addEventListener("pointerdown", (e) => e.preventDefault());
$("tex-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    insertTypedLatex();
  }
});

// ---------- taught shapes ----------

const SHAPES_KEY = "m2l-shapes";
let myShapes = JSON.parse(localStorage.getItem(SHAPES_KEY) || "[]");
let sharedShapes = [];
let preparedShapes = null;

function saveShapes() {
  localStorage.setItem(SHAPES_KEY, JSON.stringify(myShapes));
  preparedShapes = null;
  alphabetCache = null;
}

/** Your shapes plus (if turned on) the shared library, ready for matching. */
function taught() {
  if (!preparedShapes) {
    const shared = settings.useShared ? sharedShapes.map((s) => ({ ...s, shared: true })) : [];
    preparedShapes = Shapes.prepare([...myShapes, ...shared]);
  }
  return preparedShapes;
}

async function loadSharedShapes() {
  try {
    const res = await fetch("shapes/shared.json", { cache: "no-cache" });
    if (!res.ok) return;
    sharedShapes = Shapes.fromFile(await res.text());
    preparedShapes = null;
  } catch {
    // Offline or missing: your own shapes still work.
  }
}

const teachPad = new InkPad($("teach-pad"), { onStrokeEnd: teachFeedback });

function teachMessage(text) {
  $("teach-feedback").textContent = text;
}

function teachFeedback() {
  const strokes = teachPad.getStrokes();
  if (!strokes.length) return teachMessage("Draw the shape once, by itself.");
  const match = Shapes.bestMatch(strokes, taught(), { minScore: 0 });
  if (!match) return teachMessage("This doesn't look like any taught shape yet.");
  const needed = match.shape.shared ? Shapes.MIN_SCORE_SHARED : Shapes.MIN_SCORE;
  const verdict = match.score >= needed ? "it would be recognized" : "too different to count as it";
  $("teach-feedback").innerHTML = `Closest taught shape: ${convertLatexToMarkup(match.shape.latex)} — ${Math.round(match.score * 100)}%, ${verdict}.`;
}

$("teach-latex").addEventListener("input", () => {
  const latex = $("teach-latex").value.trim();
  $("teach-preview").innerHTML = latex
    ? validateLatex(latex).length
      ? "<span class='line-error'>not valid LaTeX yet</span>"
      : convertLatexToMarkup(latex)
    : "";
});

// Enter would otherwise submit (and close) the dialog.
$("teach-latex").addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.preventDefault();
});

$("teach-save").addEventListener("click", () => {
  const latex = $("teach-latex").value.trim();
  const strokes = teachPad.getStrokes();
  if (!latex) return teachMessage("Type the LaTeX for this shape first (for example \\partial).");
  if (validateLatex(latex).length) return teachMessage("That LaTeX isn't valid yet.");
  if (!strokes.length) return teachMessage("Draw the shape first.");
  if (strokes.length > Shapes.MAX_GROUP) return teachMessage(`A taught shape can have at most ${Shapes.MAX_GROUP} strokes.`);
  addSample(latex, strokes);
  teachPad.clear();
  renderShapeList();
  const n = myShapes.find((s) => s.latex === latex).samples.length;
  teachMessage(n < 3 ? `Saved (${n} so far). Draw it again: 3 to 5 drawings works best.` : `Saved (${n} drawings).`);
});
$("teach-clear").addEventListener("click", () => {
  teachPad.clear();
  teachFeedback();
});
$("teach-last").addEventListener("click", () => {
  if (!lastInk.length) return teachMessage("Write the symbol by itself in the main pad and convert it first.");
  if (lastInk.length > Shapes.MAX_GROUP) return teachMessage("What you last wrote has too many strokes. Write just the symbol, then try again.");
  teachPad.load(lastInk);
  teachFeedback();
});

function renderShapeList() {
  const list = $("shape-list");
  const rows = [
    ...myShapes.map((s) => ({ ...s, shared: false })),
    ...(settings.useShared ? sharedShapes.map((s) => ({ ...s, shared: true })) : []),
  ];
  if (!rows.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No taught shapes yet.";
    list.replaceChildren(li);
    return;
  }
  list.replaceChildren(
    ...rows.map((shape) => {
      const li = document.createElement("li");
      const preview = document.createElement("span");
      preview.className = "shape-latex";
      preview.innerHTML = convertLatexToMarkup(shape.latex);
      const info = document.createElement("span");
      info.className = "shape-info";
      info.textContent = `${shape.latex} · ${shape.samples.length} drawing${shape.samples.length === 1 ? "" : "s"}`;
      if (shape.shared) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "shared";
        info.append(badge);
      }
      const more = iconButton("Teach more", "Add more drawings of this shape", () => {
        $("teach-latex").value = shape.latex;
        $("teach-latex").dispatchEvent(new Event("input"));
        teachPad.clear();
        teachMessage(`Draw ${shape.latex} again, then save.`);
        $("teach-pad").scrollIntoView({ block: "center" });
      });
      li.append(preview, info, more);
      if (!shape.shared) {
        li.append(
          iconButton("Delete", "Forget this shape", () => {
            if (!confirm(`Forget your drawings of ${shape.latex}?`)) return;
            myShapes = myShapes.filter((s) => s.id !== shape.id);
            saveShapes();
            renderShapeList();
          }),
        );
      }
      return li;
    }),
  );
}

$("open-shapes").addEventListener("click", () => {
  teachPad.penOnly = settings.penOnly;
  renderShapeList();
  $("shapes").showModal();
  teachFeedback();
});

const trainer = setupTrainer({
  penOnly: () => settings.penOnly,
  countFor: (latex) => myShapes.find((s) => s.latex === latex)?.samples.length ?? 0,
  onSample: (latex, strokes) => addSample(latex, strokes),
  onFinish(saved) {
    if (saved && settings.reader !== "mine") {
      settings.reader = "mine";
      saveSettings();
      applySettingsToPad();
    }
    if (saved) setStatus("Now reading your handwriting. Write in the pad to try it.");
  },
});
$("open-trainer").addEventListener("click", () => {
  $("shapes").close();
  trainer.open();
});

$("export-shapes").addEventListener("click", () => {
  if (!myShapes.length) return teachMessage("You haven't taught any shapes yet.");
  download(Shapes.toFile(myShapes), "my-shapes.json", "application/json");
});
$("import-shapes").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const incoming = Shapes.fromFile(await file.text());
    myShapes = Shapes.merge(myShapes, incoming);
    saveShapes();
    renderShapeList();
    teachMessage(`Imported ${incoming.length} shape${incoming.length === 1 ? "" : "s"}.`);
  } catch (err) {
    teachMessage(err.message);
  }
});

// ---------- document buttons ----------

$("add-math").addEventListener("click", () => addLine("math"));
$("add-text").addEventListener("click", () => addLine("text"));
$("new-doc").addEventListener("click", () => {
  if (lines.some((l) => l.value.trim()) && !confirm("Start a new document? The current one will be erased (export it first if you need it).")) return;
  lines = [];
  saveDoc();
  renderLines();
  addLine("math");
});

// ---------- start ----------

// For tests and troubleshooting in the browser console.
window.m2lDebug = {
  pad,
  get lastRead() {
    return lastRead;
  },
};

if (!settings.reader) settings.reader = "mine";
applySettingsToPad();
loadSharedShapes();
renderTabs();
renderLines();
if (!lines.length) addLine("math");
if (settings.reader === "mine" && !myShapes.length) {
  setStatus("Teach the site your handwriting: tap My handwriting → Learn my handwriting", true, { sticky: true });
} else if (settings.reader === "myscript" && !settings.applicationKey) {
  setStatus("Add your free MyScript keys in Settings to convert handwriting", true, { sticky: true });
}
