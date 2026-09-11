import "./style.css";

import { AudioManager } from "./audio/AudioManager";
import { Game, GameEvent } from "./game/Game";
import { Direction, GameState } from "./game/types";
import { InputManager, InputAction } from "./input/InputManager";
import {
  ALL_LEVELS,
  CAMPAIGN_COUNT,
  DEEP_LEVELS,
  FINAL_CAMPAIGN_LEVEL_ID,
  LEVELS,
  PENUMBRA_LEVELS,
  sectionOf,
} from "./levels/index";
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
  U019: "Still, they walk together.",
  U020: "Shade on shade on shade.",
  U021: "One grave is enough for a procession.",
  U022: "Not one turn to waste.",
  U023: "The shadow is longer than it looks.",
  P001: "Nothing lives at either extreme.",
  P002: "Half-light is where movement lives.",
  P003: "Two conditions. One sun.",
  P004: "Two shadows, one light.",
  P005: "You mastered shadow. Now master its boundary.",
};

const save = new SaveManager();
const audio = new AudioManager();

function musicRequest(name: "title" | "vigil" | "penumbra") {
  const volume = name === "title" ? 0.42 : name === "vigil" ? 0.28 : 0.26;
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
let endingTimer = 0;

const input = new InputManager();
input.on(handleInput);

window.addEventListener("pointerdown", () => audio.unlock(), { passive: true });
window.addEventListener("keydown", () => audio.unlock());

const ui = new UI({
  onNext: () => advance(),
  onUndo: () => doUndo(),
  onRestart: () => doRestart(),
  onMenu: () => ui.showLevelSelect(ALL_LEVELS, CAMPAIGN_COUNT, save.data),
  onTitle: () => showTitleScreen(),
  onResume: () => {
    if (renderer.isTitle) showTitleScreen();
    else ui.hideOverlay();
  },
  onSelectLevel: (index) => startLevel(index),
  onResetProgress: () => {
    save.reset();
    ui.showLevelSelect(ALL_LEVELS, CAMPAIGN_COUNT, save.data);
  },
  onPostgame: () => showPostgame(),
  onSetCamera: (id: CameraPresetId) => setCameraView(id),
});

function campaignIndexOf(globalIndex: number): number {
  return globalIndex;
}

function labelFor(globalIndex: number): string {
  const definition = ALL_LEVELS[globalIndex];
  const section = sectionOf(definition);
  if (section === "deep") {
    return `U${String(DEEP_LEVELS.indexOf(definition) + 1).padStart(2, "0")}`;
  }
  if (section === "penumbra") {
    return `P${String(PENUMBRA_LEVELS.indexOf(definition) + 1).padStart(2, "0")}`;
  }
  return String(campaignIndexOf(globalIndex) + 1).padStart(2, "0");
}

function startLevel(index: number, options: { announce?: boolean } = {}): void {
  const announce = options.announce ?? true;
  const clamped = Math.max(0, Math.min(index, ALL_LEVELS.length - 1));
  currentIndex = clamped;
  const definition = ALL_LEVELS[clamped];
  const section = sectionOf(definition);

  window.clearTimeout(endingTimer);
  audio.setDucked(false);

  game = new Game(definition);
  game.on(handleGameEvent);

  audio.unlock();
  renderer.loadLevel(game.state);
  ui.setLevel(labelFor(clamped), game.state, definition);
  ui.setLegend(game.state.shades.map((entity) => entity.kind));
  ui.setUndoEnabled(false);
  ui.hideOverlay();
  input.setEnabled(true);
  audio.playMusic(musicRequest(section === "penumbra" ? "penumbra" : "vigil"), 2);

  const showHint = definition.id === "001" && !save.data.hasMovedSun;
  ui.setHint(showHint);

  if (announce) {
    audio.levelStart();
    const line = INTRO_LINES[definition.id];
    if (line) ui.toast(line, 3200);
  }
}

/** Move to the next level, handling the end of the core campaign. */
function advance(): void {
  const definition = ALL_LEVELS[currentIndex];
  const section = sectionOf(definition);
  if (section === "campaign" && definition.id === FINAL_CAMPAIGN_LEVEL_ID) {
    showCampaignComplete();
    return;
  }
  const next = currentIndex + 1;
  if (next >= ALL_LEVELS.length || sectionOf(ALL_LEVELS[next]) !== section) {
    showPostgame();
    return;
  }
  startLevel(next);
}

/** Where a level sits inside its own section, for the solved panel. */
function sectionPosition(globalIndex: number): { index: number; total: number } {
  const definition = ALL_LEVELS[globalIndex];
  const section = sectionOf(definition);
  if (section === "deep") return { index: DEEP_LEVELS.indexOf(definition), total: DEEP_LEVELS.length };
  if (section === "penumbra") {
    return { index: PENUMBRA_LEVELS.indexOf(definition), total: PENUMBRA_LEVELS.length };
  }
  return { index: campaignIndexOf(globalIndex), total: CAMPAIGN_COUNT };
}

function resumeIndex(): number {
  // Resume the first unsolved campaign level, or the first postgame level.
  const solved = new Set(save.data.completed);
  for (let i = 0; i < CAMPAIGN_COUNT; i++) {
    if (!solved.has(LEVELS[i].id)) return i;
  }
  return Math.min(CAMPAIGN_COUNT, ALL_LEVELS.length - 1);
}

function showTitleScreen(): void {
  audio.unlock();
  audio.setDucked(false);
  renderer.showTitle();
  ui.setHint(false);
  audio.playMusic(musicRequest("title"));
  ui.showTitle({
    hasProgress: save.data.highestLevel > 0,
    postgameUnlocked: save.data.postgameUnlocked,
    muted: audio.muted,
    camera: save.data.camera,
    handlers: {
      onContinue: () => startLevel(resumeIndex()),
      onBegin: () => startLevel(0),
      onChapters: () => ui.showLevelSelect(ALL_LEVELS, CAMPAIGN_COUNT, save.data),
      onPostgame: () => showPostgame(),
      onToggleMute: () => toggleMute(),
      onSetCamera: (id) => setCameraView(id),
    },
  });
}

function showPostgame(): void {
  ui.showPostgame({
    deepSolved: save.sectionSolved("deep"),
    deepTotal: DEEP_LEVELS.length,
    penumbraSolved: save.sectionSolved("penumbra"),
    penumbraTotal: PENUMBRA_LEVELS.length,
    handlers: {
      onDeepUmbra: () => startSection("deep"),
      onPenumbra: () => enterPenumbra(),
      onReturn: () => showTitleScreen(),
    },
  });
}

/** Start the first unsolved level of a postgame section. */
function startSection(section: "deep" | "penumbra"): void {
  const levels = section === "deep" ? DEEP_LEVELS : PENUMBRA_LEVELS;
  const base = ALL_LEVELS.indexOf(levels[0]);
  const firstUnsolved = levels.findIndex((level) => !save.isSectionCompleted(section, level.id));
  startLevel(base + (firstUnsolved === -1 ? 0 : firstUnsolved));
}

/**
 * The campaign ending, then the postgame choice. The HUD fades, the room goes
 * quiet, the camera holds, and the shadow edge softens before the choice.
 */
function showCampaignComplete(): void {
  input.setEnabled(false);
  audio.setDucked(true);
  document.body.classList.add("ending-mode");

  endingTimer = window.setTimeout(() => {
    renderer.revealPenumbra();
  }, 900);

  endingTimer = window.setTimeout(() => {
    ui.showCampaignComplete({
      onDeepUmbra: () => {
        document.body.classList.remove("ending-mode");
        save.markPostgameChoiceSeen();
        startSection("deep");
      },
      onPenumbra: () => {
        document.body.classList.remove("ending-mode");
        save.markPostgameChoiceSeen();
        enterPenumbra();
      },
      onReturn: () => {
        document.body.classList.remove("ending-mode");
        showTitleScreen();
      },
    });
  }, 2600);
}

/** The half-light reveal, then P001. */
function enterPenumbra(): void {
  audio.setDucked(false);
  audio.playMusic(musicRequest("penumbra"), 1.2);
  const go = () => {
    const base = ALL_LEVELS.indexOf(PENUMBRA_LEVELS[0]);
    const firstUnsolved = PENUMBRA_LEVELS.findIndex(
      (level) => !save.isSectionCompleted("penumbra", level.id),
    );
    startLevel(base + (firstUnsolved === -1 ? 0 : firstUnsolved));
  };
  if (!save.data.seenPostgameChoice) {
    renderer.revealPenumbra();
    ui.showPenumbraIntro(go);
  } else {
    go();
  }
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
  const section = sectionOf(ALL_LEVELS[currentIndex]);
  audio.playMusic(musicRequest(section === "penumbra" ? "penumbra" : "vigil"), 1.2);
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
  const definition = ALL_LEVELS[currentIndex];
  const section = sectionOf(definition);
  if (section === "campaign") {
    save.markCompleted(definition.id, state.turn, campaignIndexOf(currentIndex));
  } else {
    save.markSectionCompleted(section, definition.id, state.turn);
  }
  audio.solve();

  if (section === "campaign" && definition.id === FINAL_CAMPAIGN_LEVEL_ID) {
    showCampaignComplete();
    return;
  }

  input.setEnabled(false);
  const position = sectionPosition(currentIndex);
  window.setTimeout(() => ui.showSolved(state, position.index, position.total), 450);
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
    advance,
    showEnding: () => showCampaignComplete(),
    levelById: (id: string) => ALL_LEVELS.findIndex((level) => level.id === id),
    showPostgame,
    enterPenumbra,
    renderer,
    levels: ALL_LEVELS,
    campaignCount: CAMPAIGN_COUNT,
    save,
    audio,
    ui,
  };
}

void bootstrap();
