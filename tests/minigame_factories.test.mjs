import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizeGamePlugin } = require("../src/framework-core.js");

const modules = [
  require("../src/minigame-burger.js"),
  require("../src/minigame-vanishing.js"),
  require("../src/minigame-plant.js"),
  require("../src/minigame-eightball.js"),
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

test("custom timing overrides are preserved for configured games", () => {
  const plugins = modules.map((mod) => normalizeGamePlugin(mod.createMiniGamePlugin(), {}));
  const plant = plugins.find((plugin) => plugin.id === "plant");
  const eightball = plugins.find((plugin) => plugin.id === "eightball");

  assert.ok(plant, "Expected plant plugin to exist");
  assert.ok(eightball, "Expected eightball plugin to exist");
  assert.equal(plant.timing.roundMs, 15000);
  assert.equal(eightball.timing.roundMs, 12000);
});
