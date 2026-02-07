# Setup
```sh
uv venv --python 3.12
source .venv/bin/activate
```

# Run Tests
```sh
source .venv/bin/activate
pytest -q
```

# Build Compressed Artifacts
```sh
sh compress.sh
```

# Run Locally
```sh
sh run.sh src.tar.br
```
Open [http://localhost:8000/src/index.html](http://localhost:8000/src/index.html).

# Session Gestures
- Swipe up on the game card to skip the current mini-game.
- Swipe down on the game card to reopen the most recently skipped mini-game.

# Mini-game Plugin Contract
Mini-games integrate through a single plugin factory: `createMiniGamePlugin()`.

```js
{
  id: "unique-game-id",
  title: "Card Title",
  initialWeight: 1,
  rarity: {
    label: "Uncommon", // Uncommon | Elite | Legendary
    color: "#3f7fd6",
    bounty: 2
  },
  timing: {
    roundMs: 7000,
    engagedRoundMs: 25000
  },
  mount: function (mountEl, engine) {
    // render, bind listeners, return optional cleanup function
  }
}
```

The `engine` object available inside `mount()` provides:
- `complete()` to mark success (+rarity bounty score, toast, confetti, transition handled by framework).
- `fail(reason)` to end the current round without score.
- `noteInteraction()` to request engagement-time extension for non-pointer input.
- `registerControl(element, { allowSwipeSkip })` to register interactive controls for swipe arbitration.
- `effects.confetti()` and `effects.toast(text)` for optional local effects.
- `session.getRemainingSeconds()` for time-aware behavior.

# Rarity And Bounty

Rarity tiers define scoring for successful clears:
- `Uncommon` (`#3f7fd6`) -> `+2` bounty
- `Elite` (`#d48732`) -> `+3` bounty
- `Legendary` (`#b8812a`) -> `+4` bounty

Current mini-game assignments:

| Mini-game | Rarity | Color | Bounty |
| --- | --- | --- | --- |
| Burger Flipping | Uncommon | `#3f7fd6` | 2 |
| Lamp Twist | Uncommon | `#3f7fd6` | 2 |
| Pipe Grid | Uncommon | `#3f7fd6` | 2 |
| Vanishing Path | Elite | `#d48732` | 3 |
| Plant Watering | Uncommon | `#3f7fd6` | 2 |
| Cooking | Uncommon | `#3f7fd6` | 2 |
| Dino Petting | Uncommon | `#3f7fd6` | 2 |
| Slingshot Launch | Elite | `#d48732` | 3 |
| Maze Runner | Elite | `#58a05a` | 3 |
| Baseball Meter Swing | Elite | `#d48732` | 3 |
| Harvest Catch | Uncommon | `#3f7fd6` | 2 |
| 8-Ball One Shot | Legendary | `#b8812a` | 4 |
| Connect Wires | Uncommon | `#3f7fd6` | 2 |
| Letter Filling | Uncommon | `#3f7fd6` | 2 |

# Add A New Game
1. Create a module in `src/` that exports `createMiniGamePlugin()` and returns a plugin matching the contract above.
2. Add one descriptor entry for that module in `src/minigames.js`.

# Disable Games
Game enable/disable is configured in `src/minigames.js`.

- Default disabled IDs live in `DEFAULT_DISABLED_GAME_IDS`.
- Additional runtime-disabled IDs can be provided before app boot via `window.DisabledMiniGameIds`.

Example:

```html
<script>
  window.DisabledMiniGameIds = ["slingshot", "eightball"];
</script>
```
