import { Direction } from "../game/types";

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
  map: string[];
}
