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
import { computeIlluminationDepths } from "../src/game/shadows";
import { replay, solve } from "../src/game/Solver";
import { resolveTurn } from "../src/game/TurnResolver";
import { Direction, GameState, posKey } from "../src/game/types";
import { LevelDefinition } from "../src/world/Level";
import { loadLevel } from "../src/world/LevelLoader";

const ARROW: Record<Direction, string> = { N: "↑", E: "→", S: "↓", W: "←" };

function parseCandidate(text: string): LevelDefinition {
  const map: string[] = [];
  const entities: LevelDefinition["entities"] = [];
  const definition: Partial<LevelDefinition> = {
    id: "candidate",
    name: "Candidate",
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    const match = /^(id|name|sun|daylight|chapter|par|rules|entity)\s+(.+)$/i.exec(line.trim());
    if (match) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (key === "entity") {
        const [kind, x, y] = value.split(/\s+/);
        entities.push({
          kind: kind.startsWith("w") ? "wraith" : "shade",
          x: Number(x),
          y: Number(y),
        });
        continue;
      }
      if (map.length > 0) {
        // Header-ish text after the map is a map row in progress; keep reading.
        map.push(line);
        continue;
      }
      if (key === "sun") definition.startingSun = value.toUpperCase() as Direction;
      else if (key === "daylight") definition.daylight = Number(value);
      else if (key === "rules") definition.rules = value.toLowerCase() as "umbra" | "penumbra";
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
    entities: entities.length > 0 ? entities : undefined,
  } as LevelDefinition;
}

function render(state: GameState, title: string): string {
  const field = computeIlluminationDepths(state.board, state.sun, state.rules);
  const rows: string[] = [];
  for (let y = 0; y < state.height; y++) {
    let row = "";
    for (let x = 0; x < state.width; x++) {
      const tile = state.board.tileAt(x, y);
      const caster = state.board.casterAt(x, y);
      const entity = state.shades.find(
        (s) => !s.buried && s.position.x === x && s.position.y === y,
      );
      const lit = field.get(posKey({ x, y }));
      if (entity) row += entity.kind === "wraith" ? "W" : "S";
      else if (caster) row += caster.kind === "pillar" ? "P" : "L";
      else if (tile === "Wall") row += "#";
      else if (tile === "Void") row += "~";
      else if (tile === "Grave") row += "G";
      else if (lit?.tier === "umbra") row += "▓";
      else if (lit?.tier === "penumbra") row += "░";
      else row += ".";
    }
    rows.push(row);
  }
  const buried = state.shades.filter((s) => s.buried).length;
  const header = [
    title,
    `sun ${state.sun} ${ARROW[state.sun]}   turn ${state.turn}   buried ${buried}/${state.shades.length}   daylight ${state.daylight ?? "∞"}   rules ${state.rules}`,
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

  if (process.argv.includes("--field")) {
    for (const sun of ["N", "E", "S", "W"] as Direction[]) {
      console.log(render({ ...start, sun }, `— ${definition.id} field, sun ${sun} —`));
      console.log("");
    }
    return;
  }
  console.log(render(start, `— start — ${definition.id} ${definition.name}`));

  const solution = solve(start, { maxDepth: definition.daylight ?? 60 });
  if (!solution) {
    console.log(`${definition.id} UNSOLVABLE within the daylight budget`);
    process.exitCode = 1;
    return;
  }

  console.log(`minimum ${solution.moves}: ${solution.path.join(" ")}`);
  if (process.argv.includes("--quiet")) return;

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
