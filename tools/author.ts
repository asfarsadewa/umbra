/**
 * Level authoring helper.
 *
 * Solves a candidate level and prints a human-readable trace of the minimum
 * solution, so levels can be iterated on without leaving the terminal.
 *
 * Usage:
 *   npx tsx tools/author.ts --file candidate.txt
 *   npx tsx tools/author.ts --sun W --daylight 8 --map "#####" "#.S.#" "#####"
 *
 * Candidate file format (headers optional, order free):
 *
 *   id 019
 *   name Last Light
 *   sun N
 *   daylight 9
 *   #########
 *   #...S...#
 *   #########
 */
import { readFileSync } from "node:fs";
import { computeShadows } from "../src/game/shadows";
import { replay, solve } from "../src/game/Solver";
import { resolveTurn } from "../src/game/TurnResolver";
import { Direction, GameState, posKey } from "../src/game/types";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";

const ARROW: Record<Direction, string> = { N: "↑", E: "→", S: "↓", W: "←" };

function parseCandidate(text: string): LevelDefinition {
  const map: string[] = [];
  const definition: Partial<LevelDefinition> = {
    id: "candidate",
    name: "Candidate",
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    const match = /^(id|name|sun|daylight|chapter|par)\s+(.+)$/i.exec(line.trim());
    if (match && map.length === 0) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (key === "sun") definition.startingSun = value.toUpperCase() as Direction;
      else if (key === "daylight") definition.daylight = Number(value);
      else if (key === "par") definition.par = Number(value);
      else if (key === "chapter") definition.chapter = value;
      else if (key === "id") definition.id = value;
      else if (key === "name") definition.name = value;
      continue;
    }
    if (line.trim() === "" && map.length === 0) continue;
    map.push(line);
  }
  while (map.length > 0 && map[map.length - 1].trim() === "") map.pop();
  if (map.length === 0) throw new Error("candidate has no map rows");
  return {
    ...definition,
    width: map[0].length,
    height: map.length,
    startingSun: definition.startingSun ?? "N",
    map,
  } as LevelDefinition;
}

function render(state: GameState, title: string): string {
  const shadows = computeShadows(state.board, state.sun);
  const rows: string[] = [];
  for (let y = 0; y < state.height; y++) {
    let row = "";
    for (let x = 0; x < state.width; x++) {
      const tile = state.board.tileAt(x, y);
      const caster = state.board.casterAt(x, y);
      const shade = state.shades.find(
        (s) => !s.buried && s.position.x === x && s.position.y === y,
      );
      if (shade) row += "S";
      else if (caster) row += caster.kind === "pillar" ? "P" : "L";
      else if (tile === "Wall") row += "#";
      else if (tile === "Void") row += "~";
      else if (tile === "Grave") row += "G";
      else if (shadows.has(posKey({ x, y }))) row += "░";
      else row += ".";
    }
    rows.push(row);
  }
  const buried = state.shades.filter((s) => s.buried).length;
  const header = [
    title,
    `sun ${state.sun} ${ARROW[state.sun]}   turn ${state.turn}   buried ${buried}/${state.shades.length}   daylight ${state.daylight ?? "∞"}`,
  ];
  return [...header, ...rows].join("\n");
}

function jsonToCandidate(text: string): string {
  const level = JSON.parse(text) as LevelDefinition;
  const headers = [
    `id ${level.id}`,
    `name ${level.name}`,
    `sun ${level.startingSun}`,
  ];
  if (level.daylight !== undefined) headers.push(`daylight ${level.daylight}`);
  if (level.par !== undefined) headers.push(`par ${level.par}`);
  return [...headers, ...level.map].join("\n");
}

function main(): void {
  const fileArg = process.argv.indexOf("--file");
  const mapArg = process.argv.indexOf("--map");
  let text: string;
  if (fileArg >= 0) {
    text = readFileSync(process.argv[fileArg + 1], "utf8");
    if (text.trimStart().startsWith("{")) {
      text = jsonToCandidate(text);
    }
  } else if (mapArg >= 0) {
    const rows: string[] = [];
    for (let i = mapArg + 1; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg.startsWith("--")) break;
      rows.push(arg);
    }
    text = rows.join("\n");
  } else {
    console.error("usage: tsx tools/author.ts --file <candidate.txt> | --map <row>...");
    process.exit(1);
  }

  const inlineSun = process.argv.indexOf("--sun");
  const inlineDaylight = process.argv.indexOf("--daylight");
  const definition = parseCandidate(text);
  if (inlineSun >= 0) definition.startingSun = process.argv[inlineSun + 1] as Direction;
  if (inlineDaylight >= 0) definition.daylight = Number(process.argv[inlineDaylight + 1]);

  const start = loadLevel(definition);
  console.log(render(start, `— start — ${definition.id} ${definition.name}`));

  const solution = solve(start, { maxDepth: definition.daylight ?? 60 });
  if (!solution) {
    console.log("\n✘ UNSOLVABLE within the daylight budget");
    process.exit(1);
  }

  console.log(`\n✔ minimum ${solution.moves} turns: ${solution.path.join(" → ")}\n`);

  let state = start;
  for (let i = 0; i < solution.path.length; i++) {
    const sun = solution.path[i];
    state = resolveTurn(state, sun);
    console.log(render(state, `— turn ${i + 1}: choose ${sun} —`));
    console.log("");
  }

  const final = replay(start, solution.path);
  console.log(
    final.status === "solved"
      ? "✔ replayed and solved"
      : `✘ replay ended ${final.status}`,
  );
  if (definition.par !== undefined && definition.par !== solution.moves) {
    console.error(
      `✘ authored par ${definition.par} does not match minimum ${solution.moves}`,
    );
    process.exit(1);
  }
}

main();
