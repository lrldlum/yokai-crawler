'use strict';
/* Title, input, HUD, and the host-or-solo loop. Guests only send inputs. */
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const canvas = $('view');
  let renderer = null;
  let world = null;
  let mode = null; /* solo | host | guest */
  let inGame = false;
  let paused = false;
  let last = performance.now();
  let lastSnap = null;
  let pendingGuest = false;
  let eventBag = [];
  let toastT = 0;
  let hintT = 9;
  let booted = false;
  let bootError = '';
  let lastSample = null;

  const keys = new Set();
  const keyEdges = new Set();
  const tokens = { dash: 0, burst: 0, heal: 0, kunai: 0, use: 0 };
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2, mouseUsed = false;
  let leftDown = false, rightDown = false;
  const touch = { mx: 0, my: 0, slash: 0, beam: 0 };

  const QUEST = [
    ['ford', 'Ford'],
    ['ridge', 'Ridge'],
    ['court', 'Court'],
    ['gate', 'Gate'],
  ];

  function localId() { return mode === 'guest' ? 2 : 1; }

  function show(el, on) { if (el) el.hidden = !on; }

  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!keys.has(e.code)) keyEdges.add(e.code);
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.code === 'KeyM' && keyEdges.has('KeyM')) AudioBus.toggle();
    if (e.code === 'Escape') {
      keyEdges.delete('Escape');
      togglePause();
    }
  });
  window.addEventListener('keyup', function (e) { keys.delete(e.code); });
  window.addEventListener('blur', function () { keys.clear(); leftDown = false; rightDown = false; });
  window.addEventListener('mousemove', function (e) { mouseX = e.clientX; mouseY = e.clientY; mouseUsed = true; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointerdown', function (e) {
    if (e.button === 0) leftDown = true;
    if (e.button === 2) rightDown = true;
    mouseUsed = true;
  });
  window.addEventListener('pointerup', function (e) {
    if (e.button === 0) leftDown = false;
    if (e.button === 2) rightDown = false;
  });

  function down(code) { return keys.has(code); }

  function sample() {
    if (keyEdges.has('ShiftLeft') || keyEdges.has('ShiftRight')) tokens.dash++;
    if (keyEdges.has('Space')) tokens.burst++;
    if (keyEdges.has('KeyF')) tokens.heal++;
    if (keyEdges.has('KeyQ')) tokens.kunai++;
    if (keyEdges.has('KeyE')) tokens.use++;
    keyEdges.clear();
    let mx = (down('KeyD') || down('ArrowRight') ? 1 : 0) - (down('KeyA') || down('ArrowLeft') ? 1 : 0);
    let my = (down('KeyW') || down('ArrowUp') ? 1 : 0) - (down('KeyS') || down('ArrowDown') ? 1 : 0);
    if (touch.mx || touch.my) { mx = touch.mx; my = touch.my; }
    let ax = 0, ay = 0;
    const p = localPlayer();
    if (mouseUsed && p && renderer && inGame) {
      const hit = renderer.aimGround(mouseX, mouseY);
      if (hit) {
        ax = hit.x - p.x;
        ay = hit.y - p.y;
        const L = Math.hypot(ax, ay) || 1;
        ax /= L;
        ay /= L;
      }
    }
    const sampleOut = {
      mx: mx, my: my, ax: ax, ay: ay,
      slash: (leftDown || down('KeyJ') || touch.slash) ? 1 : 0,
      beam: (rightDown || down('KeyK') || touch.beam) ? 1 : 0,
      dash: tokens.dash, burst: tokens.burst, heal: tokens.heal, kunai: tokens.kunai, use: tokens.use,
    };
    lastSample = sampleOut;
    return sampleOut;
  }

  function localPlayer() {
    if (!lastSnap) return world && mode !== 'guest' ? world.player(localId()) : null;
    const ps = lastSnap.players || [];
    for (let i = 0; i < ps.length; i++) if (ps[i].id === localId()) return ps[i];
    return null;
  }

  function shareUrl(code) {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    if (code) u.searchParams.set('room', code);
    return u.toString();
  }

  function setStatus(text) { $('net-status').textContent = text || ''; }

  function boot() {
    try {
      renderer = new YokaiRender(canvas);
      renderer.onEvent = onWorldEvent;
      booted = true;
    } catch (e) {
      bootError = String(e && e.message || e);
      $('net-status').textContent = 'This browser could not start the view. ' + bootError;
      console.error(e);
    }
  }

  function onWorldEvent(e) {
    if (!e) return;
    if (e.k === 'hit') floater(e.x, e.y, String(e.n), e.mag === 'beam' ? '#bff7ff' : e.mag === 'fin' ? '#ffe08a' : '#fff');
    else if (e.k === 'hurt' && e.pid === localId()) {
      floater(e.x, e.y, '-' + e.n, '#ff6b6b');
      $('vignette').classList.add('hurt');
      setTimeout(function () { $('vignette').classList.remove('hurt'); }, 180);
      AudioBus.play('hurt');
    } else if (e.k === 'slash') AudioBus.play('slash');
    else if (e.k === 'die') AudioBus.play('die');
    else if (e.k === 'dash') AudioBus.play('dash');
    else if (e.k === 'burst') AudioBus.play('seal');
    else if (e.k === 'kunai') AudioBus.play('kunai');
    else if (e.k === 'heal') AudioBus.play('heal');
    else if (e.k === 'shrine') AudioBus.play('shrine');
    else if (e.k === 'pick') AudioBus.play('pick');
    else if (e.k === 'boss') AudioBus.play('boss');
    else if (e.k === 'hit' && e.mag) AudioBus.play('hit');
    else if (e.k === 'toast') say(e.s);
    else if (e.k === 'clear') showVictory();
    else if (e.k === 'join' && inGame) say(e.name + ' steps onto the road.');
    if (e.k === 'hit') AudioBus.play('hit');
  }

  function say(s) {
    const el = $('toast');
    el.textContent = s;
    el.classList.add('show');
    toastT = 2.8;
  }

  const floaterPool = [];
  function floater(x, y, text, color) {
    const layer = $('floaters');
    const el = floaterPool.pop() || document.createElement('div');
    el.className = 'floater';
    el.textContent = text;
    el.style.color = color || '#fff';
    el.dataset.x = x;
    el.dataset.y = y;
    el.dataset.life = '0.7';
    el.style.opacity = '1';
    layer.appendChild(el);
  }

  function updateFloaters(dt) {
    const layer = $('floaters');
    const nodes = layer.children;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const el = nodes[i];
      let life = parseFloat(el.dataset.life) - dt;
      el.dataset.life = life;
      if (life <= 0) {
        layer.removeChild(el);
        floaterPool.push(el);
        continue;
      }
      const p = renderer.project(parseFloat(el.dataset.x), parseFloat(el.dataset.y), 1.3 + (0.7 - life) * 1.4);
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.style.opacity = String(Math.max(0, life / 0.7));
    }
  }

  function updateTags() {
    const layer = $('tags');
    if (!lastSnap) { layer.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < lastSnap.players.length; i++) {
      const p = lastSnap.players[i];
      const pr = renderer.project(p.x, p.y, 2.05);
      if (!pr.on) continue;
      const cls = p.id === 1 ? 'p1' : 'p2';
      html += '<div class="tag ' + cls + '" style="left:' + pr.x + 'px;top:' + pr.y + 'px">' + p.name + (p.dead ? ' · fallen' : '') + '</div>';
    }
    layer.innerHTML = html;
  }

  function updateHUD(dt) {
    const p = localPlayer();
    if (!p) return;
    const hp = Math.max(0, p.hp), sp = Math.max(0, p.sp != null ? p.sp : p.spirit);
    const hm = p.hm || p.hpMax || 100, sm = p.sm || p.spiritMax || 100;
    $('hp-label').textContent = hp + '/' + hm;
    $('sp-label').textContent = sp + '/' + sm;
    $('hp-fill').style.width = Math.max(0, Math.min(100, hp / hm * 100)) + '%';
    $('sp-fill').style.width = Math.max(0, Math.min(100, sp / sm * 100)) + '%';
    $('elixir-n').textContent = String(p.el != null ? p.el : p.elixirs);
    $('koban').textContent = String(p.ko != null ? p.ko : p.koban);
    const combo = p.combo || 0;
    const wrap = $('combo-wrap');
    wrap.classList.toggle('on', combo > 1);
    $('combo').textContent = String(combo);
    const boss = lastSnap && lastSnap.boss;
    const bar = $('bossbar');
    if (boss) {
      bar.hidden = false;
      $('boss-name').textContent = boss.name;
      $('boss-fill').style.width = Math.max(0, boss.hp / boss.hm * 100) + '%';
    } else bar.hidden = true;
    const cleared = (lastSnap && lastSnap.cleared) || [];
    let q = '';
    for (let i = 0; i < QUEST.length; i++) {
      const done = cleared.indexOf(QUEST[i][0]) >= 0;
      q += '<li class="' + (done ? 'done' : '') + '">' + (done ? '● ' : '○ ') + QUEST[i][1] + '</li>';
    }
    $('quest').innerHTML = '<span>Night road</span><ul>' + q + '</ul>';
    const room = $('room-hud');
    if (mode === 'host') room.textContent = 'ROAD ' + (Net.code || '——') + (Net.linked() ? '  ·  Shio linked' : '  ·  ' + (Net.status || 'waiting'));
    else if (mode === 'guest') room.textContent = 'ROAD ' + (Net.code || '') + '  ·  with Kaede';
    else room.textContent = 'SOLO';
    const prompt = $('prompt');
    prompt.textContent = '';
    if (lastSnap && !p.dead) {
      for (let i = 0; i < Level.shrines.length; i++) {
        const s = Level.shrines[i];
        if (Math.hypot(p.x - s.x, p.y - s.y) < 2.7) { prompt.textContent = 'E  —  rest at ' + s.name; break; }
      }
      const ps = lastSnap.players;
      for (let i = 0; i < ps.length; i++) {
        if (ps[i].id !== p.id && ps[i].dead && Math.hypot(ps[i].x - p.x, ps[i].y - p.y) < 1.9) {
          prompt.textContent = 'E  —  lift ' + ps[i].name;
        }
      }
    }
    const step = dt || 0.016;
    if (toastT > 0) {
      toastT -= step;
      if (toastT <= 0) $('toast').classList.remove('show');
    }
    if (hintT > 0) {
      hintT -= step;
      $('hint').style.opacity = String(Math.max(0, Math.min(1, hintT / 2)));
    }
  }

  function showVictory() {
    $('victory').hidden = false;
    const p = localPlayer();
    $('victory-sub').textContent = p ? ('Koban gathered: ' + (p.ko != null ? p.ko : p.koban)) : 'The night keeps its silence.';
  }

  function togglePause() {
    if (!inGame) return;
    if (mode === 'guest') { say('Only the host can still the road.'); return; }
    paused = !paused;
    $('pause').hidden = !paused;
  }

  function enterGame() {
    inGame = true;
    $('title').hidden = true;
    $('game').hidden = false;
    renderer.mode = 'play';
    renderer.localId = localId();
    renderer.smooth = mode === 'guest' ? 18 : 70;
    renderer.snapCam = true;
    hintT = 9;
    canvas.focus();
    AudioBus.resume();
  }

  function startSim(nextMode) {
    mode = nextMode;
    world = new YokaiWorld();
    world.addPlayer(1);
    if (nextMode === 'host' && (pendingGuest || Net.linked())) world.addPlayer(2);
    enterGame();
    say('The cedar shrine smells of rain and ink.');
  }

  function inputsForHost() {
    const bag = {};
    bag[1] = sample();
    if (mode === 'host') {
      const g = Net.takeGuestInput();
      if (g) bag[2] = g;
    }
    return bag;
  }

  function loop(now) {
      const dt = Math.min(0.5, Math.max(0, (now - last) / 1000));
    last = now;
    if (!renderer) { requestAnimationFrame(loop); return; }
    try {
      if (!inGame) {
        renderer.mode = 'title';
        renderer.frame(dt);
        if (mode === 'host') {
          setStatus(Net.status || '');
          if (Net.code && (Net.status === 'WAITING FOR A COMPANION' || Net.status === 'COMPANION ON THE ROAD')) {
            $('room-code').textContent = Net.code;
            $('share-link').textContent = shareUrl(Net.code);
            $('btn-begin').disabled = false;
          }
        }
      } else if (mode === 'guest') {
        const input = sample();
        Net.pushInput(input);
        Net.heartbeat();
        if (Net.snap) {
          lastSnap = Net.snap;
          renderer.apply(Net.snap);
        }
        renderer.frame(dt);
        updateHUD(dt);
        updateTags();
        updateFloaters(dt);
        if (Net.status === 'HOST LOST') say('The host has left the road.');
      } else {
        Net.heartbeat();
        if (!paused) {
          world.step(dt, inputsForHost());
          const snap = world.snapshot();
          lastSnap = snap;
          renderer.apply(snap);
          if (mode === 'host') {
            eventBag.push.apply(eventBag, snap.events);
            const send = Object.assign({}, snap, { events: eventBag });
            const before = Net._snapAt || 0;
            Net.pushSnap(send);
            if ((Net._snapAt || 0) !== before) eventBag = [];
          }
        } else if (lastSnap) {
          renderer.apply(lastSnap);
        }
        renderer.frame(dt);
        updateHUD(dt);
        updateTags();
        updateFloaters(dt);
      }
    } catch (err) {
      console.error(err);
      $('toast').textContent = String(err.message || err);
      $('toast').classList.add('show');
    }
    requestAnimationFrame(loop);
  }

  function wireTouch() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!coarse) return;
    $('touch').hidden = false;
    const stick = $('stick');
    const knob = $('knob');
    let active = null;
    function setStick(clientX, clientY) {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = clientX - cx, dy = clientY - cy;
      const L = Math.hypot(dx, dy) || 1;
      const max = r.width * 0.38;
      const cl = Math.min(max, L);
      dx = dx / L * cl;
      dy = dy / L * cl;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      touch.mx = cl < 8 ? 0 : dx / max;
      touch.my = cl < 8 ? 0 : -dy / max;
    }
    stick.addEventListener('pointerdown', function (e) { active = e.pointerId; stick.setPointerCapture(e.pointerId); setStick(e.clientX, e.clientY); });
    stick.addEventListener('pointermove', function (e) { if (e.pointerId === active) setStick(e.clientX, e.clientY); });
    function endStick(e) {
      if (e.pointerId !== active) return;
      active = null;
      touch.mx = touch.my = 0;
      knob.style.transform = 'translate(0,0)';
    }
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    const buttons = document.querySelectorAll('#tbtn [data-a]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const a = e.currentTarget.getAttribute('data-a');
        if (a === 'slash') touch.slash = 1;
        else if (a === 'beam') touch.beam = 1;
        else if (a === 'dash') tokens.dash++;
        else if (a === 'burst') tokens.burst++;
        else if (a === 'heal') tokens.heal++;
      });
      buttons[i].addEventListener('pointerup', function (e) {
        const a = e.currentTarget.getAttribute('data-a');
        if (a === 'slash') touch.slash = 0;
        if (a === 'beam') touch.beam = 0;
      });
    }
  }

  function wireUI() {
    $('btn-solo').addEventListener('click', function () {
      AudioBus.resume();
      startSim('solo');
    });
    $('btn-host').addEventListener('click', function () {
      AudioBus.resume();
      if (typeof Peer === 'undefined') { setStatus('PeerJS failed to load.'); return; }
      mode = 'host';
      Net.startHost();
      $('host-panel').hidden = false;
      $('join-form').hidden = true;
      $('menu-actions').hidden = true;
      $('room-code').textContent = '····';
      $('btn-begin').disabled = true;
      setStatus('Opening a road…');
    });
    $('btn-begin').addEventListener('click', function () {
      AudioBus.resume();
      if (!world) startSim('host');
    });
    $('btn-join').addEventListener('click', function () {
      $('join-form').hidden = false;
      $('host-panel').hidden = true;
      $('code-input').focus();
    });
    $('btn-connect').addEventListener('click', function () {
      AudioBus.resume();
      const code = $('code-input').value;
      if (!code || code.length < 4) { setStatus('Enter the four-character road code.'); return; }
      setStatus('Seeking ' + code.toUpperCase() + '…');
      $('btn-connect').disabled = true;
      Net.startJoin(code, function (err) {
        $('btn-connect').disabled = false;
        if (err) { setStatus(err); return; }
        mode = 'guest';
        setStatus('On the road. Waiting for the host to begin…');
        waitForSnap();
      });
    });
    $('code-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('btn-connect').click(); }
    });
    $('btn-copy').addEventListener('click', function () {
      const link = shareUrl(Net.code);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function () { setStatus('Link copied.'); }, function () { setStatus(link); });
      } else setStatus(link);
    });
    $('btn-again').addEventListener('click', function () { location.reload(); });
    $('btn-resume').addEventListener('click', function () { paused = false; $('pause').hidden = true; });
    $('btn-quit').addEventListener('click', function () { location.reload(); });

    Net.onLink = function () {
      pendingGuest = true;
      if (world && !world.player(2)) world.addPlayer(2);
      AudioBus.play('join');
      if (inGame) say('Shio steps onto the road.');
      else setStatus('Companion linked. Begin when you are both ready.');
    };
    Net.onDrop = function () {
      if (mode === 'host' && inGame) say('Your companion has left the road.');
    };

    const preset = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    if (preset) {
      $('join-form').hidden = false;
      $('code-input').value = preset;
    }
    wireTouch();
  }

  function waitForSnap() {
    if (Net.snap && Net.snap.players && Net.snap.players.length) {
      enterGame();
      say('You walk beside Kaede.');
      return;
    }
    if (mode === 'guest') requestAnimationFrame(waitForSnap);
  }

  window.__YOKAI = {
    get ready() { return booted; },
    get role() { return mode; },
    get code() { return Net.code; },
    get linked() { return Net.linked(); },
    get status() { return Net.status || ''; },
    get error() { return Net.err || bootError; },
    get playing() { return inGame; },
    get simTime() { return world ? world.time : (lastSnap && lastSnap.time) || 0; },
    get sample() { return lastSample; },
    get keys() { return Array.from(keys); },
    getState: function () {
      if (!lastSnap) return { players: [], enemies: [], phase: 'title' };
      return {
        players: lastSnap.players.map(function (p) { return { id: p.id, name: p.name, x: p.x, y: p.y, hp: p.hp, facing: p.f, dead: p.dead }; }),
        enemies: lastSnap.enemies.map(function (e) { return { id: e.id, kind: e.kind, x: e.x, y: e.y, hp: e.hp, dead: !!e.dead }; }),
        phase: lastSnap.phase,
        bossDown: lastSnap.bossDown,
        cleared: lastSnap.cleared || [],
      };
    },
    remoteOnScreen: function () {
      if (!lastSnap || !renderer) return false;
      const id = localId();
      for (let i = 0; i < lastSnap.players.length; i++) {
        const p = lastSnap.players[i];
        if (p.id === id) continue;
        const pr = renderer.project(p.x, p.y, 1.4);
        if (pr.on && pr.x > 8 && pr.x < renderer.w - 8 && pr.y > 8 && pr.y < renderer.h - 8) return true;
      }
      return false;
    },
  };

  boot();
  wireUI();
  requestAnimationFrame(loop);
})();
