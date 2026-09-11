/**
 * BFS solver / level validator.
 *
 * Because the simulation is pure and deterministic we can exhaustively search
 * each level, proving solvability and finding the true minimum move count.
 *
 * Usage:
 *   npm run solve                                   # validate every campaign level
 *   npx tsx tools/solve.ts --file src/levels/002.json
 *   npx tsx tools/solve.ts --file cand.json --max 30
 */
import { readFileSync } from "node:fs";
import { replay, solve } from "../src/game/Solver";
import { LEVELS } from "../src/levels/index";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";

let allGood = true;

const fileArgIndex = process.argv.indexOf("--file");
const singleFile =
  fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : undefined;
const maxArgIndex = process.argv.indexOf("--max");
const maxDepth =
  maxArgIndex >= 0 ? Number(process.argv[maxArgIndex + 1]) : undefined;

const levels: LevelDefinition[] = singleFile
  ? [JSON.parse(readFileSync(singleFile, "utf8")) as LevelDefinition]
  : (LEVELS as LevelDefinition[]);

for (const definition of levels) {
  const state = loadLevel(definition);
  const solution = solve(state, maxDepth ? { maxDepth } : {});
  const limit = maxDepth ?? 60;
  if (!solution) {
    allGood = false;
    console.log(`✘ ${definition.id} ${definition.name} is UNSOLVABLE (≤${limit})`);
    continue;
  }

  // Independent check: replaying the path must actually solve the level.
  const solved = replay(state, solution.path);
  if (solved.status !== "solved") {
    allGood = false;
    console.log(`✘ ${definition.id} ${definition.name} replay did not solve`);
    continue;
  }

  const par = definition.par ? ` (authored par ${definition.par})` : "";
  console.log(
    `✔ ${definition.id} ${definition.name.padEnd(18)} solved in ${String(
      solution.moves,
    ).padStart(2)} turns${par}`,
  );
  console.log(`    ${solution.path.join(" → ")}`);
  if (definition.par !== undefined && solution.moves !== definition.par) {
    allGood = false;
    console.error(
      `    ✘ authored par ${definition.par} does not match the minimum ${solution.moves}`,
    );
  }
}

process.exit(allGood ? 0 : 1);
