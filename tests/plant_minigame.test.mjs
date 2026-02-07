import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { computeCenteredCanOffset } = require("../src/minigame-plant.js");

test("computeCenteredCanOffset returns zero when can is already centered", () => {
  const canRect = { left: 100, width: 80 };
  const targetRect = { left: 120, width: 40 };
  const offset = computeCenteredCanOffset(canRect, 0, targetRect);
  assert.equal(offset, 0);
});

test("computeCenteredCanOffset aligns to target center from dragged position", () => {
  const canRect = { left: 140, width: 80 };
  const targetRect = { left: 130, width: 40 };
  const offset = computeCenteredCanOffset(canRect, 50, targetRect);
  assert.equal(offset, 20);
});

test("computeCenteredCanOffset safely handles invalid geometry", () => {
  assert.equal(computeCenteredCanOffset(null, 0, null), 0);
  assert.equal(computeCenteredCanOffset({ left: NaN, width: 80 }, 0, { left: 20, width: 40 }), 0);
});
