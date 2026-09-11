import * as THREE from "three";
import { Direction } from "../game/types";
import { SunRig } from "./SunRig";
import { Theme } from "./themes";

/**
 * Scene, fog, ambient bed and the sun rig. Deliberately simple: UMBRA's
 * readable shadows are drawn explicitly by the ShadowRenderer, not produced
 * with shadow maps, so the visible shadow always equals the logical shadow.
 */
export class SceneBuilder {
  readonly scene = new THREE.Scene();
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  readonly sunRig: SunRig;

  constructor(initialSun: Direction = "N") {
    this.hemi = new THREE.HemisphereLight(0xfff3da, 0x6d6450, 0.82);
    this.scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.18);
    this.scene.add(this.ambient);

    this.sunRig = new SunRig(initialSun);
    this.scene.add(this.sunRig.group);
  }

  applyTheme(
    theme: Theme,
    boardWidth: number,
    boardHeight: number,
    cameraDistance: number,
    boardExtent: number,
  ): void {
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(
      theme.fog,
      cameraDistance + boardExtent * 0.55,
      cameraDistance + boardExtent * 2.4,
    );

    this.hemi.color = new THREE.Color(theme.hemiSky);
    this.hemi.groundColor = new THREE.Color(theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity;

    this.sunRig.applyTheme(theme, boardWidth, boardHeight);
  }
}
