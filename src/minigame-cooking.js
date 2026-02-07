(function () {
  "use strict";

  var SAMPLE_RECIPE = {
    id: "mix_bowl",
    name: "",
    finalDishId: "mix_done",
    steps: [
      {
        id: "add_egg",
        inputs: ["eggs", "bowl"],
        output: { id: "bowl_egg", name: "", type: "ingredient", state: "partial", zone: "work" },
        visualProgress: "",
        consumesInputs: ["eggs"]
      },
      {
        id: "add_milk",
        inputs: ["milk", "bowl_egg"],
        output: { id: "mix_done", name: "", type: "ingredient", state: "finished", zone: "work" },
        visualProgress: "",
        consumesInputs: ["milk"]
      }
    ]
  };

  var STARTING_ITEMS = [
    { id: "eggs", name: "Eggs", type: "ingredient", state: "raw", zone: "counter" },
    { id: "milk", name: "Milk", type: "ingredient", state: "cold", zone: "counter" },
    { id: "bowl", name: "Bowl", type: "tool", zone: "counter" }
  ];
  var ITEM_VISUALS = {
    eggs: { icon: "🥚", name: "Eggs" },
    milk: { icon: "🥛", name: "Milk" },
    bowl: { icon: "🥣", name: "Bowl" },
    bowl_egg: { icon: "🍳", name: "Egg Bowl" },
    mix_done: { icon: "🍯", name: "Mix" }
  };

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
    return STARTING_ITEMS.map(cloneItem).map(function (item, index) {
      item.instanceId = "start_" + String(index + 1);
      return item;
    });
  }

  function getVisualForItemId(itemId, fallbackName) {
    var id = String(itemId || "");
    var found = ITEM_VISUALS[id] || null;
    return {
      icon: found ? found.icon : "🍽️",
      name: found ? found.name : String(fallbackName || id || "Item")
    };
  }

  function normalizeStepState(recipe) {
    if (!recipe || !Array.isArray(recipe.steps)) {
      return [];
    }
    return recipe.steps.map(function (step, index) {
      var requiredCount = Number(step && step.requiredCount);
      return {
        id: (step && step.id) ? String(step.id) : ("step_" + String(index + 1)),
        completedCount: 0,
        requiredCount: Number.isFinite(requiredCount) && requiredCount > 0 ? Math.floor(requiredCount) : 1,
        repeatable: Boolean(step && step.repeatable)
      };
    });
  }

  function getStepById(recipe, stepId) {
    if (!recipe || !Array.isArray(recipe.steps)) {
      return null;
    }
    return recipe.steps.find(function (step, index) {
      var id = (step && step.id) ? String(step.id) : ("step_" + String(index + 1));
      return id === stepId;
    }) || null;
  }

  function isStepIncomplete(stepState) {
    if (!stepState) {
      return false;
    }
    return Number(stepState.completedCount) < Number(stepState.requiredCount);
  }

  function isStepCompleted(stepState) {
    if (!stepState) {
      return false;
    }
    return !isStepIncomplete(stepState);
  }

  function areAllStepsCompleted(stepStates) {
    var list = Array.isArray(stepStates) ? stepStates : [];
    if (!list.length) {
      return false;
    }
    return list.every(function (stepState) {
      return isStepCompleted(stepState);
    });
  }

  function findMatchingStepState(recipe, stepStates, firstDefId, secondDefId) {
    var states = Array.isArray(stepStates) ? stepStates : [];
    var i = 0;
    for (i = 0; i < states.length; i += 1) {
      var stepState = states[i];
      var step = getStepById(recipe, stepState.id);
      if (!step || !isStepIncomplete(stepState)) {
        continue;
      }
      if (isMatchingStep(step, firstDefId, secondDefId)) {
        return stepState;
      }
    }
    return null;
  }

  function getConsumedInstanceIds(step, firstItem, secondItem) {
    var consumeRule = step && step.consumesInputs;
    if (consumeRule === false) {
      return [];
    }
    if (Array.isArray(consumeRule)) {
      return [firstItem, secondItem]
        .filter(function (item) {
          return item && consumeRule.indexOf(item.id) >= 0;
        })
        .map(function (item) {
          return item.instanceId;
        });
    }
    return [firstItem.instanceId, secondItem.instanceId];
  }

  function hasItemDefinition(items, itemDefId) {
    var list = Array.isArray(items) ? items : [];
    return list.some(function (item) {
      return item.id === itemDefId;
    });
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
      label: "🍳",
      weight: 1,
      playable: true,
      render: function (mount, ctx) {
        var callbacks = ctx || {};
        var onSuccess = typeof callbacks.onSuccess === "function"
          ? callbacks.onSuccess
          : function () {};
        var items = createInitialItems().filter(function (item) {
          return item.id === "eggs" || item.id === "milk";
        });
        var bowlHasEgg = false;
        var bowlHasMilk = false;
        var bowlContents = [];
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
          "<span class='cooking-slot' data-slot='eggs'>🥚</span>" +
          "<span class='cooking-slot' data-slot='milk'>🥛</span>" +
          "</div>" +
          "</div>" +
          "</div>" +
          "<button type='button' class='btn cooking-continue is-hidden' aria-label='Continue'>▶</button>" +
          "</div>";
        var counterNode = mount.querySelector(".cooking-counter");
        var bowlNode = mount.querySelector(".cooking-bowl");
        var bowlMainNode = mount.querySelector(".cooking-bowl-main");
        var bowlFillNode = mount.querySelector(".cooking-bowl-fill");
        var eggSlotNode = mount.querySelector(".cooking-slot[data-slot='eggs']");
        var milkSlotNode = mount.querySelector(".cooking-slot[data-slot='milk']");
        var continueButton = mount.querySelector(".cooking-continue");

        function findItem(itemId) {
          var i = 0;
          for (i = 0; i < items.length; i += 1) {
            if (items[i].instanceId === itemId) {
              return items[i];
            }
          }
          return null;
        }

        function removeItem(itemId) {
          items = items.filter(function (item) {
            return item.instanceId !== itemId;
          });
        }

        function renderItems() {
          counterNode.innerHTML = items.map(function (item) {
            var classes = "cooking-item";
            if (item.instanceId === selectedId) {
              classes += " is-selected";
            }
            var visual = getVisualForItemId(item.id, item.name);
            return (
              "<button type='button' class='" + classes + "' data-item='" + item.instanceId + "'>" +
              "<span class='cooking-item-icon'>" + visual.icon + "</span>" +
              "</button>"
            );
          }).join("");
        }

        function renderBowl() {
          var level = (bowlHasEgg ? 1 : 0) + (bowlHasMilk ? 1 : 0);
          bowlNode.classList.toggle("is-stage-1", level === 1);
          bowlNode.classList.toggle("is-stage-2", level === 2);
          eggSlotNode.classList.toggle("is-added", bowlHasEgg);
          milkSlotNode.classList.toggle("is-added", bowlHasMilk);
          bowlMainNode.textContent = "🥣";
          if (!bowlContents.length) {
            bowlFillNode.innerHTML = "";
            return;
          }
          bowlFillNode.innerHTML = bowlContents.map(function (icon) {
            return "<span class='cooking-fill-dot'>" + icon + "</span>";
          }).join("");
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

        function startDrag(itemId, icon, pointerId, clientX, clientY) {
          drag.active = true;
          drag.pointerId = pointerId;
          drag.itemId = itemId;
          drag.bowlHot = false;
          bowlNode.classList.remove("is-drop-target");
          selectedId = itemId;
          renderItems();
          var ghost = ensureGhost();
          ghost.textContent = icon;
          moveGhost(clientX, clientY);
        }

        function tryDropIntoBowl(itemId) {
          if (done) {
            return;
          }
          var item = findItem(itemId);
          if (!item) {
            return;
          }
          if (item.id === "eggs" && !bowlHasEgg) {
            bowlHasEgg = true;
            bowlContents.push("🥚", "🥚");
            removeItem(item.instanceId);
            selectedId = "";
            renderItems();
            renderBowl();
          } else if (item.id === "milk" && !bowlHasMilk) {
            bowlHasMilk = true;
            bowlContents.push("🥛", "🥛");
            removeItem(item.instanceId);
            selectedId = "";
            renderItems();
            renderBowl();
          } else {
            shakeItems(item.instanceId, "");
            return;
          }
          if (bowlHasEgg && bowlHasMilk) {
            done = true;
            bowlContents.push("✨");
            renderBowl();
            continueButton.classList.remove("is-hidden");
          }
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
          var itemId = target.getAttribute("data-item");
          if (!itemId) {
            return;
          }
          var item = findItem(itemId);
          if (!item) {
            return;
          }
          var visual = getVisualForItemId(item.id, item.name);
          if (typeof target.setPointerCapture === "function") {
            try {
              target.setPointerCapture(evt.pointerId);
            } catch (err) {
              // Ignore capture failures.
            }
          }
          evt.preventDefault();
          startDrag(itemId, visual.icon, evt.pointerId, evt.clientX, evt.clientY);
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
          var didDropInBowl = pointInsideRect({ x: evt.clientX, y: evt.clientY }, bowlRect);
          if (didDropInBowl) {
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
        continueButton.addEventListener("click", onSuccess);
        renderItems();
        renderBowl();

        return function cleanup() {
          mount.removeEventListener("pointerdown", onPointerDown);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerCancel);
          continueButton.removeEventListener("click", onSuccess);
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
    SAMPLE_RECIPE: SAMPLE_RECIPE,
    STARTING_ITEMS: STARTING_ITEMS,
    createInitialItems: createInitialItems,
    normalizeStepState: normalizeStepState,
    getStepById: getStepById,
    isStepIncomplete: isStepIncomplete,
    areAllStepsCompleted: areAllStepsCompleted,
    findMatchingStepState: findMatchingStepState,
    getConsumedInstanceIds: getConsumedInstanceIds,
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
