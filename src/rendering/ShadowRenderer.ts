import * as THREE from "three";
import { computeShadowDepths } from "../game/shadows";
import { Direction, SUN_MOVE_VECTORS } from "../game/types";
import { Board } from "../world/Board";
import { gridToWorld, WorldLayout } from "./coords";
import { Theme } from "./themes";

interface Quad {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  delay: number;
}

/** A unit tile quad whose pivot sits on its sunward edge. */
const QUAD_GEOMETRY = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);

/**
 * Draws the authoritative logical shadow onto the floor.
 *
 * The simulation owns shadow truth (SPEC §6); this renderer paints exactly the
 * tiles it reports and sweeps them outward from each caster when the sun
 * changes, so a tiny grid action appears to physically sweep the light.
 */
export class ShadowRenderer {
  readonly group = new THREE.Group();
  private layout: WorldLayout = { width: 1, height: 1 };
  private readonly material: THREE.MeshBasicMaterial;
  private quads: Quad[] = [];
  private elapsed = 0;
  private duration = 0.42;
  private animating = false;

  constructor() {
    this.group.name = "Shadows";
    this.material = new THREE.MeshBasicMaterial({
      color: 0x2c3446,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Keep the shadow colour literal; ACES would lift it toward the sand.
    this.material.toneMapped = false;
  }

  /** Rebuild for a fresh level with no animation. */
  applyInstant(
    board: Board,
    sun: Direction,
    theme: Theme,
    layout: WorldLayout,
  ): void {
    this.layout = layout;
    this.material.color.set(theme.shadow);
    this.material.opacity = theme.shadowOpacity;
    this.clear();
    for (const quad of this.buildQuads(board, sun)) {
      quad.mesh.scale.set(1, 1, 1);
      this.group.add(quad.mesh);
      this.quads.push(quad);
    }
    this.animating = false;
    this.elapsed = 0;
  }

  /** Sweep to a new sun. `duration` is the light sweep time. */
  sweep(board: Board, sun: Direction, theme: Theme, duration = 0.42): void {
    this.material.color.set(theme.shadow);
    this.material.opacity = theme.shadowOpacity;
    this.duration = duration;
    this.clear();
    for (const quad of this.buildQuads(board, sun)) {
      quad.mesh.scale.set(0.001, 1, 1);
      this.group.add(quad.mesh);
      this.quads.push(quad);
    }
    this.elapsed = 0;
    this.animating = true;
  }

  private buildQuads(board: Board, sun: Direction): Quad[] {
    const depths = computeShadowDepths(board, sun);
    const vector = SUN_MOVE_VECTORS[sun];
    let maxDepth = 1;
    for (const depth of depths.values()) maxDepth = Math.max(maxDepth, depth);

    const quads: Quad[] = [];
    for (const [key, depth] of depths) {
      const [x, y] = key.split(",").map(Number);
      if (!board.inBounds(x, y)) continue;
      const tile = board.tileAt(x, y);
      if (tile !== "Floor" && tile !== "Grave") continue;
      if (board.casterAt(x, y)) continue;
      const world = gridToWorld(this.layout, x, y);
      const mesh = new THREE.Mesh(QUAD_GEOMETRY, this.material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.atan2(-vector.y, vector.x);
      mesh.position.set(
        world.x - vector.x * 0.5,
        0.018,
        world.z - vector.y * 0.5,
      );
      mesh.renderOrder = 2;
      const normalized = Math.min(1, depth / maxDepth);
      quads.push({ mesh, delay: normalized * this.duration * 0.5 });
    }
    return quads;
  }

  update(dt: number): void {
    if (!this.animating) return;
    this.elapsed += dt;
    const span = Math.max(this.duration - this.duration * 0.5, 0.001);
    for (const quad of this.quads) {
      const local = Math.min(Math.max((this.elapsed - quad.delay) / span, 0), 1);
      const scale = ease(local);
      quad.mesh.scale.set(Math.max(scale, 0.001), 1, 1);
    }
    if (this.elapsed >= this.duration) {
      for (const quad of this.quads) quad.mesh.scale.set(1, 1, 1);
      this.animating = false;
    }
  }

  get isAnimating(): boolean {
    return this.animating;
  }

  private clear(): void {
    for (const quad of this.quads) this.group.remove(quad.mesh);
    this.quads = [];
  }

  dispose(): void {
    this.clear();
    this.material.dispose();
    QUAD_GEOMETRY.dispose();
  }
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
