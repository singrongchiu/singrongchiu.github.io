Cooking Mini-Game (Angular “Ingredient Combining”, Any-Order / No-Lose)
Scene & Objects:
- Display a warm, rustic kitchen background with a wooden counter as the main play surface.
- Show exactly one active recipe at a time in a “Recipe Card” UI panel (top or side of screen).
- The recipe card lists all required combinations for this recipe (e.g., “Flour + Eggs → Batter”, “Batter + Pan → Cooked Pancake”, etc.).

The recipe card does not enforce step order:

- Each required combination is shown with a status indicator: Incomplete / Completed.
- On the counter, display the starting ingredients/tools needed for this recipe as tappable item icons (e.g., Flour, Eggs, Bowl, Whisk).

Each item has:

- id (string)
- name (string)
- type = "ingredient" or "tool"

state (optional string, e.g., "raw", "mixed", "heated")

- The counter includes a “Work Area” zone where newly created items appear as icons (e.g., Batter).
- Player Input:

- The player taps to select an item on the counter or in the work area.
- The player then taps a second item to attempt a combination.
- Tapping the selected item again cancels selection.

Selecting another item replaces the current selection.

Gameplay:

- The recipe defines a set (unordered) of required combination steps. Each step specifies:

inputs: exactly 2 required item IDs (order-independent unless specified)
output: the new item created

- visualProgress: a UI update that advances the dish (e.g., bowl fills, mixture changes color, dough forms)

repeatable (boolean):

- If false, the step can be completed only once.
- If true, it can be performed multiple times (optional, depending on your design).

When the player selects two items:

- The game checks whether the selected pair matches any incomplete recipe step (not “current step”, since order doesn’t matter).
- If the combination matches an incomplete recipe step:

Remove (or visually merge) the two input items from the counter/work area if the step consumes them.

- (Optional rule per step: consumesInputs: true/false for tools like Pan/Whisk that should remain.)
- Spawn the output item into the work area (e.g., Flour + Eggs → Batter).
- Mark that recipe step as Completed on the recipe card.
- Trigger visualProgress to update the dish preview.

Play a positive animation/sound (gentle, cozy).

- If the combination does NOT match any incomplete recipe step:
- Do not remove or change items.

Show gentle feedback (e.g., “That doesn’t make anything right now.”) and a small shake animation on the two items.
- No penalties, no loss, no progress removed.

Win Condition:

- The mini-game is completed when all required recipe steps are marked Completed (in any order) and the final dish item is created or unlocked.

On completion:

- Show a “Dish Complete!” animation.
- Display the finished dish preview.
- Show a “Continue” button.