/**
 * Generate UMBRA's sparse ambient score with Lyria 3.5 via the Gemini
 * Interactions API.
 *
 *   node tools/generate_music.mjs            # generate missing tracks
 *   node tools/generate_music.mjs --force    # regenerate everything
 *
 * Requires GEMINI_API_KEY. Output: public/audio/<name>.mp3
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public", "audio");
mkdirSync(outDir, { recursive: true });

const API = "https://generativelanguage.googleapis.com/v1beta/interactions";
const FORCE = process.argv.includes("--force");
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("GEMINI_API_KEY is not set");
  process.exit(1);
}

const TRACKS = [
  {
    name: "title",
    prompt:
      "Ancient, quiet, ritualistic instrumental theme for a puzzle game set in a sun-bleached Mediterranean ruin. A low sustained stone drone, a single distant resonant bell, dry wind over sand, a barely-there wooden flute. Vast negative space, no percussion. Instrumental only, absolutely no vocals and no lyrics. Slow, lonely, melancholic, loopable. About 90 seconds.",
  },
  {
    name: "penumbra",
    prompt:
      "Extremely thin, airy instrumental ambient for an epilogue about the edge of shadow. Almost nothing: a very high faint sine drone, a slow beating harmonic between two close tones, wide breathy air, one distant soft chime every so often. No melody, no rhythm, no percussion, no bass. Instrumental only, absolutely no vocals and no lyrics. Cold, spacious, liminal, loopable. About two minutes.",
  },
  {
    name: "vigil",
    prompt:
      "Very sparse instrumental ambient for patient puzzle solving at high noon. Almost no melody: a deep warm drone, the faintest breath of wind, occasional soft stone resonance, one distant low chime. Immense stillness and space. Instrumental only, absolutely no vocals and no lyrics, no drums, no rhythm. Extremely minimal and loopable. About two minutes.",
  },
];

async function generate(track) {
  const target = resolve(outDir, `${track.name}.mp3`);
  if (!FORCE && existsSync(target)) {
    const kb = Math.round(statSync(target).size / 1024);
    console.log(`· ${track.name}: exists (${kb} KB), skipping`);
    return;
  }

  console.log(`… generating "${track.name}" with lyria-3.5`);
  const started = Date.now();
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": KEY,
    },
    body: JSON.stringify({
      model: "lyria-3.5",
      input: track.prompt,
      response_format: { type: "audio" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
  }

  const data = await response.json();
  const audio = (data.steps ?? [])
    .flatMap((step) => step.content ?? [])
    .find((block) => block.type === "audio" && block.data);
  if (!audio) {
    throw new Error(`no audio block in response: ${JSON.stringify(data).slice(0, 400)}`);
  }

  const buffer = Buffer.from(audio.data, "base64");
  writeFileSync(target, buffer);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `✔ ${track.name}.mp3  ${(buffer.length / 1024 / 1024).toFixed(2)} MB  in ${seconds}s`,
  );
}

for (const track of TRACKS) {
  try {
    await generate(track);
  } catch (error) {
    console.error(`✘ ${track.name}:`, error.message);
    process.exitCode = 1;
  }
}

console.log("done");
