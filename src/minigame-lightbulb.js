(function () {
  "use strict";

  var MAX_BULB_STEP = 3;
  var BULB_DROP_PER_STEP = 8;
  var DEFAULT_SWIPE = {
    minDx: 44,
    maxDy: 38,
    maxMs: 650,
    horizontalRatio: 1.2
  };

  function clamp(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return min;
    }
    return Math.min(max, Math.max(min, n));
  }

  function swipeConfig(custom) {
    var input = custom || {};
    return {
      minDx: Number.isFinite(input.minDx) ? input.minDx : DEFAULT_SWIPE.minDx,
      maxDy: Number.isFinite(input.maxDy) ? input.maxDy : DEFAULT_SWIPE.maxDy,
      maxMs: Number.isFinite(input.maxMs) ? input.maxMs : DEFAULT_SWIPE.maxMs,
      horizontalRatio: Number.isFinite(input.horizontalRatio)
        ? input.horizontalRatio
        : DEFAULT_SWIPE.horizontalRatio
    };
  }

  function isValidRightSwipe(gesture, thresholds) {
    if (!gesture || typeof gesture !== "object") {
      return false;
    }
    var cfg = swipeConfig(thresholds);
    var dx = Number(gesture.dx);
    var dy = Number(gesture.dy);
    var dt = Number(gesture.dt);

    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dt)) {
      return false;
    }
    if (dt <= 0 || dt > cfg.maxMs) {
      return false;
    }
    if (dx < cfg.minDx) {
      return false;
    }
    if (Math.abs(dy) > cfg.maxDy) {
      return false;
    }
    if (Math.abs(dx) < (Math.abs(dy) * cfg.horizontalRatio)) {
      return false;
    }
    return true;
  }

  function advanceBulbStep(currentStep, gesture, maxStep) {
    var limit = Number.isFinite(maxStep) ? maxStep : MAX_BULB_STEP;
    var step = clamp(currentStep, 0, limit);
    if (step >= limit) {
      return limit;
    }
    if (!isValidRightSwipe(gesture)) {
      return step;
    }
    return clamp(step + 1, 0, limit);
  }

  function getGlowLevel(step, maxStep) {
    var limit = Number.isFinite(maxStep) ? maxStep : MAX_BULB_STEP;
    if (limit <= 0) {
      return 0;
    }
    return clamp(step, 0, limit) / limit;
  }

  function getBoostedGlow(level) {
    var base = clamp(level, 0, 1);
    if (base <= 0) {
      return 0;
    }
    return clamp(0.18 + (base * 0.92), 0, 1);
  }

  function getRotationForStep(step, maxStep) {
    void step;
    void maxStep;
    return 0;
  }

  function getBulbTransform(step, maxStep) {
    var limit = Number.isFinite(maxStep) ? maxStep : MAX_BULB_STEP;
    var drop = clamp(step, 0, limit) * BULB_DROP_PER_STEP;
    return "translateY(" + String(drop) + "px)";
  }

  function createMiniGamePlugin() {
    return {
      id: "bulb",
      title: "Lamp Twist",
      initialWeight: 1,
      mount: function (mount, engine) {
        var api = engine || {};
        var complete = typeof api.complete === "function"
          ? api.complete
          : function () {};
        var registerControl = typeof api.registerControl === "function"
          ? api.registerControl
          : function () {};
        var step = 0;
        var done = false;
        var swipe = { active: false, x: 0, y: 0, t: 0, id: -1 };

        mount.innerHTML =
          "<div class='bulb-game'>" +
          "<div class='chip mini-instruction bulb-chip'>Swipe bulb right</div>" +
          "<div class='lamp-scene'>" +
          "<div class='lamp-glow'></div>" +
          "<div class='lamp-stem'></div>" +
          "<div class='lamp-socket'></div>" +
          "<button type='button' class='bulb-hit' aria-label='Twist the bulb'>" +
          "<span class='bulb-glass'></span>" +
          "<span class='bulb-base'></span>" +
          "</button>" +
          "</div>" +
          "<div class='bulb-swipe-hint' aria-hidden='true'>--></div>" +
          "</div>";

        var scene = mount.querySelector(".lamp-scene");
        var bulb = mount.querySelector(".bulb-hit");
        var hint = mount.querySelector(".bulb-chip");
        registerControl(bulb);

        function renderState() {
          if (!scene || !bulb || !hint) {
            return;
          }
          var glow = getGlowLevel(step, MAX_BULB_STEP);
          var boostedGlow = getBoostedGlow(glow);
          var glowScale = 0.88 + (boostedGlow * 0.62);
          var transform = getBulbTransform(step, MAX_BULB_STEP);
          scene.style.setProperty("--lamp-glow", boostedGlow.toFixed(3));
          scene.style.setProperty("--lamp-glow-size", glowScale.toFixed(3));
          bulb.style.setProperty("--bulb-transform", transform);
          bulb.style.setProperty("--bulb-thread-shift", String(step * 6) + "px");
          bulb.style.transform = transform;
          if (step >= MAX_BULB_STEP) {
            hint.textContent = "Bulb locked in";
          } else {
            hint.textContent = "Swipe bulb right";
          }
        }

        function playTurnFeedback() {
          bulb.classList.remove("is-turning");
          // Force a reflow so repeated valid swipes replay the turn animation.
          void bulb.offsetWidth;
          bulb.classList.add("is-turning");
        }

        function resetSwipe() {
          swipe.active = false;
          swipe.id = -1;
        }

        function onPointerDown(evt) {
          swipe.active = true;
          swipe.x = evt.clientX;
          swipe.y = evt.clientY;
          swipe.t = Date.now();
          swipe.id = evt.pointerId;
          if (typeof bulb.setPointerCapture === "function") {
            try {
              bulb.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore capture failures on unsupported environments.
            }
          }
        }

        function onPointerUp(evt) {
          if (!swipe.active || swipe.id !== evt.pointerId) {
            return;
          }
          var gesture = {
            dx: evt.clientX - swipe.x,
            dy: evt.clientY - swipe.y,
            dt: Date.now() - swipe.t
          };
          resetSwipe();
          var nextStep = advanceBulbStep(step, gesture, MAX_BULB_STEP);
          if (nextStep === step) {
            return;
          }
          step = nextStep;
          renderState();
          playTurnFeedback();
          if (!done && step >= MAX_BULB_STEP) {
            done = true;
            complete();
          }
        }

        function onPointerCancel(evt) {
          if (swipe.active && swipe.id === evt.pointerId) {
            resetSwipe();
          }
        }

        function onTurnAnimationEnd() {
          bulb.classList.remove("is-turning");
        }

        bulb.addEventListener("pointerdown", onPointerDown);
        bulb.addEventListener("pointerup", onPointerUp);
        bulb.addEventListener("pointercancel", onPointerCancel);
        bulb.addEventListener("lostpointercapture", onPointerCancel);
        bulb.addEventListener("animationend", onTurnAnimationEnd);
        renderState();

        return function cleanup() {
          bulb.removeEventListener("pointerdown", onPointerDown);
          bulb.removeEventListener("pointerup", onPointerUp);
          bulb.removeEventListener("pointercancel", onPointerCancel);
          bulb.removeEventListener("lostpointercapture", onPointerCancel);
          bulb.removeEventListener("animationend", onTurnAnimationEnd);
        };
      }
    };
  }

  var api = {
    MAX_BULB_STEP: MAX_BULB_STEP,
    isValidRightSwipe: isValidRightSwipe,
    advanceBulbStep: advanceBulbStep,
    getGlowLevel: getGlowLevel,
    getBoostedGlow: getBoostedGlow,
    getRotationForStep: getRotationForStep,
    getBulbTransform: getBulbTransform,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.LightbulbMiniGame = api;
  }
}());
