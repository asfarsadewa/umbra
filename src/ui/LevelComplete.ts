import { GameState } from "../game/types";
import { CameraPresetId } from "../rendering/cameraPresets";
import { renderCameraControl } from "./CameraControl";

export interface PanelHandlers {
  onNext: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onTitle: () => void;
  onResume: () => void;
  onSetCamera: (id: CameraPresetId) => void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = element("button", className, label);
  node.addEventListener("click", onClick);
  return node;
}

export function renderSolvedPanel(
  state: GameState,
  isLast: boolean,
  handlers: PanelHandlers,
): HTMLElement {
  const panel = element("div", "panel-content panel-solved");
  panel.append(element("p", "panel-kicker", isLast ? "THE SUN SETS" : "BURIED"));
  panel.append(element("h2", "panel-title", isLast ? "Umbra" : state.levelName));
  panel.append(
    element(
      "p",
      "panel-stats",
      `TURNS ${state.turn}${state.par ? ` / PAR ${state.par}` : ""}`,
    ),
  );

  if (state.par && state.turn <= state.par) {
    panel.append(element("p", "panel-flourish", "Not a step was wasted."));
  } else {
    panel.append(
      element("p", "panel-quote", "The dead remember the shade."),
    );
  }

  const actions = element("div", "panel-actions");
  if (isLast) {
    panel.append(
      element(
        "p",
        "panel-flourish",
        "Every shade is buried before the light is gone.",
      ),
    );
    actions.append(button("Chapters", "primary", handlers.onMenu));
    actions.append(button("Retry", "ghost", handlers.onRestart));
    actions.append(button("Title", "ghost", handlers.onTitle));
  } else {
    actions.append(button("Next", "primary", handlers.onNext));
    actions.append(button("Retry", "ghost", handlers.onRestart));
    actions.append(button("Chapters", "ghost", handlers.onMenu));
  }
  panel.append(actions);
  return panel;
}

export function renderSunsetPanel(state: GameState, handlers: PanelHandlers): HTMLElement {
  const panel = element("div", "panel-content panel-sunset");
  panel.append(element("p", "panel-kicker", "SUNSET"));
  panel.append(element("h2", "panel-title", "The light ran out"));
  panel.append(
    element(
      "p",
      "panel-stats",
      `${state.shades.filter((s) => !s.buried).length} stayed above ground`,
    ),
  );
  panel.append(
    element("p", "panel-quote", "Undo the last choice, or begin the day again."),
  );
  const actions = element("div", "panel-actions");
  actions.append(button("Undo", "primary", handlers.onUndo));
  actions.append(button("Restart", "ghost", handlers.onRestart));
  actions.append(button("Chapters", "ghost", handlers.onMenu));
  panel.append(actions);
  return panel;
}

export function renderPausePanel(
  handlers: PanelHandlers,
  camera: CameraPresetId,
): HTMLElement {
  const panel = element("div", "panel-content panel-pause");
  panel.append(element("p", "panel-kicker", "HELD"));
  panel.append(
    element("p", "panel-quote", "You don't move the dead. You move the sun."),
  );
  panel.append(renderCameraControl(camera, handlers.onSetCamera, "panel"));
  const actions = element("div", "panel-actions");
  actions.append(button("Resume", "primary", handlers.onResume));
  actions.append(button("Restart", "ghost", handlers.onRestart));
  actions.append(button("Chapters", "ghost", handlers.onMenu));
  actions.append(button("Title", "ghost", handlers.onTitle));
  panel.append(actions);
  return panel;
}
