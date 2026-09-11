import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GameState, Position } from "../game/types";
import { AnimationManager } from "./AnimationManager";
import { AssetLoader } from "./AssetLoader";
import { BoardRenderer } from "./BoardRenderer";
import { CameraController } from "./CameraController";
import { CameraPresetId } from "./cameraPresets";
import { CasterRenderer } from "./CasterRenderer";
import { DecorRenderer } from "./DecorRenderer";
import { Effects } from "./Effects";
import { Particles } from "./Particles";
import { SceneBuilder } from "./SceneBuilder";
import { ShadeRenderer } from "./ShadeRenderer";
import { ShadowRenderer } from "./ShadowRenderer";
import { getTheme, Theme } from "./themes";
import { TitleScene } from "./TitleScene";
import { createUmbraPass } from "./UmbraPass";

/**
 * Composes the Three.js world, owns the post-processing chain and the render
 * loop. The renderer knows nothing about turn rules.
 */
export class Renderer {
  readonly sceneBuilder = new SceneBuilder();
  readonly cameraController = new CameraController();
  readonly assets = new AssetLoader();

  private gl: THREE.WebGLRenderer;
  private boardRenderer: BoardRenderer;
  private casterRenderer: CasterRenderer;
  private shadowRenderer: ShadowRenderer;
  private shadeRenderer: ShadeRenderer;
  private decorRenderer: DecorRenderer;
  private effects: Effects;
  private particles: Particles;
  private titleScene: TitleScene;
  private animationManager: AnimationManager;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private theme: Theme = getTheme("shadow");
  private mode: "title" | "game" = "game";

  constructor(container: HTMLElement) {
    this.container = container;
    this.gl = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.gl.domElement);

    this.boardRenderer = new BoardRenderer();
    this.casterRenderer = new CasterRenderer();
    this.shadowRenderer = new ShadowRenderer();
    this.shadeRenderer = new ShadeRenderer();
    this.decorRenderer = new DecorRenderer();
    this.effects = new Effects();
    this.particles = new Particles();
    this.titleScene = new TitleScene();

    const scene = this.sceneBuilder.scene;
    scene.add(this.boardRenderer.group);
    scene.add(this.casterRenderer.group);
    scene.add(this.decorRenderer.group);
    scene.add(this.shadowRenderer.group);
    scene.add(this.shadeRenderer.group);
    scene.add(this.effects.group);
    scene.add(this.particles.points);
    scene.add(this.titleScene.group);

    this.animationManager = new AnimationManager(
      this.sceneBuilder.sunRig,
      this.shadowRenderer,
      this.shadeRenderer,
      this.effects,
      this.theme,
    );

    this.setupComposer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  async preload(): Promise<void> {
    await this.assets.loadAll();
    this.titleScene.applyModels(this.assets);
  }

  setCamera(id: CameraPresetId): void {
    this.cameraController.setPreset(id);
  }

  private setupComposer(): void {
    try {
      const composer = new EffectComposer(this.gl);
      composer.addPass(
        new RenderPass(this.sceneBuilder.scene, this.cameraController.camera),
      );
      const bloom = new UnrealBloomPass(new THREE.Vector2(1024, 1024), 0.36, 0.6, 0.92);
      composer.addPass(bloom);
      composer.addPass(createUmbraPass());
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloom = bloom;
    } catch {
      this.composer = null;
      this.bloom = null;
    }
  }

  get prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  loadLevel(state: GameState): void {
    this.mode = "game";
    this.titleScene.setVisible(false);
    this.setGameVisible(true);
    this.animationManager.reset();
    this.effects.clear();

    const theme = getTheme(state.chapter);
    this.theme = theme;
    this.gl.toneMappingExposure = 1.05;
    this.animationManager.setTheme(theme);
    this.animationManager.reducedMotion = this.prefersReducedMotion;
    this.animationManager.setLayout({ width: state.width, height: state.height });

    this.boardRenderer.build(state, theme, this.assets);
    this.casterRenderer.build(state, theme, this.assets);
    this.shadeRenderer.setLevel(state, theme, this.assets);
    this.decorRenderer.build(state, theme, this.assets);
    this.effects.setLayout({ width: state.width, height: state.height });

    this.cameraController.setDrift(0);
    this.cameraController.setSway(0);
    this.cameraController.fit(state.width, state.height, this.aspect());
    this.sceneBuilder.applyTheme(
      theme,
      state.width,
      state.height,
      this.cameraController.cameraDistance,
      this.cameraController.boardExtent,
    );

    const extent = Math.max(state.width, state.height) + 4;
    this.particles.setTheme(theme.dust, extent, 0.32);
    this.particles.points.visible = !this.prefersReducedMotion;

    this.animationManager.applyInstant(state);

    if (this.bloom) {
      this.bloom.strength = theme.name === "eclipse" ? 0.55 : 0.34;
      this.bloom.threshold = theme.name === "eclipse" ? 0.82 : 0.92;
    }
  }

  showTitle(): void {
    this.mode = "title";
    this.animationManager.reset();
    this.effects.clear();
    this.setGameVisible(false);
    this.titleScene.setVisible(true);

    const theme = getTheme("eclipse");
    this.theme = theme;
    this.gl.toneMappingExposure = 1.35;
    this.titleScene.setTheme(theme);
    this.cameraController.focus(11, this.aspect(), 2.6);
    this.cameraController.setDrift(0.05);
    this.cameraController.setSway(0);
    this.sceneBuilder.applyTheme(theme, 6, 6, this.cameraController.cameraDistance, 6);
    this.particles.setTheme(theme.dust, 8, 0.22);
    this.particles.points.visible = !this.prefersReducedMotion;

    if (this.bloom) {
      this.bloom.strength = 0.5;
      this.bloom.threshold = 0.86;
    }
  }

  get isTitle(): boolean {
    return this.mode === "title";
  }

  private setGameVisible(visible: boolean): void {
    this.boardRenderer.group.visible = visible;
    this.casterRenderer.group.visible = visible;
    this.decorRenderer.group.visible = visible;
    this.shadowRenderer.group.visible = visible;
    this.shadeRenderer.group.visible = visible;
    this.effects.group.visible = visible;
    this.sceneBuilder.sunRig.group.visible = visible;
  }

  animateTurn(previous: GameState, next: GameState): Promise<void> {
    return this.animationManager.animateTurn(previous, next);
  }

  applyInstant(state: GameState): void {
    this.animationManager.applyInstant(state);
  }

  /** Cosmetic feedback for a rejected input (never happens for the sun, but kept). */
  dustAt(position: Position): void {
    this.effects.dustPuff(position, this.theme.dust);
  }

  sunsetFlash(): void {
    this.effects.sunsetFlash();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const time = this.clock.elapsedTime;

      this.animationManager.update(dt);
      this.sceneBuilder.sunRig.update(dt);
      this.shadowRenderer.update(dt);
      this.shadeRenderer.update(time * 1000);
      this.boardRenderer.update(time * 1000);
      this.effects.update(dt);
      if (this.mode === "title") this.titleScene.update(time * 1000);
      if (this.particles.points.visible) this.particles.update(dt, time);
      if (!this.prefersReducedMotion) {
        this.sceneBuilder.sunRig.updateIdle(time);
        this.cameraController.update(time);
      }

      if (this.composer) {
        this.composer.render();
      } else {
        this.gl.render(this.sceneBuilder.scene, this.cameraController.camera);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.boardRenderer.dispose();
    this.casterRenderer.dispose();
    this.shadowRenderer.dispose();
    this.shadeRenderer.dispose();
    this.decorRenderer.dispose();
    this.effects.clear();
    this.particles.dispose();
    this.titleScene.dispose();
    this.sceneBuilder.sunRig.dispose();
    this.composer?.dispose();
    this.gl.dispose();
    this.gl.domElement.remove();
  }

  private aspect(): number {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    return width / height;
  }

  private resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.gl.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.cameraController.resize(width / height);
  }
}
