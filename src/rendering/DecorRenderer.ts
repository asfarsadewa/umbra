import * as THREE from "three";
import { GameState } from "../game/types";
import { AssetLoader, styleModel } from "./AssetLoader";
import { gridToWorld, hash2d, WorldLayout } from "./coords";
import { MODEL_BASE, modelTint, Theme } from "./themes";

/**
 * Sparse ruin dressing: rubble on the walls, dry scrub and stones on the
 * surrounding sand. Purely cosmetic and deterministic. It never sits in the
 * middle of a walkable tile, so puzzle readability is preserved.
 *
 * The rubble is the AI-authored model when present; the scrub and the fallback
 * stones are procedural.
 */
export class DecorRenderer {
  readonly group = new THREE.Group();
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private layout: WorldLayout = { width: 1, height: 1 };
  private assets: AssetLoader | null = null;
  private rubbleTint = new THREE.Color(1, 1, 1);

  constructor() {
    this.group.name = "Decor";
  }

  build(state: GameState, theme: Theme, assets?: AssetLoader): void {
    this.dispose();
    this.layout = { width: state.width, height: state.height };
    this.assets = assets ?? null;
    this.rubbleTint = modelTint(MODEL_BASE.wall, theme.base);

    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: theme.wall,
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
    });
    const darkStoneMaterial = new THREE.MeshStandardMaterial({
      color: theme.base,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const scrubMaterial = new THREE.MeshStandardMaterial({
      color: theme.name === "eclipse" ? 0x4a3f28 : 0x6f6a3f,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    this.disposables.push(stoneMaterial, darkStoneMaterial, scrubMaterial);

    const rockGeometry = new THREE.IcosahedronGeometry(0.14, 0);
    const drumGeometry = new THREE.CylinderGeometry(0.18, 0.2, 0.22, 8);
    this.disposables.push(rockGeometry, drumGeometry);

    // Rubble on the walls.
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (state.board.tileAt(x, y) !== "Wall") continue;
        const roll = hash2d(x * 3 + 5, y * 7 + 2);
        const world = gridToWorld(this.layout, x, y);
        const variation = hash2d(x + 17, y + 29);
        const top = -0.3 + (0.95 + variation * 0.35);
        if (roll < 0.15) {
          const model = this.assets?.instance("rubble");
          if (model) {
            this.placeRubble(model, world.x + (roll - 0.08) * 2, top - 0.03, world.z, 0.3 + roll * 0.3, roll * 7);
          } else {
            const mesh = new THREE.Mesh(rockGeometry, darkStoneMaterial);
            mesh.position.set(world.x + (roll - 0.08) * 2, top + 0.06, world.z);
            mesh.rotation.set(roll * 5, roll * 7, roll * 3);
            mesh.castShadow = true;
            this.group.add(mesh);
          }
        } else if (roll < 0.24) {
          const mesh = new THREE.Mesh(drumGeometry, stoneMaterial);
          mesh.position.set(world.x, top + 0.11, world.z);
          mesh.rotation.set(Math.PI / 2, 0, roll * 6);
          mesh.castShadow = true;
          this.group.add(mesh);
        }
      }
    }

    // Dry scrub and stones on the surrounding sand.
    const radiusX = state.width / 2 + 2.6;
    const radiusZ = state.height / 2 + 2.6;
    for (let i = 0; i < 64; i++) {
      const rx = hash2d(i * 13 + 1, i * 7 + 3);
      const rz = hash2d(i * 5 + 9, i * 11 + 4);
      const pick = hash2d(i * 3 + 2, i * 17 + 8);
      const x = (rx * 2 - 1) * radiusX;
      const z = (rz * 2 - 1) * radiusZ;
      if (Math.abs(x) < state.width / 2 + 0.6 && Math.abs(z) < state.height / 2 + 0.6) {
        continue;
      }
      if (pick < 0.26) {
        const model = this.assets?.instance("rubble");
        if (model) {
          this.placeRubble(model, x, -1.78, z, 0.4 + pick * 1.1, rx * 6);
        } else {
          const mesh = new THREE.Mesh(rockGeometry, darkStoneMaterial);
          mesh.position.set(x, -1.72, z);
          mesh.scale.setScalar(0.7 + pick * 3);
          mesh.rotation.set(rx * 4, rz * 5, rx * 3);
          mesh.castShadow = true;
          this.group.add(mesh);
        }
      } else if (pick < 0.7) {
        const scrub = this.buildScrub(scrubMaterial);
        scrub.position.set(x, -1.72, z);
        scrub.scale.setScalar(0.7 + rz * 1.6);
        scrub.rotation.y = rx * 6;
        this.group.add(scrub);
      }
    }
  }

  private buildScrub(material: THREE.MeshStandardMaterial): THREE.Group {
    const group = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const height = 0.28 + hash2d(i * 7 + 1, i * 3 + 5) * 0.24;
      const bladeGeometry = new THREE.ConeGeometry(0.045, height, 4);
      this.disposables.push(bladeGeometry);
      const blade = new THREE.Mesh(bladeGeometry, material);
      const angle = (i / 5) * Math.PI * 2;
      blade.position.set(Math.cos(angle) * 0.07, height / 2, Math.sin(angle) * 0.07);
      blade.rotation.z = Math.cos(angle) * 0.4;
      blade.rotation.x = -Math.sin(angle) * 0.4;
      blade.castShadow = true;
      group.add(blade);
    }
    return group;
  }

  private placeRubble(
    model: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    scale: number,
    rotation: number,
  ): void {
    styleModel(
      model,
      (material) => {
        material.color.multiply(this.rubbleTint);
        material.metalness = 0;
        material.roughness = 0.95;
      },
      this.disposables,
    );
    model.position.set(x, y, z);
    model.scale.setScalar(scale);
    model.rotation.y = rotation;
    this.group.add(model);
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables = [];
    this.group.clear();
  }
}
