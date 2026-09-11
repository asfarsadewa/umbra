import { CameraPresetId } from "../rendering/cameraPresets";
import { renderCameraControl } from "./CameraControl";

export interface TitleHandlers {
  onContinue: () => void;
  onBegin: () => void;
  onChapters: () => void;
  onPostgame: () => void;
  onToggleMute: () => void;
  onSetCamera: (id: CameraPresetId) => void;
}

export interface TitleOptions {
  hasProgress: boolean;
  postgameUnlocked: boolean;
  muted: boolean;
  camera: CameraPresetId;
  handlers: TitleHandlers;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function action(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = element("button", className);
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function reveal<T extends HTMLElement>(node: T, delay: number): T {
  node.classList.add("reveal");
  node.style.animationDelay = `${delay}ms`;
  return node;
}

/**
 * The opening screen. Deliberately sparse: a wordmark, a line, a sentence and
 * one way forward, so the diorama behind it teaches the mechanic.
 */
export function renderTitleScreen(options: TitleOptions): HTMLElement {
  const screen = element("div", "title-screen");

  const top = element("div", "title-top");
  const kicker = reveal(element("p", "title-kicker"), 300);
  kicker.textContent = "A DETERMINISTIC PUZZLE OF LIGHT";
  top.append(kicker);

  const word = reveal(element("h1", "title-word"), 800);
  word.textContent = "UMBRA";
  top.append(word);

  top.append(reveal(element("div", "title-rule"), 1600));

  const tagline = reveal(element("p", "title-tagline"), 2100);
  tagline.innerHTML = "You don't move the dead.<br/>You move the sun.";
  top.append(tagline);

  const bottom = element("div", "title-bottom");
  const actions = element("div", "title-actions");

  const primary = reveal(
    action(
      options.hasProgress ? "Continue" : "Begin",
      "primary",
      options.hasProgress ? options.handlers.onContinue : options.handlers.onBegin,
    ),
    2700,
  );
  actions.append(primary);

  const links = reveal(element("div", "title-links"), 3100);
  const dot = () => {
    const node = element("span", "title-dot");
    node.textContent = "·";
    return node;
  };
  if (options.hasProgress) {
    links.append(action("Begin anew", "link", options.handlers.onBegin), dot());
  }
  links.append(action("Chapters", "link", options.handlers.onChapters), dot());
  if (options.postgameUnlocked) {
    links.append(action("Postgame", "link title-postgame", options.handlers.onPostgame), dot());
  }
  links.append(
    action(
      options.muted ? "Sound: off" : "Sound: on",
      "link title-sound",
      options.handlers.onToggleMute,
    ),
  );
  actions.append(links);
  actions.append(
    reveal(renderCameraControl(options.camera, options.handlers.onSetCamera, "title"), 3300),
  );
  bottom.append(actions);

  const hint = reveal(element("p", "title-hint"), 3500);
  hint.textContent = "↑ ↓ ← → choose the sun · Z undoes · R restarts · Esc pauses";
  bottom.append(hint);

  const credit = reveal(element("p", "title-credit"), 3900);
  const link = document.createElement("a");
  link.href = "https://x.com/ashthepeasant";
  link.target = "_blank";
  link.rel = "me noopener noreferrer";
  link.textContent = "@ashthepeasant";
  credit.append(link);
  bottom.append(credit);

  screen.append(top, bottom);
  return screen;
}
