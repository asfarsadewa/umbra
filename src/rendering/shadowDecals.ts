import { computeShadowDepths } from "../game/shadows";
import { Direction } from "../game/types";
import { Board } from "../world/Board";

export interface ShadowDecal {
  x: number;
  y: number;
  /** True when the decal sits on a low stone and must be drawn on its top. */
  stone: boolean;
  depth: number;
}

/**
 * Select the floor tiles the logical-shadow overlay must paint.
 *
 * The invariant this protects (SPEC §4–§6):
 *
 *   if a Shade may enter a tile *because it is shadowed*, the player must be
 *   able to see that the tile is shadowed.
 *
 * Tall pillars are skipped: they are never traversable, so a shadow on a pillar
 * tile carries no information. Low stones are **included** and flagged, because
 * low stones are traversable and another caster's ray can legitimately cover
 * them (e.g. The Lattice, where the pillar's north ray crosses the stone row).
 * The renderer raises those decals onto the stone's top surface so they are not
 * hidden under the mesh.
 */
export function selectShadowDecals(
  board: Board,
  depths: ReadonlyMap<string, number>,
): ShadowDecal[] {
  const decals: ShadowDecal[] = [];
  for (const [key, depth] of depths) {
    const [x, y] = key.split(",").map(Number);
    if (!board.inBounds(x, y)) continue;
    const caster = board.casterAt(x, y);
    if (caster) {
      // A pillar is impassable: no gameplay shadow to show.
      if (caster.kind === "pillar") continue;
    } else {
      const tile = board.tileAt(x, y);
      if (tile !== "Floor" && tile !== "Grave") continue;
    }
    decals.push({ x, y, stone: caster !== undefined, depth });
  }
  return decals;
}

export function shadowDecals(board: Board, sun: Direction): ShadowDecal[] {
  return selectShadowDecals(board, computeShadowDepths(board, sun));
}

/**
 * Which edges of a shadow decal are "open" (the shadow ends there and the edge
 * should feather). The edge that faces the caster never feathers, so the shadow
 * stays welded to the object casting it.
 */
export function shadowFeather(
  depths: ReadonlyMap<string, number>,
  x: number,
  y: number,
  sun: Direction,
): [number, number, number, number] {
  const dx = sun === "E" ? -1 : sun === "W" ? 1 : 0;
  const dy = sun === "N" ? 1 : sun === "S" ? -1 : 0;
  const neighbours: Array<[number, number, number]> = [
    [-1, 0, 0],
    [1, 0, 1],
    [0, -1, 2],
    [0, 1, 3],
  ];
  const feather: [number, number, number, number] = [0, 0, 0, 0];
  for (const [ox, oy, slot] of neighbours) {
    const nx = x + ox;
    const ny = y + oy;
    const neighbourShadowed = depths.has(`${nx},${ny}`);
    // The neighbour opposite the shadow direction is this tile's caster.
    const isSourceFace = ox === -dx && oy === -dy;
    feather[slot] = !neighbourShadowed && !isSourceFace ? 1 : 0;
  }
  return feather;
}
