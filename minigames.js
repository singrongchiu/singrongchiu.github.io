(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : {};
  var core = root.FrameworkCore || {};
  var normalizeGamePlugin = core.normalizeGamePlugin;
  var createFallbackPlugin = core.createFallbackPlugin;

  var descriptors = [
    {
      id: "burger",
      title: "Burger Flipping",
      icon: "🍔",
      hint: "Burger mini-game slot",
      apiName: "BurgerMiniGame"
    },
    {
      id: "vanish",
      title: "Vanishing Path",
      icon: "🧠",
      hint: "Vanishing path mini-game slot",
      apiName: "VanishingPathMiniGame"
    },
    {
      id: "plant",
      title: "Plant Watering",
      icon: "🌱",
      hint: "Plant mini-game slot",
      apiName: "PlantWaterMiniGame"
    },
    {
      id: "eightball",
      title: "8-Ball One Shot",
      icon: "🎱",
      hint: "8-ball mini-game slot",
      apiName: "EightBallMiniGame"
    },
    {
      id: "letterfill",
      title: "Letter Filling",
      icon: "🔤",
      hint: "Letter-filling mini-game slot",
      apiName: "LetterFillingMiniGame"
    }
  ];

  function makeFallback(descriptor, reason) {
    var meta = {
      id: descriptor.id,
      title: descriptor.title,
      initialWeight: 1,
      icon: descriptor.icon,
      hint: descriptor.hint
    };

    if (typeof createFallbackPlugin === "function") {
      return createFallbackPlugin(meta, reason);
    }

    return {
      id: descriptor.id,
      title: descriptor.title,
      initialWeight: 1,
      timing: {
        roundMs: 7000,
        engagedRoundMs: 25000
      },
      mount: function (mount) {
        mount.innerHTML =
          "<div>" +
          "<div class='placeholder-icon'>" + descriptor.icon + "</div>" +
          "<div class='hint'>" + descriptor.hint + "</div>" +
          "<div class='chip'>Framework placeholder only</div>" +
          "</div>";
      }
    };
  }

  function resolveApi(apiName) {
    return root[apiName] || null;
  }

  function resolvePlugin(descriptor) {
    var api = resolveApi(descriptor.apiName);
    if (!api || typeof api.createMiniGamePlugin !== "function") {
      return null;
    }

    try {
      var plugin = api.createMiniGamePlugin();
      if (typeof normalizeGamePlugin === "function") {
        return normalizeGamePlugin(plugin, {
          id: descriptor.id,
          title: descriptor.title,
          initialWeight: 1
        });
      }
      return plugin;
    } catch (err) {
      return makeFallback(descriptor, err && err.message);
    }
  }

  var miniGames = descriptors
    .map(resolvePlugin)
    .filter(Boolean);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = miniGames;
  }
  if (typeof window !== "undefined") {
    window.MiniGames = miniGames;
  }
}());
