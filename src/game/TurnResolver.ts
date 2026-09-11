import { cloneState } from "./clone";
import { collectIntents, resolveCollisions } from "./CollisionResolver";
import { getEntityIntent } from "./Movement";
import { computeIlluminationDepths } from "./shadows";
import { Direction, GameState, Illumination, requiredIllumination } from "./types";

/**
 * Resolve one complete turn. The input state is never mutated.
 *
 *   1. the sun changes immediately
 *   2. illumination is recalculated from the board, the sun and the level rules
 *   3. every entity determines its intended move (Shades need umbra, Wraiths
 *      need penumbra)
 *   4. movement conflicts are resolved
 *   5. valid moves occur simultaneously
 *   6. grave entries are resolved
 *   7. daylight is spent and the turn counter advances
 *   8. the outcome is evaluated
 */
export function resolveTurn(state: GameState, sun: Direction): GameState {
  const next = cloneState(state);
  next.sun = sun;

  const field = computeIlluminationDepths(next.board, sun, next.rules);
  const byTier: Record<Illumination, Set<string>> = {
    light: new Set(),
    penumbra: new Set(),
    umbra: new Set(),
  };
  for (const [key, tile] of field) byTier[tile.tier].add(key);

  const intents = collectIntents(next, (entity) =>
    getEntityIntent(next.board, sun, byTier[requiredIllumination(entity.kind)], entity),
  );
  const moves = resolveCollisions(next, intents);

  for (const entity of next.shades) {
    const destination = moves.get(entity.id);
    if (destination) entity.position = { ...destination };
  }

  // Grave entries remove the entity immediately.
  for (const entity of next.shades) {
    if (entity.buried) continue;
    if (next.board.tileAt(entity.position.x, entity.position.y) === "Grave") {
      entity.buried = true;
    }
  }

  if (next.daylight !== null) next.daylight -= 1;
  next.turn += 1;

  if (isSolved(next)) {
    next.status = "solved";
  } else if (next.daylight !== null && next.daylight <= 0) {
    next.status = "sunset";
  } else {
    next.status = "playing";
  }

  return next;
}

/** Every entity has entered a grave. */
export function isSolved(state: GameState): boolean {
  return state.shades.length > 0 && state.shades.every((entity) => entity.buried);
}

/** Daylight ran out before every entity was buried. */
export function isSunset(state: GameState): boolean {
  return state.status === "sunset";
}

export function isFinished(state: GameState): boolean {
  return state.status !== "playing";
}

export function buriedCount(state: GameState): number {
  return state.shades.filter((entity) => entity.buried).length;
}
