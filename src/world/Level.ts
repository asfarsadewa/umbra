import { Direction, EntityKind, Rules } from "../game/types";

/**
 * JSON level definition.
 *
 *   { id, name, chapter, par, startingSun, map: string[] }
 *
 * Legend:
 *   #  wall / impassable ruin
 *   .  traversable floor
 *   ~  void
 *   G  grave
 *   S  Shade
 *   P  tall pillar
 *   L  low stone
 *   X  decorative / non-traversable feature
 */
export interface LevelEntityDefinition {
  kind?: EntityKind;
  x: number;
  y: number;
}

export interface LevelDefinition {
  id: string;
  name: string;
  chapter?: string;
  /** Authored minimum move count. The solver asserts it equals the true minimum. */
  par?: number;
  /** Optional turn limit. Omit for unlimited daylight. */
  daylight?: number;
  width?: number;
  height?: number;
  startingSun: Direction;
  /** Illumination model. Defaults to "umbra" (the original rules). */
  rules?: Rules;
  map: string[];
  /**
   * Optional explicit entities, for cases the map legend cannot express — most
   * importantly a Shade or Wraith standing ON a low stone (needed by stone-rail
   * puzzles). The map tile is still authored with "L".
   */
  entities?: LevelEntityDefinition[];
}
