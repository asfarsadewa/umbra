/**
 * Placement explorer for Penumbra authoring.
 *
 *   npx tsx tools/explore.ts --file candidate.txt [--top 12]
 *
 * For every pair of walkable tiles it reports the minimum number of sun inputs
 * needed to move the sole entity from one to the other, so a designer can pick
 * a start and grave that yield an interesting route.
 */
import { readFileSync } from "node:fs";
import { solve } from "../src/game/Solver";
import { loadLevel } from "../src/world/LevelLoader";
import { Direction } from "../src/game/types";

const fileArg = process.argv.indexOf("--file");
const topArg = process.argv.indexOf("--top");
const top = topArg >= 0 ? Number(process.argv[topArg + 1]) : 10;
if (fileArg < 0) {
  console.error("usage: tsx tools/explore.ts --file candidate.txt [--top N]");
  process.exit(1);
}
const text = readFileSync(process.argv[fileArg + 1], "utf8");

function parse(text: string) {
  const map: string[] = [];
  let sun: Direction = "N";
  let rules: "umbra" | "penumbra" = "umbra";
  let entity: { kind: "shade" | "wraith"; x: number; y: number } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    const header = /^(sun|rules|entity)\s+(.+)$/i.exec(line.trim());
    if (header) {
      const key = header[1].toLowerCase();
      const value = header[2].trim();
      if (key === "sun") sun = value.toUpperCase() as Direction;
      else if (key === "rules") rules = value.toLowerCase() as "umbra" | "penumbra";
      else if (key === "entity") {
        const [kind, x, y] = value.split(/\s+/);
        entity = { kind: kind.startsWith("w") ? "wraith" : "shade", x: Number(x), y: Number(y) };
      }
      continue;
    }
    if (line.startsWith("#") || line.startsWith(".") || line.startsWith("~")) map.push(line);
  }
  return { map, sun, rules, entity };
}

const parsed = parse(text);
const base = parsed.map.map((row) => row.replace(/[SWG]/g, "."));
const walkable: Array<{ x: number; y: number }> = [];
for (let y = 0; y < base.length; y++) {
  for (let x = 0; x < base[y].length; x++) {
    if (base[y][x] === ".") walkable.push({ x, y });
  }
}

const results: Array<{ from: string; to: string; moves: number; path: string }> = [];
for (const from of walkable) {
  for (const to of walkable) {
    if (from.x === to.x && from.y === to.y) continue;
    const map = base.map((row, y) =>
      row
        .split("")
        .map((c, x) => {
          if (x === from.x && y === from.y) return parsed.entity?.kind === "wraith" ? "W" : "S";
          if (x === to.x && y === to.y) return "G";
          return c;
        })
        .join(""),
    );
    const state = loadLevel({
      id: "explore",
      name: "explore",
      startingSun: parsed.sun,
      rules: parsed.rules,
      map,
    });
    const solution = solve(state, { maxDepth: 40 });
    if (!solution) continue;
    results.push({
      from: `${from.x},${from.y}`,
      to: `${to.x},${to.y}`,
      moves: solution.moves,
      path: solution.path.join(""),
    });
  }
}

results.sort((a, b) => b.moves - a.moves);
const sunCount = (path: string) => new Set(path.split("")).size;
console.log(`pairs solved: ${results.length}`);
for (const r of results.slice(0, top)) {
  console.log(
    `  ${r.from} -> ${r.to}  ${String(r.moves).padStart(2)} moves, ${sunCount(
      r.path,
    )} suns   ${r.path}`,
  );
}
