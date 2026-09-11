import * as THREE from "three";
import { computeShadows } from "../game/shadows";
import { GameState, posKey } from "../game/types";
import { Effects } from "./Effects";
import { ShadeRenderer, ShadeView } from "./ShadeRenderer";
import { ShadowRenderer } from "./ShadowRenderer";
import { SunRig } from "./SunRig";
import { Theme } from "./themes";
import { WorldLayout } from "./coords";

interface Tween {
  view: ShadeView;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

interface ActiveTurn {
  phase: "sweep" | "move";
  elapsed: number;
  sweepDuration: number;
  moveDuration: number;
  tweens: Tween[];
  next: GameState;
  resolve: () => void;
}

/**
 * Sequences a turn's presentation: the sun sweeps around the ruins, the shadow
 * races outward, and only then do the Shades move. The simulation has already
 * been resolved; this only interpolates visuals (SPEC §25).
 */
export class AnimationManager {
  /** Seconds for the lighting sweep. */
  sweepDuration = 0.42;
  /** Seconds for the Shades' step. */
  moveDuration = 0.2;
  reducedMotion = false;

  private turn: ActiveTurn | null = null;
  private theme: Theme;
  private layout: WorldLayout = { width: 1, height: 1 };

  constructor(
    private sunRig: SunRig,
    private shadows: ShadowRenderer,
    private shades: ShadeRenderer,
    private effects: Effects,
    theme: Theme,
  ) {
    this.theme = theme;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
  }

  setLayout(layout: WorldLayout): void {
    this.layout = layout;
  }

  get isAnimating(): boolean {
    return this.turn !== null;
  }

  /** Jump straight to a state with no animation (level load / restart). */
  applyInstant(state: GameState): void {
    if (this.turn) {
      this.turn.resolve();
      this.turn = null;
    }
    this.sunRig.setImmediate(state.sun);
    this.shadows.applyInstant(state.board, state.sun, this.theme, this.layout);
    this.shades.syncInstant(state);
    this.applyGrounding(state);
  }

  animateTurn(previous: GameState, next: GameState): Promise<void> {
    if (this.reducedMotion) {
      this.applyInstant(next);
      return Promise.resolve();
    }
    if (this.turn) {
      this.turn.resolve();
      this.turn = null;
    }

    const sweepDuration = this.sweepDuration;
    this.sunRig.sweepTo(next.sun, sweepDuration);
    this.shadows.sweep(next.board, next.sun, this.theme, sweepDuration);

    const tweens: Tween[] = [];
    for (const shade of next.shades) {
      const view = this.shades.getView(shade.id);
      if (!view) continue;
      const before = previous.shades.find((s) => s.id === shade.id);
      const from = this.shades.positionOf(before ? before.position : shade.position);
      const to = this.shades.positionOf(shade.position);
      view.root.visible = true;
      view.root.position.copy(from);
      if (!from.equals(to)) {
        tweens.push({ view, from, to });
        this.shades.setMoving(shade.id, true);
      }
    }

    return new Promise<void>((resolve) => {
      this.turn = {
        phase: "sweep",
        elapsed: 0,
        sweepDuration,
        moveDuration: this.moveDuration,
        tweens,
        next,
        resolve,
      };
    });
  }

  update(dt: number): void {
    const turn = this.turn;
    if (!turn) return;
    turn.elapsed += dt;

    if (turn.phase === "sweep") {
      if (turn.elapsed >= turn.sweepDuration) {
        turn.phase = "move";
        turn.elapsed = 0;
      }
      return;
    }

    const t = Math.min(turn.elapsed / turn.moveDuration, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    for (const tween of turn.tweens) {
      tween.view.root.position.lerpVectors(tween.from, tween.to, eased);
      tween.view.body.position.y = Math.sin(t * Math.PI) * 0.06;
    }

    if (t >= 1) {
      for (const tween of turn.tweens) {
        tween.view.root.position.copy(tween.to);
        tween.view.body.position.y = 0;
        this.shades.setMoving(tween.view.id, false);
      }
      this.finish(turn.next);
      this.turn = null;
      turn.resolve();
    }
  }

  private finish(next: GameState): void {
    for (const shade of next.shades) {
      if (!shade.buried) continue;
      this.shades.setBuried(shade.id, true);
      this.effects.burial(shade.position, this.theme.graveGlow);
    }
    this.applyGrounding(next);
  }

  private applyGrounding(state: GameState): void {
    const shadowed = computeShadows(state.board, state.sun);
    for (const shade of state.shades) {
      this.shades.setGrounding(
        shade.id,
        !shade.buried && !shadowed.has(posKey(shade.position)),
      );
    }
  }

  /** Cancel any in-flight turn (fresh level load). */
  reset(): void {
    if (this.turn) {
      this.turn.resolve();
      this.turn = null;
    }
  }
}
