import * as THREE from "three";
import { GameState, Position, ShadeState } from "../game/types";
import { AssetLoader, styleModel } from "./AssetLoader";
import { EntityKind } from "../game/types";
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
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  walkWeight: number;
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
 * The shipped model is an AI-authored, Blender-rigged shroud with idle/walk
 * clips; the procedural primitives are the fallback.
 */
export class ShadeRenderer {
  readonly group = new THREE.Group();
  private views = new Map<string, ShadeView>();
  private layout: WorldLayout = { width: 1, height: 1 };
  private theme: Theme | null = null;
  private assets: AssetLoader | null = null;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly smokeMaterial: THREE.SpriteMaterial;
  private readonly wraithSmokeMaterial: THREE.SpriteMaterial;
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
    this.wraithSmokeMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      color: 0xc8d8f0,
      transparent: true,
      opacity: 0.22,
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

  setLevel(state: GameState, theme: Theme, assets?: AssetLoader): void {
    this.clearLevel();
    this.layout = { width: state.width, height: state.height };
    this.theme = theme;
    this.assets = assets ?? null;
    this.bodyMaterial.color.set(theme.shade);
    for (const shade of state.shades) this.createShade(shade);
    this.syncInstant(state);
  }

  private createShade(shade: ShadeState): void {
    const root = new THREE.Group();
    const body = new THREE.Group();
    const kind: EntityKind = shade.kind ?? "shade";
    const model = this.assets?.instance(kind === "wraith" ? "wraith" : "princess") ?? null;

    let mixer: THREE.AnimationMixer | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let walkAction: THREE.AnimationAction | null = null;

    if (model) {
      const isWraith = kind === "wraith";
      const tint = new THREE.Color(
        isWraith ? (this.theme?.wraith ?? 0xffffff) : (this.theme?.character ?? 0xffffff),
      );
      const sink: THREE.Material[] = [];
      styleModel(
        model,
        (material) => {
          material.color.multiply(tint);
          material.metalness = 0;
          material.roughness = isWraith ? 0.45 : 0.62;
          if (isWraith) {
            // Half-lit: faintly luminous and slightly translucent.
            material.transparent = true;
            material.opacity = 0.94;
            material.emissive = new THREE.Color(this.theme?.wraithGlow ?? 0xbcd4ff);
            material.emissiveIntensity = 0.18;
            material.depthWrite = true;
          }
        },
        sink,
      );
      body.add(model);
      const clips = this.assets?.animations(kind === "wraith" ? "wraith" : "princess") ?? [];
      const idleClip = THREE.AnimationClip.findByName(clips, "idle");
      const walkClip = THREE.AnimationClip.findByName(clips, "walk");
      if (idleClip || walkClip) {
        mixer = new THREE.AnimationMixer(model);
        if (idleClip) {
          idleAction = mixer.clipAction(idleClip);
          idleAction.setEffectiveWeight(1);
          idleAction.play();
        }
        if (walkClip) {
          walkAction = mixer.clipAction(walkClip);
          walkAction.setEffectiveWeight(0);
          walkAction.play();
        }
      }
    } else {
      body.add(this.buildPrimitiveShade(shade.colorIndex));
    }

    root.add(body);

    const smokeMaterial =
      kind === "wraith" ? this.wraithSmokeMaterial : this.smokeMaterial;
    const smoke: SmokePuff[] = [];
    for (let i = 0; i < 3; i++) {
      const sprite = new THREE.Sprite(smokeMaterial);
      sprite.position.set(0, 0.4, 0);
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
      mixer,
      idleAction,
      walkAction,
      walkWeight: 0,
      phase: shade.colorIndex * 1.7,
      buried: false,
      sink: 0,
      moving: false,
      groundInLight: true,
    };
    this.views.set(shade.id, view);
    this.group.add(root);
  }

  private buildPrimitiveShade(colorIndex: number): THREE.Group {
    const body = new THREE.Group();
    const robeGeometry = new THREE.CylinderGeometry(0.1, 0.23, 0.5, 7, 1);
    const robe = new THREE.Mesh(robeGeometry, this.bodyMaterial);
    robe.position.y = 0.25;
    robe.rotation.y = colorIndex * 0.9;
    body.add(robe);

    const shoulderGeometry = new THREE.CylinderGeometry(0.14, 0.1, 0.18, 7);
    const shoulders = new THREE.Mesh(shoulderGeometry, this.bodyMaterial);
    shoulders.position.y = 0.55;
    body.add(shoulders);

    const headGeometry = new THREE.SphereGeometry(0.095, 10, 8);
    const head = new THREE.Mesh(headGeometry, this.bodyMaterial);
    head.position.y = 0.68;
    head.scale.set(0.9, 1.15, 0.9);
    body.add(head);

    const hoodGeometry = new THREE.ConeGeometry(0.125, 0.22, 8);
    const hood = new THREE.Mesh(hoodGeometry, this.bodyMaterial);
    hood.position.y = 0.7;
    body.add(hood);

    this.geometry.push(robeGeometry, shoulderGeometry, headGeometry, hoodGeometry);
    return body;
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
      view.walkWeight = 0;
      view.body.rotation.y = 0;
      view.body.position.y = 0;
      view.idleAction?.setEffectiveWeight(1);
      view.walkAction?.setEffectiveWeight(0);
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

  /** Point a Shade toward a world-space direction (XZ). */
  setFacing(id: string, dx: number, dz: number): void {
    const view = this.views.get(id);
    if (!view || (dx === 0 && dz === 0)) return;
    view.body.rotation.y = Math.atan2(-dz, dx);
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
        view.contact.material.opacity = view.groundInLight ? 0.34 : 0.08;
      }

      const target = view.moving ? 1 : 0;
      view.walkWeight += (target - view.walkWeight) * Math.min(1, dt * 7);
      view.walkAction?.setEffectiveWeight(view.walkWeight);
      view.idleAction?.setEffectiveWeight(1 - view.walkWeight);
      view.mixer?.update(dt);

      for (const puff of view.smoke) {
        const cycle = (t * puff.speed + puff.phase) % 1;
        puff.sprite.position.y = 0.4 + cycle * 0.5;
        puff.sprite.position.x = Math.sin((cycle + view.phase) * 6) * 0.05;
        puff.sprite.scale.setScalar(0.2 + cycle * 0.36);
        puff.sprite.visible = !view.buried;
      }
    }
  }

  private clearLevel(): void {
    for (const view of this.views.values()) view.mixer?.stopAllAction();
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
    this.wraithSmokeMaterial.dispose();
    this.contactMaterial.dispose();
  }
}
