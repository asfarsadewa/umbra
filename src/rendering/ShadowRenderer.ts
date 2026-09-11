import * as THREE from "three";
import { computeShadowDepths } from "../game/shadows";
import { Direction } from "../game/types";
import { Board } from "../world/Board";
import { gridToWorld, WorldLayout } from "./coords";
import { selectShadowDecals, shadowFeather } from "./shadowDecals";
import { Theme } from "./themes";

/**
 * Draws the authoritative logical shadow onto the floor.
 *
 * The simulation owns shadow truth (SPEC §6); this renderer paints exactly the
 * tiles it reports. One merged mesh carries every shadowed tile, with per-vertex
 * data so the shadow has a soft outer boundary, darkens toward its caster and
 * fades toward its far end, and sweeps outward when the sun changes.
 *
 * A second, static layer adds soft contact occlusion around walls and casters so
 * objects sit in the courtyard instead of floating on it.
 */

const VERTEX = /* glsl */ `
  attribute vec2 aUv;
  attribute vec4 aFeather;
  attribute float aDepth;
  attribute float aReveal;
  varying vec2 vUv;
  varying vec4 vFeather;
  varying float vDepth;
  varying float vReveal;
  varying vec2 vWorld;
  void main() {
    vUv = aUv;
    vFeather = aFeather;
    vDepth = aDepth;
    vReveal = aReveal;
    vWorld = vec2(position.x, position.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uSoftness;
  varying vec2 vUv;
  varying vec4 vFeather;
  varying float vDepth;
  varying float vReveal;
  varying vec2 vWorld;

  float edgeAlpha(vec2 uv, vec4 f, float soft) {
    float a = 1.0;
    if (f.x > 0.5) a *= smoothstep(0.0, soft, uv.x);
    if (f.y > 0.5) a *= smoothstep(0.0, soft, 1.0 - uv.x);
    if (f.z > 0.5) a *= smoothstep(0.0, soft, uv.y);
    if (f.w > 0.5) a *= smoothstep(0.0, soft, 1.0 - uv.y);
    return a;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float a = edgeAlpha(vUv, vFeather, uSoftness);
    // Darker near the caster, softer and lighter toward the far end.
    a *= mix(1.0, 0.62, clamp(vDepth, 0.0, 1.0));
    // The sweep: tiles reveal in order of distance from their caster.
    a *= smoothstep(vReveal, vReveal + 0.2, uReveal);
    // A whisper of grain so the shadow is not a flat vector fill.
    a *= 0.93 + 0.07 * hash(floor(vWorld * 2.5));
    a *= uOpacity;
    if (a < 0.004) discard;
    vec3 col = mix(uColor, uColor * 1.18, clamp(vDepth, 0.0, 1.0));
    gl_FragColor = vec4(col, a);
  }
`;

const CONTACT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLOOR_SHADOW_Y = 0.018;
/** Above the low-stone mesh (0.119 tall) so its shadow is never hidden. */
const STONE_SHADOW_Y = 0.135;

const CONTACT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float a = (1.0 - smoothstep(0.16, 0.5, d)) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class ShadowRenderer {
  readonly group = new THREE.Group();
  private layout: WorldLayout = { width: 1, height: 1 };
  private readonly material: THREE.ShaderMaterial;
  private readonly contactMaterial: THREE.ShaderMaterial;
  private readonly contactGeometry: THREE.BufferGeometry;
  private readonly contactMesh: THREE.Mesh;
  private shadowMesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private elapsed = 0;
  private duration = 0.42;
  private animating = false;

  constructor() {
    this.group.name = "Shadows";

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(0x161c2b) },
        uOpacity: { value: 0.56 },
        uReveal: { value: 1.2 },
        uSoftness: { value: 0.2 },
      },
    });
    this.material.toneMapped = false;

    this.contactMaterial = new THREE.ShaderMaterial({
      vertexShader: CONTACT_VERTEX,
      fragmentShader: CONTACT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(0x1a1f2c) },
        uOpacity: { value: 0.22 },
      },
    });
    this.contactMaterial.toneMapped = false;

    this.contactGeometry = new THREE.BufferGeometry();
    this.contactMesh = new THREE.Mesh(this.contactGeometry, this.contactMaterial);
    this.contactMesh.renderOrder = 1;
    this.group.add(this.contactMesh);
  }

  /** Static contact occlusion around walls and casters. Rebuilt per level. */
  buildContact(board: Board, theme: Theme, layout: WorldLayout): void {
    this.layout = layout;
    this.contactMaterial.uniforms.uColor.value.set(theme.shadow);
    this.contactMaterial.uniforms.uOpacity.value = Math.min(
      0.34,
      theme.shadowOpacity * 0.45,
    );

    const positions: number[] = [];
    const uvs: number[] = [];
    const add = (wx: number, wz: number, size: number) => {
      const h = size / 2;
      const quad = [
        [wx - h, wz - h],
        [wx + h, wz - h],
        [wx + h, wz + h],
        [wx - h, wz + h],
      ];
      const order = [0, 1, 2, 0, 2, 3];
      for (const index of order) {
        positions.push(quad[index][0], 0.014, quad[index][1]);
      }
      uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    };

    // Only isolated casters get a soft contact pool; walls are handled as a
    // per-tile ambient-occlusion tint by the board renderer, which avoids
    // overlapping pools along a wall run.
    for (const caster of board.casters) {
      const world = gridToWorld(layout, caster.position.x, caster.position.y);
      add(world.x, world.z, caster.kind === "pillar" ? 1.5 : 1.2);
    }

    this.contactGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    this.contactGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    this.contactGeometry.computeBoundingSphere();
  }

  applyInstant(board: Board, sun: Direction, theme: Theme, layout: WorldLayout): void {
    this.layout = layout;
    this.build(board, sun, theme);
    this.material.uniforms.uReveal.value = 1.4;
    this.animating = false;
    this.elapsed = 0;
  }

  sweep(board: Board, sun: Direction, theme: Theme, duration = 0.42): void {
    this.duration = duration;
    this.build(board, sun, theme);
    this.material.uniforms.uReveal.value = -0.25;
    this.elapsed = 0;
    this.animating = true;
  }

  private build(board: Board, sun: Direction, theme: Theme): void {
    this.material.uniforms.uColor.value.set(theme.shadow);
    this.material.uniforms.uOpacity.value = theme.shadowOpacity;
    this.material.uniforms.uSoftness.value = 0.18;

    const depths = computeShadowDepths(board, sun);
    let maxDepth = 1;
    for (const depth of depths.values()) maxDepth = Math.max(maxDepth, depth);

    const positions: number[] = [];
    const feather: number[] = [];
    const uv: number[] = [];
    const depthAttr: number[] = [];
    const revealAttr: number[] = [];

    for (const decal of selectShadowDecals(board, depths)) {
      const world = gridToWorld(this.layout, decal.x, decal.y);
      const f = shadowFeather(depths, decal.x, decal.y, sun);
      // Low stones get their decal raised onto the stone's top surface.
      const y = decal.stone ? STONE_SHADOW_Y : FLOOR_SHADOW_Y;
      const normalizedDepth = Math.min(1, decal.depth / maxDepth);
      const corners = [
        [world.x - 0.5, world.z - 0.5, 0, 0],
        [world.x + 0.5, world.z - 0.5, 1, 0],
        [world.x + 0.5, world.z + 0.5, 1, 1],
        [world.x - 0.5, world.z - 0.5, 0, 0],
        [world.x + 0.5, world.z + 0.5, 1, 1],
        [world.x - 0.5, world.z + 0.5, 0, 1],
      ];
      for (const [cx, cz, u, v] of corners) {
        positions.push(cx, y, cz);
        uv.push(u, v);
        feather.push(f[0], f[1], f[2], f[3]);
        depthAttr.push(normalizedDepth);
        revealAttr.push(normalizedDepth);
      }
    }

    if (this.shadowMesh) {
      this.group.remove(this.shadowMesh);
      this.geometry?.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aUv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute("aFeather", new THREE.Float32BufferAttribute(feather, 4));
    geometry.setAttribute("aDepth", new THREE.Float32BufferAttribute(depthAttr, 1));
    geometry.setAttribute("aReveal", new THREE.Float32BufferAttribute(revealAttr, 1));
    geometry.computeBoundingSphere();
    this.geometry = geometry;

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.renderOrder = 2;
    this.group.add(mesh);
    this.shadowMesh = mesh;
  }

  update(dt: number): void {
    if (!this.animating) return;
    this.elapsed += dt;
    const t = Math.min(this.elapsed / this.duration, 1);
    this.material.uniforms.uReveal.value = -0.25 + t * 1.65;
    if (t >= 1) {
      this.material.uniforms.uReveal.value = 1.4;
      this.animating = false;
    }
  }

  get isAnimating(): boolean {
    return this.animating;
  }

  dispose(): void {
    this.geometry?.dispose();
    this.contactGeometry.dispose();
    this.material.dispose();
    this.contactMaterial.dispose();
    this.group.clear();
  }
}
