(function () {
  "use strict";

  var TABLE_PADDING = 14;
  var BALL_RADIUS = 11;
  var POCKET_RADIUS = 20;
  var TARGET_POCKET_RADIUS = 24;
  var TARGET_POCKET_KEY = "top-right";
  var SHOT_MIN_DRAG = 10;
  var SHOT_MAX_DRAG = 140;
  var SHOT_MAX_SPEED = 900;
  var DRAG_START_RADIUS = 54;
  var FRICTION = 0.998;
  var STOP_SPEED = 8;
  var CUSHION_BOUNCE = 0.9;
  var BALL_BOUNCE = 0.985;
  var EIGHTBALL_TRANSFER_BOOST = 1.5;

  function clamp(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return min;
    }
    return Math.min(max, Math.max(min, n));
  }

  function magnitude(x, y) {
    var dx = Number(x) || 0;
    var dy = Number(y) || 0;
    return Math.sqrt((dx * dx) + (dy * dy));
  }

  function normalizeVector(x, y) {
    var dx = Number(x) || 0;
    var dy = Number(y) || 0;
    var len = magnitude(dx, dy);
    if (!len) {
      return { x: 0, y: 0, length: 0 };
    }
    return {
      x: dx / len,
      y: dy / len,
      length: len
    };
  }

  function randomBetween(min, max, rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var a = Number(min) || 0;
    var b = Number(max) || 0;
    return a + ((b - a) * random());
  }

  function computeShotVelocity(dx, dy, minDrag, maxDrag, maxSpeed) {
    var minimumDrag = Number.isFinite(minDrag) ? Math.max(0, minDrag) : SHOT_MIN_DRAG;
    var maximumDrag = Number.isFinite(maxDrag) ? Math.max(minimumDrag + 1, maxDrag) : SHOT_MAX_DRAG;
    var topSpeed = Number.isFinite(maxSpeed) ? Math.max(1, maxSpeed) : SHOT_MAX_SPEED;
    var vector = normalizeVector(dx, dy);
    if (vector.length <= minimumDrag) {
      return { x: 0, y: 0, speed: 0 };
    }
    var drag = clamp(vector.length, minimumDrag, maximumDrag);
    var t = (drag - minimumDrag) / (maximumDrag - minimumDrag);
    var speed = topSpeed * clamp(t, 0, 1);
    return {
      x: vector.x * speed,
      y: vector.y * speed,
      speed: speed
    };
  }

  function computePockets(width, height, inset) {
    var w = Math.max(1, Number(width) || 1);
    var h = Math.max(1, Number(height) || 1);
    var padding = Number.isFinite(inset) ? Math.max(0, inset) : TABLE_PADDING;
    return [
      { key: "top-left", x: padding, y: padding, target: false, radius: POCKET_RADIUS },
      { key: "top-right", x: w - padding, y: padding, target: true, radius: TARGET_POCKET_RADIUS },
      { key: "bottom-left", x: padding, y: h - padding, target: false, radius: POCKET_RADIUS },
      { key: "bottom-right", x: w - padding, y: h - padding, target: false, radius: POCKET_RADIUS }
    ];
  }

  function findPocket(ball, pockets, pocketRadius) {
    var baseRadius = Number.isFinite(pocketRadius) ? Math.max(0, pocketRadius) : POCKET_RADIUS;
    var allPockets = Array.isArray(pockets) ? pockets : [];
    var i = 0;
    for (i = 0; i < allPockets.length; i += 1) {
      var pocket = allPockets[i];
      var radius = Number.isFinite(pocket.radius) ? Math.max(0, pocket.radius) : baseRadius;
      var distance = magnitude(ball.x - pocket.x, ball.y - pocket.y);
      if (distance <= radius) {
        return pocket;
      }
    }
    return null;
  }

  function createEasyStartLayout(width, height, bounds, pockets) {
    var w = Math.max(1, Number(width) || 1);
    var h = Math.max(1, Number(height) || 1);
    var b = bounds || {};
    var left = Number(b.left) || 0;
    var right = Number(b.right) || w;
    var top = Number(b.top) || 0;
    var bottom = Number(b.bottom) || h;
    var target = null;
    var i = 0;
    for (i = 0; i < pockets.length; i += 1) {
      if (pockets[i].key === TARGET_POCKET_KEY || pockets[i].target) {
        target = pockets[i];
        break;
      }
    }
    if (!target) {
      target = { x: w - TABLE_PADDING, y: TABLE_PADDING };
    }

    for (i = 0; i < 16; i += 1) {
      var angle = randomBetween(2.15, 2.55);
      var eightDistance = randomBetween(76, 120);
      var eightX = target.x + (Math.cos(angle) * eightDistance);
      var eightY = target.y + (Math.sin(angle) * eightDistance);
      eightX = clamp(eightX, left + BALL_RADIUS + 2, right - BALL_RADIUS - 2);
      eightY = clamp(eightY, top + BALL_RADIUS + 2, bottom - BALL_RADIUS - 2);

      var toPocket = normalizeVector(target.x - eightX, target.y - eightY);
      if (!toPocket.length) {
        continue;
      }
      var cueDistance = randomBetween(88, 132);
      var lateral = randomBetween(-10, 10);
      var perpX = -toPocket.y;
      var perpY = toPocket.x;
      var cueX = eightX - (toPocket.x * cueDistance) + (perpX * lateral);
      var cueY = eightY - (toPocket.y * cueDistance) + (perpY * lateral);
      cueX = clamp(cueX, left + BALL_RADIUS + 2, right - BALL_RADIUS - 2);
      cueY = clamp(cueY, top + BALL_RADIUS + 2, bottom - BALL_RADIUS - 2);

      if (magnitude(cueX - eightX, cueY - eightY) < (BALL_RADIUS * 5)) {
        continue;
      }

      return {
        cue: { x: cueX, y: cueY },
        eight: { x: eightX, y: eightY }
      };
    }

    return {
      cue: { x: w * 0.28, y: h * 0.72 },
      eight: { x: w * 0.68, y: h * 0.38 }
    };
  }

  function advanceBall(ball, dt, friction, stopSpeed) {
    if (ball.pocketed) {
      return;
    }
    var delta = Math.max(0, Number(dt) || 0);
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    var frictionPerFrame = clamp(
      Number.isFinite(friction) ? friction : FRICTION,
      0,
      1
    );
    var decay = Math.pow(frictionPerFrame, delta * 60);
    ball.vx *= decay;
    ball.vy *= decay;

    var haltSpeed = Number.isFinite(stopSpeed) ? Math.max(0, stopSpeed) : STOP_SPEED;
    if (magnitude(ball.vx, ball.vy) < haltSpeed) {
      ball.vx = 0;
      ball.vy = 0;
    }
  }

  function applyCushionBounce(ball, bounds, bounce) {
    if (ball.pocketed) {
      return;
    }
    var b = bounds || {};
    var rebound = clamp(Number.isFinite(bounce) ? bounce : CUSHION_BOUNCE, 0, 1);
    var left = Number(b.left) || 0;
    var right = Number(b.right) || 0;
    var top = Number(b.top) || 0;
    var bottom = Number(b.bottom) || 0;

    if (ball.x - ball.r < left) {
      ball.x = left + ball.r;
      ball.vx = Math.abs(ball.vx) * rebound;
    } else if (ball.x + ball.r > right) {
      ball.x = right - ball.r;
      ball.vx = -Math.abs(ball.vx) * rebound;
    }

    if (ball.y - ball.r < top) {
      ball.y = top + ball.r;
      ball.vy = Math.abs(ball.vy) * rebound;
    } else if (ball.y + ball.r > bottom) {
      ball.y = bottom - ball.r;
      ball.vy = -Math.abs(ball.vy) * rebound;
    }
  }

  function resolveBallCollision(ballA, ballB, bounce, transferBoost) {
    if (ballA.pocketed || ballB.pocketed) {
      return false;
    }
    var dx = ballB.x - ballA.x;
    var dy = ballB.y - ballA.y;
    var distance = magnitude(dx, dy);
    var minDist = ballA.r + ballB.r;
    if (distance > minDist || minDist <= 0) {
      return false;
    }

    if (!distance) {
      distance = 1;
      dx = 1;
      dy = 0;
    }

    var nx = dx / distance;
    var ny = dy / distance;
    var overlap = minDist - distance;
    if (overlap > 0) {
      var shift = overlap * 0.5;
      ballA.x -= nx * shift;
      ballA.y -= ny * shift;
      ballB.x += nx * shift;
      ballB.y += ny * shift;
    }

    var relVx = ballB.vx - ballA.vx;
    var relVy = ballB.vy - ballA.vy;
    var speedAlongNormal = (relVx * nx) + (relVy * ny);
    if (speedAlongNormal > 0) {
      return true;
    }

    var restitution = clamp(Number.isFinite(bounce) ? bounce : BALL_BOUNCE, 0, 1);
    var boost = clamp(Number.isFinite(transferBoost) ? transferBoost : 1, 1, 2);
    var impulse = -((1 + restitution) * speedAlongNormal) / 2;
    var impulseX = impulse * nx;
    var impulseY = impulse * ny;

    ballA.vx -= impulseX;
    ballA.vy -= impulseY;
    ballB.vx += impulseX * boost;
    ballB.vy += impulseY * boost;
    return true;
  }

  function bothStopped(cueBall, eightBall, stopSpeed) {
    var threshold = Number.isFinite(stopSpeed) ? Math.max(0, stopSpeed) : STOP_SPEED;
    var cueStopped = cueBall.pocketed || magnitude(cueBall.vx, cueBall.vy) <= threshold;
    var eightStopped = eightBall.pocketed || magnitude(eightBall.vx, eightBall.vy) <= threshold;
    return cueStopped && eightStopped;
  }

  function createMiniGamePlugin() {
    return {
      id: "eightball",
      title: "8-Ball One Shot",
      initialWeight: 1,
      timing: {
        roundMs: 12000
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

        var done = false;
        var shotTaken = false;
        var initialized = false;
        var skipReadyAt = 0;
        var rafId = 0;
        var settleTimer = 0;
        var framePrev = 0;
        var tableRect = null;
        var pockets = [];
        var bounds = {
          left: TABLE_PADDING,
          right: TABLE_PADDING,
          top: TABLE_PADDING,
          bottom: TABLE_PADDING
        };
        var drag = {
          active: false,
          id: -1,
          x: 0,
          y: 0
        };
        var cueBall = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          r: BALL_RADIUS,
          pocketed: false
        };
        var eightBall = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          r: BALL_RADIUS,
          pocketed: false
        };

        mount.innerHTML =
          "<div class='eightball-game'>" +
          "<div class='chip mini-instruction eightball-chip'>One shot: pull back from the cue ball, then release</div>" +
          "<div class='eightball-table' aria-label='8-ball table'>" +
          "<div class='eightball-pocket-layer' aria-hidden='true'></div>" +
          "<div class='eightball-aim' aria-hidden='true'>" +
          "<span class='eightball-aim-line'></span>" +
          "<span class='eightball-cue-stick'></span>" +
          "</div>" +
          "<span class='eightball-ball eightball-cueball' aria-hidden='true'></span>" +
          "<span class='eightball-ball eightball-eightball' aria-hidden='true'><span class='eightball-label'>8</span></span>" +
          "</div>" +
          "<div class='chip eightball-status'>Pull away from your target and release</div>" +
          "</div>";

        var table = mount.querySelector(".eightball-table");
        var pocketLayer = mount.querySelector(".eightball-pocket-layer");
        var aimNode = mount.querySelector(".eightball-aim");
        var aimLine = mount.querySelector(".eightball-aim-line");
        var cueStick = mount.querySelector(".eightball-cue-stick");
        var cueNode = mount.querySelector(".eightball-cueball");
        var eightNode = mount.querySelector(".eightball-eightball");
        var statusNode = mount.querySelector(".eightball-status");

        registerControl(table);
        table.style.touchAction = "none";

        function enablePostLaunchSkip() {
          registerControl(table, { allowSwipeSkip: true });
          skipReadyAt = Date.now() + 240;
        }

        function setStatus(text) {
          if (statusNode) {
            statusNode.textContent = String(text || "");
          }
        }

        function setAimVisible(visible) {
          if (!aimNode) {
            return;
          }
          aimNode.classList.toggle("is-visible", Boolean(visible) && !done && !shotTaken);
        }

        function refreshLayout() {
          tableRect = table.getBoundingClientRect();
          var width = Math.max(1, tableRect.width || 1);
          var height = Math.max(1, tableRect.height || 1);
          bounds.left = TABLE_PADDING;
          bounds.right = Math.max(bounds.left + (BALL_RADIUS * 2), width - TABLE_PADDING);
          bounds.top = TABLE_PADDING;
          bounds.bottom = Math.max(bounds.top + (BALL_RADIUS * 2), height - TABLE_PADDING);
          pockets = computePockets(width, height, TABLE_PADDING);

          if (!initialized) {
            var layout = createEasyStartLayout(width, height, bounds, pockets);
            cueBall.x = layout.cue.x;
            cueBall.y = layout.cue.y;
            eightBall.x = layout.eight.x;
            eightBall.y = layout.eight.y;
            initialized = true;
          } else {
            cueBall.x = clamp(cueBall.x, bounds.left + cueBall.r, bounds.right - cueBall.r);
            cueBall.y = clamp(cueBall.y, bounds.top + cueBall.r, bounds.bottom - cueBall.r);
            eightBall.x = clamp(eightBall.x, bounds.left + eightBall.r, bounds.right - eightBall.r);
            eightBall.y = clamp(eightBall.y, bounds.top + eightBall.r, bounds.bottom - eightBall.r);
          }
          renderPockets();
          renderBalls();
        }

        function renderPockets() {
          if (!pocketLayer) {
            return;
          }
          pocketLayer.innerHTML = pockets.map(function (pocket) {
            var classes = "eightball-pocket";
            if (pocket.key === TARGET_POCKET_KEY || pocket.target) {
              classes += " is-target";
            }
            return (
              "<span class='" + classes + "' style='left:" + Math.round(pocket.x) + "px;top:" + Math.round(pocket.y) + "px' aria-hidden='true'></span>"
            );
          }).join("");
        }

        function renderBalls() {
          if (cueNode) {
            cueNode.style.left = String(Math.round(cueBall.x - cueBall.r)) + "px";
            cueNode.style.top = String(Math.round(cueBall.y - cueBall.r)) + "px";
            cueNode.classList.toggle("is-pocketed", cueBall.pocketed);
          }
          if (eightNode) {
            eightNode.style.left = String(Math.round(eightBall.x - eightBall.r)) + "px";
            eightNode.style.top = String(Math.round(eightBall.y - eightBall.r)) + "px";
            eightNode.classList.toggle("is-pocketed", eightBall.pocketed);
          }
        }

        function renderAim(pointerX, pointerY, active) {
          if (!active || done || shotTaken) {
            setAimVisible(false);
            return;
          }
          // Pull-back aiming: drag opposite the intended travel direction.
          var vector = normalizeVector(cueBall.x - pointerX, cueBall.y - pointerY);
          if (vector.length <= 2) {
            setAimVisible(false);
            return;
          }
          var power = clamp(
            (vector.length - SHOT_MIN_DRAG) / (SHOT_MAX_DRAG - SHOT_MIN_DRAG),
            0,
            1
          );
          if (power <= 0) {
            setAimVisible(false);
            return;
          }

          var angle = Math.atan2(vector.y, vector.x);
          var guideLength = 26 + (power * 68);
          var cueLength = 86;
          var cueOffset = 14 + (power * 36);

          aimLine.style.left = String(Math.round(cueBall.x)) + "px";
          aimLine.style.top = String(Math.round(cueBall.y)) + "px";
          aimLine.style.width = String(Math.round(guideLength)) + "px";
          aimLine.style.transform = "translate(0,-50%) rotate(" + String(angle) + "rad)";

          cueStick.style.left = String(Math.round(cueBall.x)) + "px";
          cueStick.style.top = String(Math.round(cueBall.y)) + "px";
          cueStick.style.width = String(Math.round(cueLength)) + "px";
          cueStick.style.transform =
            "translate(0,-50%) rotate(" + String(angle) + "rad) translateX(" +
            String(Math.round(-(cueOffset + cueLength))) +
            "px)";

          setAimVisible(true);
          setStatus("Power: " + String(Math.round(power * 100)) + "%");
        }

        function getLocalPoint(evt) {
          if (!tableRect) {
            refreshLayout();
          }
          return {
            x: clamp(evt.clientX - tableRect.left, 0, tableRect.width || 0),
            y: clamp(evt.clientY - tableRect.top, 0, tableRect.height || 0)
          };
        }

        function settle(result, text, delayMs) {
          if (done) {
            return;
          }
          done = true;
          setAimVisible(false);
          setStatus(text);
          if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
          }
          settleTimer = window.setTimeout(function () {
            if (result === "complete") {
              complete();
            } else {
              fail(result);
            }
          }, Math.max(0, Number(delayMs) || 0));
        }

        function updatePocketedState(ball, node) {
          if (ball.pocketed) {
            return null;
          }
          var pocket = findPocket(ball, pockets, POCKET_RADIUS);
          if (!pocket) {
            return null;
          }
          ball.pocketed = true;
          ball.vx = 0;
          ball.vy = 0;
          if (node) {
            node.classList.add("is-pocketed");
          }
          return pocket;
        }

        function step(now) {
          if (done) {
            return;
          }
          if (!framePrev) {
            framePrev = now;
          }
          var dt = Math.min(0.033, (now - framePrev) / 1000);
          framePrev = now;

          advanceBall(cueBall, dt, FRICTION, STOP_SPEED);
          advanceBall(eightBall, dt, FRICTION, STOP_SPEED);

          var cuePocket = updatePocketedState(cueBall, cueNode);
          var eightPocket = updatePocketedState(eightBall, eightNode);

          if (!cuePocket) {
            applyCushionBounce(cueBall, bounds, CUSHION_BOUNCE);
          }
          if (!eightPocket) {
            applyCushionBounce(eightBall, bounds, CUSHION_BOUNCE);
          }
          if (!cueBall.pocketed && !eightBall.pocketed) {
            resolveBallCollision(cueBall, eightBall, BALL_BOUNCE, EIGHTBALL_TRANSFER_BOOST);
          }

          renderBalls();

          if (cuePocket) {
            settle("scratch", "Cue ball scratched. Round failed.", 140);
            return;
          }

          if (eightPocket) {
            if (eightPocket.key === TARGET_POCKET_KEY || eightPocket.target) {
              settle("complete", "Nice shot!", 260);
            } else {
              settle("wrong-pocket", "Wrong pocket. Round failed.", 140);
            }
            return;
          }

          if (shotTaken && bothStopped(cueBall, eightBall, STOP_SPEED)) {
            settle("miss", "Missed shot. Round failed.", 120);
            return;
          }

          rafId = window.requestAnimationFrame(step);
        }

        function onPointerDown(evt) {
          if (done || shotTaken) {
            return;
          }
          if (evt.pointerType === "mouse" && evt.button !== 0) {
            return;
          }
          var point = getLocalPoint(evt);
          var distanceToCue = magnitude(point.x - cueBall.x, point.y - cueBall.y);
          if (distanceToCue > DRAG_START_RADIUS) {
            setStatus("Tip: drag near the cue ball for easier control");
          }
          evt.stopPropagation();
          noteInteraction();
          drag.active = true;
          drag.id = evt.pointerId;
          drag.x = point.x;
          drag.y = point.y;
          if (typeof table.setPointerCapture === "function") {
            try {
              table.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore pointer capture failures.
            }
          }
          renderAim(point.x, point.y, true);
        }

        function onPointerMove(evt) {
          if (!drag.active || drag.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          var point = getLocalPoint(evt);
          drag.x = point.x;
          drag.y = point.y;
          renderAim(point.x, point.y, true);
        }

        function clearDragState() {
          drag.active = false;
          drag.id = -1;
        }

        function onPointerUp(evt) {
          if (!drag.active || drag.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          var point = getLocalPoint(evt);
          clearDragState();
          renderAim(point.x, point.y, false);
          if (done || shotTaken) {
            return;
          }

          var shot = computeShotVelocity(
            cueBall.x - point.x,
            cueBall.y - point.y,
            SHOT_MIN_DRAG,
            SHOT_MAX_DRAG,
            SHOT_MAX_SPEED
          );

          shotTaken = true;
          cueBall.vx = shot.x;
          cueBall.vy = shot.y;
          enablePostLaunchSkip();
          noteInteraction();
          setStatus("Shot taken. Tap anywhere or swipe up to skip.");
          framePrev = 0;
          if (!rafId) {
            rafId = window.requestAnimationFrame(step);
          }
        }

        function onPostLaunchTap(evt) {
          if (!shotTaken || done) {
            return;
          }
          if (Date.now() < skipReadyAt) {
            return;
          }
          evt.stopPropagation();
          settle("skip", "Skipping...", 0);
        }

        function onPointerCancel(evt) {
          if (!drag.active || drag.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          clearDragState();
          setAimVisible(false);
          setStatus("Pull away from your target and release");
        }

        function onResize() {
          refreshLayout();
          if (drag.active) {
            renderAim(drag.x, drag.y, true);
          }
        }

        table.addEventListener("pointerdown", onPointerDown);
        table.addEventListener("pointermove", onPointerMove);
        table.addEventListener("pointerup", onPointerUp);
        table.addEventListener("pointercancel", onPointerCancel);
        table.addEventListener("lostpointercapture", onPointerCancel);
        table.addEventListener("click", onPostLaunchTap);
        window.addEventListener("resize", onResize);
        refreshLayout();
        setStatus("Pull away from your target and release");
        renderBalls();

        return function cleanup() {
          if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
          }
          window.clearTimeout(settleTimer);
          table.removeEventListener("pointerdown", onPointerDown);
          table.removeEventListener("pointermove", onPointerMove);
          table.removeEventListener("pointerup", onPointerUp);
          table.removeEventListener("pointercancel", onPointerCancel);
          table.removeEventListener("lostpointercapture", onPointerCancel);
          table.removeEventListener("click", onPostLaunchTap);
          window.removeEventListener("resize", onResize);
        };
      }
    };
  }

  var api = {
    TABLE_PADDING: TABLE_PADDING,
    BALL_RADIUS: BALL_RADIUS,
    POCKET_RADIUS: POCKET_RADIUS,
    TARGET_POCKET_RADIUS: TARGET_POCKET_RADIUS,
    TARGET_POCKET_KEY: TARGET_POCKET_KEY,
    SHOT_MIN_DRAG: SHOT_MIN_DRAG,
    SHOT_MAX_DRAG: SHOT_MAX_DRAG,
    SHOT_MAX_SPEED: SHOT_MAX_SPEED,
    EIGHTBALL_TRANSFER_BOOST: EIGHTBALL_TRANSFER_BOOST,
    clamp: clamp,
    normalizeVector: normalizeVector,
    computeShotVelocity: computeShotVelocity,
    createEasyStartLayout: createEasyStartLayout,
    computePockets: computePockets,
    findPocket: findPocket,
    resolveBallCollision: resolveBallCollision,
    bothStopped: bothStopped,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.EightBallMiniGame = api;
  }
}());
