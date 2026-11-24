const path = require('path'), fs = require('fs');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const ROOT = path.join(__dirname, '..');
const FONTCSS = `
@font-face{font-family:'Rammetto One';font-weight:400;src:url(https://fonts.gstatic.com/local/rammetto.woff2) format('woff2')}
@font-face{font-family:'Fredoka';font-weight:500;src:url(https://fonts.gstatic.com/local/fredoka-500.woff2) format('woff2')}
@font-face{font-family:'Fredoka';font-weight:600;src:url(https://fonts.gstatic.com/local/fredoka-600.woff2) format('woff2')}
@font-face{font-family:'Fredoka';font-weight:700;src:url(https://fonts.gstatic.com/local/fredoka-700.woff2) format('woff2')}`;
const FONTS = {
  'rammetto.woff2': 'node_modules/@fontsource/rammetto-one/files/rammetto-one-latin-400-normal.woff2',
  'fredoka-500.woff2': 'node_modules/@fontsource/fredoka/files/fredoka-latin-500-normal.woff2',
  'fredoka-600.woff2': 'node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2',
  'fredoka-700.woff2': 'node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff2',
};
async function open({ w = 390, h = 760, manual = true, dpr = 2, touch = true, reduced = false } = {}) { // reduced: as a player who has asked their device for less motion
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', (m) => {
    if (/GPU stall due to ReadPixels/.test(m.text())) return; // the software renderer grumbling about speed, nothing to do with the game
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type().toUpperCase() + ' ' + m.text());
  });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: path.join(ROOT, 'node_modules/three/build/three.min.js'), contentType: 'application/javascript' }));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: FONTCSS, contentType: 'text/css' }));
  await page.route('https://fonts.gstatic.com/**', (r) => { const f = FONTS[r.request().url().split('/').pop()]; if (f) r.fulfill({ path: path.join(ROOT, f), contentType: 'font/woff2' }); else r.abort(); });
  if (manual) await page.addInitScript(() => { window.__mjManual = true; });
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  await page.waitForFunction(() => window.__mj || document.getElementById('stage').dataset.state === 'fatal', null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  // MJ_MAP=tide (or ruins) runs any test in that level; MJ_CHAR=seal (or orca, pig, …) runs it as that character
  if (process.env.MJ_MAP || process.env.MJ_CHAR) await page.evaluate(({ map, who }) => {
    const m = window.__mj, d = m.Save.data;
    if (map) d.map = map;
    if (who === 'seal' || who === 'orca') d.seaChar = who; else if (who) { d.owned = ['monkey', who]; d.char = who; }
    m.Game.toTitle();
  }, { map: process.env.MJ_MAP, who: process.env.MJ_CHAR });
  return { browser, page, errors };
}
// advance the game by `secs` in fixed steps, optionally with the autopilot, then draw one frame
async function step(page, secs, bot = false, dt = 1 / 60) {
  return page.evaluate(({ secs, bot, dt }) => {
    const m = window.__mj, n = Math.round(secs / dt);
    for (let i = 0; i < n; i++) { if (bot) m.Bot.think(); m.Game.update(dt); }
    m.render();
    return { state: m.Game.state, s: m.Player.s, dist: m.Game.run.dist, lane: m.Player.lane };
  }, { secs, bot, dt });
}
module.exports = { open, step, ROOT };
