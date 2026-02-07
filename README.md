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

# Estimate `.tar.br` File Contribution
```sh
sh estimate_tar_br_breakdown.sh src.tar.br
```
Optional arguments:
- Brotli quality (default `11`)
- Brotli window (default `24`)

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
- `complete()` to mark success (+1 score, toast, confetti, transition handled by framework).
- `fail(reason)` to end the current round without score.
- `noteInteraction()` to request engagement-time extension for non-pointer input.
- `registerControl(element, { allowSwipeSkip })` to register interactive controls for swipe arbitration.
- `effects.confetti()` and `effects.toast(text)` for optional local effects.
- `session.getRemainingSeconds()` for time-aware behavior.

# Scoring
- Successful game clear: `+1`
- Failed or timed out game: `+0`
- Skipped game: `+0`

# Add A New Game
1. Create a module in `src/` that exports `createMiniGamePlugin()` and returns a plugin matching the contract above.
2. Add one descriptor entry for that module in `src/minigames.js`.

# Disable Games
Game enable/disable is configured in `src/minigames.js`.

- To disable a game, remove its descriptor entry from the `descriptors` array.
- To re-enable a game, add the descriptor back and ensure the corresponding `src/minigame-*.js` file is loaded in `src/index.html`.
