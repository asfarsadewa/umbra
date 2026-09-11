/**
 * Social sharing audit: fetches the deployed page as a crawler would, checks the
 * Open Graph / Twitter / JSON-LD metadata, and verifies the share image is
 * reachable, correctly sized and small enough for strict scrapers.
 *
 *   node tools/check_social.mjs [url]
 */
const URL_BASE = process.argv[2] ?? "https://umbra.asfarlab.fun/";
const UA = "Twitterbot/1.0";

const problems = [];
const notes = [];

function meta(html, attr, key) {
  const re = new RegExp(
    `<meta[^>]*${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
    "i",
  );
  return re.exec(html)?.[1] ?? alt.exec(html)?.[1] ?? null;
}

function dimension(buffer, type) {
  if (type.includes("png") && buffer.length > 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (type.includes("jpeg") || type.includes("jpg")) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

async function head(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
  return res;
}

async function main() {
  const page = await head(URL_BASE);
  if (!page.ok) problems.push(`page returned ${page.status}`);
  const html = await page.text();

  const required = [
    ["og:type", "property", "og:type"],
    ["og:title", "property", "og:title"],
    ["og:description", "property", "og:description"],
    ["og:url", "property", "og:url"],
    ["og:image", "property", "og:image"],
    ["og:image:width", "property", "og:image:width"],
    ["og:image:height", "property", "og:image:height"],
    ["og:image:alt", "property", "og:image:alt"],
    ["twitter:card", "name", "twitter:card"],
    ["twitter:title", "name", "twitter:title"],
    ["twitter:description", "name", "twitter:description"],
    ["twitter:image", "name", "twitter:image"],
    ["twitter:image:alt", "name", "twitter:image:alt"],
  ];
  const tags = {};
  for (const [label, attr, key] of required) {
    const value = meta(html, attr, key);
    tags[label] = value;
    if (!value) problems.push(`missing ${label}`);
  }

  if (tags["twitter:card"] && tags["twitter:card"] !== "summary_large_image") {
    problems.push(`twitter:card should be summary_large_image, got ${tags["twitter:card"]}`);
  }
  for (const key of ["og:image", "og:url", "twitter:image"]) {
    const value = tags[key];
    if (value && !/^https:\/\//.test(value)) problems.push(`${key} must be an absolute https URL`);
  }

  const imageUrl = tags["og:image"];
  if (imageUrl) {
    const res = await head(imageUrl);
    if (!res.ok) {
      problems.push(`og:image returned ${res.status}`);
    } else {
      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      const buffer = Buffer.from(await res.arrayBuffer());
      const sizeKb = buffer.length / 1024;
      const dims = dimension(buffer, type);
      notes.push(`og:image ${type} ${dims ? `${dims.width}x${dims.height}` : "?"} ${sizeKb.toFixed(0)} KB`);
      if (!type.startsWith("image/")) problems.push(`og:image content-type is ${type}`);
      if (dims && (dims.width !== 1200 || dims.height !== 630)) {
        problems.push(`og:image should be 1200x630, got ${dims.width}x${dims.height}`);
      }
      if (sizeKb > 300) problems.push(`og:image is ${sizeKb.toFixed(0)} KB; strict scrapers prefer < 300 KB`);
    }
  }

  const canonical = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1];
  if (!canonical) problems.push("missing canonical link");
  else notes.push(`canonical ${canonical}`);

  const icons = [...html.matchAll(/rel=["'](?:icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/gi)].map(
    (m) => m[1],
  );
  if (icons.length === 0) problems.push("no favicon / apple-touch-icon links");
  for (const href of icons) {
    const url = new URL(href, URL_BASE).toString();
    const res = await head(url);
    if (!res.ok) problems.push(`icon ${href} returned ${res.status}`);
  }
  notes.push(`${icons.length} icon links`);

  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (!ld) problems.push("missing JSON-LD");
  else {
    try {
      const data = JSON.parse(ld);
      if (!data.name || !data.description) problems.push("JSON-LD missing name/description");
      notes.push(`JSON-LD @type=${data["@type"]} image=${data.image ?? "-"}`);
    } catch (error) {
      problems.push(`JSON-LD is not valid JSON: ${error.message}`);
    }
  }

  console.log(`\nsocial audit: ${URL_BASE}`);
  for (const note of notes) console.log(`  · ${note}`);
  if (problems.length === 0) {
    console.log("  ✔ all social metadata present and valid\n");
  } else {
    console.log("");
    for (const problem of problems) console.log(`  ✘ ${problem}`);
    console.log("");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("SOCIAL AUDIT FAILED:", error);
  process.exitCode = 1;
});
