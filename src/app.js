(function () {
  "use strict";

  var core = window.FrameworkCore || {};
  var registry = Array.isArray(window.MiniGames) ? window.MiniGames.slice() : [];
  var chooseNext = core.chooseNext;
  var updateWeight = core.updateWeight;
  var createSessionClock = core.createSessionClock;
  var clamp = core.clamp;

  var ROUND_MS = 7000;
  var SESSION_SECONDS = 90;
  var WEIGHT_CFG = { min: 0.3, max: 3, upFactor: 1.15, downFactor: 0.85 };
  var BG_START_1 = [215, 239, 193];
  var BG_END_1 = [255, 132, 138];
  var BG_START_2 = [183, 223, 157];
  var BG_END_2 = [235, 76, 90];

  var el = {
    timer: document.getElementById("timer"),
    score: document.getElementById("score"),
    status: document.getElementById("status"),
    card: document.getElementById("card"),
    feedback: document.getElementById("feedback"),
    confetti: document.getElementById("confetti")
  };

  var fallback = {
    id: "empty",
    label: "Framework Shell",
    weight: 1,
    playable: false,
    render: function (mount) {
      mount.innerHTML =
        "<div>" +
        "<div class='placeholder-icon'>🎮</div>" +
        "<div class='hint'>No mini-games are wired yet.<br>Swipe up to cycle cards.</div>" +
        "<div class='chip'>Framework-only mode</div>" +
        "</div>";
    }
  };

  var state = {
    running: false,
    score: 0,
    clock: null,
    tickTimer: null,
    roundTimer: null,
    lastId: null,
    current: null,
    cleanup: null,
    weights: {}
  };

  var swipe = { active: false, x: 0, y: 0, t: 0, id: -1 };

  function safeGames() {
    return registry.length ? registry : [fallback];
  }

  function resetWeights() {
    state.weights = {};
    safeGames().forEach(function (game) {
      state.weights[game.id] = clamp(game.weight || 1, WEIGHT_CFG.min, WEIGHT_CFG.max);
    });
  }

  function updateHud() {
    el.score.textContent = String(state.score);
    if (!state.clock) {
      el.timer.textContent = String(SESSION_SECONDS);
      updateBackgroundTone();
      return;
    }
    var remaining = state.clock.getRemaining();
    el.timer.textContent = String(Math.max(0, Math.ceil(remaining)));
    updateBackgroundTone();
  }

  function channelHex(value) {
    var clamped = clamp(Math.round(value), 0, 255);
    var hex = clamped.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }

  function mixHex(startRgb, endRgb, amount) {
    var t = clamp(amount, 0, 1);
    var r = startRgb[0] + ((endRgb[0] - startRgb[0]) * t);
    var g = startRgb[1] + ((endRgb[1] - startRgb[1]) * t);
    var b = startRgb[2] + ((endRgb[2] - startRgb[2]) * t);
    return "#" + channelHex(r) + channelHex(g) + channelHex(b);
  }

  function updateBackgroundTone() {
    var root = document.documentElement;
    var elapsed = 0;
    if (state.clock) {
      elapsed = clamp(1 - (state.clock.getRemaining() / SESSION_SECONDS), 0, 1);
    }
    var warm = elapsed * elapsed * elapsed;
    root.style.setProperty("--bg1", mixHex(BG_START_1, BG_END_1, elapsed * 0.82));
    root.style.setProperty("--bg2", mixHex(BG_START_2, BG_END_2, elapsed));
    root.style.setProperty("--bg-warn-alpha", (warm * 0.96).toFixed(3));
    root.style.setProperty("--bg-warn-alpha-soft", (warm * 0.62).toFixed(3));
  }

  function clearCard() {
    if (typeof state.cleanup === "function") {
      state.cleanup();
    }
    state.cleanup = null;
    el.card.innerHTML = "";
  }

  function showCorrect() {
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = "Correct!";
    el.feedback.appendChild(toast);
    window.setTimeout(function () {
      toast.remove();
    }, 760);
  }

  function burstConfetti() {
    var colors = ["#f94", "#f66", "#3aa1ff", "#7dce5a", "#ffd739"];
    var i = 0;
    for (i = 0; i < 14; i += 1) {
      var node = document.createElement("span");
      var x = (48 + Math.random() * 4) + "%";
      var y = "22%";
      var dx = ((Math.random() - 0.5) * 220) + "px";
      var dy = (50 + Math.random() * 180) + "px";
      node.className = "confetti";
      node.style.background = colors[i % colors.length];
      node.style.setProperty("--x", x);
      node.style.setProperty("--y", y);
      node.style.setProperty("--dx", dx);
      node.style.setProperty("--dy", dy);
      el.confetti.appendChild(node);
      node.addEventListener("animationend", function () {
        node.remove();
      });
    }
  }

  function renderCard(game) {
    clearCard();
    el.card.classList.remove("enter");
    var head = document.createElement("div");
    head.className = "card-head";
    head.textContent = game.label || "Mini-game";

    var body = document.createElement("div");
    body.className = "card-body";

    var foot = document.createElement("div");
    foot.className = "hint";
    foot.textContent = "Swipe up anytime to skip";

    el.card.appendChild(head);
    el.card.appendChild(body);
    el.card.appendChild(foot);
    void el.card.offsetWidth;
    el.card.classList.add("enter");

    if (typeof game.render === "function") {
      state.cleanup = game.render(body, {
        onSuccess: function () {
          handleMiniGameSuccess(game.id);
        },
        showCorrect: showCorrect,
        burstConfetti: burstConfetti
      });
    }
  }

  function handleMiniGameSuccess(id) {
    if (!state.running || !state.current || state.current.id !== id) {
      return;
    }
    state.weights[id] = updateWeight(state.weights[id], "success", WEIGHT_CFG);
    state.score += 1;
    updateHud();
    showCorrect();
    burstConfetti();
    if (typeof state.current.onSuccess === "function") {
      state.current.onSuccess({ score: state.score });
    }
    window.setTimeout(function () {
      if (state.running && state.current && state.current.id === id) {
        nextCard("success");
      }
    }, 700);
  }

  function nextCard(reason) {
    if (!state.running) {
      return;
    }
    if (state.clock && state.clock.isExpired()) {
      endSession("timeup");
      return;
    }

    window.clearTimeout(state.roundTimer);
    if (reason === "skip" && state.current) {
      state.weights[state.current.id] = updateWeight(
        state.weights[state.current.id],
        "skip",
        WEIGHT_CFG
      );
      if (typeof state.current.onSkip === "function") {
        state.current.onSkip({ reason: reason });
      }
    }

    var pool = safeGames().map(function (game) {
      return {
        id: game.id,
        weight: state.weights[game.id]
      };
    });
    var picked = chooseNext(pool, state.lastId);
    if (!picked) {
      endSession("empty");
      return;
    }

    var game = safeGames().find(function (item) {
      return item.id === picked.id;
    });

    state.current = game;
    state.lastId = game.id;
    renderCard(game);
    el.status.textContent = "Running";
    state.roundTimer = window.setTimeout(function () {
      nextCard("round-timeout");
    }, ROUND_MS);
  }

  function stopTimers() {
    window.clearInterval(state.tickTimer);
    window.clearTimeout(state.roundTimer);
    state.tickTimer = null;
    state.roundTimer = null;
  }

  function endSession(reason) {
    state.running = false;
    stopTimers();
    clearCard();
    el.status.textContent = reason === "timeup" ? "Time is up" : "Session ended";

    var head = document.createElement("div");
    head.className = "card-head";
    head.textContent = "Final Score";
    var body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML =
      "<div>" +
      "<div class='placeholder-icon'>🏁</div>" +
      "<div class='hint'>You scored <strong>" + state.score + "</strong> points in 90 seconds.</div>" +
      "</div>";

    var restart = document.createElement("button");
    restart.className = "btn";
    restart.textContent = "Restart";
    restart.addEventListener("click", startSession);

    el.card.appendChild(head);
    el.card.appendChild(body);
    el.card.appendChild(restart);
  }

  function startSession() {
    stopTimers();
    state.running = true;
    state.score = 0;
    state.lastId = null;
    state.current = null;
    state.clock = createSessionClock(SESSION_SECONDS);
    state.clock.start();
    resetWeights();
    updateHud();
    el.status.textContent = "Running";

    state.tickTimer = window.setInterval(function () {
      updateHud();
      if (state.clock && state.clock.isExpired()) {
        endSession("timeup");
      }
    }, 100);

    nextCard("start");
  }

  function handleSkipGesture() {
    if (!state.running || !state.current) {
      return;
    }
    nextCard("skip");
  }

  function bindSwipeGesture() {
    el.card.addEventListener("pointerdown", function (evt) {
      swipe.active = true;
      swipe.x = evt.clientX;
      swipe.y = evt.clientY;
      swipe.t = Date.now();
      swipe.id = evt.pointerId;
    });

    function resetSwipe() {
      swipe.active = false;
      swipe.id = -1;
    }

    el.card.addEventListener("pointerup", function (evt) {
      if (!swipe.active || swipe.id !== evt.pointerId) {
        return;
      }
      var dx = evt.clientX - swipe.x;
      var dy = evt.clientY - swipe.y;
      var dt = Date.now() - swipe.t;
      resetSwipe();
      if (dt > 900) {
        return;
      }
      if (dy < -45 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        handleSkipGesture();
      }
    });

    el.card.addEventListener("pointercancel", resetSwipe);
  }

  function renderStart() {
    el.status.textContent = "Tap to begin";
    el.card.innerHTML =
      "<div class='card-head'>Farm Flick</div>" +
      "<div class='card-body'>" +
      "<div>" +
      "<div class='placeholder-icon'>🚜</div>" +
      "<div class='hint'>Tap start, clear mini-games, and swipe up to skip cards.</div>" +
      "<div class='chip'>90-second session</div>" +
      "</div>" +
      "</div>" +
      "<button id='startBtn' class='btn'>Start</button>";
    document.getElementById("startBtn").addEventListener("click", startSession);
  }

  bindSwipeGesture();
  updateHud();
  renderStart();

  window.startSession = startSession;
  window.endSession = endSession;
  window.nextCard = nextCard;
  window.handleSkipGesture = handleSkipGesture;
  window.handleMiniGameSuccess = handleMiniGameSuccess;
}());
