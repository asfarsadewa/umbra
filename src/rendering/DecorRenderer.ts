import * as THREE from "three";
import { GameState } from "../game/types";
import { gridToWorld, hash2d, WorldLayout } from "./coords";
import { Theme } from "./themes";

/**
 * Sparse ruin dressing: rubble on the walls, dry scrub and stones on the
 * surrounding sand. Purely cosmetic and deterministic. It never sits in the
 * middle of a walkable tile, so puzzle readability is preserved.
 */
export class DecorRenderer {
  readonly group = new THREE.Group();
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private layout: WorldLayout = { width: 1, height: 1 };

  constructor() {
    this.group.name = "Decor";
  }

  build(state: GameState, theme: Theme): void {
    this.dispose();
    this.layout = { width: state.width, height: state.height };

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
      color: 0x6f6a3f,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    this.track(null, stoneMaterial, darkStoneMaterial, scrubMaterial);

    const rockGeometry = new THREE.IcosahedronGeometry(0.14, 0);
    const drumGeometry = new THREE.CylinderGeometry(0.18, 0.2, 0.22, 8);
    const scrubGeometry = new THREE.ConeGeometry(0.16, 0.4, 6);
    this.disposables.push(rockGeometry, drumGeometry, scrubGeometry);

    // Rubble on the walls.
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (state.board.tileAt(x, y) !== "Wall") continue;
        const roll = hash2d(x * 3 + 5, y * 7 + 2);
        const world = gridToWorld(this.layout, x, y);
        const variation = hash2d(x + 17, y + 29);
        const top = -0.3 + 1.05 + variation * 0.5;
        if (roll < 0.16) {
          const mesh = new THREE.Mesh(rockGeometry, darkStoneMaterial);
          mesh.position.set(world.x + (roll - 0.08) * 2, top + 0.06, world.z);
          mesh.rotation.set(roll * 5, roll * 7, roll * 3);
          mesh.castShadow = true;
          this.group.add(mesh);
        } else if (roll < 0.26) {
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
      // Leave the board footprint itself clear.
      if (
        Math.abs(x) < state.width / 2 + 0.6 &&
        Math.abs(z) < state.height / 2 + 0.6
      ) {
        continue;
      }
      if (pick < 0.4) {
        const mesh = new THREE.Mesh(rockGeometry, darkStoneMaterial);
        mesh.position.set(x, -1.68, z);
        mesh.scale.setScalar(0.7 + pick * 3);
        mesh.rotation.set(rx * 4, rz * 5, rx * 3);
        mesh.castShadow = true;
        this.group.add(mesh);
      } else if (pick < 0.72) {
        const mesh = new THREE.Mesh(scrubGeometry, scrubMaterial);
        mesh.position.set(x, -1.48, z);
        mesh.scale.setScalar(0.6 + rz * 1.4);
        mesh.rotation.set(0, rx * 6, 0);
        mesh.castShadow = true;
        this.group.add(mesh);
      }
    }
  }

  private track(
    geometry: THREE.BufferGeometry | null,
    ...materials: THREE.Material[]
  ): void {
    if (geometry) this.disposables.push(geometry);
    for (const material of materials) this.disposables.push(material);
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables = [];
    this.group.clear();
  }
}
