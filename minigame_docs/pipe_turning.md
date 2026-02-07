Angular Pipe Turning:

Scene & Objects:
- Display a square puzzle board containing exactly 9 pipe tiles arranged in a 3×3 grid.
- Each tile is a single “angular pipe” (an L-shaped corner piece).
- Each pipe tile has 4 possible orientations: 0°, 90°, 180°, 270°.
- Show a --Water Source-- icon fixed on the left edge of the top-left tile (tile 1,1).
- Show a --Drain/Goal-- icon fixed on the right edge of the bottom-right tile (tile 3,3).
- Pipes are initially set to a predefined randomized orientation (not all correct).

Player Input:
- Tap on a pipe tile.

Gameplay:
- When the player taps a tile, that tile rotates --clockwise by 90°-- (e.g., 0° → 90° → 180° → 270° → 0°).
- Only the tapped tile rotates; all other tiles remain unchanged.
- After each rotation, the game checks for a valid continuous water path from the Water Source to the Drain:
  - Water can flow between two adjacent tiles only if both tiles have open ends facing each other on the shared edge.
  - The path must be continuous through connected open ends without breaks.

Win Condition:
- The mini-game is completed when there is a continuous connected pipe path allowing water to flow from the Water Source (top-left) to the Drain (bottom-right).