(function () {
  "use strict";

  var GRID_SIZE = 4;
  var MEMORIZE_MS = 750;
  var PIT_FLASH_MS = 260;
  var MIN_START_GOAL_DISTANCE = 3;
  var TOTAL_TILES = GRID_SIZE * GRID_SIZE;
  var HINT_MEM = "Memorize the path";
  var HINT_PLAY = "Tap adjacent stones";
  var HINT_DONE = "Path crossed!";
  var NOOP = function () {};
  var TILE_HTML = "<button type='button' class='vanish-tile' aria-label='Step tile'><span class='vanish-marker'></span></button>";

  var BOARD_HTML = (function () {
    var html = "";
    var i = 0;
    for (i = 0; i < TOTAL_TILES; i += 1) {
      html += TILE_HTML;
    }
    return html;
  }());

  function tileKey(row, col) {
    return String(row) + ":" + String(col);
  }

  function toIndex(row, col) {
    return (row << 2) + col;
  }

  function isAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  function isAdjacentIndex(a, b) {
    return Math.abs((a >> 2) - (b >> 2)) + Math.abs((a & 3) - (b & 3)) === 1;
  }

  function randomInt(max, rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var limit = Math.max(1, Number(max) || 1);
    return Math.floor(random() * limit);
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
    var start = pickRandomPosition(random);
    var goal = pickRandomPosition(random);
    while (toIndex(start.row, start.col) === toIndex(goal.row, goal.col)) {
      goal = pickRandomPosition(random);
    }
    return {
      startPos: start,
      goalPos: goal
    };
  }

  function buildShortestPath(startPos, goalPos, rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var row = startPos.row;
    var col = startPos.col;
    var goalRow = goalPos.row;
    var goalCol = goalPos.col;
    var path = [{ row: row, col: col }];
    var preferRowStep = randomInt(2, random) === 0;

    while (row !== goalRow || col !== goalCol) {
      if (row !== goalRow && col !== goalCol) {
        if (preferRowStep) {
          row += row < goalRow ? 1 : -1;
        } else {
          col += col < goalCol ? 1 : -1;
        }
        preferRowStep = !preferRowStep;
      } else if (row !== goalRow) {
        row += row < goalRow ? 1 : -1;
      } else {
        col += col < goalCol ? 1 : -1;
      }
      path.push({ row: row, col: col });
    }
    return path;
  }

  function createRandomLayout(rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var attempt = 0;
    for (attempt = 0; attempt < 24; attempt += 1) {
      var picked = pickStartAndGoal(random);
      if (manhattanDistance(picked.startPos, picked.goalPos) >= MIN_START_GOAL_DISTANCE) {
        return {
          startPos: picked.startPos,
          goalPos: picked.goalPos,
          path: buildShortestPath(picked.startPos, picked.goalPos, random)
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
    var i = 0;
    for (i = 0; i < path.length; i += 1) {
      var node = path[i];
      lookup[tileKey(node.row, node.col)] = true;
    }
    return lookup;
  }

  function createMiniGamePlugin() {
    return {
      id: "vanish",
      title: "Vanishing Path",
      initialWeight: 1,
      mount: function (mount, engine) {
        var api = engine || {};
        var complete = typeof api.complete === "function" ? api.complete : NOOP;
        var registerControl = typeof api.registerControl === "function" ? api.registerControl : NOOP;
        var layout = createRandomLayout();
        var startPos = layout.startPos;
        var goalPos = layout.goalPos;
        var path = layout.path;
        var startIndex = toIndex(startPos.row, startPos.col);
        var goalIndex = toIndex(goalPos.row, goalPos.col);
        var safeTiles = new Uint8Array(TOTAL_TILES);
        var revealed = new Uint8Array(TOTAL_TILES);
        var avatarIndex = startIndex;
        var inMemorize = true;
        var done = false;
        var pitFlashIndex = -1;
        var memorizeTimer = 0;
        var flashTimer = 0;
        var i = 0;

        for (i = 0; i < path.length; i += 1) {
          var node = path[i];
          safeTiles[toIndex(node.row, node.col)] = 1;
        }
        revealed[startIndex] = 1;

        mount.innerHTML =
          "<div class='vanish-game'>" +
          "<div class='chip mini-instruction vanish-chip'>" + HINT_MEM + "</div>" +
          "<div class='vanish-scene'>" +
          "<div class='vanish-grid'>" +
          BOARD_HTML +
          "</div>" +
          "</div>" +
          "</div>";

        var grid = mount.querySelector(".vanish-grid");
        var hint = mount.querySelector(".vanish-chip");
        var tiles = Array.prototype.slice.call(mount.querySelectorAll(".vanish-tile"));
        registerControl(grid);

        for (i = 0; i < tiles.length; i += 1) {
          var tile = tiles[i];
          var marker = tile.querySelector(".vanish-marker");
          tile.__idx = i;
          if (i === startIndex) {
            tile.classList.add("is-start");
            marker.textContent = "S";
          } else if (i === goalIndex) {
            tile.classList.add("is-goal");
            marker.textContent = "G";
          } else {
            marker.textContent = "";
          }
        }

        function render() {
          var idx = 0;
          for (idx = 0; idx < tiles.length; idx += 1) {
            var tile = tiles[idx];
            tile.classList.toggle("is-safe-preview", inMemorize && !!safeTiles[idx]);
            tile.classList.toggle("is-revealed", !!revealed[idx]);
            tile.classList.toggle("is-avatar", avatarIndex === idx);
            tile.classList.toggle("is-pit-flash", pitFlashIndex === idx);
          }

          hint.textContent = done ? HINT_DONE : (inMemorize ? HINT_MEM : HINT_PLAY);
        }

        function onPointerDown(evt) {
          if (evt.target && evt.target.closest(".vanish-tile")) {
            evt.stopPropagation();
          }
        }

        function onClick(evt) {
          var tile = evt.target && evt.target.closest(".vanish-tile");
          if (!tile) {
            return;
          }
          evt.stopPropagation();
          if (done || inMemorize) {
            return;
          }

          var nextIndex = tile.__idx;
          if (!isAdjacentIndex(avatarIndex, nextIndex)) {
            return;
          }

          if (!safeTiles[nextIndex]) {
            pitFlashIndex = nextIndex;
            render();
            window.clearTimeout(flashTimer);
            flashTimer = window.setTimeout(function () {
              pitFlashIndex = -1;
              render();
            }, PIT_FLASH_MS);
            return;
          }

          avatarIndex = nextIndex;
          revealed[nextIndex] = 1;
          pitFlashIndex = -1;
          done = avatarIndex === goalIndex;
          render();

          if (done) {
            complete();
          }
        }

        grid.addEventListener("pointerdown", onPointerDown);
        grid.addEventListener("click", onClick);

        render();
        memorizeTimer = window.setTimeout(function () {
          inMemorize = false;
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
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.VanishingPathMiniGame = api;
  }
}());
