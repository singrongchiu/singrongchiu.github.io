(function () {
  "use strict";

  var WORD = "APPLOVIN";
  var MISSING_COUNT = 2;
  var WORD_BREAK_INDEX = 3;

  function randomFn(rng) {
    return typeof rng === "function" ? rng : Math.random;
  }

  function normalizeWord(word) {
    var text = String(word || WORD).trim().toUpperCase();
    if (!text) {
      return WORD;
    }
    return text;
  }

  function pickUniqueIndices(length, count, rng) {
    var size = Math.max(1, Math.floor(Number(length) || 0));
    var target = Math.max(0, Math.min(size, Math.floor(Number(count) || 0)));
    var random = randomFn(rng);
    var picked = [];
    var lookup = {};

    while (picked.length < target) {
      var index = Math.floor(random() * size) % size;
      if (!lookup[index]) {
        lookup[index] = true;
        picked.push(index);
      }
    }

    return picked.sort(function (a, b) {
      return a - b;
    });
  }

  function shuffleValues(values, rng) {
    var random = randomFn(rng);
    var list = Array.isArray(values) ? values.slice() : [];
    var i = 0;
    for (i = list.length - 1; i > 0; i -= 1) {
      var j = Math.floor(random() * (i + 1));
      var next = list[i];
      list[i] = list[j];
      list[j] = next;
    }
    return list;
  }

  function createRoundConfig(word, missingCount, rng) {
    var safeWord = normalizeWord(word);
    var answerLetters = safeWord.split("");
    var hiddenIndices = pickUniqueIndices(answerLetters.length, missingCount, rng);
    var slotLetters = answerLetters.slice();
    var tiles = [];

    hiddenIndices.forEach(function (index) {
      slotLetters[index] = null;
      tiles.push(answerLetters[index]);
    });

    return {
      word: safeWord,
      answerLetters: answerLetters,
      hiddenIndices: hiddenIndices,
      slotLetters: slotLetters,
      tiles: shuffleValues(tiles, rng)
    };
  }

  function isRoundComplete(slotLetters) {
    var slots = Array.isArray(slotLetters) ? slotLetters : [];
    return slots.every(function (value) {
      return typeof value === "string" && value.length > 0;
    });
  }

  function applyPlacement(answerLetters, slotLetters, tiles, tileUsed, slotIndex, tileIndex) {
    var answers = Array.isArray(answerLetters) ? answerLetters.slice() : [];
    var slots = Array.isArray(slotLetters) ? slotLetters.slice() : [];
    var tilePool = Array.isArray(tiles) ? tiles.slice() : [];
    var used = Array.isArray(tileUsed) ? tileUsed.slice() : [];
    var safeSlotIndex = Number(slotIndex);
    var safeTileIndex = Number(tileIndex);

    while (slots.length < answers.length) {
      slots.push(null);
    }
    while (used.length < tilePool.length) {
      used.push(false);
    }

    if (!Number.isInteger(safeSlotIndex) || safeSlotIndex < 0 || safeSlotIndex >= answers.length) {
      return {
        didPlace: false,
        slotLetters: slots,
        tileUsed: used,
        completed: isRoundComplete(slots)
      };
    }
    if (!Number.isInteger(safeTileIndex) || safeTileIndex < 0 || safeTileIndex >= tilePool.length) {
      return {
        didPlace: false,
        slotLetters: slots,
        tileUsed: used,
        completed: isRoundComplete(slots)
      };
    }
    if (used[safeTileIndex]) {
      return {
        didPlace: false,
        slotLetters: slots,
        tileUsed: used,
        completed: isRoundComplete(slots)
      };
    }
    if (typeof slots[safeSlotIndex] === "string" && slots[safeSlotIndex].length > 0) {
      return {
        didPlace: false,
        slotLetters: slots,
        tileUsed: used,
        completed: isRoundComplete(slots)
      };
    }
    if (tilePool[safeTileIndex] !== answers[safeSlotIndex]) {
      return {
        didPlace: false,
        slotLetters: slots,
        tileUsed: used,
        completed: isRoundComplete(slots)
      };
    }

    slots[safeSlotIndex] = tilePool[safeTileIndex];
    used[safeTileIndex] = true;
    return {
      didPlace: true,
      slotLetters: slots,
      tileUsed: used,
      completed: isRoundComplete(slots)
    };
  }

  function createSlotMarkup(value, index) {
    var breakClass = index === WORD_BREAK_INDEX ? " is-word-start" : "";
    if (typeof value === "string" && value.length > 0) {
      return (
        "<button type='button' class='letterfill-slot is-fixed" + breakClass + "' data-slot='" + index + "' " +
        "aria-label='Letter slot " + String(index + 1) + "' disabled>" +
        value +
        "</button>"
      );
    }
    return (
      "<button type='button' class='letterfill-slot is-missing" + breakClass + "' data-slot='" + index + "' " +
      "aria-label='Blank letter slot " + String(index + 1) + "'>?</button>"
    );
  }

  function createSlotsMarkup(slotLetters) {
    var html = "";
    var i = 0;
    for (i = 0; i < slotLetters.length; i += 1) {
      html += createSlotMarkup(slotLetters[i], i);
    }
    return "<div class='letterfill-row'>" + html + "</div>";
  }

  function createTilesMarkup(tiles) {
    var html = "";
    var i = 0;
    for (i = 0; i < tiles.length; i += 1) {
      html +=
        "<button type='button' class='letterfill-tile' data-tile='" + i + "' " +
        "aria-label='Letter tile " + tiles[i] + "'>" +
        tiles[i] +
        "</button>";
    }
    return html;
  }

  function createMiniGamePlugin() {
    return {
      id: "letterfill",
      title: "Letter Filling",
      initialWeight: 1,
      timing: {
        roundMs: 12000
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
        var timers = [];
        var drag = {
          active: false,
          pointerId: -1,
          tileIndex: -1
        };
        var dragGhost = null;
        var round = createRoundConfig(WORD, MISSING_COUNT);
        var slotLetters = round.slotLetters.slice();
        var tileUsed = round.tiles.map(function () {
          return false;
        });

        mount.innerHTML =
          "<div class='letterfill-game'>" +
          "<div class='chip mini-instruction letterfill-chip'>Drag each letter tile into the matching blank</div>" +
          "<div class='letterfill-board'>" +
          createSlotsMarkup(slotLetters) +
          "</div>" +
          "<div class='letterfill-tiles'>" +
          createTilesMarkup(round.tiles) +
          "</div>" +
          "</div>";

        var chip = mount.querySelector(".letterfill-chip");
        var board = mount.querySelector(".letterfill-board");
        var tileLane = mount.querySelector(".letterfill-tiles");
        var slots = Array.prototype.slice.call(mount.querySelectorAll(".letterfill-slot"));
        var tiles = Array.prototype.slice.call(mount.querySelectorAll(".letterfill-tile"));

        registerControl(board);
        registerControl(tileLane);
        slots.forEach(function (slot) {
          registerControl(slot);
        });
        tiles.forEach(function (tile) {
          registerControl(tile);
        });

        function setChip(text) {
          if (chip) {
            chip.textContent = String(text || "");
          }
        }

        function rememberTimer(timerId) {
          timers.push(timerId);
        }

        function pulseInvalid(node) {
          if (!node) {
            return;
          }
          node.classList.add("is-invalid");
          rememberTimer(window.setTimeout(function () {
            node.classList.remove("is-invalid");
          }, 180));
        }

        function createDragGhost(letter) {
          if (dragGhost) {
            dragGhost.remove();
          }
          dragGhost = document.createElement("div");
          dragGhost.className = "letterfill-drag-ghost";
          dragGhost.textContent = String(letter || "");
          document.body.appendChild(dragGhost);
        }

        function updateDragGhost(clientX, clientY) {
          if (!dragGhost) {
            return;
          }
          dragGhost.style.left = Number(clientX).toFixed(2) + "px";
          dragGhost.style.top = Number(clientY).toFixed(2) + "px";
        }

        function clearDragGhost() {
          if (!dragGhost) {
            return;
          }
          dragGhost.remove();
          dragGhost = null;
        }

        function tileForIndex(tileIndex) {
          if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= tiles.length) {
            return null;
          }
          return tiles[tileIndex];
        }

        function pointInsideRect(clientX, clientY, rect, padding) {
          var pad = Number(padding) || 0;
          return (
            clientX >= rect.left - pad &&
            clientX <= rect.right + pad &&
            clientY >= rect.top - pad &&
            clientY <= rect.bottom + pad
          );
        }

        function findSlotAtPoint(clientX, clientY) {
          var i = 0;
          for (i = 0; i < slots.length; i += 1) {
            var slotNode = slots[i];
            var slotIndex = Number(slotNode.getAttribute("data-slot"));
            if (
              !Number.isInteger(slotIndex) ||
              typeof slotLetters[slotIndex] === "string" && slotLetters[slotIndex].length > 0
            ) {
              continue;
            }
            var rect = slotNode.getBoundingClientRect();
            if (pointInsideRect(clientX, clientY, rect, 10)) {
              return slotIndex;
            }
          }
          return -1;
        }

        function renderSlots() {
          slots.forEach(function (slotNode, slotIndex) {
            var value = slotLetters[slotIndex];
            var isMissing = round.hiddenIndices.indexOf(slotIndex) >= 0;
            var isFilledMissing = isMissing && typeof value === "string" && value.length > 0;
            if (isFilledMissing) {
              slotNode.textContent = value;
              slotNode.classList.add("is-filled");
              slotNode.classList.remove("is-missing");
            } else if (isMissing) {
              slotNode.textContent = "?";
              slotNode.classList.add("is-missing");
              slotNode.classList.remove("is-filled");
            } else {
              slotNode.textContent = value;
            }
          });
        }

        function renderTiles() {
          tiles.forEach(function (tileNode, tileIndex) {
            var used = Boolean(tileUsed[tileIndex]);
            tileNode.classList.toggle("is-used", used);
            tileNode.classList.toggle("is-dragging", drag.active && drag.tileIndex === tileIndex);
            tileNode.disabled = used;
          });
        }

        function render() {
          renderSlots();
          renderTiles();
        }

        function stopDrag() {
          drag.active = false;
          drag.pointerId = -1;
          drag.tileIndex = -1;
          clearDragGhost();
          renderTiles();
        }

        function onTilePointerDown(evt) {
          if (done) {
            return;
          }
          evt.stopPropagation();
          evt.preventDefault();
          noteInteraction();
          var tileIndex = Number(evt.currentTarget.getAttribute("data-tile"));
          if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= tiles.length) {
            return;
          }
          if (tileUsed[tileIndex]) {
            return;
          }
          drag.active = true;
          drag.pointerId = evt.pointerId;
          drag.tileIndex = tileIndex;
          if (typeof evt.currentTarget.setPointerCapture === "function") {
            try {
              evt.currentTarget.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore pointer-capture failures.
            }
          }
          createDragGhost(round.tiles[tileIndex]);
          updateDragGhost(evt.clientX, evt.clientY);
          renderTiles();
        }

        function onTilePointerMove(evt) {
          if (!drag.active || drag.pointerId !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          evt.preventDefault();
          updateDragGhost(evt.clientX, evt.clientY);
        }

        function onTilePointerUp(evt) {
          if (!drag.active || drag.pointerId !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          evt.preventDefault();
          noteInteraction();
          var droppedSlotIndex = findSlotAtPoint(evt.clientX, evt.clientY);

          var next = applyPlacement(
            round.answerLetters,
            slotLetters,
            round.tiles,
            tileUsed,
            droppedSlotIndex,
            drag.tileIndex
          );
          slotLetters = next.slotLetters;
          tileUsed = next.tileUsed;

          if (!next.didPlace) {
            var slotNode = droppedSlotIndex >= 0 ? slots[droppedSlotIndex] : null;
            pulseInvalid(slotNode || tileForIndex(drag.tileIndex));
            setChip("Drop a tile onto the correct blank");
            stopDrag();
            return;
          }

          stopDrag();
          render();

          if (next.completed) {
            done = true;
            setChip("APPLOVIN complete!");
            rememberTimer(window.setTimeout(function () {
              complete();
            }, 120));
          } else {
            setChip("Nice! Fill the last blank");
          }
        }

        function onTilePointerCancel(evt) {
          if (!drag.active || drag.pointerId !== evt.pointerId) {
            return;
          }
          evt.stopPropagation();
          evt.preventDefault();
          stopDrag();
        }

        tiles.forEach(function (tileNode) {
          tileNode.addEventListener("pointerdown", onTilePointerDown);
          tileNode.addEventListener("pointermove", onTilePointerMove);
          tileNode.addEventListener("pointerup", onTilePointerUp);
          tileNode.addEventListener("pointercancel", onTilePointerCancel);
          tileNode.addEventListener("lostpointercapture", onTilePointerCancel);
        });

        render();

        return function cleanup() {
          stopDrag();
          timers.forEach(function (timerId) {
            window.clearTimeout(timerId);
          });
          timers = [];
          tiles.forEach(function (tileNode) {
            tileNode.removeEventListener("pointerdown", onTilePointerDown);
            tileNode.removeEventListener("pointermove", onTilePointerMove);
            tileNode.removeEventListener("pointerup", onTilePointerUp);
            tileNode.removeEventListener("pointercancel", onTilePointerCancel);
            tileNode.removeEventListener("lostpointercapture", onTilePointerCancel);
          });
        };
      }
    };
  }

  var api = {
    WORD: WORD,
    MISSING_COUNT: MISSING_COUNT,
    pickUniqueIndices: pickUniqueIndices,
    createRoundConfig: createRoundConfig,
    isRoundComplete: isRoundComplete,
    applyPlacement: applyPlacement,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.LetterFillingMiniGame = api;
  }
}());
