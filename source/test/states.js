// The two levels on the home screen. Picking one must change the whole game to it, and nothing of the sea may leak into
// Jungle Ruins (or the other way round): the home screen, a run, pause, the game-over card, "run again" and "home" are all checked,
// on a tall phone, a small phone and a phone on its side. Buttons are pressed for real, not called.
const { open, step, until } = require('./lib2');
const sharp = require('/opt/npm-tools/node_modules/sharp');
(async () => {
  const shots = [];
  let fails = 0;
  const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || !extra ? '' : '  ' + extra)); };
  for (const [w, h] of [[390, 760], [320, 568], [667, 375]]) {
    const { browser, page, errors } = await open({ w, h, dpr: 2 });
    const T = `${w}x${h}`;
    const ev = (src) => page.evaluate((src) => new Function('m', src)(window.__mj), src);
    const state = () => ev(`const q = (id) => document.getElementById(id); return { y: +m.Tide.y.toFixed(2), under: m.Tide.under, wet: m.Tide.wet, seaOn: q("sea").classList.contains("on"), fogFar: Math.round(m.scene.fog.far),
      st: m.Game.state, level: m.Game.run.level, map: m.Save.data.map, seaSegs: [m.world.cur, m.world.cur.kids.L, m.world.cur.kids.R].filter(Boolean).map((s) => !!s.sea).join(","),
      seals: m.world.cur.obstacles.filter((o) => o.skin === "seal").length, ruins: q("mapRuins").getAttribute("aria-checked"), tide: q("mapTide").getAttribute("aria-checked"), stored: (JSON.parse(localStorage.getItem("monkeyjones.v1") || "{}")).map }`);
    const dry = (s) => !s.under && !s.wet && !s.seaOn && s.y === -6.5 && s.fogFar === 168 && !/true/.test(s.seaSegs) && s.seals === 0;
    const wet = (s) => s.under && s.wet && s.seaOn && s.y === 15 && s.fogFar < 100 && !/false/.test(s.seaSegs);
    const snap = async (label) => { await new Promise((r) => setTimeout(r, 350)); await page.evaluate(() => window.__mj.render()); shots.push({ label: `${T} ${label}`, buf: await page.screenshot({ type: 'png' }), w, h }); };
    // a real finger on the middle of the button (whatever is on top there gets the touch), then time for the wipe
    const poke = async (id) => {
      const where = () => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y); return { x, y, top: top ? (top.closest('button') || top).id : null }; }, id);
      let at = await where();
      for (let i = 0; i < 30; i++) { await page.waitForTimeout(100); const b = await where(); const still = Math.abs(b.x - at.x) < 1 && Math.abs(b.y - at.y) < 1 && b.top === id; at = b; if (still) break; } // cards slide in: wait for it to arrive
      if (at.top !== id) { fails++; console.log(`FAIL ${T} #${id} is covered by #${at.top}`); }
      await page.touchscreen.tap(at.x, at.y);
    };
    const tap = async (id) => { await poke(id); await page.waitForTimeout(450); await step(page, 0.3, false); };
    const fits = () => page.evaluate(() => { // everything on the home screen is on the screen, and nothing sits on top of anything else
      const ids = ['mapRuins', 'mapTide', 'btnRun', 'btnChars', 'btnShop', 'btnMusic', 'btnSfx'], box = {};
      for (const id of ids) { const r = document.getElementById(id).getBoundingClientRect(); box[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }
      const out = ids.filter((id) => box[id][0] < 0 || box[id][1] < 0 || box[id][2] > innerWidth || box[id][3] > innerHeight || box[id][2] - box[id][0] < 40 || box[id][3] - box[id][1] < 28);
      const hit = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = box[ids[i]], b = box[ids[j]]; if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1) hit.push(ids[i] + '/' + ids[j]); }
      const logo = document.querySelector('.logo') ? document.querySelector('.logo').getBoundingClientRect() : null;
      return { out, hit, box, small: ids.filter((id) => box[id][3] - box[id][1] < 40) , logo: logo && [Math.round(logo.top), Math.round(logo.bottom)] };
    });

    // 1. a first visit: Jungle Ruins, dry
    await step(page, 0.4, false);
    let s = await state(); check(`${T} first visit is Jungle Ruins, dry`, dry(s) && s.map === 'ruins' && s.ruins === 'true' && s.tide === 'false', JSON.stringify(s));
    let f = await fits(); check(`${T} home screen: both levels, Run and the rest fit and do not overlap`, !f.out.length && !f.hit.length, JSON.stringify(f)); await snap('home: Jungle Ruins');
    // 1b. on a keyboard the arrow keys move between the two levels (and stop at the ends)
    const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(450); await step(page, 0.3, false); return state(); };
    const k1 = await key('ArrowRight'), k2 = await key('ArrowRight'), k3 = await key('ArrowLeft'), k4 = await key('ArrowLeft');
    check(`${T} arrow keys choose the level`, wet(k1) && wet(k2) && k2.map === 'tide' && dry(k3) && dry(k4) && k4.map === 'ruins' && k4.st === 'title', JSON.stringify([k1.map, k2.map, k3.map, k4.map, k4.st]));
    // 2. tap High Tide
    await tap('mapTide'); s = await state();
    check(`${T} tapping High Tide floods the home screen and is remembered`, wet(s) && s.st === 'title' && s.map === 'tide' && s.tide === 'true' && s.ruins === 'false' && s.stored === 'tide', JSON.stringify(s));
    f = await fits(); check(`${T} home screen still fits under water`, !f.out.length && !f.hit.length, JSON.stringify(f)); await snap('home: High Tide');
    // 3. Run: under water from the first step, the orca behind, seals to hop
    await ev('m.Save.data.runs = 5'); await poke('btnRun'); await step(page, 0.5, false); s = await state();
    check(`${T} High Tide: under water as the run begins`, wet(s) && s.st === 'intro', JSON.stringify(s));
    await until(page, 'm.Game.state === "run"', 5, false);
    const chase = await ev('return { orca: m.orca.group.visible, boulder: m.boulder.group.visible }');
    await step(page, 1.2, true); s = await state();
    const name1 = await page.evaluate(() => document.getElementById('levelName').textContent);
    check(`${T} High Tide: level 1 is called "High Tide"; the orca gives chase, not the boulder`, wet(s) && s.level === 1 && name1 === 'High Tide' && chase.orca && !chase.boulder, JSON.stringify({ s, name1, chase }));
    // 4. pause freezes everything
    await ev('m.Game.pause()'); const p0 = await ev('return m.Player.s'); await step(page, 1.0, false);
    check(`${T} paused: nothing moves`, (await state()).st === 'pause' && (await ev('return m.Player.s')) === p0); await snap('paused under water');
    await ev('m.Game.state = "run"; m.UI.setState("run"); m.Sound.wake();');
    // 5. the level cannot be changed in the middle of a run
    await ev('m.UI.pickMap("ruins")'); await page.waitForTimeout(350); s = await state();
    check(`${T} the level cannot change in the middle of a run`, s.map === 'tide' && wet(s) && s.st === 'run', JSON.stringify(s));
    // 6. caught by the orca: the card fits
    await ev('m.Game.run.invuln = 0; m.Game.run.danger = 0; m.Game.stumble({ type: "log", skin: "seal" }); m.Game.run.invuln = 0; m.Game.stumble({ type: "log", skin: "seal" });');
    await until(page, 'm.Game.state === "over"', 8, false); await snap('booped card');
    const card = await page.evaluate(() => { const r = document.querySelector('#over .card').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, title: document.getElementById('overTitle').textContent }; });
    check(`${T} game-over card fits on screen and says Booped!`, card.top >= 0 && card.bottom <= card.vh && card.title === 'Booped!', JSON.stringify(card));
    // 7. Run again: still High Tide
    await tap('btnAgain'); s = await state();
    check(`${T} "Run again" stays in High Tide, back at level 1`, wet(s) && s.level === 1 && (s.st === 'intro' || s.st === 'run'), JSON.stringify(s));
    await until(page, 'm.Game.state === "run"', 5, false); await step(page, 0.6, true);
    // 8. Home: still High Tide, and no banner left on the screen
    await ev('m.Player.die("bonk")'); await until(page, 'm.Game.state === "over"', 8, false); await tap('btnHome2'); s = await state();
    let banner = await page.evaluate(() => getComputedStyle(document.getElementById('levelUp')).visibility);
    check(`${T} "Home" from High Tide: the home screen is still under water, High Tide still chosen, no banner left over`, wet(s) && s.st === 'title' && s.tide === 'true' && banner === 'hidden', JSON.stringify(s) + ' banner ' + banner);
    // 9. back to Jungle Ruins: bone dry, and it stays dry through four levels
    await tap('mapRuins'); s = await state();
    check(`${T} tapping Jungle Ruins drains the home screen and is remembered`, dry(s) && s.st === 'title' && s.map === 'ruins' && s.ruins === 'true' && s.stored === 'ruins', JSON.stringify(s)); await snap('home: back in the ruins');
    await poke('btnRun'); await until(page, 'm.Game.state === "run"', 5, false);
    const land = await page.evaluate(() => { // autopilot through four levels, forgiving any slip, watching the water the whole way
      const m = window.__mj, G = m.Game, dt = 1 / 60; let t = 0, top = -99, seals = 0, sea = 0, orca = false, names = {};
      while (G.state === 'run' && G.run.level < 5 && t < 400) { G.run.invuln = 1; G.run.danger = 0; m.Bot.think(); G.update(dt); t += dt;
        top = Math.max(top, m.Tide.y); if (m.Tide.wet || m.Tide.under) sea++; seals += m.Player.seg.obstacles.filter((o) => o.skin === 'seal').length; if (m.Player.seg.sea) sea++;
        if (m.orca.group.visible) orca = true; names[G.run.level] = document.getElementById('levelName').textContent; }
      return { level: G.run.level, top, seals, sea, orca, names: Object.values(names).join(' > '), state: G.state, death: G.death && G.death.type, seaOn: document.getElementById('sea').classList.contains('on') };
    });
    check(`${T} Jungle Ruins: four levels deep and never a drop of sea`, land.level === 5 && land.top === -6.5 && !land.seals && !land.sea && !land.orca && !land.seaOn && land.names === 'Jungle Ruins > Sunset Ruins > Moonlit Ruins > Dawn Ruins > Jungle Ruins', JSON.stringify(land));
    await snap('ruins, level 5');
    // 10. the choice survives closing and opening the game
    await ev('if (m.Game.state === "run") m.Player.die("bonk")'); await until(page, 'm.Game.state === "over"', 8, false); await tap('btnHome2'); await tap('mapTide');
    await page.reload(); await page.waitForFunction(() => window.__mj); await step(page, 0.4, false); s = await state();
    check(`${T} the chosen level survives closing the game`, wet(s) && s.map === 'tide' && s.tide === 'true', JSON.stringify(s));
    console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors'); if (errors.filter((e) => !/ReadPixels/.test(e)).length) fails++;
    await browser.close();
  }
  const cw = 300, ch = Math.round(cw * 760 / 390), per = 6;
  const tiles = await Promise.all(shots.map(async (s) => { const th = Math.min(ch, Math.round(cw * s.h / s.w)); return { input: await sharp(s.buf).resize(cw, th).extend({ bottom: ch - th, background: '#222' }).toBuffer() }; }));
  await sharp({ create: { width: cw * per, height: ch * Math.ceil(tiles.length / per), channels: 3, background: '#222' } }).composite(tiles.map((t, i) => ({ input: t.input, left: (i % per) * cw, top: Math.floor(i / per) * ch }))).png().toFile('shots/states.png');
  console.log(fails ? `FAIL: ${fails}` : 'PASS');
  if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
