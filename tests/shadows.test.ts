import { describe, expect, it } from "vitest";
import { computeShadows, isShadowed, shadowTiles } from "../src/game/shadows";
import { Direction, posKey } from "../src/game/types";
import { Board } from "../src/world/Board";
import { manualState } from "./helpers";

function boardWith(
  casters: Array<{ kind: "pillar" | "stone"; x: number; y: number }>,
  width = 7,
  height = 7,
): Board {
  return manualState({
    width,
    height,
    casters: casters.map((c) => ({ kind: c.kind, position: { x: c.x, y: c.y } })),
    shades: [{ x: 0, y: 0 }],
  }).board;
}

describe("shadows", () => {
  it("a tall pillar casts a continuous shadow to the board edge", () => {
    const board = boardWith([{ kind: "pillar", x: 3, y: 3 }]);
    // Sun north => shadow travels south, to the last row.
    const shadow = computeShadows(board, "N");
    expect(shadow.has(posKey({ x: 3, y: 4 }))).toBe(true);
    expect(shadow.has(posKey({ x: 3, y: 5 }))).toBe(true);
    expect(shadow.has(posKey({ x: 3, y: 6 }))).toBe(true);
    // ...and not sideways.
    expect(shadow.has(posKey({ x: 4, y: 4 }))).toBe(false);
    // ...and not behind the pillar.
    expect(shadow.has(posKey({ x: 3, y: 2 }))).toBe(false);
  });

  it("a tall pillar shadow follows the sun in all four directions", () => {
    const board = boardWith([{ kind: "pillar", x: 3, y: 3 }]);
    const cases: Array<[Direction, { x: number; y: number }]> = [
      ["N", { x: 3, y: 5 }],
      ["S", { x: 3, y: 1 }],
      ["E", { x: 1, y: 3 }],
      ["W", { x: 5, y: 3 }],
    ];
    for (const [sun, tile] of cases) {
      expect(isShadowed(board, sun, tile.x, tile.y)).toBe(true);
    }
  });

  it("a low stone casts exactly one tile of shadow", () => {
    const board = boardWith([{ kind: "stone", x: 2, y: 2 }]);
    const shadow = computeShadows(board, "W");
    expect(shadow.has(posKey({ x: 3, y: 2 }))).toBe(true);
    expect(shadow.has(posKey({ x: 4, y: 2 }))).toBe(false);
  });

  it("does not mark the caster's own tile as shadow", () => {
    const board = boardWith([{ kind: "pillar", x: 3, y: 3 }]);
    expect(computeShadows(board, "N").has(posKey({ x: 3, y: 3 }))).toBe(false);
  });

  it("overlapping shadows collapse to a boolean set", () => {
    const board = boardWith([
      { kind: "pillar", x: 3, y: 1 },
      { kind: "pillar", x: 3, y: 5 },
    ]);
    const shadow = computeShadows(board, "N");
    expect(shadow.has(posKey({ x: 3, y: 3 }))).toBe(true);
    expect(shadowTiles(board, "N").length).toBe(new Set(shadowTiles(board, "N")).size);
  });

  it("a pillar at the edge casts no shadow off-board", () => {
    const board = boardWith([{ kind: "pillar", x: 0, y: 0 }]);
    // Sun south => shadow north (off-board); sun east => shadow west (off-board).
    expect(computeShadows(board, "S").size).toBe(0);
    expect(computeShadows(board, "E").size).toBe(0);
    // Sun north => shadow south, sun west => shadow east: on-board.
    expect(computeShadows(board, "N").size).toBeGreaterThan(0);
  });
});
