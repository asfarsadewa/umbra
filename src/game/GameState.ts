import { GameState, posKey } from "./types";

/**
 * Compact, deterministic signature of a state. Used by the solver's visited
 * set and by determinism tests.
 *
 * =========================================================================
 *  ⚠  THE KEY MUST CONTAIN EVERYTHING THE NEXT TURN CAN DEPEND ON.  ⚠
 * =========================================================================
 *
 * UMBRA has one stateful mechanic beyond Shade position: remaining daylight
 * (used by sunset levels). It is included here. The static board never changes
 * mid-level, so it does not need to appear in the key.
 *
 * BEFORE ADDING ANY NEW STATEFUL MECHANIC, EXTEND THIS KEY WITH ITS STATE, or
 * BFS will silently merge states that merely look equivalent — reporting a
 * level impossible or a bogus minimum instead of crashing.
 */
export function stateSignature(state: GameState): string {
  // The kind is part of the identity: a Shade and a Wraith at the same tile
  // are not interchangeable, they need different illumination to move.
  const shades = state.shades
    .map(
      (entity) =>
        `${entity.kind[0]}:${
          entity.buried ? "X" : `${entity.position.x},${entity.position.y}`
        }`,
    )
    .sort()
    .join(";");
  const buried = state.shades.filter((shade) => shade.buried).length;
  return [state.sun, shades, buried, state.daylight ?? "-"].join("|");
}

/** Moves spent so far. */
export function moveCount(state: GameState): number {
  return state.turn;
}

/** Sorted Shade positions, used for stable cosmetic and test comparisons. */
export function sortedShadeKeys(state: GameState): string[] {
  return state.shades.map((shade) => posKey(shade.position)).sort();
}
