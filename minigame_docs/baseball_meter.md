Baseball Meter Swing:

Scene & Objects:
- Display a side-view baseball field with exactly 1 batter at home plate.
- Display exactly 1 incoming baseball pitched from the mound each round.
- Display exactly 1 swing meter on screen with a marker that moves continuously between low and high power.
- The meter has three zones: Red (weak), Yellow (okay), and Green (sweet spot).
- Display exactly 1 highlighted target landing zone in the outfield.

Player Input:
- The player gets exactly 1 swing attempt.
- The player presses/clicks once to swing and lock in the current meter value.

Gameplay:
- The pitch begins and the meter marker starts moving up and down immediately.
- If the player swings before the ball crosses the plate, the batter swings once and power is set by the meter position at that exact moment.
- If the meter is in Green at swing time, the hit is strong and travels toward the highlighted target zone.
- If the meter is in Yellow at swing time, the hit is weak/short and does not reach the target zone.
- If the meter is in Red at swing time, the batter makes poor contact (or misses) and fails the attempt.
- If the player does not swing before the ball crosses the plate, the attempt is counted as a miss.
- After the swing window ends, all input is disabled (no second pitch, no retry in the same round).

Win Condition:
- The mini-game is completed when the player hits the ball into the highlighted outfield target zone using the single allowed swing.
- If the ball does not land in the target zone, the mini-game fails.
