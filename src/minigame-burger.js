(function () {
  "use strict";

  var PATTI_COUNT = 3;

  function createInitialPattyStates() {
    return [false, false, false];
  }

  function countFlippedPatties(states) {
    var list = Array.isArray(states) ? states : [];
    return list.filter(function (isFlipped) {
      return Boolean(isFlipped);
    }).length;
  }

  function flipPatty(states, index) {
    var list = Array.isArray(states) ? states.slice(0, PATTI_COUNT) : createInitialPattyStates();
    var targetIndex = Number(index);
    while (list.length < PATTI_COUNT) {
      list.push(false);
    }
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= PATTI_COUNT) {
      return {
        didFlip: false,
        states: list,
        completed: countFlippedPatties(list) >= PATTI_COUNT
      };
    }
    if (list[targetIndex]) {
      return {
        didFlip: false,
        states: list,
        completed: countFlippedPatties(list) >= PATTI_COUNT
      };
    }

    var nextStates = list.slice();
    nextStates[targetIndex] = true;
    return {
      didFlip: true,
      states: nextStates,
      completed: countFlippedPatties(nextStates) >= PATTI_COUNT
    };
  }

  function createBurgerGame() {
    return {
      id: "burger",
      label: "Burger Flipping",
      weight: 1,
      playable: true,
      render: function (mount, ctx) {
        var callbacks = ctx || {};
        var onSuccess = typeof callbacks.onSuccess === "function"
          ? callbacks.onSuccess
          : function () {};
        var patties = createInitialPattyStates();
        var done = false;

        mount.innerHTML =
          "<div class='burger-game'>" +
          "<div class='grill-scene'>" +
          "<div class='grill-surface'></div>" +
          "<div class='burger-smoke-layer'></div>" +
          "<button type='button' class='patty-slot' data-patty='0' aria-label='Flip patty 1'>" +
          "<span class='patty-face'></span>" +
          "<span class='patty-mark'></span>" +
          "</button>" +
          "<button type='button' class='patty-slot' data-patty='1' aria-label='Flip patty 2'>" +
          "<span class='patty-face'></span>" +
          "<span class='patty-mark'></span>" +
          "</button>" +
          "<button type='button' class='patty-slot' data-patty='2' aria-label='Flip patty 3'>" +
          "<span class='patty-face'></span>" +
          "<span class='patty-mark'></span>" +
          "</button>" +
          "</div>" +
          "<div class='chip burger-chip'>Tap each patty once</div>" +
          "</div>";

        var grill = mount.querySelector(".grill-scene");
        var smokeLayer = mount.querySelector(".burger-smoke-layer");
        var slots = Array.prototype.slice.call(mount.querySelectorAll(".patty-slot"));

        function renderPatties() {
          slots.forEach(function (slot, i) {
            var flipped = Boolean(patties[i]);
            slot.classList.toggle("is-flipped", flipped);
            slot.classList.toggle("is-raw", !flipped);
          });
        }

        function spawnSmoke(slot) {
          if (!grill || !smokeLayer || !slot) {
            return;
          }
          var grillRect = grill.getBoundingClientRect();
          var slotRect = slot.getBoundingClientRect();
          var i = 0;
          for (i = 0; i < 4; i += 1) {
            var puff = document.createElement("span");
            var x = (slotRect.left - grillRect.left) + (slotRect.width * (0.3 + (Math.random() * 0.4)));
            var y = (slotRect.top - grillRect.top) + (slotRect.height * (0.18 + (Math.random() * 0.18)));
            puff.className = "burger-smoke";
            puff.style.left = x.toFixed(1) + "px";
            puff.style.top = y.toFixed(1) + "px";
            puff.style.setProperty("--sx", ((Math.random() - 0.5) * 18).toFixed(1) + "px");
            puff.style.setProperty("--sy", (-24 - (Math.random() * 26)).toFixed(1) + "px");
            puff.style.setProperty("--ss", (0.72 + (Math.random() * 0.5)).toFixed(2));
            smokeLayer.appendChild(puff);
            (function (node) {
              node.addEventListener("animationend", function () {
                node.remove();
              });
            }(puff));
          }
        }

        function onPointerDown(evt) {
          evt.stopPropagation();
        }

        function onClick(evt) {
          evt.stopPropagation();
          if (done) {
            return;
          }
          var targetIndex = Number(evt.currentTarget.getAttribute("data-patty"));
          var next = flipPatty(patties, targetIndex);
          if (!next.didFlip) {
            return;
          }
          patties = next.states;
          renderPatties();
          spawnSmoke(evt.currentTarget);
          if (next.completed) {
            done = true;
            onSuccess();
          }
        }

        slots.forEach(function (slot) {
          slot.addEventListener("pointerdown", onPointerDown);
          slot.addEventListener("click", onClick);
        });

        renderPatties();

        return function cleanup() {
          slots.forEach(function (slot) {
            slot.removeEventListener("pointerdown", onPointerDown);
            slot.removeEventListener("click", onClick);
          });
        };
      }
    };
  }

  var api = {
    PATTI_COUNT: PATTI_COUNT,
    createInitialPattyStates: createInitialPattyStates,
    countFlippedPatties: countFlippedPatties,
    flipPatty: flipPatty,
    createBurgerGame: createBurgerGame
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.BurgerMiniGame = api;
  }
}());
