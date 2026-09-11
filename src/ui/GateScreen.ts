export interface GateHandlers {
  /** Runs synchronously inside the user gesture (audio unlock must happen here). */
  onUnlock: () => void;
  /** Runs after the seal has opened (reveal the title screen). */
  onReveal: () => void;
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

/** A small eclipse glyph: a dark disc with a thin corona and a pillar notch. */
function eclipseGlyph(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("class", "gate-mark");
  svg.setAttribute("aria-hidden", "true");

  const corona = document.createElementNS(NS, "circle");
  corona.setAttribute("cx", "60");
  corona.setAttribute("cy", "60");
  corona.setAttribute("r", "30");
  corona.setAttribute("fill", "none");
  corona.setAttribute("stroke", "rgba(232,180,90,0.65)");
  corona.setAttribute("stroke-width", "1.2");
  svg.append(corona);

  const disc = document.createElementNS(NS, "circle");
  disc.setAttribute("cx", "60");
  disc.setAttribute("cy", "60");
  disc.setAttribute("r", "24");
  disc.setAttribute("fill", "#070604");
  svg.append(disc);

  const pillar = document.createElementNS(NS, "polygon");
  pillar.setAttribute(
    "points",
    "56,52 64,52 64,78 56,78",
  );
  pillar.setAttribute("fill", "rgba(226,214,184,0.9)");
  svg.append(pillar);

  const glow = document.createElementNS(NS, "polygon");
  glow.setAttribute("points", "64,52 80,86 64,86");
  glow.setAttribute("fill", "rgba(232,180,90,0.22)");
  svg.append(glow);

  return svg;
}

/**
 * The pre-title gateway. An opaque eclipse-seal page whose only job, beyond
 * atmosphere, is to capture one real user gesture so the browser lets us start
 * audio, and to make that moment feel deliberate. Through the circular aperture
 * the title monument is already waiting.
 */
export function renderGateScreen(): HTMLElement {
  const screen = element("div", "gate-screen");

  const top = element("div", "gate-top");
  top.append(element("p", "gate-kicker", "THE COURTYARD IS SEALED"));

  const emblem = element("div", "gate-emblem");
  emblem.append(eclipseGlyph());

  const line = element("p", "gate-line");
  line.textContent = "The sun will not wait for you to be ready.";

  const button = element("button", "gate-begin");
  button.type = "button";
  button.textContent = "Break the seal";
  button.append(element("span", "gate-bloom"));

  const hint = element("p", "gate-hint", "click · tap · press any key");

  const sound = element("div", "gate-sound");
  const bars = element("span", "gate-bars");
  for (let i = 0; i < 3; i++) bars.append(element("span", "gate-bar"));
  sound.append(bars);

  const bottom = element("div", "gate-bottom");
  bottom.append(emblem, line, button, hint, sound);

  screen.append(top, bottom);
  return screen;
}
