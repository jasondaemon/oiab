(() => {
  const $ = (id) => document.getElementById(id);
  const API = {
    packs: "/api/maps/packs/installed",
    packStatus: "/api/maps/packs/status",
    overlays: "/api/maps/overlays",
    overlayRegions: "/api/maps/overlays/regions",
    overlayOfflineOnly: "/api/maps/overlays/offline-only",
    data: "/maps-data",
    location: "/maps-location-current",
    track: "/maps-tracks-current",
    trackManualStart: "/api/tracks/manual/start",
    trackManualStop: "/api/tracks/manual/stop",
    save: "/maps-quick-save",
    manage: "/maps-data-manage",
  };
  const MAP_3D_BUILDINGS_KEY = "omv2.show3dBuildings";
  const MAP_AUTO_RECORDING_KEY = "omv2.autoTrackRecording";
  const EMPTY = { type: "FeatureCollection", features: [] };
  const WAYPOINT_TYPES = [
    ["gas", "Gas", "gas-station-ev-station"],
    ["camp", "Camp", "campsite"],
    ["waterfall", "Waterfall", "waterfall"],
    ["lookout", "Lookout", "viewpoint"],
    ["trailhead", "Trailhead", "trailhead"],
    ["food", "Food", "restaurant"],
    ["restroom", "Restroom", "restrooms"],
    ["hazard", "Hazard", "hazard"],
    ["photo", "Photo", "photo"],
    ["other", "Other", "information"],
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
  const ROAD_TYPES = [
    ["", "Default", "#ffd34f"],
    ["interstate", "Interstate", "#ff4f2e"],
    ["main_road", "Main road", "#ff8a2a"],
    ["street", "Minor road / street", "#ffffff"],
    ["gravel", "Gravel road", "#b08d57"],
    ["dirt", "Dirt road", "#8a6a42"],
    ["high_clearance", "High-clearance road", "#f97316"],
    ["trail", "Trail / path", "#555555"],
  ];
  const COLOR_SWATCHES = [
    "#ffd34f", "#ff8a2a", "#ff4f2e", "#74e38a", "#62ccff", "#8be0bd",
    "#c084fc", "#ffffff", "#b08d57", "#8a6a42", "#111827", "#e11d48",
  ];
  const SEARCH_SYNONYMS = {
    gas: ["gas", "fuel", "petrol", "charging", "ev", "service station"],
    fuel: ["fuel", "gas", "petrol", "charging", "ev"],
    grocery: ["grocery", "groceries", "supermarket", "market"],
    food: ["food", "restaurant", "fast food", "cafe", "diner"],
    restroom: ["restroom", "restrooms", "toilet", "toilets", "bathroom"],
    camp: ["camp", "campsite", "campground", "rv"],
    trail: ["trail", "trailhead", "path", "hiking"],
  };
  const MVUM_ROUTE_TYPE_LABELS = {
    "1": "Road open to all vehicles",
    "2": "Road open to highway-legal vehicles",
    "3": "Road open to all vehicles",
    "4": "Trail open to vehicles 50 inches or less",
    "5": "Trail open to motorcycles",
    "6": "Trail open to wheeled vehicles",
    "7": "Special vehicle designation",
    "8": "Seasonal route",
    "17": "ATV Only",
    "18": "Motorcycle Only",
    "19": "OHV / Off-highway vehicle",
  };
  const MAP_KIND_TO_POI_ICON = {
    aerodrome: "airport",
    airport: "airport",
    alpine_hut: "alpine-hut",
    atm: "atm",
    attraction: "attraction",
    bakery: "bakery",
    bank: "bank",
    bar: "bar",
    beach: "beach",
    bicycle_parking: "bicycle-parking",
    bicycle_shop: "bike-shop",
    bus_station: "bus-station",
    cafe: "cafe",
    camp_site: "campsite",
    campsite: "campsite",
    campground: "campground",
    cave_entrance: "cave-entrance",
    cinema: "cinema",
    college: "college-university",
    university: "college-university",
    dog_park: "dog-park",
    drinking_water: "drinking-water",
    fast_food: "fast-food",
    ferry_terminal: "ferry-terminal",
    fire_station: "fire-station",
    fuel: "gas-station-ev-station",
    gas_station: "gas-station-ev-station",
    charging_station: "gas-station-ev-station",
    garden: "garden",
    golf_course: "golf-course",
    supermarket: "grocery-store",
    convenience: "grocery-store",
    grocery: "grocery-store",
    hotel: "lodging",
    motel: "lodging",
    hot_spring: "hotspring",
    information: "information",
    library: "library",
    lighthouse: "lighthouse",
    marina: "marina",
    hospital: "medical-clinic-hospital",
    clinic: "medical-clinic-hospital",
    doctors: "medical-clinic-hospital",
    pharmacy: "pharmacy",
    mine: "mine-quarry",
    quarry: "mine-quarry",
    museum: "museum",
    outdoor: "outdoor-store",
    parking: "parking",
    parking_lot: "parking",
    peak: "peak-summit",
    picnic_site: "picnic-area",
    playground: "playground",
    police: "police-station",
    post_office: "post-office",
    pub: "pub-brewery",
    ranger_station: "ranger-station",
    restaurant: "restaurant",
    restroom: "restrooms",
    restrooms: "restrooms",
    station: "train-station",
    bus_stop: "bus-station",
    toilet: "restrooms",
    toilets: "restrooms",
    rv_site: "rv-camping",
    school: "school",
    shelter: "shelter",
    shop: "shopping",
    ski: "ski-area",
    spring: "spring",
    swimming_pool: "swimming-area",
    theatre: "theater",
    theme_park: "theme-park",
    trailhead: "trailhead",
    train_station: "train-station",
    viewpoint: "viewpoint",
    lookout: "lookout-tower",
    visitor_center: "visitor-center",
    volcano: "volcano",
    waterfall: "waterfall",
    zoo: "zoo",
  };
  const WAYPOINT_CATEGORY_TO_POI_ICON = {
    gas: "gas-station-ev-station",
    fuel: "gas-station-ev-station",
    camp: "campsite",
    campsite: "campsite",
    campground: "campground",
    waterfall: "waterfall",
    water: "drinking-water",
    lookout: "viewpoint",
    viewpoint: "viewpoint",
    trailhead: "trailhead",
    home: "house-home",
    house: "house-home",
    food: "restaurant",
    restaurant: "restaurant",
    restroom: "restrooms",
    restrooms: "restrooms",
    toilet: "restrooms",
    hazard: "hazard",
    photo: "photo",
    parking: "parking",
    library: "library",
    other: "information",
    waypoint: "information",
    quick_save: "information",
    "quick-save": "information",
  };
  const POI_ICON_KEYS = Array.from(new Set([
    ...Object.values(MAP_KIND_TO_POI_ICON),
    ...Object.values(WAYPOINT_CATEGORY_TO_POI_ICON),
    "information",
  ])).sort();

  const state = {
    map: null,
    packSelection: null,
    follow: false,
    addFromMap: false,
    currentLocation: null,
    browserLocation: null,
    browserWatchId: null,
    folders: new Set(),
    hiddenFolders: new Set(JSON.parse(localStorage.getItem("omv2.hiddenFolders") || "[]")),
    showWaypoints: JSON.parse(localStorage.getItem("omv2.showWaypoints") || "true"),
    showTracks: JSON.parse(localStorage.getItem("omv2.showTracks") || "true"),
    show3dBuildings: JSON.parse(localStorage.getItem(MAP_3D_BUILDINGS_KEY) || "false"),
    places: EMPTY,
    track: null,
    vehicleMarker: null,
    modalPoint: null,
    editingItem: null,
    deletingItem: null,
    missingPackPoll: null,
    dataTimer: null,
    locationTimer: null,
    trackTimer: null,
    packTimer: null,
    packSignature: "",
    overlayRegistry: null,
    tileErrors: [],
    inspectTile: false,
    offlineRegionDraw: false,
    offlineRegionStart: null,
    offlineRegionDraft: null,
    offlineRegionEditing: null,
    managerSnapshot: { folders: [], items: [] },
    managerSelectedItems: new Set(),
    managerSelectedFolders: new Set(),
    managerOpenFolders: new Set(),
    searchResults: [],
    manualRecording: false,
  };

  function toast(message, error = false) {
    const node = $("toast");
    node.textContent = message;
    node.classList.toggle("is-error", error);
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 3200);
  }

  function setPackMessage(message, error = false) {
    const node = $("mapPackMessage");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(error));
  }

  function worldOverviewJob(registry) {
    const jobs = registry?.jobs || {};
    return jobs.world_overview || null;
  }

  function renderMissingPack(registry = {}) {
    const job = worldOverviewJob(registry);
    const title = $("missingPackTitle");
    const intro = $("missingPackIntro");
    const installButton = $("installWorldOverview");
    const status = String(job?.status || "");
    $("missingPack").hidden = false;
    $("mapPackName").textContent = "No active map pack";
    installButton.disabled = status === "pending" || status === "running";
    if (status === "pending" || status === "running") {
      title.textContent = "Setting up maps";
      intro.textContent = "World Overview is installing in the background. Maps will load automatically when it is ready.";
      setPackMessage(`World Overview install ${status}${job?.progress ? ` · ${job.progress}%` : ""}.`);
      return;
    }
    if (status === "failed") {
      title.textContent = "Map setup needs attention";
      intro.textContent = "World Overview could not install automatically. Retry it, open Map Pack Settings, or rescan local PMTiles.";
      setPackMessage(job?.error || "World Overview install failed.", true);
      return;
    }
    title.textContent = "No active map pack";
    intro.textContent = "Install World Overview from the catalog, or use Map Pack Settings to install CONUS or state packs.";
    setPackMessage("");
  }

  function stopMissingPackPoll() {
    if (state.missingPackPoll) {
      clearInterval(state.missingPackPoll);
      state.missingPackPoll = null;
    }
  }

  function startMissingPackPoll() {
    if (state.missingPackPoll) return;
    state.missingPackPoll = setInterval(async () => {
      try {
        const registry = await fetchJson(API.packStatus, { ok: false, basemaps: [] });
        const selection = normalizePackSelection(registry);
        if (selection) {
          stopMissingPackPoll();
          await boot();
          return;
        }
        renderMissingPack(registry);
      } catch (error) {
        setPackMessage(error.message, true);
      }
    }, 3000);
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
    return normalizeFolderName((feature.properties || {}).folder);
  }

  function normalizeFolderName(folder) {
    if (folder && typeof folder === "object") {
      return String(folder.name || folder.folder || "Unfiled").trim() || "Unfiled";
    }
    return String(folder || "Unfiled").trim() || "Unfiled";
  }

  function categoryOf(feature) {
    return String((feature.properties || {}).category || (feature.geometry && feature.geometry.type === "LineString" ? "route" : "waypoint")).toLowerCase();
  }

  function colorFor(feature) {
    const props = feature.properties || {};
    return props.color || CATEGORY_COLORS[categoryOf(feature)] || "#ffd34f";
  }

  function waypointIconKey(properties = {}) {
    const raw = String(properties.icon || properties.category || properties.type || "waypoint")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return WAYPOINT_CATEGORY_TO_POI_ICON[raw] || (POI_ICON_KEYS.includes(raw) ? raw : "information");
  }

  function featureName(feature) {
    const props = feature.properties || {};
    return props.name || props.title || props.category || "Saved place";
  }

  function validCoord(lat, lon) {
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
  }

  function parseCoordinateQuery(query) {
    const raw = String(query || "").trim();
    if (!raw) return null;
    const normalized = raw
      .replace(/[;|]/g, ",")
      .replace(/\s+/g, " ")
      .replace(/^[^\d+-]+/, "")
      .replace(/[^\d.,+\-\s]+$/g, "");
    const match = normalized.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/);
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (validCoord(first, second)) return { lat: first, lon: second };
    if (validCoord(second, first)) return { lat: second, lon: first };
    return null;
  }

  async function fetchJson(url, fallback = null, options = {}) {
    const response = await fetch(url, { cache: "no-cache", ...options });
    if (!response.ok) {
      if (fallback !== null) return fallback;
      throw new Error(`${url} returned ${response.status}`);
    }
    return response.json();
  }

  async function postJson(url, body = {}) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = JSON.parse(text || "{}");
    } catch {
      throw new Error(`${url} returned non-JSON (${response.status}).`);
    }
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `${url} returned ${response.status}`);
    return payload;
  }

  async function setOverlayEnabled(id, enabled) {
    return postJson("/api/maps/overlays/set-enabled", { id, enabled });
  }

  async function setOverlayOpacity(id, opacity) {
    return postJson("/api/maps/overlays/set-opacity", { id, opacity });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function localizeStyle(style) {
    style.glyphs = absoluteTemplateUrl("/maps-v2/fonts/{fontstack}/{range}.pbf?v=oiab-glyph-fallback-1");
    if (!style.sprite || String(style.sprite).includes("maps.black") || String(style.sprite).startsWith("/")) {
      style.sprite = absoluteTemplateUrl("/maps-v2/sprites/legacy/protomaps-light/sprites");
    }
    normalizeStyleFonts(style);
    return style;
  }

  function absoluteTemplateUrl(value) {
    if (!value) return value;
    if (/^https?:\/\//i.test(String(value))) return value;
    const raw = String(value);
    if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
    return `${window.location.href.replace(/[^/]*$/, "")}${raw}`;
  }

  function normalizeStyleFonts(value) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        if (value[i] === "Noto Sans Medium" || value[i] === "Noto Sans Italic") {
          value[i] = "Noto Sans Regular";
        } else {
          normalizeStyleFonts(value[i]);
        }
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) normalizeStyleFonts(value[key]);
  }

  function templateVectorSource(style) {
    const sources = style.sources || {};
    if (sources.basemap && sources.basemap.type === "vector") return { id: "basemap", source: sources.basemap };
    const found = Object.entries(sources).find(([, source]) => source && source.type === "vector");
    if (found) return { id: found[0], source: found[1] };
    return { id: "basemap", source: {} };
  }

  function sourceIdFor(pack) {
    return `pack-${String(pack.id || "map").replace(/[^a-z0-9_-]+/gi, "-")}`;
  }

  function overlaySourceId(overlay, variant = "") {
    const base = `overlay-${String(overlay.id || "source").replace(/[^a-z0-9_-]+/gi, "-")}`;
    return variant ? `${base}-${String(variant).replace(/[^a-z0-9_-]+/gi, "-")}` : base;
  }

  function overlayLayerId(overlay, suffix, variant = "") {
    return `${overlaySourceId(overlay, variant)}-${suffix}`;
  }

  function poiImageId(key) {
    return `oiab-poi-${String(key || "information").replace(/[^a-z0-9_-]+/gi, "-")}`;
  }

  function poiMarkerImageId(key) {
    return `oiab-poi-marker-${String(key || "information").replace(/[^a-z0-9_-]+/gi, "-")}`;
  }

  function mapPoiMatchExpression(property, mapping, fallback = "information", idFactory = poiImageId) {
    const expression = ["match", ["get", property]];
    for (const [value, iconKey] of Object.entries(mapping)) {
      expression.push(value, idFactory(iconKey));
    }
    expression.push(idFactory(fallback));
    return expression;
  }

  async function loadSvgMapImage(id, url, size = 96) {
    if (!state.map || state.map.hasImage(id)) return;
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    const svg = await response.text();
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const image = new Image();
      image.decoding = "async";
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      state.map.addImage(id, context.getImageData(0, 0, size, size), { pixelRatio: 2 });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function loadPoiImages() {
    const tasks = POI_ICON_KEYS.flatMap((key) => [
      loadSvgMapImage(poiImageId(key), `/maps-v2/icons/poi/${key}.svg`).catch((error) => {
        console.warn("[OIAB Maps v2] POI icon failed", key, error);
      }),
      loadSvgMapImage(poiMarkerImageId(key), `/maps-v2/icons/poi-marker/${key}.svg`, 120).catch((error) => {
        console.warn("[OIAB Maps v2] POI marker failed", key, error);
      }),
    ]);
    await Promise.all(tasks);
  }

  function addMilitaryHatchPattern() {
    if (!state.map || state.map.hasImage("oiab-military-hatch")) return;
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, size, size);
    context.strokeStyle = "rgba(220, 38, 38, 0.72)";
    context.lineWidth = 3;
    for (let x = -size; x < size * 2; x += 12) {
      context.beginPath();
      context.moveTo(x, size);
      context.lineTo(x + size, 0);
      context.stroke();
    }
    state.map.addImage("oiab-military-hatch", context.getImageData(0, 0, size, size), { pixelRatio: 1 });
  }

  function addMilitaryHatchLayer() {
    if (!state.map || state.map.getLayer("oiab-military-hatch") || !state.map.getSource("naturalearth-protomaps")) return;
    addMilitaryHatchPattern();
    state.map.addLayer({
      id: "oiab-military-hatch",
      type: "fill",
      source: "naturalearth-protomaps",
      "source-layer": "landuse",
      filter: ["in", ["get", "kind"], ["literal", ["military", "naval_base"]]],
      paint: {
        "fill-pattern": "oiab-military-hatch",
        "fill-opacity": 0.45,
      },
    });
  }

  function addBasePoiIconLayer() {
    const sourceId = sourceIdFor(state.packSelection?.base || {});
    if (!state.map || !state.map.getSource(sourceId) || state.map.getLayer("oiab-poi-icons")) return;
    const beforeId = state.map.getLayer("oiab-travel-poi-labels") ? "oiab-travel-poi-labels" : undefined;
    state.map.addLayer({
      id: "oiab-poi-icons",
      type: "symbol",
      source: sourceId,
      "source-layer": "pois",
      minzoom: 13,
      filter: ["in", ["get", "kind"], ["literal", Object.keys(MAP_KIND_TO_POI_ICON)]],
      layout: {
        "icon-image": mapPoiMatchExpression("kind", MAP_KIND_TO_POI_ICON, "information", poiMarkerImageId),
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.22, 15, 0.3, 18, 0.42],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-optional": false,
        "icon-padding": 2,
      },
    }, beforeId);
  }

  function numericPackZoom(pack, key, fallback) {
    const aliases = key === "maxzoom"
      ? [pack.actual_maxzoom, pack.actual_max_zoom, pack.maxzoom, pack.max_zoom, pack.catalog_maxzoom, pack.catalog_max_zoom]
      : [pack.actual_minzoom, pack.actual_min_zoom, pack.minzoom, pack.min_zoom, pack.catalog_minzoom, pack.catalog_min_zoom];
    for (const value of aliases) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  function packZoomDiagnostics(pack, templateSource = {}) {
    const sourceMinzoom = numericPackZoom(pack, "minzoom", templateSource.minzoom ?? 0);
    const sourceMaxzoom = numericPackZoom(pack, "maxzoom", templateSource.maxzoom ?? 15);
    const catalogMax = Number(pack.catalog_maxzoom ?? pack.catalog_max_zoom);
    const actualMax = Number(pack.actual_maxzoom ?? pack.actual_max_zoom);
    return {
      sourceMinzoom,
      sourceMaxzoom,
      catalogMinzoom: pack.catalog_minzoom ?? pack.catalog_min_zoom ?? "",
      catalogMaxzoom: Number.isFinite(catalogMax) ? catalogMax : "",
      actualMinzoom: pack.actual_minzoom ?? pack.actual_min_zoom ?? "",
      actualMaxzoom: Number.isFinite(actualMax) ? actualMax : "",
      warning: Number.isFinite(actualMax) && Number.isFinite(catalogMax) && actualMax < catalogMax
        ? `Catalog maxzoom ${catalogMax} is higher than actual PMTiles maxzoom ${actualMax}; using actual archive maxzoom.`
        : "",
    };
  }

  function normalizeOverlayRegistry(registry) {
    return (Array.isArray(registry?.overlays) ? registry.overlays : [])
      .sort((a, b) => Number(a.sort_order ?? 100) - Number(b.sort_order ?? 100));
  }

  function offlineRegions(registry = state.overlayRegistry) {
    return Array.isArray(registry?.offline_regions) ? registry.offline_regions : [];
  }

  function cacheableOfflineOverlays(registry = state.overlayRegistry) {
    return normalizeOverlayRegistry(registry).filter((overlay) => overlay?.cacheable_region);
  }

  function bboxToString(bbox) {
    return Array.isArray(bbox) && bbox.length === 4 ? bbox.map((value) => Number(value).toFixed(6)).join(",") : "";
  }

  function bboxFromString(text) {
    const parts = String(text || "").split(",").map((value) => Number(value.trim()));
    return parts.length === 4 && parts.every((value) => Number.isFinite(value)) ? parts : null;
  }

  function enabledOverlays(registry) {
    return normalizeOverlayRegistry(registry)
      .filter((overlay) => overlay && overlay.enabled && overlay.available);
  }

  function overlaySignature(overlays) {
    return overlays.map((overlay) => ({
      id: overlay.id,
      type: overlay.type,
      source_type: overlay.source_type || "",
      url: overlay.url || overlay.source_url,
      tiles: overlay.tiles || [],
      source_layer: overlay.source_layer || "",
      enabled: Boolean(overlay.enabled),
      opacity: Number(overlay.opacity ?? 1),
      sort_order: Number(overlay.sort_order ?? 100),
      cache_status: overlay.cache_status || "",
      last_fetch_at: overlay.last_fetch_at || "",
      expires_at: overlay.expires_at || "",
      size_bytes: Number(overlay.size_bytes || 0),
      region_sources: (overlay.region_sources || []).map((region) => ({
        id: region.region_id || "",
        url: region.url || "",
        size_bytes: Number(region.size_bytes || 0),
      })),
    }));
  }

  function normalizePackSelection(registry) {
    const basemaps = (Array.isArray(registry.basemaps) ? registry.basemaps : []).filter((pack) => pack && pack.exists);
    if (!basemaps.length) return null;
    const byId = new Map(basemaps.map((pack) => [String(pack.id), pack]));
    const activeId = String(registry.active || registry.active_basemap || "");
    const detailed = byId.get(activeId);
    const base = detailed || byId.get("world_overview") || basemaps[0];
    return {
      base,
      overlays: enabledOverlays(state.overlayRegistry),
      all: [base],
      overlayCount: enabledOverlays(state.overlayRegistry).length,
    };
  }

  function selectionSignature(selection) {
    return JSON.stringify({
      packs: (selection?.all || []).map((pack) => ({
        id: pack.id,
        url: pack.url,
        public_url: pack.public_url,
        version: pack.version || "",
        size_bytes: pack.size_bytes || 0,
        mtime_ns: pack.mtime_ns || 0,
        enabled: Boolean(pack.enabled),
      })),
      overlays: overlaySignature(selection?.overlays || []),
      offline_regions_only: Boolean(state.overlayRegistry?.offline_regions_only),
    });
  }

  async function loadPack() {
    const registry = await fetchJson(API.packs, { ok: false, basemaps: [] });
    state.overlayRegistry = await fetchJson(API.overlays, { ok: false, overlays: [] });
    const selection = normalizePackSelection(registry);
    if (!selection) {
      renderMissingPack(registry);
      startMissingPackPoll();
      return null;
    }
    stopMissingPackPoll();
    $("missingPack").hidden = true;
    $("mapPackName").textContent = selection.base.name || selection.base.id;
    state.packSelection = selection;
    return selection;
  }

  function overlayOpacity(overlay) {
    const value = Number(overlay.opacity);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  }

  function applyOverlayOpacity(layer, opacity) {
    const copy = clone(layer);
    copy.paint = copy.paint || {};
    if (copy.type === "raster") copy.paint["raster-opacity"] = opacity;
    if (copy.type === "fill") copy.paint["fill-opacity"] = opacity;
    if (copy.type === "line") copy.paint["line-opacity"] = opacity;
    if (copy.type === "circle") copy.paint["circle-opacity"] = opacity;
    if (copy.type === "symbol") {
      copy.paint["icon-opacity"] = opacity;
      copy.paint["text-opacity"] = opacity;
    }
    if (copy.type === "fill-extrusion") copy.paint["fill-extrusion-opacity"] = opacity;
    return copy;
  }

  function mvumLinePaint(opacity) {
    return {
      "line-color": [
        "match",
        ["coalesce", ["get", "style_bucket"], ["get", "route_type"], ["get", "route_type_label"], ""],
        "restricted", "#ff7068",
        "closed", "#ff7068",
        "seasonal", "#ffd34f",
        "high_clearance", "#f97316",
        "atv_only", "#22c55e",
        "motorcycle_only", "#60a5fa",
        "trail", "#c084fc",
        "open_motorized", "#ff8c2f",
        "17", "#22c55e",
        "18", "#60a5fa",
        "#a3a3a3",
      ],
      "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.2, 12, 2.2, 16, 4],
      "line-opacity": opacity,
    };
  }

  function routeLinePaint() {
    return {
      "line-color": ["coalesce", ["get", "color"], ["match", ["get", "road_type"], "interstate", "#ff4f2e", "main_road", "#ff8a2a", "street", "#ffffff", "gravel", "#b08d57", "dirt", "#8a6a42", "high_clearance", "#f97316", "trail", "#555555", "#ffd34f"]],
      "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2, 12, 4, 16, 7],
      "line-opacity": 0.95,
    };
  }

  function blmOverlayLayers(overlay, sourceId, sourceLayer = null) {
    const opacity = overlayOpacity(overlay);
    const minzoom = Number(overlay.minzoom ?? overlay.metadata?.minzoom ?? 0);
    const maxzoom = Number(overlay.maxzoom ?? overlay.metadata?.maxzoom ?? 22);
    const agencyExpr = ["upcase", ["coalesce", ["get", "agency"], ["get", "ADMIN_AGENCY_CODE"], ""]];
    const blmFillFar = [
      "case",
      ["==", agencyExpr, "BLM"],
      "#f3d98a",
      "#dfcf9d",
    ];
    const blmFillNear = [
      "case",
      ["==", agencyExpr, "BLM"],
      "#efc96e",
      "#d9c287",
    ];
    const blmBoundaryColor = [
      "case",
      ["==", agencyExpr, "BLM"],
      "#8f6d27",
      "#8f7f52",
    ];
    const blmBoundaryCasing = [
      "case",
      ["==", agencyExpr, "BLM"],
      "#f8eac2",
      "#ece1b9",
    ];
    const shared = {
      source: sourceId,
      ...(sourceLayer ? { "source-layer": sourceLayer } : {}),
      minzoom,
      maxzoom,
    };
    return [
      {
        id: overlayLayerId(overlay, "blm-fill-far"),
        type: "fill",
        ...shared,
        minzoom: Math.max(minzoom, 4),
        maxzoom: Math.min(maxzoom, 8),
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": blmFillFar,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            Math.max(minzoom, 4),
            opacity * 0.12,
            6,
            opacity * 0.17,
            8,
            opacity * 0.22,
          ],
        },
      },
      {
        id: overlayLayerId(overlay, "blm-fill-near"),
        type: "fill",
        ...shared,
        minzoom: Math.max(minzoom, 8),
        maxzoom,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": blmFillNear,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            opacity * 0.24,
            10,
            opacity * 0.3,
            12,
            opacity * 0.36,
            13,
            opacity * 0.4,
            16,
            opacity * 0.46,
          ],
        },
      },
      {
        id: overlayLayerId(overlay, "blm-boundary-casing"),
        type: "line",
        ...shared,
        minzoom: Math.max(minzoom, 10),
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
        paint: {
          "line-color": blmBoundaryCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.35, 11, 1.95, 13, 2.8, 16, 3.8],
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            opacity * 0.22,
            11,
            opacity * 0.4,
            13,
            opacity * 0.6,
            16,
            opacity * 0.78,
          ],
        },
      },
      {
        id: overlayLayerId(overlay, "blm-boundary"),
        type: "line",
        ...shared,
        minzoom: Math.max(minzoom, 10),
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
        paint: {
          "line-color": blmBoundaryColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 11, 1.25, 13, 1.75, 16, 2.4],
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            opacity * 0.28,
            11,
            opacity * 0.52,
            13,
            opacity * 0.78,
            16,
            opacity * 0.98,
          ],
        },
      },
    ];
  }

  function blmWildernessOverlayLayers(overlay, sourceId, sourceLayer = null) {
    const opacity = overlayOpacity(overlay);
    const minzoom = Number(overlay.minzoom ?? overlay.metadata?.minzoom ?? 0);
    const maxzoom = Number(overlay.maxzoom ?? overlay.metadata?.maxzoom ?? 22);
    const classExpr = ["coalesce", ["get", "class"], ""];
    const fillColor = [
      "match",
      classExpr,
      "wilderness_area",
      "#e7b45a",
      "wilderness_study_area",
      "#8fb39a",
      "#d6c086",
    ];
    const lineColor = [
      "match",
      classExpr,
      "wilderness_area",
      "#91641f",
      "wilderness_study_area",
      "#5a7d64",
      "#8f7f52",
    ];
    const lineCasing = [
      "match",
      classExpr,
      "wilderness_area",
      "#f4dcc0",
      "wilderness_study_area",
      "#dce9df",
      "#ece1b9",
    ];
    const shared = {
      source: sourceId,
      ...(sourceLayer ? { "source-layer": sourceLayer } : {}),
      minzoom,
      maxzoom,
    };
    return [
      {
        id: overlayLayerId(overlay, "wilderness-fill-far"),
        type: "fill",
        ...shared,
        minzoom: Math.max(minzoom, 4),
        maxzoom: Math.min(maxzoom, 9),
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": fillColor,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            Math.max(minzoom, 4),
            opacity * 0.14,
            6,
            opacity * 0.2,
            9,
            opacity * 0.28,
          ],
        },
      },
      {
        id: overlayLayerId(overlay, "wilderness-fill-near"),
        type: "fill",
        ...shared,
        minzoom: Math.max(minzoom, 9),
        maxzoom,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": fillColor,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            opacity * 0.3,
            11,
            opacity * 0.38,
            13,
            opacity * 0.46,
            16,
            opacity * 0.54,
          ],
        },
      },
      {
        id: overlayLayerId(overlay, "wilderness-boundary-casing"),
        type: "line",
        ...shared,
        minzoom: Math.max(minzoom, 10),
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
        paint: {
          "line-color": lineCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 12, 2.1, 14, 2.8, 16, 3.6],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, opacity * 0.28, 12, opacity * 0.44, 16, opacity * 0.7],
        },
      },
      {
        id: overlayLayerId(overlay, "wilderness-boundary"),
        type: "line",
        ...shared,
        minzoom: Math.max(minzoom, 10),
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
        paint: {
          "line-color": lineColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 12, 1.35, 14, 1.8, 16, 2.3],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, opacity * 0.4, 12, opacity * 0.62, 16, opacity * 0.95],
        },
      },
    ];
  }

  function contourOverlayLayers(overlay, sourceId, sourceLayer = null, variant = "") {
    const opacity = overlayOpacity(overlay);
    const minzoom = Number(overlay.minzoom ?? overlay.metadata?.minzoom ?? 9);
    const maxzoom = 24;
    const shared = {
      source: sourceId,
      ...(sourceLayer ? { "source-layer": sourceLayer } : {}),
      minzoom,
      maxzoom,
    };
    return [
      {
        id: overlayLayerId(overlay, "contour-index", variant),
        type: "line",
        ...shared,
        minzoom: Math.max(minzoom, 9),
        filter: [
          "all",
          ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
          ["==", ["get", "contour_type"], "index"],
        ],
        paint: {
          "line-color": "#3f2f1b",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.05, 12, 1.6, 16, 2.45, 20, 3.15],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, opacity * 0.74, 12, opacity * 0.88, 16, opacity, 20, opacity],
        },
      },
      {
        id: overlayLayerId(overlay, "contour-normal", variant),
        type: "line",
        ...shared,
        minzoom: Math.max(minzoom, 11),
        filter: [
          "all",
          ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
          ["==", ["get", "contour_type"], "normal"],
        ],
        paint: {
          "line-color": "#6b5737",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.72, 13, 1.05, 16, 1.55, 20, 2.05],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 11, opacity * 0.5, 13, opacity * 0.68, 16, opacity * 0.86, 20, opacity * 0.92],
        },
      },
      {
        id: overlayLayerId(overlay, "contour-label", variant),
        type: "symbol",
        ...shared,
        minzoom: Math.max(minzoom, 12),
        filter: [
          "all",
          ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
          ["==", ["get", "contour_type"], "index"],
        ],
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 14, 11, 16, 12],
          "text-letter-spacing": 0.02,
          "symbol-spacing": 420,
          "text-keep-upright": true,
        },
        paint: {
          "text-color": "#2f2415",
          "text-halo-color": "rgba(249, 246, 231, 0.92)",
          "text-halo-width": 1.6,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, opacity * 0.74, 16, opacity, 20, opacity],
        },
      },
    ];
  }

  function defaultOverlayLayers(overlay, sourceId, sourceLayer = null, variant = "") {
    const opacity = overlayOpacity(overlay);
    const style = overlay.style || overlay.category || "";
    const minzoom = Number(overlay.minzoom ?? overlay.metadata?.minzoom ?? 0);
    const maxzoom = Number(overlay.maxzoom ?? overlay.metadata?.maxzoom ?? 22);
    if (overlay.type === "raster") {
      return [{
        id: overlayLayerId(overlay, "raster", variant),
        type: "raster",
        source: sourceId,
        minzoom,
        maxzoom,
        paint: { "raster-opacity": opacity },
      }];
    }
    if (overlay.type === "geojson") {
      if (style === "usgs_contours" || overlay.id === "usgs_topographic_contours") {
        return contourOverlayLayers(overlay, sourceId, null, variant);
      }
      if (style === "public_lands_blm_wilderness") {
        return blmWildernessOverlayLayers(overlay, sourceId);
      }
      if (style === "public_lands_blm" || overlay.category === "public_lands") {
        return blmOverlayLayers(overlay, sourceId);
      }
      if (style === "weather_alerts") {
        return [
          {
          id: overlayLayerId(overlay, "weather-fill", variant),
            type: "fill",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: {
              "fill-color": ["match", ["get", "severity"], "Extreme", "#7f1d1d", "Severe", "#ef4444", "Moderate", "#f59e0b", "Minor", "#facc15", "#60a5fa"],
              "fill-opacity": opacity * 0.28,
            },
          },
          {
            id: overlayLayerId(overlay, "weather-line", variant),
            type: "line",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
            paint: {
              "line-color": ["match", ["get", "severity"], "Extreme", "#7f1d1d", "Severe", "#ef4444", "Moderate", "#f59e0b", "Minor", "#facc15", "#60a5fa"],
              "line-width": 2,
              "line-opacity": opacity,
            },
          },
        ];
      }
      if (style === "wildfire_hotspots") {
        return [{
          id: overlayLayerId(overlay, "hotspots", variant),
          type: "circle",
          source: sourceId,
          minzoom,
          maxzoom,
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2.5, 8, 4.5, 13, 7],
            "circle-color": ["case", ["==", ["get", "confidence"], "h"], "#ff2d1f", ["==", ["get", "confidence"], "n"], "#ff8c1a", "#ffd34f"],
            "circle-stroke-color": "#4a0906",
            "circle-stroke-width": 1.5,
            "circle-opacity": opacity,
          },
        }];
      }
      if (style === "mvum_roads" || style === "mvum_trails" || overlay.category === "mvum") {
        return [{
          id: overlayLayerId(overlay, "mvum-line", variant),
          type: "line",
          source: sourceId,
          minzoom,
          maxzoom,
          filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
          paint: mvumLinePaint(opacity),
        }];
      }
      return [
        {
          id: overlayLayerId(overlay, "fill", variant),
          type: "fill",
          source: sourceId,
          minzoom,
          maxzoom,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#ffcf45", "fill-opacity": opacity * 0.22 },
        },
        {
          id: overlayLayerId(overlay, "line", variant),
          type: "line",
          source: sourceId,
          minzoom,
          maxzoom,
          filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
          paint: { "line-color": "#ffcf45", "line-width": 2, "line-opacity": opacity },
        },
        {
          id: overlayLayerId(overlay, "point", variant),
          type: "circle",
          source: sourceId,
          minzoom,
          maxzoom,
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3, 14, 6],
            "circle-color": "#ffcf45",
            "circle-stroke-color": "#102719",
            "circle-stroke-width": 1.5,
            "circle-opacity": opacity,
          },
        },
      ];
    }
    const pmtilesSourceLayer = sourceLayer || overlay.source_layer;
    if (overlay.type === "pmtiles" && pmtilesSourceLayer) {
      if (style === "usgs_contours" || overlay.id === "usgs_topographic_contours") {
        return contourOverlayLayers(overlay, sourceId, pmtilesSourceLayer, variant);
      }
      if (style === "public_lands_blm_wilderness") {
        return blmWildernessOverlayLayers(overlay, sourceId, pmtilesSourceLayer);
      }
      if (style === "public_lands_blm" || overlay.category === "public_lands") {
        return blmOverlayLayers(overlay, sourceId, pmtilesSourceLayer);
      }
      if (style === "mvum_roads" || style === "mvum_trails" || overlay.category === "mvum") {
        return [{
          id: overlayLayerId(overlay, "mvum-line", variant),
          type: "line",
          source: sourceId,
          "source-layer": pmtilesSourceLayer,
          minzoom,
          maxzoom,
          filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
          paint: mvumLinePaint(opacity),
        }];
      }
      return [
        {
          id: overlayLayerId(overlay, "fill", variant),
          type: "fill",
          source: sourceId,
          "source-layer": pmtilesSourceLayer,
          minzoom,
          maxzoom,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#ffcf45", "fill-opacity": opacity * 0.22 },
        },
        {
          id: overlayLayerId(overlay, "line", variant),
          type: "line",
          source: sourceId,
          "source-layer": pmtilesSourceLayer,
          minzoom,
          maxzoom,
          filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
          paint: { "line-color": "#ffcf45", "line-width": 2, "line-opacity": opacity },
        },
        {
          id: overlayLayerId(overlay, "point", variant),
          type: "circle",
          source: sourceId,
          "source-layer": pmtilesSourceLayer,
          minzoom,
          maxzoom,
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3, 14, 6],
            "circle-color": "#ffcf45",
            "circle-stroke-color": "#102719",
            "circle-stroke-width": 1.5,
            "circle-opacity": opacity,
          },
        },
      ];
    }
    return [];
  }

  function overlayLayerIds(overlay) {
    const variants = Array.isArray(overlay.region_sources) && overlay.region_sources.length
      ? overlay.region_sources.map((item) => ({ sourceId: overlaySourceId(overlay, item.region_id || item.region_name || "region"), variant: item.region_id || item.region_name || "region" }))
      : [{ sourceId: overlaySourceId(overlay), variant: "" }];
    const customLayers = Array.isArray(overlay.layers) ? overlay.layers : [];
    const layers = variants.flatMap(({ sourceId, variant }) => (
      customLayers.length
        ? customLayers.map((layer, index) => ({ ...layer, id: layer.id || overlayLayerId(overlay, `custom-${index}`, variant) }))
        : defaultOverlayLayers(overlay, sourceId, overlay.type === "pmtiles" ? overlay.source_layer : null, variant)
    ));
    return layers
      .filter((layer) => layer && layer.id && layer.type !== "raster")
      .map((layer) => layer.id);
  }

  function appendOverlaySourcesAndLayers(style, overlays) {
    if (!overlays.length) return;
    style.sources = style.sources || {};
    style.layers = Array.isArray(style.layers) ? style.layers : [];
    const overlayLayers = [];
    for (const overlay of overlays) {
      const sourceId = overlaySourceId(overlay);
      const sourceUrl = overlay.url || overlay.source_url;
      if (overlay.type === "pmtiles" && Array.isArray(overlay.region_sources) && overlay.region_sources.length) {
        for (const regionSource of overlay.region_sources) {
          const regionSourceId = overlaySourceId(overlay, regionSource.region_id || regionSource.region_name || "region");
          style.sources[regionSourceId] = {
            type: "vector",
            url: `pmtiles://${new URL(regionSource.url, window.location.href).href}`,
            attribution: overlay.attribution || "",
          };
          const layers = defaultOverlayLayers(overlay, regionSourceId, overlay.source_layer, regionSource.region_id || regionSource.region_name || "region");
          overlayLayers.push(...layers);
        }
        continue;
      }
      if (overlay.type === "raster") {
        const tiles = overlay.cached_tile_url_template
          ? [`${overlay.cached_tile_url_template}?offline_only=${state.overlayRegistry?.offline_regions_only ? "1" : "0"}`]
          : Array.isArray(overlay.tiles) && overlay.tiles.length ? overlay.tiles : sourceUrl ? [sourceUrl] : [];
        if (!tiles.length) continue;
        style.sources[sourceId] = {
          type: "raster",
          tiles: tiles.map((tile) => absoluteTemplateUrl(tile)),
          tileSize: Number(overlay.metadata?.tile_size || overlay.tile_size || 256),
          minzoom: Number(overlay.minzoom ?? overlay.metadata?.minzoom ?? 0),
          maxzoom: Number(overlay.maxzoom ?? overlay.metadata?.maxzoom ?? 22),
          attribution: overlay.attribution || "",
        };
      } else if (overlay.type === "geojson") {
        if (!sourceUrl) continue;
        style.sources[sourceId] = {
          type: "geojson",
          data: absoluteTemplateUrl(sourceUrl),
          attribution: overlay.attribution || "",
        };
      } else if (overlay.type === "pmtiles") {
        if (!sourceUrl) continue;
        style.sources[sourceId] = {
          type: "vector",
          url: `pmtiles://${new URL(sourceUrl, window.location.href).href}`,
          attribution: overlay.attribution || "",
        };
      } else {
        continue;
      }
      const customLayers = Array.isArray(overlay.layers) ? overlay.layers : [];
      const layers = customLayers.length
        ? customLayers.map((layer, index) => {
          const next = { ...layer, id: layer.id || overlayLayerId(overlay, `custom-${index}`), source: layer.source || sourceId };
          if (overlay.type === "pmtiles" && overlay.source_layer && !next["source-layer"]) next["source-layer"] = overlay.source_layer;
          return applyOverlayOpacity(next, overlayOpacity(overlay));
        })
        : defaultOverlayLayers(overlay, sourceId, overlay.type === "pmtiles" ? overlay.source_layer : null);
      overlayLayers.push(...layers);
    }
    if (!overlayLayers.length) return;
    const labelIndex = style.layers.findIndex((layer) => layer.type === "symbol");
    if (labelIndex < 0) {
      style.layers.push(...overlayLayers);
      return;
    }
    style.layers.splice(labelIndex, 0, ...overlayLayers);
  }

  async function loadStyle(selection) {
    const styleUrl = new URL(selection.base.style || "/maps-v2/map-style.json", window.location.href);
    styleUrl.searchParams.set("v", selectionSignature(selection));
    const style = localizeStyle(await fetchJson(styleUrl.href, null, { cache: "no-store" }));
    const templateLayers = Array.isArray(style.layers) ? style.layers : [];
    const template = templateVectorSource(style);
    const templateSource = clone(template.source || {});
    const sources = {};
    const layers = [];
    const pack = selection.base;
    const url = new URL(pack.url, window.location.href).href;
    const activeSourceId = sourceIdFor(pack);
    const zooms = packZoomDiagnostics(pack, templateSource);
    state.sourceZoom = zooms;
    if (zooms.warning) console.warn("[OIAB Maps v2]", zooms.warning, pack);
    sources[activeSourceId] = {
      ...templateSource,
      type: "vector",
      url: `pmtiles://${url}`,
      minzoom: zooms.sourceMinzoom,
      maxzoom: zooms.sourceMaxzoom,
      attribution: pack.attribution || "© OpenStreetMap contributors",
    };
    for (const layer of templateLayers) {
      if (!layer.source) {
        layers.push(clone(layer));
        continue;
      }
      if (layer.source !== template.id) continue;
      const copy = clone(layer);
      copy.id = layer.id;
      copy.source = activeSourceId;
      layers.push(copy);
    }
    style.sources = sources;
    style.layers = layers;
    appendOverlaySourcesAndLayers(style, selection.overlays || []);
    return style;
  }

  function clearPollers() {
    ["dataTimer", "locationTimer", "trackTimer", "packTimer"].forEach((key) => {
      if (state[key]) {
        clearInterval(state[key]);
        state[key] = null;
      }
    });
  }

  function maybeFitToSelection(selection) {
    const target = selection.overlays[selection.overlays.length - 1] || selection.base;
    const bbox = Array.isArray(target?.bbox) ? target.bbox : null;
    const signature = selectionSignature(selection);
    const previous = localStorage.getItem("omv2.packSelection");
    localStorage.setItem("omv2.packSelection", signature);
    if (!bbox || bbox.length !== 4 || !state.map) return;
    const center = state.map.getCenter();
    const inside = center.lng >= bbox[0] && center.lng <= bbox[2] && center.lat >= bbox[1] && center.lat <= bbox[3];
    if (previous === signature && inside) return;
    state.map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
      padding: 48,
      duration: 650,
      maxZoom: target.region_type === "state" ? 10.5 : target.region_type === "country" ? 7.4 : 3.8,
    });
  }

  async function checkPackChange() {
    try {
      const registry = await fetchJson(API.packStatus, { ok: false, basemaps: [] });
      state.overlayRegistry = await fetchJson(API.overlays, { ok: false, overlays: [] });
      const next = normalizePackSelection(registry);
      if (!next) return;
      if (!state.packSelection || selectionSignature(next) !== selectionSignature(state.packSelection)) {
        await boot();
      }
    } catch {
      // Keep the current map running if pack polling fails.
    }
  }

  function tileIdFromEvent(event, error) {
    const candidates = [
      event?.tile?.tileID?.canonical,
      event?.tile?.tileID,
      event?.coord?.canonical,
      event?.coord,
      error?.tileID?.canonical,
      error?.tileID,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const z = candidate.z ?? candidate.overscaledZ;
      const x = candidate.x;
      const y = candidate.y;
      if (Number.isFinite(z) && Number.isFinite(x) && Number.isFinite(y)) {
        return { z: Number(z), x: Number(x), y: Number(y) };
      }
    }
    const text = `${error?.message || ""} ${error?.url || ""} ${event?.url || ""}`;
    const patterns = [
      /(?:^|[^\d])z[=:/ ](\d+)[^\d]+x[=:/ ](\d+)[^\d]+y[=:/ ](\d+)/i,
      /(?:^|[^\d])(\d{1,2})\/(\d+)\/(\d+)(?:\.|\?|$|[^\d])/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) };
    }
    return null;
  }

  function logMapError(event) {
    const error = event?.error || event;
    const message = error?.message || String(error || "MapLibre error");
    const sourceId = event?.sourceId || event?.source?.id || error?.sourceId || "";
    const tileId = tileIdFromEvent(event, error);
    const center = state.map?.getCenter();
    const activePack = state.packSelection?.base || {};
    const entry = {
      time: new Date().toISOString(),
      sourceId,
      status: error?.status || error?.statusCode || event?.status || "",
      url: error?.url || event?.url || error?.resource?.url || event?.resource?.url || "",
      message,
      tile: tileId ? `${tileId.z}/${tileId.x}/${tileId.y}` : "",
      z: tileId?.z,
      x: tileId?.x,
      y: tileId?.y,
      packId: activePack.id || "",
      packUrl: activePack.public_url || activePack.url || "",
      zoom: state.map ? Number(state.map.getZoom().toFixed(3)) : "",
      center: center ? { lon: Number(center.lng.toFixed(6)), lat: Number(center.lat.toFixed(6)) } : null,
    };
    state.tileErrors.unshift(entry);
    state.tileErrors = state.tileErrors.slice(0, 20);
    localStorage.setItem("omv2.tileErrors", JSON.stringify(state.tileErrors));
    console.groupCollapsed("[OIAB Maps v2 tile error]", entry.tile || entry.sourceId || entry.message);
    console.warn(entry);
    console.warn(event);
    console.groupEnd();
    renderMapErrors();
  }

  function lngLatToTile(lngLat, zoom) {
    const z = Math.max(0, Math.floor(Number(zoom) || 0));
    const scale = 2 ** z;
    const latRad = lngLat.lat * Math.PI / 180;
    const x = Math.floor((lngLat.lng + 180) / 360 * scale);
    const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * scale);
    return { z, x, y };
  }

  function tileAtZoom(lngLat, zoom) {
    return lngLatToTile(lngLat, Math.max(0, Number(zoom) || 0));
  }

  function uniqueTiles(tiles) {
    const seen = new Set();
    return tiles.filter((item) => {
      const key = `${item.role}:${item.z}/${item.x}/${item.y}`;
      const tileKey = `${item.z}/${item.x}/${item.y}`;
      if (seen.has(key) || seen.has(tileKey)) return false;
      seen.add(key);
      seen.add(tileKey);
      return true;
    });
  }

  async function checkPackTile(pack, tile) {
    const params = new URLSearchParams({
      pack: pack.id || "",
      z: String(tile.z),
      x: String(tile.x),
      y: String(tile.y),
    });
    const result = await fetchJson(`/api/maps/packs/tile-check?${params}`, { ok: false });
    return {
      ...tile,
      url: `/api/maps/packs/tile-check?${params}`,
      ok: Boolean(result.ok),
      tile_exists: Boolean(result.tile_exists),
      cli_readable: Boolean(result.cli_readable),
      tile_bytes: Number(result.tile_bytes || 0),
      result,
    };
  }

  async function inspectTileAt(lngLat) {
    if (!state.map || !state.packSelection?.base) return;
    const pack = state.packSelection.base;
    const mapZoom = Number(state.map.getZoom());
    const floorZoom = Math.floor(mapZoom);
    const ceilZoom = Math.ceil(mapZoom);
    const sourceMaxzoom = Number(state.sourceZoom?.sourceMaxzoom ?? pack.actual_maxzoom ?? pack.actual_max_zoom ?? pack.maxzoom ?? pack.max_zoom ?? floorZoom);
    const likelyZoom = Math.min(sourceMaxzoom, ceilZoom);
    const floorTile = tileAtZoom(lngLat, floorZoom);
    const childZoom = floorZoom + 1;
    const childBase = { z: childZoom, x: floorTile.x * 2, y: floorTile.y * 2 };
    const checks = uniqueTiles([
      { role: "floor", ...floorTile },
      { role: "ceil", ...tileAtZoom(lngLat, ceilZoom) },
      { role: "source_max", ...tileAtZoom(lngLat, sourceMaxzoom) },
      { role: "likely_maplibre", ...tileAtZoom(lngLat, likelyZoom) },
      ...(mapZoom > floorZoom ? [
        { role: "floor_child_nw", ...childBase },
        { role: "floor_child_ne", z: childZoom, x: childBase.x + 1, y: childBase.y },
        { role: "floor_child_sw", z: childZoom, x: childBase.x, y: childBase.y + 1 },
        { role: "floor_child_se", z: childZoom, x: childBase.x + 1, y: childBase.y + 1 },
      ] : []),
    ]);
    const center = state.map.getCenter();
    const entry = {
      time: new Date().toISOString(),
      sourceId: sourceIdFor(pack),
      message: "Manual tile inspection",
      tile: `${floorTile.z}/${floorTile.x}/${floorTile.y}`,
      z: floorTile.z,
      x: floorTile.x,
      y: floorTile.y,
      packId: pack.id || "",
      packUrl: pack.public_url || pack.url || "",
      zoom: Number(mapZoom.toFixed(3)),
      center: { lon: Number(center.lng.toFixed(6)), lat: Number(center.lat.toFixed(6)) },
      url: `/api/maps/packs/tile-check?pack=${encodeURIComponent(pack.id || "")}&z=${floorTile.z}&x=${floorTile.x}&y=${floorTile.y}`,
      zoomDiagnostics: {
        catalogMinzoom: pack.catalog_minzoom ?? pack.catalog_min_zoom ?? "",
        catalogMaxzoom: pack.catalog_maxzoom ?? pack.catalog_max_zoom ?? "",
        actualMinzoom: pack.actual_minzoom ?? pack.actual_min_zoom ?? "",
        actualMaxzoom: pack.actual_maxzoom ?? pack.actual_max_zoom ?? "",
        sourceMinzoom: state.sourceZoom?.sourceMinzoom ?? "",
        sourceMaxzoom,
        likelyRequestedZoom: likelyZoom,
        beyondActualMaxzoom: Number.isFinite(Number(pack.actual_maxzoom ?? pack.actual_max_zoom)) && mapZoom > Number(pack.actual_maxzoom ?? pack.actual_max_zoom),
      },
    };
    try {
      const results = await Promise.all(checks.map((tile) => checkPackTile(pack, tile)));
      const likely = results.find((tile) => tile.role === "likely_maplibre") || results[0];
      entry.status = likely?.tile_exists ? "likely tile exists" : "likely tile missing";
      entry.message = likely?.tile_exists
        ? `Likely MapLibre tile ${likely.z}/${likely.x}/${likely.y} exists in ${pack.name || pack.id}: ${Number(likely.tile_bytes || 0).toLocaleString()} bytes`
        : `Likely MapLibre tile is missing or unreadable in ${pack.name || pack.id}`;
      entry.tileChecks = results;
      entry.result = likely?.result;
    } catch (error) {
      entry.status = "check failed";
      entry.message = error.message;
    }
    state.tileErrors.unshift(entry);
    state.tileErrors = state.tileErrors.slice(0, 20);
    localStorage.setItem("omv2.tileErrors", JSON.stringify(state.tileErrors));
    renderMapErrors();
    toast(`${entry.tile}: ${entry.status}`);
    console.groupCollapsed("[OIAB Maps v2 manual tile check]", entry.tile);
    console.warn(entry);
    console.groupEnd();
  }

  function renderMapErrors() {
    const node = $("mapErrorPanel");
    const list = $("mapErrorList");
    if (!node || !list) return;
    node.hidden = state.tileErrors.length === 0;
    list.innerHTML = state.tileErrors.slice(0, 8).map((entry) => `
      <div class="omv2-error-row">
        <strong>${escapeHtml(entry.sourceId || "map")}</strong>
        <span>${escapeHtml(entry.message)}</span>
        ${entry.tile ? `<small>tile ${escapeHtml(entry.tile)} · pack ${escapeHtml(entry.packId)} · zoom ${escapeHtml(entry.zoom)}</small>` : ""}
        ${entry.zoomDiagnostics ? `<small>catalog ${escapeHtml(entry.zoomDiagnostics.catalogMinzoom ?? "--")}/${escapeHtml(entry.zoomDiagnostics.catalogMaxzoom ?? "--")} · actual ${escapeHtml(entry.zoomDiagnostics.actualMinzoom ?? "--")}/${escapeHtml(entry.zoomDiagnostics.actualMaxzoom ?? "--")} · source ${escapeHtml(entry.zoomDiagnostics.sourceMinzoom ?? "--")}/${escapeHtml(entry.zoomDiagnostics.sourceMaxzoom ?? "--")} · likely z${escapeHtml(entry.zoomDiagnostics.likelyRequestedZoom ?? "--")}</small>` : ""}
        ${entry.status ? `<small>status ${escapeHtml(entry.status)}</small>` : ""}
        ${Array.isArray(entry.tileChecks) ? `<div class="omv2-tile-checks">${entry.tileChecks.map((tile) => `<small>${escapeHtml(tile.role)} ${escapeHtml(tile.z)}/${escapeHtml(tile.x)}/${escapeHtml(tile.y)}: ${tile.tile_exists ? `${Number(tile.tile_bytes || 0).toLocaleString()} bytes` : "missing"}</small>`).join("")}</div>` : ""}
        ${entry.url ? `<code>${escapeHtml(entry.url)}</code>` : ""}
        ${entry.tile ? `<a href="/map-diagnostics?pack=${encodeURIComponent(entry.packId)}&z=${encodeURIComponent(entry.z)}&x=${encodeURIComponent(entry.x)}&y=${encodeURIComponent(entry.y)}" target="_blank" rel="noreferrer">Check this tile</a>` : ""}
      </div>
    `).join("");
  }

  function applyBuildingDisplayMode() {
    if (!state.map) return;
    const extrusionVisibility = state.show3dBuildings ? "visible" : "none";
    const fillVisibility = state.show3dBuildings ? "none" : "visible";
    if (state.map.getLayer("buildings-3d")) {
      state.map.setLayoutProperty("buildings-3d", "visibility", extrusionVisibility);
    }
    if (state.map.getLayer("buildings-fill")) {
      state.map.setLayoutProperty("buildings-fill", "visibility", fillVisibility);
    }
    if (state.map.getLayer("buildings")) {
      state.map.setLayoutProperty("buildings", "visibility", "visible");
    }
  }

  function initMap(style) {
    clearPollers();
    if (state.map) state.map.remove();
    state.tileErrors = [];
    renderMapErrors();
    state.map = new maplibregl.Map({
      container: "mapCanvas",
      style,
      center: JSON.parse(localStorage.getItem("omv2.center") || "[-98.5795,39.8283]"),
      zoom: Number(localStorage.getItem("omv2.zoom") || 3.4),
      pitch: Number(localStorage.getItem("omv2.pitch") || 0),
      bearing: Number(localStorage.getItem("omv2.bearing") || 0),
      attributionControl: false,
      cooperativeGestures: false,
      canvasContextAttributes: { antialias: true },
    });
    state.map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "imperial" }), "bottom-left");
    state.map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    state.map.on("error", logMapError);
    state.map.on("moveend", saveMapView);
    state.map.on("load", async () => {
      applyBuildingDisplayMode();
      await loadPoiImages();
      addMilitaryHatchLayer();
      addBasePoiIconLayer();
      bindOverlayFeaturePopups();
      addOverlandSources();
      loadOverlandData();
      pollLocation();
      pollTrack();
      maybeFitToSelection(state.packSelection);
      state.dataTimer = setInterval(loadOverlandData, 10000);
      state.locationTimer = setInterval(pollLocation, 1000);
      state.trackTimer = setInterval(pollTrack, 4000);
      state.packTimer = setInterval(checkPackChange, 30000);
    });
    state.map.on("click", (event) => {
      if (state.offlineRegionDraw) return;
      if (state.inspectTile) {
        inspectTileAt(event.lngLat);
        return;
      }
      if (!state.addFromMap) return;
      state.modalPoint = { lat: event.lngLat.lat, lon: event.lngLat.lng, source: "map_click" };
      state.addFromMap = false;
      $("addMapWaypoint").classList.remove("is-pending");
      openWaypointModal("Save map point");
    });
    state.map.on("click", "overland-waypoint-circles", showSavedPointPopup);
    state.map.on("click", "overland-waypoint-icons", showSavedPointPopup);
    state.map.on("click", "overland-track-lines", showSavedTrackPopup);
    state.map.on("click", "offline-region-icons", (event) => {
      const regionId = event.features?.[0]?.properties?.id;
      if (regionId && regionId !== "__draft__") openOfflineRegionById(regionId);
    });
    state.map.on("click", "search-result-halo", (event) => openSearchResult(event.features?.[0]?.properties?.index));
    state.map.on("click", "search-result-dot", (event) => openSearchResult(event.features?.[0]?.properties?.index));
    state.map.on("click", "oiab-poi-icons", showBasePoiPopup);
    state.map.on("click", "pois", showBasePoiPopup);
    state.map.on("mousedown", (event) => {
      if (!state.offlineRegionDraw) return;
      startOfflineRegionDraw(event.lngLat);
    });
    state.map.on("mousemove", (event) => {
      moveOfflineRegionDraw(event.lngLat);
    });
    state.map.on("mouseup", (event) => {
      finishOfflineRegionDraw(event.lngLat);
    });
  }

  function bindOverlayFeaturePopups() {
    if (!state.map) return;
    const layerIds = (state.packSelection?.overlays || [])
      .flatMap(overlayLayerIds)
      .filter((id) => state.map.getLayer(id));
    for (const layerId of layerIds) {
      state.map.on("click", layerId, showOverlayPopup);
      state.map.on("mouseenter", layerId, () => {
        state.map.getCanvas().style.cursor = "pointer";
      });
      state.map.on("mouseleave", layerId, () => {
        state.map.getCanvas().style.cursor = "";
      });
    }
  }

  function showSavedPointPopup(event) {
    const feature = event.features && event.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const coords = feature.geometry.coordinates;
    new maplibregl.Popup({ className: "omv2-poi-popup", maxWidth: "380px" })
      .setLngLat(coords)
      .setHTML(savedDataPopupHtml(props, "waypoint", coords))
      .addTo(state.map);
  }

  function showSavedTrackPopup(event) {
    const feature = event.features && event.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const coords = [event.lngLat.lng, event.lngLat.lat];
    new maplibregl.Popup({ className: "omv2-poi-popup", maxWidth: "380px" })
      .setLngLat(coords)
      .setHTML(savedDataPopupHtml(props, "route", coords))
      .addTo(state.map);
  }

  function showBasePoiPopup(event) {
    const feature = event.features && event.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates || [event.lngLat.lng, event.lngLat.lat];
    const lngLat = Array.isArray(coords) && Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))
      ? coords
      : [event.lngLat.lng, event.lngLat.lat];
    new maplibregl.Popup({ className: "omv2-poi-popup", maxWidth: "360px" })
      .setLngLat(lngLat)
      .setHTML(basePoiPopupHtml(props, lngLat))
      .addTo(state.map);
  }

  function showOverlayPopup(event) {
    const feature = event.features && event.features[0];
    if (!feature) return;
    const overlay = overlayForFeature(feature);
    const coords = feature.geometry?.type === "Point" && Array.isArray(feature.geometry?.coordinates)
      ? feature.geometry.coordinates
      : [event.lngLat.lng, event.lngLat.lat];
    new maplibregl.Popup({ className: "omv2-poi-popup", maxWidth: "390px" })
      .setLngLat(coords)
      .setHTML(overlayPopupHtml(feature.properties || {}, overlay, coords))
      .addTo(state.map);
  }

  function overlayForFeature(feature) {
    const layerId = feature?.layer?.id || "";
    const sourceId = feature?.source || feature?.layer?.source || "";
    return (state.packSelection?.overlays || []).find((overlay) => {
      const overlaySource = overlaySourceId(overlay);
      return sourceId === overlaySource
        || sourceId.startsWith(`${overlaySource}-`)
        || layerId.startsWith(`${overlaySource}-`);
    }) || {};
  }

  function coordinateDetail(coords) {
    const lon = Array.isArray(coords) ? Number(coords[0]) : NaN;
    const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
    return Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : "";
  }

  function basePoiPopupHtml(props = {}, coords = null) {
    const name = props.name || props["name:en"] || props.name_en || "Point of interest";
    const kind = humanizePoiValue(props.kind || props.kind_detail || props.amenity || props.shop || props.tourism || "poi");
    const coordText = coordinateDetail(coords);
    const details = compactDetails([["Coordinates", coordText], ...readablePoiDetails(props)]);
    const technical = Object.entries(props)
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([key, value]) => `<dt>${escapeHtml(humanizePoiKey(key))}</dt><dd>${escapeHtml(formatPoiValue(value))}</dd>`)
      .join("");
    return `
      <article class="omv2-poi-card">
        <p class="omv2-poi-kicker">${escapeHtml(kind)}</p>
        <h3>${escapeHtml(name)}</h3>
        ${details.length ? `<dl class="omv2-poi-details">${details.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>` : `<p class="omv2-poi-empty">No additional details in this map pack.</p>`}
        ${technical ? `<details class="omv2-poi-technical"><summary>Technical details</summary><dl>${technical}</dl></details>` : ""}
        ${coordText ? `<div class="omv2-poi-actions"><button type="button" data-copy-coords="${escapeHtml(coordText)}">Copy coordinates</button></div>` : ""}
      </article>
    `;
  }

  function overlayPopupHtml(props = {}, overlay = {}, coords = null) {
    const category = overlay.category || overlay.style || "overlay";
    const title = overlayFeatureTitle(props, overlay);
    const kicker = overlay.name || overlayCategoryTitle(category);
    const coordText = coordinateDetail(coords);
    const details = compactDetails([["Coordinates", coordText], ...overlayReadableDetails(props, overlay)]);
    const technical = Object.entries(props)
      .filter(([key, value]) => !["raw_properties", "rawProperties"].includes(key) && value !== undefined && value !== null && String(value).trim() !== "")
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .slice(0, 28)
      .map(([key, value]) => `<dt>${escapeHtml(humanizePoiKey(key))}</dt><dd>${escapeHtml(formatPoiValue(value))}</dd>`)
      .join("");
    return `
      <article class="omv2-poi-card">
        <p class="omv2-poi-kicker">${escapeHtml(kicker)}</p>
        <h3>${escapeHtml(title)}</h3>
        ${details.length ? `<dl class="omv2-poi-details">${details.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>` : `<p class="omv2-poi-empty">No readable details in this overlay feature.</p>`}
        ${technical ? `<details class="omv2-poi-technical"><summary>All available fields</summary><dl>${technical}</dl></details>` : ""}
        ${coordText ? `<div class="omv2-poi-actions"><button type="button" data-copy-coords="${escapeHtml(coordText)}">Copy coordinates</button></div>` : ""}
      </article>
    `;
  }

  function savedDataPopupHtml(props = {}, kind = "waypoint", coords = null) {
    const title = props.name || props.title || (kind === "route" ? "Saved route" : "Saved waypoint");
    const lon = Array.isArray(coords) ? Number(coords[0]) : Number(props.lon);
    const lat = Array.isArray(coords) ? Number(coords[1]) : Number(props.lat);
    const coordText = Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : "";
    const details = compactDetails([
      ["Type", props.category || kind],
      ["Folder", props.folder || "Unfiled"],
      ["Coordinates", coordText],
      ["Source", props.source || ""],
      ["URL", props.url || props.website || ""],
      ["Description", props.notes || props.description || ""],
      ["Created", props.timestamp || props.created_at || ""],
    ]);
    const itemId = props.id || "";
    return `
      <article class="omv2-poi-card">
        <p class="omv2-poi-kicker">Saved ${escapeHtml(kind)}</p>
        <h3>${escapeHtml(title)}</h3>
        ${details.length ? `<dl class="omv2-poi-details">${details.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${linkifyDetail(key, value)}</dd>`).join("")}</dl>` : ""}
        <div class="omv2-poi-actions">
          ${coordText ? `<button type="button" data-copy-coords="${escapeHtml(coordText)}">Copy coordinates</button>` : ""}
          <button type="button" data-edit-map-item="${escapeHtml(itemId)}">Edit</button>
          <button type="button" data-delete-map-item="${escapeHtml(itemId)}" data-delete-map-label="${escapeHtml(title)}">Delete</button>
          <button type="button" data-open-map-data-manager>Open manager</button>
        </div>
      </article>
    `;
  }

  function linkifyDetail(key, value) {
    if (String(key).toLowerCase() === "url" && /^https?:\/\//i.test(String(value))) {
      const safe = escapeHtml(value);
      return `<a href="${safe}" target="_blank" rel="noopener">${safe}</a>`;
    }
    return escapeHtml(value);
  }

  function overlayCategoryTitle(category) {
    return String(category || "overlay")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function overlayFeatureTitle(props = {}, overlay = {}) {
    return props.route_name
      || props.unit_name
      || props.class_label
      || props.ADMIN_UNIT_NAME
      || props.ADMIN_UNIT_TYPE
      || props.label
      || props.name
      || props.title
      || props.headline
      || props.event
      || props.route_id
      || props.id
      || (overlay.category === "wildfire" ? "Wildfire hotspot" : "")
      || (overlay.category === "weather" ? "Weather alert" : "")
      || (overlay.category === "mvum" ? "MVUM route" : "")
      || (overlay.category === "public_lands" ? "BLM public land" : "")
      || (overlay.style === "usgs_contours" ? "Contour line" : "")
      || "Overlay feature";
  }

  function mvumRouteTypeLabel(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const code = raw.match(/\d+/)?.[0] || raw;
    const label = MVUM_ROUTE_TYPE_LABELS[code];
    return label ? `${label} (${code})` : raw;
  }

  function mvumBucketLabel(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function firstPresent(props, keys) {
    for (const key of keys) {
      const value = props[key] ?? props[key.replace(/:/g, "_")];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function overlayReadableDetails(props = {}, overlay = {}) {
    const category = overlay.category || overlay.style || "";
    if (category === "mvum" || String(overlay.style || "").startsWith("mvum")) {
      const routeType = firstPresent(props, ["route_type_label", "route_type", "type", "style_bucket"]);
      return compactDetails([
        ["Route ID", firstPresent(props, ["route_id", "routeid", "route_no", "route_number", "route"])],
        ["Route type", mvumRouteTypeLabel(routeType)],
        ["Route class", mvumBucketLabel(firstPresent(props, ["style_bucket"]))],
        ["Vehicle classes", firstPresent(props, ["vehicle_classes", "vehicles", "allowed_vehicles"])],
        ["Season", firstPresent(props, ["season", "seasonal", "season_of_use"])],
        ["Allowed", firstPresent(props, ["allowed", "allowed_raw", "status"])],
        ["High clearance", firstPresent(props, ["high_clearance"])],
        ["Forest", firstPresent(props, ["forest_name", "forest", "admin_forest"])],
        ["District", firstPresent(props, ["district", "ranger_district"])],
        ["Source", firstPresent(props, ["source"])],
      ]);
    }
    if (category === "wildfire" || overlay.style === "wildfire_hotspots") {
      return compactDetails([
        ["Date", firstPresent(props, ["acq_date", "date"])],
        ["Time", firstPresent(props, ["acq_time", "time"])],
        ["Confidence", firstPresent(props, ["confidence"])],
        ["Brightness", firstPresent(props, ["brightness", "bright_ti4", "bright_ti5"])],
        ["FRP", firstPresent(props, ["frp"])],
        ["Satellite", firstPresent(props, ["satellite"])],
        ["Instrument", firstPresent(props, ["instrument"])],
        ["Day/night", firstPresent(props, ["daynight"])],
      ]);
    }
    if (category === "weather" || overlay.style === "weather_alerts") {
      return compactDetails([
        ["Event", firstPresent(props, ["event"])],
        ["Severity", firstPresent(props, ["severity"])],
        ["Urgency", firstPresent(props, ["urgency"])],
        ["Certainty", firstPresent(props, ["certainty"])],
        ["Area", firstPresent(props, ["areaDesc", "area_desc"])],
        ["Effective", firstPresent(props, ["effective", "sent"])],
        ["Expires", firstPresent(props, ["expires", "ends"])],
        ["Headline", firstPresent(props, ["headline"])],
        ["Instruction", firstPresent(props, ["instruction"])],
      ]);
    }
    if (overlay.style === "public_lands_blm_wilderness") {
      return compactDetails([
        ["Class", firstPresent(props, ["class_label"])],
        ["Unit", firstPresent(props, ["unit_name"])],
        ["State", firstPresent(props, ["state"])],
        ["NLCS ID", firstPresent(props, ["nlcs_id"])],
        ["Case file", firstPresent(props, ["casefile_no"])],
        ["Designation date", firstPresent(props, ["designation_date"])],
        ["ROD date", firstPresent(props, ["rod_date"])],
        ["Recommendation", firstPresent(props, ["recommendation"])],
        ["Agency", firstPresent(props, ["agency"])],
      ]);
    }
    if (category === "public_lands" || overlay.style === "public_lands_blm") {
      return compactDetails([
        ["Agency", firstPresent(props, ["ADMIN_AGENCY_CODE", "agency", "ADMIN_DEPT_CODE"])],
        ["Unit", firstPresent(props, ["ADMIN_UNIT_NAME"])],
        ["Unit type", firstPresent(props, ["ADMIN_UNIT_TYPE"])],
        ["State", firstPresent(props, ["ADMIN_ST"])],
        ["Surface Mgmt ID", firstPresent(props, ["SMA_ID"])],
        ["Holding agency", firstPresent(props, ["HOLD_AGENCY_CODE", "HOLD_DEPT_CODE"])],
        ["Field office", firstPresent(props, ["FAU_ID"])],
        ["Source", firstPresent(props, ["source"])],
      ]);
    }
    if (category === "topo" || overlay.style === "usgs_contours") {
      return compactDetails([
        ["Elevation", firstPresent(props, ["label"])],
        ["Elevation (ft)", firstPresent(props, ["ele_ft"])],
        ["Elevation (m)", firstPresent(props, ["ele_m"])],
        ["Contour type", firstPresent(props, ["contour_type"])],
        ["Interval", firstPresent(props, ["interval_ft"]) ? `${firstPresent(props, ["interval_ft"])} ft` : ""],
        ["Source", "USGS 3DEP / The National Map"],
      ]);
    }
    const ignored = new Set(["raw_properties", "rawProperties"]);
    return Object.entries(props)
      .filter(([key, value]) => !ignored.has(key) && value !== undefined && value !== null && String(value).trim() !== "")
      .slice(0, 10)
      .map(([key, value]) => [humanizePoiKey(key), formatPoiValue(value)]);
  }

  function compactDetails(rows) {
    return rows
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      .map(([key, value]) => [key, formatPoiValue(value)]);
  }

  function readablePoiDetails(props = {}) {
    const fields = [
      ["kind_detail", "Detail"],
      ["brand", "Brand"],
      ["operator", "Operator"],
      ["network", "Network"],
      ["cuisine", "Cuisine"],
      ["opening_hours", "Hours"],
      ["website", "Website"],
      ["phone", "Phone"],
      ["addr:housenumber", "Address #"],
      ["addr:street", "Street"],
      ["addr:city", "City"],
      ["addr:state", "State"],
      ["addr:postcode", "Postcode"],
      ["ref", "Reference"],
      ["ele", "Elevation"],
    ];
    const result = [];
    for (const [key, label] of fields) {
      const value = props[key] ?? props[key.replace(/:/g, "_")];
      if (value === undefined || value === null || String(value).trim() === "") continue;
      result.push([label, formatPoiValue(value)]);
    }
    if (props.min_zoom !== undefined) result.push(["Appears from zoom", formatPoiValue(props.min_zoom)]);
    return result;
  }

  function humanizePoiKey(key) {
    return String(key || "")
      .replace(/^addr:/, "address ")
      .replace(/[:_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function humanizePoiValue(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatPoiValue(value) {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.map(formatPoiValue).join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return humanizePoiValue(value);
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
    state.map.addSource("search-results", { type: "geojson", data: EMPTY });
    state.map.addSource("offline-regions", { type: "geojson", data: EMPTY });
    state.map.addLayer({
      id: "overland-track-lines",
      type: "line",
      source: "overland-tracks",
      paint: routeLinePaint(),
    });
    state.map.addLayer({
      id: "overland-waypoint-circles",
      type: "circle",
      source: "overland-waypoints",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 11, 12, 17, 16, 24],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.78,
        "circle-stroke-color": "#0a170f",
        "circle-stroke-width": 2,
      },
    });
    state.map.addLayer({
      id: "overland-waypoint-icons",
      type: "symbol",
      source: "overland-waypoints",
      layout: {
        "icon-image": mapPoiMatchExpression("marker_icon_key", Object.fromEntries(
          POI_ICON_KEYS.map((key) => [key, key]),
        ), "information", poiMarkerImageId),
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.36, 12, 0.52, 16, 0.68],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
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
    state.map.addLayer({
      id: "search-result-halo",
      type: "circle",
      source: "search-results",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 16, 12, 24, 16, 34],
        "circle-color": "#ffd34f",
        "circle-opacity": 0.34,
        "circle-stroke-color": "#102719",
        "circle-stroke-width": 3,
      },
    });
    state.map.addLayer({
      id: "search-result-dot",
      type: "circle",
      source: "search-results",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5, 12, 8, 16, 11],
        "circle-color": "#7df28c",
        "circle-stroke-color": "#102719",
        "circle-stroke-width": 2,
      },
    });
    state.map.addLayer({
      id: "offline-region-fills",
      type: "fill",
      source: "offline-regions",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#8be0bd",
        "fill-opacity": ["case", ["==", ["get", "draft"], 1], 0.2, 0.14],
      },
    });
    state.map.addLayer({
      id: "offline-region-lines",
      type: "line",
      source: "offline-regions",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "line-color": "#7df28c",
        "line-width": ["case", ["==", ["get", "draft"], 1], 3, 2],
        "line-opacity": 0.9,
        "line-dasharray": [2, 1],
      },
    });
    state.map.addLayer({
      id: "offline-region-icon-halo",
      type: "circle",
      source: "offline-regions",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 13, 14, 16],
        "circle-color": "#7df28c",
        "circle-opacity": 0.92,
        "circle-stroke-color": "#06170f",
        "circle-stroke-width": 2,
      },
    });
    state.map.addLayer({
      id: "offline-region-icons",
      type: "symbol",
      source: "offline-regions",
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": ["case", ["==", ["get", "draft"], 1], "+", "↧"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 14, 10, 17, 14, 20],
        "text-font": ["Noto Sans Bold"],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-anchor": "center",
      },
      paint: {
        "text-color": "#06170f",
        "text-halo-color": "rgba(125, 242, 140, 0.0)",
        "text-halo-width": 0,
      },
    });
    updateOfflineRegionSources();
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

  function offlineRegionFeatures() {
    const features = [];
    for (const region of offlineRegions()) {
      const bbox = Array.isArray(region?.bbox) ? region.bbox.map(Number) : [];
      if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) continue;
      const [minLon, minLat, maxLon, maxLat] = bbox;
      const properties = {
        id: region.id,
        name: region.name || "Offline Region",
        draft: 0,
        overlays: (Array.isArray(region.items) ? region.items : []).map((item) => item.overlay_name || item.overlay_id).join(", "),
      };
      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat],
          ]],
        },
        properties,
      });
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [maxLon - ((maxLon - minLon) * 0.035), minLat + ((maxLat - minLat) * 0.035)] },
        properties,
      });
    }
    if (Array.isArray(state.offlineRegionDraft) && state.offlineRegionDraft.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = state.offlineRegionDraft;
      const draftProps = { id: "__draft__", name: "Draft region", draft: 1, overlays: "" };
      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat],
          ]],
        },
        properties: draftProps,
      });
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [(minLon + maxLon) / 2, (minLat + maxLat) / 2] },
        properties: draftProps,
      });
    }
    return { type: "FeatureCollection", features };
  }

  function updateOfflineRegionSources() {
    if (!state.map || !state.map.getSource("offline-regions")) return;
    state.map.getSource("offline-regions").setData(offlineRegionFeatures());
  }

  function setOfflineOnlyToggle() {
    const toggle = $("offlineOnlyToggle");
    if (!toggle) return;
    toggle.checked = Boolean(state.overlayRegistry?.offline_regions_only);
  }

  function setOfflineRegionDrawEnabled(enabled) {
    state.offlineRegionDraw = Boolean(enabled);
    if (!state.offlineRegionDraw) {
      state.offlineRegionStart = null;
      state.offlineRegionDraft = null;
      updateOfflineRegionSources();
    }
    $("offlineRegionToggle").classList.toggle("is-pending", state.offlineRegionDraw);
    if (!state.map) return;
    if (state.offlineRegionDraw) state.map.dragPan.disable();
    else state.map.dragPan.enable();
  }

  function regionBBoxFromPoints(start, end) {
    if (!start || !end) return null;
    const minLon = Math.min(Number(start.lng), Number(end.lng));
    const minLat = Math.min(Number(start.lat), Number(end.lat));
    const maxLon = Math.max(Number(start.lng), Number(end.lng));
    const maxLat = Math.max(Number(start.lat), Number(end.lat));
    if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) return null;
    return [minLon, minLat, maxLon, maxLat];
  }

  function renderOfflineRegionOverlayOptions(selectedIds = new Set()) {
    const holder = $("offlineRegionOverlayOptions");
    if (!holder) return;
    const overlays = cacheableOfflineOverlays();
    holder.innerHTML = overlays.map((overlay) => `
      <label class="omv2-offline-overlay-option">
        <input type="checkbox" value="${escapeHtml(String(overlay.id || ""))}" ${selectedIds.has(String(overlay.id || "")) ? "checked" : ""}>
        <span>
          <strong>${escapeHtml(overlay.name || overlay.id)}</strong>
          <small>${escapeHtml(overlay.category || "overlay")} · z${escapeHtml(String(overlay.offline_cache_minzoom ?? overlay.minzoom ?? 0))}-${escapeHtml(String(overlay.offline_cache_maxzoom ?? overlay.maxzoom ?? 16))}</small>
        </span>
      </label>
    `).join("");
  }

  function selectedOfflineOverlayIds() {
    return Array.from($("offlineRegionOverlayOptions").querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => String(input.value || "").trim())
      .filter(Boolean);
  }

  function openOfflineRegionModal(region = null, draftBBox = null) {
    state.offlineRegionEditing = region || null;
    const bbox = Array.isArray(draftBBox) && draftBBox.length === 4
      ? draftBBox
      : Array.isArray(region?.bbox) && region.bbox.length === 4
        ? region.bbox.map(Number)
        : null;
    $("offlineRegionTitle").textContent = region ? "Update offline region" : "Save offline region";
    $("offlineRegionId").value = region?.id || "";
    $("offlineRegionName").value = region?.name || "";
    $("offlineRegionBbox").value = bboxToString(bbox);
    const selected = new Set((Array.isArray(region?.items) ? region.items : []).map((item) => String(item.overlay_id || "")).filter(Boolean));
    if (!selected.size) {
      for (const overlay of cacheableOfflineOverlays()) selected.add(String(overlay.id || ""));
    }
    renderOfflineRegionOverlayOptions(selected);
    $("refreshOfflineRegion").hidden = !region;
    $("deleteOfflineRegion").hidden = !region;
    $("offlineRegionModal").hidden = false;
  }

  function closeOfflineRegionModal() {
    $("offlineRegionModal").hidden = true;
    $("offlineRegionForm").reset();
    $("offlineRegionId").value = "";
    $("offlineRegionBbox").value = "";
    state.offlineRegionEditing = null;
  }

  function applyOverlayRegistryUpdate(registry) {
    state.overlayRegistry = registry;
    renderOverlayControls();
    updateOfflineRegionSources();
  }

  async function saveOfflineRegion(mode = "create") {
    const regionId = String($("offlineRegionId").value || "").trim();
    const name = String($("offlineRegionName").value || "").trim() || "Offline Region";
    const bbox = bboxFromString($("offlineRegionBbox").value);
    const overlayIds = selectedOfflineOverlayIds();
    if (!bbox) throw new Error("Draw or select a valid bbox first.");
    if (!overlayIds.length) throw new Error("Select at least one overlay to cache.");
    const payload = { region_id: regionId, name, bbox, overlay_ids: overlayIds };
    const endpoint = mode === "refresh" ? "/api/maps/overlays/regions/refresh" : API.overlayRegions;
    const data = await postJson(endpoint, payload);
    state.offlineRegionDraft = null;
    applyOverlayRegistryUpdate(data);
    closeOfflineRegionModal();
    toast(mode === "refresh" ? "Offline region update started." : "Offline region download started.");
  }

  async function removeOfflineRegion() {
    const regionId = String($("offlineRegionId").value || "").trim();
    if (!regionId) throw new Error("No offline region selected.");
    const data = await postJson("/api/maps/overlays/regions/delete", { region_id: regionId });
    state.offlineRegionDraft = null;
    applyOverlayRegistryUpdate(data);
    closeOfflineRegionModal();
    toast("Offline region cache cleared.");
  }

  function openOfflineRegionById(regionId) {
    const region = offlineRegions().find((item) => String(item.id || "") === String(regionId || ""));
    if (region) openOfflineRegionModal(region);
  }

  function startOfflineRegionDraw(lngLat) {
    state.offlineRegionStart = { lng: Number(lngLat.lng), lat: Number(lngLat.lat) };
    state.offlineRegionDraft = [state.offlineRegionStart.lng, state.offlineRegionStart.lat, state.offlineRegionStart.lng, state.offlineRegionStart.lat];
    updateOfflineRegionSources();
  }

  function moveOfflineRegionDraw(lngLat) {
    if (!state.offlineRegionDraw || !state.offlineRegionStart) return;
    const bbox = regionBBoxFromPoints(state.offlineRegionStart, lngLat);
    if (!bbox) return;
    state.offlineRegionDraft = bbox;
    updateOfflineRegionSources();
  }

  function finishOfflineRegionDraw(lngLat) {
    if (!state.offlineRegionDraw || !state.offlineRegionStart) return;
    const bbox = regionBBoxFromPoints(state.offlineRegionStart, lngLat);
    setOfflineRegionDrawEnabled(false);
    if (!bbox) return;
    const width = Math.abs(bbox[2] - bbox[0]);
    const height = Math.abs(bbox[3] - bbox[1]);
    if (width < 0.001 || height < 0.001) {
      toast("Draw a larger offline cache region.", true);
      return;
    }
    state.offlineRegionDraft = bbox;
    updateOfflineRegionSources();
    openOfflineRegionModal(null, bbox);
  }

  function updateFolders(folders) {
    for (const folder of folders) state.folders.add(normalizeFolderName(folder));
    for (const feature of state.places.features || []) state.folders.add(folderOf(feature));
    renderFolders();
  }

  function renderFolders() {
    const node = $("folderList");
    const folders = Array.from(state.folders).map(normalizeFolderName).sort((a, b) => String(a).localeCompare(String(b)));
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

  function overlaySummary(overlay, status = "") {
    if (overlay.id === "usgs_topographic_contours" || overlay.style === "usgs_contours") {
      const count = Array.isArray(overlay.region_sources) ? overlay.region_sources.length : 0;
      return `topo · offline regions only${count ? ` · ${count} region${count === 1 ? "" : "s"}` : ""}${status}`;
    }
    const cache = overlay.cache_status && overlay.cache_status !== "cached" ? ` · ${overlay.cache_status}` : "";
    return `${overlay.category || "overlay"}${cache}`;
  }

  function renderOverlayControls() {
    const node = $("overlayList");
    if (!node) return;
    setOfflineOnlyToggle();
    const overlays = normalizeOverlayRegistry(state.overlayRegistry).filter((overlay) => overlay.available);
    node.innerHTML = "";
    if (!overlays.length) {
      node.innerHTML = '<div class="omv2-overlay-note">No downloaded overlays yet. Use Settings → Map Packs to download overlay data.</div>';
      return;
    }
    for (const overlay of overlays) {
      const row = document.createElement("div");
      row.className = "omv2-folder-row omv2-overlay-row";
      const status = overlay.cache_status && overlay.cache_status !== "cached" ? ` · ${overlay.cache_status}` : "";
      row.innerHTML = `
        <label class="omv2-overlay-check">
          <input type="checkbox" ${overlay.enabled ? "checked" : ""}>
          <span>${escapeHtml(overlay.name || overlay.id)}<br><small class="omv2-overlay-note">${escapeHtml(overlaySummary(overlay, status))}</small></span>
        </label>
        <label class="omv2-overlay-opacity">
          <span>${Math.round(Number(overlay.opacity ?? 1) * 100)}%</span>
          <input type="range" min="0" max="1" step="0.05" value="${Number(overlay.opacity ?? 1)}">
        </label>
      `;
      row.querySelector(".omv2-overlay-check input").addEventListener("change", async (event) => {
        try {
          state.overlayRegistry = await setOverlayEnabled(overlay.id, event.target.checked);
          await boot();
        } catch (error) {
          event.target.checked = !event.target.checked;
          toast(error.message, true);
        }
      });
      row.querySelector(".omv2-overlay-opacity input").addEventListener("change", async (event) => {
        try {
          state.overlayRegistry = await setOverlayOpacity(overlay.id, event.target.value);
          await boot();
        } catch (error) {
          toast(error.message, true);
        }
      });
      node.appendChild(row);
    }
  }

  function setManagerStatus(message = "", error = false) {
    const node = $("managerStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", Boolean(error));
  }

  function managerFolderNames() {
    const names = new Set(["Unfiled"]);
    for (const folder of state.folders || []) names.add(normalizeFolderName(folder));
    for (const folder of state.managerSnapshot.folders || []) names.add(normalizeFolderName(folder.name || folder));
    for (const item of state.managerSnapshot.items || []) names.add(normalizeFolderName(item.folder));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  function fillManagerFolderSelect(select, selected = "Unfiled") {
    if (!select) return;
    select.replaceChildren(...managerFolderNames().map((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      option.selected = name === selected;
      return option;
    }));
  }

  function managerGroups() {
    const folders = new Map();
    for (const folder of state.managerSnapshot.folders || []) {
      const name = normalizeFolderName(folder.name || folder);
      folders.set(name, { name, shown: folder.shown !== false, items: [] });
    }
    for (const item of state.managerSnapshot.items || []) {
      const name = normalizeFolderName(item.folder);
      if (!folders.has(name)) folders.set(name, { name, shown: true, items: [] });
      folders.get(name).items.push(item);
    }
    return Array.from(folders.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function loadManagerSnapshot() {
    const data = await fetchJson(API.manage, { ok: false, folders: [], items: [] });
    if (data.ok === false) throw new Error(data.error || "Map data manager failed to load.");
    state.managerSnapshot = data;
    renderDataManager();
    return data;
  }

  async function managerAction(payload) {
    const data = await postJson(API.manage, payload);
    state.managerSnapshot = data;
    renderDataManager();
    await loadOverlandData();
    return data;
  }

  function renderDataManager() {
    const root = $("managerFolderList");
    if (!root) return;
    const groups = managerGroups();
    root.innerHTML = groups.length ? "" : '<div class="omv2-overlay-note">No saved map data yet.</div>';
    for (const folder of groups) {
      const open = state.managerOpenFolders.has(folder.name);
      const folderRow = document.createElement("div");
      folderRow.className = "omv2-manager-folder";
      folderRow.innerHTML = `
        <button class="omv2-manager-caret" type="button" title="Expand folder">${open ? "▾" : "▸"}</button>
        <input type="checkbox" ${state.managerSelectedFolders.has(folder.name) ? "checked" : ""} title="Select folder">
        <span class="omv2-manager-name">${escapeHtml(folder.name)}</span>
        <span class="omv2-manager-meta">${folder.items.length}</span>
        <span class="omv2-manager-row-actions">
          <button class="omv2-manager-icon-button" type="button" data-folder-visible="${escapeHtml(folder.name)}" title="${folder.shown ? "Hide" : "Show"}">${folder.shown ? "◉" : "◎"}</button>
          <button class="omv2-manager-icon-button" type="button" data-folder-delete="${escapeHtml(folder.name)}" title="Delete folder">🗑</button>
        </span>
      `;
      folderRow.querySelector(".omv2-manager-caret").addEventListener("click", () => {
        if (state.managerOpenFolders.has(folder.name)) state.managerOpenFolders.delete(folder.name);
        else state.managerOpenFolders.add(folder.name);
        renderDataManager();
      });
      folderRow.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) state.managerSelectedFolders.add(folder.name);
        else state.managerSelectedFolders.delete(folder.name);
      });
      folderRow.querySelector("[data-folder-visible]").addEventListener("click", async () => {
        try {
          await managerAction({ action: "set_folder_visibility", folder: folder.name, visible: !folder.shown });
          setManagerStatus(`${folder.name} ${folder.shown ? "hidden" : "shown"}.`);
        } catch (error) {
          setManagerStatus(error.message, true);
        }
      });
      folderRow.querySelector("[data-folder-delete]").addEventListener("click", () => openDataDeleteModal("", folder.name, folder.name));
      root.appendChild(folderRow);
      if (!open) continue;
      for (const item of folder.items) {
        const itemRow = document.createElement("div");
        itemRow.className = "omv2-manager-item";
        itemRow.innerHTML = `
          <input type="checkbox" ${state.managerSelectedItems.has(item.id) ? "checked" : ""} title="Select item">
          <span class="omv2-manager-name">${escapeHtml(item.name || "Untitled")}</span>
          <span class="omv2-manager-meta">${escapeHtml(item.kind || item.category || "")}${item.point_count ? ` · ${Number(item.point_count).toLocaleString()} pts` : ""}</span>
          <span class="omv2-manager-row-actions">
            <button class="omv2-manager-icon-button" type="button" data-edit-map-item="${escapeHtml(item.id)}" title="Edit">✎</button>
            <button class="omv2-manager-icon-button" type="button" data-delete-map-item="${escapeHtml(item.id)}" data-delete-map-label="${escapeHtml(item.name || "item")}" title="Delete">🗑</button>
          </span>
        `;
        itemRow.querySelector("input").addEventListener("change", (event) => {
          if (event.target.checked) state.managerSelectedItems.add(item.id);
          else state.managerSelectedItems.delete(item.id);
        });
        root.appendChild(itemRow);
      }
    }
    fillManagerFolderSelect($("managerImportFolder"));
    fillManagerFolderSelect($("managerCoordFolder"));
    fillManagerFolderSelect($("managerMoveFolder"));
  }

  async function openDataManagerModal() {
    $("dataManagerPanel").hidden = false;
    $("savedDataPanel").hidden = true;
    $("overlaysPanel").hidden = true;
    try {
      await loadManagerSnapshot();
    } catch (error) {
      setManagerStatus(error.message, true);
    }
  }

  function closeDataManagerModal() {
    $("dataManagerPanel").hidden = true;
    loadOverlandData();
  }

  function closeSearch() {
    $("searchForm").hidden = true;
    $("searchResults").hidden = true;
    $("searchInput").value = "";
    state.searchResults = [];
    if (state.map?.getSource("search-results")) state.map.getSource("search-results").setData(EMPTY);
  }

  function featureSearchText(feature = {}) {
    const props = feature.properties || {};
    const values = [
      props.name,
      props.title,
      props.category,
      props.kind,
      props.kind_detail,
      props.amenity,
      props.shop,
      props.tourism,
      props.brand,
      props.operator,
      props.description,
      props.notes,
      props.route_name,
      props.route_type,
      props.style_bucket,
      props.event,
      props.headline,
      props.severity,
      props.folder,
    ];
    return values.filter((value) => value !== undefined && value !== null).join(" ").toLowerCase();
  }

  function pointForFeature(feature) {
    const geometry = feature?.geometry || {};
    if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) return geometry.coordinates;
    if (geometry.type === "LineString" && Array.isArray(geometry.coordinates) && geometry.coordinates.length) {
      return geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
    }
    if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates) && geometry.coordinates[0]?.length) {
      const line = geometry.coordinates[0];
      return line[Math.floor(line.length / 2)];
    }
    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates) && geometry.coordinates[0]?.length) {
      return geometry.coordinates[0].reduce((acc, coord) => [acc[0] + Number(coord[0] || 0), acc[1] + Number(coord[1] || 0)], [0, 0]).map((value) => value / geometry.coordinates[0].length);
    }
    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates) && geometry.coordinates[0]?.[0]?.length) {
      return geometry.coordinates[0][0].reduce((acc, coord) => [acc[0] + Number(coord[0] || 0), acc[1] + Number(coord[1] || 0)], [0, 0]).map((value) => value / geometry.coordinates[0][0].length);
    }
    return null;
  }

  function featureWithinBounds(feature, bounds) {
    const point = pointForFeature(feature);
    return point && bounds.contains({ lng: Number(point[0]), lat: Number(point[1]) });
  }

  function searchResultTitle(feature, fallback = "Result") {
    const props = feature.properties || {};
    return props.name || props.title || props.route_name || props.headline || props.event || props.kind || props.category || fallback;
  }

  function searchResultSubtitle(feature, sourceLabel) {
    const props = feature.properties || {};
    return [sourceLabel, props.category, props.kind, props.amenity, props.shop, props.folder].filter(Boolean).join(" · ");
  }

  function renderSearchResults(results) {
    const list = $("searchResults");
    if (!results.length) {
      list.innerHTML = '<div class="omv2-overlay-note">No visible matches.</div>';
      list.hidden = false;
      if (state.map?.getSource("search-results")) state.map.getSource("search-results").setData(EMPTY);
      return;
    }
    list.innerHTML = results.slice(0, 40).map((result, index) => `
      <button class="omv2-search-result" type="button" data-search-index="${index}">
        <strong>${escapeHtml(result.title)}</strong>
        <small>${escapeHtml(result.subtitle)}</small>
      </button>
    `).join("");
    list.hidden = false;
    const highlights = results
      .filter((result) => result.point)
      .map((result, index) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: result.point },
        properties: { index, title: result.title },
      }));
    if (state.map?.getSource("search-results")) {
      state.map.getSource("search-results").setData({ type: "FeatureCollection", features: highlights });
    }
  }

  function searchNeedles(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const values = new Set([q]);
    for (const token of q.split(/\s+/).filter(Boolean)) {
      values.add(token);
      (SEARCH_SYNONYMS[token] || []).forEach((item) => values.add(item));
    }
    return Array.from(values).filter(Boolean);
  }

  function matchesSearch(feature, needles) {
    const text = featureSearchText(feature);
    return needles.some((needle) => text.includes(needle));
  }

  function featureOverlay(feature) {
    const source = String(feature.source || feature.layer?.source || "");
    const sourceLayer = String(feature.sourceLayer || feature.sourceLayer || "");
    const layerId = String(feature.layer?.id || "");
    return normalizeOverlayRegistry(state.overlayRegistry)
      .find((overlay) => {
        const sourceId = overlaySourceId(overlay);
        return source === sourceId
          || source.startsWith(`${sourceId}-`)
          || layerId.startsWith(`${sourceId}-`)
          || (overlay.source_layer && sourceLayer === overlay.source_layer);
      }) || null;
  }

  function runMapSearch(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!state.map || !q) {
      closeSearch();
      return;
    }
    const coords = parseCoordinateQuery(query);
    if (coords) {
      const point = [coords.lon, coords.lat];
      const title = `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
      state.searchResults = [{
        feature: { type: "Feature", geometry: { type: "Point", coordinates: point }, properties: { name: title } },
        point,
        title,
        subtitle: "Coordinates",
        source: "coordinates",
      }];
      renderSearchResults(state.searchResults);
      state.map.easeTo({ center: point, zoom: Math.max(state.map.getZoom(), 14), duration: 450 });
      new maplibregl.Popup({ className: "omv2-poi-popup", maxWidth: "340px" })
        .setLngLat(point)
        .setHTML(`
          <article class="omv2-poi-card">
            <p class="omv2-poi-kicker">Coordinates</p>
            <h3>${escapeHtml(title)}</h3>
            <div class="omv2-poi-actions">
              <button type="button" data-copy-coords="${escapeHtml(title)}">Copy coordinates</button>
            </div>
          </article>
        `)
        .addTo(state.map);
      return;
    }
    const needles = searchNeedles(q);
    const includeBase = $("searchBase")?.checked !== false;
    const includeOverlays = $("searchOverlays")?.checked !== false;
    const includeSaved = $("searchSaved")?.checked !== false;
    const bounds = state.map.getBounds();
    const results = [];
    const seen = new Set();
    if (includeSaved) {
      for (const feature of state.places.features || []) {
        if (!featureWithinBounds(feature, bounds)) continue;
        if (!matchesSearch(feature, needles)) continue;
        const point = pointForFeature(feature);
        const title = searchResultTitle(feature, "Saved item");
        const key = `saved:${feature.properties?.id || title}:${point}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ feature, point, title, subtitle: searchResultSubtitle(feature, "Saved data"), source: "saved" });
      }
    }
    const searchableLayers = state.map.getStyle().layers
      .filter((layer) => layer.id && state.map.getLayer(layer.id) && !["background", "raster", "hillshade"].includes(layer.type))
      .map((layer) => layer.id);
    const rendered = searchableLayers.length ? state.map.queryRenderedFeatures({ layers: searchableLayers }) : [];
    for (const feature of rendered) {
      const overlay = featureOverlay(feature);
      if (overlay && !includeOverlays) continue;
      if (!overlay && !includeBase) continue;
      if (!matchesSearch(feature, needles)) continue;
      const point = pointForFeature(feature);
      if (!point) continue;
      const title = searchResultTitle(feature, "Map item");
      const key = `${feature.source}:${feature.sourceLayer || feature.layer?.id}:${title}:${point.map((value) => Number(value).toFixed(4)).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        feature,
        point,
        title,
        subtitle: searchResultSubtitle(feature, overlay?.name || feature.sourceLayer || feature.layer?.id || "Map"),
        source: overlay ? "overlay" : "map",
        overlay,
      });
    }
    state.searchResults = results;
    renderSearchResults(results);
  }

  function openSearchResult(index) {
    const result = state.searchResults[Number(index)];
    if (!result?.point || !state.map) return;
    state.map.easeTo({ center: result.point, zoom: Math.max(state.map.getZoom(), 15), duration: 450 });
    const html = result.source === "saved"
      ? savedDataPopupHtml(result.feature.properties || {}, result.feature.geometry?.type === "Point" ? "waypoint" : "route", result.point)
      : result.source === "overlay"
        ? overlayPopupHtml(result.feature.properties || {}, result.overlay || {}, result.point)
        : basePoiPopupHtml(result.feature.properties || {}, result.point);
    new maplibregl.Popup({ className: "omv2-poi-popup", maxWidth: "380px" })
      .setLngLat(result.point)
      .setHTML(html)
      .addTo(state.map);
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
      copy.properties.marker_icon_key = waypointIconKey(copy.properties);
      copy.properties.road_type = copy.properties.road_type || copy.properties.route_type || copy.properties.category || "";
      if (geometry.type === "Point" && state.showWaypoints) waypointFeatures.push(copy);
      if (["LineString", "MultiLineString"].includes(geometry.type) && state.showTracks) trackFeatures.push(copy);
    }
    state.map.getSource("overland-waypoints").setData({ type: "FeatureCollection", features: waypointFeatures });
    state.map.getSource("overland-tracks").setData({ type: "FeatureCollection", features: trackFeatures });
    updateOfflineRegionSources();
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
      state.manualRecording = Boolean(payload.manual_recording);
      const status = state.track && state.track.status ? state.track.status : "inactive";
      const points = state.track && state.track.point_count ? ` · ${state.track.point_count} pts` : "";
      $("trackStatus").textContent = `Track ${status}${points}`;
      updateTrackDot(status, payload.track_mode || "auto");
    } catch {
      $("trackStatus").textContent = "Track --";
      state.manualRecording = false;
      updateTrackDot("disabled", "auto");
    }
  }

  function updateTrackDot(status, mode = "auto") {
    const dot = $("trackDot");
    const button = $("trackDotButton");
    if (!dot) return;
    const autoEnabled = localStorage.getItem(MAP_AUTO_RECORDING_KEY) !== "false";
    dot.classList.remove("is-active", "is-disabled");
    if (!autoEnabled || status === "disabled" || status === "--") {
      dot.classList.add("is-disabled");
      if (button) button.title = "Track recording disabled";
      return;
    }
    if (state.manualRecording || mode === "manual") {
      dot.classList.add("is-active");
      if (button) button.title = "Continuous track recording active";
      return;
    }
    if (status === "current" || status === "active" || status === "recording") {
      dot.classList.add("is-active");
      if (button) button.title = "Track recording active";
      return;
    }
    if (button) button.title = "Track recording inactive";
  }

  function openTrackModeModal() {
    $("trackModeTitle").textContent = state.manualRecording ? "Continuous recording active" : "Recording options";
    $("trackModeHint").textContent = state.manualRecording
      ? "This route will continue recording until you stop it. Auto 2 mph recording is bypassed while continuous recording is active."
      : "Auto recording starts above 2 mph. Continuous recording keeps a single route active until you stop it.";
    $("startManualTrack").hidden = state.manualRecording;
    $("stopManualTrack").hidden = !state.manualRecording;
    $("trackModeModal").hidden = false;
  }

  function closeTrackModeModal() {
    $("trackModeModal").hidden = true;
  }

  async function setManualTrackRecording(enabled) {
    const endpoint = enabled ? API.trackManualStart : API.trackManualStop;
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "Track recording update failed.");
    }
    state.track = payload.track || null;
    state.manualRecording = Boolean(payload.manual_recording);
    const status = state.track && state.track.status ? state.track.status : "inactive";
    updateTrackDot(status, payload.track_mode || "auto");
    $("trackStatus").textContent = `Track ${status}${state.track && state.track.point_count ? ` · ${state.track.point_count} pts` : ""}`;
    return payload;
  }

  function openLegendModal() {
    const content = $("legendContent");
    if (content && !content.dataset.rendered) {
      content.innerHTML = legendMarkup();
      content.dataset.rendered = "1";
    }
    $("legendModal").hidden = false;
  }

  function closeLegendModal() {
    $("legendModal").hidden = true;
  }

  function legendMarkup() {
    const lines = [
      ["Interstate / Primary Road", "solid", "#ff7b24"],
      ["Main Road / Highway", "solid", "#ffd34f"],
      ["Street / Local Road", "solid", "#ffffff"],
      ["Service Road", "dash", "#cfcfcf"],
      ["Track / Unmaintained Road", "dash", "#777"],
      ["Trail / Path", "dot", "#555"],
      ["Railroad", "rail", "#8d8377"],
      ["MVUM Motor Road", "dash", "#ff8a2a"],
      ["MVUM Trail", "dash", "#7c5cff"],
    ];
    const areas = [
      ["Park / Forest", "#9bd8ac"],
      ["BLM-Administered Land", "#efc96e"],
      ["BLM Wilderness Area", "#e7b45a"],
      ["BLM Wilderness Study Area", "#8fb39a"],
      ["Waterway / Waterbody", "#76d9e8"],
      ["Building / Structure", "#d7d1c5"],
      ["School / Campus", "#e9e2cb"],
      ["Industrial / Commercial", "#e0d8d0"],
      ["Restricted / Military", "#ffd4d4"],
      ["Weather Alert", "rgba(255, 211, 79, .42)"],
      ["Wildfire Hotspot", "#ff6b37"],
    ];
    const pois = [
      ["gas-station-ev-station", "Fuel / EV"],
      ["parking", "Parking"],
      ["restaurant", "Restaurant"],
      ["campsite", "Campsite"],
      ["trailhead", "Trailhead"],
      ["viewpoint", "Viewpoint"],
      ["restrooms", "Restrooms"],
      ["medical-clinic-hospital", "Medical"],
      ["airport", "Airport"],
      ["waterfall", "Waterfall"],
    ];
    return `
      <section><h3>Roads & Lines</h3>${lines.map(([label, type, color]) => `<div class="legend-row"><span class="legend-line ${type}" style="--c:${color}"></span><span>${escapeHtml(label)}</span></div>`).join("")}</section>
      <section><h3>Areas & Overlays</h3>${areas.map(([label, color]) => `<div class="legend-row"><span class="legend-area" style="--c:${color}"></span><span>${escapeHtml(label)}</span></div>`).join("")}</section>
      <section><h3>Points of Interest</h3>${pois.map(([icon, label]) => `<div class="legend-row"><span class="legend-poi"><img src="/maps-v2/icons/poi/${escapeHtml(icon)}.svg" alt=""></span><span>${escapeHtml(label)}</span></div>`).join("")}</section>
    `;
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

  function findPlaceById(id) {
    return (state.places.features || []).find((feature) => String(feature.properties?.id || "") === String(id));
  }

  function openDataEditModal(itemId) {
    const feature = findPlaceById(itemId);
    if (!feature) {
      toast("Saved item was not found.", true);
      return;
    }
    const props = feature.properties || {};
    state.editingItem = feature;
    $("dataEditId").value = props.id || "";
    $("dataEditName").value = props.name || props.title || "";
    fillManagerFolderSelect($("dataEditFolder"), props.folder || "Unfiled");
    $("dataEditCategory").value = props.category || (feature.geometry?.type === "Point" ? "waypoint" : "route");
    $("dataEditIcon").value = waypointIconKey(props);
    $("dataEditUrl").value = props.url || props.website || "";
    $("dataEditNotes").value = props.notes || props.description || "";
    $("dataEditColor").value = /^#[0-9a-f]{6}$/i.test(String(props.color || "")) ? props.color : colorFor(feature);
    const isRoute = ["LineString", "MultiLineString"].includes(feature.geometry?.type);
    $("dataEditRoadTypeLabel").hidden = !isRoute;
    $("dataEditRoadType").value = props.road_type || props.route_type || "";
    renderColorSwatches($("dataEditColor").value);
    $("dataEditModal").hidden = false;
  }

  function closeDataEditModal() {
    $("dataEditModal").hidden = true;
    state.editingItem = null;
  }

  function openDataDeleteModal(itemId, label = "this item", folder = "") {
    if (!itemId && !folder) return;
    state.deletingItem = { id: itemId, label, folder };
    $("dataDeleteMessage").textContent = folder
      ? `Delete folder "${label}" and its map data? This cannot be undone.`
      : `Delete "${label}" from OIAB map data? This cannot be undone.`;
    $("dataDeleteModal").hidden = false;
  }

  function openDataBulkDeleteModal(itemIds = [], folderPaths = []) {
    if (!itemIds.length && !folderPaths.length) return;
    state.deletingItem = { label: "selected map data", itemIds, folderPaths };
    $("dataDeleteMessage").textContent = `Delete ${itemIds.length + folderPaths.length} selected map data item(s)? This cannot be undone.`;
    $("dataDeleteModal").hidden = false;
  }

  function closeDataDeleteModal() {
    $("dataDeleteModal").hidden = true;
    state.deletingItem = null;
  }

  async function confirmDataDelete() {
    const target = state.deletingItem;
    if (!target?.id && !target?.folder && !target?.itemIds?.length && !target?.folderPaths?.length) return;
    const body = target.itemIds || target.folderPaths
      ? { action: "delete_items", item_ids: target.itemIds || [], folder_paths: target.folderPaths || [] }
      : target.folder
      ? { action: "delete_items", item_ids: [], folder_paths: [target.folder] }
      : { action: "delete_items", item_ids: [target.id], folder_paths: [] };
    const response = await fetch("/maps-data-manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      toast(data.error || "Saved item delete failed.", true);
      return;
    }
    closeDataDeleteModal();
    const popup = document.querySelector(".maplibregl-popup .maplibregl-popup-close-button");
    if (popup) popup.click();
    toast("Saved item deleted.");
    state.managerSelectedItems.clear();
    state.managerSelectedFolders.clear();
    await loadOverlandData();
    if (!$("dataManagerPanel").hidden) await loadManagerSnapshot();
  }

  async function copyCoordinates(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast("Coordinates copied.");
    } catch {
      toast("Copy failed. Select and copy the coordinates manually.", true);
    }
  }

  async function saveDataEdit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { action: "update_item" };
    for (const [key, value] of form.entries()) payload[key] = value;
    const response = await fetch("/maps-data-manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      toast(data.error || "Saved item update failed.", true);
      return;
    }
    closeDataEditModal();
    toast("Saved item updated.");
    await loadOverlandData();
    if (!$("dataManagerPanel").hidden) await loadManagerSnapshot();
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
    for (const [id, label, iconKey] of WAYPOINT_TYPES) {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<img src="/maps-v2/icons/poi/${escapeHtml(iconKey)}.svg" alt="" loading="lazy"><span>${escapeHtml(label)}</span>`;
      button.addEventListener("click", () => saveWaypoint(id));
      node.appendChild(button);
    }
  }

  function populateIconSelect() {
    const select = $("dataEditIcon");
    if (!select) return;
    const keys = Array.from(new Set(POI_ICON_KEYS)).sort((a, b) => humanizePoiValue(a).localeCompare(humanizePoiValue(b)));
    select.innerHTML = keys.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(humanizePoiValue(key))}</option>`).join("");
  }

  function renderColorSwatches(selected = "") {
    const node = $("dataEditColorSwatches");
    if (!node) return;
    const active = String(selected || "").toLowerCase();
    node.replaceChildren(...COLOR_SWATCHES.map((color) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "omv2-color-swatch";
      button.style.background = color;
      button.title = color;
      button.classList.toggle("is-active", color.toLowerCase() === active);
      button.addEventListener("click", () => {
        $("dataEditColor").value = color;
        renderColorSwatches(color);
      });
      return button;
    }));
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
    $("savedDataToggle").addEventListener("click", () => {
      $("savedDataPanel").hidden = !$("savedDataPanel").hidden;
      $("overlaysPanel").hidden = true;
      $("dataManagerPanel").hidden = true;
    });
    $("overlaysToggle").addEventListener("click", () => {
      $("overlaysPanel").hidden = !$("overlaysPanel").hidden;
      $("savedDataPanel").hidden = true;
      $("dataManagerPanel").hidden = true;
    });
    $("offlineRegionToggle").addEventListener("click", () => {
      state.inspectTile = false;
      state.addFromMap = false;
      $("inspectTile").classList.remove("is-pending");
      $("addMapWaypoint").classList.remove("is-pending");
      $("savedDataPanel").hidden = true;
      $("overlaysPanel").hidden = true;
      $("dataManagerPanel").hidden = true;
      const enabled = !state.offlineRegionDraw;
      setOfflineRegionDrawEnabled(enabled);
      toast(enabled ? "Draw a box on the map to cache online overlays." : "Offline cache region mode off.");
    });
    $("closeSavedData").addEventListener("click", () => { $("savedDataPanel").hidden = true; });
    $("closeOverlays").addEventListener("click", () => { $("overlaysPanel").hidden = true; });
    $("closeDataManager").addEventListener("click", closeDataManagerModal);
    $("closeOfflineRegionModal").addEventListener("click", () => {
      state.offlineRegionDraft = null;
      updateOfflineRegionSources();
      closeOfflineRegionModal();
    });
    $("offlineRegionForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await saveOfflineRegion("create");
      } catch (error) {
        toast(error.message || "Offline region save failed.", true);
      }
    });
    $("refreshOfflineRegion").addEventListener("click", async () => {
      try {
        await saveOfflineRegion("refresh");
      } catch (error) {
        toast(error.message || "Offline region update failed.", true);
      }
    });
    $("deleteOfflineRegion").addEventListener("click", async () => {
      try {
        await removeOfflineRegion();
      } catch (error) {
        toast(error.message || "Offline region delete failed.", true);
      }
    });
    $("offlineOnlyToggle").addEventListener("change", async (event) => {
      try {
        const data = await postJson(API.overlayOfflineOnly, { enabled: event.target.checked });
        applyOverlayRegistryUpdate(data);
        state.packSignature = "";
        await boot();
        toast(event.target.checked ? "Offline regions only enabled." : "Online fallback restored.");
      } catch (error) {
        event.target.checked = !event.target.checked;
        toast(error.message || "Offline-only toggle failed.", true);
      }
    });
    $("searchToggle").addEventListener("click", () => {
      $("searchForm").hidden = false;
      $("searchInput").focus();
    });
    $("searchClose").addEventListener("click", closeSearch);
    $("searchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      runMapSearch($("searchInput").value);
    });
    $("searchInput").addEventListener("input", (event) => {
      const value = event.target.value.trim();
      if (!value) {
        if (state.map?.getSource("search-results")) state.map.getSource("search-results").setData(EMPTY);
        $("searchResults").hidden = true;
      }
    });
    $("searchResults").addEventListener("click", (event) => {
      const button = event.target.closest("[data-search-index]");
      if (button) openSearchResult(button.dataset.searchIndex);
    });
    $("legendToggle").addEventListener("click", openLegendModal);
    $("closeLegendModal").addEventListener("click", closeLegendModal);
    $("trackDotButton").addEventListener("click", openTrackModeModal);
    $("closeTrackModeModal").addEventListener("click", closeTrackModeModal);
    $("closeTrackModeAction").addEventListener("click", closeTrackModeModal);
    $("startManualTrack").addEventListener("click", async () => {
      try {
        await setManualTrackRecording(true);
        closeTrackModeModal();
        toast("Continuous recording started.");
      } catch (error) {
        toast(error.message || "Track start failed.", true);
      }
    });
    $("stopManualTrack").addEventListener("click", async () => {
      try {
        await setManualTrackRecording(false);
        closeTrackModeModal();
        toast("Continuous recording stopped.");
      } catch (error) {
        toast(error.message || "Track stop failed.", true);
      }
    });
    $("refreshData").addEventListener("click", () => { loadOverlandData(); pollLocation(); pollTrack(); });
    $("inspectTile").addEventListener("click", () => {
      state.inspectTile = !state.inspectTile;
      state.addFromMap = false;
      $("inspectTile").classList.toggle("is-pending", state.inspectTile);
      $("addMapWaypoint").classList.remove("is-pending");
      toast(state.inspectTile ? "Tile inspect mode on. Tap the gray block." : "Tile inspect mode off.");
    });
    $("retryMapPack").addEventListener("click", boot);
    $("rescanMapPacks").addEventListener("click", async () => {
      try {
        setPackMessage("Scanning /data/oiab/maps/packs...");
        await postJson("/api/maps/packs/rescan");
        toast("Map packs rescanned.");
        setPackMessage("Map packs rescanned.");
        await boot();
      } catch (error) {
        setPackMessage(error.message, true);
        toast(error.message, true);
      }
    });
    $("installWorldOverview").addEventListener("click", async () => {
      try {
        setPackMessage("Starting World Overview install...");
        toast("Starting World Overview install...");
        await postJson("/api/maps/packs/install", { id: "world_overview" });
        setPackMessage("World Overview install is running in the background.");
        startMissingPackPoll();
      } catch (error) {
        setPackMessage(error.message, true);
        toast(error.message, true);
      }
    });
    $("openMapPackSettings").addEventListener("click", () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "oiab:open-app", appId: "map-packs" }, window.location.origin);
      } else if (window.top && window.top !== window) {
        window.top.postMessage({ type: "oiab:open-app", appId: "map-packs" }, window.location.origin);
      } else {
        window.location.href = "/mobile/map-packs.html";
      }
    });
    $("closeWaypointModal").addEventListener("click", closeWaypointModal);
    $("closeDataEdit").addEventListener("click", closeDataEditModal);
    $("dataEditForm").addEventListener("submit", saveDataEdit);
    $("closeDataDelete").addEventListener("click", closeDataDeleteModal);
    $("cancelDataDelete").addEventListener("click", closeDataDeleteModal);
    $("confirmDataDelete").addEventListener("click", confirmDataDelete);
    $("managerAddFolderOpen").addEventListener("click", () => {
      $("managerMoveForm").hidden = true;
      $("managerAddFolderForm").hidden = !$("managerAddFolderForm").hidden;
      if (!$("managerAddFolderForm").hidden) $("managerAddFolderForm").querySelector("input").focus();
    });
    $("managerAddFolderForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("folder") || "").trim();
      if (!name) return;
      try {
        await managerAction({ action: "add_folder", folder: name });
        event.currentTarget.reset();
        event.currentTarget.hidden = true;
        setManagerStatus("Folder added.");
      } catch (error) {
        setManagerStatus(error.message, true);
      }
    });
    $("managerMoveOpen").addEventListener("click", () => {
      if (!state.managerSelectedItems.size && !state.managerSelectedFolders.size) {
        setManagerStatus("Select items or folders first.", true);
        return;
      }
      fillManagerFolderSelect($("managerMoveFolder"), "Unfiled");
      $("managerAddFolderForm").hidden = true;
      $("managerMoveForm").hidden = !$("managerMoveForm").hidden;
    });
    $("managerMoveForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const target = String(form.get("folder") || "").trim();
      if (!target) return;
      try {
        const data = await managerAction({
          action: "move_items",
          item_ids: Array.from(state.managerSelectedItems),
          folder_paths: Array.from(state.managerSelectedFolders),
          target_folder: target,
        });
        state.managerSelectedItems.clear();
        state.managerSelectedFolders.clear();
        event.currentTarget.hidden = true;
        setManagerStatus(`Moved ${data.count || 0} item(s).`);
      } catch (error) {
        setManagerStatus(error.message, true);
      }
    });
    document.querySelectorAll("[data-cancel-manager-form]").forEach((button) => {
      button.addEventListener("click", () => {
        $("managerAddFolderForm").hidden = true;
        $("managerMoveForm").hidden = true;
      });
    });
    $("managerExport").addEventListener("click", () => {
      window.location.href = "/maps-data-export.gpx";
    });
    $("managerDelete").addEventListener("click", async () => {
      if (!state.managerSelectedItems.size && !state.managerSelectedFolders.size) {
        setManagerStatus("Select items or folders first.", true);
        return;
      }
      openDataBulkDeleteModal(Array.from(state.managerSelectedItems), Array.from(state.managerSelectedFolders));
    });
    $("managerImportForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      setManagerStatus("Importing...");
      const formElement = event.currentTarget;
      try {
        const response = await fetch("/maps-data-import", { method: "POST", body: new FormData(formElement) });
        const data = await response.json();
        if (!response.ok || data.ok === false) throw new Error(data.error || "Import failed.");
        state.managerSnapshot = data;
        renderDataManager();
        await loadOverlandData();
        if (typeof formElement.reset === "function") formElement.reset();
        setManagerStatus(`Imported ${data.count || 0} item(s).`);
      } catch (error) {
        setManagerStatus(error.message, true);
      }
    });
    $("managerCoordinateForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      setManagerStatus("Saving waypoint...");
      const formElement = event.currentTarget;
      try {
        const form = new FormData(formElement);
        form.set("source", "manual");
        form.set("icon", form.get("category") || "waypoint");
        const response = await fetch(API.save, { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok || data.ok === false) throw new Error(data.error || "Waypoint save failed.");
        if (typeof formElement.reset === "function") formElement.reset();
        await loadManagerSnapshot();
        await loadOverlandData();
        setManagerStatus("Waypoint added.");
      } catch (error) {
        setManagerStatus(error.message, true);
      }
    });
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oiab:close-map-data-manager") closeDataManagerModal();
    });
    document.addEventListener("click", (event) => {
      const managerLink = event.target.closest("[data-open-map-data-manager]");
      if (managerLink) {
        event.preventDefault();
        openDataManagerModal();
        return;
      }
      const copyButton = event.target.closest("[data-copy-coords]");
      if (copyButton) {
        event.preventDefault();
        copyCoordinates(copyButton.dataset.copyCoords || "");
        return;
      }
      const deleteButton = event.target.closest("[data-delete-map-item]");
      if (deleteButton) {
        event.preventDefault();
        openDataDeleteModal(deleteButton.dataset.deleteMapItem, deleteButton.dataset.deleteMapLabel || "this item");
        return;
      }
      const button = event.target.closest("[data-edit-map-item]");
      if (!button) return;
      event.preventDefault();
      openDataEditModal(button.dataset.editMapItem);
    });
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
      const selection = await loadPack();
      if (!selection) return;
      renderOverlayControls();
      const signature = selectionSignature(selection);
      if (state.map && signature === state.packSignature) {
        maybeFitToSelection(selection);
        return;
      }
      state.packSignature = signature;
      const style = await loadStyle(selection);
      initMap(style);
    } catch (error) {
      $("missingPack").hidden = false;
      $("mapPackName").textContent = "Maps v2 failed to start";
      toast(error.message, true);
    }
  }

  bindControls();
  renderWaypointTypes();
  populateIconSelect();
  window.addEventListener("storage", (event) => {
    if (event.key !== MAP_3D_BUILDINGS_KEY) return;
    state.show3dBuildings = JSON.parse(event.newValue || "false");
    applyBuildingDisplayMode();
  });
  boot();
})();
