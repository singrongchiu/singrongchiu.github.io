(function () {
  "use strict";

  var DEFAULT_ROUND_MS = 7000;
  var DEFAULT_ENGAGED_ROUND_MS = 25000;
  var DEFAULT_CARD_SWIPE = {
    maxDurationMs: 800,
    minTravelPx: 90,
    verticalRatio: 1.3
  };
  var DEFAULT_ROUND_PACING = {
    timeoutMinScale: 0.56,
    motionMinScale: 0.68,
    easePower: 1.2
  };
  var RARITY_PRESETS = {
    uncommon: { label: "Uncommon", color: "#3f7fd6", bounty: 2 },
    elite: { label: "Elite", color: "#d48732", bounty: 3 },
    legendary: { label: "Legendary", color: "#b8812a", bounty: 4 }
  };

  function clamp(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return min;
    }
    return Math.min(max, Math.max(min, n));
  }

  function pickWeighted(entries, rng) {
    var items = Array.isArray(entries) ? entries : [];
    if (!items.length) {
      return null;
    }
    var random = typeof rng === "function" ? rng : Math.random;
    var total = 0;
    var i = 0;
    for (i = 0; i < items.length; i += 1) {
      total += Math.max(0, Number(items[i].weight) || 0);
    }
    if (total <= 0) {
      return items[0];
    }
    var roll = random() * total;
    var acc = 0;
    for (i = 0; i < items.length; i += 1) {
      acc += Math.max(0, Number(items[i].weight) || 0);
      if (roll < acc) {
        return items[i];
      }
    }
    return items[items.length - 1];
  }

  function chooseNext(entries, lastId, rng) {
    var items = Array.isArray(entries) ? entries : [];
    if (!items.length) {
      return null;
    }
    if (items.length === 1) {
      return items[0];
    }
    var filtered = items.filter(function (item) {
      return item.id !== lastId;
    });
    return pickWeighted(filtered.length ? filtered : items, rng);
  }

  function classifyCardSwipe(gesture, thresholds) {
    var input = gesture && typeof gesture === "object" ? gesture : {};
    var cfg = thresholds && typeof thresholds === "object" ? thresholds : {};
    var maxDurationMs = Number(cfg.maxDurationMs);
    var minTravelPx = Number(cfg.minTravelPx);
    var verticalRatio = Number(cfg.verticalRatio);
    var dx = Number(input.dx);
    var dy = Number(input.dy);
    var dt = Number(input.dt);

    if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
      maxDurationMs = DEFAULT_CARD_SWIPE.maxDurationMs;
    }
    if (!Number.isFinite(minTravelPx) || minTravelPx <= 0) {
      minTravelPx = DEFAULT_CARD_SWIPE.minTravelPx;
    }
    if (!Number.isFinite(verticalRatio) || verticalRatio <= 0) {
      verticalRatio = DEFAULT_CARD_SWIPE.verticalRatio;
    }
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dt) || dt > maxDurationMs) {
      return null;
    }
    if (Math.abs(dy) < minTravelPx) {
      return null;
    }
    if (Math.abs(dy) <= Math.abs(dx) * verticalRatio) {
      return null;
    }
    return dy < 0 ? "up" : "down";
  }

  function updateWeight(weight, outcome, config) {
    var cfg = config || {};
    var min = Number.isFinite(cfg.min) ? cfg.min : 0.3;
    var max = Number.isFinite(cfg.max) ? cfg.max : 3;
    var upFactor = Number.isFinite(cfg.upFactor) ? cfg.upFactor : 1.15;
    var downFactor = Number.isFinite(cfg.downFactor) ? cfg.downFactor : 0.85;
    var next = Number(weight) || min;

    if (outcome === "success") {
      next *= upFactor;
    } else if (outcome === "skip") {
      next *= downFactor;
    }
    return clamp(next, min, max);
  }

  function computeRoundPacing(progress, config) {
    var cfg = config && typeof config === "object" ? config : {};
    var timeoutMinScale = Number(cfg.timeoutMinScale);
    var motionMinScale = Number(cfg.motionMinScale);
    var easePower = Number(cfg.easePower);
    var clampedProgress = clamp(progress, 0, 1);
    var eased = 0;
    var timeoutScale = 1;
    var motionScale = 1;

    if (!Number.isFinite(timeoutMinScale) || timeoutMinScale <= 0 || timeoutMinScale > 1) {
      timeoutMinScale = DEFAULT_ROUND_PACING.timeoutMinScale;
    }
    if (!Number.isFinite(motionMinScale) || motionMinScale <= 0 || motionMinScale > 1) {
      motionMinScale = DEFAULT_ROUND_PACING.motionMinScale;
    }
    if (!Number.isFinite(easePower) || easePower <= 0) {
      easePower = DEFAULT_ROUND_PACING.easePower;
    }

    eased = Math.pow(clampedProgress, easePower);
    timeoutScale = 1 - ((1 - timeoutMinScale) * eased);
    motionScale = 1 - ((1 - motionMinScale) * eased);

    return {
      progress: clampedProgress,
      timeoutScale: clamp(timeoutScale, timeoutMinScale, 1),
      motionScale: clamp(motionScale, motionMinScale, 1)
    };
  }

  function createSessionClock(durationSec, nowFn) {
    var ms = Math.max(0, Number(durationSec) || 0) * 1000;
    var now = typeof nowFn === "function" ? nowFn : Date.now;
    var startMs = null;

    function ensureStart() {
      if (startMs === null) {
        startMs = now();
      }
    }

    return {
      start: function () {
        startMs = now();
      },
      getElapsed: function () {
        ensureStart();
        return Math.max(0, now() - startMs);
      },
      getRemaining: function () {
        ensureStart();
        return Math.max(0, (ms - (now() - startMs)) / 1000);
      },
      isExpired: function () {
        ensureStart();
        return now() - startMs >= ms;
      }
    };
  }

  function parsePositiveMs(value, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      n = Number(fallback);
    }
    if (!Number.isFinite(n) || n <= 0) {
      return 0;
    }
    return Math.round(n);
  }

  function normalizePluginTiming(input, defaults) {
    var timing = input && typeof input === "object" ? input : {};
    var base = defaults && typeof defaults === "object" ? defaults : {};
    var roundMs = parsePositiveMs(timing.roundMs, base.roundMs || DEFAULT_ROUND_MS);
    var engagedRoundMs = parsePositiveMs(
      timing.engagedRoundMs,
      base.engagedRoundMs || DEFAULT_ENGAGED_ROUND_MS
    );
    if (engagedRoundMs < roundMs) {
      engagedRoundMs = roundMs;
    }
    return {
      roundMs: roundMs,
      engagedRoundMs: engagedRoundMs
    };
  }

  function rarityKey(value) {
    var text = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (!text) {
      return "uncommon";
    }
    if (text === "common") {
      return "uncommon";
    }
    if (text === "uncommon" || text === "elite" || text === "legendary") {
      return text;
    }
    return "uncommon";
  }

  function normalizeRarity(input, defaults) {
    var raw = input && typeof input === "object" ? input : {};
    var base = defaults && typeof defaults === "object" ? defaults : {};
    var preset = RARITY_PRESETS[rarityKey(raw.label || raw.tier || base.label || base.tier)];
    var color = String(raw.color || base.color || preset.color).trim();
    if (!color) {
      color = preset.color;
    }
    var bounty = Number(raw.bounty);
    if (!Number.isFinite(bounty) || bounty <= 0) {
      bounty = Number(base.bounty);
    }
    if (!Number.isFinite(bounty) || bounty <= 0) {
      bounty = preset.bounty;
    }
    return {
      label: preset.label,
      color: color,
      bounty: Math.max(2, Math.round(bounty))
    };
  }

  function normalizeGamePlugin(input, defaults) {
    var base = defaults && typeof defaults === "object" ? defaults : {};
    var raw = input && typeof input === "object" ? input : {};
    var id = String(raw.id || base.id || "").trim();
    if (!id) {
      throw new Error("Mini-game plugin requires a non-empty id");
    }
    var title = String(raw.title || base.title || "Mini-game").trim();
    if (!title) {
      title = "Mini-game";
    }
    var mount = raw.mount;
    if (typeof mount !== "function") {
      throw new Error("Mini-game plugin requires a mount(mountEl, engine) function");
    }

    var initialWeight = Number(raw.initialWeight);
    if (!Number.isFinite(initialWeight) || initialWeight <= 0) {
      initialWeight = Number(base.initialWeight);
    }
    if (!Number.isFinite(initialWeight) || initialWeight <= 0) {
      initialWeight = 1;
    }

    return {
      id: id,
      title: title,
      initialWeight: initialWeight,
      timing: normalizePluginTiming(raw.timing, base.timing),
      rarity: normalizeRarity(raw.rarity, base.rarity),
      mount: mount
    };
  }

  function createFallbackPlugin(meta, reason) {
    var cfg = meta && typeof meta === "object" ? meta : {};
    var id = String(cfg.id || "fallback").trim() || "fallback";
    var title = String(cfg.title || "Mini-game unavailable").trim() || "Mini-game unavailable";
    var icon = String(cfg.icon || "🎮");
    var hint = String(cfg.hint || "This mini-game is unavailable right now.");
    var detail = reason ? String(reason) : "";
    var badge = detail ? "Unavailable: " + detail : "Unavailable";

    return normalizeGamePlugin(
      {
        id: id,
        title: title,
        initialWeight: Number(cfg.initialWeight) || 1,
        timing: cfg.timing,
        rarity: cfg.rarity,
        mount: function (mountEl) {
          mountEl.innerHTML =
            "<div>" +
            "<div class='placeholder-icon'>" + icon + "</div>" +
            "<div class='hint'>" + hint + "</div>" +
            "<div class='chip'>" + badge + "</div>" +
            "</div>";
        }
      },
      {
        id: id,
        title: title,
        initialWeight: 1,
        rarity: cfg.rarity
      }
    );
  }

  var api = {
    clamp: clamp,
    pickWeighted: pickWeighted,
    chooseNext: chooseNext,
    classifyCardSwipe: classifyCardSwipe,
    updateWeight: updateWeight,
    computeRoundPacing: computeRoundPacing,
    createSessionClock: createSessionClock,
    normalizeGamePlugin: normalizeGamePlugin,
    createFallbackPlugin: createFallbackPlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.FrameworkCore = api;
  }
}());
