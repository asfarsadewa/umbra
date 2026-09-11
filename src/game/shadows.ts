import { Board } from "../world/Board";
import { Caster, Direction, posKey, SUN_MOVE_VECTORS } from "./types";

/**
 * The logical shadow model. This is the single source of truth for what counts
 * as shadow during play; the renderer draws exactly these tiles.
 *
 *   pillar (P)  casts shadow continuously from itself to the board edge,
 *               in the direction opposite the sun.
 *   stone  (L)  casts exactly one tile of shadow.
 *
 * Walls do not stop a gameplay shadow (SPEC §6). Shadow state is boolean; there
 * is no intensity.
 */
export function computeShadows(board: Board, sun: Direction): Set<string> {
  const direction = SUN_MOVE_VECTORS[sun];
  const shadowed = new Set<string>();
  for (const caster of board.casters) {
    const maxLength = caster.kind === "pillar" ? Infinity : 1;
    let x = caster.position.x + direction.x;
    let y = caster.position.y + direction.y;
    let length = 0;
    while (length < maxLength && board.inBounds(x, y)) {
      shadowed.add(posKey({ x, y }));
      x += direction.x;
      y += direction.y;
      length++;
    }
  }
  return shadowed;
}

/** True when the given tile is shadowed for the given sun. */
export function isShadowed(
  board: Board,
  sun: Direction,
  x: number,
  y: number,
): boolean {
  for (const caster of board.casters) {
    if (!casterReaches(board, caster, sun, x, y)) continue;
    return true;
  }
  return false;
}

function casterReaches(
  board: Board,
  caster: Caster,
  sun: Direction,
  x: number,
  y: number,
): boolean {
  const direction = SUN_MOVE_VECTORS[sun];
  const maxLength = caster.kind === "pillar" ? Infinity : 1;
  let cx = caster.position.x + direction.x;
  let cy = caster.position.y + direction.y;
  let length = 0;
  while (length < maxLength && board.inBounds(cx, cy)) {
    if (cx === x && cy === y) return true;
    cx += direction.x;
    cy += direction.y;
    length++;
  }
  return false;
}

/** Ordered list of shadowed tiles, for stable iteration in tests/renderers. */
export function shadowTiles(board: Board, sun: Direction): string[] {
  return [...computeShadows(board, sun)].sort();
}

/**
 * Shadowed tiles mapped to their distance from the nearest caster along the
 * shadow ray. Used only to stagger the cosmetic sweep of the shadow overlay.
 */
export function computeShadowDepths(
  board: Board,
  sun: Direction,
): Map<string, number> {
  const direction = SUN_MOVE_VECTORS[sun];
  const depths = new Map<string, number>();
  for (const caster of board.casters) {
    const maxLength = caster.kind === "pillar" ? Infinity : 1;
    let x = caster.position.x + direction.x;
    let y = caster.position.y + direction.y;
    let depth = 0;
    while (depth < maxLength && board.inBounds(x, y)) {
      const key = posKey({ x, y });
      const previous = depths.get(key);
      if (previous === undefined || depth < previous) depths.set(key, depth);
      x += direction.x;
      y += direction.y;
      depth++;
    }
  }
  return depths;
}
