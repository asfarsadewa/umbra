import * as THREE from "three";
import { GameState, Position, ShadeState } from "../game/types";
import { gridPositionToWorld, WorldLayout } from "./coords";
import { Theme } from "./themes";

interface SmokePuff {
  sprite: THREE.Sprite;
  phase: number;
  speed: number;
}

export interface ShadeView {
  id: string;
  root: THREE.Group;
  body: THREE.Group;
  smoke: SmokePuff[];
  contact: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  phase: number;
  buried: boolean;
  sink: number;
  moving: boolean;
  groundInLight: boolean;
}

function softTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The Shades: tiny, near-featureless silhouettes with a thin trail of smoke.
 * They read as vulnerable, not monstrous (SPEC §26).
 */
export class ShadeRenderer {
  readonly group = new THREE.Group();
  private views = new Map<string, ShadeView>();
  private layout: WorldLayout = { width: 1, height: 1 };
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly smokeMaterial: THREE.SpriteMaterial;
  private readonly contactMaterial: THREE.MeshBasicMaterial;
  private readonly geometry: THREE.BufferGeometry[] = [];
  private readonly texture: THREE.Texture;
  private lastTime = 0;

  constructor() {
    this.group.name = "Shades";
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x08080c,
      roughness: 0.86,
      metalness: 0.05,
      flatShading: true,
    });
    this.texture = softTexture();
    this.smokeMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      color: 0x2a2b33,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.contactMaterial = new THREE.MeshBasicMaterial({
      color: 0x1b2030,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  setLevel(state: GameState, theme: Theme): void {
    this.clearLevel();
    this.layout = { width: state.width, height: state.height };
    this.bodyMaterial.color.set(theme.shade);
    for (const shade of state.shades) this.createShade(shade);
    this.syncInstant(state);
  }

  private createShade(shade: ShadeState): void {
    const root = new THREE.Group();
    const body = new THREE.Group();

    // A narrow robe: a tapered prism, slightly asymmetric.
    const robeGeometry = new THREE.CylinderGeometry(0.1, 0.23, 0.5, 7, 1);
    this.geometry.push(robeGeometry);
    const robe = new THREE.Mesh(robeGeometry, this.bodyMaterial);
    robe.position.y = 0.25;
    robe.rotation.y = shade.colorIndex * 0.9;
    body.add(robe);

    const shoulderGeometry = new THREE.CylinderGeometry(0.14, 0.1, 0.18, 7);
    this.geometry.push(shoulderGeometry);
    const shoulders = new THREE.Mesh(shoulderGeometry, this.bodyMaterial);
    shoulders.position.y = 0.55;
    body.add(shoulders);

    const headGeometry = new THREE.SphereGeometry(0.095, 10, 8);
    this.geometry.push(headGeometry);
    const head = new THREE.Mesh(headGeometry, this.bodyMaterial);
    head.position.y = 0.68;
    head.scale.set(0.9, 1.15, 0.9);
    body.add(head);

    const hoodGeometry = new THREE.ConeGeometry(0.125, 0.22, 8);
    this.geometry.push(hoodGeometry);
    const hood = new THREE.Mesh(hoodGeometry, this.bodyMaterial);
    hood.position.y = 0.7;
    body.add(hood);

    root.add(body);

    // A thin trail of smoke.
    const smoke: SmokePuff[] = [];
    for (let i = 0; i < 3; i++) {
      const sprite = new THREE.Sprite(this.smokeMaterial);
      sprite.position.set(0, 0.5, 0);
      sprite.scale.setScalar(0.34);
      root.add(sprite);
      smoke.push({ sprite, phase: i * 0.9, speed: 0.22 + i * 0.05 });
    }

    const contactGeometry = new THREE.CircleGeometry(0.24, 20);
    this.geometry.push(contactGeometry);
    const contact = new THREE.Mesh(contactGeometry, this.contactMaterial);
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.015;
    root.add(contact);

    const view: ShadeView = {
      id: shade.id,
      root,
      body,
      smoke,
      contact,
      phase: shade.colorIndex * 1.7,
      buried: false,
      sink: 0,
      moving: false,
      groundInLight: true,
    };
    this.views.set(shade.id, view);
    this.group.add(root);
  }

  syncInstant(state: GameState): void {
    for (const shade of state.shades) {
      const view = this.views.get(shade.id);
      if (!view) continue;
      const world = gridPositionToWorld(this.layout, shade.position);
      view.root.position.set(world.x, 0, world.z);
      view.root.visible = !shade.buried;
      view.buried = shade.buried;
      view.sink = shade.buried ? 1 : 0;
      view.moving = false;
      view.body.rotation.y = 0;
      view.body.position.y = 0;
    }
  }

  positionOf(position: Position): THREE.Vector3 {
    const world = gridPositionToWorld(this.layout, position);
    return new THREE.Vector3(world.x, 0, world.z);
  }

  getView(id: string): ShadeView | undefined {
    return this.views.get(id);
  }

  setBuried(id: string, buried: boolean): void {
    const view = this.views.get(id);
    if (view) view.buried = buried;
  }

  setMoving(id: string, moving: boolean): void {
    const view = this.views.get(id);
    if (view) view.moving = moving;
  }

  /** Show a soft grounding shadow only when the Shade stands in full light. */
  setGrounding(id: string, inLight: boolean): void {
    const view = this.views.get(id);
    if (view) view.groundInLight = inLight;
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    const dt = Math.min(Math.max(t - this.lastTime, 0), 0.1);
    this.lastTime = t;

    for (const view of this.views.values()) {
      if (!view.root.visible) continue;

      if (view.buried) {
        view.sink = Math.min(view.sink + dt * 2.4, 1);
        view.body.position.y = -view.sink * 0.55;
        view.body.scale.setScalar(1 - view.sink * 0.35);
        view.contact.material.opacity = 0.34 * (1 - view.sink);
        if (view.sink > 0.85) view.root.visible = false;
      } else {
        const breathe = Math.sin(t * 1.6 + view.phase) * 0.018;
        view.body.position.y = breathe;
        const lean = view.moving ? Math.sin(t * 9 + view.phase) * 0.09 : 0;
        view.body.rotation.z = lean;
        view.contact.material.opacity = view.groundInLight ? 0.34 : 0.08;
      }

      for (const puff of view.smoke) {
        const cycle = (t * puff.speed + puff.phase) % 1;
        puff.sprite.position.y = 0.45 + cycle * 0.55;
        puff.sprite.position.x = Math.sin((cycle + view.phase) * 6) * 0.05;
        const scale = 0.22 + cycle * 0.4;
        puff.sprite.scale.setScalar(scale);
        puff.sprite.visible = !view.buried;
      }
    }
  }

  private clearLevel(): void {
    this.views.clear();
    this.group.clear();
    for (const geometry of this.geometry) geometry.dispose();
    this.geometry.length = 0;
  }

  dispose(): void {
    this.clearLevel();
    this.texture.dispose();
    this.bodyMaterial.dispose();
    this.smokeMaterial.dispose();
    this.contactMaterial.dispose();
  }
}
