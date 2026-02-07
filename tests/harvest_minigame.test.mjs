import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  TARGET_GOOD,
  getHorizontalSwipeDirection,
  createMiniGamePlugin
} = require("../src/minigame-harvest.js");

function createNoopNode() {
  return {
    style: {},
    textContent: "",
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    remove() {},
    classList: {
      add() {},
      remove() {}
    }
  };
}

test("harvest scene allows swipe-up skip arbitration", () => {
  const plugin = createMiniGamePlugin();
  const scoreNode = createNoopNode();
  const goodNode = createNoopNode();
  const fallsLayer = createNoopNode();
  let spawnCount = 0;
  fallsLayer.appendChild = function () {
    spawnCount += 1;
  };
  const feedbackLayer = createNoopNode();
  const basketNode = createNoopNode();
  const scene = createNoopNode();
  scene.getBoundingClientRect = function () {
    return { left: 10, width: 320, height: 220 };
  };
  scene.setPointerCapture = function () {};

  const mount = {
    innerHTML: "",
    querySelector(selector) {
      if (selector === "[data-score='1']") {
        return scoreNode;
      }
      if (selector === "[data-good='1']") {
        return goodNode;
      }
      if (selector === ".harvest-scene") {
        return scene;
      }
      if (selector === ".harvest-falls") {
        return fallsLayer;
      }
      if (selector === ".harvest-basket") {
        return basketNode;
      }
      if (selector === ".harvest-feedback") {
        return feedbackLayer;
      }
      return null;
    }
  };

  let registeredControl = null;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  globalThis.window = {
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {}
  };
  globalThis.document = {
    createElement() {
      return createNoopNode();
    }
  };

  try {
    const cleanup = plugin.mount(mount, {
      registerControl(element, options) {
        registeredControl = { element, options };
      }
    });

    assert.ok(registeredControl, "Expected harvest to register interactive scene control");
    assert.equal(registeredControl.element, scene);
    assert.deepEqual(registeredControl.options, { allowSwipeSkip: true });
    assert.equal(spawnCount, 1, "Expected an immediate fruit spawn on mount");
    assert.equal(typeof cleanup, "function");

    cleanup();
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("harvest target good catch count is set to 4", () => {
  assert.equal(TARGET_GOOD, 4);
});

test("horizontal swipe detection returns right, left, or none", () => {
  assert.equal(getHorizontalSwipeDirection({ dx: 72, dy: 12, dt: 220 }), 1);
  assert.equal(getHorizontalSwipeDirection({ dx: -68, dy: 8, dt: 240 }), -1);
  assert.equal(getHorizontalSwipeDirection({ dx: 30, dy: 2, dt: 180 }), 0);
  assert.equal(getHorizontalSwipeDirection({ dx: 70, dy: 80, dt: 200 }), 0);
  assert.equal(getHorizontalSwipeDirection({ dx: 66, dy: 4, dt: 700 }), 0);
});
