Vanishing Path:

Scene & Objects:
- Display a 4x4 grid of stone tiles floating in a void.
- Display a single Avatar starting on a random tile (Start).
- Display a Goal Marker (e.g., a flag or portal) on a different random tile (End).
- Each tile has two underlying properties: Safe (part of the path) and Unsafe (empty space/pit).
- At the start, a randomized shortest Manhattan path of Safe tiles exists connecting Start to End. All other tiles are Unsafe.

Player Input:
- Click or Tap an adjacent tile (Up, Down, Left, Right) to move the Avatar.

Gameplay:
- Memorization Phase: Upon loading, all Safe tiles light up (glow Green) for exactly 1.5 seconds.
- Conceal Phase: After 1.5 seconds, all tiles revert to their neutral stone appearance (Grey).
- The player clicks an adjacent tile to attempt a step.
- If the player clicks a Safe tile:
- The Avatar moves to that tile.
- The tile state changes from Hidden → Revealed (stays permanently Green).
- If the player clicks an Unsafe tile:
- The tile briefly flashes Red (indicating a pit/trap).
- The Avatar does not move.
- The tile returns to the neutral stone appearance.
- (Optional difficulty setting: The Avatar is sent back to the Start tile).

Win Condition:
- The mini-game is completed when the player successfully moves the Avatar onto the Goal Marker tile. Essentially, the full path from Start to End has been traversed.
