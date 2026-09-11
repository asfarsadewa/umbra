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

/**
 * Which illumination model a level uses.
 *
 *  "umbra"    — the original rule: a tile is either lit or fully shadowed.
 *  "penumbra" — three tiers: light / penumbra / umbra (postgame).
 */
export type Rules = "umbra" | "penumbra";

/** The three illumination states of the Penumbra model. */
export type Illumination = "light" | "penumbra" | "umbra";

/**
 * A Shade moves only into full shadow; a Wraith moves only into partial
 * shadow. Both always move one tile away from the sun.
 */
export type EntityKind = "shade" | "wraith";

const ILLUMINATION_RANK: Record<Illumination, number> = {
  light: 0,
  penumbra: 1,
  umbra: 2,
};

export function strongestIllumination(a: Illumination, b: Illumination): Illumination {
  return ILLUMINATION_RANK[a] >= ILLUMINATION_RANK[b] ? a : b;
}

/** The illumination an entity needs on its destination tile. */
export function requiredIllumination(kind: EntityKind): Illumination {
  return kind === "wraith" ? "penumbra" : "umbra";
}

export type CasterKind = "pillar" | "stone";

/** A static object that casts a logical shadow. */
export interface Caster {
  kind: CasterKind;
  position: Position;
}

export interface ShadeState {
  id: string;
  kind: EntityKind;
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
  /** Illumination model for this level. */
  rules: Rules;
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
