import * as THREE from "three";
import { Direction, SUN_VECTORS } from "../game/types";
import { Theme } from "./themes";

/** Azimuth (radians) in world XZ for a sun direction. */
export function sunAzimuth(sun: Direction): number {
  const v = SUN_VECTORS[sun];
  return Math.atan2(v.x, v.y);
}

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.22, "rgba(255,235,190,0.85)");
    gradient.addColorStop(0.5, "rgba(255,200,120,0.32)");
    gradient.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function shortestDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * The lighting rig. It owns the key light and the visible sun, and sweeps both
 * around the board when the sun changes. It never touches simulation state.
 */
export class SunRig {
  readonly group = new THREE.Group();
  readonly key: THREE.DirectionalLight;

  private readonly target = new THREE.Object3D();
  private readonly marker = new THREE.Group();
  private readonly markerCore: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly markerHalo: THREE.Sprite;
  private readonly markerHaloMaterial: THREE.SpriteMaterial;
  private readonly texture: THREE.Texture;
  private theme: Theme | null = null;

  private angle: number;
  private desiredAngle: number;
  private startAngle: number;
  private elapsed = 0;
  private duration = 0.42;
  private animating = false;
  private extent = 8;

  constructor(initialSun: Direction = "N") {
    this.group.name = "SunRig";
    this.angle = sunAzimuth(initialSun);
    this.desiredAngle = this.angle;
    this.startAngle = this.angle;

    this.key = new THREE.DirectionalLight(0xfff0cc, 2);
    this.group.add(this.key);
    this.group.add(this.target);
    this.key.target = this.target;

    const fill = new THREE.DirectionalLight(0xa8bcd8, 0.32);
    fill.position.set(-4, 3, -4);
    this.group.add(fill);

    this.texture = glowTexture();
    this.markerHaloMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      color: 0xffdf9c,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.markerHalo = new THREE.Sprite(this.markerHaloMaterial);
    this.markerHalo.scale.setScalar(3.2);
    this.marker.add(this.markerHalo);

    const coreGeometry = new THREE.SphereGeometry(0.24, 20, 16);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff4da,
      emissive: 0xffce7a,
      emissiveIntensity: 3.4,
      roughness: 0.3,
    });
    this.markerCore = new THREE.Mesh(coreGeometry, coreMaterial);
    this.marker.add(this.markerCore);

    this.group.add(this.marker);
  }

  applyTheme(theme: Theme, width: number, height: number): void {
    this.theme = theme;
    this.extent = Math.max(width, height);
    this.key.color.set(theme.sun);
    this.key.intensity = theme.sunIntensity;
    this.markerHaloMaterial.color.set(theme.sunMarker);
    this.markerCore.material.color.set(theme.sunMarker);
    this.markerCore.material.emissive.set(theme.sunMarkerGlow);
    this.layout();
  }

  /** Snap the rig to a sun direction without animation (level load). */
  setImmediate(sun: Direction): void {
    this.angle = sunAzimuth(sun);
    this.desiredAngle = this.angle;
    this.animating = false;
    this.elapsed = 0;
    this.layout();
  }

  /** Sweep the sun to a new direction. Returns the sweep duration in seconds. */
  sweepTo(sun: Direction, duration = 0.42): number {
    this.startAngle = this.angle;
    this.desiredAngle = sunAzimuth(sun);
    this.duration = duration;
    this.elapsed = 0;
    this.animating = true;
    return duration;
  }

  get isAnimating(): boolean {
    return this.animating;
  }

  update(dt: number): void {
    if (!this.animating) return;
    this.elapsed += dt;
    const t = Math.min(this.elapsed / this.duration, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.angle = this.startAngle + shortestDelta(this.startAngle, this.desiredAngle) * eased;
    if (t >= 1) {
      this.angle = this.desiredAngle;
      this.animating = false;
    }
    this.layout();
  }

  /** Idle glow. Presentation only. */
  updateIdle(time: number): void {
    if (!this.theme) return;
    this.markerHaloMaterial.opacity = 0.85 + Math.sin(time * 1.4) * 0.1;
    this.markerHalo.scale.setScalar(3.0 + Math.sin(time * 1.1) * 0.25);
    this.markerCore.material.emissiveIntensity = 3.0 + Math.sin(time * 1.6) * 0.5;
  }

  private layout(): void {
    const span = this.extent + 4;
    const lightDistance = span * 1.15;
    const lightHeight = span * 1.05;
    this.key.position.set(
      Math.sin(this.angle) * lightDistance,
      lightHeight,
      Math.cos(this.angle) * lightDistance,
    );
    this.target.position.set(0, 0, 0);

    const edge = this.extent / 2 + 1.6;
    this.marker.position.set(
      Math.sin(this.angle) * edge,
      0.85,
      Math.cos(this.angle) * edge,
    );
  }

  dispose(): void {
    this.texture.dispose();
    this.markerCore.geometry.dispose();
    this.markerCore.material.dispose();
    this.markerHaloMaterial.dispose();
  }
}
