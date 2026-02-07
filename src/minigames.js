(function () {
  "use strict";

  var burgerApi = window.BurgerMiniGame || null;
  var lightbulbApi = window.LightbulbMiniGame || null;
  var pipeApi = window.PipeTurningMiniGame || null;
  var plantApi = window.PlantWaterMiniGame || null;

  function makePlaceholder(game) {
    return {
      id: game.id,
      label: game.label,
      weight: game.weight,
      playable: false,
      render: function (mount) {
        mount.innerHTML =
          "<div>" +
          "<div class='placeholder-icon'>" + game.icon + "</div>" +
          "<div class='hint'>" + game.hint + "</div>" +
          "<div class='chip'>Framework placeholder only</div>" +
          "</div>";
      }
    };
  }

  function buildGame(game) {
    if (
      game.id === "burger" &&
      burgerApi &&
      typeof burgerApi.createBurgerGame === "function"
    ) {
      try {
        return burgerApi.createBurgerGame();
      } catch (err) {
        return makePlaceholder(game);
      }
    }
    if (
      game.id === "bulb" &&
      lightbulbApi &&
      typeof lightbulbApi.createLightbulbGame === "function"
    ) {
      try {
        return lightbulbApi.createLightbulbGame();
      } catch (err) {
        return makePlaceholder(game);
      }
    }
    if (
      game.id === "pipe" &&
      pipeApi &&
      typeof pipeApi.createPipeTurningGame === "function"
    ) {
      try {
        return pipeApi.createPipeTurningGame();
      } catch (err) {
        return makePlaceholder(game);
      }
    }
    if (
      game.id === "plant" &&
      plantApi &&
      typeof plantApi.createPlantWateringGame === "function"
    ) {
      try {
        return plantApi.createPlantWateringGame();
      } catch (err) {
        return makePlaceholder(game);
      }
    }
    return makePlaceholder(game);
  }

  function isValidGame(game) {
    return Boolean(game && typeof game.id === "string" && typeof game.render === "function");
  }

  function pushUnique(target, seen, game) {
    if (!isValidGame(game)) {
      return;
    }
    if (seen[game.id]) {
      return;
    }
    seen[game.id] = true;
    target.push(game);
  }

  var localGames = [
    { id: "burger", label: "Burger Flipping", weight: 1, icon: "\ud83c\udf54", hint: "Burger mini-game slot" },
    { id: "bulb", label: "Lamp Twist", weight: 1, icon: "\ud83d\udca1", hint: "Lightbulb mini-game slot" },
    { id: "pipe", label: "Pipe Grid", weight: 1, icon: "\ud83e\udde9", hint: "Pipe mini-game slot" },
    { id: "plant", label: "Plant Watering", weight: 1, icon: "\ud83c\udf31", hint: "Plant mini-game slot" }
  ].map(buildGame);

  var cloudGames = Array.isArray(window.CloudMiniGames)
    ? window.CloudMiniGames.slice()
    : [];
  var seen = {};
  var miniGames = [];

  localGames.forEach(function (game) {
    pushUnique(miniGames, seen, game);
  });

  cloudGames.forEach(function (game) {
    pushUnique(miniGames, seen, game);
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = miniGames;
  }
  if (typeof window !== "undefined") {
    window.MiniGames = miniGames;
  }
}());
