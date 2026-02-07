(function () {
  "use strict";

  var lightbulbApi = window.LightbulbMiniGame || null;

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
    return makePlaceholder(game);
  }

  var miniGames = [
    { id: "burger", label: "Burger Station", weight: 1, icon: "🍔", hint: "Burger mini-game slot" },
    { id: "bulb", label: "Lamp Twist", weight: 1, icon: "💡", hint: "Lightbulb mini-game slot" },
    { id: "pipe", label: "Pipe Grid", weight: 1, icon: "🧩", hint: "Pipe mini-game slot" },
    { id: "plant", label: "Plant Care", weight: 1, icon: "🌱", hint: "Plant mini-game slot" }
  ].map(buildGame);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = miniGames;
  }
  if (typeof window !== "undefined") {
    window.MiniGames = miniGames;
  }
}());
