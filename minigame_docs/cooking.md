# Cooking Mini-Game

The cooking mini-game presents one recipe per round.

## Recipe Rules
- There are exactly **3 total recipes** in the game.
- Each recipe has exactly **2 required ingredients**.
- Each recipe shows **3 total ingredients** on the counter.
- Of the 3 shown ingredients, **1 is irrelevant** (a decoy) and should not count toward completion.
- The player completes the round by dragging the 2 required ingredients into the bowl (any order).

## Current Recipes
1. Omelet: required `eggs` + `milk`, with `flour` as the decoy.
2. Salad: required `tomato` + `lettuce`, with `cheese` as the decoy.
3. Smoothie: required `banana` + `berries`, with `spinach` as the decoy.

## Completion Behavior
- Adding a required ingredient marks it as complete in the bowl and recipe card.
- Adding the decoy ingredient does nothing (no progress).
- The game completes after both required ingredients are added.
