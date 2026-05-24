/* =====================================================================
 * Bengaluru Zone Manager - Main Application
 * ===================================================================*/

(function () {
  "use strict";

  const { BENGALURU_BOUNDARY, MAIN_ZONES, PINCODES, CITY_CENTRE, RADIUS_LIMIT_KM } = window.BZM_DATA;

  // ============ STATE ============
  const state = {
    map: null,
    layers: {
      boundary: null,        // Bengaluru outline
      pincodes: null,        // L.LayerGroup of pincode polygons
      zones:    null,        // L.LayerGroup of main zone polygons
      custom:   null,        // L.LayerGroup of custom sub-zone polygons
      highlight: null        // single highlight layer
    },
    show: { pincodes: false, zones: false },
    customZones: [],         // {id, name, color, pincodes:[codes], polygon, area, radius}
    pincodeFeatures: {},     // code -> turf Feature (clipped Voronoi polygon)
    zoneFeatures: {},        // zoneId -> turf Feature (union)
    activeSelection: null    // { type: 'pincode'|'zone'|'custom'|'combined', id }
  };

  // ============ HELPERS ============

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function turfFeatureToLatLngs(feature) {
    // Convert turf Polygon/MultiPolygon to leaflet latlngs
    if (!feature || !feature.geometry) return [];
    const g = feature.geometry;
    if (g.type === "Polygon") {
      return g.coordinates.map(ring => ring.map(([lng, lat]) => [lat, lng]));
    }
    if (g.type === "MultiPolygon") {
      return g.coordinates.map(poly => poly.map(ring => ring.map(([lng, lat]) => [lat, lng])));
    }
    return [];
  }

  function computeAreaKm2(feature) {
    if (!feature) return 0;
    try { return turf.area(feature) / 1_000_000; } catch { return 0; }
  }

  function computeRadiusKm(feature) {
    // Max distance from polygon centroid to any boundary vertex
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

  // ============ STEP 1: GENERATE PINCODE POLYGONS (Voronoi) ============

  function buildPincodePolygons() {
    // 1. Build Voronoi from pincode centres
    const points = PINCODES.map(p => [p.lng, p.lat]);
    const delaunay = d3.Delaunay.from(points);

    // Use a slightly padded bbox of Bengaluru boundary
    const [minX, minY, maxX, maxY] = turf.bbox(BENGALURU_BOUNDARY);
    const pad = 0.05;
    const voronoi = delaunay.voronoi([minX - pad, minY - pad, maxX + pad, maxY + pad]);

    // 2. For each pincode, clip cell to Bengaluru boundary
    PINCODES.forEach((p, i) => {
      const cell = voronoi.cellPolygon(i);
      if (!cell) return;
      try {
        const cellFeat = turf.polygon([cell]);
        const clipped  = turf.intersect(cellFeat, BENGALURU_BOUNDARY);
        if (clipped) {
          clipped.properties = {
            code: p.code, area: p.area, zone: p.zone, lat: p.lat, lng: p.lng
          };
          state.pincodeFeatures[p.code] = clipped;
        }
      } catch (e) {
        console.warn(`Failed to clip pincode ${p.code}`, e);
      }
    });
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

  // ============ STEP 3: MAP INITIALISATION ============

  function initMap() {
    state.map = L.map("map", {
      center: [CITY_CENTRE.lat, CITY_CENTRE.lng],
      zoom: 11,
      zoomControl: true,
      attributionControl: true
    });

    // Subtle dark tile layer (Carto positron-dark via OSM-compatible tiles)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(state.map);

    // Empty layer groups
    state.layers.pincodes  = L.layerGroup().addTo(state.map);
    state.layers.zones     = L.layerGroup().addTo(state.map);
    state.layers.custom    = L.layerGroup().addTo(state.map);
    state.layers.highlight = L.layerGroup().addTo(state.map);

    // Default: only Bengaluru boundary outline shown
    drawBoundary();
  }

  function drawBoundary() {
    state.layers.boundary = L.geoJSON(BENGALURU_BOUNDARY, {
      style: {
        color: "#06b6d4",
        weight: 3,
        fillColor: "#06b6d4",
        fillOpacity: 0.04,
        dashArray: "6 4"
      },
      interactive: false
    }).addTo(state.map);

    // Fit bounds
    state.map.fitBounds(state.layers.boundary.getBounds(), { padding: [20, 20] });
  }

  // ============ STEP 4: RENDER LAYERS ============

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
          color: zone.color,
          weight: 2.5,
          fillColor: zone.color,
          fillOpacity: 0.20
        }
      });

      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        showZoneInfo(zone.id);
      });
      layer.bindTooltip(zone.name, {
        permanent: true,
        direction: "center",
        className: "zone-label",
        sticky: false
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
          color: cz.color,
          weight: 2.5,
          fillColor: cz.color,
          fillOpacity: 0.25,
          dashArray: "4 3"
        }
      });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        showCustomZoneInfo(cz.id);
      });
      layer.bindTooltip(cz.name, {
        permanent: true,
        direction: "center",
        className: "zone-label"
      });
      state.layers.custom.addLayer(layer);
    });
  }

  // ============ HIGHLIGHTING ============

  function clearHighlight() {
    state.layers.highlight.clearLayers();
    state.activeSelection = null;
    $$(".zone-list li, .pincode-list li").forEach(li => li.classList.remove("active"));
  }

  function highlightFeature(feature, color, opts = {}) {
    state.layers.highlight.clearLayers();

    const fillLayer = L.geoJSON(feature, {
      style: {
        color: color,
        weight: 3.5,
        fillColor: color,
        fillOpacity: 0.45,
        dashArray: opts.dashed ? "6 4" : null
      }
    });
    state.layers.highlight.addLayer(fillLayer);

    // Centre + radius circle (max-distance from center)
    const { centerLngLat, radiusKm } = computeRadiusKm(feature);
    if (centerLngLat) {
      const center = [centerLngLat[1], centerLngLat[0]];
      L.circleMarker(center, {
        radius: 5, color: "#fff", weight: 2,
        fillColor: color, fillOpacity: 1
      }).addTo(state.layers.highlight);

      // Reach circle
      L.circle(center, {
        radius: radiusKm * 1000,
        color: radiusKm > RADIUS_LIMIT_KM ? "#ef4444" : "#10b981",
        weight: 1.5,
        fillOpacity: 0.04,
        dashArray: "4 4"
      }).addTo(state.layers.highlight);

      // 10 km service ring (for reference)
      L.circle(center, {
        radius: RADIUS_LIMIT_KM * 1000,
        color: "#06b6d4", weight: 1, dashArray: "2 4",
        fillOpacity: 0
      }).addTo(state.layers.highlight);
    }

    // Fit map to feature bounds
    try {
      const b = fillLayer.getBounds();
      state.map.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
    } catch {}
  }

  // ============ INFO PANEL ============

  function renderInfoEmpty() {
    $("#info-panel").innerHTML =
      `<div class="info-empty"><p class="muted">Click any pincode or zone on the map to see details here.</p></div>`;
  }

  function limitBadge(radiusKm) {
    const over = radiusKm > RADIUS_LIMIT_KM;
    const label = over
      ? `Exceeds ${RADIUS_LIMIT_KM} km limit`
      : `Within ${RADIUS_LIMIT_KM} km limit`;
    return `<span class="limit-badge ${over ? "over" : "ok"}">${label}</span>`;
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

    // Mark active in lists
    $$(".pincode-list li").forEach(li => li.classList.toggle("active", li.dataset.code === code));

    $("#info-panel").innerHTML = `
      <div class="info-card">
        <div class="info-header">
          <div class="info-color" style="background:${zone.color}"></div>
          <div>
            <h3 class="info-title">${p.code}</h3>
            <p class="info-subtitle">${p.area}</p>
          </div>
        </div>

        <div class="kv"><span class="k">Belongs to Zone</span><span class="v" style="color:${zone.color}">${zone.name}</span></div>
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
        <div class="info-header">
          <div class="info-color" style="background:${zone.color}"></div>
          <div>
            <h3 class="info-title">${zone.name}</h3>
            <p class="info-subtitle">${pins.length} pincodes</p>
          </div>
        </div>

        <div class="kv"><span class="k">Total Coverage</span><span class="v">${area.toFixed(2)} km²</span></div>
        <div class="kv"><span class="k">Max Radius (centre→edge)</span><span class="v">${radiusKm.toFixed(2)} km</span></div>
        <div class="kv"><span class="k">Pincodes Covered</span><span class="v">${pins.length}</span></div>

        <div class="section-title">Service Range</div>
        ${limitBadge(radiusKm)}

        <div class="section-title">Pincodes in this zone</div>
        <div class="pin-chip-list">
          ${pins.map(p => `<span class="pin-chip" title="${p.area}">${p.code}</span>`).join("")}
        </div>
      </div>
    `;
  }

  function showCustomZoneInfo(czId) {
    const cz = state.customZones.find(z => z.id === czId);
    if (!cz || !cz.polygon) return;

    const area = computeAreaKm2(cz.polygon);
    const { radiusKm } = computeRadiusKm(cz.polygon);

    state.activeSelection = { type: "custom", id: czId };
    highlightFeature(cz.polygon, cz.color, { dashed: true });

    const pins = cz.pincodes.map(c => PINCODES.find(p => p.code === c)).filter(Boolean);

    $("#info-panel").innerHTML = `
      <div class="info-card">
        <div class="info-header">
          <div class="info-color" style="background:${cz.color}"></div>
          <div>
            <h3 class="info-title">${cz.name}</h3>
            <p class="info-subtitle">Custom sub-zone · ${pins.length} pincodes</p>
          </div>
        </div>

        <div class="kv"><span class="k">Total Coverage</span><span class="v">${area.toFixed(2)} km²</span></div>
        <div class="kv"><span class="k">Max Radius</span><span class="v">${radiusKm.toFixed(2)} km</span></div>
        <div class="kv"><span class="k">Pincodes</span><span class="v">${pins.length}</span></div>

        <div class="section-title">Service Range</div>
        ${limitBadge(radiusKm)}

        <div class="section-title">Pincodes</div>
        <div class="pin-chip-list">
          ${pins.map(p => `<span class="pin-chip" title="${p.area}">${p.code}</span>`).join("")}
        </div>

        <div class="form-actions">
          <button class="btn btn-ghost" id="btn-delete-custom">Delete sub-zone</button>
        </div>
      </div>
    `;

    $("#btn-delete-custom").addEventListener("click", () => {
      state.customZones = state.customZones.filter(z => z.id !== czId);
      renderCustomZones();
      renderCustomZoneList();
      updateStats();
      renderInfoEmpty();
    });
  }

  function showCombinedInfo(zoneIds, feature, names, colors) {
    const area = computeAreaKm2(feature);
    const { radiusKm } = computeRadiusKm(feature);
    const totalPincodes = new Set();
    zoneIds.forEach(id => {
      const main   = MAIN_ZONES.find(z => z.id === id);
      const custom = state.customZones.find(z => z.id === id);
      if (main)   PINCODES.filter(p => p.zone === id).forEach(p => totalPincodes.add(p.code));
      if (custom) custom.pincodes.forEach(c => totalPincodes.add(c));
    });

    state.activeSelection = { type: "combined", id: zoneIds.join("+") };

    const colorBlocks = colors.map(c => `<span class="info-color" style="background:${c};display:inline-block;width:14px;height:14px;border-radius:3px;margin-right:4px;vertical-align:middle"></span>`).join("");

    $("#info-panel").innerHTML = `
      <div class="info-card">
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
      </div>
    `;
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
          <div>${zone.name}</div>
          <div class="muted" style="font-size:11px;margin:0">${pins.length} pincodes · ${area.toFixed(1)} km²</div>
        </div>
      `;
      li.addEventListener("click", () => {
        // Auto-show zones layer if hidden, then highlight
        if (!state.show.zones) toggleZones(true);
        showZoneInfo(zone.id);
      });
      list.appendChild(li);
    });
  }

  function renderCustomZoneList() {
    const list = $("#custom-zone-list");
    if (state.customZones.length === 0) {
      list.innerHTML = `<li class="empty">No custom zones yet. Create one in the Create tab.</li>`;
      return;
    }
    list.innerHTML = "";
    state.customZones.forEach(cz => {
      const area = computeAreaKm2(cz.polygon);
      const li = document.createElement("li");
      li.dataset.custom = cz.id;
      li.innerHTML = `
        <span class="zone-dot" style="background:${cz.color}"></span>
        <div>
          <div>${cz.name}</div>
          <div class="muted" style="font-size:11px;margin:0">${cz.pincodes.length} pincodes · ${area.toFixed(1)} km²</div>
        </div>
      `;
      li.addEventListener("click", () => showCustomZoneInfo(cz.id));
      list.appendChild(li);
    });
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
        <span class="pincode-zone" style="color:${zone.color}">${zone.id}</span>
      `;
      li.addEventListener("click", () => {
        if (!state.show.pincodes) togglePincodes(true);
        showPincodeInfo(p.code);
      });
      list.appendChild(li);
    });
  }

  function renderCreatePincodeList(searchTerm = "") {
    const list = $("#create-pincode-list");
    list.innerHTML = "";
    const term = searchTerm.trim().toLowerCase();
    const filtered = PINCODES.filter(p =>
      !term || p.code.toLowerCase().includes(term) || p.area.toLowerCase().includes(term)
    );

    filtered.forEach(p => {
      const zone = MAIN_ZONES.find(z => z.id === p.zone);
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="checkbox" data-code="${p.code}" />
        <span class="zone-dot" style="background:${zone.color}"></span>
        <span class="pincode-code">${p.code}</span>
        <span class="pincode-area">${p.area}</span>
      `;
      list.appendChild(li);
    });
  }

  function renderCombineList() {
    const list = $("#combine-zone-list");
    list.innerHTML = "";

    MAIN_ZONES.forEach(zone => {
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="checkbox" data-zone-id="${zone.id}" data-zone-kind="main" />
        <span class="zone-dot" style="background:${zone.color}"></span>
        <span>${zone.name}</span>
      `;
      list.appendChild(li);
    });

    state.customZones.forEach(cz => {
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="checkbox" data-zone-id="${cz.id}" data-zone-kind="custom" />
        <span class="zone-dot" style="background:${cz.color}"></span>
        <span>${cz.name} <em class="muted" style="font-size:11px">(custom)</em></span>
      `;
      list.appendChild(li);
    });
  }

  function populateZoneFilter() {
    const sel = $("#pincode-zone-filter");
    sel.innerHTML = `<option value="">All zones</option>` +
      MAIN_ZONES.map(z => `<option value="${z.id}">${z.name}</option>`).join("");
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

  // ============ CREATE ZONE ============

  function setupCreateZone() {
    $("#create-search").addEventListener("input", e => {
      // preserve currently checked codes
      const checked = new Set(
        $$("#create-pincode-list input:checked").map(i => i.dataset.code)
      );
      renderCreatePincodeList(e.target.value);
      $$("#create-pincode-list input").forEach(i => {
        if (checked.has(i.dataset.code)) i.checked = true;
      });
    });

    $("#btn-clear-create").addEventListener("click", () => {
      $("#new-zone-name").value = "";
      $("#new-zone-color").value = "#06b6d4";
      $("#create-search").value = "";
      renderCreatePincodeList();
    });

    $("#btn-create-zone").addEventListener("click", () => {
      const name  = $("#new-zone-name").value.trim();
      const color = $("#new-zone-color").value;
      const codes = $$("#create-pincode-list input:checked").map(i => i.dataset.code);

      if (!name) { alert("Please enter a zone name."); return; }
      if (codes.length === 0) { alert("Please select at least one pincode."); return; }

      const feats = codes.map(c => state.pincodeFeatures[c]).filter(Boolean);
      const polygon = unionAll(feats);
      if (!polygon) { alert("Could not create zone polygon."); return; }

      const cz = {
        id: "cz-" + Date.now(),
        name, color,
        pincodes: codes,
        polygon
      };
      state.customZones.push(cz);
      renderCustomZones();
      renderCustomZoneList();
      renderCombineList();
      updateStats();

      // Reset form
      $("#new-zone-name").value = "";
      $("#create-search").value = "";
      renderCreatePincodeList();

      // Show the new zone
      showCustomZoneInfo(cz.id);
    });
  }

  // ============ COMBINE ZONES ============

  function setupCombine() {
    $("#btn-clear-combine").addEventListener("click", () => {
      $$("#combine-zone-list input").forEach(i => i.checked = false);
      $("#combine-result").classList.add("hidden");
      $("#combine-result").innerHTML = "";
    });

    $("#btn-combine").addEventListener("click", () => {
      const checked = $$("#combine-zone-list input:checked");
      if (checked.length < 2) { alert("Select at least 2 zones to combine."); return; }

      const features = [], names = [], colors = [], ids = [];
      checked.forEach(box => {
        const id   = box.dataset.zoneId;
        const kind = box.dataset.zoneKind;
        if (kind === "main") {
          const z = MAIN_ZONES.find(m => m.id === id);
          const f = state.zoneFeatures[id];
          if (f) { features.push(f); names.push(z.name); colors.push(z.color); ids.push(id); }
        } else {
          const cz = state.customZones.find(c => c.id === id);
          if (cz && cz.polygon) {
            features.push(cz.polygon); names.push(cz.name); colors.push(cz.color); ids.push(id);
          }
        }
      });

      const combined = unionAll(features);
      if (!combined) { alert("Could not combine zones."); return; }

      // Highlight combined polygon
      state.activeSelection = { type: "combined", id: ids.join("+") };
      highlightFeature(combined, "#06b6d4");

      // Inline result summary
      const area = computeAreaKm2(combined);
      const { radiusKm } = computeRadiusKm(combined);
      const over = radiusKm > RADIUS_LIMIT_KM;
      const totalPincodes = new Set();
      ids.forEach(id => {
        const main   = MAIN_ZONES.find(z => z.id === id);
        const custom = state.customZones.find(z => z.id === id);
        if (main)   PINCODES.filter(p => p.zone === id).forEach(p => totalPincodes.add(p.code));
        if (custom) custom.pincodes.forEach(c => totalPincodes.add(c));
      });

      $("#combine-result").classList.remove("hidden");
      $("#combine-result").innerHTML = `
        <div class="kv"><span class="k">Combined</span><span class="v">${names.join(" + ")}</span></div>
        <div class="kv"><span class="k">Total Area</span><span class="v">${area.toFixed(2)} km²</span></div>
        <div class="kv"><span class="k">Max Radius</span><span class="v">${radiusKm.toFixed(2)} km</span></div>
        <div class="kv"><span class="k">Pincodes</span><span class="v">${totalPincodes.size}</span></div>
        <div style="margin-top:8px">
          <span class="limit-badge ${over ? "over" : "ok"}">
            ${over ? `Exceeds ${RADIUS_LIMIT_KM} km limit` : `Within ${RADIUS_LIMIT_KM} km limit`}
          </span>
        </div>
      `;

      // Detailed info-panel too
      showCombinedInfo(ids, combined, names, colors);
    });
  }

  // ============ SEARCH HOOKS ============

  function setupSearch() {
    $("#pincode-search").addEventListener("input", e => {
      renderPincodeList(e.target.value, $("#pincode-zone-filter").value);
    });
    $("#pincode-zone-filter").addEventListener("change", e => {
      renderPincodeList($("#pincode-search").value, e.target.value);
    });
  }

  // ============ MAP CLICK (clear highlight) ============

  function setupMapClicks() {
    state.map.on("click", () => {
      if (state.activeSelection) {
        clearHighlight();
        renderInfoEmpty();
      }
    });
  }

  // ============ TOPBAR BUTTONS ============

  function setupTopbar() {
    $("#btn-toggle-zones").addEventListener("click",    () => toggleZones());
    $("#btn-toggle-pincodes").addEventListener("click", () => togglePincodes());
    $("#btn-reset").addEventListener("click",           () => resetView());
  }

  // ============ INIT ============

  function init() {
    // 1. Compute geometry
    buildPincodePolygons();
    buildZonePolygons();

    // 2. Map
    initMap();

    // 3. UI
    populateZoneFilter();
    renderZoneList();
    renderCustomZoneList();
    renderPincodeList();
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

  // Wait for DOM + libraries
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
