import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * Desert grade: a gentle vignette, a slight warm lift in the highlights and a
 * cool settle in the shadows. Runs in linear space before OutputPass.
 */
export const UmbraShader = {
  name: "UmbraShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    offset: { value: 1.05 },
    darkness: { value: 0.8 },
    tint: { value: new THREE.Color(0x1a1a24) },
    warmth: { value: 0.06 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    uniform vec3 tint;
    uniform float warmth;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * vec2(offset);
      float vignette = smoothstep(0.95, 0.15, dot(uv, uv));
      float amount = mix(darkness, 1.0, vignette);
      vec3 color = mix(tint, texel.rgb, amount);
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color += vec3(warmth, warmth * 0.7, warmth * 0.35) * smoothstep(0.25, 1.0, luma);
      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

export function createUmbraPass(): ShaderPass {
  return new ShaderPass(UmbraShader);
}
