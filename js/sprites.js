'use strict';
/* Original pixel actors for a high-angle night road.
   Drawn here, not traced. One sheet per kind: 4 facings x idle/step/slash. */
(function () {
  const PW = 32, PH = 40, COLS = 4, ROWS = 3;

  function blit(d, w, x, y, c) {
    if (x < 0 || y < 0 || x >= w || y >= PH) return;
    const i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] == null ? 255 : c[3];
  }
  function rect(d, w, x, y, rw, rh, c) {
    for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) blit(d, w, x + xx, y + yy, c);
  }
  function outline(d, w) {
    const src = new Uint8ClampedArray(d);
    const h = PH;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3] > 10) continue;
        let hit = false;
        if (x > 0 && src[i - 4 + 3] > 200) hit = true;
        if (x + 1 < w && src[i + 4 + 3] > 200) hit = true;
        if (y > 0 && src[i - w * 4 + 3] > 200) hit = true;
        if (y + 1 < h && src[i + w * 4 + 3] > 200) hit = true;
        if (hit) { d[i] = 10; d[i + 1] = 6; d[i + 2] = 12; d[i + 3] = 255; }
      }
    }
  }
  function mirror(d, w) {
    for (let y = 0; y < PH; y++) {
      for (let x = 0; x < (w >> 1); x++) {
        const a = (y * w + x) * 4;
        const b = (y * w + (w - 1 - x)) * 4;
        for (let k = 0; k < 4; k++) { const t = d[a + k]; d[a + k] = d[b + k]; d[b + k] = t; }
      }
    }
  }

  const INK = [12, 8, 14, 255];
  const SKIN = [222, 186, 150, 255];
  const STEEL = [232, 242, 246, 255];
  const CYAN = [186, 255, 252, 255];

  function hero(buf, dir, pose, pal) {
    const step = pose === 1 ? 1 : 0;
    const slash = pose === 2;
    const robe = pal.robe, cape = pal.cape, hat = pal.hat, hatD = pal.hatD;
    if (dir === 0) {
      rect(buf, PW, 8, 3, 16, 6, hat);
      rect(buf, PW, 6, 8, 20, 3, hatD);
      rect(buf, PW, 10, 12, 12, 16, cape);
      rect(buf, PW, 12, 14, 8, 8, robe);
      rect(buf, PW, 14, 18, 4, 5, [244, 236, 220, 255]);
      blit(buf, PW, 15, 20, CYAN); blit(buf, PW, 16, 21, CYAN);
      rect(buf, PW, 11, 28 + step, 4, 8, INK);
      rect(buf, PW, 17, 28 - step, 4, 8, INK);
      rect(buf, PW, 22, 16, 2, 14, STEEL);
      rect(buf, PW, 21, 16, 4, 2, pal.trim);
    } else if (dir === 2) {
      rect(buf, PW, 7, 6, 18, 3, hatD);
      rect(buf, PW, 11, 2, 10, 5, hat);
      rect(buf, PW, 12, 9, 8, 6, SKIN);
      blit(buf, PW, 14, 11, INK); blit(buf, PW, 18, 11, INK);
      rect(buf, PW, 10, 15, 12, 14, robe);
      rect(buf, PW, 10, 20, 12, 3, pal.trim);
      rect(buf, PW, 11, 29 + step, 4, 8, INK);
      rect(buf, PW, 17, 29 - step, 4, 8, INK);
      if (slash) {
        rect(buf, PW, 22, 12, 8, 2, STEEL);
        rect(buf, PW, 24, 8, 2, 6, CYAN);
        blit(buf, PW, 27, 7, CYAN); blit(buf, PW, 28, 10, CYAN);
      } else rect(buf, PW, 22, 18, 2, 12, STEEL);
    } else {
      rect(buf, PW, 10, 3, 12, 5, hat);
      rect(buf, PW, 8, 7, 16, 3, hatD);
      rect(buf, PW, 14, 10, 6, 5, SKIN);
      blit(buf, PW, 18, 12, INK);
      rect(buf, PW, 12, 15, 9, 14, robe);
      rect(buf, PW, 8, 16, 5, 12, cape);
      rect(buf, PW, 13, 30 + step, 4, 7, INK);
      rect(buf, PW, 18, 30 - step, 3, 7, INK);
      if (slash) {
        rect(buf, PW, 20, 14, 10, 2, STEEL);
        for (let i = 0; i < 6; i++) blit(buf, PW, 22 + i, 12 - (i % 3), CYAN);
      } else {
        rect(buf, PW, 20, 18, 8, 2, STEEL);
      }
      if (dir === 3) mirror(buf, PW);
    }
  }

  function kappa(buf, dir, pose) {
    const step = pose === 1 ? 1 : 0;
    const g = [36, 150, 78, 255], gD = [18, 90, 48, 255], sh = [58, 110, 52, 255];
    const dish = [176, 236, 226, 255], beak = [230, 186, 70, 255];
    rect(buf, PW, 8, 14, 16, 12, g);
    rect(buf, PW, 10, 10, 12, 6, sh);
    rect(buf, PW, 11, 8, 10, 2, dish);
    rect(buf, PW, 14, 16, 4, 3, gD);
    if (dir === 2 || dir === 1 || dir === 3) {
      rect(buf, PW, dir === 0 ? 14 : 18, 18, 5, 2, beak);
    }
    rect(buf, PW, 10, 26 + step, 4, 6, gD);
    rect(buf, PW, 18, 26 - step, 4, 6, gD);
    if (pose === 2) rect(buf, PW, 22, 18, 6, 2, [255, 255, 255, 255]);
    if (dir === 3) mirror(buf, PW);
  }

  function kumo(buf, dir, pose) {
    const body = [28, 16, 32, 255], leg = [16, 10, 18, 255], eye = [255, 70, 150, 255];
    rect(buf, PW, 8, 16, 16, 10, body);
    for (let i = 0; i < 4; i++) {
      const o = pose === 1 && i % 2 ? 1 : 0;
      rect(buf, PW, 6 + i * 5, 26 + o, 2, 7, leg);
    }
    blit(buf, PW, 12, 19, eye); blit(buf, PW, 18, 19, eye);
    if (pose === 2) rect(buf, PW, 22, 18, 6, 2, eye);
    if (dir === 3) mirror(buf, PW);
  }

  function tengu(buf, dir, pose) {
    const robe = [16, 14, 26, 255], face = [176, 42, 42, 255], wing = [48, 28, 78, 255];
    const nose = [196, 64, 58, 255];
    rect(buf, PW, 4, 12, 8, 10, wing);
    rect(buf, PW, 20, 12, 8, 10, wing);
    rect(buf, PW, 11, 10, 10, 18, robe);
    rect(buf, PW, 12, 6, 8, 6, face);
    if (dir !== 0) rect(buf, PW, dir === 2 ? 15 : 18, 8, 6, 2, nose);
    rect(buf, PW, 12, 4, 8, 3, [12, 10, 16, 255]);
    const step = pose === 1 ? 1 : 0;
    rect(buf, PW, 12, 28 + step, 3, 8, robe);
    rect(buf, PW, 17, 28 - step, 3, 8, robe);
    if (pose === 2) {
      for (let i = 0; i < 8; i++) blit(buf, PW, 20 + (i % 5), 14 + (i % 3), [210, 90, 255, 255]);
    }
    if (dir === 3) mirror(buf, PW);
  }

  function joro(buf, dir, pose) {
    const skin = [236, 220, 206, 255], hair = [22, 12, 16, 255], red = [150, 28, 52, 255];
    const leg = [28, 16, 22, 255];
    rect(buf, PW, 12, 8, 8, 10, hair);
    rect(buf, PW, 13, 12, 6, 5, skin);
    if (dir === 2) { blit(buf, PW, 14, 14, INK); blit(buf, PW, 17, 14, INK); }
    rect(buf, PW, 11, 17, 10, 8, red);
    for (let i = 0; i < 4; i++) {
      const o = pose === 1 && i % 2 ? 2 : 0;
      rect(buf, PW, 6 + i * 5, 24 + o, 2, 10, leg);
    }
    if (pose === 2) rect(buf, PW, 4, 20, 24, 2, [255, 80, 120, 180]);
    if (dir === 3) mirror(buf, PW);
  }

  function oni(buf, dir, pose) {
    const skin = [168, 36, 40, 255], horn = [242, 232, 210, 255], belt = [198, 122, 42, 255];
    const club = [92, 64, 40, 255];
    rect(buf, PW, 10, 4, 3, 5, horn);
    rect(buf, PW, 19, 4, 3, 5, horn);
    rect(buf, PW, 9, 8, 14, 10, skin);
    if (dir === 2) { blit(buf, PW, 12, 12, [255, 220, 80, 255]); blit(buf, PW, 18, 12, [255, 220, 80, 255]); }
    rect(buf, PW, 8, 18, 16, 12, skin);
    rect(buf, PW, 8, 24, 16, 3, belt);
    const step = pose === 1 ? 1 : 0;
    rect(buf, PW, 10, 30 + step, 4, 8, [90, 18, 22, 255]);
    rect(buf, PW, 18, 30 - step, 4, 8, [90, 18, 22, 255]);
    if (pose === 2) rect(buf, PW, 22, 10, 4, 16, club);
    else rect(buf, PW, 23, 16, 3, 14, club);
    if (dir === 3) mirror(buf, PW);
  }

  const DRAW = { kaede: hero, shio: hero, kappa: kappa, kumo: kumo, tengu: tengu, jorogumo: joro, oni: oni };
  const PALS = {
    kaede: { robe: [26, 32, 78, 255], cape: [150, 32, 42, 255], hat: [122, 28, 36, 255], hatD: [70, 16, 22, 255], trim: [196, 48, 52, 255] },
    shio: { robe: [16, 72, 74, 255], cape: [28, 120, 112, 255], hat: [14, 48, 52, 255], hatD: [10, 32, 36, 255], trim: [212, 176, 86, 255] },
  };

  const sheets = {};
  function sheet(kind) {
    if (sheets[kind]) return sheets[kind];
    const c = document.createElement('canvas');
    c.width = PW * COLS;
    c.height = PH * ROWS;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const data = img.data;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const buf = new Uint8ClampedArray(PW * PH * 4);
        const fn = DRAW[kind];
        if (kind === 'kaede' || kind === 'shio') fn(buf, col, row, PALS[kind]);
        else fn(buf, col, row);
        outline(buf, PW);
        for (let y = 0; y < PH; y++) {
          for (let x = 0; x < PW; x++) {
            const s = (y * PW + x) * 4;
            if (buf[s + 3] === 0) continue;
            const dx = col * PW + x;
            const dy = row * PH + y;
            const di = (dy * c.width + dx) * 4;
            data[di] = buf[s]; data[di + 1] = buf[s + 1]; data[di + 2] = buf[s + 2]; data[di + 3] = buf[s + 3];
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    sheets[kind] = tex;
    return tex;
  }

  function actor(kind) {
    const tex = sheet(kind).clone();
    tex.repeat.set(1 / COLS, 1 / ROWS);
    tex.offset.set(0, 1 - 1 / ROWS);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.center.set(0.5, 0.08);
    const h = kind === 'oni' ? 2.6 : kind === 'tengu' || kind === 'jorogumo' ? 2.05 : kind === 'kumo' ? 1.45 : kind === 'kappa' ? 1.6 : 1.9;
    s.scale.set(h * 0.8, h, 1);
    s.userData.kind = kind;
    return s;
  }

  function pose(sprite, anim, facing, time, flash) {
    const x = Math.cos(facing), y = Math.sin(facing);
    let col = 0;
    if (Math.abs(x) > Math.abs(y) * 0.85) col = x > 0 ? 1 : 3;
    else col = y > 0 ? 0 : 2;
    let row = 0;
    if (anim === 'slash' || anim === 'swing' || anim === 'slam') row = 2;
    else if (anim === 'run' || anim === 'dash' || anim === 'charge') row = (Math.floor(time * 8) % 2) ? 1 : 0;
    const tex = sprite.material.map;
    tex.offset.set(col / COLS, 1 - (row + 1) / ROWS);
    if (flash) sprite.material.color.setScalar(7);
    else sprite.material.color.setScalar(1);
  }

  window.YokaiSprites = { actor: actor, pose: pose };
})();
