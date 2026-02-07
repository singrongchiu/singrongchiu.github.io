(function () {
  "use strict";

  var RECIPE = {
    required: ["eggs", "milk"],
    bowl: "bowl"
  };

  var STARTING_ITEMS = [
    { id: "eggs", name: "Eggs", type: "ingredient", state: "raw", zone: "counter" },
    { id: "milk", name: "Milk", type: "ingredient", state: "cold", zone: "counter" },
    { id: "bowl", name: "Bowl", type: "tool", zone: "counter" }
  ];

  var ITEM_VISUALS = {
    eggs: { icon: "🥚", name: "Eggs" },
    milk: { icon: "🥛", name: "Milk" },
    bowl: { icon: "🥣", name: "Bowl" }
  };

  function cloneItem(item) {
    return {
      id: String(item.id),
      name: String(item.name || item.id),
      type: String(item.type || "ingredient"),
      state: item.state ? String(item.state) : "",
      zone: item.zone === "work" ? "work" : "counter"
    };
  }

  function createInitialItems() {
    return STARTING_ITEMS.map(cloneItem).map(function (item, index) {
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

  function isRequiredIngredient(itemId) {
    return RECIPE.required.indexOf(String(itemId)) >= 0;
  }

  function createCookingGame() {
    return {
      id: "cooking",
      label: "🍳",
      weight: 1,
      playable: true,
      render: function (mount, ctx) {
        var callbacks = ctx || {};
        var onSuccess = typeof callbacks.onSuccess === "function" ? callbacks.onSuccess : function () {};
        var burstConfetti = typeof callbacks.burstConfetti === "function" ? callbacks.burstConfetti : function () {};

        var items = createInitialItems().filter(function (item) {
          return item.id !== RECIPE.bowl;
        });
        var added = { eggs: false, milk: false };
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

        var parentCard = mount.parentNode;
        var hintNode = parentCard ? parentCard.querySelector(".hint") : null;
        var headNode = parentCard ? parentCard.querySelector(".card-head") : null;
        var previousHintText = hintNode ? hintNode.textContent : "";
        var previousHeadText = headNode ? headNode.textContent : "";

        if (hintNode) {
          hintNode.textContent = "";
        }
        if (headNode) {
          headNode.textContent = "🍳";
        }

        mount.innerHTML =
          "<div class='cooking-game cooking-game-icons'>" +
          "<div class='cooking-scene'>" +
          "<div class='cooking-counter'></div>" +
          "<div class='cooking-bowl-wrap'>" +
          "<button type='button' class='cooking-bowl' data-bowl='1' aria-label='Bowl'>" +
          "<span class='cooking-bowl-main'>🥣</span>" +
          "<span class='cooking-bowl-fill'></span>" +
          "</button>" +
          "<div class='cooking-bowl-slots'>" +
          "<span class='cooking-slot' data-slot='eggs'></span>" +
          "<span class='cooking-slot' data-slot='milk'></span>" +
          "</div>" +
          "</div>" +
          "</div>" +
          "<div class='cooking-recipe-bottom'>" +
          "<span class='recipe-dot recipe-egg'>🥚</span>" +
          "<span class='recipe-plus'>+</span>" +
          "<span class='recipe-dot recipe-milk'>🥛</span>" +
          "<span class='recipe-arrow'>→</span>" +
          "<span class='recipe-dot recipe-bowl'>🥣</span>" +
          "</div>" +
          "</div>";

        var counterNode = mount.querySelector(".cooking-counter");
        var gameNode = mount.querySelector(".cooking-game");
        var recipeBottomNode = mount.querySelector(".cooking-recipe-bottom");
        var bowlNode = mount.querySelector(".cooking-bowl");
        var bowlFillNode = mount.querySelector(".cooking-bowl-fill");
        var bowlSlotsNode = mount.querySelector(".cooking-bowl-slots");
        var eggSlotNode = mount.querySelector(".cooking-slot[data-slot='eggs']");
        var milkSlotNode = mount.querySelector(".cooking-slot[data-slot='milk']");
        var recipeEggNode = mount.querySelector(".recipe-egg");
        var recipeMilkNode = mount.querySelector(".recipe-milk");

        function findItem(instanceId) {
          var i = 0;
          for (i = 0; i < items.length; i += 1) {
            if (items[i].instanceId === instanceId) {
              return items[i];
            }
          }
          return null;
        }

        function removeItem(instanceId) {
          items = items.filter(function (item) {
            return item.instanceId !== instanceId;
          });
        }

        function renderItems() {
          counterNode.innerHTML = items.map(function (item) {
            var classes = "cooking-item";
            if (item.instanceId === selectedId) {
              classes += " is-selected";
            }
            var visual = getItemVisual(item.id, item.name);
            return (
              "<button type='button' class='" + classes + "' data-item='" + item.instanceId + "'>" +
              "<span class='cooking-item-icon'>" + visual.icon + "</span>" +
              "</button>"
            );
          }).join("");
        }

        function renderBowl() {
          var level = (added.eggs ? 1 : 0) + (added.milk ? 1 : 0);
          var growBowl = !done;
          if (gameNode) {
            gameNode.classList.toggle("is-complete", done);
          }
          if (recipeBottomNode) {
            recipeBottomNode.setAttribute("aria-hidden", done ? "true" : "false");
          }
          bowlNode.classList.toggle("is-stage-1", growBowl && level === 1);
          bowlNode.classList.toggle("is-stage-2", growBowl && level === 2);
          eggSlotNode.classList.toggle("is-added", added.eggs);
          milkSlotNode.classList.toggle("is-added", added.milk);
          recipeEggNode.classList.toggle("is-added", added.eggs);
          recipeMilkNode.classList.toggle("is-added", added.milk);
          bowlSlotsNode.classList.toggle("is-hidden", done);

          if (done) {
            bowlFillNode.innerHTML = "<span class='cooking-fill-dot'>🥚</span><span class='cooking-fill-dot'>🥛</span><span class='cooking-fill-dot'>✨</span>";
            return;
          }
          if (added.eggs) {
            bowlFillNode.innerHTML = "<span class='cooking-fill-dot'>🥚</span>";
            return;
          }
          if (added.milk) {
            bowlFillNode.innerHTML = "<span class='cooking-fill-dot'>🥛</span>";
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
          if (!done && added.eggs && added.milk) {
            done = true;
            renderBowl();
            burstConfetti();
            window.setTimeout(function () {
              onSuccess();
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
          if (!isRequiredIngredient(item.id)) {
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
          removeItem(item.instanceId);
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
          if (hintNode) {
            hintNode.textContent = previousHintText;
          }
          if (headNode) {
            headNode.textContent = previousHeadText;
          }
        };
      }
    };
  }

  var api = {
    RECIPE: RECIPE,
    STARTING_ITEMS: STARTING_ITEMS,
    createInitialItems: createInitialItems,
    isRequiredIngredient: isRequiredIngredient,
    createCookingGame: createCookingGame
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.CookingMiniGame = api;
  }
}());
