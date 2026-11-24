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
  const fresh = async (gold) => {                                                        // a fresh run on an empty stretch with `gold` in hand, and nothing left on screen from before
    await page.evaluate((gold) => { T.start(); __mj.Save.data.gold = gold; __mj.UI.gold(); }, gold);
    await page.waitForFunction(() => [...document.querySelectorAll('.screen')].every((e) => getComputedStyle(e).visibility === 'hidden'), null, { timeout: 5000 }); // (a screen takes 0.2 s of real time to fade, and can be touched until it has)
  };
  const state = () => page.evaluate(() => ({ on: __mj.Game.run.gold > 0, left: __mj.Save.data.gold, shown: !!document.getElementById('btnGold').offsetParent, count: document.getElementById('goldCount').textContent }));
  await scene('use: refused on the pause screen, during the 3-2-1 after it, and once the run is over, whether by the golden button, a double tap or the G key (nothing is spent)', async () => {
    const tryAll = async () => {
      const at = await page.evaluate(() => {                                         // the button's middle, and a spot on the screen that is no button at all
        const r = document.getElementById('btnGold').getBoundingClientRect(); let free = null;
        for (let y = 700; y > 60 && !free; y -= 40) for (const x of [60, 195, 330]) { const e = document.elementFromPoint(x, y); if (e && !e.closest('button') && !e.closest('#btnGold')) { free = { x, y }; break; } }
        return { bx: r.x + r.width / 2, by: r.y + r.height / 2, seen: r.width > 0 && getComputedStyle(document.getElementById('btnGold')).visibility === 'visible', free };
      });
      if (at.seen) await page.touchscreen.tap(at.bx, at.by);
      await page.touchscreen.tap(at.free.x, at.free.y); await page.waitForTimeout(110); await page.touchscreen.tap(at.free.x, at.free.y);
      await page.keyboard.press('g');
      return page.evaluate((seen) => { const G = __mj.Game; return { state: G.state, seen, direct: G.useGold(), stock: __mj.Save.data.gold, gold: G.run.gold, gilt: __mj.monkey.gilt }; }, at.seen);
    };
    await page.evaluate(() => { const m = __mj; T.start('ruins', 2); m.Save.data.gold = 5; m.UI.gold(); T.wait(0.5); m.Game.pause(); });
    const paused = await tryAll();
    await page.evaluate(() => __mj.Game.resume());
    const counting = await tryAll();
    await page.evaluate(() => { const m = __mj, G = m.Game; T.start('ruins', 2); m.Save.data.gold = 5; m.UI.gold(); T.wait(0.3); m.Player.die('bonk'); let t = 0; while (G.state !== 'over' && t < 8) { G.update(1 / 60); t += 1 / 60; } });
    const over = await tryAll();
    const no = (r, st) => r.state === st && r.direct === false && r.stock === 5 && r.gold === 0 && !r.gilt;
    return { ok: no(paused, 'pause') && paused.seen && no(counting, 'count') && counting.seen && no(over, 'over'), paused, counting, over };
  });
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
  const drag = async (x, y, dx, dy) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up(); };
  const btnAt = async () => {                                                            // the middle of the golden button, once nothing else is in front of it (the home screen takes a moment of real time to fade)
    const mid = () => { const r = document.getElementById('btnGold').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    await page.waitForFunction('(' + mid.toString() + ')().x > 0 && (() => { const m = (' + mid.toString() + ')(), e = document.elementFromPoint(m.x, m.y); return !!(e && e.closest("#btnGold")); })()', null, { timeout: 5000 });
    return page.evaluate(mid);
  };
  await scene('double tap: two quick flicks too short to be swipes are not a double tap (a tap is a touch that stays put: under 12 px)', async () => {
    await fresh(5);
    await drag(195, 430, 0, -16); await page.waitForTimeout(90); await drag(195, 430, 0, -16); await page.waitForTimeout(120);
    const flicks = await state(), air = await page.evaluate(() => { __mj.Game.update(1 / 60); return !__mj.Player.grounded; });
    await fresh(5); await drag(195, 430, 3, -4); await page.waitForTimeout(90); await drag(196, 431, -2, 5); const wobbly = await state();   // a finger never lands quite still
    return { ok: !flicks.on && flicks.left === 5 && !air && wobbly.on && wobbly.left === 4, flicks, air, wobbly };
  });
  await scene('button: a swipe that starts on the golden button is still a swipe (he jumps, he changes lane) and spends nothing, even if it ends on the button', async () => {
    const got = {};
    await fresh(5); let at = await btnAt(); await drag(at.x, at.y, 0, -80);
    const air = () => page.evaluate(() => { __mj.Game.update(1 / 60); return { air: !__mj.Player.grounded }; });              // (a jump is taken on the next frame)
    got.long = Object.assign(await state(), await air());
    await fresh(5); at = await btnAt(); await drag(at.x, at.y + 8, 0, -26);                                                             // up and down inside the button itself
    got.short = Object.assign(await state(), await air());
    await fresh(5); at = await btnAt(); await drag(at.x, at.y, -80, 0);
    got.side = Object.assign(await state(), await page.evaluate(() => ({ lane: __mj.Player.lane })));
    return { ok: got.long.air && !got.long.on && got.long.left === 5 && got.short.air && !got.short.on && got.short.left === 5 && got.side.lane === -1 && !got.side.on && got.side.left === 5, got };
  });
  await scene('button: it answers the keyboard too (Enter or Space with it in focus), once', async () => {
    await fresh(3);
    await page.evaluate(() => document.getElementById('btnGold').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
    const a = await state();
    return { ok: a.on && a.left === 2, a };
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

  // ── how it ends ──
  await test('end: a last burst clears the way: every totem for the next 2.5 s of ordinary running is knocked away, and the next one is left', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s = P.s, pillars = [];
    for (let q = s + 14; q < s + 72; q += 6) pillars.push(T.pillar(seg, 1, q));
    G.goldSaves = 0; T.gold(1); let n = 0; while (G.state === 'run' && G.golden() && n++ < 600) G.update(T.dt);
    const at = P.s, ghost = G.run.ghost, reach = at + 2.5 * 11;
    const wrong = pillars.filter((o) => (o.s1 < reach - 0.1) !== !!o.gone && Math.abs(o.s - reach) > 0.8).length, standing = pillars.filter((o) => !o.gone).length;
    const alive = T.wait(1.4);
    return { ok: alive && wrong === 0 && standing >= 1 && ghost > 1.4 && ghost <= 1.5 && G.goldSaves === 0, at: +(at - s).toFixed(1), wrong, standing, ghost, alive };
  });
  await test('end: a long gap that he is still over when the grace would run out does not swallow him', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s = P.s; T.hole(seg, s + 34, 36);
    G.goldSaves = 0; T.gold(1); let n = 0; while (G.state === 'run' && G.golden() && n++ < 600) G.update(T.dt);
    const at = P.s - s; let t = 0, overAt = -1; const alive = T.to(s + 76, () => { t += T.dt; if (overAt < 0 && G.run.ghost <= 0) overAt = P.s - s; });
    return { ok: alive && at < 34 && t > 2 && overAt >= 69.8 && overAt < 72 && P.y === 0 && G.goldSaves === 0, endedAt: +at.toFixed(1), secs: +t.toFixed(2), graceOverAt: +overAt.toFixed(1), alive };
  });
  await test('end: if time runs out in the run-up to a corner, gold holds through the corner and is off within a second after it', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(); G.goldSaves = 0; T.gold(60);
    T.to(seg.len - 3.2 - 12); G.run.gold = 0.02;
    let held = 0, dropped = false, over = 0, n = 0;
    while (G.state === 'run' && G.run.turns < 1 && n++ < 600) { G.update(T.dt); if (G.run.turns < 1) { if (G.golden()) held++; else dropped = true; } over = Math.max(over, G.run.goldOver); }
    const turned = G.run.turns; let after = 0; n = 0; while (G.state === 'run' && G.golden() && n++ < 600) { G.update(T.dt); after += T.dt; over = Math.max(over, G.run.goldOver); }
    const grace = G.run.ghost, alive = T.wait(1);
    return { ok: alive && turned === 1 && !dropped && held > 5 && after < 1 && !G.golden() && over > 0.1 && over < 3.5 && grace > 1.3 && G.goldSaves === 0, turned, dropped, held, after: +after.toFixed(2), over: +over.toFixed(2), grace: +grace.toFixed(2), state: G.state };
  });
  await test('end: afterwards everything is as it was: no gold, no hold on the level, the level\'s own speed, the chaser at its distance, and another can be set off', () => {
    const G = __mj.Game, P = __mj.Player, m = __mj; T.start(); T.gold(1.5);
    let n = 0; while (G.state === 'run' && G.golden() && n++ < 900) G.update(T.dt);
    const now = { gold: G.run.gold, over: G.run.goldOver, hold: m.world.hold }, play = () => m.Bot.think();
    T.wait(2, play); const speed = G.run.speed; T.wait(2.5, play);
    const again = (m.Save.data.gold = 3, G.useGold());
    return { ok: now.gold === 0 && now.over === 0 && now.hold === false && Math.abs(speed - 11) < 1 && G.bGap >= 15 && G.bGap < 22 && G.run.danger <= 0 && again === true, now, speed: +speed.toFixed(2), gap: +G.bGap.toFixed(1), again };
  });
  await test('end: the run gets deeper again afterwards: set off on the last stretch of level 1, level 2 comes a few corners after gold, never during it', () => {
    const G = __mj.Game, P = __mj.Player, m = __mj;
    m.Save.data.runs = 5; m.Save.data.map = 'ruins'; m.Seg.startDepth = 3; G.restart(); m.Seg.startDepth = 0; let t = 0; while (G.state !== 'run' && t < 5) { G.update(T.dt); t += T.dt; }
    G.run.danger = 0; G.goldSaves = 0; T.gold(4);
    let during = 1, endTurns = -1, n = 0;
    while (G.state === 'run' && G.run.level < 2 && n++ < 60 * 90) { m.Bot.think(); G.update(T.dt); if (G.golden()) during = Math.max(during, G.run.level); else if (endTurns < 0) endTurns = G.run.turns; }
    return { ok: G.state === 'run' && during === 1 && G.run.level === 2 && endTurns >= 1 && G.run.turns - endTurns <= 4 && G.goldSaves === 0, state: G.state, during, level: G.run.level, cornersInGold: endTurns, cornersAfter: G.run.turns - endTurns, death: G.death && G.death.type };
  });

  // ── crates ──
  await scene('crate: running through one adds a golden banana and saves it at once; one in the next lane is left; at 99 the count stays 99', async () => {
    await reloadWith(null);
    const r = await page.evaluate(() => {
      const G = __mj.Game, P = __mj.Player, d = __mj.Save.data, seg = T.start(), s = P.s;
      const a = T.token(seg, 'crate', 1, s + 15), b = T.token(seg, 'crate', 2, s + 30), c = T.token(seg, 'crate', 1, s + 45);
      T.to(s + 20); const one = { gold: d.gold, got: a.got, stored: JSON.parse(localStorage.getItem('monkeyjones.v1')).gold, said: document.getElementById('toast').textContent };
      T.to(s + 35); const two = { gold: d.gold, got: b.got };
      d.gold = 99; const alive = T.to(s + 50);
      return { alive, one, two, three: { gold: d.gold, got: c.got, said: document.getElementById('toast').textContent }, count: document.getElementById('goldCount').textContent };
    });
    return { ok: r.alive && r.one.gold === 6 && r.one.got && r.one.stored === 6 && r.one.said === '+1 Golden Banana' && r.two.gold === 6 && !r.two.got && r.three.gold === 99 && r.three.got && r.count === '99' && !/\+1/.test(r.three.said), r };
  });
  await test('crate: he does not run past one at gold\'s speed on a slow frame (58 m/s, 20 frames a second)', () => {
    const G = __mj.Game, P = __mj.Player, d = __mj.Save.data, seg = T.start('ruins', 12), s = P.s, dt0 = T.dt;
    const a = T.token(seg, 'crate', 1, s + 41.3), b = T.token(seg, 'magnet', 1, s + 62.9);
    T.gold(30); d.gold = 3; T.dt = 1 / 20; const alive = T.to(s + 70); T.dt = dt0;
    return { ok: alive && a.got && d.gold === 4 && b.got, crate: a.got, gold: d.gold, token: b.got };
  });
  await test('crate: none is laid on a stretch made while the level is held (gold cannot be used to hunt them)', () => {
    const m = __mj; let held = 0, free = 0;
    for (let i = 0; i < 1500; i++) {
      held += m.gen(20 + (i % 8), 9000 + i, true).pickups.filter((p) => p.kind === 'crate').length;
      free += m.gen(20 + (i % 8), 9000 + i, false).pickups.filter((p) => p.kind === 'crate').length;
    }
    return { ok: held === 0 && free > 15, held, free };
  });

  // ── look, sound and the first-time hint ──
  await test('look: every character turns gold while it lasts and is himself again when it ends, on a restart, and on going home', () => {
    const G = __mj.Game, m = __mj, d = m.Save.data, got = [];
    const gilt = () => { let n = 0, plain = 0; m.monkey.root.traverse((o) => { if (o.isMesh && o.material === m.MAT.midas) n++; if (o.isMesh && o.material === m.MAT.char) plain++; }); return { n, plain }; };
    for (const who of ['monkey', 'smokey', 'pig', 'elephant', 'dino', 'seal', 'orca']) {
      const sea = who === 'seal' || who === 'orca';
      const begin = () => { T.start(sea ? 'tide' : 'ruins'); d.owned = ['monkey', who]; if (sea) d.seaChar = who; else d.char = who; G.restart(); let t = 0; while (G.state !== 'run' && t < 5) { G.update(T.dt); t += T.dt; } };
      begin(); const before = gilt(); T.gold(1); T.wait(0.3); const on = gilt();
      let n = 0; while (G.state === 'run' && G.golden() && n++ < 900) G.update(T.dt); const ended = gilt();
      T.gold(30); T.wait(0.2); const again = gilt(); G.restart(); const restarted = gilt();
      begin(); T.gold(30); T.wait(0.2); G.toTitle(); const home = gilt();
      got.push({ who, id: m.monkey.id, ok: m.monkey.id === who && before.n === 0 && before.plain > 0 && on.n === before.plain && on.plain === 0 && ended.n === 0 && again.n > 0 && restarted.n === 0 && home.n === 0, before, on, ended, restarted, home });
    }
    d.char = 'monkey'; d.seaChar = null; d.map = 'ruins';
    return { ok: got.every((g) => g.ok), bad: got.filter((g) => !g.ok) };
  });
  await test('look: the HUD shows a timer for gold that runs down, the screen\'s edge glows, and the golden button waits its turn', () => {
    const G = __mj.Game; T.start(); __mj.UI.gold();
    const chip = () => [...document.querySelectorAll('#powers .pw')].find((e) => /Gold/.test(e.textContent)), bar = () => +(/scaleX\(([\d.]+)\)/.exec(chip().querySelector('i').style.transform) || [0, 0])[1];
    const glow = () => document.getElementById('goldGlow').classList.contains('on'), dim = () => document.getElementById('btnGold').classList.contains('on');
    const idle = { shown: chip().style.display !== 'none', glow: glow(), dim: dim() };
    T.gold(4); T.wait(0.5); const early = { shown: chip().style.display !== 'none', bar: bar(), glow: glow(), dim: dim() };
    T.wait(2); const late = { bar: bar() };
    let n = 0; while (G.state === 'run' && G.golden() && n++ < 900) G.update(T.dt); T.wait(0.1);
    const after = { shown: chip().style.display !== 'none', glow: glow(), dim: dim() };
    return { ok: !idle.shown && !idle.glow && !idle.dim && early.shown && early.glow && early.dim && early.bar > 0.8 && late.bar < 0.45 && late.bar > 0.2 && !after.shown && !after.glow && !after.dim, idle, early, late, after };
  });
  await test('look: at gold\'s top speed the camera opens up by no more than 14 degrees', () => {
    const G = __mj.Game, m = __mj; T.start('ruins', 12); T.gold(30); let top = 0; T.wait(3, () => { top = Math.max(top, m.Cam.fovKick); });
    return { ok: G.state === 'run' && top > 9 && top <= 14, top };
  });
  await test('look: he trails gold at the same rate on a slow frame as on a fast one, and the trail keeps behind him, short of the camera', () => {
    const G = __mj.Game, m = __mj, P = m.Player, fx = m.fx, got = {};
    const real = fx.trail; let n = 0, idx = [];
    if (!real) return { ok: false, why: 'no trail' };
    fx.trail = function (...a) { n++; idx.push(fx.next); return real.apply(fx, a); };
    for (const [name, dt] of [['fast', 1 / 60], ['slow', 1 / 20]]) {
      const seg = T.start('ruins', 3); T.gold(30); T.dt = 1 / 60; T.wait(0.7);  // up to speed (and the whole second that follows is on the first stretch, which is never under 99 m)
      n = 0; idx = []; T.dt = dt; T.wait(1); T.dt = 1 / 60;
      const d = P.seg.dir, lag = [];
      for (const i of idx.slice(-12)) if (fx.life[i] > 0) lag.push(-((fx.pos[i * 3] - P.wx) * d.fx + (fx.pos[i * 3 + 2] - P.wz) * d.fz));
      got[name] = { n, most: Math.max(...lag), least: Math.min(...lag), alive: lag.length, straight: P.seg === seg };
    }
    fx.trail = real;
    const fine = (g) => g.straight && g.n >= 25 && g.n <= 50 && g.alive > 0 && g.least > -1.2 && g.most < 4.5;
    return { ok: fine(got.fast) && fine(got.slow) && Math.abs(got.fast.n - got.slow.n) <= 6, got };
  });
  await test('look: on land his trail is stars; under water it is golden bubbles', () => {
    const m = __mj, fx = m.fx, real = fx.spawn, got = {};
    for (const map of ['ruins', 'tide']) {
      T.start(map, 2); T.wait(0.3); fx.clear();
      const kinds = {}; let on = false;
      fx.spawn = function (...a) { if (on) { const k = a[11] || 0; kinds[k] = (kinds[k] || 0) + 1; } return real.apply(fx, a); };
      const t0 = fx.trail; fx.trail = function (...a) { on = true; const r = t0.apply(fx, a); on = false; return r; };   // (only what the trail itself throws off)
      T.gold(5); T.wait(1);
      fx.spawn = real; fx.trail = t0; got[map] = kinds;
    }
    m.Save.data.map = 'ruins';
    return { ok: got.ruins[1] > 20 && !got.ruins[2] && got.tide[2] > 20 && !got.tide[1], got };
  });
  await test('look: nothing he throws off while gold hangs in the air for the camera to run into: smashed pieces, dust, sparkle and his trail all keep ahead of it (60 and 20 frames a second, levels 3 and 12)', () => {
    const G = __mj.Game, m = __mj, P = m.Player, fx = m.fx, got = [];
    const real = fx.spawn; let born = new Set();
    fx.spawn = function (...a) { born.add(fx.next); return real.apply(fx, a); };
    for (const level of [3, 12]) for (const dt of [1 / 60, 1 / 20]) {
      const seg = T.start('ruins', level); fx.clear(); born = new Set();
      for (let s = P.s + 14, i = 0; s < seg.len - 30; s += 11, i++) { if (i % 3 === 0) T.pillar(seg, 1, s); else if (i % 3 === 1) T.rubble(seg, 1, s); else T.log(seg, s); }
      T.lane(0); T.gold(30); T.dt = dt;
      let worst = 0, seen = 0, hops = 0, t = 0;
      while (G.state === 'run' && P.seg === seg && P.s < seg.len - 34 && t < 4) {
        if (P.grounded && t > 0.4 * (hops + 1)) { P.jump(); hops++; }           // a hop now and then, for the dust of landing
        G.update(T.dt); t += T.dt;
        const d = seg.dir;
        for (const i of born) {
          if (!(fx.life[i] > 0)) { born.delete(i); continue; }
          if (fx.alpha[i] <= 0.25 || fx.size[i] <= 0.05) continue;                // (faded out, or shrunk away: nothing to see)
          seen++; worst = Math.max(worst, -((fx.pos[i * 3] - P.wx) * d.fx + (fx.pos[i * 3 + 2] - P.wz) * d.fz));
        }
      }
      T.dt = 1 / 60;
      got.push({ level, fps: Math.round(1 / dt), worst: +worst.toFixed(2), seen, smashed: G.run.smashed || 0, hops, state: G.state });
    }
    fx.spawn = real;
    return { ok: got.every((g) => g.state === 'run' && g.smashed >= 3 && g.hops >= 1 && g.seen > 200 && g.worst < 4.6), got };
  });
  await test('look: a crate\'s splinters fly on with him too, at any speed: none is left hanging for the camera to run into', () => {
    const G = __mj.Game, m = __mj, P = m.Player, fx = m.fx, got = [];
    const real = fx.spawn; let born = new Set();
    fx.spawn = function (...a) { born.add(fx.next); return real.apply(fx, a); };
    for (const level of [2, 12]) {
      const seg = T.start('ruins', level); fx.clear(); T.lane(0); m.addCrate(seg, 1, P.s + 12); T.to(P.s + 6); born = new Set();
      let worst = 0, seen = 0; const had = m.Save.data.gold;
      const crate = seg.pickups[seg.pickups.length - 1];
      T.wait(1.2, () => { if (!crate.got) born.clear(); const d = seg.dir; for (const i of born) { if (!(fx.life[i] > 0)) { born.delete(i); continue; } if (fx.alpha[i] <= 0.25 || fx.size[i] <= 0.05) continue; seen++; worst = Math.max(worst, -((fx.pos[i * 3] - P.wx) * d.fx + (fx.pos[i * 3 + 2] - P.wz) * d.fz)); } });
      got.push({ level, worst: +worst.toFixed(2), seen, took: m.Save.data.gold - had });
    }
    fx.spawn = real;
    return { ok: got.every((g) => g.took === 1 && g.seen > 50 && g.worst < 4.6), got };
  });
  const flicker = () => {                                                                      // a 3-second gold, watched frame by frame
    const G = __mj.Game, m = __mj, S = m.Sound.sfx, n = { on: 0, off: 0, tick: 0 }, real = { on: S.goldOn, off: S.goldOff, tick: S.goldTick };
    S.goldOn = () => { n.on++; }; S.goldOff = () => { n.off++; }; S.goldTick = () => { n.tick++; };
    T.start(); T.gold(3);
    let early = 0, late = 0, was = true, frames = 0, top = 0;
    while (G.state === 'run' && G.run.gold > 0 && frames++ < 400) {
      G.update(T.dt); const g = m.monkey.gilt; top = Math.max(top, m.Cam.fovKick);
      if (was && !g && G.run.gold > 0) { if (G.run.gold > 1.5) early++; else late++; } // (its going out for good at the end is not a flicker)
      was = g;
    }
    let k = 0; while (G.state === 'run' && G.golden() && k++ < 900) G.update(T.dt);
    S.goldOn = real.on; S.goldOff = real.off; S.goldTick = real.tick;
    return { early, late, n, after: m.monkey.gilt, top, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  };
  await test('look: in its last second and a half the gold flickers on him, no more than three times a second, and a tick counts it down; it starts and ends with a sound of its own', (src) => {
    const r = (0, eval)('(' + src + ')')(); // (the watcher above, run in the page)
    return { ok: r.early === 0 && r.late >= 3 && r.late <= 4 && r.n.on === 1 && r.n.off === 1 && r.n.tick >= 4 && r.n.tick <= 7 && r.after === false, r };
  }, flicker.toString());
  await scene('look: for a player who has asked for less motion the gold does not flicker (it holds till it ends) and the camera does not open up', async () => {
    const calm = await open({ w: 390, h: 760, dpr: 1, reduced: true });
    await rig(calm.page);
    const r = await calm.page.evaluate((src) => (0, eval)('(' + src + ')')(), flicker.toString());
    await calm.browser.close();
    return { ok: r.reduced && r.early === 0 && r.late === 0 && r.top === 0 && r.n.on === 1 && r.n.off === 1 && r.after === false, r };
  });
  await scene('sound: with the sound engine running, gold taking hold, its ticks, its end and a crate bursting each make their sound, without error', async () => {
    await reloadWith({ runs: 5, gold: 5 });
    await page.evaluate(() => { window.__osc = 0; const P = OscillatorNode.prototype, o = P.start; P.start = function () { window.__osc++; return o.apply(this, arguments); }; });
    await page.click('#btnRun', { force: true });                                  // a real tap, which is what wakes the sound
    await page.evaluate(() => { const G = __mj.Game; let t = 0; while (G.state !== 'run' && t < 5) { G.update(1 / 60); t += 1 / 60; } });
    const r = await page.evaluate(() => {
      const S = __mj.Sound, got = { state: S.state };
      for (const k of ['goldOn', 'goldTick', 'goldOff', 'crate']) { const n0 = window.__osc; try { S.sfx[k](); got[k] = window.__osc - n0; } catch (e) { got[k] = String(e); } }
      return got;
    });
    return { ok: r.state === 'running' && ['goldOn', 'goldTick', 'goldOff', 'crate'].every((k) => r[k] > 0), r };
  });
  await test('hint: from the third run on, until one has ever been used, a run begins with "Double tap for the Golden Banana"; never otherwise', () => {
    const G = __mj.Game, m = __mj, d = m.Save.data, got = {};
    const begin = (runs, gold, used) => { d.runs = runs; d.gold = gold; d.goldUsed = used; d.map = 'ruins'; G.restart(); let t = 0; while (G.state !== 'run' && t < 5) { G.update(T.dt); t += T.dt; } T.wait(0.4); };
    const hint = () => (document.getElementById('hint').classList.contains('on') ? document.getElementById('hintText').textContent : '');
    begin(2, 5, false); got.shown = hint(); T.wait(6.2, () => m.Bot.think()); got.later = hint();
    begin(2, 5, false); T.wait(0.3); G.useGold(); T.wait(0.2); got.afterUse = hint(); got.usedFlag = d.goldUsed;
    begin(6, 5, true); got.veteran = hint();
    begin(6, 0, false); got.none = hint();
    begin(1, 5, false); got.coaching = hint();
    d.runs = 5; d.goldUsed = false; d.gold = 5;
    return { ok: got.shown === 'Double tap for the Golden Banana' && got.later === '' && got.afterUse === '' && got.usedFlag === true && got.veteran === '' && got.none === '' && !/Golden/.test(got.coaching), got };
  });

  // ── leaving a run in the middle of gold ──
  const golden = () => {                                                                         // everything about a run and its screen that gold touches
    const m = __mj, G = m.Game, P = m.Player, w = m.world, has = (id, c) => document.getElementById(id).classList.contains(c);
    const chip = [...document.querySelectorAll('#powers .pw')].find((e) => /Gold/.test(e.textContent));
    const stretches = [w.cur, w.prev, ...(w.cur ? Object.values(w.cur.kids || {}) : [])].filter(Boolean);
    return { state: G.state, gold: G.run.gold, over: G.run.goldOver, golden: G.golden(), gilt: m.monkey.gilt, hold: !!w.hold, extra: stretches.reduce((n, sg) => n + sg.bananas.filter((b) => b.gold && !b.got).length, 0),
      glow: has('goldGlow', 'on'), dim: has('btnGold', 'on'), chip: !!chip && chip.style.display !== 'none', carry: Math.abs(m.fx.cx) + Math.abs(m.fx.cz), speed: G.run.speed, level: G.run.level, depth: w.cur.depth,
      fov: m.Cam.fovKick, stock: m.Save.data.gold };
  };
  const plain = (g) => g.gold === 0 && g.over === 0 && !g.golden && !g.gilt && !g.hold && g.extra === 0 && !g.glow && !g.dim && !g.chip && g.carry === 0;
  await test('leaving: a restart in the middle of gold begins an ordinary run: himself again, the level free to move on, its own speed, no extra bananas, no glow, no timer; the banana that was used stays used', (src) => {
    const now = (0, eval)('(' + src + ')'), G = __mj.Game, m = __mj;
    T.start('ruins', 3); m.Save.data.gold = 5; T.gold(8); T.wait(1.2, () => m.Bot.think());
    const during = now();
    G.restart(); const at0 = now();
    let t = 0; while (G.state !== 'run' && t < 5) { G.update(T.dt); t += T.dt; } T.wait(1, () => m.Bot.think());
    const after = now();
    return { ok: during.golden && during.gilt && during.hold && during.extra > 20 && during.carry > 0 && during.stock === 4
      && at0.gold === 0 && !at0.gilt && !at0.hold && at0.extra === 0 && at0.carry === 0
      && after.state === 'run' && after.gold === 0 && !after.gilt && !after.hold && after.extra === 0 && !after.glow && !after.dim && !after.chip && after.carry === 0 && after.speed < 12 && after.level === 1 && after.stock === 4, during, at0, after };
  }, golden.toString());
  await test('leaving: going home in the middle of gold leaves nothing golden on the home screen, and the next run is an ordinary one', (src) => {
    const now = (0, eval)('(' + src + ')'), G = __mj.Game, m = __mj;
    T.start('tide', 3); m.Save.data.gold = 5; T.gold(8); T.wait(1.2, () => m.Bot.think());
    const during = now();
    G.toTitle(); for (let i = 0; i < 30; i++) G.update(T.dt);
    const home = now(), homeChip = document.getElementById('goldHome').textContent;
    G.startIntro(); let t = 0; while (G.state !== 'run' && t < 6) { G.update(T.dt); t += T.dt; } T.wait(1, () => m.Bot.think());
    const next = now(); m.Save.data.map = 'ruins';
    return { ok: during.golden && during.glow && during.dim && during.chip
      && home.state === 'title' && home.gold === 0 && !home.gilt && !home.hold && home.extra === 0 && !home.glow && !home.dim && home.carry === 0 && home.fov === 0 && homeChip === '4'
      && next.state === 'run' && next.gold === 0 && !next.gilt && !next.hold && next.extra === 0 && !next.glow && !next.dim && !next.chip && next.carry === 0, during, home, homeChip, next };
  }, golden.toString());
  await scene('leaving: a pause in the middle of gold stops its clock; on resuming he is still gold with the time he had left, and it then runs out as it should', async () => {
    await page.evaluate(() => { const m = __mj; T.start('ruins', 2); m.Save.data.gold = 5; T.gold(6); T.wait(1.5, () => m.Bot.think()); });
    const before = await page.evaluate((src) => (0, eval)('(' + src + ')')(), golden.toString());
    await page.evaluate(() => { const G = __mj.Game; G.pause(); for (let i = 0; i < 120; i++) G.update(1 / 60); });       // two seconds of frames while paused
    const paused = await page.evaluate((src) => (0, eval)('(' + src + ')')(), golden.toString());
    await page.evaluate(() => { const G = __mj.Game; G.resume(); for (let i = 0; i < 60; i++) G.update(1 / 60); });     // the 3-2-1: frames go by, the clock does not
    const counting = await page.evaluate((src) => (0, eval)('(' + src + ')')(), golden.toString());
    await page.waitForFunction(() => __mj.Game.state === 'run', null, { timeout: 8000 });
    const back = await page.evaluate((src) => { const m = __mj; m.Bot.think(); m.Game.update(1 / 60); return (0, eval)('(' + src + ')')(); }, golden.toString());
    const end = await page.evaluate((src) => { const m = __mj, G = m.Game; let n = 0; while (G.state === 'run' && G.golden() && n++ < 1500) { m.Bot.think(); G.update(1 / 60); } T.wait(0.2, () => m.Bot.think()); return Object.assign((0, eval)('(' + src + ')')(), { frames: n }); }, golden.toString());
    const near = (a, b) => Math.abs(a - b) < 0.03;
    return { ok: before.golden && near(before.gold, 4.5) && paused.state === 'pause' && near(paused.gold, before.gold) && paused.gilt && paused.hold && paused.stock === before.stock
      && counting.state === 'count' && near(counting.gold, before.gold) && back.state === 'run' && near(back.gold, before.gold - 1 / 60) && back.gilt && back.hold && back.glow
      && end.state === 'run' && !end.golden && !end.gilt && !end.hold && !end.glow && end.extra === 0 && end.frames > 200 && end.frames < 700,
      before: before.gold, paused: [paused.state, paused.gold], counting: [counting.state, counting.gold], back: [back.state, back.gold, back.gilt, back.glow], end: [end.state, end.golden, end.gilt, end.hold, end.glow, end.extra, end.frames] };
  });

  const bad = errors.filter((e) => !/ReadPixels/.test(e));
  console.log(bad.join('\n') || 'no errors');
  console.log(fails || bad.length ? `FAIL: ${fails} of ${ran}` : `PASS: all ${ran} golden banana rules hold`);
  await browser.close();
  process.exit(fails || bad.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
