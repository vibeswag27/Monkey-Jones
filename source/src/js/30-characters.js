// ───────────────────────── the cast ─────────────────────────
// Every character is modelled on its plush and shares one skeleton, so they all run, jump, slide and fly the same way.
const HIP_Y = 0.5;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

const CHARS = {
  monkey: { name: 'Monkey Jones', blurb: 'The original banana thief', cost: 0, kind: 'monkey', marks: true,
    pal: { body: 0xf38f70, face: 0xfff0dc, ear: 0xf9c6bb, top: 0xf2622e, top2: 0xf8823f, paw: 0xfff0dc, ink: 0x2a140c } },
  smokey: { name: 'Strongkey', blurb: 'The strongest monkey in the ruins', cost: 300, kind: 'monkey', marks: true, belly: true,
    pal: { body: 0x727b88, face: 0xc8cdd6, ear: 0xbcc2cc, top: 0x393d45, top2: 0x4b505a, paw: 0xc8cdd6, ink: 0x1d2026 } },
  pig: { name: 'Piggie', blurb: 'Small snout, big appetite', cost: 600, kind: 'pig',
    pal: { body: 0xf9cfd2, face: 0xf3a5ac, ear: 0xf3a5ac, top: 0xee8d8f, top2: 0xee8d8f, paw: 0xf3a5ac, ink: 0x9a4a56 } },
  elephant: { name: 'Ellie', blurb: 'Never forgets a shortcut', cost: 1000, kind: 'elephant',
    pal: { body: 0xa6cef1, face: 0xc8e3f9, ear: 0xc8e3f9, top: 0x86b8e6, top2: 0x86b8e6, paw: 0x8dbde9, ink: 0x2d4a66 } },
  dino: { name: 'Herbie', blurb: 'Herbivore. Mostly bananas.', cost: 1500, kind: 'dino', marks: true, stiffTop: true,
    pal: { body: 0xf6efa8, face: 0xf6efa8, ear: 0x86c5ae, top: 0x86c5ae, top2: 0x6db59c, paw: 0xeee18c, ink: 0x4d4722 } },
  // sea: true = lives in High Tide and nowhere else. These two swim (SeaCharacter, further down) instead of running.
  seal: { name: 'Sealie', blurb: 'Naps anywhere, swims everywhere', cost: 800, kind: 'seal', sea: true },
  orca: { name: 'Orkie', blurb: 'Small whale, big splash', cost: 1200, kind: 'orca', sea: true },
};
const CHAR_ORDER = ['monkey', 'smokey', 'pig', 'elephant', 'dino', 'seal', 'orca'];
// Testing: the characters named here can be played without being bought (nothing is spent, nothing is marked as bought).
// Empty the list to put their prices back; whatever was really bought is kept.
let FREE_CAST = ['seal', 'orca'];

// Each head builder adds its shapes and says where the eyes go.
const HEADS = {
  monkey(gb, p) { // cream mask and big muzzle, round ears with a lighter inside
    gb.add(SHAPE.sphHi, M(0, 0, 0, 0.92, 0.84, 0.86), p.body);
    gb.add(SHAPE.sph, M(-0.14, 0.075, -0.305, 0.37, 0.35, 0.22), p.face);
    gb.add(SHAPE.sph, M(0.14, 0.075, -0.305, 0.37, 0.35, 0.22), p.face);
    gb.add(SHAPE.sphHi, M(0, -0.14, -0.32, 0.6, 0.42, 0.44), p.face);
    for (const sx of [-1, 1]) {
      gb.add(SHAPE.sph, M(sx * 0.47, 0.04, 0.02, 0.46, 0.46, 0.17), p.body);
      gb.add(SHAPE.sph, M(sx * 0.478, 0.04, -0.04, 0.31, 0.31, 0.12), p.ear);
      gb.add(SHAPE.sphLo, M(sx * 0.042, -0.062, -0.526, 0.026, 0.052, 0.02, 0, 0, sx * 0.5), p.ink);
    }
    return { x: 0.15, y: 0.085, z: -0.408, r: 0.033 };
  },
  pig(gb, p) { // flat oval snout, pointed ears that tip forward
    gb.add(SHAPE.sphHi, M(0, 0, 0, 0.92, 0.84, 0.86), p.body);
    gb.add(SHAPE.sphHi, M(0, -0.1, -0.36, 0.42, 0.31, 0.34), p.face);
    gb.add(SHAPE.cyl12, M(0, -0.1, -0.5, 0.36, 0.08, 0.25, Math.PI / 2, 0, 0), p.face);
    for (const sx of [-1, 1]) {
      gb.add(SHAPE.sphLo, M(sx * 0.07, -0.09, -0.545, 0.04, 0.09, 0.03), p.ink);
      _v.set(sx * 0.42, 0.9, -0.25).normalize();
      gb.add(SHAPE.coneS, Mdir(sx * 0.27, 0.27, -0.02, _v, 0.3, 0.34, 0.13), p.body);
      gb.add(SHAPE.coneS, Mdir(sx * 0.275, 0.29, -0.06, _v, 0.2, 0.25, 0.08), p.ear);
    }
    return { x: 0.2, y: 0.09, z: -0.375, r: 0.031 };
  },
  elephant(gb, p) { // huge round ears and a stubby trunk that curls up
    gb.add(SHAPE.sphHi, M(0, 0, 0, 0.9, 0.84, 0.86), p.body);
    for (const sx of [-1, 1]) {
      gb.add(SHAPE.sph, M(sx * 0.6, 0.12, 0.05, 0.66, 0.7, 0.15, 0, sx * 0.32, 0), p.body);
      gb.add(SHAPE.sph, M(sx * 0.615, 0.12, 0.0, 0.5, 0.54, 0.11, 0, sx * 0.32, 0), p.ear);
    }
    gb.add(taperTube([v3(0, -0.08, -0.3), v3(0, -0.21, -0.5), v3(0, -0.23, -0.68), v3(0, -0.13, -0.8), v3(0, -0.01, -0.82)], 14, 0.15, 0.085, 9), IDENT, p.body);
    gb.add(SHAPE.sph, M(0, -0.01, -0.82, 0.17, 0.1, 0.17), p.top);
    gb.add(SHAPE.sph, M(0, -0.08, -0.3, 0.34, 0.34, 0.3), p.body);
    return { x: 0.22, y: 0.14, z: -0.35, r: 0.031 };
  },
  dino(gb, p) { // long rounded snout with nostrils right at the front
    gb.add(SHAPE.sphHi, M(0, 0.02, 0.02, 0.86, 0.76, 0.84), p.body);
    gb.add(SHAPE.sphHi, M(0, -0.07, -0.3, 0.72, 0.58, 0.7), p.body);
    for (const sx of [-1, 1]) gb.add(SHAPE.sphLo, M(sx * 0.1, 0.02, -0.635, 0.04, 0.04, 0.03), p.ink);
    return { x: 0.22, y: 0.21, z: -0.3, r: 0.031 };
  },
};
// Whatever sits on top of the head and bobs about: a tuft, or spikes.
const TOPS = {
  monkey(gb, p) {
    gb.add(SHAPE.sph, M(0, 0.02, 0, 0.28, 0.2, 0.28), p.top);
    const spikes = [[0, 0]];
    for (let i = 0; i < 6; i++) spikes.push([0.48, (i / 6) * TAU + 0.3]);
    for (let i = 0; i < 9; i++) spikes.push([1.0, (i / 9) * TAU]);
    spikes.forEach(([th, ph], i) => {
      _v.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      gb.add(SHAPE.coneS, Mdir(0, 0.02, 0, _v, 0.12, 0.34 - th * 0.1), i % 2 ? p.top : p.top2);
    });
  },
  dino(gb, p) {
    const plates = [[-0.2, 0.2, -0.25], [-0.03, 0.27, 0], [0.16, 0.24, 0.2], [0.33, 0.18, 0.5]];
    plates.forEach(([z, h, tilt], i) => { _v.set(0, Math.cos(tilt), Math.sin(tilt)); gb.add(SHAPE.coneS, Mdir(0, -0.06 - Math.abs(z) * 0.12, z, _v, 0.11, h + 0.06, 0.24), i % 2 ? p.top : p.top2); });
  },
};
const TAILS = {
  monkey(gb, p) { // runs back, sweeps up and hooks over at the tip
    const c = new THREE.CatmullRomCurve3([v3(0, 0, 0), v3(0, 0, 0.18), v3(0, 0.14, 0.4), v3(0, 0.4, 0.5), v3(0, 0.62, 0.42), v3(0, 0.69, 0.25), v3(0, 0.57, 0.15), v3(0, 0.46, 0.22)]);
    gb.add(softG(new THREE.TubeGeometry(c, 22, 0.052, 7, false)), IDENT, p.body);
    gb.add(SHAPE.sph, M(0, 0.46, 0.22, 0.118, 0.118, 0.118), p.body);
  },
  pig(gb, p) { // a tight little corkscrew
    const pts = [];
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU * 1.6; pts.push(v3(Math.sin(a) * 0.075, 0.12 + Math.cos(a) * 0.075 - 0.075, 0.02 + i * 0.016)); }
    gb.add(softG(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, 0.036, 6, false)), IDENT, p.top);
    const e = pts[pts.length - 1]; gb.add(SHAPE.sphLo, M(e.x, e.y, e.z, 0.08, 0.08, 0.08), p.top);
  },
  elephant(gb, p) { // thin, with a tassel
    gb.add(taperTube([v3(0, 0.02, 0), v3(0, -0.02, 0.14), v3(0, -0.12, 0.24), v3(0, -0.24, 0.27)], 8, 0.04, 0.03, 6), IDENT, p.body);
    gb.add(SHAPE.sph, M(0, -0.27, 0.27, 0.11, 0.14, 0.11), p.top);
  },
  dino(gb, p) { // thick, tapering, with plates along the top
    gb.add(taperTube([v3(0, 0.02, -0.08), v3(0, -0.02, 0.2), v3(0, 0.0, 0.46), v3(0, 0.08, 0.7), v3(0, 0.2, 0.9)], 14, 0.24, 0.035, 9), IDENT, p.body);
    [[0.14, 0.2, 0.2], [0.36, 0.16, 0.16], [0.56, 0.12, 0.13]].forEach(([z, h, w], i) => { _v.set(0, 0.94, 0.34).normalize(); gb.add(SHAPE.coneS, Mdir(0, 0.13 - z * 0.08 + (z > 0.4 ? (z - 0.4) * 0.3 : 0), z, _v, 0.09, h, w), i % 2 ? p.top2 : p.top); });
  },
};

class Character {
  constructor(id) {
    const spec = this.spec = CHARS[id], p = spec.pal;
    this.id = id;
    const root = this.root = new THREE.Group();
    const sq = this.sq = new THREE.Group(); root.add(sq);
    const body = this.body = new THREE.Group(); body.position.y = HIP_Y; sq.add(body);

    // torso
    let gb = new GeoBuilder();
    gb.add(SHAPE.sphHi, M(0, 0.2, 0, 0.64, 0.76, 0.58), p.body);
    if (spec.belly) gb.add(SHAPE.sphHi, M(0, 0.16, -0.075, 0.5, 0.6, 0.48), p.face);
    if (spec.kind === 'dino') { _v.set(0, 0.6, 0.8).normalize(); gb.add(SHAPE.coneS, Mdir(0, 0.44, 0.2, _v, 0.1, 0.2, 0.2), p.top); }
    body.add(toonPart(gb));

    // head
    const head = this.head = new THREE.Group(); head.position.set(0, 0.66, -0.02); body.add(head);
    gb = new GeoBuilder();
    const E = HEADS[spec.kind](gb, p);
    head.add(toonPart(gb));

    // tuft / spikes
    const tuft = this.tuft = new THREE.Group(); tuft.position.set(0, 0.37, 0.02); head.add(tuft);
    if (TOPS[spec.kind]) { gb = new GeoBuilder(); TOPS[spec.kind](gb, p); tuft.add(toonPart(gb, 0.02)); }

    // eyes: a few swappable expressions
    this.eyes = {}; this.eyeballs = [];
    const eyeGeo = new THREE.SphereGeometry(E.r, 12, 8), barGeo = new THREE.BoxGeometry(0.12, 0.032, 0.03);
    const EX = E.x, EY = E.y, EZ = E.z;
    let g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, MAT.eye); e.position.set(sx * EX, EY, EZ); g.add(e); this.eyeballs.push(e);
      const hl = new THREE.Mesh(eyeGeo, MAT.white); hl.scale.setScalar(0.3); hl.position.set(sx * EX - 0.013, EY + 0.016, EZ - 0.028); g.add(hl);
    }
    this.eyes.normal = g;
    g = new THREE.Group(); // wide: scared
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(eyeGeo, MAT.white); w.scale.set(2.0, 2.2, 0.7); w.position.set(sx * EX, EY + 0.01, EZ + 0.004); g.add(w);
      const e = new THREE.Mesh(eyeGeo, MAT.eye); e.scale.setScalar(0.85); e.position.set(sx * EX, EY + 0.01, EZ - 0.02); g.add(e);
    }
    this.eyes.wide = g;
    g = new THREE.Group(); // X X: knocked out
    for (const sx of [-1, 1]) for (const r of [-1, 1]) { const b = new THREE.Mesh(barGeo, MAT.eye); b.position.set(sx * EX, EY, EZ - 0.012); b.rotation.z = r * 0.78; g.add(b); }
    this.eyes.x = g;
    g = new THREE.Group(); // > < : ouch
    for (const sx of [-1, 1]) for (const r of [-1, 1]) { const b = new THREE.Mesh(barGeo, MAT.eye); b.scale.x = 0.8; b.position.set(sx * EX, EY + r * 0.03, EZ - 0.012); b.rotation.z = -sx * r * 0.55; g.add(b); }
    this.eyes.squint = g;
    g = new THREE.Group(); // ^ ^ : happy
    for (const sx of [-1, 1]) for (const r of [-1, 1]) { const b = new THREE.Mesh(barGeo, MAT.eye); b.scale.x = 0.7; b.position.set(sx * EX + r * 0.03, EY, EZ - 0.012); b.rotation.z = -r * 0.75; g.add(b); }
    this.eyes.happy = g;
    for (const k in this.eyes) { this.eyes[k].visible = k === 'normal'; head.add(this.eyes[k]); }
    this.expr = 'normal'; this.exprT = 0; this.blinkT = 2.5;

    // arms & legs
    const armGeo = capsuleGeo(0.088, 0.3, 10), legGeo = capsuleGeo(0.105, 0.2, 10);
    const mkArm = (sx) => {
      const a = new THREE.Group(); a.position.set(sx * 0.31, 0.44, 0);
      const b = new GeoBuilder();
      b.add(armGeo, M(0, -0.2, 0, 1, 1, 1), p.body);
      b.add(SHAPE.sph, M(0, -0.43, 0, 0.23, 0.22, 0.23), p.paw);
      if (spec.marks) for (const k of [-1, 1]) b.add(SHAPE.sphLo, M(k * 0.04, -0.47, -0.1, 0.014, 0.075, 0.02), p.ink);
      a.add(toonPart(b)); body.add(a);
      return a;
    };
    const mkLeg = (sx) => {
      const l = new THREE.Group(); l.position.set(sx * 0.17, 0.02, 0);
      const b = new GeoBuilder();
      b.add(legGeo, M(0, -0.2, 0, 1, 1, 1), p.body);
      b.add(SHAPE.sph, M(0, -0.43, -0.06, 0.24, 0.17, 0.36), p.paw);
      l.add(toonPart(b)); body.add(l);
      return l;
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    this.legL = mkLeg(-1); this.legR = mkLeg(1);

    // tail
    const tail = this.tail = new THREE.Group(); tail.position.set(0, spec.kind === 'pig' ? 0.1 : 0, 0.25); body.add(tail);
    gb = new GeoBuilder(); TAILS[spec.kind](gb, p);
    tail.add(toonPart(gb, 0.02));

    // the Golden Banana: slung on the back during a run, held up on the title screen
    gb = new GeoBuilder();
    gb.add(GEO.banana, M(0, 0, 0, 1.05, 1.05, 1.05), 0xffffff);
    const pack = this.pack = toonPart(gb, 0.022, MAT.gold);
    pack.position.set(0.03, 0.3, 0.32); pack.rotation.set(0.1, 0, -0.95);
    body.add(pack);
    const strapTilt = this.strap = new THREE.Group(); strapTilt.rotation.z = 0.7; strapTilt.position.set(0, 0.2, 0);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.026, 6, 22), new THREE.MeshToonMaterial({ color: 0x8a4b2a, gradientMap: GRAD_CHAR }));
    strap.rotation.set(0, Math.PI / 2, 0); strap.scale.set(0.92, 1.12, 1);
    strapTilt.add(strap); body.add(strapTilt);
    gb = new GeoBuilder();
    gb.add(GEO.banana, M(0, 0, 0, 1.0, 1.0, 1.0), 0xffffff);
    const held = this.held = toonPart(gb, 0.022, MAT.gold);
    held.position.set(0, -0.62, 0); held.rotation.set(0, Math.PI / 2, Math.PI / 2 + 0.15);
    this.armR.add(held);
    held.visible = false;

    // coconut rocket: two coconuts on the back, nozzles pointing down the legs
    const jet = this.jet = new THREE.Group(); jet.visible = false; body.add(jet);
    gb = new GeoBuilder();
    for (const sx of [-1, 1]) {
      gb.add(SHAPE.sph, M(sx * 0.15, 0.3, 0.36, 0.3, 0.36, 0.3), 0x8a5a33);
      gb.add(SHAPE.sph, M(sx * 0.15, 0.46, 0.36, 0.2, 0.1, 0.2), 0xb07a48);
      gb.add(SHAPE.coneS, M(sx * 0.15, 0.08, 0.36, 0.2, 0.16, 0.2), 0x4a3526);
    }
    gb.add(SHAPE.box, M(0, 0.3, 0.3, 0.5, 0.07, 0.07), 0x8a4b2a);
    jet.add(toonPart(gb, 0.022));
    this.nozzles = [new THREE.Object3D(), new THREE.Object3D()];
    this.nozzles[0].position.set(-0.15, 0.0, 0.36); this.nozzles[1].position.set(0.15, 0.0, 0.36);
    jet.add(this.nozzles[0], this.nozzles[1]);

    // super springs: bright coils round the ankles
    this.coils = [];
    const coilGeo = new THREE.TorusGeometry(0.125, 0.03, 6, 14).rotateX(Math.PI / 2), coilMat = new THREE.MeshToonMaterial({ color: 0x7ce04a, gradientMap: GRAD_CHAR, emissive: 0x1d4a08 });
    for (const leg of [this.legL, this.legR]) {
      const c = new THREE.Group(); c.visible = false;
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(coilGeo, coilMat); ring.position.set(0, -0.2 - i * 0.075, 0); ring.rotation.z = i % 2 ? 0.16 : -0.16;
        const ink = new THREE.Mesh(coilGeo, MAT.ink); ink.scale.set(1.14, 1.5, 1.14); ring.add(ink);
        c.add(ring);
      }
      leg.add(c); this.coils.push(c);
    }

    // dizzy stars
    const stars = this.stars = new THREE.Group(); stars.position.y = 1.75; stars.visible = false; root.add(stars);
    const starGeo = new THREE.OctahedronGeometry(0.085, 0), starMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(starGeo, starMat), a = (i / 3) * TAU;
      s.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42); s.scale.set(1, 1.5, 1);
      const o = new THREE.Mesh(starGeo, MAT.ink); o.scale.setScalar(1.3); s.add(o);
      stars.add(s);
    }

    // bubble shield
    const bub = this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.08, 22, 14), new THREE.MeshBasicMaterial({ color: 0x9fefff, transparent: true, opacity: 0.24, depthWrite: false }));
    bub.position.y = 0.9; bub.visible = false; bub.renderOrder = 5; root.add(bub);
    const rim = new THREE.Mesh(bub.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.BackSide }));
    rim.scale.setScalar(1.03); bub.add(rim);

    // soft blob shadow (lives in the scene, not on the character)
    this.shadow = new THREE.Mesh(GEO.disc, MAT.shadow);
    this.shadow.userData.sharedGeo = true;
    this.shadow.renderOrder = 2;

    this.P = this._pose(); this.T = this._pose();
    this.phase = 0; this.sqy = 1; this.sqv = 0; this.flat = 0;
  }

  _pose() { return { by: 0, bp: 0, br: 0, byaw: 0, hp: 0, hy: 0, hr: 0, alx: 0, alz: -0.16, arx: 0, arz: 0.16, llx: 0, lrx: 0, tx: 0, ty: 0, ux: 0, uz: 0 }; }

  setExpr(name, hold) {
    if (this.expr !== name) { for (const k in this.eyes) this.eyes[k].visible = k === name; this.expr = name; }
    this.exprT = hold || 0;
  }
  holdBanana(on) { this.held.visible = on; this.pack.visible = !on; this.strap.visible = !on; }
  setJet(on) { this.jet.visible = on; }
  setSprings(on) { for (const c of this.coils) c.visible = on; }
  bounce(v) { this.sqy = v; this.sqv = 0; }
  snapPose() { for (const k in this.T) this.P[k] = this.T[k]; }
  // back to a clean slate (new run, or swapped in from the character screen)
  fresh() {
    this.root.visible = true; this.flat = 0; this.stars.visible = false; this.bubble.visible = false;
    this.setJet(false); this.setSprings(false); this.setExpr('normal'); this.sqy = 1; this.sqv = 0;
  }

  // st: { mode, t, time, speedK, vy, panic, lean, stumble }
  update(dt, st) {
    const T = this.T, P = this.P, t = st.time, mt = st.t || 0;
    T.by = 0; T.bp = 0; T.br = st.lean || 0; T.byaw = 0; T.hp = 0; T.hy = 0; T.hr = 0;
    T.alx = 0; T.alz = -0.16; T.arx = 0; T.arz = 0.16; T.llx = 0; T.lrx = 0; T.tx = 0; T.ty = 0; T.ux = 0; T.uz = 0;
    let k = 22;
    switch (st.mode) {
      case 'idle':
        T.by = Math.sin(t * 2.1) * 0.012; T.hr = Math.sin(t * 0.9) * 0.07; T.hy = Math.sin(t * 0.55) * 0.14; T.hp = -0.03;
        T.arx = 2.7 + Math.sin(t * 2.2) * 0.07; T.arz = 0.8; T.alx = Math.sin(t * 1.3) * 0.08; T.alz = -0.24;
        T.ty = Math.sin(t * 1.7) * 0.5; T.tx = Math.sin(t * 1.1) * 0.1; T.uz = Math.sin(t * 1.3) * 0.08;
        k = 10; break;
      case 'scare': // glancing back at what just came out of the temple
        T.hy = 1.3; T.byaw = 0.55; T.hp = -0.05; T.alx = 2.3; T.arx = 2.3; T.alz = -0.75; T.arz = 0.75;
        T.llx = 0.3; T.lrx = -0.3; T.by = 0.05; T.tx = -0.5; T.ux = -0.25;
        k = 17; break;
      case 'run': {
        this.phase += dt * TAU * lerp(2.7, 3.7, st.speedK || 0);
        const s = Math.sin(this.phase), c2 = Math.cos(this.phase * 2);
        T.llx = s * 1.05; T.lrx = -s * 1.05;
        if (st.panic) { T.alx = 2.75 + Math.sin(this.phase * 2) * 0.4; T.arx = 2.75 - Math.sin(this.phase * 2) * 0.4; T.alz = -0.5; T.arz = 0.5; }
        else { T.alx = -s * 1.15; T.arx = s * 1.15; }
        T.by = Math.abs(s) * 0.075; T.bp = -0.22; T.hp = 0.14; T.hr = s * 0.05; T.byaw = s * 0.08;
        T.ty = s * 0.45; T.tx = c2 * 0.15 - 0.1; T.ux = 0.5 + c2 * 0.12;
        k = 32; break;
      }
      case 'air': {
        const up = st.vy > 0;
        T.alx = 2.85; T.arx = 2.85; T.alz = -0.55; T.arz = 0.55;
        T.llx = up ? 1.15 : 0.35; T.lrx = up ? -0.5 : 0.25; T.bp = up ? -0.16 : 0.06; T.hp = 0.08;
        T.tx = up ? 0.5 : -0.5; T.ux = up ? 0.7 : -0.3;
        k = 18; break;
      }
      case 'slide': // belly-flop, arms out front, just like the plush lies
        T.bp = -1.42; T.by = -0.2; T.hp = 1.05; T.alx = 3.0; T.arx = 3.0; T.alz = -0.25; T.arz = 0.25;
        T.llx = -0.12; T.lrx = -0.12; T.tx = -0.3; T.ty = Math.sin(t * 14) * 0.2; T.ux = 0.9;
        k = 20; break;
      case 'fly': // rocket: stretched out like a superhero
        T.bp = -1.34 + Math.sin(t * 3.1) * 0.05; T.by = 0; T.hp = 1.0; T.alx = 3.0; T.arx = 3.0; T.alz = -0.3; T.arz = 0.3;
        T.llx = -0.1 + Math.sin(t * 9) * 0.1; T.lrx = -0.1 - Math.sin(t * 9) * 0.1; T.tx = -0.2; T.ty = Math.sin(t * 11) * 0.25; T.ux = 1.0;
        k = 9; break;
      case 'bonk': { // flat on the back, seeing stars
        const d = Math.exp(-mt * 2.2);
        T.bp = 1.5; T.by = -0.2; T.hp = 0.25; T.alx = -1.2; T.arx = -1.2; T.alz = -1.25; T.arz = 1.25;
        T.llx = 0.75 + Math.sin(mt * 16) * 0.35 * d; T.lrx = 0.55 - Math.sin(mt * 16) * 0.35 * d; T.tx = 0.3;
        k = 13; break;
      }
      case 'fall':
        T.alx = 2.6 + Math.sin(mt * 31) * 0.7; T.arx = 2.6 - Math.sin(mt * 31) * 0.7; T.alz = -0.7; T.arz = 0.7;
        T.llx = Math.sin(mt * 27) * 0.9; T.lrx = -Math.sin(mt * 27) * 0.9; T.bp = Math.sin(mt * 5) * 0.25; T.hp = -0.2; T.ux = -0.6; T.tx = -0.6;
        k = 26; break;
      case 'flat':
        T.alz = -1.5; T.arz = 1.5; T.llx = 0; T.lrx = 0; T.bp = -1.45; T.by = -0.2; T.hp = 0.9; T.alx = 3.0; T.arx = 3.0;
        k = 30; break;
    }
    if (st.stumble >= 0 && st.stumble < 1) {
      const u = st.stumble, w = Math.sin(Math.PI * u);
      T.bp -= 0.85 * w; T.hp += 0.3 * w; T.by += 0.12 * w;
      T.alx = 2.1 + Math.sin(u * 26) * 0.9; T.arx = 2.1 - Math.sin(u * 26) * 0.9; T.alz = -0.6; T.arz = 0.6;
    }
    const a = 1 - Math.exp(-k * dt);
    for (const key in T) P[key] += (T[key] - P[key]) * a;

    this.body.position.y = HIP_Y + P.by;
    this.body.rotation.set(P.bp, P.byaw, P.br);
    this.head.rotation.set(P.hp, P.hy, P.hr);
    this.armL.rotation.set(P.alx, 0, P.alz); this.armR.rotation.set(P.arx, 0, P.arz);
    this.legL.rotation.x = P.llx; this.legR.rotation.x = P.lrx;
    this.tail.rotation.set(P.tx, P.ty, 0);
    const stiff = this.spec.stiffTop ? 0.2 : 1; // spikes barely move; a tuft flops about
    this.tuft.rotation.set(P.ux * stiff, 0, P.uz * stiff);

    // squash & stretch on a spring
    this.sqv += (-340 * (this.sqy - 1) - 19 * this.sqv) * dt;
    this.sqy = clamp(this.sqy + this.sqv * dt, 0.5, 1.5);
    if (this.flat > 0) {
      const f = this.flat, wob = 1 + Math.sin(t * 22) * 0.04 * f;
      this.sq.scale.set(lerp(1, 1.55, f) * wob, lerp(1, 0.07, f), lerp(1, 1.55, f) / wob);
    } else {
      const w = 1 / Math.sqrt(this.sqy);
      this.sq.scale.set(w, this.sqy, w);
    }

    // blinking and timed expressions
    if (this.exprT > 0) { this.exprT -= dt; if (this.exprT <= 0) this.setExpr('normal'); }
    this.blinkT -= dt;
    const blink = this.blinkT < 0.1;
    if (this.blinkT < 0) this.blinkT = 2.2 + Math.random() * 2.6;
    for (const e of this.eyeballs) e.scale.y = blink ? 0.12 : 1;

    if (this.stars.visible) { // circle wherever the head has ended up
      this.root.updateMatrixWorld(true);
      this.head.getWorldPosition(_v); this.root.worldToLocal(_v);
      this.stars.position.set(_v.x, _v.y + 0.62, _v.z);
      this.stars.rotation.y += dt * 4.5;
    }
    if (this.bubble.visible) this.bubble.scale.setScalar(1 + Math.sin(t * 5) * 0.025);
  }
}

// Who is running: built on first use, one in the scene at a time. `monkey` always points at the current one.
const Roster = {
  cache: {},
  get(id) { if (!CHARS[id]) id = 'monkey'; return this.cache[id] || (this.cache[id] = CHARS[id].sea ? new SeaCharacter(id) : new Character(id)); },
  use(id) {
    const c = this.get(id);
    if (monkey === c) return c;
    if (monkey) scene.remove(monkey.root, monkey.shadow);
    monkey = c; c.fresh();
    scene.add(c.root, c.shadow);
    return c;
  },
};

// ───────────────────────── the boulder ─────────────────────────
class Boulder {
  constructor() {
    this.R = 1.2;
    const g = new THREE.IcosahedronGeometry(this.R, 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < pos.count; i++) { // lumpy: the same bump for every copy of a shared corner
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = 0.93 + 0.14 * hash(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50));
      pos.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    for (let f = 0; f < pos.count; f += 3) {
      const h = hash(f, 3.1, 7.7), h2 = hash(f, 9.2, 1.3);
      let c = shade(0xa29a8f, 0.84 + h * 0.26);
      if (h2 < 0.13) c = shade(0x6fae5b, 0.9 + h * 0.2); else if (h2 > 0.9) c = shade(0x6e675f, 0.9 + h * 0.15);
      for (let j = 0; j < 3; j++) { col[(f + j) * 3] = c[0]; col[(f + j) * 3 + 1] = c[1]; col[(f + j) * 3 + 2] = c[2]; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.group = new THREE.Group();
    this.ball = new THREE.Mesh(g, MAT.env);
    this.ball.position.y = this.R;
    const hull = new THREE.Mesh(new THREE.IcosahedronGeometry(this.R * 1.07 + 0.05, 2), MAT.ink);
    this.ball.add(hull);
    this.group.add(this.ball);
    this.shadow = new THREE.Mesh(GEO.disc, MAT.shadow);
    this.shadow.userData.sharedGeo = true;
    this.shadow.scale.set(2.9, 1, 2.9); this.shadow.position.y = 0.03; this.shadow.renderOrder = 2;
    this.group.add(this.shadow);
    this.group.visible = false;
  }
  roll(dist) { this.ball.rotation.x -= dist / this.R; }
}

// ───────────────────────── sea creatures, modelled on the plush seal and the plush orca ─────────────────────────
const SEAL = { body: 0xf8b494, flip: 0xee9d7c, muzzle: 0xb36b36, dark: 0x2a1a14, dot: 0x7a4322, spot: 0xe98a3c };
const ORCA = { black: 0x2c3142, white: 0xf8f4ea, pupil: 0x15171d };
MAT.inkDark = new THREE.MeshBasicMaterial({ color: 0x12141b, side: THREE.BackSide });

// A seal on its belly, nose towards -Z, about 2.1 m from nose to flipper tips and 0.8 m tall. asleep: eyes shut.
function sealGeo(asleep) {
  const gb = new GeoBuilder(), c = SEAL;
  gb.add(SHAPE.sphHi, M(0, 0.4, -0.02, 0.84, 0.8, 1.5), c.body);                                             // a loaf of a body
  gb.add(taperTube([v3(0, 0.35, 0.3), v3(0, 0.28, 0.62), v3(0, 0.2, 0.92)], 8, 0.3, 0.13, 10), IDENT, c.body); // tapering to the tail
  gb.add(SHAPE.sphHi, M(0, 0.42, -0.5, 0.88, 0.82, 0.82), c.body);                                           // domed head, as wide as the body
  gb.add(SHAPE.sph, M(0, 0.29, -0.845, 0.46, 0.32, 0.24), c.muzzle);                                         // caramel muzzle
  gb.add(SHAPE.cone4, M(0, 0.385, -0.955, 0.18, 0.12, 0.07, Math.PI, 0, 0), c.dark);                         // nose: a black triangle, point down
  gb.add(SHAPE.box, M(0, 0.265, -0.96, 0.02, 0.13, 0.02), c.dark);                                           // the seam below it
  for (const sx of [-1, 1]) {
    for (const [dx, dy] of [[0.1, 0.275], [0.155, 0.315], [0.15, 0.235]]) gb.add(SHAPE.sphLo, M(sx * dx, dy, -0.945 + dx * 0.22, 0.024, 0.024, 0.02), c.dot); // whisker dots
    if (asleep) for (const k of [-1, 1]) gb.add(SHAPE.box, M(sx * 0.285 + k * 0.034 * 0.76, 0.565, -0.762 + sx * k * 0.034 * 0.64, 0.09, 0.03, 0.03, 0, -sx * 0.7, k * 0.5), c.dark);
    else gb.add(SHAPE.sph, M(sx * 0.285, 0.57, -0.765, 0.086, 0.086, 0.06, 0, -sx * 0.7, 0), c.dark);             // small wide-set eyes
    gb.add(SHAPE.sph, M(sx * 0.56, 0.065, -0.06, 0.62, 0.11, 0.36, 0, sx * -0.5, sx * -0.06), c.flip);        // front flippers, flat on the ground and swept back
    for (const k of [-1, 0, 1]) gb.add(SHAPE.box, M(sx * 0.62, 0.118, -0.02 + k * 0.085, 0.34, 0.014, 0.022, 0, sx * -(0.5 + k * 0.14), 0), c.muzzle);
    gb.add(SHAPE.sph, M(sx * 0.13, 0.1, 1.02, 0.22, 0.1, 0.44, 0, sx * 0.34, 0), c.flip);                     // tail flippers
  }
  for (const [x, y, z, r] of [[0.13, 0.786, 0.14, -0.3], [-0.1, 0.765, 0.31, 0.25], [0.07, 0.725, 0.44, -0.15]]) gb.add(SHAPE.sph, M(x, y, z, 0.15, 0.03, 0.11, 0.25, 0.4, r), c.spot); // spots on the back
  return gb.build();
}

// The orca, nose towards -Z, about 4 m long. part: 'body', 'tail' (the piece that beats), or 'all' in one for the ones that only glide by.
function orcaGeo(part, noEyes) {
  const gb = new GeoBuilder(), c = ORCA;
  if (part !== 'tail') {
    gb.add(SHAPE.sphHi, M(0, 0, -0.25, 1.75, 1.5, 3.1), c.black);                                             // one big blunt lozenge
    gb.add(SHAPE.sphHi, M(0, -0.2, -0.55, 1.62, 1.22, 2.55), c.white);                                        // white chin and belly showing through underneath
    gb.add(taperTube([v3(0, 0.02, 0.7), v3(0, 0.05, 1.0), v3(0, 0.07, 1.3)], 6, 0.6, 0.36, 12), IDENT, c.black);
    gb.add(SHAPE.sph, M(0, 0.07, 1.3, 0.72, 0.72, 0.5), c.black);
    gb.add(SHAPE.sph, M(0, 0.74, 0.12, 0.17, 1.0, 0.66, 0.5, 0, 0), c.black);                                  // rounded fin, leaning back
    for (const sx of [-1, 1]) {
      gb.add(SHAPE.sph, M(sx * 0.726, 0.27, -0.95, 0.1, 0.5, 0.7, 0, sx * 0.3, sx * 0.46), c.white);            // the big white eye patch …
      if (!noEyes) gb.add(SHAPE.sph, M(sx * 0.772, 0.29, -0.98, 0.06, 0.09, 0.09, 0, sx * 0.3, sx * 0.46), c.pupil); // … with a dot of an eye in the middle
      gb.add(SHAPE.sph, M(sx * 0.845, -0.1, 0.1, 0.09, 0.74, 0.42, 0.5, 0, sx * -0.12), c.white);              // white flash on the flank
      gb.add(SHAPE.sph, M(sx * 0.98, -0.52, -0.5, 0.95, 0.15, 0.52, 0, sx * -0.45, sx * -0.5), c.black);       // paddle flippers, swept back
    }
  }
  if (part !== 'body') {
    const z0 = part === 'tail' ? -1.3 : 0; // the tail piece is built around its hinge
    gb.add(taperTube([v3(0, 0.07, 1.3 + z0), v3(0, 0.09, 1.6 + z0), v3(0, 0.1, 1.9 + z0)], 6, 0.36, 0.16, 10), IDENT, c.black);
    gb.add(SHAPE.sph, M(0, 0.1, 1.92 + z0, 0.34, 0.2, 0.34), c.black);
    for (const sx of [-1, 1]) gb.add(SHAPE.sph, M(sx * 0.4, 0.1, 2.08 + z0, 0.9, 0.13, 0.5, 0, sx * -0.45, 0), c.black); // flukes
  }
  return gb.build();
}
// A loose school of little fish, all heading towards -Z. One mesh, so a whole school costs a single draw.
function fishGeo(cols) {
  const gb = new GeoBuilder(), rng = makeRng(cols[0]);
  for (let i = 0; i < 10; i++) {
    const x = rng.range(-1.2, 1.2), y = rng.range(-0.75, 0.75), z = rng.range(-1.5, 1.5), s = rng.range(0.8, 1.3), c = cols[i % cols.length];
    gb.add(SHAPE.sphLo, M(x, y, z, 0.16 * s, 0.3 * s, 0.52 * s), c);
    gb.add(SHAPE.cone4, M(x, y, z + 0.37 * s, 0.05 * s, 0.26 * s, 0.26 * s, -Math.PI / 2, 0, 0), shade(c, 0.78)); // tail fin
    gb.add(SHAPE.box, M(x, y, z - 0.05 * s, 0.17 * s, 0.3 * s, 0.07 * s), 0xffffff);                              // one white band
    for (const sx of [-1, 1]) gb.add(SHAPE.sphLo, M(x + sx * 0.065 * s, y + 0.05 * s, z - 0.17 * s, 0.04 * s, 0.05 * s, 0.05 * s), 0x1f1410);
  }
  return gb.build();
}
// Ink outline geometry that a GeoBuilder can also merge (it needs normals).
function inkOf(geo, t) { const g = outlineOf(geo, t); g.setAttribute('normal', geo.attributes.normal); return g; }
function seaGeo() { // built the first time the tide comes in
  if (!GEO.sealNap) {
    GEO.sealNap = sealGeo(true); GEO.sealNapInk = inkOf(GEO.sealNap, 0.03);
    GEO.seal = sealGeo(false); GEO.sealInk = inkOf(GEO.seal, 0.03);
    GEO.orca = orcaGeo('all'); GEO.orcaInk = inkOf(GEO.orca, 0.04);
    GEO.fishA = fishGeo([0xff8a3c, 0xffb347, 0xff6f61]); GEO.fishB = fishGeo([0xffe066, 0x5fd4f2, 0x7ae0c4]);
  }
  return GEO;
}
const sharedMesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.userData.sharedGeo = true; return m; };

// The orca that takes over from the boulder under water: it swims after you, and if it catches you, you get booped.
class Orca {
  constructor() {
    this.group = new THREE.Group(); this.group.visible = false;
    const swim = this.swim = new THREE.Group(); swim.position.set(0, 1.0, 0.3); this.group.add(swim);
    const body = orcaGeo('body'), tail = orcaGeo('tail');
    const b = new THREE.Mesh(body, MAT.char); b.add(new THREE.Mesh(outlineOf(body, 0.04), MAT.inkDark)); swim.add(b);
    this.tail = new THREE.Group(); this.tail.position.set(0, 0, 1.3); swim.add(this.tail);
    const tm = new THREE.Mesh(tail, MAT.char); tm.add(new THREE.Mesh(outlineOf(tail, 0.04), MAT.inkDark)); this.tail.add(tm);
    this.shadow = sharedMesh(GEO.disc, MAT.shadow);
    this.shadow.scale.set(2.4, 1, 4.2); this.shadow.position.set(0, 0.03, 0.3); this.shadow.renderOrder = 2;
    this.group.add(this.shadow);
    this.ph = 0; this.wig = 0;
  }
  // v: how fast it is moving (m/s). glee: 0…1 after a boop, when it wriggles with delight.
  update(dt, t, v, glee) {
    this.ph += dt * (4.2 + Math.min(v, 30) * 0.22);
    const s = Math.sin(this.ph), g = glee || 0;
    this.tail.rotation.x = s * 0.42;
    this.swim.rotation.x = Math.sin(this.ph - 1.1) * 0.07 - g * 0.25;
    this.swim.rotation.z = Math.sin(t * 1.3) * 0.05 + g * Math.sin(t * 13) * 0.22;
    this.swim.position.y = 1.0 + Math.sin(t * 1.9) * 0.1 + g * 0.5;
  }
}

// Seals, orcas and schools of fish that only swim about for the look of the thing. They belong to a stretch of track and loop for ever.
class Swimmer {
  constructor(kind, o) {
    const G = seaGeo(), orca = kind === 'orca';
    if (kind === 'fish') this.obj = sharedMesh(o.alt ? G.fishB : G.fishA, MAT.char); // too small to need an outline
    else {
      this.obj = sharedMesh(orca ? G.orca : G.seal, MAT.char);
      this.obj.add(sharedMesh(orca ? G.orcaInk : G.sealInk, orca ? MAT.inkDark : MAT.ink));
    }
    Object.assign(this, { kind, cx: 0, cy: 3, cz: 0, rx: 3, rz: 3, w: 0.8, ph: 0, bob: 0.5, size: 1, roll: 0, fled: -1 }, o);
    this.obj.scale.setScalar(this.size);
  }
  flee(t) { if (this.fled < 0) this.fled = t; } // startled: up and away, and it carries on its rounds from there
  update(t) {
    const a = t * this.w + this.ph, c = Math.cos(a), s = Math.sin(a), o = this.obj;
    if (this.home) o.visible = Tide.y > SEA_LIFE_Y && !(monkey && monkey.swims); // company for a runner with legs; a seal or an orca out in front needs no double behind it
    o.position.set(this.cx + c * this.rx, this.cy + Math.sin(a * 1.7 + this.ph) * this.bob, this.cz + s * this.rz);
    const vx = -s * this.rx * this.w, vz = c * this.rz * this.w;                 // heading follows the way it is going
    o.rotation.set(Math.cos(a * 1.7 + this.ph) * 0.16, Math.atan2(-vx, -vz), Math.sin(a * 2.3) * 0.14 + (this.roll ? Math.max(0, Math.sin(a * 0.5)) ** 8 * TAU : 0), 'YXZ');
    if (this.fled >= 0) {
      const k = clamp((t - this.fled) / 0.9, 0, 1), e = k * k * (3 - 2 * k);
      o.position.y += 7 * e; o.position.x += (this.cx < 0 ? -5 : 5) * e; o.rotation.x += 0.7 * Math.sin(k * Math.PI); // nose up on the way
    }
  }
}

// ───────────────────────── the seal and the orca as runners ─────────────────────────
// Sea-only characters. They swim instead of running: level in the water with the belly half a metre off the floor,
// which is where a napping seal would trip them and a beam would catch them, so a leap and a dive are needed in exactly
// the places a jump and a slide are. The rules and the reach are everybody's; only the stroke is their own.
// Everything the game asks of a Character, this answers too.
const SWIM_Y = 1.0; // how high the middle of the body rides

// The plush seal again, taken apart at the tail and the shoulders so that it can swim.
// Model space: nose towards -Z, the middle of the body at the origin. part: 'body', 'tail' (built round its hinge) or 'flip' (one front flipper, built round the shoulder; sx = which side).
function sealSwimGeo(part, sx) {
  const gb = new GeoBuilder(), c = SEAL;
  if (part === 'body') {
    gb.add(SHAPE.sphHi, M(0, 0, -0.02, 0.84, 0.8, 1.5), c.body);
    gb.add(SHAPE.sphHi, M(0, 0.02, -0.5, 0.88, 0.82, 0.82), c.body);
    gb.add(SHAPE.sph, M(0, -0.11, -0.845, 0.46, 0.32, 0.24), c.muzzle);
    gb.add(SHAPE.cone4, M(0, -0.015, -0.955, 0.18, 0.12, 0.07, Math.PI, 0, 0), c.dark);
    gb.add(SHAPE.box, M(0, -0.135, -0.96, 0.02, 0.13, 0.02), c.dark);
    for (const k of [-1, 1]) for (const [dx, dy] of [[0.1, -0.125], [0.155, -0.085], [0.15, -0.165]]) gb.add(SHAPE.sphLo, M(k * dx, dy, -0.945 + dx * 0.22, 0.024, 0.024, 0.02), c.dot);
    for (const [x, y, z, r] of [[0.13, 0.386, 0.14, -0.3], [-0.1, 0.365, 0.31, 0.25], [0.07, 0.325, 0.44, -0.15], [-0.15, 0.372, -0.1, 0.5]]) gb.add(SHAPE.sph, M(x, y, z, 0.15, 0.03, 0.11, 0.25, 0.4, r), c.spot); // the spots on its back are what you see of it in a run
  } else if (part === 'tail') {
    gb.add(taperTube([v3(0, 0, -0.07), v3(0, -0.01, 0.3), v3(0, -0.02, 0.7)], 8, 0.3, 0.14, 10), IDENT, c.body);
    for (const k of [-1, 1]) { // hind flippers, fanned out in a V: this is the end of it you see in a run
      gb.add(SHAPE.sph, M(k * 0.2, -0.02, 0.9, 0.32, 0.1, 0.62, 0, k * 0.5, 0), c.flip);
      for (const j of [-1, 1]) gb.add(SHAPE.box, M(k * 0.24 + j * 0.06, 0.035, 0.98, 0.016, 0.014, 0.3, 0, k * 0.5 + j * 0.16, 0), c.muzzle);
    }
  } else {
    gb.add(SHAPE.sph, M(sx * 0.28, 0, 0.08, 0.66, 0.1, 0.36, 0, sx * -0.5, 0), c.flip);
    for (const k of [-1, 0, 1]) gb.add(SHAPE.box, M(sx * 0.35, 0.05, 0.13 + k * 0.085, 0.36, 0.014, 0.022, 0, sx * -(0.5 + k * 0.14), 0), c.muzzle);
  }
  return gb.build();
}

// Eyes that can change expression on a head that is not flat-fronted: each eye sits on its own little turntable, turned to face out of the head.
// E: { x, y, z, yaw } for one eye (mirrored for the other). onWhite: the eye sits on a white patch already (the orca), so "wide" is a pinprick pupil instead.
function seaEyes(E, r, onWhite) {
  const eyeGeo = new THREE.SphereGeometry(r, 12, 8), barGeo = new THREE.BoxGeometry(r * 3.5, r * 0.95, r * 0.8), sets = {}, balls = [];
  const make = (fill) => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sx * E.x, E.y, E.z); pv.rotation.y = -sx * E.yaw; fill(pv, sx); g.add(pv); }
    return g;
  };
  sets.normal = make((pv, sx) => {
    const e = new THREE.Mesh(eyeGeo, MAT.eye); e.scale.z = 0.6; pv.add(e); balls.push(e);
    const hl = new THREE.Mesh(eyeGeo, MAT.white); hl.scale.setScalar(0.3); hl.position.set(-sx * r * 0.3, r * 0.42, -r * 0.55); pv.add(hl);
  });
  sets.wide = make((pv) => {
    if (!onWhite) { const w = new THREE.Mesh(eyeGeo, MAT.white); w.scale.set(1.9, 2.1, 0.5); pv.add(w); }
    const e = new THREE.Mesh(eyeGeo, MAT.eye); e.scale.set(onWhite ? 0.55 : 0.85, onWhite ? 0.55 : 0.85, 0.5); e.position.z = -r * 0.5; pv.add(e);
  });
  sets.x = make((pv) => { for (const k of [-1, 1]) { const b = new THREE.Mesh(barGeo, MAT.eye); b.position.z = -r * 0.35; b.rotation.z = k * 0.78; pv.add(b); } });
  sets.squint = make((pv, sx) => { for (const k of [-1, 1]) { const b = new THREE.Mesh(barGeo, MAT.eye); b.scale.x = 0.8; b.position.set(0, k * r * 0.9, -r * 0.35); b.rotation.z = -sx * k * 0.55; pv.add(b); } });
  sets.happy = make((pv) => { for (const k of [-1, 1]) { const b = new THREE.Mesh(barGeo, MAT.eye); b.scale.x = 0.7; b.position.set(k * r * 0.9, 0, -r * 0.35); b.rotation.z = -k * 0.75; pv.add(b); } });
  return { sets, balls };
}

// Per kind: how far the plush is fattened and shortened (a runner has to fit a lane and its own hitbox), and where things attach once it has been.
const SEA_BODY = {
  seal: { sc: [1.12, 1.12, 1.0], tail: [0, -0.045, 0.34], shoulder: [0.403, -0.224, -0.12], eye: { x: 0.319, y: 0.19, z: -0.765, yaw: 0.7 }, eyeR: 0.048,
    nose: [0, -0.01, -0.99], back: [0, 0.55, 0.12], strap: [0.452, 1.03, 0.98, 0, 0.12], jet: [0.17, 0.5, 0.34], head: [0, 0.1, -0.62],
    coils: [[0.04, 0.33], [0.16, 0.285], [0.28, 0.24]], dive: -0.53, diveRoll: 0, rest: -0.55, roll: Math.PI, bubble: [1.05, 0.98, 1.42, 0.1], shadow: [0.9, 1.9] },
  orca: { sc: [0.62, 0.62, 0.52], tail: [0, 0, 0.676], eye: { x: 0.48, y: 0.18, z: -0.51, yaw: 1.22 }, eyeR: 0.05,
    nose: [0, -0.02, -0.936], back: [0, 0.535, -0.42], strap: [0.482, 1.06, 0.97, -0.03, -0.42], jet: [0.22, 0.49, 0.06], head: [0, 0.1, -0.6],
    coils: [[0.04, 0.215], [0.12, 0.185], [0.2, 0.155]], dive: -0.5, diveRoll: 0.5, rest: -0.42, roll: 1.45, bubble: [1.12, 1.02, 1.42, 0.12], shadow: [1.0, 1.9] },
};

class SeaCharacter {
  constructor(id) {
    const spec = this.spec = CHARS[id], K = this.orca = spec.kind === 'orca', B = this.B = SEA_BODY[spec.kind], [ax, ay, az] = B.sc;
    this.id = id; this.swims = true;
    const root = this.root = new THREE.Group();
    const sq = this.sq = new THREE.Group(); root.add(sq);
    const body = this.body = new THREE.Group(); body.rotation.order = 'YXZ'; body.position.y = SWIM_Y; sq.add(body);
    const ink = K ? MAT.inkDark : MAT.ink;
    const part = (geo) => { geo.scale(ax, ay, az); const m = new THREE.Mesh(geo, MAT.char); m.add(new THREE.Mesh(outlineOf(geo, 0.026), ink)); return m; };

    body.add(part(K ? orcaGeo('body', true) : sealSwimGeo('body')));
    const tail = this.tail = new THREE.Group(); tail.position.set(B.tail[0], B.tail[1], B.tail[2]); body.add(tail);
    tail.add(part(K ? orcaGeo('tail') : sealSwimGeo('tail')));
    this.flips = [];
    if (B.shoulder) for (const sx of [-1, 1]) { // the seal paddles; the orca's flippers are part of its body
      const f = new THREE.Group(); f.position.set(sx * B.shoulder[0], B.shoulder[1], B.shoulder[2]); f.add(part(sealSwimGeo('flip', sx))); body.add(f); this.flips.push(f);
    }

    // a point in the head: where the bubbles come from and what the stars circle
    const head = this.head = new THREE.Object3D(); head.position.set(B.head[0], B.head[1], B.head[2]); body.add(head);
    const ey = seaEyes(B.eye, B.eyeR, K);
    this.eyes = ey.sets; this.eyeballs = ey.balls;
    for (const k in this.eyes) { this.eyes[k].visible = k === 'normal'; body.add(this.eyes[k]); }
    this.expr = 'normal'; this.exprT = 0; this.blinkT = 2.5;

    // the Golden Banana: strapped along the back in a run, balanced on the nose on the home screen
    let gb = new GeoBuilder();
    gb.add(GEO.banana, M(0, 0, 0, 1.05, 1.05, 1.05), 0xffffff);
    const pack = this.pack = toonPart(gb, 0.022, MAT.gold);
    pack.position.set(B.back[0], B.back[1], B.back[2]); pack.rotation.set(0, Math.PI / 2 - 0.18, Math.PI); // along the spine, ends down, so it hugs the curve of the back
    body.add(pack);
    const strap = this.strap = new THREE.Mesh(new THREE.TorusGeometry(B.strap[0], 0.026, 6, 24), new THREE.MeshToonMaterial({ color: 0x8a4b2a, gradientMap: GRAD_CHAR }));
    strap.scale.set(B.strap[1], B.strap[2], 1); strap.position.set(0, B.strap[3], B.strap[4]);
    body.add(strap);
    gb = new GeoBuilder();
    gb.add(GEO.banana, M(0, 0, 0, 1.0, 1.0, 1.0), 0xffffff);
    const perch = this.perch = new THREE.Group(); perch.position.set(B.nose[0], B.nose[1], B.nose[2]); body.add(perch); // it rocks about the tip of the nose
    const held = this.held = toonPart(gb, 0.022, MAT.gold);
    held.position.set(0, 0.27, 0); perch.add(held);
    held.visible = false;

    // coconut rocket: two coconuts on the back, nozzles to the rear
    const jet = this.jet = new THREE.Group(); jet.visible = false; body.add(jet);
    gb = new GeoBuilder();
    for (const sx of [-1, 1]) {
      gb.add(SHAPE.sph, M(sx * B.jet[0], B.jet[1], B.jet[2], 0.3, 0.3, 0.36), 0x8a5a33);
      gb.add(SHAPE.sph, M(sx * B.jet[0], B.jet[1], B.jet[2] - 0.16, 0.2, 0.2, 0.1), 0xb07a48);
      gb.add(SHAPE.coneS, M(sx * B.jet[0], B.jet[1], B.jet[2] + 0.22, 0.2, 0.16, 0.2, -Math.PI / 2, 0, 0), 0x4a3526);
    }
    gb.add(SHAPE.box, M(0, B.jet[1] - 0.04, B.jet[2], B.jet[0] * 2 + 0.2, 0.07, 0.07), 0x8a4b2a);
    jet.add(toonPart(gb, 0.022));
    this.nozzles = [new THREE.Object3D(), new THREE.Object3D()];
    this.nozzles[0].position.set(-B.jet[0], B.jet[1], B.jet[2] + 0.32); this.nozzles[1].position.set(B.jet[0], B.jet[1], B.jet[2] + 0.32);
    jet.add(this.nozzles[0], this.nozzles[1]);

    // super springs: bright coils round the tail
    const coils = new THREE.Group(); coils.visible = false; tail.add(coils); this.coils = [coils];
    const coilMat = new THREE.MeshToonMaterial({ color: 0x7ce04a, gradientMap: GRAD_CHAR, emissive: 0x1d4a08 });
    B.coils.forEach(([z, r], i) => {
      const geo = new THREE.TorusGeometry(r, 0.03, 6, 16), ring = new THREE.Mesh(geo, coilMat); ring.position.set(0, K ? 0.045 : -0.01, z); ring.rotation.x = i % 2 ? 0.16 : -0.16;
      const o = new THREE.Mesh(geo, MAT.ink); o.scale.set(1.08, 1.08, 1.6); ring.add(o);
      coils.add(ring);
    });

    // dizzy stars
    const stars = this.stars = new THREE.Group(); stars.visible = false; root.add(stars);
    const starGeo = new THREE.OctahedronGeometry(0.085, 0), starMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(starGeo, starMat), a = (i / 3) * TAU;
      s.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42); s.scale.set(1, 1.5, 1);
      const o = new THREE.Mesh(starGeo, MAT.ink); o.scale.setScalar(1.3); s.add(o);
      stars.add(s);
    }

    // bubble shield, long enough to take all of it
    const bub = this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), new THREE.MeshBasicMaterial({ color: 0x9fefff, transparent: true, opacity: 0.24, depthWrite: false }));
    bub.visible = false; bub.renderOrder = 5; root.add(bub);
    const rim = new THREE.Mesh(bub.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.BackSide }));
    rim.scale.setScalar(1.03); bub.add(rim);

    // soft shadow on the floor below, as long as the animal (lives in the scene, not on the character)
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2).scale(B.shadow[0], 1, B.shadow[1]), MAT.shadow);
    this.shadow.renderOrder = 2;

    this.P = this._pose(); this.T = this._pose();
    this.phase = 0; this.sqy = 1; this.sqv = 0; this.flat = 0;
  }

  // by: height, bp: pitch (nose up), br: roll, byaw: turn; tx/ty: tail up-down and side to side; fl: flippers raised, fa: one more than the other; hz: the banana rocking; sz: size (it poses a little smaller than it swims, to fit the screen)
  _pose() { return { by: 0, bp: 0, br: 0, byaw: 0, tx: 0, ty: 0, fl: -0.35, fa: 0, hz: 0, sz: 1 }; }

  setExpr(name, hold) {
    if (this.expr !== name) { for (const k in this.eyes) this.eyes[k].visible = k === name; this.expr = name; }
    this.exprT = hold || 0;
  }
  holdBanana(on) { this.held.visible = on; this.pack.visible = !on; this.strap.visible = !on; }
  setJet(on) { this.jet.visible = on; }
  setSprings(on) { for (const c of this.coils) c.visible = on; }
  bounce(v) { this.sqy = v; this.sqv = 0; }
  snapPose() { for (const k in this.T) this.P[k] = this.T[k]; }
  fresh() {
    this.root.visible = true; this.flat = 0; this.stars.visible = false; this.bubble.visible = false;
    this.setJet(false); this.setSprings(false); this.setExpr('normal'); this.sqy = 1; this.sqv = 0;
    this.P.br = 0; this.P.bp = 0; this.P.by = 0; // the right way up again
  }

  // st: { mode, t, time, speedK, vy, panic, lean, stumble } — the same call a Character takes
  update(dt, st) {
    const T = this.T, P = this.P, B = this.B, K = this.orca, t = st.time, mt = st.t || 0;
    T.by = 0; T.bp = 0; T.br = (st.lean || 0) * 0.9; T.byaw = 0; T.tx = 0; T.ty = 0; T.fl = -0.35; T.fa = 0; T.hz = 0; T.sz = 1;
    let k = 22;
    switch (st.mode) {
      case 'idle': // nose in the air like a performing seal, three-quarters on, the Golden Banana balanced on the end of it
        T.byaw = (K ? 0.55 : 0.4) + Math.sin(t * 0.5) * 0.08; T.bp = 0.55 + Math.sin(t * 1.15) * 0.04; T.by = -0.06 + Math.sin(t * 1.6) * 0.045; T.br = Math.sin(t * 0.9) * 0.05; T.sz = 0.86;
        T.tx = K ? Math.sin(t * 1.9) * 0.22 : 0; T.ty = K ? 0 : Math.sin(t * 1.9) * 0.3; T.fl = -0.2 + Math.sin(t * 2.3) * 0.22; T.fa = Math.sin(t * 1.15) * 0.1; T.hz = Math.sin(t * 2.3) * 0.1;
        k = 9; break;
      case 'scare': // a look back at what just came out of the temple
        T.byaw = 1.05; T.bp = 0.16; T.by = 0.16; T.fl = 0.7; T.tx = K ? -0.4 : 0; T.ty = K ? 0 : -0.5;
        k = 17; break;
      case 'run': { // swimming: the seal sculls from side to side, the orca beats its flukes up and down
        const hurry = st.panic ? 1.25 : 1;
        this.phase += dt * TAU * lerp(1.7, 2.5, st.speedK || 0) * hurry;
        const s = Math.sin(this.phase);
        T.bp = 0.2; // nose a little up, so the camera behind sees its back and not just its tail end
        if (K) { T.tx = s * 0.5 * hurry; T.bp += Math.sin(this.phase - 1.2) * 0.075 * hurry; T.by = Math.sin(this.phase - 0.5) * 0.04; }
        else { T.ty = s * 0.5 * hurry; T.byaw = -Math.sin(this.phase - 0.4) * 0.11 * hurry; T.br += s * 0.035; T.by = Math.sin(this.phase * 2) * 0.02; T.fl = -0.35 + Math.cos(this.phase) * 0.14; T.fa = s * 0.12; }
        k = 26; break;
      }
      case 'air': // a leap: nose up on the way up, nose down on the way back
        T.bp = clamp(0.15 + (st.vy || 0) * 0.075, -0.6, 0.85); T.fl = 0.75; T.tx = K ? (st.vy > 0 ? 0.35 : -0.25) : 0; T.ty = K ? 0 : Math.sin(t * 16) * 0.22;
        k = 16; break;
      case 'slide': // a dive: flat along the floor with everything tucked in
        T.by = B.dive; T.bp = 0.02; T.br = B.diveRoll; T.fl = -0.8; // (the orca tips on its side to get its fin under) T.tx = K ? Math.sin(t * 15) * 0.16 : 0; T.ty = K ? 0 : Math.sin(t * 15) * 0.2;
        k = 20; break;
      case 'fly': // coconuts lit: straight as an arrow
        T.bp = 0.16 + Math.sin(t * 3.1) * 0.04; T.fl = 0.45; T.tx = K ? Math.sin(t * 12) * 0.18 : 0; T.ty = K ? 0 : Math.sin(t * 12) * 0.2;
        k = 9; break;
      case 'bonk': { // rolled over on the floor, seeing stars
        const d = Math.exp(-mt * 2.2);
        T.br = B.roll; T.by = B.rest; T.bp = 0.04; T.fl = 0.35 + Math.sin(mt * 16) * 0.3 * d; T.fa = Math.sin(mt * 16) * 0.2 * d; T.tx = K ? 0.25 : 0;
        k = 11; break;
      }
      case 'fall': // helpless: over and over with everything flapping
        T.br = Math.sin(mt * 6.5) * 0.9; T.bp = Math.sin(mt * 5) * 0.3 - 0.15; T.fl = 0.3 + Math.sin(mt * 31) * 0.6; T.fa = Math.sin(mt * 27) * 0.5;
        T.tx = K ? Math.sin(mt * 27) * 0.6 : 0; T.ty = K ? 0 : Math.sin(mt * 27) * 0.7;
        k = 24; break;
      case 'flat':
        T.by = B.rest; T.fl = 0.2;
        k = 30; break;
    }
    if (st.stumble >= 0 && st.stumble < 1) {
      const u = st.stumble, w = Math.sin(Math.PI * u);
      T.bp -= 0.5 * w; T.br += Math.sin(u * 26) * 0.4 * w; T.by += 0.1 * w; T.fl = 0.4 + Math.sin(u * 26) * 0.6;
    }
    const a = 1 - Math.exp(-k * dt);
    for (const key in T) P[key] += (T[key] - P[key]) * a;

    this.body.position.y = SWIM_Y + P.by;
    this.body.rotation.set(P.bp, P.byaw, P.br);
    this.tail.rotation.set(P.tx, P.ty, 0);
    if (this.flips.length) { this.flips[0].rotation.z = -(P.fl - P.fa); this.flips[1].rotation.z = P.fl + P.fa; }
    this.perch.rotation.z = P.hz; this.perch.rotation.x = -P.bp; // the banana stays level while the nose tips under it

    // squash & stretch on a spring, about the middle of the body
    this.sqv += (-340 * (this.sqy - 1) - 19 * this.sqv) * dt;
    this.sqy = clamp(this.sqy + this.sqv * dt, 0.5, 1.5);
    if (this.flat > 0) { const f = this.flat; this.body.scale.set(lerp(1, 1.4, f), lerp(1, 0.14, f), lerp(1, 1.4, f)); }
    else { const w = P.sz / Math.sqrt(this.sqy); this.body.scale.set(w, this.sqy * P.sz, w); }

    // blinking and timed expressions
    if (this.exprT > 0) { this.exprT -= dt; if (this.exprT <= 0) this.setExpr('normal'); }
    this.blinkT -= dt;
    const blink = this.blinkT < 0.1;
    if (this.blinkT < 0) this.blinkT = 2.2 + Math.random() * 2.6;
    for (const e of this.eyeballs) e.scale.y = blink ? 0.12 : 1;

    if (this.stars.visible) { // circle wherever the head has ended up
      this.root.updateMatrixWorld(true);
      this.head.getWorldPosition(_v); this.root.worldToLocal(_v);
      this.stars.position.set(_v.x, _v.y + 0.55, _v.z);
      this.stars.rotation.y += dt * 4.5;
    }
    if (this.bubble.visible) { const p = 1 + Math.sin(t * 5) * 0.025; this.bubble.position.set(0, SWIM_Y + P.by, B.bubble[3]); this.bubble.scale.set(B.bubble[0] * p, B.bubble[1] * p, B.bubble[2] * p); }
    this.shadow.rotation.y = this.root.rotation.y; // the shadow lies the way the animal is heading
  }
}
