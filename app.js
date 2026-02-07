(function () {
  "use strict";

  var core = window.FrameworkCore || {};
  var rawRegistry = Array.isArray(window.MiniGames) ? window.MiniGames.slice() : [];
  var chooseNext = core.chooseNext;
  var classifyCardSwipe = core.classifyCardSwipe;
  var updateWeight = core.updateWeight;
  var computeRoundPacing = core.computeRoundPacing;
  var createSessionClock = core.createSessionClock;
  var clamp = core.clamp;
  var normalizeGamePlugin = core.normalizeGamePlugin;
  var createFallbackPlugin = core.createFallbackPlugin;

  var ROUND_MS = 7000;
  var ENGAGED_ROUND_MS = 25000;
  var ROUND_TIMEOUT_MIN_MS = 2800;
  var ENGAGED_ROUND_MIN_MS = 5200;
  var RESULT_MS = 1000;
  var ROUND_PACING_CFG = {
    timeoutMinScale: 0.56,
    motionMinScale: 0.68,
    easePower: 1.2
  };
  var SESSION_SECONDS = 90;
  var WEIGHT_CFG = { min: 0.3, max: 3, upFactor: 1.15, downFactor: 0.85 };
  var SWIPE_VISUAL_START_PX = 26;
  var SWIPE_VISUAL_VERTICAL_RATIO = 1.2;
  var SWIPE_VISUAL_MAX_TRAVEL_RATIO = 0.42;
  var SWIPE_VISUAL_RESET_MS = 170;
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
    timeoutScale: 1,
    motionScale: 1,
    roundExtended: false,
    roundDone: false,
    roundSeq: 0,
    lastId: null,
    lastSkippedId: null,
    current: null,
    cleanup: null,
    weights: {},
    controls: [],
    plugins: normalizeRegistry(rawRegistry)
  };

  var swipe = {
    active: false,
    x: 0,
    y: 0,
    t: 0,
    id: -1,
    visualActive: false,
    settleTimer: 0
  };

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

  function scaleDurationMs(ms, scale, minMs) {
    var value = clampRoundMs(ms, 0);
    var amount = clamp(scale, 0, 1);
    var floor = Math.max(0, Number(minMs) || 0);
    return Math.max(floor, Math.round(value * amount));
  }

  function getSessionProgress() {
    if (!state.clock) {
      return 0;
    }
    return clamp(state.clock.getElapsed() / SESSION_SECONDS, 0, 1);
  }

  function resolveRoundPacing(progress) {
    if (typeof computeRoundPacing === "function") {
      return computeRoundPacing(progress, ROUND_PACING_CFG);
    }
    var eased = Math.pow(clamp(progress, 0, 1), ROUND_PACING_CFG.easePower);
    var timeoutScale = 1 - ((1 - ROUND_PACING_CFG.timeoutMinScale) * eased);
    var motionScale = 1 - ((1 - ROUND_PACING_CFG.motionMinScale) * eased);
    return {
      timeoutScale: clamp(timeoutScale, ROUND_PACING_CFG.timeoutMinScale, 1),
      motionScale: clamp(motionScale, ROUND_PACING_CFG.motionMinScale, 1)
    };
  }

  function applyRoundPacing() {
    var pacing = resolveRoundPacing(getSessionProgress());
    state.timeoutScale = pacing.timeoutScale;
    state.motionScale = pacing.motionScale;
    document.documentElement.style.setProperty("--tempo-scale", state.motionScale.toFixed(3));
  }

  function pacedDelayMs(ms, minMs) {
    var base = Math.max(0, Number(ms) || 0);
    var floor = Math.max(0, Number(minMs) || 0);
    return Math.max(floor, Math.round(base * state.motionScale));
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

  function isTargetInsideGameBox(target) {
    if (!target || typeof target.closest !== "function") {
      return false;
    }
    return Boolean(target.closest(".card-body"));
  }

  function clearSwipeSettleTimer() {
    if (swipe.settleTimer) {
      window.clearTimeout(swipe.settleTimer);
      swipe.settleTimer = 0;
    }
  }

  function clearCardSwipeVisual() {
    clearSwipeSettleTimer();
    swipe.visualActive = false;
    el.card.classList.remove("swipe-follow");
    el.card.style.transition = "";
    el.card.style.transform = "";
  }

  function shouldActivateSwipeVisual(dx, dy) {
    if (Math.abs(dy) < SWIPE_VISUAL_START_PX) {
      return false;
    }
    if (Math.abs(dy) <= Math.abs(dx) * SWIPE_VISUAL_VERTICAL_RATIO) {
      return false;
    }
    return true;
  }

  function applyCardSwipeVisual(dx, dy) {
    var cardHeight = Math.max(1, Number(el.card.clientHeight) || 1);
    var maxTravel = Math.max(120, cardHeight * SWIPE_VISUAL_MAX_TRAVEL_RATIO);
    var y = clamp(dy, -maxTravel, maxTravel);
    var tilt = clamp(dx / 26, -6, 6);
    clearSwipeSettleTimer();
    swipe.visualActive = true;
    el.card.classList.add("swipe-follow");
    el.card.style.transition = "none";
    el.card.style.transform =
      "translate3d(0," + y.toFixed(1) + "px,0) rotate(" + tilt.toFixed(2) + "deg)";
  }

  function settleCardSwipeVisual() {
    if (!swipe.visualActive) {
      clearCardSwipeVisual();
      return;
    }
    clearSwipeSettleTimer();
    var resetMs = pacedDelayMs(SWIPE_VISUAL_RESET_MS, 90);
    el.card.classList.remove("swipe-follow");
    el.card.style.transition = "transform " + String(resetMs) + "ms cubic-bezier(.2,.78,.25,1)";
    el.card.style.transform = "translate3d(0,0,0) rotate(0deg)";
    swipe.settleTimer = window.setTimeout(function () {
      clearCardSwipeVisual();
    }, resetMs + 24);
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
    clearCardSwipeVisual();
  }

  function showToast(text, ms, kind) {
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = String(text || "");
    el.feedback.appendChild(toast);
    var duration = Number.isFinite(ms) ? ms : pacedDelayMs(760, 260);
    if (Number.isFinite(ms)) {
      toast.style.animationDuration = String(ms) + "ms";
    }
    if (kind) {
      var bg = kind === "win" ? "#1f9d45" : kind === "timeout" ? "#e6b325" : "#d94444";
      var border = kind === "win" ? "#0b6829" : kind === "timeout" ? "#b98710" : "#9c1f1f";
      toast.style.background = bg;
      toast.style.borderColor = border;
      toast.style.fontSize = "22px";
      toast.style.padding = "12px 20px";
      toast.style.letterSpacing = "1px";
    }
    window.setTimeout(function () {
      toast.remove();
    }, duration);
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

  function showCorrect(rarity, ms) {
    var badge = rarity && rarity.label ? String(rarity.label) : "Uncommon";
    var bounty = rarity && Number.isFinite(rarity.bounty)
      ? Math.max(2, Math.round(rarity.bounty))
      : 2;
    showToast("WIN +" + String(bounty) + " (" + badge + ")", ms, "win");
  }

  function burstConfetti(ms) {
    var colors = ["#f94", "#f66", "#3aa1ff", "#7dce5a", "#ffd739"];
    var duration = Number.isFinite(ms) ? ms : null;
    var i = 0;
    for (i = 0; i < 14; i += 1) {
      var node = document.createElement("span");
      var x = (48 + Math.random() * 4) + "%";
      var y = "10%";
      var dx = ((Math.random() - 0.5) * 220) + "px";
      var dy = (60 + Math.random() * 200) + "px";
      node.className = "confetti";
      node.style.background = colors[i % colors.length];
      node.style.setProperty("--x", x);
      node.style.setProperty("--y", y);
      node.style.setProperty("--dx", dx);
      node.style.setProperty("--dy", dy);
      if (duration) {
        node.style.animationDuration = String(duration) + "ms";
      }
      el.confetti.appendChild(node);
      node.addEventListener("animationend", function () {
        node.remove();
      });
    }
  }

  function setRoundTimer(ms) {
    window.clearTimeout(state.roundTimer);
    state.roundTimer = window.setTimeout(function () {
      showRoundResult("timeout", "round-timeout");
    }, ms);
  }

  function pauseSessionClock() {
    if (!state.clock) {
      return SESSION_SECONDS;
    }
    var remaining = state.clock.getRemaining();
    state.clock = {
      getRemaining: function () {
        return remaining;
      },
      getElapsed: function () {
        return Math.max(0, SESSION_SECONDS - remaining);
      },
      isExpired: function () {
        return false;
      }
    };
    return remaining;
  }

  function showRoundResult(kind, reason, rarity) {
    if (!state.running || !state.current || state.roundDone) {
      return;
    }
    state.roundDone = true;
    window.clearTimeout(state.roundTimer);
    var remaining = pauseSessionClock();
    if (kind === "win") {
      showCorrect(rarity, RESULT_MS);
      burstConfetti(RESULT_MS);
    } else {
      showToast(kind === "timeout" ? "TIMEOUT" : "LOSE", RESULT_MS, kind);
    }
    window.setTimeout(function () {
      if (!state.running) {
        return;
      }
      state.clock = createSessionClock(remaining);
      state.clock.start();
      nextCard(reason);
    }, RESULT_MS);
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
      if (settled || !isActiveRound() || state.roundDone) {
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
          showRoundResult("win", "success", rarity);
        });
      },
      fail: function () {
        settleRound(function () {
          showRoundResult("loss", "fail");
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

    var swipeZone = document.createElement("div");
    swipeZone.className = "card-swipe-zone";
    swipeZone.setAttribute("aria-hidden", "true");

    el.card.appendChild(head);
    el.card.appendChild(body);
    el.card.appendChild(swipeZone);
    void el.card.offsetWidth;
    el.card.classList.add("enter");

    state.roundSeq += 1;
    applyRoundPacing();
    state.roundMs = scaleDurationMs(
      clampRoundMs(plugin.timing && plugin.timing.roundMs, ROUND_MS),
      state.timeoutScale,
      ROUND_TIMEOUT_MIN_MS
    );
    state.engagedRoundMs = scaleDurationMs(
      clampRoundMs(plugin.timing && plugin.timing.engagedRoundMs, ENGAGED_ROUND_MS),
      state.timeoutScale,
      ENGAGED_ROUND_MIN_MS
    );
    if (state.engagedRoundMs < state.roundMs) {
      state.engagedRoundMs = state.roundMs;
    }
    state.roundExtended = false;
    state.roundDone = false;

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
    state.timeoutScale = 1;
    state.motionScale = 1;
    document.documentElement.style.setProperty("--tempo-scale", "1");
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
    state.roundSeq = 0;
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
    if (!state.running || !state.current || state.roundDone) {
      return;
    }
    nextCard("skip");
  }

  function handleRestoreLastSkippedGesture() {
    if (!state.running || !state.current || !state.lastSkippedId || state.roundDone) {
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
      if (state.roundDone) {
        return;
      }
      if (state.running && state.current && isTargetInsideGameBox(evt.target)) {
        extendRoundOnEngagement();
        swipe.active = false;
        swipe.id = -1;
        swipe.visualActive = false;
        clearSwipeSettleTimer();
        return;
      }
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
      swipe.visualActive = false;
      clearSwipeSettleTimer();
      if (typeof el.card.setPointerCapture === "function") {
        try {
          el.card.setPointerCapture(evt.pointerId);
        } catch (err) {
          // Ignore capture failures and keep gesture handling functional.
        }
      }
    }, true);

    function resetSwipe() {
      var pointerId = swipe.id;
      swipe.active = false;
      swipe.id = -1;
      swipe.visualActive = false;
      if (pointerId !== -1 && typeof el.card.releasePointerCapture === "function") {
        try {
          el.card.releasePointerCapture(pointerId);
        } catch (err) {
          // Ignore release failures.
        }
      }
    }

    el.card.addEventListener("pointermove", function (evt) {
      if (!swipe.active || swipe.id !== evt.pointerId) {
        return;
      }
      var dx = evt.clientX - swipe.x;
      var dy = evt.clientY - swipe.y;
      if (!swipe.visualActive && !shouldActivateSwipeVisual(dx, dy)) {
        return;
      }
      applyCardSwipeVisual(dx, dy);
      if (evt.cancelable) {
        evt.preventDefault();
      }
    }, true);

    el.card.addEventListener("pointerup", function (evt) {
      if (!swipe.active || swipe.id !== evt.pointerId) {
        return;
      }
      if (state.roundDone) {
        resetSwipe();
        clearCardSwipeVisual();
        return;
      }
      var dx = evt.clientX - swipe.x;
      var dy = evt.clientY - swipe.y;
      var dt = Date.now() - swipe.t;
      var hadVisual = swipe.visualActive;
      resetSwipe();
      var direction = resolveCardSwipeDirection(dx, dy, dt);
      if (direction === "up") {
        clearCardSwipeVisual();
        handleSkipGesture();
      } else if (direction === "down") {
        clearCardSwipeVisual();
        handleRestoreLastSkippedGesture();
      } else if (hadVisual) {
        settleCardSwipeVisual();
      }
    }, true);

    el.card.addEventListener("pointercancel", function (evt) {
      if (!swipe.active || swipe.id !== evt.pointerId) {
        return;
      }
      var hadVisual = swipe.visualActive;
      resetSwipe();
      if (hadVisual) {
        settleCardSwipeVisual();
      } else {
        clearCardSwipeVisual();
      }
    }, true);
  }

  function renderStart() {
    el.status.textContent = "Tap to begin";
    el.card.innerHTML =
      "<div class='card-head'>Farm Flick</div>" +
      "<div class='card-body'>" +
      "<div>" +
      "<div class='placeholder-icon'>🚜</div>" +
      "<div class='hint'>Tap start and play inside the game box. Swipe outside the game box (especially in the bottom area): up to skip, down to reopen the last skipped game.</div>" +
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
