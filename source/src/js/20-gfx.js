// ───────────────────────── drawing kit: shapes, merged-geometry builder, materials ─────────────────────────
const UP = new THREE.Vector3(0, 1, 0);
const IDENT = new THREE.Matrix4();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _n3 = new THREE.Matrix3(), _c = new THREE.Color();

// Compose a transform into a shared matrix (use it straight away).
function M(x, y, z, sx, sy, sz, rx, ry, rz) {
  _e.set(rx || 0, ry || 0, rz || 0, 'YXZ');
  _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
// Transform that points a shape's +Y axis along a direction, with its base at (x,y,z).
function Mdir(x, y, z, dir, w, len, d) {
  _q.setFromUnitVectors(UP, dir);
  return _m.compose(_p.set(x + dir.x * len * 0.5, y + dir.y * len * 0.5, z + dir.z * len * 0.5), _q, _s.set(w, len, d === undefined ? w : d));
}

const flatG = (g) => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
const softG = (g) => (g.index ? g.toNonIndexed() : g);

// Every base shape is one unit across, so scale = size in metres.
const SHAPE = {
  box: softG(new THREE.BoxGeometry(1, 1, 1)),
  cyl: flatG(new THREE.CylinderGeometry(0.5, 0.5, 1, 8)),
  cyl12: softG(new THREE.CylinderGeometry(0.5, 0.5, 1, 12)),
  taper: flatG(new THREE.CylinderGeometry(0.36, 0.5, 1, 7)),
  rock: flatG(new THREE.CylinderGeometry(0.5, 0.3, 1, 9)),
  cone: flatG(new THREE.ConeGeometry(0.5, 1, 6)),
  cone4: flatG(new THREE.ConeGeometry(0.5, 1, 4)),
  coneS: softG(new THREE.ConeGeometry(0.5, 1, 8)),
  ico: flatG(new THREE.IcosahedronGeometry(0.5, 0)),
  ico1: flatG(new THREE.IcosahedronGeometry(0.5, 1)),
  sphLo: softG(new THREE.SphereGeometry(0.5, 8, 6)),
  sph: softG(new THREE.SphereGeometry(0.5, 16, 12)),
  sphHi: softG(new THREE.SphereGeometry(0.5, 24, 16)),
};

// A capsule along Y (r128 has no CapsuleGeometry).
function capsuleGeo(r, len, seg) {
  const pts = [], n = 6;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r, -len / 2 + Math.sin(a) * r)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r, len / 2 + Math.sin(a) * r)); }
  return softG(new THREE.LatheGeometry(pts, seg || 10));
}

// A fat little crescent: a short brown stem at one end, a dark point at the other.
function makeBananaGeo() {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.34, 0.1, 0), new THREE.Vector3(0, -0.26, 0), new THREE.Vector3(0.34, 0.12, 0));
  const TS = 11, RS = 7;
  const g = new THREE.TubeGeometry(curve, TS, 0.115, RS, false);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i <= TS; i++) {
    const u = i / TS, c = curve.getPointAt(u);
    let k = 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * clamp(0.04 + 0.92 * u, 0, 1)), 0.55);
    if (i === 0 || i === TS) k = 0.03; else if (i === 1) k = 0.3;
    const brown = i <= 1 || i === TS;
    for (let j = 0; j <= RS; j++) {
      const idx = i * (RS + 1) + j;
      pos.setXYZ(idx, c.x + (pos.getX(idx) - c.x) * k, c.y + (pos.getY(idx) - c.y) * k, c.z + (pos.getZ(idx) - c.z) * k * 0.92);
      col[idx * 3] = brown ? 0.5 : 1; col[idx * 3 + 1] = brown ? 0.33 : 0.82; col[idx * 3 + 2] = brown ? 0.14 : 0.2;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return softG(g);
}

// Collects many transformed shapes into one mesh's worth of triangles (one draw call).
class GeoBuilder {
  constructor(withColor) {
    this.n = 0; this.cap = 4096;
    this.p = new Float32Array(this.cap * 3);
    this.nm = new Float32Array(this.cap * 3);
    this.c = withColor === false ? null : new Float32Array(this.cap * 3);
  }
  _grow(need) {
    if (this.n + need <= this.cap) return;
    let cap = this.cap;
    while (this.n + need > cap) cap *= 2;
    const grow = (a) => { const b = new Float32Array(cap * 3); b.set(a.subarray(0, this.n * 3)); return b; };
    this.p = grow(this.p); this.nm = grow(this.nm);
    if (this.c) this.c = grow(this.c);
    this.cap = cap;
  }
  // color: hex number or [r,g,b]. Returns [firstVertex, endVertex] so the piece can be hidden later.
  add(geo, m, color) {
    const src = geo.attributes.position.array, sn = geo.attributes.normal.array, cnt = geo.attributes.position.count;
    const sc = geo.attributes.color ? geo.attributes.color.array : null;
    this._grow(cnt);
    let r = 1, g = 1, b = 1;
    if (this.c && color !== undefined) {
      if (typeof color === 'number') { _c.setHex(color); r = _c.r; g = _c.g; b = _c.b; } else { r = color[0]; g = color[1]; b = color[2]; }
    }
    const e = m.elements;
    _n3.getNormalMatrix(m);
    const ne = _n3.elements, P = this.p, N = this.nm, C = this.c;
    let o = this.n * 3;
    for (let i = 0, k = 0; i < cnt; i++, k += 3, o += 3) {
      const x = src[k], y = src[k + 1], z = src[k + 2];
      P[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
      P[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      P[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = sn[k], ny = sn[k + 1], nz = sn[k + 2];
      const ax = ne[0] * nx + ne[3] * ny + ne[6] * nz, ay = ne[1] * nx + ne[4] * ny + ne[7] * nz, az = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      const l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
      N[o] = ax / l; N[o + 1] = ay / l; N[o + 2] = az / l;
      if (C) {
        if (sc) { C[o] = sc[k] * r; C[o + 1] = sc[k + 1] * g; C[o + 2] = sc[k + 2] * b; } else { C[o] = r; C[o + 1] = g; C[o + 2] = b; }
      }
    }
    const start = this.n;
    this.n += cnt;
    return [start, this.n];
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, this.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nm.slice(0, this.n * 3), 3));
    if (this.c) g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, this.n * 3), 3));
    g.computeBoundingSphere();
    return g;
  }
}

// Brightness-scaled copy of a hex colour, as [r,g,b].
function shade(hex, k) { _c.setHex(hex); return [_c.r * k, _c.g * k, _c.b * k]; }

// Ink outline: the same shape pushed out along its normals and drawn inside-out.
function outlineOf(geo, t) {
  const p = geo.attributes.position.array, n = geo.attributes.normal.array, out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = p[i] + n[i] * t;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeBoundingSphere();
  return g;
}

function gradTex(stops) {
  const n = stops.length, d = new Uint8Array(n * 4);
  stops.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, n, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

const INK = 0x3a1e14;
const GRAD_CHAR = gradTex([168, 168, 218, 255]);
const GRAD_ENV = gradTex([150, 186, 226, 255]);
const MAT = {
  char: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD_CHAR }),
  env: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD_ENV }),
  gold: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD_CHAR, emissive: 0x5a3c00 }),
  midas: new THREE.MeshToonMaterial({ color: 0xffc21f, gradientMap: GRAD_CHAR, emissive: 0x4d3000 }), // what a character wears in place of `char` while the Golden Banana has him: solid gold
  ink: new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  eye: new THREE.MeshBasicMaterial({ color: 0x1f0f09 }),
  white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x1a0d08, transparent: true, opacity: 0.27, depthWrite: false }),
};
const GEO = {
  banana: makeBananaGeo(),
  disc: new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2),
};
GEO.bananaInk = outlineOf(GEO.banana, 0.022);

function toonPart(gb, t, mat) {
  const geo = gb.build();
  const mesh = new THREE.Mesh(geo, mat || MAT.char);
  if (t !== 0) mesh.add(new THREE.Mesh(outlineOf(geo, t || 0.024), MAT.ink));
  return mesh;
}
function disposeTree(obj) {
  obj.traverse((o) => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); });
}

// A tube whose radius runs from r0 to r1 along a smooth path (trunks, tails).
function taperTube(points, segs, r0, r1, radial) {
  const rs = radial || 8, curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, segs, 1, rs, false), pos = g.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, c = curve.getPointAt(u), r = lerp(r0, r1, u);
    for (let j = 0; j <= rs; j++) {
      const idx = i * (rs + 1) + j;
      pos.setXYZ(idx, c.x + (pos.getX(idx) - c.x) * r, c.y + (pos.getY(idx) - c.y) * r, c.z + (pos.getZ(idx) - c.z) * r);
    }
  }
  return softG(g);
}
