import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cloneState } from "../src/game/clone";
import { computeShadows } from "../src/game/shadows";
import { replay, solve } from "../src/game/Solver";
import { isSolved, resolveTurn } from "../src/game/TurnResolver";
import { DIRECTIONS, GameState } from "../src/game/types";
import { LEVELS } from "../src/levels/index";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";
import { stateSignature } from "../src/game/GameState";
import { manualState } from "./helpers";

const CAMPAIGN = LEVELS as LevelDefinition[];

/* ------------------------------------------------------------------ *
 * 1. The simulation cannot become nondeterministic.
 * ------------------------------------------------------------------ */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("simulation purity", () => {
  const files = [
    ...sourceFiles(resolve(process.cwd(), "src/game")),
    ...sourceFiles(resolve(process.cwd(), "src/world")),
  ];

  it("scans the simulation sources", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each([
    ["Math.random", /Math\.random/],
    ["Date.now", /Date\.now/],
    ["new Date", /new Date\b/],
    ["performance.now", /performance\.now/],
    ["setTimeout", /\bsetTimeout\b/],
    ["requestAnimationFrame", /\brequestAnimationFrame\b/],
    ["crypto", /\bcrypto\./],
    ["window", /\bwindow\./],
    ["document", /\bdocument\./],
  ])("contains no %s", (_label, pattern) => {
    const offenders = files.filter((file) => pattern.test(readFileSync(file, "utf8")));
    expect(offenders, `nondeterministic source in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("never imports three.js or a rendering/UI/input/audio module", () => {
    const offenders = files.filter((file) =>
      /from\s+["'](three|.*\/(rendering|ui|input|audio)\/)/.test(readFileSync(file, "utf8")),
    );
    expect(offenders, `layering violation in: ${offenders.join(", ")}`).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Rules that must stay deterministic under permutation / repetition.
 * ------------------------------------------------------------------ */

function permute<T>(items: T[]): T[] {
  // Reverse is enough to exercise order dependence for small arrays.
  return [...items].reverse();
}

describe("order independence and repeated inputs", () => {
  it("resolveTurn produces identical results for a permuted shades array", () => {
    for (const definition of CAMPAIGN) {
      const state = loadLevel(definition);
      if (state.shades.length < 2) continue;
      const shuffled = cloneState(state);
      shuffled.shades = permute(shuffled.shades).map((shade, index) => ({
        ...shade,
        colorIndex: index,
      }));
      for (const sun of DIRECTIONS) {
        const a = resolveTurn(state, sun);
        const b = resolveTurn(shuffled, sun);
        const positions = (s: GameState) =>
          s.shades
            .map((shade) => `${shade.buried ? "X" : `${shade.position.x},${shade.position.y}`}`)
            .sort()
            .join("|");
        expect(positions(a), `${definition.id} sun ${sun}`).toBe(positions(b));
        expect(a.turn).toBe(b.turn);
        expect(a.status).toBe(b.status);
      }
    }
  });

  it("choosing the same sun again is legal and still consumes a turn", () => {
    const state = manualState({
      width: 5,
      height: 6,
      sun: "S",
      shades: [{ x: 2, y: 4 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 5 } }],
      tile: (x, y) => (x === 2 && y === 1 ? "Grave" : "Floor"),
    });
    const first = resolveTurn(state, "S");
    expect(first.turn).toBe(1);
    const second = resolveTurn(first, "S");
    expect(second.turn).toBe(2);
    expect(second.shades[0].position).toEqual({ x: 2, y: 2 });
  });
});

/* ------------------------------------------------------------------ *
 * 3. Terrain: void blocks exactly like a wall.
 * ------------------------------------------------------------------ */

describe("void", () => {
  it("blocks movement and is never a shadow decal", () => {
    const state = manualState({
      width: 5,
      height: 6,
      sun: "S",
      shades: [{ x: 2, y: 3 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 5 } }],
      tile: (x, y) => (x === 2 && y === 2 ? "Void" : "Floor"),
    });
    const next = resolveTurn(state, "S");
    expect(next.shades[0].position).toEqual({ x: 2, y: 3 });
    expect(next.shades[0].buried).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * 4. A blocked leader holds the Shade behind it (integration, not just
 *    the collision unit).
 * ------------------------------------------------------------------ */

describe("chained waiting", () => {
  it("a blocked Shade prevents the Shade behind it from advancing", () => {
    // Two shades in a column, pillar below, wall above the leader: the leader
    // cannot enter the wall, so the follower cannot enter the leader's tile.
    const state = manualState({
      width: 5,
      height: 7,
      sun: "S",
      shades: [
        { id: "leader", x: 2, y: 2 },
        { id: "follower", x: 2, y: 3 },
      ],
      casters: [{ kind: "pillar", position: { x: 2, y: 6 } }],
      tile: (x, y) => (x === 2 && y === 1 ? "Wall" : "Floor"),
    });
    const next = resolveTurn(state, "S");
    expect(next.shades.find((s) => s.id === "leader")!.position).toEqual({ x: 2, y: 2 });
    expect(next.shades.find((s) => s.id === "follower")!.position).toEqual({ x: 2, y: 3 });
  });
});

/* ------------------------------------------------------------------ *
 * 5. The visited key must not merge states that behave differently.
 *    An over-complete key (it also distinguishes turn parity and the full
 *    board) can only find a minimum >= the production key's. If they agree
 *    on every level, the production key is not silently pruning a shorter
 *    route.
 * ------------------------------------------------------------------ */

/**
 * Built from scratch rather than reusing `stateSignature`, so an omission in the
 * production key cannot hide inside it. It carries every mutable field plus the
 * full board, so it is strictly finer: its minimum can only be >= production's.
 */
const overCompleteKey = (state: GameState): string =>
  JSON.stringify({
    sun: state.sun,
    shades: state.shades
      .map((shade) => (shade.buried ? "X" : `${shade.position.x},${shade.position.y}`))
      .sort(),
    buried: state.shades.filter((shade) => shade.buried).length,
    daylight: state.daylight,
    turn: state.turn,
    status: state.status,
    board: state.board.tiles,
    casters: state.board.casters.map(
      (caster) => `${caster.kind}:${caster.position.x},${caster.position.y}`,
    ),
  });

describe("solver key soundness", () => {
  it.each(CAMPAIGN.map((level) => [level.id, level] as const))(
    "level %s reports the same minimum with an over-complete key",
    (_id, definition) => {
      const state = loadLevel(definition);
      const limit = (definition.par ?? 12) + 1;
      const production = solve(state, { maxDepth: limit });
      const independent = solve(state, { maxDepth: limit, key: overCompleteKey });
      expect(production).not.toBeNull();
      expect(independent).not.toBeNull();
      expect(independent!.moves).toBe(production!.moves);
      expect(replay(state, independent!.path).status).toBe("solved");
    },
  );
});

/* ------------------------------------------------------------------ *
 * 6. Independent minimality: a depth-limited exhaustive walk with NO
 *    visited set at all, so it cannot inherit any key assumption. It
 *    proves no shorter solution exists for every level within reach.
 * ------------------------------------------------------------------ */

function solvesWithin(state: GameState, limit: number): boolean {
  if (isSolved(state)) return true;
  if (limit <= 0 || state.status !== "playing") return false;
  for (const sun of DIRECTIONS) {
    const next = resolveTurn(state, sun);
    if (next.status === "sunset") continue;
    if (isSolved(next)) return true;
    if (solvesWithin(next, limit - 1)) return true;
  }
  return false;
}

describe("independent minimality", () => {
  const small = CAMPAIGN.filter((level) => (level.par ?? 99) <= 8);
  it("covers the small levels exhaustively", () => {
    expect(small.length).toBeGreaterThanOrEqual(12);
  });

  it.each(small.map((level) => [level.id, level] as const))(
    "level %s has no solution shorter than par, and one exactly at par",
    (_id, definition) => {
      const par = definition.par!;
      const state = loadLevel(definition);
      // No visited set: pure depth-limited enumeration of every input sequence.
      expect(solvesWithin(state, par - 1), `${definition.id} should need ${par}`).toBe(false);
      expect(solvesWithin(state, par)).toBe(true);
    },
  );
});


/* ------------------------------------------------------------------ *
 * 7. Stronger than minima: the visited key must be a bisimulation. Two
 *    states that share a signature must behave identically — for every
 *    input their successors must again share a signature. Unlike comparing
 *    minima, this catches an omitted field even when the campaign has slack
 *    (e.g. daylight, which never binds on the authored levels).
 *
 *    Exploration uses the over-complete key so the group actually contains
 *    the duplicate-looking states; `turn` is deliberately part of it, since
 *    a state reached later must still behave the same.
 * ------------------------------------------------------------------ */

/** Enumerate the reachable states using the over-complete key. */
function reachableWithFineKey(start: GameState, depth: number): GameState[] {
  const seen = new Set<string>([overCompleteKey(start)]);
  const all: GameState[] = [start];
  let frontier: GameState[] = [start];
  for (let d = 0; d < depth; d++) {
    const next: GameState[] = [];
    for (const state of frontier) {
      if (state.status !== "playing") continue;
      for (const sun of DIRECTIONS) {
        const result = resolveTurn(state, sun);
        if (result.status === "sunset") continue;
        const key = overCompleteKey(result);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(result);
        next.push(result);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return all;
}

/** A canonical description of how a state responds to every input. */
function transitionProfile(state: GameState): string {
  return DIRECTIONS.map((sun) => {
    const next = resolveTurn(state, sun);
    return `${sun}:${next.status}:${stateSignature(next)}`;
  }).join("|");
}

describe("solver key bisimulation", () => {
  it.each(CAMPAIGN.map((level) => [level.id, level] as const))(
    "level %s: states sharing a signature behave identically",
    (_id, definition) => {
      const states = reachableWithFineKey(loadLevel(definition), 5).filter(
        (state) => state.status === "playing",
      );
      const profiles = new Map<string, Set<string>>();
      for (const state of states) {
        const signature = stateSignature(state);
        const bucket = profiles.get(signature) ?? new Set<string>();
        bucket.add(transitionProfile(state));
        profiles.set(signature, bucket);
      }
      const collisions = [...profiles.entries()].filter(([, bucket]) => bucket.size > 1);
      expect(
        collisions.length,
        `${definition.id}: ${collisions.length} signature(s) merge differing behaviour, e.g. ${
          collisions[0]?.[0] ?? "-"
        }`,
      ).toBe(0);
    },
  );
});

/* ------------------------------------------------------------------ *
 * 8. Shadows depend only on the static board and the sun, never on where
 *    the Shades happen to be.
 * ------------------------------------------------------------------ */

describe("shadow/state decoupling", () => {
  it("shadows are identical regardless of Shade positions and turn", () => {
    const a = manualState({
      width: 6,
      height: 6,
      sun: "N",
      shades: [{ x: 1, y: 1 }],
      casters: [
        { kind: "pillar", position: { x: 3, y: 4 } },
        { kind: "stone", position: { x: 4, y: 2 } },
      ],
    });
    const b = cloneState(a);
    b.shades = [
      { id: "s1", position: { x: 5, y: 5 }, buried: false, colorIndex: 0 },
      { id: "s2", position: { x: 0, y: 3 }, buried: true, colorIndex: 1 },
    ];
    b.turn = 7;
    for (const sun of DIRECTIONS) {
      expect([...computeShadows(a.board, sun)].sort()).toEqual(
        [...computeShadows(b.board, sun)].sort(),
      );
    }
  });

  it("cloneState is a deep copy: mutating a clone cannot touch the original", () => {
    const original = loadLevel(CAMPAIGN[0]);
    const copy = cloneState(original);
    copy.shades[0].position.x = 99;
    copy.shades[0].buried = true;
    copy.turn = 42;
    copy.sun = "E";
    copy.board.tiles[0][0] = "Void";
    expect(original.shades[0].position.x).not.toBe(99);
    expect(original.shades[0].buried).toBe(false);
    expect(original.turn).toBe(0);
    expect(original.sun).toBe(CAMPAIGN[0].startingSun);
    expect(original.board.tiles[0][0]).toBe("Wall");
  });

  it("loadLevel is deterministic: the same definition yields the same state", () => {
    for (const definition of CAMPAIGN) {
      const a = loadLevel(definition);
      const b = loadLevel(definition);
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      expect(stateSignature(b)).toBe(stateSignature(a));
    }
  });
});

/* ------------------------------------------------------------------ *
 * 9. Field-by-field: the key must distinguish every mutable field, and
 *    only merge states that are genuinely interchangeable. Reachability
 *    based checks are only as good as the states they happen to visit,
 *    so this enumerates the dimensions directly.
 * ------------------------------------------------------------------ */

describe("signature components", () => {
  const base = manualState({
    width: 5,
    height: 6,
    sun: "N",
    daylight: 5,
    shades: [
      { id: "a", x: 1, y: 1 },
      { id: "b", x: 3, y: 3 },
    ],
    casters: [{ kind: "pillar", position: { x: 2, y: 4 } }],
  });
  const baseSignature = stateSignature(base);

  it("differs for every sun", () => {
    for (const sun of ["E", "S", "W"] as const) {
      expect(stateSignature({ ...cloneState(base), sun })).not.toBe(baseSignature);
    }
  });

  it("differs when any individual Shade moves", () => {
    const first = cloneState(base);
    first.shades[0].position = { x: 1, y: 2 };
    expect(stateSignature(first)).not.toBe(baseSignature);

    const second = cloneState(base);
    second.shades[1].position = { x: 4, y: 3 };
    expect(stateSignature(second)).not.toBe(baseSignature);
  });

  it("differs when a Shade becomes buried", () => {
    const buried = cloneState(base);
    buried.shades[0].buried = true;
    expect(stateSignature(buried)).not.toBe(baseSignature);
  });

  it("differs for every remaining daylight value, including unlimited", () => {
    for (const daylight of [null, 0, 1, 4, 6]) {
      expect(stateSignature({ ...cloneState(base), daylight })).not.toBe(baseSignature);
    }
  });

  it("does NOT differ when two Shades swap places (they are interchangeable)", () => {
    const swapped = cloneState(base);
    swapped.shades = [swapped.shades[1], swapped.shades[0]];
    expect(stateSignature(swapped)).toBe(baseSignature);
  });

  it("does NOT differ on turn alone (no mechanic depends on it)", () => {
    expect(stateSignature({ ...cloneState(base), turn: 9 })).toBe(baseSignature);
  });
});
