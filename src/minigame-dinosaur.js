(function () {
  "use strict";

  var REQUIRED_TAPS = 8;
  var MOVE_MIN_MS = 900;
  var MOVE_MAX_MS = 1500;
  var MOVE_RANGE_PX = 72;
  var POP_GLYPHS = ["*", "+", "\u2665"];
  var REWARD_GLYPHS = ["\u2665", "\ud83e\ude99"];

  function randomBetween(min, max, rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var a = Number(min) || 0;
    var b = Number(max) || 0;
    return a + (random() * (b - a));
  }

  function pickGlyph(list, rng) {
    var items = Array.isArray(list) && list.length ? list : ["*"];
    var random = typeof rng === "function" ? rng : Math.random;
    var index = Math.floor(random() * items.length) % items.length;
    return items[index];
  }

  function createDinosaurGame() {
    return {
      id: "dinosaur",
      label: "Dino Petting",
      weight: 1,
      allowSkip: false,
      playable: true,
      render: function (mount, ctx) {
        var callbacks = ctx || {};
        var onSuccess = typeof callbacks.onSuccess === "function"
          ? callbacks.onSuccess
          : function () {};

        var taps = 0;
        var completed = false;
        var moveTimer = null;
        var activeShift = 0;
        var suppressClickUntil = 0;

        mount.innerHTML =
          "<div class='dino-game'>" +
          "<div class='dino-scene'>" +
          "<span class='dino-flower f1'></span>" +
          "<span class='dino-flower f2'></span>" +
          "<button type='button' class='dinosaur' aria-label='Pet dinosaur'>" +
          "<span class='dino-tail'></span>" +
          "<span class='dino-body'></span>" +
          "<span class='dino-head'>" +
          "<span class='dino-eye'></span>" +
          "<span class='dino-cheek'></span>" +
          "</span>" +
          "<span class='dino-leg l1'></span>" +
          "<span class='dino-leg l2'></span>" +
          "</button>" +
          "<span class='dino-fence'></span>" +
          "</div>" +
          "<div class='chip dino-chip'>Pet taps: <span class='dino-count'>0/" + REQUIRED_TAPS + "</span></div>" +
          "</div>";

        var dino = mount.querySelector(".dinosaur");
        var scene = mount.querySelector(".dino-scene");
        var countNode = mount.querySelector(".dino-count");
        dino.style.touchAction = "none";

        function setShift(px) {
          activeShift = px;
          dino.style.setProperty("--dino-shift", String(px) + "px");
        }

        function setScale(scale) {
          dino.style.setProperty("--dino-scale", String(scale));
        }

        function scheduleMove() {
          if (completed) {
            return;
          }
          var delay = Math.round(randomBetween(MOVE_MIN_MS, MOVE_MAX_MS));
          moveTimer = window.setTimeout(function () {
            if (completed) {
              return;
            }
            setShift(Math.round(randomBetween(-MOVE_RANGE_PX, MOVE_RANGE_PX)));
            scheduleMove();
          }, delay);
        }

        function spawnPop(glyph) {
          var pop = document.createElement("span");
          pop.className = "dino-pop";
          pop.textContent = glyph;
          var x = 30 + Math.round(Math.random() * 40);
          var y = 30 + Math.round(Math.random() * 26);
          pop.style.setProperty("--spark-x", String(x) + "%");
          pop.style.setProperty("--spark-y", String(y) + "%");
          scene.appendChild(pop);
          pop.addEventListener("animationend", function () {
            pop.remove();
          });
        }

        function updateCounter() {
          countNode.textContent = String(taps) + "/" + String(REQUIRED_TAPS);
        }

        function completeGame() {
          if (completed) {
            return;
          }
          completed = true;
          window.clearTimeout(moveTimer);
          dino.disabled = true;
          setShift(0);
          setScale(1.07);
          spawnPop(pickGlyph(REWARD_GLYPHS));
          window.setTimeout(function () {
            onSuccess();
          }, 280);
        }

        function onPet() {
          if (completed) {
            return;
          }
          taps += 1;
          updateCounter();
          dino.classList.remove("is-tapped");
          dino.offsetWidth;
          dino.classList.add("is-tapped");
          spawnPop(pickGlyph(POP_GLYPHS));

          if (taps >= REQUIRED_TAPS) {
            completeGame();
          }
        }

        function onTapAnimationEnd() {
          dino.classList.remove("is-tapped");
        }

        function onPointerDown(evt) {
          if (!evt) {
            return;
          }
          if (evt.pointerType === "mouse" && evt.button !== 0) {
            return;
          }
          if (evt.cancelable) {
            evt.preventDefault();
          }
          suppressClickUntil = Date.now() + 450;
          onPet();
        }

        function onClick(evt) {
          if (Date.now() < suppressClickUntil) {
            if (evt && evt.cancelable) {
              evt.preventDefault();
            }
            return;
          }
          onPet();
        }

        function onDoubleClick(evt) {
          if (evt && evt.cancelable) {
            evt.preventDefault();
          }
        }

        dino.addEventListener("pointerdown", onPointerDown);
        dino.addEventListener("click", onClick);
        dino.addEventListener("dblclick", onDoubleClick);
        dino.addEventListener("animationend", onTapAnimationEnd);
        dino.addEventListener("transitionend", onTapAnimationEnd);
        updateCounter();
        setShift(activeShift);
        setScale(1);
        scheduleMove();

        return function cleanup() {
          window.clearTimeout(moveTimer);
          dino.removeEventListener("pointerdown", onPointerDown);
          dino.removeEventListener("click", onClick);
          dino.removeEventListener("dblclick", onDoubleClick);
          dino.removeEventListener("animationend", onTapAnimationEnd);
          dino.removeEventListener("transitionend", onTapAnimationEnd);
        };
      }
    };
  }

  var api = {
    REQUIRED_TAPS: REQUIRED_TAPS,
    createDinosaurGame: createDinosaurGame
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DinosaurMiniGame = api;
  }
}());
