import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  WORD,
  MISSING_COUNT,
  pickUniqueIndices,
  createRoundConfig,
  isRoundComplete,
  applyPlacement
} = require("../src/minigame-letterfill.js");

function countLetters(list) {
  const counts = {};
  for (const letter of list) {
    counts[letter] = (counts[letter] || 0) + 1;
  }
  return counts;
}

test("pickUniqueIndices returns the expected number of unique sorted values", () => {
  let seq = 0;
  const rngValues = [0.8, 0.2, 0.8, 0.5];
  const rng = () => {
    const value = rngValues[seq] ?? 0.1;
    seq += 1;
    return value;
  };

  const picked = pickUniqueIndices(8, 2, rng);
  assert.deepEqual(picked, [1, 6]);
});

test("round config hides exactly two arbitrary letters and generates matching tiles", () => {
  let seq = 0;
  const rngValues = [0.15, 0.4, 0.0];
  const rng = () => {
    const value = rngValues[seq] ?? 0;
    seq += 1;
    return value;
  };

  const round = createRoundConfig(WORD, MISSING_COUNT, rng);
  assert.equal(round.hiddenIndices.length, 2);
  assert.deepEqual(round.hiddenIndices, [1, 3]);

  const hiddenLetters = round.hiddenIndices.map((index) => round.answerLetters[index]);
  assert.equal(round.slotLetters[1], null);
  assert.equal(round.slotLetters[3], null);
  assert.deepEqual(countLetters(round.tiles), countLetters(hiddenLetters));
});

test("round config supports duplicate hidden letters by emitting duplicate tiles", () => {
  let seq = 0;
  const rngValues = [0.2, 0.32, 0.9];
  const rng = () => {
    const value = rngValues[seq] ?? 0;
    seq += 1;
    return value;
  };

  const round = createRoundConfig(WORD, MISSING_COUNT, rng);
  assert.deepEqual(round.hiddenIndices, [1, 2]);
  assert.deepEqual(countLetters(round.tiles), { P: 2 });
});

test("applyPlacement accepts only correct tile-slot matches and detects completion", () => {
  const answerLetters = WORD.split("");
  const slotLetters = ["A", null, null, "L", "O", "V", "I", "N"];
  const tiles = ["P", "P"];
  const tileUsed = [false, false];

  const first = applyPlacement(answerLetters, slotLetters, tiles, tileUsed, 1, 0);
  assert.equal(first.didPlace, true);
  assert.deepEqual(first.slotLetters, ["A", "P", null, "L", "O", "V", "I", "N"]);
  assert.deepEqual(first.tileUsed, [true, false]);
  assert.equal(first.completed, false);

  const rejectedReuse = applyPlacement(answerLetters, first.slotLetters, tiles, first.tileUsed, 2, 0);
  assert.equal(rejectedReuse.didPlace, false);
  assert.deepEqual(rejectedReuse.slotLetters, first.slotLetters);
  assert.deepEqual(rejectedReuse.tileUsed, first.tileUsed);

  const second = applyPlacement(answerLetters, first.slotLetters, tiles, first.tileUsed, 2, 1);
  assert.equal(second.didPlace, true);
  assert.equal(isRoundComplete(second.slotLetters), true);
  assert.equal(second.completed, true);
});
