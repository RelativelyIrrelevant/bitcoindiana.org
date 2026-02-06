// assets/js/merchants-router.js
//
// Single-page merchants router:
// - Loads /assets/data/merchant-states.json
// - Parses ?state= (accepts slug "kentucky" or code "ky", case-insensitive)
// - Defaults to registry.default (indiana)
// - Canonicalizes URL to slug form (?state=kentucky) via history.replaceState
// - Sets window.BITCOININDIANA_MAP_CONFIG for map.js
// - Updates: document.title, meta description, canonical link, H1, intro, chips
// - Populates dropdown (#stateSelect)

(function () {
  "use strict";

  const REGISTRY_URL = "/assets/data/merchant-states.json";

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

  function getStateParam() {
    const u = new URL(window.location.href);
    return u.searchParams.get("state");
  }

  function setCanonicalSlug(slug) {
    const u = new URL(window.location.href);
    u.searchParams.set("state", slug);
    // Replace (not push) to avoid back button bouncing between aliases.
    window.history.replaceState({}, "", u.toString());
  }

  function setCanonicalLink(url) {
    const link = document.querySelector('link[rel="canonical"]');
    if (!link) return;
    link.setAttribute("href", url);
  }

  function setMetaDescription(desc) {
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) return;
    meta.setAttribute("content", desc);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  function ensureSlugLinksInIntro(introEl, chosen) {
    // Build a consistent intro with links (so we don't lose anchors via textContent).
    // This replaces the intro contents entirely.
    // If you prefer to keep your existing intro markup, remove this function call.
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

  function populateDropdown(selectEl, states, chosenSlug) {
    if (!selectEl) return;

    // Clear existing options (if any)
    selectEl.innerHTML = "";

    for (const st of states) {
      const opt = document.createElement("option");
      opt.value = st.slug;          // canonical value is slug
      opt.textContent = st.name;
      if (st.slug === chosenSlug) opt.selected = true;
      selectEl.appendChild(opt);
    }

    selectEl.addEventListener("change", () => {
      const slug = norm(selectEl.value);
      const u = new URL(window.location.href);
      u.searchParams.set("state", slug);
      // full navigation (simpler, ensures clean boot)
      window.location.href = u.toString();
    });
  }

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

      const res = await fetch(REGISTRY_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load merchant-states.json (HTTP ${res.status})`);
      const registry = await res.json();

      const states = Array.isArray(registry.states) ? registry.states : [];
      if (!states.length) throw new Error("No states found in merchant-states.json");

      // Sort for dropdown (stable UX)
      const sortedStates = [...states].sort((a, b) => String(a.name).localeCompare(String(b.name)));

      const { bySlug, byCode } = buildLookups(sortedStates);

      const defaultSlug = norm(registry.default || "indiana");

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

      // Canonicalize to slug form
      // - If user used code (ky), rewrite to slug (kentucky)
      // - If missing param, add ?state=indiana (optional but keeps URL explicit)
      const canonicalWanted = chosenSlug;
      const tokenNow = norm(getStateParam());
      if (tokenNow !== canonicalWanted) {
        setCanonicalSlug(canonicalWanted);
      }

      // Update SEO + page copy
      const title = `${chosen.name} Merchants | bitcoINdiana`;
      const desc = `A map of merchants that accept Bitcoin in ${chosen.name}.`;

      document.title = title;
      setMetaDescription(desc);

      // Canonical URL should point to the slug form
      // Keep current origin, but normalize path + query.
      const canonicalUrl = `${window.location.origin}/merchants/?state=${encodeURIComponent(chosenSlug)}`;
      setCanonicalLink(canonicalUrl);

      // H1
      setText("pageTitle", `Bitcoin ${chosen.name} Merchants`);

      // Intro (with links)
      const introEl = document.getElementById("pageIntro");
      ensureSlugLinksInIntro(introEl, chosen);

      // Chips / labels
      const pipChip = document.getElementById("pipChip");
      if (pipChip) pipChip.textContent = `${chosen.name}: point-in-polygon`;

      // Fit button baseline text will be set by map.js, but we can set a placeholder
      const btnFit = document.getElementById("btnFit");
      if (btnFit) btnFit.textContent = `Fit ${chosen.name}`;

      // Dropdown
      populateDropdown(document.getElementById("stateSelect"), sortedStates, chosenSlug);

      // Expose config for map.js
      window.BITCOININDIANA_MAP_CONFIG = {
        stateName: chosen.name,
        stateCode: chosen.code,
        geojsonUrl: chosen.geojsonUrl,
        coverage: Array.isArray(chosen.coverage) ? chosen.coverage : []
      };

      setStatus(`Selected: ${chosen.name}. Loading merchants…`);
    } catch (e) {
      console.error(e);
      const statusEl = document.getElementById("status");
      if (statusEl) statusEl.textContent = e?.message || String(e);
    }
  }

  main();
})();
