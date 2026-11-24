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

  // ── unstoppable ──
  await test('gold: he runs through a totem, a beam, a log, rubble, a sweeper and a bobber; each is knocked away and scores 50', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s = P.s; G.goldSaves = 0;
    const hit = [T.pillar(seg, 1, s + 20), T.beam(seg, s + 32), T.log(seg, s + 44), T.rubble(seg, 1, s + 56), T.mover(seg, 'side', 1, s + 68, 0, 0), T.mover(seg, 'bob', 1, s + 80, 0, 0)];
    T.gold(30); const base = G.run.score - G.run.dist - 10 * G.run.nanas; // (what is left of the score once distance and bananas are taken out is the smashing)
    const alive = T.to(s + 86), bonus = Math.round(G.run.score - G.run.dist - 10 * G.run.nanas - base);
    return { ok: alive && hit.every((o) => o.gone) && bonus === 300 && G.run.danger <= 0 && G.goldSaves === 0 && G.run.gold > 0, alive, gone: hit.map((o) => !!o.gone), bonus, saves: G.goldSaves };
  });
  await test('gold: what he does not touch is left standing (a totem in the next lane, a bobber high overhead, a log he jumps)', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s = P.s;
    const a = T.pillar(seg, 2, s + 20), b = T.mover(seg, 'bob', 1, s + 32, 0, Math.PI), c = T.log(seg, s + 60);
    T.gold(30); T.to(s + 36); T.to(s + 60 - G.run.speed * 0.335); G.input('up'); const alive = T.to(s + 75);
    return { ok: alive && !a.gone && !b.gone && !c.gone, gone: [!!a.gone, !!b.gone, !!c.gone] };
  });
  await test('gold: a wall with no steps lifts him onto its top, and a shield he was carrying is not spent on it', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 40, false); G.goldSaves = 0;
    G.run.shield = true; G.run.shieldT = 20; T.gold(30); const alive = T.to(s0 + 8);
    return { ok: alive && T.near(P.y, 2.2) && P.grounded && G.run.shield === true && G.goldSaves === 0, alive, y: P.y, shield: G.run.shield };
  });
  await test('gold: gaps do not stop him: a gap right across the path, and a bridged gap away from its platform, are both crossed', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s = P.s; G.goldSaves = 0;
    T.hole(seg, s + 20, 13); T.bridge(seg, s + 45, 13, 0, true);
    T.gold(30); let low = 0; const alive = T.to(s + 62, () => { low = Math.min(low, P.y); });
    return { ok: alive && low === 0 && P.y === 0 && G.goldSaves === 0, alive, low };
  });
  await test('gold: a bounce pad does not fire', () => {
    const P = __mj.Player, seg = T.start(), sp = P.s + 20, pad = T.pad(seg, 1, sp);
    T.gold(30); let top = 0; T.to(sp + 6, () => { top = Math.max(top, P.y); });
    return { ok: !pad.used && top === 0 && P.grounded, used: !!pad.used, top };
  });
  await test('gold: corners take themselves: twelve seconds with no hand on the controls, starting at a T, through whatever the track holds', () => {
    const G = __mj.Game, P = __mj.Player, m = __mj;
    let tries = 0; do { m.Save.data.runs = 5; m.Save.data.map = 'ruins'; m.Seg.startDepth = 8; G.restart(); m.Seg.startDepth = 0; let t = 0; while (G.state !== 'run' && t < 5) { G.update(T.dt); t += T.dt; } } while (P.seg.jt !== 'T' && ++tries < 60);
    const jt = P.seg.jt; G.goldSaves = 0; T.gold(60);
    const alive = T.wait(12);
    return { ok: jt === 'T' && alive && G.run.turns >= 3 && G.goldSaves === 0 && G.run.danger <= 0, jt, alive, turns: G.run.turns, saves: G.goldSaves, state: G.state, death: G.death && G.death.type };
  });
  await test('gold: three times the level speed (33 m/s at level 1), never more than 58 (level 12)', () => {
    const G = __mj.Game, got = [];
    for (const level of [1, 12]) {
      T.start('ruins', level); T.gold(60); let top = 0; T.wait(0.45); const early = G.run.speed; T.wait(2, () => { top = Math.max(top, G.run.speed); });
      got.push({ level, early: +early.toFixed(1), speed: +G.run.speed.toFixed(2), top: +top.toFixed(2), alive: G.state === 'run' });
    }
    return { ok: got[0].alive && got[1].alive && got[0].speed > 32.6 && got[0].top <= 33.001 && got[0].early > 29 && got[1].speed > 57.4 && got[1].top <= 58.001, got };
  });
  await test('gold: set off at an awkward moment (in mid-air over a gap, at the brink of a fall, mid-slide, mid-bounce, in danger) he lives', () => {
    const G = __mj.Game, P = __mj.Player, got = {};
    const live = (name) => { const alive = T.wait(4); got[name] = { alive, saves: G.goldSaves, y: +P.y.toFixed(2) }; };
    let seg = T.start(), s = P.s; G.goldSaves = 0; T.hole(seg, s + 20, 14); T.to(s + 17.5); G.input('up'); T.to(s + 23); got.airborne = !P.grounded; T.gold(30); live('midair');
    seg = T.start(); s = P.s; G.goldSaves = 0; T.hole(seg, s + 20, 14); let n = 0; while (G.state === 'run' && !(P.coyote > 0 && !P.grounded) && n++ < 600) G.update(T.dt); got.brinkAt = +(P.s - s).toFixed(1); T.gold(30); live('brink');
    seg = T.start(); s = P.s; G.goldSaves = 0; T.beam(seg, s + 12); G.input('down'); T.wait(0.1); got.sliding = P.slide > 0; T.gold(30); live('slide');
    seg = T.start(); s = P.s; G.goldSaves = 0; T.pad(seg, 1, s + 15); T.pillar(seg, 1, s + 20); T.to(s + 16.5); got.bouncing = P.bouncing; T.gold(30); live('bounce');
    seg = T.start(); s = P.s; G.goldSaves = 0; T.rubble(seg, 1, s + 12); G.run.danger = 5; T.gold(30); live('danger');
    const ok = got.airborne && got.sliding && got.bouncing && got.brinkAt > 19 && ['midair', 'brink', 'slide', 'bounce', 'danger'].every((k) => got[k].alive && got[k].saves === 0);
    return { ok, got };
  });
  await test('gold: a rocket token is left where it is; any other token is still picked up', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s = P.s, r = T.token(seg, 'rocket', 1, s + 20), mg = T.token(seg, 'magnet', 1, s + 40);
    T.gold(30); const alive = T.to(s + 46);
    return { ok: alive && !r.got && !P.flying && mg.got && G.run.magnet > 0, rocket: r.got, flying: P.flying, magnet: mg.got };
  });
  await test('gold: the level is held: set off on the last stretch of level 1, three corners later it is still level 1 and no stretch ahead is any deeper', () => {
    const G = __mj.Game, P = __mj.Player, m = __mj;
    m.Save.data.runs = 5; m.Save.data.map = 'ruins'; m.Seg.startDepth = 3; G.restart(); m.Seg.startDepth = 0; let t = 0; while (G.state !== 'run' && t < 5) { G.update(T.dt); t += T.dt; }
    const d0 = P.seg.depth, before = [P.seg.kids.L, P.seg.kids.R].filter(Boolean).map((k) => k.depth);
    G.goldSaves = 0; T.gold(60); const depths = [], levels = new Set(); let n = 0;
    while (G.state === 'run' && G.run.turns < 3 && n++ < 3000) { G.update(T.dt); levels.add(G.run.level); if (depths[depths.length - 1] !== P.seg.depth || depths.length < G.run.turns + 1) depths[G.run.turns] = P.seg.depth; }
    const ahead = []; const walk = (seg) => { if (!seg || seg.dead) return; ahead.push(seg.depth); walk(seg.kids.L); walk(seg.kids.R); }; walk(P.seg);
    return { ok: d0 === 3 && before.every((d) => d === 4) && G.state === 'run' && G.run.turns === 3 && [...levels].join() === '1' && depths.every((d) => d === 3) && ahead.every((d) => d === 3) && m.world.hold === true && G.goldSaves === 0,
      d0, before, turns: G.run.turns, levels: [...levels], depths, ahead, hold: m.world.hold };
  });

  // ── bananas everywhere ──
  await test('bananas: a moment into gold, every floor row from 4 m ahead to the end of the stretch has one in each lane, at the height of the floor there', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), d = T.deck(seg, 2, P.s + 30, P.s + 55, false);
    T.gold(30); T.wait(0.2);
    let slots = 0, missing = 0, onDeck = 0;
    for (let k = 0; ; k++) {
      const s = seg.floorStart + (k + 0.5) * 2.4; if (s > seg.len - 3.2 - 4) break; if (s < P.s + 4) continue;
      for (const x of [-1.9, 0, 1.9]) {
        const y = seg.floorY(s, x) + 0.62; slots++;
        if (!seg.bananas.some((b) => !b.got && Math.abs(b.s - s) < 1 && Math.abs(b.x - x) < 0.5 && Math.abs(b.y - y) < 0.6)) missing++;
        else if (y > 2.5) onDeck++;
      }
    }
    return { ok: slots > 60 && missing === 0 && onDeck >= 8, slots, missing, onDeck };
  });
  // a gold run at top speed with no hand on the controls: how many of the gold bananas in his own lane did he get, and how full did the world's banana list ever become?
  const sweep = (opts) => page.evaluate((o) => {
    const G = __mj.Game, P = __mj.Player, m = __mj, dt0 = T.dt;
    T.start('ruins', 12); T.dt = o.dt; G.goldSaves = 0;
    if (o.magnet) { G.run.magnet = 60; G.run.max.magnet = 60; }
    const g0 = G.grab; let got = 0; G.grab = function (b) { if (b.gold) got++; return g0.call(this, b); };
    T.gold(60); let passed = 0, most = 0, d0 = G.run.dist;
    const alive = T.wait(o.secs, () => {
      for (const b of P.seg.bananas) if (b.gold && !b.seen && b.s < P.s - 3 && Math.abs(b.x - P.x) < 0.5) { b.seen = true; passed++; }
      most = Math.max(most, m.world.nanas.count);
    });
    G.grab = g0; T.dt = dt0;
    return { alive, got, passed, most, metres: Math.round(G.run.dist - d0), turns: G.run.turns, saves: G.goldSaves };
  }, opts);
  await scene('bananas: at 58 m/s he misses none in his lane, at 60 frames a second and at 20', async () => {
    const a = await sweep({ dt: 1 / 60, secs: 10 }), b = await sweep({ dt: 1 / 20, secs: 10 });
    const fine = (r) => r.alive && r.metres > 520 && r.passed > 150 && r.got >= 0.97 * r.passed && r.saves === 0;
    return { ok: fine(a) && fine(b), at60: a, at20: b };
  });
  await scene('bananas: with the magnet on he takes all three lanes; and the world never has more bananas to draw than it can', async () => {
    const plain = await sweep({ dt: 1 / 60, secs: 8 }), mag = await sweep({ dt: 1 / 60, secs: 8, magnet: true });
    return { ok: mag.alive && mag.got > 2.5 * plain.got * (mag.metres / plain.metres) && plain.most < 640 && mag.most < 640, plain, mag };
  });
  await test('bananas: when gold ends none of its bananas are left, on this stretch or any other', () => {
    const G = __mj.Game, P = __mj.Player, m = __mj; T.start(); T.gold(1.2); T.wait(0.6);
    const during = P.seg.bananas.filter((b) => b.gold && !b.got).length;
    let n = 0; while (G.state === 'run' && G.golden() && n++ < 900) G.update(T.dt);
    let left = 0; const walk = (seg) => { if (!seg || seg.dead) return; left += seg.bananas.filter((b) => b.gold && !b.got).length; walk(seg.kids.L); walk(seg.kids.R); }; walk(m.world.cur); walk(m.world.prev);
    return { ok: during > 30 && !G.golden() && left === 0, during, left, golden: G.golden() };
  });

  const bad = errors.filter((e) => !/ReadPixels/.test(e));
  console.log(bad.join('\n') || 'no errors');
  console.log(fails || bad.length ? `FAIL: ${fails} of ${ran}` : `PASS: all ${ran} golden banana rules hold`);
  await browser.close();
  process.exit(fails || bad.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
