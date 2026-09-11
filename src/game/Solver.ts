import { cloneState } from "./clone";
import { stateSignature } from "./GameState";
import { isSolved, resolveTurn } from "./TurnResolver";
import { Direction, DIRECTIONS, GameState } from "./types";

export interface Solution {
  moves: number;
  path: Direction[];
}

export interface SolveOptions {
  maxDepth?: number;
  forbidden?: Set<string>;
  /**
   * Visited-set key. Defaults to the production `stateSignature`. Tests pass an
   * over-complete key to prove the production one never merges states that
   * behave differently (which would silently corrupt the reported minimum).
   */
  key?: (state: GameState) => string;
}

/** Replay a sun-direction sequence from a fresh clone. */
export function replay(start: GameState, path: Direction[]): GameState {
  let state = cloneState(start);
  for (const sun of path) {
    if (state.status !== "playing") break;
    state = resolveTurn(state, sun);
  }
  return state;
}

/** Alias kept for callers that prefer the shorter name. */
export function stateKey(state: GameState): string {
  return stateSignature(state);
}

/**
 * Breadth-first solver.
 *
 * The branching factor is exactly 4 (the sun has four positions) and the
 * simulation is pure and deterministic, so BFS returns the true minimum number
 * of turns. Used by `npm run solve` and by the test suite.
 */
export function solve(
  start: GameState,
  options: SolveOptions = {},
): Solution | null {
  let maxDepth = options.maxDepth ?? 60;
  if (start.daylight !== null) maxDepth = Math.min(maxDepth, start.daylight);
  const forbidden = options.forbidden ?? new Set<string>();
  const keyOf = options.key ?? stateSignature;

  if (isSolved(start)) return { moves: 0, path: [] };

  const startKey = keyOf(start);
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, { prev: string; sun: Direction } | null>();
  parent.set(startKey, null);

  let frontier: GameState[] = [start];

  for (let depth = 0; depth < maxDepth; depth++) {
    const next: GameState[] = [];
    for (const current of frontier) {
      for (const sun of DIRECTIONS) {
        const result = resolveTurn(current, sun);
        if (result.status === "sunset") continue;
        const key = keyOf(result);
        if (visited.has(key) || forbidden.has(key)) continue;
        visited.add(key);
        parent.set(key, { prev: keyOf(current), sun });
        if (isSolved(result)) {
          return { moves: depth + 1, path: rebuild(parent, key) };
        }
        next.push(result);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}

function rebuild(
  parent: Map<string, { prev: string; sun: Direction } | null>,
  key: string,
): Direction[] {
  const path: Direction[] = [];
  let cursor: string | null = key;
  while (cursor) {
    const entry = parent.get(cursor);
    if (!entry) break;
    path.unshift(entry.sun);
    cursor = entry.prev;
  }
  return path;
}
