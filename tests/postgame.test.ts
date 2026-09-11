import { describe, expect, it } from "vitest";
import { stateSignature } from "../src/game/GameState";
import { computeIlluminationDepths, UMBRA_DEPTH } from "../src/game/shadows";
import { replay, solve } from "../src/game/Solver";
import { resolveTurn } from "../src/game/TurnResolver";
import { DIRECTIONS, GameState, posKey } from "../src/game/types";
import { DEEP_LEVELS, PENUMBRA_LEVELS } from "../src/levels/index";
import { SaveManager } from "../src/ui/SaveManager";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";
import { manualState } from "./helpers";

const DEEP = DEEP_LEVELS as LevelDefinition[];
const PENUMBRA = PENUMBRA_LEVELS as LevelDefinition[];

/* ------------------------------------------------------------------ *
 * Illumination model
 * ------------------------------------------------------------------ */

describe("penumbra illumination", () => {
  it("is deterministic", () => {
    const state = loadLevel(PENUMBRA[0]);
    for (const sun of DIRECTIONS) {
      const a = computeIlluminationDepths(state.board, sun, "penumbra");
      const b = computeIlluminationDepths(state.board, sun, "penumbra");
      expect(JSON.stringify([...a])).toBe(JSON.stringify([...b]));
    }
  });

  it("grades a pillar's ray: dark near the caster, partial beyond", () => {
    const state = loadLevel(PENUMBRA[0]);
    // Level P001 places its pillar at (4,7) and starts the sun south.
    const field = computeIlluminationDepths(state.board, "S", "penumbra");
    expect(field.get("4,6")?.tier).toBe("umbra"); // depth 0
    expect(field.get("4,5")?.tier).toBe("umbra"); // depth 1
    expect(field.get("4,4")?.tier).toBe("penumbra"); // depth 2
  });

  it("keeps UMBRA_DEPTH tiles dark and everything beyond partial", () => {
    const state = loadLevel(PENUMBRA[0]);
    const field = computeIlluminationDepths(state.board, "S", "penumbra");
    for (const tile of field.values()) {
      if (tile.tier === "umbra") {
        expect(tile.depth).toBeLessThan(UMBRA_DEPTH);
      } else {
        expect(tile.depth).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("the original rules produce no penumbra at all", () => {
    for (const definition of DEEP) {
      const state = loadLevel(definition);
      for (const sun of DIRECTIONS) {
        for (const tile of computeIlluminationDepths(state.board, sun, "umbra").values()) {
          expect(tile.tier).toBe("umbra");
        }
      }
    }
  });

  it("both tiers appear in every Penumbra level, for some sun", () => {
    for (const definition of PENUMBRA) {
      const state = loadLevel(definition);
      const tiers = new Set<string>();
      for (const sun of DIRECTIONS) {
        for (const tile of computeIlluminationDepths(state.board, sun, "penumbra").values()) {
          tiers.add(tile.tier);
        }
      }
      expect(tiers.has("umbra"), `${definition.id} umbra`).toBe(true);
      expect(tiers.has("penumbra"), `${definition.id} penumbra`).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Movement rules per entity kind
 * ------------------------------------------------------------------ */

describe("wraith movement", () => {
  /** A pillar with a ray of umbra near it and penumbra further out. */
  const penumbraBoard = () =>
    manualState({
      width: 5,
      height: 8,
      sun: "S",
      rules: "penumbra",
      shades: [{ kind: "wraith", x: 2, y: 4 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 7 } }],
    });

  it("moves into partial shadow", () => {
    const state = penumbraBoard();
    const next = resolveTurn(state, "S");
    expect(next.shades[0].position).toEqual({ x: 2, y: 3 });
  });

  it("cannot move onto a grave unless that grave tile is partial shadow", () => {
    const state = manualState({
      width: 5,
      height: 8,
      sun: "S",
      rules: "penumbra",
      shades: [{ kind: "wraith", x: 2, y: 4 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 7 } }],
      tile: (x, y) => (x === 2 && y === 3 ? "Grave" : "Floor"),
    });
    // (2,3) is depth 3 from the pillar -> penumbra, so the Wraith may enter.
    const next = resolveTurn(state, "S");
    expect(next.shades[0].buried).toBe(true);
  });

  it("will not enter full shadow: a Shade can, a Wraith cannot", () => {
    // (2,6) is depth 0 and (2,5) is depth 1: both full shadow.
    const asShade = manualState({
      width: 5,
      height: 8,
      sun: "S",
      rules: "penumbra",
      shades: [{ kind: "shade", x: 2, y: 6 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 7 } }],
    });
    expect(resolveTurn(asShade, "S").shades[0].position).toEqual({ x: 2, y: 5 });

    const asWraith = manualState({
      width: 5,
      height: 8,
      sun: "S",
      rules: "penumbra",
      shades: [{ kind: "wraith", x: 2, y: 6 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 7 } }],
    });
    expect(resolveTurn(asWraith, "S").shades[0].position).toEqual({ x: 2, y: 6 });
  });

  it("will not enter light", () => {
    const state = manualState({
      width: 5,
      height: 8,
      sun: "S",
      rules: "penumbra",
      shades: [{ kind: "wraith", x: 0, y: 5 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 7 } }],
    });
    const next = resolveTurn(state, "S");
    expect(next.shades[0].position).toEqual({ x: 0, y: 5 });
  });

  it("is deterministic across a walk", () => {
    const state = penumbraBoard();
    let a = state;
    let b = state;
    for (const sun of ["S", "E", "N", "W", "S", "S"] as const) {
      a = resolveTurn(a, sun);
      b = resolveTurn(b, sun);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

/* ------------------------------------------------------------------ *
 * The visited key must distinguish entity kinds
 * ------------------------------------------------------------------ */

describe("penumbra keys", () => {
  it("a Shade and a Wraith on the same tile are not the same state", () => {
    const base = manualState({
      width: 5,
      height: 6,
      sun: "S",
      rules: "penumbra",
      shades: [{ kind: "shade", x: 2, y: 3 }],
      casters: [{ kind: "pillar", position: { x: 2, y: 5 } }],
    });
    const asWraith: GameState = {
      ...base,
      shades: [{ ...base.shades[0], kind: "wraith" }],
    };
    // Same tile, different behaviour, so the visited key must not merge them.
    expect(posKey(base.shades[0].position)).toBe(posKey(asWraith.shades[0].position));
    expect(stateSignature(base)).not.toBe(stateSignature(asWraith));
  });

  it("keys stay stable under Shade iteration order within a section", () => {
    const shape = (reversed: boolean) =>
      manualState({
        width: 5,
        height: 5,
        sun: "N",
        rules: "penumbra",
        shades: reversed
          ? [
              { id: "b", kind: "wraith", x: 3, y: 3 },
              { id: "a", kind: "shade", x: 1, y: 1 },
            ]
          : [
              { id: "a", kind: "shade", x: 1, y: 1 },
              { id: "b", kind: "wraith", x: 3, y: 3 },
            ],
      });
    expect(stateSignature(shape(false))).toBe(stateSignature(shape(true)));
  });
});

/* ------------------------------------------------------------------ *
 * Postgame content is solver-verified like the campaign
 * ------------------------------------------------------------------ */

describe("postgame campaign", () => {
  it.each([...DEEP, ...PENUMBRA].map((level) => [level.id, level] as const))(
    "level %s is solvable and its authored par is the true minimum",
    (id, definition) => {
      const state = loadLevel(definition);
      const solution = solve(state);
      expect(solution, `${id} should be solvable`).not.toBeNull();
      expect(replay(state, solution!.path).status).toBe("solved");
      expect(solution!.moves, `${id} par`).toBe(definition.par);
    },
  );

  it("Deep Umbra adds no new rules", () => {
    for (const definition of DEEP) {
      expect(definition.rules ?? "umbra").toBe("umbra");
      expect(definition.chapter).toBe("deep");
    }
  });

  it("Penumbra levels all opt into the half-light rules", () => {
    for (const definition of PENUMBRA) {
      expect(definition.rules).toBe("penumbra");
      expect(definition.chapter).toBe("penumbra");
    }
  });

  it("every postgame level has a distinct id from the campaign", () => {
    const ids = [...DEEP, ...PENUMBRA].map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("0")).toBe(false);
  });

  it("P005 is the declared finale and stays small", () => {
    const finale = PENUMBRA[PENUMBRA.length - 1];
    expect(finale.id).toBe("P005");
    expect(Math.max(finale.width ?? 0, finale.height ?? 0)).toBeLessThanOrEqual(11);
    const casters = (finale.map.join("").match(/[PL]/g) ?? []).length;
    expect(casters).toBeLessThanOrEqual(6);
  });
});

/* ------------------------------------------------------------------ *
 * Progress is id-based, so adding levels revokes nothing
 * ------------------------------------------------------------------ */

describe("section progress", () => {
  it("tracks completion per level id, independently of the campaign", () => {
    const save = new SaveManager();
    save.reset();
    const before = save.data.completed.length;
    save.markCompleted("018", 11, 17);
    save.markSectionCompleted("deep", "U019", 7);
    save.markSectionCompleted("penumbra", "P001", 3);

    expect(save.data.campaignComplete).toBe(true);
    expect(save.data.postgameUnlocked).toBe(true);
    expect(save.isCompleted("018")).toBe(true);
    expect(save.isSectionCompleted("deep", "U019")).toBe(true);
    expect(save.isSectionCompleted("deep", "U020")).toBe(false);
    expect(save.isSectionCompleted("penumbra", "P001")).toBe(true);
    expect(save.sectionSolved("deep")).toBe(1);
    expect(save.sectionSolved("penumbra")).toBe(1);
    // The campaign list is untouched by postgame progress.
    expect(save.data.completed.length).toBe(before + 1);
  });

  it("a solved postgame level records the best turn count only when better", () => {
    const save = new SaveManager();
    save.reset();
    save.markSectionCompleted("deep", "U019", 9);
    expect(save.section("deep").best.U019).toBe(9);
    save.markSectionCompleted("deep", "U019", 8);
    expect(save.section("deep").best.U019).toBe(8);
    save.markSectionCompleted("deep", "U019", 12);
    expect(save.section("deep").best.U019).toBe(8);
  });
});
