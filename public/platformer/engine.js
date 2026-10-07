(function (root) {
  "use strict";
  const levels = [
    {
      name: "风起草甸",
      subtitle: "第一次远行，从轻轻一跃开始。",
      width: 2240,
      palette: "meadow",
      floors: [
        [0, 370, 540, 100],
        [640, 370, 570, 100],
        [1310, 370, 490, 100],
        [1890, 370, 350, 100],
      ],
      platforms: [
        [200, 290, 120, 18],
        [750, 285, 115, 18],
        [1440, 280, 120, 18],
        [1990, 280, 100, 18],
      ],
      spikes: [
        [365, 354, 34, 16],
        [985, 354, 36, 16],
        [1660, 354, 40, 16],
      ],
      patrols: [],
      checkpoints: [
        { x: 700, y: 332 },
        { x: 1380, y: 332 },
      ],
      coins: [
        [155, 325],
        [255, 255],
        [430, 325],
        [700, 325],
        [800, 250],
        [1070, 325],
        [1370, 325],
        [1490, 245],
        [1725, 325],
        [1940, 325],
        [2040, 245],
        [2160, 315],
      ],
      goal: { x: 2170, y: 298, w: 46, h: 72 },
    },
    {
      name: "落日石径",
      subtitle: "看准落脚点，再向前一步。",
      width: 2600,
      palette: "sunset",
      floors: [
        [0, 370, 460, 100],
        [575, 370, 500, 100],
        [1200, 370, 610, 100],
        [1940, 370, 660, 100],
      ],
      platforms: [
        [130, 285, 110, 18],
        [735, 290, 110, 18],
        [900, 230, 95, 18],
        [1230, 285, 110, 18],
        [2110, 285, 100, 18],
        [2260, 230, 100, 18],
      ],
      spikes: [
        [350, 354, 45, 16],
        [1440, 354, 48, 16],
        [2290, 354, 50, 16],
      ],
      patrols: [
        { x: 805, y: 340, w: 26, h: 26, min: 770, max: 1010, speed: 70 },
      ],
      checkpoints: [
        { x: 650, y: 332 },
        { x: 1260, y: 332 },
        { x: 2000, y: 332 },
      ],
      coins: [
        [160, 325],
        [280, 250],
        [620, 325],
        [785, 255],
        [945, 195],
        [1250, 325],
        [1285, 250],
        [1610, 325],
        [1760, 325],
        [2010, 325],
        [2160, 250],
        [2310, 195],
        [2420, 325],
        [2500, 315],
      ],
      goal: { x: 2520, y: 298, w: 46, h: 72 },
    },
    {
      name: "云端归途",
      subtitle: "最后一程，把星光带回家。",
      width: 2920,
      palette: "cloud",
      floors: [
        [0, 370, 420, 100],
        [540, 370, 450, 100],
        [1120, 370, 550, 100],
        [1810, 370, 480, 100],
        [2410, 370, 510, 100],
      ],
      platforms: [
        [110, 290, 100, 18],
        [560, 285, 90, 18],
        [1150, 285, 110, 18],
        [1480, 265, 110, 18],
        [1940, 280, 100, 18],
        [2570, 285, 110, 18],
        [2720, 225, 100, 18],
      ],
      spikes: [
        [310, 354, 48, 16],
        [760, 354, 55, 16],
        [1390, 354, 60, 16],
        [2120, 354, 60, 16],
      ],
      patrols: [
        { x: 1510, y: 245, w: 26, h: 26, min: 1490, max: 1620, speed: 72 },
        { x: 2600, y: 220, w: 26, h: 26, min: 2500, max: 2800, speed: 85 },
      ],
      checkpoints: [
        { x: 590, y: 332 },
        { x: 1170, y: 332 },
        { x: 1870, y: 332 },
        { x: 2460, y: 332 },
      ],
      coins: [
        [150, 325],
        [245, 255],
        [590, 325],
        [605, 250],
        [880, 315],
        [1180, 325],
        [1205, 250],
        [1530, 230],
        [1870, 325],
        [1990, 245],
        [2210, 325],
        [2460, 325],
        [2620, 250],
        [2770, 190],
        [2840, 315],
      ],
      goal: { x: 2840, y: 298, w: 46, h: 72 },
    },
  ];
  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const blocks = (level) =>
    [...level.floors, ...level.platforms].map(([x, y, w, h]) => ({
      x,
      y,
      w,
      h,
    }));
  function createState(index = 0) {
    return {
      index,
      phase: "ready",
      player: {
        x: 65,
        y: 332,
        w: 28,
        h: 38,
        vx: 0,
        vy: 0,
        grounded: true,
        facing: 1,
      },
      time: 0,
      deaths: 0,
      checkpoint: -1,
      collected: new Set(),
      coyote: 0.1,
      buffer: 0,
      respawn: 0,
      event: null,
    };
  }
  function die(state) {
    const point = levels[state.index].checkpoints[state.checkpoint] || {
      x: 65,
      y: 332,
    };
    Object.assign(state.player, {
      x: point.x,
      y: point.y,
      vx: 0,
      vy: 0,
      grounded: true,
    });
    state.deaths++;
    state.respawn = 0.55;
    state.coyote = 0.1;
    state.buffer = 0;
    state.event = "respawn";
  }
  function patrolAt(patrol, time) {
    const distance = patrol.max - patrol.min;
    const travel =
      (time * patrol.speed + patrol.x - patrol.min) % (distance * 2);
    return {
      ...patrol,
      x: patrol.min + (travel > distance ? distance * 2 - travel : travel),
    };
  }
  function step(state, input, dt) {
    state.event = null;
    if (state.phase !== "playing") return;
    dt = Math.min(Math.max(dt, 0), 1 / 30);
    state.time += dt;
    const p = state.player,
      level = levels[state.index];
    if (state.respawn > 0) {
      state.respawn = Math.max(0, state.respawn - dt);
      return;
    }
    state.coyote = p.grounded ? 0.1 : Math.max(0, state.coyote - dt);
    state.buffer = input.jumpPressed ? 0.12 : Math.max(0, state.buffer - dt);
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const target = direction * 245;
    const acceleration = (p.grounded ? 1900 : 1250) * dt;
    p.vx += Math.max(-acceleration, Math.min(acceleration, target - p.vx));
    if (direction) p.facing = direction;
    if (state.buffer > 0 && state.coyote > 0) {
      p.vy = -630;
      p.grounded = false;
      state.coyote = 0;
      state.buffer = 0;
    }
    if (!input.jumpHeld && p.vy < -270) p.vy = -270;
    p.vy = Math.min(820, p.vy + 1650 * dt);
    const solids = blocks(level);
    p.x += p.vx * dt;
    for (const b of solids)
      if (overlap(p, b)) {
        p.x = p.vx > 0 ? b.x - p.w : b.x + b.w;
        p.vx = 0;
      }
    p.x = Math.max(0, Math.min(level.width - p.w, p.x));
    p.y += p.vy * dt;
    p.grounded = false;
    for (const b of solids)
      if (overlap(p, b)) {
        if (p.vy >= 0) {
          p.y = b.y - p.h;
          p.grounded = true;
        } else p.y = b.y + b.h;
        p.vy = 0;
      }
    const hitbox = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 5 };
    if (
      p.y > 490 ||
      level.spikes.some(([x, y, w, h]) =>
        overlap(hitbox, { x: x + 3, y: y + 4, w: w - 6, h: h - 4 }),
      ) ||
      level.patrols.some((h) => overlap(hitbox, patrolAt(h, state.time)))
    ) {
      die(state);
      return;
    }
    level.checkpoints.forEach((cp, i) => {
      if (i > state.checkpoint && p.x >= cp.x) {
        state.checkpoint = i;
        state.event = "checkpoint";
      }
    });
    level.coins.forEach(([x, y], i) => {
      if (
        !state.collected.has(i) &&
        overlap(p, { x: x - 10, y: y - 10, w: 20, h: 20 })
      ) {
        state.collected.add(i);
        state.event = "coin";
      }
    });
    if (
      overlap(p, {
        x: level.goal.x,
        y: 0,
        w: level.width - level.goal.x,
        h: 370,
      })
    ) {
      state.phase = "won";
      state.event = "won";
    }
  }
  const api = { levels, createState, step, overlap, patrolAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Platformer = api;
})(typeof window !== "undefined" ? window : globalThis);
