'use strict';
/* Authoritative simulation. Solo and the co-op host both run this.
   Guests only render snapshots. +Y is up the road. */
(function () {
  const STEP = 1 / 60;
  const KINDS = {
    kappa: { hp: 48, speed: 3.55, r: 0.52, touch: 10, cd: 0.85, range: 1.2, aggro: 6.2 },
    kumo: { hp: 24, speed: 4.7, r: 0.36, touch: 7, cd: 0.62, range: 0.95, aggro: 7 },
    tengu: { hp: 78, speed: 3.25, r: 0.5, shot: 12, cd: 1.55, prefer: 7.4, aggro: 14 },
    jorogumo: { hp: 170, speed: 2.85, r: 0.82, touch: 14, cd: 0.95, range: 1.55, aggro: 12 },
    oni: { hp: 560, speed: 2.7, r: 1.2, touch: 18, cd: 1.05, range: 1.9, aggro: 18 },
  };

  function r2(n) { return Math.round(n * 100) / 100; }
  function len(x, y) { return Math.hypot(x, y); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function World() {
    this.players = [];
    this.enemies = [];
    this.shots = [];
    this.drops = [];
    this.zones = [];
    this.events = [];
    this.arenas = Level.arenas.map(function (a) {
      return {
        id: a.id, name: a.name, trigger: a.trigger, gates: a.gates,
        spawns: a.spawns, boss: !!a.boss, started: false, cleared: false,
      };
    });
    this.gates = [];
    const self = this;
    this.arenas.forEach(function (a) {
      a.gates.forEach(function (y) {
        const seg = Level.segmentAt(y);
        self.gates.push({ y: y, x0: seg.x0, x1: seg.x1, closed: false, arena: a.id });
      });
    });
    this.eid = 1;
    this.nid = 1;
    this.time = 0;
    this.acc = 0;
    this.bossDown = false;
    this.phase = 'play';
    this.spawnAmbient();
  }

  World.prototype.nextId = function () { return this.nid++; };
  World.prototype.emit = function (e) { e.id = this.eid++; this.events.push(e); };

  World.prototype.player = function (id) {
    for (let i = 0; i < this.players.length; i++) if (this.players[i].id === id) return this.players[i];
    return null;
  };

  World.prototype.addPlayer = function (id) {
    if (this.player(id)) return this.player(id);
    const shrine = Level.shrines[0];
    const p = {
      id: id,
      name: id === 1 ? 'Kaede' : 'Shio',
      x: id === 1 ? -0.65 : 0.85,
      y: shrine.sy,
      facing: Math.PI / 2,
      hp: 100, hpMax: 100,
      spirit: 100, spiritMax: 100,
      elixirs: 3, koban: 0,
      anim: 'idle', sw: 0,
      dead: false, downT: 0, iframe: 1.1, flash: false,
      dashT: 0, dashCd: 0, dx: 0, dy: 1,
      kx: 0, ky: 0,
      swingT: 0, swingDur: 0.18, gap: 0, comboIdx: 0, chainT: 0, didHit: false, swingFace: Math.PI / 2,
      beamAcc: 0, beamOn: false, beamX: 0, beamY: 0, numAcc: 0,
      burstCd: 0, kunaiCd: 0,
      combo: 0, comboT: 0,
      checkpoint: { x: id === 1 ? -0.65 : 0.85, y: shrine.sy },
      tokens: { dash: 0, burst: 0, heal: 0, kunai: 0, use: 0 },
      tokensArmed: false,
      hurtCd: {},
    };
    /* second player appears beside whoever is already walking */
    if (id !== 1 && this.players.length) {
      const host = this.players[0];
      p.x = host.x + 1.15;
      p.y = host.y - 0.2;
      p.checkpoint = { x: p.x, y: p.y };
      p.facing = host.facing;
    }
    this.players.push(p);
    if (id !== 1) this.emit({ k: 'join', pid: id, name: p.name });
    return p;
  };

  World.prototype.spawnAmbient = function () {
    this.spawnEnemy('kappa', 2.35, 15.4, null, false);
    this.spawnEnemy('kappa', -2.55, 17.6, null, false);
  };

  World.prototype.spawnEnemy = function (kind, x, y, arena, awake) {
    const k = KINDS[kind];
    const e = {
      id: this.nextId(), kind: kind, x: x, y: y, facing: -Math.PI / 2,
      hp: k.hp, hpMax: k.hp, r: k.r, speed: k.speed,
      dead: false, dieT: 0, flash: false, awake: !!awake, arena: arena,
      anim: 'idle', ph: 0, cd: 0.4 + Math.random() * 0.4,
      kx: 0, ky: 0, wind: 0, tx: x, ty: y,
      did: false, aimT: 0, webCd: 2.2, slamCd: 1.4, chargeT: 0, chargeCd: 3.5,
      summon1: false, summon2: false, phase: 1,
    };
    this.enemies.push(e);
    return e;
  };

  World.prototype.blocked = function (x, y, rad) {
    const seg = Level.segmentAt(y);
    if (x - rad < seg.x0 || x + rad > seg.x1) return true;
    if (y - rad < Level.y0 || y + rad > Level.y1) return true;
    const solids = Level.solids;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      const dx = x - s.x, dy = y - s.y;
      const rr = rad + s.r;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      if (!g.closed) continue;
      if (Math.abs(y - g.y) < rad + 0.42 && x > g.x0 - 0.2 && x < g.x1 + 0.2) return true;
    }
    return false;
  };

  World.prototype.move = function (ent, dx, dy, rad) {
    const nx = ent.x + dx;
    if (!this.blocked(nx, ent.y, rad)) ent.x = nx;
    const ny = ent.y + dy;
    if (!this.blocked(ent.x, ny, rad)) ent.y = ny;
  };

  World.prototype.living = function () {
    return this.players.filter(function (p) { return !p.dead; });
  };

  World.prototype.nearestPlayer = function (x, y) {
    const ps = this.living();
    let best = null, bd = 1e9;
    for (let i = 0; i < ps.length; i++) {
      const d = len(ps[i].x - x, ps[i].y - y);
      if (d < bd) { bd = d; best = ps[i]; }
    }
    return { p: best, d: bd };
  };

  World.prototype.inArc = function (px, py, facing, e, range, half) {
    const dx = e.x - px, dy = e.y - py;
    const d = len(dx, dy);
    if (d > range + e.r) return false;
    let diff = Math.atan2(dy, dx) - facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < half;
  };

  World.prototype.hurtEnemy = function (e, dmg, src, kb) {
    if (!e || e.dead) return;
    e.hp -= dmg;
    e.flash = true;
    const poise = e.kind === 'oni' ? 0.22 : e.kind === 'jorogumo' ? 0.55 : 1;
    if (src) {
      const dx = e.x - src.x, dy = e.y - src.y;
      const L = len(dx, dy) || 1;
      const k = (kb || 5) * poise;
      e.kx += (dx / L) * k;
      e.ky += (dy / L) * k;
      if (src.comboT != null) {
        src.combo = src.comboT > 0 ? src.combo + 1 : 1;
        src.comboT = 2.15;
      }
    }
    this.emit({ k: 'hit', x: e.x, y: e.y, n: Math.max(1, Math.round(dmg)), kind: e.kind, mag: src && src.mag });
    if (e.hp <= 0) this.killEnemy(e);
  };

  World.prototype.killEnemy = function (e) {
    if (e.dead) return;
    e.dead = true;
    e.dieT = 0;
    e.hp = 0;
    e.anim = 'dead';
    this.emit({ k: 'die', x: e.x, y: e.y, kind: e.kind });
    this.drops.push({ id: this.nextId(), x: e.x, y: e.y, kind: 'spirit', n: 22, age: 0 });
    this.drops.push({ id: this.nextId(), x: e.x + 0.25, y: e.y - 0.15, kind: 'koban', n: 3 + Math.floor(Math.random() * 6), age: 0 });
    if (Math.random() < (e.kind === 'oni' ? 1 : 0.2)) {
      this.drops.push({ id: this.nextId(), x: e.x - 0.3, y: e.y + 0.2, kind: 'elixir', n: 1, age: 0 });
    }
    if (e.kind === 'oni') {
      this.bossDown = true;
      this.emit({ k: 'toast', s: 'The gate oni kneels.' });
      this.emit({ k: 'boss' });
    }
    this.checkArenas();
  };

  World.prototype.hurtPlayer = function (p, dmg, sx, sy) {
    if (!p || p.dead || p.iframe > 0) return false;
    p.hp -= dmg;
    p.iframe = 0.38;
    p.flash = true;
    p.anim = 'hurt';
    const dx = p.x - sx, dy = p.y - sy;
    const L = len(dx, dy) || 1;
    p.kx = (dx / L) * 7.5;
    p.ky = (dy / L) * 7.5;
    this.emit({ k: 'hurt', pid: p.id, x: p.x, y: p.y, n: Math.round(dmg) });
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      p.downT = 3.4;
      p.anim = 'down';
      this.emit({ k: 'toast', s: p.name + ' has fallen.' });
    }
    return true;
  };

  World.prototype.checkArenas = function () {
    for (let i = 0; i < this.arenas.length; i++) {
      const a = this.arenas[i];
      if (!a.started || a.cleared) continue;
      let alive = false;
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        if (e.arena === a.id && !e.dead) alive = true;
      }
      if (!alive) {
        a.cleared = true;
        for (let g = 0; g < this.gates.length; g++) if (this.gates[g].arena === a.id) this.gates[g].closed = false;
        this.emit({ k: 'toast', s: a.name + ' falls quiet.' });
        if (a.boss) {
          this.phase = 'clear';
          this.emit({ k: 'clear' });
        }
      }
    }
  };

  World.prototype.startArena = function (a) {
    if (a.started) return;
    a.started = true;
    for (let g = 0; g < this.gates.length; g++) if (this.gates[g].arena === a.id) this.gates[g].closed = true;
    for (let i = 0; i < a.spawns.length; i++) {
      const s = a.spawns[i];
      this.spawnEnemy(s.kind, s.x, s.y, a.id, true);
    }
    this.emit({ k: 'toast', s: a.name });
    if (a.boss) this.emit({ k: 'boss' });
  };

  World.prototype.step = function (dt, inputs) {
    dt = Math.min(0.5, Math.max(0, dt));
    this.acc += dt;
    let first = true;
    let guard = 0;
    while (this.acc >= STEP && guard < 30) {
      this.tick(STEP, inputs || {}, first);
      this.acc -= STEP;
      first = false;
      guard++;
    }
    if (guard >= 30) this.acc = 0;
  };

  World.prototype.tick = function (dt, inputs, edges) {
    this.time += dt;
    this.tickPlayers(dt, inputs, edges);
    this.tickShots(dt);
    this.tickEnemies(dt);
    this.tickDrops(dt);
    this.tickZones(dt);
    this.tickArenas();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        e.dieT += dt;
        if (e.dieT > 1.25) this.enemies.splice(i, 1);
      }
    }
  };

  World.prototype.tickPlayers = function (dt, inputs, edges) {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
    const provided = Object.prototype.hasOwnProperty.call(inputs, p.id);
    const input = provided ? inputs[p.id] : ZERO;
    this.tickPlayer(p, input, dt, edges && provided, provided);
    }
  };

  const ZERO = { mx: 0, my: 0, ax: 0, ay: 0, slash: 0, beam: 0, dash: 0, burst: 0, heal: 0, kunai: 0, use: 0 };

  World.prototype.armTokens = function (p, input) {
    if (p.tokensArmed) return;
    p.tokens.dash = input.dash | 0;
    p.tokens.burst = input.burst | 0;
    p.tokens.heal = input.heal | 0;
    p.tokens.kunai = input.kunai | 0;
    p.tokens.use = input.use | 0;
    p.tokensArmed = true;
  };

  World.prototype.pressed = function (p, input, key) {
    const v = input[key] | 0;
    const prev = p.tokens[key] | 0;
    p.tokens[key] = v;
    return v !== prev;
  };

  World.prototype.tickPlayer = function (p, input, dt, edges, provided) {
    this.armTokens(p, input);
    if (p.comboT > 0) {
      p.comboT -= dt;
      if (p.comboT <= 0) p.combo = 0;
    }
    if (p.iframe > 0) p.iframe -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.gap > 0) p.gap -= dt;
    if (p.burstCd > 0) p.burstCd -= dt;
    if (p.kunaiCd > 0) p.kunaiCd -= dt;
    if (p.chainT > 0) p.chainT -= dt;
    p.kx *= Math.exp(-dt * 8);
    p.ky *= Math.exp(-dt * 8);

    /* checkpoint */
    for (let i = 0; i < Level.shrines.length; i++) {
      const s = Level.shrines[i];
      if (len(p.x - s.x, p.y - s.y) < 2.7 || len(p.x - s.sx, p.y - s.sy) < 2.2) {
        p.checkpoint = { x: s.sx, y: s.sy };
      }
    }

    if (p.dead) {
      p.downT -= dt;
      p.anim = 'down';
      p.beamOn = false;
      if (edges && input) {
        /* ally revive handled when the ally presses use */
      }
      if (p.downT <= 0) this.respawn(p);
      return;
    }

    if (!p.beamOn && p.spirit < p.spiritMax) p.spirit = Math.min(p.spiritMax, p.spirit + 10 * dt);

    let mx = input.mx || 0, my = input.my || 0;
    const ml = len(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }

    if (edges) {
      if (this.pressed(p, input, 'use')) this.tryUse(p);
      if (this.pressed(p, input, 'dash') && p.dashCd <= 0 && p.dashT <= 0) this.startDash(p, mx, my, ml);
      if (this.pressed(p, input, 'burst')) this.tryBurst(p);
      if (this.pressed(p, input, 'heal')) this.tryHeal(p);
      if (this.pressed(p, input, 'kunai')) this.tryKunai(p);
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.anim = 'dash';
      p.beamOn = false;
      this.move(p, p.dx * 18.5 * dt + p.kx * dt, p.dy * 18.5 * dt + p.ky * dt, 0.42);
      p.facing = Math.atan2(p.dy, p.dx);
      if (p.dashT <= 0) p.anim = 'idle';
      return;
    }

    /* facing */
    const al = len(input.ax || 0, input.ay || 0);
    if (p.swingT <= 0) {
      if (al > 0.25) p.facing = Math.atan2(input.ay, input.ax);
      else if (ml > 0.15) p.facing = Math.atan2(my, mx);
    }

    /* swing */
    if (p.swingT > 0) {
      p.swingT -= dt;
      const prog = 1 - (p.swingT / p.swingDur);
      p.sw = clamp(prog, 0, 1);
      p.anim = 'slash';
      p.facing = p.swingFace;
      if (!p.didHit && prog >= 0.28) {
        p.didHit = true;
        const c = p.comboIdx;
        const range = c === 2 ? 3.15 : 2.4;
        const half = c === 2 ? 1.45 : 1.05;
        const dmg = c === 2 ? 30 : c === 1 ? 17 : 14;
        p.mag = c === 2 ? 'fin' : 'slash';
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.dead && this.inArc(p.x, p.y, p.facing, e, range, half)) this.hurtEnemy(e, dmg, p, c === 2 ? 9 : 5.5);
        }
        this.emit({ k: 'slash', x: p.x, y: p.y, a: p.facing, combo: c });
      }
      if (p.swingT <= 0) {
        p.gap = 0.045;
        p.chainT = 0.34;
        p.anim = 'idle';
        p.sw = 0;
      }
    } else if (edges && provided && input.slash && p.gap <= 0 && !input.beam) {
      if (p.chainT > 0) p.comboIdx = (p.comboIdx + 1) % 3;
      else p.comboIdx = 0;
      p.swingDur = [0.18, 0.16, 0.26][p.comboIdx];
      p.swingT = p.swingDur;
      p.didHit = false;
      p.swingFace = p.facing;
      p.chainT = 0;
      p.anim = 'slash';
      p.mag = 'slash';
    }

    /* beam */
    p.beamOn = false;
    if (provided && input.beam && p.swingT <= 0 && p.spirit > 0) {
      p.beamOn = true;
      p.spirit = Math.max(0, p.spirit - 26 * dt);
      const ax = Math.cos(p.facing), ay = Math.sin(p.facing);
      const hit = this.beamCast(p, ax, ay);
      p.beamX = hit.x;
      p.beamY = hit.y;
      p.beamAcc -= dt;
      p.anim = 'beam';
      if (p.beamAcc <= 0) {
        p.beamAcc = 0.08;
        if (hit.e) {
          p.mag = 'beam';
          this.hurtEnemy(hit.e, 5, p, 1.4);
        }
      }
    } else p.beamAcc = 0;

    /* walk */
    let slow = 1;
    if (Level.inWater(p.x, p.y)) slow *= 0.68;
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      if (len(p.x - z.x, p.y - z.y) < z.r) slow *= 0.45;
    }
    if (p.swingT > 0) slow *= 0.42;
    const speed = 7.6 * slow;
    this.move(p, (mx * speed + p.kx) * dt, (my * speed + p.ky) * dt, 0.42);
    if (p.anim !== 'slash' && p.anim !== 'beam' && p.anim !== 'hurt') {
      p.anim = ml > 0.15 ? 'run' : 'idle';
    }
    if (p.anim === 'hurt') p.anim = ml > 0.15 ? 'run' : 'idle';

    /* separate from enemies unless dashing (already returned) */
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = len(dx, dy);
      const min = 0.42 + e.r * 0.85;
      if (d > 0.001 && d < min) {
        const push = (min - d) * 0.65;
        this.move(p, (dx / d) * push, (dy / d) * push, 0.42);
      }
    }
  };

  World.prototype.respawn = function (p) {
    const c = p.checkpoint || { x: 0, y: 7.1 };
    p.x = c.x;
    p.y = c.y;
    p.hp = 72;
    p.spirit = 100;
    p.dead = false;
    p.iframe = 1.35;
    p.anim = 'idle';
    p.kx = p.ky = 0;
    this.emit({ k: 'toast', s: p.name + ' returns to the shrine.' });
    this.emit({ k: 'rise', pid: p.id, x: p.x, y: p.y });
  };

  World.prototype.tryUse = function (p) {
    /* revive a nearby companion first */
    for (let i = 0; i < this.players.length; i++) {
      const o = this.players[i];
      if (o !== p && o.dead && len(o.x - p.x, o.y - p.y) < 1.9) {
        o.dead = false;
        o.hp = 58;
        o.spirit = 80;
        o.iframe = 1.2;
        o.anim = 'idle';
        this.emit({ k: 'toast', s: p.name + ' lifts ' + o.name + '.' });
        this.emit({ k: 'heal', x: o.x, y: o.y });
        return;
      }
    }
    for (let i = 0; i < Level.shrines.length; i++) {
      const s = Level.shrines[i];
      if (len(p.x - s.x, p.y - s.y) < 2.7) {
        p.hp = p.hpMax;
        p.spirit = p.spiritMax;
        if (p.elixirs < 3) p.elixirs = 3;
        p.checkpoint = { x: s.sx, y: s.sy };
        this.emit({ k: 'shrine', x: s.x, y: s.y, s: s.name });
        this.emit({ k: 'toast', s: 'Rest — ' + s.name });
        return;
      }
    }
  };

  World.prototype.startDash = function (p, mx, my, ml) {
    let dx, dy;
    if (ml > 0.15) { dx = mx; dy = my; }
    else { dx = Math.cos(p.facing); dy = Math.sin(p.facing); }
    const L = len(dx, dy) || 1;
    p.dx = dx / L;
    p.dy = dy / L;
    p.dashT = 0.16;
    p.dashCd = 0.5;
    p.iframe = Math.max(p.iframe, 0.16);
    p.spirit = Math.max(0, p.spirit - 8);
    p.anim = 'dash';
    this.emit({ k: 'dash', x: p.x, y: p.y });
  };

  World.prototype.tryBurst = function (p) {
    if (p.spirit < 28 || p.burstCd > 0 || p.dead) return;
    p.spirit -= 28;
    p.burstCd = 0.72;
    p.mag = 'seal';
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      if (len(e.x - p.x, e.y - p.y) < 3.7 + e.r) this.hurtEnemy(e, 32, p, 11);
    }
    this.emit({ k: 'burst', x: p.x, y: p.y });
  };

  World.prototype.tryHeal = function (p) {
    if (p.elixirs <= 0 || p.hp >= p.hpMax || p.dead) return;
    p.elixirs -= 1;
    p.hp = Math.min(p.hpMax, p.hp + 48);
    this.emit({ k: 'heal', x: p.x, y: p.y, pid: p.id });
  };

  World.prototype.tryKunai = function (p) {
    if (p.spirit < 8 || p.kunaiCd > 0 || p.dead) return;
    p.spirit -= 8;
    p.kunaiCd = 0.28;
    const ax = Math.cos(p.facing), ay = Math.sin(p.facing);
    this.shots.push({
      id: this.nextId(), team: 'p', owner: p.id, kind: 'kunai',
      x: p.x + ax * 0.7, y: p.y + ay * 0.7,
      vx: ax * 18, vy: ay * 18, dmg: 12, r: 0.2, life: 0.85,
    });
    this.emit({ k: 'kunai', x: p.x, y: p.y });
  };

  World.prototype.beamCast = function (p, ax, ay) {
    const reach = 7.6;
    let best = null, bestT = reach;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const t = dx * ax + dy * ay;
      if (t < 0 || t > reach) continue;
      const px = dx - ax * t, py = dy - ay * t;
      if (len(px, py) < e.r + 0.42 && t < bestT) { best = e; bestT = t; }
    }
    return { e: best, x: p.x + ax * bestT, y: p.y + ay * bestT };
  };

  World.prototype.tickShots = function (dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      let dead = s.life <= 0;
      if (this.blocked(s.x, s.y, 0.12)) dead = true;
      if (s.team === 'p') {
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          if (e.dead) continue;
          if (len(e.x - s.x, e.y - s.y) < e.r + s.r) {
            const owner = this.player(s.owner);
            if (owner) owner.mag = 'kunai';
            this.hurtEnemy(e, s.dmg, owner || { x: s.x - s.vx, y: s.y - s.vy, comboT: 0, combo: 0 }, 4);
            dead = true;
            break;
          }
        }
      } else {
        const ps = this.living();
        for (let j = 0; j < ps.length; j++) {
          const p = ps[j];
          if (len(p.x - s.x, p.y - s.y) < 0.42 + s.r) {
            if (this.hurtPlayer(p, s.dmg, s.x, s.y)) dead = true;
            break;
          }
        }
      }
      if (dead) this.shots.splice(i, 1);
    }
  };

  World.prototype.tickEnemies = function (dt) {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      e.kx *= Math.exp(-dt * 7);
      e.ky *= Math.exp(-dt * 7);
      if (e.cd > 0) e.cd -= dt;
      const near = this.nearestPlayer(e.x, e.y);
      if (!e.awake) {
        if (near.p && near.d < (KINDS[e.kind].aggro || 6)) e.awake = true;
        else {
          e.anim = 'idle';
          this.move(e, e.kx * dt, e.ky * dt, e.r * 0.8);
          continue;
        }
      }
      if (!near.p) { e.anim = 'idle'; continue; }
      if (e.kind === 'tengu') this.aiTengu(e, near, dt);
      else if (e.kind === 'oni') this.aiOni(e, near, dt);
      else if (e.kind === 'jorogumo') this.aiJoro(e, near, dt);
      else this.aiMelee(e, near, dt);
      /* separate */
      for (let j = i + 1; j < this.enemies.length; j++) {
        const o = this.enemies[j];
        if (o.dead) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d = len(dx, dy);
        const min = (e.r + o.r) * 0.85;
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5;
          e.kx += (dx / d) * push * 6;
          e.ky += (dy / d) * push * 6;
        }
      }
    }
  };

  World.prototype.aiMelee = function (e, near, dt) {
    const p = near.p;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = near.d || 1;
    e.facing = Math.atan2(dy, dx);
    const k = KINDS[e.kind];
    if (e.anim === 'swing') {
      e.ph += dt / 0.38;
      if (!e.did && e.ph >= 0.45) {
        e.did = true;
        if (len(p.x - e.x, p.y - e.y) < k.range + 0.55) this.hurtPlayer(p, k.touch, e.x, e.y);
      }
      if (e.ph >= 1) { e.anim = 'idle'; e.ph = 0; }
      this.move(e, e.kx * dt, e.ky * dt, e.r * 0.75);
      return;
    }
    if (d > k.range) {
      e.anim = 'run';
      const sp = k.speed * (e.kind === 'kumo' ? 1 : 1);
      this.move(e, (dx / d) * sp * dt + e.kx * dt, (dy / d) * sp * dt + e.ky * dt, e.r * 0.75);
    } else {
      e.anim = 'idle';
      this.move(e, e.kx * dt, e.ky * dt, e.r * 0.75);
      if (e.cd <= 0) {
        e.anim = 'swing';
        e.ph = 0;
        e.did = false;
        e.cd = k.cd;
      }
    }
  };

  World.prototype.aiJoro = function (e, near, dt) {
    this.aiMelee(e, near, dt);
    e.webCd -= dt;
    if (e.webCd <= 0 && near.p) {
      e.webCd = 3.3;
      this.zones.push({ id: this.nextId(), x: near.p.x, y: near.p.y, r: 2.15, t: 4.2, kind: 'web' });
      this.emit({ k: 'web', x: near.p.x, y: near.p.y });
    }
  };

  World.prototype.aiTengu = function (e, near, dt) {
    const p = near.p;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = near.d || 1;
    e.facing = Math.atan2(dy, dx);
    const prefer = KINDS.tengu.prefer;
    let mx = 0, my = 0;
    if (d < prefer - 1.6) { mx = -dx / d; my = -dy / d; }
    else if (d > prefer + 1.8) { mx = dx / d; my = dy / d; }
    else { mx = -dy / d; my = dx / d; }
    if (e.anim === 'aim') {
      e.ph += dt / 0.42;
      e.tx = p.x; e.ty = p.y;
      if (e.ph >= 1) {
        const ax = Math.cos(e.facing), ay = Math.sin(e.facing);
        this.shots.push({
          id: this.nextId(), team: 'e', kind: 'feather',
          x: e.x + ax * 0.6, y: e.y + ay * 0.6,
          vx: ax * 10.5, vy: ay * 10.5, dmg: KINDS.tengu.shot, r: 0.28, life: 2.1,
        });
        e.anim = 'idle';
        e.ph = 0;
        e.cd = KINDS.tengu.cd;
      }
    } else if (e.cd <= 0 && d < 13.5) {
      e.anim = 'aim';
      e.ph = 0;
      e.tx = p.x;
      e.ty = p.y;
    } else e.anim = 'run';
    const sp = e.anim === 'aim' ? 0.6 : KINDS.tengu.speed;
    this.move(e, mx * sp * dt + e.kx * dt, my * sp * dt + e.ky * dt, e.r * 0.75);
  };

  World.prototype.aiOni = function (e, near, dt) {
    const p = near.p;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = near.d || 1;
    const ratio = e.hp / e.hpMax;
    if (!e.summon1 && ratio < 0.7) {
      e.summon1 = true;
      this.spawnEnemy('kappa', e.x - 3.2, e.y - 1.5, 'gate', true);
      this.spawnEnemy('kappa', e.x + 3.2, e.y - 1.2, 'gate', true);
      this.emit({ k: 'toast', s: 'Kappa crawl from the gate stones.' });
    }
    if (!e.summon2 && ratio < 0.38) {
      e.summon2 = true;
      this.spawnEnemy('tengu', e.x - 2.4, e.y + 2.2, 'gate', true);
      this.emit({ k: 'toast', s: 'A tengu answers the oni.' });
    }
    e.slamCd -= dt;
    e.chargeCd -= dt;
    if (e.anim === 'windup') {
      e.ph += dt / 0.7;
      e.wind = clamp(e.ph, 0, 1);
      e.facing = Math.atan2(e.ty - e.y, e.tx - e.x);
      if (e.ph >= 1) {
        e.anim = 'slam';
        e.ph = 0;
        e.wind = 0;
        const ps = this.living();
        for (let i = 0; i < ps.length; i++) {
          if (len(ps[i].x - e.tx, ps[i].y - e.ty) < 2.35) this.hurtPlayer(ps[i], 22, e.tx, e.ty);
        }
        this.emit({ k: 'slam', x: e.tx, y: e.ty });
        e.cd = 0.4;
      }
      this.move(e, e.kx * dt, e.ky * dt, e.r * 0.8);
      return;
    }
    if (e.anim === 'charge') {
      e.chargeT -= dt;
      e.facing = Math.atan2(e.dy, e.dx);
      this.move(e, e.dx * 11 * dt + e.kx * dt, e.dy * 11 * dt + e.ky * dt, e.r * 0.8);
      const ps = this.living();
      for (let i = 0; i < ps.length; i++) {
        if (len(ps[i].x - e.x, ps[i].y - e.y) < e.r + 0.5) this.hurtPlayer(ps[i], 16, e.x, e.y);
      }
      if (e.chargeT <= 0) e.anim = 'idle';
      return;
    }
    e.wind = 0;
    e.facing = Math.atan2(dy, dx);
    if (ratio < 0.7 && e.chargeCd <= 0 && d < 12 && d > 2.2) {
      e.anim = 'charge';
      e.chargeT = 0.55;
      e.chargeCd = 4.4;
      const L = d || 1;
      e.dx = dx / L;
      e.dy = dy / L;
      this.emit({ k: 'toast', s: 'The oni lowers a horn.' });
      return;
    }
    if (e.slamCd <= 0 && d < 8.5) {
      e.anim = 'windup';
      e.ph = 0;
      e.tx = p.x;
      e.ty = p.y;
      e.wind = 0.01;
      e.slamCd = ratio < 0.4 ? 1.7 : 2.5;
      return;
    }
    if (d > KINDS.oni.range) {
      e.anim = 'run';
      const sp = KINDS.oni.speed * (ratio < 0.4 ? 1.35 : 1);
      this.move(e, (dx / d) * sp * dt + e.kx * dt, (dy / d) * sp * dt + e.ky * dt, e.r * 0.8);
    } else if (e.cd <= 0) {
      e.anim = 'swing';
      e.ph = 0;
      e.did = false;
      e.cd = KINDS.oni.cd;
      if (d < KINDS.oni.range + 0.4) this.hurtPlayer(p, KINDS.oni.touch, e.x, e.y);
    } else {
      e.anim = 'idle';
      this.move(e, e.kx * dt, e.ky * dt, e.r * 0.8);
    }
  };

  World.prototype.tickDrops = function (dt) {
    const ps = this.living();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      let best = null, bd = 2.7;
      for (let j = 0; j < ps.length; j++) {
        const dist = len(ps[j].x - d.x, ps[j].y - d.y);
        if (dist < bd) { bd = dist; best = ps[j]; }
      }
      if (best) {
        const sp = 11;
        d.x += ((best.x - d.x) / (bd || 1)) * sp * dt;
        d.y += ((best.y - d.y) / (bd || 1)) * sp * dt;
        if (bd < 0.48) {
          if (d.kind === 'spirit') best.spirit = Math.min(best.spiritMax, best.spirit + d.n);
          else if (d.kind === 'koban') best.koban += d.n;
          else if (d.kind === 'elixir') best.elixirs = Math.min(5, best.elixirs + 1);
          this.emit({ k: 'pick', x: best.x, y: best.y, kind: d.kind, pid: best.id });
          this.drops.splice(i, 1);
          continue;
        }
      }
      if (d.age > 22) this.drops.splice(i, 1);
    }
  };

  World.prototype.tickZones = function (dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      this.zones[i].t -= dt;
      if (this.zones[i].t <= 0) this.zones.splice(i, 1);
    }
  };

  World.prototype.tickArenas = function () {
    const ps = this.living();
    for (let i = 0; i < this.arenas.length; i++) {
      const a = this.arenas[i];
      if (a.started) continue;
      for (let j = 0; j < ps.length; j++) {
        if (ps[j].y > a.trigger && ps[j].y < a.trigger + 8) {
          this.startArena(a);
          break;
        }
      }
    }
  };

  World.prototype.snapshot = function () {
    const events = this.events;
    this.events = [];
    const players = this.players.map(function (p) {
      return {
        id: p.id, name: p.name,
        x: r2(p.x), y: r2(p.y), f: r2(p.facing),
        hp: Math.max(0, Math.ceil(p.hp)), hm: p.hpMax,
        sp: Math.max(0, Math.ceil(p.spirit)), sm: p.spiritMax,
        el: p.elixirs, ko: p.koban,
        anim: p.anim, sw: r2(p.sw || 0),
        dead: p.dead ? 1 : 0, down: r2(p.downT),
        flash: p.flash ? 1 : 0,
        dash: p.dashT > 0 ? 1 : 0,
        beam: p.beamOn ? { x: r2(p.beamX), y: r2(p.beamY) } : 0,
        combo: p.combo | 0,
      };
    });
    for (let i = 0; i < this.players.length; i++) this.players[i].flash = false;
    const enemies = this.enemies.map(function (e) {
      return {
        id: e.id, kind: e.kind,
        x: r2(e.x), y: r2(e.y), f: r2(e.facing),
        hp: Math.max(0, Math.ceil(e.hp)), hm: e.hpMax,
        dead: e.dead ? 1 : 0, die: r2(e.dieT),
        anim: e.anim, ph: r2(e.ph || 0),
        flash: e.flash ? 1 : 0,
        wind: r2(e.wind || 0), tx: r2(e.tx), ty: r2(e.ty),
      };
    });
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].flash = false;
    const shots = this.shots.map(function (s) {
      return { id: s.id, x: r2(s.x), y: r2(s.y), vx: r2(s.vx), vy: r2(s.vy), kind: s.kind, team: s.team };
    });
    const drops = this.drops.map(function (d) {
      return { id: d.id, x: r2(d.x), y: r2(d.y), kind: d.kind, n: d.n };
    });
    const zones = this.zones.map(function (z) {
      return { id: z.id, x: r2(z.x), y: r2(z.y), r: z.r, kind: z.kind };
    });
    const cleared = [];
    for (let i = 0; i < this.arenas.length; i++) if (this.arenas[i].cleared) cleared.push(this.arenas[i].id);
    let boss = null;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.kind === 'oni' && !e.dead) boss = { name: 'Gate Oni', hp: Math.ceil(e.hp), hm: e.hpMax };
    }
    return {
      t: 's',
      time: r2(this.time),
      players: players,
      enemies: enemies,
      shots: shots,
      drops: drops,
      zones: zones,
      gates: this.gates.map(function (g) { return g.closed ? 1 : 0; }),
      cleared: cleared,
      boss: boss,
      bossDown: this.bossDown ? 1 : 0,
      phase: this.phase,
      events: events,
      seq: this.seq = (this.seq || 0) + 1,
    };
  };

  window.YokaiWorld = World;
  window.YokaiKinds = KINDS;
})();
