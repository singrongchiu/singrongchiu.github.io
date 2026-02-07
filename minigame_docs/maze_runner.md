Maze Runner:

Rarity:
- Tier: Rare
- Color: `#58a05a`
- Bounty: `3`

Scene & Objects:
- Display a forward-scrolling maze corridor with exactly 3 lanes (Left, Center, Right).
- Display the player's Avatar auto-running near the bottom third of the screen.
- Spawn exactly 3 obstacles ahead of the Avatar across the course.
- Obstacle types are lane-blocking walls, broken pillars, and sliding gate segments.
- Include a visible finish gate at the end of the course.

Player Input:
- Swipe Left or Right to shift the Avatar exactly one lane in that direction.
- If the target lane is blocked by a maze wall boundary, the swipe is ignored.

Gameplay:
- The Avatar runs forward automatically; the player only controls lateral movement.
- The 3 obstacles approach in sequence, requiring lane changes to stay on safe paths.
- Collision with any obstacle removes the player's only heart and ends the run immediately.
- The player starts with exactly 1 heart.
- Course speed increases slightly every 5 seconds to raise difficulty.

Win Condition:
- The mini-game is completed when the player reaches the finish gate after dodging all 3 obstacles.
