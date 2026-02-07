(function () {
  "use strict";

  var core = window.FrameworkCore || {};
  var rawRegistry = Array.isArray(window.MiniGames) ? window.MiniGames.slice() : [];
  var chooseNext = core.chooseNext;
  var classifyCardSwipe = core.classifyCardSwipe;
  var updateWeight = core.updateWeight;
  var createSessionClock = core.createSessionClock;
  var clamp = core.clamp;
  var normalizeGamePlugin = core.normalizeGamePlugin;
  var createFallbackPlugin = core.createFallbackPlugin;

  var ROUND_MS = 7000;
  var ENGAGED_ROUND_MS = 25000;
  var SESSION_SECONDS = 105;
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

  var fallback = makeFallbackPlugin({
    id: "framework-shell",
    title: "Framework Shell",
    icon: "🎮",
    hint: "No mini-games are wired yet. Swipe up to cycle cards."
  });

  var state = {
    running: false,
    score: 0,
    clock: null,
    tickTimer: null,
    roundTimer: null,
    roundMs: ROUND_MS,
    engagedRoundMs: ENGAGED_ROUND_MS,
    roundExtended: false,
    roundSeq: 0,
    lastId: null,
    lastSkippedId: null,
    current: null,
    cleanup: null,
    weights: {},
    controls: [],
    plugins: normalizeRegistry(rawRegistry)
  };

  var swipe = { active: false, x: 0, y: 0, t: 0, id: -1 };

  function makeFallbackPlugin(meta, reason) {
    if (typeof createFallbackPlugin === "function") {
      return createFallbackPlugin(meta, reason);
    }
    return {
      id: String((meta && meta.id) || "fallback"),
      title: String((meta && meta.title) || "Mini-game unavailable"),
      initialWeight: 1,
      timing: {
        roundMs: ROUND_MS,
        engagedRoundMs: ENGAGED_ROUND_MS
      },
      mount: function (mount) {
        var icon = meta && meta.icon ? String(meta.icon) : "🎮";
        var hint = meta && meta.hint
          ? String(meta.hint)
          : "This mini-game is unavailable right now.";
        var chip = reason ? "Unavailable: " + String(reason) : "Unavailable";
        mount.innerHTML =
          "<div>" +
          "<div class='placeholder-icon'>" + icon + "</div>" +
          "<div class='hint'>" + hint + "</div>" +
          "<div class='chip'>" + chip + "</div>" +
          "</div>";
      }
    };
  }

  function clampRoundMs(value, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      n = Number(fallback);
    }
    if (!Number.isFinite(n) || n <= 0) {
      return 0;
    }
    return Math.round(n);
  }

  function normalizeRegistry(list) {
    if (!Array.isArray(list) || !list.length) {
      return [];
    }
    return list.map(function (plugin, index) {
      var fallbackId = "plugin-" + String(index + 1);
      var fallbackTitle = "Mini-game " + String(index + 1);
      try {
        if (typeof normalizeGamePlugin === "function") {
          return normalizeGamePlugin(plugin, {
            id: fallbackId,
            title: fallbackTitle,
            initialWeight: 1,
            timing: {
              roundMs: ROUND_MS,
              engagedRoundMs: ENGAGED_ROUND_MS
            }
          });
        }
        return plugin;
      } catch (err) {
        return makeFallbackPlugin(
          {
            id: fallbackId,
            title: fallbackTitle,
            icon: "⚠️",
            hint: "A mini-game failed to load and was replaced."
          },
          err && err.message
        );
      }
    });
  }

  function safeGames() {
    return state.plugins.length ? state.plugins : [fallback];
  }

  function resetWeights() {
    state.weights = {};
    safeGames().forEach(function (plugin) {
      state.weights[plugin.id] = clamp(plugin.initialWeight || 1, WEIGHT_CFG.min, WEIGHT_CFG.max);
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

  function clearRegisteredControls() {
    state.controls = [];
  }

  function registerRoundControl(element, options) {
    if (!element || typeof element.contains !== "function") {
      return;
    }
    state.controls.push({
      element: element,
      allowSwipeSkip: Boolean(options && options.allowSwipeSkip)
    });
  }

  function getControlForTarget(target) {
    var i = 0;
    for (i = state.controls.length - 1; i >= 0; i -= 1) {
      var control = state.controls[i];
      if (control.element && target && control.element.contains(target)) {
        return control;
      }
    }
    return null;
  }

  function clearCard() {
    if (typeof state.cleanup === "function") {
      try {
        state.cleanup();
      } catch (err) {
        // Ignore cleanup failures to keep the session running.
      }
    }
    state.cleanup = null;
    clearRegisteredControls();
    el.card.innerHTML = "";
  }

  function showToast(text) {
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = String(text || "");
    el.feedback.appendChild(toast);
    window.setTimeout(function () {
      toast.remove();
    }, 760);
  }

  function getPluginRarity(plugin) {
    var rarity = plugin && plugin.rarity && typeof plugin.rarity === "object"
      ? plugin.rarity
      : {};
    var label = String(rarity.label || "Uncommon").trim() || "Uncommon";
    var color = String(rarity.color || "#3f7fd6").trim() || "#3f7fd6";
    var bounty = Number(rarity.bounty);
    if (!Number.isFinite(bounty) || bounty <= 0) {
      bounty = 2;
    }
    return {
      label: label,
      color: color,
      bounty: Math.max(2, Math.round(bounty))
    };
  }

  function showCorrect(rarity) {
    var badge = rarity && rarity.label ? String(rarity.label) : "Uncommon";
    var bounty = rarity && Number.isFinite(rarity.bounty)
      ? Math.max(2, Math.round(rarity.bounty))
      : 2;
    showToast("Correct! +" + String(bounty) + " (" + badge + ")");
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

  function setRoundTimer(ms) {
    window.clearTimeout(state.roundTimer);
    state.roundTimer = window.setTimeout(function () {
      nextCard("round-timeout");
    }, ms);
  }

  function extendRoundOnEngagement() {
    if (!state.running || !state.current || state.roundExtended) {
      return;
    }
    state.roundExtended = true;
    setRoundTimer(state.engagedRoundMs);
  }

  function createEngineContextForRound(roundSeq) {
    var settled = false;

    function isActiveRound() {
      return Boolean(state.running && state.current && state.roundSeq === roundSeq);
    }

    function settleRound(effect) {
      if (settled || !isActiveRound()) {
        return false;
      }
      settled = true;
      effect();
      return true;
    }

    return {
      complete: function () {
        settleRound(function () {
          var currentId = state.current.id;
          var rarity = getPluginRarity(state.current);
          state.weights[currentId] = updateWeight(state.weights[currentId], "success", WEIGHT_CFG);
          state.score += rarity.bounty;
          updateHud();
          showCorrect(rarity);
          burstConfetti();
          window.setTimeout(function () {
            if (isActiveRound()) {
              nextCard("success");
            }
          }, 700);
        });
      },
      fail: function () {
        settleRound(function () {
          window.setTimeout(function () {
            if (isActiveRound()) {
              nextCard("fail");
            }
          }, 120);
        });
      },
      noteInteraction: function () {
        if (isActiveRound()) {
          extendRoundOnEngagement();
        }
      },
      registerControl: function (element, options) {
        if (isActiveRound()) {
          registerRoundControl(element, options);
        }
      },
      effects: {
        confetti: function () {
          if (isActiveRound()) {
            burstConfetti();
          }
        },
        toast: function (text) {
          if (isActiveRound()) {
            showToast(text || "");
          }
        }
      },
      session: {
        getRemainingSeconds: function () {
          if (!state.clock) {
            return SESSION_SECONDS;
          }
          return state.clock.getRemaining();
        }
      }
    };
  }

  function renderCard(plugin) {
    clearCard();
    el.card.classList.remove("enter");

    var rarity = getPluginRarity(plugin);
    var head = document.createElement("div");
    head.className = "card-head";
    head.textContent = plugin.title || "Mini-game";

    var rarityChip = document.createElement("div");
    rarityChip.className = "chip";
    rarityChip.textContent = rarity.label + " \u2022 Bounty +" + String(rarity.bounty);
    rarityChip.style.borderColor = rarity.color;
    rarityChip.style.color = rarity.color;
    rarityChip.style.background = "#fff8ec";
    rarityChip.style.marginTop = "6px";
    head.appendChild(document.createElement("br"));
    head.appendChild(rarityChip);

    var body = document.createElement("div");
    body.className = "card-body";

    el.card.appendChild(head);
    el.card.appendChild(body);
    void el.card.offsetWidth;
    el.card.classList.add("enter");

    state.roundSeq += 1;
    state.roundMs = clampRoundMs(plugin.timing && plugin.timing.roundMs, ROUND_MS);
    state.engagedRoundMs = clampRoundMs(plugin.timing && plugin.timing.engagedRoundMs, ENGAGED_ROUND_MS);
    if (state.engagedRoundMs < state.roundMs) {
      state.engagedRoundMs = state.roundMs;
    }
    state.roundExtended = false;

    if (typeof plugin.mount === "function") {
      try {
        state.cleanup = plugin.mount(body, createEngineContextForRound(state.roundSeq));
      } catch (err) {
        var failed = makeFallbackPlugin(
          {
            id: plugin.id,
            title: plugin.title,
            icon: "⚠️",
            hint: "This mini-game crashed while loading."
          },
          err && err.message
        );
        state.cleanup = failed.mount(body);
      }
    }

    if (typeof state.cleanup !== "function") {
      state.cleanup = null;
    }
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
      state.lastSkippedId = state.current.id;
      state.weights[state.current.id] = updateWeight(
        state.weights[state.current.id],
        "skip",
        WEIGHT_CFG
      );
    }

    var games = safeGames();
    var pool = games.map(function (plugin) {
      return {
        id: plugin.id,
        weight: state.weights[plugin.id]
      };
    });
    var picked = chooseNext(pool, state.lastId);
    if (!picked) {
      endSession("empty");
      return;
    }

    var plugin = games.find(function (item) {
      return item.id === picked.id;
    });

    if (!plugin) {
      endSession("empty");
      return;
    }

    state.current = plugin;
    state.lastId = plugin.id;
    renderCard(plugin);
    el.status.textContent = "Running";
    setRoundTimer(state.roundMs);
  }

  function stopTimers() {
    window.clearInterval(state.tickTimer);
    window.clearTimeout(state.roundTimer);
    state.tickTimer = null;
    state.roundTimer = null;
    state.roundMs = ROUND_MS;
    state.engagedRoundMs = ENGAGED_ROUND_MS;
    state.roundExtended = false;
  }

  function endSession(reason) {
    state.running = false;
    state.current = null;
    state.lastSkippedId = null;
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
    state.lastSkippedId = null;
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

  function handleRestoreLastSkippedGesture() {
    if (!state.running || !state.current || !state.lastSkippedId) {
      return;
    }
    if (state.current.id === state.lastSkippedId) {
      return;
    }

    var plugin = safeGames().find(function (item) {
      return item.id === state.lastSkippedId;
    });
    if (!plugin) {
      state.lastSkippedId = null;
      return;
    }

    window.clearTimeout(state.roundTimer);
    state.current = plugin;
    state.lastId = plugin.id;
    state.lastSkippedId = null;
    renderCard(plugin);
    el.status.textContent = "Running";
    setRoundTimer(state.roundMs);
    showToast("Reopened skipped game");
  }

  function resolveCardSwipeDirection(dx, dy, dt) {
    if (typeof classifyCardSwipe === "function") {
      return classifyCardSwipe({ dx: dx, dy: dy, dt: dt });
    }
    if (dt > 800) {
      return null;
    }
    if (Math.abs(dy) < 90) {
      return null;
    }
    if (Math.abs(dy) <= Math.abs(dx) * 1.3) {
      return null;
    }
    return dy < 0 ? "up" : "down";
  }

  function bindSwipeGesture() {
    el.card.addEventListener("pointerdown", function (evt) {
      var control = getControlForTarget(evt.target);
      if (control) {
        extendRoundOnEngagement();
        if (!control.allowSwipeSkip) {
          swipe.active = false;
          swipe.id = -1;
          return;
        }
      }
      swipe.active = true;
      swipe.x = evt.clientX;
      swipe.y = evt.clientY;
      swipe.t = Date.now();
      swipe.id = evt.pointerId;
    }, true);

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
      var direction = resolveCardSwipeDirection(dx, dy, dt);
      if (direction === "up") {
        handleSkipGesture();
      } else if (direction === "down") {
        handleRestoreLastSkippedGesture();
      }
    }, true);

    el.card.addEventListener("pointercancel", resetSwipe, true);
  }

  function renderStart() {
    el.status.textContent = "Tap to begin";
    el.card.innerHTML =
      "<div class='card-head'>Farm Flick</div>" +
      "<div class='card-body'>" +
      "<div>" +
      "<div class='placeholder-icon'>🚜</div>" +
      "<div class='hint'>Tap start, clear mini-games, swipe up to skip, and swipe down to reopen the last skipped game.</div>" +
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
  window.handleRestoreLastSkippedGesture = handleRestoreLastSkippedGesture;
}());
