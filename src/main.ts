import "./style.css";

import { AudioManager } from "./audio/AudioManager";
import { Game, GameEvent } from "./game/Game";
import { Direction, GameState } from "./game/types";
import { InputManager, InputAction } from "./input/InputManager";
import { LEVELS } from "./levels/index";
import { Renderer } from "./rendering/Renderer";
import type { CameraPresetId } from "./rendering/cameraPresets";
import { SaveManager } from "./ui/SaveManager";
import { UI } from "./ui/UI";

/** A single poetic line per level, shown once as a quiet toast. */
const INTRO_LINES: Record<string, string> = {
  "001": "The dead remember the shade.",
  "002": "Turn the light, and the way turns with it.",
  "005": "A courtyard has more than one morning.",
  "009": "One sun. Two who walk.",
  "010": "A procession is a single decision, repeated.",
  "013": "Some shadows are only one step long.",
  "014": "The stones remember where to walk.",
  "016": "The day is not endless.",
  "018": "You don't move the dead. You move the sun.",
};

const save = new SaveManager();
const audio = new AudioManager();

function musicRequest(name: "title" | "vigil") {
  const volume = name === "title" ? 0.42 : 0.28;
  return {
    name,
    url: `${import.meta.env.BASE_URL}audio/${name}.mp3`,
    volume,
  };
}

const sceneContainer = document.getElementById("scene");
if (!sceneContainer) throw new Error("Missing #scene container");
const renderer = new Renderer(sceneContainer);
renderer.start();

let game: Game;
let currentIndex = 0;

const input = new InputManager();
input.on(handleInput);

window.addEventListener("pointerdown", () => audio.unlock(), { passive: true });
window.addEventListener("keydown", () => audio.unlock());

const ui = new UI(
  {
    onNext: () => startLevel(currentIndex + 1),
    onUndo: () => doUndo(),
    onRestart: () => doRestart(),
    onMenu: () => ui.showLevelSelect(LEVELS, save.data),
    onTitle: () => showTitleScreen(),
    onResume: () => {
      if (renderer.isTitle) showTitleScreen();
      else ui.hideOverlay();
    },
    onSelectLevel: (index) => startLevel(index),
    onResetProgress: () => {
      save.reset();
      ui.showLevelSelect(LEVELS, save.data);
    },
    onSetCamera: (id) => setCameraView(id),
  },
  (visible) => input.setUiActive(visible),
);

function startLevel(index: number, options: { announce?: boolean } = {}): void {
  const announce = options.announce ?? true;
  const clamped = Math.max(0, Math.min(index, LEVELS.length - 1));
  currentIndex = clamped;
  const definition = LEVELS[clamped];

  game = new Game(definition);
  game.on(handleGameEvent);

  audio.unlock();
  renderer.loadLevel(game.state);
  ui.setLevel(clamped, game.state, definition);
  ui.setUndoEnabled(false);
  ui.hideOverlay();
  input.setEnabled(true);
  audio.playMusic(musicRequest("vigil"), 2);

  const showHint = definition.id === "001" && !save.data.hasMovedSun;
  ui.setHint(showHint);

  if (announce) {
    audio.levelStart();
    const line = INTRO_LINES[definition.id];
    if (line) ui.toast(line, 3200);
  }
}

function resumeIndex(): number {
  return Math.min(save.data.highestLevel, LEVELS.length - 1);
}

function showTitleScreen(): void {
  audio.unlock();
  renderer.showTitle();
  ui.setHint(false);
  audio.playMusic(musicRequest("title"));
  ui.showTitle({
    hasProgress: save.data.highestLevel > 0,
    muted: audio.muted,
    camera: save.data.camera,
    handlers: {
      onContinue: () => startLevel(resumeIndex()),
      onBegin: () => startLevel(0),
      onChapters: () => ui.showLevelSelect(LEVELS, save.data),
      onToggleMute: () => toggleMute(),
      onSetCamera: (id) => setCameraView(id),
    },
  });
}

function setCameraView(id: CameraPresetId): void {
  save.setCamera(id);
  renderer.setCamera(id);
  ui.setActiveCamera(id);
}

function toggleMute(): void {
  audio.unlock();
  const muted = !audio.muted;
  audio.setMuted(muted);
  save.setMuted(muted);
  ui.setMuted(muted);
  ui.setTitleMuted(muted);
}

function handleInput(action: InputAction): void {
  audio.unlock();

  if (action.type === "toggle-mute") {
    toggleMute();
    return;
  }

  if (ui.overlayVisible) return;

  switch (action.type) {
    case "sun":
      doSun(action.direction);
      break;
    case "undo":
      doUndo();
      break;
    case "restart":
      doRestart();
      break;
    case "menu":
      ui.showPause();
      break;
  }
}

function doSun(direction: Direction): void {
  if (game.mode !== "waiting") return;
  if (!save.data.hasMovedSun) {
    save.markMovedSun();
    ui.setHint(false);
  }
  game.chooseSun(direction);
}

function doUndo(): void {
  if (game.mode === "animating") return;
  if (game.undoMove()) {
    ui.hideOverlay();
    audio.undo();
  }
}

function doRestart(): void {
  game.restart();
  ui.hideOverlay();
  input.setEnabled(true);
  audio.playMusic(musicRequest("vigil"), 1.2);
}

function handleGameEvent(event: GameEvent): void {
  switch (event.type) {
    case "turn":
      onTurn(event.previous, event.next);
      break;
    case "undo":
      onUndo(event.next);
      break;
    case "restart":
    case "load":
      renderer.applyInstant(event.next);
      ui.setStateHud(event.next);
      ui.setUndoEnabled(game.canUndo);
      input.setEnabled(true);
      break;
  }
}

function onTurn(previous: GameState, next: GameState): void {
  input.setEnabled(false);
  audio.sunSweep();

  renderer.animateTurn(previous, next).then(() => {
    game.finishAnimation();
    ui.setStateHud(next);
    ui.setUndoEnabled(game.canUndo);

    const moved = next.shades.some((shade) => {
      const before = previous.shades.find((s) => s.id === shade.id);
      return (
        before &&
        (before.position.x !== shade.position.x ||
          before.position.y !== shade.position.y)
      );
    });
    if (moved) audio.shadeMove();

    const buriedNow = next.shades.some((shade) => {
      const before = previous.shades.find((s) => s.id === shade.id);
      return shade.buried && before && !before.buried;
    });
    if (buriedNow && next.status !== "sunset") audio.burial();

    if (next.status === "solved") {
      handleSolved(next);
    } else if (next.status === "sunset") {
      handleSunset(next);
    } else {
      input.setEnabled(!ui.overlayVisible);
    }
  });
}

function onUndo(next: GameState): void {
  renderer.applyInstant(next);
  ui.setStateHud(next);
  ui.setUndoEnabled(game.canUndo);
  input.setEnabled(!ui.overlayVisible);
}

function handleSolved(state: GameState): void {
  save.markCompleted(LEVELS[currentIndex].id, state.turn, currentIndex);
  audio.solve();
  input.setEnabled(false);
  window.setTimeout(() => ui.showSolved(state, currentIndex, LEVELS.length), 450);
}

function handleSunset(state: GameState): void {
  audio.sunset();
  renderer.sunsetFlash();
  input.setEnabled(false);
  window.setTimeout(() => ui.showSunset(state), 700);
}

ui.setMuted(save.data.muted);
audio.setMuted(save.data.muted);

async function bootstrap(): Promise<void> {
  const loading = document.getElementById("loading");
  try {
    await renderer.preload();
  } catch (error) {
    console.error("Preload failed:", error);
  }
  loading?.classList.add("hidden");

  renderer.setCamera(save.data.camera);
  ui.setActiveCamera(save.data.camera);

  // Prepare the resume level behind the scenes, then open on the sealed
  // gateway. Its single gesture is what lets the browser start audio.
  startLevel(resumeIndex(), { announce: false });
  ui.setHint(false);
  renderer.showGate();
  audio.playMusic(musicRequest("title"));
  ui.showGate({
    onUnlock: () => audio.unlock(),
    onReveal: () => showTitleScreen(),
  });

  (window as unknown as { umbra?: unknown }).umbra = {
    game: () => game,
    startLevel,
    renderer,
    levels: LEVELS,
    save,
    audio,
    ui,
  };
}

void bootstrap();
