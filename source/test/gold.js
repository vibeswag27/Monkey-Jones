// The rules of the Golden Banana: the stock and its upgrade, setting one off, what gold does, how it ends, and crates.
// Like test/overhaul.js, the real game is stepped headless on a stretch emptied of everything a test does not put there.
//   node test/gold.js [part of a test's name]
const { open } = require('./lib2');
const rig = require('./rig');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760, dpr: 1 });
  let fails = 0, ran = 0; const only = process.argv[2];
  const say = (name, r) => { ran++; if (!r || !r.ok) fails++; console.log((r && r.ok ? 'ok   ' : 'FAIL ') + name + (r && r.ok ? '' : '  ' + JSON.stringify(r))); };
  const test = async (name, fn, arg) => {            // a test that runs wholly inside the page
    if (only && !name.includes(only)) return;
    let r; try { r = await page.evaluate(fn, arg); } catch (e) { r = { ok: false, err: String(e).split('\n')[0] }; }
    say(name, r);
  };
  const scene = async (name, fn) => {                // a test that also acts from outside: real taps, keys, reloads
    if (only && !name.includes(only)) return;
    let r; try { r = await fn(); } catch (e) { r = { ok: false, err: String(e).split('\n')[0] }; }
    say(name, r);
  };
  const KEY = 'monkeyjones.v1';
  const reloadWith = async (save) => {               // start the page again as a player whose saved game is `save`
    await page.evaluate(({ KEY, save }) => { if (save === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(save)); }, { KEY, save });
    await page.reload();
    await page.waitForFunction(() => window.__mj, null, { timeout: 30000 });
    await rig(page);
  };
  const stored = () => page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY) || '{}'), KEY);
  await rig(page);

  // ── the stock, and its row in Upgrades ──
  await scene('save: a new player, and a save from before golden bananas, both start with 5 at level 1; a bad count is put right', async () => {
    const got = [];
    for (const [save, want] of [[null, 5], [{ wallet: 40, up: { magnet: 3 } }, 5], [{ gold: 2 }, 2], [{ gold: 0 }, 0], [{ gold: -3 }, 0], [{ gold: 2.7 }, 2], [{ gold: 1e9 }, 99], [{ gold: 'x' }, 5], [{ gold: null }, 5]]) {
      await reloadWith(save);
      const d = await page.evaluate(() => ({ gold: __mj.Save.data.gold, up: __mj.Save.data.up, used: __mj.Save.data.goldUsed }));
      got.push({ save: JSON.stringify(save), gold: d.gold, lv: d.up.gold, magnet: d.up.magnet, used: d.used, ok: d.gold === want && d.up.gold === 1 && d.used === false });
    }
    return { ok: got.every((g) => g.ok) && got[1].magnet === 3, got: got.filter((g) => !g.ok) };
  });
  await scene('upgrades: a sixth row for the Golden banana, on the same ladder: 5 s, and 6 s once 100 bananas are paid', async () => {
    await reloadWith({ wallet: 100 });
    const before = await page.evaluate(() => { __mj.UI.openShop(); const li = [...document.querySelectorAll('#shopList li.up')]; const g = li[li.length - 1];
      return { rows: li.length, name: g.querySelector('.up-name').textContent, note: g.querySelector('.up-note').textContent, cost: g.querySelector('button.buy') && g.querySelector('button.buy').dataset.kind }; });
    await page.tap('#shopList button.buy[data-kind="gold"]');
    const after = await page.evaluate(() => { const li = [...document.querySelectorAll('#shopList li.up')]; return { lv: __mj.Save.data.up.gold, wallet: __mj.Save.data.wallet, note: li[li.length - 1].querySelector('.up-note').textContent }; });
    const run = await page.evaluate(() => { T.start(); __mj.Game.useGold(); return { t: __mj.Game.run.gold, max: __mj.Game.run.max.gold }; });
    const s = await stored();
    return { ok: before.rows === 6 && before.name === 'Golden banana' && before.note === 'Lasts 5 s, next level 6 s' && before.cost === 'gold' && after.lv === 2 && after.wallet === 0 && after.note === 'Lasts 6 s, next level 7 s' && run.max === 6 && run.t > 5.9 && s.up.gold === 2, before, after, run };
  });

  // ── setting one off ──
  await scene('use: in a run it spends one, saves at once, and gold is on for 5 s; a second cannot be set off while it lasts', async () => {
    await reloadWith(null);
    const r = await page.evaluate(() => { const G = __mj.Game; T.start(); const a = G.useGold(), left = __mj.Save.data.gold, t = G.run.gold, b = G.useGold(); return { a, b, left, t, max: G.run.max.gold, after: __mj.Save.data.gold, used: __mj.Save.data.goldUsed, saves: G.goldSaves }; });
    const s = await stored();
    return { ok: r.a === true && r.b === false && r.left === 4 && r.after === 4 && r.t === 5 && r.max === 5 && r.used === true && s.gold === 4 && s.goldUsed === true && r.saves === 0, r, stored: s.gold };
  });
  await test('use: refused with none left, during the intro, and while the rocket is carrying him (nothing is spent)', () => {
    const G = __mj.Game, P = __mj.Player, d = __mj.Save.data, got = {};
    T.start(); d.gold = 0; got.none = G.useGold(); d.gold = 3;
    G.restart(); got.introState = G.state; got.intro = G.useGold();
    T.start(); P.startFlight(); G.run.rocket = 5; got.rocket = G.useGold();
    got.left = d.gold; got.gold = G.run.gold;
    return { ok: got.none === false && got.introState === 'intro' && got.intro === false && got.rocket === false && got.left === 3 && !(got.gold > 0), got };
  });
  await test('use: setting one off clears a stumble: no danger, no slow-down', () => {
    const G = __mj.Game; T.start(); __mj.Save.data.gold = 3; G.run.danger = 4; G.run.slow = 0.4; __mj.Player.stumbleT = 0.2;
    const a = G.useGold();
    return { ok: a && G.run.danger <= 0 && G.run.slow <= 0 && __mj.Player.stumbleT < 0, danger: G.run.danger, slow: G.run.slow };
  });
  const fresh = (gold) => page.evaluate((gold) => { T.start(); __mj.Save.data.gold = gold; __mj.UI.gold(); }, gold);
  const state = () => page.evaluate(() => ({ on: __mj.Game.run.gold > 0, left: __mj.Save.data.gold, shown: !!document.getElementById('btnGold').offsetParent, count: document.getElementById('goldCount').textContent }));
  await scene('double tap: two quick taps on the play area set one off', async () => {
    await fresh(5); const a = await state();
    await page.touchscreen.tap(195, 430); await page.waitForTimeout(110); await page.touchscreen.tap(200, 436);
    const b = await state();
    return { ok: !a.on && a.shown && a.count === '5' && b.on && b.left === 4 && b.count === '4', a, b };
  });
  await scene('double tap: one tap does nothing, nor two taps more than 0.35 s apart, nor a swipe followed by a tap', async () => {
    const got = {};
    await fresh(5); await page.touchscreen.tap(195, 430); await page.waitForTimeout(500); got.one = await state();
    await fresh(5); await page.touchscreen.tap(195, 430); await page.waitForTimeout(600); await page.touchscreen.tap(195, 430); await page.waitForTimeout(450); got.slow = await state();
    await fresh(5); await page.mouse.move(150, 430); await page.mouse.down(); await page.mouse.move(230, 432, { steps: 4 }); await page.mouse.up(); await page.touchscreen.tap(195, 430); await page.waitForTimeout(450); got.swipe = await state();
    return { ok: !got.one.on && got.one.left === 5 && !got.slow.on && got.slow.left === 5 && !got.swipe.on && got.swipe.left === 5, got };
  });
  await scene('button and key: a tap on the golden button sets one off, and so does the G key; the button hides when none are left', async () => {
    const got = {};
    await fresh(2); await page.tap('#btnGold'); got.button = await state();
    await fresh(1); await page.keyboard.press('g'); got.key = await state();
    return { ok: got.button.on && got.button.left === 1 && got.button.count === '1' && got.key.on && got.key.left === 0 && !got.key.shown, got };
  });
  await scene('home screen: the stock is shown there too', async () => {
    await reloadWith({ gold: 7 });
    const r = await page.evaluate(() => { const e = document.getElementById('goldHome'); return { shown: !!(e && e.offsetParent), text: e ? e.textContent.trim() : null, w: document.documentElement.scrollWidth, vw: innerWidth }; });
    return { ok: r.shown && r.text === '7' && r.w <= r.vw, r };
  });

  const bad = errors.filter((e) => !/ReadPixels/.test(e));
  console.log(bad.join('\n') || 'no errors');
  console.log(fails || bad.length ? `FAIL: ${fails} of ${ran}` : `PASS: all ${ran} golden banana rules hold`);
  await browser.close();
  process.exit(fails || bad.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
