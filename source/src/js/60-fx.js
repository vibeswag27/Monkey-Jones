// ───────────────────────── particles ─────────────────────────
class FX {
  constructor(scene) {
    const n = this.max = 380;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.kind = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.ttl = new Float32Array(n);
    this.grav = new Float32Array(n); this.size0 = new Float32Array(n); this.grow = new Float32Array(n); this.a0 = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: 'attribute vec3 aCol; attribute float aSize; attribute float aAlpha; attribute float aKind; varying vec3 vCol; varying float vAlpha; varying float vKind; uniform float uScale;' +
        'void main(){ vCol = aCol; vAlpha = aAlpha; vKind = aKind; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vCol; varying float vAlpha; varying float vKind;' +
        'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a;' +
        ' if (vKind > 1.5) { a = smoothstep(0.5, 0.45, d) * (0.26 + 0.74 * smoothstep(0.27, 0.41, d)); a = max(a, 0.95 * smoothstep(0.13, 0.06, length(c + vec2(0.17, 0.17)))); }' + // a bubble: bright rim, faint middle, one highlight
        ' else if (vKind > 0.5) { a = smoothstep(0.016, 0.004, abs(c.x) * abs(c.y)) * smoothstep(0.5, 0.34, d); } else { a = smoothstep(0.5, 0.43, d); }' +
        ' if (a * vAlpha < 0.02) discard; gl_FragColor = vec4(vCol, a * vAlpha); }',
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 6;
    scene.add(this.points);
    this.next = 0; this.geo = g;
    this.cx = 0; this.cz = 0;
  }
  // Whatever is thrown off from now on is carried along at this speed over the ground as well as its own (0, 0: nothing is).
  // A runner going faster than the camera can dodge sets it to his own speed, so that what he throws off travels with him and is not left hanging for the camera to run into.
  carry(vx, vz) { this.cx = vx; this.cz = vz; }
  spawn(x, y, z, vx, vy, vz, hex, size, ttl, grav, grow, kind, alpha) {
    const i = this.next; this.next = (i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx + this.cx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz + this.cz;
    _c.setHex(hex); this.col[i * 3] = _c.r; this.col[i * 3 + 1] = _c.g; this.col[i * 3 + 2] = _c.b;
    this.size0[i] = size; this.life[i] = ttl; this.ttl[i] = ttl; this.grav[i] = grav || 0; this.grow[i] = grow || 0;
    this.kind[i] = kind || 0; this.a0[i] = alpha === undefined ? 1 : alpha;
  }
  dust(x, y, z, n, hex) {
    for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * 0.6, y + 0.1 + Math.random() * 0.15, z + (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 2.4, 0.5 + Math.random() * 1.3, (Math.random() - 0.5) * 2.4, hex || 0xf3e3c2, 0.3 + Math.random() * 0.25, 0.36 + Math.random() * 0.2, -1, 1.6, 0, 0.85);
  }
  sparkle(x, y, z, n, hex) {
    for (let i = 0; i < n; i++) this.spawn(x, y, z, (Math.random() - 0.5) * 3.4, (Math.random() - 0.2) * 3.4, (Math.random() - 0.5) * 3.4, hex || 0xfff3a8, 0.34 + Math.random() * 0.3, 0.3 + Math.random() * 0.2, 2, -0.6, 1, 1);
  }
  // One star of a trail (under water, one bubble): carried along with its maker, it falls behind him at (bx, bz) and is gone before it reaches the camera.
  trail(x, y, z, bx, bz, hex, bubble) {
    const px = x + (Math.random() - 0.5) * 0.7, pz = z + (Math.random() - 0.5) * 0.7, vx = bx + (Math.random() - 0.5) * 1.2, vz = bz + (Math.random() - 0.5) * 1.2, ttl = 0.24 + Math.random() * 0.12;
    if (bubble) this.spawn(px, y, pz, vx, 0.6 + Math.random() * 1.2, vz, hex, 0.16 + Math.random() * 0.18, ttl, -1.6, 0.45, 2, 0.95);
    else this.spawn(px, y, pz, vx, 0.4 + Math.random() * 1.4, vz, hex, 0.2 + Math.random() * 0.2, ttl, 1.5, -0.5, 1, 1);
  }
  // The pieces of something broken by a runner at speed: flung on ahead of him (by up to ax, az more than whatever carries them) and outwards, and gone in half a second.
  shards(x, y, z, n, hex, ax, az) {
    for (let i = 0; i < n; i++) {
      const k = 0.3 + Math.random() * 0.9;
      this.spawn(x + (Math.random() - 0.5) * 1.2, y + Math.random() * 1.6, z + (Math.random() - 0.5) * 0.8,
        ax * k + (Math.random() - 0.5) * 7, 2 + Math.random() * 6, az * k + (Math.random() - 0.5) * 7, hex, 0.22 + Math.random() * 0.3, 0.45 + Math.random() * 0.25, 20, 0, 0, 1);
    }
  }
  debris(x, y, z, n, hex) {
    for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * 1.2, y + Math.random() * 2, z + (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 9, 2 + Math.random() * 6, (Math.random() - 0.5) * 9, hex, 0.26 + Math.random() * 0.4, 0.7 + Math.random() * 0.4, 20, 0, 0, 1);
  }
  // Bubbles wobble upwards and swell a little as they go.
  bubbles(x, y, z, n, spread, scale) {
    const sp = spread || 0.3, k = scale || 1;
    for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * sp, y + (Math.random() - 0.5) * sp, z + (Math.random() - 0.5) * sp,
      (Math.random() - 0.5) * 0.7, 1.1 + Math.random() * 1.5, (Math.random() - 0.5) * 0.7, 0xeaffff, (0.12 + Math.random() * 0.2) * k, 1.1 + Math.random() * 1.1, -1.6, 0.45, 2, 0.9);
  }
  clear() { this.life.fill(0); this.size.fill(0); this.geo.attributes.aSize.needsUpdate = true; this.cx = this.cz = 0; } // a new run starts with clean, still air
  splash(x, z) {
    for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, r = 1 + Math.random() * 3.5; this.spawn(x, WATER_Y + 0.1, z, Math.cos(a) * r, 5 + Math.random() * 7, Math.sin(a) * r, i % 3 ? 0xffffff : 0xa9f0f2, 0.3 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 17, 0, 0, 0.95); }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; this.spawn(x + Math.cos(a) * 0.5, WATER_Y + 0.12, z + Math.sin(a) * 0.5, Math.cos(a) * 3.2, 0.1, Math.sin(a) * 3.2, 0xffffff, 0.7, 0.9, 0, 1.2, 0, 0.8); }
  }
  update(dt, uScale) {
    this.mat.uniforms.uScale.value = uScale;
    const { pos, vel, life, ttl, size, size0, grow, alpha, a0, grav } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { size[i] = 0; continue; }
      life[i] -= dt;
      const k = Math.max(0, life[i] / ttl[i]);
      vel[i * 3 + 1] -= grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] = Math.max(0, size0[i] * (1 + grow[i] * (1 - k)));
      alpha[i] = a0[i] * Math.min(1, k * 2.2);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true; a.aCol.needsUpdate = true; a.aSize.needsUpdate = true; a.aAlpha.needsUpdate = true; a.aKind.needsUpdate = true;
  }
}
