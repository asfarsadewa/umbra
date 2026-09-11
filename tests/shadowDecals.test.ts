import { describe, expect, it } from "vitest";
import { computeIlluminationDepths } from "../src/game/shadows";
import { DIRECTIONS, Illumination, Rules } from "../src/game/types";
import { ALL_LEVELS, LEVELS } from "../src/levels/index";
import { selectShadowDecals, shadowFeather } from "../src/rendering/shadowDecals";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";

const ALL = ALL_LEVELS as LevelDefinition[];
const CAMPAIGN = LEVELS as LevelDefinition[];

const RULES: Rules[] = ["umbra", "penumbra"];

/**
 * The cardinal rule: what looks illuminated equals what the simulation considers
 * illuminated. An entity must never be able to enter a tile *because of its
 * illumination* while that tile is drawn as something else.
 */
describe("illumination visibility", () => {
  it("draws every enterable tile at its own tier, for every level and sun", () => {
    for (const definition of ALL) {
      const state = loadLevel(definition);
      for (const sun of DIRECTIONS) {
        for (const rules of RULES) {
          const field = computeIlluminationDepths(state.board, sun, rules);
          const decals = new Map(
            selectShadowDecals(state.board, field).map((decal) => [
              `${decal.x},${decal.y}`,
              decal.tier,
            ]),
          );
          for (const [key, tile] of field) {
            const [x, y] = key.split(",").map(Number);
            if (!state.board.canShadeEnter(x, y)) continue;
            expect(
              decals.get(key),
              `${definition.id} ${rules} sun ${sun}: enterable ${key} is ${tile.tier} but drawn ${
                decals.get(key) ?? "not at all"
              }`,
            ).toBe(tile.tier);
          }
        }
      }
    }
  });

  it("never draws on a tall pillar (impassable)", () => {
    for (const definition of ALL) {
      const state = loadLevel(definition);
      for (const sun of DIRECTIONS) {
        const field = computeIlluminationDepths(state.board, sun, "penumbra");
        for (const decal of selectShadowDecals(state.board, field)) {
          expect(state.board.isPillar(decal.x, decal.y)).toBe(false);
        }
      }
    }
  });

  it("both tiers actually occur across the campaign and postgame", () => {
    const seen = new Set<Illumination>();
    for (const definition of ALL) {
      const state = loadLevel(definition);
      for (const sun of DIRECTIONS) {
        const field = computeIlluminationDepths(state.board, sun, "penumbra");
        for (const tile of field.values()) seen.add(tile.tier);
      }
    }
    expect(seen.has("umbra")).toBe(true);
    expect(seen.has("penumbra")).toBe(true);
  });

  it("includes the enterable low stones that motivated the rule (The Lattice)", () => {
    const state = loadLevel(CAMPAIGN[13]);
    const field = computeIlluminationDepths(state.board, "S", "umbra");
    const stoneDecals = selectShadowDecals(state.board, field).filter((d) => d.stone);
    expect(stoneDecals.length).toBeGreaterThan(0);
    expect(stoneDecals.some((d) => d.x === 2 && d.y === 4)).toBe(true);
  });

  it("keeps the caster-facing edge crisp so the shadow stays welded on", () => {
    const state = loadLevel(CAMPAIGN[13]);
    const field = computeIlluminationDepths(state.board, "S", "umbra");
    // (2,6) is the first tile of the pillar's north ray from (2,7); its +z
    // neighbour is the pillar itself, so that edge must not feather.
    const feather = shadowFeather(field, 2, 6, "S");
    expect(feather[3]).toBe(0);
  });
});
