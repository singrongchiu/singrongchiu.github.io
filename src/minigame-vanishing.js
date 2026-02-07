(function () {
  "use strict";

  var GRID_SIZE = 4;
  var MEMORIZE_MS = 1500;
  var PIT_FLASH_MS = 260;
  var MIN_START_GOAL_DISTANCE = 3;

  function tileKey(row, col) {
    return String(row) + ":" + String(col);
  }

  function isAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  function randomInt(max, rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var limit = Math.max(1, Number(max) || 1);
    return Math.floor(random() * limit) % limit;
  }

  function pickRandomPosition(rng) {
    return {
      row: randomInt(GRID_SIZE, rng),
      col: randomInt(GRID_SIZE, rng)
    };
  }

  function manhattanDistance(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  function pickStartAndGoal(rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var attempts = 0;
    var start = pickRandomPosition(random);
    var goal = pickRandomPosition(random);

    while (
      attempts < 40 &&
      (
        tileKey(start.row, start.col) === tileKey(goal.row, goal.col) ||
        manhattanDistance(start, goal) < MIN_START_GOAL_DISTANCE
      )
    ) {
      goal = pickRandomPosition(random);
      attempts += 1;
    }

    while (tileKey(start.row, start.col) === tileKey(goal.row, goal.col)) {
      goal = pickRandomPosition(random);
    }

    return {
      startPos: start,
      goalPos: goal
    };
  }

  function buildShortestPath(startPos, goalPos, rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var path = [{ row: startPos.row, col: startPos.col }];
    var row = startPos.row;
    var col = startPos.col;
    var preferRowStep = randomInt(2, random) === 0;

    while (row !== goalPos.row || col !== goalPos.col) {
      var canStepRow = row !== goalPos.row;
      var canStepCol = col !== goalPos.col;
      var stepRow = false;

      if (canStepRow && canStepCol) {
        stepRow = preferRowStep;
      } else {
        stepRow = canStepRow;
      }

      if (stepRow) {
        row += row < goalPos.row ? 1 : -1;
      } else {
        col += col < goalPos.col ? 1 : -1;
      }

      path.push({ row: row, col: col });

      if (canStepRow && canStepCol) {
        preferRowStep = !preferRowStep;
      }
    }

    return path;
  }

  function createRandomLayout(rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var attempt = 0;

    for (attempt = 0; attempt < 24; attempt += 1) {
      var picked = pickStartAndGoal(random);
      var path = buildShortestPath(picked.startPos, picked.goalPos, random);
      if (path.length >= MIN_START_GOAL_DISTANCE + 1) {
        return {
          startPos: picked.startPos,
          goalPos: picked.goalPos,
          path: path
        };
      }
    }

    var fallbackStart = { row: GRID_SIZE - 1, col: 0 };
    var fallbackGoal = { row: 0, col: GRID_SIZE - 1 };
    return {
      startPos: fallbackStart,
      goalPos: fallbackGoal,
      path: buildShortestPath(fallbackStart, fallbackGoal, random)
    };
  }

  function createSafeLookup(path) {
    var lookup = {};
    path.forEach(function (node) {
      lookup[tileKey(node.row, node.col)] = true;
    });
    return lookup;
  }

  function createBoardMarkup() {
    var html = "";
    var row = 0;
    var col = 0;

    for (row = 0; row < GRID_SIZE; row += 1) {
      for (col = 0; col < GRID_SIZE; col += 1) {
        html +=
          "<button type='button' class='vanish-tile' data-row='" + row + "' data-col='" + col + "' aria-label='Step tile'>" +
          "<span class='vanish-marker'></span>" +
          "</button>";
      }
    }
    return html;
  }

  function createVanishingPathGame() {
    return {
      id: "vanish",
      label: "Vanishing Path",
      weight: 1,
      playable: true,
      render: function (mount, ctx) {
        var callbacks = ctx || {};
        var onSuccess = typeof callbacks.onSuccess === "function"
          ? callbacks.onSuccess
          : function () {};
        var layout = createRandomLayout();
        var startPos = layout.startPos;
        var goalPos = layout.goalPos;
        var path = layout.path;
        var safeTiles = createSafeLookup(path);
        var revealedTiles = {};
        revealedTiles[tileKey(startPos.row, startPos.col)] = true;
        var avatar = { row: startPos.row, col: startPos.col };
        var phase = "memorize";
        var done = false;
        var pitFlashKey = "";
        var memorizeTimer = null;
        var flashTimer = null;

        mount.innerHTML =
          "<div class='vanish-game'>" +
          "<div class='vanish-scene'>" +
          "<div class='vanish-grid'>" +
          createBoardMarkup() +
          "</div>" +
          "</div>" +
          "<div class='chip vanish-chip'>Memorize the path</div>" +
          "</div>";

        var grid = mount.querySelector(".vanish-grid");
        var hint = mount.querySelector(".vanish-chip");
        var tiles = Array.prototype.slice.call(mount.querySelectorAll(".vanish-tile"));

        function render() {
          var avatarKey = tileKey(avatar.row, avatar.col);
          tiles.forEach(function (tile) {
            var row = Number(tile.getAttribute("data-row"));
            var col = Number(tile.getAttribute("data-col"));
            var key = tileKey(row, col);
            var isSafe = Boolean(safeTiles[key]);
            var marker = tile.querySelector(".vanish-marker");

            tile.classList.toggle("is-safe-preview", phase === "memorize" && isSafe);
            tile.classList.toggle("is-revealed", Boolean(revealedTiles[key]));
            tile.classList.toggle("is-avatar", avatarKey === key);
            tile.classList.toggle("is-start", row === startPos.row && col === startPos.col);
            tile.classList.toggle("is-goal", row === goalPos.row && col === goalPos.col);
            tile.classList.toggle("is-pit-flash", pitFlashKey === key);

            if (!marker) {
              return;
            }
            if (row === goalPos.row && col === goalPos.col) {
              marker.textContent = "G";
            } else if (row === startPos.row && col === startPos.col) {
              marker.textContent = "S";
            } else {
              marker.textContent = "";
            }
          });

          if (!hint) {
            return;
          }
          if (done) {
            hint.textContent = "Path crossed!";
          } else if (phase === "memorize") {
            hint.textContent = "Memorize the path";
          } else {
            hint.textContent = "Tap adjacent stones";
          }
        }

        function clearPitFlash() {
          pitFlashKey = "";
          render();
        }

        function onPointerDown(evt) {
          if (!evt.target || !evt.target.closest(".vanish-tile")) {
            return;
          }
          evt.stopPropagation();
        }

        function onClick(evt) {
          var tile = evt.target && evt.target.closest(".vanish-tile");
          if (!tile) {
            return;
          }
          evt.stopPropagation();
          if (done || phase === "memorize") {
            return;
          }

          var row = Number(tile.getAttribute("data-row"));
          var col = Number(tile.getAttribute("data-col"));
          var next = { row: row, col: col };

          if (!isAdjacent(avatar, next)) {
            return;
          }

          var key = tileKey(row, col);
          if (!safeTiles[key]) {
            pitFlashKey = key;
            render();
            window.clearTimeout(flashTimer);
            flashTimer = window.setTimeout(clearPitFlash, PIT_FLASH_MS);
            return;
          }

          avatar = next;
          revealedTiles[key] = true;
          clearPitFlash();

          if (avatar.row === goalPos.row && avatar.col === goalPos.col) {
            done = true;
            render();
            onSuccess();
            return;
          }
          render();
        }

        grid.addEventListener("pointerdown", onPointerDown);
        grid.addEventListener("click", onClick);

        render();
        memorizeTimer = window.setTimeout(function () {
          phase = "play";
          render();
        }, MEMORIZE_MS);

        return function cleanup() {
          window.clearTimeout(memorizeTimer);
          window.clearTimeout(flashTimer);
          grid.removeEventListener("pointerdown", onPointerDown);
          grid.removeEventListener("click", onClick);
        };
      }
    };
  }

  var api = {
    GRID_SIZE: GRID_SIZE,
    MEMORIZE_MS: MEMORIZE_MS,
    PIT_FLASH_MS: PIT_FLASH_MS,
    MIN_START_GOAL_DISTANCE: MIN_START_GOAL_DISTANCE,
    tileKey: tileKey,
    isAdjacent: isAdjacent,
    randomInt: randomInt,
    pickRandomPosition: pickRandomPosition,
    pickStartAndGoal: pickStartAndGoal,
    buildShortestPath: buildShortestPath,
    createRandomLayout: createRandomLayout,
    createSafeLookup: createSafeLookup,
    createVanishingPathGame: createVanishingPathGame
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.VanishingPathMiniGame = api;
  }
}());
