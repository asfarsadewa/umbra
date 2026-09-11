import { Caster, TileType } from "../game/types";
import { blocksShade } from "./Tile";

/**
 * Static board geometry. Terrain and casters are immutable for the duration of
 * a level, so the board is cheap to share between cloned states.
 */
export class Board {
  private readonly casterIndex: Map<string, Caster>;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly tiles: TileType[][],
    readonly casters: Caster[],
  ) {
    this.casterIndex = new Map();
    for (const caster of casters) {
      this.casterIndex.set(`${caster.position.x},${caster.position.y}`, caster);
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  tileAt(x: number, y: number): TileType {
    if (!this.inBounds(x, y)) return "Void";
    return this.tiles[y][x];
  }

  casterAt(x: number, y: number): Caster | undefined {
    return this.casterIndex.get(`${x},${y}`);
  }

  /**
   * A tile a Shade may occupy: in bounds, walkable, and not a tall pillar.
   *
   * Low stones are deliberately traversable. Because the movement rule only
   * requires the *destination* to be in shadow, a one-tile stone shadow could
   * otherwise never be entered (the Shade would have to stand on the stone).
   * Treating a low stone as a slab a Shade can step onto makes its single
   * shadow tile a usable, precise one-step divert.
   */
  canShadeEnter(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    if (blocksShade(this.tileAt(x, y))) return false;
    const caster = this.casterAt(x, y);
    return !(caster && caster.kind === "pillar");
  }

  clone(): Board {
    return new Board(
      this.width,
      this.height,
      this.tiles.map((row) => row.slice()),
      this.casters.map((caster) => ({
        kind: caster.kind,
        position: { ...caster.position },
      })),
    );
  }

  /** True when a tall pillar occupies the tile (blocks Shade movement). */
  isPillar(x: number, y: number): boolean {
    return this.casterAt(x, y)?.kind === "pillar";
  }

  /** True when a low stone occupies the tile (traversable, casts one shadow tile). */
  isStone(x: number, y: number): boolean {
    return this.casterAt(x, y)?.kind === "stone";
  }
}
