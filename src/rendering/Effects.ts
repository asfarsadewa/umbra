import * as THREE from "three";
import { Position } from "../game/types";
import { WorldLayout } from "./coords";

interface EffectItem {
  object: THREE.Object3D;
  age: number;
  life: number;
  update: (object: THREE.Object3D, t: number) => void;
  dispose: () => void;
}

/**
 * Short-lived cosmetic effects: dust puffs, burial rings, sunset washes.
 * Nothing here affects simulation.
 */
export class Effects {
  readonly group = new THREE.Group();
  private items: EffectItem[] = [];
  private layout: WorldLayout = { width: 1, height: 1 };

  constructor() {
    this.group.name = "Effects";
  }

  setLayout(layout: WorldLayout): void {
    this.layout = layout;
  }

  private toWorld(position: Position): { x: number; z: number } {
    return {
      x: position.x - (this.layout.width - 1) / 2,
      z: position.y - (this.layout.height - 1) / 2,
    };
  }

  dustPuff(position: Position, color: number): void {
    const world = this.toWorld(position);
    const geometry = new THREE.RingGeometry(0.12, 0.22, 20);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(world.x, 0.04, world.z);
    this.group.add(ring);
    this.add({
      object: ring,
      life: 0.55,
      update: (object, t) => {
        const mesh = object as THREE.Mesh;
        mesh.scale.setScalar(1 + t * 2.4);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - t);
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  burial(position: Position, glow: number): void {
    const world = this.toWorld(position);
    const ringGeometry = new THREE.RingGeometry(0.18, 0.44, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: glow,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(world.x, 0.05, world.z);
    this.group.add(ring);
    this.add({
      object: ring,
      life: 1.1,
      update: (object, t) => {
        const mesh = object as THREE.Mesh;
        mesh.scale.setScalar(0.6 + t * 1.6);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
      },
      dispose: () => {
        ringGeometry.dispose();
        ringMaterial.dispose();
      },
    });

    // A rising column of dust.
    const columnGeometry = new THREE.CylinderGeometry(0.28, 0.16, 1.6, 18, 1, true);
    const columnMaterial = new THREE.MeshBasicMaterial({
      color: glow,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const column = new THREE.Mesh(columnGeometry, columnMaterial);
    column.position.set(world.x, 0.8, world.z);
    this.group.add(column);
    this.add({
      object: column,
      life: 1.0,
      update: (object, t) => {
        const mesh = object as THREE.Mesh;
        mesh.position.y = 0.8 + t * 0.5;
        mesh.scale.set(1 + t * 0.6, 1 - t * 0.4, 1 + t * 0.6);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.16 * (1 - t);
      },
      dispose: () => {
        columnGeometry.dispose();
        columnMaterial.dispose();
      },
    });
  }

  sunsetFlash(): void {
    const geometry = new THREE.PlaneGeometry(60, 60);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff5a1e,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: false,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 1.5;
    plane.renderOrder = 999;
    this.group.add(plane);
    this.add({
      object: plane,
      life: 1.6,
      update: (object, t) => {
        const mesh = object as THREE.Mesh;
        // wash in quickly, then drain away
        const amount = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
        (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, amount) * 0.34;
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  private add(item: Omit<EffectItem, "age"> & { age?: number }): void {
    this.items.push({ ...item, age: item.age ?? 0 });
  }

  update(dt: number): void {
    const remaining: EffectItem[] = [];
    for (const item of this.items) {
      item.age += dt;
      const t = Math.min(item.age / item.life, 1);
      item.update(item.object, t);
      if (item.age >= item.life) {
        this.group.remove(item.object);
        item.dispose();
      } else {
        remaining.push(item);
      }
    }
    this.items = remaining;
  }

  clear(): void {
    for (const item of this.items) {
      this.group.remove(item.object);
      item.dispose();
    }
    this.items = [];
  }
}
