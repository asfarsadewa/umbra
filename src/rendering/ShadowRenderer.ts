import * as THREE from "three";
import { computeIlluminationDepths } from "../game/shadows";
import { Direction, Rules } from "../game/types";
import { Board } from "../world/Board";
import { gridToWorld, WorldLayout } from "./coords";
import { selectShadowDecals, shadowFeather } from "./shadowDecals";
import { Theme } from "./themes";

/**
 * Paints the illumination field onto the floor.
 *
 * Two tiers are drawn from one merged mesh, distinguished by more than colour
 * (Penumbra spec §27): full shadow is a deep, opaque decal, while partial shadow
 * is lighter and **stippled** with an ordered dither, so light / penumbra / umbra
 * stay readable in grayscale and at a glance. The per-caster sweep is preserved.
 */

const VERTEX = /* glsl */ `
  attribute vec2 aUv;
  attribute vec4 aFeather;
  attribute float aDepth;
  attribute float aReveal;
  attribute float aTier;      // 1 = umbra, 2 = penumbra
  varying vec2 vUv;
  varying vec4 vFeather;
  varying float vDepth;
  varying float vReveal;
  varying float vTier;
  varying vec2 vWorld;
  void main() {
    vUv = aUv;
    vFeather = aFeather;
    vDepth = aDepth;
    vReveal = aReveal;
    vTier = aTier;
    vWorld = vec2(position.x, position.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;        // umbra
  uniform vec3 uPenumbra;     // partial shadow
  uniform float uOpacity;     // umbra
  uniform float uPenumbraOpacity;
  uniform float uReveal;
  uniform float uSoftness;
  varying vec2 vUv;
  varying vec4 vFeather;
  varying float vDepth;
  varying float vReveal;
  varying float vTier;
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

  // 4x4 ordered dither, so the half-light reads as a screen of light.
  float bayer4(vec2 p) {
    vec2 f = floor(mod(p, 4.0));
    int x = int(f.x);
    int y = int(f.y);
    int index = x + y * 4;
    float m[16];
    m[0] = 0.0;  m[1] = 8.0;  m[2] = 2.0;  m[3] = 10.0;
    m[4] = 12.0; m[5] = 4.0;  m[6] = 14.0; m[7] = 6.0;
    m[8] = 3.0;  m[9] = 11.0; m[10] = 1.0; m[11] = 9.0;
    m[12] = 15.0; m[13] = 7.0; m[14] = 13.0; m[15] = 5.0;
    float v = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i == index) v = m[i];
    }
    return v / 16.0;
  }

  void main() {
    bool penumbra = vTier > 1.5;
    float soft = penumbra ? uSoftness * 1.9 : uSoftness;
    float a = edgeAlpha(vUv, vFeather, soft);
    a *= mix(1.0, 0.62, clamp(vDepth, 0.0, 1.0));
    a *= smoothstep(vReveal, vReveal + 0.2, uReveal);
    a *= 0.93 + 0.07 * hash(floor(vWorld * 2.5));

    vec3 col;
    if (penumbra) {
      // Stipple: roughly half the pixels lighten, so the tier is unmistakable.
      float d = bayer4(vWorld * 4.0);
      a *= uPenumbraOpacity * mix(0.35, 1.0, d);
      col = mix(uPenumbra, uPenumbra * 1.1, clamp(vDepth, 0.0, 1.0));
    } else {
      a *= uOpacity;
      col = mix(uColor, uColor * 1.18, clamp(vDepth, 0.0, 1.0));
    }

    if (a < 0.004) discard;
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

const FLOOR_SHADOW_Y = 0.018;
/** Above the low-stone mesh (0.119 tall) so its decal is never hidden. */
const STONE_SHADOW_Y = 0.135;

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
        uPenumbra: { value: new THREE.Color(0x5a6377) },
        uOpacity: { value: 0.56 },
        uPenumbraOpacity: { value: 0.4 },
        uReveal: { value: 1.2 },
        uSoftness: { value: 0.18 },
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

  /** Static contact occlusion around casters. Rebuilt per level. */
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
      for (const index of order) positions.push(quad[index][0], 0.014, quad[index][1]);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    };

    // Only isolated casters get a soft contact pool; walls are handled as a
    // per-tile ambient-occlusion tint by the board renderer.
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

  applyInstant(
    board: Board,
    sun: Direction,
    theme: Theme,
    layout: WorldLayout,
    rules: Rules,
  ): void {
    this.layout = layout;
    this.build(board, sun, theme, rules);
    this.material.uniforms.uReveal.value = 1.4;
    this.animating = false;
    this.elapsed = 0;
  }

  sweep(
    board: Board,
    sun: Direction,
    theme: Theme,
    duration = 0.42,
    rules: Rules = "umbra",
  ): void {
    this.duration = duration;
    this.build(board, sun, theme, rules);
    this.material.uniforms.uReveal.value = -0.25;
    this.elapsed = 0;
    this.animating = true;
  }

  private build(board: Board, sun: Direction, theme: Theme, rules: Rules): void {
    this.material.uniforms.uColor.value.set(theme.shadow);
    this.material.uniforms.uOpacity.value = theme.shadowOpacity;
    this.material.uniforms.uPenumbra.value.set(theme.penumbraShadow);
    this.material.uniforms.uPenumbraOpacity.value = theme.penumbraOpacity;
    this.material.uniforms.uSoftness.value = 0.18;

    const field = computeIlluminationDepths(board, sun, rules);
    let maxDepth = 1;
    for (const tile of field.values()) maxDepth = Math.max(maxDepth, tile.depth);

    const positions: number[] = [];
    const feather: number[] = [];
    const uv: number[] = [];
    const depthAttr: number[] = [];
    const revealAttr: number[] = [];
    const tierAttr: number[] = [];

    for (const decal of selectShadowDecals(board, field)) {
      const world = gridToWorld(this.layout, decal.x, decal.y);
      const f = shadowFeather(field, decal.x, decal.y, sun);
      // Low stones get their decal raised onto the stone's top surface.
      const y = decal.stone ? STONE_SHADOW_Y : FLOOR_SHADOW_Y;
      const normalizedDepth = Math.min(1, decal.depth / maxDepth);
      const tier = decal.tier === "penumbra" ? 2 : 1;
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
        tierAttr.push(tier);
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
    geometry.setAttribute("aTier", new THREE.Float32BufferAttribute(tierAttr, 1));
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
