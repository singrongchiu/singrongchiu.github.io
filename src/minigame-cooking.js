(function () {
  "use strict";

  var RECIPES = [
    {
      id: "omelet",
      required: ["eggs", "milk"],
      available: ["eggs", "milk", "flour"],
      bowl: "bowl"
    },
    {
      id: "salad",
      required: ["tomato", "lettuce"],
      available: ["tomato", "lettuce", "cheese"],
      bowl: "bowl"
    },
    {
      id: "smoothie",
      required: ["banana", "berries"],
      available: ["banana", "berries", "spinach"],
      bowl: "bowl"
    }
  ];

  var RECIPE = RECIPES[0];

  var ITEM_LIBRARY = {
    eggs: { id: "eggs", name: "Eggs", type: "ingredient", state: "raw", zone: "counter" },
    milk: { id: "milk", name: "Milk", type: "ingredient", state: "cold", zone: "counter" },
    flour: { id: "flour", name: "Flour", type: "ingredient", state: "dry", zone: "counter" },
    tomato: { id: "tomato", name: "Tomato", type: "ingredient", state: "fresh", zone: "counter" },
    lettuce: { id: "lettuce", name: "Lettuce", type: "ingredient", state: "fresh", zone: "counter" },
    cheese: { id: "cheese", name: "Cheese", type: "ingredient", state: "sliced", zone: "counter" },
    banana: { id: "banana", name: "Banana", type: "ingredient", state: "ripe", zone: "counter" },
    berries: { id: "berries", name: "Berries", type: "ingredient", state: "fresh", zone: "counter" },
    spinach: { id: "spinach", name: "Spinach", type: "ingredient", state: "fresh", zone: "counter" },
    bowl: { id: "bowl", name: "Bowl", type: "tool", state: "", zone: "counter" }
  };

  var ITEM_VISUALS = {
    eggs: { icon: "🥚", name: "Eggs" },
    milk: { icon: "🥛", name: "Milk" },
    flour: { icon: "🌾", name: "Flour" },
    tomato: { icon: "🍅", name: "Tomato" },
    lettuce: { icon: "🥬", name: "Lettuce" },
    cheese: { icon: "🧀", name: "Cheese" },
    banana: { icon: "🍌", name: "Banana" },
    berries: { icon: "🫐", name: "Berries" },
    spinach: { icon: "🥗", name: "Spinach" },
    bowl: { icon: "🥣", name: "Bowl" }
  };

  function cloneItem(item) {
    return {
      id: String(item.id),
      name: String(item.name || item.id),
      type: String(item.type || "ingredient"),
      state: item.state ? String(item.state) : "",
      zone: item.zone === "work" ? "work" : "counter",
      consumed: item.consumed === true
    };
  }

  function isValidRecipe(recipe) {
    if (!recipe || typeof recipe !== "object") {
      return false;
    }
    if (!Array.isArray(recipe.required) || recipe.required.length !== 2) {
      return false;
    }
    if (!Array.isArray(recipe.available) || recipe.available.length !== 3) {
      return false;
    }
    return recipe.required.every(function (id) {
      return recipe.available.indexOf(String(id)) >= 0;
    });
  }

  function normalizeRecipe(recipe) {
    if (isValidRecipe(recipe)) {
      return recipe;
    }
    return RECIPE;
  }

  function createStartingItems(recipe) {
    var activeRecipe = normalizeRecipe(recipe);
    var ingredients = activeRecipe.available.map(function (itemId) {
      var known = ITEM_LIBRARY[String(itemId)];
      if (known) {
        return cloneItem(known);
      }
      return {
        id: String(itemId),
        name: String(itemId),
        type: "ingredient",
        state: "",
        zone: "counter"
      };
    });
    var bowlId = String(activeRecipe.bowl || "bowl");
    var bowlItem = ITEM_LIBRARY[bowlId] || ITEM_LIBRARY.bowl;
    ingredients.push(cloneItem(bowlItem));
    return ingredients;
  }

  var STARTING_ITEMS = createStartingItems(RECIPE);

  function createInitialItems(recipe) {
    return createStartingItems(recipe).map(cloneItem).map(function (item, index) {
      item.instanceId = "start_" + String(index + 1);
      return item;
    });
  }

  function getItemVisual(itemId, fallbackName) {
    var found = ITEM_VISUALS[String(itemId)] || null;
    return {
      icon: found ? found.icon : "🍽️",
      name: found ? found.name : String(fallbackName || itemId || "Item")
    };
  }

  function isRequiredIngredient(itemId, recipe) {
    var activeRecipe = normalizeRecipe(recipe);
    return activeRecipe.required.indexOf(String(itemId)) >= 0;
  }

  function pickRandomRecipe() {
    if (!RECIPES.length) {
      return RECIPE;
    }
    var index = Math.floor(Math.random() * RECIPES.length);
    return normalizeRecipe(RECIPES[index]);
  }

  function shuffleItems(list) {
    var shuffled = Array.isArray(list) ? list.slice() : [];
    var i = 0;
    for (i = shuffled.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return shuffled;
  }

  function createMiniGamePlugin() {
    return {
      id: "cooking",
      title: "🍳",
      initialWeight: 1,
      timing: {
        roundMs: 20000
      },
      mount: function (mount, engine) {
        var api = engine || {};
        var complete = typeof api.complete === "function" ? api.complete : function () {};
        var registerControl = typeof api.registerControl === "function"
          ? api.registerControl
          : function () {};
        var burstConfetti = api.effects && typeof api.effects.confetti === "function"
          ? api.effects.confetti
          : function () {};

        var activeRecipe = pickRandomRecipe();
        var requiredA = activeRecipe.required[0];
        var requiredB = activeRecipe.required[1];
        var requiredVisualA = getItemVisual(requiredA, requiredA);
        var requiredVisualB = getItemVisual(requiredB, requiredB);

        var items = shuffleItems(
          createInitialItems(activeRecipe).filter(function (item) {
            return item.id !== activeRecipe.bowl;
          })
        );
        var added = {};
        added[requiredA] = false;
        added[requiredB] = false;

        var selectedId = "";
        var done = false;
        var drag = {
          active: false,
          pointerId: -1,
          itemId: "",
          ghost: null,
          ghostX: 0,
          ghostY: 0,
          ghostFrame: 0,
          bowlHot: false
        };

        mount.innerHTML =
          "<div class='cooking-game cooking-game-icons'>" +
          "<div class='cooking-recipe-bottom'>" +
          "<span class='recipe-dot recipe-required-1'>" + requiredVisualA.icon + "</span>" +
          "<span class='recipe-plus'>+</span>" +
          "<span class='recipe-dot recipe-required-2'>" + requiredVisualB.icon + "</span>" +
          "<span class='recipe-arrow'>→</span>" +
          "<span class='recipe-dot recipe-bowl'>🥣</span>" +
          "</div>" +
          "<div class='chip mini-instruction cooking-chip'>Drag " + requiredVisualA.name.toLowerCase() + " and " + requiredVisualB.name.toLowerCase() + " into the bowl</div>" +
          "<div class='cooking-scene'>" +
          "<div class='cooking-counter'></div>" +
          "<div class='cooking-bowl-wrap'>" +
          "<button type='button' class='cooking-bowl' data-bowl='1' aria-label='Bowl'>" +
          "<span class='cooking-bowl-main'>🥣</span>" +
          "<span class='cooking-bowl-fill'></span>" +
          "</button>" +
          "</div>" +
          "</div>" +
          "</div>";

        var counterNode = mount.querySelector(".cooking-counter");
        var gameNode = mount.querySelector(".cooking-game");
        var recipeBottomNode = mount.querySelector(".cooking-recipe-bottom");
        var bowlNode = mount.querySelector(".cooking-bowl");
        var bowlFillNode = mount.querySelector(".cooking-bowl-fill");
        var recipeRequiredANode = mount.querySelector(".recipe-required-1");
        var recipeRequiredBNode = mount.querySelector(".recipe-required-2");
        registerControl(counterNode, { allowSwipeSkip: true });
        registerControl(bowlNode, { allowSwipeSkip: true });

        function findItem(instanceId) {
          var i = 0;
          for (i = 0; i < items.length; i += 1) {
            if (items[i].instanceId === instanceId) {
              return items[i];
            }
          }
          return null;
        }

        function consumeItem(instanceId) {
          var item = findItem(instanceId);
          if (!item) {
            return;
          }
          item.consumed = true;
        }

        function renderItems() {
          counterNode.innerHTML = items.map(function (item) {
            var classes = "cooking-item";
            if (item.instanceId === selectedId) {
              classes += " is-selected";
            }
            if (item.consumed) {
              classes += " is-consumed";
            }
            var visual = getItemVisual(item.id, item.name);
            var isHidden = item.consumed;
            return (
              "<button type='button' class='" + classes + "' data-item='" + item.instanceId + "'" + (isHidden ? " aria-hidden='true' disabled='disabled'" : "") + ">" +
              "<span class='cooking-item-icon'>" + (isHidden ? "" : visual.icon) + "</span>" +
              "</button>"
            );
          }).join("");
        }

        function renderBowl() {
          var level = (added[requiredA] ? 1 : 0) + (added[requiredB] ? 1 : 0);
          var growBowl = level > 0;
          if (gameNode) {
            gameNode.classList.toggle("is-complete", done);
          }
          if (recipeBottomNode) {
            recipeBottomNode.setAttribute("aria-hidden", done ? "true" : "false");
          }
          bowlNode.classList.toggle("is-stage-1", growBowl && level === 1);
          bowlNode.classList.toggle("is-stage-2", growBowl && level === 2);
          recipeRequiredANode.classList.toggle("is-added", added[requiredA]);
          recipeRequiredBNode.classList.toggle("is-added", added[requiredB]);

          if (done) {
            bowlFillNode.innerHTML = "<span class='cooking-fill-dot'>" + requiredVisualA.icon + "</span><span class='cooking-fill-dot'>" + requiredVisualB.icon + "</span><span class='cooking-fill-dot'>✨</span>";
            return;
          }
          if (added[requiredA]) {
            bowlFillNode.innerHTML = "<span class='cooking-fill-dot'>" + requiredVisualA.icon + "</span>";
            return;
          }
          if (added[requiredB]) {
            bowlFillNode.innerHTML = "<span class='cooking-fill-dot'>" + requiredVisualB.icon + "</span>";
            return;
          }
          bowlFillNode.innerHTML = "";
        }

        function pointInsideRect(point, rect) {
          return (
            point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.top &&
            point.y <= rect.bottom
          );
        }

        function inflateRect(rect, pad) {
          return {
            left: rect.left - pad,
            right: rect.right + pad,
            top: rect.top - pad,
            bottom: rect.bottom + pad
          };
        }

        function ensureGhost() {
          if (drag.ghost) {
            return drag.ghost;
          }
          var node = document.createElement("span");
          node.className = "cooking-drag-ghost";
          mount.appendChild(node);
          drag.ghost = node;
          return node;
        }

        function moveGhost(clientX, clientY) {
          if (!drag.active) {
            return;
          }
          var rect = mount.getBoundingClientRect();
          drag.ghostX = clientX - rect.left;
          drag.ghostY = clientY - rect.top;
          if (drag.ghostFrame) {
            return;
          }
          drag.ghostFrame = window.requestAnimationFrame(function () {
            var ghost = ensureGhost();
            ghost.style.transform = "translate3d(" + drag.ghostX + "px, " + drag.ghostY + "px, 0) translate(-50%, -50%)";
            drag.ghostFrame = 0;
          });
        }

        function clearDragState() {
          if (drag.ghostFrame) {
            window.cancelAnimationFrame(drag.ghostFrame);
            drag.ghostFrame = 0;
          }
          drag.active = false;
          drag.pointerId = -1;
          drag.itemId = "";
          drag.bowlHot = false;
          bowlNode.classList.remove("is-drop-target");
          if (drag.ghost) {
            drag.ghost.remove();
          }
          drag.ghost = null;
        }

        function startDrag(instanceId, icon, pointerId, clientX, clientY) {
          drag.active = true;
          drag.pointerId = pointerId;
          drag.itemId = instanceId;
          selectedId = instanceId;
          renderItems();
          var ghost = ensureGhost();
          ghost.textContent = icon;
          moveGhost(clientX, clientY);
        }

        function maybeCompleteRecipe() {
          if (!done && added[requiredA] && added[requiredB]) {
            done = true;
            renderBowl();
            burstConfetti();
            window.setTimeout(function () {
              complete();
            }, 350);
          }
        }

        function tryDropIntoBowl(instanceId) {
          if (done) {
            return;
          }
          var item = findItem(instanceId);
          if (!item) {
            return;
          }
          if (!isRequiredIngredient(item.id, activeRecipe)) {
            selectedId = "";
            renderItems();
            return;
          }
          if (added[item.id]) {
            selectedId = "";
            renderItems();
            return;
          }
          added[item.id] = true;
          consumeItem(item.instanceId);
          selectedId = "";
          renderItems();
          renderBowl();
          maybeCompleteRecipe();
        }

        function onPointerDown(evt) {
          if (done) {
            return;
          }
          if (evt.pointerType === "mouse" && evt.button !== 0) {
            return;
          }
          var target = evt.target;
          while (target && target !== mount && !target.classList.contains("cooking-item")) {
            target = target.parentNode;
          }
          if (!target || target === mount) {
            return;
          }
          var instanceId = target.getAttribute("data-item");
          if (!instanceId) {
            return;
          }
          var item = findItem(instanceId);
          if (!item) {
            return;
          }
          if (item.consumed) {
            return;
          }
          var visual = getItemVisual(item.id, item.name);
          if (typeof target.setPointerCapture === "function") {
            try {
              target.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore capture failures.
            }
          }
          evt.preventDefault();
          startDrag(instanceId, visual.icon, evt.pointerId, evt.clientX, evt.clientY);
        }

        function onPointerMove(evt) {
          if (!drag.active || drag.pointerId !== evt.pointerId) {
            return;
          }
          evt.preventDefault();
          moveGhost(evt.clientX, evt.clientY);
          var hotRect = inflateRect(bowlNode.getBoundingClientRect(), 18);
          var isHot = pointInsideRect({ x: evt.clientX, y: evt.clientY }, hotRect);
          if (isHot !== drag.bowlHot) {
            drag.bowlHot = isHot;
            bowlNode.classList.toggle("is-drop-target", isHot);
          }
        }

        function onPointerUp(evt) {
          if (!drag.active || drag.pointerId !== evt.pointerId) {
            return;
          }
          evt.preventDefault();
          var bowlRect = inflateRect(bowlNode.getBoundingClientRect(), 18);
          if (pointInsideRect({ x: evt.clientX, y: evt.clientY }, bowlRect)) {
            tryDropIntoBowl(drag.itemId);
          } else {
            selectedId = "";
            renderItems();
          }
          clearDragState();
        }

        function onPointerCancel(evt) {
          if (!drag.active || drag.pointerId !== evt.pointerId) {
            return;
          }
          evt.preventDefault();
          selectedId = "";
          renderItems();
          clearDragState();
        }

        mount.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerCancel);

        renderItems();
        renderBowl();

        return function cleanup() {
          mount.removeEventListener("pointerdown", onPointerDown);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerCancel);
          clearDragState();
        };
      }
    };
  }

  var api = {
    RECIPES: RECIPES,
    RECIPE: RECIPE,
    STARTING_ITEMS: STARTING_ITEMS,
    createInitialItems: createInitialItems,
    isRequiredIngredient: isRequiredIngredient,
    createMiniGamePlugin: createMiniGamePlugin
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.CookingMiniGame = api;
  }
}());
