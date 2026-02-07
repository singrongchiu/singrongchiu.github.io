(function () {
  "use strict";

  var SAMPLE_RECIPE = {
    id: "pancakes",
    name: "Pancakes",
    steps: [
      {
        inputs: ["flour", "eggs"],
        output: { id: "batter", name: "Batter", type: "ingredient", state: "mixed", zone: "work" },
        visualProgress: "Batter mixed"
      },
      {
        inputs: ["batter", "pan"],
        output: { id: "hot_batter", name: "Hot Batter", type: "ingredient", state: "heated", zone: "work" },
        visualProgress: "Batter heating"
      },
      {
        inputs: ["hot_batter", "spatula"],
        output: { id: "pancakes_done", name: "Pancakes", type: "ingredient", state: "finished", zone: "work" },
        visualProgress: "Dish complete"
      }
    ]
  };

  var STARTING_ITEMS = [
    { id: "flour", name: "Flour", type: "ingredient", state: "raw", zone: "counter" },
    { id: "eggs", name: "Eggs", type: "ingredient", state: "raw", zone: "counter" },
    { id: "pan", name: "Pan", type: "tool", zone: "counter" },
    { id: "spatula", name: "Spatula", type: "tool", zone: "counter" }
  ];

  function cloneItem(item) {
    return {
      id: String(item.id),
      name: String(item.name),
      type: String(item.type || "ingredient"),
      state: item.state ? String(item.state) : "",
      zone: item.zone === "work" ? "work" : "counter"
    };
  }

  function createInitialItems() {
    return STARTING_ITEMS.map(cloneItem);
  }

  function getCurrentStep(recipe, stepIndex) {
    if (!recipe || !Array.isArray(recipe.steps)) {
      return null;
    }
    return recipe.steps[stepIndex] || null;
  }

  function isMatchingStep(step, firstId, secondId) {
    if (!step || !Array.isArray(step.inputs) || step.inputs.length !== 2) {
      return false;
    }
    var a = String(firstId);
    var b = String(secondId);
    var s0 = String(step.inputs[0]);
    var s1 = String(step.inputs[1]);
    return (a === s0 && b === s1) || (a === s1 && b === s0);
  }

  function createCookingGame() {
    return {
      id: "cooking",
      label: "Ingredient Combining",
      weight: 1,
      playable: true,
      render: function (mount, ctx) {
        var callbacks = ctx || {};
        var onSuccess = typeof callbacks.onSuccess === "function"
          ? callbacks.onSuccess
          : function () {};

        var recipe = SAMPLE_RECIPE;
        var items = createInitialItems();
        var stepIndex = 0;
        var selectedId = "";
        var done = false;

        mount.innerHTML =
          "<div class='cooking-game'>" +
          "<div class='cooking-recipe'></div>" +
          "<div class='cooking-progress'></div>" +
          "<div class='cooking-zones'>" +
          "<div class='cooking-zone'>" +
          "<div class='cooking-zone-title'>Counter</div>" +
          "<div class='cooking-items' data-zone='counter'></div>" +
          "</div>" +
          "<div class='cooking-zone'>" +
          "<div class='cooking-zone-title'>Work Area</div>" +
          "<div class='cooking-items' data-zone='work'></div>" +
          "</div>" +
          "</div>" +
          "<div class='chip cooking-chip'>Tap two items to combine</div>" +
          "</div>";

        var recipeNode = mount.querySelector(".cooking-recipe");
        var progressNode = mount.querySelector(".cooking-progress");
        var counterNode = mount.querySelector(".cooking-items[data-zone='counter']");
        var workNode = mount.querySelector(".cooking-items[data-zone='work']");
        var hintNode = mount.querySelector(".cooking-chip");

        function findItem(itemId) {
          var i = 0;
          for (i = 0; i < items.length; i += 1) {
            if (items[i].id === itemId) {
              return items[i];
            }
          }
          return null;
        }

        function removeItem(itemId) {
          items = items.filter(function (item) {
            return item.id !== itemId;
          });
        }

        function spawnItem(item) {
          items.push(cloneItem(item));
        }

        function renderRecipe() {
          var stepsHtml = recipe.steps.map(function (step, i) {
            var classes = "cooking-step";
            if (i < stepIndex) {
              classes += " is-done";
            } else if (i === stepIndex) {
              classes += " is-next";
            }
            return (
              "<li class='" + classes + "'>" +
              "<span>" + step.inputs.join(" + ") + "</span>" +
              "<span>" + step.output.name + "</span>" +
              "</li>"
            );
          }).join("");

          recipeNode.innerHTML =
            "<div class='cooking-recipe-title'>Recipe: " + recipe.name + "</div>" +
            "<ol class='cooking-step-list'>" + stepsHtml + "</ol>";
        }

        function renderItems() {
          function renderZone(zoneNode, zoneName) {
            var list = items.filter(function (item) {
              return item.zone === zoneName;
            });
            zoneNode.innerHTML = list.map(function (item) {
              var classes = "cooking-item";
              if (item.id === selectedId) {
                classes += " is-selected";
              }
              return (
                "<button type='button' class='" + classes + "' data-item='" + item.id + "'>" +
                "<span class='cooking-item-name'>" + item.name + "</span>" +
                "<span class='cooking-item-meta'>" + item.type + (item.state ? (" | " + item.state) : "") + "</span>" +
                "</button>"
              );
            }).join("");
          }

          renderZone(counterNode, "counter");
          renderZone(workNode, "work");
        }

        function renderProgress(message) {
          progressNode.textContent = "Dish Progress: " + stepIndex + "/" + recipe.steps.length;
          if (done) {
            hintNode.textContent = "Dish Complete!";
          } else if (message) {
            hintNode.textContent = message;
          } else {
            hintNode.textContent = "Tap two items to combine";
          }
        }

        function shakeItems(firstId, secondId) {
          var nodes = mount.querySelectorAll(".cooking-item");
          Array.prototype.forEach.call(nodes, function (node) {
            var id = node.getAttribute("data-item");
            if (id === firstId || id === secondId) {
              node.classList.remove("is-shaking");
              node.offsetWidth;
              node.classList.add("is-shaking");
            }
          });
        }

        function completeIfDone() {
          if (!done && stepIndex >= recipe.steps.length) {
            done = true;
            renderRecipe();
            renderItems();
            renderProgress("Dish Complete!");
            onSuccess();
          }
        }

        function tryCombine(firstId, secondId) {
          var step = getCurrentStep(recipe, stepIndex);
          if (!step || done) {
            return;
          }
          if (!findItem(firstId) || !findItem(secondId) || firstId === secondId) {
            return;
          }
          if (!isMatchingStep(step, firstId, secondId)) {
            shakeItems(firstId, secondId);
            renderProgress("That doesn't go together yet.");
            return;
          }

          removeItem(firstId);
          removeItem(secondId);
          spawnItem(step.output);
          stepIndex += 1;
          renderRecipe();
          renderItems();
          renderProgress(step.visualProgress || "Step complete");
          completeIfDone();
        }

        function onItemClick(evt) {
          var target = evt.target;
          while (target && target !== mount && !target.classList.contains("cooking-item")) {
            target = target.parentNode;
          }
          if (!target || target === mount || done) {
            return;
          }
          var itemId = target.getAttribute("data-item");
          if (!itemId) {
            return;
          }
          if (selectedId === itemId) {
            selectedId = "";
            renderItems();
            return;
          }
          if (!selectedId) {
            selectedId = itemId;
            renderItems();
            return;
          }
          var first = selectedId;
          selectedId = "";
          tryCombine(first, itemId);
          renderItems();
        }

        mount.addEventListener("click", onItemClick);
        renderRecipe();
        renderItems();
        renderProgress("");

        return function cleanup() {
          mount.removeEventListener("click", onItemClick);
        };
      }
    };
  }

  var api = {
    SAMPLE_RECIPE: SAMPLE_RECIPE,
    STARTING_ITEMS: STARTING_ITEMS,
    createInitialItems: createInitialItems,
    getCurrentStep: getCurrentStep,
    isMatchingStep: isMatchingStep,
    createCookingGame: createCookingGame
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.CookingMiniGame = api;
  }
}());
