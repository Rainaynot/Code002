/* =====================================================================
 * Bengaluru Zone Manager - Main Application (v2)
 * ===================================================================== */

(function () {
  "use strict";

  const {
    BENGALURU_BOUNDARY, MAIN_ZONES, ZONE_COLOR_PRESETS,
    PINCODES, CITY_CENTRE, RADIUS_LIMIT_KM
  } = window.BZM_DATA;

  // ============ STATE ============
  const state = {
    map: null,
    layers: {
      boundary:  null,
      pincodes:  null,
      zones:     null,
      custom:    null,
      highlight: null
    },
    show: { pincodes: false, zones: false },
    customZones: [],            // { id, name, color, pincodes:[codes], polygon }
    pincodeFeatures: {},        // code -> turf Feature
    zoneFeatures: {},           // zoneId -> turf Feature
    activeSelection: null,      // { type, id }
    editingZoneId: null,        // when editing a sub-zone, id is set
    selectedColor: ZONE_COLOR_PRESETS[0]
  };

  // ============ HELPERS ============
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function computeAreaKm2(feature) {
    if (!feature) return 0;
    try { return turf.area(feature) / 1_000_000; } catch { return 0; }
  }

  function computeRadiusKm(feature) {
    if (!feature) return { centerLngLat: null, radiusKm: 0 };
    try {
      const center = turf.centerOfMass(feature);
      const coords = turf.coordAll(feature);
      let maxD = 0;
      for (const c of coords) {
        const d = turf.distance(center, turf.point(c), { units: "kilometers" });
        if (d > maxD) maxD = d;
      }
      return { centerLngLat: center.geometry.coordinates, radiusKm: maxD };
    } catch {
      return { centerLngLat: null, radiusKm: 0 };
    }
  }

  function safeUnion(a, b) {
    try { return turf.union(a, b); }
    catch (e) { console.warn("turf.union failed", e); return a; }
  }
  function unionAll(features) {
    if (features.length === 0) return null;
    let u = features[0];
    for (let i = 1; i < features.length; i++) u = safeUnion(u, features[i]);
    return u;
  }

  // ============ STEP 1: BUILD PINCODE POLYGONS (Voronoi) ============
  function buildPincodePolygons() {
    const boundary = state.boundary || BENGALURU_BOUNDARY;
    const clipPoly = toClipPolygon(boundary);

    const points = PINCODES.map(p => [p.lng, p.lat]);
    const delaunay = d3.Delaunay.from(points);
    const [minX, minY, maxX, maxY] = turf.bbox(boundary);
    const pad = 0.05;
    const voronoi = delaunay.voronoi([minX - pad, minY - pad, maxX + pad, maxY + pad]);

    PINCODES.forEach((p, i) => {
      const cell = voronoi.cellPolygon(i);
      if (!cell) return;
      try {
        const cellFeat = turf.polygon([cell]);
        const clipped  = turf.intersect(cellFeat, clipPoly);
        if (clipped) {
          clipped.properties = { code: p.code, area: p.area, zone: p.zone, lat: p.lat, lng: p.lng };
          state.pincodeFeatures[p.code] = clipped;
        }
      } catch (e) {
        console.warn(`Failed to clip pincode ${p.code}`, e);
      }
    });
  }

  // ============ STEP 0: FETCH LIVE OSM BOUNDARY ============
  // Fetches Bengaluru's real administrative boundary from OpenStreetMap via Nominatim.
  // Falls back to embedded polygon if offline / API fails. Caches in localStorage for 24h.
  async function fetchOSMBoundary() {
    const cacheKey = "bzm-osm-boundary-v2";

    // 1. Try cached
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (cached && cached.ts && (Date.now() - cached.ts < 86400000) && cached.feature) {
        setMapEngineStatus("OpenStreetMap Boundary Engine (cached)", "ok");
        return cached.feature;
      }
    } catch {}

    // 2. Fetch from Nominatim
    try {
      setMapEngineStatus("Fetching OSM boundary…", "loading");
      const url = "https://nominatim.openstreetmap.org/search"
        + "?q=" + encodeURIComponent("Bengaluru, Karnataka, India")
        + "&format=json&polygon_geojson=1&limit=10";
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      // Pick best polygon match: prefer admin boundaries with largest area
      let best = null;
      for (const d of data) {
        if (!d.geojson) continue;
        if (d.geojson.type !== "Polygon" && d.geojson.type !== "MultiPolygon") continue;
        if (!best || (d.place_rank && best.place_rank && d.place_rank < best.place_rank)) {
          best = d;
        }
      }

      if (best && best.geojson) {
        const feature = {
          type: "Feature",
          properties: { name: best.display_name || "Bengaluru", source: "OSM-Nominatim" },
          geometry: best.geojson
        };
        try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), feature })); } catch {}
        setMapEngineStatus("OpenStreetMap Boundary Engine (Leaflet Live)", "ok");
        return feature;
      }
    } catch (e) {
      console.warn("OSM boundary fetch failed, using embedded fallback:", e);
    }

    setMapEngineStatus("Embedded boundary (offline)", "warn");
    return BENGALURU_BOUNDARY;
  }

  function setMapEngineStatus(text, kind) {
    const el = document.getElementById("map-engine-status");
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind || "ok";
  }

  // Returns a single Polygon Feature suitable for turf.intersect (picks largest ring of MultiPolygon)
  function toClipPolygon(feature) {
    if (!feature || !feature.geometry) return feature;
    const g = feature.geometry;
    if (g.type === "Polygon") return feature;
    if (g.type === "MultiPolygon") {
      // Pick the largest sub-polygon by area
      let bestRing = null, bestArea = 0;
      for (const poly of g.coordinates) {
        try {
          const f = turf.polygon(poly);
          const a = turf.area(f);
          if (a > bestArea) { bestArea = a; bestRing = poly; }
        } catch {}
      }
      if (bestRing) return turf.polygon(bestRing);
    }
    return feature;
  }

  // ============ STEP 2: BUILD MAIN ZONE POLYGONS ============
  function buildZonePolygons() {
    MAIN_ZONES.forEach(zone => {
      const feats = PINCODES
        .filter(p => p.zone === zone.id)
        .map(p => state.pincodeFeatures[p.code])
        .filter(Boolean);
      const union = unionAll(feats);
      if (union) {
        union.properties = { zoneId: zone.id, name: zone.name, color: zone.color };
        state.zoneFeatures[zone.id] = union;
      }
    });
  }

  // ============ STEP 3: MAP INIT ============
  function initMap() {
    state.map = L.map("map", {
      center: [CITY_CENTRE.lat, CITY_CENTRE.lng],
      zoom: 11,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(state.map);

    state.layers.pincodes  = L.layerGroup().addTo(state.map);
    state.layers.zones     = L.layerGroup().addTo(state.map);
    state.layers.custom    = L.layerGroup().addTo(state.map);
    state.layers.highlight = L.layerGroup().addTo(state.map);

    drawBoundary();
  }

  function drawBoundary() {
    const boundary = state.boundary || BENGALURU_BOUNDARY;

    // Halo / glow layer underneath
    const halo = L.geoJSON(boundary, {
      style: {
        color: "#06b6d4",
        weight: 8,
        opacity: 0.18,
        fill: false,
        lineCap: "round",
        lineJoin: "round"
      },
      interactive: false
    }).addTo(state.map);

    // Main solid boundary
    state.layers.boundary = L.geoJSON(boundary, {
      style: {
        color: "#22d3ee",
        weight: 2.5,
        fillColor: "#06b6d4",
        fillOpacity: 0.04,
        lineCap: "round",
        lineJoin: "round"
      },
      interactive: false
    }).addTo(state.map);

    state.layers._boundaryHalo = halo;

    state.map.fitBounds(state.layers.boundary.getBounds(), { padding: [20, 20] });
  }

  // ============ RENDER LAYERS ============
  function renderPincodes() {
    state.layers.pincodes.clearLayers();
    if (!state.show.pincodes) return;

    PINCODES.forEach(p => {
      const feat = state.pincodeFeatures[p.code];
      if (!feat) return;
      const zone = MAIN_ZONES.find(z => z.id === p.zone);

      const layer = L.geoJSON(feat, {
        style: {
          color: zone.color,
          weight: 1,
          fillColor: zone.color,
          fillOpacity: 0.15
        }
      });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        showPincodeInfo(p.code);
      });
      layer.bindTooltip(`${p.code} — ${p.area}`, { sticky: true, className: "pincode-label" });

      state.layers.pincodes.addLayer(layer);
    });
  }

  function renderZones() {
    state.layers.zones.clearLayers();
    if (!state.show.zones) return;

    MAIN_ZONES.forEach(zone => {
      const feat = state.zoneFeatures[zone.id];
      if (!feat) return;

      const layer = L.geoJSON(feat, {
        style: {
          color: zone.color, weight: 2.5,
          fillColor: zone.color, fillOpacity: 0.20
        }
      });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        showZoneInfo(zone.id);
      });
      layer.bindTooltip(zone.name, {
        permanent: true, direction: "center", className: "zone-label"
      });
      state.layers.zones.addLayer(layer);
    });
  }

  function renderCustomZones() {
    state.layers.custom.clearLayers();
    state.customZones.forEach(cz => {
      if (!cz.polygon) return;
      const layer = L.geoJSON(cz.polygon, {
        style: {
          color: cz.color, weight: 2.5,
          fillColor: cz.color, fillOpacity: 0.25,
          dashArray: "5 3"
        }
      });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        showCustomZoneInfo(cz.id);
      });
      layer.bindTooltip(cz.name, {
        permanent: true, direction: "center", className: "zone-label"
      });
      state.layers.custom.addLayer(layer);
    });
  }

  // ============ HIGHLIGHT ============
  function clearHighlight() {
    state.layers.highlight.clearLayers();
    state.activeSelection = null;
    $$(".zone-list li, .pincode-list li").forEach(li => li.classList.remove("active"));
  }

  function highlightFeature(feature, color, opts = {}) {
    state.layers.highlight.clearLayers();

    const fillLayer = L.geoJSON(feature, {
      style: {
        color: color, weight: 3.5,
        fillColor: color, fillOpacity: 0.45,
        dashArray: opts.dashed ? "6 4" : null
      }
    });
    state.layers.highlight.addLayer(fillLayer);

    const { centerLngLat, radiusKm } = computeRadiusKm(feature);
    if (centerLngLat) {
      const center = [centerLngLat[1], centerLngLat[0]];

      L.circleMarker(center, {
        radius: 5, color: "#fff", weight: 2,
        fillColor: color, fillOpacity: 1
      }).addTo(state.layers.highlight);

      L.circle(center, {
        radius: radiusKm * 1000,
        color: radiusKm > RADIUS_LIMIT_KM ? "#ef4444" : "#10b981",
        weight: 1.5, fillOpacity: 0.04, dashArray: "4 4"
      }).addTo(state.layers.highlight);

      L.circle(center, {
        radius: RADIUS_LIMIT_KM * 1000,
        color: "#06b6d4", weight: 1, dashArray: "2 4", fillOpacity: 0
      }).addTo(state.layers.highlight);
    }

    try {
      state.map.fitBounds(fillLayer.getBounds(), { padding: [40, 40], maxZoom: 14 });
    } catch {}
  }

  // ============ INFO PANEL ============
  function renderInfoEmpty() {
    $("#info-panel").innerHTML = `
      <div class="info-empty">
        <div class="info-empty-icon">⊕</div>
        <p class="muted">Click any zone or pincode on the map (or in the sidebar) to see details here.</p>
      </div>`;
  }

  function limitBadge(radiusKm) {
    const over = radiusKm > RADIUS_LIMIT_KM;
    const label = over
      ? `Exceeds ${RADIUS_LIMIT_KM} km limit`
      : `Within ${RADIUS_LIMIT_KM} km limit`;
    return `<span class="limit-badge ${over ? "over" : "ok"}">${label}</span>`;
  }

  function pincodeRowsHTML(codes) {
    return codes.map(code => {
      const p = PINCODES.find(x => x.code === code);
      if (!p) return "";
      const zone = MAIN_ZONES.find(z => z.id === p.zone);
      return `
        <li data-jump-pincode="${p.code}">
          <span class="pin-row-dot" style="background:${zone.color}"></span>
          <span class="pin-row-code">${p.code}</span>
          <span class="pin-row-area">${p.area}</span>
        </li>`;
    }).join("");
  }

  function attachPincodeRowJump(rootEl) {
    $$("[data-jump-pincode]", rootEl).forEach(li => {
      li.addEventListener("click", () => {
        if (!state.show.pincodes) togglePincodes(true);
        showPincodeInfo(li.dataset.jumpPincode);
      });
    });
  }

  function showPincodeInfo(code) {
    const p = PINCODES.find(x => x.code === code);
    const feat = state.pincodeFeatures[code];
    if (!p || !feat) return;

    const zone = MAIN_ZONES.find(z => z.id === p.zone);
    const area = computeAreaKm2(feat);
    const { radiusKm } = computeRadiusKm(feat);

    state.activeSelection = { type: "pincode", id: code };
    highlightFeature(feat, zone.color);

    $$(".pincode-list li").forEach(li => li.classList.toggle("active", li.dataset.code === code));

    $("#info-panel").innerHTML = `
      <div class="info-card">
        <span class="info-type-badge info-type-pin">Pincode</span>
        <div class="info-header">
          <div class="info-color" style="background:${zone.color}"></div>
          <div>
            <h3 class="info-title">${p.code}</h3>
            <p class="info-subtitle">${p.area}</p>
          </div>
        </div>

        <div class="kv"><span class="k">Belongs to Zone</span><span class="v" style="color:${zone.color}">${zone.name}</span></div>
        <div class="kv"><span class="k">Area Name</span><span class="v">${p.area}</span></div>
        <div class="kv"><span class="k">Centroid</span><span class="v">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</span></div>
        <div class="kv"><span class="k">Coverage Area</span><span class="v">${area.toFixed(2)} km²</span></div>
        <div class="kv"><span class="k">Max Reach (centre→edge)</span><span class="v">${radiusKm.toFixed(2)} km</span></div>

        <div class="section-title">Service Range</div>
        ${limitBadge(radiusKm)}
      </div>
    `;
  }

  function showZoneInfo(zoneId) {
    const zone = MAIN_ZONES.find(z => z.id === zoneId);
    const feat = state.zoneFeatures[zoneId];
    if (!zone || !feat) return;

    const pins = PINCODES.filter(p => p.zone === zoneId);
    const area = computeAreaKm2(feat);
    const { radiusKm } = computeRadiusKm(feat);

    state.activeSelection = { type: "zone", id: zoneId };
    highlightFeature(feat, zone.color);

    $$("#zone-list li").forEach(li => li.classList.toggle("active", li.dataset.zone === zoneId));

    $("#info-panel").innerHTML = `
      <div class="info-card">
        <span class="info-type-badge info-type-main">Main Zone</span>
        <div class="info-header">
          <div class="info-color" style="background:${zone.color}"></div>
          <div>
            <h3 class="info-title">${zone.name}</h3>
            <p class="info-subtitle">${pins.length} pincodes covered</p>
          </div>
        </div>

        <div class="kv"><span class="k">Total Coverage</span><span class="v">${area.toFixed(2)} km²</span></div>
        <div class="kv"><span class="k">Max Radius</span><span class="v">${radiusKm.toFixed(2)} km</span></div>
        <div class="kv"><span class="k">Pincodes Covered</span><span class="v">${pins.length}</span></div>

        <div class="section-title">Service Range</div>
        ${limitBadge(radiusKm)}

        <div class="section-title">Areas in this zone</div>
        <ul class="pin-row-list">
          ${pincodeRowsHTML(pins.map(p => p.code))}
        </ul>
      </div>
    `;
    attachPincodeRowJump($("#info-panel"));
  }

  function showCustomZoneInfo(czId) {
    const cz = state.customZones.find(z => z.id === czId);
    if (!cz || !cz.polygon) return;

    const area = computeAreaKm2(cz.polygon);
    const { radiusKm } = computeRadiusKm(cz.polygon);

    state.activeSelection = { type: "custom", id: czId };
    highlightFeature(cz.polygon, cz.color, { dashed: true });

    $("#info-panel").innerHTML = `
      <div class="info-card">
        <span class="info-type-badge info-type-sub">Sub Zone</span>
        <div class="info-header">
          <div class="info-color" style="background:${cz.color}"></div>
          <div>
            <h3 class="info-title">${cz.name}</h3>
            <p class="info-subtitle">${cz.pincodes.length} pincodes · custom</p>
          </div>
        </div>

        <div class="kv"><span class="k">Total Coverage</span><span class="v">${area.toFixed(2)} km²</span></div>
        <div class="kv"><span class="k">Max Radius</span><span class="v">${radiusKm.toFixed(2)} km</span></div>
        <div class="kv"><span class="k">Pincodes</span><span class="v">${cz.pincodes.length}</span></div>

        <div class="section-title">Service Range</div>
        ${limitBadge(radiusKm)}

        <div class="section-title">Areas in this sub-zone</div>
        <ul class="pin-row-list">
          ${pincodeRowsHTML(cz.pincodes)}
        </ul>

        <div class="card-actions">
          <button class="btn btn-sm" data-edit-cz="${cz.id}">✎ Edit</button>
          <button class="btn btn-sm btn-danger" data-delete-cz="${cz.id}">🗑 Delete</button>
        </div>
      </div>
    `;
    attachPincodeRowJump($("#info-panel"));

    $(`[data-edit-cz="${cz.id}"]`).addEventListener("click", () => startEditZone(cz.id));
    $(`[data-delete-cz="${cz.id}"]`).addEventListener("click", () => deleteCustomZone(cz.id));
  }

  function showCombinedInfo(zoneIds, feature, names, colors, kinds) {
    const area = computeAreaKm2(feature);
    const { radiusKm } = computeRadiusKm(feature);
    const totalPincodes = new Set();
    zoneIds.forEach((id, i) => {
      if (kinds[i] === "main") {
        PINCODES.filter(p => p.zone === id).forEach(p => totalPincodes.add(p.code));
      } else {
        const cz = state.customZones.find(z => z.id === id);
        if (cz) cz.pincodes.forEach(c => totalPincodes.add(c));
      }
    });

    state.activeSelection = { type: "combined", id: zoneIds.join("+") };

    const colorBlocks = colors.map(c =>
      `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${c};margin-right:4px;vertical-align:middle"></span>`
    ).join("");

    $("#info-panel").innerHTML = `
      <div class="info-card">
        <span class="info-type-badge info-type-com">Combined</span>
        <div class="info-header">
          <div>${colorBlocks}</div>
          <div>
            <h3 class="info-title">Combined Zone</h3>
            <p class="info-subtitle">${names.join(" + ")}</p>
          </div>
        </div>

        <div class="kv"><span class="k">Combined Area</span><span class="v">${area.toFixed(2)} km²</span></div>
        <div class="kv"><span class="k">Max Radius</span><span class="v">${radiusKm.toFixed(2)} km</span></div>
        <div class="kv"><span class="k">Total Pincodes</span><span class="v">${totalPincodes.size}</span></div>
        <div class="kv"><span class="k">Zones Combined</span><span class="v">${zoneIds.length}</span></div>

        <div class="section-title">Service Range</div>
        ${limitBadge(radiusKm)}

        <div class="section-title">Areas covered</div>
        <ul class="pin-row-list">
          ${pincodeRowsHTML(Array.from(totalPincodes).sort())}
        </ul>
      </div>
    `;
    attachPincodeRowJump($("#info-panel"));
  }

  // ============ SIDEBAR LISTS ============
  function renderZoneList() {
    const list = $("#zone-list");
    list.innerHTML = "";
    MAIN_ZONES.forEach(zone => {
      const pins = PINCODES.filter(p => p.zone === zone.id);
      const feat = state.zoneFeatures[zone.id];
      const area = feat ? computeAreaKm2(feat) : 0;

      const li = document.createElement("li");
      li.dataset.zone = zone.id;
      li.innerHTML = `
        <span class="zone-dot" style="background:${zone.color}"></span>
        <div>
          <div class="row-title">${zone.name}</div>
          <div class="row-meta">${pins.length} pincodes · ${area.toFixed(1)} km²</div>
        </div>
      `;
      li.addEventListener("click", () => {
        if (!state.show.zones) toggleZones(true);
        showZoneInfo(zone.id);
      });
      list.appendChild(li);
    });
    $("#main-zone-count").textContent = MAIN_ZONES.length;
  }

  function renderCustomZoneList() {
    const list = $("#custom-zone-list");
    if (state.customZones.length === 0) {
      list.innerHTML = `<li class="empty">No sub-zones yet. Create one above.</li>`;
    } else {
      list.innerHTML = "";
      state.customZones.forEach(cz => {
        const area = computeAreaKm2(cz.polygon);
        const { radiusKm } = computeRadiusKm(cz.polygon);
        const li = document.createElement("li");
        li.dataset.custom = cz.id;
        li.innerHTML = `
          <span class="zone-dot" style="background:${cz.color}"></span>
          <div>
            <div class="row-title">${cz.name}</div>
            <div class="row-meta">${cz.pincodes.length} pincodes · ${area.toFixed(1)} km² · ${radiusKm.toFixed(1)} km reach</div>
          </div>
          <div class="zone-actions">
            <button class="icon-btn" title="Edit"   data-edit-cz="${cz.id}">✎</button>
            <button class="icon-btn danger" title="Delete" data-delete-cz="${cz.id}">×</button>
          </div>
        `;

        li.addEventListener("click", (e) => {
          if (e.target.closest("[data-edit-cz]"))   return;
          if (e.target.closest("[data-delete-cz]")) return;
          showCustomZoneInfo(cz.id);
        });
        $(`[data-edit-cz="${cz.id}"]`,   li).addEventListener("click", (e) => { e.stopPropagation(); startEditZone(cz.id); });
        $(`[data-delete-cz="${cz.id}"]`, li).addEventListener("click", (e) => { e.stopPropagation(); deleteCustomZone(cz.id); });

        list.appendChild(li);
      });
    }
    $("#sub-zone-count").textContent = state.customZones.length;
    $("#stat-custom").textContent = state.customZones.length;
  }

  function renderPincodeList(searchTerm = "", zoneFilter = "") {
    const list = $("#pincode-list");
    list.innerHTML = "";
    const term = searchTerm.trim().toLowerCase();
    const filtered = PINCODES.filter(p => {
      if (zoneFilter && p.zone !== zoneFilter) return false;
      if (!term) return true;
      return p.code.toLowerCase().includes(term) || p.area.toLowerCase().includes(term);
    });

    $("#pincode-count").textContent = filtered.length;

    if (filtered.length === 0) {
      list.innerHTML = `<li class="empty">No matches found.</li>`;
      return;
    }

    filtered.forEach(p => {
      const zone = MAIN_ZONES.find(z => z.id === p.zone);
      const li = document.createElement("li");
      li.dataset.code = p.code;
      li.innerHTML = `
        <span class="zone-dot" style="background:${zone.color}"></span>
        <span class="pincode-code">${p.code}</span>
        <span class="pincode-area">${p.area}</span>
        <span class="pincode-zone-tag" style="color:${zone.color}">${zone.id}</span>
      `;
      li.addEventListener("click", () => {
        if (!state.show.pincodes) togglePincodes(true);
        showPincodeInfo(p.code);
      });
      list.appendChild(li);
    });
  }

  function renderCreatePincodeList(searchTerm = "", preserveCheckedCodes = null) {
    const list = $("#create-pincode-list");
    list.innerHTML = "";
    const term = searchTerm.trim().toLowerCase();
    const filtered = PINCODES.filter(p =>
      !term || p.code.toLowerCase().includes(term) || p.area.toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
      list.innerHTML = `<li class="empty">No matches.</li>`;
      updateSelectionCount();
      return;
    }

    const checkedSet = preserveCheckedCodes
      ? new Set(preserveCheckedCodes)
      : new Set($$("#create-pincode-list input:checked").map(i => i.dataset.code));

    filtered.forEach(p => {
      const zone = MAIN_ZONES.find(z => z.id === p.zone);
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="checkbox" data-code="${p.code}" ${checkedSet.has(p.code) ? "checked" : ""} />
        <span class="zone-dot" style="background:${zone.color}"></span>
        <span class="pincode-code">${p.code}</span>
        <span class="pincode-area">${p.area}</span>
      `;
      $("input", li).addEventListener("change", updateSelectionCount);
      list.appendChild(li);
    });

    updateSelectionCount();
  }

  function getAllSelectedCreateCodes() {
    return $$("#create-pincode-list input:checked").map(i => i.dataset.code);
  }

  function updateSelectionCount() {
    $("#selection-count").textContent = getAllSelectedCreateCodes().length;
  }

  function renderCombineList() {
    const main = $("#combine-main-list");
    main.innerHTML = "";
    MAIN_ZONES.forEach(zone => {
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="checkbox" data-zone-id="${zone.id}" data-zone-kind="main" />
        <span class="zone-dot" style="background:${zone.color}"></span>
        <div>
          <div class="row-title">${zone.name}</div>
          <div class="row-meta">${PINCODES.filter(p => p.zone === zone.id).length} pincodes</div>
        </div>
      `;
      main.appendChild(li);
    });

    const sub = $("#combine-sub-list");
    if (state.customZones.length === 0) {
      sub.innerHTML = `<li class="empty">No sub-zones to combine yet.</li>`;
    } else {
      sub.innerHTML = "";
      state.customZones.forEach(cz => {
        const li = document.createElement("li");
        li.innerHTML = `
          <input type="checkbox" data-zone-id="${cz.id}" data-zone-kind="custom" />
          <span class="zone-dot" style="background:${cz.color}"></span>
          <div>
            <div class="row-title">${cz.name}</div>
            <div class="row-meta">${cz.pincodes.length} pincodes</div>
          </div>
        `;
        sub.appendChild(li);
      });
    }
  }

  function populateZoneFilter() {
    const sel = $("#pincode-zone-filter");
    sel.innerHTML = `<option value="">All zones</option>` +
      MAIN_ZONES.map(z => `<option value="${z.id}">${z.name}</option>`).join("");
  }

  // ============ COLOR PALETTE ============
  function renderColorPalette() {
    const wrap = $("#color-palette");
    wrap.innerHTML = "";
    ZONE_COLOR_PRESETS.forEach((c, i) => {
      const sw = document.createElement("div");
      sw.className = "color-swatch";
      if (c === state.selectedColor) sw.classList.add("selected");
      sw.style.background = c;
      sw.title = c;
      sw.addEventListener("click", () => {
        state.selectedColor = c;
        $("#new-zone-color").value = c;
        $$(".color-swatch").forEach(s => s.classList.toggle("selected", s.dataset.color === c));
      });
      sw.dataset.color = c;
      wrap.appendChild(sw);
    });

    $("#new-zone-color").addEventListener("input", (e) => {
      state.selectedColor = e.target.value;
      $$(".color-swatch").forEach(s => s.classList.remove("selected"));
    });
  }

  // ============ STATS ============
  function updateStats() {
    $("#stat-zones").textContent    = MAIN_ZONES.length;
    $("#stat-pincodes").textContent = PINCODES.length;
    $("#stat-custom").textContent   = state.customZones.length;
    let total = 0;
    Object.values(state.zoneFeatures).forEach(f => total += computeAreaKm2(f));
    $("#stat-area").textContent = total.toFixed(0);
  }

  // ============ TOGGLES ============
  function toggleZones(force) {
    state.show.zones = (typeof force === "boolean") ? force : !state.show.zones;
    renderZones();
    const btn = $("#btn-toggle-zones");
    btn.textContent = state.show.zones ? "Hide Zones" : "Show Zones";
    btn.classList.toggle("btn-active", state.show.zones);
  }

  function togglePincodes(force) {
    state.show.pincodes = (typeof force === "boolean") ? force : !state.show.pincodes;
    renderPincodes();
    const btn = $("#btn-toggle-pincodes");
    btn.textContent = state.show.pincodes ? "Hide Pincodes" : "Show Pincodes";
    btn.classList.toggle("btn-active", state.show.pincodes);
  }

  function resetView() {
    state.show.zones = false;
    state.show.pincodes = false;
    renderZones();
    renderPincodes();
    clearHighlight();
    renderInfoEmpty();

    $("#btn-toggle-zones").textContent = "Show Zones";
    $("#btn-toggle-zones").classList.remove("btn-active");
    $("#btn-toggle-pincodes").textContent = "Show Pincodes";
    $("#btn-toggle-pincodes").classList.remove("btn-active");

    state.map.fitBounds(state.layers.boundary.getBounds(), { padding: [20, 20] });
  }

  // ============ TABS ============
  function setupTabs() {
    $$(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        $$(".tab").forEach(t => t.classList.toggle("active", t === tab));
        $$(".tab-panel").forEach(p =>
          p.classList.toggle("active", p.dataset.panel === target));
      });
    });
  }

  function switchToTab(tabName) {
    const tab = $(`.tab[data-tab="${tabName}"]`);
    if (tab) tab.click();
  }

  // ============ CREATE / EDIT ZONE ============
  function setupCreateZone() {
    $("#create-search").addEventListener("input", e => {
      const checked = getAllSelectedCreateCodes();
      renderCreatePincodeList(e.target.value, checked);
    });

    $("#btn-select-all").addEventListener("click", () => {
      $$("#create-pincode-list input").forEach(i => i.checked = true);
      updateSelectionCount();
    });

    $("#btn-deselect-all").addEventListener("click", () => {
      $$("#create-pincode-list input").forEach(i => i.checked = false);
      updateSelectionCount();
    });

    $("#btn-cancel-edit").addEventListener("click", cancelEdit);

    $("#btn-create-zone").addEventListener("click", () => {
      const name  = $("#new-zone-name").value.trim();
      const color = $("#new-zone-color").value;
      const codes = getAllSelectedCreateCodes();

      if (!name) { alert("Please enter a zone name."); return; }
      if (codes.length === 0) { alert("Please select at least one pincode."); return; }

      const feats = codes.map(c => state.pincodeFeatures[c]).filter(Boolean);
      const polygon = unionAll(feats);
      if (!polygon) { alert("Could not create zone polygon."); return; }

      if (state.editingZoneId) {
        // UPDATE existing
        const cz = state.customZones.find(z => z.id === state.editingZoneId);
        if (cz) {
          cz.name = name;
          cz.color = color;
          cz.pincodes = codes;
          cz.polygon = polygon;
        }
        cancelEdit();
        renderCustomZones();
        renderCustomZoneList();
        renderCombineList();
        showCustomZoneInfo(cz.id);
      } else {
        // CREATE new
        const cz = {
          id: "cz-" + Date.now(),
          name, color, pincodes: codes, polygon
        };
        state.customZones.push(cz);
        renderCustomZones();
        renderCustomZoneList();
        renderCombineList();
        updateStats();
        clearCreateForm();
        showCustomZoneInfo(cz.id);
      }
    });
  }

  function clearCreateForm() {
    $("#new-zone-name").value = "";
    $("#new-zone-color").value = ZONE_COLOR_PRESETS[0];
    state.selectedColor = ZONE_COLOR_PRESETS[0];
    $$(".color-swatch").forEach((s, i) => s.classList.toggle("selected", i === 0));
    $("#create-search").value = "";
    renderCreatePincodeList("", []);
  }

  function startEditZone(czId) {
    const cz = state.customZones.find(z => z.id === czId);
    if (!cz) return;

    state.editingZoneId = czId;
    switchToTab("sub");

    $("#sub-form-title").textContent = `Editing: ${cz.name}`;
    $("#new-zone-name").value = cz.name;
    $("#new-zone-color").value = cz.color;
    state.selectedColor = cz.color;
    $$(".color-swatch").forEach(s => s.classList.toggle("selected", s.dataset.color === cz.color));
    $("#create-search").value = "";
    renderCreatePincodeList("", cz.pincodes);

    $("#btn-create-zone").textContent = "Save Changes";
    $("#btn-cancel-edit").classList.remove("hidden");

    // Scroll form into view
    $('[data-panel="sub"] .card').scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    state.editingZoneId = null;
    $("#sub-form-title").textContent = "Create new sub-zone";
    $("#btn-create-zone").textContent = "Create Sub-zone";
    $("#btn-cancel-edit").classList.add("hidden");
    clearCreateForm();
  }

  function deleteCustomZone(czId) {
    const cz = state.customZones.find(z => z.id === czId);
    if (!cz) return;
    if (!confirm(`Delete sub-zone "${cz.name}"?`)) return;

    state.customZones = state.customZones.filter(z => z.id !== czId);
    if (state.editingZoneId === czId) cancelEdit();

    renderCustomZones();
    renderCustomZoneList();
    renderCombineList();
    updateStats();

    if (state.activeSelection?.type === "custom" && state.activeSelection.id === czId) {
      clearHighlight();
      renderInfoEmpty();
    }
  }

  // ============ COMBINE ============
  function setupCombine() {
    $("#btn-clear-combine").addEventListener("click", () => {
      $$("#combine-main-list input, #combine-sub-list input").forEach(i => i.checked = false);
      $("#combine-result").classList.add("hidden");
      $("#combine-result").innerHTML = "";
    });

    $("#btn-combine").addEventListener("click", () => {
      const checked = $$("#combine-main-list input:checked, #combine-sub-list input:checked");
      if (checked.length < 2) { alert("Select at least 2 zones to combine."); return; }

      const features = [], names = [], colors = [], ids = [], kinds = [];
      checked.forEach(box => {
        const id   = box.dataset.zoneId;
        const kind = box.dataset.zoneKind;
        if (kind === "main") {
          const z = MAIN_ZONES.find(m => m.id === id);
          const f = state.zoneFeatures[id];
          if (f) { features.push(f); names.push(z.name); colors.push(z.color); ids.push(id); kinds.push("main"); }
        } else {
          const cz = state.customZones.find(c => c.id === id);
          if (cz && cz.polygon) {
            features.push(cz.polygon); names.push(cz.name); colors.push(cz.color); ids.push(id); kinds.push("custom");
          }
        }
      });

      const combined = unionAll(features);
      if (!combined) { alert("Could not combine zones."); return; }

      highlightFeature(combined, "#06b6d4");

      const area = computeAreaKm2(combined);
      const { radiusKm } = computeRadiusKm(combined);
      const over = radiusKm > RADIUS_LIMIT_KM;
      const totalPincodes = new Set();
      ids.forEach((id, i) => {
        if (kinds[i] === "main") {
          PINCODES.filter(p => p.zone === id).forEach(p => totalPincodes.add(p.code));
        } else {
          const cz = state.customZones.find(z => z.id === id);
          if (cz) cz.pincodes.forEach(c => totalPincodes.add(c));
        }
      });

      $("#combine-result").classList.remove("hidden");
      $("#combine-result").innerHTML = `
        <div class="kv"><span class="k">Combined</span><span class="v">${names.join(" + ")}</span></div>
        <div class="kv"><span class="k">Total Area</span><span class="v">${area.toFixed(2)} km²</span></div>
        <div class="kv"><span class="k">Max Radius</span><span class="v">${radiusKm.toFixed(2)} km</span></div>
        <div class="kv"><span class="k">Pincodes</span><span class="v">${totalPincodes.size}</span></div>
        <div style="margin-top:10px">
          <span class="limit-badge ${over ? "over" : "ok"}">
            ${over ? `Exceeds ${RADIUS_LIMIT_KM} km limit` : `Within ${RADIUS_LIMIT_KM} km limit`}
          </span>
        </div>
      `;

      showCombinedInfo(ids, combined, names, colors, kinds);
    });
  }

  // ============ SEARCH ============
  function setupSearch() {
    $("#pincode-search").addEventListener("input", e => {
      renderPincodeList(e.target.value, $("#pincode-zone-filter").value);
    });
    $("#pincode-zone-filter").addEventListener("change", e => {
      renderPincodeList($("#pincode-search").value, e.target.value);
    });
  }

  // ============ MAP CLICK ============
  function setupMapClicks() {
    state.map.on("click", () => {
      if (state.activeSelection) {
        clearHighlight();
        renderInfoEmpty();
      }
    });
  }

  // ============ TOPBAR ============
  function setupTopbar() {
    $("#btn-toggle-zones").addEventListener("click",    () => toggleZones());
    $("#btn-toggle-pincodes").addEventListener("click", () => togglePincodes());
    $("#btn-reset").addEventListener("click",           () => resetView());
  }

  // ============ INIT ============
  async function init() {
    setMapEngineStatus("Loading…", "loading");

    // 0. Fetch live OSM boundary (with embedded fallback)
    state.boundary = await fetchOSMBoundary();

    // 1. Build geometry using the real boundary
    buildPincodePolygons();
    buildZonePolygons();

    // 2. Map
    initMap();

    // 3. UI
    populateZoneFilter();
    renderZoneList();
    renderCustomZoneList();
    renderPincodeList();
    renderColorPalette();
    renderCreatePincodeList();
    renderCombineList();
    updateStats();

    setupTabs();
    setupTopbar();
    setupSearch();
    setupCreateZone();
    setupCombine();
    setupMapClicks();
    renderInfoEmpty();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
