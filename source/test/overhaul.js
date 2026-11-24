// The rules of the run's new pieces (decks, pads, movers, bridges), checked by stepping the real game headless on a
// stretch emptied of everything except what each test puts there.   node test/overhaul.js [part of a test's name]
const { open } = require('./lib2');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760, dpr: 1 });
  let fails = 0, ran = 0; const only = process.argv[2];
  const test = async (name, fn) => {
    if (only && !name.includes(only)) return;
    let r; try { r = await page.evaluate(fn); } catch (e) { r = { ok: false, err: String(e).split('\n')[0] }; }
    ran++; if (!r || !r.ok) fails++;
    console.log((r && r.ok ? 'ok   ' : 'FAIL ') + name + (r && r.ok ? '' : '  ' + JSON.stringify(r)));
  };
  await page.evaluate(() => {
    const m = window.__mj, G = m.Game, P = m.Player;
    window.T = {
      dt: 1 / 60,
      // a fresh run on an empty stretch; returns the stretch. speed: fraction of the level's speed to hold (default 1)
      start(map) {
        m.Save.data.map = map || 'ruins'; m.Save.data.runs = 5; m.Save.data.seaChar = null; m.Save.data.char = 'monkey'; G.restart();
        let t = 0; while (G.state !== 'run' && t < 5) { G.update(this.dt); t += this.dt; }
        const seg = P.seg; seg.obstacles.length = 0; seg.holes.length = 0; seg.holeCells.clear(); seg.bananas.length = 0; seg.pickups.length = 0;
        for (const k of ['decks', 'movers', 'bridges']) if (seg[k]) seg[k].length = 0;
        seg.obI = 0; seg.bI = 0; G.run.invuln = 0; G.run.danger = 0; G.run.ghost = 0; G.run.speed = 11;
        return seg;
      },
      deck(seg, lane, s0, s1, ramp) { const x = (lane - 1) * 1.9, d = { lane, s0, s1, h: 2.2, ramp: !!ramp, r0: ramp ? s0 - 5.5 : s0, x0: x - 0.95, x1: x + 0.95 }; seg.decks.push(d); return d; },
      to(s, each) { let n = 0; while (G.state === 'run' && P.s < s && n++ < 9000) { if (each) each(); G.update(this.dt); } return G.state === 'run'; },
      wait(sec, each) { for (let t = 0; t < sec && G.state === 'run'; t += this.dt) { if (each) each(); G.update(this.dt); } return G.state === 'run'; },
      lane(l) { P.lane = l; P.x = l * 1.9; },
      // obstacles as the generator makes them, kept in order along the stretch
      put(seg, o) { seg.obstacles.push(o); seg.obstacles.sort((a, b) => a.s0 - b.s0); seg.obI = 0; return o; },
      pad(seg, lane, s, d) { const x = (lane - 1) * 1.9, o = this.put(seg, { type: 'pad', lane, s, s0: s - 0.6, s1: s + 0.6, x0: x - 0.8, x1: x + 0.8, y0: 0, y1: 0.3, d }); if (d) d.pad = o; return o; },
      pillar(seg, lane, s) { const x = (lane - 1) * 1.9; return this.put(seg, { type: 'pillar', s, s0: s - 0.62, s1: s + 0.62, x0: x - 0.72, x1: x + 0.72, y0: 0, y1: 2.8, lane }); },
      rubble(seg, lane, s) { const x = (lane - 1) * 1.9; return this.put(seg, { type: 'rubble', s, s0: s - 0.5, s1: s + 0.5, x0: x - 0.8, x1: x + 0.8, y0: 0, y1: 0.6, trip: true, lane }); },
      near(a, b) { return Math.abs(a - b) < 1e-6; },
    };
  });

  // ── decks ──
  await test('deck: floorY is 0 before the steps, half way up in the middle of them, 2.2 on top, 0 past the end and in the next lane', () => {
    const P = __mj.Player, seg = T.start(), s0 = P.s + 25, d = T.deck(seg, 1, s0, s0 + 30, true);
    const got = [seg.floorY(s0 - 6, 0), seg.floorY(s0 - 2.75, 0), seg.floorY(s0 + 5, 0), seg.floorY(s0 + 30.1, 0), seg.floorY(s0 + 5, 1.9)];
    return { ok: got[0] === 0 && T.near(got[1], 1.1) && got[2] === 2.2 && got[3] === 0 && got[4] === 0, got };
  });
  await test('deck: the steps carry him up, he runs along the top and drops off the far end unharmed', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, true);
    T.to(s0 + 15); const top = { y: P.y, g: P.grounded };
    T.to(s0 + 40); const end = { y: P.y, g: P.grounded, st: G.state };
    return { ok: T.near(top.y, 2.2) && top.g && end.y === 0 && end.g && end.st === 'run', top, end };
  });
  await test('deck: running into the face of one with no steps is a bonk', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, false);
    T.to(s0 + 3); let n = 0; while (G.state === 'dying' && n++ < 600) G.update(T.dt);
    return { ok: !!G.death && G.death.type === 'bonk' && G.death.s0 < s0 + 1, death: G.death && G.death.type, s: P.s - s0 };
  });
  await test('deck: a shield at the face lifts him onto it and is spent', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, false); G.run.shield = true; G.run.shieldT = 9;
    const alive = T.to(s0 + 5);
    return { ok: alive && T.near(P.y, 2.2) && P.grounded && G.run.shield === false, alive, y: P.y, shield: G.run.shield };
  });
  await test('deck: a swipe into its side is refused, with no stumble', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, false); T.lane(-1);
    T.to(s0 + 10); G.input('right'); T.wait(0.4);
    return { ok: G.state === 'run' && P.lane === -1 && Math.abs(P.x + 1.9) < 0.05 && G.run.danger <= 0 && P.y === 0, lane: P.lane, x: P.x, danger: G.run.danger, y: P.y };
  });
  await test('deck: stepping off the side of the top lands him in the next lane', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, true);
    T.to(s0 + 10); const up = P.y; G.input('left'); T.wait(0.9);
    return { ok: G.state === 'run' && T.near(up, 2.2) && P.lane === -1 && P.y === 0 && P.grounded, up, lane: P.lane, y: P.y };
  });
  await test('deck: a jump timed to reach the lip climbs on; a jump too early is a bonk', () => {
    const G = __mj.Game, P = __mj.Player; let seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, false);
    T.to(s0 - 11 * 0.335); G.input('up'); const a = T.to(s0 + 6), ya = P.y, ga = P.grounded;
    seg = T.start(); s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, false);
    T.to(s0 - 11 * 0.6); G.input('up'); T.to(s0 + 6);
    return { ok: a && T.near(ya, 2.2) && ga && !!G.death && G.death.type === 'bonk', a, ya, ga, early: G.death && G.death.type };
  });
  await test('deck: a springs jump clears the lip and lands on top', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, false); G.run.springs = 6;
    T.to(s0 - 3.3); G.input('up'); const alive = T.to(s0 + 12);
    return { ok: alive && T.near(P.y, 2.2) && P.grounded, alive, y: P.y };
  });
  await test('deck: a swipe just before the face never leaves him inside the block', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25, s1 = s0 + 30; T.deck(seg, 1, s0, s1, false); T.lane(-1);
    T.to(s0 - 0.5); G.input('right'); let inside = 0;
    const alive = T.to(s0 + 15, () => { if (P.s > s0 && P.s < s1 && Math.abs(P.x) < 0.9 && P.y < 2.0) inside++; });
    return { ok: alive && inside === 0, alive, inside, lane: P.lane, x: P.x };
  });
  await test('deck: the rocket will not set him down in front of a face', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 40; T.deck(seg, 1, s0, s0 + 30, false);
    T.to(s0 - 6); const before = P.clearToLand(); T.start(); const open = P.clearToLand();
    return { ok: before === false && open === true, before, open };
  });
  await test('deck: the boulder comes up onto the deck behind him', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 60, true);
    T.to(s0 + 20); G.bGap = 4; T.wait(0.6, () => { G.bGap = 4; });
    return { ok: Math.abs(__mj.boulder.group.position.y - 2.2) < 0.15, y: __mj.boulder.group.position.y };
  });

  // ── bounce pads ──
  await test('pad: it throws him about 3.5 m up, and a totem under the arc does not touch him', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sp = P.s + 20, pad = T.pad(seg, 1, sp); T.pillar(seg, 1, sp + 4);
    T.to(sp + 0.5); const off = { vy: P.vy, g: P.grounded, b: P.bouncing };
    let top = 0; const alive = T.to(sp + 14, () => { top = Math.max(top, P.y); });
    return { ok: alive && off.vy > 0 && !off.g && off.b === true && top >= 3.3 && top < 3.8 && P.grounded && P.y === 0 && P.bouncing === false && G.run.danger <= 0 && pad.used === true, off, top, y: P.y, alive };
  });
  await test('pad then deck: he ends on top at full speed, at 0.62 of it and at 0.4 of it', () => {
    const G = __mj.Game, P = __mj.Player, got = [];
    for (const k of [1, 0.62, 0.4]) {
      const seg = T.start(), sp = P.s + 20, d = T.deck(seg, 1, sp + 3.75, sp + 33.75, false); T.pad(seg, 1, sp, d);
      const hold = () => { G.run.speed = 11 * k; }, alive = T.to(sp + 13, hold);
      got.push({ k, alive, y: +P.y.toFixed(2), g: P.grounded, s: +(P.s - sp).toFixed(1) });
    }
    return { ok: got.every((r) => r.alive && r.y === 2.2 && r.g), got };
  });
  await test('pad: it works once', () => {
    const P = __mj.Player, seg = T.start(), sp = P.s + 20, pad = T.pad(seg, 1, sp);
    T.to(sp + 14); const first = pad.used;
    P.s = sp - 4; seg.obI = 0; let top = 0; T.to(sp + 6, () => { top = Math.max(top, P.y); });
    return { ok: first === true && top === 0 && P.grounded, first, top };
  });
  await test('pad: jumping over it does not set it off', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sp = P.s + 20, pad = T.pad(seg, 1, sp);
    T.to(sp - 11 * 0.335); G.input('up'); let top = 0; T.to(sp + 8, () => { top = Math.max(top, P.y); });
    return { ok: !pad.used && top > 1.7 && top < 2.1 && P.grounded && P.y === 0, used: !!pad.used, top };
  });
  await test('pad: a slide across it still bounces him', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sp = P.s + 20, pad = T.pad(seg, 1, sp);
    T.to(sp - 2.5); G.input('down'); const sliding = P.slide > 0; T.to(sp + 0.5);
    return { ok: sliding && pad.used === true && P.bouncing === true && P.slide <= 0 && P.vy > 0, sliding, used: !!pad.used, slide: P.slide };
  });
  await test('pad: nothing touches him for a moment after he comes down', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sp = P.s + 20; T.pad(seg, 1, sp); T.rubble(seg, 1, sp + 11 * (2 * 15.4 / 34) + 1.6);
    T.to(sp + 3); let n = 0; while (!P.grounded && n++ < 400) G.update(T.dt);
    const ghost = G.run.ghost, alive = T.to(sp + 16);
    return { ok: alive && ghost > 0.25 && ghost <= 0.35 && G.run.danger <= 0, ghost, danger: G.run.danger, landed: +(P.s - sp).toFixed(1) };
  });
  await test('pad: a stumble just before it does not rob the bounce (he is back up to speed off the pad)', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sp = P.s + 20; T.pad(seg, 1, sp);
    T.to(sp - 3); G.run.slow = 0.45; G.run.speed = 11 * 0.62; T.to(sp + 0.5);
    return { ok: P.bouncing === true && G.run.slow <= 0, slow: G.run.slow, b: P.bouncing };
  });

  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors'); if (errors.filter((e) => !/ReadPixels/.test(e)).length) fails++;
  console.log(fails ? `FAIL: ${fails} of ${ran}` : `PASS: ${ran} rules`);
  await browser.close();
  if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
