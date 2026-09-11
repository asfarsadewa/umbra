import * as THREE from "three";
import { GameState } from "../game/types";
import { AssetLoader, styleModel } from "./AssetLoader";
import { gridToWorld, hash2d, WorldLayout } from "./coords";
import { MODEL_BASE, modelTint, Theme } from "./themes";

/**
 * The static shadow casters: tall pillars and low stones. The shipped models
 * are AI-authored and prepared in Blender; if they are missing, crisp
 * procedural primitives are used instead so the diorama always builds.
 */
export class CasterRenderer {
  readonly group = new THREE.Group();
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private layout: WorldLayout = { width: 1, height: 1 };

  constructor() {
    this.group.name = "Casters";
  }

  build(state: GameState, theme: Theme, assets?: AssetLoader): void {
    this.dispose();
    this.layout = { width: state.width, height: state.height };
    let index = 0;
    for (const caster of state.board.casters) {
      const world = gridToWorld(this.layout, caster.position.x, caster.position.y);
      const model = assets?.instance(caster.kind === "pillar" ? "pillar" : "stone");
      if (model) {
        this.placeModel(model, world.x, world.z, caster.kind, index, theme);
      } else if (caster.kind === "pillar") {
        this.addPillar(world.x, world.z, index, theme);
      } else {
        this.addStone(world.x, world.z, index, theme);
      }
      index++;
    }
  }

  private placeModel(
    model: THREE.Object3D,
    x: number,
    z: number,
    kind: "pillar" | "stone",
    index: number,
    theme: Theme,
  ): void {
    const tint = modelTint(
      kind === "pillar" ? MODEL_BASE.pillar : MODEL_BASE.stone,
      kind === "pillar" ? theme.pillar : theme.stone,
    );
    styleModel(
      model,
      (material) => {
        material.color.multiply(tint);
        material.metalness = 0;
        material.roughness = 0.92;
      },
      this.disposables,
    );
    model.position.set(x, 0, z);
    model.rotation.y = (hash2d(index * 13 + 3, index * 7 + 11) - 0.5) * 0.5;
    this.group.add(model);
  }

  private addPillar(x: number, z: number, index: number, theme: Theme): void {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = (hash2d(index * 13 + 3, index * 7 + 11) - 0.5) * 0.4;

    const shaftMaterial = new THREE.MeshStandardMaterial({
      color: theme.pillar,
      roughness: 0.92,
      metalness: 0,
      flatShading: true,
    });
    const topMaterial = new THREE.MeshStandardMaterial({
      color: theme.pillarTop,
      roughness: 0.88,
      metalness: 0,
      flatShading: true,
    });
    this.disposables.push(shaftMaterial, topMaterial);

    const height = 1.5 + hash2d(index + 21, index + 4) * 0.28;

    const baseGeometry = new THREE.BoxGeometry(0.66, 0.16, 0.66);
    const base = new THREE.Mesh(baseGeometry, shaftMaterial);
    base.position.y = 0.08;
    base.castShadow = true;
    base.receiveShadow = true;
    this.disposables.push(baseGeometry);
    root.add(base);

    const plinthGeometry = new THREE.BoxGeometry(0.54, 0.12, 0.54);
    const plinth = new THREE.Mesh(plinthGeometry, shaftMaterial);
    plinth.position.y = 0.2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.disposables.push(plinthGeometry);
    root.add(plinth);

    const shaftGeometry = new THREE.CylinderGeometry(0.185, 0.23, height, 14, 1);
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.y = 0.26 + height / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    this.disposables.push(shaftGeometry);
    root.add(shaft);

    const collarGeometry = new THREE.CylinderGeometry(0.25, 0.21, 0.12, 14);
    const collar = new THREE.Mesh(collarGeometry, topMaterial);
    collar.position.y = 0.26 + height + 0.06;
    collar.castShadow = true;
    this.disposables.push(collarGeometry);
    root.add(collar);

    const capitalGeometry = new THREE.BoxGeometry(0.56, 0.16, 0.56);
    const capital = new THREE.Mesh(capitalGeometry, topMaterial);
    capital.position.y = 0.26 + height + 0.2;
    capital.rotation.y = 0.2;
    capital.castShadow = true;
    this.disposables.push(capitalGeometry);
    root.add(capital);

    const chipGeometry = new THREE.BoxGeometry(0.3, 0.11, 0.32);
    const chip = new THREE.Mesh(chipGeometry, topMaterial);
    chip.position.set(0.1, 0.26 + height + 0.34, -0.08);
    chip.rotation.y = 0.6;
    chip.castShadow = true;
    this.disposables.push(chipGeometry);
    root.add(chip);

    this.group.add(root);
  }

  private addStone(x: number, z: number, index: number, theme: Theme): void {
    const material = new THREE.MeshStandardMaterial({
      color: theme.stone,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });
    const topMaterial = new THREE.MeshStandardMaterial({
      color: theme.stoneTop,
      roughness: 0.9,
      metalness: 0,
      flatShading: true,
    });
    this.disposables.push(material, topMaterial);

    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = hash2d(index * 17 + 5, index * 3 + 2) * Math.PI;

    const slabGeometry = new THREE.CylinderGeometry(0.44, 0.49, 0.17, 7);
    const slab = new THREE.Mesh(slabGeometry, material);
    slab.position.y = 0.085;
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.disposables.push(slabGeometry);
    root.add(slab);

    const capGeometry = new THREE.CylinderGeometry(0.38, 0.44, 0.05, 7);
    const cap = new THREE.Mesh(capGeometry, topMaterial);
    cap.position.y = 0.185;
    cap.rotation.y = 0.4;
    cap.castShadow = true;
    cap.receiveShadow = true;
    this.disposables.push(capGeometry);
    root.add(cap);

    this.group.add(root);
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables = [];
    this.group.clear();
  }
}
