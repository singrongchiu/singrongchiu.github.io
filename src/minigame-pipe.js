(function () {
  "use strict";

  var BOARD_SIZE = 3;
  var ORIENTATION_COUNT = 4;
  var DIR_BITS = [1, 2, 4, 8]; // up, right, down, left
  var DIR_STEPS = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1]
  ];
  var OPPOSITE_DIR = [2, 3, 0, 1];
  // Base orientation is up+left, rotating clockwise by 90 degrees per step.
  var ORIENTATION_MASKS = [
    DIR_BITS[0] | DIR_BITS[3],
    DIR_BITS[0] | DIR_BITS[1],
    DIR_BITS[1] | DIR_BITS[2],
    DIR_BITS[2] | DIR_BITS[3]
  ];
  var SOLVED_ORIENTATIONS = [
    [2, 3, 0],
    [1, 1, 3],
    [0, 2, 0]
  ];
  var START_OFFSETS = [
    [1, 3, 2],
    [1, 0, 2],
    [3, 1, 2]
  ];

  function normalizeOrientation(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return 0;
    }
    var rounded = Math.round(n) % ORIENTATION_COUNT;
    return rounded < 0 ? rounded + ORIENTATION_COUNT : rounded;
  }

  function rotateClockwise(orientation) {
    return normalizeOrientation(orientation + 1);
  }

  function copyGrid(grid) {
    return grid.map(function (row) {
      return row.slice();
    });
  }

  function createInitialOrientations() {
    var board = copyGrid(SOLVED_ORIENTATIONS);
    var r = 0;
    var c = 0;
    for (r = 0; r < BOARD_SIZE; r += 1) {
      for (c = 0; c < BOARD_SIZE; c += 1) {
        board[r][c] = normalizeOrientation(board[r][c] + START_OFFSETS[r][c]);
      }
    }
    return board;
  }

  function inBounds(row, col) {
    return (
      row >= 0 &&
      row < BOARD_SIZE &&
      col >= 0 &&
      col < BOARD_SIZE
    );
  }

  function getOrientationMask(orientation) {
    return ORIENTATION_MASKS[normalizeOrientation(orientation)];
  }

  function computeReachable(orientations) {
    var visited = [
      [false, false, false],
      [false, false, false],
      [false, false, false]
    ];
    var queue = [{ row: 0, col: 0 }];
    var head = 0;

    visited[0][0] = true;

    while (head < queue.length) {
      var node = queue[head];
      head += 1;

      var row = node.row;
      var col = node.col;
      var mask = getOrientationMask(orientations[row][col]);
      var dirIndex = 0;

      for (dirIndex = 0; dirIndex < DIR_STEPS.length; dirIndex += 1) {
        if ((mask & DIR_BITS[dirIndex]) === 0) {
          continue;
        }

        var nextRow = row + DIR_STEPS[dirIndex][0];
        var nextCol = col + DIR_STEPS[dirIndex][1];
        if (!inBounds(nextRow, nextCol)) {
          continue;
        }

        var nextMask = getOrientationMask(orientations[nextRow][nextCol]);
        var oppositeBit = DIR_BITS[OPPOSITE_DIR[dirIndex]];
        if ((nextMask & oppositeBit) === 0) {
          continue;
        }

        if (!visited[nextRow][nextCol]) {
          visited[nextRow][nextCol] = true;
          queue.push({ row: nextRow, col: nextCol });
        }
      }
    }

    return visited;
  }

  function hasPathToGoal(orientations) {
    var reachable = computeReachable(orientations);
    var goalMask = getOrientationMask(orientations[BOARD_SIZE - 1][BOARD_SIZE - 1]);
    var hasDrainOutlet = Boolean(goalMask & (DIR_BITS[1] | DIR_BITS[2]));
    return Boolean(reachable[BOARD_SIZE - 1][BOARD_SIZE - 1]) && hasDrainOutlet;
  }

  function createBoardMarkup() {
    var html = "";
    var row = 0;
    var col = 0;
    for (row = 0; row < BOARD_SIZE; row += 1) {
      for (col = 0; col < BOARD_SIZE; col += 1) {
        html +=
          "<button type='button' class='pipe-tile' data-row='" + row + "' data-col='" + col + "' aria-label='Rotate pipe'>" +
          "<span class='pipe-bend'></span>" +
          "</button>";
      }
    }
    return html;
  }

  function createPipeTurningGame() {
    return {
      id: "pipe",
      label: "Pipe Grid",
      weight: 1,
      playable: true,
      render: function (mount, ctx) {
        var callbacks = ctx || {};
        var onSuccess = typeof callbacks.onSuccess === "function"
          ? callbacks.onSuccess
          : function () {};
        var done = false;
        var orientations = createInitialOrientations();

        mount.innerHTML =
          "<div class='pipe-game'>" +
          "<div class='pipe-stage'>" +
          "<div class='pipe-source' aria-hidden='true'>🚰</div>" +
          "<div class='pipe-drain' aria-hidden='true'>🕳️</div>" +
          "<div class='pipe-board'>" +
          createBoardMarkup() +
          "</div>" +
          "</div>" +
          "<div class='chip pipe-chip'>Tap pipes to connect water</div>" +
          "</div>";

        var boardNode = mount.querySelector(".pipe-board");
        var hintNode = mount.querySelector(".pipe-chip");
        var tiles = Array.prototype.slice.call(mount.querySelectorAll(".pipe-tile"));

        function renderBoard() {
          var reachable = computeReachable(orientations);
          var goalMask = getOrientationMask(orientations[BOARD_SIZE - 1][BOARD_SIZE - 1]);
          var goalReachable = Boolean(reachable[BOARD_SIZE - 1][BOARD_SIZE - 1]);
          var hasDrainOutlet = Boolean(goalMask & (DIR_BITS[1] | DIR_BITS[2]));
          var connected = goalReachable && hasDrainOutlet;

          tiles.forEach(function (tile) {
            var row = Number(tile.getAttribute("data-row"));
            var col = Number(tile.getAttribute("data-col"));
            var orientation = orientations[row][col];
            tile.style.setProperty("--pipe-rot", String(orientation * 90) + "deg");
            tile.classList.toggle("is-flow", Boolean(reachable[row][col]));
            tile.setAttribute(
              "aria-label",
              "Rotate pipe row " + (row + 1) + " column " + (col + 1) + " (" + (orientation * 90) + " degrees)"
            );
          });

          if (hintNode) {
            if (connected) {
              hintNode.textContent = "Water connected!";
            } else if (goalReachable && !hasDrainOutlet) {
              hintNode.textContent = "Turn goal pipe right or down";
            } else {
              hintNode.textContent = "Tap pipes to connect water";
            }
          }
          return connected;
        }

        function onPointerDown(evt) {
          if (!evt.target || !evt.target.closest(".pipe-tile")) {
            return;
          }
          evt.stopPropagation();
        }

        function onClick(evt) {
          var tile = evt.target && evt.target.closest(".pipe-tile");
          if (!tile) {
            return;
          }
          evt.stopPropagation();
          if (done) {
            return;
          }

          var row = Number(tile.getAttribute("data-row"));
          var col = Number(tile.getAttribute("data-col"));
          orientations[row][col] = rotateClockwise(orientations[row][col]);

          if (renderBoard()) {
            done = true;
            onSuccess();
          }
        }

        boardNode.addEventListener("pointerdown", onPointerDown);
        boardNode.addEventListener("click", onClick);
        renderBoard();

        return function cleanup() {
          boardNode.removeEventListener("pointerdown", onPointerDown);
          boardNode.removeEventListener("click", onClick);
        };
      }
    };
  }

  var api = {
    BOARD_SIZE: BOARD_SIZE,
    ORIENTATION_COUNT: ORIENTATION_COUNT,
    ORIENTATION_MASKS: ORIENTATION_MASKS.slice(),
    SOLVED_ORIENTATIONS: copyGrid(SOLVED_ORIENTATIONS),
    START_OFFSETS: copyGrid(START_OFFSETS),
    normalizeOrientation: normalizeOrientation,
    rotateClockwise: rotateClockwise,
    createInitialOrientations: createInitialOrientations,
    computeReachable: computeReachable,
    hasPathToGoal: hasPathToGoal,
    createPipeTurningGame: createPipeTurningGame
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.PipeTurningMiniGame = api;
  }
}());
