(function () {
  "use strict";

  var LANE_COUNT = 3;
  var OBSTACLE_COUNT = 3;
  var START_HEARTS = 1;
  var OBSTACLE_TYPES = ["wall", "pillar", "gate"];
  var BASE_SPEED_PX_PER_SEC = 132;
  var SPEED_STEP_PX_PER_SEC = 20;
  var SPEED_STEP_EVERY_MS = 5000;
  var OBSTACLE_HEIGHT_PX = 48;
  var OBSTACLE_SPACING_PX = 140;
  var OBSTACLE_START_OFFSET_PX = 90;
  var MAZE_WALL_WIDTH_PX = 14;
  var COLLISION_WINDOW_PX = 32;
  var AVATAR_CENTER_FROM_BOTTOM_PX = 46;
  var SWIPE_MIN_DISTANCE_PX = 16;
  var SWIPE_MAX_DURATION_MS = 520;
  var SWIPE_HORIZONTAL_RATIO = 1.05;
  var DRAG_MIN_DISTANCE_PX = 8;

  function clamp(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return min;
    }
    return Math.min(max, Math.max(min, n));
  }

  function clampLane(index, laneCount) {
    var total = Math.max(1, Math.floor(Number(laneCount) || LANE_COUNT));
    return Math.floor(clamp(index, 0, total - 1));
  }

  function applyLaneShift(currentLane, direction, laneCount) {
    var total = Math.max(1, Math.floor(Number(laneCount) || LANE_COUNT));
    var current = clampLane(currentLane, total);
    var delta = 0;
    if (Number(direction) < 0) {
      delta = -1;
    } else if (Number(direction) > 0) {
      delta = 1;
    }
    return clampLane(current + delta, total);
  }

  function randomInt(max, rng) {
    var limit = Math.max(1, Math.floor(Number(max) || 1));
    var random = typeof rng === "function" ? rng : Math.random;
    return Math.floor(random() * limit) % limit;
  }

  function createObstacleMarkup(safeLane) {
    var html = "<span class='maze-obstacle-strip'>";
    var lane = 0;
    for (lane = 0; lane < LANE_COUNT; lane += 1) {
      var laneClass = lane === safeLane ? "maze-cell is-gap" : "maze-cell is-block";
      html += "<span class='" + laneClass + "'></span>";
    }
    html += "</span>";
    return html;
  }

  function createObstacleSequence(count, laneCount, rng) {
    var total = Math.max(1, Math.floor(Number(count) || OBSTACLE_COUNT));
    var lanes = Math.max(1, Math.floor(Number(laneCount) || LANE_COUNT));
    var random = typeof rng === "function" ? rng : Math.random;
    var obstacles = [];
    var prevSafeLane = -1;
    var i = 0;

    for (i = 0; i < total; i += 1) {
      var safeLane = randomInt(lanes, random);
      if (lanes > 1 && safeLane === prevSafeLane) {
        safeLane = (safeLane + 1 + randomInt(lanes - 1, random)) % lanes;
      }
      prevSafeLane = safeLane;
      obstacles.push({
        id: i,
        type: OBSTACLE_TYPES[i % OBSTACLE_TYPES.length],
        safeLane: safeLane,
        y: -OBSTACLE_START_OFFSET_PX - (i * OBSTACLE_SPACING_PX),
        resolved: false,
        counted: false,
        node: null
      });
    }

    return obstacles;
  }

  function obstacleCollides(playerLane, obstacle) {
    var lane = clampLane(playerLane, LANE_COUNT);
    if (!obstacle || typeof obstacle !== "object") {
      return false;
    }
    return lane !== clampLane(obstacle.safeLane, LANE_COUNT);
  }

  function applyCollision(hearts, collided) {
    var lives = Math.max(0, Math.floor(Number(hearts) || 0));
    if (!collided) {
      return {
        hearts: lives,
        failed: false
      };
    }
    var nextHearts = Math.max(0, lives - 1);
    return {
      hearts: nextHearts,
      failed: nextHearts <= 0
    };
  }

  function resolveSwipeDirection(dx, dy, dt, config) {
    var cfg = config && typeof config === "object" ? config : {};
    var deltaX = Number(dx) || 0;
    var deltaY = Number(dy) || 0;
    var deltaT = Number(dt) || 0;
    var minDistance = Number.isFinite(cfg.minDistance) ? cfg.minDistance : SWIPE_MIN_DISTANCE_PX;
    var maxDuration = Number.isFinite(cfg.maxDuration) ? cfg.maxDuration : SWIPE_MAX_DURATION_MS;
    var horizontalRatio = Number.isFinite(cfg.horizontalRatio)
      ? cfg.horizontalRatio
      : SWIPE_HORIZONTAL_RATIO;

    if (deltaT > maxDuration) {
      return 0;
    }
    if (Math.abs(deltaX) < minDistance) {
      return 0;
    }
    if (Math.abs(deltaX) <= Math.abs(deltaY) * horizontalRatio) {
      return 0;
    }
    return deltaX < 0 ? -1 : 1;
  }

  function resolveDragLane(clientX, stageRect, laneCount, wallWidthPx) {
    var rect = stageRect && typeof stageRect === "object" ? stageRect : {};
    var left = Number(rect.left) || 0;
    var width = Math.max(1, Number(rect.width) || 0);
    var lanes = Math.max(1, Math.floor(Number(laneCount) || LANE_COUNT));
    var wallWidth = Number.isFinite(wallWidthPx) ? Math.max(0, wallWidthPx) : MAZE_WALL_WIDTH_PX;
    var innerWidth = Math.max(1, width - (wallWidth * 2));
    var laneWidth = innerWidth / lanes;
    var rawX = (Number(clientX) || 0) - left - wallWidth;
    var clampedX = clamp(rawX, 0, innerWidth - 0.0001);
    return clampLane(Math.floor(clampedX / laneWidth), lanes);
  }

  function createMiniGamePlugin() {
    return {
      id: "maze",
      title: "Maze Runner",
      initialWeight: 1,
      timing: {
        roundMs: 10000
      },
      mount: function (mount, engine) {
        var api = engine || {};
        var complete = typeof api.complete === "function"
          ? api.complete
          : function () {};
        var fail = typeof api.fail === "function"
          ? api.fail
          : function () {};
        var noteInteraction = typeof api.noteInteraction === "function"
          ? api.noteInteraction
          : function () {};
        var registerControl = typeof api.registerControl === "function"
          ? api.registerControl
          : function () {};

        var hearts = START_HEARTS;
        var lane = Math.floor(LANE_COUNT / 2);
        var obstacles = createObstacleSequence(OBSTACLE_COUNT, LANE_COUNT);
        var cleared = 0;
        var done = false;
        var startMs = 0;
        var prevMs = 0;
        var rafId = 0;
        var flashTimer = 0;
        var settleTimer = 0;
        var boundaryTimer = 0;
        var pointer = {
          active: false,
          id: -1,
          x: 0,
          y: 0,
          t: 0,
          swipeUsed: false,
          dragUsed: false
        };

        mount.innerHTML =
          "<div class='maze-game'>" +
          "<div class='chip mini-instruction maze-chip'>Hearts: <span class='maze-hearts'>" + START_HEARTS + "</span> \u2022 Obstacles: <span class='maze-progress'>0/" + OBSTACLE_COUNT + "</span></div>" +
          "<div class='maze-stage' tabindex='0' aria-label='Swipe left or right to dodge obstacles'>" +
          "<span class='maze-wall maze-wall-left' aria-hidden='true'></span>" +
          "<span class='maze-wall maze-wall-right' aria-hidden='true'></span>" +
          "<div class='maze-lanes' aria-hidden='true'>" +
          "<span class='maze-lane'></span>" +
          "<span class='maze-lane'></span>" +
          "<span class='maze-lane'></span>" +
          "</div>" +
          "<div class='maze-finish is-hidden' aria-hidden='true'>FINISH</div>" +
          "<div class='maze-obstacles' aria-hidden='true'></div>" +
          "<div class='maze-avatar' aria-hidden='true'><span class='maze-avatar-head'></span><span class='maze-avatar-body'></span></div>" +
          "</div>" +
          "</div>";

        var stage = mount.querySelector(".maze-stage");
        var heartsNode = mount.querySelector(".maze-hearts");
        var progressNode = mount.querySelector(".maze-progress");
        var obstacleLayer = mount.querySelector(".maze-obstacles");
        var avatar = mount.querySelector(".maze-avatar");
        var finish = mount.querySelector(".maze-finish");
        registerControl(stage, { allowSwipeSkip: true });

        obstacles.forEach(function (obstacle) {
          var node = document.createElement("div");
          node.className = "maze-obstacle is-" + obstacle.type;
          node.innerHTML = createObstacleMarkup(obstacle.safeLane);
          obstacleLayer.appendChild(node);
          obstacle.node = node;
          obstacle.node.style.top = obstacle.y.toFixed(2) + "px";
        });

        function renderHud() {
          heartsNode.textContent = String(hearts);
          progressNode.textContent = String(cleared) + "/" + String(OBSTACLE_COUNT);
        }

        function renderLane(withPulse) {
          var stageWidth = stage.clientWidth || 304;
          var innerWidth = Math.max(1, stageWidth - (MAZE_WALL_WIDTH_PX * 2));
          var laneWidth = innerWidth / LANE_COUNT;
          var centerX = MAZE_WALL_WIDTH_PX + ((lane + 0.5) * laneWidth);
          avatar.style.left = centerX.toFixed(2) + "px";
          if (!withPulse) {
            return;
          }
          avatar.classList.remove("is-shifting");
          avatar.offsetWidth;
          avatar.classList.add("is-shifting");
        }

        function pulseBoundary() {
          stage.classList.add("is-wall-bump");
          window.clearTimeout(boundaryTimer);
          boundaryTimer = window.setTimeout(function () {
            stage.classList.remove("is-wall-bump");
          }, 160);
        }

        function pulseHit() {
          stage.classList.add("is-hit");
          window.clearTimeout(flashTimer);
          flashTimer = window.setTimeout(function () {
            stage.classList.remove("is-hit");
          }, 190);
        }

        function clearPointer(evt) {
          if (
            evt &&
            Number.isFinite(evt.pointerId) &&
            stage &&
            typeof stage.hasPointerCapture === "function" &&
            stage.hasPointerCapture(evt.pointerId) &&
            typeof stage.releasePointerCapture === "function"
          ) {
            try {
              stage.releasePointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore release failures for cross-browser resilience.
            }
          }
          pointer.active = false;
          pointer.id = -1;
          pointer.swipeUsed = false;
          pointer.dragUsed = false;
        }

        function setLane(nextLane, withPulse) {
          var target = clampLane(nextLane, LANE_COUNT);
          if (target === lane) {
            return false;
          }
          lane = target;
          noteInteraction();
          renderLane(Boolean(withPulse));
          return true;
        }

        function tryLaneShift(direction) {
          if (done) {
            return;
          }
          var nextLane = applyLaneShift(lane, direction, LANE_COUNT);
          if (nextLane === lane) {
            pulseBoundary();
            return;
          }
          setLane(nextLane, true);
        }

        function onPointerDown(evt) {
          if (!evt) {
            return;
          }
          if (evt.pointerType === "mouse" && evt.button !== 0) {
            return;
          }
          pointer.active = true;
          pointer.id = evt.pointerId;
          pointer.x = evt.clientX;
          pointer.y = evt.clientY;
          pointer.t = Date.now();
          pointer.swipeUsed = false;
          pointer.dragUsed = false;
          if (stage && typeof stage.setPointerCapture === "function") {
            try {
              stage.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore capture failures for cross-browser resilience.
            }
          }
        }

        function onPointerMove(evt) {
          if (!evt || !pointer.active || pointer.id !== evt.pointerId) {
            return;
          }
          var dx = evt.clientX - pointer.x;
          var dy = evt.clientY - pointer.y;
          var dt = Date.now() - pointer.t;

          if (!pointer.swipeUsed) {
            var direction = resolveSwipeDirection(dx, dy, dt);
            if (direction) {
              tryLaneShift(direction);
              pointer.swipeUsed = true;
            }
          }

          if (Math.abs(dx) < DRAG_MIN_DISTANCE_PX) {
            return;
          }
          var nextLane = resolveDragLane(
            evt.clientX,
            stage.getBoundingClientRect(),
            LANE_COUNT,
            MAZE_WALL_WIDTH_PX
          );
          if (setLane(nextLane, true)) {
            pointer.dragUsed = true;
          }
        }

        function onPointerUp(evt) {
          if (!evt || !pointer.active || pointer.id !== evt.pointerId) {
            return;
          }
          if (!pointer.swipeUsed && !pointer.dragUsed) {
            var direction = resolveSwipeDirection(
              evt.clientX - pointer.x,
              evt.clientY - pointer.y,
              Date.now() - pointer.t
            );
            if (direction) {
              tryLaneShift(direction);
            }
          }
          clearPointer(evt);
        }

        function onKeyDown(evt) {
          if (!evt) {
            return;
          }
          if (evt.key === "ArrowLeft") {
            evt.preventDefault();
            tryLaneShift(-1);
            return;
          }
          if (evt.key === "ArrowRight") {
            evt.preventDefault();
            tryLaneShift(1);
          }
        }

        function settleFailure() {
          if (!done) {
            return;
          }
          fail("collision");
        }

        function settleSuccess() {
          if (!done) {
            return;
          }
          complete();
        }

        function tick(now) {
          if (done) {
            return;
          }
          if (!startMs) {
            startMs = now;
            prevMs = now;
          }
          var deltaMs = Math.min(64, now - prevMs);
          prevMs = now;
          var elapsedMs = now - startMs;
          var speed = BASE_SPEED_PX_PER_SEC + (Math.floor(elapsedMs / SPEED_STEP_EVERY_MS) * SPEED_STEP_PX_PER_SEC);
          var yStep = speed * (deltaMs / 1000);
          var stageHeight = stage.clientHeight || 220;
          var avatarCenterY = stageHeight - AVATAR_CENTER_FROM_BOTTOM_PX;

          obstacles.forEach(function (obstacle) {
            obstacle.y += yStep;
            if (obstacle.node) {
              obstacle.node.style.top = obstacle.y.toFixed(2) + "px";
            }

            if (!obstacle.resolved) {
              var obstacleCenterY = obstacle.y + (OBSTACLE_HEIGHT_PX * 0.5);
              if (Math.abs(obstacleCenterY - avatarCenterY) <= COLLISION_WINDOW_PX) {
                obstacle.resolved = true;
                if (obstacleCollides(lane, obstacle)) {
                  var collision = applyCollision(hearts, true);
                  hearts = collision.hearts;
                  renderHud();
                  pulseHit();
                  if (collision.failed) {
                    done = true;
                    settleTimer = window.setTimeout(settleFailure, 220);
                  }
                }
              }
            }

            if (!obstacle.counted && obstacle.y > stageHeight + 18) {
              obstacle.counted = true;
              cleared += 1;
              renderHud();
            }
          });

          if (!done && cleared >= OBSTACLE_COUNT) {
            done = true;
            finish.classList.remove("is-hidden");
            finish.classList.add("is-open");
            settleTimer = window.setTimeout(settleSuccess, 260);
            return;
          }

          rafId = window.requestAnimationFrame(tick);
        }

        stage.addEventListener("pointerdown", onPointerDown);
        stage.addEventListener("pointermove", onPointerMove);
        stage.addEventListener("pointerup", onPointerUp);
        stage.addEventListener("pointercancel", clearPointer);
        stage.addEventListener("keydown", onKeyDown);

        renderHud();
        renderLane(false);
        rafId = window.requestAnimationFrame(tick);

        return function cleanup() {
          done = true;
          window.cancelAnimationFrame(rafId);
          window.clearTimeout(flashTimer);
          window.clearTimeout(settleTimer);
          window.clearTimeout(boundaryTimer);
          stage.removeEventListener("pointerdown", onPointerDown);
          stage.removeEventListener("pointermove", onPointerMove);
          stage.removeEventListener("pointerup", onPointerUp);
          stage.removeEventListener("pointercancel", clearPointer);
          stage.removeEventListener("keydown", onKeyDown);
        };
      }
    };
  }

  var api = {
    LANE_COUNT: LANE_COUNT,
    OBSTACLE_COUNT: OBSTACLE_COUNT,
    START_HEARTS: START_HEARTS,
    OBSTACLE_TYPES: OBSTACLE_TYPES.slice(),
    clampLane: clampLane,
    applyLaneShift: applyLaneShift,
    createObstacleSequence: createObstacleSequence,
    obstacleCollides: obstacleCollides,
    applyCollision: applyCollision,
    resolveSwipeDirection: resolveSwipeDirection,
    resolveDragLane: resolveDragLane,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.MazeRunnerMiniGame = api;
  }
}());
