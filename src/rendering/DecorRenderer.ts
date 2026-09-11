import * as THREE from "three";
import { GameState } from "../game/types";
import { AssetLoader, styleModel } from "./AssetLoader";
import { gridToWorld, hash2d, WorldLayout } from "./coords";
import { MODEL_BASE, modelTint, Theme } from "./themes";

/**
 * Sparse ruin dressing around the courtyard: olive trees, dry scrub, and
 * tumbled rubble. The shipped props are AI-authored; procedural primitives are
 * the fallback. Placement is deterministic and never lands on a walkable tile,
 * so puzzle readability is preserved.
 */
export class DecorRenderer {
  readonly group = new THREE.Group();
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private layout: WorldLayout = { width: 1, height: 1 };
  private assets: AssetLoader | null = null;
  private tints = {
    rubble: new THREE.Color(1, 1, 1),
    cypress: new THREE.Color(1, 1, 1),
    bush: new THREE.Color(1, 1, 1),
  };

  constructor() {
    this.group.name = "Decor";
  }

  build(state: GameState, theme: Theme, assets?: AssetLoader): void {
    this.dispose();
    this.layout = { width: state.width, height: state.height };
    this.assets = assets ?? null;
    const eclipse = theme.name === "eclipse";
    this.tints = {
      rubble: modelTint(MODEL_BASE.wall, theme.base),
      cypress: new THREE.Color(eclipse ? 0xc9a072 : 0xffffff),
      bush: new THREE.Color(eclipse ? 0xbf9a68 : 0x8a8f63),
    };

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
      color: theme.name === "eclipse" ? 0x5a4a2e : 0x6f6a3f,
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
            this.place(
              model,
              world.x + (roll - 0.08) * 2,
              top - 0.03,
              world.z,
              0.32 + roll * 0.3,
              roll * 7,
              "rubble",
            );
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

    this.scatter(state, scrubMaterial, rockGeometry, darkStoneMaterial);
  }

  /** Trees, scrub and stones on the surrounding sand. */
  private scatter(
    state: GameState,
    scrubMaterial: THREE.MeshStandardMaterial,
    rockGeometry: THREE.BufferGeometry,
    rockMaterial: THREE.Material,
  ): void {
    const near = Math.max(state.width, state.height) / 2 + 2.6;

    // Cypresses, further out, so the ruins sit in a Mediterranean landscape.
    const cypresses = this.assets?.has("cypress") ? 8 : 0;
    for (let i = 0; i < cypresses; i++) {
      const model = this.assets?.instance("cypress");
      if (!model) break;
      const a = hash2d(i * 71 + 3, i * 37 + 11) * Math.PI * 2;
      const r = near + 1.4 + hash2d(i * 13 + 5, i * 29 + 7) * 4.6;
      const x = Math.cos(a) * (r + state.width * 0.1);
      const z = Math.sin(a) * (r + state.height * 0.1);
      this.place(
        model,
        x,
        -1.78,
        z,
        0.7 + hash2d(i + 2, i + 9) * 0.55,
        hash2d(i * 3 + 1, i * 5 + 2) * 6,
        "cypress",
      );
    }

    // Scrub and stones closer in.
    for (let i = 0; i < 72; i++) {
      const rx = hash2d(i * 13 + 1, i * 7 + 3);
      const rz = hash2d(i * 5 + 9, i * 11 + 4);
      const pick = hash2d(i * 3 + 2, i * 17 + 8);
      const spread = near + hash2d(i * 19 + 2, i * 23 + 6) * 2.6;
      const x = (rx * 2 - 1) * (spread + state.width * 0.1);
      const z = (rz * 2 - 1) * (spread + state.height * 0.1);
      if (
        Math.abs(x) < state.width / 2 + 0.7 &&
        Math.abs(z) < state.height / 2 + 0.7
      ) {
        continue;
      }

      if (pick < 0.2) {
        const model = this.assets?.instance("rubble");
        if (model) {
          this.place(model, x, -1.78, z, 0.4 + pick * 1.1, rx * 6, "rubble");
        } else {
          const mesh = new THREE.Mesh(rockGeometry, rockMaterial);
          mesh.position.set(x, -1.72, z);
          mesh.scale.setScalar(0.7 + pick * 3);
          mesh.rotation.set(rx * 4, rz * 5, rx * 3);
          mesh.castShadow = true;
          this.group.add(mesh);
        }
      } else if (pick < 0.46) {
        const model = this.assets?.instance("bush");
        if (model) {
          this.place(model, x, -1.78, z, 0.4 + rz * 0.5, rx * 6, "bush", 0.72);
        } else {
          const scrub = this.buildScrub(scrubMaterial);
          scrub.position.set(x, -1.72, z);
          scrub.scale.setScalar(0.7 + rz * 1.6);
          scrub.rotation.y = rx * 6;
          this.group.add(scrub);
        }
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

  private place(
    model: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    scale: number,
    rotation: number,
    tint: "rubble" | "cypress" | "bush",
    flattenY = 1,
  ): void {
    styleModel(
      model,
      (material) => {
        material.color.multiply(this.tints[tint]);
        material.metalness = 0;
        material.roughness = Math.max(material.roughness, 0.7);
      },
      this.disposables,
    );
    model.position.set(x, y, z);
    model.scale.set(scale, scale * flattenY, scale);
    model.rotation.y = rotation;
    this.group.add(model);
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables = [];
    this.group.clear();
  }
}
