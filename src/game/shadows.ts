import { Board } from "../world/Board";
import {
  Direction,
  Illumination,
  Rules,
  posKey,
  strongestIllumination,
  SUN_MOVE_VECTORS,
} from "./types";

export interface IlluminationTile {
  tier: Illumination;
  /**
   * Distance from the casting object along the shadow ray (0 = the tile
   * directly adjacent to the caster). Used to stagger visual sweeps and to
   * grade the penumbra.
   */
  depth: number;
}

/** Distance from a caster, in tiles, that is still fully dark. */
export const UMBRA_DEPTH = 2;

/**
 * How far the soft boundary spreads sideways from a ray, from this depth out.
 *
 * It must start at depth 0: the swaths of neighbouring sun directions then meet
 * on their diagonals, which is what lets a Wraith turn a corner instead of
 * walking a single dead-end corridor.
 */
export const PENUMBRA_FRINGE_FROM = 0;

function perpendicular(direction: { x: number; y: number }): { x: number; y: number } {
  return { x: -direction.y, y: direction.x };
}

/**
 * The illumination field. This is the single source of truth for what an entity
 * may enter, and the renderer draws exactly these tiles.
 *
 * "umbra"    — one tier: every ray tile is fully shadowed (the original rule).
 * "penumbra" — three tiers:
 *
 *                LIGHT   . . . . . . . .
 *                ray     P ▓ ▓ ░ ░ ░ ░     (k < UMBRA_DEPTH is umbra)
 *                fringe  . . ░ ░ ░ ░ ░     (from PENUMBRA_FRINGE_FROM out)
 *
 * A taller caster reaches the board edge; a low stone casts a single tile.
 * Where casters overlap, the darker tier wins.
 */
export function computeIlluminationDepths(
  board: Board,
  sun: Direction,
  rules: Rules,
): Map<string, IlluminationTile> {
  const direction = SUN_MOVE_VECTORS[sun];
  const side = perpendicular(direction);
  const field = new Map<string, IlluminationTile>();

  const paint = (x: number, y: number, tier: Illumination, depth: number) => {
    if (!board.inBounds(x, y)) return;
    const key = posKey({ x, y });
    const existing = field.get(key);
    const merged = existing
      ? strongestIllumination(existing.tier, tier)
      : tier;
    const nextDepth =
      existing && existing.tier === merged ? Math.min(existing.depth, depth) : depth;
    field.set(key, { tier: merged, depth: nextDepth });
  };

  for (const caster of board.casters) {
    const maxLength = caster.kind === "pillar" ? Infinity : 1;
    let x = caster.position.x + direction.x;
    let y = caster.position.y + direction.y;
    let depth = 0;
    while (depth < maxLength && board.inBounds(x, y)) {
      const tier: Illumination =
        rules === "penumbra" && depth >= UMBRA_DEPTH ? "penumbra" : "umbra";
      paint(x, y, tier, depth);

      if (rules === "penumbra" && depth >= PENUMBRA_FRINGE_FROM) {
        paint(x + side.x, y + side.y, "penumbra", depth);
        paint(x - side.x, y - side.y, "penumbra", depth);
      }

      x += direction.x;
      y += direction.y;
      depth++;
    }
  }

  return field;
}

/**
 * The set of fully shadowed (umbra) tiles. Under the original rules this is the
 * whole shadow; under penumbra it is only the dark core.
 */
export function computeShadows(board: Board, sun: Direction): Set<string> {
  const shadows = new Set<string>();
  for (const [key, tile] of computeIlluminationDepths(board, sun, "umbra")) {
    if (tile.tier === "umbra") shadows.add(key);
  }
  return shadows;
}

/** True when the given tile is fully shadowed for the given sun. */
export function isShadowed(
  board: Board,
  sun: Direction,
  x: number,
  y: number,
): boolean {
  const shadows = computeShadows(board, sun);
  return shadows.has(posKey({ x, y }));
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
  const depths = new Map<string, number>();
  for (const [key, tile] of computeIlluminationDepths(board, sun, "umbra")) {
    if (tile.tier !== "umbra") continue;
    const previous = depths.get(key);
    if (previous === undefined || tile.depth < previous) depths.set(key, tile.depth);
  }
  return depths;
}
