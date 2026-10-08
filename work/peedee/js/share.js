'use strict';
/* ============================== SHARING ==============================
   Every button opens the platform's compose box with the post already written (like Bluesky's intent
   link). Facebook ignores pre-written text, so its button copies the post first for the player to
   paste. Save Image downloads a score card. Nothing is sent unless the player picks one. */
const copyrightYears = (now = new Date()) => now.getFullYear() > 2026 ? '2026–' + now.getFullYear() : '2026';
document.querySelectorAll('.jv-years').forEach(el => { el.textContent = copyrightYears(); });
function shareLink() {
  if (SHARE_LINK) return SHARE_LINK;
  return /^https?:$/.test(location.protocol) ? location.origin + location.pathname : PORTFOLIO_URL;
}
function shareText(r) {
  if (r.won) return 'I beat Hal-9001 and saved the smile in ' + GAME_NAME + ' with ' + r.score.toLocaleString() + ' points!';
  return 'I scored ' + r.score.toLocaleString() + ' in ' + GAME_NAME + '! I cleaned ' + r.cleaned + ' ' + (r.cleaned === 1 ? 'spot' : 'spots') + ' and made it to ' + r.area + '.';
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {                      // blocked (e.g. an iframe without clipboard-write): the old way still works
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(area); area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { /* unsupported */ }
    area.remove();
    return ok;
  }
}
function shareTargets(r, phone) {
  const text = shareText(r), url = shareLink(), full = text + ' ' + url, enc = encodeURIComponent;
  const tag = enc('#' + GAME_NAME.replace(/\W/g, ''));
  return [
    { label: 'Bluesky', href: 'https://bsky.app/intent/compose?text=' + enc(full) },
    { label: 'X', href: 'https://x.com/intent/post?text=' + enc(text) + '&url=' + enc(url) },
    { label: 'Threads', href: 'https://www.threads.net/intent/post?text=' + enc(full) },
    { label: 'Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url) + '&hashtag=' + tag, copy: true },
    { label: 'Reddit', href: 'https://www.reddit.com/submit?url=' + enc(url) + '&title=' + enc(text) },
    { label: 'WhatsApp', href: 'https://wa.me/?text=' + enc(full) },
    { label: 'Email', href: 'mailto:?subject=' + enc('My ' + GAME_NAME + ' score') + '&body=' + enc(text + '\n\n' + url) },
    ...(phone ? [{ label: 'Text', href: 'sms:?&body=' + enc(full) }] : [])
  ];
}
function setupShare(r) {
  const phone = document.body.classList.contains('touch') && !!navigator.share;
  const text = shareText(r), full = text + ' ' + shareLink();
  $('shareText').textContent = full;
  const flash = (el, msg) => {
    const label = el.dataset.label || (el.dataset.label = el.textContent);
    el.textContent = msg; clearTimeout(el.flashTimer);
    el.flashTimer = setTimeout(() => { el.textContent = label; }, 2400);
  };
  const row = $('shareLinks'); row.replaceChildren();
  for (const t of shareTargets(r, phone)) {
    const a = document.createElement('a');
    a.href = t.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t.label;
    if (t.copy) a.addEventListener('click', () => { copyText(full); flash(a, 'TEXT COPIED - PASTE IT IN'); });
    row.append(a);
  }
  const copy = document.createElement('button');
  copy.type = 'button'; copy.textContent = 'COPY TEXT';
  copy.addEventListener('click', async () => flash(copy, (await copyText(full)) ? 'COPIED!' : "COULDN'T COPY"));
  row.append(copy);
  if (phone) {                     // the phone's own share menu (text + link)
    const more = document.createElement('button');
    more.type = 'button'; more.textContent = 'MORE...';
    more.addEventListener('click', () => navigator.share({ title: GAME_NAME, text, url: shareLink() }).catch(() => {}));
    row.append(more);
  }
  $('saveImgBtn').onclick = () => saveScoreImage(r);
}

/* SAVE IMAGE: a 1080x1080 score card in the game's colors (downloaded, not shared). */
function drawScoreCard(r) {
  const W = 1080, H = 1080, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const px = s => s + "px 'Press Start 2P', 'Courier New', monospace", vt = s => s + "px 'VT323', 'Courier New', monospace";
  const center = (text, y, font, color, shadow, off) => {
    g.font = font; g.textAlign = 'center';
    if (shadow) { g.fillStyle = shadow; g.fillText(text, W / 2 + (off || 6), y + (off || 6)); }
    g.fillStyle = color; g.fillText(text, W / 2, y);
  };
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#4a1470'); bg.addColorStop(0.55, '#2a0a45'); bg.addColorStop(1, '#12061f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(hash(i) * W, hash(i + 50) * H, 8 + hash(i + 99) * 30, 0, 7); g.fill(); }
  g.strokeStyle = '#ff2e63'; g.lineWidth = 18; g.strokeRect(26, 26, W - 52, H - 52);
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(52, 52, W - 104, H - 104);
  g.textBaseline = 'alphabetic';
  center("PeeDee's", 200, px(70), '#2ce8f5', '#0050b0', 7);
  center('DENTAL DEFENSE', 280, px(42), '#ffffff', '#a3123f', 5);
  center(r.won ? 'MOUTH SAVED!' : 'GAME OVER', 380, px(36), r.won ? '#3dff6a' : '#ff2e63', '#000', 4);
  // PeeDee, big and crunchy
  g.imageSmoothingEnabled = false;
  g.save(); g.translate(60, 420); drawEndSprite(r.won, 0, g, 11); g.restore();
  // score + stats
  g.textAlign = 'left';
  g.fillStyle = '#cdb8ff'; g.font = px(22); g.fillText('FINAL SCORE', 520, 480);
  let size = 64; g.font = px(size);
  while (g.measureText(r.score.toLocaleString()).width > 470 && size > 30) { size -= 4; g.font = px(size); }
  g.fillStyle = '#7a3b00'; g.fillText(r.score.toLocaleString(), 526, 576);
  g.fillStyle = '#ffcc00'; g.fillText(r.score.toLocaleString(), 520, 570);
  const rows = [['Reached', r.area], ['Spots cleaned', r.cleaned], ['Germs zapped', r.germs], ['Time', r.time]];
  let y = 640;
  for (const [k, v] of rows) {
    g.font = vt(44); g.fillStyle = '#e9dcff'; g.textAlign = 'left'; g.fillText(k, 520, y);
    const room = W - 110 - 520 - g.measureText(k).width - 24;
    let vs = 44; g.font = vt(vs);
    while (g.measureText(String(v)).width > room && vs > 24) { vs -= 2; g.font = vt(vs); }
    g.fillStyle = '#ffffff'; g.textAlign = 'right'; g.fillText(String(v), W - 110, y);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(520, y + 14, W - 630, 3);
    y += 58;
  }
  g.textAlign = 'center';
  center(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase(), 936, px(18), '#a08cc8');
  let link = shareLink().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (link.length > 44) link = link.slice(0, 43) + '…';
  center(link, 892, px(16), '#a08cc8');
  const credit = copyrightYears() + ' Joe VanWagner';
  g.font = px(18);
  const cw = g.measureText(credit).width, x0 = W / 2 - (cw + 52) / 2;
  const head = document.querySelector('.jv-credit img');
  if (head && head.complete) { g.imageSmoothingEnabled = false; g.drawImage(head, x0, 966, 40, 40); }
  g.textAlign = 'left'; g.fillStyle = '#c9b8ec'; g.fillText(credit, x0 + 52, 996);
  return c;
}
function saveScoreImage(r) {
  const go = () => drawScoreCard(r).toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'peedees-dental-defense-score.png';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
  // make sure both fonts are ready at card sizes before drawing
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("40px 'Press Start 2P'"), document.fonts.load("44px 'VT323'")]).then(go, go);
  else go();
}
