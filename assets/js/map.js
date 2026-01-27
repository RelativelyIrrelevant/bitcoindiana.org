// assets/js/map.js
//
// Map page logic for bitcoindiana.org.
//
// What this file does:
// 1) Creates a Leaflet map.
// 2) Loads Indiana boundary GeoJSON (assets/data/indiana.geojson).
// 3) Fetches BTC Map Places API v4 data.
// 4) Filters places:
//    - must have coordinates
//    - must be inside Indiana polygon (point-in-polygon)
//    - exclude categories (icon): currency_exchange, local_atm
// 5) Renders markers and popups with a "View on BTC Map" link.
//
// Performance notes:
// - The BTC Map /v4/places endpoint returns worldwide places.
// - To keep filtering fast, we compute Indiana's bounding box once and do a quick
//   bounds check before running point-in-polygon (ray casting).
//
// NOTE: For local testing, use a local server:
//   python3 -m http.server 8000
// Opening index.html via file:// often blocks fetch().

(function () {
  // ---------- Config ----------
  const INDIANA_GEOJSON_URL = "/assets/data/indiana.geojson";

  // Use field selection to keep payload smaller.
  // Docs: https://github.com/teambtcmap/btcmap-api/blob/master/docs/rest/v4/places.md
  const BTCMAP_PLACES_URL =
    "https://api.btcmap.org/v4/places" +
    "?fields=id,lat,lon,name,icon,address,website,phone,opening_hours,verified_at,updated_at,osm_url";

  // Excluded BTC Map "icon" categories (requested).
  const EXCLUDED_ICONS = new Set(["currency_exchange", "local_atm"]);

  // ---------- DOM elements ----------
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

  // ---------- Leaflet map ----------
  const map = L.map("map", { zoomControl: true });

  // Basemap tiles (OSM). If you expect heavy traffic, consider a hosted tiles provider.
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const markersLayer = L.layerGroup().addTo(map);

  // Custom bitcoin-orange marker (fast + readable).
  const btcIcon = L.divIcon({
    className: "", // don't use Leaflet default icon styles
    html: '<div class="btc-marker" aria-hidden="true"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });

  // We'll store the outline layer so we can fit bounds later.
  let indianaFeature = null;
  let indianaOutlineLayer = null;

  // A simple bounding box for Indiana used as a fast pre-filter
  // (computed from the polygon once).
  let indianaBounds = null; // {minLon, minLat, maxLon, maxLat}

  // Data caches
  let allPlaces = [];
  let inPlaces = [];

  // ---------- Geo helpers ----------
  // Ray-casting algorithm for a ring.
  // GeoJSON uses [lon, lat] ordering.
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

  // Polygon with optional holes.
  function pointInPolygon(point, polygonCoordinates) {
    // polygonCoordinates: [ outerRing, holeRing1, ... ]
    if (!polygonCoordinates || polygonCoordinates.length === 0) return false;

    // Must be inside outer ring
    if (!pointInRing(point, polygonCoordinates[0])) return false;

    // Must NOT be inside any holes
    for (let i = 1; i < polygonCoordinates.length; i++) {
      if (pointInRing(point, polygonCoordinates[i])) return false;
    }

    return true;
  }

  // Feature can be Polygon or MultiPolygon.
  function pointInFeature(point, feature) {
    const g = feature && feature.geometry;
    if (!g) return false;

    if (g.type === "Polygon") {
      return pointInPolygon(point, g.coordinates);
    }

    if (g.type === "MultiPolygon") {
      return g.coordinates.some(poly => pointInPolygon(point, poly));
    }

    return false;
  }

  // Compute a feature bounding box (min/max lon/lat).
  // Used to quickly reject points far outside Indiana before point-in-polygon.
  function featureBounds(feature) {
    const g = feature?.geometry;
    if (!g) throw new Error("Cannot compute bounds: missing geometry.");

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

    const scanRing = (ring) => {
      for (const coord of ring) {
        const lon = coord[0];
        const lat = coord[1];
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
    };

    if (g.type === "Polygon") {
      // Only the outer ring is needed for bounds.
      scanRing(g.coordinates[0]);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        scanRing(poly[0]);
      }
    } else {
      throw new Error(`Cannot compute bounds: unsupported geometry type ${g.type}`);
    }

    return { minLon, minLat, maxLon, maxLat };
  }

  function pointInBounds(point, b) {
    // point: [lon, lat]
    return (
      point[0] >= b.minLon && point[0] <= b.maxLon &&
      point[1] >= b.minLat && point[1] <= b.maxLat
    );
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

    // Render each place as a marker + popup.
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

    // Update count
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

    // Accept either Feature or FeatureCollection (take first feature).
    if (geo.type === "Feature") indianaFeature = geo;
    else if (geo.type === "FeatureCollection" && Array.isArray(geo.features) && geo.features.length > 0) indianaFeature = geo.features[0];
    else throw new Error("indiana.geojson must be a GeoJSON Feature or FeatureCollection with at least one feature.");

    // Compute bounds once (used for fast pre-filtering).
    indianaBounds = featureBounds(indianaFeature);

    // Draw the outline (helpful context; also used for fitBounds).
    indianaOutlineLayer = L.geoJSON(indianaFeature, {
      style: { color: "#F7931A", weight: 2, opacity: 0.65, fillOpacity: 0.04 }
    }).addTo(map);

    map.fitBounds(indianaOutlineLayer.getBounds(), { padding: [14, 14] });
  }

  async function loadPlaces() {
    if (!indianaFeature || !indianaBounds) throw new Error("Indiana boundary not loaded.");

    setStatus("Loading BTC Map places…");

    const res = await fetch(BTCMAP_PLACES_URL, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`BTC Map API error (HTTP ${res.status}).`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected BTC Map response: expected an array.");

    allPlaces = data;

    // Filter worldwide places down to Indiana-only + exclusions.
    inPlaces = allPlaces.filter(p => {
      if (typeof p.lat !== "number" || typeof p.lon !== "number") return false;
      if (isExcludedCategory(p)) return false;

      // Fast pre-check: reject points outside Indiana bounding box.
      const pt = [p.lon, p.lat];
      if (!pointInBounds(pt, indianaBounds)) return false;

      // Accurate check: point-in-polygon.
      return pointInFeature(pt, indianaFeature);
    });

    setStatus(`Loaded ${allPlaces.length.toLocaleString()} places. Indiana: ${inPlaces.length.toLocaleString()}.`);
    render();
  }

  // ---------- Event wiring ----------
  qEl?.addEventListener("input", render);

  btnFit?.addEventListener("click", () => {
    if (indianaOutlineLayer) map.fitBounds(indianaOutlineLayer.getBounds(), { padding: [14, 14] });
  });

  btnReload?.addEventListener("click", async () => {
    try {
      await loadPlaces();
    } catch (e) {
      console.error(e);
      setStatus(e?.message || String(e));
    }
  });

  // ---------- Boot ----------
  (async function boot() {
    try {
      await loadIndianaPolygon();
      await loadPlaces();
      setStatus(`${statusEl.textContent} Ready.`);
    } catch (e) {
      console.error(e);
      setStatus(e?.message || String(e));
    }
  })();
})();
