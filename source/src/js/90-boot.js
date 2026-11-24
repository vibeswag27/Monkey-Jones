// ───────────────────────── autopilot (used for playtesting the level generator) ─────────────────────────
const Bot = {
  // What does this lane hold between `from` and `to`? → { kind: 'block' | 'jump' | 'slide', s0, mid }
  hazard(lane, from, to) {
    const P = Player, seg = P.seg, v = Game.run.speed, li = lane + 1, x = lane * LANE_W;
    let best = null;
    const see = (kind, s0, mid) => { if (!best || s0 < best.s0) best = { kind, s0, mid }; };
    // A bounce pad ahead in this lane will carry him over whatever lies within its flight, provided he will be on the ground
    // (and, if it is in another lane, across to it) by the time he reaches it.
    let fly0 = 1e9, fly1 = -1e9, served = null;
    const touch = P.grounded ? P.s : P.s + v * (P.vy + Math.sqrt(P.vy * P.vy + 2 * GRAVITY * Math.max(0, P.y - P.floor))) / GRAVITY; // where his feet next meet the floor
    for (const o of seg.obstacles) {
      if (o.type !== 'pad' || o.used || o.lane !== li || o.s1 < P.s) continue;
      if (o.s0 > to) break;
      if (o.s1 - 0.25 > touch && (lane === P.lane || o.s0 > P.s + v * 0.16 + 0.5) && !P.bouncing) { fly0 = o.s0; fly1 = o.s + v * PAD_AIR * 0.96; served = o.d || null; }
      break;
    }
    for (const o of seg.obstacles) {
      if (o.gone || o.s1 < from || o.type === 'pad') continue;
      if (o.s0 > to) break;
      if (o.s0 >= fly0 && o.s0 <= fly1) continue; // under the bounce
      if (o.type === 'mover') { // a bobber is best gone round; a sweeper is hopped if it will be anywhere near this lane when he gets there
        if (o.kind === 'bob') { if (o.lane === li) see('block', o.s0, o.s); }
        else if (Math.abs(LANE_W * Math.sin(o.w * (Game.time + Math.max(0, o.s0 - P.s) / v) + o.ph) - x) < 1.75) see('jump', o.s0, o.s);
        continue;
      }
      if (o.type === 'pillar') { if (o.lane === li) see('block', o.s0, o.s); }
      else if (o.type === 'beam') see('slide', o.s0, o.s);
      else if (x + 0.36 > o.x0 && x - 0.36 < o.x1) see('jump', o.s0, o.s);
    }
    for (const h of seg.holes) {
      if (h.s1 < from || h.s0 > to || !(x > h.x0 && x < h.x1)) continue;
      if (h.bridge) { if (!(h.bridge.locked && h.bridge.to === li)) see('block', h.s0, (h.s0 + h.s1) / 2); continue; } // a bridged gap: only the lane the platform has settled on is open
      see(h.s1 - h.s0 <= v * AIR_T * 0.78 ? 'jump' : 'block', h.s0, (h.s0 + h.s1) / 2);
    }
    // Raised walkways. In his own lane, steps ahead are just more path; a face with no steps is a wall.
    // In another lane, the question is whether its side would be in the way while he crosses, and after that whether a face comes up.
    if (lane !== P.lane && seg.deckWall(li, P.s - 0.4, P.s + v * 0.13 + 0.6, P.y)) see('block', P.s, P.s);
    for (const d of seg.decks) {
      if (d.lane !== li || d.ramp || d.s1 < from || d.s0 > to || d.s0 < P.s - 0.3 || d === served) continue;
      if (d.h > P.y + STEP_UP) see('block', d.s0, d.s0);
    }
    return best;
  },
  think() {
    const P = Player, seg = P.seg, run = Game.run, v = Math.max(run.speed, 6);
    if (P.dead || Game.state !== 'run' || P.flying || P.bouncing) return;
    const L = seg.len, opens = L - LANE_W - 0.45, airT = AIR_T * (run.springs > 0 ? SPRING_K : 1);
    if (!P.turnQ && P.s > opens - Math.max(7, v * 0.55) + 0.6 && P.s <= L + 2) {
      const dir = seg.jt === 'T' ? (Math.random() < 0.5 ? 'L' : 'R') : seg.jt;
      Game.input(dir === 'L' ? 'left' : 'right');
      return;
    }
    const s = P.s, far = v * 0.85 + 2;
    const mine = this.hazard(P.lane, s - 0.6, s + far);
    if (mine && mine.kind === 'block') {
      const free = (l) => { if (l < -1 || l > 1) return false; const h = this.hazard(l, s - 1.3, s + far); return !(h && h.kind === 'block'); };
      const clearNow = (l) => { if (l < -1 || l > 1) return false; const h = this.hazard(l, s - 1.3, s + v * 0.11 + 1.3); return !(h && h.kind === 'block'); }; // crossing a lane takes about a tenth of a second
      let go = 0;
      if (free(P.lane - 1) && free(P.lane + 1)) go = Math.random() < 0.5 ? -1 : 1;
      else if (free(P.lane - 1)) go = -1;
      else if (free(P.lane + 1)) go = 1;
      else if (free(P.lane - 2) && clearNow(P.lane - 1)) go = -1;
      else if (free(P.lane + 2) && clearNow(P.lane + 1)) go = 1;
      // if the lane he would move to has something to hop almost at once, and the block is not yet upon him, he lets it go by first
      if (go && mine.s0 - s > v * 0.5 + 2) { const h = this.hazard(P.lane + go, s - 1.3, s + v * 0.42 + 1); if (h && h.kind === 'jump') go = 0; }
      if (go) Game.input(go < 0 ? 'left' : 'right');
    }
    // steps up in the next lane are worth a detour (he decides once per flight, and goes for most of them)
    if (P.grounded && P.y < 0.1 && !(mine && mine.kind === 'block')) for (const d of seg.decks) {
      if (!d.ramp || Math.abs(d.lane - 1 - P.lane) !== 1 || d.r0 < s + v * 0.3 || d.r0 > s + far) continue;
      if (d.fancy === undefined) d.fancy = Math.random() < 0.65;
      const h2 = d.fancy && this.hazard(d.lane - 1, s - 1.3, d.r0);
      if (d.fancy && !h2) { Game.input(d.lane - 1 < P.lane ? 'left' : 'right'); break; }
    }
    // and so is a bounce pad
    if (P.grounded && P.y < 0.1 && !(mine && mine.kind === 'block')) for (const o of seg.pads || []) {
      if (o.used || Math.abs(o.lane - 1 - P.lane) !== 1 || o.s0 < s + v * 0.3 + 1 || o.s0 > s + far) continue;
      if (o.fancy === undefined) o.fancy = Math.random() < 0.65;
      if (o.fancy && !this.hazard(o.lane - 1, s - 1.3, o.s0)) { Game.input(o.lane - 1 < P.lane ? 'left' : 'right'); break; }
    }
    const h = this.hazard(P.lane, s - 0.4, s + far);
    if (!h) return;
    if (!P.grounded && run.springs > 0 && P.vy < 0 && h.kind !== 'block' && h.s0 > s + v * 0.3 + 1 && h.s0 - s < v * 0.75) { Game.input('down'); return; } // long spring jumps: drop early if something is coming
    if (h.kind === 'jump' && P.grounded && s >= h.mid - (v * airT) / 2 + 0.3) Game.input('up');
    else if (h.kind === 'slide') { if (P.grounded && P.slide <= 0.2 && h.s0 - s < v * 0.3) Game.input('down'); else if (!P.grounded && h.s0 - s < v * 0.45) Game.input('down'); }
  },
};

// ───────────────────────── boot ─────────────────────────
function boot(hot) {
  const stage = document.getElementById('stage'), canvas = document.getElementById('c');
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { UI.fatal('This device could not start 3D graphics. Try another browser.'); return; }
  let pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setClearColor(0xc8eef9, 1);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 1, 0.3, 1500);
  sky = new Sky(scene);
  world = new World(scene);
  Save.load(hot);
  Roster.use(Save.data.char);
  boulder = new Boulder(); scene.add(boulder.group);
  shark = new Shark(); scene.add(shark.group);
  fx = new FX(scene);

  function resize() {
    const w = Math.max(1, stage.clientWidth || window.innerWidth), h = Math.max(1, stage.clientHeight || window.innerHeight);
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const was = Cam.portrait, wasA = Cam.aspect;
    Cam.portrait = w / h < 1.1; Cam.aspect = w / h;
    const titleCam = stage.dataset.state === 'chars' ? 'chars' : 'title';
    if (Cam.c && Game.state === 'title' && (was !== Cam.portrait || Math.abs(wasA - Cam.aspect) > 0.01)) Cam.snap(Cam.preset(titleCam));
    if (was !== Cam.portrait && Cam.c) {
      if (Game.state === 'title') Cam.snap(Cam.preset(titleCam));
      else if (Game.state === 'run' || Game.state === 'pause' || Game.state === 'count') Cam.to(Cam.preset('run'), 4);
    }
    if (Game.state === 'pause') renderer.render(scene, camera);
  }
  Cam.aspect = (stage.clientWidth || window.innerWidth) / (stage.clientHeight || window.innerHeight);
  Cam.portrait = Cam.aspect < 1.1;

  UI.init();
  resize();
  Game.toTitle();
  monkey.snapPose();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); UI.fatal('The graphics were interrupted. Reload the page to keep playing.'); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { // redraw the ×2 badge once the display face is in
    const m = world.pickupMat.double; m.map.image = drawBadge('double', 128); m.map.needsUpdate = true;
  }).catch(() => {});

  let lastT = 0, slow = 0, frames = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let raw = (now - lastT) / 1000; lastT = now;
    if (!(raw > 0) || raw > 0.3) raw = 1 / 60;
    if (Game.state === 'pause' || Game.state === 'fatal' || window.__mjManual) return;
    Game.update(Math.min(raw, 1 / 30));
    renderer.render(scene, camera);
    // if the device can't hold the frame rate, quietly drop the render resolution
    if (Game.state === 'run') {
      frames++; if (raw > 1 / 42) slow++;
      if (frames >= 120) { if (slow > 60 && pr > 1) { pr = Math.max(1, pr - 0.25); resize(); } frames = 0; slow = 0; }
    }
  }
  requestAnimationFrame(frame);

  // testing hooks
  window.__mj = { Game, Player, Cam, Bot, Save, UI, Sound, Tide, Seg, MAT, seaGeo, cast: { get free() { return FREE_CAST.slice(); }, set free(v) { FREE_CAST = Array.isArray(v) ? v.slice() : []; Save.fixCast(); } }, runner, get world() { return world; }, get sky() { return sky; }, get monkey() { return monkey; }, get fx() { return fx; }, get shark() { return shark; }, get boulder() { return boulder; }, get camera() { return camera; }, get scene() { return scene; }, render() { renderer.render(scene, camera); },
    // lay out (but do not build) a stretch at a given depth of the run, for the generator's tests
    gen(depth, seed, hold) { const p = new Seg(null, null); p.len = 60; p.depth = depth - 1; const s = new Seg(p, 'R'); genSegment(s, { rng: makeRng(seed >>> 0), tutorial: false, nextPickupAt: 0, hold: !!hold }); return s; },
    // float a crate on a built stretch (for photographs and for trying things by hand)
    addCrate(seg, lane, s) { const p = { kind: 'crate', s, x: laneX(lane), y: 1.15, got: false, sprite: null }; seg.pickups.push(p); if (seg.group) seg.group.add(makeCrate(p, seg.sea)); return p; } };
}

try {
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ save: Save.data }));
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
} catch (err) {
  console.error(err);
  UI.fatal('Something went wrong starting the game. Reload the page to try again.');
}
