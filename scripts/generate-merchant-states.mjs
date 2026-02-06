// scripts/generate-merchant-states.mjs
//
// Generates assets/data/merchant-states.json by scanning assets/data/us-states/*.geojson
// and computing a set of coverage circles per state based on polygon bounds.
//
// Usage:
//   node scripts/generate-merchant-states.mjs
//
// Options:
//   node scripts/generate-merchant-states.mjs --in assets/data/us-states --out assets/data/merchant-states.json
//
// Notes:
// - Coverage circles are heuristic: grid over the state's bounding box.
// - PIP filtering in map.js ensures only in-state points are kept.
// - For MultiPolygon states, bounds are computed across all polygons.

import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_IN_DIR = "assets/data/us-states";
const DEFAULT_OUT_FILE = "assets/data/merchant-states.json";
const CODES_FILE = "scripts/us-state-codes.json";

function parseArgs(argv) {
  const args = { inDir: DEFAULT_IN_DIR, outFile: DEFAULT_OUT_FILE };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in" && argv[i + 1]) args.inDir = argv[++i];
    else if (a === "--out" && argv[i + 1]) args.outFile = argv[++i];
  }
  return args;
}

function titleCaseFromSlug(slug) {
  return slug
    .split("-")
    .map(w => w ? (w[0].toUpperCase() + w.slice(1)) : w)
    .join(" ");
}

// Haversine distance (km)
function kmBetween(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function featureFromGeo(geo) {
  if (!geo) throw new Error("Empty GeoJSON.");
  if (geo.type === "Feature") return geo;
  if (geo.type === "FeatureCollection" && Array.isArray(geo.features) && geo.features[0]) return geo.features[0];
  throw new Error("Expected Feature or FeatureCollection with at least one feature.");
}

function computeBounds(feature) {
  const g = feature?.geometry;
  if (!g) throw new Error("Missing geometry.");

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  const scanRing = (ring) => {
    for (const coord of ring) {
      const lon = coord[0], lat = coord[1];
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  };

  if (g.type === "Polygon") {
    scanRing(g.coordinates[0]);
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) scanRing(poly[0]);
  } else {
    throw new Error(`Unsupported geometry type: ${g.type}`);
  }

  return { minLon, minLat, maxLon, maxLat };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// Decide grid size from "span" (km). Larger states => larger grid => fewer circles.
function chooseGridDims(widthKm, heightKm) {
  const areaLike = widthKm * heightKm;

  // fewer circles overall
  if (areaLike < 25000) return { nx: 1, ny: 2 };   // very small: 2 + center = 3
  if (areaLike < 70000) return { nx: 2, ny: 2 };   // small: 4 + center = 5
  if (areaLike < 140000) return { nx: 3, ny: 2 };  // medium: 6 + center = 7
  if (areaLike < 260000) return { nx: 3, ny: 3 };  // large: 9 + center = 10
  return { nx: 4, ny: 3 };                         // huge: 12 + center = 13
}

// Choose radius based on cell size.
// We want overlapping circles. Use ~0.75 of half-diagonal.
function chooseRadiusKm(cellWidthKm, cellHeightKm) {
  const halfDiag = Math.sqrt(cellWidthKm ** 2 + cellHeightKm ** 2) / 2;
  return Math.round(clamp(halfDiag * 0.9, 80, 260));
}

function makeCoverageFromBounds(bounds, slug) {
  // Center lat for km conversions
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;

  // width/height in km
  const widthKm = kmBetween(centerLat, bounds.minLon, centerLat, bounds.maxLon);
  const heightKm = kmBetween(bounds.minLat, centerLon, bounds.maxLat, centerLon);

  const { nx, ny } = chooseGridDims(widthKm, heightKm);

  const latStep = (bounds.maxLat - bounds.minLat) / ny;
  const lonStep = (bounds.maxLon - bounds.minLon) / nx;

  // Cell size (km) approximated at center latitude
  const cellWidthKm = widthKm / nx;
  const cellHeightKm = heightKm / ny;

  const radius_km = chooseRadiusKm(cellWidthKm, cellHeightKm);

  const cov = [];

  // Place points at centers of each cell
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const lat = bounds.minLat + (iy + 0.5) * latStep;
      const lon = bounds.minLon + (ix + 0.5) * lonStep;

      // Friendly-ish names like "Grid 1", "Grid 2"... (not required by your fetch code)
      cov.push({
        name: `Grid ${iy * nx + ix + 1}`,
        lat: Number(lat.toFixed(5)),
        lon: Number(lon.toFixed(5)),
        radius_km
      });
    }
  }

  // Add one center circle to reduce odds of a hole (esp. irregular shapes)
  // Use slightly larger radius.
  cov.push({
    name: "Center",
    lat: Number(centerLat.toFixed(5)),
    lon: Number(centerLon.toFixed(5)),
    radius_km: Math.round(clamp(radius_km * 1.15, 90, 280))
  });

  // Special cases: Alaska bounding box is enormous (Aleutians), grid becomes too wide.
  // For AK, cap grid points by using known hubs instead (still programmatic fallback).
  if (slug === "alaska") {
    return [
      { name: "Anchorage", lat: 61.2181, lon: -149.9003, radius_km: 260 },
      { name: "Fairbanks", lat: 64.8378, lon: -147.7164, radius_km: 260 },
      { name: "Juneau", lat: 58.3019, lon: -134.4197, radius_km: 220 },
      { name: "Nome", lat: 64.5011, lon: -165.4064, radius_km: 260 },
      { name: "Bethel", lat: 60.7922, lon: -161.7558, radius_km: 260 }
    ];
  }

  // Hawaii: bounding box spans islands + lots of ocean, prefer island hubs
  if (slug === "hawaii") {
    return [
      { name: "Oahu (Honolulu)", lat: 21.3069, lon: -157.8583, radius_km: 80 },
      { name: "Hawaii (Hilo)", lat: 19.7070, lon: -155.0870, radius_km: 90 },
      { name: "Maui (Kahului)", lat: 20.8893, lon: -156.4729, radius_km: 80 },
      { name: "Kauai (Lihue)", lat: 21.9811, lon: -159.3711, radius_km: 70 }
    ];
  }

  // Puerto Rico: small enough for 2-3 circles
  if (slug === "puerto-rico") {
    return [
      { name: "San Juan Metro", lat: 18.4655, lon: -66.1057, radius_km: 80 },
      { name: "West", lat: 18.20, lon: -67.14, radius_km: 80 },
      { name: "South", lat: 18.01, lon: -66.62, radius_km: 80 }
    ];
  }

  // DC: tiny
  if (slug === "district-of-columbia") {
    return [{ name: "Washington, DC", lat: 38.9072, lon: -77.0369, radius_km: 45 }];
  }

  return cov;
}

async function main() {
  const { inDir, outFile } = parseArgs(process.argv);

  const codesRaw = await fs.readFile(CODES_FILE, "utf8");
  const codesBySlug = JSON.parse(codesRaw);

  const entries = await fs.readdir(inDir, { withFileTypes: true });
  const geojsonFiles = entries
    .filter(e => e.isFile() && e.name.endsWith(".geojson"))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b));

  const states = [];

  for (const filename of geojsonFiles) {
    const slug = filename.replace(/\.geojson$/i, "");
    const geojsonUrl = `/${path.posix.join(inDir.replace(/^\/?/, ""), filename)}`.replace(/^assets\//, "/assets/").replace(/\/+/, "/");
    // Above line ensures output URL like /assets/data/us-states/ohio.geojson

    const code = codesBySlug[slug];
    if (!code) {
      throw new Error(`Missing postal code mapping for slug '${slug}'. Add it to ${CODES_FILE}.`);
    }

    const filePath = path.join(inDir, filename);
    const raw = await fs.readFile(filePath, "utf8");
    const geo = JSON.parse(raw);
    const feature = featureFromGeo(geo);

    const bounds = computeBounds(feature);
    const coverage = makeCoverageFromBounds(bounds, slug);

    states.push({
      code,
      slug,
      name: titleCaseFromSlug(slug),
      geojsonUrl: `/assets/data/us-states/${filename}`,
      coverage
    });
  }

  // Sort by name for nicer dropdowns
  states.sort((a, b) => a.name.localeCompare(b.name));

  const out = {
    default: "indiana",
    states
  };

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`Wrote ${states.length} entries to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
