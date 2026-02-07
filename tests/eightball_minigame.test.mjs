import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  BALL_RADIUS,
  POCKET_RADIUS,
  TARGET_POCKET_RADIUS,
  TARGET_POCKET_KEY,
  SHOT_MIN_DRAG,
  SHOT_MAX_DRAG,
  SHOT_MAX_SPEED,
  EIGHTBALL_TRANSFER_BOOST,
  normalizeVector,
  computeShotVelocity,
  createEasyStartLayout,
  computePockets,
  findPocket,
  resolveBallCollision,
  bothStopped
} = require("../src/minigame-eightball.js");

function approxEqual(a, b, epsilon = 1e-9) {
  assert.ok(Math.abs(a - b) <= epsilon, `Expected ${a} ~= ${b}`);
}

test("normalizeVector reports unit direction and original length", () => {
  const normalized = normalizeVector(3, 4);
  approxEqual(normalized.length, 5);
  approxEqual(normalized.x, 0.6);
  approxEqual(normalized.y, 0.8);
});

test("computeShotVelocity requires drag beyond minimum", () => {
  const smallShot = computeShotVelocity(1, 1, SHOT_MIN_DRAG, SHOT_MAX_DRAG, SHOT_MAX_SPEED);
  assert.equal(smallShot.speed, 0);
  assert.equal(smallShot.x, 0);
  assert.equal(smallShot.y, 0);
});

test("computeShotVelocity caps at configured max speed", () => {
  const hugeShot = computeShotVelocity(999, 0, SHOT_MIN_DRAG, SHOT_MAX_DRAG, SHOT_MAX_SPEED);
  assert.ok(hugeShot.speed <= SHOT_MAX_SPEED);
  assert.ok(hugeShot.speed > SHOT_MAX_SPEED * 0.95);
  assert.ok(hugeShot.x > 0);
  approxEqual(hugeShot.y, 0);
});

test("findPocket detects when a ball enters the target pocket", () => {
  const pockets = computePockets(300, 220, 14);
  const target = pockets.find((pocket) => pocket.key === "top-right");
  assert.ok(target);
  const pocketed = findPocket({ x: target.x, y: target.y }, pockets, 15);
  assert.ok(pocketed);
  assert.equal(pocketed.key, "top-right");
});

test("target pocket radius is larger than base pocket radius", () => {
  const pockets = computePockets(300, 220, 14);
  const target = pockets.find((pocket) => pocket.key === TARGET_POCKET_KEY);
  const side = pockets.find((pocket) => pocket.key === "top-left");
  assert.ok(target);
  assert.ok(side);
  assert.equal(target.radius, TARGET_POCKET_RADIUS);
  assert.equal(side.radius, POCKET_RADIUS);
  assert.ok(target.radius > side.radius);
});

test("createEasyStartLayout returns separated in-bounds balls", () => {
  const width = 300;
  const height = 220;
  const bounds = { left: 14, right: 286, top: 14, bottom: 206 };
  const pockets = computePockets(width, height, 14);
  const layout = createEasyStartLayout(width, height, bounds, pockets);

  assert.ok(layout && layout.cue && layout.eight);
  assert.ok(layout.cue.x >= bounds.left + BALL_RADIUS);
  assert.ok(layout.cue.x <= bounds.right - BALL_RADIUS);
  assert.ok(layout.cue.y >= bounds.top + BALL_RADIUS);
  assert.ok(layout.cue.y <= bounds.bottom - BALL_RADIUS);
  assert.ok(layout.eight.x >= bounds.left + BALL_RADIUS);
  assert.ok(layout.eight.x <= bounds.right - BALL_RADIUS);
  assert.ok(layout.eight.y >= bounds.top + BALL_RADIUS);
  assert.ok(layout.eight.y <= bounds.bottom - BALL_RADIUS);
  assert.ok(
    Math.hypot(layout.cue.x - layout.eight.x, layout.cue.y - layout.eight.y) >= BALL_RADIUS * 5
  );
});

test("resolveBallCollision transfers momentum to the 8-ball", () => {
  const cueBall = { x: 50, y: 40, vx: 120, vy: 0, r: 11, pocketed: false };
  const eightBall = { x: 71, y: 40, vx: 0, vy: 0, r: 11, pocketed: false };

  const collided = resolveBallCollision(cueBall, eightBall, 0.94);
  assert.equal(collided, true);
  assert.ok(cueBall.vx < 120);
  assert.ok(eightBall.vx > 0);
});

test("transfer boost increases 8-ball speed after collision", () => {
  const cueNormal = { x: 50, y: 40, vx: 120, vy: 0, r: 11, pocketed: false };
  const eightNormal = { x: 71, y: 40, vx: 0, vy: 0, r: 11, pocketed: false };
  const cueBoosted = { x: 50, y: 40, vx: 120, vy: 0, r: 11, pocketed: false };
  const eightBoosted = { x: 71, y: 40, vx: 0, vy: 0, r: 11, pocketed: false };

  resolveBallCollision(cueNormal, eightNormal, 0.985, 1);
  resolveBallCollision(cueBoosted, eightBoosted, 0.985, EIGHTBALL_TRANSFER_BOOST);

  assert.ok(eightBoosted.vx > eightNormal.vx);
});

test("bothStopped treats pocketed balls as settled", () => {
  const cueBall = { vx: 0, vy: 0, pocketed: true };
  const eightBall = { vx: 4, vy: 3, pocketed: false };
  assert.equal(bothStopped(cueBall, eightBall, 6), true);
  assert.equal(bothStopped(cueBall, eightBall, 4), false);
});
