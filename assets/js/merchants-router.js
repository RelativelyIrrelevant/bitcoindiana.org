// assets/js/merchants-router.js
// Chooses a state config based on ?state= (code or slug), canonicalizes to slug,
// then exposes window.BITCOININDIANA_MAP_CONFIG for map.js.
//
// Expected registry format (JSON):
// {
//   "default": "indiana",              // optional, slug
//   "states": [
//     {
//       "code": "IN",
//       "slug": "indiana",
//       "name": "Indiana",
//       "stateCode": "IN",             // optional; if omitted, code is used
//       "geojsonUrl": "/assets/data/us-states/indiana.geojson",
//       "fitLabel": "Indiana",
//       "pageTitle": "Indiana Merchants",
//       "coverage": [ { "lat":..., "lon":..., "radius_km":... }, ... ]
//     }
//   ]
// }

(function () {
  "use strict";

  const REGISTRY_URL = "/assets/data/merchant-states.json";

  // If you later want to use this router on other pages, you can override via:
  // window.BITCOININDIANA_MERCHANTS_ROUTER = { registryUrl: "..." }
  const OVERRIDE = window.BITCOININDIANA_MERCHANTS_ROUTER || {};
  const registryUrl = OVERRIDE.registryUrl || REGISTRY_URL;

  function normalizeToken(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      // be forgiving about users typing spaces/underscores
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      // strip leading/trailing hyphens
      .replace(/^-+|-+$/g, "");
  }

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function setCanonicalStateParam(slug) {
    const url = new URL(window.location.href);
    url.searchParams.set("state", slug);

    // Keep other query params intact; just normalize state=.
    // Replace instead of push so back button doesn't bounce between aliases.
    window.history.replaceState({}, "", url.toString());
  }

  function buildLookups(states) {
    const bySlug = Object.create(null);
    const byCode = Object.create(null);

    for (const st of states) {
      if (!st || !st.slug || !st.name) continue;

      const slug = normalizeToken(st.slug);
      const code = normalizeToken(st.code || st.stateCode || "");

      bySlug[slug] = st;
      if (code) byCode[code] = st;

      // Optional additional aliases field, if you want it later:
      // "aliases": ["ill.", "illinois-us"] etc.
      if (Array.isArray(st.aliases)) {
        for (const a of st.aliases) {
          const alias = normalizeToken(a);
          if (alias && !bySlug[alias] && !byCode[alias]) {
            // Prefer slug-space; but treat aliases as slug-like
            bySlug[alias] = st;
          }
        }
      }
    }

    return { bySlug, byCode };
  }

  function chooseState(registry) {
    const states = Array.isArray(registry.states) ? registry.states : [];
    const { bySlug, byCode } = buildLookups(states);

    const defaultSlug = normalizeToken(registry.default || "indiana");

    const raw = getQueryParam("state");
    const token = normalizeToken(raw);

    let chosen = null;

    if (!token) {
      chosen = bySlug[defaultSlug] || states[0] || null;
      return { chosen, tokenUsed: null, canonicalSlug: chosen ? normalizeToken(chosen.slug) : null };
    }

    // Try code match first (il), then slug match (illinois)
    chosen = byCode[token] || bySlug[token] || null;

    if (!chosen) {
      chosen = bySlug[defaultSlug] || states[0] || null;
      return { chosen, tokenUsed: token, canonicalSlug: chosen ? normalizeToken(chosen.slug) : null, unknown: true };
    }

    return { chosen, tokenUsed: token, canonicalSlug: normalizeToken(chosen.slug) };
  }

  function stateToMapConfig(st) {
    // Map.js expects these keys (per your notes):
    // stateName, stateCode, geojsonUrl, fitLabel, pageTitle(optional), coverage
    return {
      stateName: st.name,
      stateCode: st.stateCode || st.code || "",
      geojsonUrl: st.geojsonUrl,
      fitLabel: st.fitLabel || st.name,
      pageTitle: st.pageTitle || `${st.name} Bitcoin Merchants`,
      coverage: Array.isArray(st.coverage) ? st.coverage : []
    };
  }

  function updatePageText(config) {
    // Optional hooks you already support:
    const titleEl = document.getElementById("pageTitle");
    if (titleEl && config.pageTitle) titleEl.textContent = config.pageTitle;
  }

  function populateDropdown(registry, chosenSlug) {
    const select = document.getElementById("stateSelect");
    if (!select) return;

    // If the markup already has options, don't duplicate.
    if (select.options && select.options.length > 0) return;

    const states = Array.isArray(registry.states) ? registry.states : [];
    // Sort by display name
    const sorted = [...states].sort((a, b) => String(a.name).localeCompare(String(b.name)));

    for (const st of sorted) {
      const opt = document.createElement("option");
      opt.value = normalizeToken(st.slug);
      opt.textContent = st.name;
      if (normalizeToken(st.slug) === chosenSlug) opt.selected = true;
      select.appendChild(opt);
    }

    // Navigation on change (canonical slug form)
    select.addEventListener("change", () => {
      const slug = normalizeToken(select.value);
      const url = new URL(window.location.href);
      url.searchParams.set("state", slug);
      window.location.href = url.toString();
    });
  }

  async function loadRegistry() {
    const res = await fetch(registryUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load merchant states registry: ${res.status} ${res.statusText}`);
    return await res.json();
  }

  async function main() {
    const statusEl = document.getElementById("status");
    const setStatus = (msg) => {
      if (statusEl) statusEl.textContent = msg;
    };

    try {
      setStatus("Loading state registry…");

      const registry = await loadRegistry();
      const result = chooseState(registry);

      if (!result.chosen) {
        setStatus("No states configured.");
        return;
      }

      // Canonicalize URL to slug form.
      // If user used ?state=il we rewrite to ?state=illinois.
      // If unknown token, we rewrite to the default slug as well.
      if (result.canonicalSlug) {
        const raw = getQueryParam("state");
        const token = normalizeToken(raw);
        if (token !== result.canonicalSlug) {
          setCanonicalStateParam(result.canonicalSlug);
        } else if (!raw) {
          // Ensure state param exists (optional). If you don't want this, delete this block.
          setCanonicalStateParam(result.canonicalSlug);
        }
      }

      const config = stateToMapConfig(result.chosen);

      window.BITCOININDIANA_MAP_CONFIG = config;

      updatePageText(config);
      populateDropdown(registry, normalizeToken(result.chosen.slug));

      // If map.js is loaded with "defer" after this file, it will run afterward.
      // If map.js was loaded before this router, you'll need to refactor map.js into an init function.
      setStatus(`Selected: ${config.stateName}. Loading merchants…`);
    } catch (err) {
      console.error(err);
      const statusEl = document.getElementById("status");
      if (statusEl) statusEl.textContent = `Error: ${err.message}`;
    }
  }

  // Run ASAP (after DOM is parsed if script uses defer).
  main();
})();
