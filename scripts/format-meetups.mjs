import fs from "node:fs";

const FILE = "assets/data/meetups.json";

const LINK_ORDER = ["website", "meetup", "linktree", "x", "nostr", "other"];
const orderIndex = (type) => {
  const t = String(type ?? "").trim().toLowerCase();
  const i = LINK_ORDER.indexOf(t);
  return i === -1 ? LINK_ORDER.indexOf("other") : i; // unknown treated as "other"
};

function asStr(x) {
  return (x === null || x === undefined) ? "" : String(x).trim();
}

function uniqCaseInsensitive(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const s = asStr(v);
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function normalizeStateCode(x) {
  const s = asStr(x).toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : "";
}

function sortAlphaCI(arr) {
  return [...arr].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), "en"));
}

function isObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (e) {
  throw new Error(`Cannot parse ${FILE}: ${e.message}`);
}

if (!Array.isArray(data)) {
  throw new Error(`${FILE} must be a JSON array`);
}

for (const m of data) {
  if (!isObject(m)) continue;

  // ----- states -----
  const stateCode = normalizeStateCode(m.state_code) || normalizeStateCode(m.state);

  const statesRaw = Array.isArray(m.states) ? m.states : [];
  const statesNorm = uniqCaseInsensitive(statesRaw)
    .map(normalizeStateCode)
    .filter(Boolean);

  // ensure physical state present
  if (stateCode && !statesNorm.includes(stateCode)) statesNorm.push(stateCode);

  // sort + dedupe again (after push)
  const statesFinal = Array.from(new Set(sortAlphaCI(statesNorm)));
  m.states = statesFinal;

  // ----- cities -----
  const citiesRaw = Array.isArray(m.cities) ? m.cities : [];
  const citiesFinal = sortAlphaCI(uniqCaseInsensitive(citiesRaw));
  m.cities = citiesFinal;

  // ----- links -----
  if (Array.isArray(m.links)) {
    const links = m.links
      .filter(l => isObject(l) && asStr(l.url)) // keep only valid-ish links
      .map(l => ({
        type: asStr(l.type),
        label: asStr(l.label),
        url: asStr(l.url)
      }));

    links.sort((a, b) => {
      const ia = orderIndex(a.type);
      const ib = orderIndex(b.type);
      if (ia !== ib) return ia - ib;
      // stable-ish secondary sort so commits are deterministic
      return (a.label || a.url).toLowerCase().localeCompare((b.label || b.url).toLowerCase(), "en");
    });

    m.links = links;
  }
}

// Write pretty JSON (2 spaces) + trailing newline
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");

console.log(`Formatted ${FILE}: cities sorted/deduped, states normalized, links ordered.`);
