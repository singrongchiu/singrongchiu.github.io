import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_METER,
  DEFAULT_PITCH,
  getPitchProgress,
  hasPitchCrossedPlate,
  getMeterValue,
  classifyMeterZone,
  consumeSwingAttempt,
  resolveSwingOutcome
} = require("../src/minigame-baseball.js");

function approxEqual(a, b, epsilon = 1e-9) {
  assert.ok(Math.abs(a - b) <= epsilon, `Expected ${a} ~= ${b}`);
}

test("meter value oscillates from 0 to 1 and back to 0", () => {
  approxEqual(getMeterValue(0), 0);
  approxEqual(getMeterValue(DEFAULT_METER.cycleMs * 0.25), 0.5);
  approxEqual(getMeterValue(DEFAULT_METER.cycleMs * 0.5), 1);
  approxEqual(getMeterValue(DEFAULT_METER.cycleMs * 0.75), 0.5);
  approxEqual(getMeterValue(DEFAULT_METER.cycleMs), 0);
});

test("zone classification matches red, yellow, and green thresholds", () => {
  assert.equal(classifyMeterZone(DEFAULT_METER.greenMin), "green");
  assert.equal(classifyMeterZone((DEFAULT_METER.greenMin + DEFAULT_METER.greenMax) * 0.5), "green");
  assert.equal(classifyMeterZone(DEFAULT_METER.yellowMin), "yellow");
  assert.equal(classifyMeterZone(DEFAULT_METER.yellowMax), "yellow");
  assert.equal(classifyMeterZone(0.05), "red");
  assert.equal(classifyMeterZone(0.95), "red");
});

test("pitch progress and plate crossing are normalized", () => {
  assert.equal(getPitchProgress(-100), 0);
  assert.equal(getPitchProgress(DEFAULT_PITCH.durationMs * 0.5), 0.5);
  assert.equal(getPitchProgress(DEFAULT_PITCH.durationMs * 2), 1);

  assert.equal(hasPitchCrossedPlate(DEFAULT_PITCH.plateProgress - 0.001), false);
  assert.equal(hasPitchCrossedPlate(DEFAULT_PITCH.plateProgress), true);
  assert.equal(hasPitchCrossedPlate(2), true);
});

test("swing attempt can only be consumed once", () => {
  const first = consumeSwingAttempt(false);
  assert.equal(first.didSwing, true);
  assert.equal(first.attemptUsed, true);

  const second = consumeSwingAttempt(first.attemptUsed);
  assert.equal(second.didSwing, false);
  assert.equal(second.attemptUsed, true);
});

test("swing outcome resolves success, weak hit, whiff, and late swing", () => {
  const progressBeforePlate = DEFAULT_PITCH.plateProgress - 0.05;
  const progressAfterPlate = DEFAULT_PITCH.plateProgress + 0.05;

  const perfect = resolveSwingOutcome(0.5, progressBeforePlate, { attemptUsed: false });
  assert.equal(perfect.outcome, "home_run");
  assert.equal(perfect.zone, "green");

  const weak = resolveSwingOutcome(DEFAULT_METER.yellowMin, progressBeforePlate, { attemptUsed: false });
  assert.equal(weak.outcome, "weak_hit");
  assert.equal(weak.zone, "yellow");

  const whiff = resolveSwingOutcome(0.01, progressBeforePlate, { attemptUsed: false });
  assert.equal(whiff.outcome, "whiff");
  assert.equal(whiff.zone, "red");

  const late = resolveSwingOutcome(0.5, progressAfterPlate, { attemptUsed: false });
  assert.equal(late.outcome, "late");

  const locked = resolveSwingOutcome(0.5, progressBeforePlate, { attemptUsed: true });
  assert.equal(locked.didSwing, false);
  assert.equal(locked.outcome, "locked");
});
