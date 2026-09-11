import * as THREE from "three";

function softDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.4)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Dust suspended in the light. Slow, sparse, and deliberately subtle — it adds
 * depth without ever competing with the shadow geometry.
 */
export class Particles {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly count: number;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly texture: THREE.Texture;
  private extent = 8;

  constructor(count = 240) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * this.extent * 2;
      this.positions[i * 3 + 1] = Math.random() * 4.2;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.extent * 2;
      this.speeds[i] = 0.03 + Math.random() * 0.1;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.texture = softDotTexture();
    this.material = new THREE.PointsMaterial({
      color: 0xffeac6,
      size: 0.075,
      map: this.texture,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  setTheme(color: number, extent: number, opacity = 0.4): void {
    this.material.color.set(color);
    this.material.opacity = opacity;
    this.extent = Math.max(extent, 4);
  }

  update(dt: number, time: number): void {
    const positions = this.positions;
    for (let i = 0; i < this.count; i++) {
      const iy = i * 3 + 1;
      positions[iy] += this.speeds[i] * dt;
      positions[i * 3] += Math.sin(time * 0.18 + i) * dt * 0.045;
      if (positions[iy] > 4.3) {
        positions[iy] = -0.2;
        positions[i * 3] = (Math.random() - 0.5) * this.extent * 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * this.extent * 2;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
