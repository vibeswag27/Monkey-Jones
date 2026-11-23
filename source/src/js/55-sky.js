// ───────────────────────── sky, light, water and far scenery ─────────────────────────
// The time of day drifts as you run: bright morning → sunset → moonlit night → dawn → …
const BIOMES = [
  { top: 0x2f9bf0, hor: 0xbfeeff, fog: 0xc8eef9, water: 0x21bfc4, sun: 0xfff6dc, sunI: 0.56, sky: 0xf2fbff, gnd: 0xa9c095, hemiI: 0.5, cloud: 0xffffff, mtn: 0x9fd6dc, disc: 0xfff4c2, star: 0 },
  { top: 0x6a4fc4, hor: 0xffb37a, fog: 0xffc49a, water: 0x6f74d4, sun: 0xffc08a, sunI: 0.56, sky: 0xffe0cc, gnd: 0x9a7f9c, hemiI: 0.5, cloud: 0xffd2b4, mtn: 0xd697a4, disc: 0xffd27a, star: 0.12 },
  { top: 0x0a1040, hor: 0x2c4a9c, fog: 0x26418c, water: 0x15307f, sun: 0xb4ccff, sunI: 0.46, sky: 0x86a6f2, gnd: 0x3a4c86, hemiI: 0.58, cloud: 0x5a74c8, mtn: 0x1d2f73, disc: 0xf2f6ff, star: 1 },
  { top: 0x5fa0f0, hor: 0xffd6e6, fog: 0xf9dce6, water: 0x4cc4d0, sun: 0xffe6cc, sunI: 0.56, sky: 0xfff2f6, gnd: 0xa8b89c, hemiI: 0.5, cloud: 0xffe8ee, mtn: 0xb8a8d6, disc: 0xffe9b0, star: 0 },
];
const BIOME_SPAN = 700;

class Sky {
  constructor(scene) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0xc8eef9, 42, 168);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x99aa88, 0.66); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.74); scene.add(this.sun); scene.add(this.sun.target);

    this.domeMat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uFog; varying vec3 vDir; void main(){ float h = normalize(vDir).y; vec3 c = mix(uHor, uTop, pow(clamp(h * 1.3, 0.0, 1.0), 0.8)); c = mix(uFog, c, smoothstep(-0.01, 0.09, h)); gl_FragColor = vec4(c, 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 14), this.domeMat);
    this.dome.frustumCulled = false; this.dome.renderOrder = -10; scene.add(this.dome);

    const rng = makeRng(77);
    // stars
    const sp = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      const a = rng.range(0, TAU), e = Math.asin(rng.range(0.08, 1));
      sp[i * 3] = Math.cos(a) * Math.cos(e) * 860; sp[i * 3 + 1] = Math.sin(e) * 860; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 860;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false; this.stars.renderOrder = -9; scene.add(this.stars);

    // sun / moon
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,1)'); gr.addColorStop(0.34, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this.disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false }));
    this.disc.scale.set(250, 250, 1); this.disc.renderOrder = -8; scene.add(this.disc);
    this.sunDir = new THREE.Vector3(-0.52, 0.4, -0.76).normalize();

    // far scenery rides along with the camera, so it never gets closer
    this.far = new THREE.Group(); scene.add(this.far);
    let gb = new GeoBuilder();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rng.range(-0.1, 0.1), r = 620, h = rng.range(90, 200), w = rng.range(230, 330);
      gb.add(SHAPE.cone, M(Math.cos(a) * r, WATER_Y - 4 + h / 2, Math.sin(a) * r, w, h, w, 0, rng.f() * 3, 0), shade(0xffffff, rng.range(0.94, 1.0)));
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + rng.range(-0.15, 0.15), r = 480, h = rng.range(45, 105), w = rng.range(150, 240);
      gb.add(SHAPE.taper, M(Math.cos(a) * r, WATER_Y - 4 + h / 2, Math.sin(a) * r, w, h, w, 0, rng.f() * 3, 0), shade(0xffffff, rng.range(0.78, 0.86)));
    }
    this.mtnMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    this.far.add(new THREE.Mesh(gb.build(), this.mtnMat));

    gb = new GeoBuilder();
    for (let i = 0; i < 15; i++) {
      const a = rng.range(0, TAU), r = rng.range(260, 540), y = rng.range(75, 185), s = rng.range(34, 62), n = rng.int(3, 5);
      for (let j = 0; j < n; j++) {
        const k = rng.range(0.6, 1.1) * s;
        gb.add(SHAPE.sph, M(Math.cos(a) * r + (j - (n - 1) / 2) * s * 0.52, y + rng.range(-0.1, 0.16) * s, Math.sin(a) * r + rng.range(-0.3, 0.3) * s, k * 1.25, k * 0.62, k), 0xffffff);
      }
    }
    const cg = gb.build(), cc = cg.attributes.color.array, cn = cg.attributes.normal.array;
    for (let i = 0; i < cc.length; i += 3) { const k = 0.8 + 0.2 * clamp(cn[i + 1] * 0.5 + 0.6, 0, 1); cc[i] = cc[i + 1] = cc[i + 2] = k; }
    this.cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    this.clouds = new THREE.Mesh(cg, this.cloudMat); this.far.add(this.clouds);

    this.waterMat = new THREE.MeshBasicMaterial({ color: 0x21bfc4 });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2), this.waterMat);
    this.water.position.y = WATER_Y; scene.add(this.water);

    // streaks of light on the water: they give the height and the speed something to slide against
    this.nGl = 80; this.glSpan = 190;
    this.glints = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, depthWrite: false }), this.nGl);
    this.glints.frustumCulled = false; scene.add(this.glints);
    this.gl = [];
    for (let i = 0; i < this.nGl; i++) this.gl.push({ x: rng.range(0, this.glSpan), z: rng.range(0, this.glSpan), len: rng.range(2, 6), w: rng.range(0.16, 0.3), ph: rng.range(0, TAU), ry: rng.range(-0.3, 0.3) });

    this.cur = {}; this._a = new THREE.Color(); this._b = new THREE.Color();
    this.setBiome(0);
  }

  _mix(key, a, b, t) { return this._a.setHex(a[key]).lerp(this._b.setHex(b[key]), t); }
  setBiome(dist) {
    const p = Math.max(0, dist) / BIOME_SPAN, i = Math.floor(p) % 4, f = p - Math.floor(p);
    const a = BIOMES[i], b = BIOMES[(i + 1) % 4], t = smooth((f - 0.6) / 0.4);
    this.domeMat.uniforms.uTop.value.copy(this._mix('top', a, b, t));
    this.domeMat.uniforms.uHor.value.copy(this._mix('hor', a, b, t));
    this.domeMat.uniforms.uFog.value.copy(this._mix('fog', a, b, t));
    this.scene.fog.color.copy(this._a);
    this.waterMat.color.copy(this._mix('water', a, b, t));
    this.sun.color.copy(this._mix('sun', a, b, t)); this.sun.intensity = lerp(a.sunI, b.sunI, t);
    this.hemi.color.copy(this._mix('sky', a, b, t)); this.hemi.groundColor.copy(this._mix('gnd', a, b, t)); this.hemi.intensity = lerp(a.hemiI, b.hemiI, t);
    this.cloudMat.color.copy(this._mix('cloud', a, b, t));
    this.mtnMat.color.copy(this._mix('mtn', a, b, t));
    this.disc.material.color.copy(this._mix('disc', a, b, t));
    this.stars.material.opacity = lerp(a.star, b.star, t);
    this.stars.visible = this.stars.material.opacity > 0.01;
  }

  update(dt, t, cam) {
    const p = cam.position;
    this.dome.position.copy(p); this.stars.position.copy(p);
    this.far.position.set(p.x, 0, p.z);
    this.clouds.rotation.y += dt * 0.004;
    this.water.position.set(p.x, WATER_Y, p.z);
    this.disc.position.copy(p).addScaledVector(this.sunDir, 800);
    // key light always comes from over the camera's left shoulder, so whatever you look at reads clearly
    cam.getWorldDirection(_v); _v.y = 0; _v.normalize();
    this.sun.target.position.copy(p).addScaledVector(_v, 8);
    this.sun.position.set(p.x - _v.x * 6 + _v.z * 4.5, p.y + 9, p.z - _v.z * 6 - _v.x * 4.5);
    // water glints wrap around the camera
    const span = this.glSpan, half = span / 2, arr = this.glints.instanceMatrix.array;
    for (let i = 0; i < this.nGl; i++) {
      const g = this.gl[i];
      const x = p.x + ((((g.x - p.x) % span) + span) % span) - half, z = p.z + ((((g.z - p.z) % span) + span) % span) - half;
      const k = 0.55 + 0.45 * Math.sin(t * 1.3 + g.ph), len = g.len * k, c = Math.cos(g.ry), s = Math.sin(g.ry), o = i * 16;
      arr[o] = c * len; arr[o + 1] = 0; arr[o + 2] = -s * len; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = s * g.w; arr[o + 9] = 0; arr[o + 10] = c * g.w; arr[o + 11] = 0;
      arr[o + 12] = x; arr[o + 13] = WATER_Y + 0.04; arr[o + 14] = z; arr[o + 15] = 1;
    }
    this.glints.instanceMatrix.needsUpdate = true;
  }
}
