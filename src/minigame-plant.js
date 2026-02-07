(function () {
  "use strict";

  var PLANT_COUNT = 3;
  var REQUIRED_WATERINGS = 2;

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

  function createPlantWateringGame() {
    return {
      id: "plant",
      label: "Plant Watering",
      weight: 1,
      playable: true,
      render: function (mount, ctx) {
        var callbacks = ctx || {};
        var onSuccess = typeof callbacks.onSuccess === "function"
          ? callbacks.onSuccess
          : function () {};
        var states = createInitialPlantStates();
        var wateredCount = 0;
        var done = false;
        var drag = { active: false, id: -1, startX: 0, startY: 0, baseX: 0, baseY: 0, x: 0, y: 0 };

        mount.innerHTML =
          "<div class='plant-game'>" +
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
          "<div class='chip plant-chip'>Drag can to dry plants</div>" +
          "</div>";

        var slots = Array.prototype.slice.call(mount.querySelectorAll(".plant-slot"));
        var can = mount.querySelector(".watering-can");
        var spout = mount.querySelector(".can-spout");

        function renderPlants() {
          slots.forEach(function (slot, i) {
            var watered = Boolean(states[i]);
            slot.classList.toggle("is-watered", watered);
            slot.classList.toggle("is-dry", !watered);
            var marker = slot.querySelector(".plant-state");
            if (marker) {
              marker.textContent = watered ? "OK" : "!!";
            }
          });
        }

        function applyCanTransform() {
          can.style.transform = "translate(" + drag.x + "px, " + drag.y + "px)";
        }

        function resetCan() {
          drag.x = 0;
          drag.y = 0;
          drag.baseX = 0;
          drag.baseY = 0;
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
            var marker = slot.querySelector(".plant-state");
            var pot = slot.querySelector(".plant-pot");
            var markerRect = marker ? inflateRect(marker.getBoundingClientRect(), 12) : null;
            var potRect = pot ? inflateRect(pot.getBoundingClientRect(), 16) : null;
            for (p = 0; p < points.length; p += 1) {
              var point = points[p];
              var hitMarker = markerRect && pointInsideRect(point, markerRect);
              var hitPot = potRect && pointInsideRect(point, potRect);
              if (hitMarker || hitPot) {
                return i;
              }
            }
          }
          return -1;
        }

        function buildDropPoints(canRect, spoutRect) {
          var points = [];
          if (spoutRect) {
            points.push({
              x: spoutRect.right,
              y: spoutRect.top + (spoutRect.height * 0.5)
            });
          }
          points.push(
            {
              x: canRect.left + (canRect.width * 0.5),
              y: canRect.top + (canRect.height * 0.5)
            },
            {
              x: canRect.left + (canRect.width * 0.8),
              y: canRect.top + (canRect.height * 0.55)
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

          if (
            next.didWater &&
            !done &&
            wateredCount >= REQUIRED_WATERINGS &&
            countDryPlants(states) === 0
          ) {
            done = true;
            onSuccess();
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
              // Ignore pointer-capture errors.
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
    createInitialPlantStates: createInitialPlantStates,
    countDryPlants: countDryPlants,
    applyWatering: applyWatering,
    createPlantWateringGame: createPlantWateringGame
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.PlantWaterMiniGame = api;
  }
}());
