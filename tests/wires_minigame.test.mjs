import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  WIRE_COUNT,
  SOCKET_EXPECTED_WIRE,
  createDisconnectedLinks,
  countConnectedWires,
  isCorrectMatch,
  applyConnection
} = require("../src/minigame-wires.js");

test("initial wire links start fully disconnected", () => {
  const links = createDisconnectedLinks();
  assert.deepEqual(links, [-1, -1, -1]);
  assert.equal(WIRE_COUNT, 3);
  assert.equal(countConnectedWires(links), 0);
});

test("socket matching follows the expected wire mapping", () => {
  assert.equal(isCorrectMatch(SOCKET_EXPECTED_WIRE, 2, 0), true);
  assert.equal(isCorrectMatch(SOCKET_EXPECTED_WIRE, 0, 0), false);
  assert.equal(isCorrectMatch(SOCKET_EXPECTED_WIRE, 0, 1), true);
  assert.equal(isCorrectMatch(SOCKET_EXPECTED_WIRE, 1, 2), true);
});

test("applyConnection rejects invalid and mismatched drops", () => {
  const start = createDisconnectedLinks();
  const sockets = createDisconnectedLinks();
  const invalidIndex = applyConnection(start, sockets, 0, 99, SOCKET_EXPECTED_WIRE);
  assert.equal(invalidIndex.didConnect, false);
  assert.deepEqual(invalidIndex.wireToSocket, [-1, -1, -1]);
  assert.deepEqual(invalidIndex.socketToWire, [-1, -1, -1]);

  const mismatch = applyConnection(start, sockets, 0, 0, SOCKET_EXPECTED_WIRE);
  assert.equal(mismatch.didConnect, false);
  assert.deepEqual(mismatch.wireToSocket, [-1, -1, -1]);
  assert.deepEqual(mismatch.socketToWire, [-1, -1, -1]);
});

test("correct matches lock connections and prevent reusing wire/socket", () => {
  const start = createDisconnectedLinks();
  const sockets = createDisconnectedLinks();
  const first = applyConnection(start, sockets, 2, 0, SOCKET_EXPECTED_WIRE);
  assert.equal(first.didConnect, true);
  assert.deepEqual(first.wireToSocket, [-1, -1, 0]);
  assert.deepEqual(first.socketToWire, [2, -1, -1]);
  assert.equal(first.completed, false);

  const duplicateWire = applyConnection(first.wireToSocket, first.socketToWire, 2, 1, SOCKET_EXPECTED_WIRE);
  assert.equal(duplicateWire.didConnect, false);

  const duplicateSocket = applyConnection(first.wireToSocket, first.socketToWire, 0, 0, SOCKET_EXPECTED_WIRE);
  assert.equal(duplicateSocket.didConnect, false);
});

test("game completes once all three wires are connected correctly", () => {
  let state = {
    wireToSocket: createDisconnectedLinks(),
    socketToWire: createDisconnectedLinks()
  };

  for (let socketIndex = 0; socketIndex < WIRE_COUNT; socketIndex += 1) {
    const wireIndex = SOCKET_EXPECTED_WIRE[socketIndex];
    const next = applyConnection(
      state.wireToSocket,
      state.socketToWire,
      wireIndex,
      socketIndex,
      SOCKET_EXPECTED_WIRE
    );
    state = {
      wireToSocket: next.wireToSocket,
      socketToWire: next.socketToWire
    };
    if (socketIndex < WIRE_COUNT - 1) {
      assert.equal(next.completed, false);
    } else {
      assert.equal(next.completed, true);
    }
  }

  assert.equal(countConnectedWires(state.wireToSocket), WIRE_COUNT);
});
