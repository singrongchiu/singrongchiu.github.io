Slingshot Launch:

Rarity:
- Tier: Elite
- Color: `#d48732`
- Bounty: `3`

Scene & Objects:
- Display an outdoor target range with exactly 1 slingshot anchored on the left side.
- Display exactly 1 projectile (stone) loaded in the slingshot pouch at the start.
- Display exactly 1 target on the right side (for example, a wooden bullseye).
- The target has two states: Intact (starting state) and Hit.
- Show a simple launch boundary so the player can only pull the pouch backward (not forward).

Player Input:
- Click/tap and drag the slingshot pouch backward, then release.

Gameplay:
- Drag distance controls launch power (farther pull = stronger shot).
- Drag angle controls launch direction.
- On release, launch the projectile using the selected power + angle.
- The player gets exactly 2 launch attempts in the mini-game.
- After each release, the projectile resolves as hit or miss before another launch can begin.
- After the second launch, the pouch locks and cannot be dragged again (no third shot).
- If the projectile collides with the target, target state changes from Intact → Hit and play positive hit feedback.
- If the projectile misses, play gentle miss feedback.
- On a second missed launch, mark the mini-game as failed and automatically advance to the next game.

Win Condition:
- The mini-game is completed when the target is Hit within the two allowed launches.
