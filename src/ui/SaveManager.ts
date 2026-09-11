import type { CameraPresetId } from "../rendering/cameraPresets";

export type ProgressSection = "deep" | "penumbra";

export interface SectionProgress {
  completed: Record<string, true>;
  best: Record<string, number>;
}

export interface SaveData {
  /** Campaign progression (levels 001–018). */
  highestLevel: number;
  completed: string[];
  bestTurns: Record<string, number>;
  /**
   * True once level 018 is solved. This is the only thing that finishes UMBRA;
   * postgame content never changes "18 / 18".
   */
  campaignComplete: boolean;
  postgameUnlocked: boolean;
  seenPostgameChoice: boolean;
  /** Postgame progress, tracked per level id so adding levels revokes nothing. */
  deep: SectionProgress;
  penumbra: SectionProgress;
  muted: boolean;
  camera: CameraPresetId;
  hasMovedSun: boolean;
}

const STORAGE_KEY = "umbra.save.v1";

function emptySection(): SectionProgress {
  return { completed: {}, best: {} };
}

const DEFAULT_SAVE: SaveData = {
  highestLevel: 0,
  completed: [],
  bestTurns: {},
  campaignComplete: false,
  postgameUnlocked: false,
  seenPostgameChoice: false,
  deep: emptySection(),
  penumbra: emptySection(),
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
      if (!raw) return { ...DEFAULT_SAVE, completed: [], bestTurns: {}, deep: emptySection(), penumbra: emptySection() };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const completed = parsed.completed ?? [];
      const campaignComplete = parsed.campaignComplete ?? completed.includes("018");
      return {
        highestLevel: parsed.highestLevel ?? 0,
        completed,
        bestTurns: parsed.bestTurns ?? {},
        campaignComplete,
        postgameUnlocked: parsed.postgameUnlocked ?? campaignComplete,
        seenPostgameChoice: parsed.seenPostgameChoice ?? false,
        deep: { ...emptySection(), ...(parsed.deep ?? {}) },
        penumbra: { ...emptySection(), ...(parsed.penumbra ?? {}) },
        muted: parsed.muted ?? false,
        camera: parsed.camera ?? DEFAULT_SAVE.camera,
        hasMovedSun: parsed.hasMovedSun ?? false,
      };
    } catch {
      return { ...DEFAULT_SAVE, completed: [], bestTurns: {}, deep: emptySection(), penumbra: emptySection() };
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

  /** Record a core-campaign solve. Solving 018 completes UMBRA. */
  markCompleted(levelId: string, turns: number, levelIndex: number): void {
    if (!this.data.completed.includes(levelId)) this.data.completed.push(levelId);
    const previous = this.data.bestTurns[levelId];
    if (previous === undefined || turns < previous) this.data.bestTurns[levelId] = turns;
    this.data.highestLevel = Math.max(this.data.highestLevel, levelIndex + 1);
    if (levelId === "018") {
      this.data.campaignComplete = true;
      this.data.postgameUnlocked = true;
    }
    this.persist();
  }

  section(section: ProgressSection): SectionProgress {
    return this.data[section];
  }

  markSectionCompleted(section: ProgressSection, levelId: string, turns: number): void {
    const progress = this.data[section];
    progress.completed[levelId] = true;
    const previous = progress.best[levelId];
    if (previous === undefined || turns < previous) progress.best[levelId] = turns;
    this.persist();
  }

  isSectionCompleted(section: ProgressSection, levelId: string): boolean {
    return this.data[section].completed[levelId] === true;
  }

  sectionSolved(section: ProgressSection): number {
    return Object.keys(this.data[section].completed).length;
  }

  markPostgameChoiceSeen(): void {
    if (this.data.seenPostgameChoice) return;
    this.data.seenPostgameChoice = true;
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
    this.data = {
      ...DEFAULT_SAVE,
      completed: [],
      bestTurns: {},
      deep: emptySection(),
      penumbra: emptySection(),
    };
    this.persist();
  }
}
