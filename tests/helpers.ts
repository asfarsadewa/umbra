import {
  Caster,
  Direction,
  GameState,
  ShadeState,
  TileType,
} from "../src/game/types";
import { Board } from "../src/world/Board";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";

export function fromMap(map: string[], startingSun: Direction = "N"): GameState {
  return loadLevel({
    id: "test",
    name: "test",
    width: map[0].length,
    height: map.length,
    startingSun,
    map,
  });
}

export function fromDefinition(definition: LevelDefinition): GameState {
  return loadLevel(definition);
}

export interface ManualOptions {
  width: number;
  height: number;
  shades: Array<Partial<ShadeState> & { x: number; y: number }>;
  sun?: Direction;
  casters?: Caster[];
  tile?: (x: number, y: number) => TileType;
  daylight?: number | null;
  rules?: "umbra" | "penumbra";
}

export function manualState(options: ManualOptions): GameState {
  const tiles: TileType[][] = [];
  for (let y = 0; y < options.height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < options.width; x++) {
      row.push(options.tile ? options.tile(x, y) : "Floor");
    }
    tiles.push(row);
  }
  const casters = options.casters ?? [];
  const board = new Board(options.width, options.height, tiles, casters);
  return {
    levelId: "manual",
    levelName: "manual",
    chapter: "shadow",
    width: options.width,
    height: options.height,
    board,
    sun: options.sun ?? "N",
    rules: options.rules ?? "umbra",
    shades: options.shades.map((shade, index) => ({
      id: shade.id ?? `s${index + 1}`,
      kind: shade.kind ?? "shade",
      position: { x: shade.x, y: shade.y },
      buried: shade.buried ?? false,
      colorIndex: index,
    })),
    daylight: options.daylight ?? null,
    turn: 0,
    status: "playing",
  };
}
