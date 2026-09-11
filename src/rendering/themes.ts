/**
 * Visual themes. Everything here is purely cosmetic — the simulation never
 * reads a theme. UMBRA lives in one place: bleached Mediterranean stone under a
 * hard sun, with extremely dark Shades and deep, cool shadows.
 */
import * as THREE from "three";

export interface Theme {
  name: string;

  background: number;
  fog: number;

  ground: number;
  base: number;

  floor: number;
  floorAlt: number;
  floorEdge: number;

  wall: number;
  wallTop: number;

  void: number;
  voidGlow: number;

  grave: number;
  graveGlow: number;

  pillar: number;
  pillarTop: number;

  stone: number;
  stoneTop: number;

  shade: number;
  shadeRim: number;

  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;

  sun: number;
  sunIntensity: number;

  /** Colour of the logical (authoritative) shadow overlay. */
  shadow: number;
  shadowOpacity: number;

  dust: number;
  sunMarker: number;
  sunMarkerGlow: number;
}

const shadow: Theme = {
  name: "shadow",
  background: 0xc7b892,
  fog: 0xc7b892,
  ground: 0x8d8062,
  base: 0x6e6349,
  floor: 0xded2b4,
  floorAlt: 0xe9dfc6,
  floorEdge: 0xb0a384,
  wall: 0xab9c7a,
  wallTop: 0xc4b492,
  void: 0x211c14,
  voidGlow: 0x594e39,
  grave: 0x14110c,
  graveGlow: 0xc9b78f,
  pillar: 0xcabda0,
  pillarTop: 0xdfd2b4,
  stone: 0xb4a78a,
  stoneTop: 0xcabd9f,
  shade: 0x08080c,
  shadeRim: 0x9fb6d8,
  hemiSky: 0xfff3da,
  hemiGround: 0x574f3d,
  hemiIntensity: 0.72,
  sun: 0xfff0cc,
  sunIntensity: 2.15,
  shadow: 0x161c2b,
  shadowOpacity: 0.56,
  dust: 0xffeac6,
  sunMarker: 0xffdf9c,
  sunMarkerGlow: 0xffb347,
};

const corners: Theme = {
  ...shadow,
  name: "corners",
  background: 0xd2c096,
  fog: 0xd2c096,
  ground: 0x94855f,
  base: 0x726545,
  floor: 0xe4d8b5,
  floorAlt: 0xefe4c4,
  wall: 0xb3a17a,
  wallTop: 0xcbb994,
  hemiSky: 0xfff0cc,
  sun: 0xffeec2,
  sunIntensity: 2.3,
  shadow: 0x1a2030,
  shadowOpacity: 0.58,
};

const procession: Theme = {
  ...shadow,
  name: "procession",
  background: 0xc4b18a,
  fog: 0xc4b18a,
  ground: 0x8a7b58,
  base: 0x6b5e42,
  floor: 0xd9cba8,
  floorAlt: 0xe4d7b7,
  wall: 0xa89873,
  wallTop: 0xc1af8b,
  shadow: 0x141a28,
  shadowOpacity: 0.6,
};

const stones: Theme = {
  ...shadow,
  name: "stones",
  background: 0xcdbb95,
  fog: 0xcdbb95,
  ground: 0x91815e,
  base: 0x6f6246,
  floor: 0xe0d2b0,
  floorAlt: 0xebdebf,
  wall: 0xae9e79,
  wallTop: 0xc7b593,
  shadow: 0x151b2a,
  shadowOpacity: 0.58,
};

const eclipse: Theme = {
  ...shadow,
  name: "eclipse",
  background: 0x4a382a,
  fog: 0x4a382a,
  ground: 0x5c4834,
  base: 0x6b5540,
  floor: 0x9c8a68,
  floorAlt: 0xa89673,
  floorEdge: 0x7d6d50,
  wall: 0x7f6e50,
  wallTop: 0x9a8564,
  void: 0x0f0b07,
  voidGlow: 0x3a2a18,
  grave: 0x0f0b07,
  graveGlow: 0xff9a4a,
  pillar: 0x9a8663,
  pillarTop: 0xb29b73,
  stone: 0x8a7757,
  stoneTop: 0xa08b67,
  shade: 0x050405,
  shadeRim: 0xffb066,
  hemiSky: 0xffc98a,
  hemiGround: 0x241a12,
  hemiIntensity: 0.58,
  sun: 0xffb066,
  sunIntensity: 1.95,
  shadow: 0x0d0a10,
  shadowOpacity: 0.6,
  dust: 0xffcf9a,
  sunMarker: 0xffb066,
  sunMarkerGlow: 0xff7b2e,
};

const THEMES: Record<string, Theme> = {
  shadow,
  corners,
  procession,
  stones,
  eclipse,
};

export function getTheme(name: string | undefined): Theme {
  return THEMES[name ?? "shadow"] ?? shadow;
}

/**
 * The AI-authored stone is authored around this bleached ivory. Theme tints are
 * expressed as a ratio so a single generated model can serve every chapter.
 */
export const MODEL_BASE = {
  pillar: 0xcabda0,
  stone: 0xb4a78a,
  grave: 0xd8ccb0,
  wall: 0xc4b697,
  shade: 0x3a3a40,
} as const;

/** Ratio tint that maps the authored base colour onto a theme colour. */
export function modelTint(base: number, target: number): THREE.Color {
  const b = new THREE.Color(base);
  const t = new THREE.Color(target);
  const clamp = (v: number) => Math.max(0.05, Math.min(2.5, v));
  return new THREE.Color(
    clamp(t.r / Math.max(b.r, 1e-4)),
    clamp(t.g / Math.max(b.g, 1e-4)),
    clamp(t.b / Math.max(b.b, 1e-4)),
  );
}

export const CHAPTER_ORDER = ["shadow", "corners", "procession", "stones", "eclipse"];
