Connect the Wires:

Rarity:
- Tier: Uncommon
- Color: `#3f7fd6`
- Bounty: `2`

Scene & Objects:
- Display a control panel containing exactly 3 left-side wire starts and 3 right-side sockets.
- Each wire start and socket has a matching color (for example: Red, Blue, Green) with no text labels.
- All 3 wire starts begin in a Disconnected state.
- The right-side sockets are fixed in place; wire starts can be dragged.
- Show a subtle power meter/light strip at the top with 3 segments (all Off at start).

Player Input:
- Click/tap and drag a wire start toward a socket, then release.

Gameplay:
- The player can connect one wire at a time by dropping a wire start onto a socket.
- If the dropped wire matches the socket color:
  - The wire snaps into place and becomes Connected (locked).
  - That connection cannot be moved again.
  - One segment of the power meter turns On.
- If the dropped wire does not match the socket:
  - The wire returns to its original start point.
  - The socket remains empty.
  - Show gentle invalid feedback (small shake or flash).
- Connected wires stay connected while the player completes the remaining matches.
- The mini-game has no penalty counter; incorrect attempts are allowed until solved.

Win Condition:
- The mini-game is completed when all 3 wires are correctly connected to their matching sockets and the power meter is fully On.
