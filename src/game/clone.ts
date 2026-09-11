import { GameState, ShadeState } from "./types";

/** Deep clone a game state. States are tiny, so snapshot everything. */
export function cloneState(state: GameState): GameState {
  return {
    levelId: state.levelId,
    levelName: state.levelName,
    chapter: state.chapter,
    rules: state.rules,
    par: state.par,
    width: state.width,
    height: state.height,
    board: state.board.clone(),
    sun: state.sun,
    shades: state.shades.map(
      (shade): ShadeState => ({
        ...shade,
        position: { ...shade.position },
      }),
    ),
    daylight: state.daylight,
    turn: state.turn,
    status: state.status,
  };
}
