import { Board } from "../world/Board";
import { IlluminationTile } from "../game/shadows";
import { Illumination, Rules, Direction, SUN_MOVE_VECTORS } from "../game/types";

export interface ShadowDecal {
  x: number;
  y: number;
  tier: Illumination;
  /** True when the decal sits on a low stone and must be drawn on its top. */
  stone: boolean;
  depth: number;
}

/**
 * Select the tiles the illumination overlay must paint.
 *
 * The invariant this protects (SPEC §4–§6, and the Penumbra addendum §27):
 *
 *   if an entity may enter a tile *because of its illumination*, the player
 *   must be able to see that illumination.
 *
 * Tall pillars are skipped: they are never traversable, so a decal there carries
 * no information. Low stones are included (and flagged) because they are
 * traversable and another caster's field can cover them.
 */
export function selectShadowDecals(
  board: Board,
  field: ReadonlyMap<string, IlluminationTile>,
): ShadowDecal[] {
  const decals: ShadowDecal[] = [];
  for (const [key, tile] of field) {
    const [x, y] = key.split(",").map(Number);
    if (!board.inBounds(x, y)) continue;
    const caster = board.casterAt(x, y);
    if (caster) {
      if (caster.kind === "pillar") continue;
    } else {
      const ground = board.tileAt(x, y);
      if (ground !== "Floor" && ground !== "Grave") continue;
    }
    decals.push({ x, y, tier: tile.tier, stone: caster !== undefined, depth: tile.depth });
  }
  return decals;
}

/**
 * Which edges of a decal are "open" (the field ends there and the edge should
 * feather). The edge facing the caster never feathers, so the shadow stays
 * welded to the object casting it. A boundary between two illuminated tiles is
 * not an edge: the tier change is shown by the material, not by a gap.
 */
export function shadowFeather(
  field: ReadonlyMap<string, IlluminationTile>,
  x: number,
  y: number,
  sun: Direction,
): [number, number, number, number] {
  const d = SUN_MOVE_VECTORS[sun];
  const neighbours: Array<[number, number, number]> = [
    [-1, 0, 0],
    [1, 0, 1],
    [0, -1, 2],
    [0, 1, 3],
  ];
  const feather: [number, number, number, number] = [0, 0, 0, 0];
  for (const [ox, oy, slot] of neighbours) {
    const neighbourLit = field.has(`${x + ox},${y + oy}`);
    const isSourceFace = ox === -d.x && oy === -d.y;
    feather[slot] = !neighbourLit && !isSourceFace ? 1 : 0;
  }
  return feather;
}

/** Convenience for callers that only have a Board + sun. */
export function shadowDecalsFor(
  board: Board,
  field: ReadonlyMap<string, IlluminationTile>,
  _sun: Direction,
  _rules: Rules,
): ShadowDecal[] {
  return selectShadowDecals(board, field);
}
