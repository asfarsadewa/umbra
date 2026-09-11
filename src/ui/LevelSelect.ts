import { LevelDefinition } from "../world/Level";
import { CHAPTERS } from "../levels/index";
import { SaveData } from "./SaveManager";

export interface LevelSelectHandlers {
  onSelect: (index: number) => void;
  onClose: () => void;
  onReset: () => void;
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

export function renderLevelSelect(
  levels: LevelDefinition[],
  save: SaveData,
  handlers: LevelSelectHandlers,
): HTMLElement {
  const panel = element("div", "panel-content panel-select");
  panel.append(element("p", "panel-kicker", "THE CAMPAIGN"));
  panel.append(element("h2", "panel-title", "Choose a courtyard"));

  const chapterOrder = ["shadow", "corners", "procession", "stones", "eclipse"];

  for (const chapter of chapterOrder) {
    const entries = levels
      .map((level, index) => ({ level, index }))
      .filter(({ level }) => (level.chapter ?? "shadow") === chapter);
    if (entries.length === 0) continue;

    panel.append(
      element("p", "chapter-label", CHAPTERS[chapter] ?? chapter),
    );
    const grid = element("div", "level-grid");
    for (const { level, index } of entries) {
      const completed = save.completed.includes(level.id);
      const unlocked = index === 0 || save.highestLevel >= index;
      const card = element("button", "level-card");
      card.disabled = !unlocked;
      if (completed) card.classList.add("completed");
      if (!unlocked) card.classList.add("locked");

      card.append(element("span", "level-card-number", String(index + 1).padStart(2, "0")));
      card.append(element("span", "level-card-name", level.name));
      const best = save.bestTurns[level.id];
      card.append(
        element(
          "span",
          "level-card-best",
          unlocked
            ? best !== undefined
              ? `${best} turns`
              : level.daylight !== undefined
                ? `${level.daylight} days`
                : "· · ·"
            : "locked",
        ),
      );
      card.addEventListener("click", () => {
        if (unlocked) handlers.onSelect(index);
      });
      grid.append(card);
    }
    panel.append(grid);
  }

  const actions = element("div", "panel-actions");
  const reset = element("button", "ghost", "Reset progress");
  reset.addEventListener("click", handlers.onReset);
  const close = element("button", "primary", "Close");
  close.addEventListener("click", handlers.onClose);
  actions.append(reset, close);
  panel.append(actions);
  return panel;
}
