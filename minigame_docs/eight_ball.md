8-Ball One-Shot Mini-Game:

Scene & Objects:
- Display a small top-down pool table with exactly 2 balls: 1 cue ball and 1 black 8-ball.
- Display exactly 1 target pocket highlighted (for example, the top-right corner pocket).
- The cue ball starts at a fixed position near the lower half of the table.
- The 8-ball starts at a fixed position with a clear line to at least one cushion/pocket route.
- Show a cue stick indicator attached to the cue ball while aiming.

Player Input:
- The player gets exactly 1 shot attempt.
- The player drags to set aim direction and release power, then releases to shoot.
- After the shot is taken, all aiming input is disabled.

Gameplay:
- On release, the cue ball is struck once and moves according to the chosen direction and power.
- Standard simplified collisions apply:
  - Cue ball can collide with cushions and bounce.
  - Cue ball can collide with the 8-ball and transfer momentum.
  - The 8-ball can collide with cushions and bounce.
- The shot continues until both balls stop moving or the 8-ball is pocketed.
- No second shot, no repositioning, and no retries inside the same round.

Win Condition:
- The mini-game is completed when the 8-ball is pocketed in the highlighted target pocket using that single shot.
- If the 8-ball is not pocketed in the target pocket after motion ends, the mini-game fails.
