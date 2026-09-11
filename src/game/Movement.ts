import { Board } from "../world/Board";
import { Direction, Position, ShadeState, SUN_MOVE_VECTORS, posKey } from "./types";

/**
 * The deterministic intent of a single entity.
 *
 * An entity attempts to move exactly one orthogonal tile away from the sun. It
 * may move only if the destination is in bounds, traversable, free of blocking
 * objects, and carries the illumination it requires:
 *
 *   Shade   -> UMBRA      (full shadow)
 *   Wraith  -> PENUMBRA   (partial shadow only)
 *
 * `allowed` is the set of tiles at exactly that entity's tier, so the rule is
 * expressed once and shared by both kinds. Otherwise the entity waits.
 */
export function getEntityIntent(
  board: Board,
  sun: Direction,
  allowed: ReadonlySet<string>,
  entity: ShadeState,
): Position | null {
  if (entity.buried) return null;
  const vector = SUN_MOVE_VECTORS[sun];
  const destination: Position = {
    x: entity.position.x + vector.x,
    y: entity.position.y + vector.y,
  };
  if (!board.canShadeEnter(destination.x, destination.y)) return null;
  if (!allowed.has(posKey(destination))) return null;
  return destination;
}

/** Convenience wrapper for the original rules, where a Shade needs shadow. */
export function getShadeIntent(
  board: Board,
  sun: Direction,
  shadows: ReadonlySet<string>,
  shade: ShadeState,
): Position | null {
  return getEntityIntent(board, sun, shadows, shade);
}

export function movementVector(sun: Direction): Position {
  return SUN_MOVE_VECTORS[sun];
}
