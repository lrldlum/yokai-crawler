'use strict';
/* High-angle diorama. Dark cedar night, lantern warmth, ofuda cyan against yokai violet. */
(function () {
  const GEO = {};
  function geo(name, make) {
    if (!GEO[name]) GEO[name] = make();
    return GEO[name];
  }

  let GLOW = null;
  function glowTex() {
    if (GLOW) return GLOW;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    GLOW = new THREE.CanvasTexture(c);
    return GLOW;
  }

  function mat(color, o) {
    o = o || {};
    const m = new THREE.MeshStandardMaterial({
      color: color,
      roughness: o.rough != null ? o.rough : 0.78,
      metalness: o.metal != null ? o.metal : 0.04,
      emissive: new THREE.Color(o.em != null ? o.em : 0x000000),
      emissiveIntensity: o.emI != null ? o.emI : 0,
      flatShading: !!o.flat,
      transparent: !!o.transparent,
      opacity: o.opacity != null ? o.opacity : 1,
      side: o.side || THREE.FrontSide,
      depthWrite: o.depthWrite != null ? o.depthWrite : true,
    });
    m.userData.baseE = m.emissive.clone();
    m.userData.baseI = m.emissiveIntensity;
    return m;
  }

  function add(group, mesh, shadow) {
    if (shadow) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    group.add(mesh);
    return mesh;
  }

  function halo(color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(),
      color: color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    s.scale.set(size, size, 1);
    return s;
  }

  function collectMats(g) {
    const mats = [];
    g.traverse(function (o) {
      if (o.material && o.material.userData && o.material.userData.baseE) mats.push(o.material);
    });
    g.userData.mats = mats;
  }

  function hash(x, y) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function makeGroundTexture() {
    const w = 1024, h = 2048;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const data = img.data;
    const y0 = -4, y1 = 220, x0 = -20, x1 = 20;
    for (let py = 0; py < h; py++) {
      const wy = y0 + (py / h) * (y1 - y0);
      const seg = Level.segmentAt(wy);
      for (let px = 0; px < w; px++) {
        const wx = x0 + (px / w) * (x1 - x0);
        const n = hash(px, py);
        const n2 = hash(px * 3 + 9, py * 5 + 2);
        let r, gc, b;
        const wet = Level.inWater(wx, wy);
        const on = wx > seg.x0 + 0.15 && wx < seg.x1 - 0.15;
        const center = Math.abs(wx) < 1.35;
        if (wet) {
          r = 18 + n * 10;
          gc = 48 + n * 20;
          b = 72 + n * 24;
        } else if (wy > 180 && on) {
          r = 62 + n * 16;
          gc = 60 + n * 14;
          b = 64 + n * 12;
          if (((px >> 4) + (py >> 4)) % 2 === 0) { r -= 8; gc -= 8; b -= 6; }
        } else if (wy > 132 && wy < 164 && on) {
          r = 48 + n * 14;
          gc = 46 + n * 10;
          b = 52 + n * 12;
        } else if (on && center) {
          r = 78 + n * 18;
          gc = 68 + n * 12;
          b = 48 + n * 8;
        } else if (on) {
          r = 42 + n * 16;
          gc = 48 + n * 14;
          b = 32 + n * 8;
          if (n2 > 0.86) { r = 70; gc = 78; b = 48; }
        } else {
          r = 12 + n * 10;
          gc = 22 + n * 16;
          b = 16 + n * 8;
        }
        const i = (py * w + px) * 4;
        data[i] = r;
        data[i + 1] = gc;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function makeHero(id) {
    const g = new THREE.Group();
    const p1 = id === 1;
    const robe = p1 ? 0x1a2148 : 0x114e4a;
    const sash = p1 ? 0xc4372f : 0xd4b15a;
    const hat = p1 ? 0x6e1c22 : 0x1c3d40;
    const skin = 0xd7b497;
    add(g, new THREE.Mesh(geo('leg', function () { return new THREE.CapsuleGeometry(0.07, 0.28, 3, 6); }), mat(0x141820)), true).position.set(-0.1, 0.28, 0);
    add(g, new THREE.Mesh(geo('leg', function () { return GEO.leg; }), mat(0x141820)), true).position.set(0.1, 0.28, 0);
    const torso = add(g, new THREE.Mesh(geo('torso', function () { return new THREE.CapsuleGeometry(0.2, 0.42, 4, 8); }), mat(robe, { rough: 0.66 })), true);
    torso.position.y = 0.86;
    const sashM = add(g, new THREE.Mesh(geo('sash', function () { return new THREE.CylinderGeometry(0.22, 0.23, 0.09, 12); }), mat(sash, { em: sash, emI: 0.35, rough: 0.45 })), false);
    sashM.position.y = 0.78;
    const head = add(g, new THREE.Mesh(geo('head', function () { return new THREE.SphereGeometry(0.15, 12, 10); }), mat(skin, { rough: 0.55 })), true);
    head.position.y = 1.32;
    const brim = add(g, new THREE.Mesh(geo('brim', function () { return new THREE.CylinderGeometry(0.52, 0.56, 0.05, 16); }), mat(hat, { em: p1 ? 0x3a1014 : 0x0c2424, emI: 0.25 })), true);
    brim.position.y = 1.5;
    const crown = add(g, new THREE.Mesh(geo('crown', function () { return new THREE.ConeGeometry(0.26, 0.22, 12); }), mat(hat)), true);
    crown.position.y = 1.64;
    const cape = add(g, new THREE.Mesh(geo('cape', function () { return new THREE.PlaneGeometry(0.46, 0.62); }), mat(p1 ? 0x8e2430 : 0x21756c, { side: THREE.DoubleSide, em: p1 ? 0x401018 : 0x103430, emI: 0.3 })), true);
    cape.position.set(0, 0.95, -0.18);
    cape.rotation.x = 0.25;
    g.userData.cape = cape;
    const ofuda = add(g, new THREE.Mesh(geo('ofuda', function () { return new THREE.PlaneGeometry(0.16, 0.26); }), mat(0xf6f1e2, { em: 0xfff0c0, emI: 0.7, side: THREE.DoubleSide })), false);
    ofuda.position.set(0.12, 1.05, -0.22);
    const pivot = new THREE.Group();
    pivot.position.set(0.18, 1.05, 0.12);
    const blade = new THREE.Mesh(geo('blade', function () { return new THREE.BoxGeometry(0.045, 0.045, 0.92); }), mat(0xe7eef8, { metal: 0.85, rough: 0.22, em: 0xcff7ff, emI: 0.45 }));
    blade.position.z = 0.4;
    blade.castShadow = true;
    pivot.add(blade);
    const guard = new THREE.Mesh(geo('guard', function () { return new THREE.BoxGeometry(0.16, 0.05, 0.05); }), mat(0xe2b656, { metal: 0.6, rough: 0.3, em: 0xe2b656, emI: 0.4 }));
    pivot.add(guard);
    g.add(pivot);
    g.userData.pivot = pivot;
    g.userData.blade = blade;
    const h = halo(p1 ? 0xffb089 : 0x9ff0e0, 1.15);
    h.position.y = 0.4;
    g.add(h);
    collectMats(g);
    g.userData.kind = 'hero';
    g.scale.setScalar(1.28);
    return g;
  }

  function makeKappa() {
    const g = new THREE.Group();
    const body = add(g, new THREE.Mesh(geo('kbody', function () { return new THREE.SphereGeometry(0.38, 12, 10); }), mat(0x1f7a45, { rough: 0.55, em: 0x0c3a22, emI: 0.25 })), true);
    body.position.y = 0.42;
    body.scale.set(1, 0.85, 1.05);
    const shell = add(g, new THREE.Mesh(geo('shell', function () { return new THREE.SphereGeometry(0.36, 10, 8); }), mat(0x3c6a32, { flat: true, rough: 0.8 })), true);
    shell.position.set(0, 0.58, -0.12);
    shell.scale.set(1, 0.7, 0.85);
    const head = add(g, new THREE.Mesh(geo('khead', function () { return new THREE.SphereGeometry(0.22, 10, 8); }), mat(0x2f8f4e, { em: 0x145c30, emI: 0.2 })), true);
    head.position.set(0, 0.78, 0.18);
    const beak = add(g, new THREE.Mesh(geo('beak', function () { return new THREE.ConeGeometry(0.08, 0.22, 6); }), mat(0xe2b656, { flat: true })), true);
    beak.position.set(0, 0.74, 0.38);
    beak.rotation.x = Math.PI / 2;
    const dish = add(g, new THREE.Mesh(geo('dish', function () { return new THREE.TorusGeometry(0.16, 0.035, 6, 12); }), mat(0x8fd0c8, { em: 0x7ef0e0, emI: 0.5 })), false);
    dish.position.y = 1.02;
    dish.rotation.x = Math.PI / 2;
    const h = halo(0x3ecf7a, 0.9);
    h.position.y = 0.5;
    g.add(h);
    collectMats(g);
    return g;
  }

  function makeKumo() {
    const g = new THREE.Group();
    const body = add(g, new THREE.Mesh(geo('sbody', function () { return new THREE.SphereGeometry(0.28, 10, 8); }), mat(0x1a1420, { em: 0x3a1030, emI: 0.35 })), true);
    body.position.y = 0.32;
    body.scale.set(1.1, 0.7, 1.3);
    for (let i = 0; i < 6; i++) {
      const leg = add(g, new THREE.Mesh(geo('sleg', function () { return new THREE.CylinderGeometry(0.02, 0.035, 0.45, 4); }), mat(0x120e14)), true);
      const a = (i / 6) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.22, 0.22, Math.sin(a) * 0.22);
      leg.rotation.z = Math.cos(a) * 0.8;
      leg.rotation.x = Math.sin(a) * 0.5;
    }
    const eye = halo(0xff3ea5, 0.35);
    eye.position.set(0, 0.4, 0.2);
    g.add(eye);
    collectMats(g);
    return g;
  }

  function makeTengu() {
    const g = new THREE.Group();
    const robe = add(g, new THREE.Mesh(geo('trobe', function () { return new THREE.ConeGeometry(0.38, 0.95, 8); }), mat(0x151820, { em: 0x1a1030, emI: 0.3 })), true);
    robe.position.y = 0.55;
    const head = add(g, new THREE.Mesh(geo('thead', function () { return new THREE.SphereGeometry(0.16, 10, 8); }), mat(0x9a2a2a, { em: 0x5a1018, emI: 0.35 })), true);
    head.position.y = 1.15;
    const nose = add(g, new THREE.Mesh(geo('nose', function () { return new THREE.ConeGeometry(0.05, 0.42, 6); }), mat(0xc4473a, { em: 0xff5a40, emI: 0.25 })), true);
    nose.position.set(0, 1.12, 0.28);
    nose.rotation.x = Math.PI / 2.3;
    const hat = add(g, new THREE.Mesh(geo('tokin', function () { return new THREE.CylinderGeometry(0.12, 0.16, 0.16, 8); }), mat(0x0e0e12)), true);
    hat.position.y = 1.32;
    const wingL = add(g, new THREE.Mesh(geo('wing', function () { return new THREE.PlaneGeometry(0.7, 0.38); }), mat(0x2a2038, { side: THREE.DoubleSide, em: 0x6a30a0, emI: 0.35 })), false);
    wingL.position.set(-0.45, 0.85, -0.05);
    wingL.rotation.y = 0.5;
    const wingR = wingL.clone();
    wingR.position.x = 0.45;
    wingR.rotation.y = -0.5;
    g.add(wingR);
    g.userData.wingL = wingL;
    g.userData.wingR = wingR;
    const h = halo(0xc060ff, 0.85);
    h.position.y = 0.7;
    g.add(h);
    collectMats(g);
    return g;
  }

  function makeJoro() {
    const g = new THREE.Group();
    const hips = add(g, new THREE.Mesh(geo('jhip', function () { return new THREE.SphereGeometry(0.34, 10, 8); }), mat(0xd8d0c8, { em: 0x401020, emI: 0.15, rough: 0.45 })), true);
    hips.position.y = 0.7;
    hips.scale.set(0.8, 1.1, 0.7);
    const hakama = add(g, new THREE.Mesh(geo('hak', function () { return new THREE.ConeGeometry(0.36, 0.55, 8); }), mat(0x7a1830, { em: 0x400810, emI: 0.25 })), true);
    hakama.position.y = 0.4;
    const head = add(g, new THREE.Mesh(geo('jhead', function () { return new THREE.SphereGeometry(0.16, 12, 10); }), mat(0xf0e4d4, { rough: 0.45 })), true);
    head.position.y = 1.35;
    const hair = add(g, new THREE.Mesh(geo('hair', function () { return new THREE.SphereGeometry(0.2, 10, 8); }), mat(0x140c10)), true);
    hair.position.set(0, 1.42, -0.04);
    hair.scale.set(1, 1.2, 1);
    g.userData.legs = [];
    for (let i = 0; i < 8; i++) {
      const leg = add(g, new THREE.Mesh(geo('jleg', function () { return new THREE.CylinderGeometry(0.02, 0.03, 0.85, 4); }), mat(0x1a1218)), true);
      const a = (i / 8) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.28, 0.45, Math.sin(a) * 0.28);
      leg.userData.a = a;
      g.userData.legs.push(leg);
    }
    const h = halo(0xff4d6a, 1.1);
    h.position.y = 0.8;
    g.add(h);
    collectMats(g);
    return g;
  }

  function makeOni() {
    const g = new THREE.Group();
    const skinM = mat(0x8e1e22, { em: 0x5a0c10, emI: 0.35, rough: 0.5 });
    const body = add(g, new THREE.Mesh(geo('obody', function () { return new THREE.CapsuleGeometry(0.42, 0.7, 4, 8); }), skinM), true);
    body.position.y = 1.15;
    const head = add(g, new THREE.Mesh(geo('ohead', function () { return new THREE.SphereGeometry(0.32, 12, 10); }), mat(0x9a2428, { em: 0x6a1014, emI: 0.3 })), true);
    head.position.y = 1.9;
    const hornL = add(g, new THREE.Mesh(geo('horn', function () { return new THREE.ConeGeometry(0.07, 0.38, 6); }), mat(0xf2efe4, { em: 0xffe2a8, emI: 0.25 })), true);
    hornL.position.set(-0.14, 2.2, 0);
    hornL.rotation.z = 0.4;
    const hornR = hornL.clone();
    hornR.position.x = 0.14;
    hornR.rotation.z = -0.4;
    g.add(hornR);
    const belt = add(g, new THREE.Mesh(geo('belt', function () { return new THREE.CylinderGeometry(0.44, 0.46, 0.16, 8); }), mat(0xd68a2a, { em: 0xa85a10, emI: 0.2 })), true);
    belt.position.y = 0.85;
    const clubP = new THREE.Group();
    clubP.position.set(0.45, 1.3, 0.1);
    const club = new THREE.Mesh(geo('kanabo', function () { return new THREE.CylinderGeometry(0.08, 0.12, 1.35, 6); }), mat(0x5a4030, { rough: 0.7 }));
    club.position.y = -0.3;
    club.castShadow = true;
    clubP.add(club);
    g.add(clubP);
    g.userData.club = clubP;
    const h = halo(0xff3030, 1.8);
    h.position.y = 1;
    g.add(h);
    collectMats(g);
    return g;
  }

  const MAKERS = { kappa: makeKappa, kumo: makeKumo, tengu: makeTengu, jorogumo: makeJoro, oni: makeOni };
  const SCALES = { kappa: 1, kumo: 0.85, tengu: 1.12, jorogumo: 1.2, oni: 1.55 };

  function Renderer(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0c1220, 0.02);
    this.scene.background = new THREE.Color(0x0c1220);
    this.cam = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 240);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.time = 0;
    this.players = new Map();
    this.enemies = new Map();
    this.shots = new Map();
    this.drops = new Map();
    this.zones = new Map();
    this.lamps = [];
    this.lampLights = [];
    this.shake = 0;
    this.camH = 11;
    this.camB = 10;
    this.camA = 6;
    this.mode = 'title';
    this.localId = 1;
    this.smooth = 16;
    this._v = new THREE.Vector3();
    this._seenEvents = new Set();
    this.floaters = [];
    this.arcs = [];
    this.ghosts = [];
    this.particles = [];
    this.gates = [];
    this.slamRings = [];
    this.beams = new Map();
    this.frameTimes = [];
    this.shadows = false;
    this.onEvent = null;
    this._buildLights();
    this._buildLevel();
    this._buildPools();
    const self = this;
    window.addEventListener('resize', function () { self.resize(); });
  }

  Renderer.prototype.resize = function () {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.cam.aspect = this.w / Math.max(1, this.h);
    this.cam.updateProjectionMatrix();
    this.renderer.setSize(this.w, this.h);
  };

  Renderer.prototype._buildLights = function () {
    const scene = this.scene;
    scene.add(new THREE.HemisphereLight(0x243258, 0x1a120c, 0.55));
    scene.add(new THREE.AmbientLight(0x1a2240, 0.28));
    const moon = new THREE.DirectionalLight(0xc5d4ff, 1.15);
    moon.position.set(18, 28, 8);
    moon.castShadow = false;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 80;
    moon.shadow.camera.left = -20;
    moon.shadow.camera.right = 20;
    moon.shadow.camera.top = 20;
    moon.shadow.camera.bottom = -20;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.04;
    scene.add(moon);
    scene.add(moon.target);
    this.moon = moon;
    const warm = new THREE.DirectionalLight(0xffb080, 0.35);
    warm.position.set(-10, 8, -6);
    scene.add(warm);
    for (let i = 0; i < 3; i++) {
      const L = new THREE.PointLight(0xffb15a, 0, 9, 2);
      scene.add(L);
      this.lampLights.push(L);
    }
    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 14), new THREE.MeshBasicMaterial({ color: 0xfff4d2 }));
    moonMesh.position.set(7.5, 9.5, -22);
    this.cam.add(moonMesh);
    const moonGlow = halo(0xfff0c8, 7);
    moonGlow.position.copy(moonMesh.position);
    this.cam.add(moonGlow);
    const stars = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < 80; i++) {
      pos.push((Math.random() - 0.5) * 40, 6 + Math.random() * 10, -18 - Math.random() * 16);
    }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const starPts = new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xdfe7ff, size: 0.12, sizeAttenuation: true }));
    this.cam.add(starPts);
    scene.add(this.cam);
  };

  Renderer.prototype._buildLevel = function () {
    const scene = this.scene;
    const tex = makeGroundTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 224),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 108);
    ground.receiveShadow = true;
    scene.add(ground);
    const skirt = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 280),
      new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: 1 })
    );
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.set(0, -0.08, 108);
    scene.add(skirt);

    const segs = Level.segments;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const lenY = s.y1 - s.y0;
      const mid = (s.y0 + s.y1) / 2;
      const h = s.wall;
      const thick = 2.4;
      const left = new THREE.Mesh(new THREE.BoxGeometry(thick, h, lenY), mat(0x2a313c, { flat: true, rough: 0.92, em: 0x10141c, emI: 0.08 }));
      left.position.set(s.x0 - thick / 2, h / 2, mid);
      left.receiveShadow = true;
      scene.add(left);
      const right = left.clone();
      right.position.x = s.x1 + thick / 2;
      scene.add(right);
      /* cap moss strip */
      const cap = new THREE.Mesh(new THREE.BoxGeometry(thick, 0.18, lenY), mat(0x1c3a28, { flat: true, em: 0x102818, emI: 0.15 }));
      cap.position.set(s.x0 - thick / 2, h + 0.02, mid);
      scene.add(cap);
      const cap2 = cap.clone();
      cap2.position.x = s.x1 + thick / 2;
      scene.add(cap2);
    }

    const waterTex = document.createElement('canvas');
    waterTex.width = waterTex.height = 128;
    const wg = waterTex.getContext('2d');
    wg.fillStyle = '#12384e';
    wg.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 18; i++) {
      wg.strokeStyle = 'rgba(170,220,255,0.25)';
      wg.beginPath();
      wg.moveTo(0, i * 8);
      wg.bezierCurveTo(30, i * 8 + 4, 70, i * 8 - 3, 128, i * 8 + 1);
      wg.stroke();
    }
    this.waterMap = new THREE.CanvasTexture(waterTex);
    this.waterMap.wrapS = this.waterMap.wrapT = THREE.RepeatWrapping;
    this.waterMap.repeat.set(2, 2);
    const wdef = Level.water[0];
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(wdef.x1 - wdef.x0, wdef.y1 - wdef.y0),
      new THREE.MeshStandardMaterial({
        map: this.waterMap, color: 0x7ec8e8, transparent: true, opacity: 0.72,
        roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(0x123040), emissiveIntensity: 0.4,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set((wdef.x0 + wdef.x1) / 2, 0.05, (wdef.y0 + wdef.y1) / 2);
    scene.add(water);
    this.water = water;

    const decor = Level.decor;
    for (let i = 0; i < decor.length; i++) this._placeDecor(decor[i]);

    /* gates in the same order the sim builds them */
    for (let i = 0; i < Level.arenas.length; i++) {
      const a = Level.arenas[i];
      for (let j = 0; j < a.gates.length; j++) {
        const y = a.gates[j];
        const seg = Level.segmentAt(y);
        const width = seg.x1 - seg.x0;
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(width, 1.4, 0.45),
          mat(0x3a404c, { flat: true, em: 0x2a1030, emI: 0.15 })
        );
        bar.position.set((seg.x0 + seg.x1) / 2, -1.2, y);
        bar.castShadow = true;
        scene.add(bar);
        const seal = halo(0xc060ff, 1.4);
        seal.position.set(0, 0.9, 0);
        seal.visible = false;
        bar.add(seal);
        this.gates.push({ mesh: bar, seal: seal, openY: -1.6, shutY: 0.85 });
      }
    }

    /* fireflies */
    this.flies = [];
    for (let i = 0; i < 36; i++) {
      const s = halo(0xc6ffb0, 0.35);
      const y = Math.random() * 200;
      const seg = Level.segmentAt(y);
      s.position.set(seg.x0 + 1 + Math.random() * (seg.x1 - seg.x0 - 2), 0.6 + Math.random() * 1.4, y);
      s.userData.base = s.position.clone();
      s.userData.ph = Math.random() * 6;
      scene.add(s);
      this.flies.push(s);
    }
  };

  Renderer.prototype._placeDecor = function (d) {
    const s = d.s || 1;
    let obj = null;
    if (d.k === 'lantern') obj = this._lantern();
    else if (d.k === 'torii') obj = this._torii(s);
    else if (d.k === 'pine') obj = this._pine(s, d.tint);
    else if (d.k === 'bamboo') obj = this._bamboo(s);
    else if (d.k === 'rock') obj = this._rock(s);
    else if (d.k === 'shrine') obj = this._shrine(s);
    else if (d.k === 'hokora') obj = this._hokora(s);
    else if (d.k === 'bridge') obj = this._bridge();
    else if (d.k === 'jizo') obj = this._jizo();
    else if (d.k === 'webgate') obj = this._webgate();
    else if (d.k === 'wall') obj = this._screen();
    else if (d.k === 'castle') obj = this._castle();
    if (!obj) return;
    obj.position.set(d.x, 0, d.y);
    this.scene.add(obj);
  };

  Renderer.prototype._lantern = function () {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), mat(0x2a241c));
    post.position.y = 0.35;
    post.castShadow = true;
    g.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), mat(0xffd2a0, { em: 0xffb15a, emI: 2.4, rough: 0.4 }));
    box.position.y = 0.86;
    g.add(box);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.38), mat(0x1c1814));
    cap.position.y = 1.06;
    g.add(cap);
    const h = halo(0xffb15a, 1.6);
    h.position.y = 0.86;
    g.add(h);
    this.lamps.push(box);
    return g;
  };

  Renderer.prototype._torii = function (s) {
    const g = new THREE.Group();
    g.scale.setScalar(s);
    const red = mat(0xc4372f, { em: 0x6a140c, emI: 0.25, rough: 0.5 });
    const black = mat(0x141414, { rough: 0.4 });
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.1, 8), red);
    p1.position.set(-1.55, 1.55, 0);
    p1.castShadow = true;
    const p2 = p1.clone();
    p2.position.x = 1.55;
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.22, 0.34), red);
    top.position.y = 3.05;
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 0.5), red);
    kasagi.position.y = 3.24;
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.16, 0.22), black);
    nuki.position.y = 2.35;
    g.add(p1, p2, top, kasagi, nuki);
    return g;
  };

  Renderer.prototype._pine = function (s, tint) {
    const g = new THREE.Group();
    g.scale.setScalar(s);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 5), mat(0x3a2a1c, { flat: true }));
    trunk.position.y = 0.35;
    const leaf = tint === 'pale' ? 0x8aa0b0 : 0x163424;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.1, 6), mat(leaf, { flat: true, em: tint === 'pale' ? 0x203040 : 0x0c2014, emI: 0.2 }));
    c1.position.y = 1.15;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.85, 6), mat(leaf, { flat: true }));
    c2.position.y = 1.75;
    g.add(trunk, c1, c2);
    return g;
  };

  Renderer.prototype._bamboo = function (s) {
    const g = new THREE.Group();
    g.scale.setScalar(s);
    for (let i = 0; i < 4; i++) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.4 + i * 0.2, 5), mat(0x7ea84a, { em: 0x2a4018, emI: 0.15, rough: 0.6 }));
      stalk.position.set((i - 1.5) * 0.12, 1.2, ((i % 2) - 0.5) * 0.1);
      stalk.rotation.z = (i - 1.5) * 0.04;
      g.add(stalk);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 4), mat(0x9ec85a, { flat: true }));
      leaf.position.set(stalk.position.x, 2.3 + i * 0.15, stalk.position.z);
      g.add(leaf);
    }
    return g;
  };

  Renderer.prototype._rock = function (s) {
    const g = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mat(0x5c6270, { flat: true, rough: 0.95 }));
    g.scale.setScalar(s);
    g.position.y = 0.3 * s;
    g.receiveShadow = true;
    return g;
  };

  Renderer.prototype._shrine = function (s) {
    const g = new THREE.Group();
    g.scale.setScalar(s);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 1.8), mat(0x6a645c, { flat: true, rough: 0.9 }));
    base.position.y = 0.18;
    base.receiveShadow = true;
    const hall = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.05, 1.25), mat(0x6b3a24, { rough: 0.7 }));
    hall.position.y = 0.85;
    hall.castShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.16, 1.8), mat(0x1c2430, { em: 0x101820, emI: 0.1 }));
    roof.position.y = 1.5;
    const roof2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.2), mat(0x1c2430));
    roof2.position.y = 1.85;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.05), mat(0xffe0b0, { em: 0xffc27a, emI: 1.6 }));
    glow.position.set(0, 0.9, 0.64);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 14), mat(0xf2efe2));
    rope.position.set(0, 1.15, 0.7);
    g.add(base, hall, roof, roof2, glow, rope);
    const h = halo(0xffc27a, 2.2);
    h.position.set(0, 1, 0.8);
    g.add(h);
    return g;
  };

  Renderer.prototype._hokora = function (s) {
    const g = new THREE.Group();
    g.scale.setScalar(s);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.55), mat(0x7a4a2c, { rough: 0.65 }));
    body.position.y = 0.55;
    body.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.4, 4), mat(0x222833));
    roof.position.y = 1.05;
    roof.rotation.y = Math.PI / 4;
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.04), mat(0xffe2b8, { em: 0xffc27a, emI: 1.5 }));
    light.position.set(0, 0.55, 0.28);
    g.add(body, roof, light);
    const h = halo(0xffc27a, 1.3);
    h.position.y = 0.6;
    g.add(h);
    return g;
  };

  Renderer.prototype._bridge = function () {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 6.5), mat(0x6a4a30, { rough: 0.8 }));
    deck.position.y = 0.18;
    deck.receiveShadow = true;
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 6.5), mat(0xc4372f, { em: 0x4a1010, emI: 0.15 }));
    r1.position.set(-1.05, 0.36, 0);
    const r2 = r1.clone();
    r2.position.x = 1.05;
    g.add(deck, r1, r2);
    return g;
  };

  Renderer.prototype._jizo = function () {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.35, 3, 6), mat(0xc8c2b4, { rough: 0.6 }));
    body.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0xd8d2c4));
    head.position.y = 0.78;
    const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), mat(0xc4372f, { side: THREE.DoubleSide, em: 0x601010, emI: 0.2 }));
    bib.position.set(0, 0.5, 0.14);
    g.add(body, head, bib);
    return g;
  };

  Renderer.prototype._webgate = function () {
    const g = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 6, 18, Math.PI), mat(0xf2f2f2, { em: 0xffffff, emI: 0.35 }));
    arch.position.y = 1.4;
    arch.rotation.y = Math.PI;
    const h = halo(0xfff6ff, 1.5);
    h.position.y = 1.6;
    g.add(arch, h);
    return g;
  };

  Renderer.prototype._screen = function () {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 2.2), mat(0x4a4038, { flat: true }));
    g.position.y = 0.9;
    g.castShadow = true;
    return g;
  };

  Renderer.prototype._castle = function () {
    const g = new THREE.Group();
    const stone = mat(0x2c3340, { flat: true, rough: 0.9, em: 0x141820, emI: 0.08 });
    const roofM = mat(0x1a2030, { flat: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 10), stone);
    base.position.y = 3;
    const mid = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 7), stone);
    mid.position.y = 8.2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), stone);
    top.position.y = 12.2;
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.5, 12), roofM);
    r1.position.y = 6.2;
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 8.5), roofM);
    r2.position.y = 10.8;
    const r3 = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.35, 6), roofM);
    r3.position.y = 14.4;
    g.add(base, mid, top, r1, r2, r3);
    const wins = [[-6, 3.2, 5.05], [0, 3.4, 5.05], [6, 3.1, 5.05], [-3, 8.4, 3.55], [3, 8.6, 3.55], [0, 12.4, 2.55]];
    for (let i = 0; i < wins.length; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), mat(0xffe0a8, { em: 0xffb15a, emI: 2.2 }));
      w.position.set(wins[i][0], wins[i][1], wins[i][2]);
      g.add(w);
      const h = halo(0xffb15a, 1.8);
      h.position.copy(w.position);
      g.add(h);
    }
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 18), stone);
    wallL.position.set(-12, 1.6, -6);
    const wallR = wallL.clone();
    wallR.position.x = 12;
    g.add(wallL, wallR);
    return g;
  };

  Renderer.prototype._buildPools = function () {
    const scene = this.scene;
    for (let i = 0; i < 8; i++) {
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 1.55, 28, 1, -1.05, 2.1),
        new THREE.MeshBasicMaterial({
          color: 0xe9fbff, transparent: true, opacity: 0.9,
          side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      arc.rotation.x = -Math.PI / 2;
      arc.visible = false;
      scene.add(arc);
      this.arcs.push(arc);
    }
    for (let i = 0; i < 16; i++) {
      const s = halo(0xfff6e8, 0.8);
      s.visible = false;
      scene.add(s);
      this.ghosts.push(s);
    }
    for (let i = 0; i < 56; i++) {
      const s = halo(0xffffff, 0.4);
      s.visible = false;
      scene.add(s);
      this.particles.push({ s: s, life: 0 });
    }
    this._p = 0;
  };

  Renderer.prototype.burst = function (x, z, color, n, speed, life) {
    for (let k = 0; k < n; k++) {
      const p = this.particles[this._p++ % this.particles.length];
      p.s.visible = true;
      p.s.position.set(x, 0.5 + Math.random() * 0.4, z);
      p.s.material.color.set(color);
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = 0.4 + Math.random() * speed * 0.5;
      p.vz = (Math.random() - 0.5) * speed;
      p.life = life * (0.6 + Math.random() * 0.5);
      p.max = p.life;
      p.s.scale.setScalar(0.2 + Math.random() * 0.45);
    }
  };

  Renderer.prototype.project = function (x, simY, h) {
    this._v.set(x, h, simY);
    this._v.project(this.cam);
    return {
      x: (this._v.x * 0.5 + 0.5) * this.w,
      y: (-this._v.y * 0.5 + 0.5) * this.h,
      on: this._v.z < 1 && this._v.z > -1,
    };
  };

  Renderer.prototype.aimGround = function (clientX, clientY) {
    const ndc = this._ndc || (this._ndc = new THREE.Vector2());
    ndc.x = (clientX / this.w) * 2 - 1;
    ndc.y = -(clientY / this.h) * 2 + 1;
    if (!this._ray) this._ray = new THREE.Raycaster();
    this._ray.setFromCamera(ndc, this.cam);
    const dir = this._ray.ray.direction;
    const o = this._ray.ray.origin;
    if (Math.abs(dir.y) < 1e-5) return null;
    const t = -o.y / dir.y;
    if (t < 0) return null;
    return { x: o.x + dir.x * t, y: o.z + dir.z * t };
  };

  Renderer.prototype.apply = function (snap) {
    if (!snap) return;
    this._last = snap;
    const seenP = new Set();
    for (let i = 0; i < snap.players.length; i++) {
      const p = snap.players[i];
      seenP.add(p.id);
      let g = this.players.get(p.id);
      if (!g) {
        g = makeHero(p.id);
        g.userData.born = false;
        this.scene.add(g);
        this.players.set(p.id, g);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.14, 1, 8, 1, true),
          new THREE.MeshBasicMaterial({
            color: p.id === 1 ? 0xd8fbff : 0xb8ffe8,
            transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
          })
        );
        beam.visible = false;
        this.scene.add(beam);
        this.beams.set(p.id, beam);
      }
      g.userData.target = p;
      if (!g.userData.born) {
        g.position.set(p.x, 0, p.y);
        g.userData.born = true;
      }
      if (p.flash) g.userData.flashT = 0.1;
    }
    this.players.forEach(function (g, id) {
      if (!seenP.has(id)) {
        g.visible = false;
      } else g.visible = true;
    });

    const seenE = new Set();
    for (let i = 0; i < snap.enemies.length; i++) {
      const e = snap.enemies[i];
      seenE.add(e.id);
      let g = this.enemies.get(e.id);
      if (!g) {
        const mk = MAKERS[e.kind] || makeKappa;
        g = mk();
        g.scale.setScalar(SCALES[e.kind] || 1);
        g.userData.born = false;
        this.scene.add(g);
        this.enemies.set(e.id, g);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.4, 2.2, 28),
          new THREE.MeshBasicMaterial({
            color: 0xff3355, transparent: true, opacity: 0.45,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        this.scene.add(ring);
        g.userData.ring = ring;
      }
      g.userData.target = e;
      if (!g.userData.born) {
        g.position.set(e.x, 0, e.y);
        g.userData.born = true;
      }
      if (e.flash) g.userData.flashT = 0.12;
    }
    const self = this;
    this.enemies.forEach(function (g, id) {
      if (!seenE.has(id)) {
        self.scene.remove(g);
        if (g.userData.ring) self.scene.remove(g.userData.ring);
        self.enemies.delete(id);
      }
    });

    this._syncShots(snap);
    this._syncDrops(snap);
    this._syncZones(snap);
    if (snap.gates) {
      for (let i = 0; i < this.gates.length && i < snap.gates.length; i++) {
        this.gates[i].closed = !!snap.gates[i];
      }
    }
    if (snap.events && snap.seq !== this._seq) {
      this._seq = snap.seq;
      this._playEvents(snap.events);
    }
  };

  Renderer.prototype._syncShots = function (snap) {
    const seen = new Set();
    for (let i = 0; i < snap.shots.length; i++) {
      const s = snap.shots[i];
      seen.add(s.id);
      let m = this.shots.get(s.id);
      if (!m) {
        const color = s.kind === 'feather' ? 0xd060ff : 0xf2f6ff;
        m = new THREE.Mesh(
          s.kind === 'kunai' ? new THREE.ConeGeometry(0.07, 0.32, 5) : new THREE.SphereGeometry(0.14, 8, 6),
          new THREE.MeshBasicMaterial({ color: color })
        );
        const h = halo(color, s.kind === 'feather' ? 0.7 : 0.4);
        m.add(h);
        this.scene.add(m);
        this.shots.set(s.id, m);
      }
      m.userData.s = s;
      m.userData.at = performance.now();
    }
    const self = this;
    this.shots.forEach(function (m, id) {
      if (!seen.has(id)) { self.scene.remove(m); self.shots.delete(id); }
    });
  };

  Renderer.prototype._syncDrops = function (snap) {
    const seen = new Set();
    for (let i = 0; i < snap.drops.length; i++) {
      const d = snap.drops[i];
      seen.add(d.id);
      let m = this.drops.get(d.id);
      if (!m) {
        const color = d.kind === 'elixir' ? 0x7dffb2 : d.kind === 'koban' ? 0xffd56a : 0xbff7ff;
        m = halo(color, d.kind === 'koban' ? 0.45 : 0.55);
        this.scene.add(m);
        this.drops.set(d.id, m);
      }
      m.userData.d = d;
    }
    const self = this;
    this.drops.forEach(function (m, id) {
      if (!seen.has(id)) { self.scene.remove(m); self.drops.delete(id); }
    });
  };

  Renderer.prototype._syncZones = function (snap) {
    const seen = new Set();
    for (let i = 0; i < snap.zones.length; i++) {
      const z = snap.zones[i];
      seen.add(z.id);
      let m = this.zones.get(z.id);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.CircleGeometry(1, 20),
          new THREE.MeshBasicMaterial({
            color: 0xe8d4ff, transparent: true, opacity: 0.28,
            side: THREE.DoubleSide, depthWrite: false,
          })
        );
        m.rotation.x = -Math.PI / 2;
        this.scene.add(m);
        this.zones.set(z.id, m);
      }
      m.position.set(z.x, 0.06, z.y);
      m.scale.setScalar(z.r);
    }
    const self = this;
    this.zones.forEach(function (m, id) {
      if (!seen.has(id)) { self.scene.remove(m); self.zones.delete(id); }
    });
  };

  Renderer.prototype._playEvents = function (events) {
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.id && this._seenEvents.has(e.id)) continue;
      if (e.id) this._seenEvents.add(e.id);
      if (this.onEvent) this.onEvent(e);
      if (e.k === 'hit') this.burst(e.x, e.y, e.mag === 'beam' ? 0xbff7ff : e.mag === 'seal' ? 0xffe2a0 : 0xffffff, 8, 4.5, 0.35);
      else if (e.k === 'die') this.burst(e.x, e.y, e.kind === 'oni' ? 0xff4040 : 0xd0b0ff, 18, 6, 0.55);
      else if (e.k === 'slash') this._arc(e.x, e.y, e.a, e.combo);
      else if (e.k === 'burst' || e.k === 'slam') {
        this.burst(e.x, e.y, e.k === 'slam' ? 0xff3355 : 0xfff0c0, 16, 7, 0.45);
        this.shake = Math.max(this.shake, e.k === 'slam' ? 0.55 : 0.32);
      } else if (e.k === 'hurt') this.shake = Math.max(this.shake, 0.22);
      else if (e.k === 'dash') this.burst(e.x, e.y, 0xd8fbff, 6, 3, 0.25);
    }
    if (this._seenEvents.size > 400) this._seenEvents.clear();
  };

  Renderer.prototype._arc = function (x, y, a, combo) {
    let arc = null;
    for (let i = 0; i < this.arcs.length; i++) if (!this.arcs[i].visible) { arc = this.arcs[i]; break; }
    if (!arc) arc = this.arcs[0];
    arc.visible = true;
    arc.position.set(x, 0.72, y);
    arc.rotation.x = -Math.PI / 2;
    arc.rotation.z = -a + Math.PI / 2;
    const sc = combo === 2 ? 1.45 : combo === 1 ? 1.15 : 0.95;
    arc.scale.setScalar(sc);
    arc.material.color.set(combo === 2 ? 0xfff2c0 : 0xe7fbff);
    arc.material.opacity = 0.95;
    arc.userData.life = 0.16;
  };

  Renderer.prototype.frame = function (dt) {
    this.time += dt;
    const k = 1 - Math.exp(-this.smooth * dt);
    const self = this;

    this.players.forEach(function (g, id) {
      const p = g.userData.target;
      if (!p || !g.visible) return;
      if (!g.userData.born) return;
      g.position.x += (p.x - g.position.x) * k;
      g.position.z += (p.y - g.position.z) * k;
      const face = Math.PI / 2 - p.f;
      let df = face - g.rotation.y;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      g.rotation.y += df * Math.min(1, k * 1.4);
      const bob = p.anim === 'run' ? Math.sin(self.time * 13 + id) * 0.07 : Math.sin(self.time * 2.2 + id) * 0.02;
      const sink = p.dead ? Math.min(0.8, (p.down || 0) * 0.15) : 0;
      g.position.y = bob - sink;
      if (g.userData.cape) {
        g.userData.cape.rotation.x = 0.22 + Math.sin(self.time * 3 + id) * 0.08 + (p.anim === 'run' || p.anim === 'dash' ? 0.35 : 0);
      }
      if (g.userData.pivot) {
        const sw = p.anim === 'slash' ? Math.sin((p.sw || 0) * Math.PI) : 0;
        g.userData.pivot.rotation.y = -1.2 + sw * 2.6;
        g.userData.pivot.rotation.x = sw * 0.4;
      }
      g.userData.flashT = (g.userData.flashT || 0) - dt;
      const on = g.userData.flashT > 0;
      if (on !== g.userData.wasFlash) {
        g.userData.wasFlash = on;
        const mats = g.userData.mats || [];
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (on) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 2.4; }
          else { m.emissive.copy(m.userData.baseE); m.emissiveIntensity = m.userData.baseI; }
        }
      }
      const beam = self.beams.get(id);
      if (beam) {
        if (p.beam && p.beam.x != null) {
          beam.visible = true;
          const a = new THREE.Vector3(g.position.x, 0.85, g.position.z);
          const b = new THREE.Vector3(p.beam.x, 0.85, p.beam.y);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const dist = Math.max(0.2, a.distanceTo(b));
          beam.position.copy(mid);
          beam.scale.set(1, dist, 1);
          beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          beam.material.opacity = 0.55 + Math.sin(self.time * 40) * 0.25;
        } else beam.visible = false;
      }
      if (p.dash) {
        const ghost = self.ghosts[self._p % self.ghosts.length];
        self._p++;
        ghost.visible = true;
        ghost.position.set(g.position.x, 0.7, g.position.z);
        ghost.material.color.set(id === 1 ? 0xffb089 : 0x9ff0e0);
        ghost.userData.life = 0.22;
        ghost.scale.setScalar(1.1);
      }
    });

    this.enemies.forEach(function (g) {
      const e = g.userData.target;
      if (!e) return;
      g.position.x += (e.x - g.position.x) * k;
      g.position.z += (e.y - g.position.z) * k;
      const face = Math.PI / 2 - e.f;
      let df = face - g.rotation.y;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      g.rotation.y += df * Math.min(1, k);
      const sink = e.dead ? Math.min(1.2, e.die * 0.9) : 0;
      const bob = e.anim === 'run' ? Math.abs(Math.sin(self.time * 10 + e.id)) * 0.05 : 0;
      g.position.y = bob - sink;
      if (e.dead) g.rotation.z = Math.min(1.2, e.die * 1.4);
      else g.rotation.z *= 0.8;
      if (g.userData.wingL) {
        g.userData.wingL.rotation.z = Math.sin(self.time * 8 + e.id) * 0.4;
        g.userData.wingR.rotation.z = -Math.sin(self.time * 8 + e.id) * 0.4;
      }
      if (g.userData.legs) {
        for (let i = 0; i < g.userData.legs.length; i++) {
          const leg = g.userData.legs[i];
          leg.rotation.z = Math.cos(leg.userData.a + self.time * 6) * 0.6;
        }
      }
      if (g.userData.club) {
        g.userData.club.rotation.x = e.anim === 'swing' || e.anim === 'slam' ? Math.sin((e.ph || 0) * Math.PI) * 1.4 : 0.4;
      }
      g.userData.flashT = (g.userData.flashT || 0) - dt;
      const on = g.userData.flashT > 0;
      if (on !== g.userData.wasFlash) {
        g.userData.wasFlash = on;
        const mats = g.userData.mats || [];
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (on) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 3; }
          else { m.emissive.copy(m.userData.baseE); m.emissiveIntensity = m.userData.baseI; }
        }
      }
      if (g.userData.ring) {
        const ring = g.userData.ring;
        if (e.wind > 0.02 && !e.dead) {
          ring.visible = true;
          ring.position.set(e.tx, 0.08, e.ty);
          const sc = 0.3 + e.wind * 1.1;
          ring.scale.setScalar(sc);
          ring.material.opacity = 0.2 + e.wind * 0.5;
        } else ring.visible = false;
      }
    });

    const now = performance.now();
    this.shots.forEach(function (m) {
      const s = m.userData.s;
      const age = Math.min(0.08, (now - (m.userData.at || now)) / 1000);
      m.position.set(s.x + s.vx * age, 0.55, s.y + s.vy * age);
      if (s.kind === 'kunai') m.lookAt(m.position.x + s.vx, 0.55, m.position.z + s.vy);
    });

    this.drops.forEach(function (m) {
      const d = m.userData.d;
      m.position.x += (d.x - m.position.x) * k;
      m.position.z += (d.y - m.position.z) * k;
      m.position.y = 0.35 + Math.sin(self.time * 4 + d.id) * 0.08;
    });

    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      const want = g.closed ? g.shutY : g.openY;
      g.mesh.position.y += (want - g.mesh.position.y) * Math.min(1, dt * 6);
      g.seal.visible = !!g.closed;
    }

    for (let i = 0; i < this.arcs.length; i++) {
      const a = this.arcs[i];
      if (!a.visible) continue;
      a.userData.life -= dt;
      a.material.opacity = Math.max(0, a.userData.life / 0.16);
      a.scale.multiplyScalar(1 + dt * 1.5);
      if (a.userData.life <= 0) a.visible = false;
    }
    for (let i = 0; i < this.ghosts.length; i++) {
      const s = this.ghosts[i];
      if (!s.visible || s.userData.life == null) continue;
      s.userData.life -= dt;
      s.material.opacity = Math.max(0, s.userData.life / 0.22);
      if (s.userData.life <= 0) s.visible = false;
    }
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      p.vy -= dt * 3;
      p.s.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) p.s.visible = false;
    }
    for (let i = 0; i < this.flies.length; i++) {
      const f = this.flies[i];
      const b = f.userData.base;
      f.position.x = b.x + Math.sin(this.time * 0.7 + f.userData.ph) * 0.6;
      f.position.y = b.y + Math.sin(this.time * 1.7 + f.userData.ph) * 0.25;
      f.position.z = b.z + Math.cos(this.time * 0.5 + f.userData.ph) * 0.6;
    }
    if (this.waterMap) this.waterMap.offset.y = this.time * 0.05;

    this._updateLamps();
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.cam);

    this.frameTimes.push(dt);
    if (this.frameTimes.length > 12) this.frameTimes.shift();
    if (this.shadows && this.frameTimes.length === 12) {
      let sum = 0;
      for (let i = 0; i < this.frameTimes.length; i++) sum += this.frameTimes[i];
      if (sum / this.frameTimes.length > 0.045) {
        this.shadows = false;
        this.renderer.shadowMap.enabled = false;
        this.moon.castShadow = false;
      }
    }
  };

  Renderer.prototype._updateLamps = function () {
    const focus = this._focus || { x: 0, z: 8 };
    const lamps = this.lamps;
    const ranked = [];
    for (let i = 0; i < lamps.length; i++) {
      const lp = lamps[i].getWorldPosition(this._v);
      const dx = lp.x - focus.x, dz = lp.z - focus.z;
      ranked.push({ i: i, d: dx * dx + dz * dz, p: lp.clone() });
    }
    ranked.sort(function (a, b) { return a.d - b.d; });
    for (let i = 0; i < this.lampLights.length; i++) {
      const L = this.lampLights[i];
      if (i < ranked.length) {
        L.position.copy(ranked[i].p);
        L.intensity = 3.2;
      } else L.intensity = 0;
    }
  };

  Renderer.prototype.focusOf = function (snap) {
    if (!snap) return { x: 0, z: 14, y: 14, combat: false, vista: false };
    let p = null;
    for (let i = 0; i < snap.players.length; i++) if (snap.players[i].id === this.localId) p = snap.players[i];
    if (!p && snap.players[0]) p = snap.players[0];
    if (!p) return { x: 0, z: 14, y: 14, combat: false, vista: false };
    let combat = false;
    for (let i = 0; i < snap.enemies.length; i++) {
      const e = snap.enemies[i];
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < 13 * 13) combat = true;
    }
    const vista = !combat && p.y > 164 && p.y < 182;
    return { x: p.x, z: p.y, y: p.y, combat: combat, vista: vista };
  };

  Renderer.prototype._updateCamera = function (dt) {
    let wantH, wantB, wantA, fx, fz;
    if (this.mode === 'title') {
      wantH = 8.2;
      wantB = 12;
      wantA = 8;
      fx = Math.sin(this.time * 0.18) * 1.4;
      fz = 12;
    } else {
      const f = this.focusOf(this._last);
      this._focus = { x: f.x, z: f.z };
      wantH = f.combat ? 11.2 : f.vista ? 6.2 : 9.6;
      wantB = f.combat ? 10.2 : f.vista ? 14.5 : 11.4;
      wantA = f.combat ? 2.6 : f.vista ? 18 : 5.2;
      fx = f.x;
      fz = f.z;
      /* keep the moon light's shadow box on the player */
      this.moon.position.set(fx + 14, 26, fz + 6);
      this.moon.target.position.set(fx, 0, fz);
      this.moon.target.updateMatrixWorld();
    }
    const ck = 1 - Math.exp(-2.4 * dt);
    this.camH += (wantH - this.camH) * ck;
    this.camB += (wantB - this.camB) * ck;
    this.camA += (wantA - this.camA) * ck;
    const shake = this.shake;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sx = (Math.random() - 0.5) * shake;
    const sz = (Math.random() - 0.5) * shake;
    const px = fx + sx;
    const pz = fz - this.camB + sz;
    if (this.snapCam && this.mode !== 'title') {
      this.snapCam = false;
      this.camH = wantH;
      this.camB = wantB;
      this.camA = wantA;
      this._cx = px;
      this._cz = pz;
      this.cam.position.set(px, wantH, pz);
    }
    const lk = 1 - Math.exp(-3.2 * dt);
    if (this._cx == null) { this._cx = px; this._cz = pz; }
    this._cx += (px - this._cx) * lk;
    this._cz += (pz - this._cz) * lk;
    this.cam.position.set(this._cx, this.camH, this._cz);
    this.cam.lookAt(fx, 0.8, fz + this.camA);
  };

  window.YokaiRender = Renderer;
})();
