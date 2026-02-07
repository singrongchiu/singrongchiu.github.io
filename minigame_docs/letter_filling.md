Letter Filling (APPLOVIN):

Scene & Objects:
- Display the brand word as exactly 8 character slots in one horizontal row, with a visible grouping gap between `APP` and `LOVIN`.
- At the start of each round, choose exactly 2 arbitrary slot positions to hide (any 2 of the 8 positions).
- Pre-fill the remaining 6 slots and leave the chosen 2 slots blank.
- Display exactly 2 draggable letter tiles corresponding to the hidden letters for the current round.
- If both hidden positions contain the same letter (for example, both `P` positions), show two instances of that same letter tile.
- Empty slots are visually highlighted so the player can identify where letters should be placed.

Player Input:
- Click/tap and drag a letter tile into one of the blank slots, then release to drop.

Gameplay:
- The mini-game starts with the two randomly selected blanks empty and both corresponding letter tiles available.
- If the player places the correct letter in a blank slot:
  - The letter snaps into place.
  - The slot becomes locked.
  - The placed tile is removed from the available tile area.
- If the player tries to place a letter in an invalid position, the tile returns to its original position with gentle feedback.
- Filled correct slots remain fixed until both missing letters are placed.
- No timer or penalty counter is required; the player can keep trying until solved.

Win Condition:
- The mini-game is completed when both blanks are correctly filled and the full word reads `APPLOVIN`.
