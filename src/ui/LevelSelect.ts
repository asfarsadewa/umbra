import { LevelDefinition } from "../world/Level";
import { CHAPTERS } from "../levels/index";
import { SaveData } from "./SaveManager";

export interface LevelSelectHandlers {
  onSelect: (index: number) => void;
  onClose: () => void;
  onReset: () => void;
  onPostgame: () => void;
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

const CHAPTER_ORDER = ["shadow", "corners", "procession", "stones", "eclipse"];

/**
 * Level select. The core campaign keeps its own grid; the postgame lives in a
 * separate section so 019 / P001 never look like campaign stages (spec §22).
 */
export function renderLevelSelect(
  allLevels: LevelDefinition[],
  campaignCount: number,
  save: SaveData,
  handlers: LevelSelectHandlers,
): HTMLElement {
  const panel = element("div", "panel-content panel-select");
  panel.append(element("p", "panel-kicker", "THE CAMPAIGN"));
  panel.append(element("h2", "panel-title", "Choose a courtyard"));

  const campaign = allLevels.slice(0, campaignCount);
  for (const chapter of CHAPTER_ORDER) {
    const entries = campaign
      .map((level, index) => ({ level, index }))
      .filter(({ level }) => (level.chapter ?? "shadow") === chapter);
    if (entries.length === 0) continue;

    panel.append(element("p", "chapter-label", CHAPTERS[chapter] ?? chapter));
    panel.append(
      buildGrid(entries, save, handlers, (index) => ({
        unlocked: index === 0 || save.highestLevel >= index,
        completed: save.completed.includes(allLevels[index].id),
        best: save.bestTurns[allLevels[index].id],
        label: index,
      })),
    );
  }

  if (save.postgameUnlocked) {
    panel.append(element("div", "postgame-divider"));
    panel.append(element("p", "chapter-label", "POSTGAME"));

    const deepEntries = allLevels
      .map((level, index) => ({ level, index }))
      .filter(({ level }) => level.chapter === "deep");
    const penumbraEntries = allLevels
      .map((level, index) => ({ level, index }))
      .filter(({ level }) => level.chapter === "penumbra");

    panel.append(element("p", "section-label", "DEEP UMBRA · nothing new, only harder"));
    panel.append(
      buildGrid(deepEntries, save, handlers, (index) => ({
        unlocked: true,
        completed: save.deep.completed[allLevels[index].id] === true,
        best: save.deep.best[allLevels[index].id],
        label: index - campaignCount,
      })),
    );

    panel.append(element("p", "section-label", "PENUMBRA · enter the half-light"));
    panel.append(
      buildGrid(penumbraEntries, save, handlers, (index) => ({
        unlocked: true,
        completed: save.penumbra.completed[allLevels[index].id] === true,
        best: save.penumbra.best[allLevels[index].id],
        label: index - campaignCount - deepEntries.length,
      })),
    );
  }

  const actions = element("div", "panel-actions");
  if (save.postgameUnlocked) {
    const post = element("button", "ghost", "Postgame");
    post.addEventListener("click", handlers.onPostgame);
    actions.append(post);
  }
  const reset = element("button", "ghost", "Reset progress");
  reset.addEventListener("click", handlers.onReset);
  const close = element("button", "primary", "Close");
  close.addEventListener("click", handlers.onClose);
  actions.append(reset, close);
  panel.append(actions);
  return panel;
}

function buildGrid(
  entries: Array<{ level: LevelDefinition; index: number }>,
  save: SaveData,
  handlers: LevelSelectHandlers,
  describe: (index: number) => {
    unlocked: boolean;
    completed: boolean;
    best: number | undefined;
    label: number;
  },
): HTMLElement {
  const grid = element("div", "level-grid");
  for (const { level, index } of entries) {
    const info = describe(index);
    const card = element("button", "level-card");
    card.disabled = !info.unlocked;
    if (info.completed) card.classList.add("completed");
    if (!info.unlocked) card.classList.add("locked");

    card.append(
      element("span", "level-card-number", String(info.label + 1).padStart(2, "0")),
    );
    card.append(element("span", "level-card-name", level.name));
    card.append(
      element(
        "span",
        "level-card-best",
        !info.unlocked
          ? "locked"
          : info.best !== undefined
            ? `${info.best} turns`
            : level.daylight !== undefined
              ? `${level.daylight} days`
              : "· · ·",
      ),
    );
    card.addEventListener("click", () => {
      if (info.unlocked) handlers.onSelect(index);
    });
    grid.append(card);
  }
  void save;
  return grid;
}
