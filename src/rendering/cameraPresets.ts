/**
 * Camera view presets. Each preset is a direction from the look-at target to
 * the camera; only the pitch changes, so the grid orientation stays consistent
 * and shadow geometry stays readable.
 */
export type CameraPresetId = "diorama" | "classic" | "elevated";

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  blurb: string;
  direction: readonly [number, number, number];
}

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  {
    id: "diorama",
    label: "Diorama",
    blurb: "A low tabletop angle (~46°).",
    direction: [0.42, 1.05, 1],
  },
  {
    id: "classic",
    label: "Classic",
    blurb: "The default raised angle (~52°).",
    direction: [0.42, 1.3, 1],
  },
  {
    id: "elevated",
    label: "Elevated",
    blurb: "Higher, for the clearest read of the whole board (~60°).",
    direction: [0.42, 1.75, 1],
  },
] as const;

export const DEFAULT_CAMERA: CameraPresetId = "classic";

export function getCameraPreset(id: string | undefined): CameraPreset {
  return (
    CAMERA_PRESETS.find((preset) => preset.id === id) ??
    CAMERA_PRESETS.find((preset) => preset.id === DEFAULT_CAMERA)!
  );
}

/** Downward pitch in degrees (angle above the horizon). */
export function cameraPitchDegrees(
  direction: readonly [number, number, number],
): number {
  const [x, y, z] = direction;
  const length = Math.hypot(x, y, z) || 1;
  return (Math.asin(y / length) * 180) / Math.PI;
}
