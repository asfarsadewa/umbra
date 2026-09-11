import { Direction, GameState } from "../game/types";
import { CameraPresetId, DEFAULT_CAMERA } from "../rendering/cameraPresets";
import { LevelDefinition } from "../world/Level";
import {
  PanelHandlers,
  renderPausePanel,
  renderSolvedPanel,
  renderSunsetPanel,
} from "./LevelComplete";
import { renderLevelSelect } from "./LevelSelect";
import { SaveData } from "./SaveManager";
import { renderTitleScreen, TitleOptions } from "./TitleScreen";

export interface UIHandlers extends PanelHandlers {
  onSelectLevel: (index: number) => void;
  onResetProgress: () => void;
}

const SUN_GLYPH: Record<Direction, string> = { N: "↑", E: "→", S: "↓", W: "←" };

/**
 * Thin DOM layer: HUD, toasts and overlay panels. The game logic never touches
 * the DOM directly.
 */
export class UI {
  private overlay: HTMLElement;
  private panelHost: HTMLElement;
  private levelNumber: HTMLElement;
  private levelName: HTMLElement;
  private sunIndicator: HTMLElement;
  private daylightNode: HTMLElement;
  private turnCount: HTMLElement;
  private parCount: HTMLElement;
  private hint: HTMLElement;
  private toastNode: HTMLElement;
  private undoButton: HTMLButtonElement | null;
  private muteButton: HTMLButtonElement | null;
  private toastTimer = 0;
  private escapeAction: (() => void) | null = null;
  private openedAt = 0;
  private activeCamera: CameraPresetId = DEFAULT_CAMERA;
  private daylightTotal: number | null = null;

  constructor(
    private handlers: UIHandlers,
    private onVisibilityChange?: (visible: boolean) => void,
  ) {
    this.overlay = this.require("overlay");
    this.panelHost = this.require("overlay-panel");
    this.levelNumber = this.require("level-number");
    this.levelName = this.require("level-name");
    this.sunIndicator = this.require("sun-indicator");
    this.daylightNode = this.require("daylight");
    this.turnCount = this.require("turn-count");
    this.parCount = this.require("par-count");
    this.hint = this.require("hint");
    this.toastNode = this.require("toast");
    this.undoButton = document.getElementById("undo-button") as HTMLButtonElement | null;
    this.muteButton = document.getElementById("mute-button") as HTMLButtonElement | null;

    window.addEventListener("keydown", (event) => this.onKey(event));
  }

  private require(id: string): HTMLElement {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing UI element #${id}`);
    return node;
  }

  get overlayVisible(): boolean {
    return !this.overlay.classList.contains("hidden");
  }

  setLevel(index: number, state: GameState, definition?: LevelDefinition): void {
    this.levelNumber.textContent = String(index + 1).padStart(2, "0");
    this.levelName.textContent = state.levelName;
    this.daylightTotal = definition?.daylight ?? state.daylight ?? null;
    this.setStateHud(state);
  }

  setStateHud(state: GameState): void {
    this.turnCount.textContent = String(state.turn);
    this.parCount.textContent = state.par ? `/ ${state.par}` : "";
    this.sunIndicator.textContent = `☀ ${state.sun} ${SUN_GLYPH[state.sun]}`;
    this.setDaylight(state);
  }

  private setDaylight(state: GameState): void {
    if (state.daylight === null) {
      this.daylightNode.textContent = "—";
      this.daylightNode.classList.remove("daylight-dots");
      return;
    }
    const total = this.daylightTotal ?? state.daylight;
    const remaining = Math.max(0, state.daylight);
    const parts: string[] = [];
    for (let i = 0; i < total; i++) {
      parts.push(i < remaining ? "●" : "○");
    }
    this.daylightNode.textContent = parts.join(" ");
    this.daylightNode.classList.add("daylight-dots");
    this.daylightNode.classList.toggle("low", remaining <= 3);
  }

  setHint(visible: boolean): void {
    this.hint.classList.toggle("visible", visible);
  }

  setUndoEnabled(enabled: boolean): void {
    if (this.undoButton) this.undoButton.disabled = !enabled;
  }

  setMuted(muted: boolean): void {
    if (this.muteButton) {
      this.muteButton.textContent = muted ? "Muted" : "Sound";
      this.muteButton.classList.toggle("active", !muted);
    }
  }

  setTitleMuted(muted: boolean): void {
    const node = this.panelHost.querySelector(".title-sound");
    if (node) node.textContent = muted ? "Sound: off" : "Sound: on";
  }

  setActiveCamera(id: CameraPresetId): void {
    this.activeCamera = id;
    this.panelHost.querySelectorAll<HTMLElement>(".camera-option").forEach((node) => {
      node.classList.toggle("active", node.dataset.camera === id);
    });
  }

  toast(message: string, duration = 2200): void {
    this.toastNode.textContent = message;
    this.toastNode.classList.add("visible");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastNode.classList.remove("visible");
    }, duration);
  }

  showSolved(state: GameState, index: number, total: number): void {
    const isLast = index >= total - 1;
    this.show(renderSolvedPanel(state, isLast, this.handlers), this.handlers.onMenu);
  }

  showSunset(state: GameState): void {
    this.show(renderSunsetPanel(state, this.handlers), this.handlers.onMenu);
  }

  showPause(): void {
    this.show(renderPausePanel(this.handlers, this.activeCamera), this.handlers.onResume);
  }

  showLevelSelect(levels: LevelDefinition[], save: SaveData): void {
    this.show(
      renderLevelSelect(levels, save, {
        onSelect: this.handlers.onSelectLevel,
        onClose: this.handlers.onResume,
        onReset: this.handlers.onResetProgress,
      }),
      this.handlers.onResume,
    );
  }

  showTitle(options: TitleOptions): void {
    this.activeCamera = options.camera;
    this.escapeAction = null;
    this.overlay.classList.add("title-mode");
    document.body.classList.add("title-mode");
    this.panelHost.replaceChildren(renderTitleScreen(options));
    this.overlay.classList.remove("hidden");
    this.openedAt = performance.now();
    this.onVisibilityChange?.(true);
    this.fadeInOverlay();
    window.requestAnimationFrame(() => this.focusFirst());
  }

  hideOverlay(): void {
    this.escapeAction = null;
    this.overlay.style.opacity = "";
    this.overlay.classList.add("hidden");
    this.overlay.classList.remove("title-mode");
    document.body.classList.remove("title-mode");
    this.onVisibilityChange?.(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  private show(content: HTMLElement, escapeAction: () => void): void {
    this.escapeAction = escapeAction;
    this.overlay.classList.remove("title-mode");
    document.body.classList.remove("title-mode");
    this.panelHost.replaceChildren(content);
    this.overlay.classList.remove("hidden");
    this.openedAt = performance.now();
    this.onVisibilityChange?.(true);
    this.fadeInOverlay();
    window.requestAnimationFrame(() => this.focusFirst());
  }

  private fadeInOverlay(): void {
    this.overlay.style.opacity = "0";
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        this.overlay.style.opacity = "1";
      });
    });
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.overlayVisible) return;
    // Ignore the very keydown that opened this overlay.
    if (performance.now() - this.openedAt < 60) return;
    if (
      event.defaultPrevented ||
      (event as KeyboardEvent & { __umbraInput?: boolean }).__umbraInput
    ) {
      return;
    }
    switch (event.key) {
      case "Escape":
        if (this.escapeAction) {
          event.preventDefault();
          this.escapeAction();
        }
        return;
      case "ArrowRight":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        this.moveFocus(event.key);
        return;
      default:
        return;
    }
  }

  private focusableItems(): HTMLElement[] {
    const selector = 'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panelHost.querySelectorAll<HTMLElement>(selector)).filter(
      (node) =>
        node.offsetWidth > 0 || node.offsetHeight > 0 || node === document.activeElement,
    );
  }

  private moveFocus(key: string): void {
    const items = this.focusableItems();
    if (items.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    let index = current ? items.indexOf(current) : -1;

    let columns = 1;
    if (items.length > 1) {
      const firstTop = items[0].offsetTop;
      const firstRow = items.filter((node) => node.offsetTop === firstTop).length;
      if (firstRow > 1 && firstRow < items.length) columns = firstRow;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[
      key
    ];
    if (step === undefined) return;
    if (index === -1) index = step > 0 ? -1 : 0;
    const target = items[(index + step + items.length * 2) % items.length];
    target?.focus();
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  private focusFirst(): void {
    const primary = this.panelHost.querySelector<HTMLElement>(".primary:not(:disabled)");
    const fallback = this.panelHost.querySelector<HTMLElement>(
      ".level-card:not(:disabled), button:not(:disabled), [href]",
    );
    (primary ?? fallback)?.focus();
  }
}
