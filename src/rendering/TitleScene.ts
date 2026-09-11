import * as THREE from "three";
import { Theme } from "./themes";

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,235,190,0.8)");
    gradient.addColorStop(0.55, "rgba(255,190,110,0.25)");
    gradient.addColorStop(1, "rgba(255,160,70,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The opening scene (SPEC §29). A single pillar stands in an empty space. A
 * tiny Shade shelters behind it. The sun slowly moves, the shadow changes, and
 * the Shade quietly shifts to remain protected. The mechanic is taught before
 * the player presses anything.
 */
export class TitleScene {
  readonly group = new THREE.Group();
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private readonly texture: THREE.Texture;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly sunOrb: THREE.Sprite;
  private readonly sunCore: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly shadowStrip: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly shade: THREE.Group;
  private readonly pillar: THREE.Group;
  private readonly ground: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  private readonly marker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private sunAngle = Math.PI;
  private shadeTarget = new THREE.Vector3(0, 0, 1.5);
  private built = false;

  private static readonly SHADOW_LENGTH = 5.2;

  constructor() {
    this.group.name = "TitleScene";
    this.group.visible = false;

    const groundGeometry = new THREE.CircleGeometry(16, 64);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1610,
      roughness: 1,
      metalness: 0,
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.01;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);
    this.disposables.push(groundGeometry, groundMaterial);

    this.group.add(new THREE.HemisphereLight(0xffe0b8, 0x141008, 0.55));

    this.keyLight = new THREE.DirectionalLight(0xfff0cc, 2.2);
    this.group.add(this.keyLight);
    this.group.add(this.keyLight.target);

    const platformGeometry = new THREE.CylinderGeometry(1.9, 2.1, 0.22, 40);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x32271a,
      roughness: 0.98,
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = 0.11;
    platform.receiveShadow = true;
    this.group.add(platform);
    this.disposables.push(platformGeometry, platformMaterial);

    this.pillar = this.buildPillar();
    this.group.add(this.pillar);

    // The logical shadow: a strip from the pillar outward, away from the sun.
    const shadowGeometry = new THREE.PlaneGeometry(1, 1);
    shadowGeometry.translate(0, 0.5, 0);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x0a0c12,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.shadowStrip = new THREE.Mesh(shadowGeometry, shadowMaterial);
    this.shadowStrip.rotation.x = -Math.PI / 2;
    this.shadowStrip.position.y = 0.02;
    this.group.add(this.shadowStrip);
    this.disposables.push(shadowGeometry, shadowMaterial);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.3, 28),
      new THREE.MeshBasicMaterial({
        color: 0x8fb0d8,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.03;
    this.group.add(this.marker);

    this.texture = glowTexture();
    const haloMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      color: 0xffdf9c,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sunOrb = new THREE.Sprite(haloMaterial);
    this.sunOrb.scale.setScalar(2.2);
    this.group.add(this.sunOrb);
    this.disposables.push(haloMaterial);

    const coreGeometry = new THREE.SphereGeometry(0.22, 20, 16);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff4da,
      emissive: 0xffce7a,
      emissiveIntensity: 3.4,
      roughness: 0.3,
    });
    this.sunCore = new THREE.Mesh(coreGeometry, coreMaterial);
    this.group.add(this.sunCore);
    this.disposables.push(coreGeometry, coreMaterial);

    this.shade = this.buildShade();
    this.group.add(this.shade);
  }

  private buildPillar(): THREE.Group {
    const group = new THREE.Group();
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xcabda0,
      roughness: 0.92,
      metalness: 0,
      flatShading: true,
    });
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfd2b4,
      roughness: 0.88,
      metalness: 0,
      flatShading: true,
    });
    this.disposables.push(stoneMaterial, topMaterial);

    const height = 2.15;
    const shaftGeometry = new THREE.CylinderGeometry(0.24, 0.3, height, 16, 1);
    const shaft = new THREE.Mesh(shaftGeometry, stoneMaterial);
    shaft.position.y = 0.22 + height / 2;
    shaft.castShadow = true;
    group.add(shaft);
    this.disposables.push(shaftGeometry);

    const baseGeometry = new THREE.BoxGeometry(0.86, 0.2, 0.86);
    const base = new THREE.Mesh(baseGeometry, stoneMaterial);
    base.position.y = 0.1;
    base.castShadow = true;
    group.add(base);
    this.disposables.push(baseGeometry);

    const collarGeometry = new THREE.CylinderGeometry(0.34, 0.28, 0.14, 16);
    const collar = new THREE.Mesh(collarGeometry, topMaterial);
    collar.position.y = 0.22 + height + 0.07;
    collar.castShadow = true;
    group.add(collar);
    this.disposables.push(collarGeometry);

    const capitalGeometry = new THREE.BoxGeometry(0.72, 0.2, 0.72);
    const capital = new THREE.Mesh(capitalGeometry, topMaterial);
    capital.position.y = 0.22 + height + 0.24;
    capital.rotation.y = 0.18;
    capital.castShadow = true;
    group.add(capital);
    this.disposables.push(capitalGeometry);
    return group;
  }

  private buildShade(): THREE.Group {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0x07070a,
      roughness: 0.86,
      flatShading: true,
    });
    this.disposables.push(material);

    const robeGeometry = new THREE.CylinderGeometry(0.09, 0.2, 0.44, 7, 1);
    const robe = new THREE.Mesh(robeGeometry, material);
    robe.position.y = 0.22;
    root.add(robe);
    this.disposables.push(robeGeometry);

    const hoodGeometry = new THREE.ConeGeometry(0.12, 0.24, 8);
    const hood = new THREE.Mesh(hoodGeometry, material);
    hood.position.y = 0.52;
    root.add(hood);
    this.disposables.push(hoodGeometry);

    const headGeometry = new THREE.SphereGeometry(0.085, 10, 8);
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = 0.44;
    head.scale.set(0.9, 1.1, 0.9);
    root.add(head);
    this.disposables.push(headGeometry);

    root.position.set(0, 0, 1.9);
    root.scale.setScalar(1.3);
    return root;
  }

  setTheme(theme: Theme): void {
    this.ground.material.color.set(0x4a3d2b);
    this.keyLight.color.set(0xfff4dd);
    this.keyLight.intensity = 3.1;
    (this.shadowStrip.material as THREE.MeshBasicMaterial).color.set(0x05060a);
    (this.shadowStrip.material as THREE.MeshBasicMaterial).opacity = 0.82;
    this.sunOrb.material.color.set(theme.sunMarker);
    this.sunCore.material.color.set(theme.sunMarker);
    this.sunCore.material.emissive.set(theme.sunMarkerGlow);
    this.marker.material.color.set(theme.graveGlow);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (visible && !this.built) this.built = true;
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    // A slow, deliberate orbit.
    this.sunAngle += 0.0006 * 16.7;

    const dir = new THREE.Vector3(Math.cos(this.sunAngle), 0, Math.sin(this.sunAngle));
    const distance = 5.4;
    const orbPos = new THREE.Vector3(
      dir.x * distance,
      2.4,
      dir.z * distance,
    );
    this.sunOrb.position.copy(orbPos);
    this.sunCore.position.copy(orbPos);
    this.keyLight.position.copy(orbPos);
    this.keyLight.target.position.set(0, 0.8, 0);

    // Shadow extends away from the sun, from the pillar to the edge.
    const away = new THREE.Vector3(-dir.x, 0, -dir.z);
    this.shadowStrip.rotation.z = Math.atan2(-away.z, away.x);
    this.shadowStrip.scale.set(TitleScene.SHADOW_LENGTH, 1, 1);
    this.shadowStrip.position.set(0, 0.02, 0);

    // The Shade shelters just inside the shadow, a little way out from the pillar.
    const target = away.clone().multiplyScalar(1.9);
    this.shadeTarget.lerp(target, 0.02);
    this.shade.position.x = this.shadeTarget.x;
    this.shade.position.z = this.shadeTarget.z;
    this.shade.rotation.y = Math.atan2(away.x, away.z);

    this.marker.position.set(this.shade.position.x, 0.03, this.shade.position.z);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    this.marker.material.opacity = 0.16 + pulse * 0.18;
    this.marker.scale.setScalar(1 + pulse * 0.08);
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
    this.texture.dispose();
  }
}
