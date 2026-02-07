import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  MAX_BULB_STEP,
  isValidRightSwipe,
  advanceBulbStep,
  getGlowLevel,
  getBoostedGlow,
  getRotationForStep,
  getBulbTransform
} = require("../src/minigame-lightbulb.js");

function approxEqual(a, b, epsilon = 1e-9) {
  assert.ok(Math.abs(a - b) <= epsilon, `Expected ${a} ~= ${b}`);
}

test("valid right swipe increments exactly one state", () => {
  const gesture = { dx: 64, dy: 10, dt: 180 };
  assert.equal(isValidRightSwipe(gesture), true);
  assert.equal(advanceBulbStep(0, gesture, MAX_BULB_STEP), 1);
});

test("three valid swipes reach full state and clamp there", () => {
  const gesture = { dx: 72, dy: 6, dt: 220 };
  let step = 0;
  for (let i = 0; i < 3; i += 1) {
    step = advanceBulbStep(step, gesture, MAX_BULB_STEP);
  }
  assert.equal(step, 3);
  assert.equal(advanceBulbStep(step, gesture, MAX_BULB_STEP), 3);
});

test("invalid swipe shapes do not advance the bulb state", () => {
  const invalid = [
    { dx: -90, dy: 0, dt: 180 },
    { dx: 26, dy: 4, dt: 150 },
    { dx: 56, dy: 52, dt: 160 },
    { dx: 66, dy: 0, dt: 900 }
  ];
  for (const gesture of invalid) {
    assert.equal(isValidRightSwipe(gesture), false);
    assert.equal(advanceBulbStep(1, gesture, MAX_BULB_STEP), 1);
  }
});

test("glow level increases by step and caps at full brightness", () => {
  approxEqual(getGlowLevel(0, 3), 0);
  approxEqual(getGlowLevel(1, 3), 1 / 3);
  approxEqual(getGlowLevel(2, 3), 2 / 3);
  approxEqual(getGlowLevel(3, 3), 1);
  approxEqual(getGlowLevel(8, 3), 1);
});

test("boosted glow curve makes each swipe more visually apparent", () => {
  assert.equal(getBoostedGlow(0), 0);
  assert.ok(getBoostedGlow(1 / 3) > 0.45);
  assert.ok(getBoostedGlow(2 / 3) > getBoostedGlow(1 / 3));
  assert.equal(getBoostedGlow(1), 1);
});

test("rotation stays fixed while transform seats the bulb into the socket", () => {
  assert.equal(getRotationForStep(0, 3), 0);
  assert.equal(getRotationForStep(1, 3), 0);
  assert.equal(getRotationForStep(2, 3), 0);
  assert.equal(getRotationForStep(3, 3), 0);
  assert.equal(getBulbTransform(0, 3), "translateY(0px)");
  assert.equal(getBulbTransform(1, 3), "translateY(8px)");
  assert.equal(getBulbTransform(2, 3), "translateY(16px)");
  assert.equal(getBulbTransform(3, 3), "translateY(24px)");
  assert.equal(getBulbTransform(9, 3), "translateY(24px)");
});
