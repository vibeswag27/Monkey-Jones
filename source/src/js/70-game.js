// ───────────────────────── game: save data, camera, player, rules ─────────────────────────
let renderer, scene, camera, world, sky, monkey, boulder, shark, fx;
const _look = new THREE.Vector3(), _nose = new THREE.Vector3();
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not available */ } };

const Save = {
  // char: the everyday runner, who can go anywhere. seaChar: the seal or the orca, if one of them has been picked for High Tide (they live nowhere else).
  data: { best: 0, wallet: 0, music: true, sfx: true, runs: 0, up: {}, char: 'monkey', seaChar: null, owned: ['monkey'], map: 'ruins' },
  fixCast(more) { // Monkey Jones is always unlocked; whoever is chosen must be someone you may play
    const d = this.data, have = Array.isArray(d.owned) ? d.owned : [], extra = Array.isArray(more) ? more : [];
    d.owned = CHAR_ORDER.filter((k) => k === 'monkey' || have.includes(k) || extra.includes(k));
    if (!owns(d.char) || CHARS[d.char].sea) d.char = 'monkey';
    if (!owns(d.seaChar) || !CHARS[d.seaChar].sea) d.seaChar = null;
    if (!MAPS[d.map]) d.map = 'ruins';
  },
  fixLevels(more) { // every power-up has a level from 1 to 6
    const up = this.data.up && typeof this.data.up === 'object' ? this.data.up : {}, out = {};
    for (const k of POWER_KINDS) out[k] = clamp(Math.floor(Math.max(up[k] || 1, (more && more[k]) || 1)), 1, MAX_LEVEL);
    this.data.up = out;
  },
  load(extra) {
    try { const raw = localStorage.getItem('monkeyjones.v1'); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
    this.fixLevels(extra && extra.save && extra.save.up);
    this.fixCast(extra && extra.save && extra.save.owned);
    if (extra && extra.save && owns(extra.save.char) && !CHARS[extra.save.char].sea) this.data.char = extra.save.char;
    if (extra && extra.save && owns(extra.save.seaChar) && CHARS[extra.save.seaChar].sea) this.data.seaChar = extra.save.seaChar;
    if (extra && extra.save && MAPS[extra.save.map]) this.data.map = extra.save.map;
    if (extra && typeof extra === 'object' && extra.save) {
      const s = extra.save;
      this.data.best = Math.max(this.data.best, s.best || 0); this.data.wallet = Math.max(this.data.wallet, s.wallet || 0);
      this.data.runs = Math.max(this.data.runs, s.runs || 0);
      if (typeof s.music === 'boolean') this.data.music = s.music;
      if (typeof s.sfx === 'boolean') this.data.sfx = s.sfx;
    }
  },
  store() { try { localStorage.setItem('monkeyjones.v1', JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ } },
};

const powerTime = (k) => POWERS[k].t[Save.data.up[k] - 1];
const owns = (id) => !!CHARS[id] && (FREE_CAST.includes(id) || Save.data.owned.includes(id)); // may this character be played?
// Who runs in the level that is chosen: in High Tide the seal or the orca if one was picked there, otherwise the everyday runner.
const runner = () => (atSea() && owns(Save.data.seaChar) ? Save.data.seaChar : Save.data.char);
// A puff where he pushes off or comes down: dust for feet, bubbles for anyone who swims.
const puff = (x, z, n) => { if (monkey.swims) fx.bubbles(x, SWIM_Y - 0.35, z, n, 0.7); else fx.dust(x, 0, z, n); };

// The tide. At 0 the lagoon lies far below the path; at 1 the ruins are deep under water.
const Tide = {
  u: 0, aim: 0, y: WATER_Y, sub: 0, wet: false, under: false,
  // High Tide is a level of its own, so the water is set once: in for the whole run, or out for the whole run.
  // (Change `aim` during a run and it will still rise or drain by itself, with everything that goes with it.)
  flood(on) { this.u = this.aim = on ? 1 : 0; this.y = this.height(this.u); this.sub = on ? 1 : 0; this.wet = this.under = !!on; },
  height(u) { // fast up to the path, slow enough across it to watch the flood, then away overhead
    if (u <= 0) return WATER_Y;
    if (u < 0.34) { const k = u / 0.34; return WATER_Y + (-0.5 - WATER_Y) * (1.345 * k - 0.345 * k * k); }
    if (u < 0.8) return -0.5 + 5.3 * ((u - 0.34) / 0.46);
    if (u < 1) { const k = (u - 0.8) / 0.2; return 4.8 + (TIDE_TOP - 4.8) * (0.226 * k + 0.774 * k * k); }
    return TIDE_TOP;
  },
  // Returns 'under' or 'out' on the frame the surface crosses the camera.
  update(dt, camY) {
    if (this.u !== this.aim) { const d = dt / 2.9; this.u = this.aim > this.u ? Math.min(this.aim, this.u + d) : Math.max(this.aim, this.u - d); }
    this.y = this.height(this.u);
    this.sub = clamp(this.y - camY + 0.5, 0, 1); // 0 with the surface below the camera, 1 once it has closed overhead
    this.wet = this.y > 1.3;                      // deep enough that he is swimming rather than wading
    const now = this.sub > 0.5;
    if (now === this.under) return null;
    this.under = now;
    return now ? 'under' : 'out';
  },
};

// Camera: orbits a smoothed follow point. a = orbit angle (0 = behind Monkey Jones, π = in front).
const Cam = {
  yaw: 0, F: new THREE.Vector3(), c: null, t: null, k: 6, shake: 0, portrait: true, lookAt: null, fovKick: 0,
  preset(name) {
    const p = this.portrait, r = Math.max(1, (this.aspect || 0.52) / 0.52); // squatter phones: stand further back so the buttons don't cover him
    if (name === 'title') return { a: p ? Math.PI - 0.13 : Math.PI - 0.3, dist: p ? 5.45 * Math.pow(r, 1.15) : 4.7, height: 1.15, lookY: p ? 1.02 - (r - 1) : 0.95, ahead: 0, fov: p ? 44 : 32, side: 0, lookSide: p ? 0 : -1.25 };
    if (name === 'chars') { const t = this.preset('title'); if (p) t.lookY = 0.14; return t; } // lift the character clear of the controls
    if (name === 'down') return { a: 0.6, dist: 4.6, height: 2.5, lookY: 0.6, ahead: 0.5, fov: p ? 62 : 48, side: 0, lookSide: 0 };
    return { a: 0, dist: p ? 5.2 : 5.7, height: p ? 3.1 : 3.0, lookY: 1.3, ahead: p ? 7 : 8, fov: p ? 72 : 58, side: 0, lookSide: 0 };
  },
  snap(p) { this.c = Object.assign({}, p); this.t = Object.assign({}, p); },
  to(p, k) { this.t = Object.assign({}, p); this.k = k || 5; },
  kick(a) { if (!REDUCED) this.shake = Math.max(this.shake, a); },
  update(dt, tx, ty, tz, yawT, hard) {
    const c = this.c, t = this.t, e = 1 - Math.exp(-this.k * dt);
    for (const key in t) c[key] += (t[key] - c[key]) * e;
    if (hard) { this.F.set(tx, ty, tz); this.yaw = yawT; }
    else {
      this.F.x = damp(this.F.x, tx, 14, dt); this.F.z = damp(this.F.z, tz, 14, dt); this.F.y = damp(this.F.y, ty, 8, dt);
      this.yaw = dampAngle(this.yaw, yawT, 7.5, dt);
    }
    const psi = this.yaw + c.a, sn = Math.sin(psi), cs = Math.cos(psi);
    let sx = 0, sy = 0;
    if (this.shake > 0.002) { sx = (Math.random() - 0.5) * this.shake * 0.5; sy = (Math.random() - 0.5) * this.shake * 0.5; this.shake *= Math.exp(-7 * dt); }
    camera.position.set(this.F.x + sn * c.dist + cs * c.side + sx, this.F.y + c.height + sy, this.F.z + cs * c.dist - sn * c.side);
    if (this.lookAt) _v.copy(this.lookAt);
    else _v.set(this.F.x - Math.sin(this.yaw) * c.ahead + cs * c.lookSide, this.F.y + c.lookY, this.F.z - Math.cos(this.yaw) * c.ahead - sn * c.lookSide);
    camera.lookAt(_v);
    const fov = c.fov + this.fovKick;
    if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  },
};

const Player = {
  seg: null, s: 0, x: 0, lane: 0, y: 0, vy: 0, grounded: true, slide: 0, slideOnLand: false, jumpBuf: 0, coyote: 0,
  turnQ: null, yaw: 0, lean: 0, stumbleT: -1, dead: false, wx: 0, wz: 0, stepPh: 0, flying: false,

  reset(seg) {
    this.seg = seg; this.s = 0; this.x = 0; this.lane = 0; this.y = 0; this.vy = 0; this.grounded = true;
    this.slide = 0; this.slideOnLand = false; this.jumpBuf = 0; this.coyote = 0; this.turnQ = null;
    this.yaw = seg.yaw; this.lean = 0; this.stumbleT = -1; this.dead = false; this.flying = false; this.place();
  },
  place() { this.wx = this.seg.wx(this.s, this.x); this.wz = this.seg.wz(this.s, this.x); },

  input(a) {
    if (this.dead) return;
    if (this.flying && (a === 'up' || a === 'down')) return;
    if (a === 'up') { if (this.grounded || this.coyote > 0) this.jump(); else this.jumpBuf = 0.15; return; }
    if (a === 'down') {
      if (this.grounded) this.startSlide();
      else { if (this.vy > -18) this.vy = -18; this.coyote = 0; this.slideOnLand = true; }
      return;
    }
    const dir = a === 'left' ? 'L' : 'R', seg = this.seg, L = seg.len;
    const opens = L - LANE_W - 0.45; // where the turn window opens; a swipe a little early is remembered
    if ((seg.jt === 'T' || seg.jt === dir) && this.s > opens - Math.max(7, Game.run.speed * 0.55) && this.s <= L + 2.4) {
      this.turnQ = dir; this.tryTurn(); return;
    }
    this.shift(dir === 'L' ? -1 : 1);
  },
  shift(d) {
    const nl = clamp(this.lane + d, -1, 1);
    if (nl === this.lane) { this.lean = -d * 0.3; return; }
    const O = this.seg.obstacles, li = nl + 1;
    for (let i = this.seg.obI; i < O.length && !this.flying && Game.run.ghost <= 0; i++) { // a totem right beside you? you bounce off it
      const o = O[i];
      if (o.s0 > this.s + 1.0) break;
      if (!o.gone && o.type === 'pillar' && o.lane === li && o.s1 > this.s - 0.7 && this.y < o.y1 - 0.3) { this.lean = d * 0.55; Game.stumble(o); return; }
    }
    this.lane = nl; Sound.sfx.lane();
  },
  jump() {
    const sp = Game.run.springs > 0;
    this.vy = JUMP_V * (sp ? SPRING_K : 1); this.grounded = false; this.slide = 0; this.coyote = 0; this.jumpBuf = 0; this.slideOnLand = false;
    if (this.y < 0) this.y = 0;
    monkey.bounce(sp ? 1.34 : 1.2); puff(this.wx, this.wz, sp ? 8 : 4);
    if (sp) Sound.sfx.spring(); else Sound.sfx.jump();
  },
  // Rocket: lift off, and string bananas through the air ahead.
  startFlight() {
    this.flying = true; this.grounded = false; this.vy = 0; this.slide = 0; this.coyote = 0; this.jumpBuf = 0; this.slideOnLand = false; this.stumbleT = -1;
    world.skyOn = true;
    world.addSky(this.seg, this.s + 10);
    for (const t of ['L', 'R']) if (this.seg.kids[t]) world.addSky(this.seg.kids[t], HJ + 6);
    monkey.setJet(true); Sound.sfx.rocket();
  },
  endFlight() {
    const run = Game.run;
    this.flying = false; this.vy = -2; this.grounded = false; this.coyote = 0;
    run.rocket = 0; run.ghost = 1.2;
    world.dropSky(); monkey.setJet(false); Sound.sfx.powerEnd();
  },
  // Is the stretch below clear enough to come down on?
  clearToLand() {
    const seg = this.seg, s = this.s, v = Game.run.speed, x = this.lane * LANE_W, to = s + v * 0.95;
    if (s < (seg.first ? 0 : seg.floorStart + 3) || s > seg.len - HJ - Math.max(18, v * 1.7)) return false;
    for (const h of seg.holes) if (h.s1 > s - 1 && h.s0 < to) return false;
    for (const o of seg.obstacles) {
      if (o.gone || o.s1 < s - 1) continue;
      if (o.s0 > to) break;
      if (x + 0.5 > o.x0 && x - 0.5 < o.x1) return false;
    }
    return true;
  },
  startSlide() { this.slide = SLIDE_T; this.slideOnLand = false; monkey.bounce(0.84); Sound.sfx.slide(); fx.dust(this.wx, 0, this.wz, 5); },
  tryTurn() {
    const seg = this.seg, L = seg.len, dir = this.turnQ;
    if (!dir) return false;
    // Each lane turns on the junction's diagonal, so you come out of a corner in the lane you went in on:
    // the inside lane turns first and the outside lane runs a little further before it does.
    const pivot = L + (dir === 'R' ? -1 : 1) * this.lane * LANE_W;
    if (this.s < pivot) return false;
    const child = seg.kids[dir];
    if (!child || !child.group) return false;
    const ns = dir === 'R' ? this.x : -this.x, nx = dir === 'R' ? L - this.s : this.s - L;
    this.seg = world.enter(dir);
    this.s = ns; this.x = nx; this.turnQ = null; // the lane is kept; a late swipe just eases him back across to it
    this.lean = dir === 'R' ? -0.5 : 0.5;
    Sound.sfx.turn(); Game.onTurn();
    return true;
  },
  die(type) { if (this.dead) return; this.dead = true; Game.kill(type); },

  collide() {
    const seg = this.seg, O = seg.obstacles, s = this.s, x = this.x, y = this.y;
    while (seg.obI < O.length && O[seg.obI].s1 < s - 1.2) seg.obI++;
    if (Game.run.ghost > 0) return; // just landed from a flight: nothing can touch him for a moment
    for (let i = seg.obI; i < O.length; i++) {
      const o = O[i];
      if (o.s0 > s + 0.3) break;
      if (o.gone || o.s1 < s - 0.3) continue;
      const hitX = x + 0.36 > o.x0 && x - 0.36 < o.x1;
      if (o.type === 'pillar') { // only a head-on hit counts; sideways bumps are handled when you swipe
        if (!o.seen) { o.seen = true; if (hitX && y < o.y1 - 0.3) { Game.hitSolid(o); if (this.dead) return; } } // springs can clear the top
      } else if (o.type === 'beam') {
        if (!o.hit && y < o.y1 && y + (this.slide > 0 ? 0.78 : 1.45) > o.y0) { o.hit = true; Game.hitSolid(o); if (this.dead) return; }
      } else if (o.trip && !o.hit && hitX && y < o.y1 - 0.14) { o.hit = true; Game.stumble(o); if (this.dead) return; }
    }
  },

  update(dt) {
    const run = Game.run;
    let left = run.speed * dt;
    while (left > 0 && !this.dead) { // small steps, so nothing is skipped at speed
      const step = Math.min(left, 0.4); left -= step; this.s += step;
      if (this.flying && !this.turnQ && this.s > this.seg.len - LANE_W - 0.6) this.turnQ = this.seg.jt === 'T' ? (Math.random() < 0.5 ? 'L' : 'R') : this.seg.jt; // the rocket steers itself round corners
      if (this.turnQ) this.tryTurn();
      if (!this.flying) this.collide();
    }
    if (this.dead) return;
    const seg = this.seg;
    if (this.s > seg.len + HJ - 0.5) { if (this.flying) this.s = seg.len + HJ - 0.5; else { this.die('bonk'); return; } }

    const tx = this.lane * LANE_W;
    this.x = damp(this.x, tx, 17, dt);
    this.lean = damp(this.lean, clamp(-(tx - this.x) * 0.3, -0.5, 0.5), 11, dt);

    if (this.flying) {
      this.y = damp(this.y, FLY_Y + Math.sin(Game.time * 3) * 0.1, 5, dt);
      // out of fuel: keep gliding until there is a clear stretch (never set him down right in front of a junction)
      if (run.rocket <= 0 && this.s < seg.len - HJ - Math.max(14, run.speed * 0.9) && (run.rocket < -3.5 || this.clearToLand())) this.endFlight();
      this.yaw = dampAngle(this.yaw, seg.yaw, 20, dt);
      this.place();
      return;
    }
    const ghost = run.ghost > 0;
    const over = !ghost && this.y <= 0.02 && seg.overHole(this.s, this.x);
    if (this.grounded) {
      if (over) { this.grounded = false; this.vy = 0; this.coyote = 0.09; this.slide = 0; }
      else if (this.slide > 0) this.slide -= dt;
    }
    if (!this.grounded) {
      if (this.coyote > 0) { // a beat of hang time in which a jump still saves you
        this.coyote -= dt;
        if (this.coyote <= 0 && !ghost && seg.overHole(this.s, this.x)) { this.die('fall'); return; }
      } else {
        this.vy -= GRAVITY * dt; this.y += this.vy * dt;
        if (this.y <= 0 && this.vy <= 0) {
          if (!ghost && seg.overHole(this.s, this.x)) { this.die('fall'); return; }
          this.y = 0; this.vy = 0; this.grounded = true;
          monkey.bounce(0.8); Sound.sfx.land(); puff(seg.wx(this.s, this.x), seg.wz(this.s, this.x), 5);
          if (this.slideOnLand) this.startSlide();
          else if (this.jumpBuf > 0) this.jump();
        }
      }
    }
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    this.yaw = dampAngle(this.yaw, seg.yaw, 20, dt);
    this.place();
  },
};

const HINTS = [
  { from: 18, to: 35, text: ['Swipe up to jump', 'Press ↑ to jump'], icon: 'up' },
  { from: 46, to: 63, text: ['Swipe down to slide', 'Press ↓ to slide'], icon: 'down' },
  { from: 73, to: 89, text: ['Swipe right to dodge', 'Press → to dodge'], icon: 'right' },
  { from: 100, to: 127, text: ['Swipe left or right to turn', 'Press ← or → to turn'], icon: 'both' },
];

const Game = {
  state: 'title', time: 0, run: null, death: null, introT: 0, introLen: 1.75, quick: false,
  bGap: 15, bPos: new THREE.Vector3(), bSnap: true, bYaw: 0, camFrom: null, camTo: null, bS0: -31, scared: false, hintOn: -1, skyP: 0, seaK: 0, bubT: 0, homeK: 0,

  blankRun() {
    return { dist: 0, score: 0, nanas: 0, mult: 1, level: 1, speed: 0, slow: 0, danger: 0, invuln: 0, ghost: 0, chain: 0, chainT: 0, pulled: [], turns: 0,
      magnet: 0, dbl: 0, shield: false, shieldT: 0, springs: 0, rocket: 0, max: { magnet: 1, double: 1, shield: 1, springs: 1, rocket: 1 } };
  },
  closeGap() { return Tide.wet ? 3.2 : Cam.portrait ? 4.6 : 4.9; }, // the shark is lower than the boulder, so it comes in closer to be seen

  // ── screens ──
  toTitle() {
    this.state = 'title'; this.run = this.blankRun(); this.death = null;
    this.homeK = 1; this.setScene();
    world.reset((Math.random() * 4294967295) >>> 0, Save.data.runs < 2);
    Player.reset(world.cur);
    Roster.use(runner()); monkey.fresh(); Sound.jet(0);
    monkey.holdBanana(true);
    boulder.group.visible = false; this.bGap = 15;
    Cam.lookAt = null; Cam.fovKick = 0; Cam.snap(Cam.preset('title'));
    Sound.muffle(true); Sound.rumble(0);
    UI.setState('title'); UI.refreshTitle(); UI.hint(null); UI.danger(false);
    this.frameTitle(0, true);
  },
  startIntro(quick) {
    if (this.state !== 'title' && !quick) return;
    Roster.use(runner()); // in case the character screen was showing someone else
    this.run = this.blankRun(); this.death = null;
    this.run.level = world.cur.level; this.run.mult = Math.min(10, this.run.level);
    this.skyP = this.run.level - 1;
    this.state = 'intro'; this.quick = !!quick; this.introT = 0; this.introLen = quick ? 1.0 : 1.8; this.scared = false; this.hintOn = -1;
    monkey.holdBanana(false); monkey.setExpr('normal');
    boulder.group.visible = true; this.bS0 = quick ? -15 : -31; this.bGap = Player.s - this.bS0; this.bSnap = true;
    this.camFrom = quick ? Object.assign(Cam.preset('run'), { a: 1.15, dist: 5.2, height: 2.4 }) : Object.assign({}, Cam.c);
    this.camTo = Cam.preset('run');
    Cam.snap(this.camFrom);
    Sound.startMusic(); Sound.muffle(false); if (Tide.wet) Sound.sfx.shark(); else Sound.sfx.rumbleStart();
    for (const c of world.cur.critters || []) if (c.home) c.flee(this.time); // the seal by the door knows what is coming out of it
    UI.setState('intro'); UI.hud(this.run, true);
    if (!quick) fx.sparkle(Player.wx, 1.6, Player.wz, 8, 0xffe45c);
  },
  restart() { // straight back into a fresh run
    this.homeK = 0; this.setScene();
    world.reset((Math.random() * 4294967295) >>> 0, Save.data.runs < 2);
    Player.reset(world.cur);
    Roster.use(runner()); monkey.fresh(); Sound.jet(0);
    Cam.lookAt = null; Cam.fovKick = 0; UI.hint(null); UI.danger(false);
    this.state = 'title';
    this.startIntro(true);
  },
  // Which level is being played, and so whether everything is under water. Called before the track is built.
  setScene() {
    MAP = MAPS[Save.data.map] ? Save.data.map : 'ruins';
    const sea = atSea();
    this.skyP = 0; this.seaK = sea ? 1 : 0; Tide.flood(sea); sky.setLook(0, Tide.sub, this.homeK); fx.clear();
    shark.group.visible = false; Sound.sea(sea); UI.sea(sea);
  },
  pause() { if (this.state !== 'run' && this.state !== 'count') return; this.state = 'pause'; UI.setState('pause'); UI.stopCount(); Sound.sleep(); },
  resume() {
    if (this.state !== 'pause') return;
    Sound.wake(); this.state = 'count'; UI.setState('count');
    UI.countdown(() => { if (this.state === 'count') { this.state = 'run'; UI.setState('run'); } });
  },
  input(a) {
    if (this.state === 'run' || (this.state === 'intro' && this.introT > (this.quick ? 0.25 : 0.85))) Player.input(a);
  },

  // ── rules ──
  onTurn() {
    const run = this.run, seg = Player.seg; run.turns++;
    if (Player.flying) for (const t of ['L', 'R']) if (seg.kids[t]) world.addSky(seg.kids[t], HJ + 6);
    if (this.hintOn >= 0) { UI.hint(null); this.hintOn = -1; }
    if (seg.level > run.level) { // every corner that starts a new level: faster, tighter, and worth more
      run.level = seg.level; run.mult = Math.min(10, run.level);
      UI.levelUp(run.level); Sound.sfx.level();
    }
  },
  stumble(o) {
    const run = this.run, P = Player;
    if (run.invuln > 0 || run.ghost > 0 || P.flying) return;
    if (run.shield) { this.popShield(); return; }
    if (run.danger > 0 && this.state === 'run') { P.die('flat'); return; }
    run.danger = 5.5; run.slow = 0.45; run.invuln = 0.75; P.stumbleT = 0;
    monkey.setExpr('squint', 0.75); Sound.sfx.stumble(); Cam.kick(0.55); buzz(40);
    puff(P.wx, P.wz, 7);
    if (Tide.wet) Sound.sfx.shark(); // somewhere behind, something has noticed
    if (o && o.skin === 'clam') { Sound.sfx.clam(); fx.bubbles(P.wx, 0.7, P.wz, 8, 1.1); } // it snaps shut in a huff
    else if (o && o.type !== 'pillar') fx.debris(P.wx, 0.1, P.wz, 5, o.type === 'log' ? ENV.wood : 0x9aa3a8);
  },
  hitSolid(o) {
    const run = this.run, P = Player;
    if (run.ghost > 0 || P.flying) return;
    if (run.shield) {
      this.popShield();
      world.smash(P.seg, o); Sound.sfx.smash(); Cam.kick(0.7);
      const ox = o.type === 'beam' ? P.x : laneX(o.lane);
      fx.debris(P.seg.wx(o.s, ox), 0.3, P.seg.wz(o.s, ox), 16, o.type === 'beam' ? ENV.stoneWarm : 0x8fa6b3);
      return;
    }
    P.die('bonk');
  },
  popShield() {
    const run = this.run; run.shield = false; run.shieldT = 0; run.invuln = 0.9; monkey.bubble.visible = false;
    Sound.sfx.pop(); fx.sparkle(Player.wx, Player.y + 0.9, Player.wz, 12, 0xbff3ff);
  },
  take(p) {
    const run = this.run, k = p.kind, T = powerTime(k);
    p.got = true; if (p.sprite) p.sprite.visible = false;
    Sound.sfx.power(); monkey.setExpr('happy', 0.9); fx.sparkle(Player.wx, Player.y + 1, Player.wz, 14, 0xffffff);
    run.max[k] = T; UI.toast(POWERS[k].name);
    if (k === 'magnet') run.magnet = T;
    else if (k === 'double') run.dbl = T;
    else if (k === 'shield') { run.shield = true; run.shieldT = T; monkey.bubble.visible = true; }
    else if (k === 'springs') { run.springs = T; monkey.setSprings(true); }
    else if (k === 'rocket') { run.rocket = T; Player.startFlight(); }
  },
  grab(b) {
    const run = this.run; b.got = true;
    const eff = run.mult * (run.dbl > 0 ? 2 : 1);
    run.nanas++; run.score += 10 * eff;
    run.chain = run.chainT > 0 ? Math.min(run.chain + 1, 10) : 0; run.chainT = 0.55;
    Sound.sfx.banana(run.chain); UI.popBananas();
    fx.sparkle(b.pull >= 0 ? Player.wx : b.wx, b.pull >= 0 ? Player.y + 0.9 : b.y, b.pull >= 0 ? Player.wz : b.wz, 3, 0xfff3a8);
  },
  collect(dt) {
    const run = this.run, P = Player, seg = P.seg, B = seg.bananas, s = P.s;
    while (seg.bI < B.length && B[seg.bI].s < s - 2.5) seg.bI++;
    const reach = run.magnet > 0 ? 9 : 1.2;
    for (let i = seg.bI; i < B.length; i++) {
      const b = B[i];
      if (b.s > s + reach) break;
      if (b.got || b.pull >= 0) continue;
      const ds = b.s - s;
      if (Math.abs(ds) < 0.95 && Math.abs(b.x - P.x) < 0.85 && Math.abs(b.y - (P.y + 0.75)) < 1.15) this.grab(b);
      else if (run.magnet > 0 && ds > -1.5) { b.pull = 0; run.pulled.push(b); }
    }
    for (let i = run.pulled.length - 1; i >= 0; i--) { // bananas flying in to the magnet
      const b = run.pulled[i];
      b.pull += dt * 5.5;
      if (b.pull >= 1) { this.grab(b); run.pulled.splice(i, 1); }
    }
    for (const p of seg.pickups) if (!p.got && Math.abs(p.s - s) < 1.15 && Math.abs(p.x - P.x) < 0.95 && P.y < 2.4) this.take(p);
  },

  // ── per-frame ──
  updateRun(dt) {
    const run = this.run, P = Player;
    if (run.slow > 0) run.slow -= dt;
    run.speed = damp(run.speed, levelSpeed(run.level) * (run.slow > 0 ? 0.62 : 1) * (P.flying ? 1.3 : 1), 5, dt);
    P.update(dt);
    if (P.dead) return;
    run.dist += run.speed * dt;
    run.score += run.speed * dt * run.mult * (run.dbl > 0 ? 2 : 1);
    if (run.danger > 0) run.danger -= dt;
    if (run.invuln > 0) run.invuln -= dt;
    if (run.chainT > 0) run.chainT -= dt;
    if (run.magnet > 0) { run.magnet -= dt; if (run.magnet <= 0) Sound.sfx.powerEnd(); }
    if (run.dbl > 0) { run.dbl -= dt; if (run.dbl <= 0) Sound.sfx.powerEnd(); }
    if (run.springs > 0) { run.springs -= dt; if (run.springs <= 0) { monkey.setSprings(false); Sound.sfx.powerEnd(); } }
    if (run.shield) {
      run.shieldT -= dt;
      if (run.shieldT <= 0) { run.shield = false; monkey.bubble.visible = false; Sound.sfx.powerEnd(); }
      else monkey.bubble.visible = run.shieldT > 2 || Math.floor(run.shieldT * 8) % 2 === 0; // flickers before it goes
    }
    if (P.flying) run.rocket -= dt;
    if (run.ghost > 0) run.ghost -= dt;
    if (P.stumbleT >= 0) { P.stumbleT += dt / 0.55; if (P.stumbleT >= 1) P.stumbleT = -1; }
    this.collect(dt);

    // on-screen coaching for the first couple of runs
    if (P.seg.first && Save.data.runs < 2) {
      let h = -1;
      for (let i = 0; i < HINTS.length; i++) if (P.s >= HINTS[i].from && P.s <= HINTS[i].to) h = i;
      if (h !== this.hintOn) { this.hintOn = h; UI.hint(h < 0 ? null : HINTS[h]); }
    } else if (this.hintOn >= 0) { this.hintOn = -1; UI.hint(null); }

    if (P.grounded && P.slide <= 0 && !P.flying) { // soft plush footsteps, or the swish of each stroke
      const ph = Math.floor(monkey.phase / Math.PI);
      if (ph !== P.stepPh) { P.stepPh = ph; if (monkey.swims) Sound.sfx.swish(ph & 1); else Sound.sfx.step(ph & 1); }
    }
    Sound.tempo(114 + (run.speed - SPEED_MIN) * 1.3);
    Cam.fovKick = REDUCED ? 0 : (run.speed - SPEED_MIN) * 0.42 + (P.flying ? 4 : 0);
    Sound.jet(P.flying ? 0.5 : 0);
    if (P.flying) { // exhaust
      const d = P.seg.dir, back = run.speed - 7; // flames trail a little way behind him, not all the way to the camera
      for (let i = 0; i < 2; i++) {
        monkey.nozzles[i].getWorldPosition(_look);
        if (Tide.wet) { if (Math.random() < 0.4) fx.bubbles(_look.x, _look.y, _look.z, 1, 0.25, 0.6); } // under water the rocket leaves a wake of bubbles
        else fx.spawn(_look.x, _look.y, _look.z, d.fx * back + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, d.fz * back + (Math.random() - 0.5) * 1.2, Math.random() < 0.5 ? 0xff8a1f : 0xffe066, 0.3, 0.12 + Math.random() * 0.08, 0, -0.8, 0, 0.95);
      }
    }
    this.bGap = damp(this.bGap, run.danger > 0 ? this.closeGap() : 15, run.danger > 0 ? 7 : 1.1, dt);
    UI.danger(run.danger > 0);
  },

  updateIntro(dt) {
    const run = this.run, P = Player, q = this.quick, T = this.introLen;
    const t = (this.introT += dt), go = q ? 0 : 0.62;
    if (t < go) {
      if (!this.scared && t > 0.14) { this.scared = true; monkey.setExpr('wide', 1.1); monkey.bounce(1.28); buzz(30); }
    } else {
      run.speed = SPEED_MIN * smooth((t - go) / 0.45);
      P.update(dt);
      run.dist += run.speed * dt;
    }
    const u = easeInOut(clamp(t / T, 0, 1));
    this.bGap = P.s - lerp(this.bS0, P.s - this.closeGap(), u);
    const cu = easeInOut(clamp((t - (q ? 0 : 0.3)) / (T - (q ? 0 : 0.3)), 0, 1));
    for (const k in this.camTo) { Cam.c[k] = lerp(this.camFrom[k], this.camTo[k], cu); Cam.t[k] = Cam.c[k]; }
    Cam.c.ahead = Cam.t.ahead = this.camTo.ahead * cu * cu * cu; // keep him in frame while the camera swings round
    Cam.kick(0.12);
    if (t >= T && !P.dead) { this.state = 'run'; run.danger = 1.5; UI.setState('run'); UI.levelUp(run.level); }
  },

  kill(type) {
    const P = Player;
    if (Tide.wet) type = type === 'fall' ? 'sink' : type === 'flat' ? 'boop' : type; // under water the same mistakes end differently
    this.state = 'dying'; UI.setState('dying'); UI.hint(null); UI.danger(false); Sound.jet(0);
    this.death = { type, t: 0, s0: P.s, y0: Math.max(0, P.y), landed: false, drop: false, splashed: false, ts: 0, squashed: false, tq: 0 };
    P.slide = 0; P.stumbleT = -1; this.hintOn = -1;
    Sound.muffle(true); Cam.fovKick = 0;
    if (type === 'bonk') {
      Sound.sfx.bonk(); Cam.kick(1.1); monkey.setExpr('x'); monkey.bounce(0.6); buzz(90);
      fx.sparkle(P.wx, P.y + 1.3, P.wz, 10, 0xffe45c);
      Cam.to(Cam.preset('down'), 2.6);
    } else if (type === 'fall' || type === 'sink') {
      monkey.setExpr('wide'); P.vy = 0;
      Cam.to(Object.assign(Cam.preset('down'), { a: 0.3, height: 3.6, dist: 5.4 }), 3);
    } else { monkey.setExpr('wide'); Cam.to(Cam.preset('down'), 2.6); }
  },
  updateDying(dt) {
    const d = this.death, P = Player, run = this.run, t = (d.t += dt);
    let mode = 'run';
    if (d.type !== 'flat' && d.type !== 'boop') this.bGap = damp(this.bGap, 16, 4, dt); // whatever was chasing him drops back out of the picture
    if (d.type === 'bonk') { // bounce back off it and land flat on his back
      const u = clamp(t / 0.6, 0, 1);
      P.s = d.s0 - 2.4 * easeOut(u);
      P.y = d.y0 * (1 - u) + Math.sin(Math.PI * u) * 0.85;
      if (u >= 1 && !d.landed) { d.landed = true; P.y = 0; monkey.bounce(0.72); monkey.stars.visible = true; fx.dust(P.wx, 0, P.wz, 8); Sound.sfx.land(); }
      mode = 'bonk';
      if (t > 1.75) this.over();
    } else if (d.type === 'fall') { // hang in the air for a beat, then drop
      if (t < 0.34) P.s += run.speed * Math.max(0, 0.3 - t) * dt;
      else {
        if (!d.drop) { d.drop = true; Sound.sfx.whistle(); }
        P.vy -= GRAVITY * 0.75 * dt; P.y += P.vy * dt;
      }
      mode = 'fall';
      if (!d.splashed && P.y < WATER_Y + 0.3) { d.splashed = true; d.ts = t; fx.splash(P.wx, P.wz); Sound.sfx.splash(); monkey.root.visible = false; }
      if (d.splashed && t > d.ts + 0.95) this.over();
      Cam.lookAt = _look.set(P.wx, Math.max(P.y, WATER_Y) + 0.6, P.wz);
    } else if (d.type === 'sink') { // under water he drifts down to the sea bed instead of dropping
      if (t < 0.34) P.s += run.speed * Math.max(0, 0.3 - t) * dt;
      else if (!d.landed) {
        if (!d.drop) { d.drop = true; Sound.sfx.bloop(); }
        P.vy = Math.max(P.vy - GRAVITY * 0.3 * dt, -6); P.y += P.vy * dt;
        if (Math.random() < dt * 26) fx.bubbles(P.wx, Math.min(0.4, P.y + 1), P.wz, 1, 0.5);
        if (P.y < WATER_Y + 0.1) { d.landed = true; P.y = WATER_Y + 0.1; monkey.setExpr('x'); fx.dust(P.wx, WATER_Y + 0.1, P.wz, 12, 0xe9dcb0); }
      }
      if (t > 2.0) this.over();
      mode = d.landed ? 'bonk' : 'fall';
      Cam.lookAt = _look.set(P.wx, Math.max(P.y, WATER_Y) + 0.6, P.wz);
    } else if (d.type === 'boop') { // the shark noses him clean off his feet
      const reach = 1.8;
      if (!d.squashed) {
        this.bGap = Math.max(reach, this.bGap - 19 * dt);
        run.speed = damp(run.speed, 0, 6, dt); P.s += run.speed * dt;
        if (this.bGap <= reach + 0.01) {
          const seg = P.seg, next = seg.obstacles.find((o) => !o.gone && o.s1 > P.s), pit = seg.holes.find((h) => h.s1 > P.s);
          d.fly = clamp(Math.min(next ? next.s0 - P.s - 1.3 : 9, pit ? pit.s0 - P.s - 1 : 9, seg.len + HJ - 1.4 - P.s), 0.6, 7.5); // room to land in
          d.squashed = true; d.tq = t; d.s1 = P.s; Sound.sfx.boop(); Cam.kick(1.1); monkey.setExpr('x'); buzz(110); fx.bubbles(P.wx, 0.9, P.wz, 16, 1.3);
        }
      } else {
        const u = clamp((t - d.tq) / 0.95, 0, 1);
        P.s = d.s1 + d.fly * easeOut(u); P.y = Math.sin(Math.PI * u) * 2.7; // up and over in a slow arc, then down on his back
        this.bGap = damp(this.bGap + (P.s - (d.sp === undefined ? d.s1 : d.sp)), 3.1, 2.6, dt); d.sp = P.s; // the shark noses after him and hovers there, wriggling with glee
        if (u >= 1 && !d.landed) { d.landed = true; P.y = 0; monkey.bounce(0.72); monkey.stars.visible = true; fx.dust(P.wx, 0, P.wz, 8); Sound.sfx.land(); }
        if (t > d.tq + 2.1) this.over();
      }
      mode = !d.squashed ? 'run' : d.landed ? 'bonk' : 'fall';
    } else { // the boulder catches him
      this.bGap = Math.max(-22, this.bGap - (d.squashed ? 12 : 17) * dt);
      run.speed = damp(run.speed, 0, 9, dt); P.s += run.speed * dt;
      if (!d.squashed && this.bGap < 0.95) {
        d.squashed = true; d.tq = t; Sound.sfx.splat(); Cam.kick(1.3); monkey.setExpr('x'); buzz(120); fx.dust(P.wx, 0, P.wz, 14);
      }
      if (d.squashed) { monkey.flat = Math.min(1, monkey.flat + dt * 16); if (t > d.tq + 0.7) monkey.stars.visible = true; }
      mode = d.squashed ? 'flat' : 'run';
      if (d.squashed && t > d.tq + 1.45) this.over();
    }
    P.place();
    return mode;
  },
  over() {
    if (this.state === 'over') return;
    this.state = 'over';
    const run = this.run, d = Save.data, score = Math.floor(run.score), best = score > d.best && score > 0;
    if (best) d.best = score;
    d.wallet += run.nanas; d.runs++; Save.store();
    Sound.rumble(0);
    if (best) Sound.sfx.best();
    UI.showOver(this.death.type, score, run, best);
  },

  placeBoulder(dt) {
    const P = Player;
    let seg = P.seg, sB = P.s - this.bGap, x = P.x * 0.5;
    if (!seg.first && sB < 0 && world.prev && !world.prev.dead) { seg = world.prev; sB = seg.len + sB; x = 0; }
    const tx = seg.wx(sB, x), tz = seg.wz(sB, x), b = this.bPos;
    if (this.bSnap) { b.set(tx, 0, tz); this.bSnap = false; this.bYaw = seg.yaw; }
    const ox = b.x, oz = b.z;
    b.x = damp(b.x, tx, 16, dt); b.z = damp(b.z, tz, 16, dt);
    this.bYaw = dampAngle(this.bYaw, seg.yaw, 8, dt);
    const moved = Math.hypot(b.x - ox, b.z - oz), shown = this.bGap < 13.5 && this.state !== 'title';
    // On land a boulder rolls after him. Under water a shark takes over (if one is in sight at the time, they swap in a blink).
    const k = this.seaK = damp(this.seaK, Tide.wet ? 1 : 0, 10, dt);
    boulder.group.position.set(b.x, 0, b.z); boulder.group.rotation.y = this.bYaw;
    boulder.roll(moved);
    boulder.group.visible = shown && k < 0.97; boulder.group.scale.setScalar(Math.max(0.01, 1 - k));
    shark.group.position.set(b.x, 0, b.z); shark.group.rotation.y = this.bYaw;
    shark.group.visible = shown && k > 0.03; shark.group.scale.setScalar(Math.max(0.01, k));
    if (shark.group.visible) shark.update(dt, this.time, dt > 0 ? moved / dt : 0, this.death && this.death.type === 'boop' && this.death.squashed ? 1 : 0);
    const near = clamp((13 - Math.abs(this.bGap)) / 9, 0, 1);
    Sound.rumble(this.state === 'over' || this.state === 'title' ? 0 : near * 0.55);
    if (near > 0.55 && (this.state === 'run' || this.state === 'intro')) Cam.kick(0.07 + (near - 0.55) * 0.2);
  },

  frameTitle(dt, hard) {
    monkey.root.position.set(Player.wx, 0, Player.wz); monkey.root.rotation.y = Player.yaw;
    monkey.shadow.position.set(Player.wx, 0.03, Player.wz); monkey.shadow.scale.set(1.25, 1, 1.25); monkey.shadow.visible = true;
    monkey.update(dt, { mode: 'idle', time: this.time, t: this.time });
    if (dt > 0 && Math.random() < dt * 2.2) { // the Golden Banana twinkles
      monkey.held.getWorldPosition(_look);
      fx.sparkle(_look.x + (Math.random() - 0.5) * 0.4, _look.y + (Math.random() - 0.5) * 0.4, _look.z, 1, 0xfff6c0);
    }
    Cam.update(dt, Player.wx, 0, Player.wz, Player.yaw, hard);
  },

  // One step of the whole game. Rendering happens outside, so this can also run headless for testing.
  update(dt) {
    this.time += dt;
    const st = this.state, P = Player, run = this.run;
    if (st === 'pause' || st === 'count') return;
    if (st === 'title') { this.frameTitle(dt, false); world.update(dt, this.time, P.wx, 0, P.wz); fx.update(dt, this.pScale()); this.updateSea(dt); sky.update(dt, this.time, camera, Tide.y); return; }

    let mode = 'run';
    if (st === 'intro') { this.updateIntro(dt); mode = this.introT < (this.quick ? 0 : 0.62) ? 'scare' : 'run'; }
    else if (st === 'run') this.updateRun(dt);
    if (this.state === 'dying') mode = this.updateDying(dt);
    else if (this.state === 'over') mode = this.death.type === 'fall' ? 'fall' : this.death.type === 'flat' ? 'flat' : 'bonk';
    if ((this.state === 'run' || this.state === 'intro') && mode === 'run') mode = P.flying ? 'fly' : P.grounded || P.coyote > 0 ? (P.slide > 0 ? 'slide' : 'run') : 'air';

    // Monkey Jones
    monkey.root.position.set(P.wx, P.y, P.wz); monkey.root.rotation.y = P.yaw;
    const onFloor = P.y > -0.1 && !P.seg.overHole(P.s, P.x);
    monkey.shadow.visible = onFloor && monkey.root.visible;
    if (onFloor) { const k = clamp(1.25 - P.y * 0.28, 0.5, 1.25) * (monkey.flat > 0 ? 1 + monkey.flat * 0.6 : 1); monkey.shadow.position.set(P.wx, 0.03, P.wz); monkey.shadow.scale.set(k, 1, k); }
    monkey.update(dt, {
      mode, time: this.time, t: this.death ? this.death.t : 0, vy: P.vy, lean: P.lean,
      speedK: clamp((run.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1),
      panic: this.bGap < 8 && (this.state === 'run' || this.state === 'intro'), stumble: P.stumbleT,
    });

    this.placeBoulder(dt);
    world.update(dt, this.time, P.wx, P.y, P.wz);
    fx.update(dt, this.pScale());
    const camY = this.state === 'dying' && this.death.type === 'fall' ? 0 : P.flying ? P.y * 0.4 : Math.max(0, P.y) * 0.35;
    Cam.update(dt, P.seg.wx(P.s, P.x * 0.7), camY, P.seg.wz(P.s, P.x * 0.7), P.seg.yaw, false);
    this.updateSea(dt);
    sky.update(dt, this.time, camera, Tide.y);
    UI.hud(run, false);
  },
  // The tide, the time of day, and everything that changes when the water closes overhead.
  updateSea(dt) {
    const want = this.run.level - 1; // the hour moves on with every level
    if (this.skyP < want) this.skyP = Math.min(want, this.skyP + dt / 5);
    const ev = Tide.update(dt, camera.position.y);
    if (ev) {
      const under = ev === 'under', c = camera.position;
      UI.plunge(sky.dim); UI.sea(under); Sound.sea(under); Sound.sfx.plunge(under);
      if (under) fx.bubbles(c.x, c.y - 1, c.z, 22, 7);
    }
    this.homeK = damp(this.homeK, this.state === 'title' ? 1 : 0, 2.4, dt); // on the home screen the haze sits close; it opens out as he sets off
    sky.setLook(this.skyP, Tide.sub, this.homeK);
    if (Tide.under && this.state !== 'over') { // bubbles drifting up all around, and a trail from his nose
      const P = Player, d = P.seg.dir;
      this.bubT -= dt;
      if (this.bubT <= 0) {
        this.bubT = 0.07;
        const a = this.state === 'title' ? (Math.random() - 0.3) * 9 : 4 + Math.random() * 24, b = (Math.random() - 0.5) * 17;
        fx.bubbles(P.wx + d.fx * a + d.rx * b, Math.random() * 3.2, P.wz + d.fz * a + d.rz * b, 1, 0.2);
        if (Math.random() < 0.5 && monkey.root.visible) { monkey.head.getWorldPosition(_nose); fx.bubbles(_nose.x, _nose.y + 0.1, _nose.z, 1, 0.12, 0.55); }
      }
      if (Math.random() < dt * (this.state === 'title' ? 0.4 : 1.2)) Sound.sfx.bloop();
    }
  },
  pScale() { return renderer ? renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360)) : 400; },
};
