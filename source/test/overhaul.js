// The rules of the run's new pieces (decks, pads, movers, bridges), checked by stepping the real game headless on a
// stretch emptied of everything except what each test puts there.   node test/overhaul.js [part of a test's name]
const { open } = require('./lib2');
const rig = require('./rig');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 760, dpr: 1 });
  let fails = 0, ran = 0; const only = process.argv[2];
  const test = async (name, fn) => {
    if (only && !name.includes(only)) return;
    let r; try { r = await page.evaluate(fn); } catch (e) { r = { ok: false, err: String(e).split('\n')[0] }; }
    ran++; if (!r || !r.ok) fails++;
    console.log((r && r.ok ? 'ok   ' : 'FAIL ') + name + (r && r.ok ? '' : '  ' + JSON.stringify(r)));
  };
  await rig(page);

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

  await test('deck: the charmed moment after a rocket flight sets him on top of a face instead of ending the run', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 30, false);
    T.to(s0 - 3); G.run.ghost = 1.0; const alive = T.to(s0 + 5);
    return { ok: alive && T.near(P.y, 2.2) && P.grounded, alive, y: P.y };
  });

  await test('deck: one in an outside lane never shoves him off the edge of the path, wherever in it he turns up', () => {
    const P = __mj.Player, got = [];
    for (const [lane, x] of [[2, 2.4], [2, 1.5], [0, -2.4], [0, -1.5], [1, 0.3], [1, -0.3]]) {
      const seg = T.start(), s0 = P.s + 10, d = T.deck(seg, lane, s0, s0 + 40, false); d.seen = true;
      P.s = s0 + 5; P.x = x; P.lane = lane - 1; T.wait(0.5);
      got.push({ lane, from: x, x: +P.x.toFixed(2), to: P.lane, y: P.y });
    }
    const ok = got.every((r) => Math.abs(r.x) < 2.0 && r.y === 0 && r.to !== r.lane - 1) && got[0].x < 1 && got[1].x < 1 && got[2].x > -1 && got[3].x > -1 && got[4].x > 1 && got[5].x < -1;
    return { ok, got };
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

  // ── movers ──
  await test('sweeper: it trips a runner in the lane it is crossing (a stumble, never a death), and not one in the next lane', () => {
    const G = __mj.Game, P = __mj.Player, got = [];
    for (const lane of [0, -1]) {
      const seg = T.start(), sm = P.s + 20; T.mover(seg, 'side', 1, sm, 0, 0); T.lane(lane);
      const alive = T.to(sm + 3); got.push({ lane, alive, danger: +G.run.danger.toFixed(1) });
    }
    return { ok: got[0].alive && got[0].danger > 0 && got[1].alive && got[1].danger <= 0, got };
  });
  await test('sweeper: a jump clears it', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sm = P.s + 20; T.mover(seg, 'side', 1, sm, 0, 0);
    T.to(sm - 11 * 0.335); G.input('up'); const alive = T.to(sm + 6);
    return { ok: alive && G.run.danger <= 0 && P.grounded, danger: G.run.danger };
  });
  await test('sweeper: where it is depends only on the game clock (in his lane when he arrives: a stumble; a lane away: none)', () => {
    const G = __mj.Game, P = __mj.Player, got = [], w = 2.4;
    for (const [off, lane] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 2, 1]]) {
      const seg = T.start(), sm = P.s + 20, tArr = G.time + (sm - P.s) / 11, o = T.mover(seg, 'side', 1, sm, w, off - w * tArr); T.lane(lane);
      T.wait(0.5); const moved = o.x0; T.wait(0.3); const moving = Math.abs(o.x0 - moved) > 0.05;
      const alive = T.to(sm + 3); got.push({ alive, moving, hit: G.run.danger > 0 });
    }
    return { ok: got.every((r) => r.alive && r.moving) && got[0].hit && !got[1].hit && got[2].hit, got };
  });
  await test('bobber: down low, running into it is a stumble and a jump clears it', () => {
    const G = __mj.Game, P = __mj.Player, got = [];
    for (const jump of [false, true]) {
      const seg = T.start(), sm = P.s + 20; T.mover(seg, 'bob', 1, sm, 0, 0);
      if (jump) { T.to(sm - 11 * 0.335); G.input('up'); }
      const alive = T.to(sm + 6); got.push({ jump, alive, hit: G.run.danger > 0 });
    }
    return { ok: got[0].alive && got[0].hit && got[1].alive && !got[1].hit, got };
  });
  await test('bobber: up high, he runs under it', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sm = P.s + 20, o = T.mover(seg, 'bob', 1, sm, 0, Math.PI);
    const alive = T.to(sm + 3);
    return { ok: alive && G.run.danger <= 0 && Math.abs(o.y0 - 1.6) < 1e-6, danger: G.run.danger, y0: o.y0 };
  });
  await test('bobber: at chest height, a standing run trips and a slide goes under', () => {
    const G = __mj.Game, P = __mj.Player, got = [];
    for (const slide of [false, true]) {
      const seg = T.start(), sm = P.s + 20, o = T.mover(seg, 'bob', 1, sm, 0, Math.acos(1 - 1.05 / 0.775));
      if (slide) { T.to(sm - 3); G.input('down'); }
      const alive = T.to(sm + 3); got.push({ slide, alive, hit: G.run.danger > 0, y0: +o.y0.toFixed(2) });
    }
    return { ok: got[0].alive && got[0].hit && got[1].alive && !got[1].hit && got[0].y0 === 1.1, got };
  });
  await test('bobber: it guards its own lane only', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sm = P.s + 20; T.mover(seg, 'bob', 1, sm, 0, 0); T.lane(1);
    const alive = T.to(sm + 3);
    return { ok: alive && G.run.danger <= 0, danger: G.run.danger };
  });

  // ── moving bridges ──
  await test('bridge: on the platform he crosses; a lane away is a fall, and under water a sinking', () => {
    const G = __mj.Game, P = __mj.Player, got = [];
    for (const [map, lane] of [['ruins', 0], ['ruins', -1], ['tide', 1]]) {
      const seg = T.start(map), s0 = P.s + 20; T.bridge(seg, s0, 12.9, 1, true); T.lane(lane);
      const alive = T.to(s0 + 16); got.push({ map, lane, alive, death: alive ? null : G.death.type, s: +(P.s - s0).toFixed(1) });
    }
    return { ok: got[0].alive && got[1].death === 'fall' && got[2].death === 'sink', got };
  });
  await test('bridge: it shuttles from lane to lane while he is far off, smoothly', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), b = T.bridge(seg, P.s + 900, 12.9, 1, false), lanes = new Set();
    T.wait(0.05); // (the first step puts it where the clock says it should be)
    let jump = 0, last = null; T.wait(5.5, () => { lanes.add(b.to); if (last !== null) jump = Math.max(jump, Math.abs(b.x - last)); last = b.x; });
    return { ok: lanes.size === 3 && jump > 0.02 && jump < 0.3 && b.locked === false, lanes: [...lanes], jump };
  });
  await test('bridge: about 1.3 s out it settles on a lane, is at rest 0.9 s before he arrives, and stays put until he is across (at 11 m/s and at 29)', () => {
    const G = __mj.Game, P = __mj.Player, got = [];
    for (const level of [1, 12]) for (const ph of [0, 0.45, 0.8, 1.1, 1.3]) {
      const seg = T.start('ruins', level), v = T.v, s0 = P.s + 1.3 * v + 3 + 9, b = T.bridge(seg, s0, 0.9 * v + 3, 1, false); b.ph = ph;
      let tLock = -1, to = -1, changed = false, tRest = -1, tArr = -1, moved = false;
      const watch = () => {
        if (b.locked && tLock < 0) { tLock = G.time; to = b.to; }
        if (tLock >= 0) {
          if (b.to !== to) changed = true;
          T.lane(to - 1);                                            // he takes the lane it has settled on
          const rest = Math.abs(b.x - (to - 1) * 1.9) < 1e-9;
          if (rest && tRest < 0) tRest = G.time; if (!rest && tRest >= 0) moved = true;
        }
        if (tArr < 0 && P.s >= s0) tArr = G.time;
      };
      const alive = T.to(b.s1 + 1, watch);
      got.push({ v, ph, alive, lead: +(tArr - tLock).toFixed(2), rest: +(tArr - tRest).toFixed(2), changed, moved });
    }
    return { ok: got.every((r) => r.alive && r.lead >= 1.2 && r.rest >= 0.9 && !r.changed && !r.moved), got };
  });
  await test('bridge: the autopilot crosses 20 of 20', () => {
    const G = __mj.Game, P = __mj.Player, lost = [];
    for (let i = 0; i < 20; i++) {
      const seg = T.start(i % 4 < 2 ? 'ruins' : 'tide', i % 2 ? 12 : 1), v = T.v, s0 = P.s + 1.3 * v + 3 + 10, b = T.bridge(seg, s0, 0.9 * v + 3, 1, false); b.ph = i * 0.37;
      T.lane([-1, 0, 1][i % 3]);
      const alive = T.to(b.s1 + 3, () => __mj.Bot.think());
      if (!alive) lost.push({ i, v, to: b.to, lane: P.lane, at: +(P.s - s0).toFixed(1), death: G.death && G.death.type });
    }
    return { ok: lost.length === 0, lost };
  });
  await test('bridge: its bananas ride with it', () => {
    const P = __mj.Player, seg = T.start(), b = T.bridge(seg, P.s + 900, 12.9, 1, false);
    const n = { s: b.s0 + 2, x: b.x, y: 0.62, got: false, pull: -1, ph: 0, wx: 0, wz: 0, ride: b }; seg.bananas.push(n);
    const seen = new Set(); T.wait(4, () => { seen.add(Math.round(n.x * 10)); });
    return { ok: seen.size > 3 && n.x === b.x && Math.abs(n.wx - seg.wx(n.s, n.x)) < 1e-9 && Math.abs(n.wz - seg.wz(n.s, n.x)) < 1e-9, places: seen.size };
  });

  // ── a new run starts clean ──
  await test('restart: straight from the top of a deck, the new run begins on the ground with the camera down', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), s0 = P.s + 25; T.deck(seg, 1, s0, s0 + 40, true);
    T.to(s0 + 12); T.wait(0.6); const before = { y: P.y, camF: G.camF };
    G.restart(); const after = { y: P.y, floor: P.floor, camF: G.camF, g: P.grounded };
    return { ok: before.y > 2 && before.camF > 1.5 && after.y === 0 && after.floor === 0 && after.camF === 0 && after.g, before, after };
  });
  await test('restart: after dying in mid-bounce, the new run is not still bouncing and nothing is carried over', () => {
    const G = __mj.Game, P = __mj.Player, seg = T.start(), sp = P.s + 20; T.pad(seg, 1, sp);
    T.to(sp + 3); const mid = { b: P.bouncing, y: P.y }; P.die('bonk');
    let n = 0; while (G.state !== 'over' && n++ < 900) G.update(T.dt);
    G.restart(); n = 0; while (G.state !== 'run' && n++ < 600) G.update(T.dt);
    T.wait(0.3);
    return { ok: mid.b === true && mid.y > 1 && G.state === 'run' && P.bouncing === false && P.y === 0 && P.grounded && G.camF < 0.02 && Math.abs(G.bY) < 0.02, mid, state: G.state, b: P.bouncing, y: P.y, camF: G.camF, bY: G.bY };
  });
  await test('restart: the new world is new: bridges free, pads unused, movers untouched', () => {
    const G = __mj.Game, P = __mj.Player, m = __mj;
    m.Seg.startDepth = 12; G.restart(); let n = 0; while (G.state !== 'run' && n++ < 600) G.update(T.dt);
    for (let i = 0; i < 600 && G.state === 'run'; i++) { m.Bot.think(); G.update(T.dt); }       // ten seconds of play, to dirty things
    m.Seg.startDepth = 12; G.restart(); m.Seg.startDepth = 0;
    const segs = [m.world.cur, m.world.cur.kids.L, m.world.cur.kids.R].filter(Boolean), bad = [];
    let pieces = 0;
    for (const seg of segs) {
      for (const b of seg.bridges) { pieces++; if (b.locked) bad.push('bridge locked'); }
      for (const o of seg.obstacles) { if (o.type === 'pad') { pieces++; if (o.used) bad.push('pad used'); } if (o.type === 'mover') { pieces++; if (o.hit) bad.push('mover hit'); } }
      for (const d of seg.decks) { pieces++; if (d.seen) bad.push('deck face already met'); }
    }
    return { ok: bad.length === 0 && segs.length >= 2, pieces, bad };
  });

  console.log(errors.filter((e) => !/ReadPixels/.test(e)).join('\n') || 'no errors'); if (errors.filter((e) => !/ReadPixels/.test(e)).length) fails++;
  console.log(fails ? `FAIL: ${fails} of ${ran}` : `PASS: ${ran} rules`);
  await browser.close();
  if (fails) process.exit(1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
