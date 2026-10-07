const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  levels,
  createState,
  step,
  patrolAt,
} = require("../public/platformer/engine");
const playing = (index) =>
  Object.assign(createState(index), { phase: "playing" });
const advance = (state, frames, input = {}) => {
  for (let i = 0; i < frames; i++) step(state, input, 1 / 120);
};

test("platformer movement lands on solid ground without falling through", () => {
  const s = playing(0);
  advance(s, 30, { right: true });
  assert(s.player.x > 65);
  assert.equal(s.player.y, 332);
  assert(s.player.grounded);
  assert.equal(s.deaths, 0);
});
test("holding jump reaches higher than tapping, and air jumps are rejected", () => {
  const long = playing(0),
    short = playing(0);
  step(long, { jumpPressed: true, jumpHeld: true }, 1 / 120);
  step(short, { jumpPressed: true, jumpHeld: true }, 1 / 120);
  advance(long, 22, { jumpHeld: true });
  advance(short, 22, { jumpHeld: false });
  assert(long.player.y < short.player.y - 25);
  const before = long.player.vy;
  step(long, { jumpPressed: true, jumpHeld: true }, 1 / 120);
  assert(long.player.vy > before);
});
test("falling restores the checkpoint and keeps collected stars", () => {
  const s = playing(0);
  s.checkpoint = 1;
  s.collected.add(0);
  s.player.y = 520;
  step(s, {}, 1 / 120);
  assert.equal(s.deaths, 1);
  assert.equal(s.player.x, levels[0].checkpoints[1].x);
  assert(s.collected.has(0));
  assert(s.respawn > 0);
});
test("a star is counted only once", () => {
  const s = playing(0);
  s.player.x = 145;
  s.player.y = 310;
  step(s, {}, 1 / 120);
  assert(s.collected.has(0));
  const count = s.collected.size;
  advance(s, 10);
  assert.equal(s.collected.size, count);
});
test("paused games freeze the timer and player", () => {
  const s = createState(0);
  s.phase = "paused";
  const before = JSON.stringify(s);
  advance(s, 120, { right: true, jumpPressed: true, jumpHeld: true });
  assert.equal(JSON.stringify(s), before);
});
test("the exit also counts when the player jumps across it", () => {
  const s = playing(2);
  s.player.x = levels[2].goal.x;
  s.player.y = 210;
  step(s, {}, 1 / 120);
  assert.equal(s.phase, "won");
});
for (let index = 0; index < levels.length; index++)
  test(`level ${index + 1} has a playable route through its gaps and hazards`, () => {
    const s = playing(index),
      level = levels[index];
    for (let frame = 0; frame < 120 * 45 && s.phase === "playing"; frame++) {
      const p = s.player;
      const floor = [...level.floors, ...level.platforms].find(
        ([x, y, w]) =>
          p.x + p.w > x && p.x < x + w && Math.abs(p.y + p.h - y) < 2,
      );
      const gap =
        floor &&
        floor[1] === 370 &&
        floor[0] + floor[2] - p.x - p.w < 37 &&
        floor[0] + floor[2] < level.width;
      const spikes = level.spikes.some(
        ([x, y, w]) =>
          x + w > p.x && x - p.x - p.w < 65 && x > p.x && p.y + p.h > y,
      );
      const hazard = level.patrols.some((h) => {
        const b = patrolAt(h, s.time);
        return (
          b.x + b.w > p.x &&
          b.x - p.x - p.w < 85 &&
          b.x > p.x &&
          p.y + p.h > b.y &&
          b.y + b.h > p.y
        );
      });
      step(
        s,
        {
          right: true,
          jumpPressed: p.grounded && (gap || spikes || hazard),
          jumpHeld: true,
        },
        1 / 120,
      );
    }
    assert.equal(s.phase, "won");
    assert(s.deaths <= 2, "route should not require repeated failures");
    assert(s.collected.size > 0);
  });
