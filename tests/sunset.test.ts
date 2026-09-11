import { describe, expect, it } from "vitest";
import { isSolved, resolveTurn } from "../src/game/TurnResolver";
import { loadLevel } from "../src/world/LevelLoader";
import { manualState } from "./helpers";

describe("sunset", () => {
  const base = {
    width: 5,
    height: 6,
    sun: "S" as const,
    shades: [{ x: 2, y: 4 }],
    casters: [{ kind: "pillar" as const, position: { x: 2, y: 5 } }],
    tile: (x: number, y: number) =>
      x === 2 && y === 1 ? ("Grave" as const) : ("Floor" as const),
  };

  it("spends one daylight per turn", () => {
    const state = manualState({ ...base, daylight: 5 });
    const after = resolveTurn(state, "S");
    expect(after.daylight).toBe(4);
    expect(after.status).toBe("playing");
  });

  it("fails with SUNSET when daylight runs out", () => {
    const state = manualState({ ...base, daylight: 1 });
    // One turn is not enough to reach the grave at (2,1) from (2,4).
    const after = resolveTurn(state, "S");
    expect(after.daylight).toBe(0);
    expect(after.status).toBe("sunset");
  });

  it("a solve on the final unit of daylight still wins", () => {
    // Shade one step from the grave, exactly one daylight left.
    const state = manualState({
      ...base,
      shades: [{ x: 2, y: 2 }],
      daylight: 1,
    });
    const after = resolveTurn(state, "S");
    expect(after.daylight).toBe(0);
    expect(isSolved(after)).toBe(true);
    expect(after.status).toBe("solved");
  });

  it("solver stops at the daylight budget", () => {
    const definition = {
      id: "sunset",
      name: "sunset",
      startingSun: "S" as const,
      daylight: 2,
      width: 5,
      height: 6,
      map: ["#####", "#...#", "#.G.#", "#...#", "#.S.#", "#.P.#"],
    };
    const state = loadLevel(definition);
    expect(state.daylight).toBe(2);
  });
});
