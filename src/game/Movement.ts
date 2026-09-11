import { Board } from "../world/Board";
import { Direction, Position, ShadeState, SUN_MOVE_VECTORS, posKey } from "./types";

/**
 * The deterministic intent of a single Shade.
 *
 * A Shade attempts to move exactly one orthogonal tile away from the sun. It
 * may move only if the destination is in bounds, traversable, free of blocking
 * objects, and currently in shadow. Otherwise it waits.
 */
export function getShadeIntent(
  board: Board,
  sun: Direction,
  shadows: ReadonlySet<string>,
  shade: ShadeState,
): Position | null {
  if (shade.buried) return null;
  const vector = SUN_MOVE_VECTORS[sun];
  const destination: Position = {
    x: shade.position.x + vector.x,
    y: shade.position.y + vector.y,
  };
  if (!board.canShadeEnter(destination.x, destination.y)) return null;
  if (!shadows.has(posKey(destination))) return null;
  return destination;
}

export function movementVector(sun: Direction): Position {
  return SUN_MOVE_VECTORS[sun];
}
