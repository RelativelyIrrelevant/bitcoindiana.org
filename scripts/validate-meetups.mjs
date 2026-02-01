import fs from "node:fs";

const FILE = "assets/data/meetups.json";

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`⚠️ ${msg}`);
}

function isObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function asStr(x) {
  return (x === null || x === undefined) ? "" : String(x).trim();
}

function isStateCode(x) {
  return /^[A-Z]{2}$/.test(asStr(x));
}

function decimalPlaces(n) {
  // We want "at least 8 decimals" in the JSON text form.
  // This checks the string representation; contributors should enter many decimals directly.
  const s = String(n);
  const m = s.match(/\.(\d+)/);
  return m ? m[1].length : 0;
}

function ensure(cond, msg) {
  if (!cond) fail(msg);
}

function compareAlphaCI(a, b) {
  return a.toLowerCase().localeCompare(b.toLowerCase(), "en");
}

const ORDER = ["website", "meetup", "linktree", "x", "nostr", "other"];
const orderIndex = (type) => {
  const t = asStr(type).toLowerCase();
  const i = ORDER.indexOf(t);
  return i === -1 ? ORDER.indexOf("other") : i; // unknown treated as "other"
};

let raw;
try {
  raw = fs.readFileSync(FILE, "utf8");
} catch (e) {
  fail(`Could not read ${FILE}: ${e.message}`);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  fail(`${FILE} is not valid JSON: ${e.message}`);
}

ensure(Array.isArray(data), `${FILE} must be a JSON array of meetups.`);

const ids = new Set();

data.forEach((m, idx) => {
  const at = `meetups[${idx}]`;

  ensure(isObject(m), `${at} must be an object.`);

  const requiredStringFields = ["id", "name", "address", "city", "state_code", "state_name"];
  for (const f of requiredStringFields) {
    ensure(asStr(m[f]), `${at}.${f} is required and must be a non-empty string.`);
  }

  // id uniqueness
  const id = asStr(m.id);
  ensure(!ids.has(id), `${at}.id "${id}" is duplicated.`);
  ids.add(id);

  // state_code format
  const stateCode = asStr(m.state_code).toUpperCase();
  ensure(isStateCode(stateCode), `${at}.state_code must be 2 uppercase letters (e.g., "IN").`);

  // lat/lon numbers + 8 decimals
  ensure(Number.isFinite(m.lat), `${at}.lat must be a number.`);
  ensure(Number.isFinite(m.lon), `${at}.lon must be a number.`);
  ensure(decimalPlaces(m.lat) >= 8, `${at}.lat must have at least 8 decimal places (got ${m.lat}).`);
  ensure(decimalPlaces(m.lon) >= 8, `${at}.lon must have at least 8 decimal places (got ${m.lon}).`);

  // states array
  ensure(Array.isArray(m.states), `${at}.states is required and must be an array of state codes.`);
  const states = m.states.map(s => asStr(s).toUpperCase()).filter(Boolean);
  ensure(states.length >= 1, `${at}.states must have at least 1 value.`);
  for (const s of states) {
    ensure(isStateCode(s), `${at}.states contains invalid state code "${s}".`);
  }
  ensure(states.includes(stateCode), `${at}.states must include state_code "${stateCode}".`);

  // cities array
  ensure(Array.isArray(m.cities), `${at}.cities is required and must be an array of strings.`);
  const cities = m.cities.map(c => asStr(c)).filter(Boolean);
  ensure(cities.length >= 1, `${at}.cities must have at least 1 city string.`);
  // verify sorted (case-insensitive)
  const sorted = [...cities].sort(compareAlphaCI);
  const sameOrder = cities.length === sorted.length && cities.every((v, i) => v === sorted[i]);
  ensure(sameOrder, `${at}.cities must be sorted alphabetically (case-insensitive).`);

  // Optional: links order + schema
  if (m.links !== undefined) {
    ensure(Array.isArray(m.links), `${at}.links must be an array if present.`);
    let lastIdx = -1;
    m.links.forEach((l, li) => {
      const lat2 = `${at}.links[${li}]`;
      ensure(isObject(l), `${lat2} must be an object.`);
      // url required if link object exists
      ensure(asStr(l.url), `${lat2}.url is required.`);
      // type optional but encouraged
      const idx2 = orderIndex(l.type);
      // enforce monotonic increase
      ensure(idx2 >= lastIdx, `${at}.links must be ordered: website → meetup → linktree → x → nostr → other. Problem at ${lat2} (type="${asStr(l.type)}").`);
      lastIdx = idx2;
    });
  }

  // Optional: state_name sanity (not strict)
  if (asStr(m.state_name).length < 3) {
    warn(`${at}.state_name looks unusually short: "${asStr(m.state_name)}"`);
  }
});

console.log(`✅ meetups.json OK (${data.length} meetups validated).`);
