/* Question modal: power-up questions (easy) and revive questions (hard). */
import { QUESTIONS, HARD_QUESTIONS } from "../questions.js";
import { POWER_NAME } from "../config.js";
import { SETTINGS } from "../settings.js";
import { shuffle } from "../rng.js";

let qQueue = [], hqQueue = [];
export function resetQuestions() { qQueue = shuffle(QUESTIONS); hqQueue = shuffle(HARD_QUESTIONS); }

function nextQuestion(hard) {
  let q = hard ? hqQueue : qQueue;
  if (q.length === 0) { q = shuffle(hard ? HARD_QUESTIONS : QUESTIONS); if (hard) hqQueue = q; else qQueue = q; }
  const raw = q.pop(), order = shuffle(raw.a.map((_, i) => i));
  return { q: raw.q, a: order.map(k => raw.a[k]), c: order.indexOf(raw.c) };
}

const $ = id => document.getElementById(id);
let timer = null, locked = false;

/** Shows a question. done(correct) is called after the result has been shown briefly. */
export function openQuestion(mode, kind, reason, done) {
  locked = false;
  const q = nextQuestion(mode === "revive"), start = performance.now();
  const badge = $("qbadge");
  badge.className = mode === "revive" ? "revive" : "power";
  badge.textContent = mode === "revive" ? ("☠ " + (reason || "Down!") + "  Answer to REVIVE") : ("Power-up! " + (POWER_NAME[kind] || ""));
  const res = $("qresult"); res.textContent = ""; res.className = "";
  $("qtext").textContent = q.q;
  const box = $("answers"); box.innerHTML = "";

  function answer(idx, btn) {
    if (locked) return; locked = true; clearInterval(timer);
    const btns = box.querySelectorAll(".answer");
    btns.forEach(b => { b.disabled = true; });
    btns[q.c].classList.add("correct");
    const correct = idx === q.c;
    if (!correct && btn) btn.classList.add("wrong");
    if (mode === "revive") { res.className = correct ? "good" : "bad"; res.textContent = correct ? "REVIVED! Go!" : "Wrong - game over."; }
    else { res.className = correct ? "good" : "bad"; res.textContent = correct ? "Correct - power-up granted!" : "Wrong - no power-up."; }
    setTimeout(() => { $("quiz").classList.remove("show"); done(correct); }, correct ? 900 : 1100);
  }

  q.a.forEach((t, idx) => {
    const b = document.createElement("button"); b.className = "answer"; b.textContent = t;
    b.onclick = () => answer(idx, b); box.appendChild(b);
  });
  const wrap = $("timerWrap"), bar = $("timerBar");
  clearInterval(timer);
  if (SETTINGS.answerTime > 0) {
    const limit = SETTINGS.answerTime * 1000;
    wrap.style.display = "block"; bar.style.width = "100%";
    timer = setInterval(() => {
      const left = limit - (performance.now() - start);
      bar.style.width = Math.max(0, left / limit * 100) + "%";
      if (left <= 0) { clearInterval(timer); answer(-1, null); }
    }, 60);
  } else wrap.style.display = "none";
  $("quiz").classList.add("show");
}

// Number keys 1-4 answer when the quiz is open (desktop convenience).
document.addEventListener("keydown", e => {
  if (!$("quiz").classList.contains("show")) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 4) { const b = $("answers").querySelectorAll(".answer")[n - 1]; if (b && !b.disabled) b.click(); }
});
