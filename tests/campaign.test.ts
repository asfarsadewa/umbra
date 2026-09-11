import { describe, expect, it } from "vitest";
import { replay, solve } from "../src/game/Solver";
import { LEVELS } from "../src/levels/index";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";

const CAMPAIGN = LEVELS as LevelDefinition[];

describe("campaign", () => {
  it("has the authored campaign of 18 levels with unique ids", () => {
    expect(CAMPAIGN.length).toBe(18);
    const ids = new Set(CAMPAIGN.map((level) => level.id));
    expect(ids.size).toBe(18);
  });

  it.each(CAMPAIGN.map((level) => [level.id, level] as const))(
    "level %s is solvable and its authored par is the true minimum",
    (id, definition) => {
      const state = loadLevel(definition);
      const solution = solve(state);
      expect(solution, `${id} should be solvable`).not.toBeNull();
      const final = replay(state, solution!.path);
      expect(final.status, `${id} replay should solve`).toBe("solved");
      if (definition.par !== undefined) {
        expect(solution!.moves, `${id} par`).toBe(definition.par);
      }
    },
  );

  it("a solution never exceeds its daylight budget", () => {
    for (const definition of CAMPAIGN) {
      if (definition.daylight === undefined) continue;
      const state = loadLevel(definition);
      const solution = solve(state);
      expect(solution, `${definition.id} solvable`).not.toBeNull();
      expect(
        solution!.moves,
        `${definition.id} must fit in ${definition.daylight} daylight`,
      ).toBeLessThanOrEqual(definition.daylight);
    }
  });
});
