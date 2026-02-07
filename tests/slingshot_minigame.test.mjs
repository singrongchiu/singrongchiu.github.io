import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  clampDragPull,
  normalizeReleasePull,
  computeLaunchVelocity,
  consumeLaunchAttempt,
  circleIntersectsRect,
  isPointInCircle,
  targetBullseye,
  isBullseyeHit,
  DEFAULT_PULL,
  MAX_LAUNCH_ATTEMPTS
} = require("../src/minigame-slingshot.js");

test("drag pull clamps to backward-only x range", () => {
  const pull = clampDragPull({ x: 40, y: 1000 });
  assert.equal(pull.x, 0);
  assert.equal(pull.y, DEFAULT_PULL.maxY);

  const pull2 = clampDragPull({ x: -999, y: -999 });
  assert.equal(pull2.x, -DEFAULT_PULL.maxX);
  assert.equal(pull2.y, -DEFAULT_PULL.maxY);
});

test("release pull enforces a minimum backward launch", () => {
  const released = normalizeReleasePull({ x: 0, y: 3 });
  assert.equal(released.x, -DEFAULT_PULL.minLaunchX);
  assert.equal(released.y, 3);
});

test("launch velocity always moves projectile forward", () => {
  const velocity = computeLaunchVelocity({ x: -50, y: 24 });
  assert.ok(velocity.vx > 0);
  assert.ok(Number.isFinite(velocity.vy));
});

test("launch attempt budget allows exactly two launches", () => {
  const first = consumeLaunchAttempt(0, MAX_LAUNCH_ATTEMPTS);
  assert.equal(first.didLaunch, true);
  assert.equal(first.attemptsUsed, 1);
  assert.equal(first.attemptsRemaining, 1);

  const second = consumeLaunchAttempt(first.attemptsUsed, MAX_LAUNCH_ATTEMPTS);
  assert.equal(second.didLaunch, true);
  assert.equal(second.attemptsUsed, 2);
  assert.equal(second.attemptsRemaining, 0);

  const third = consumeLaunchAttempt(second.attemptsUsed, MAX_LAUNCH_ATTEMPTS);
  assert.equal(third.didLaunch, false);
  assert.equal(third.attemptsUsed, 2);
  assert.equal(third.attemptsRemaining, 0);
});

test("circle-rectangle collision reports hit and miss cases", () => {
  const rect = { left: 50, right: 80, top: 50, bottom: 80 };
  assert.equal(circleIntersectsRect(60, 60, 8, rect), true);
  assert.equal(circleIntersectsRect(10, 10, 5, rect), false);
});

test("bullseye geometry uses target center and a small inner radius", () => {
  const bullseye = targetBullseye({ left: 100, right: 172, top: 40, bottom: 112 });
  assert.equal(bullseye.cx, 136);
  assert.equal(bullseye.cy, 76);
  assert.ok(bullseye.radius >= 10);
  assert.ok(bullseye.radius < 14);
});

test("point-in-circle matches center-only hit expectations", () => {
  assert.equal(isPointInCircle(10, 10, 10, 10, 5), true);
  assert.equal(isPointInCircle(16, 10, 10, 10, 5), false);
});

test("bullseye hit requires the projectile center near the true middle", () => {
  const targetRect = { left: 100, right: 172, top: 40, bottom: 112 };
  assert.equal(isBullseyeHit(136, 76, targetRect), true);
  assert.equal(isBullseyeHit(126, 76, targetRect), true);
  assert.equal(isBullseyeHit(124, 76, targetRect), true);
  assert.equal(isBullseyeHit(110, 76, targetRect), false);
});
