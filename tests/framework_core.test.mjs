import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  clamp,
  pickWeighted,
  chooseNext,
  classifyCardSwipe,
  updateWeight,
  computeRoundPacing,
  createSessionClock,
  normalizeGamePlugin,
  createFallbackPlugin
} = require("../src/framework-core.js");

function makeRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("clamp constrains values and handles invalid input", () => {
  assert.equal(clamp(5, 1, 4), 4);
  assert.equal(clamp(-2, 1, 4), 1);
  assert.equal(clamp("oops", 2, 3), 2);
});

test("updateWeight applies skip/success multipliers with clamping", () => {
  const cfg = { min: 0.5, max: 2, upFactor: 1.2, downFactor: 0.7 };
  assert.equal(updateWeight(1, "skip", cfg), 0.7);
  assert.equal(updateWeight(1, "success", cfg), 1.2);
  assert.equal(updateWeight(10, "success", cfg), 2);
  assert.equal(updateWeight(0.1, "skip", cfg), 0.5);
});

test("computeRoundPacing ramps down timeout and motion scales over progress", () => {
  const start = computeRoundPacing(0);
  const middle = computeRoundPacing(0.5);
  const end = computeRoundPacing(1);

  assert.equal(start.timeoutScale, 1);
  assert.equal(start.motionScale, 1);
  assert.ok(middle.timeoutScale < 1);
  assert.ok(middle.motionScale < 1);
  assert.ok(end.timeoutScale <= middle.timeoutScale);
  assert.ok(end.motionScale <= middle.motionScale);
  assert.equal(end.timeoutScale, 0.56);
  assert.equal(end.motionScale, 0.68);
});

test("computeRoundPacing clamps invalid inputs and honors custom config", () => {
  const clamped = computeRoundPacing(-5, {
    timeoutMinScale: 2,
    motionMinScale: -1,
    easePower: 0
  });
  assert.equal(clamped.progress, 0);
  assert.equal(clamped.timeoutScale, 1);
  assert.equal(clamped.motionScale, 1);

  const custom = computeRoundPacing(1, {
    timeoutMinScale: 0.7,
    motionMinScale: 0.8,
    easePower: 1
  });
  assert.equal(custom.timeoutScale, 0.7);
  assert.equal(custom.motionScale, 0.8);
});

test("chooseNext avoids immediate repeat when pool has two or more items", () => {
  const entries = [
    { id: "a", weight: 1 },
    { id: "b", weight: 1 },
    { id: "c", weight: 1 }
  ];
  const rng = makeRng(42);
  for (let i = 0; i < 50; i += 1) {
    const picked = chooseNext(entries, "a", rng);
    assert.notEqual(picked.id, "a");
  }
});

test("chooseNext may repeat when there is only one entry", () => {
  const entries = [{ id: "only", weight: 1 }];
  const picked = chooseNext(entries, "only");
  assert.equal(picked.id, "only");
});

test("classifyCardSwipe detects vertical up/down gestures and ignores weak swipes", () => {
  assert.equal(classifyCardSwipe({ dx: 6, dy: -120, dt: 220 }), "up");
  assert.equal(classifyCardSwipe({ dx: -8, dy: 110, dt: 180 }), "down");
  assert.equal(classifyCardSwipe({ dx: 80, dy: -90, dt: 200 }), null);
  assert.equal(classifyCardSwipe({ dx: 2, dy: -120, dt: 900 }), null);
  assert.equal(classifyCardSwipe({ dx: 0, dy: 30, dt: 200 }), null);
});

test("classifyCardSwipe accepts custom thresholds", () => {
  const custom = { maxDurationMs: 1200, minTravelPx: 60, verticalRatio: 1.1 };
  assert.equal(classifyCardSwipe({ dx: 20, dy: 70, dt: 1000 }, custom), "down");
  assert.equal(classifyCardSwipe({ dx: 40, dy: 60, dt: 1000 }, custom), "down");
  assert.equal(classifyCardSwipe({ dx: 40, dy: 60, dt: 1300 }, custom), null);
});

test("pickWeighted statistically favors larger weights", () => {
  const entries = [
    { id: "low", weight: 1 },
    { id: "high", weight: 5 }
  ];
  const rng = makeRng(7);
  const counts = { low: 0, high: 0 };

  for (let i = 0; i < 4000; i += 1) {
    const picked = pickWeighted(entries, rng);
    counts[picked.id] += 1;
  }

  assert.ok(counts.high > counts.low * 3);
});

test("createSessionClock expires after duration and never returns negative remaining", () => {
  let now = 1000;
  const clock = createSessionClock(90, () => now);
  clock.start();
  assert.equal(clock.isExpired(), false);
  assert.equal(clock.getRemaining(), 90);
  now = 91000;
  assert.equal(clock.isExpired(), true);
  assert.equal(clock.getRemaining(), 0);
});

test("normalizeGamePlugin applies defaults and normalizes timing", () => {
  const plugin = normalizeGamePlugin(
    {
      id: "demo",
      mount() {}
    },
    {
      title: "Demo Title",
      initialWeight: 2,
      timing: { roundMs: 6000, engagedRoundMs: 12000 }
    }
  );

  assert.equal(plugin.id, "demo");
  assert.equal(plugin.title, "Demo Title");
  assert.equal(plugin.initialWeight, 2);
  assert.equal(plugin.timing.roundMs, 6000);
  assert.equal(plugin.timing.engagedRoundMs, 12000);
  assert.equal(typeof plugin.mount, "function");
});

test("normalizeGamePlugin rejects invalid plugin shapes", () => {
  assert.throws(() => normalizeGamePlugin({}, {}), /id/i);
  assert.throws(
    () => normalizeGamePlugin({ id: "demo" }, {}),
    /mount/i
  );
});

test("createFallbackPlugin returns a valid mountable plugin", () => {
  const plugin = createFallbackPlugin(
    { id: "fallback-demo", title: "Fallback Demo", icon: "⚠️", hint: "Missing game" },
    "missing module"
  );
  assert.equal(plugin.id, "fallback-demo");
  assert.equal(plugin.title, "Fallback Demo");
  assert.equal(plugin.initialWeight, 1);
  assert.equal(typeof plugin.mount, "function");
  assert.equal(plugin.timing.roundMs > 0, true);
  assert.equal(plugin.timing.engagedRoundMs >= plugin.timing.roundMs, true);
});
