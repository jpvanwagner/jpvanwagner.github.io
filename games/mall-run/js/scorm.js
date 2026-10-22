/* SCORM 1.2 (optional). Silently does nothing unless the page runs inside an LMS that exposes window.API. */
function findAPI(w) {
  let n = 0;
  while (!w.API && w.parent && w.parent !== w) { if (++n > 7) return null; w = w.parent; }
  return w.API || null;
}
function tryOpener(w) {
  try { return (w.opener && w.opener !== w) ? (findAPI(w.opener) || tryOpener(w.opener)) : null; } catch (e) { return null; }
}

let api = null, live = false;
try {
  api = findAPI(window) || tryOpener(window);
  if (api) { const r = api.LMSInitialize(""); live = (r === "true" || r === true); }
} catch (e) { /* not in an LMS */ }

export const SCORM = {
  get active() { return live; },
  set(k, v) { if (live) try { api.LMSSetValue(k, String(v)); } catch (e) {} },
  save() { if (live) try { api.LMSCommit(""); } catch (e) {} },
  quit() { if (live) try { api.LMSFinish(""); live = false; } catch (e) {} },
  report(pct, passed) {
    if (!live) return;
    this.set("cmi.core.score.raw", pct); this.set("cmi.core.score.min", "0"); this.set("cmi.core.score.max", "100");
    this.set("cmi.core.lesson_status", passed ? "passed" : "failed"); this.save();
  }
};
window.addEventListener("beforeunload", () => SCORM.quit());
