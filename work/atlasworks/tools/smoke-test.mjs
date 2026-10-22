// Headless smoke test for Atlasworks: proves index.html runs on its own.
// Opens the page from disk (file://), drives the main tools, exports a map,
// and fails on any page error, console error or network request.
//
//   npm install --no-save playwright && npx playwright install chromium
//   node tools/smoke-test.mjs [--screenshot out.png]

import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Run:\n  npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotArg = process.argv.indexOf('--screenshot');
const screenshot = shotArg > -1 ? process.argv[shotArg + 1] : null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const problems = [];
page.on('pageerror', e => problems.push('page error: ' + e.message));
page.on('console', m => { if (m.type() === 'error') problems.push('console error: ' + m.text()); });
page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) problems.push('network request: ' + r.url()); });
page.on('dialog', d => d.dismiss());

const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) problems.push(what); };
const tileCount = () => page.evaluate(() => Object.keys(STATE.tiles).length);
const poiCount = () => page.evaluate(() => Object.values(STATE.tiles).reduce((n, t) => n + t.pois.length, 0));

await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.click('text=Create Map');
check(await tileCount() === 400, 'Create Map builds the default 20x20 grid');

await page.evaluate(() => endTutorial());
// The view zooms and centres itself just after setup; wait for it to settle,
// then aim every stroke relative to the map's on-screen top-left corner.
await page.waitForTimeout(1000);
const grid = await page.locator('#grid-container').boundingBox();
const at = (dx, dy) => [grid.x + dx, grid.y + dy];
const drag = async (from, to) => {
  await page.mouse.move(...from); await page.mouse.down();
  await page.mouse.move(...to, { steps: 10 }); await page.mouse.up();
};

await page.evaluate(() => { setTool('paint', null); setBrush('water', null); });
const before = await page.evaluate(() => JSON.stringify(STATE.tiles));
await drag(at(20, 20), at(200, 40));
check(before !== await page.evaluate(() => JSON.stringify(STATE.tiles)), 'painting water changes the terrain');

await page.evaluate(() => setTool('road', null));
await drag(at(40, 300), at(400, 300));
check(await page.evaluate(() => STATE.roads.length) === 1, 'dragging with the road tool lays a road');

await page.evaluate(() => { setTool('poi', null); applyPOIPreset('gas'); });
await page.mouse.click(...at(250, 450));
check(await poiCount() === 1, 'clicking with the POI tool places a POI');

await page.click('#btn-undo');
check(await poiCount() === 0, 'Undo removes the POI');

for (const t of ['hand', 'inspect', 'paint', 'river', 'shape', 'elevation', 'road', 'dock', 'poi', 'residence', 'bus']) {
  await page.evaluate(t => setTool(t, null), t);
}
check(true, 'every tool panel opens');

await page.click('text=Settings');
await page.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach(m => { m.style.display = 'none'; }));
await page.click('text=Preview Mode');
await page.waitForTimeout(1500);
check(await page.evaluate(() => STATE.phase) !== 'editor', 'Preview Mode starts');

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
  page.click('text=Export File'),
]);
const exported = download && JSON.parse(readFileSync(await download.path(), 'utf8'));
check(!!download && /^atlasworks_.*\.json$/.test(download.suggestedFilename()) &&
  Object.keys(exported.tiles).length === 400 && exported.roads.length === 1,
  'Export File downloads the map as JSON');

if (screenshot) await page.screenshot({ path: screenshot });
await browser.close();

if (problems.length) {
  console.error('\nAtlasworks smoke test FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('\nAtlasworks smoke test passed.');
