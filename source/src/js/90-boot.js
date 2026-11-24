// ───────────────────────── autopilot (used for playtesting the level generator) ─────────────────────────
const Bot = {
  // What does this lane hold between `from` and `to`? → { kind: 'block' | 'jump' | 'slide', s0, mid }
  hazard(lane, from, to) {
    const P = Player, seg = P.seg, v = Game.run.speed, li = lane + 1, x = lane * LANE_W;
    let best = null;
    const see = (kind, s0, mid) => { if (!best || s0 < best.s0) best = { kind, s0, mid }; };
    for (const o of seg.obstacles) {
      if (o.gone || o.s1 < from) continue;
      if (o.s0 > to) break;
      if (o.type === 'pillar') { if (o.lane === li) see('block', o.s0, o.s); }
      else if (o.type === 'beam') see('slide', o.s0, o.s);
      else if (x + 0.36 > o.x0 && x - 0.36 < o.x1) see('jump', o.s0, o.s);
    }
    for (const h of seg.holes) {
      if (h.s1 < from || h.s0 > to || !(x > h.x0 && x < h.x1)) continue;
      see(h.s1 - h.s0 <= v * AIR_T * 0.78 ? 'jump' : 'block', h.s0, (h.s0 + h.s1) / 2);
    }
    return best;
  },
  think() {
    const P = Player, seg = P.seg, run = Game.run, v = Math.max(run.speed, 6);
    if (P.dead || Game.state !== 'run' || P.flying) return;
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
      if (go) Game.input(go < 0 ? 'left' : 'right');
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
  orca = new Orca(); scene.add(orca.group);
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
  window.__mj = { Game, Player, Cam, Bot, Save, UI, Sound, Tide, Seg, MAT, seaGeo, cast: { get free() { return FREE_CAST.slice(); }, set free(v) { FREE_CAST = Array.isArray(v) ? v.slice() : []; Save.fixCast(); } }, runner, get world() { return world; }, get sky() { return sky; }, get monkey() { return monkey; }, get orca() { return orca; }, get boulder() { return boulder; }, get camera() { return camera; }, get scene() { return scene; }, render() { renderer.render(scene, camera); } };
}

try {
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ save: Save.data }));
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
} catch (err) {
  console.error(err);
  UI.fatal('Something went wrong starting the game. Reload the page to try again.');
}
