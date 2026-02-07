import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = path.join(ROOT, "src", "minigames.js");

function createPlugin(id, title) {
  return {
    id,
    title,
    initialWeight: 1,
    timing: { roundMs: 7000, engagedRoundMs: 25000 },
    mount() {}
  };
}

function normalizeGamePlugin(plugin, defaults) {
  return {
    id: plugin.id || defaults.id,
    title: plugin.title || defaults.title,
    initialWeight: Number(plugin.initialWeight) || Number(defaults.initialWeight) || 1,
    timing: plugin.timing || { roundMs: 7000, engagedRoundMs: 25000 },
    mount: typeof plugin.mount === "function" ? plugin.mount : function () {}
  };
}

function loadMiniGames() {
  const code = fs.readFileSync(REGISTRY_PATH, "utf8");
  const sandbox = {
    window: {
      FrameworkCore: {
        normalizeGamePlugin,
        createFallbackPlugin() {
          return createPlugin("fallback", "Fallback");
        }
      },
      BurgerMiniGame: { createMiniGamePlugin: () => createPlugin("burger", "Burger Flipping") },
      LetterFillingMiniGame: { createMiniGamePlugin: () => createPlugin("letterfill", "Letter Filling") }
    },
    module: { exports: {} },
    exports: {}
  };

  vm.runInNewContext(code, sandbox, { filename: "minigames.js" });
  return sandbox.window.MiniGames;
}

test("registry includes all wired game modules", () => {
  const games = loadMiniGames();
  const ids = games.map((game) => game.id);

  assert.equal(ids.includes("burger"), true);
  assert.equal(ids.includes("letterfill"), true);
  assert.equal(ids.includes("pipe"), false);
  assert.equal(ids.includes("dinosaur"), false);
});
