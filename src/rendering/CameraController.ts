import * as THREE from "three";
import {
  CameraPresetId,
  DEFAULT_CAMERA,
  getCameraPreset,
} from "./cameraPresets";

/**
 * Orthographic diorama camera. Frames the board automatically and never rotates
 * arbitrarily, keeping shadow geometry readable. Framing changes (gate -> title
 * -> level) ease over time so scene transitions are smooth.
 */
export class CameraController {
  readonly camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 240);
  private readonly target = new THREE.Vector3(0, 0, 0);
  private readonly direction: THREE.Vector3;
  private readonly desiredDirection: THREE.Vector3;
  private readonly up = new THREE.Vector3(0, 1, 0);

  private extent = 10;
  private desiredExtent = 10;
  private distance = 26;
  private desiredTargetY = 0;
  private aspect = 1;
  private focusSpeed = 3.2;

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

  setSway(amount: number): void {
    this.sway = amount;
  }

  setDrift(speed: number): void {
    this.drift = speed;
  }

  /** Seconds-ish speed for framing changes; larger is snappier. */
  setFocusSpeed(speed: number): void {
    this.focusSpeed = speed;
  }

  fit(width: number, height: number, aspect: number): void {
    this.focus(Math.max(width, height) + 3.2, aspect, 0.2, false);
  }

  /**
   * Frame an arbitrary extent, optionally aimed above the ground plane.
   * With `animate`, the framing eases from its current value instead of popping.
   */
  focus(extent: number, aspect: number, targetY = 0, animate = false): void {
    this.aspect = aspect;
    this.desiredExtent = extent;
    this.desiredTargetY = targetY;
    this.distance = extent * 2.6;
    if (!animate) {
      this.extent = extent;
      this.target.y = targetY;
      this.applyFrustum();
      this.update(0);
    }
  }

  update(time: number): void {
    const dt = Math.min(Math.max(time - this.lastTime, 0), 0.1);
    this.lastTime = time;

    this.extent += (this.desiredExtent - this.extent) * Math.min(1, dt * this.focusSpeed);
    this.distance = this.extent * 2.6;
    this.target.y += (this.desiredTargetY - this.target.y) * Math.min(1, dt * this.focusSpeed);
    this.applyFrustum();

    this.direction.lerp(this.desiredDirection, Math.min(1, dt * 4.5)).normalize();

    const angle = this.drift * time;
    const direction = this.direction.clone().applyAxisAngle(this.up, angle);
    const s = this.sway;
    this.camera.position.set(
      this.target.x + direction.x * this.distance + Math.sin(time * 0.23) * s,
      this.target.y + direction.y * this.distance + Math.sin(time * 0.17) * s * 0.5,
      this.target.z + direction.z * this.distance + Math.cos(time * 0.2) * s,
    );
    this.camera.lookAt(this.target);
  }

  resize(aspect: number): void {
    this.aspect = aspect;
    this.applyFrustum();
  }

  private applyFrustum(): void {
    const safeAspect = Number.isFinite(this.aspect) && this.aspect > 0 ? this.aspect : 1;
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
