import * as THREE from "three";
import {
  CameraPresetId,
  DEFAULT_CAMERA,
  getCameraPreset,
} from "./cameraPresets";

/**
 * Orthographic diorama camera. Frames the board automatically and never rotates
 * arbitrarily, keeping shadow geometry readable.
 */
export class CameraController {
  readonly camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 240);
  private readonly target = new THREE.Vector3(0, 0, 0);
  private readonly direction: THREE.Vector3;
  private readonly desiredDirection: THREE.Vector3;
  private extent = 10;
  private distance = 26;
  private drift = 0;
  private sway = 0;
  private lastTime = 0;

  constructor() {
    this.camera.up.set(0, 1, 0);
    const [x, y, z] = getCameraPreset(DEFAULT_CAMERA).direction;
    this.direction = new THREE.Vector3(x, y, z).normalize();
    this.desiredDirection = this.direction.clone();
  }

  get boardExtent(): number {
    return this.extent;
  }

  get cameraDistance(): number {
    return this.distance;
  }

  setPreset(id: CameraPresetId): void {
    const [x, y, z] = getCameraPreset(id).direction;
    this.desiredDirection.set(x, y, z).normalize();
  }

  /** Amplitude of the idle breathing motion (0 during active puzzle play). */
  setSway(amount: number): void {
    this.sway = amount;
  }

  /** Slow orbital drift in radians/second (title screen only). */
  setDrift(speed: number): void {
    this.drift = speed;
  }

  fit(width: number, height: number, aspect: number): void {
    this.focus(Math.max(width, height) + 3.2, aspect, 0.2);
  }

  focus(extent: number, aspect: number, targetY = 0): void {
    this.extent = extent;
    this.distance = extent * 2.6;
    this.target.set(0, targetY, 0);
    this.applyFrustum(aspect);
    this.update(0);
  }

  update(time: number): void {
    const dt = Math.min(Math.max(time - this.lastTime, 0), 0.1);
    this.lastTime = time;
    this.direction.lerp(this.desiredDirection, Math.min(1, dt * 4.5)).normalize();

    const angle = this.drift * time;
    const direction = this.direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const s = this.sway;
    this.camera.position.set(
      this.target.x + direction.x * this.distance + Math.sin(time * 0.23) * s,
      this.target.y + direction.y * this.distance + Math.sin(time * 0.17) * s * 0.5,
      this.target.z + direction.z * this.distance + Math.cos(time * 0.2) * s,
    );
    this.camera.lookAt(this.target);
  }

  resize(aspect: number): void {
    this.applyFrustum(aspect);
  }

  private applyFrustum(aspect: number): void {
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const size = this.extent;
    let viewWidth: number;
    let viewHeight: number;
    if (safeAspect >= 1) {
      viewHeight = size;
      viewWidth = size * safeAspect;
    } else {
      viewWidth = size;
      viewHeight = size / safeAspect;
    }
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
  }
}
