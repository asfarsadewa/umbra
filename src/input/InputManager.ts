import { Direction } from "../game/types";

export type InputAction =
  | { type: "sun"; direction: Direction }
  | { type: "undo" }
  | { type: "restart" }
  | { type: "menu" }
  | { type: "toggle-mute" };

export type InputHandler = (action: InputAction) => void;

/**
 * Keyboard and on-screen input. Crucially, the arrow keys select the *sun*,
 * not the Shade (SPEC §10): ↑ = sun north, ↓ = sun south, ← = sun west,
 * → = sun east.
 */
export class InputManager {
  private enabled = true;
  private uiActive = false;
  private handlers: InputHandler[] = [];

  constructor() {
    window.addEventListener("keydown", this.onKey);
    this.bindButtons();
  }

  on(handler: InputHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setUiActive(active: boolean): void {
    this.uiActive = active;
  }

  private get active(): boolean {
    return this.enabled && !this.uiActive;
  }

  private emit(action: InputAction): void {
    if (!this.active) return;
    for (const handler of this.handlers) handler(action);
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.active) return;
    (event as KeyboardEvent & { __umbraInput?: boolean }).__umbraInput = true;
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      this.emit({ type: "undo" });
      return;
    }
    switch (key) {
      case "arrowup":
      case "w":
        event.preventDefault();
        this.emit({ type: "sun", direction: "N" });
        break;
      case "arrowdown":
      case "s":
        event.preventDefault();
        this.emit({ type: "sun", direction: "S" });
        break;
      case "arrowleft":
      case "a":
        event.preventDefault();
        this.emit({ type: "sun", direction: "W" });
        break;
      case "arrowright":
      case "d":
        event.preventDefault();
        this.emit({ type: "sun", direction: "E" });
        break;
      case "z":
        this.emit({ type: "undo" });
        break;
      case "r":
        this.emit({ type: "restart" });
        break;
      case "escape":
        event.preventDefault();
        this.emit({ type: "menu" });
        break;
      case "m":
        this.emit({ type: "toggle-mute" });
        break;
    }
  };

  private bindButtons(): void {
    for (const button of document.querySelectorAll<HTMLElement>("[data-sun]")) {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const direction = button.dataset.sun as Direction;
        if (direction) this.emit({ type: "sun", direction });
      });
    }
    for (const button of document.querySelectorAll<HTMLElement>("[data-action]")) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const action = button.dataset.action;
        if (action === "undo") this.emit({ type: "undo" });
        else if (action === "restart") this.emit({ type: "restart" });
        else if (action === "menu") this.emit({ type: "menu" });
        else if (action === "mute") this.emit({ type: "toggle-mute" });
      });
    }
  }
}
