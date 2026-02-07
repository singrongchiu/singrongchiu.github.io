Plant Watering:

Rarity:
- Tier: Uncommon
- Color: `#3f7fd6`
- Bounty: `2`

Scene & Objects:
- Display a garden bed containing exactly 3 potted plants.
- Display a single watering can that the player can move.
- Each plant has two states: Dry (starting state) and Watered.
- At the start, exactly 2 plants are Dry (need water), and 1 plant is Watered (does not need water).

Player Input:
- Drag and drop the watering can.

Gameplay:
- The player drags the watering can and drops it onto a plant.
- The watering can is replaced to its initial position.
- If the nozzle is dropped onto a Dry plant, that plant’s state changes from Dry → Watered and counts as 1 watering. That plant now looks watered and shows up as watered. 
- If the nozzle is dropped onto a Watered plant, nothing happens (no watering counted).
- Any plant that was watered stays in the watered state until all plants are watered. 

Win Condition:
- The mini-game is completed when the player has successfully watered Dry plants a total of 2 times (i.e., 2 Dry → Watered actions). Essentially, the two dry plants at the start are watered. 
