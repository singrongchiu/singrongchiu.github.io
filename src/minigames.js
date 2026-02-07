(function () {
  "use strict";

  var burgerApi = window.BurgerMiniGame || null;
  var lightbulbApi = window.LightbulbMiniGame || null;
  var pipeApi = window.PipeTurningMiniGame || null;
  var vanishingApi = window.VanishingPathMiniGame || null;
  var plantApi = window.PlantWaterMiniGame || null;
  var cookingApi = window.CookingMiniGame || null;
  var dinosaurApi = window.DinosaurMiniGame || null;
  var harvestApi = window.HarvestMiniGame || null;

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
      game.id === "vanish" &&
      vanishingApi &&
      typeof vanishingApi.createVanishingPathGame === "function"
    ) {
      try {
        return vanishingApi.createVanishingPathGame();
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
    if (
      game.id === "cooking" &&
      cookingApi &&
      typeof cookingApi.createCookingGame === "function"
    ) {
      try {
        return cookingApi.createCookingGame();
      } catch (err) {
        return makePlaceholder(game);
      }
    }
    if (
      game.id === "dinosaur" &&
      dinosaurApi &&
      typeof dinosaurApi.createDinosaurGame === "function"
    ) {
      try {
        return dinosaurApi.createDinosaurGame();
      } catch (err) {
        return makePlaceholder(game);
      }
    }
    if (
      game.id === "harvest" &&
      harvestApi &&
      typeof harvestApi.createHarvestGame === "function"
    ) {
      try {
        return harvestApi.createHarvestGame();
      } catch (err) {
        return makePlaceholder(game);
      }
    }
    return makePlaceholder(game);
  }

  var miniGames = [
    { id: "burger", label: "Burger Flipping", weight: 1, icon: "\ud83c\udf54", hint: "Burger mini-game slot" },
    { id: "bulb", label: "Lamp Twist", weight: 1, icon: "\ud83d\udca1", hint: "Lightbulb mini-game slot" },
    { id: "pipe", label: "Pipe Grid", weight: 1, icon: "\ud83e\udde9", hint: "Pipe mini-game slot" },
    { id: "vanish", label: "Vanishing Path", weight: 1, icon: "\ud83e\udde0", hint: "Vanishing path mini-game slot" },
    { id: "plant", label: "Plant Watering", weight: 1, icon: "\ud83c\udf31", hint: "Plant mini-game slot" },
    { id: "cooking", label: "Ingredient Combining", weight: 1, icon: "\ud83e\uddc1", hint: "Cooking mini-game slot" },
    { id: "dinosaur", label: "Dino Petting", weight: 1, icon: "\ud83e\udd96", hint: "Dinosaur mini-game slot" },
    { id: "harvest", label: "Harvest Catch", weight: 1, icon: "\ud83c\udf4e", hint: "Harvest mini-game slot" }
  ].map(buildGame);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = miniGames;
  }
  if (typeof window !== "undefined") {
    window.MiniGames = miniGames;
  }
}());
