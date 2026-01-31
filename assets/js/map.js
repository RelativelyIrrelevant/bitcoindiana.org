// assets/js/map.js
//
// Configurable merchants map for bitcoindiana.org using BTC Map API v4 SEARCH endpoint.
// Defaults to Indiana, but can be overridden per-page by setting:
//   window.BITCOININDIANA_MAP_CONFIG = { ... }  (before loading this script)
//
// Local testing:
//   python3 -m http.server 8000

(function () {
  // ---------- Defaults (Indiana) ----------
  const DEFAULT_CONFIG = {
    stateName: "Indiana",
    stateCode: "IN",
    geojsonUrl: "/assets/data/indiana.geojson",
    canonical: "https://bitcoinindiana.org/",
    excludedIcons: ["currency_exchange", "local_atm"],
    coverage: [
      { name: "North",   lat: 41.55, lon: -86.20, radius_km: 120 },
      { name: "Central", lat: 39.85, lon: -86.15, radius_km: 150 },
      { name: "South",   lat: 38.35, lon: -86.75, radius_km: 140 },
      { name: "East",    lat: 40.05, lon: -85.35, radius_km: 120 },
      { name: "West",    lat: 40.05, lon: -87.25, radius_km: 120 }
    ]
  };

  const CONFIG = Object.assign({}, DEFAULT_CONFIG, (window.BITCOININDIANA_MAP_CONFIG || {}));
  CONFIG.coverage = (window.BITCOININDIANA_MAP_CONFIG?.coverage) || DEFAULT_CONFIG.coverage;

  // ---------- Endpoints ----------
  const BTCMAP_SEARCH_URL = "https://api.btcmap.org/v4/places/search/";

  // ---------- Config-derived ----------
  const GEOJSON_URL = CONFIG.geojsonUrl;
  const EXCLUDED_ICONS = new Set(CONFIG.excludedIcons || DEFAULT_CONFIG.excludedIcons);
  const COVERAGE = CONFIG.coverage;

  // ---------- DOM ----------
  const qEl = document.getElementById("q");
  const countEl = document.getElementById("count");
  const countNoteEl = document.getElementById("countNote");
  const statusEl = document.getElementById("status");
  const btnFit = document.getElementById("btnFit");
  const btnReload = document.getElementById("btnReload");

  // Optional: allow per-page label changes without editing HTML
  const pageTitleEl = document.getElementById("pageTitle");
  const pageIntroEl = document.getElementById("pageIntro");
  if (pageTitleEl && CONFIG.pageTitle) pageTitleEl.textContent = CONFIG.pageTitle;
  if (pageIntroEl && CONFIG.pageIntro) pageIntroEl.textContent = CONFIG.pageIntro;
  if (btnFit && CONFIG.fitLabel) btnFit.textContent = CONFIG.fitLabel;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
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

  // ---------- Leaflet ----------
  const map = L.map("map", { zoomControl: true });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const markersLayer = L.layerGroup().addTo(map);

  const btcIcon = L.divIcon({
    className: "",
    html: '<div class="btc-marker" aria-hidden="true"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });

  let stateFeature = null;
  let stateOutlineLayer = null;
  let stateBounds = null; // {minLon,minLat,maxLon,maxLat}

  // Data
  let allFetched = [];
  let inPlaces = [];

  // ---------- Geo helpers ----------
  function featureBounds(feature) {
    const g = feature?.geometry;
    if (!g) throw new Error("Cannot compute bounds: missing geometry.");

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

    const scanRing = (ring) => {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
    };

    if (g.type === "Polygon") scanRing(g.coordinates[0]);
    else if (g.type === "MultiPolygon") for (const poly of g.coordinates) scanRing(poly[0]);
    else throw new Error(`Unsupported geometry type: ${g.type}`);

    return { minLon, minLat, maxLon, maxLat };
  }

  function pointInBounds([lon, lat], b) {
    return lon >= b.minLon && lon <= b.maxLon && lat >= b.minLat && lat <= b.maxLat;
  }

  function pointInRing(point, ring) {
    const x = point[0], y = point[1];
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];

      const intersect =
        ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi);

      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(point, polygonCoordinates) {
    if (!polygonCoordinates || polygonCoordinates.length === 0) return false;
    if (!pointInRing(point, polygonCoordinates[0])) return false; // outer ring
    for (let i = 1; i < polygonCoordinates.length; i++) {
      if (pointInRing(point, polygonCoordinates[i])) return false; // holes
    }
    return true;
  }

  function pointInFeature(point, feature) {
    const g = feature?.geometry;
    if (!g) return false;

    if (g.type === "Polygon") return pointInPolygon(point, g.coordinates);
    if (g.type === "MultiPolygon") return g.coordinates.some(poly => pointInPolygon(point, poly));
    return false;
  }

  // ---------- Filtering + rendering ----------
  function isExcludedCategory(place) {
    return EXCLUDED_ICONS.has((place.icon || "").trim());
  }

  function matchesQuery(place, q) {
    if (!q) return true;
    const hay = `${place.name || ""} ${place.address || ""} ${place.icon || ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function render() {
    const q = (qEl?.value || "").trim();
    markersLayer.clearLayers();

    const filtered = inPlaces.filter(p => matchesQuery(p, q));

    for (const p of filtered) {
      const title = p.name || `Place #${p.id}`;
      const btcMapUrl = `https://btcmap.org/merchant/${encodeURIComponent(p.id)}`;

      const popup = `
        <div style="min-width:220px; max-width:340px;">
          <div style="font-weight:800; margin-bottom:4px;">${escapeHtml(title)}</div>
          ${p.address ? `<div style="font-size:13px; margin-bottom:6px;">${escapeHtml(p.address)}</div>` : ""}
          <div style="color:#9db0c6; font-size:12.5px;">
            ${p.icon ? `Category: ${escapeHtml(p.icon)}` : ""}
            ${p.verified_at ? `<br/>Verified: ${escapeHtml(String(p.verified_at).slice(0,10))}` : ""}
          </div>
          <div style="margin-top:8px; display:grid; gap:6px;">
            ${p.website ? `<a href="${p.website}" target="_blank" rel="noopener noreferrer">Website</a>` : ""}
            ${p.phone ? `<a href="tel:${encodeURIComponent(p.phone)}">Call</a>` : ""}
            ${p.osm_url ? `<a href="${p.osm_url}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>` : ""}
            <a href="${btcMapUrl}" target="_blank" rel="noopener noreferrer">View on BTC Map</a>
          </div>
        </div>
      `;

      L.marker([p.lat, p.lon], { title, icon: btcIcon })
        .addTo(markersLayer)
        .bindPopup(popup);
    }

    if (countEl) countEl.textContent = String(filtered.length);
    if (countNoteEl) countNoteEl.textContent = (filtered.length === 1) ? "location" : "locations";
  }

  // ---------- Loaders ----------
  async function loadStatePolygon() {
    setStatus(`Loading ${CONFIG.stateName} boundary…`);

    const res = await fetch(GEOJSON_URL, {
      headers: { "accept": "application/geo+json,application/json" }
    });
    if (!res.ok) throw new Error(`Failed to load ${CONFIG.stateName} boundary (HTTP ${res.status}).`);

    const geo = await res.json();
    if (geo.type === "Feature") stateFeature = geo;
    else if (geo.type === "FeatureCollection" && Array.isArray(geo.features) && geo.features.length > 0) stateFeature = geo.features[0];
    else throw new Error(`State GeoJSON must be a Feature or FeatureCollection with at least one feature.`);

    stateBounds = featureBounds(stateFeature);

    stateOutlineLayer = L.geoJSON(stateFeature, {
      style: { color: "#F7931A", weight: 2, opacity: 0.65, fillOpacity: 0.04 }
    }).addTo(map);

    map.fitBounds(stateOutlineLayer.getBounds(), { padding: [14, 14] });
  }

  async function fetchCircle(circle) {
    const url = new URL(BTCMAP_SEARCH_URL);
    url.searchParams.set("lat", String(circle.lat));
    url.searchParams.set("lon", String(circle.lon));
    url.searchParams.set("radius_km", String(circle.radius_km));

    const res = await fetch(url.toString(), { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`Search failed (${circle.name}) HTTP ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(`Unexpected search response (${circle.name}): expected an array`);
    return data;
  }

  async function loadPlacesViaSearch() {
    if (!stateFeature || !stateBounds) throw new Error("State boundary not loaded.");

    setStatus(`Loading BTC Map places for ${CONFIG.stateName} (search)…`);

    const results = await Promise.all(COVERAGE.map(fetchCircle));
    const flat = results.flat();

    const byId = new Map();
    for (const p of flat) {
      if (!p || typeof p.id !== "number") continue;
      if (!byId.has(p.id)) byId.set(p.id, p);
    }

    allFetched = [...byId.values()];

    inPlaces = allFetched.filter(p => {
      if (typeof p.lat !== "number" || typeof p.lon !== "number") return false;
      if (isExcludedCategory(p)) return false;

      const pt = [p.lon, p.lat];
      if (!pointInBounds(pt, stateBounds)) return false;
      return pointInFeature(pt, stateFeature);
    });

    setStatus(
      `Fetched ${allFetched.length.toLocaleString()} unique places near ${CONFIG.stateName}. ` +
      `${CONFIG.stateName}: ${inPlaces.length.toLocaleString()}.`
    );
    render();
  }

  // ---------- Events ----------
  qEl?.addEventListener("input", render);

  btnFit?.addEventListener("click", () => {
    if (stateOutlineLayer) map.fitBounds(stateOutlineLayer.getBounds(), { padding: [14, 14] });
  });

  btnReload?.addEventListener("click", async () => {
    try {
      await loadPlacesViaSearch();
    } catch (e) {
      console.error(e);
      setStatus(e?.message || String(e));
    }
  });

  // ---------- Boot ----------
  (async function boot() {
    try {
      await loadStatePolygon();
      await loadPlacesViaSearch();
      setStatus(`${statusEl.textContent} Ready.`);
    } catch (e) {
      console.error(e);
      setStatus(e?.message || String(e));
    }
  })();
})();
