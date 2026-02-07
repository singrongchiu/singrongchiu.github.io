(function () {
  "use strict";

  var PLANT_COUNT = 3;
  var REQUIRED_WATERINGS = 2;
  var PLANT_DROP_PADDING = 28;
  var POT_DROP_PADDING = 48;

  function computeCenteredCanOffset(canRect, currentDragX, targetRect) {
    if (!canRect || !targetRect) {
      return 0;
    }
    var canCenterX = Number(canRect.left) + (Number(canRect.width) * 0.5);
    var baseCanCenterX = canCenterX - (Number(currentDragX) || 0);
    var targetCenterX = Number(targetRect.left) + (Number(targetRect.width) * 0.5);
    if (!Number.isFinite(baseCanCenterX) || !Number.isFinite(targetCenterX)) {
      return 0;
    }
    return targetCenterX - baseCanCenterX;
  }

  function pickIndex(length, rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var n = Math.max(1, Number(length) || 1);
    return Math.floor(random() * n) % n;
  }

  function createInitialPlantStates(rng) {
    var states = [false, false, false];
    states[pickIndex(PLANT_COUNT, rng)] = true;
    return states;
  }

  function countDryPlants(states) {
    var list = Array.isArray(states) ? states : [];
    return list.filter(function (isWatered) {
      return !isWatered;
    }).length;
  }

  function applyWatering(states, index, successCount) {
    var list = Array.isArray(states) ? states.slice(0, PLANT_COUNT) : [false, false, false];
    var targetIndex = Number(index);
    var safeCount = Number(successCount) || 0;
    while (list.length < PLANT_COUNT) {
      list.push(false);
    }
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= PLANT_COUNT) {
      return {
        didWater: false,
        states: list,
        successCount: safeCount,
        completed: safeCount >= REQUIRED_WATERINGS && countDryPlants(list) === 0
      };
    }
    if (list[targetIndex]) {
      return {
        didWater: false,
        states: list,
        successCount: safeCount,
        completed: safeCount >= REQUIRED_WATERINGS && countDryPlants(list) === 0
      };
    }

    var nextStates = list.slice();
    nextStates[targetIndex] = true;
    var nextCount = safeCount + 1;
    return {
      didWater: true,
      states: nextStates,
      successCount: nextCount,
      completed: nextCount >= REQUIRED_WATERINGS && countDryPlants(nextStates) === 0
    };
  }

  function createMiniGamePlugin() {
    return {
      id: "plant",
      title: "Plant Watering",
      initialWeight: 1,
      timing: {
        roundMs: 15000
      },
      mount: function (mount, engine) {
        var api = engine || {};
        var complete = typeof api.complete === "function"
          ? api.complete
          : function () {};
        var registerControl = typeof api.registerControl === "function"
          ? api.registerControl
          : function () {};
        var states = createInitialPlantStates();
        var wateredCount = 0;
        var done = false;
        var drag = {
          active: false,
          id: -1,
          startX: 0,
          startY: 0,
          baseX: 0,
          baseY: 0,
          x: 0,
          y: 0,
          homeX: 0,
          homeY: 0
        };

        mount.innerHTML =
          "<div class='plant-game'>" +
          "<div class='chip mini-instruction plant-chip'>Drag can to dry plants</div>" +
          "<div class='garden-bed'>" +
          "<button type='button' class='plant-slot' data-plant='0' aria-label='Plant 1'>" +
          "<span class='plant-leaf leaf-a'></span>" +
          "<span class='plant-leaf leaf-b'></span>" +
          "<span class='plant-stem'></span>" +
          "<span class='plant-pot'></span>" +
          "<span class='plant-state'></span>" +
          "</button>" +
          "<button type='button' class='plant-slot' data-plant='1' aria-label='Plant 2'>" +
          "<span class='plant-leaf leaf-a'></span>" +
          "<span class='plant-leaf leaf-b'></span>" +
          "<span class='plant-stem'></span>" +
          "<span class='plant-pot'></span>" +
          "<span class='plant-state'></span>" +
          "</button>" +
          "<button type='button' class='plant-slot' data-plant='2' aria-label='Plant 3'>" +
          "<span class='plant-leaf leaf-a'></span>" +
          "<span class='plant-leaf leaf-b'></span>" +
          "<span class='plant-stem'></span>" +
          "<span class='plant-pot'></span>" +
          "<span class='plant-state'></span>" +
          "</button>" +
          "</div>" +
          "<div class='can-lane'>" +
          "<button type='button' class='watering-can' aria-label='Drag watering can'>" +
          "<span class='can-body'></span>" +
          "<span class='can-top'></span>" +
          "<span class='can-spout'></span>" +
          "<span class='can-handle'></span>" +
          "</button>" +
          "</div>" +
          "</div>";

        var slots = Array.from(mount.querySelectorAll(".plant-slot"));
        var can = mount.querySelector(".watering-can");
        var spout = mount.querySelector(".can-spout");
        registerControl(can);

        function renderPlants() {
          slots.forEach(function (slot, i) {
            var watered = Boolean(states[i]);
            slot.classList.toggle("is-watered", watered);
            slot.classList.toggle("is-dry", !watered);
            var marker = slot.querySelector(".plant-state");
            if (marker) {
              marker.textContent = watered ? "?" : "?";
            }
          });
        }

        function applyCanTransform() {
          can.style.transform = "translate(" + drag.x + "px, " + drag.y + "px)";
        }

        function centerTargetRect() {
          var centerIndex = Math.floor(slots.length * 0.5);
          var centerSlot = slots[centerIndex];
          if (!centerSlot) {
            return null;
          }
          var centerPot = centerSlot.querySelector(".plant-pot");
          if (centerPot && typeof centerPot.getBoundingClientRect === "function") {
            return centerPot.getBoundingClientRect();
          }
          if (typeof centerSlot.getBoundingClientRect === "function") {
            return centerSlot.getBoundingClientRect();
          }
          return null;
        }

        function updateCanHome() {
          var canRect = can.getBoundingClientRect();
          var targetRect = centerTargetRect();
          drag.homeX = computeCenteredCanOffset(canRect, drag.x, targetRect);
          drag.homeY = 0;
        }

        function resetCan() {
          updateCanHome();
          drag.x = drag.homeX;
          drag.y = drag.homeY;
          drag.baseX = drag.homeX;
          drag.baseY = drag.homeY;
          applyCanTransform();
        }

        function pointInsideRect(point, rect) {
          return (
            point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.top &&
            point.y <= rect.bottom
          );
        }

        function inflateRect(rect, padding) {
          return {
            left: rect.left - padding,
            right: rect.right + padding,
            top: rect.top - padding,
            bottom: rect.bottom + padding
          };
        }

        function findDroppedPlant(dropPoints) {
          var points = Array.isArray(dropPoints) ? dropPoints : [];
          var i = 0;
          var p = 0;
          for (i = 0; i < slots.length; i += 1) {
            var slot = slots[i];
            var leafA = slot.querySelector(".leaf-a");
            var leafB = slot.querySelector(".leaf-b");
            var stem = slot.querySelector(".plant-stem");
            var pot = slot.querySelector(".plant-pot");
            var leafARect = leafA ? inflateRect(leafA.getBoundingClientRect(), PLANT_DROP_PADDING) : null;
            var leafBRect = leafB ? inflateRect(leafB.getBoundingClientRect(), PLANT_DROP_PADDING) : null;
            var stemRect = stem ? inflateRect(stem.getBoundingClientRect(), PLANT_DROP_PADDING) : null;
            var potRect = pot ? inflateRect(pot.getBoundingClientRect(), POT_DROP_PADDING) : null;
            for (p = 0; p < points.length; p += 1) {
              var point = points[p];
              var hitLeafA = leafARect && pointInsideRect(point, leafARect);
              var hitLeafB = leafBRect && pointInsideRect(point, leafBRect);
              var hitStem = stemRect && pointInsideRect(point, stemRect);
              var hitPot = potRect && pointInsideRect(point, potRect);
              if (hitLeafA || hitLeafB || hitStem || hitPot) {
                return i;
              }
            }
          }
          return -1;
        }

        function buildDropPoints(canRect, spoutRect) {
          var points = [];
          if (spoutRect) {
            points.push(
              {
                x: spoutRect.right,
                y: spoutRect.top + (spoutRect.height * 0.5)
              },
              {
                x: spoutRect.right + 8,
                y: spoutRect.top + (spoutRect.height * 0.5)
              },
              {
                x: spoutRect.left + (spoutRect.width * 0.75),
                y: spoutRect.top + (spoutRect.height * 0.2)
              },
              {
                x: spoutRect.left + (spoutRect.width * 0.75),
                y: spoutRect.top + (spoutRect.height * 0.8)
              }
            );
          }
          points.push(
            {
              x: canRect.left + (canRect.width * 0.5),
              y: canRect.top + (canRect.height * 0.5)
            },
            {
              x: canRect.left + (canRect.width * 0.75),
              y: canRect.top + (canRect.height * 0.55)
            },
            {
              x: canRect.left + (canRect.width * 0.85),
              y: canRect.top + (canRect.height * 0.3)
            },
            {
              x: canRect.left + (canRect.width * 0.85),
              y: canRect.top + (canRect.height * 0.8)
            },
            {
              x: canRect.left + (canRect.width * 0.65),
              y: canRect.top + (canRect.height * 0.35)
            }
          );
          return points;
        }

        function finishDrop() {
          var canRect = can.getBoundingClientRect();
          var spoutRect = spout ? spout.getBoundingClientRect() : null;
          var dropPoints = buildDropPoints(canRect, spoutRect);
          var target = findDroppedPlant(dropPoints);
          if (target < 0 || done) {
            resetCan();
            return;
          }

          var next = applyWatering(states, target, wateredCount);
          states = next.states;
          wateredCount = next.successCount;
          renderPlants();
          resetCan();

          if (next.didWater && !done && next.completed) {
            done = true;
            complete();
          }
        }

        function onPointerDown(evt) {
          evt.stopPropagation();
          drag.active = true;
          drag.id = evt.pointerId;
          drag.startX = evt.clientX;
          drag.startY = evt.clientY;
          drag.baseX = drag.x;
          drag.baseY = drag.y;
          if (typeof can.setPointerCapture === "function") {
            try {
              can.setPointerCapture(evt.pointerId);
            } catch (err) {
            }
          }
        }

        function onPointerMove(evt) {
          if (!drag.active || drag.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          drag.x = drag.baseX + (evt.clientX - drag.startX);
          drag.y = drag.baseY + (evt.clientY - drag.startY);
          applyCanTransform();
        }

        function clearPointerState() {
          drag.active = false;
          drag.id = -1;
        }

        function onPointerUp(evt) {
          if (!drag.active || drag.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          clearPointerState();
          finishDrop();
        }

        function onPointerCancel(evt) {
          if (!drag.active || drag.id !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          clearPointerState();
          resetCan();
        }

        can.addEventListener("pointerdown", onPointerDown);
        can.addEventListener("pointermove", onPointerMove);
        can.addEventListener("pointerup", onPointerUp);
        can.addEventListener("pointercancel", onPointerCancel);
        can.addEventListener("lostpointercapture", onPointerCancel);
        renderPlants();
        resetCan();

        return function cleanup() {
          can.removeEventListener("pointerdown", onPointerDown);
          can.removeEventListener("pointermove", onPointerMove);
          can.removeEventListener("pointerup", onPointerUp);
          can.removeEventListener("pointercancel", onPointerCancel);
          can.removeEventListener("lostpointercapture", onPointerCancel);
        };
      }
    };
  }

  var api = {
    PLANT_COUNT: PLANT_COUNT,
    REQUIRED_WATERINGS: REQUIRED_WATERINGS,
    PLANT_DROP_PADDING: PLANT_DROP_PADDING,
    POT_DROP_PADDING: POT_DROP_PADDING,
    createInitialPlantStates: createInitialPlantStates,
    countDryPlants: countDryPlants,
    applyWatering: applyWatering,
    computeCenteredCanOffset: computeCenteredCanOffset,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.PlantWaterMiniGame = api;
  }
}());
