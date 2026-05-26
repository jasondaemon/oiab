(() => {
  const $ = (id) => document.getElementById(id);
  const API = {
    packs: "/maps-v2-map-packs",
    data: "/maps-data",
    location: "/maps-location-current",
    track: "/maps-tracks-current",
    save: "/maps-quick-save",
  };
  const EMPTY = { type: "FeatureCollection", features: [] };
  const WAYPOINT_TYPES = [
    ["gas", "Gas", "fuel"],
    ["camp", "Camp", "camp"],
    ["waterfall", "Waterfall", "water"],
    ["lookout", "Lookout", "lookout"],
    ["trailhead", "Trailhead", "trailhead"],
    ["food", "Food", "food"],
    ["restroom", "Restroom", "restroom"],
    ["hazard", "Hazard", "hazard"],
    ["photo", "Photo", "photo"],
    ["other", "Other", "pin"],
  ];
  const CATEGORY_COLORS = {
    gas: "#f3c74d",
    fuel: "#f3c74d",
    camp: "#74e38a",
    campsite: "#74e38a",
    waterfall: "#62ccff",
    water: "#62ccff",
    lookout: "#8be0bd",
    viewpoint: "#8be0bd",
    trailhead: "#d3a963",
    food: "#ff9b55",
    restroom: "#b7a1ff",
    hazard: "#ff7068",
    photo: "#f0f7ff",
    route: "#ffd34f",
    quick_save: "#ffd34f",
    "quick-save": "#ffd34f",
  };

  const state = {
    map: null,
    pack: null,
    follow: false,
    addFromMap: false,
    currentLocation: null,
    browserLocation: null,
    browserWatchId: null,
    folders: new Set(),
    hiddenFolders: new Set(JSON.parse(localStorage.getItem("omv2.hiddenFolders") || "[]")),
    showWaypoints: JSON.parse(localStorage.getItem("omv2.showWaypoints") || "true"),
    showTracks: JSON.parse(localStorage.getItem("omv2.showTracks") || "true"),
    places: EMPTY,
    track: null,
    vehicleMarker: null,
    modalPoint: null,
  };

  function toast(message, error = false) {
    const node = $("toast");
    node.textContent = message;
    node.classList.toggle("is-error", error);
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 3200);
  }

  function number(value, digits = 5) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(digits) : "--";
  }

  function mph(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${Math.round(parsed)} mph` : "-- mph";
  }

  function headingLabel(deg) {
    const parsed = Number(deg);
    if (!Number.isFinite(parsed)) return "--";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return `${Math.round(parsed)}° ${dirs[Math.round(parsed / 45) % 8]}`;
  }

  function folderOf(feature) {
    return String((feature.properties || {}).folder || "Unfiled").trim() || "Unfiled";
  }

  function categoryOf(feature) {
    return String((feature.properties || {}).category || (feature.geometry && feature.geometry.type === "LineString" ? "route" : "waypoint")).toLowerCase();
  }

  function colorFor(feature) {
    const props = feature.properties || {};
    return props.color || CATEGORY_COLORS[categoryOf(feature)] || "#ffd34f";
  }

  function featureName(feature) {
    const props = feature.properties || {};
    return props.name || props.title || props.category || "Saved place";
  }

  function validCoord(lat, lon) {
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
  }

  async function fetchJson(url, fallback = null) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      if (fallback !== null) return fallback;
      throw new Error(`${url} returned ${response.status}`);
    }
    return response.json();
  }

  function normalizePackRegistry(registry) {
    const basemaps = Array.isArray(registry.basemaps) ? registry.basemaps : [];
    const activeId = registry.active || registry.active_basemap || "";
    return basemaps.find((pack) => pack.id === activeId && pack.exists) || basemaps.find((pack) => pack.exists) || null;
  }

  async function loadPack() {
    const registry = await fetchJson(API.packs, { ok: false, basemaps: [] });
    const pack = normalizePackRegistry(registry);
    if (!pack) {
      $("missingPack").hidden = false;
      $("mapPackName").textContent = "No map pack installed";
      return null;
    }
    $("missingPack").hidden = true;
    $("mapPackName").textContent = pack.name || pack.id;
    state.pack = pack;
    return pack;
  }

  async function loadStyle(pack) {
    const style = await fetchJson(pack.style || "/maps-v2/map-style.json");
    const url = new URL(pack.url, window.location.href).href;
    style.sources = style.sources || {};
    style.sources.basemap = {
      ...(style.sources.basemap || {}),
      type: "vector",
      url: `pmtiles://${url}`,
      attribution: pack.attribution || "© OpenStreetMap contributors",
    };
    return style;
  }

  function initMap(style) {
    if (state.map) state.map.remove();
    state.map = new maplibregl.Map({
      container: "mapCanvas",
      style,
      center: JSON.parse(localStorage.getItem("omv2.center") || "[-98.5795,39.8283]"),
      zoom: Number(localStorage.getItem("omv2.zoom") || 3.4),
      pitch: Number(localStorage.getItem("omv2.pitch") || 0),
      bearing: Number(localStorage.getItem("omv2.bearing") || 0),
      attributionControl: true,
      cooperativeGestures: false,
    });
    state.map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "imperial" }), "bottom-left");
    state.map.on("moveend", saveMapView);
    state.map.on("load", () => {
      addOverlandSources();
      loadOverlandData();
      pollLocation();
      pollTrack();
      setInterval(loadOverlandData, 10000);
      setInterval(pollLocation, 1000);
      setInterval(pollTrack, 4000);
    });
    state.map.on("click", (event) => {
      if (!state.addFromMap) return;
      state.modalPoint = { lat: event.lngLat.lat, lon: event.lngLat.lng, source: "map_click" };
      state.addFromMap = false;
      $("addMapWaypoint").classList.remove("is-pending");
      openWaypointModal("Save map point");
    });
    state.map.on("click", "overland-waypoint-circles", (event) => {
      const feature = event.features && event.features[0];
      if (!feature) return;
      const props = feature.properties || {};
      const coords = feature.geometry.coordinates;
      new maplibregl.Popup()
        .setLngLat(coords)
        .setHTML(`<strong>${escapeHtml(featureName(feature))}</strong><br>${escapeHtml(props.category || "waypoint")} · ${escapeHtml(props.folder || "Unfiled")}<br><small>${escapeHtml(props.notes || "")}</small>`)
        .addTo(state.map);
    });
  }

  function saveMapView() {
    if (!state.map) return;
    const center = state.map.getCenter();
    localStorage.setItem("omv2.center", JSON.stringify([center.lng, center.lat]));
    localStorage.setItem("omv2.zoom", String(state.map.getZoom()));
    localStorage.setItem("omv2.pitch", String(state.map.getPitch()));
    localStorage.setItem("omv2.bearing", String(state.map.getBearing()));
  }

  function addOverlandSources() {
    state.map.addSource("overland-waypoints", { type: "geojson", data: EMPTY });
    state.map.addSource("overland-tracks", { type: "geojson", data: EMPTY });
    state.map.addLayer({
      id: "overland-track-lines",
      type: "line",
      source: "overland-tracks",
      paint: {
        "line-color": ["coalesce", ["get", "color"], "#ffd34f"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2, 13, 5],
        "line-opacity": 0.86,
      },
    });
    state.map.addLayer({
      id: "overland-waypoint-circles",
      type: "circle",
      source: "overland-waypoints",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5, 12, 8, 16, 12],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#0a170f",
        "circle-stroke-width": 2,
      },
    });
    state.map.addLayer({
      id: "overland-waypoint-labels",
      type: "symbol",
      source: "overland-waypoints",
      minzoom: 4,
      layout: {
        "text-field": ["get", "name"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 12, 12, 16, 14],
        "text-font": ["Noto Sans Bold"],
        "text-offset": [0, 1.2],
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#102719",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.8,
      },
    });
  }

  async function loadOverlandData() {
    try {
      const data = await fetchJson(API.data);
      state.places = data.places || EMPTY;
      updateFolders(data.folders || []);
      updateOverlandSources();
    } catch (error) {
      toast(`Map data failed: ${error.message}`, true);
    }
  }

  function updateFolders(folders) {
    for (const folder of folders) state.folders.add(folder || "Unfiled");
    for (const feature of state.places.features || []) state.folders.add(folderOf(feature));
    renderFolders();
  }

  function renderFolders() {
    const node = $("folderList");
    const folders = Array.from(state.folders).sort((a, b) => a.localeCompare(b));
    node.innerHTML = "";
    for (const folder of folders) {
      const count = (state.places.features || []).filter((feature) => folderOf(feature) === folder).length;
      const row = document.createElement("label");
      row.className = "omv2-folder-row";
      row.innerHTML = `<input type="checkbox" ${state.hiddenFolders.has(folder) ? "" : "checked"}><span>${escapeHtml(folder)}</span><span class="omv2-folder-count">${count}</span>`;
      row.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) state.hiddenFolders.delete(folder);
        else state.hiddenFolders.add(folder);
        localStorage.setItem("omv2.hiddenFolders", JSON.stringify(Array.from(state.hiddenFolders)));
        updateOverlandSources();
      });
      node.appendChild(row);
    }
  }

  function updateOverlandSources() {
    if (!state.map || !state.map.getSource("overland-waypoints")) return;
    const waypointFeatures = [];
    const trackFeatures = [];
    for (const feature of state.places.features || []) {
      const folder = folderOf(feature);
      if (state.hiddenFolders.has(folder)) continue;
      const geometry = feature.geometry || {};
      const copy = JSON.parse(JSON.stringify(feature));
      copy.properties = copy.properties || {};
      copy.properties.name = featureName(feature);
      copy.properties.color = colorFor(feature);
      if (geometry.type === "Point" && state.showWaypoints) waypointFeatures.push(copy);
      if (["LineString", "MultiLineString"].includes(geometry.type) && state.showTracks) trackFeatures.push(copy);
    }
    state.map.getSource("overland-waypoints").setData({ type: "FeatureCollection", features: waypointFeatures });
    state.map.getSource("overland-tracks").setData({ type: "FeatureCollection", features: trackFeatures });
  }

  function activeLocationPayload(payload) {
    if (payload && payload.valid && payload.stable && validCoord(payload.stable.lat, payload.stable.lon)) {
      return {
        source: payload.active_source || payload.source || "usb_gps",
        lat: Number(payload.stable.lat),
        lon: Number(payload.stable.lon),
        speed_mph: Number(payload.stable.speed_mph || 0),
        heading_deg: Number(payload.stable.heading_deg),
        accuracy_m: payload.stable.accuracy_m,
        hdop: payload.stable.hdop,
        raw: payload.raw || null,
        stable: payload.stable,
        timestamp: payload.stable.timestamp || payload.timestamp,
      };
    }
    if (state.browserLocation) return state.browserLocation;
    return null;
  }

  async function pollLocation() {
    try {
      const payload = await fetchJson(API.location);
      const location = activeLocationPayload(payload);
      if (location) {
        state.currentLocation = location;
        updateVehicle(location);
        if (state.follow) state.map.easeTo({ center: [location.lon, location.lat], duration: 450 });
      } else if (!payload.valid) {
        maybeStartBrowserWatch();
      }
      updateLocationStatus(payload, location);
    } catch (error) {
      maybeStartBrowserWatch();
      updateLocationStatus(null, state.browserLocation);
    }
  }

  function maybeStartBrowserWatch() {
    if (state.browserWatchId !== null || !navigator.geolocation) return;
    state.browserWatchId = navigator.geolocation.watchPosition((position) => {
      state.browserLocation = {
        source: "browser",
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        speed_mph: Number(position.coords.speed || 0) * 2.23694,
        heading_deg: Number(position.coords.heading),
        accuracy_m: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString(),
        stable: {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          speed_mph: Number(position.coords.speed || 0) * 2.23694,
          heading_deg: Number(position.coords.heading),
          accuracy_m: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString(),
          stabilized: false,
          stabilization_mode: "browser",
        },
      };
      if (!state.currentLocation || state.currentLocation.source !== "usb_gps") {
        state.currentLocation = state.browserLocation;
        updateVehicle(state.browserLocation);
      }
    }, () => {
      toast("Browser location is unavailable.", true);
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 });
  }

  function updateVehicle(location) {
    if (!state.map || !validCoord(location.lat, location.lon)) return;
    const element = state.vehicleMarker ? state.vehicleMarker.getElement() : document.createElement("div");
    element.className = "vehicle-marker";
    const heading = Number(location.heading_deg);
    if (Number.isFinite(heading) && Number(location.speed_mph || 0) > 1) {
      element.style.transform = `rotate(${heading}deg)`;
    }
    if (!state.vehicleMarker) {
      state.vehicleMarker = new maplibregl.Marker({ element, anchor: "center", rotationAlignment: "map" })
        .setLngLat([location.lon, location.lat])
        .addTo(state.map);
    } else {
      state.vehicleMarker.setLngLat([location.lon, location.lat]);
    }
  }

  function updateLocationStatus(rawPayload, location) {
    const source = location ? location.source.replace("_", " ") : "GPS --";
    $("gpsSource").textContent = source;
    $("gpsSpeed").textContent = location ? mph(location.speed_mph) : "0 mph";
    if (rawPayload && !rawPayload.valid && !state.browserLocation) $("gpsSource").textContent = rawPayload.reason || "no fix";
  }

  async function pollTrack() {
    try {
      const payload = await fetchJson(API.track);
      state.track = payload.track || null;
      const status = state.track && state.track.status ? state.track.status : "inactive";
      const points = state.track && state.track.point_count ? ` · ${state.track.point_count} pts` : "";
      $("trackStatus").textContent = `Track ${status}${points}`;
    } catch {
      $("trackStatus").textContent = "Track --";
    }
  }

  function openWaypointModal(label, point = null) {
    state.modalPoint = point || state.modalPoint || null;
    $("waypointModeLabel").textContent = label;
    const location = state.modalPoint || state.currentLocation;
    $("waypointLocationHint").textContent = location && validCoord(location.lat, location.lon)
      ? `${number(location.lat, 5)}, ${number(location.lon, 5)} · ${location.source || "gps"}`
      : "No current location available.";
    $("waypointModal").hidden = false;
  }

  function closeWaypointModal() {
    $("waypointModal").hidden = true;
    state.modalPoint = null;
  }

  async function saveWaypoint(type) {
    const location = state.modalPoint || state.currentLocation;
    if (!location || !validCoord(location.lat, location.lon)) {
      toast("No usable location is available.", true);
      return;
    }
    const now = new Date();
    const stamp = now.toLocaleString([], { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
    const label = WAYPOINT_TYPES.find((item) => item[0] === type) || WAYPOINT_TYPES[WAYPOINT_TYPES.length - 1];
    const form = new FormData();
    form.set("name", `${label[1]} - ${stamp}`);
    form.set("lat", String(location.lat));
    form.set("lon", String(location.lon));
    form.set("folder", type === "other" ? "Unfiled" : label[1]);
    form.set("category", type);
    form.set("icon", label[2]);
    form.set("source", location.source || "gps");
    form.set("notes", `Saved from Overland Maps v2. Source: ${location.source || "gps"}.`);
    form.set("location_timestamp", location.timestamp || now.toISOString());
    if (location.accuracy_m !== undefined) form.set("accuracy_m", String(location.accuracy_m));
    if (location.hdop !== undefined) form.set("hdop", String(location.hdop));
    if (location.speed_mph !== undefined) form.set("speed_mph", String(location.speed_mph));
    if (location.heading_deg !== undefined) form.set("heading_deg", String(location.heading_deg));
    if (location.stable) {
      form.set("stabilized", String(Boolean(location.stable.stabilized)));
      form.set("stationary", String(Boolean(location.stable.stationary)));
      form.set("stabilization_mode", location.stable.stabilization_mode || "");
    }
    if (location.raw && validCoord(location.raw.lat, location.raw.lon)) {
      form.set("raw_lat", String(location.raw.lat));
      form.set("raw_lon", String(location.raw.lon));
      if (location.raw.accuracy_m !== undefined) form.set("raw_accuracy_m", String(location.raw.accuracy_m));
      if (location.raw.hdop !== undefined) form.set("raw_hdop", String(location.raw.hdop));
    }
    const response = await fetch(API.save, { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      toast(payload.error || "Waypoint save failed.", true);
      return;
    }
    closeWaypointModal();
    toast(`Saved ${label[1]} waypoint.`);
    await loadOverlandData();
  }

  function renderWaypointTypes() {
    const node = $("waypointTypes");
    node.innerHTML = "";
    for (const [id, label] of WAYPOINT_TYPES) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => saveWaypoint(id));
      node.appendChild(button);
    }
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function bindControls() {
    $("zoomIn").addEventListener("click", () => state.map && state.map.zoomIn());
    $("zoomOut").addEventListener("click", () => state.map && state.map.zoomOut());
    $("followToggle").addEventListener("click", () => {
      state.follow = !state.follow;
      $("followToggle").classList.toggle("is-active", state.follow);
      if (state.follow && state.currentLocation && state.map) {
        state.map.easeTo({ center: [state.currentLocation.lon, state.currentLocation.lat], zoom: Math.max(state.map.getZoom(), 14), duration: 650 });
      }
    });
    $("addCurrentWaypoint").addEventListener("click", () => {
      state.modalPoint = null;
      openWaypointModal("Save current location");
    });
    $("addMapWaypoint").addEventListener("click", () => {
      state.addFromMap = !state.addFromMap;
      $("addMapWaypoint").classList.toggle("is-pending", state.addFromMap);
      toast(state.addFromMap ? "Tap the map to choose a waypoint location." : "Map waypoint mode off.");
    });
    $("layersToggle").addEventListener("click", () => { $("layersPanel").hidden = !$("layersPanel").hidden; });
    $("closeLayers").addEventListener("click", () => { $("layersPanel").hidden = true; });
    $("refreshData").addEventListener("click", () => { loadOverlandData(); pollLocation(); pollTrack(); });
    $("retryMapPack").addEventListener("click", boot);
    $("closeWaypointModal").addEventListener("click", closeWaypointModal);
    $("showWaypoints").checked = state.showWaypoints;
    $("showTracks").checked = state.showTracks;
    $("showWaypoints").addEventListener("change", (event) => {
      state.showWaypoints = event.target.checked;
      localStorage.setItem("omv2.showWaypoints", JSON.stringify(state.showWaypoints));
      updateOverlandSources();
    });
    $("showTracks").addEventListener("change", (event) => {
      state.showTracks = event.target.checked;
      localStorage.setItem("omv2.showTracks", JSON.stringify(state.showTracks));
      updateOverlandSources();
    });
  }

  async function boot() {
    try {
      if (!window.maplibregl || !window.pmtiles) throw new Error("MapLibre or PMTiles did not load.");
      if (!boot.protocolInstalled) {
        const protocol = new pmtiles.Protocol();
        maplibregl.addProtocol("pmtiles", protocol.tile);
        boot.protocolInstalled = true;
      }
      const pack = await loadPack();
      if (!pack) return;
      const style = await loadStyle(pack);
      initMap(style);
    } catch (error) {
      $("missingPack").hidden = false;
      $("mapPackName").textContent = "Maps v2 failed to start";
      toast(error.message, true);
    }
  }

  bindControls();
  renderWaypointTypes();
  boot();
})();
