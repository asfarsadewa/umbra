import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

/**
 * The AI-authored models (gpt-image-2.5-sunburst -> fal Hunyuan 3D 3.1 Pro ->
 * Blender prep/rig). They are loaded once and handed out as cheap clones; if
 * any of them are missing the renderers fall back to their procedural
 * primitives, so the game never hard-fails on an absent asset.
 */
const MODEL_FILES = {
  shade: "models/shade.glb",
  pillar: "models/pillar.glb",
  stone: "models/stone.glb",
  grave: "models/grave.glb",
  rubble: "models/rubble.glb",
  title: "models/title.glb",
} as const;

export type ModelName = keyof typeof MODEL_FILES;

interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export class AssetLoader {
  private readonly loader = new GLTFLoader();
  private readonly models = new Map<ModelName, LoadedModel>();
  loaded = false;

  /** Loads every model that is present; missing files are simply skipped. */
  async loadAll(): Promise<void> {
    const base = import.meta.env.BASE_URL ?? "./";
    await Promise.all(
      (Object.keys(MODEL_FILES) as ModelName[]).map(async (name) => {
        try {
          const gltf = await this.loader.loadAsync(`${base}${MODEL_FILES[name]}`);
          gltf.scene.name = name;
          this.models.set(name, {
            scene: gltf.scene,
            animations: gltf.animations ?? [],
          });
        } catch {
          // Fall back to the procedural primitive for this model.
        }
      }),
    );
    this.loaded = true;
  }

  has(name: ModelName): boolean {
    return this.models.has(name);
  }

  /** A fresh clone of a whole model, with skeletons rebound. */
  instance(name: ModelName): THREE.Object3D | null {
    const loaded = this.models.get(name);
    if (!loaded) return null;
    return SkeletonUtils.clone(loaded.scene);
  }

  animations(name: ModelName): THREE.AnimationClip[] {
    return this.models.get(name)?.animations ?? [];
  }

  names(): ModelName[] {
    return Object.keys(MODEL_FILES) as ModelName[];
  }
}

/**
 * Clone a model's materials onto a fresh set, so each instance can be tinted
 * independently without leaking into the shared source.
 */
export function styleModel(
  root: THREE.Object3D,
  configure: (material: THREE.MeshStandardMaterial) => void,
  sink: Array<THREE.Material | THREE.BufferGeometry>,
): void {
  const seen = new Map<THREE.Material, THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (!material) return;
    let copy = seen.get(material);
    if (!copy) {
      const cloned = material.clone();
      configure(cloned);
      seen.set(material, cloned);
      sink.push(cloned);
      copy = cloned;
    }
    mesh.material = copy;
  });
}

/** Measure a model and return the scalar needed to reach a target height. */
export function scaleToHeight(
  root: THREE.Object3D,
  targetHeight: number,
): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 1e-5 ? targetHeight / size.y : 1;
  root.scale.setScalar(scale);
  const scaled = new THREE.Box3().setFromObject(root);
  const center = scaled.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaled.min.y;
}
