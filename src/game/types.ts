/**
 * Core simulation types.
 *
 * Everything under src/game and src/world is plain, deterministic TypeScript.
 * It must never import Three.js. Rendering and animation are presentation only
 * and never drive simulation state.
 */

/** The four cardinal directions. The sun occupies exactly one of them. */
export type Direction = "N" | "E" | "S" | "W";

export interface Position {
  x: number;
  y: number;
}

/** Game Y grows downward, like map rows. */
export const SUN_VECTORS: Record<Direction, Position> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

/**
 * A Shade moves one tile *away* from the sun. That is the same direction in
 * which an object casts its shadow.
 */
export const SUN_MOVE_VECTORS: Record<Direction, Position> = {
  N: { x: 0, y: 1 },
  S: { x: 0, y: -1 },
  E: { x: -1, y: 0 },
  W: { x: 1, y: 0 },
};

export const DIRECTIONS: Direction[] = ["N", "E", "S", "W"];

export const OPPOSITE: Record<Direction, Direction> = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
};

export type TileType = "Floor" | "Wall" | "Void" | "Grave";

export type CasterKind = "pillar" | "stone";

/** A static object that casts a logical shadow. */
export interface Caster {
  kind: CasterKind;
  position: Position;
}

export interface ShadeState {
  id: string;
  position: Position;
  /** True once the Shade has entered a grave. Kept so undo can restore it. */
  buried: boolean;
  /** Stable index, used only for cosmetic variation. */
  colorIndex: number;
}

export type GameStatus = "playing" | "solved" | "sunset";

export interface GameState {
  levelId: string;
  levelName: string;
  chapter: string;
  par?: number;
  width: number;
  height: number;
  board: import("../world/Board").Board;
  sun: Direction;
  shades: ShadeState[];
  /** Remaining turns of daylight; null means unlimited. */
  daylight: number | null;
  turn: number;
  status: GameStatus;
}

export interface MoveIntent {
  entityId: string;
  from: Position;
  to: Position;
}

export function posKey(p: Position): string {
  return `${p.x},${p.y}`;
}

export function posEquals(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
