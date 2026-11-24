// ───────────────────────── sound: all synthesized, nothing downloaded ─────────────────────────
const Sound = (() => {
  const AIR_HZ = 18000, SEA_HZ = 1700;
  let ctx = null, master, sfxBus, musBus, musFilter, seaFilter, noiseBuf, rumbleGain = null;
  let sfxOn = true, musicOn = true, muffled = false, hushed = false, undersea = false, rebuilds = 0, rumbleV = -1;
  // Glide a volume to a new level. Old automation is cleared first: left to pile up (one event per frame),
  // it slowly chokes the audio engine on iPhones until the sound cuts out.
  function glide(param, v, tc) {
    const t = ctx.currentTime;
    try {
      if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
      else { const cur = param.value; param.cancelScheduledValues(t); param.setValueAtTime(cur, t); }
    } catch (e) { /* older engines */ }
    param.setTargetAtTime(v, t, tc);
  }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    master = ctx.createGain(); master.gain.value = 0.9;
    seaFilter = ctx.createBiquadFilter(); seaFilter.type = 'lowpass'; seaFilter.Q.value = 0.4; seaFilter.frequency.value = undersea ? SEA_HZ : AIR_HZ; // everything goes dull under water
    master.connect(seaFilter);
    let out = seaFilter;
    try {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
      seaFilter.connect(comp); out = comp;
    } catch (e) { /* no compressor, fine */ }
    out.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
    musFilter = ctx.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 12000; musFilter.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 0.5; musBus.connect(musFilter);
    const len = Math.floor(ctx.sampleRate * 1.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (hushed) master.gain.value = 0;
    musBus.gain.value = musicOn ? (muffled ? 0.28 : 0.5) : 0;
    return true;
  }
  // Throw the audio engine away and start a new one (used if it gets stuck or was closed).
  function rebuild() {
    const hadMusic = music.on;
    stopMusic();
    try { if (ctx && ctx.state !== 'closed') ctx.close(); } catch (e) { /* ignore */ }
    ctx = null; rumbleGain = null; jetGain = null; jetOn = 0; rumbleV = -1;
    if (init() && hadMusic) startMusic();
  }
  // Call from any tap or key press: browsers only let sound start (or restart) from one.
  function unlock() {
    if (ctx && ctx.state === 'closed') rebuild();
    if (!init()) return;
    if (ctx.state !== 'running') {
      try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
      const mine = ctx;
      setTimeout(() => { if (ctx === mine && ctx.state !== 'running' && rebuilds < 2) { rebuilds++; rebuild(); } }, 700);
    }
  }

  function toneAt(t, type, f0, f1, dur, vol, bus, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.03);
  }
  function hissAt(t, dur, vol, ftype, f0, f1, q, bus) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.03);
  }
  const live = () => ctx && sfxOn && ctx.state === 'running';
  const tone = (type, f0, f1, dur, vol, delay) => { if (live()) toneAt(ctx.currentTime + (delay || 0), type, f0, f1, dur, vol, sfxBus); };
  const hiss = (dur, vol, ftype, f0, f1, q, delay) => { if (live()) hissAt(ctx.currentTime + (delay || 0), dur, vol, ftype, f0, f1, q, sfxBus); };
  function boing(delay) {
    if (!live()) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(430, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.6);
    l.frequency.value = 26; lg.gain.setValueAtTime(140, t); lg.gain.exponentialRampToValueAtTime(8, t + 0.6);
    l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(g); g.connect(sfxBus); o.start(t); l.start(t); o.stop(t + 0.7); l.stop(t + 0.7);
  }


  const semi = (f, s) => f * Math.pow(2, s / 12);
  const sfx = {
    level() { [0, 7, 12, 19].forEach((s, i) => { const f = semi(440, s); tone('triangle', f, f, 0.17, 0.3, i * 0.07); }); tone('sine', 880, 1760, 0.32, 0.15, 0.28); },
    tide(rising) { hiss(2.0, 0.5, 'lowpass', rising ? 260 : 1900, rising ? 2300 : 300, 0.6); tone('sine', rising ? 62 : 120, rising ? 130 : 58, 1.6, 0.4); },
    plunge(under) {
      hiss(0.5, 0.55, 'lowpass', 2600, 380, 0.6);
      if (under) for (let i = 0; i < 5; i++) { const f = 420 + Math.random() * 500; tone('sine', f, f * 2, 0.09, 0.2, 0.08 + i * 0.07); }
    },
    bloop() { const f = 380 + Math.random() * 520; tone('sine', f, f * 1.9, 0.1, 0.11); },
    clam() { tone('square', 840, 250, 0.055, 0.2); tone('square', 620, 190, 0.07, 0.18, 0.1); hiss(0.07, 0.22, 'bandpass', 1900, 700, 1.3); }, // a shell clacking shut, twice
    shark() { tone('sine', 104, 58, 0.55, 0.5); tone('triangle', 208, 96, 0.4, 0.14, 0.03); hiss(0.6, 0.2, 'lowpass', 520, 110, 0.7); },           // something big coming through the water
    boop() { tone('sine', 260, 620, 0.12, 0.6); tone('triangle', 520, 1240, 0.1, 0.16, 0.01); boing(0.06); hiss(0.25, 0.4, 'lowpass', 1400, 300, 0.7); },
    jump() { tone('sine', 310, 660, 0.19, 0.5); tone('triangle', 620, 1100, 0.12, 0.12, 0.02); },
    spring() { tone('sine', 250, 900, 0.27, 0.5); tone('triangle', 500, 1500, 0.2, 0.14, 0.02); boing(0.02); },
    rocket() { hiss(0.9, 0.7, 'bandpass', 500, 3200, 0.7); tone('sawtooth', 110, 340, 0.6, 0.22); },
    land() { tone('sine', 150, 62, 0.11, 0.5); hiss(0.07, 0.22, 'lowpass', 900, 300, 0.7); },
    slide() { hiss(0.45, 0.4, 'bandpass', 2400, 600, 0.9); },
    lane() { hiss(0.11, 0.2, 'bandpass', 1300, 2600, 1.4); },
    turn() { hiss(0.22, 0.36, 'bandpass', 700, 2600, 1.0); },
    banana(n) {
      const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      const f = semi(659.25, steps[Math.min(n, steps.length - 1)]);
      tone('triangle', f, f, 0.15, 0.3); tone('sine', f * 2, f * 2, 0.24, 0.2, 0.04);
    },
    power() { [0, 4, 7, 12, 16].forEach((s, i) => { const f = semi(523.25, s); tone('triangle', f, f, 0.2, 0.3, i * 0.065); }); },
    powerEnd() { tone('triangle', 660, 330, 0.25, 0.22); },
    stumble() { tone('sawtooth', 260, 85, 0.24, 0.3); hiss(0.18, 0.5, 'lowpass', 800, 200, 0.7); },
    pad() { tone('sine', 170, 640, 0.26, 0.55); tone('triangle', 340, 1280, 0.2, 0.14, 0.02); boing(0.01); }, // a fat springy mushroom
    jet() { hiss(0.42, 0.5, 'bandpass', 420, 2600, 0.8); for (let i = 0; i < 4; i++) { const f = 300 + i * 170; tone('sine', f, f * 2, 0.09, 0.2, i * 0.045); } }, // a column of bubbles taking him up
    zap() { tone('sawtooth', 1500, 320, 0.12, 0.24); tone('square', 900, 1900, 0.05, 0.1, 0.05); hiss(0.1, 0.22, 'highpass', 3000, 7000, 0.8); }, // a jellyfish's sting
    thud() { tone('sine', 150, 68, 0.11, 0.4); hiss(0.05, 0.12, 'lowpass', 600, 200, 0.7); }, // shouldering a wall that will not move
    bonk() { tone('sine', 200, 52, 0.32, 1.0); tone('square', 880, 440, 0.07, 0.16); hiss(0.13, 0.7, 'lowpass', 1800, 300, 0.7); boing(0.1); },
    whistle() { tone('sine', 1500, 230, 1.05, 0.3); },
    splash() { hiss(0.55, 0.7, 'lowpass', 3000, 350, 0.6); tone('sine', 430, 100, 0.25, 0.45); },
    splat() { hiss(0.2, 0.8, 'lowpass', 900, 140, 0.7); tone('sine', 130, 38, 0.35, 1.0); tone('sawtooth', 500, 90, 0.16, 0.2, 0.02); },
    smash() {
      hiss(0.3, 0.8, 'lowpass', 2500, 300, 0.6); tone('sine', 180, 60, 0.2, 0.7);
      for (let i = 0; i < 4; i++) tone('triangle', 300 + Math.random() * 500, 120, 0.09, 0.2, 0.05 + i * 0.045);
    },
    pop() { tone('sine', 900, 180, 0.12, 0.5); hiss(0.08, 0.3, 'highpass', 3000, 6000, 0.7); },
    click() { tone('triangle', 700, 980, 0.07, 0.3); },
    rumbleStart() { hiss(0.9, 0.6, 'lowpass', 90, 220, 0.6); tone('sine', 55, 75, 0.8, 0.5); },
    tick() { tone('triangle', 880, 880, 0.09, 0.3); },
    go() { tone('triangle', 1175, 1175, 0.22, 0.34); },
    best() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { const f = semi(392, s); tone('triangle', f, f, 0.22, 0.26, i * 0.08); }); },
    step(alt) { hiss(0.035, 0.07, 'lowpass', alt ? 520 : 440, 200, 0.6); },
    swish(alt) { hiss(0.17, 0.05, 'bandpass', alt ? 780 : 640, 320, 0.8); }, // one stroke of a tail
  };

  // The boulder: a low rumble that swells when it is on your heels.
  function startRumble() {
    if (!ctx || rumbleGain) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150;
    rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;
    s.connect(lp); lp.connect(rumbleGain); rumbleGain.connect(sfxBus); s.start();
  }
  function rumble(v) { // called every frame, so only touch the audio graph when the level really changes
    if (!ctx) return;
    const q = sfxOn ? Math.round(v * 16) / 16 : 0;
    if (q === rumbleV) return;
    if (!rumbleGain) { if (q === 0) return; startRumble(); }
    rumbleV = q;
    glide(rumbleGain.gain, q, 0.1);
  }
  let jetGain = null, jetOn = 0;
  function jet(v) { // the rocket's roar
    if (!ctx || v === jetOn) return;
    if (!jetGain) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 780; bp.Q.value = 0.6;
      jetGain = ctx.createGain(); jetGain.gain.value = 0;
      s.connect(bp); bp.connect(jetGain); jetGain.connect(sfxBus); s.start();
    }
    jetOn = v;
    glide(jetGain.gain, sfxOn ? v : 0, 0.12);
  }

  // ── music: an original marimba loop, scheduled a few notes ahead ──
  const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CH = { C: [60, 64, 67], Am: [57, 60, 64], F: [53, 57, 60], G: [55, 59, 62], Dm: [50, 53, 57] };
  const ROOT = { C: 48, Am: 45, F: 41, G: 43, Dm: 50 };
  const BARS = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'];
  const ARP = [[0, 0, 0], [2, 1, 0], [3, 2, 0], [5, 1, 0], [6, 0, 12], [8, 2, 0], [10, 1, 0], [11, 0, 12], [13, 2, 0], [14, 1, 0]];
  const BASS = [[0, 0], [3, 0], [6, 7], [8, 0], [11, 0], [14, 7]];
  const LEAD = [
    [[0, 76, 3], [4, 79, 2], [6, 76, 2], [8, 72, 4], [12, 74, 2], [14, 76, 2]],
    [[0, 76, 6], [8, 72, 2], [10, 69, 2], [12, 72, 4]],
    [[0, 77, 3], [4, 81, 2], [6, 77, 2], [8, 72, 4], [12, 74, 2], [14, 77, 2]],
    [[0, 74, 6], [8, 71, 2], [10, 74, 2], [12, 79, 4]],
    [[0, 79, 3], [4, 76, 2], [6, 72, 2], [8, 76, 4], [12, 79, 2], [14, 84, 2]],
    [[0, 81, 4], [4, 76, 4], [8, 72, 4], [12, 76, 4]],
    [[0, 77, 3], [4, 74, 2], [6, 77, 2], [8, 81, 4], [12, 77, 2], [14, 74, 2]],
    [[0, 79, 4], [4, 74, 4], [8, 71, 4], [12, 67, 4]],
  ];
  const music = { on: false, step: 0, next: 0, bpm: 114, timer: null };
  function schedule(step, t) {
    const loop = Math.floor(step / 128) % 2, bar = Math.floor(step / 16) % 8, s = step % 16;
    const name = BARS[bar], ch = CH[name], sd = 60 / music.bpm / 4;
    if (s === 0 || s === 8) toneAt(t, 'sine', 150, 48, 0.13, 0.7, musBus, 0.003);
    if (s % 2 === 0) hissAt(t, 0.035, s % 4 === 2 ? 0.16 : 0.07, 'highpass', 7000, 7000, 0.7, musBus);
    if (s === 0 || s === 3 || s === 6 || s === 10 || s === 12) toneAt(t, 'sine', 1180, 1180, 0.05, 0.14, musBus, 0.002);
    for (const b of BASS) if (b[0] === s) { const f = mf(ROOT[name] + b[1]); toneAt(t, 'triangle', f, f, sd * 2.6, 0.5, musBus, 0.01); toneAt(t, 'sine', f * 2, f * 2, sd * 2.6, 0.16, musBus, 0.01); }
    for (const a of ARP) if (a[0] === s) { const f = mf(ch[a[1]] + 12 + a[2]); toneAt(t, 'sine', f, f, 0.32, 0.2, musBus, 0.004); toneAt(t, 'sine', f * 4, f * 4, 0.09, 0.055, musBus, 0.002); }
    if (loop === 0) for (const n of LEAD[bar]) if (n[0] === s) { const f = mf(n[1]); toneAt(t, 'triangle', f, f, sd * n[2] * 1.3, 0.2, musBus, 0.012); toneAt(t, 'sine', f * 2, f * 2, sd * n[2] * 0.8, 0.05, musBus, 0.01); }
  }
  function tick() {
    if (!ctx || !music.on || hushed || ctx.state !== 'running') return;
    const sd = 60 / music.bpm / 4;
    if (music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
    while (music.next < ctx.currentTime + 0.16) {
      if (musicOn) schedule(music.step, music.next);
      music.next += sd; music.step = (music.step + 1) % 256;
    }
  }
  function startMusic() {
    if (!ctx || music.on) return;
    music.on = true; music.step = 0; music.next = ctx.currentTime + 0.08;
    music.timer = setInterval(tick, 40);
  }
  function stopMusic() { music.on = false; if (music.timer) clearInterval(music.timer); music.timer = null; }
  function applyMusicGain() {
    if (!ctx) return;
    glide(musBus.gain, musicOn ? (muffled ? 0.28 : 0.5) : 0, 0.08);
    glide(musFilter.frequency, muffled ? 650 : 12000, 0.12);
  }

  window.addEventListener('pagehide', () => { try { if (ctx && ctx.state !== 'closed') ctx.close(); } catch (e) { /* ignore */ } });

  return {
    unlock, sfx, startMusic, stopMusic, rumble, jet,
    tempo(b) { music.bpm = b; },
    muffle(on) { muffled = on; applyMusicGain(); },
    sea(on) { if (on === undersea) return; undersea = on; if (ctx) glide(seaFilter.frequency, on ? SEA_HZ : AIR_HZ, 0.12); },
    setSfx(on) { sfxOn = on; if (!on && ctx) { if (rumbleGain) { glide(rumbleGain.gain, 0, 0.05); rumbleV = 0; } if (jetGain) { glide(jetGain.gain, 0, 0.05); jetOn = 0; } } },
    setMusic(on) { musicOn = on; applyMusicGain(); },
    // Pausing fades the master volume instead of suspending the engine: suspend/resume is what tends to get stuck on phones.
    sleep() { hushed = true; if (ctx) glide(master.gain, 0, 0.03); },
    wake() { hushed = false; if (ctx) { glide(master.gain, 0.9, 0.05); music.next = 0; if (ctx.state !== 'running') unlock(); } },
    get state() { return ctx ? ctx.state : 'none'; },
    get running() { return !!ctx && ctx.state === 'running'; },
  };
})();
