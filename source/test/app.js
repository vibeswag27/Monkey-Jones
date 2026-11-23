// Tests the home-screen build exactly as a web host would serve it: no outside requests allowed.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const ROOT = path.join(__dirname, '..', '..');   // the repo root = the published site
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
let versionOverride = null;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (p === '/game/version.json' && versionOverride) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(versionOverride)); }
  const f = path.join(ROOT, p.replace(/^\/game/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=600' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/game/`;
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const outside = [], errors = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.push(r.url()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('ERR ' + m.text()); });
  await page.goto(base); await page.waitForFunction(() => window.__mj, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  console.log('loaded; outside requests:', outside.length ? outside : 'none');
  console.log('fonts:', await page.evaluate(() => [document.fonts.check('20px "Rammetto One"'), document.fonts.check('600 20px Fredoka')].join(',')), '| standalone tags:', await page.evaluate(() => !!document.querySelector('link[rel=manifest]') && !!document.querySelector('link[rel=apple-touch-icon]') && /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content)));
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1200);
  // play a bit (real time loop, autopilot)
  await page.evaluate(() => { const m = window.__mj; m.Save.data.runs = 5; m.Game.startIntro(false); });
  const played = await page.evaluate(() => { const m = window.__mj; let t = 0; while (m.Game.state !== 'over' && m.Game.run.dist < 700 && t < 120) { m.Bot.think(); m.Game.update(1 / 60); t += 1 / 60; } return { state: m.Game.state, dist: Math.round(m.Game.run.dist) }; });
  console.log('played:', JSON.stringify(played));
  await page.screenshot({ path: 'shots/app.png' });
  // offline: reload with no network at all
  await ctx.setOffline(true); await page.reload(); await page.waitForFunction(() => window.__mj, null, { timeout: 30000 });
  console.log('offline reload: game booted, state', await page.evaluate(() => document.getElementById('stage').dataset.state));
  await ctx.setOffline(false);
  // update: the host now has a newer build → the app should reload itself onto ?v=…
  await page.reload(); await page.waitForFunction(() => window.__mj);
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).build; versionOverride = { build: b + 5 };
  await page.waitForURL(/\?v=\d+/, { timeout: 15000 }); await page.waitForFunction(() => window.__mj);
  console.log('self-update: reloaded to', page.url().replace(base, ''), '| loops?', await (async () => { await page.waitForTimeout(4000); return page.url().replace(base, ''); })());
  console.log(errors.join('\n') || 'no errors');
  await browser.close(); server.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
