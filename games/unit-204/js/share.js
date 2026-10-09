'use strict';
/* ============================== SHARING ==============================
   Same set-up as the other games: every button opens the platform's compose box with the post already
   written. Facebook ignores pre-written text, so its button copies the post first. Instagram has no web
   posting link: on phones its button hands the score card and text to the share menu; elsewhere it saves the
   card, copies the text and opens Instagram. Save Image downloads a 1080x1080 score card. Nothing is sent
   unless the player picks one. */
const copyrightYears = (now = new Date()) => now.getFullYear() > 2026 ? '2026–' + now.getFullYear() : '2026';
document.querySelectorAll('.jv-years').forEach(el => { el.textContent = copyrightYears(); });
function shareLink() {
  if (SHARE_LINK) return SHARE_LINK;
  return /^https?:$/.test(location.protocol) ? location.origin + location.pathname : PORTFOLIO_URL;
}
function shareText(r) {
  return `I inspected ${GAME_NAME} and got a ${r.grade} (${r.score.toLocaleString()} pts): ${r.correct}/${r.total} calls right and ${r.hazards}/${r.hazTotal} hazards caught. Can you spot the difference between wear and damage?`;
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
    { label: 'LinkedIn', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(url), copy: true },
    { label: 'Reddit', href: 'https://www.reddit.com/submit?url=' + enc(url) + '&title=' + enc(text) },
    { label: 'WhatsApp', href: 'https://wa.me/?text=' + enc(full) },
    { label: 'Email', href: 'mailto:?subject=' + enc('My ' + GAME_NAME + ' inspection report') + '&body=' + enc(text + '\n\n' + url) },
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
  const insta = document.createElement('button');   // Instagram: share the score card image itself
  insta.type = 'button'; insta.textContent = 'Instagram';
  insta.addEventListener('click', () => {
    let files = null;
    try { const f = new File([''], 'x.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) files = true; } catch (e) { /* no file sharing */ }
    copyText(full);
    if (files) {
      scoreCardBlob(r).then(blob => navigator.share({ files: [new File([blob], 'unit-204-report.png', { type: 'image/png' })], text: full }))
        .catch(() => { saveScoreImage(r); flash(insta, 'IMAGE SAVED + TEXT COPIED'); });
    } else {
      window.open('https://www.instagram.com/', '_blank', 'noopener');
      saveScoreImage(r); flash(insta, 'IMAGE SAVED + TEXT COPIED');
    }
  });
  row.insertBefore(insta, row.children[5] || null);
  const copy = document.createElement('button');
  copy.type = 'button'; copy.textContent = 'COPY TEXT';
  copy.addEventListener('click', async () => flash(copy, (await copyText(full)) ? 'COPIED!' : "COULDN'T COPY"));
  row.append(copy);
  if (phone) {
    const more = document.createElement('button');
    more.type = 'button'; more.textContent = 'MORE...';
    more.addEventListener('click', () => navigator.share({ title: GAME_NAME, text, url: shareLink() }).catch(() => {}));
    row.append(more);
  }
  $('saveImgBtn').onclick = () => saveScoreImage(r);
}

/* SAVE IMAGE: a 1080x1080 report card, clipboard style, with your photos pinned on. */
function drawScoreCard(r) {
  const W = 1080, H = 1080, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sk = s => s + "px 'Silkscreen', 'Courier New', monospace", px = s => s + "px 'Pixelify Sans', 'Trebuchet MS', sans-serif";
  // desk + clipboard
  g.fillStyle = '#2b2440'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#332a4c'; for (let y = 0; y < H; y += 24) g.fillRect(0, y, W, 12);
  g.fillStyle = '#0d0b13'; g.fillRect(90, 70, 900, 960);
  const wood = g.createLinearGradient(100, 80, 980, 1020); wood.addColorStop(0, '#b07a42'); wood.addColorStop(1, '#8a5a2c');
  g.fillStyle = wood; g.fillRect(100, 80, 880, 940);
  g.fillStyle = '#fffdf4'; g.fillRect(140, 150, 800, 840);
  g.fillStyle = '#0d0b13'; g.fillRect(400, 52, 280, 92); g.fillStyle = '#c9ccd4'; g.fillRect(408, 60, 264, 76); g.fillStyle = '#eef0f4'; g.fillRect(408, 60, 264, 10);
  // header
  g.fillStyle = '#8a3d00'; g.font = sk(22); g.textAlign = 'left'; g.fillText('BRICKROAD PROPERTY MGMT.', 180, 210);
  g.fillStyle = '#2a2133'; g.font = sk(64); g.fillText('UNIT 204', 180, 290);
  g.font = px(32); g.fillStyle = '#4a3f5a'; g.fillText('Move-out inspection · ' + GAME_DATE, 180, 336);
  g.fillStyle = '#2a2133'; g.fillRect(180, 356, 720, 5);
  // grade stamp
  g.save(); g.translate(770, 470); g.rotate(-.16);
  g.strokeStyle = '#c0270f'; g.lineWidth = 10; g.strokeRect(-88, -78, 176, 150);
  g.fillStyle = '#c0270f'; g.font = sk(r.grade.length > 1 ? 92 : 112); g.textAlign = 'center'; g.fillText(r.grade, 0, 36);
  g.restore();
  // score + stats
  g.textAlign = 'left'; g.fillStyle = '#6a5a7a'; g.font = sk(24); g.fillText('SCORE', 180, 420);
  g.fillStyle = '#2a2133'; g.font = sk(84); g.fillText(r.score.toLocaleString(), 180, 505);
  g.fillStyle = '#6a5a7a'; g.font = px(32); g.fillText('of ' + r.max.toLocaleString() + ' · ' + r.rank, 180, 550);
  const rows = [['Correct calls', `${r.correct}/${r.total}`], ['Hazards caught', `${r.hazards}/${r.hazTotal}`], ['Deposit charged', `$${r.charged} of $${r.chargeable}`], ['Shift time', r.time]];
  let y = 610;
  for (const [k, v] of rows) {
    g.font = px(36); g.fillStyle = '#2a2133'; g.textAlign = 'left'; g.fillText(k, 180, y);
    g.font = sk(30); g.textAlign = 'right'; g.fillText(String(v), 900, y);
    g.fillStyle = '#c9bd99'; for (let x = 180; x < 900; x += 12) g.fillRect(x, y + 14, 6, 3);
    y += 58;
  }
  // photos as little prints
  const photos = Object.values(Game.photos).slice(0, 3), imgs = [...document.querySelectorAll('#endPhotos img')].slice(0, 3);
  imgs.forEach((img, i) => {
    if (!img.complete) return;
    g.save(); g.translate(250 + i * 290, 900); g.rotate((i - 1) * .06);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-118, -72, 248, 168);
    g.fillStyle = '#ffffff'; g.fillRect(-124, -78, 248, 168);
    g.imageSmoothingEnabled = false; g.drawImage(img, -112, -66, 224, 126);
    g.restore();
  });
  if (!photos.length) { g.fillStyle = '#a89a74'; g.font = sk(22); g.textAlign = 'center'; g.fillText('NO PHOTOS ON FILE', W / 2, 900); }
  // footer
  let link = shareLink().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (link.length > 44) link = link.slice(0, 43) + '…';
  g.textAlign = 'center'; g.fillStyle = '#e9dcff'; g.font = sk(18); g.fillText(link, W / 2, 1052);
  const credit = copyrightYears() + ' Joe VanWagner';
  g.font = sk(16); const cw = g.measureText(credit).width, x0 = W / 2 - (cw + 34) / 2;
  const head = document.querySelector('.jv-credit img');
  if (head && head.complete) { g.imageSmoothingEnabled = false; g.drawImage(head, x0, 12, 26, 26); }
  g.textAlign = 'left'; g.fillStyle = '#c9b8ec'; g.fillText(credit, x0 + 34, 32);
  return c;
}
function scoreCardBlob(r) {
  const ready = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load("40px 'Silkscreen'"), document.fonts.load("40px 'Pixelify Sans'")]).catch(() => {}) : Promise.resolve();
  return ready.then(() => new Promise((ok, fail) => drawScoreCard(r).toBlob(b => b ? ok(b) : fail(new Error('no image')), 'image/png')));
}
function saveScoreImage(r) {
  scoreCardBlob(r).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'unit-204-report.png';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, () => {});
}
