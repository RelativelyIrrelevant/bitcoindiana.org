// scripts/split-us-states-geojson.mjs
import { promises as fs } from "node:fs";
import path from "node:path";

function slugifyName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const inputPath = process.argv[2];
  const outDir = process.argv[3] || "assets/data/us-states";

  if (!inputPath) {
    console.error("Usage: node scripts/split-us-states-geojson.mjs <input.geojson> [outDir]");
    process.exit(1);
  }

  const raw = await fs.readFile(inputPath, "utf8");
  const geo = JSON.parse(raw);

  if (!geo || geo.type !== "FeatureCollection" || !Array.isArray(geo.features)) {
    throw new Error("Input must be a GeoJSON FeatureCollection with a features array.");
  }

  await fs.mkdir(outDir, { recursive: true });

  const written = [];

  for (const feat of geo.features) {
    const name = feat?.properties?.NAME;
    if (!name) {
      console.warn("Skipping feature with no properties.NAME");
      continue;
    }

    const slug = slugifyName(name);
    const filename = `${slug}.geojson`;
    const outPath = path.join(outDir, filename);

    const outGeo = {
      type: "FeatureCollection",
      features: [feat]
    };

    await fs.writeFile(outPath, JSON.stringify(outGeo, null, 2) + "\n", "utf8");
    written.push({ name, slug, outPath });
  }

  written.sort((a, b) => a.slug.localeCompare(b.slug));
  console.log(`Wrote ${written.length} files to ${outDir}`);
  for (const w of written) console.log(`- ${w.slug} (${w.name}) -> ${w.outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
