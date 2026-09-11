# UMBRA

> **You don't move the dead. You move the sun.**

A small deterministic grid puzzle built with **TypeScript + Three.js**, playable in any
modern browser and deployable as a Cloudflare Worker (static assets).

Choose the direction of the sun. Pillars and low stones cast logical shadows across the
courtyard. Every Shade moves one tile *away from the sun* — but only into shadow. Guide
them all into graves before the daylight runs out.

Play: **https://umbra.asfarlab.fun**

---

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sun north | `W` / `↑` | compass ▲ |
| Sun south | `S` / `↓` | compass ▼ |
| Sun west | `A` / `←` | compass ◀ |
| Sun east | `D` / `→` | compass ▶ |
| Undo | `Z` / `Ctrl+Z` | Undo |
| Restart | `R` | Restart |
| Pause / menu | `Esc` | Menu |
| Mute | `M` | Sound |

You are never moving the Shades directly. You are choosing which shadow corridor exists
this turn.

The campaign has **18 handcrafted levels** across five chapters, all solver-verified.
Progress, best turn counts and settings are saved to `localStorage`.

| Chapter | Levels | Teaches |
| --- | --- | --- |
| I · Shadow | 001–004 | sun direction, pillar shadows, graves |
| II · Corners | 005–008 | rotating the sun, routing around structures |
| III · Procession | 009–012 | several Shades, one global input |
| IV · Short Stones | 013–015 | low stones and their one-tile shadows |
| V · Eclipse | 016–018 | everything, plus the sunset limit |

---

## Core rules

1. Each input selects one of four sun directions. The sun changes immediately.
2. Every shadow is recalculated: a **tall pillar** casts shadow continuously to the board
   edge, away from the sun; a **low stone** casts exactly one tile of shadow.
3. Each Shade attempts to move one tile **away from the sun**, but only if the destination
   is in bounds, traversable, free, and **currently in shadow**. Otherwise it waits.
4. Every Shade decides simultaneously. All Shades move in the same direction, so they
   cannot collide head-on; a blocked Shade can hold up the one behind it.
5. Entering a grave removes the Shade. Graves are reusable.
6. The level is solved when every Shade is buried. On sunset levels, each input spends one
   unit of daylight; running out first is **SUNSET**.

Low stones are deliberately **traversable**. Because the movement rule only requires the
*destination* to be in shadow, a one-tile stone shadow could otherwise never be entered
(the Shade would have to stand on the stone). Letting a Shade step onto a low stone makes
its single shadow tile a usable, precise one-step divert — and a line of low stones
becomes a walkable path the sun can push a Shade along.

The simulation is fully deterministic: same board + same sun choice = same result. There
is no randomness and no clock dependency anywhere under `src/game` or `src/world`.

---

## Architecture

The puzzle engine has **no dependency on Three.js**. It is plain, testable TypeScript:

```text
input → simulation → GameState → renderer → Three.js
```

```text
src/
├── game/          pure simulation (types, shadows, movement, collisions, turn
│                  resolution, undo, BFS solver, Game)
├── world/         board, tiles, level format + loader
├── rendering/     Three.js only: board, casters, shadow overlay, Shades,
│                  sun rig, animation, effects, camera, themes, title scene
├── input/         keyboard + on-screen compass
├── audio/         procedural Web Audio (wind, drone, stone resonance)
├── ui/            HUD, overlays, level select, save data
└── levels/        handcrafted JSON levels 001–018
```

Animation never drives the simulation. A turn is resolved instantly, then the renderer
plays it back: **the sun sweeps around the ruins (~0.42 s), the shadow races outward from
each caster, and only then do the Shades step.**

### The authoritative shadow

Three.js shadow maps are deliberately **not** used for gameplay. The simulation computes
the logical shadow (`src/game/shadows.ts`), and `ShadowRenderer` paints exactly those
tiles as a translucent overlay, sweeping them outward when the sun changes. The shadow the
player sees is therefore the shadow the rules use — no invisible state, no mismatch.

---

## Solver

Every level is BFS-verified. The branching factor is exactly 4, so breadth-first search
finds the true minimum turn count.

```bash
npm run solve
```

For each level it proves solvability, prints the minimum and the path, independently
replays that path, and **fails with a non-zero exit** if an authored `par` differs from the
true minimum — so a stale par cannot slip through.

The BFS visited key (`stateSignature`) contains the sun, the sorted Shade positions, the
buried count and the remaining daylight. **If a stateful mechanic is ever added, the key
must be extended with its state**, or BFS will silently merge states that merely look
equivalent.

`npm run author` prints a human-readable turn-by-turn trace of a candidate level while you
design it:

```bash
npx tsx tools/author.ts --file candidate.txt
```

---

## Visuals

A fixed orthographic diorama camera (diorama / classic / elevated, ~46–60° pitch) keeps
the grid readable. UMBRA is deliberately distinct from *Pilgrims*: bleached ivory stone,
pale sand, hard warm sunlight and deep, cool shadows, and a small regal princess
traveller leading the procession of Shades.

Every gameplay object is an **AI-authored, Blender-prepared model** (see *Assets* below),
tinted per chapter at runtime so a single set of generated meshes serves all five
chapters. If a model is ever missing, the renderer falls back to a procedural primitive,
so the game never hard-fails on an absent asset.

The title screen is a small scene in its own right: a single pillar in an empty space, the
traveller sheltering behind it, and a slow sun that changes the shadow while she quietly
shifts to stay protected — the whole mechanic, taught before the player presses anything.

Before the title, an **eclipse-seal gateway** captures one real user gesture (which is what
lets the browser start audio). The title scene waits behind its circular aperture; breaking
the seal opens it in one smooth move, the camera easing back as the title fades in.

---

## Audio

Sparse and procedural, generated with the Web Audio API on the first user gesture: dry
wind, a low stone drone and short interaction sounds (a sun sweep, cloth-and-sand Shade
movement, a deep burial tone, a reversed resonance for undo). Two generated ambient tracks
stream lazily and crossfade by scene.

---

## Assets

The game ships no hand-drawn art. Every model is generated from a text prompt, and every
asset is reproducible:

```text
gpt-image-2.5-sunburst  →  fal Hunyuan 3D 3.1 Pro  →  Blender prep/rig  →  public/models
        (reference)                (geometry + PBR)        (bake, orient,
                                                             decimate, rig)
```

| File | Kind | Preparation |
| --- | --- | --- |
| `princess.glb` | rigged character | 16k tris, 14-bone rig, `idle` + `walk` clips, 0.9 units tall |
| `pillar.glb` | static prop | 6k tris, bleached limestone column, PBR |
| `stone.glb` | static prop | 4k tris, low slab, fitted to 0.95 tiles wide |
| `grave.glb` | static prop | 6k tris, carved funerary seal, flattened to a shallow ring |
| `rubble.glb` | static prop | 2.5k tris, broken-wall cluster, scattered on walls and sand |
| `cypress.glb` | static prop | 9k tris, columnar Mediterranean cypress |
| `bush.glb` | static prop | 4k tris, dense evergreen shrub |
| `title.glb` | static prop | 12k tris, ringed monument for the opening scene |

Each reference was generated with a transparent background, one isolated object per image,
then reconstructed with Hunyuan 3D 3.1 Pro (PBR), then baked, centred, grounded, oriented,
decimated, texture-downscaled to 1024, and (for the Shade) rigged and animated in Blender.

### Regenerating the models

```bash
# 1. reference images (gpt-image-2.5-sunburst), transparent background
python "$CODEX_HOME/skills/.system/imagegen/scripts/image_gen.py" generate-batch \
  --model gpt-image-2.5-sunburst --input tools/asset-prompts/models.jsonl \
  --out-dir output/imagegen/refs --quality xhigh --background transparent \
  --output-format png --no-augment --concurrency 3

# 2. image -> 3D (fal Hunyuan 3.1 Pro, paid), resumable
for name in princess pillar title stone grave rubble cypress bush; do
  python "$CODEX_HOME/skills/image-to-3d/scripts/hunyuan_3d.py" generate \
    --image "output/imagegen/refs/$name.png" --name "$name" --out-dir output/3d --pbr
done

# 3. facing detection + Blender prep/rig -> public/models
npm run models -- --detect
```

Facing is determined automatically (`tools/detect_facing.py`): each model is rendered from
four orthographic views and compared against its reference silhouette by IoU; the matching
view maps to the Blender yaw that turns the model to face +X, which is UMBRA's runtime
convention. The result is also recorded in `output/3d/review/<name>/facing.json`.

### Music and share art

```bash
npm run music     # Lyria 3.5 (Gemini API) -> public/audio/{title,vigil}.mp3
npm run og        # key art + Pillow typography -> og-card.png + icons
```

The share card composes a generated key-art backdrop with real typography (Georgia), so
the words are always correct.

---

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # typecheck + production build into dist/
npm run test       # unit tests for the simulation
npm run solve      # BFS-verify every level and its par
npm run smoke      # headless Chrome smoke test (needs a preview server)
npm run models     # prepare/rig the GLBs from the newest Hunyuan runs (Blender)
npm run music      # regenerate ambient tracks (GEMINI_API_KEY)
npm run og         # regenerate the social card and icons
npm run deploy     # build + wrangler deploy to umbra.asfarlab.fun
```

---

## Tests

`npm test` covers shadow calculation in all four directions, pillar shadow length, the
one-tile stone shadow, Shade movement and blocking, simultaneous movement, collision
cancellation, swap prevention, grave entry and reuse, multiple Shades, sunset, undo,
deterministic replay, signature stability, and the whole campaign (every level solvable,
every authored par equal to the true minimum, every solution inside its daylight budget).

---

## Design rule

Whenever a proposed new feature appears, ask:

> **Does this make manipulating shadow geometry more interesting?**

If the answer is no: do not add it.
