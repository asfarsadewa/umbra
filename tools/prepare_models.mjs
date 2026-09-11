/**
 * Reproducible asset pipeline for UMBRA's 3D models.
 *
 *   gpt-image-2.5-sunburst  ->  fal Hunyuan 3D 3.1 Pro  ->  Blender prep/rig  ->  public/models
 *
 * The first two steps are run with the Codex skill helpers (they need
 * OPENAI_API_KEY / FAL_AI_KEY and cost money), and write into output/3d/. This
 * script performs the last step: it finds the newest Hunyuan run for each
 * model, optionally re-detects the facing by silhouette IoU, and drives Blender
 * headlessly (the same binary the Blender MCP uses) to bake, orient, decimate,
 * rig and export a game-ready GLB.
 *
 *   npm run models:prep              # prep every model from its newest run
 *   npm run models:prep -- --detect  # re-run facing detection first
 *   npm run models:prep -- shade    # a single model
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = resolve(ROOT, "public", "models");
const THREED = resolve(ROOT, "output", "3d");
const REVIEW = resolve(ROOT, "output", "3d", "review");

/**
 * Facing yaws are the values tools/detect_facing.py produced by comparing each
 * reference silhouette against four orthographic review renders (see README).
 */
const MODELS = [
  { name: "princess", height: 0.9, tris: 16000, yaw: 90, rig: true, texture: 512 },
  { name: "wraith", height: 0.86, tris: 14000, yaw: 90, rig: true, texture: 512 },
  { name: "pillar", height: 1.75, tris: 6000, yaw: 0, texture: 512 },
  { name: "title", height: 2.6, tris: 12000, yaw: 90, texture: 512 },
  { name: "stone", fit: "width", width: 0.95, tris: 4000, yaw: 0, texture: 512 },
  { name: "grave", fit: "width", width: 1.02, flatten: 0.3, tris: 6000, yaw: 90, texture: 512 },
  { name: "rubble", fit: "width", width: 0.5, tris: 2500, yaw: 0, texture: 512 },
  { name: "cypress", height: 2.0, tris: 9000, yaw: 0, texture: 512 },
  { name: "bush", fit: "width", width: 0.95, tris: 4000, yaw: 0, texture: 512 },
];

function findBlender() {
  const candidates = [
    process.env.BLENDER_PATH,
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
    "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe",
    "blender",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === "blender" || existsSync(candidate)) return candidate;
  }
  throw new Error("Blender not found; set BLENDER_PATH");
}

function newestRun(name) {
  if (!existsSync(THREED)) throw new Error("output/3d is missing; run the generation step first");
  const dirs = readdirSync(THREED)
    .filter((entry) => entry.startsWith(`${name}-`))
    .map((entry) => resolve(THREED, entry))
    .filter((dir) => statSync(dir).isDirectory() && existsSync(resolve(dir, "model.glb")))
    .sort();
  if (dirs.length === 0) throw new Error(`no Hunyuan run found for "${name}"`);
  return dirs[dirs.length - 1];
}

function detectYaw(name, modelPath, defaultYaw) {
  try {
    const output = execFileSync(
      "python",
      [
        resolve(ROOT, "tools", "detect_facing.py"),
        "--ref",
        resolve(ROOT, "output", "imagegen", "refs", `${name}.png`),
        "--model",
        modelPath,
        "--out-dir",
        resolve(REVIEW, name),
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );
    const report = JSON.parse(output.slice(output.indexOf("{")));
    console.log(`  facing: best=${report.best} yaw=${report.yaw}`);
    return report.yaw;
  } catch (error) {
    console.warn(`  facing detection failed (${error.message}); using ${defaultYaw}`);
    return defaultYaw;
  }
}

function main() {
  const args = process.argv.slice(2);
  const detect = args.includes("--detect");
  const only = args.filter((arg) => !arg.startsWith("--"));
  const blender = findBlender();
  console.log(`Blender: ${blender}`);

  for (const model of MODELS) {
    if (only.length > 0 && !only.includes(model.name)) continue;
    const runDir = newestRun(model.name);
    const input = resolve(runDir, "model.glb");
    const out = resolve(OUT_DIR, `${model.name}.glb`);
    console.log(`\n▶ ${model.name}  (${runDir.split(/[\\/]/).pop()})`);

    const yaw = detect
      ? detectYaw(model.name, input, model.yaw)
      : model.yaw;

    const scriptArgs = [
      "--background",
      "--factory-startup",
      "--python",
      resolve(ROOT, "tools", "blender", "prepare_ai_models.py"),
      "--",
      "--kind",
      model.name,
      "--input",
      input,
      "--out",
      out,
      "--tris",
      String(model.tris),
      "--yaw",
      String(yaw),
      "--max-texture",
      String(model.texture ?? 1024),
    ];
    if (model.fit === "width") {
      scriptArgs.push("--fit", "width", "--width", String(model.width));
    } else {
      scriptArgs.push("--height", String(model.height));
    }
    if (model.flatten) scriptArgs.push("--flatten", String(model.flatten));
    if (model.rig) scriptArgs.push("--rig");

    execFileSync(blender, scriptArgs, { stdio: "inherit" });
  }
  console.log("\ndone");
}

main();
