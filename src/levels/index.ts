import { LevelDefinition } from "../world/Level";

import l001 from "./001.json";
import l002 from "./002.json";
import l003 from "./003.json";
import l004 from "./004.json";
import l005 from "./005.json";
import l006 from "./006.json";
import l007 from "./007.json";
import l008 from "./008.json";
import l009 from "./009.json";
import l010 from "./010.json";
import l011 from "./011.json";
import l012 from "./012.json";
import l013 from "./013.json";
import l014 from "./014.json";
import l015 from "./015.json";
import l016 from "./016.json";
import l017 from "./017.json";
import l018 from "./018.json";

import u019 from "./U019.json";
import u020 from "./U020.json";
import u021 from "./U021.json";
import u022 from "./U022.json";
import u023 from "./U023.json";

import p001 from "./P001.json";
import p002 from "./P002.json";
import p003 from "./P003.json";
import p004 from "./P004.json";
import p005 from "./P005.json";

/**
 * The core campaign. Completing level 018 finishes UMBRA; everything below is
 * optional postgame content and never changes "18 / 18".
 */
export const LEVELS: LevelDefinition[] = [
  l001, l002, l003, l004, l005, l006, l007, l008, l009,
  l010, l011, l012, l013, l014, l015, l016, l017, l018,
] as LevelDefinition[];

export const CAMPAIGN_COUNT = LEVELS.length;
export const FINAL_CAMPAIGN_LEVEL_ID = "018";

/** Deep Umbra: advanced puzzles using only the original rules. Expandable. */
export const DEEP_LEVELS: LevelDefinition[] = [
  u019, u020, u021, u022, u023,
] as LevelDefinition[];

/** Penumbra: the experimental half-light branch (light / penumbra / umbra). */
export const PENUMBRA_LEVELS: LevelDefinition[] = [
  p001, p002, p003, p004, p005,
] as LevelDefinition[];

export type Section = "campaign" | "deep" | "penumbra";

export const POSTGAME_LEVELS: LevelDefinition[] = [...DEEP_LEVELS, ...PENUMBRA_LEVELS];
export const ALL_LEVELS: LevelDefinition[] = [...LEVELS, ...POSTGAME_LEVELS];

export function levelsForSection(section: Section): LevelDefinition[] {
  if (section === "deep") return DEEP_LEVELS;
  if (section === "penumbra") return PENUMBRA_LEVELS;
  return LEVELS;
}

export function sectionOf(level: LevelDefinition): Section {
  if (level.chapter === "deep") return "deep";
  if (level.chapter === "penumbra") return "penumbra";
  return "campaign";
}

/** Chapter labels for the campaign level select. */
export const CHAPTERS: Record<string, string> = {
  shadow: "I · Shadow",
  corners: "II · Corners",
  procession: "III · Procession",
  stones: "IV · Short Stones",
  eclipse: "V · Eclipse",
};
