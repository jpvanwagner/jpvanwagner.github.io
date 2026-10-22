/*
 * The end-of-shift grade sheet as an image (PNG), for saving or sharing:
 * game name, employer logo, shift, date, grade, score and the stats.
 *
 * Sharing uses the system share sheet where the browser has one (with the
 * image attached when it can), and otherwise offers email / text / social
 * links and "copy". Nothing leaves the page unless the player picks one.
 */
import { companyLogoSvg } from '../data/companies.js';
import { CREDITS, GAME, copyrightYears } from '../config/credits.js';

const W = 1080;
const ROW = 46;
const STATS_TOP = 760;

function loadUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadSvg(svg) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** The line people share. */
export function shareText(summary) {
  const shift = `${summary.level.name}${summary.double ? ' (double)' : ''}`;
  return `I scored ${summary.score} (grade ${summary.grade.letter}) on my ${shift} shift at ${summary.company.name} in ${GAME.name}!`;
}

/** Draw the grade sheet; resolves to a <canvas>. */
export async function gradeSheet(summary, rows) {
  const H = STATS_TOP + rows.length * ROW + 110; // tall enough for every stat row
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const font = (size, weight = 700) => `${weight} ${size}px 'Inter Variable', Inter, system-ui, sans-serif`;
  const company = summary.company;

  // Paper + header band
  g.fillStyle = '#fbfaf7';
  g.fillRect(0, 0, W, H);
  g.fillStyle = company.ink;
  g.fillRect(0, 0, W, 150);
  g.fillStyle = company.accent;
  g.fillRect(0, 150, W, 10);
  g.fillStyle = '#fff';
  g.font = font(54, 900);
  g.fillText(GAME.name.toUpperCase(), 60, 92);
  g.font = font(24, 700);
  g.globalAlpha = 0.75;
  g.fillText(GAME.subtitle, 62, 128);
  g.globalAlpha = 1;

  // Employer
  const logo = await loadSvg(companyLogoSvg(company, { size: 200, title: false }));
  if (logo) g.drawImage(logo, 60, 200, 200, 200);
  g.fillStyle = '#7b8190';
  g.font = font(24, 800);
  g.fillText('PERFORMANCE REVIEW', 300, 240);
  g.fillStyle = '#262a31';
  g.font = font(46, 900);
  g.fillText(company.name, 300, 300);
  g.fillStyle = '#4b5260';
  g.font = font(28, 600);
  g.fillText(`${summary.level.name}${summary.double ? ' · Double shift' : ''}`, 300, 348);
  g.fillText(`Day ${summary.day} · ${summary.date}`, 300, 390);

  // Grade + score
  g.fillStyle = '#262a31';
  g.font = font(220, 900);
  g.fillText(summary.grade.letter, 60, 650);
  g.font = font(36, 800);
  g.fillText(summary.grade.title, 300, 540);
  g.fillStyle = '#7b8190';
  g.font = font(26, 700);
  g.fillText('FINAL SCORE', 300, 600);
  g.fillStyle = '#262a31';
  g.font = font(64, 900);
  g.fillText(String(summary.score), 300, 665);

  // Stats
  let y = STATS_TOP;
  g.font = font(28, 600);
  for (const [label, value] of rows) {
    g.fillStyle = '#4b5260';
    g.fillText(label, 60, y);
    g.fillStyle = '#262a31';
    g.font = font(28, 800);
    const v = String(value);
    g.fillText(v, W - 60 - g.measureText(v).width, y);
    g.font = font(28, 600);
    g.fillStyle = '#e7e3da';
    g.fillRect(60, y + 16, W - 120, 2);
    y += ROW;
  }

  // Footer
  g.fillStyle = '#7b8190';
  g.font = font(24, 600);
  g.fillText(CREDITS.gameUrl, 60, H - 60);
  const credit = `© ${copyrightYears()} ${CREDITS.author}`;
  const creditX = W - 60 - g.measureText(credit).width;
  g.fillText(credit, creditX, H - 60);
  const face = CREDITS.icon ? await loadUrl(CREDITS.icon) : null;
  if (face) {
    g.imageSmoothingEnabled = false; // crisp pixel art
    g.drawImage(face, creditX - 46, H - 88, 36, 36);
  }
  return c;
}

/**
 * The sheet as a PNG blob. Encoding a sheet this size takes a moment, so the
 * end screen starts it early and the buttons below take the promise: the
 * clipboard and downloads then act straight away, inside the click.
 */
export const pngOf = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

export async function saveImage(png, name = 'right-this-way-grade.png') {
  const blob = await png;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Can this browser put an image on the clipboard? */
export const canCopyImage = () => typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

/** Copy the grade sheet image to the clipboard (paste it into a post or chat). */
export async function copyImage(png) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Blocked (e.g. an iframe without clipboard-write): the old way still works.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* not supported */
    }
    area.remove();
    return ok;
  }
}

/**
 * Share via the system share sheet (with the image when supported). Only used
 * on phones / tablets: desktop share sheets (Windows especially) often can't
 * share an image file and just show an error, which looks like a cancel.
 * Returns false when there's no share sheet, so the caller shows fallbacks.
 */
export async function shareNative(png, summary) {
  if (!navigator.share) return false;
  const text = shareText(summary);
  try {
    const file = new File([await png], 'right-this-way-grade.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: GAME.name, text: `${text} ${CREDITS.gameUrl}` });
    } else {
      await navigator.share({ title: GAME.name, text, url: CREDITS.gameUrl });
    }
    return true;
  } catch (err) {
    return err?.name === 'AbortError'; // cancelled by the player: that's fine
  }
}

/**
 * Links for when there's no share sheet (the image can be saved and attached).
 * Instagram can't take a pre-written post at all; the end screen handles its link specially
 * (share sheet with the image on phones, image saved + caption copied on computers).
 */
export function shareLinks(summary, { mobile = false } = {}) {
  const text = shareText(summary);
  const url = CREDITS.gameUrl;
  const enc = encodeURIComponent;
  return [
    ['Email', `mailto:?subject=${enc(`My ${GAME.name} grade`)}&body=${enc(`${text}\n\n${url}`)}`],
    ...(mobile ? [['Text message', `sms:?&body=${enc(`${text} ${url}`)}`]] : []),
    ['X', `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`],
    ['Bluesky', `https://bsky.app/intent/compose?text=${enc(`${text} ${url}`)}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['Instagram', 'https://www.instagram.com/'],
    ['Reddit', `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}`],
  ];
}
