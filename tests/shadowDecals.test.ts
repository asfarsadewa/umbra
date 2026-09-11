import { describe, expect, it } from "vitest";
import { computeShadowDepths, computeShadows } from "../src/game/shadows";
import { DIRECTIONS } from "../src/game/types";
import { LEVELS } from "../src/levels/index";
import { shadowDecals, shadowFeather } from "../src/rendering/shadowDecals";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";

const CAMPAIGN = LEVELS as LevelDefinition[];

/**
 * The cardinal rule: what looks shadowed equals what the simulation considers
 * shadowed. In particular, a Shade must never be able to enter a tile *because
 * it is shadowed* while that tile is drawn unshadowed.
 */
describe("logical shadow visibility", () => {
  it("draws a decal on every enterable shadowed tile, in every level and sun", () => {
    for (const definition of CAMPAIGN) {
      const state = loadLevel(definition);
      for (const sun of DIRECTIONS) {
        const shadows = computeShadows(state.board, sun);
        const decals = new Set(
          shadowDecals(state.board, sun).map((decal) => `${decal.x},${decal.y}`),
        );
        for (const key of shadows) {
          const [x, y] = key.split(",").map(Number);
          if (!state.board.canShadeEnter(x, y)) continue;
          expect(
            decals.has(key),
            `${definition.id} sun ${sun}: shadow on enterable ${key} must be visible`,
          ).toBe(true);
        }
      }
    }
  });

  it("never draws a logical shadow on a tall pillar (impassable)", () => {
    for (const definition of CAMPAIGN) {
      const state = loadLevel(definition);
      for (const sun of DIRECTIONS) {
        for (const decal of shadowDecals(state.board, sun)) {
          expect(
            state.board.isPillar(decal.x, decal.y),
            `${definition.id}: pillar decal at ${decal.x},${decal.y}`,
          ).toBe(false);
        }
      }
    }
  });

  it("includes the enterable low stones that motivated the rule (The Lattice)", () => {
    const state = loadLevel(CAMPAIGN[13]);
    const stoneDecals = shadowDecals(state.board, "S").filter((decal) => decal.stone);
    expect(stoneDecals.length).toBeGreaterThan(0);
    // The pillar's north ray crosses the stone row at (2,4).
    expect(stoneDecals.some((decal) => decal.x === 2 && decal.y === 4)).toBe(true);
  });

  it("keeps the caster-facing edge crisp so the shadow stays welded on", () => {
    const state = loadLevel(CAMPAIGN[13]);
    const depths = computeShadowDepths(state.board, "S");
    // (2,6) is the first tile of the pillar's north ray from (2,7). Its +z
    // neighbour is the pillar itself (not shadowed), so that edge must not
    // feather, or the shadow would visually detach from the pillar.
    const feather = shadowFeather(depths, 2, 6, "S");
    // slots: [ -x, +x, -z, +z ]; the caster side for sun S is +z.
    expect(feather[3]).toBe(0);
  });
});
