import {
  Caster,
  Direction,
  GameState,
  Position,
  ShadeState,
  TileType,
} from "../game/types";
import { Board } from "./Board";
import { LevelDefinition } from "./Level";
import {
  blocksShade,
  PILLAR_CHAR,
  SHADE_CHAR,
  STONE_CHAR,
  tileFromChar,
} from "./Tile";

/**
 * Turns a JSON level definition into a fresh GameState.
 * No Three.js objects are created here.
 */
export function loadLevel(definition: LevelDefinition): GameState {
  const { map } = definition;
  const height = definition.height ?? map.length;
  const width = definition.width ?? Math.max(...map.map((row) => row.length));

  assertShape(definition, width, height);

  const tiles: TileType[][] = [];
  const casters: Caster[] = [];
  const shades: ShadeState[] = [];

  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    const source = map[y] ?? "";
    for (let x = 0; x < width; x++) {
      const char = source[x] ?? "#";
      if (char === PILLAR_CHAR) {
        row.push("Floor");
        casters.push({ kind: "pillar", position: { x, y } });
      } else if (char === STONE_CHAR) {
        row.push("Floor");
        casters.push({ kind: "stone", position: { x, y } });
      } else if (char === SHADE_CHAR) {
        row.push("Floor");
        shades.push({
          id: `s${shades.length + 1}`,
          position: { x, y },
          buried: false,
          colorIndex: shades.length,
        });
      } else if (char === "X") {
        // Decorative, non-traversable feature.
        row.push("Wall");
      } else {
        row.push(tileFromChar(char));
      }
    }
    tiles.push(row);
  }

  const board = new Board(width, height, tiles, casters);

  if (shades.length === 0) {
    throw new Error(`Level ${definition.id}: no Shades`);
  }
  if (!tiles.some((row) => row.includes("Grave"))) {
    throw new Error(`Level ${definition.id}: no grave`);
  }
  for (const caster of casters) {
    if (blocksShade(tiles[caster.position.y][caster.position.x])) {
      throw new Error(
        `Level ${definition.id}: caster on impassable tile at ${caster.position.x},${caster.position.y}`,
      );
    }
  }
  for (const shade of shades) {
    if (board.casterAt(shade.position.x, shade.position.y)) {
      throw new Error(`Level ${definition.id}: Shade inside a caster`);
    }
  }

  return {
    levelId: definition.id,
    levelName: definition.name,
    chapter: definition.chapter ?? "shadow",
    par: definition.par,
    width,
    height,
    board,
    sun: requireSun(definition),
    shades,
    daylight: definition.daylight ?? null,
    turn: 0,
    status: "playing",
  };
}

function requireSun(definition: LevelDefinition): Direction {
  const sun = definition.startingSun;
  if (sun !== "N" && sun !== "E" && sun !== "S" && sun !== "W") {
    throw new Error(`Level ${definition.id}: invalid startingSun "${sun}"`);
  }
  return sun;
}

function assertShape(
  definition: LevelDefinition,
  width: number,
  height: number,
): void {
  if (height !== definition.map.length) {
    throw new Error(
      `Level ${definition.id}: height ${height} does not match map rows ${definition.map.length}`,
    );
  }
  definition.map.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(
        `Level ${definition.id}: row ${y} has width ${row.length}, expected ${width}`,
      );
    }
  });
}

/** Convenience for tools: the initial Shade positions of a level. */
export function initialShadePositions(definition: LevelDefinition): Position[] {
  return loadLevel(definition).shades.map((s) => ({ ...s.position }));
}
