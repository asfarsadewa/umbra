import { cloneState } from "./clone";
import { collectIntents, resolveCollisions } from "./CollisionResolver";
import { getShadeIntent } from "./Movement";
import { computeShadows } from "./shadows";
import { Direction, GameState } from "./types";

/**
 * Resolve one complete turn. The input state is never mutated.
 *
 *   1. the sun changes immediately
 *   2. logical shadows are recalculated
 *   3. every Shade determines its intended move
 *   4. movement conflicts are resolved
 *   5. valid moves occur simultaneously
 *   6. grave entries are resolved
 *   7. daylight is spent and the turn counter advances
 *   8. the outcome is evaluated
 */
export function resolveTurn(state: GameState, sun: Direction): GameState {
  const next = cloneState(state);
  next.sun = sun;

  const shadows = computeShadows(next.board, sun);

  const intents = collectIntents(next, (shade) =>
    getShadeIntent(next.board, sun, shadows, shade),
  );
  const moves = resolveCollisions(next, intents);

  for (const shade of next.shades) {
    const destination = moves.get(shade.id);
    if (destination) shade.position = { ...destination };
  }

  // Grave entries remove the Shade immediately.
  for (const shade of next.shades) {
    if (shade.buried) continue;
    if (next.board.tileAt(shade.position.x, shade.position.y) === "Grave") {
      shade.buried = true;
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

/** Every Shade has entered a grave. */
export function isSolved(state: GameState): boolean {
  return state.shades.length > 0 && state.shades.every((shade) => shade.buried);
}

/** Daylight ran out before every Shade was buried. */
export function isSunset(state: GameState): boolean {
  return state.status === "sunset";
}

export function isFinished(state: GameState): boolean {
  return state.status !== "playing";
}

export function buriedCount(state: GameState): number {
  return state.shades.filter((shade) => shade.buried).length;
}
