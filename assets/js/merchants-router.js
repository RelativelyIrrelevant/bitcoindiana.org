// assets/js/merchants-router.js
//
// Single-page router for the merchants map:
// - Loads the central registry (/assets/data/merchant-states.json)
// - Reads ?state= from URL (accepts slug like "kentucky" or code like "ky", case-insensitive)
// - Defaults to registry.default (usually "indiana")
// - Canonicalizes URL to slug form (?state=kentucky) using history.replaceState
// - Updates SEO (title, meta description, canonical link)
// - Updates visible page content: H1 (#pageTitle), intro paragraph (#pageIntro), chips, fit button label
// - Populates the state dropdown (#stateSelect)
// - Exposes window.BITCOININDIANA_MAP_CONFIG for map.js to consume
// - Dispatches CustomEvent so map.js knows when config is ready
//
// This script runs deferred, after DOM is parsed.

(function () {
  "use strict";

  const REGISTRY_URL = "/assets/data/merchant-states.json";

  // Normalize any string to a clean lowercase slug (used for lookups and canonical URLs)
  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Get current ?state= value from URL
  function getStateParam() {
    const u = new URL(window.location.href);
    return u.searchParams.get("state");
  }

  // Rewrite URL to use canonical slug form (without reloading page)
  function setCanonicalSlug(slug) {
    const u = new URL(window.location.href);
    u.searchParams.set("state", slug);
    // Use replaceState so back/forward doesn't bounce between ky → kentucky
    window.history.replaceState({}, "", u.toString());
  }

  // Update <link rel="canonical"> for SEO
  function setCanonicalLink(url) {
    const link = document.querySelector('link[rel="canonical"]');
    if (link) link.setAttribute("href", url);
  }

  // Update <meta name="description">
  function setMetaDescription(desc) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", desc);
  }

  // Safe way to set textContent on an element by ID
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // Rebuild intro paragraph with dynamic state link + fallback to Indiana
  // Uses innerHTML so links survive; escapeHtml prevents XSS if state name is weird
  function ensureSlugLinksInIntro(introEl, chosen) {
    if (!introEl) return;

    const stateName = chosen.name;
    const stateSlug = chosen.slug;

    introEl.innerHTML = `
      Map of Bitcoin-accepting merchants in
      <a href="/merchants/?state=${encodeURIComponent(stateSlug)}">${escapeHtml(stateName)}</a>.
      Please confirm merchant details before traveling.
      Return (Back Home Again in) <a href="/merchants/?state=indiana">Indiana</a>.
    `.trim();
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, s => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[s]));
  }

  // Populate <select id="stateSelect"> dropdown and handle change → full page reload
  function populateDropdown(selectEl, states, chosenSlug) {
    if (!selectEl) return;

    selectEl.innerHTML = ""; // clear any static options

    for (const st of states) {
      const opt = document.createElement("option");
      opt.value = st.slug;
      opt.textContent = st.name;
      if (st.slug === chosenSlug) opt.selected = true;
      selectEl.appendChild(opt);
    }

    selectEl.addEventListener("change", () => {
      const slug = norm(selectEl.value);
      const u = new URL(window.location.href);
      u.searchParams.set("state", slug);
      window.location.href = u.toString(); // full navigation for clean reload
    });
  }

  // Build fast lookup maps: slug → state, code → state
  function buildLookups(states) {
    const bySlug = new Map();
    const byCode = new Map();

    for (const st of states) {
      const slug = norm(st.slug);
      const code = norm(st.code);
      if (slug) bySlug.set(slug, st);
      if (code) byCode.set(code, st);
    }
    return { bySlug, byCode };
  }

  async function main() {
    const statusEl = document.getElementById("status");
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg || ""; };

    try {
      setStatus("Loading states…");

      // Fetch registry (no cache so we always get latest after script updates)
      const res = await fetch(REGISTRY_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load merchant-states.json (HTTP ${res.status})`);
      const registry = await res.json();

      const states = Array.isArray(registry.states) ? registry.states : [];
      if (!states.length) throw new Error("No states found in merchant-states.json");

      // Sort alphabetically by name for consistent dropdown order
      const sortedStates = [...states].sort((a, b) => String(a.name).localeCompare(String(b.name)));

      const { bySlug, byCode } = buildLookups(sortedStates);

      const defaultSlug = norm(registry.default || "indiana");

      // Determine chosen state from URL param or default
      const rawParam = getStateParam();
      const token = norm(rawParam);
      let chosen = null;

      if (!token) {
        chosen = bySlug.get(defaultSlug) || sortedStates[0];
      } else {
        chosen = bySlug.get(token) || byCode.get(token) || null;
        if (!chosen) chosen = bySlug.get(defaultSlug) || sortedStates[0];
      }

      const chosenSlug = norm(chosen.slug);

      // Canonicalize URL if needed (e.g. ?state=KY → ?state=kentucky)
      const tokenNow = norm(getStateParam());
      if (tokenNow !== chosenSlug) {
        setCanonicalSlug(chosenSlug);
      }

      // ── Update SEO metadata ───────────────────────────────────────────────
      const title = `${chosen.name} Merchants | bitcoINdiana`;
      const desc = `A map of merchants that accept Bitcoin in ${chosen.name} (${chosen.code}).`;

      document.title = title;
      setMetaDescription(desc);

      const canonicalUrl = `${window.location.origin}/merchants/?state=${encodeURIComponent(chosenSlug)}`;
      setCanonicalLink(canonicalUrl);

      // ── Update visible page content ──────────────────────────────────────
      setText("pageTitle", `Bitcoin ${chosen.name} Merchants`);

      const introEl = document.getElementById("pageIntro");
      ensureSlugLinksInIntro(introEl, chosen);

      // Update dynamic chip
      const pipChip = document.getElementById("pipChip");
      if (pipChip) pipChip.textContent = `${chosen.name}: point-in-polygon`;

      // Set baseline label for fit button (map.js may override later)
      const btnFit = document.getElementById("btnFit");
      if (btnFit) btnFit.textContent = `Fit ${chosen.name}`;

      // Populate dropdown
      populateDropdown(document.getElementById("stateSelect"), sortedStates, chosenSlug);

      // ── Prepare config for map.js ─────────────────────────────────────────
      window.BITCOININDIANA_MAP_CONFIG = {
        stateName: chosen.name,
        stateCode: chosen.code,
        geojsonUrl: chosen.geojsonUrl,
        coverage: Array.isArray(chosen.coverage) ? chosen.coverage : []
      };

      // Notify map.js that config is ready (it waits for this event)
      window.dispatchEvent(
        new CustomEvent("bitcoinindiana:merchants-config", {
          detail: window.BITCOININDIANA_MAP_CONFIG
        })
      );

      // ── Final status + re-apply playful "IN" highlighting ─────────────────
      // We call this AFTER all text updates so spans are applied to the final content
      setStatus(`Selected: ${chosen.name}. Loading merchants…`);

      if (window.highlightPlayfulIn) {
        window.highlightPlayfulIn(); // from site.js – makes "in" glow on hover
      }

    } catch (e) {
      console.error(e);
      if (statusEl) statusEl.textContent = e?.message || String(e);
    }
  }

  main();
})();
