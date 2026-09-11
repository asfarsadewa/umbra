import { describe, expect, it } from "vitest";
import { cloneState } from "../src/game/clone";
import { stateSignature } from "../src/game/GameState";
import { replay, solve, stateKey } from "../src/game/Solver";
import { resolveTurn } from "../src/game/TurnResolver";
import { Direction } from "../src/game/types";
import { UndoManager } from "../src/game/UndoManager";
import { loadLevel } from "../src/world/LevelLoader";
import { manualState } from "./helpers";

const DIRECTIONS: Direction[] = ["N", "E", "S", "W"];

describe("determinism", () => {
  it("same state + same input = identical state, across a long walk", () => {
    const definition = {
      id: "det",
      name: "det",
      startingSun: "S" as const,
      width: 7,
      height: 7,
      map: [
        "#######",
        "#.....#",
        "#.P...#",
        "#.....#",
        "#.S.P.#",
        "#....G#",
        "#######",
      ],
    };
    const start = loadLevel(definition);
    let a = start;
    let b = start;
    const sequence: Direction[] = ["S", "W", "N", "W", "E", "S", "N", "E", "W"];
    for (const sun of sequence) {
      a = resolveTurn(a, sun);
      b = resolveTurn(b, sun);
    }
    expect(stateSignature(a)).toBe(stateSignature(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("state signature is independent of shade iteration order", () => {
    const one = manualState({
      width: 5,
      height: 5,
      sun: "N",
      shades: [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 3, y: 3 },
      ],
    });
    const two = manualState({
      width: 5,
      height: 5,
      sun: "N",
      shades: [
        { id: "b", x: 3, y: 3 },
        { id: "a", x: 1, y: 1 },
      ],
    });
    expect(stateSignature(one)).toBe(stateSignature(two));
    expect(stateKey(one)).toBe(stateKey(two));
  });

  it("state signature includes daylight", () => {
    const withDay = manualState({
      width: 5,
      height: 5,
      shades: [{ x: 1, y: 1 }],
      daylight: 5,
    });
    const without = manualState({
      width: 5,
      height: 5,
      shades: [{ x: 1, y: 1 }],
      daylight: null,
    });
    expect(stateSignature(withDay)).not.toBe(stateSignature(without));
    expect(stateSignature(withDay)).not.toBe(
      stateSignature({ ...cloneState(withDay), daylight: 4 }),
    );
  });

  it("replaying a solution reproduces the solved state exactly", () => {
    const definition = {
      id: "rep",
      name: "rep",
      startingSun: "S" as const,
      width: 7,
      height: 7,
      map: [
        "#######",
        "#.....#",
        "#..G..#",
        "#.....#",
        "#..S..#",
        "#..P..#",
        "#######",
      ],
    };
    const start = loadLevel(definition);
    const solution = solve(start);
    expect(solution).not.toBeNull();
    const first = replay(start, solution!.path);
    const second = replay(start, solution!.path);
    expect(first.status).toBe("solved");
    expect(stateSignature(first)).toBe(stateSignature(second));
  });

  it("resolveTurn never mutates its input", () => {
    const state = manualState({
      width: 5,
      height: 5,
      sun: "S",
      shades: [{ x: 1, y: 3 }],
      casters: [{ kind: "pillar", position: { x: 1, y: 4 } }],
    });
    const before = JSON.stringify(state);
    for (const sun of DIRECTIONS) resolveTurn(state, sun);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("undo", () => {
  it("restores sun, positions and daylight", () => {
    const undo = new UndoManager();
    const state = manualState({
      width: 5,
      height: 6,
      sun: "S",
      daylight: 4,
      shades: [{ x: 1, y: 3 }],
      casters: [{ kind: "pillar", position: { x: 1, y: 5 } }],
      tile: (x, y) => (x === 1 && y === 1 ? "Grave" : "Floor"),
    });
    undo.push(state);
    const next = resolveTurn(state, "S");
    expect(stateSignature(next)).not.toBe(stateSignature(state));
    const restored = undo.pop();
    expect(restored).toBeDefined();
    expect(stateSignature(restored!)).toBe(stateSignature(state));
    expect(restored!.daylight).toBe(4);
  });
});
