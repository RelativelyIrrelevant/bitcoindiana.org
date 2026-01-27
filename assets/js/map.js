// assets/js/map.js
//
// Indiana map page logic for bitcoindiana.org using BTC Map API v4 SEARCH endpoint
// to avoid downloading worldwide places.
//
// Strategy:
// - Load Indiana polygon (assets/data/indiana.geojson)
// - Query BTC Map search endpoint with a few overlapping circles that cover Indiana
// - De-duplicate results by place id
// - Filter by Indiana polygon (point-in-polygon) for correctness near borders
// - Exclude categories: currency_exchange, local_atm
//
// Local testing:
//   python3 -m http.server 8000

(function () {
  // ---------- Config ----------
  const INDIANA_GEOJSON_URL = "/assets/data/indiana.geojson";

  // BTC Map Search endpoint (radius-based)
  // Docs: https://github.com/teambtcmap/btcmap-api/blob/master/docs/rest/v4/places.md
  const BTCMAP_SEARCH_URL = "https://api.btcmap.org/v4/places/search/";

  // Choose fields returned by search.
  // The docs show search returns many fields; field selection is not documented for search,
  // so we accept the default response and just use what we need.
  //
  // If BTC Map later adds ?fields= support to /search, we can tighten payload.

  const EXCLUDED_ICONS = new Set(["currency_exchange", "local_atm"]);

  // Indiana coverage circles (center + radius_km).
  // These are chosen to cover the state with overlap. Feel free to tweak.
  //
  // Notes:
  // - Indiana is roughly ~500km N-S and ~225km E-W.
  // - Larger radius = fewer requests but more over-fetch beyond borders.
  // - We still polygon-filter afterward, so over-fetch is fine.
  const IN_COVERAGE = [
    { name: "North",  lat: 41.55, lon: -86.20, radius_km: 120 },
    { name: "Central",lat: 39.85, lon: -86.15, radius_km: 150 },
    { name: "South",  lat: 38.35, lon: -86.75, radius_km: 140 },
    { name: "East",   lat: 40.05, lon: -85.35, radius_km: 120 },
    { name: "West",   lat: 40.05, lon: -87.25, radius_km: 120 }
  ];

  // ---------- DOM ----------
  const qEl = document.getElementById("q");
  const countEl = document.getElementById("count");
  const countNoteEl = document.getElementById("countNote");
  const statusEl = document.getElementById("status");
  const btnFit = document.getElementById("btnFit");
  const btnReload = document.getElementById("btnReload");

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

  // Bitcoin-orange dot marker (DivIcon)
  const btcIcon = L.divIcon({
    className: "",
    html: '<div class="btc-marker" aria-hidden="true"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });

  let indianaFeature = null;
  let indianaOutlineLayer = null;
  let indianaBounds = null; // {minLon,minLat,maxLon,maxLat}

  // Data
  let allFetched = [];  // pre-dedupe results from search
  let inPlaces = [];    // final filtered places

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
    if (!pointInRing(point, polygonCoordinates[0])) return false;
    for (let i = 1; i < polygonCoordinates.length; i++) {
      if (pointInRing(point, polygonCoordinates[i])) return false;
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
  async function loadIndianaPolygon() {
    setStatus("Loading Indiana boundary…");

    const res = await fetch(INDIANA_GEOJSON_URL, {
      headers: { "accept": "application/geo+json,application/json" }
    });
    if (!res.ok) throw new Error(`Failed to load Indiana boundary (HTTP ${res.status}).`);

    const geo = await res.json();
    if (geo.type === "Feature") indianaFeature = geo;
    else if (geo.type === "FeatureCollection" && Array.isArray(geo.features) && geo.features.length > 0) indianaFeature = geo.features[0];
    else throw new Error("indiana.geojson must be a GeoJSON Feature or FeatureCollection with at least one feature.");

    indianaBounds = featureBounds(indianaFeature);

    indianaOutlineLayer = L.geoJSON(indianaFeature, {
      style: { color: "#F7931A", weight: 2, opacity: 0.65, fillOpacity: 0.04 }
    }).addTo(map);

    map.fitBounds(indianaOutlineLayer.getBounds(), { padding: [14, 14] });
  }

  async function fetchCircle(circle) {
    // Builds:
    // https://api.btcmap.org/v4/places/search/?lat=..&lon=..&radius_km=..
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
    if (!indianaFeature || !indianaBounds) throw new Error("Indiana boundary not loaded.");

    setStatus("Loading BTC Map places for Indiana (search)…");

    // Fetch circles in parallel (a few requests)
    const results = await Promise.all(IN_COVERAGE.map(fetchCircle));

    // Flatten
    const flat = results.flat();

    // De-duplicate by numeric id
    const byId = new Map();
    for (const p of flat) {
      // Some safety checks
      if (!p || typeof p.id !== "number") continue;
      if (!byId.has(p.id)) byId.set(p.id, p);
    }

    allFetched = [...byId.values()];

    // Final filtering:
    // - must have coordinates
    // - exclude categories
    // - bounds pre-check
    // - point-in-polygon
    inPlaces = allFetched.filter(p => {
      if (typeof p.lat !== "number" || typeof p.lon !== "number") return false;
      if (isExcludedCategory(p)) return false;

      const pt = [p.lon, p.lat];
      if (!pointInBounds(pt, indianaBounds)) return false;
      return pointInFeature(pt, indianaFeature);
    });

    setStatus(`Fetched ${allFetched.length.toLocaleString()} unique places near Indiana. Indiana: ${inPlaces.length.toLocaleString()}.`);
    render();
  }

  // ---------- Events ----------
  qEl?.addEventListener("input", render);

  btnFit?.addEventListener("click", () => {
    if (indianaOutlineLayer) map.fitBounds(indianaOutlineLayer.getBounds(), { padding: [14, 14] });
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
      await loadIndianaPolygon();
      await loadPlacesViaSearch();
      setStatus(`${statusEl.textContent} Ready.`);
    } catch (e) {
      console.error(e);
      setStatus(e?.message || String(e));
    }
  })();
})();
