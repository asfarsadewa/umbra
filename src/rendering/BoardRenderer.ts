import * as THREE from "three";
import { GameState } from "../game/types";
import { AssetLoader, styleModel } from "./AssetLoader";
import { gridToWorld, hash2d, TILE_SIZE, WorldLayout } from "./coords";
import { MODEL_BASE, modelTint, Theme } from "./themes";

const TILE_GEOMETRY = new THREE.BoxGeometry(TILE_SIZE * 0.998, 1, TILE_SIZE * 0.998);

/**
 * Builds the static diorama for a board. Rebuilt whenever a level loads.
 * Nothing here mutates game state.
 */
export class BoardRenderer {
  readonly group = new THREE.Group();
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private graveRings: THREE.Mesh[] = [];
  private gravePools: THREE.Mesh[] = [];
  private layout: WorldLayout = { width: 1, height: 1 };

  constructor() {
    this.group.name = "Board";
  }

  build(state: GameState, theme: Theme, assets?: AssetLoader): void {
    this.dispose();
    this.layout = { width: state.width, height: state.height };

    this.buildBase(state, theme);
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const world = gridToWorld(this.layout, x, y);
        const variation = hash2d(x, y);
        switch (state.board.tileAt(x, y)) {
          case "Floor":
            this.addFloor(world.x, world.z, variation, theme);
            break;
          case "Wall":
            this.addWall(world.x, world.z, x, y, theme);
            break;
          case "Void":
            this.addVoid(world.x, world.z, variation, theme);
            break;
          case "Grave":
            this.addFloor(world.x, world.z, variation, theme);
            this.addGrave(world.x, world.z, theme, assets);
            break;
        }
      }
    }
  }

  private buildBase(state: GameState, theme: Theme): void {
    const width = state.width * TILE_SIZE;
    const height = state.height * TILE_SIZE;

    const plinthGeometry = new THREE.BoxGeometry(width + 0.7, 1.5, height + 0.7);
    const plinthMaterial = new THREE.MeshStandardMaterial({
      color: theme.base,
      roughness: 0.96,
      metalness: 0,
    });
    this.track(plinthGeometry, plinthMaterial);
    const plinth = new THREE.Mesh(plinthGeometry, plinthMaterial);
    plinth.position.y = -1.0;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // A wide sand tabletop so the diorama reads as an object in a landscape.
    const groundGeometry = new THREE.PlaneGeometry(width * 8, height * 8);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: theme.ground,
      roughness: 1,
      metalness: 0,
    });
    this.track(groundGeometry, groundMaterial);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.78;
    ground.receiveShadow = true;
    this.group.add(ground);

    // A paved bed just under the tiles, so the grout lines read as mortar
    // rather than as dark trenches.
    const bedGeometry = new THREE.PlaneGeometry(width + 0.2, height + 0.2);
    const bedMaterial = new THREE.MeshStandardMaterial({
      color: theme.floorEdge,
      roughness: 0.98,
      metalness: 0,
    });
    this.track(bedGeometry, bedMaterial);
    const bed = new THREE.Mesh(bedGeometry, bedMaterial);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = -0.22;
    bed.receiveShadow = true;
    this.group.add(bed);
  }

  private addFloor(x: number, z: number, variation: number, theme: Theme): void {
    const height = 0.26;
    const material = new THREE.MeshStandardMaterial({
      color: variation > 0.5 ? theme.floorAlt : theme.floor,
      roughness: 0.97,
      metalness: 0,
    });
    this.track(null, material);
    const mesh = new THREE.Mesh(TILE_GEOMETRY, material);
    mesh.scale.y = height;
    mesh.position.set(x, -height / 2, z);
    mesh.rotation.y = (variation - 0.5) * 0.05;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
  }

  private addWall(
    x: number,
    z: number,
    gx: number,
    gy: number,
    theme: Theme,
  ): void {
    const variation = hash2d(gx * 5 + 1, gy * 3 + 7);
    const height = 0.95 + variation * 0.35;
    const material = new THREE.MeshStandardMaterial({
      color: theme.wall,
      roughness: 0.94,
      metalness: 0,
    });
    this.track(null, material);
    const mesh = new THREE.Mesh(TILE_GEOMETRY, material);
    mesh.scale.y = height;
    mesh.position.set(x, -0.3 + height / 2, z);
    mesh.rotation.y = (variation - 0.5) * 0.16;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const capMaterial = new THREE.MeshStandardMaterial({
      color: theme.wallTop,
      roughness: 0.9,
    });
    this.track(null, capMaterial);
    const capGeometry = new THREE.BoxGeometry(TILE_SIZE * 0.92, 0.09, TILE_SIZE * 0.92);
    this.track(capGeometry, null);
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.set(x, -0.3 + height + 0.02, z);
    cap.rotation.y = mesh.rotation.y;
    cap.castShadow = true;
    cap.receiveShadow = true;
    this.group.add(cap);
  }

  private addVoid(x: number, z: number, variation: number, theme: Theme): void {
    const material = new THREE.MeshStandardMaterial({
      color: theme.void,
      roughness: 1,
      metalness: 0.08,
      emissive: theme.voidGlow,
      emissiveIntensity: 0.05 + variation * 0.05,
    });
    this.track(null, material);
    const mesh = new THREE.Mesh(TILE_GEOMETRY, material);
    mesh.scale.set(0.9, 0.14, 0.9);
    mesh.position.set(x, -0.58, z);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private addGrave(x: number, z: number, theme: Theme, assets?: AssetLoader): void {
    const model = assets?.instance("grave");
    if (model) {
      const tint = modelTint(MODEL_BASE.grave, theme.floorAlt);
      styleModel(
        model,
        (material) => {
          material.color.multiply(tint);
          material.metalness = 0;
          material.roughness = 0.85;
        },
        this.disposables,
      );
      model.position.set(x, 0, z);
      this.group.add(model);
      return;
    }
    // A dark carved aperture descending underground, ringed by a stone lip.
    const poolGeometry = new THREE.CircleGeometry(0.38, 32);
    const poolMaterial = new THREE.MeshStandardMaterial({
      color: theme.grave,
      roughness: 0.75,
      metalness: 0.02,
      emissive: theme.graveGlow,
      emissiveIntensity: 0.02,
      side: THREE.DoubleSide,
    });
    this.track(poolGeometry, poolMaterial);
    const pool = new THREE.Mesh(poolGeometry, poolMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.012, z);
    this.group.add(pool);
    this.gravePools.push(pool);

    const ringGeometry = new THREE.RingGeometry(0.38, 0.47, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: theme.floorEdge,
      roughness: 0.85,
      metalness: 0,
      emissive: theme.graveGlow,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });
    this.track(ringGeometry, ringMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    this.group.add(ring);
    this.graveRings.push(ring);
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    for (let i = 0; i < this.graveRings.length; i++) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 1.4);
      (this.graveRings[i].material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.18 + pulse * 0.16;
    }
    for (let i = 0; i < this.gravePools.length; i++) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 1.4);
      (this.gravePools[i].material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.04 + pulse * 0.08;
    }
  }

  private track(
    geometry: THREE.BufferGeometry | null,
    material: THREE.Material | null,
  ): void {
    if (geometry) this.disposables.push(geometry);
    if (material) this.disposables.push(material);
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables = [];
    this.graveRings = [];
    this.gravePools = [];
    this.group.clear();
  }
}
