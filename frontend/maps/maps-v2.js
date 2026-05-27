(() => {
  const $ = (id) => document.getElementById(id);
  const API = {
    packs: "/api/maps/packs/installed",
    packStatus: "/api/maps/packs/status",
    overlays: "/api/maps/overlays",
    data: "/maps-data",
    location: "/maps-location-current",
    track: "/maps-tracks-current",
    save: "/maps-quick-save",
  };
  const MAP_3D_BUILDINGS_KEY = "omv2.show3dBuildings";
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
    missingPackPoll: null,
    dataTimer: null,
    locationTimer: null,
    trackTimer: null,
    packTimer: null,
    packSignature: "",
    overlayRegistry: null,
    tileErrors: [],
    inspectTile: false,
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
    return String((feature.properties || {}).folder || "Unfiled").trim() || "Unfiled";
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

  function overlaySourceId(overlay) {
    return `overlay-${String(overlay.id || "source").replace(/[^a-z0-9_-]+/gi, "-")}`;
  }

  function overlayLayerId(overlay, suffix) {
    return `${overlaySourceId(overlay)}-${suffix}`;
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
      .filter((overlay) => overlay && overlay.enabled && (overlay.available || overlay.online_available || overlay.offline_available || overlay.exists))
      .sort((a, b) => Number(a.sort_order ?? 100) - Number(b.sort_order ?? 100));
  }

  function overlaySignature(overlays) {
    return overlays.map((overlay) => ({
      id: overlay.id,
      type: overlay.type,
      url: overlay.url || overlay.source_url,
      tiles: overlay.tiles || [],
      source_layer: overlay.source_layer || "",
      enabled: Boolean(overlay.enabled),
      opacity: Number(overlay.opacity ?? 1),
      sort_order: Number(overlay.sort_order ?? 100),
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
      overlays: normalizeOverlayRegistry(state.overlayRegistry),
      all: [base],
      overlayCount: normalizeOverlayRegistry(state.overlayRegistry).length,
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

  function defaultOverlayLayers(overlay, sourceId) {
    const opacity = overlayOpacity(overlay);
    if (overlay.type === "raster") {
      return [{
        id: overlayLayerId(overlay, "raster"),
        type: "raster",
        source: sourceId,
        paint: { "raster-opacity": opacity },
      }];
    }
    if (overlay.type === "geojson") {
      return [
        {
          id: overlayLayerId(overlay, "fill"),
          type: "fill",
          source: sourceId,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#ffcf45", "fill-opacity": opacity * 0.22 },
        },
        {
          id: overlayLayerId(overlay, "line"),
          type: "line",
          source: sourceId,
          filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
          paint: { "line-color": "#ffcf45", "line-width": 2, "line-opacity": opacity },
        },
        {
          id: overlayLayerId(overlay, "point"),
          type: "circle",
          source: sourceId,
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
    if (overlay.type === "pmtiles" && overlay.source_layer) {
      return [
        {
          id: overlayLayerId(overlay, "fill"),
          type: "fill",
          source: sourceId,
          "source-layer": overlay.source_layer,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#ffcf45", "fill-opacity": opacity * 0.22 },
        },
        {
          id: overlayLayerId(overlay, "line"),
          type: "line",
          source: sourceId,
          "source-layer": overlay.source_layer,
          filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
          paint: { "line-color": "#ffcf45", "line-width": 2, "line-opacity": opacity },
        },
        {
          id: overlayLayerId(overlay, "point"),
          type: "circle",
          source: sourceId,
          "source-layer": overlay.source_layer,
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

  function appendOverlaySourcesAndLayers(style, overlays) {
    if (!overlays.length) return;
    style.sources = style.sources || {};
    style.layers = Array.isArray(style.layers) ? style.layers : [];
    const overlayLayers = [];
    for (const overlay of overlays) {
      const sourceId = overlaySourceId(overlay);
      const sourceUrl = overlay.url || overlay.source_url;
      if (overlay.type === "raster") {
        const tiles = Array.isArray(overlay.tiles) && overlay.tiles.length ? overlay.tiles : sourceUrl ? [sourceUrl] : [];
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
        : defaultOverlayLayers(overlay, sourceId);
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
      attributionControl: true,
      cooperativeGestures: false,
      canvasContextAttributes: { antialias: true },
    });
    state.map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "imperial" }), "bottom-left");
    state.map.on("error", logMapError);
    state.map.on("moveend", saveMapView);
    state.map.on("load", async () => {
      applyBuildingDisplayMode();
      await loadPoiImages();
      addBasePoiIconLayer();
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
    state.map.on("click", "overland-waypoint-circles", showWaypointPopup);
    state.map.on("click", "overland-waypoint-icons", showWaypointPopup);
    state.map.on("click", "oiab-poi-icons", showBasePoiPopup);
    state.map.on("click", "pois", showBasePoiPopup);
  }

  function showWaypointPopup(event) {
    const feature = event.features && event.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const coords = feature.geometry.coordinates;
    new maplibregl.Popup()
      .setLngLat(coords)
      .setHTML(`<strong>${escapeHtml(featureName(feature))}</strong><br>${escapeHtml(props.category || "waypoint")} · ${escapeHtml(props.folder || "Unfiled")}<br><small>${escapeHtml(props.notes || "")}</small>`)
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
      .setHTML(basePoiPopupHtml(props))
      .addTo(state.map);
  }

  function basePoiPopupHtml(props = {}) {
    const name = props.name || props["name:en"] || props.name_en || "Point of interest";
    const kind = humanizePoiValue(props.kind || props.kind_detail || props.amenity || props.shop || props.tourism || "poi");
    const details = readablePoiDetails(props);
    const technical = Object.entries(props)
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `<dt>${escapeHtml(humanizePoiKey(key))}</dt><dd>${escapeHtml(formatPoiValue(value))}</dd>`)
      .join("");
    return `
      <article class="omv2-poi-card">
        <p class="omv2-poi-kicker">${escapeHtml(kind)}</p>
        <h3>${escapeHtml(name)}</h3>
        ${details.length ? `<dl class="omv2-poi-details">${details.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>` : `<p class="omv2-poi-empty">No additional details in this map pack.</p>`}
        ${technical ? `<details class="omv2-poi-technical"><summary>Technical details</summary><dl>${technical}</dl></details>` : ""}
      </article>
    `;
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
      copy.properties.marker_icon_key = waypointIconKey(copy.properties);
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
    for (const [id, label, iconKey] of WAYPOINT_TYPES) {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<img src="/maps-v2/icons/poi/${escapeHtml(iconKey)}.svg" alt="" loading="lazy"><span>${escapeHtml(label)}</span>`;
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
      } else {
        window.location.href = "/mobile/map-packs.html";
      }
    });
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
      const selection = await loadPack();
      if (!selection) return;
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
  window.addEventListener("storage", (event) => {
    if (event.key !== MAP_3D_BUILDINGS_KEY) return;
    state.show3dBuildings = JSON.parse(event.newValue || "false");
    applyBuildingDisplayMode();
  });
  boot();
})();
