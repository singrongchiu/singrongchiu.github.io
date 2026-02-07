import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  LANE_COUNT,
  OBSTACLE_COUNT,
  START_HEARTS,
  OBSTACLE_TYPES,
  clampLane,
  applyLaneShift,
  createObstacleSequence,
  obstacleCollides,
  applyCollision,
  resolveSwipeDirection,
  resolveDragLane
} = require("../src/minigame-maze.js");

test("lane clamping keeps indices inside 3-lane bounds", () => {
  assert.equal(clampLane(-4, LANE_COUNT), 0);
  assert.equal(clampLane(0, LANE_COUNT), 0);
  assert.equal(clampLane(2, LANE_COUNT), 2);
  assert.equal(clampLane(99, LANE_COUNT), 2);
});

test("lane shift moves one lane and respects maze boundaries", () => {
  assert.equal(applyLaneShift(1, -1, LANE_COUNT), 0);
  assert.equal(applyLaneShift(1, 1, LANE_COUNT), 2);
  assert.equal(applyLaneShift(0, -1, LANE_COUNT), 0);
  assert.equal(applyLaneShift(2, 1, LANE_COUNT), 2);
});

test("obstacle sequence creates exactly three typed obstacles", () => {
  const obstacles = createObstacleSequence(OBSTACLE_COUNT, LANE_COUNT, () => 0.2);
  assert.equal(obstacles.length, OBSTACLE_COUNT);
  assert.deepEqual(
    obstacles.map((obstacle) => obstacle.type),
    OBSTACLE_TYPES
  );

  for (const obstacle of obstacles) {
    assert.equal(Number.isInteger(obstacle.id), true);
    assert.equal(obstacle.safeLane >= 0, true);
    assert.equal(obstacle.safeLane < LANE_COUNT, true);
  }
});

test("collision helper fails when runner is not in safe lane", () => {
  assert.equal(obstacleCollides(1, { safeLane: 1 }), false);
  assert.equal(obstacleCollides(0, { safeLane: 2 }), true);
});

test("collision consumes the single heart and fails the run", () => {
  const untouched = applyCollision(START_HEARTS, false);
  assert.equal(untouched.hearts, START_HEARTS);
  assert.equal(untouched.failed, false);

  const hit = applyCollision(START_HEARTS, true);
  assert.equal(hit.hearts, 0);
  assert.equal(hit.failed, true);
});

test("swipe direction resolves fast horizontal swipes and rejects weak gestures", () => {
  assert.equal(resolveSwipeDirection(-24, 4, 160), -1);
  assert.equal(resolveSwipeDirection(21, -2, 170), 1);
  assert.equal(resolveSwipeDirection(9, 0, 120), 0);
  assert.equal(resolveSwipeDirection(18, 30, 140), 0);
  assert.equal(resolveSwipeDirection(25, 0, 800), 0);
});

test("drag lane maps pointer position to left, center, and right lanes", () => {
  const rect = { left: 100, width: 300 };
  assert.equal(resolveDragLane(110, rect, 3, 14), 0);
  assert.equal(resolveDragLane(250, rect, 3, 14), 1);
  assert.equal(resolveDragLane(395, rect, 3, 14), 2);
});
