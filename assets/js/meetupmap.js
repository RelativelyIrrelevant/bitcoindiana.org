// assets/js/meetupmap.js
// Map + search for Indiana Bitcoin meetups from a local JSON file.
//
// Local testing:
//   python3 -m http.server 8000
//
(function () {
  const BASE = new URL("..", window.location.href); // parent of /meetups/
  const INDIANA_GEOJSON_URL = new URL("assets/data/indiana.geojson", BASE).toString();
  const MEETUPS_URL = new URL("assets/data/meetups.json", BASE).toString();

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

  function googleMapsUrlForAddress(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  function asText(v) {
    return String(v ?? "").trim();
  }

  function normalizeStateCode(v) {
    const s = asText(v).toUpperCase();
    return /^[A-Z]{2}$/.test(s) ? s : "";
  }

  function normalizeStateName(v) {
    // Keep human casing as provided; just trim.
    return asText(v);
  }

  // If the user types exactly 2 letters (optionally with punctuation/spaces),
  // treat it as a state code search (exact match) rather than substring search.
  // Example: "IN" should match Indiana only, not "bitcoIN" in meetup names.
  function parseTwoLetterStateCodeQuery(qRaw) {
    const q = asText(qRaw);
    if (!q) return null;

    // Remove anything that's not a letter, then upper-case
    const lettersOnly = q.replace(/[^a-z]/gi, "").toUpperCase();

    if (/^[A-Z]{2}$/.test(lettersOnly)) return lettersOnly;
    return null;
  }

  // ---------- Leaflet ----------
  const map = L.map("map", { zoomControl: true });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const markersLayer = L.layerGroup().addTo(map);

  // Same orange dot as your merchant map
  const btcIcon = L.divIcon({
    className: "",
    html: '<div class="btc-marker" aria-hidden="true"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });

  let indianaOutlineLayer = null;
  let meetups = [];

  // ---------- Loaders ----------
  async function loadIndianaPolygon() {
    setStatus("Loading Indiana boundary…");

    const res = await fetch(INDIANA_GEOJSON_URL, {
      headers: { "accept": "application/geo+json,application/json" }
    });
    if (!res.ok) throw new Error(`Failed to load Indiana boundary (HTTP ${res.status}).`);

    const geo = await res.json();
    const feature =
      geo.type === "Feature" ? geo :
      (geo.type === "FeatureCollection" && geo.features?.[0]) ? geo.features[0] :
      null;

    if (!feature) throw new Error("indiana.geojson must be a GeoJSON Feature or a FeatureCollection with at least one feature.");

    indianaOutlineLayer = L.geoJSON(feature, {
      style: { color: "#F7931A", weight: 2, opacity: 0.65, fillOpacity: 0.04 }
    }).addTo(map);

    map.fitBounds(indianaOutlineLayer.getBounds(), { padding: [14, 14] });
  }

  async function loadMeetups() {
    setStatus("Loading meetups…");

    const res = await fetch(MEETUPS_URL, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`Failed to load meetups.json (HTTP ${res.status}).`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("meetups.json must be an array of meetup objects.");

    // Normalize + light validation
    meetups = data
      .filter(m => m && Number.isFinite(m.lat) && Number.isFinite(m.lon))
      .map(m => {
        const stateLegacy = normalizeStateCode(m.state); // your original field
        const stateCode = normalizeStateCode(m.state_code) || stateLegacy;
        const stateName = normalizeStateName(m.state_name);

        return {
          id: asText(m.id) || `${asText(m.name)}-${m.lat}-${m.lon}`,
          name: asText(m.name) || "Bitcoin Meetup",
          schedule: asText(m.schedule),
          day: asText(m.day),
          frequency: asText(m.frequency),
          venue: asText(m.venue),
          address: asText(m.address),
          city: asText(m.city),
          county: asText(m.county),

          // Keep legacy + new fields
          state: stateLegacy || stateCode,     // keep something reasonable here
          state_code: stateCode,
          state_name: stateName,

          zip: asText(m.zip),
          lat: m.lat,
          lon: m.lon,
          notes: asText(m.notes),
          links: Array.isArray(m.links) ? m.links.filter(Boolean).map(l => ({
            type: asText(l.type),
            label: asText(l.label),
            url: asText(l.url)
          })) : []
        };
      });

    setStatus(`Loaded ${meetups.length} meetup(s).`);
  }

  // ---------- Search ----------
  function meetupHaystack(m) {
    // Search “most fields” including link label + url.
    // Includes both state_code and state_name so either format can be found.
    const linkText = (m.links || [])
      .map(l => `${l.type} ${l.label} ${l.url}`.trim())
      .join(" ");

    return [
      m.name, m.schedule, m.day, m.frequency,
      m.venue, m.address, m.city, m.county,

      // State fields
      m.state, m.state_code, m.state_name,

      m.zip,
      m.notes,
      linkText
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function matchesQuery(m, qRaw) {
    const q = asText(qRaw);
    if (!q) return true;

    // Special case: 2-letter query acts like "filter by state code"
    const stateCodeQuery = parseTwoLetterStateCodeQuery(q);
    if (stateCodeQuery) {
      return (m.state_code || "").toUpperCase() === stateCodeQuery;
    }

    // Otherwise do normal substring search
    return meetupHaystack(m).includes(q.toLowerCase());
  }

  // ---------- Rendering ----------
  function renderLinks(links) {
    if (!Array.isArray(links)) return "";

    const rows = links
      .filter(l => l && l.url)
      .map(l => {
        const label = l.label || l.type || l.url;
        return `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
      });

    if (rows.length === 0) return "";
    return `<div style="margin-top:8px; display:grid; gap:6px;">${rows.join("")}</div>`;
  }

  function render() {
    const q = (qEl?.value || "").trim();

    markersLayer.clearLayers();
    const filtered = meetups.filter(m => matchesQuery(m, q));

    for (const m of filtered) {
      const title = m.name;
      const whenLine = m.schedule || [m.frequency, m.day].filter(Boolean).join(" ");
      const stateLine = [m.city, m.state_code || m.state_name || m.state].filter(Boolean).join(", ");

      const popup = `
        <div style="min-width:220px; max-width:360px;">
          <div style="font-weight:800; margin-bottom:6px;">${escapeHtml(m.name)}</div>

          ${stateLine ? `<div style="margin-bottom:6px; color:#9db0c6; font-size:12.5px;">${escapeHtml(stateLine)}</div>` : ""}

          ${whenLine ? `<div style="margin-bottom:6px;"><strong>When:</strong><br/>${escapeHtml(whenLine)}</div>` : ""}

          ${m.venue ? `<div style="margin-bottom:6px;"><strong>Where:</strong><br/>${escapeHtml(m.venue)}</div>` : ""}

          ${m.address ? `<div style="margin-bottom:6px;"><strong>Address:</strong><br/><a href="${googleMapsUrlForAddress(m.address)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.address)}</a></div>` : ""}

          ${renderLinks(m.links)}

          ${m.notes ? `<div style="margin-top:8px; color:#9db0c6; font-size:12.5px;">${escapeHtml(m.notes)}</div>` : ""}
        </div>
      `;

      L.marker([m.lat, m.lon], { title, icon: btcIcon })
        .addTo(markersLayer)
        .bindPopup(popup);
    }

    if (countEl) countEl.textContent = String(filtered.length);
    if (countNoteEl) countNoteEl.textContent = (filtered.length === 1) ? "meetup" : "meetups";

    // Optional: show a helpful status when state-code filtering is active
    const stateCodeQuery = parseTwoLetterStateCodeQuery(q);
    if (stateCodeQuery) {
      setStatus(`Filtering by state code: ${stateCodeQuery}. Showing ${filtered.length} meetup(s).`);
    }
  }

  // ---------- Events ----------
  qEl?.addEventListener("input", render);

  btnFit?.addEventListener("click", () => {
    if (indianaOutlineLayer) map.fitBounds(indianaOutlineLayer.getBounds(), { padding: [14, 14] });
  });

  btnReload?.addEventListener("click", async () => {
    try {
      await loadMeetups();
      render();
      setStatus(`Loaded ${meetups.length} meetup(s).`);
    } catch (e) {
      console.error(e);
      setStatus(e?.message || String(e));
    }
  });

  // ---------- Boot ----------
  (async function boot() {
    try {
      await loadIndianaPolygon();
      await loadMeetups();
      render();
      setStatus(`Loaded ${meetups.length} meetup(s). Ready.`);
    } catch (e) {
      console.error(e);
      setStatus(e?.message || String(e));
    }
  })();
})();
