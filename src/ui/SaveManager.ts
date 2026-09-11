import type { CameraPresetId } from "../rendering/cameraPresets";

export interface SaveData {
  highestLevel: number;
  completed: string[];
  bestTurns: Record<string, number>;
  muted: boolean;
  camera: CameraPresetId;
  /** Once the player has moved the sun, the opening hint disappears for good. */
  hasMovedSun: boolean;
}

const STORAGE_KEY = "umbra.save.v1";

const DEFAULT_SAVE: SaveData = {
  highestLevel: 0,
  completed: [],
  bestTurns: {},
  muted: false,
  camera: "classic",
  hasMovedSun: false,
};

export class SaveManager {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SAVE, completed: [], bestTurns: {} };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        highestLevel: parsed.highestLevel ?? 0,
        completed: parsed.completed ?? [],
        bestTurns: parsed.bestTurns ?? {},
        muted: parsed.muted ?? false,
        camera: parsed.camera ?? DEFAULT_SAVE.camera,
        hasMovedSun: parsed.hasMovedSun ?? false,
      };
    } catch {
      return { ...DEFAULT_SAVE, completed: [], bestTurns: {} };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable; play on without saving.
    }
  }

  isCompleted(levelId: string): boolean {
    return this.data.completed.includes(levelId);
  }

  best(levelId: string): number | undefined {
    return this.data.bestTurns[levelId];
  }

  markCompleted(levelId: string, turns: number, levelIndex: number): void {
    if (!this.data.completed.includes(levelId)) this.data.completed.push(levelId);
    const previous = this.data.bestTurns[levelId];
    if (previous === undefined || turns < previous) this.data.bestTurns[levelId] = turns;
    this.data.highestLevel = Math.max(this.data.highestLevel, levelIndex + 1);
    this.persist();
  }

  markMovedSun(): void {
    if (this.data.hasMovedSun) return;
    this.data.hasMovedSun = true;
    this.persist();
  }

  setMuted(muted: boolean): void {
    this.data.muted = muted;
    this.persist();
  }

  setCamera(camera: CameraPresetId): void {
    this.data.camera = camera;
    this.persist();
  }

  reset(): void {
    this.data = { ...DEFAULT_SAVE, completed: [], bestTurns: {} };
    this.persist();
  }
}
