// Calls MyScript's cloud recognizer (free tier: 2,000 requests/month).
// Same REST endpoint and request shape as MyScript's own iink-ts "INK_V2"
// client, without pulling in their whole SDK.

const URL = "https://cloud.myscript.com/api/v4.0/iink/recognize";

// MyScript expects millimetres per CSS pixel (96 dpi).
const MM_PER_PX = 0.265;

const margin = { top: 20, left: 10, right: 10, bottom: 10 };

function mathConfig() {
  return {
    lang: "en_US",
    math: {
      // Don't let MyScript compute answers and append them to what you wrote.
      solver: { enable: false },
      margin,
      eraser: { "erase-precisely": false },
      "undo-redo": { mode: "stroke" },
      mimeTypes: ["application/x-latex"],
    },
    export: { jiix: { "bounding-box": false, strokes: false, text: { chars: false, words: true } } },
  };
}

function textConfig() {
  return {
    lang: "en_US",
    text: {
      guides: { enable: false },
      margin,
      eraser: { "erase-precisely": false },
      mimeTypes: ["text/plain"],
    },
    export: { jiix: { "bounding-box": false, strokes: false, text: { chars: false, words: true } } },
  };
}

async function hmac(message, applicationKey, hmacKey) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(applicationKey + hmacKey),
    { name: "HMAC", hash: { name: "SHA-512" } },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @param {{x:number[], y:number[], t:number[], p:number[], pointerType:string}[]} strokes
 * @param {"math"|"text"} kind
 * @param {{applicationKey:string, hmacKey:string}} keys
 * @returns {Promise<string>} LaTeX for math, plain text for text
 */
export async function recognize(strokes, kind, keys) {
  if (!keys.applicationKey || !keys.hmacKey) {
    throw new Error("Add your free MyScript keys in Settings first.");
  }
  if (!crypto.subtle) {
    // Browsers only allow signing requests on https:// pages (or localhost).
    throw new Error("Open the site over https (for example GitHub Pages) to use handwriting recognition.");
  }
  const body = JSON.stringify({
    configuration: kind === "math" ? mathConfig() : textConfig(),
    scaleX: MM_PER_PX,
    scaleY: MM_PER_PX,
    contentType: kind === "math" ? "Math" : "Text",
    strokes: strokes.map((s, i) => ({
      id: `s${i}`,
      pointerType: s.pointerType,
      x: s.x,
      y: s.y,
      t: s.t,
      p: s.p,
    })),
  });

  const headers = new Headers({
    Accept: kind === "math" ? "application/x-latex" : "text/plain",
    "Content-Type": "application/json",
    applicationKey: keys.applicationKey,
    hmac: await hmac(body, keys.applicationKey, keys.hmacKey),
  });

  let response;
  try {
    response = await fetch(URL, { method: "POST", headers, body, credentials: "omit" });
  } catch {
    throw new Error("Couldn't reach MyScript. Check your internet connection.");
  }
  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      const err = JSON.parse(text);
      if (err.code === "access.not.granted") detail = "MyScript rejected the keys. Check them in Settings.";
      else detail = err.message || text;
    } catch {}
    throw new Error(detail || `MyScript error ${response.status}`);
  }
  return text.trim();
}
