import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizeGamePlugin } = require("../src/framework-core.js");
const cookingModule = require("../src/minigame-cooking.js");

const modules = [
  require("../src/minigame-burger.js"),
  require("../src/minigame-lightbulb.js"),
  require("../src/minigame-pipe.js"),
  require("../src/minigame-vanishing.js"),
  require("../src/minigame-plant.js"),
  cookingModule,
  require("../src/minigame-dinosaur.js"),
  require("../src/minigame-slingshot.js"),
  require("../src/minigame-maze.js"),
  require("../src/minigame-baseball.js"),
  require("../src/minigame-harvest.js"),
  require("../src/minigame-eightball.js"),
  require("../src/minigame-wires.js"),
  require("../src/minigame-letterfill.js")
];

test("every minigame module exposes createMiniGamePlugin", () => {
  for (const mod of modules) {
    assert.equal(typeof mod.createMiniGamePlugin, "function");
  }
});

test("plugin factories return unique ids with normalized shape", () => {
  const ids = new Set();

  for (const mod of modules) {
    const rawPlugin = mod.createMiniGamePlugin();
    const plugin = normalizeGamePlugin(rawPlugin, {
      id: "fallback-id",
      title: "Fallback Title",
      initialWeight: 1,
      timing: { roundMs: 7000, engagedRoundMs: 25000 }
    });

    assert.equal(typeof plugin.id, "string");
    assert.equal(typeof plugin.title, "string");
    assert.equal(typeof plugin.mount, "function");
    assert.equal(plugin.timing.roundMs > 0, true);
    assert.equal(plugin.timing.engagedRoundMs >= plugin.timing.roundMs, true);

    assert.equal(ids.has(plugin.id), false, `Duplicate plugin id: ${plugin.id}`);
    ids.add(plugin.id);
  }
});

test("custom timing overrides are preserved for long-round games", () => {
  const plugins = modules.map((mod) => normalizeGamePlugin(mod.createMiniGamePlugin(), {}));
  const plant = plugins.find((plugin) => plugin.id === "plant");
  const cooking = plugins.find((plugin) => plugin.id === "cooking");
  const harvest = plugins.find((plugin) => plugin.id === "harvest");

  assert.ok(plant, "Expected plant plugin to exist");
  assert.ok(cooking, "Expected cooking plugin to exist");
  assert.ok(harvest, "Expected harvest plugin to exist");
  assert.equal(plant.timing.roundMs, 15000);
  assert.equal(cooking.timing.roundMs, 20000);
  assert.equal(harvest.timing.roundMs, 18000);
});

test("cooking recipes contain exactly two required ingredients and one decoy", () => {
  assert.equal(Array.isArray(cookingModule.RECIPES), true);
  assert.equal(cookingModule.RECIPES.length, 3);

  for (const recipe of cookingModule.RECIPES) {
    assert.equal(Array.isArray(recipe.required), true);
    assert.equal(recipe.required.length, 2);
    assert.equal(Array.isArray(recipe.available), true);
    assert.equal(recipe.available.length, 3);

    const requiredSet = new Set(recipe.required);
    const availableSet = new Set(recipe.available);
    assert.equal(requiredSet.size, 2);
    assert.equal(availableSet.size, 3);
    assert.equal(recipe.required.every((id) => availableSet.has(id)), true);
    assert.equal(recipe.available.filter((id) => !requiredSet.has(id)).length, 1);

    const starting = cookingModule.createInitialItems(recipe);
    const ingredientCount = starting.filter((item) => item.type === "ingredient").length;
    assert.equal(ingredientCount, 3);
  }
});
