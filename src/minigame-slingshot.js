(function () {
  "use strict";

  var DEFAULT_PULL = {
    maxX: 126,
    maxY: 82,
    minLaunchX: 12
  };

  var DEFAULT_LAUNCH = {
    power: 0.095,
    lift: 2.1,
    minSpeedX: 2.5,
    gravity: 0.24
  };
  var DEFAULT_GRAB_RADIUS = 64;
  var MAX_LAUNCH_ATTEMPTS = 2;
  var TRAJECTORY_DOT_COUNT = 10;
  var TRAJECTORY_STEP_FRAMES = 3.8;
  var PROJECTILE_TIME_SCALE = 1.38;

  function clamp(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return min;
    }
    return Math.min(max, Math.max(min, n));
  }

  function pullConfig(custom) {
    var input = custom || {};
    return {
      maxX: Number.isFinite(input.maxX) ? Math.max(0, input.maxX) : DEFAULT_PULL.maxX,
      maxY: Number.isFinite(input.maxY) ? Math.max(0, input.maxY) : DEFAULT_PULL.maxY,
      minLaunchX: Number.isFinite(input.minLaunchX)
        ? Math.max(0, input.minLaunchX)
        : DEFAULT_PULL.minLaunchX
    };
  }

  function launchConfig(custom) {
    var input = custom || {};
    return {
      power: Number.isFinite(input.power) ? input.power : DEFAULT_LAUNCH.power,
      lift: Number.isFinite(input.lift) ? input.lift : DEFAULT_LAUNCH.lift,
      minSpeedX: Number.isFinite(input.minSpeedX) ? input.minSpeedX : DEFAULT_LAUNCH.minSpeedX,
      gravity: Number.isFinite(input.gravity) ? input.gravity : DEFAULT_LAUNCH.gravity
    };
  }

  function clampDragPull(pull, limits) {
    var cfg = pullConfig(limits);
    var next = pull && typeof pull === "object" ? pull : {};
    return {
      x: clamp(Number(next.x), -cfg.maxX, 0),
      y: clamp(Number(next.y), -cfg.maxY, cfg.maxY)
    };
  }

  function normalizeReleasePull(pull, limits) {
    var cfg = pullConfig(limits);
    var next = clampDragPull(pull, cfg);
    if (next.x > -cfg.minLaunchX) {
      next.x = -cfg.minLaunchX;
    }
    return next;
  }

  function computeLaunchVelocity(pull, tuning) {
    var cfg = launchConfig(tuning);
    var safePull = normalizeReleasePull(pull);
    return {
      vx: Math.max(cfg.minSpeedX, -safePull.x * cfg.power),
      vy: (-safePull.y * cfg.power) - cfg.lift
    };
  }

  function consumeLaunchAttempt(attemptsUsed, maxAttempts) {
    var used = Math.max(0, Math.floor(Number(attemptsUsed) || 0));
    var limit = Math.max(1, Math.floor(Number(maxAttempts) || MAX_LAUNCH_ATTEMPTS));
    if (used >= limit) {
      return {
        didLaunch: false,
        attemptsUsed: used,
        attemptsRemaining: 0
      };
    }
    return {
      didLaunch: true,
      attemptsUsed: used + 1,
      attemptsRemaining: limit - (used + 1)
    };
  }

  function circleIntersectsRect(cx, cy, radius, rect) {
    var box = rect && typeof rect === "object"
      ? rect
      : { left: 0, right: 0, top: 0, bottom: 0 };
    var closestX = clamp(cx, box.left, box.right);
    var closestY = clamp(cy, box.top, box.bottom);
    var dx = cx - closestX;
    var dy = cy - closestY;
    return ((dx * dx) + (dy * dy)) <= (radius * radius);
  }

  function isPointInCircle(pointX, pointY, centerX, centerY, radius) {
    var r = Math.max(0, Number(radius) || 0);
    var dx = Number(pointX) - Number(centerX);
    var dy = Number(pointY) - Number(centerY);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return false;
    }
    return ((dx * dx) + (dy * dy)) <= (r * r);
  }

  function targetBullseye(rect) {
    var box = rect && typeof rect === "object"
      ? rect
      : { left: 0, right: 0, top: 0, bottom: 0 };
    var width = Math.max(0, Number(box.right) - Number(box.left));
    var height = Math.max(0, Number(box.bottom) - Number(box.top));
    var size = Math.min(width, height);
    return {
      cx: (Number(box.left) + Number(box.right)) * 0.5,
      cy: (Number(box.top) + Number(box.bottom)) * 0.5,
      radius: Math.max(6, size * 0.18)
    };
  }

  function isBullseyeHit(projectileX, projectileY, rect) {
    var bullseye = targetBullseye(rect);
    return isPointInCircle(projectileX, projectileY, bullseye.cx, bullseye.cy, bullseye.radius);
  }

  function isPointWithinGrabRadius(pointX, pointY, centerX, centerY, radius) {
    var r = Number.isFinite(radius) ? Math.max(0, radius) : DEFAULT_GRAB_RADIUS;
    var dx = Number(pointX) - Number(centerX);
    var dy = Number(pointY) - Number(centerY);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return false;
    }
    return ((dx * dx) + (dy * dy)) <= (r * r);
  }

  function computeTrajectoryPoints(origin, velocity, options) {
    var cfg = options && typeof options === "object" ? options : {};
    var start = origin && typeof origin === "object" ? origin : {};
    var speed = velocity && typeof velocity === "object" ? velocity : {};
    var count = Number.isFinite(cfg.count) ? Math.max(1, Math.round(cfg.count)) : TRAJECTORY_DOT_COUNT;
    var frames = Number.isFinite(cfg.stepFrames)
      ? Math.max(0.1, Number(cfg.stepFrames))
      : TRAJECTORY_STEP_FRAMES;
    var gravity = Number.isFinite(cfg.gravity) ? Number(cfg.gravity) : DEFAULT_LAUNCH.gravity;
    var bounds = cfg.bounds && typeof cfg.bounds === "object" ? cfg.bounds : null;
    var points = [];
    var i = 0;

    for (i = 0; i < count; i += 1) {
      var t = (i + 1) * frames;
      var x = (Number(start.x) || 0) + ((Number(speed.vx) || 0) * t);
      var y = (Number(start.y) || 0) + ((Number(speed.vy) || 0) * t) + (0.5 * gravity * t * t);
      var visible = true;
      if (bounds) {
        var width = Number(bounds.width) || 0;
        var height = Number(bounds.height) || 0;
        visible = x >= -14 && x <= (width + 14) && y >= -14 && y <= (height + 14);
      }
      points.push({
        x: x,
        y: y,
        visible: visible
      });
    }

    return points;
  }

  function createMiniGamePlugin() {
    return {
      id: "slingshot",
      title: "Slingshot Launch",
      initialWeight: 1,
      timing: {
        roundMs: 9000
      },
      mount: function (mount, engine) {
        var api = engine || {};
        var complete = typeof api.complete === "function"
          ? api.complete
          : function () {};
        var noteInteraction = typeof api.noteInteraction === "function"
          ? api.noteInteraction
          : function () {};
        var registerControl = typeof api.registerControl === "function"
          ? api.registerControl
          : function () {};
        var effects = api.effects && typeof api.effects === "object" ? api.effects : {};
        var confetti = typeof effects.confetti === "function" ? effects.confetti : function () {};
        var toast = typeof effects.toast === "function" ? effects.toast : function () {};

        var pull = { x: 0, y: 0 };
        var pointer = { active: false, id: -1 };
        var projectile = { x: 0, y: 0, vx: 0, vy: 0, active: false, lastMs: 0 };
        var rafId = 0;
        var missTimer = 0;
        var attemptsUsed = 0;
        var done = false;
        var metrics = null;

        mount.innerHTML =
          "<div class='slingshot-game'>" +
          "<div class='chip mini-instruction slingshot-chip'>Pull back and release (2 tries)</div>" +
          "<div class='slingshot-scene'>" +
          "<div class='slingshot-hill'></div>" +
          "<div class='slingshot-target' aria-hidden='true'></div>" +
          "<div class='slingshot-stand' aria-hidden='true'>" +
          "<span class='slingshot-fork fork-a'></span>" +
          "<span class='slingshot-fork fork-b'></span>" +
          "</div>" +
          "<div class='slingshot-band band-a' aria-hidden='true'></div>" +
          "<div class='slingshot-band band-b' aria-hidden='true'></div>" +
          "<div class='slingshot-trajectory' aria-hidden='true'></div>" +
          "<button type='button' class='slingshot-pouch' aria-label='Pull and release slingshot'></button>" +
          "<div class='slingshot-stone is-hidden' aria-hidden='true'></div>" +
          "</div>" +
          "</div>";

        var game = mount.querySelector(".slingshot-game");
        var chip = mount.querySelector(".slingshot-chip");
        var scene = mount.querySelector(".slingshot-scene");
        var target = mount.querySelector(".slingshot-target");
        var bandA = mount.querySelector(".band-a");
        var bandB = mount.querySelector(".band-b");
        var pouch = mount.querySelector(".slingshot-pouch");
        var stone = mount.querySelector(".slingshot-stone");
        var trajectory = mount.querySelector(".slingshot-trajectory");
        var trajectoryDots = [];
        var i = 0;

        for (i = 0; i < TRAJECTORY_DOT_COUNT; i += 1) {
          var dot = document.createElement("span");
          dot.className = "slingshot-trajectory-dot is-hidden";
          dot.style.setProperty("--dot-alpha", (0.9 - (i * 0.07)).toFixed(2));
          trajectory.appendChild(dot);
          trajectoryDots.push(dot);
        }

        registerControl(scene, { allowSwipeSkip: true });

        function readMetrics() {
          var rect = scene.getBoundingClientRect();
          var width = rect.width;
          var height = rect.height;
          return {
            width: width,
            height: height,
            anchorX: width * 0.224,
            anchorY: height * 0.62,
            leftForkX: width * 0.198,
            rightForkX: width * 0.25,
            forkY: height * 0.485
          };
        }

        function setBandGeometry(node, fromX, fromY, toX, toY) {
          if (!node) {
            return;
          }
          var dx = toX - fromX;
          var dy = toY - fromY;
          var length = Math.sqrt((dx * dx) + (dy * dy));
          var angle = Math.atan2(dy, dx) * (180 / Math.PI);
          node.style.left = fromX.toFixed(2) + "px";
          node.style.top = fromY.toFixed(2) + "px";
          node.style.width = Math.max(1, length).toFixed(2) + "px";
          node.style.transform = "translateY(-50%) rotate(" + angle.toFixed(2) + "deg)";
        }

        function renderBands(toX, toY) {
          if (!metrics) {
            return;
          }
          setBandGeometry(bandA, metrics.leftForkX, metrics.forkY, toX, toY);
          setBandGeometry(bandB, metrics.rightForkX, metrics.forkY, toX, toY);
        }

        function renderPouch(x, y) {
          pouch.style.left = x.toFixed(2) + "px";
          pouch.style.top = y.toFixed(2) + "px";
          renderBands(x, y);
        }

        function renderStone() {
          stone.style.left = projectile.x.toFixed(2) + "px";
          stone.style.top = projectile.y.toFixed(2) + "px";
        }

        function renderReadyPose() {
          if (!metrics) {
            return;
          }
          var x = metrics.anchorX + pull.x;
          var y = metrics.anchorY + pull.y;
          renderPouch(x, y);
          renderTrajectory(x, y);
        }

        function resetPointer() {
          pointer.active = false;
          pointer.id = -1;
        }

        function localPoint(evt) {
          var rect = scene.getBoundingClientRect();
          return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
          };
        }

        function updatePull(evt) {
          if (!hasLaunchesRemaining() || projectile.active || done || !metrics) {
            return;
          }
          var point = localPoint(evt);
          pull = clampDragPull({
            x: point.x - metrics.anchorX,
            y: point.y - metrics.anchorY
          });
          renderReadyPose();
        }

        function hideTrajectory() {
          if (!trajectory) {
            return;
          }
          trajectory.classList.remove("is-visible");
          trajectoryDots.forEach(function (dot) {
            dot.classList.add("is-hidden");
          });
        }

        function renderTrajectory(originX, originY) {
          if (!metrics || !hasLaunchesRemaining() || projectile.active || done) {
            hideTrajectory();
            return;
          }
          if (pull.x > -4) {
            hideTrajectory();
            return;
          }

          var velocity = computeLaunchVelocity(pull);
          var points = computeTrajectoryPoints(
            { x: originX, y: originY },
            velocity,
            {
              count: trajectoryDots.length,
              stepFrames: TRAJECTORY_STEP_FRAMES,
              gravity: launchConfig().gravity,
              bounds: { width: metrics.width, height: metrics.height }
            }
          );
          var visibleCount = 0;

          trajectoryDots.forEach(function (dot, index) {
            var point = points[index];
            if (point && point.visible) {
              dot.classList.remove("is-hidden");
              dot.style.left = point.x.toFixed(2) + "px";
              dot.style.top = point.y.toFixed(2) + "px";
              visibleCount += 1;
              return;
            }
            dot.classList.add("is-hidden");
          });

          trajectory.classList.toggle("is-visible", visibleCount > 0);
        }

        function targetRectInScene() {
          var sceneRect = scene.getBoundingClientRect();
          var targetRect = target.getBoundingClientRect();
          return {
            left: targetRect.left - sceneRect.left,
            right: targetRect.right - sceneRect.left,
            top: targetRect.top - sceneRect.top,
            bottom: targetRect.bottom - sceneRect.top
          };
        }

        function stopFlight() {
          if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
          }
          projectile.active = false;
        }

        function showMissFeedback(text) {
          chip.textContent = text || "Missed.";
          target.classList.add("is-miss");
          if (missTimer) {
            window.clearTimeout(missTimer);
          }
          missTimer = window.setTimeout(function () {
            target.classList.remove("is-miss");
            missTimer = 0;
          }, 460);
        }

        function hasLaunchesRemaining() {
          return attemptsUsed < MAX_LAUNCH_ATTEMPTS;
        }

        function onMiss() {
          stopFlight();
          if (hasLaunchesRemaining()) {
            stone.classList.remove("is-spent");
            stone.classList.add("is-hidden");
            pouch.classList.remove("is-spent");
            game.classList.remove("is-launched");
            pull = { x: 0, y: 0 };
            renderReadyPose();
            showMissFeedback("Missed. One try left.");
            return;
          }

          stone.classList.add("is-spent");
          pouch.classList.add("is-spent");
          showMissFeedback("Missed. No tries left.");
        }

        function onHit() {
          if (done) {
            return;
          }
          done = true;
          stopFlight();
          chip.textContent = "Bullseye!";
          target.classList.add("is-hit");
          confetti();
          toast("Bullseye!");
          complete();
        }

        function isOutOfBounds() {
          return (
            projectile.x < -42 ||
            projectile.x > (metrics.width + 42) ||
            projectile.y < -42 ||
            projectile.y > (metrics.height + 54)
          );
        }

        function stepFlight(ts) {
          if (!projectile.active) {
            return;
          }
          if (!projectile.lastMs) {
            projectile.lastMs = ts;
          }
          var dtMs = Math.min(34, Math.max(1, ts - projectile.lastMs));
          var dt = (dtMs / 16.666) * PROJECTILE_TIME_SCALE;
          projectile.lastMs = ts;

          projectile.x += projectile.vx * dt;
          projectile.y += projectile.vy * dt;
          projectile.vy += launchConfig().gravity * dt;
          renderStone();

          if (isBullseyeHit(projectile.x, projectile.y, targetRectInScene())) {
            onHit();
            return;
          }
          if (isOutOfBounds()) {
            onMiss();
            return;
          }

          rafId = window.requestAnimationFrame(stepFlight);
        }

        function launchFromPull() {
          if (!metrics || !hasLaunchesRemaining() || projectile.active || done) {
            return;
          }
          var launch = consumeLaunchAttempt(attemptsUsed, MAX_LAUNCH_ATTEMPTS);
          attemptsUsed = launch.attemptsUsed;
          if (!launch.didLaunch) {
            return;
          }

          game.classList.add("is-launched");
          pouch.classList.add("is-spent");
          pull = normalizeReleasePull(pull);
          var velocity = computeLaunchVelocity(pull);

          projectile.x = metrics.anchorX + pull.x;
          projectile.y = metrics.anchorY + pull.y;
          projectile.vx = velocity.vx;
          projectile.vy = velocity.vy;
          projectile.lastMs = 0;
          projectile.active = true;

          stone.classList.remove("is-hidden");
          renderStone();
          hideTrajectory();

          pull = { x: 0, y: 0 };
          renderPouch(metrics.anchorX, metrics.anchorY);
          chip.textContent = launch.attemptsRemaining > 0
            ? "Shot away... One try left."
            : "Final shot away...";

          stopFlight();
          projectile.active = true;
          rafId = window.requestAnimationFrame(stepFlight);
        }

        function onPointerDown(evt) {
          if (!hasLaunchesRemaining() || projectile.active || done) {
            return;
          }
          if (!metrics) {
            return;
          }
          var point = localPoint(evt);
          var pouchX = metrics.anchorX + pull.x;
          var pouchY = metrics.anchorY + pull.y;
          if (!isPointWithinGrabRadius(point.x, point.y, pouchX, pouchY, DEFAULT_GRAB_RADIUS)) {
            return;
          }
          evt.stopPropagation();
          pointer.active = true;
          pointer.id = evt.pointerId;
          noteInteraction();
          if (typeof scene.setPointerCapture === "function") {
            try {
              scene.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore pointer-capture failures.
            }
          }
          updatePull(evt);
        }

        function onPointerMove(evt) {
          if (!pointer.active || pointer.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          noteInteraction();
          updatePull(evt);
        }

        function onPointerUp(evt) {
          if (!pointer.active || pointer.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          resetPointer();
          launchFromPull();
        }

        function onPointerCancel(evt) {
          if (!pointer.active || pointer.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          resetPointer();
          if (hasLaunchesRemaining() && !projectile.active) {
            pull = { x: 0, y: 0 };
            renderReadyPose();
          }
        }

        function onResize() {
          metrics = readMetrics();
          if (hasLaunchesRemaining() && !projectile.active) {
            renderReadyPose();
            return;
          }
          hideTrajectory();
        }

        scene.addEventListener("pointerdown", onPointerDown);
        scene.addEventListener("pointermove", onPointerMove);
        scene.addEventListener("pointerup", onPointerUp);
        scene.addEventListener("pointercancel", onPointerCancel);
        scene.addEventListener("lostpointercapture", onPointerCancel);
        window.addEventListener("resize", onResize);

        metrics = readMetrics();
        renderReadyPose();

        return function cleanup() {
          stopFlight();
          if (missTimer) {
            window.clearTimeout(missTimer);
            missTimer = 0;
          }
          hideTrajectory();
          window.removeEventListener("resize", onResize);
          scene.removeEventListener("pointerdown", onPointerDown);
          scene.removeEventListener("pointermove", onPointerMove);
          scene.removeEventListener("pointerup", onPointerUp);
          scene.removeEventListener("pointercancel", onPointerCancel);
          scene.removeEventListener("lostpointercapture", onPointerCancel);
        };
      }
    };
  }

  var api = {
    DEFAULT_PULL: DEFAULT_PULL,
    DEFAULT_LAUNCH: DEFAULT_LAUNCH,
    MAX_LAUNCH_ATTEMPTS: MAX_LAUNCH_ATTEMPTS,
    clampDragPull: clampDragPull,
    normalizeReleasePull: normalizeReleasePull,
    computeLaunchVelocity: computeLaunchVelocity,
    consumeLaunchAttempt: consumeLaunchAttempt,
    circleIntersectsRect: circleIntersectsRect,
    isPointInCircle: isPointInCircle,
    targetBullseye: targetBullseye,
    isBullseyeHit: isBullseyeHit,
    isPointWithinGrabRadius: isPointWithinGrabRadius,
    computeTrajectoryPoints: computeTrajectoryPoints,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.SlingshotMiniGame = api;
  }
}());
