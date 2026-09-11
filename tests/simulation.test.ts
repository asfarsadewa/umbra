import { describe, expect, it } from "vitest";
import { resolveCollisions } from "../src/game/CollisionResolver";
import { getShadeIntent } from "../src/game/Movement";
import { computeShadows } from "../src/game/shadows";
import { isSolved, resolveTurn } from "../src/game/TurnResolver";
import { Direction, MoveIntent } from "../src/game/types";
import { manualState } from "./helpers";

describe("shade movement", () => {
  it("moves one tile away from the sun when the destination is shadowed", () => {
    // Pillar below the shade; sun south => shadow north.
    const state = manualState({
      width: 5,
      height: 6,
      sun: "S",
      shades: [{ x: 2, y: 3 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 5 } }],
    });
    const shadows = computeShadows(state.board, state.sun);
    expect(getShadeIntent(state.board, state.sun, shadows, state.shades[0])).toEqual(
      { x: 2, y: 2 },
    );
  });

  it("waits when the destination is not in shadow", () => {
    const state = manualState({
      width: 5,
      height: 6,
      sun: "S",
      shades: [{ x: 2, y: 3 }],
    });
    const shadows = computeShadows(state.board, state.sun);
    expect(getShadeIntent(state.board, state.sun, shadows, state.shades[0])).toBeNull();
  });

  it("cannot enter a wall", () => {
    const state = manualState({
      width: 5,
      height: 6,
      sun: "S",
      shades: [{ x: 2, y: 3 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 5 } }],
      tile: (x, y) => (x === 2 && y === 2 ? "Wall" : "Floor"),
    });
    const shadows = computeShadows(state.board, state.sun);
    expect(getShadeIntent(state.board, state.sun, shadows, state.shades[0])).toBeNull();
  });

  it("cannot enter a tall pillar, but can step onto a low stone", () => {
    const pillar = manualState({
      width: 5,
      height: 6,
      sun: "S",
      shades: [{ x: 2, y: 3 }],
      casters: [
        { kind: "pillar", position: { x: 2, y: 5 } },
        { kind: "pillar", position: { x: 2, y: 2 } },
      ],
    });
    expect(
      getShadeIntent(
        pillar.board,
        pillar.sun,
        computeShadows(pillar.board, pillar.sun),
        pillar.shades[0],
      ),
    ).toBeNull();

    const stone = manualState({
      width: 5,
      height: 6,
      sun: "S",
      shades: [{ x: 2, y: 3 }],
      casters: [
        { kind: "pillar", position: { x: 2, y: 5 } },
        { kind: "stone", position: { x: 2, y: 2 } },
      ],
    });
    expect(
      getShadeIntent(
        stone.board,
        stone.sun,
        computeShadows(stone.board, stone.sun),
        stone.shades[0],
      ),
    ).toEqual({ x: 2, y: 2 });
  });

  it("uses a low stone as a one-tile divert", () => {
    // Shade stands on a stone; the stone's single shadow lets it step off.
    const state = manualState({
      width: 6,
      height: 4,
      sun: "W",
      shades: [{ x: 2, y: 1 }],
      casters: [{ kind: "stone", position: { x: 2, y: 1 } }],
    });
    const shadows = computeShadows(state.board, state.sun);
    expect(getShadeIntent(state.board, state.sun, shadows, state.shades[0])).toEqual(
      { x: 3, y: 1 },
    );
    // It can only take one such step.
    const after = resolveTurn(state, "W");
    expect(after.shades[0].position).toEqual({ x: 3, y: 1 });
    const again = resolveTurn(after, "W");
    expect(again.shades[0].position).toEqual({ x: 3, y: 1 });
  });

  it("all four suns push in the expected direction", () => {
    const cases: Array<[Direction, { x: number; y: number }]> = [
      ["N", { x: 2, y: 4 }],
      ["S", { x: 2, y: 2 }],
      ["E", { x: 1, y: 3 }],
      ["W", { x: 3, y: 3 }],
    ];
    for (const [sun, expected] of cases) {
      // A pillar on the far side casts shadow across the shade's tile.
      const casterPosition =
        sun === "N"
          ? { x: 2, y: 1 }
          : sun === "S"
            ? { x: 2, y: 5 }
            : sun === "E"
              ? { x: 4, y: 3 }
              : { x: 0, y: 3 };
      const state = manualState({
        width: 5,
        height: 6,
        sun,
        shades: [{ x: 2, y: 3 }],
        casters: [{ kind: "pillar", position: casterPosition }],
      });
      const shadows = computeShadows(state.board, sun);
      expect(
        getShadeIntent(state.board, sun, shadows, state.shades[0]),
        `sun ${sun}`,
      ).toEqual(expected);
    }
  });
});

describe("collision resolution", () => {
  const state = manualState({
    width: 5,
    height: 3,
    shades: [
      { id: "a", x: 1, y: 1 },
      { id: "b", x: 2, y: 1 },
      { id: "c", x: 3, y: 1 },
    ],
  });

  it("cancels two shades targeting the same tile", () => {
    const intents: MoveIntent[] = [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { entityId: "b", from: { x: 2, y: 1 }, to: { x: 2, y: 1 } },
    ];
    expect(resolveCollisions(state, intents).size).toBe(0);
  });

  it("forbids a swap", () => {
    const intents: MoveIntent[] = [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { entityId: "b", from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
    ];
    expect(resolveCollisions(state, intents).size).toBe(0);
  });

  it("allows a chain into vacated tiles", () => {
    const intents: MoveIntent[] = [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { entityId: "b", from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
      { entityId: "c", from: { x: 3, y: 1 }, to: { x: 4, y: 1 } },
    ];
    const moves = resolveCollisions(state, intents);
    expect(moves.get("a")).toEqual({ x: 2, y: 1 });
    expect(moves.get("b")).toEqual({ x: 3, y: 1 });
    expect(moves.get("c")).toEqual({ x: 4, y: 1 });
  });

  it("cancels a shade whose destination is held by a blocked shade", () => {
    const intents: MoveIntent[] = [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ];
    const moves = resolveCollisions(state, intents);
    expect(moves.size).toBe(0);
  });
});

describe("turn resolution", () => {
  it("resolves graves, reusing a grave for multiple shades", () => {
    const state = manualState({
      width: 5,
      height: 6,
      sun: "S",
      shades: [
        { x: 2, y: 4 },
        { x: 2, y: 3 },
      ],
      casters: [{ kind: "pillar", position: { x: 2, y: 5 } }],
      tile: (x, y) => (x === 2 && y === 1 ? "Grave" : "Floor"),
    });
    // Two south-sun turns push both shades north. The leader enters the grave,
    // the follower then enters the same grave.
    const first = resolveTurn(state, "S");
    expect(first.shades[0].position).toEqual({ x: 2, y: 3 });
    expect(first.shades[1].position).toEqual({ x: 2, y: 2 });
    const second = resolveTurn(first, "S");
    expect(second.shades[0].position).toEqual({ x: 2, y: 2 });
    expect(second.shades[1].position).toEqual({ x: 2, y: 1 });
    expect(second.shades[1].buried).toBe(true);
    const third = resolveTurn(second, "S");
    expect(third.shades[0].position).toEqual({ x: 2, y: 1 });
    expect(third.shades[0].buried).toBe(true);
    expect(isSolved(third)).toBe(true);
  });

  it("is deterministic: identical state and input produce identical state", () => {
    const state = manualState({
      width: 7,
      height: 7,
      sun: "S",
      shades: [
        { x: 2, y: 4 },
        { x: 4, y: 4 },
      ],
      casters: [
        { kind: "pillar", position: { x: 3, y: 6 } },
        { kind: "stone", position: { x: 5, y: 4 } },
      ],
    });
    for (const sun of ["N", "E", "S", "W"] as Direction[]) {
      const a = resolveTurn(state, sun);
      const b = resolveTurn(state, sun);
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    }
  });
});
