Lightbulb Screwing:

Scene & Objects:
- Display a lamp with exactly 1 empty socket (no bulb installed).
- Display exactly 1 lightbulb aligned above the socket.
- Display a light glow around the bulb/lamp that can change intensity.
- The lightbulb has four states: Unscrewed (starting state), Partially Screwed (1), Partially Screwed (2), and Fully Screwed (3).

Player Input:
- Swipe right on the lightbulb.

Gameplay:
- Each valid right-swipe advances the bulb by exactly one state:
  - Unscrewed → Partially Screwed (1)
  - Partially Screwed (1) → Partially Screwed (2)
  - Partially Screwed (2) → Fully Screwed (3)

- The lamp’s glow becomes brighter with each completed swipe step (3 brightness levels corresponding to steps 1–3).
- After the bulb is Fully Screwed (3), additional right-swipes do nothing (no unscrewing, no extra brightness).

Win Condition:
- The mini-game is completed when the bulb reaches Fully Screwed (3) and the lamp is at maximum brightness.