import { TileType } from "../game/types";

/** Level map legend. Keep the gameplay vocabulary intentionally small. */
export const TILE_CHARS: Record<string, TileType> = {
  "#": "Wall",
  ".": "Floor",
  " ": "Floor",
  "~": "Void",
  G: "Grave",
};

/** Characters that spawn a shadow-casting object on a floor tile. */
export const PILLAR_CHAR = "P";
export const STONE_CHAR = "L";
export const SHADE_CHAR = "S";
export const WRAITH_CHAR = "W";

/** Terrain that stops a Shade: walls and void. Graves are enterable. */
export function blocksShade(tile: TileType): boolean {
  return tile === "Wall" || tile === "Void";
}

export function tileFromChar(char: string): TileType {
  const tile = TILE_CHARS[char];
  if (tile === undefined) {
    throw new Error(`Unknown tile character: "${char}"`);
  }
  return tile;
}
