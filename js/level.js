'use strict';
/* The night road: a single winding approach from the cedar shrine to the oni gate.
   Coordinates are ground-plane metres. +Y is up the road (rendered as +Z). */
(function () {
  const segments = [
    { y0: -4, y1: 24, x0: -7.2, x1: 7.2, wall: 2.4 },
    { y0: 24, y1: 58, x0: -11.2, x1: 11.2, wall: 2.8 },
    { y0: 58, y1: 86, x0: -5.5, x1: 5.5, wall: 4.6 },
    { y0: 86, y1: 118, x0: -11.2, x1: 11.2, wall: 3.4 },
    { y0: 118, y1: 132, x0: -6.4, x1: 6.4, wall: 3.0 },
    { y0: 132, y1: 164, x0: -11.4, x1: 11.4, wall: 3.2 },
    { y0: 164, y1: 180, x0: -7.6, x1: 7.6, wall: 3.6 },
    { y0: 180, y1: 214, x0: -12.2, x1: 12.2, wall: 5.2 },
  ];

  const shrines = [
    { id: 'cedar', name: 'Cedar Shrine', x: 0, y: 2.6, sx: 0, sy: 7.1 },
    { id: 'bamboo', name: 'Bamboo Hokora', x: 0, y: 72, sx: 0, sy: 74.2 },
    { id: 'stone', name: 'Stone Hokora', x: 0, y: 124.2, sx: 0, sy: 126.4 },
    { id: 'gate', name: 'Gate Shrine', x: 0, y: 172, sx: 0, sy: 174.2 },
  ];

  const arenas = [
    {
      id: 'ford', name: 'Kappa Ford', trigger: 32, gates: [26.2, 56.2],
      spawns: [
        { kind: 'kappa', x: -4.2, y: 42 },
        { kind: 'kappa', x: 3.6, y: 40 },
        { kind: 'kappa', x: -1.5, y: 48.5 },
        { kind: 'kappa', x: 5.1, y: 50 },
      ],
    },
    {
      id: 'ridge', name: 'Tengu Ridge', trigger: 94, gates: [88.2, 115.6],
      spawns: [
        { kind: 'tengu', x: -6.4, y: 104 },
        { kind: 'tengu', x: 6.2, y: 100 },
        { kind: 'kappa', x: -2.2, y: 96 },
        { kind: 'kappa', x: 2.4, y: 108 },
      ],
    },
    {
      id: 'court', name: 'Jorogumo Court', trigger: 140, gates: [134.2, 161.5],
      spawns: [
        { kind: 'jorogumo', x: 0.4, y: 152 },
        { kind: 'kumo', x: -4.4, y: 142 },
        { kind: 'kumo', x: 4.6, y: 144 },
        { kind: 'kumo', x: -3.2, y: 156 },
        { kind: 'kumo', x: 3.8, y: 148 },
      ],
    },
    {
      id: 'gate', name: 'Oni Gate', trigger: 186, gates: [181.2], boss: true,
      spawns: [{ kind: 'oni', x: 0, y: 198 }],
    },
  ];

  const water = [{ x0: -8.2, y0: 37.5, x1: 8.2, y1: 49.5 }];

  const decor = [];
  const solids = [];
  function prop(k, x, y, r, extra) {
    decor.push(Object.assign({ k: k, x: x, y: y }, extra || {}));
    if (r) solids.push({ x: x, y: y, r: r });
  }

  prop('shrine', 0, 2.5, 1.25, { s: 1.15 });
  prop('torii', 0, 20.2, 0, { s: 1.2 });
  solids.push({ x: -1.9, y: 20.2, r: 0.34 });
  solids.push({ x: 1.9, y: 20.2, r: 0.34 });
  prop('lantern', -3.7, 8.2, 0.28);
  prop('lantern', 3.7, 8.2, 0.28);
  prop('lantern', -3.5, 15.4, 0.28);
  prop('lantern', 3.5, 15.4, 0.28);
  prop('lantern', -4.6, 27, 0.28);
  prop('lantern', 4.8, 29, 0.28);
  prop('pine', -5.4, 11, 0.62, { s: 1.15 });
  prop('pine', 5.6, 13.5, 0.62, { s: 0.9 });
  prop('pine', -5.8, 22.5, 0.55, { s: 1.3 });
  prop('pine', 6.1, 6.4, 0.55, { s: 0.8 });
  prop('rock', -8.4, 36, 0.85, { s: 1.1 });
  prop('rock', 8.6, 44, 0.75, { s: 0.85 });
  prop('rock', -7.2, 51, 0.7, { s: 0.7 });
  prop('bridge', 0, 43.5, 0, { s: 1 });

  for (let y = 60; y < 84; y += 2.15) {
    prop('bamboo', -4.15, y, 0.34, { s: 0.85 + ((y * 3) % 5) * 0.06 });
    prop('bamboo', 4.15, y + 0.4, 0.34, { s: 0.9 + ((y * 5) % 4) * 0.05 });
    if (Math.floor(y) % 4 === 0) {
      prop('bamboo', -3.15, y + 1.0, 0.28, { s: 0.7 });
      prop('bamboo', 3.2, y + 0.2, 0.28, { s: 0.75 });
    }
  }
  prop('lantern', -2.2, 70.5, 0.26);
  prop('lantern', 2.2, 73.6, 0.26);
  prop('hokora', 0, 71.6, 0.7, { s: 0.85 });

  prop('pine', -8.6, 92, 0.7, { s: 1.4 });
  prop('pine', 8.8, 96, 0.65, { s: 1.2 });
  prop('pine', -9.2, 108, 0.6, { s: 1.05 });
  prop('pine', 9.0, 112, 0.7, { s: 1.35 });
  prop('rock', -6.8, 99, 0.9, { s: 1.2 });
  prop('rock', 7.1, 106, 0.8, { s: 1 });
  prop('lantern', -4.2, 90.5, 0.28);
  prop('lantern', 4.4, 114, 0.28);
  prop('jizo', -2.4, 122.5, 0.32);
  prop('jizo', 2.4, 122.5, 0.32);
  prop('hokora', 0, 124, 0.75, { s: 0.9 });
  prop('lantern', -3.3, 126.8, 0.26);
  prop('lantern', 3.3, 126.8, 0.26);

  prop('webgate', 0, 136.5, 0, { s: 1 });
  prop('pine', -8.8, 140, 0.6, { s: 1.1, tint: 'pale' });
  prop('pine', 8.6, 146, 0.6, { s: 1.25, tint: 'pale' });
  prop('pine', -9, 156, 0.55, { s: 0.95, tint: 'pale' });
  prop('rock', 7.4, 152, 0.7, { s: 0.8 });
  prop('lantern', -5.2, 138, 0.28);
  prop('lantern', 5.4, 159, 0.28);

  prop('lantern', -3.4, 168, 0.28);
  prop('lantern', 3.4, 168, 0.28);
  prop('lantern', -3.2, 176, 0.28);
  prop('lantern', 3.2, 176, 0.28);
  prop('hokora', 0, 171.8, 0.7, { s: 0.8 });
  prop('pine', -5.8, 166, 0.55, { s: 1.2 });
  prop('pine', 5.9, 169, 0.55, { s: 1 });

  prop('wall', -6.5, 192, 0.4, { s: 1 });
  prop('wall', 6.5, 192, 0.4, { s: 1 });
  prop('lantern', -5.2, 186, 0.3);
  prop('lantern', 5.2, 186, 0.3);
  prop('lantern', -5.4, 200, 0.3);
  prop('lantern', 5.4, 200, 0.3);
  prop('torii', 0, 208.5, 0, { s: 1.65 });
  solids.push({ x: -2.6, y: 208.5, r: 0.4 });
  solids.push({ x: 2.6, y: 208.5, r: 0.4 });
  prop('castle', 0, 236, 0, { s: 1 });

  function segmentAt(y) {
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (y >= s.y0 && y < s.y1) return s;
    }
    if (y < segments[0].y0) return segments[0];
    return segments[segments.length - 1];
  }

  function inWater(x, y) {
    for (let i = 0; i < water.length; i++) {
      const w = water[i];
      if (x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1) return true;
    }
    return false;
  }

  window.Level = {
    segments: segments,
    shrines: shrines,
    arenas: arenas,
    water: water,
    decor: decor,
    solids: solids,
    y0: -3,
    y1: 212,
    segmentAt: segmentAt,
    inWater: inWater,
  };
})();
