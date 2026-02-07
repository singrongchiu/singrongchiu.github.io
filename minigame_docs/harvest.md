# Falling Fruit Catch Mini-Game (Tree + Basket)

## Rarity
- Tier: Uncommon
- Color: `#3f7fd6`
- Bounty: `2`

## Scene & Objects
- Display a cheerful outdoor scene with a **single tree** centered near the top of the screen.
- A **basket** (player-controlled) is shown near the bottom of the screen on the ground.
- **Falling objects** spawn from the tree canopy and fall downward.
- Objects are represented as icons/sprites (example set):
  - **Good items**: Apple, Orange, Pear
  - **Neutral items (optional)**: Leaf
  - **Bad items (optional)**: Rock
- Show a simple HUD:
  - **Score** (number)
  - **Time Remaining** (seconds) or **Progress Bar**
  - **Caught Count** (optional)

## Object Data
Each falling object has:
- `id` (string)
- `type` (string) e.g., `"apple" | "orange" | "pear" | "leaf" | "rock"`
- `isGood` (boolean)
- `x` (number) horizontal position (0–100% of play area)
- `y` (number) vertical position (0–100% of play area)
- `fallSpeed` (number) pixels per second (or units per tick)
- `spawnTime` (number) timestamp
- `value` (number) score value (e.g., apple = +10, leaf = +0, rock = -5 optional)

## Player Input
- The player moves the basket **left and right** to catch objects.
- Supported input options (choose one or more):
  - **Swipe** left/right to nudge the basket.
  - **Drag** the basket horizontally.
  - **Tap** left/right buttons to move the basket.
  - **Keyboard** (desktop): Left Arrow / Right Arrow.
- The basket cannot move outside the play area bounds.

## Gameplay
- The game runs in a continuous loop (e.g., 60fps or fixed tick).
- Objects spawn at a configurable interval:
  - Example: every **0.6–1.2 seconds** (randomized).
- Spawn position:
  - Objects spawn at a random `x` within the canopy range of the tree.
  - Objects start at `y = 0` (top area near leaves).
- Falling motion:
  - Each tick, update `y` based on `fallSpeed` and delta time.
  - Objects are removed when `y` passes the ground (bottom boundary).

### Catch Detection
- A catch occurs when a falling object overlaps the basket hitbox:
  - Use simple rectangle intersection between:
    - `basketRect` (x, y, width, height)
    - `objectRect` (x, y, width, height)
- When caught:
  - Remove the object from the scene.
  - Apply feedback:
    - Floating text (e.g., “+10”)
    - Soft “pop” sound
    - Small basket bounce animation

### Scoring Rules (No-Lose Friendly Default)
- Catching **good items** increases score:
  - Apple: +10
  - Orange: +15
  - Pear: +20
- Catching **neutral items** does nothing (optional):
  - Leaf: +0 (but can count toward “caught”)
- Catching **bad items** triggers gentle feedback (optional):
  - Rock: either **0 points** or **-5 points** (choose your tone)
  - Show “Oops!” and a soft thunk sound
- Missing items (hitting the ground) does **not** penalize the player by default:
  - Optional: show a small “splat”/dust puff effect.

## Difficulty Scaling (Optional)
- Over time, increase challenge by one or more:
  - Reduce spawn interval slightly.
  - Increase average fallSpeed.
  - Add more object types (including occasional bad items).
- Difficulty changes should feel gentle and gradual.

## Win / End Conditions (Choose One)
### Option A: Timer-Based
- The mini-game ends when the timer reaches **0**.
- The final score is displayed.

### Option B: Goal-Based
- The mini-game ends when the player catches **N good items** (e.g., 20).
- Display completion screen.

### Option C: Endless (Arcade)
- The game continues until the player exits.
- Track best score (optional).

## Completion Screen
- Show a results panel:
  - Total Score
  - Good Items Caught
  - (Optional) Bad Items Caught / Missed Count
- Buttons:
  - **Play Again**
  - **Continue**

## Feedback & Accessibility
- All negative outcomes should be **gentle** (no harsh sounds or big penalties).
- Provide visual cues:
  - Basket highlight when a catch occurs
  - Object glow for good items (optional)
- Support reduced motion option (optional):
  - Slower fallSpeed and fewer screen shakes.
