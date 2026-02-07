# Mini-game Plugin Contract

All mini-games must expose a `createMiniGamePlugin()` factory and return a plugin object with this shape:

```js
{
  id: string,
  title: string,
  initialWeight: number,
  timing: {
    roundMs: number,
    engagedRoundMs: number
  },
  mount: function (mountEl, engine) {
    // return optional cleanup function
  }
}
```

## Required Fields
- `id`: Stable unique identifier used by the weighting and selection engine.
- `title`: Card header text rendered by the framework.
- `mount(mountEl, engine)`: Creates DOM inside `mountEl`, registers event handlers, and optionally returns a cleanup function.

## Optional Fields
- `initialWeight`: Initial selection weight. Defaults to `1`.
- `timing.roundMs`: Per-round timeout for this game. Defaults to framework round duration.
- `timing.engagedRoundMs`: Extended timeout after engagement. Defaults to framework engaged duration.

## Engine API (Inside `mount`)
- `engine.complete()`
  Marks the mini-game as successful and awards `+1` score. This call is idempotent: only the first call in a round is honored.
- `engine.fail(reason)`
  Ends the mini-game without awarding points (`+0`).
- `engine.noteInteraction()`
  Signals meaningful interaction (for example keyboard input) so the framework can extend round time.
- `engine.registerControl(element, { allowSwipeSkip })`
  Registers an interactive control for swipe arbitration.
  - `allowSwipeSkip` defaults to `false`.
  - Use `true` only when touch interactions should still permit swipe-up skip.
- `engine.effects.confetti()`
  Triggers framework confetti effect.
- `engine.effects.toast(text)`
  Triggers framework toast with custom text.
- `engine.session.getRemainingSeconds()`
  Returns remaining session time in seconds.

## Lifecycle Rules
- `mount()` is called once when the card is shown.
- The cleanup function returned by `mount()` (if any) is called when the card exits.
- Games should route completion through `engine.complete()` rather than directly changing score/UI.
- Games should register all interactive controls via `engine.registerControl(...)`.
