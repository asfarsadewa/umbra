# UMBRA

> **You don't move the dead. You move the sun.**

A small deterministic grid-based puzzle game built around indirect control, shadow geometry, and simultaneous movement.

The player does not control the Shades directly. Instead, they choose the direction of the sun. Pillars and stones cast logical shadows across the board, and the Shades move according to those shadows.

The game should be compact, readable, deterministic, solver-verifiable, and finishable as a small project.

---

## 1. Design Pillars

UMBRA should preserve the design philosophy that makes *Pilgrims* work without repeating its mechanics.

### Core principles

1. **Indirect control**
   - The player manipulates the environment, not the characters.
   - Moving the sun changes the board state.
   - The Shades respond deterministically.

2. **Tiny visible rule set**
   - The player should understand the basic rules within seconds.
   - Complexity comes from interaction between simple rules, not from many mechanics.

3. **Deterministic simulation**
   - Same board + same sun direction = same result.
   - No randomness.
   - No physics-based gameplay decisions.
   - Rendering and animation never drive simulation state.

4. **Readable cause and effect**
   - The shadow the player sees must correspond exactly to the logical shadow used by the simulation.
   - No invisible movement rules.
   - No hidden state unless represented visually.

5. **Small campaign, handcrafted levels**
   - Target: **18 levels**.
   - Every level should be solver-verified.
   - Par should be the true minimum move count.

---

## 2. Core Fantasy

The board is an ancient ruined courtyard.

The player controls the position of the sun around the board:

```text
      NORTH

WEST   BOARD   EAST

      SOUTH
```

The sun can occupy one of four cardinal directions:

```text
N
E
S
W
```

Changing the sun direction changes the direction in which pillars and stones cast shadow.

Shades can only move through shadow.

The objective is to guide every Shade into a grave before daylight is lost.

---

## 3. Core Rule

> **A Shade moves one tile away from the sun, but only if the destination tile is in shadow.**

That is the foundation of the entire game.

Each player input selects a sun direction.

The simulation then resolves one complete turn.

---

## 4. Turn Resolution

Each turn follows this sequence:

```text
player selects sun direction
        ↓
logical shadows are recalculated
        ↓
each Shade determines its intended move
        ↓
movement conflicts are resolved
        ↓
valid Shade moves occur simultaneously
        ↓
grave entries are resolved
        ↓
turn counter advances
```

### Turn rules

1. The player selects one of:

```text
N
E
S
W
```

2. The sun changes immediately in simulation.

3. Every shadow tile is recalculated.

4. Each Shade attempts to move exactly one orthogonal tile **away from the sun**.

5. A Shade may move only if:
   - the destination is inside the board;
   - the destination is traversable;
   - the destination is currently in shadow;
   - the destination is not occupied by a blocking object.

6. If it cannot move, it waits.

7. All Shades decide simultaneously.

8. If two or more Shades target the same destination:
   - all involved Shades remain in place.

9. Shades may not swap positions.

10. Entering a grave removes the Shade from the board.

11. The level is solved when all Shades are buried.

---

## 5. Movement Direction

The movement direction is determined only by the sun.

| Sun | Shade moves |
| --- | --- |
| North | South |
| South | North |
| East | West |
| West | East |

For example:

```text
SUN WEST

☀ →  . . █ ░ ░ ░ S
```

The pillar casts shadow east.

The Shade moves east because that is away from the sun, provided the destination remains in shadow.

---

## 6. Shadow Model

Gameplay shadows must be computed entirely inside the deterministic simulation.

Do **not** use Three.js shadow maps, raycasting, or rendered lighting as authoritative game state.

Three.js may render beautiful shadows, but the simulation owns truth.

### Tall Pillar

Symbol:

```text
█
```

A tall pillar casts a shadow continuously from itself to the board edge in the direction opposite the sun.

Example:

```text
SUN WEST

☀ →  █ ░ ░ ░ ░
```

### Low Stone

Introduced later.

Symbol:

```text
▣
```

A low stone casts exactly one tile of shadow.

Example:

```text
SUN WEST

☀ →  ▣ ░ .
```

### Shadow overlap

Multiple objects may cast shadow onto the same tile.

Shadow state is simply:

```ts
shadowed: boolean
```

No intensity levels are required for gameplay.

---

## 7. Tiles and Entities

Recommended level legend:

```text
#  wall / impassable ruin
.  traversable floor
~  void
G  grave
S  Shade
P  tall pillar
L  low stone
```

Optional authoring-only symbol:

```text
X  decorative/non-traversable feature
```

Keep gameplay vocabulary intentionally small.

---

## 8. Graves

A grave is an exit.

```text
G
```

A Shade that enters a grave is removed immediately after movement resolution.

The grave remains available to other Shades unless a future level mechanic explicitly changes this.

For V1:

> **Graves are reusable.**

This keeps rules clean and avoids unnecessary assignment puzzles.

---

## 9. Collision Rules

Movement resolution should be predictable and independent of entity iteration order.

### Same destination

```text
S → .
S → .
```

If both target the same tile:

```text
both stay
```

### Swap

```text
S1 S2
```

If S1 targets S2's origin and S2 targets S1's origin:

```text
both stay
```

### Move into vacated tile

A Shade may move into another Shade's current tile only if the occupying Shade successfully moves away and the movement does not create a swap or conflict.

Implement using intents rather than sequential mutation.

---

## 10. Player Controls

Desktop:

| Action | Key |
| --- | --- |
| Sun North | W / ↑ |
| Sun South | S / ↓ |
| Sun West | A / ← |
| Sun East | D / → |
| Undo | Z / Ctrl+Z |
| Restart | R |
| Pause/Menu | Esc |
| Mute | M |

Touch:

- four-direction sun selector;
- undo button;
- restart/menu button.

The UI should make it visually clear that the player is controlling **the sun**, not the Shade.

---

## 11. Unlimited Undo

UMBRA should support unlimited undo.

Store a complete previous `GameState` snapshot before every turn.

Undo should restore:

- sun direction;
- Shade positions;
- buried count;
- remaining daylight;
- any future deterministic state.

Because the state is tiny, snapshot-based undo is preferable to inverse operations.

---

## 12. Sunset

Sunset is the single late-game pressure mechanic.

Some levels have a limited number of turns.

Example:

```text
☀ ☀ ☀ ☀ ☀ ☀ ☀

7 turns of daylight remain
```

Each input consumes one daylight unit.

If all Shades are not buried before daylight reaches zero:

```text
SUNSET
```

The level is lost.

Undo restores daylight.

### Design intent

Sunset should appear late enough that the player already understands shadow manipulation.

It transforms route discovery into optimisation without adding another entity type.

---

## 13. Campaign Structure

Target:

> **18 handcrafted levels**

The campaign should teach through composition rather than tutorial text wherever possible.

---

## 14. Chapter I — SHADOW

### Levels 001–004

Purpose:

- teach sun direction;
- teach pillar shadows;
- teach Shade movement;
- teach graves.

Recommended board sizes:

```text
7×7
7×7
7×7
9×9
```

The first level should make the intended input obvious.

Example concept:

```text
#######
#.....#
#..G..#
#.....#
#.P...#
#..S..#
#######
```

No UI instruction beyond perhaps:

```text
MOVE THE SUN
```

The level itself should explain the mechanic.

---

## 15. Chapter II — CORNERS

### Levels 005–008

Purpose:

- force the player to rotate sunlight multiple times;
- teach that shadow geometry changes globally;
- teach routing around structures.

Solutions begin resembling:

```text
W W N E S S W
```

The player should realise they are not choosing where the Shade goes directly.

They are choosing which shadow corridor exists this turn.

---

## 16. Chapter III — PROCESSION

### Levels 009–012

Introduce multiple Shades.

Example:

```text
#########
#S.....G#
#...P...#
#.......#
#...P...#
#G.....S#
#########
```

The important discovery:

> One change to the sun affects every Shade.

The player must coordinate several deterministic agents with a single global input.

This should be the point where UMBRA becomes meaningfully difficult.

---

## 17. Chapter IV — SHORT STONES

### Levels 013–015

Introduce one new object:

```text
L
```

A low stone casts only one shadow tile.

This creates local shadow geometry and allows more precise routing.

Do not introduce any additional mechanics in this chapter.

The contrast becomes:

```text
P  long shadow
L  one-tile shadow
```

That should be sufficient to significantly expand the puzzle space.

---

## 18. Chapter V — ECLIPSE

### Levels 016–018

Combine:

- multiple Shades;
- tall pillars;
- low stones;
- complex shadow overlap;
- sunset limits.

Level 18 should look deceptively simple.

Example composition:

```text
###########
#....G....#
#.........#
#..P...P..#
#.........#
#....S....#
#.........#
#..P...P..#
#.........#
#....G....#
###########
```

The final puzzle should feel elegant rather than enormous.

Target maximum board size:

```text
11×11
```

Avoid turning the finale into a maze.

---

## 19. Solver

Every level must be solver-verifiable.

The branching factor is exceptionally small:

```text
4
```

Possible actions:

```text
N
E
S
W
```

Use BFS for minimum solutions.

### State signature

A state signature can contain:

```text
sun direction
sorted Shade positions
buried count
remaining daylight
```

For example:

```ts
function signature(state: GameState): string {
  return [
    state.sun,
    [...state.shades]
      .sort(comparePositions)
      .map(p => `${p.x},${p.y}`)
      .join(";"),
    state.buried,
    state.daylight ?? "-"
  ].join("|");
}
```

### Solver requirements

`npm run solve` should:

1. load every authored level;
2. BFS from the initial state;
3. prove the level solvable;
4. calculate the true minimum number of turns;
5. replay the returned solution;
6. assert replay solves the level;
7. fail if authored `par` differs from the true minimum.

This keeps the campaign honest.

---

## 20. Simulation Architecture

Keep the simulation completely independent from Three.js.

Recommended structure:

```text
input
  ↓
simulation
  ↓
GameState
  ↓
renderer
  ↓
Three.js animation
```

Possible directory structure:

```text
src/
├── game/
│   ├── state.ts
│   ├── simulation.ts
│   ├── movement.ts
│   ├── shadows.ts
│   ├── collisions.ts
│   └── undo.ts
│
├── world/
│   ├── board.ts
│   ├── tiles.ts
│   ├── level.ts
│   └── loader.ts
│
├── entities/
│   └── shade.ts
│
├── rendering/
│   ├── scene.ts
│   ├── board.ts
│   ├── shade.ts
│   ├── lighting.ts
│   ├── shadows.ts
│   └── animation.ts
│
├── input/
│   ├── keyboard.ts
│   └── touch.ts
│
├── ui/
│   ├── hud.ts
│   ├── menu.ts
│   └── level-select.ts
│
├── audio/
│   └── audio.ts
│
└── levels/
    ├── 001.json
    ├── ...
    └── index.ts
```

---

## 21. Suggested State

Keep state deliberately small.

```ts
type Direction = "N" | "E" | "S" | "W";

interface Position {
  x: number;
  y: number;
}

interface GameState {
  sun: Direction;
  shades: Position[];
  buried: number;
  daylight?: number;
  turn: number;
}
```

Static board geometry belongs in the loaded level, not in mutable state.

---

## 22. Level Format

Example:

```json
{
  "id": "001",
  "name": "First Shade",
  "chapter": "shadow",
  "par": 3,
  "width": 7,
  "height": 7,
  "startingSun": "W",
  "map": [
    "#######",
    "#.....#",
    "#..G..#",
    "#.....#",
    "#.P...#",
    "#..S..#",
    "#######"
  ]
}
```

Sunset level:

```json
{
  "id": "016",
  "name": "Last Light",
  "chapter": "eclipse",
  "par": 9,
  "daylight": 11,
  "width": 9,
  "height": 9,
  "startingSun": "N",
  "map": [
    "#########",
    "#...G...#",
    "#.......#",
    "#..P.P..#",
    "#...S...#",
    "#..L.L..#",
    "#.......#",
    "#...G...#",
    "#########"
  ]
}
```

---

## 23. Visual Direction

UMBRA should feel visually distinct from *Pilgrims*.

### World

Think:

- ruined Mediterranean courtyard;
- Silk Road funerary complex;
- bleached stone;
- massive empty spaces;
- wind-worn architecture;
- sparse vegetation;
- dust suspended in light;
- tiny Shades against monumental ruins.

### Palette

The environment should be visually restrained:

- ivory stone;
- pale sand;
- warm sunlight;
- extremely dark Shade silhouettes;
- deep cool shadows.

Do not over-detail the board.

The player must always be able to read shadow geometry immediately.

---

## 24. Camera

Use a fixed or gently adjustable diorama camera.

Target:

```text
pitch: ~45–55°
yaw: fixed
orthographic preferred
```

The camera should prioritise the visibility of:

- pillar position;
- shadow length;
- Shade position;
- graves.

Avoid low cinematic angles during active puzzle play.

---

## 25. Sun Transition

When the player changes direction, do not visually teleport the sun.

The simulation resolves immediately.

The renderer then animates the lighting rig around the board over approximately:

```text
350–500 ms
```

During the transition:

- sunlight sweeps around the ruins;
- shadows race over the floor;
- dust catches the moving light;
- Shades move only after or near the end of the lighting transition.

This should make a tiny grid action feel physically substantial.

Important:

> Animation is presentation only.

The simulation state must already be resolved before rendering interpolation begins.

---

## 26. Shade Design

Shades should be almost featureless.

Possible appearance:

- narrow humanoid silhouette;
- slightly distorted robe/body;
- no readable face;
- subtle trailing smoke/dust;
- tiny grounding shadow only when standing in light, if desired.

They should look vulnerable rather than monstrous.

Their small scale reinforces the monumental environment.

---

## 27. Grave Design

Avoid obvious Western tombstones.

Use something more ambiguous:

- shallow stone depression;
- circular funerary seal;
- broken sarcophagus aperture;
- carved square in the floor;
- dark doorway descending underground.

The player should read it as a destination before necessarily understanding exactly what it represents.

---

## 28. Audio

Keep audio extremely sparse.

### Ambient

- dry wind;
- distant sand movement;
- occasional stone resonance;
- almost inaudible low drone.

### Interaction sounds

Sun movement:

```text
low stone resonance / air sweep
```

Shade movement:

```text
soft cloth / sand drag
```

Burial:

```text
single deep resonant tone
```

Undo:

```text
brief reversed resonance
```

Avoid constant melodic music during puzzle solving.

---

## 29. Title Screen

Black screen.

A single pillar stands in an empty space.

A tiny Shade shelters behind it.

The sun slowly moves.

The pillar's shadow changes.

The Shade quietly moves to remain protected.

Then:

```text
UMBRA

The dead remember the shade.

BEGIN
```

The title sequence teaches the fundamental idea before the player presses anything.

---

## 30. Opening Level Experience

After BEGIN:

1. Camera fades into the first courtyard.
2. One Shade is visible.
3. One pillar is visible.
4. One grave is visible.
5. A sun indicator appears around the edge of the board.

Minimal instruction:

```text
MOVE THE SUN
```

Once the player performs the correct input, the instruction disappears permanently.

Avoid tutorial dialogue.

---

## 31. UI

The HUD should remain minimal.

Example:

```text
UMBRA        004 — TURNING

        ☀ N

     DAYLIGHT  —


Z Undo     R Restart
```

On sunset levels:

```text
DAYLIGHT  ● ● ● ● ○ ○
```

Avoid numerical timers if a visual representation reads better.

---

## 32. Progression

Persist using `localStorage`.

Store:

```text
highest unlocked level
completed levels
best move count per level
settings
mute state
camera preference
```

Do not require accounts or backend services.

---

## 33. Technology

Recommended stack:

```text
TypeScript
Three.js
Vite
Vitest
Cloudflare Workers static assets
```

The game should remain entirely client-side.

No server logic is needed.

---

## 34. Testing

Simulation tests should cover:

- shadow calculation in all four directions;
- tall pillar shadow length;
- low stone one-tile shadow;
- Shade movement;
- blocked movement;
- simultaneous movement;
- collision cancellation;
- swap prevention;
- grave entry;
- multiple Shade resolution;
- sunset;
- undo;
- deterministic replay;
- state signature stability.

Add determinism tests:

```text
same state + same input = identical state
```

No `Math.random()` or clock dependency may exist inside simulation code.

---

## 35. MVP Scope

The Sunday build should contain only:

```text
✓ grid board
✓ four sun directions
✓ tall pillars
✓ logical shadows
✓ Shades
✓ graves
✓ simultaneous movement
✓ undo
✓ restart
✓ solver
✓ level loading
✓ basic Three.js rendering
✓ 6–8 initial levels
```

Do not build yet:

```text
✗ low stones
✗ sunset
✗ 18-level campaign
✗ elaborate models
✗ music generation
✗ particle polish
✗ title cinematic
✗ mobile polish
```

First prove:

> **Is changing the sun fun enough to support puzzles?**

If yes, expand.

---

## 36. Full V1 Scope

After the mechanic proves itself:

```text
18 levels
5 chapters
tall pillars
low stones
multiple Shades
sunset levels
BFS verified par
unlimited undo
level select
saved progress
desktop + touch input
Three.js diorama presentation
ambient audio
title sequence
Cloudflare deployment
```

Then stop.

Do not add:

- switches;
- keys;
- enemies;
- inventory;
- moving platforms;
- dialogue;
- procedural levels;
- meta progression;
- upgrades;
- combat.

The puzzle system should succeed on geometry alone.

---

## 37. Design Test

Before expanding the project beyond the prototype, build three levels:

### Test A — Obvious

One Shade, one pillar, one grave.

The player should solve it almost accidentally.

### Test B — Route

One Shade must travel around two pillars using at least three different sun directions.

### Test C — Coordination

Two Shades require conflicting intermediate sun states before both can reach graves.

If these three are satisfying:

> UMBRA works.

If Test C feels arbitrary or unreadable, fix the core movement/shadow rules before adding content.

---

## 38. Success Criteria

UMBRA succeeds if:

1. a new player understands the relationship between sun, shadow and Shade movement in under one minute;
2. a puzzle can be visually read without inspecting UI text;
3. solutions feel discovered rather than brute-forced;
4. the same four inputs remain interesting through 18 levels;
5. the solver proves every authored level;
6. adding low stones creates depth rather than merely complexity;
7. the game can be completed without feature creep.

---

## 39. Tone

UMBRA should not feel like horror.

It should feel:

```text
ancient
quiet
melancholic
ritualistic
lonely
beautiful
```

The Shades are not enemies.

The player is helping them reach where they belong before the light disappears.

---

## 40. Tagline

Primary:

> **You don't move the dead. You move the sun.**

Secondary:

> **The dead remember the shade.**

---

## 41. One-Sentence Pitch

> **UMBRA is a deterministic puzzle game where you rotate the sun around ancient ruins, reshaping shadows that guide the dead toward their graves.**

---

## 42. Project Rule

Whenever a proposed new feature appears, ask:

> **Does this make manipulating shadow geometry more interesting?**

If the answer is no:

> **Do not add it.**

That rule should keep UMBRA small.
