import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeGamePlugin,
  createFallbackPlugin
} = require("../src/framework-core.js");

function toSafePlugin(raw, defaults) {
  try {
    return normalizeGamePlugin(raw, defaults);
  } catch (err) {
    return createFallbackPlugin(
      {
        id: defaults.id,
        title: defaults.title,
        icon: "⚠️",
        hint: "Fallback plugin was used"
      },
      err && err.message
    );
  }
}

test("normalizeGamePlugin fills omitted optional fields", () => {
  const plugin = normalizeGamePlugin(
    {
      id: "simple",
      title: "Simple",
      mount() {}
    },
    {
      initialWeight: 1,
      timing: { roundMs: 7000, engagedRoundMs: 25000 }
    }
  );

  assert.equal(plugin.id, "simple");
  assert.equal(plugin.title, "Simple");
  assert.equal(plugin.initialWeight, 1);
  assert.equal(plugin.timing.roundMs, 7000);
  assert.equal(plugin.timing.engagedRoundMs, 25000);
  assert.equal(plugin.rarity.label, "Uncommon");
  assert.equal(plugin.rarity.bounty, 2);
});

test("normalizeGamePlugin enforces required methods", () => {
  assert.throws(
    () => normalizeGamePlugin({ id: "broken" }, {}),
    /mount/i
  );
});

test("invalid plugins can be safely converted to fallback plugins", () => {
  const plugin = toSafePlugin(
    { id: "broken", mount: "not-a-function" },
    { id: "safe-fallback", title: "Safe Fallback" }
  );

  assert.equal(plugin.id, "safe-fallback");
  assert.equal(plugin.title, "Safe Fallback");
  assert.equal(typeof plugin.mount, "function");
});

test("fallback plugin mount produces placeholder markup", () => {
  const plugin = createFallbackPlugin(
    { id: "missing", title: "Missing Game", icon: "🎮", hint: "Unavailable" },
    "factory missing"
  );

  const mountEl = { innerHTML: "" };
  plugin.mount(mountEl);

  assert.equal(mountEl.innerHTML.includes("placeholder-icon"), true);
  assert.equal(mountEl.innerHTML.includes("Unavailable"), true);
});
