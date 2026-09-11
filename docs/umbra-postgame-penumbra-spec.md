# UMBRA — Postgame Architecture: Deep Umbra + Penumbra

> **Level 18 ends the journey. It does not exhaust the shadow.**

This specification extends UMBRA beyond its original 18-level campaign without weakening the elegance of the base game.

The key structural decision:

- **Levels 001–018 remain the complete core campaign.**
- Completing Level 018 is a real ending and earns campaign completion.
- After Level 018, the player is offered optional postgame paths:
  - **DEEP UMBRA** — harder puzzles using the original UMBRA rules.
  - **PENUMBRA** — a compact experimental branch built around partial shadow.
- Future UMBRA levels may be added indefinitely without changing the meaning of "Campaign Complete."

The base game must never become retroactively incomplete because more challenge content is added later.

---

# 1. Product Structure

UMBRA is divided into three conceptual layers.

```text
UMBRA

CORE CAMPAIGN
001–018
required
complete story / complete mechanical arc
        │
        └── Level 018: UMBRA
                 │
                 ▼
        CAMPAIGN COMPLETE
                 │
       ┌─────────┴──────────┐
       │                    │
       ▼                    ▼
  DEEP UMBRA             PENUMBRA
  U019+                  P001+
  original rules         altered light model
  extreme puzzles        experimental postgame
```

The player may freely choose either postgame path after completing Level 018.

Neither branch is required to consider UMBRA "finished."

---

# 2. Core Principle

Level 018 is a **graduation point**.

Before Level 018:

> The game teaches UMBRA.

After Level 018:

> The game assumes mastery.

This distinction allows postgame puzzles to be significantly harder without damaging the pacing or accessibility of the main campaign.

The first 18 levels remain designed for a thoughtful normal player.

Everything beyond them may assume:

- complete understanding of shadow geometry;
- comfort planning several sun rotations ahead;
- understanding of simultaneous Shade movement;
- understanding of chains and blocking;
- familiarity with low-stone routing;
- comfort with daylight optimisation;
- willingness to restart and reason deeply.

In other words:

> Postgame UMBRA is where the peanuts end.

---

# 3. Campaign Completion

Completing Level 018 sets:

```ts
campaignComplete = true
postgameUnlocked = true
```

The game should immediately treat the core campaign as fully completed.

Do **not** change:

```text
18 / 18
```

into:

```text
18 / 27
```

when more levels are later added.

The player completed UMBRA.

Everything afterwards is bonus mastery content.

---

# 4. Level 018 Ending

Level 018 remains:

```text
018 — UMBRA
```

When the final Shade enters its grave:

1. normal solve effects play;
2. the HUD fades;
3. ambient sound falls quieter;
4. the camera holds on the empty courtyard;
5. the sun continues its slow movement;
6. no menu appears immediately.

After approximately 2–3 seconds:

```text
UMBRA

The dead are still.
```

Then:

```text
CAMPAIGN COMPLETE
```

Do not undermine this with:

```text
NEXT LEVEL
```

The player deserves an ending.

---

# 5. The Postgame Reveal

After the completion moment, the sunlight continues changing.

The player sees the shadow edge soften slightly.

A new line appears:

```text
But shadow has an edge.
```

Then reveal the postgame choice.

Example:

```text
THE JOURNEY IS COMPLETE.

Yet two roads remain.


[ DESCEND DEEPER ]
Pure UMBRA. No new rules.


[ ENTER THE HALF-LIGHT ]
PENUMBRA. The rules of shadow change.


[ RETURN ]
```

Preferred final labels:

```text
DEEP UMBRA
PENUMBRA
RETURN
```

The descriptions can appear underneath in smaller text.

---

# 6. The Two Postgame Promises

These branches must make different promises.

## DEEP UMBRA

> **Nothing new. Only harder.**

This branch uses the exact original rules.

Allowed mechanics:

- tall pillars;
- low stones;
- Shades;
- reusable graves;
- simultaneous movement;
- collisions/chains;
- sunset.

No additional gameplay entity or tile type is required.

The challenge comes entirely from:

- geometry;
- sequencing;
- coordination;
- optimisation.

This is the "prove you actually understand UMBRA" mode.

---

## PENUMBRA

> **You mastered shadow. Now master its boundary.**

This branch changes the illumination model.

It is explicitly experimental postgame content.

It should initially be short and self-contained.

Recommended first release:

```text
5 Penumbra levels
```

The branch may expand later only if its rule system proves strong enough.

---

# 7. Deep Umbra Level Numbering

Never continue ordinary campaign numbering in the UI as though these were required campaign stages.

Internally, files may still be cleanly ordered.

Recommended IDs:

```text
U019
U020
U021
...
```

or:

```text
D001
D002
D003
...
```

Preferred:

```text
U019+
```

because they remain fundamentally UMBRA puzzles.

Examples:

```text
U019 — The Narrow Shadow
U020 — Stillness
U021 — Four Graves
U022 — Long Noon
```

The title may display:

```text
DEEP UMBRA 01
```

instead of:

```text
LEVEL 19
```

This preserves the symbolic completeness of 001–018.

---

# 8. Deep Umbra Has No Fixed Ceiling

Deep Umbra is deliberately expandable.

There is **no architectural assumption** that UMBRA ends at 18 total authored puzzles.

Possible future counts:

```text
18 core + 5 deep
18 core + 12 deep
18 core + 30 deep
```

All are valid.

The base campaign remains:

```text
18 / 18 complete
```

Deep Umbra instead reports:

```text
DEEP UMBRA
7 solved
```

or:

```text
7 / 12
```

only within its own section.

Adding new Deep Umbra levels must never reduce completion status for players who previously cleared all available content.

Track completion per level ID rather than by numeric count alone.

---

# 9. Deep Umbra Difficulty Philosophy

Deep Umbra may be unreasonable.

That is the point.

Target player reaction:

```text
"This looks impossible."

five minutes later

"Oh."

ten minutes later

"OH YOU BASTARD."
```

The puzzles should remain elegant, not merely large.

Difficulty should come from compressed interactions.

Avoid:

```text
bigger board = harder
more Shades = harder
more pillars = harder
```

Prefer:

```text
small board
few objects
high consequence per sun rotation
```

A 9×9 board that requires a 17-move insight is preferable to a 17×17 maze.

---

# 10. Deep Umbra Puzzle Families

Advanced levels may explore the existing rules much more aggressively.

## 10.1 Shadow Dependency

A Shade must occupy one shadow corridor temporarily so another Shade can move.

The player must understand movement order as a system.

---

## 10.2 Procession Chains

Use several aligned Shades where one blocked Shade causes a chain of waiting entities.

The puzzle is partly about intentionally blocking your own procession.

---

## 10.3 Shared Graves

Several Shades approach reusable graves from different axes.

Routing order matters.

---

## 10.4 Stone Rails

Lines or lattices of low stones create precise one-step corridors.

The player must repeatedly change sun direction to "walk" Shades along them.

---

## 10.5 False Progress

A Shade may move closer to its grave while making the state unsolvable.

The optimum solution requires apparently moving away.

---

## 10.6 Synchronisation

Several Shades must arrive at different critical positions on the same turn.

One global sun input controls all of them.

---

## 10.7 Sunset Mastery

Daylight budget approaches the true BFS minimum.

Examples:

```text
par:       14
daylight:  15
```

or, for the truly offensive:

```text
par:       17
daylight:  17
```

Use exact-budget levels sparingly.

They should feel like final exams, not normal play.

---

# 11. Deep Umbra Content Rule

No new mechanic may be added merely to create more Deep Umbra levels.

The challenge is:

> **How far can the original UMBRA rule system be pushed?**

If a proposed puzzle requires a new rule, it belongs somewhere else.

Possibly PENUMBRA.

Possibly nowhere.

---

# 12. Penumbra Core Concept

PENUMBRA introduces three illumination states.

```ts
type Illumination =
  | "light"
  | "penumbra"
  | "umbra";
```

Conceptually:

```text
LIGHT      fully illuminated
PENUMBRA   partially shadowed boundary
UMBRA      full shadow
```

The exact geometry does **not** need to be physically accurate.

It must be:

- deterministic;
- grid-readable;
- visually obvious;
- solver-friendly.

---

# 13. Penumbra Design Thesis

UMBRA asks:

> **Where is the shadow?**

PENUMBRA asks:

> **Where does the shadow end?**

The player is no longer primarily manipulating dark corridors.

They are manipulating **boundaries**.

That distinction is the reason PENUMBRA deserves to exist.

---

# 14. First Penumbra Entity Rule

The cleanest first experiment:

> **A Penumbral Shade moves away from the sun only if its destination is PENUMBRA.**

It may not enter:

```text
LIGHT
UMBRA
```

Only:

```text
PENUMBRA
```

This immediately changes how the player reads every caster.

---

# 15. Penumbra Shadow Geometry

Do not simulate realistic area-light optics.

Use an authored deterministic grid abstraction.

One possible tall-pillar footprint:

```text
sun
 ↓

   P
   █
  ▓▓▓
 ░▓▓▓░
░░▓▓▓░░
```

Legend:

```text
▓ = UMBRA
░ = PENUMBRA
. = LIGHT
```

Possible rule:

- central ray becomes UMBRA;
- side boundary tiles become PENUMBRA;
- penumbra width increases with distance.

Alternative simpler model:

```text
depth 1–2  → UMBRA
depth 3+   → PENUMBRA
```

Prototype both.

Choose whichever creates clearer puzzles.

Do not choose based on realism.

---

# 16. Penumbra Prototype Requirement

Before building a complete Penumbra branch, author exactly three proof levels.

## P001 — The Edge

One Penumbral Shade.

One caster.

One grave.

Purpose:

> understand that only partial shadow permits movement.

---

## P002 — Around the Edge

Require at least three sun orientations.

Purpose:

> prove penumbra geometry supports routing rather than a single gimmick.

---

## P003 — Two Conditions

Introduce either:

- two Penumbral Shades; or
- one ordinary UMBRA Shade plus one Penumbral Shade.

Purpose:

> prove that the system creates genuinely interesting global-input conflicts.

If P003 is not fun:

> stop.

Do not force PENUMBRA to exist merely because the name is excellent.

---

# 17. Two-Entity Penumbra Option

Only after P001–P003 prove the mechanic.

Possible entities:

```text
SHADE
moves only into UMBRA

WRAITH
moves only into PENUMBRA
```

Both still move:

```text
one tile away from the sun
```

The player controls the same global light.

A single sun change may:

- open a route for the Shade;
- close the Wraith's route;
- move both;
- move one;
- freeze both.

This should be the principal source of advanced Penumbra difficulty.

---

# 18. Penumbra Scope

Initial target:

```text
P001–P005
```

Suggested names:

```text
P001 — The Edge
P002 — Half-Light
P003 — Between
P004 — Two Shadows
P005 — Penumbra
```

Five levels is a deliberate cap for the first implementation.

If the mechanic remains compelling after real player testing, it may later become:

```text
P001–P010
```

But do not design ten levels before proving five.

---

# 19. Penumbra Finale

P005 should be sparse.

Avoid a giant mechanics soup.

Preferred shape:

```text
9×9 or 11×11
few casters
one or two entities
one elegant geometric trap
```

The final solution should rely on understanding the relationship among:

```text
light
penumbra
umbra
```

rather than raw search.

---

# 20. Post-Level-18 Choice Flow

On the first completion of Level 018:

```text
CAMPAIGN COMPLETE

The dead are still.

But shadow has an edge.
```

Then:

```text
WHAT REMAINS?


[ DEEP UMBRA ]
Nothing new. Only harder.


[ PENUMBRA ]
Enter the half-light.


[ RETURN TO TITLE ]
```

Do not force either branch.

---

# 21. Returning Players

Once postgame has been unlocked, the title menu may become:

```text
CONTINUE
CHAPTERS
DEEP UMBRA
PENUMBRA
SOUND
```

If Penumbra has not yet been started:

```text
PENUMBRA
NEW
```

Do not continually nag the player.

---

# 22. Level Select Structure

Before Level 018 completion:

```text
I     SHADOW
II    CORNERS
III   PROCESSION
IV    SHORT STONES
V     ECLIPSE
```

After completion:

```text
I     SHADOW
II    CORNERS
III   PROCESSION
IV    SHORT STONES
V     ECLIPSE

────────────────────

POSTGAME

DEEP UMBRA
PENUMBRA
```

Do not mix:

```text
019
020
P001
P002
```

into the ordinary campaign level grid.

They are different conceptual spaces.

---

# 23. Save Model

Recommended structure:

```ts
interface SaveData {
  campaign: {
    completed: boolean;
    best: Record<string, number>;
  };

  deepUmbra: {
    unlocked: boolean;
    completed: Record<string, boolean>;
    best: Record<string, number>;
  };

  penumbra: {
    unlocked: boolean;
    completed: Record<string, boolean>;
    best: Record<string, number>;
  };

  settings: {
    muted: boolean;
    camera: string;
  };
}
```

Actual implementation may remain backward-compatible with the existing save format.

The important point:

> Completion is ID-based, not total-count-based.

---

# 24. Future-Proofing Added Deep Umbra Levels

Suppose the game ships with:

```text
U019–U023
```

and a player solves all five.

Later the game adds:

```text
U024–U030
```

Do not make their previous achievement appear revoked.

Possible UI:

```text
DEEP UMBRA

Previously mastered: 5
Available: 12
Solved: 5 / 12
```

Or simply treat each level independently.

The core campaign completion badge remains untouched forever.

---

# 25. Solver Architecture

UMBRA and Deep Umbra continue using the existing state model:

```text
sun
Shade states
daylight
```

PENUMBRA should ideally still use the same high-level solver architecture:

```text
action
  ↓
illumination calculation
  ↓
movement intents
  ↓
collision resolution
  ↓
state
```

The branching factor remains:

```text
4
```

unless the player gains a genuinely new input.

Avoid introducing new actions unnecessarily.

---

# 26. Solver State for Penumbra

If illumination is derived entirely from:

```text
board geometry
sun direction
```

it does not need to be stored independently.

If future Penumbra mechanics introduce stateful illumination, that state must be added to the BFS signature.

Retain the existing rule:

> The solver state key must contain everything that can affect the next turn.

---

# 27. Rendering Contract

The existing UMBRA invariant remains sacred:

> **If movement legality depends on an illumination state, that state must be visibly readable.**

For PENUMBRA:

```text
LIGHT      visibly light
UMBRA      visibly full shadow
PENUMBRA   visibly partial shadow
```

Do not rely only on subtle colour differences.

Consider:

- softer shadow edge;
- dither/grain boundary;
- slightly translucent partial shadow;
- distinct animated transition edge.

The player should never need to guess whether a tile is Umbra or Penumbra.

---

# 28. Penumbra Visual Reveal

The first transition from UMBRA into PENUMBRA should happen in-world.

After selecting:

```text
ENTER THE HALF-LIGHT
```

return to the empty Level 018 courtyard.

The sun lowers.

The hard shadow edge softens.

For the first time, the player sees:

```text
full shadow
partial shadow
light
```

Then:

```text
PENUMBRA

Nothing lives at either extreme.
```

Fade into P001.

---

# 29. Audio

UMBRA postgame should not require a new soundtrack system.

Deep Umbra may reuse the existing ambient soundscape.

PENUMBRA may add one subtle variation:

- thinner drone;
- more air;
- distant harmonic beating;
- softer sun sweep.

Do not turn it into a dramatic sequel soundtrack.

It is an epilogue, not a new franchise production.

---

# 30. Narrative Tone

There is no need for exposition.

The progression itself is the narrative.

Core campaign:

> Guide the dead through shadow.

Deep Umbra:

> Continue practising what you already understand.

Penumbra:

> Discover that your understanding was incomplete.

That is enough.

---

# 31. Recommended Postgame Text

After Level 018:

```text
The dead are still.

You learned the shape of shadow.

But shadow has an edge.
```

Choice screen:

```text
DEEP UMBRA
Nothing new. Only harder.

PENUMBRA
Enter the half-light.

RETURN
The journey is already complete.
```

That final line is important.

It tells players they are not failing by stopping.

---

# 32. Completion States

Possible achievements / status labels:

```text
CAMPAIGN COMPLETE
18 / 18

DEEP UMBRA
MASTERED 7

PENUMBRA
3 / 5
```

If all currently available Deep Umbra levels are solved:

```text
DEEP UMBRA MASTERED
```

If more are added later, do not remove a historical completion badge if one is displayed.

Consider versioning mastery:

```text
Deep Umbra · First Set mastered
```

only if this becomes relevant.

Do not overengineer this now.

---

# 33. Content Release Strategy

Recommended:

## Phase 1

Ship current UMBRA:

```text
001–018
```

Stable.

## Phase 2

Add:

```text
U019–U023
```

five brutal Deep Umbra levels.

These require no new simulation rules.

## Phase 3

Prototype:

```text
P001–P003
```

privately.

If fun:

```text
P004–P005
```

and release PENUMBRA.

This avoids blocking finished UMBRA on experimental mechanics.

---

# 34. Deep Umbra Initial Five

Suggested first set:

## U019 — Still They Walk

Two Shades.

Very small board.

Intentional chain blocking.

---

## U020 — Narrow Noon

One Shade.

Several low stones.

Precise stone-rail routing.

---

## U021 — Procession

Three Shades.

Single grave.

Order and congestion matter.

---

## U022 — No Waste

Sunset.

Minimum solution equals daylight budget.

Use only after the player has voluntarily entered Deep Umbra.

---

## U023 — The Long Shadow

Sparse board.

Few pieces.

Deceptively high minimum.

Should feel like the purest expression of the original rule set.

---

# 35. The Super-Genius Clause

Deep Umbra is allowed to contain puzzles that normal campaign design would reject as too demanding.

Examples:

```text
minimum solution: 18–30 turns
several tempting dead states
exact daylight budget
multi-Shade synchronization
long dependency chains
```

However:

> Difficulty must still come from insight, not obscurity.

A genius-level puzzle should make the player say:

```text
"I should have seen that."
```

Not:

```text
"How was I supposed to know that?"
```

---

# 36. Hard Rule for Deep Umbra

Never add complexity merely to defeat the solver or inflate move count.

A good advanced UMBRA puzzle should remain explainable after solving.

The solution may be long.

The idea behind the solution should be elegant.

---

# 37. Hard Rule for Penumbra

PENUMBRA must justify itself mechanically.

Its existence depends on this statement being true:

> Partial shadow creates puzzle decisions that full shadow cannot.

If that statement does not survive playtesting:

> Remove Penumbra.

The post-Level-18 hook can remain dormant until the mechanic earns release.

---

# 38. No Forced Canonical Order

After 018, players may choose:

```text
Deep Umbra first
Penumbra first
only Deep Umbra
only Penumbra
neither
```

All are valid.

Do not gate Penumbra behind Deep Umbra completion.

Do not gate Deep Umbra behind Penumbra.

Level 018 is the only prerequisite.

---

# 39. Definition of "Finished"

UMBRA is finished when:

```text
001–018 complete
campaign ending shown
```

Deep Umbra and Penumbra are **postgame**, not unfinished work.

This distinction should remain true in:

- UI;
- README;
- save data;
- release notes;
- level select;
- player messaging.

---

# 40. README Language

Recommended wording:

> UMBRA contains an 18-level core campaign. Completing Level 018 finishes the main journey and unlocks optional postgame challenges.
>
> **Deep Umbra** continues with advanced puzzles using only the original rules.
>
> **Penumbra** is an experimental half-light campaign that changes how shadow itself behaves.

If Penumbra is not yet released:

> Completing UMBRA unlocks Deep Umbra. Further postgame experiments may appear later.

Do not advertise unfinished Penumbra prematurely.

---

# 41. Final Design Boundary

UMBRA remains governed by:

> **Does this make manipulating shadow geometry more interesting?**

Postgame adds one refinement.

For Deep Umbra:

> **Can this puzzle be made harder without adding a rule?**

For Penumbra:

> **Does partial shadow create a new kind of reasoning?**

If the answer is no:

> **Do not add it.**

---

# 42. Final Structure

```text
UMBRA
│
├── CORE CAMPAIGN
│   ├── I   Shadow
│   ├── II  Corners
│   ├── III Procession
│   ├── IV  Short Stones
│   └── V   Eclipse
│
│   001–018
│
└── POSTGAME
    │
    ├── DEEP UMBRA
    │   ├── U019
    │   ├── U020
    │   ├── U021
    │   ├── ...
    │   └── no fixed ceiling
    │
    └── PENUMBRA
        ├── P001 The Edge
        ├── P002 Half-Light
        ├── P003 Between
        ├── P004 Two Shadows
        └── P005 Penumbra
```

The most important sentence:

> **Level 018 is the end of UMBRA's journey, but not the limit of what its rules can do.**
