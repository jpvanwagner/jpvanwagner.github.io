/* End-of-run sharing. Every button opens the platform's compose box with the post already
   written, like Bluesky's intent link does. Facebook is the exception: it ignores any text a site
   passes in, so its button copies the text first for the player to paste. Separately, Save image
   downloads a score card PNG. Nothing leaves the page unless the player picks one of these. */
import { GAME_NAME, SHARE_URL, F_HEAD } from "../config.js";

export const copyrightYears = (now = new Date()) => now.getFullYear() > 2026 ? "2026–" + now.getFullYear() : "2026";

/** The line people share. */
export function shareText(s) {
  return "I scored " + s.score.toLocaleString() + " in " + GAME_NAME + "! I ran " + s.distance.toLocaleString() +
    " m and made it to the " + s.area + ".";
}

function loadImg(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src;
  });
}

/** Draws the score card; resolves to a <canvas> (1080 x 1350, a good size for social posts). */
export async function scoreCard(s, portraitUrl, iconUrl) {
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const font = (size, weight) => (weight || 700) + " " + size + "px " + F_HEAD;
  const right = (t, x, y) => g.fillText(t, x - g.measureText(t).width, y);

  // paper + header band
  g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#3fa89b"; g.fillRect(0, 0, W, 170);
  g.fillStyle = "#e39ab4"; g.fillRect(0, 170, W, 12);
  g.fillStyle = "#fff"; g.font = font(72); g.fillText(GAME_NAME.toUpperCase(), 60, 100);
  g.globalAlpha = 0.85; g.font = font(26); g.fillText("ENDLESS QUIZ RUN", 64, 142); g.globalAlpha = 1;

  // runner portrait
  g.save(); roundRect(g, 60, 230, 380, 540, 28); g.clip();
  g.fillStyle = "#efe9dc"; g.fillRect(60, 230, 380, 540);
  const face = await loadImg(portraitUrl);
  if (face) g.drawImage(face, 60, 230, 380, 540);
  g.restore();

  // name + score
  g.fillStyle = "#8a8072"; g.font = font(26); g.fillText("RUNNER", 490, 280);
  g.fillStyle = "#2b2822"; g.font = font(fitSize(g, s.name, 520, 64)); g.fillText(s.name, 490, 350);
  g.fillStyle = "#8a8072"; g.font = font(26); g.fillText("FINAL SCORE", 490, 450);
  g.fillStyle = "#c2577d"; g.font = font(fitSize(g, s.score.toLocaleString(), 540, 120)); g.fillText(s.score.toLocaleString(), 486, 570);
  g.fillStyle = "#8a8072"; g.font = font(26); g.fillText("REACHED", 490, 660);
  g.fillStyle = "#2b2822"; g.font = font(44); g.fillText(s.area, 490, 715);
  g.fillStyle = "#5a5142"; g.font = font(28, 600); g.fillText("Level " + s.level, 490, 760);

  // stats
  let y = 850;
  for (const [label, value] of s.rows) {
    g.fillStyle = "#5a5142"; g.font = font(30, 600); g.fillText(label, 60, y);
    g.fillStyle = "#2b2822"; g.font = font(30, 800); right(String(value), W - 60, y);
    g.fillStyle = "#ded5c0"; g.fillRect(60, y + 18, W - 120, 3);
    y += 56;
  }

  // footer: link + credit with the pixel head
  g.fillStyle = "#8a8072"; g.font = font(26, 600);
  g.fillText(SHARE_URL.replace(/^https?:\/\//, "").replace(/\/$/, ""), 60, H - 60);
  const credit = copyrightYears() + " Joe VanWagner";
  const cx = W - 60 - g.measureText(credit).width;
  g.fillText(credit, cx, H - 60);
  const icon = await loadImg(iconUrl);
  if (icon) { g.imageSmoothingEnabled = false; g.drawImage(icon, cx - 50, H - 92, 40, 40); }
  return c;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function fitSize(g, text, maxW, size) {
  g.font = "700 " + size + "px " + F_HEAD;
  while (g.measureText(text).width > maxW && size > 24) { size -= 4; g.font = "700 " + size + "px " + F_HEAD; }
  return size;
}

export const pngOf = canvas => new Promise(resolve => canvas.toBlob(resolve, "image/png"));

export async function saveImage(png) {
  const blob = await png;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "mall-run-score.png";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {                     // blocked (e.g. an iframe without clipboard-write): the old way still works
    const area = document.createElement("textarea");
    area.value = text; area.setAttribute("readonly", ""); area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(area); area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { /* unsupported */ }
    area.remove();
    return ok;
  }
}

/**
 * Where the post can go. `copy: true` = the site can't pre-fill text, so copy it first.
 * `instagram: true` = Instagram can't be pre-filled at all and posts are pictures: see setupShare.
 */
export function shareTargets(s, mobile) {
  const text = shareText(s), url = SHARE_URL, full = text + " " + url, enc = encodeURIComponent;
  const tag = enc("#" + GAME_NAME.replace(/\W/g, ""));
  return [
    { label: "Bluesky", href: "https://bsky.app/intent/compose?text=" + enc(full) },
    { label: "X", href: "https://x.com/intent/post?text=" + enc(text) + "&url=" + enc(url) },
    { label: "Threads", href: "https://www.threads.net/intent/post?text=" + enc(full) },
    { label: "Facebook", href: "https://www.facebook.com/sharer/sharer.php?u=" + enc(url) + "&hashtag=" + tag, copy: true },
    { label: "Instagram", href: "https://www.instagram.com/", instagram: true },
    { label: "Reddit", href: "https://www.reddit.com/submit?url=" + enc(url) + "&title=" + enc(text) },
    { label: "WhatsApp", href: "https://wa.me/?text=" + enc(full) },
    { label: "Email", href: "mailto:?subject=" + enc("My " + GAME_NAME + " score") + "&body=" + enc(text + "\n\n" + url) },
    ...(mobile ? [{ label: "Text message", href: "sms:?&body=" + enc(full) }] : [])
  ];
}

/** System share sheet with the score card attached (falls back to text + link). */
export async function shareImage(png, s) {
  try {
    const file = new File([await png], "mall-run-score.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: GAME_NAME, text: shareText(s) + " " + SHARE_URL });
      return true;
    }
  } catch (err) { return !!err && err.name === "AbortError"; }   // the player cancelled: fine
  return shareNative(s);
}

/** System share sheet (phones/tablets), text + link. */
export async function shareNative(s) {
  if (!navigator.share) return false;
  try { await navigator.share({ title: GAME_NAME, text: shareText(s), url: SHARE_URL }); return true; }
  catch (err) { return !!err && err.name === "AbortError"; }      // the player cancelled: fine
}

/**
 * Fills the end screen's "Share your score" section for one finished run and wires Save image.
 * getPortrait() returns a PNG data URL of the runner; iconUrl is the credit icon.
 */
export function setupShare(s, getPortrait, iconUrl) {
  const $ = id => document.getElementById(id);
  const mobile = (("ontouchstart" in window) || navigator.maxTouchPoints > 0) && !!navigator.share;
  const full = shareText(s) + " " + SHARE_URL;
  $("shareText").textContent = full;
  let png = null;
  const getPng = () => (png = png || scoreCard(s, getPortrait(), iconUrl).then(pngOf));
  $("saveImgBtn").onclick = () => saveImage(getPng());

  const flash = (btn, msg) => {
    const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
    btn.textContent = msg;
    clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = label; }, 2600);
  };
  const row = $("shareLinkRow"); row.innerHTML = "";
  for (const t of shareTargets(s, mobile)) {
    const a = document.createElement("a");
    a.className = "btn ghost small"; a.href = t.href; a.target = "_blank"; a.rel = "noopener"; a.textContent = t.label;
    // Facebook won't take pre-written text: put it on the clipboard as the link opens
    if (t.copy) a.onclick = () => { copyText(full); flash(a, "Text copied \u2013 paste it in"); };
    // Instagram: phones get the share sheet with the score card (pick Instagram there); computers get the
    // card saved and the caption copied as instagram.com opens, ready for Create > Post.
    if (t.instagram) a.onclick = e => {
      copyText(full);
      if (mobile) { e.preventDefault(); shareImage(getPng(), s); return; }
      saveImage(getPng());
      flash(a, "Picture saved, caption copied");
    };
    row.append(a);
  }
  const copyBtn = document.createElement("button");
  copyBtn.className = "btn ghost small"; copyBtn.textContent = "Copy text";
  copyBtn.onclick = async () => flash(copyBtn, (await copyText(full)) ? "Copied!" : "Couldn\u2019t copy");
  row.append(copyBtn);
  if (mobile) {                    // the phone's own share menu (text + link)
    const more = document.createElement("button");
    more.className = "btn ghost small"; more.textContent = "More\u2026";
    more.onclick = () => shareNative(s);
    row.append(more);
  }
  setTimeout(getPng, 300);          // draw the card in the background so Save image is instant
}
