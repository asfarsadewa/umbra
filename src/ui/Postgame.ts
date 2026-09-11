export interface PostgameHandlers {
  onDeepUmbra: () => void;
  onPenumbra: () => void;
  onReturn: () => void;
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

function choice(
  label: string,
  blurb: string,
  className: string,
  delay: number,
  onClick: () => void,
): HTMLElement {
  const button = element("button", `postgame-choice ${className} reveal`);
  button.style.animationDelay = `${delay}ms`;
  button.append(element("span", "postgame-choice-label", label));
  button.append(element("span", "postgame-choice-blurb", blurb));
  button.addEventListener("click", onClick);
  return button;
}

/**
 * The ending of the core campaign and the postgame choice. It is deliberately
 * not a "next level" screen: completing 018 finishes UMBRA, and the two
 * postgame roads are offered as optional mastery content.
 */
export function renderCampaignComplete(handlers: PostgameHandlers): HTMLElement {
  const screen = element("div", "postgame-screen");

  const head = element("div", "postgame-head");
  head.append(element("p", "postgame-kicker reveal", "CAMPAIGN COMPLETE"));
  head.append(element("h2", "postgame-title reveal", "The dead are still."));
  const quote = element("p", "postgame-quote reveal");
  quote.innerHTML =
    "You learned the shape of shadow.<br/>But shadow has an edge.";
  head.append(quote);

  const choices = element("div", "postgame-choices");
  choices.append(
    choice("Deep Umbra", "Nothing new. Only harder.", "deep", 900, handlers.onDeepUmbra),
  );
  choices.append(
    choice("Penumbra", "Enter the half-light.", "penumbra", 1100, handlers.onPenumbra),
  );
  choices.append(
    choice("Return", "The journey is already complete.", "return", 1300, handlers.onReturn),
  );

  screen.append(head, choices);
  return screen;
}

/**
 * The half-light reveal, shown once when the player first steps into Penumbra.
 * The board behind it is repainted with the three-tier illumination model, so
 * the softening of the shadow edge happens in-world (Penumbra spec §28).
 */
export function renderPenumbraIntro(): HTMLElement {
  const screen = element("div", "penumbra-intro");
  screen.append(element("p", "penumbra-word reveal", "PENUMBRA"));
  screen.append(
    element("p", "penumbra-line reveal", "Nothing lives at either extreme."),
  );
  return screen;
}

export interface PostgamePanelOptions {
  deepSolved: number;
  deepTotal: number;
  penumbraSolved: number;
  penumbraTotal: number;
  handlers: PostgameHandlers;
}

/** Small panel used from the title screen once postgame is unlocked. */
export function renderPostgamePanel(options: PostgamePanelOptions): HTMLElement {
  const panel = element("div", "panel-content panel-postgame");
  panel.append(element("p", "panel-kicker", "POSTGAME"));
  panel.append(element("h2", "panel-title", "What remains"));
  panel.append(
    element(
      "p",
      "panel-quote",
      "Level 018 is the end of the journey, not the limit of its rules.",
    ),
  );

  const choices = element("div", "postgame-choices");
  choices.append(
    choice(
      "Deep Umbra",
      `Nothing new. Only harder.  -  ${options.deepSolved} / ${options.deepTotal}`,
      "deep",
      0,
      options.handlers.onDeepUmbra,
    ),
  );
  choices.append(
    choice(
      "Penumbra",
      `Enter the half-light.  -  ${options.penumbraSolved} / ${options.penumbraTotal}`,
      "penumbra",
      0,
      options.handlers.onPenumbra,
    ),
  );
  panel.append(choices);

  const actions = element("div", "panel-actions");
  const back = element("button", "primary", "Back");
  back.addEventListener("click", options.handlers.onReturn);
  actions.append(back);
  panel.append(actions);
  return panel;
}
