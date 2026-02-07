(function () {
  "use strict";

  var TARGET_GOOD = 4;
  var CANOPY_LEFT = 16;
  var CANOPY_RIGHT = 84;
  var SPAWN_MIN_MS = 600;
  var SPAWN_MAX_MS = 1200;
  var SPEED_MIN = 130;
  var SPEED_MAX = 240;
  var BASKET_WIDTH = 86;
  var SWIPE_MIN_DX = 42;
  var SWIPE_MAX_DT = 460;
  var SWIPE_DOMINANCE = 1.15;
  var SWIPE_STEP = 14;

  var ITEM_TYPES = [
    { type: "apple", isGood: true, value: 10, className: "is-apple" },
    { type: "orange", isGood: true, value: 15, className: "is-orange" },
    { type: "pear", isGood: true, value: 20, className: "is-pear" }
  ];

  function clamp(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return min;
    }
    return Math.min(max, Math.max(min, n));
  }

  function randomBetween(min, max) {
    return min + (Math.random() * (max - min));
  }

  function pickType() {
    return ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  }

  function getHorizontalSwipeDirection(gesture) {
    if (!gesture || typeof gesture !== "object") {
      return 0;
    }
    var dx = Number(gesture.dx);
    var dy = Number(gesture.dy);
    var dt = Number(gesture.dt);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dt)) {
      return 0;
    }
    if (dt <= 0 || dt > SWIPE_MAX_DT) {
      return 0;
    }
    if (Math.abs(dx) < SWIPE_MIN_DX) {
      return 0;
    }
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) {
      return 0;
    }
    return dx > 0 ? 1 : -1;
  }

  function createMiniGamePlugin() {
    return {
      id: "harvest",
      title: "Harvest Catch",
      initialWeight: 1,
      timing: {
        roundMs: 18000
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

        var done = false;
        var score = 0;
        var goodCaught = 0;
        var spawnTimer = null;
        var rafId = 0;
        var lastTime = 0;
        var sceneRect = null;
        var basketX = 50;
        var basketPxX = 0;
        var drag = { active: false, id: -1, offsetX: 0, startX: 0, startY: 0, startTime: 0 };
        var itemId = 0;
        var items = [];

        mount.innerHTML =
          "<div class='harvest-game'>" +
          "<div class='chip mini-instruction harvest-help'>Swipe, drag basket, or use arrow keys</div>" +
          "<div class='harvest-hud'>" +
          "<span class='chip harvest-chip'>Score: <span data-score='1'>0</span></span>" +
          "<span class='chip harvest-chip'>Good: <span data-good='1'>0/" + TARGET_GOOD + "</span></span>" +
          "</div>" +
          "<div class='harvest-scene' tabindex='0' aria-label='Harvest scene'>" +
          "<div class='harvest-ground' aria-hidden='true'></div>" +
          "<div class='harvest-falls'></div>" +
          "<button type='button' class='harvest-basket' aria-label='Move basket'></button>" +
          "<div class='harvest-feedback'></div>" +
          "</div>" +
          "</div>";

        var scoreNode = mount.querySelector("[data-score='1']");
        var goodNode = mount.querySelector("[data-good='1']");
        var scene = mount.querySelector(".harvest-scene");
        var fallsLayer = mount.querySelector(".harvest-falls");
        var basketNode = mount.querySelector(".harvest-basket");
        var feedbackLayer = mount.querySelector(".harvest-feedback");
        registerControl(scene, { allowSwipeSkip: true });

        function updateHud() {
          scoreNode.textContent = String(score);
          goodNode.textContent = String(goodCaught) + "/" + String(TARGET_GOOD);
        }

        function refreshSceneRect() {
          sceneRect = scene.getBoundingClientRect();
        }

        function applyBasketPosition() {
          if (!sceneRect) {
            refreshSceneRect();
          }
          var width = sceneRect.width || 1;
          basketPxX = clamp((basketX / 100) * width, BASKET_WIDTH * 0.5, width - (BASKET_WIDTH * 0.5));
          basketNode.style.left = String(Math.round(basketPxX)) + "px";
        }

        function spawnFeedback(x, y, text, positive) {
          var node = document.createElement("span");
          node.className = "harvest-float" + (positive ? " is-positive" : " is-neutral");
          node.textContent = text;
          node.style.left = String(Math.round(x)) + "px";
          node.style.top = String(Math.round(y)) + "px";
          feedbackLayer.appendChild(node);
          node.addEventListener("animationend", function () {
            node.remove();
          });
        }

        function removeItem(item) {
          var index = items.indexOf(item);
          if (index >= 0) {
            items.splice(index, 1);
          }
          if (item.node && item.node.parentNode) {
            item.node.remove();
          }
        }

        function basketRect() {
          var left = basketPxX - (BASKET_WIDTH * 0.5);
          return {
            left: left,
            right: left + BASKET_WIDTH,
            top: (sceneRect.height || 0) - 54,
            bottom: (sceneRect.height || 0) - 8
          };
        }

        function intersects(a, b) {
          return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
        }

        function completeIfNeeded() {
          if (done || goodCaught < TARGET_GOOD) {
            return;
          }
          done = true;
          window.clearTimeout(spawnTimer);
          window.setTimeout(function () {
            complete();
          }, 260);
        }

        function catchItem(item) {
          var centerX = item.x;
          var centerY = item.y;
          score = Math.max(0, score + item.value);
          if (item.isGood) {
            goodCaught += 1;
          }
          basketNode.classList.remove("is-hit");
          basketNode.offsetWidth;
          basketNode.classList.add("is-hit");
          if (item.value > 0) {
            spawnFeedback(centerX, centerY, "+" + String(item.value), true);
          } else if (item.value < 0) {
            spawnFeedback(centerX, centerY, String(item.value), false);
          } else {
            spawnFeedback(centerX, centerY, "0", false);
          }
          removeItem(item);
          updateHud();
          completeIfNeeded();
        }

        function createItem() {
          if (done) {
            return;
          }
          if (!sceneRect) {
            refreshSceneRect();
          }
          var type = pickType();
          var node = document.createElement("span");
          node.className = "harvest-item " + type.className;
          node.setAttribute("aria-hidden", "true");
          fallsLayer.appendChild(node);

          var span = CANOPY_RIGHT - CANOPY_LEFT;
          var xPercent = CANOPY_LEFT + (Math.random() * span);
          var x = (xPercent / 100) * sceneRect.width;
          var item = {
            id: "item_" + String(itemId += 1),
            type: type.type,
            isGood: type.isGood,
            value: type.value,
            x: x,
            y: 18,
            size: 22,
            fallSpeed: randomBetween(SPEED_MIN, SPEED_MAX),
            node: node
          };
          node.style.left = String(Math.round(item.x)) + "px";
          node.style.top = "18px";
          items.push(item);
        }

        function scheduleSpawn() {
          if (done) {
            return;
          }
          var delay = Math.round(randomBetween(SPAWN_MIN_MS, SPAWN_MAX_MS));
          spawnTimer = window.setTimeout(function () {
            createItem();
            scheduleSpawn();
          }, delay);
        }

        function step(now) {
          if (done) {
            return;
          }
          if (!lastTime) {
            lastTime = now;
          }
          var dt = Math.min(0.05, (now - lastTime) / 1000);
          lastTime = now;
          var groundY = (sceneRect.height || 0) - 2;
          var box = basketRect();

          items.slice().forEach(function (item) {
            item.y += item.fallSpeed * dt;
            item.node.style.top = String(Math.round(item.y)) + "px";
            var r = {
              left: item.x - (item.size * 0.5),
              right: item.x + (item.size * 0.5),
              top: item.y - (item.size * 0.5),
              bottom: item.y + (item.size * 0.5)
            };
            if (intersects(r, box)) {
              catchItem(item);
              return;
            }
            if (item.y > groundY) {
              removeItem(item);
            }
          });

          rafId = window.requestAnimationFrame(step);
        }

        function toPercentX(clientX) {
          if (!sceneRect) {
            refreshSceneRect();
          }
          return ((clientX - sceneRect.left) / sceneRect.width) * 100;
        }

        function onResize() {
          refreshSceneRect();
          applyBasketPosition();
        }

        function onScenePointerDown(evt) {
          if (done) {
            return;
          }
          if (evt.pointerType === "mouse" && evt.button !== 0) {
            return;
          }
          refreshSceneRect();
          drag.active = true;
          drag.id = evt.pointerId;
          drag.offsetX = basketX - toPercentX(evt.clientX);
          drag.startX = evt.clientX;
          drag.startY = evt.clientY;
          drag.startTime = Date.now();
          if (typeof scene.setPointerCapture === "function") {
            try {
              scene.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore capture failures.
            }
          }
          evt.preventDefault();
        }

        function onScenePointerMove(evt) {
          if (!drag.active || drag.id !== evt.pointerId || done) {
            return;
          }
          basketX = clamp(toPercentX(evt.clientX) + drag.offsetX, 6, 94);
          applyBasketPosition();
          evt.preventDefault();
        }

        function resetDrag() {
          drag.active = false;
          drag.id = -1;
          drag.startX = 0;
          drag.startY = 0;
          drag.startTime = 0;
        }

        function onScenePointerUp(evt) {
          if (!drag.active || drag.id !== evt.pointerId) {
            return;
          }
          if (!done) {
            var direction = getHorizontalSwipeDirection({
              dx: evt.clientX - drag.startX,
              dy: evt.clientY - drag.startY,
              dt: Date.now() - drag.startTime
            });
            if (direction !== 0) {
              noteInteraction();
              basketX = clamp(basketX + (direction * SWIPE_STEP), 6, 94);
              applyBasketPosition();
            }
          }
          resetDrag();
        }

        function onScenePointerCancel(evt) {
          if (!drag.active || drag.id !== evt.pointerId) {
            return;
          }
          resetDrag();
        }

        function onKeyDown(evt) {
          if (done) {
            return;
          }
          if (evt.key === "ArrowLeft") {
            noteInteraction();
            basketX = clamp(basketX - 5, 6, 94);
            applyBasketPosition();
            evt.preventDefault();
          } else if (evt.key === "ArrowRight") {
            noteInteraction();
            basketX = clamp(basketX + 5, 6, 94);
            applyBasketPosition();
            evt.preventDefault();
          }
        }

        scene.addEventListener("pointerdown", onScenePointerDown);
        scene.addEventListener("pointermove", onScenePointerMove);
        scene.addEventListener("pointerup", onScenePointerUp);
        scene.addEventListener("pointercancel", onScenePointerCancel);
        scene.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);

        refreshSceneRect();
        applyBasketPosition();
        updateHud();
        createItem();
        scheduleSpawn();
        rafId = window.requestAnimationFrame(step);

        return function cleanup() {
          window.clearTimeout(spawnTimer);
          window.cancelAnimationFrame(rafId);
          window.removeEventListener("resize", onResize);
          scene.removeEventListener("pointerdown", onScenePointerDown);
          scene.removeEventListener("pointermove", onScenePointerMove);
          scene.removeEventListener("pointerup", onScenePointerUp);
          scene.removeEventListener("pointercancel", onScenePointerCancel);
          scene.removeEventListener("keydown", onKeyDown);
          items.slice().forEach(removeItem);
        };
      }
    };
  }

  var api = {
    TARGET_GOOD: TARGET_GOOD,
    ITEM_TYPES: ITEM_TYPES.slice(),
    getHorizontalSwipeDirection: getHorizontalSwipeDirection,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.HarvestMiniGame = api;
  }
}());
