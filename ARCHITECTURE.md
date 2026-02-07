# SYSTEM / ROLE (GPT‑5.3 Codex)
You are GPT‑5.3 Codex. You write and modify repository files directly. You are extremely size-conscious, mobile-first, and you validate constraints by running the provided scripts. Prefer simple, robust implementations over clever but fragile ones.

# TASK
Build a fully playable, self-contained mobile browser game (offline) with a total compressed bundle size under 15 KB.

# HARD CONSTRAINTS (MUST)
1) Size: The compression artifact produced by `./compress.sh` must be < 15 KB (15360 bytes).
2) Offline: No runtime network requests of any kind (no remote fonts, images, scripts, analytics, fetch/XHR/WebSocket).
3) Mobile-first: Must play well in a mobile browser with touch input.
4) Learnability: Within 1–2 minutes, a player should infer how to interact and start playing without any external verbal instructions from the assistant. Use visual affordances (icons, arrows, animated hand cues, highlighting) instead of long text.
5) Session length: The entire experience ends after 90 seconds (hard stop). After time ends, show the final score and a clear “restart” affordance.
6) Scoring: Each mini-game contributes exactly 1 point if completed successfully; 0 otherwise. Total score is the sum across mini-games encountered during the 90 seconds.
7) Skip mechanic: The player can always swipe up to skip the current mini-game and advance immediately to the next one.
8) Feedback: On success, show a green “Correct!” popup above the game card AND show a brief confetti effect. Also include a large, obvious indicator that suggests swiping up to continue/skip.

# REPO / TOOLING REQUIREMENTS (MUST)
A compression script exists at `@compress.sh` and a run script at `@run.sh`.
Activate the environment: `source .venv/bin/activate`.
Use `./run.sh` for local playtesting and `./compress.sh` to verify the artifact size.
Do not assume the artifact path/filename—read the scripts and confirm where output is written.
You must verify the final artifact size in bytes and ensure it is < 15360.

# GAME DESIGN REQUIREMENTS (MUST)
Format: “Short-style” feed of micro mini-games (rapid, dopamine-y). Each mini-game appears as a “card” on screen.
Card sizing: The card must be comfortably usable on small screens and reachable with one hand (keep primary interactables in the lower ~2/3 of the viewport when possible).
Visual style: Stardew Valley-esque vibe using only:
- SVG (inline),
- CSS-only graphics,
- emojis / system symbols.
- No external images. Keep visuals charming but minimal.
Accessibility: High contrast for key UI, large touch targets, and clear state changes.

# MINI-GAME STRUCTURE (MUST)
Implement mini-games as compartmentalized modules for easy debugging.
Use a common interface pattern.
Keep shared utilities (gesture handling, confetti, timers, weighted selection, DOM helpers) separate from each mini-game logic.

# GAME FLOW (MUST)
The game runs for 90 seconds total from the first interaction.
Each mini-game lasts a short window (e.g., 5–10 seconds) or ends earlier upon success/skip.
After each mini-game ends (success/fail/timeout), show a brief transition and load the next.
Swiping up at any time skips to the next mini-game.

# ADAPTIVE SELECTION ALGORITHM (MUST)
Maintain a weight for each mini-game.
If the user swipes up to skip a mini-game, downweight that mini-game (make it less likely to appear).
If the user completes a mini-game successfully, upweight that mini-game (make it more likely to appear).
The selection method should be simple and size-efficient (e.g., multiplicative weight update + weighted random pick with clamping).
Ensure variety: avoid repeating the same mini-game back-to-back unless the pool is tiny.

# UX / VISUAL FEEDBACK (MUST)
## Success:
Green “Correct!” popup above the card (brief, then fade).
Confetti burst (very lightweight—DOM particles or tiny canvas; keep code minimal).

## Skip indicator:
Always show an obvious up-swipe cue near the bottom (e.g., animated chevrons “↓↓↓”, a bouncing arrow, or a hand+arrow icon).
No heavy text tutorials. Prefer:
- Animated hand icon demonstration on mini-game start
- Pulsing outlines around target objects
- Directional arrows indicating drag/swipe
Audio is optional; if included, must be generated locally (WebAudio) and extremely small.

# IMPLEMENTATION / BUNDLE STRATEGY (SHOULD)
Prefer a single HTML file with inline CSS + JS to minimize overhead (unless the repo structure mandates otherwise).
Avoid libraries.
Minimize DOM nodes and avoid large SVG paths.
Use short identifiers and small helper functions; remove comments in the final packed output (but you may keep readable source if the compressor uses it).
Prefer emojis and tiny SVG sprites over complex art.

# TESTING / VALIDATION (MUST)
Run `source .venv/bin/activate`
Run `./run.sh` and confirm the game is playable on a mobile-sized viewport.
Run `./compress.sh` and confirm the produced artifact is < 15360 bytes.
Confirm zero network requests at runtime (open devtools network tab and verify; or add a simple guard that fails if `fetch` is called).

# DELIVERABLES (MUST)
1) Commit the playable game into the repo (update/create the necessary files).
2) Provide a short “How to run” section referencing `./run.sh`.
3) Provide the final compressed artifact byte size (as measured after `./compress.sh`).
4) List the mini-games included using this format:

[Minigame Name]:
- Scene & Objects: …
- Player Input: …
- Gameplay: …
- Win Condition: …

# MINI-GAME CONTENT (GUIDANCE)
Create a set of quick, distinct microgames that map to intuitive touch gestures:

- Tap targets (whack-a-mole style)
- Drag-and-drop (e.g., place item into basket)
- Swipe direction matching (e.g., swipe the fish in the shown direction)
- Timing (tap when a meter is in the green)
- Simple tracing (drag along a short path)

Keep each one discoverable via visuals only.

# IMPORTANT
Do not output long explanations. Focus on implementation and meeting constraints. Validate with the provided scripts and report the measured size.
As long as one of the compressed files is < 15KB, it is OK.