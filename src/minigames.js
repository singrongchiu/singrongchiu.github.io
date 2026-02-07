(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : {};
  var core = root.FrameworkCore || {};
  var normalizeGamePlugin = core.normalizeGamePlugin;
  var createFallbackPlugin = core.createFallbackPlugin;
  var RARITY = {
    UNCOMMON: { label: "Uncommon", color: "#3f7fd6", bounty: 2 },
    ELITE: { label: "Elite", color: "#d48732", bounty: 3 },
    LEGENDARY: { label: "Legendary", color: "#b8812a", bounty: 4 }
  };

  var descriptors = [
    {
      id: "burger",
      title: "Burger Flipping",
      icon: "🍔",
      hint: "Burger mini-game slot",
      rarity: RARITY.UNCOMMON,
      apiName: "BurgerMiniGame"
    },
    {
      id: "vanish",
      title: "Vanishing Path",
      icon: "🧠",
      hint: "Vanishing path mini-game slot",
      rarity: RARITY.ELITE,
      apiName: "VanishingPathMiniGame"
    },
    {
      id: "plant",
      title: "Plant Watering",
      icon: "🌱",
      hint: "Plant mini-game slot",
      rarity: RARITY.UNCOMMON,
      apiName: "PlantWaterMiniGame"
    },
    {
      id: "slingshot",
      title: "Slingshot Launch",
      icon: "🎯",
      hint: "Slingshot mini-game slot",
      rarity: RARITY.ELITE,
      apiName: "SlingshotMiniGame"
    },
    {
      id: "maze",
      title: "Maze Runner",
      icon: "🏃",
      hint: "Maze runner mini-game slot",
      rarity: { label: "Elite", color: "#58a05a", bounty: 3 },
      apiName: "MazeRunnerMiniGame"
    },
    {
      id: "harvest",
      title: "Harvest Catch",
      icon: "🍎",
      hint: "Harvest mini-game slot",
      rarity: RARITY.UNCOMMON,
      apiName: "HarvestMiniGame"
    },
    {
      id: "eightball",
      title: "8-Ball One Shot",
      icon: "🎱",
      hint: "8-ball mini-game slot",
      rarity: RARITY.LEGENDARY,
      apiName: "EightBallMiniGame"
    },
    {
      id: "wires",
      title: "Connect Wires",
      icon: "🔌",
      hint: "Connect-the-wires mini-game slot",
      rarity: RARITY.UNCOMMON,
      apiName: "ConnectWiresMiniGame"
    },
    {
      id: "letterfill",
      title: "Letter Filling",
      icon: "🔤",
      hint: "Letter-filling mini-game slot",
      rarity: RARITY.UNCOMMON,
      apiName: "LetterFillingMiniGame"
    }
  ];

  function makeFallback(descriptor, reason) {
    var meta = {
      id: descriptor.id,
      title: descriptor.title,
      initialWeight: 1,
      icon: descriptor.icon,
      hint: descriptor.hint,
      rarity: descriptor.rarity
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
          initialWeight: 1,
          rarity: descriptor.rarity
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
