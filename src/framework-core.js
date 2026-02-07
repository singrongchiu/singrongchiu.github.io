(function () {
  "use strict";

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

  var api = {
    clamp: clamp,
    pickWeighted: pickWeighted,
    chooseNext: chooseNext,
    updateWeight: updateWeight,
    createSessionClock: createSessionClock
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.FrameworkCore = api;
  }
}());
