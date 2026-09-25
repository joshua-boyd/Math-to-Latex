import { MathfieldElement, convertLatexToMarkup } from "../vendor/mathlive/mathlive.min.mjs";
import { InkPad } from "./inkpad.js";
import { recognize } from "./myscript.js";
import { TABS, EDIT_BUTTONS, put } from "./toolbar.js";
import { lookalikes } from "./lookalikes.js";
import { buildDocument, linesWithEmptyBoxes } from "./export.js";

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
  proofEnv: true,
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
  return line?.kind === "math" ? line.el : null;
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
  if (line.kind === "math") {
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
    const grow = () => {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    };
    field.addEventListener("input", () => {
      line.value = field.value;
      saveDoc();
      grow();
    });
    requestAnimationFrame(grow);
  }
  line.el = field;

  const actions = document.createElement("div");
  actions.className = "line-actions";
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
    def.run(mf);
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
        put(mf, alt, { selectionMode: "item" });
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
    if (settings.autoConvert && !pad.isEmpty) {
      convertTimer = setTimeout(convert, settings.delay * 1000);
    }
  },
});
let convertTimer = 0;
let converting = false;

// Tapping the pad must not blur the math line (that would lose its selection).
$("pad").addEventListener("pointerdown", (e) => e.preventDefault());

function applySettingsToPad() {
  pad.penOnly = settings.penOnly;
  $("pad-hint").textContent = settings.penOnly
    ? "Write here with Apple Pencil"
    : "Write here (pencil, finger or mouse)";
}

async function convert() {
  clearTimeout(convertTimer);
  if (pad.isEmpty || converting) return;
  let line = activeLine() ?? addLine("math");
  const strokes = pad.getStrokes();
  converting = true;
  setStatus("Converting…", false, { sticky: true });
  // Inside \text{...} on a math line, read the handwriting as words.
  const wordsInMath = line.kind === "math" && line.el.mode === "text";
  try {
    const result = await recognize(strokes, wordsInMath ? "text" : line.kind, settings);
    if (!result) {
      setStatus("Nothing recognized — try writing a little larger", true);
      return;
    }
    // Only remove the strokes that were sent; keep anything written since.
    pad.removeFirst(strokes.length);
    if (wordsInMath) line.el.insert(result, { mode: "text", selectionMode: "after" });
    else if (line.kind === "math") insertMath(line.el, result);
    else insertText(line.el, result);
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    converting = false;
    if (!pad.isEmpty && settings.autoConvert) convertTimer = setTimeout(convert, settings.delay * 1000);
  }
}

function insertMath(mf, latex) {
  const fillingBox = !mf.selectionIsCollapsed && mf.getValue(mf.selection, "latex").includes("\\placeholder");
  put(mf, latex, { insertionMode: "replaceSelection", selectionMode: "after" });
  if (fillingBox && settings.jumpNext && mf.value.includes("\\placeholder")) {
    mf.executeCommand("moveToNextPlaceholder");
  }
  mf.focus();
}

function insertText(textarea, text) {
  const escaped = text.replace(/([&%#_$])/g, "\\$1");
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  const before = value.slice(0, s);
  const spacer = before && !/\s$/.test(before) ? " " : "";
  textarea.setRangeText(spacer + escaped, s, e, "end");
  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
}

$("convert").addEventListener("click", convert);
$("pad-undo").addEventListener("click", () => pad.undo());
$("pad-clear").addEventListener("click", () => {
  clearTimeout(convertTimer);
  pad.clear();
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
  applicationKey: [$("app-key"), "value"],
  hmacKey: [$("hmac-key"), "value"],
  penOnly: [$("pen-only"), "checked"],
  autoConvert: [$("auto-convert"), "checked"],
  delay: [$("delay"), "value"],
  jumpNext: [$("jump-next"), "checked"],
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
$("download-tex").addEventListener("click", () => {
  const blob = new Blob([$("export-text").value], { type: "application/x-tex" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "proof.tex";
  a.click();
  URL.revokeObjectURL(a.href);
});
$("overleaf").addEventListener("click", () => {
  $("overleaf-snip").value = $("export-text").value;
  $("overleaf-form").submit();
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

applySettingsToPad();
renderTabs();
renderLines();
if (!lines.length) addLine("math");
if (!settings.applicationKey) {
  setStatus("Add your free MyScript keys in Settings to convert handwriting", true, { sticky: true });
}
