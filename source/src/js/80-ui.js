// ───────────────────────── HUD, menus and input ─────────────────────────
const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const el = {};
  for (const id of ['score', 'mult', 'level', 'bananas', 'nanaChip', 'powers', 'hint', 'hintIcon', 'hintText', 'toast', 'levelUp', 'levelNum', 'levelName', 'best', 'wallet', 'how', 'countNum', 'wipe', 'danger', 'sea', 'plunge',
    'overTitle', 'overSub', 'newBest', 'oScore', 'oDist', 'oLevel', 'oNanas', 'oBest', 'btnRun', 'btnPause', 'btnResume', 'btnRestart', 'btnHome', 'btnHome2', 'btnAgain',
    'btnMusic', 'btnSfx', 'btnMusic2', 'btnSfx2', 'fatalMsg', 'btnShop', 'btnShop2', 'btnShopDone', 'shopList', 'shopWallet',
    'btnChars', 'btnPrev', 'btnNext', 'btnCharGo', 'btnCharDone', 'charName', 'charBlurb', 'charDots', 'charWallet', 'charNeed', 'mapRuins', 'mapTide']) el[id] = $(id);
  const NANA = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5.5 10.5c1.6 8.6 9.3 14.4 20.3 13.3 1.7-.2 1.9-2.3.3-2.8C18.9 18.9 14 14.4 12.2 8 11.8 6.4 9.9 6.2 9 7.4z" fill="#FFD23F" stroke="#3A1E14" stroke-width="2.4" stroke-linejoin="round"/><path d="M9.3 6.8l1.2-3" stroke="#3A1E14" stroke-width="2.8" stroke-linecap="round"/></svg>';
  const touch = !!((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window);
  const last = { score: -1, nanas: -1, mult: -1, level: -1, danger: false, sea: false, popAt: 0 };
  const replay = (node) => { node.classList.remove('on'); void node.offsetWidth; node.classList.add('on'); }; // restart a CSS animation
  const setText = (node, txt) => { node.textContent = txt; if (node.dataset.t !== undefined) node.dataset.t = txt; };

  const ARROW = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27V7M7 15l9-9 9 9" fill="none" stroke="#3A1E14" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const turned = (deg) => '<span style="display:inline-flex;transform:rotate(' + deg + 'deg)">' + ARROW + '</span>';
  const ICON = { up: turned(0), down: turned(180), right: turned(90), both: turned(-90) + turned(90) };
  const PW = {
    magnet: ['Magnet', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v8a6 6 0 0012 0V4" fill="none" stroke="#3A1E14" stroke-width="7" stroke-linecap="butt"/><path d="M6 5v7a6 6 0 0012 0V5" fill="none" stroke="#E8402A" stroke-width="4"/></svg>'],
    double: ['Double', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FFD23F" stroke="#3A1E14" stroke-width="2.4"/><path d="M7.5 9l4 6m0-6l-4 6M13.6 10.2c.4-1.6 3.4-1.6 3.4.3 0 1.5-3.4 2.6-3.4 4.5h3.6" fill="none" stroke="#3A1E14" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
    shield: ['Shield', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#7FE0F5" stroke="#3A1E14" stroke-width="2.4"/><circle cx="9" cy="9" r="2.6" fill="#fff"/></svg>'],
    springs: ['Springs', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20.5l10-2.6L7 15.3l10-2.6L7 10.1l10-2.6L7 4.9" fill="none" stroke="#3A1E14" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 20.5l10-2.6L7 15.3l10-2.6L7 10.1l10-2.6L7 4.9" fill="none" stroke="#6FD93A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
    rocket: ['Rocket', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16.5c-2.2 1.6-2.2 4 0 5.6 2.2-1.6 2.2-4 0-5.6z" fill="#FF8A1F" stroke="#3A1E14" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.6 12.5l-3.2 4.3 3.9-.9zM15.4 12.5l3.2 4.3-3.9-.9z" fill="#E8402A" stroke="#3A1E14" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 1.8c4 3.6 5 9.4 3.4 14.6H8.6C7 11.2 8 5.4 12 1.8z" fill="#FFF2DC" stroke="#3A1E14" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="8.8" r="2" fill="#5FD6F2" stroke="#3A1E14" stroke-width="1.4"/></svg>'],
  };
  const pw = {};
  for (const kind in PW) {
    const d = document.createElement('div');
    d.className = 'pw'; d.style.display = 'none';
    d.innerHTML = PW[kind][1] + '<span>' + PW[kind][0] + '</span><span class="bar"><i></i></span>';
    el.powers.appendChild(d);
    pw[kind] = { d, bar: d.querySelector('i'), on: false };
  }
  function setPower(kind, frac) {
    const p = pw[kind], on = frac > 0;
    if (on !== p.on) { p.on = on; p.d.style.display = on ? '' : 'none'; }
    if (on && p.bar) p.bar.style.transform = 'scaleX(' + clamp(frac, 0, 1).toFixed(3) + ')';
  }

  let countTimers = [];
  // (name, the character) → what the card says. Swimmers get their own wording where running or sinking would be odd.
  const OVER = {
    bonk: ['Bonk!', (n, c) => n + (c.swims ? ' swam' : ' ran') + ' face-first into the ruins.'],
    fall: ['Splash!', (n) => n + ' went for a swim.'],
    flat: ['Flattened!', (n) => 'The boulder caught up with ' + n + '.'],
    sink: ['Glub!', (n, c) => (c.swims ? 'The undertow pulled ' + n + ' down.' : n + ' sank to the sea bed.')],
    boop: ['Booped!', (n, c) => (c.orca ? 'A much bigger orca' : 'The orca') + ' caught up with ' + n + '.'],
  };
  let browseAt = 0;
  const cast = () => CHAR_ORDER.filter((k) => !CHARS[k].sea || atSea()); // who can be picked for the level that is chosen: the seal and the orca only show up in High Tide

  const api = {
    touch,
    setState(s) { stage.dataset.state = s; },
    fatal(msg) { if (msg) el.fatalMsg.textContent = msg; stage.dataset.state = 'fatal'; },
    refreshTitle() {
      el.best.textContent = fmt(Save.data.best); el.wallet.textContent = fmt(Save.data.wallet);
      setText(el.how, touch ? 'Swipe to dodge, jump and slide' : 'Arrow keys to dodge, jump and slide');
      el.mapRuins.setAttribute('aria-checked', String(Save.data.map !== 'tide')); el.mapTide.setAttribute('aria-checked', String(Save.data.map === 'tide'));
      api.syncToggles();
    },
    syncToggles() {
      for (const b of [el.btnMusic, el.btnMusic2]) b.setAttribute('aria-pressed', String(!!Save.data.music));
      for (const b of [el.btnSfx, el.btnSfx2]) b.setAttribute('aria-pressed', String(!!Save.data.sfx));
      Sound.setMusic(!!Save.data.music); Sound.setSfx(!!Save.data.sfx);
    },
    hud(run, force) {
      const sc = Math.floor(run.score);
      if (force || sc !== last.score) { last.score = sc; setText(el.score, fmt(sc)); }
      if (force || run.nanas !== last.nanas) { last.nanas = run.nanas; el.bananas.textContent = fmt(run.nanas); }
      const m = run.mult * (run.dbl > 0 ? 2 : 1);
      if (force || m !== last.mult) { last.mult = m; el.mult.textContent = '×' + m; }
      if (force || run.level !== last.level) { last.level = run.level; el.level.textContent = 'Level ' + run.level; }
      const mx = run.max;
      setPower('magnet', run.magnet / mx.magnet); setPower('double', run.dbl / mx.double); setPower('shield', run.shield ? run.shieldT / mx.shield : 0);
      setPower('springs', run.springs / mx.springs); setPower('rocket', Player.flying ? Math.max(0.03, run.rocket / mx.rocket) : 0);
    },
    popBananas() {
      const now = performance.now();
      if (now - last.popAt < 130 || !el.nanaChip.animate) return;
      last.popAt = now;
      el.nanaChip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 160 });
    },
    danger(on) { if (on !== last.danger) { last.danger = on; el.danger.classList.toggle('on', on); } },
    hint(h) {
      if (!h) { el.hint.classList.remove('on'); return; }
      el.hintIcon.innerHTML = ICON[h.icon]; el.hintIcon.style.display = 'inline-flex';
      el.hintText.textContent = h.text[touch ? 0 : 1];
      el.hint.classList.add('on');
    },
    toast(text) { setText(el.toast, text); replay(el.toast); },
    // A new level: its number, and what kind of place it is.
    levelUp(n) {
      setText(el.levelNum, 'Level ' + n); el.levelName.textContent = levelName(n);
      el.levelUp.classList.toggle('sea', atSea());
      replay(el.levelUp);
    },
    sea(on) { if (on !== last.sea) { last.sea = on; el.sea.classList.toggle('on', on); } }, // the edges of the screen darken under water
    plunge(bright) { el.plunge.style.filter = bright < 0.95 ? 'brightness(' + (0.25 + 0.75 * bright).toFixed(2) + ')' : ''; replay(el.plunge); }, // a wash of foam as the surface passes the camera (dimmer at night)
    showOver(type, score, run, best) {
      const o = OVER[type] || OVER.bonk;
      setText(el.overTitle, o[0]); el.overSub.textContent = o[1](monkey.spec.name, monkey);
      el.newBest.classList.toggle('on', !!best);
      el.oScore.textContent = fmt(score); el.oDist.textContent = fmt(run.dist) + ' m'; el.oLevel.textContent = run.level; el.oNanas.textContent = fmt(run.nanas); el.oBest.textContent = fmt(Save.data.best);
      api.setState('over');
      setTimeout(() => { if (stage.dataset.state === 'over') { try { el.btnAgain.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 300);
    },
    // Choosing where to run: the home screen is rebuilt behind a quick wipe, so it shows the place you picked.
    pickMap(id) {
      if (!MAPS[id] || Save.data.map === id || Game.state !== 'title') return;
      Save.data.map = id; Save.store();
      api.wipe(() => Game.toTitle());
    },
    // Upgrade shop: bananas buy the next level of a power-up.
    openShop() { api.renderShop(); api.setState('shop'); },
    renderShop() {
      const w = Save.data.wallet, sec = (t) => t + ' s';
      el.shopWallet.textContent = fmt(w);
      el.shopList.innerHTML = POWER_KINDS.map((k) => {
        const p = POWERS[k], lv = Save.data.up[k], top = lv >= MAX_LEVEL, cost = top ? 0 : UP_COST[lv - 1];
        const pips = p.t.map((_, i) => '<i' + (i < lv ? ' class="on"' : '') + '></i>').join('');
        const note = 'Lasts ' + sec(p.t[lv - 1]) + (top ? '' : ', next level ' + sec(p.t[lv]));
        const btn = top ? '<span class="maxed">Max</span>'
          : '<button class="buy" data-kind="' + k + '"' + (w < cost ? ' disabled' : '') + ' aria-label="Upgrade ' + p.name + ' for ' + cost + ' bananas">' + NANA + fmt(cost) + '</button>';
        return '<li class="up"><span class="up-ico">' + PW[k][1] + '</span><div class="up-main"><div class="up-name">' + p.name + '</div>' +
          '<div class="up-blurb">' + p.blurb + '</div><div class="pips" role="img" aria-label="Level ' + lv + ' of ' + MAX_LEVEL + '">' + pips + '</div><div class="up-note">' + note + '</div></div>' + btn + '</li>';
      }).join('');
    },
    buy(k) {
      const d = Save.data, lv = d.up[k];
      if (!POWERS[k] || lv >= MAX_LEVEL || d.wallet < UP_COST[lv - 1]) return;
      d.wallet -= UP_COST[lv - 1]; d.up[k] = lv + 1; Save.store();
      Sound.sfx.power(); api.renderShop();
    },
    // Characters: flick through the real models, unlock with bananas, choose who runs.
    openChars() { browseAt = Math.max(0, cast().indexOf(runner())); api.setState('chars'); api.renderChars(); Cam.to(Cam.preset('chars'), 6); },
    browse(d) { const n = cast().length; browseAt = (browseAt + d + n) % n; Sound.sfx.lane(); api.renderChars(); },
    renderChars() {
      const list = cast(), id = list[browseAt], c = CHARS[id], d = Save.data, owned = owns(id), free = FREE_CAST.includes(id) && !d.owned.includes(id), b = el.btnCharGo;
      if (monkey.id !== id) { Roster.use(id); monkey.holdBanana(true); monkey.bounce(1.18); }
      setText(el.charName, c.name); setText(el.charBlurb, c.blurb);
      el.charWallet.textContent = fmt(d.wallet);
      el.charDots.innerHTML = list.map((k, i) => '<i class="' + (i === browseAt ? 'on' : '') + (owns(k) ? '' : ' locked') + '"></i>').join('');
      if (runner() === id) { b.textContent = 'Selected'; b.disabled = true; }
      else if (owned) { b.textContent = 'Play as ' + c.name; b.disabled = false; }
      else { b.innerHTML = 'Unlock ' + NANA + fmt(c.cost); b.disabled = d.wallet < c.cost; }
      setText(el.charNeed, !owned && d.wallet < c.cost ? 'Collect ' + fmt(c.cost - d.wallet) + ' more bananas to unlock'
        : c.sea ? 'High Tide only' + (free ? ' · free for testing' : '') : free ? 'Free for testing' : '');
    },
    charGo() {
      const id = cast()[browseAt], c = CHARS[id], d = Save.data;
      if (runner() === id) return;
      if (!owns(id)) {
        if (d.wallet < c.cost) return;
        d.wallet -= c.cost; d.owned.push(id); Save.fixCast();
        Sound.sfx.best(); monkey.setExpr('happy', 1.4); monkey.bounce(1.4);
        fx.sparkle(Player.wx, 1.1, Player.wz, 26, 0xfff3a8);
      } else Sound.sfx.power();
      // The seal and the orca are picked for High Tide alone. Anyone else becomes the runner everywhere (and, picked in High Tide, takes over there too).
      if (c.sea) d.seaChar = id; else { d.char = id; if (atSea()) d.seaChar = null; }
      Save.store(); api.renderChars();
    },
    closeChars() { Roster.use(runner()); monkey.holdBanana(true); api.refreshTitle(); api.setState('title'); Cam.to(Cam.preset('title'), 6); },
    stopCount() { countTimers.forEach(clearTimeout); countTimers = []; el.countNum.classList.remove('on'); },
    countdown(done) {
      api.stopCount();
      const show = (n) => { setText(el.countNum, String(n)); el.countNum.classList.remove('on'); void el.countNum.offsetWidth; el.countNum.classList.add('on'); Sound.sfx.tick(); };
      show(3);
      countTimers.push(setTimeout(() => show(2), 500), setTimeout(() => show(1), 1000), setTimeout(() => { el.countNum.classList.remove('on'); Sound.sfx.go(); done(); }, 1500));
    },
    wipe(fn) {
      el.wipe.classList.add('on');
      setTimeout(() => { fn(); requestAnimationFrame(() => requestAnimationFrame(() => el.wipe.classList.remove('on'))); }, 180);
    },

    init() {
      const press = (b, fn) => b.addEventListener('click', (e) => { e.preventDefault(); Sound.unlock(); Sound.sfx.click(); fn(); b.blur(); });
      press(el.btnRun, () => Game.startIntro(false));
      press(el.btnPause, () => Game.pause());
      press(el.btnResume, () => Game.resume());
      press(el.btnRestart, () => api.wipe(() => Game.restart()));
      press(el.btnAgain, () => api.wipe(() => Game.restart()));
      press(el.btnHome, () => api.wipe(() => Game.toTitle()));
      press(el.btnHome2, () => api.wipe(() => Game.toTitle()));
      press(el.btnShop, () => api.openShop());
      press(el.btnShop2, () => api.wipe(() => { Game.toTitle(); api.openShop(); }));
      press(el.btnShopDone, () => { api.refreshTitle(); api.setState('title'); });
      press(el.btnChars, () => api.openChars());
      press(el.mapRuins, () => api.pickMap('ruins')); press(el.mapTide, () => api.pickMap('tide'));
      press(el.btnCharDone, () => api.closeChars());
      el.btnPrev.addEventListener('click', () => { Sound.unlock(); api.browse(-1); });
      el.btnNext.addEventListener('click', () => { Sound.unlock(); api.browse(1); });
      el.btnCharGo.addEventListener('click', () => { Sound.unlock(); api.charGo(); });
      el.shopList.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.buy'); if (b && !b.disabled) { Sound.unlock(); api.buy(b.dataset.kind); } });
      const flip = (key) => () => { Save.data[key] = !Save.data[key]; Save.store(); api.syncToggles(); };
      press(el.btnMusic, flip('music')); press(el.btnMusic2, flip('music'));
      press(el.btnSfx, flip('sfx')); press(el.btnSfx2, flip('sfx'));

      // swipes (touch, pen or a mouse drag)
      let ptr = null;
      stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest && e.target.closest('button, .card')) return;
        ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
      });
      stage.addEventListener('pointermove', (e) => { // one swipe = one move, however long the swipe is
        if (!ptr || e.pointerId !== ptr.id || ptr.fired) return;
        const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
        if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
        ptr.fired = true;
        if (stage.dataset.state === 'chars') { if (Math.abs(dx) > Math.abs(dy)) api.browse(dx < 0 ? 1 : -1); return; }
        Game.input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      });
      const end = (e) => { if (ptr && e.pointerId === ptr.id) ptr = null; Sound.unlock(); };
      stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
      for (const ev of ['touchend', 'click']) document.addEventListener(ev, () => Sound.unlock(), true); // any tap can bring sound back
      stage.addEventListener('touchmove', (e) => { if (!(e.target.closest && e.target.closest('.shop'))) e.preventDefault(); }, { passive: false });
      for (const ev of ['contextmenu', 'gesturestart', 'dblclick']) stage.addEventListener(ev, (e) => e.preventDefault());

      const KEYS = { ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
      window.addEventListener('keydown', (e) => {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        Sound.unlock();
        const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
        const st = Game.state, shop = stage.dataset.state === 'shop';
        if (shop) { if (e.code === 'Escape') { api.refreshTitle(); api.setState('title'); e.preventDefault(); } return; }
        if (stage.dataset.state === 'chars') {
          if (e.code === 'Escape') api.closeChars(); else if (e.code === 'ArrowLeft' || e.code === 'KeyA') api.browse(-1); else if (e.code === 'ArrowRight' || e.code === 'KeyD') api.browse(1);
          else if (e.code === 'Enter' && !onButton) api.charGo(); else return;
          e.preventDefault(); return;
        }
        if (e.code === 'KeyP' || e.code === 'Escape') { if (st === 'run' || st === 'count') Game.pause(); else if (st === 'pause') Game.resume(); e.preventDefault(); return; }
        if (e.code === 'KeyM') { Save.data.music = !Save.data.music; Save.data.sfx = Save.data.music; Save.store(); api.syncToggles(); return; }
        if ((e.code === 'Enter' || e.code === 'Space') && !onButton) {
          if (st === 'title') { Game.startIntro(false); e.preventDefault(); return; }
          if (st === 'over') { api.wipe(() => Game.restart()); e.preventDefault(); return; }
          if (st === 'pause') { Game.resume(); e.preventDefault(); return; }
        }
        if (st === 'title' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { // the levels sit side by side on the home screen
          const to = MAP_ORDER[MAP_ORDER.indexOf(Save.data.map) + (e.code === 'ArrowLeft' ? -1 : 1)];
          if (to) api.pickMap(to);
          e.preventDefault(); return;
        }
        const a = KEYS[e.code];
        if (a && (st === 'run' || st === 'intro')) { Game.input(a); e.preventDefault(); }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (Game.state === 'run' || Game.state === 'count') Game.pause(); Sound.sleep(); }
        else if (Game.state !== 'pause') Sound.wake();
      });
      window.addEventListener('blur', () => { if (Game.state === 'run' || Game.state === 'count') Game.pause(); });
    },
  };
  return api;
})();
