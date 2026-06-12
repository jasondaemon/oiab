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
  const MAP_THEME_KEY = "omv2.mapTheme";
  const MAP_RIGHT_CONTROLS_COLLAPSED_KEY = "omv2.rightControlsCollapsed";
  const MAP_DETAIL_OVERLAYS_KEY = "omv2.mapDetailOverlays";
  const TEMPERATURE_FORECAST_KEY = "omv2.temperatureForecast";
  const POI_KIND_FILTER_KEY = "omv2.poiKindFilter";
  const POI_ICON_STYLE_KEY = "omv2.poiIconStyle";
  const SAVED_DATA_OVERLAYS_KEY = "omv2.savedDataOverlays";
  const POI_ICON_STYLE_DEFAULT = "outlined-glyph";
  const POI_ICON_STYLES = new Set(["outlined-glyph", "circle-marker", "google-circle"]);
  const FOLLOW_PITCH = 58;
  const FOLLOW_MIN_HEADING_SPEED_MPH = 1.2;
  const EMPTY = { type: "FeatureCollection", features: [] };
  const WAYPOINT_TYPES = [
    ["waypoint", "Waypoint", "waypoint"],
    ["gas", "Gas", "gas-station-ev-station"],
    ["camp", "Camp", "campsite"],
    ["waterfall", "Waterfall", "waterfall"],
    ["lookout", "Lookout", "viewpoint"],
    ["trailhead", "Trailhead", "trailhead"],
    ["food", "Food", "restaurant"],
    ["restroom", "Restroom", "restrooms"],
    ["hazard", "Hazard", "hazard"],
    ["photo", "Photo", "photo"],
    ["other", "Other", "waypoint"],
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
    route: "#a855f7",
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
    "1": "Road open to highway-legal vehicles",
    "2": "Road open to all vehicles",
    "3": "Seasonal road",
    "4": "Road with seasonal designation",
    "5": "High-clearance vehicle road",
    "6": "Special vehicle designation",
    "7": "Trail open to all vehicles",
    "8": "Trail open to vehicles 50 inches or less",
    "9": "Motorcycle trail",
    "10": "Seasonal trail",
    "11": "Seasonal motorized trail",
    "12": "Administrative route",
    "13": "Closed route",
    "14": "Decommissioned route",
    "15": "Non-motorized trail",
    "16": "Motorized mixed-use route",
    "17": "ATV Only",
    "18": "Motorcycle Only",
    "19": "OHV / off-highway vehicle route",
  };
  const MVUM_LINE_STYLES = {
    open_motorized: { label: "MVUM Motor Road", color: "#585858", casing: "#bdbdbd", dash: [1.2, 1.2], pattern: "gravel" },
    high_clearance: { label: "MVUM High-Clearance / Unmaintained", color: "#786b47", casing: "#d9c89b", dash: [2.4, 1.2, 0.7, 1.2], pattern: "high-clearance" },
    seasonal: { label: "MVUM Seasonal Road / Trail Info", color: "#786b47", casing: "#c9c9c9", dash: [2.4, 1.2], annotation: "Open 6/15-9/30", pattern: "seasonal" },
    trail: { label: "MVUM Motorized Trail", color: "#c084fc", dash: [1.1, 1.3] },
    atv_only: { label: "MVUM ATV Only", color: "#22c55e", dash: [2.8, 1.1, 0.7, 1.1], symbol: "ATV" },
    motorcycle_only: { label: "MVUM Motorcycle Only", color: "#60a5fa", dash: [0.8, 1.1, 2.4, 1.1] },
    special: { label: "MVUM Special Designation", color: "#38bdf8", dash: [3, 1.2] },
    restricted: { label: "MVUM Restricted / Closed", color: "#ff7068", dash: [0.9, 1.1] },
    closed: { label: "MVUM Restricted / Closed", color: "#ff7068", dash: [0.9, 1.1] },
    unknown: { label: "MVUM Unknown Route", color: "#a3a3a3", dash: [1, 1] },
  };
  function humanizeToken(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  const MAP_KIND_TO_POI_ICON = {
    aerodrome: "airport",
    airport: "airport",
    alpine_hut: "alpine-hut",
    atm: "atm",
    attraction: "attraction",
    bakery: "bakery",
    bank: "bank",
    bench: "bench",
    bar: "bar",
    beach: "beach",
    bicycle: "bicycle-parking",
    bicycle_parking: "bicycle-parking",
    bicycle_rental: "bicycle-parking",
    bike_rental: "bicycle-parking",
    bicycle_shop: "bike-shop",
    bike_shop: "bike-shop",
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
    water: "drinking-water",
    water_point: "drinking-water",
    water_fountain: "drinking-water",
    drinking_fountain: "drinking-water",
    fountain: "drinking-water",
    tap: "drinking-water",
    diner: "restaurant",
    food: "restaurant",
    coffee: "cafe",
    coffee_shop: "cafe",
    food_court: "fast-food",
    fast_food: "fast-food",
    fast_food_restaurant: "fast-food",
    ferry_terminal: "ferry-terminal",
    fire_station: "fire-station",
    fuel: "gas-station-ev-station",
    gas_station: "gas-station-ev-station",
    charging_station: "gas-station-ev-station",
    garden: "garden",
    golf_course: "golf-course",
    supermarket: "grocery-store",
    convenience: "grocery-store",
    convenience_store: "grocery-store",
    grocery: "grocery-store",
    grocery_store: "grocery-store",
    greengrocer: "grocery-store",
    hotel: "lodging",
    motel: "lodging",
    hot_spring: "hotspring",
    information: "waypoint",
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
    car_park: "parking",
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
    store: "shopping",
    marketplace: "shopping",
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
  const NOUN_POI_ICON_PATHS = {
    airport: "airport",
    "alpine-hut": "alpine-hut",
    amphitheater: "amphitheater",
    atm: "atm",
    attraction: "attraction",
    bakery: "bakery",
    bar: "bar",
    beach: "beach",
    bench: "bench",
    cafe: "cafe",
    campground: "campground",
    campsite: "campsite",
    bank: "bank",
    cave_entrance: "cave",
    "cave-entrance": "cave",
    church: "church",
    fast_food: "fast-food",
    "fast-food": "fast-food",
    fuel: "fuel",
    gas_station: "fuel",
    charging_station: "fuel",
    "gas-station-ev-station": "fuel",
    garden: "garden",
    grocery: "grocery",
    "grocery-store": "grocery",
    "bicycle-parking": "parking",
    "bike-shop": "shop",
    "bus-station": "train",
    cinema: "theatre",
    "college-university": "school",
    "dog-park": "campsite",
    "ferry-terminal": "train",
    "fire-station": "hospital",
    "golf-course": "trailhead",
    hotspring: "water",
    information: "waypoint",
    lighthouse: "airport",
    marina: "water",
    "mine-quarry": "mountain",
    "pub-brewery": "restaurant",
    shelter: "house",
    "ski-area": "mountain",
    spring: "water",
    "swimming-area": "water",
    "water-point": "water",
    "theme-park": "attraction",
    "visitor-center": "waypoint",
    volcano: "mountain",
    zoo: "attraction",
    hospital: "hospital",
    "medical-clinic-hospital": "hospital",
    hotel: "hotel",
    lodging: "hotel",
    library: "library",
    museum: "museum",
    mountain: "mountain",
    "peak-summit": "mountain",
    post_office: "post-office",
    "post-office": "post-office",
    parking: "parking",
    pharmacy: "pharmacy",
    picnic_area: "picnic-area",
    "picnic-area": "picnic-area",
    playground: "playground",
    "police-station": "police-station",
    "ranger-station": "ranger-station",
    restaurant: "restaurant",
    "rv-camping": "rv-camping",
    school: "school",
    shop: "shop",
    shopping: "shop",
    "drinking-water": "water",
    "house-home": "house",
    "outdoor-store": "shop",
    theater: "theatre",
    theatre: "theatre",
    restrooms: "toilet",
    toilet: "toilet",
    toilets: "toilet",
    trailhead: "trailhead",
    train_station: "train",
    "train-station": "train",
    viewpoint: "viewpoint",
    waterfall: "waterfall",
    waypoint: "waypoint",
    hazard: "waypoint",
    photo: "viewpoint",
    "house-home": "house",
  };
  const POI_ICON_COLORS = {
    airport: "#60a5fa",
    "alpine-hut": "#78716c",
    amphitheater: "#78716c",
    atm: "#a78bfa",
    attraction: "#a78bfa",
    bakery: "#fb923c",
    bank: "#a78bfa",
    bar: "#fb923c",
    beach: "#67e8f9",
    bench: "#f7f4df",
    "bicycle-parking": "#60a5fa",
    "bike-shop": "#60a5fa",
    "bus-station": "#60a5fa",
    cafe: "#fb923c",
    campground: "#fb923c",
    campsite: "#4ade80",
    "cave-entrance": "#78716c",
    cinema: "#a78bfa",
    "college-university": "#a78bfa",
    "dog-park": "#4ade80",
    "drinking-water": "#67e8f9",
    "water-point": "#67e8f9",
    "fast-food": "#fb923c",
    "ferry-terminal": "#60a5fa",
    "fire-station": "#f87171",
    "gas-station-ev-station": "#facc15",
    garden: "#4ade80",
    "golf-course": "#4ade80",
    "grocery-store": "#facc15",
    hazard: "#fb7185",
    "house-home": "#4ade80",
    hotspring: "#67e8f9",
    information: "#ffd34f",
    library: "#a78bfa",
    lighthouse: "#60a5fa",
    lodging: "#60a5fa",
    "lookout-tower": "#67e8f9",
    marina: "#67e8f9",
    "medical-clinic-hospital": "#f87171",
    "mine-quarry": "#78716c",
    museum: "#a78bfa",
    "outdoor-store": "#fb923c",
    parking: "#60a5fa",
    "peak-summit": "#78716c",
    pharmacy: "#f87171",
    photo: "#67e8f9",
    "picnic-area": "#4ade80",
    playground: "#4ade80",
    "police-station": "#78716c",
    "post-office": "#a78bfa",
    "pub-brewery": "#fb923c",
    "ranger-station": "#78716c",
    restaurant: "#fb923c",
    restrooms: "#c4b5fd",
    "rv-camping": "#fb923c",
    school: "#eadfbe",
    shelter: "#78716c",
    shopping: "#facc15",
    "ski-area": "#78716c",
    spring: "#67e8f9",
    "swimming-area": "#67e8f9",
    theater: "#a78bfa",
    "theme-park": "#a78bfa",
    trailhead: "#a3e635",
    "train-station": "#60a5fa",
    viewpoint: "#67e8f9",
    "visitor-center": "#f7f4df",
    volcano: "#78716c",
    waterfall: "#67e8f9",
    waypoint: "#ffd34f",
    zoo: "#a78bfa",
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
    other: "waypoint",
    waypoint: "waypoint",
    quick_save: "waypoint",
    "quick-save": "waypoint",
  };
  const POI_ICON_KEYS = Array.from(new Set([
    ...Object.values(MAP_KIND_TO_POI_ICON),
    ...Object.values(WAYPOINT_CATEGORY_TO_POI_ICON),
    "bench",
    "waypoint",
  ])).sort();
  const POI_KIND_FILTER_LABELS = {
    "gas-station-ev-station": "Fuel / EV",
    "fast-food": "Fast Food",
    "grocery-store": "Grocery",
    "drinking-water": "Drinking Water",
    "medical-clinic-hospital": "Medical",
    "picnic-area": "Picnic",
    "rv-camping": "RV Camping",
    "train-station": "Train Station",
    "bus-station": "Bus Station",
    "cave-entrance": "Cave",
    "college-university": "College",
    "police-station": "Police",
    "post-office": "Post Office",
    "ranger-station": "Ranger Station",
    "peak-summit": "Peak / Summit",
    "pub-brewery": "Pub / Brewery",
    "ski-area": "Ski Area",
    "theme-park": "Theme Park",
    "visitor-center": "Visitor Center",
    "water-point": "Water Point",
    "house-home": "Home",
  };
  const POI_KIND_FILTER_OPTIONS = POI_ICON_KEYS
    .map((key) => [key, POI_KIND_FILTER_LABELS[key] || humanizeToken(key)])
    .sort((a, b) => a[1].localeCompare(b[1]));

  function loadPoiKindFilter() {
    const raw = localStorage.getItem(POI_KIND_FILTER_KEY);
    if (!raw) return new Set(POI_ICON_KEYS);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set(POI_ICON_KEYS);
      return new Set(parsed.filter((key) => POI_ICON_KEYS.includes(key)));
    } catch {
      return new Set(POI_ICON_KEYS);
    }
  }

  function savePoiKindFilter() {
    localStorage.setItem(POI_KIND_FILTER_KEY, JSON.stringify(Array.from(state.poiKindFilter)));
  }

  function readPoiIconStyle() {
    const value = localStorage.getItem(POI_ICON_STYLE_KEY) || POI_ICON_STYLE_DEFAULT;
    return POI_ICON_STYLES.has(value) ? value : POI_ICON_STYLE_DEFAULT;
  }

  const MAP_DETAIL_OVERLAY_DEFS = [
    {
      id: "map_detail_roads",
      name: "Map Roads",
      category: "map",
      summary: "roads",
      default_enabled: true,
      default_opacity: 1,
      default_sort_order: 32,
    },
    {
      id: "map_detail_boundaries",
      name: "Map Boundaries",
      category: "map",
      summary: "boundaries",
      default_enabled: true,
      default_opacity: 0.85,
      default_sort_order: 34,
    },
    {
      id: "map_detail_pois",
      name: "Map POIs",
      category: "map",
      summary: "points",
      default_enabled: true,
      default_opacity: 1,
      default_sort_order: 92,
    },
    {
      id: "map_detail_labels",
      name: "Map Labels",
      category: "map",
      summary: "labels",
      default_enabled: true,
      default_opacity: 1,
      default_sort_order: 96,
    },
  ];

  const SAVED_DATA_OVERLAY_DEFS = [
    {
      id: "saved_data_routes",
      name: "Saved Routes",
      category: "saved",
      summary: "routes",
      default_enabled: true,
      default_opacity: 1,
      default_sort_order: 86,
    },
    {
      id: "saved_data_pois",
      name: "Saved POIs",
      category: "saved",
      summary: "points",
      default_enabled: true,
      default_opacity: 1,
      default_sort_order: 88,
    },
  ];

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
    mapDetailLayersByOverlay: {},
    mapErrorsDismissed: false,
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
    poiKindFilter: loadPoiKindFilter(),
    poiIconStyle: readPoiIconStyle(),
    manualRecording: false,
    temperatureForecast: JSON.parse(localStorage.getItem(TEMPERATURE_FORECAST_KEY) || '{"product":"temp","period":"now"}'),
    temperatureOptions: null,
    temperatureDebounce: null,
    temperaturePickMode: false,
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
    return WAYPOINT_CATEGORY_TO_POI_ICON[raw] || (POI_ICON_KEYS.includes(raw) ? raw : "waypoint");
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
    if (isMapDetailOverlayId(id)) {
      return updateMapDetailOverlay(id, { enabled: Boolean(enabled) });
    }
    if (isSavedDataOverlayId(id)) {
      return updateSavedDataOverlay(id, { enabled: Boolean(enabled) });
    }
    return postJson("/api/maps/overlays/set-enabled", { id, enabled });
  }

  async function setOverlayOpacity(id, opacity) {
    if (isMapDetailOverlayId(id)) {
      return updateMapDetailOverlay(id, { opacity: Number(opacity) });
    }
    if (isSavedDataOverlayId(id)) {
      return updateSavedDataOverlay(id, { opacity: Number(opacity) });
    }
    return postJson("/api/maps/overlays/set-opacity", { id, opacity });
  }

  async function setOverlayOrder(id, sortOrder) {
    if (isMapDetailOverlayId(id)) {
      return updateMapDetailOverlay(id, { sort_order: Number(sortOrder) });
    }
    if (isSavedDataOverlayId(id)) {
      return updateSavedDataOverlay(id, { sort_order: Number(sortOrder) });
    }
    return postJson("/api/maps/overlays/set-order", { id, sort_order: sortOrder });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readMapDetailOverlayState() {
    try {
      const saved = JSON.parse(localStorage.getItem(MAP_DETAIL_OVERLAYS_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  }

  function writeMapDetailOverlayState(next) {
    localStorage.setItem(MAP_DETAIL_OVERLAYS_KEY, JSON.stringify(next || {}));
  }

  function isMapDetailOverlayId(id) {
    return MAP_DETAIL_OVERLAY_DEFS.some((overlay) => overlay.id === id);
  }

  function mapDetailOverlays() {
    const saved = readMapDetailOverlayState();
    return MAP_DETAIL_OVERLAY_DEFS.map((def) => {
      const item = saved[def.id] || {};
      return {
        ...def,
        type: "map_detail",
        source_type: "active_basemap",
        available: true,
        enabled: item.enabled === undefined ? def.default_enabled : Boolean(item.enabled),
        opacity: Number.isFinite(Number(item.opacity)) ? Number(item.opacity) : def.default_opacity,
        sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : def.default_sort_order,
        cache_status: "active",
      };
    });
  }

  function mapDetailOverlayState(id) {
    return mapDetailOverlays().find((overlay) => overlay.id === id) || null;
  }

  function updateMapDetailOverlay(id, patch) {
    const saved = readMapDetailOverlayState();
    const current = saved[id] || {};
    saved[id] = { ...current, ...patch };
    writeMapDetailOverlayState(saved);
    return state.overlayRegistry || { overlays: [] };
  }

  function readSavedDataOverlayState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_DATA_OVERLAYS_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  }

  function writeSavedDataOverlayState(next) {
    localStorage.setItem(SAVED_DATA_OVERLAYS_KEY, JSON.stringify(next || {}));
  }

  function isSavedDataOverlayId(id) {
    return SAVED_DATA_OVERLAY_DEFS.some((overlay) => overlay.id === id);
  }

  function savedDataOverlays() {
    const saved = readSavedDataOverlayState();
    return SAVED_DATA_OVERLAY_DEFS.map((def) => {
      const item = saved[def.id] || {};
      return {
        ...def,
        type: "saved_data",
        source_type: "overland_saved_data",
        available: true,
        enabled: item.enabled === undefined ? def.default_enabled : Boolean(item.enabled),
        opacity: Number.isFinite(Number(item.opacity)) ? Number(item.opacity) : def.default_opacity,
        sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : def.default_sort_order,
        cache_status: "local",
      };
    });
  }

  function savedDataOverlayState(id) {
    return savedDataOverlays().find((overlay) => overlay.id === id) || null;
  }

  function updateSavedDataOverlay(id, patch) {
    const saved = readSavedDataOverlayState();
    const current = saved[id] || {};
    saved[id] = { ...current, ...patch };
    writeSavedDataOverlayState(saved);
    return state.overlayRegistry || { overlays: [] };
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

  function mapDetailLayerGroup(layer) {
    const id = String(layer?.id || "");
    const sourceLayer = String(layer?.["source-layer"] || "");
    if (!layer?.source) return "";
    if (id.startsWith("roads_labels_")) return "map_detail_labels";
    if (id.startsWith("roads_")) return "map_detail_roads";
    if (id.startsWith("boundaries")) return "map_detail_boundaries";
    if (sourceLayer === "pois" || id === "pois" || id.startsWith("oiab-travel-poi")) return "map_detail_pois";
    if (layer.type === "symbol" && (sourceLayer === "places" || sourceLayer === "water")) return "map_detail_labels";
    return "";
  }

  function mapDetailLayerId(overlayId, layerId) {
    return `${overlayId}-${String(layerId || "layer").replace(/[^a-z0-9_-]+/gi, "-")}`;
  }

  function overlaySourceId(overlay, variant = "") {
    const base = `overlay-${String(overlay.id || "source").replace(/[^a-z0-9_-]+/gi, "-")}`;
    return variant ? `${base}-${String(variant).replace(/[^a-z0-9_-]+/gi, "-")}` : base;
  }

  function overlayLayerId(overlay, suffix, variant = "") {
    return `${overlaySourceId(overlay, variant)}-${suffix}`;
  }

  const POI_ICON_ASSET_VERSION = "noun-20260611d";
  const POI_IMAGE_PREFIX = `oiab-poi-${POI_ICON_ASSET_VERSION}-`;
  const warnedPoiIconFallbacks = new Set();

  function poiImageId(key) {
    return `${POI_IMAGE_PREFIX}${String(key || "waypoint").replace(/[^a-z0-9_-]+/gi, "-")}`;
  }

  function mapPoiMatchExpression(property, mapping, fallback = "waypoint", idFactory = poiImageId) {
    const keyExpression = Array.isArray(property) ? property : ["get", property];
    const expression = ["match", keyExpression];
    for (const [value, iconKey] of Object.entries(mapping)) {
      expression.push(value, idFactory(iconKey));
    }
    expression.push(idFactory(fallback));
    return expression;
  }

  function poiKindFilterActive() {
    return state.poiKindFilter.size < POI_ICON_KEYS.length;
  }

  function poiKindFilterExpression(iconKeyExpression) {
    if (!poiKindFilterActive()) return null;
    return ["in", iconKeyExpression, ["literal", Array.from(state.poiKindFilter)]];
  }

  function combineMapFilters(...filters) {
    const active = filters.filter(Boolean);
    if (active.length === 0) return undefined;
    if (active.length === 1) return active[0];
    return ["all", ...active];
  }

  function pointGeometryFilter() {
    return ["==", ["geometry-type"], "Point"];
  }

  function basePoiIconKeyExpression() {
    return mapPoiMatchExpression(basePoiKindExpression(), MAP_KIND_TO_POI_ICON, "waypoint", (key) => key);
  }

  function basePoiKindExpression() {
    return ["coalesce", ["get", "kind_detail"], ["get", "kind"]];
  }

  function mapPoiColorExpression() {
    return [
      "match",
      basePoiKindExpression(),
      "fuel", "#facc15",
      "gas_station", "#facc15",
      "charging_station", "#22d3ee",
      "restaurant", "#fb923c",
      "fast_food", "#fb923c",
      "food_court", "#fb923c",
      "diner", "#fb923c",
      "cafe", "#fb923c",
      "camp_site", "#4ade80",
      "campsite", "#4ade80",
      "campground", "#fb923c",
      "trailhead", "#a3e635",
      "parking", "#60a5fa",
      "hospital", "#f87171",
      "clinic", "#f87171",
      "pharmacy", "#f87171",
      "restroom", "#c4b5fd",
      "restrooms", "#c4b5fd",
      "toilet", "#c4b5fd",
      "toilets", "#c4b5fd",
      "drinking_water", "#67e8f9",
      "water_point", "#67e8f9",
      "viewpoint", "#67e8f9",
      "waterfall", "#67e8f9",
      "supermarket", "#facc15",
      "convenience", "#facc15",
      "grocery_store", "#facc15",
      "#f7f4df",
    ];
  }

  function campflarePointColorExpression(style) {
    const fallback = style === "campflare_campsites"
      ? "#38bdf8"
      : style === "campflare_campgrounds"
        ? "#fb923c"
        : style === "campflare_land_pois"
          ? "#a78bfa"
          : "#94a3b8";
    return [
      "case",
      ["==", ["get", "source_kind"], "campsite"], "#38bdf8",
      ["==", ["get", "source_kind"], "poi"], "#a78bfa",
      ["==", ["get", "kind"], "dispersed"], "#4ade80",
      ["==", ["get", "kind"], "established"], "#fb923c",
      ["==", ["get", "kind"], "campground"], "#fb923c",
      fallback,
    ];
  }

  function campflarePointIconExpression(style, idFactory = poiImageId) {
    const campgroundIcon = [
      "match",
      ["get", "kind"],
      "dispersed", idFactory("campsite"),
      "established", idFactory("campground"),
      "campground", idFactory("campground"),
      idFactory("campground"),
    ];
    const poiIcon = [
      "match",
      ["get", "kind"],
      "toilet", idFactory("restrooms"),
      "toilets", idFactory("restrooms"),
      "restroom", idFactory("restrooms"),
      "restrooms", idFactory("restrooms"),
      "water", idFactory("drinking-water"),
      "drinking_water", idFactory("drinking-water"),
      "trailhead", idFactory("trailhead"),
      "viewpoint", idFactory("viewpoint"),
      "picnic", idFactory("picnic-area"),
      "picnic_area", idFactory("picnic-area"),
      "cafe", idFactory("cafe"),
      "restaurant", idFactory("restaurant"),
      "fuel", idFactory("gas-station-ev-station"),
      idFactory("waypoint"),
    ];
    const fallbackIcon = style === "campflare_campsites"
      ? idFactory("campsite")
      : style === "campflare_campgrounds"
        ? campgroundIcon
        : style === "campflare_land_pois"
          ? poiIcon
          : idFactory("waypoint");
    return [
      "case",
      ["==", ["get", "source_kind"], "campsite"], idFactory("campsite"),
      ["==", ["get", "source_kind"], "campground"], campgroundIcon,
      ["==", ["get", "source_kind"], "poi"], poiIcon,
      fallbackIcon,
    ];
  }

  function ridbPointIconExpression(idFactory = poiImageId) {
    return [
      "case",
      ["==", ["get", "recreation_category"], "camping"], idFactory("campground"),
      ["==", ["get", "type"], "Campground"], idFactory("campground"),
      ["==", ["get", "type"], "Camping"], idFactory("campsite"),
      ["==", ["get", "recreation_category"], "pass_permit"], idFactory("waypoint"),
      ["==", ["get", "recreation_category"], "visitor_info"], idFactory("waypoint"),
      idFactory("waypoint"),
    ];
  }

  function unifiedPoiBadgeIconSize() {
    if (state.poiIconStyle === "outlined-glyph") {
      return ["interpolate", ["linear"], ["zoom"], 5, 0.62, 12, 0.9, 17, 1.18];
    }
    return ["interpolate", ["linear"], ["zoom"], 5, 0.5, 12, 0.76, 17, 1.02];
  }

  function poiIconAnchor() {
    return state.poiIconStyle === "outlined-glyph" ? "bottom" : "center";
  }

  function poiIconOffset() {
    return state.poiIconStyle === "outlined-glyph" ? [0, -2] : [0, 0];
  }

  function applyPoiIconLayerLayout() {
    if (!state.map?.getStyle) return;
    const layers = state.map.getStyle()?.layers || [];
    for (const layer of layers) {
      const id = String(layer?.id || "");
      if (
        id === "oiab-poi-icons"
        || id === "overland-waypoint-icons"
        || id.includes("point-icon")
      ) {
        try {
          if (!state.map.getLayer(id)) continue;
          state.map.setLayoutProperty(id, "icon-anchor", poiIconAnchor());
          state.map.setLayoutProperty(id, "icon-offset", poiIconOffset());
          state.map.setLayoutProperty(id, "icon-size", unifiedPoiBadgeIconSize());
        } catch (error) {
          if (window.OIAB_DEBUG_MAPS) console.warn("[OIAB Maps v2] POI icon layout update failed", id, error);
        }
      }
    }
  }

  function staticPoiBadgeLayer(overlay, sourceId, iconKey, options = {}, sourceLayer = null, variant = "") {
    return pointIconOverlayLayer(overlay, sourceId, {
      suffix: options.suffix || "point-icon",
      iconImage: poiImageId(iconKey || "waypoint"),
      iconKey: iconKey || "waypoint",
      iconSize: options.iconSize,
    }, sourceLayer, variant);
  }

  function overlayIconImageId(key) {
    return `oiab-overlay-icon-${String(key || "marker").replace(/[^a-z0-9_-]+/gi, "-")}`;
  }

  const pendingMapImageLoads = new Map();

  function mapImageOptions(id, options = {}) {
    const shouldUseSdf = options.sdf || id === overlayIconImageId("wildfire-flame");
    return shouldUseSdf ? { pixelRatio: 2, sdf: true } : { pixelRatio: 2 };
  }

  function addGeneratedWildfireFlameIcon(id = overlayIconImageId("wildfire-flame"), size = 112) {
    if (!state.map || state.map.hasImage(id)) return true;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context || typeof Path2D === "undefined") return false;
    context.clearRect(0, 0, size, size);
    context.save();
    context.scale(size / 24, size / 24);
    context.fillStyle = "#000";
    context.fill(new Path2D("M11.1758045,11.5299649 C11.7222481,10.7630248 11.6612694,9.95529555 11.2823626,8.50234466 C10.5329929,5.62882187 10.8313891,4.05382867 13.4147321,2.18916004 L14.6756139,1.27904986 L14.9805807,2.80388386 C15.3046861,4.42441075 15.8369398,5.42670671 17.2035766,7.35464078 C17.2578735,7.43122022 17.2578735,7.43122022 17.3124108,7.50814226 C19.2809754,10.2854144 20,11.9596204 20,15 C20,18.6883517 16.2713564,22 12,22 C7.72840879,22 4,18.6888043 4,15 C4,14.9310531 4.00007066,14.9331427 3.98838852,14.6284506 C3.89803284,12.2718054 4.33380946,10.4273676 6.09706666,8.43586022 C6.46961415,8.0150872 6.8930834,7.61067534 7.36962714,7.22370749 L8.42161802,6.36945926 L8.9276612,7.62657706 C9.30157948,8.55546878 9.73969716,9.28566491 10.2346078,9.82150804 C10.6537848,10.2753538 10.9647401,10.8460665 11.1758045,11.5299649 Z M7.59448531,9.76165711 C6.23711779,11.2947332 5.91440928,12.6606068 5.98692012,14.5518252 C6.00041903,14.9039019 6,14.8915108 6,15 C6,17.5278878 8.78360021,20 12,20 C15.2161368,20 18,17.527472 18,15 C18,12.4582072 17.4317321,11.1350292 15.6807305,8.66469725 C15.6264803,8.58818014 15.6264803,8.58818014 15.5719336,8.51124844 C14.5085442,7.0111098 13.8746802,5.96758691 13.4553336,4.8005211 C12.7704786,5.62117775 12.8107447,6.43738988 13.2176374,7.99765534 C13.9670071,10.8711781 13.6686109,12.4461713 11.0852679,14.31084 L9.61227259,15.3740546 L9.50184911,13.5607848 C9.43129723,12.4022487 9.16906461,11.6155508 8.76539217,11.178492 C8.36656566,10.7466798 8.00646835,10.2411426 7.68355027,9.66278925 C7.65342985,9.69565638 7.62374254,9.72861259 7.59448531,9.76165711 Z"));
    context.restore();
    state.map.addImage(id, context.getImageData(0, 0, size, size), { pixelRatio: 2, sdf: true });
    return true;
  }

  async function loadSvgMapImage(id, url, size = 96, options = {}) {
    if (!state.map || state.map.hasImage(id)) return;
    if (pendingMapImageLoads.has(id)) return pendingMapImageLoads.get(id);
    const task = (async () => {
      let objectUrl = null;
      try {
        const response = await fetch(url, { cache: "no-cache" });
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        const svg = await response.text();
        objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
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
        if (options.trim !== false) {
          const imageData = context.getImageData(0, 0, size, size);
          const data = imageData.data;
          let minX = size;
          let minY = size;
          let maxX = -1;
          let maxY = -1;
          for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
              if (data[((y * size + x) * 4) + 3] < 8) continue;
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
          if (maxX >= minX && maxY >= minY) {
            const sourceWidth = maxX - minX + 1;
            const sourceHeight = maxY - minY + 1;
            const padding = Math.max(2, Math.round(size * 0.04));
            const targetSize = size - (padding * 2);
            const scale = Math.min(targetSize / sourceWidth, targetSize / sourceHeight);
            const drawWidth = sourceWidth * scale;
            const drawHeight = sourceHeight * scale;
            const drawX = (size - drawWidth) / 2;
            const drawY = (size - drawHeight) / 2;
            const trimmed = document.createElement("canvas");
            trimmed.width = sourceWidth;
            trimmed.height = sourceHeight;
            const trimmedContext = trimmed.getContext("2d");
            trimmedContext.putImageData(context.getImageData(minX, minY, sourceWidth, sourceHeight), 0, 0);
            context.clearRect(0, 0, size, size);
            context.drawImage(trimmed, drawX, drawY, drawWidth, drawHeight);
          }
        }
        if (state.map && !state.map.hasImage(id)) {
          state.map.addImage(id, context.getImageData(0, 0, size, size), mapImageOptions(id, options));
        }
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        pendingMapImageLoads.delete(id);
      }
    })();
    pendingMapImageLoads.set(id, task);
    return task;
  }

  function poiIconColor(key) {
    return POI_ICON_COLORS[String(key || "waypoint")] || POI_ICON_COLORS.waypoint || "#ffd34f";
  }

  function parseSvgViewBox(svg) {
    const match = String(svg || "").match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
    if (!match) return [0, 0, 100, 100];
    const values = match[1].trim().split(/[\s,]+/).map(Number);
    return values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0
      ? values
      : [0, 0, 100, 100];
  }

  function svgInnerMarkup(svg) {
    return String(svg || "")
      .replace(/<\?xml[\s\S]*?\?>/gi, "")
      .replace(/<!doctype[\s\S]*?>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
      .replace(/<foreignObject\b[^>]*\/>/gi, "")
      .replace(/<image\b[\s\S]*?>/gi, "")
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
      .replace(/<title[\s\S]*?<\/title>/gi, "")
      .replace(/<desc[\s\S]*?<\/desc>/gi, "")
      .replace(/<text[\s\S]*?<\/text>/gi, "")
      .replace(/^\s*<svg\b[^>]*>/i, "")
      .replace(/<\/svg>\s*$/i, "")
      .replace(/<\/?switch\b[^>]*>/gi, "")
      .replace(/\s+[a-z][\w-]*:[\w-]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\s+[a-z][\w-]*:[\w-]+\s*=\s*'[^']*'/gi, "")
      .replace(/<\/?[a-z][\w-]*:[\w-]+\b[^>]*>/gi, "")
      .replace(/\s+style\s*=\s*"[^"]*"/gi, "")
      .replace(/\s+style\s*=\s*'[^']*'/gi, "")
      .replace(/\s+fill\s*=\s*"(?!none\b)[^"]*"/gi, "")
      .replace(/\s+fill\s*=\s*'(?!none\b)[^']*'/gi, "")
      .replace(/\s+stroke\s*=\s*"[^"]*"/gi, "")
      .replace(/\s+stroke\s*=\s*'[^']*'/gi, "")
      .trim();
  }

  function safeSvgColor(value, fallback = "#f7f4df") {
    const text = String(value || "").trim();
    return /^#[0-9a-f]{3,8}$/i.test(text) ? text : fallback;
  }

  function poiIconStyleConfig(style = state.poiIconStyle) {
    if (style === "circle-marker") {
      return {
        style: "circle-marker",
        foreground: "#050706",
        circleStroke: "#050706",
        circleStrokeWidth: 0.045,
        circleRadius: 0.44,
        glyphScale: 0.82,
        outlineScale: 0,
      };
    }
    if (style === "google-circle") {
      return {
        style: "google-circle",
        foreground: "#ffffff",
        circleStroke: "#ffffff",
        circleStrokeWidth: 0.055,
        circleRadius: 0.42,
        glyphScale: 0.7,
        outlineScale: 0,
      };
    }
    return {
      style: "outlined-glyph",
      foreground: null,
      outline: "#ffffff",
      glyphScale: 0.72,
      outlineScale: 1.16,
    };
  }

  function composePoiBadgeSvg(key, rawSvg, size = 96, style = state.poiIconStyle) {
    const [minX, minY, width, height] = parseSvgViewBox(rawSvg);
    const config = poiIconStyleConfig(style);
    const targetSize = size * config.glyphScale;
    const scale = targetSize / Math.max(width, height);
    const drawX = (size - (width * scale)) / 2;
    const drawY = (size - (height * scale)) / 2;
    const fill = safeSvgColor(poiIconColor(key));
    const foreground = safeSvgColor(config.foreground || fill);
    const inner = svgInnerMarkup(rawSvg);
    const circle = config.circleRadius
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * config.circleRadius}" fill="${fill}" stroke="${config.circleStroke}" stroke-width="${Math.max(2, Math.round(size * config.circleStrokeWidth))}"/>`
      : "";
    const outlineScale = config.outlineScale || 0;
    const outlineDraw = outlineScale > 0
      ? `<g class="oiab-poi-outline" transform="translate(${size / 2} ${size / 2}) scale(${outlineScale}) translate(${-size / 2} ${-size / 2}) translate(${drawX} ${drawY}) scale(${scale}) translate(${-minX} ${-minY})">
        ${inner}
      </g>`
      : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <style>
        .oiab-poi-outline, .oiab-poi-outline * {
          color: ${config.outline || "#ffffff"};
          fill: ${config.outline || "#ffffff"};
          stroke: ${config.outline || "#ffffff"};
        }
        .oiab-poi-glyph, .oiab-poi-glyph * {
          color: ${foreground};
          fill: ${foreground};
          stroke: ${foreground};
        }
        .oiab-poi-outline [fill="none"], .oiab-poi-outline [fill="None"], .oiab-poi-outline [fill="NONE"],
        .oiab-poi-glyph [fill="none"], .oiab-poi-glyph [fill="None"], .oiab-poi-glyph [fill="NONE"] {
          fill: none;
        }
      </style>
      ${circle}
      ${outlineDraw}
      <g class="oiab-poi-glyph" transform="translate(${drawX} ${drawY}) scale(${scale}) translate(${-minX} ${-minY})">
        ${inner}
      </g>
    </svg>`;
  }

  function fallbackPoiGlyphSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <path d="M50 8c-17.7 0-32 14.1-32 31.5 0 23.6 32 52.5 32 52.5s32-28.9 32-52.5C82 22.1 67.7 8 50 8Zm0 45.5c-8.1 0-14.7-6.4-14.7-14.3S41.9 24.9 50 24.9s14.7 6.4 14.7 14.3S58.1 53.5 50 53.5Z"/>
    </svg>`;
  }

  async function setMapImage(id, image, options = { pixelRatio: 2 }) {
    if (!state.map) return;
    if (state.map.hasImage(id) && typeof state.map.updateImage === "function") {
      state.map.updateImage(id, image);
      return;
    }
    if (state.map.hasImage(id)) state.map.removeImage(id);
    state.map.addImage(id, image, options);
  }

  async function addPoiBadgeImageFromSvg(id, key, rawSvg, size = 96) {
    const svg = composePoiBadgeSvg(key, rawSvg || fallbackPoiGlyphSvg(), size);
    const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const image = new Image();
    image.decoding = "async";
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    await setMapImage(id, context.getImageData(0, 0, size, size), { pixelRatio: 2 });
  }

  async function loadPoiBadgeImage(id, key, size = 96, force = false) {
    if (!state.map || (!force && state.map.hasImage(id))) return;
    if (pendingMapImageLoads.has(id)) return pendingMapImageLoads.get(id);
    const task = (async () => {
      try {
        let rawSvg = fallbackPoiGlyphSvg();
        try {
          const url = poiIconUrl(key);
          const response = await fetch(url, { cache: "no-cache" });
          if (!response.ok) throw new Error(`${url} returned ${response.status}`);
          rawSvg = await response.text();
        } catch (error) {
          if (window.OIAB_DEBUG_MAPS && !warnedPoiIconFallbacks.has(key)) {
            warnedPoiIconFallbacks.add(key);
            console.warn("[OIAB Maps v2] POI icon using fallback", key, error);
          }
        }
        await addPoiBadgeImageFromSvg(id, key, rawSvg, size);
      } finally {
        pendingMapImageLoads.delete(id);
      }
    })();
    pendingMapImageLoads.set(id, task);
    return task;
  }

  async function loadPoiImages() {
    const tasks = POI_ICON_KEYS.map((key) =>
      loadPoiBadgeImage(poiImageId(key), key).catch((error) => {
        console.warn("[OIAB Maps v2] POI icon failed", key, error);
      }));
    await Promise.all(tasks);
  }

  async function refreshPoiIconStyle() {
    state.poiIconStyle = readPoiIconStyle();
    const tasks = POI_ICON_KEYS.map((key) =>
      loadPoiBadgeImage(poiImageId(key), key, 96, true).catch((error) => {
        console.warn("[OIAB Maps v2] POI icon refresh failed", key, error);
      }));
    await Promise.all(tasks);
    applyPoiIconLayerLayout();
    renderPoiKindFilterPanel();
    if ($("legendModal") && !$("legendModal").hidden && $("legendContent")) {
      $("legendContent").innerHTML = legendMarkup();
    }
  }

  async function loadOverlayImages() {
    if (addGeneratedWildfireFlameIcon()) return;
    await Promise.all([
      loadSvgMapImage(overlayIconImageId("wildfire-flame"), "/maps-v2/icons/overlay-flame.svg", 112, { sdf: true }).catch((error) => {
        console.warn("[OIAB Maps v2] overlay icon failed", "wildfire-flame", error);
      }),
    ]);
  }

  function poiIconUrl(key) {
    const iconKey = String(key || "waypoint").replace(/[^a-z0-9_-]+/gi, "-");
    const asset = NOUN_POI_ICON_PATHS[iconKey] || NOUN_POI_ICON_PATHS.waypoint || "waypoint";
    return `/maps-v2/icons/noun/${asset}.svg`;
  }

  function handleStyleImageMissing(event) {
    const imageId = String(event?.id || "");
    if (imageId.startsWith(POI_IMAGE_PREFIX)) {
      const key = imageId.slice(POI_IMAGE_PREFIX.length) || "waypoint";
      loadPoiBadgeImage(imageId, key).catch((error) => {
        console.warn("[OIAB Maps v2] missing POI icon fallback failed", imageId, error);
      });
      return;
    }
    if (event.id !== overlayIconImageId("wildfire-flame")) return;
    if (addGeneratedWildfireFlameIcon(event.id)) return;
    loadSvgMapImage(event.id, "/maps-v2/icons/overlay-flame.svg", 112, { sdf: true }).catch((error) => {
      console.warn("[OIAB Maps v2] missing overlay icon failed", event.id, error);
    });
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
    if (state.map.getLayer("oiab-poi-icon-bg")) state.map.removeLayer("oiab-poi-icon-bg");
    const beforeId = state.map.getLayer("oiab-travel-poi-labels") ? "oiab-travel-poi-labels" : undefined;
    const poiOverlay = mapDetailOverlayState("map_detail_pois");
    state.map.addLayer({
      id: "oiab-poi-icons",
      type: "symbol",
      source: sourceId,
      "source-layer": "pois",
      minzoom: 13,
      filter: combineMapFilters(
        ["in", basePoiKindExpression(), ["literal", Object.keys(MAP_KIND_TO_POI_ICON)]],
        poiKindFilterExpression(basePoiIconKeyExpression()),
      ),
      layout: {
        "icon-image": mapPoiMatchExpression(basePoiKindExpression(), MAP_KIND_TO_POI_ICON, "waypoint", poiImageId),
        "icon-size": unifiedPoiBadgeIconSize(),
        "icon-anchor": poiIconAnchor(),
        "icon-offset": poiIconOffset(),
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-optional": false,
        "icon-padding": 2,
        "visibility": poiOverlay?.enabled === false ? "none" : "visible",
      },
      paint: {
        "icon-opacity": overlayOpacity(poiOverlay || { opacity: 1 }),
      },
    }, beforeId);
  }

  function applyBasePoiOverlayState() {
    if (!state.map?.getLayer("oiab-poi-icons")) return;
    const poiOverlay = mapDetailOverlayState("map_detail_pois") || { enabled: true, opacity: 1 };
    try {
      state.map.setLayoutProperty("oiab-poi-icons", "visibility", poiOverlay.enabled === false ? "none" : "visible");
      state.map.setPaintProperty("oiab-poi-icons", "icon-opacity", overlayOpacity(poiOverlay));
    } catch (error) {
      console.warn("[OIAB Maps v2] failed to apply base POI overlay state", error);
    }
  }

  function applySavedDataOverlayState() {
    if (!state.map) return;
    const routeOverlay = savedDataOverlayState("saved_data_routes") || { enabled: true, opacity: 1 };
    const poiOverlay = savedDataOverlayState("saved_data_pois") || { enabled: true, opacity: 1 };
    const routeVisible = routeOverlay.enabled === false ? "none" : "visible";
    const poiVisible = poiOverlay.enabled === false ? "none" : "visible";
    try {
      if (state.map.getLayer("overland-track-lines")) {
        state.map.setLayoutProperty("overland-track-lines", "visibility", routeVisible);
        state.map.setPaintProperty("overland-track-lines", "line-opacity", overlayOpacity(routeOverlay));
      }
      if (state.map.getLayer("overland-waypoint-icons")) {
        state.map.setLayoutProperty("overland-waypoint-icons", "visibility", poiVisible);
        state.map.setPaintProperty("overland-waypoint-icons", "icon-opacity", overlayOpacity(poiOverlay));
      }
      if (state.map.getLayer("overland-waypoint-labels")) {
        state.map.setLayoutProperty("overland-waypoint-labels", "visibility", poiVisible);
        state.map.setPaintProperty("overland-waypoint-labels", "text-opacity", overlayOpacity(poiOverlay));
      }
    } catch (error) {
      console.warn("[OIAB Maps v2] failed to apply saved data overlay state", error);
    }
  }

  function applyOverlayLayerOrdering() {
    if (!state.map) return;
    const overlays = normalizeOverlayRegistry(state.overlayRegistry).filter((overlay) => overlay.available && overlay.enabled);
    const managedStack = [];
    const seen = new Set();
    // The overlay list is a visual stack: first row is topmost. MapLibre draws
    // later layers above earlier layers, so rebuild the managed layer stack bottom-up.
    for (const overlay of overlays.slice().reverse()) {
      for (const layerId of overlayLayerIds(overlay)) {
        if (seen.has(layerId) || !state.map.getLayer(layerId)) continue;
        seen.add(layerId);
        managedStack.push(layerId);
      }
    }
    for (const layerId of managedStack) {
      try {
        state.map.moveLayer(layerId);
      } catch (error) {
        console.warn("[OIAB Maps v2] failed to order overlay layer", layerId, error);
      }
    }
  }

  function applyLayerFilter(layerId, filter) {
    if (!state.map?.getLayer(layerId)) return;
    try {
      state.map.setFilter(layerId, filter);
    } catch (error) {
      console.warn("[OIAB Maps v2] failed to apply POI kind filter", layerId, error);
    }
  }

  function applyPoiKindFilters() {
    applyLayerFilter("oiab-poi-icons", combineMapFilters(
      ["in", basePoiKindExpression(), ["literal", Object.keys(MAP_KIND_TO_POI_ICON)]],
      poiKindFilterExpression(basePoiIconKeyExpression()),
    ));
    applyLayerFilter("overland-waypoint-icons", combineMapFilters(
      pointGeometryFilter(),
      poiKindFilterExpression(["coalesce", ["get", "marker_icon_key"], "waypoint"]),
    ));

    for (const overlay of normalizeOverlayRegistry(state.overlayRegistry)) {
      const style = overlay.style || overlay.category || "";
      const variants = [""].concat((overlay.region_sources || []).map((region) => region.region_id || region.region_name || "region"));
      for (const variant of variants) {
        if (style === "historic_places") {
          applyLayerFilter(overlayLayerId(overlay, "historic-point-icon", variant), combineMapFilters(
            pointGeometryFilter(),
            poiKindFilterExpression(["literal", "museum"]),
          ));
        } else if (style === "opencaching") {
          applyLayerFilter(overlayLayerId(overlay, "opencaching-point-icon", variant), combineMapFilters(
            pointGeometryFilter(),
            poiKindFilterExpression(["literal", "waypoint"]),
          ));
        } else if (style === "ridb_recreation") {
          applyLayerFilter(overlayLayerId(overlay, "ridb-point-icon", variant), combineMapFilters(
            pointGeometryFilter(),
            poiKindFilterExpression(ridbPointIconExpression((key) => key)),
          ));
        } else if (style === "campflare_campgrounds" || style === "campflare_campsites" || style === "campflare_land_pois") {
          applyLayerFilter(overlayLayerId(overlay, "campflare-marker-icon", variant), combineMapFilters(
            pointGeometryFilter(),
            poiKindFilterExpression(campflarePointIconExpression(style, (key) => key)),
          ));
        }
      }
    }
    applyBasePoiOverlayState();
  }

  function setPoiKindFilter(keys) {
    state.poiKindFilter = new Set(keys.filter((key) => POI_ICON_KEYS.includes(key)));
    savePoiKindFilter();
    renderPoiKindFilterPanel();
    applyPoiKindFilters();
    if ($("searchInput")?.value.trim()) runMapSearch($("searchInput").value);
  }

  function renderPoiKindFilterPanel() {
    const list = $("poiFilterList");
    if (!list) return;
    const selectedCount = state.poiKindFilter.size;
    list.innerHTML = POI_KIND_FILTER_OPTIONS.map(([key, label]) => `
      <label class="omv2-poi-filter-item">
        <input type="checkbox" value="${escapeHtml(key)}" ${state.poiKindFilter.has(key) ? "checked" : ""}>
        <span
          class="legend-poi legend-poi--${escapeHtml(state.poiIconStyle)}"
          style="--poi-bg:${escapeHtml(poiIconColor(key))};--poi-url:url('${escapeHtml(poiIconUrl(key))}')"
        >
          <span class="legend-poi-glyph" aria-hidden="true"></span>
        </span>
        <span>${escapeHtml(label)}</span>
      </label>
    `).join("");
    const heading = $("poiFilterSummary");
    if (heading) heading.textContent = `${selectedCount}/${POI_ICON_KEYS.length} kinds`;
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
    return [
      ...mapDetailOverlays(),
      ...savedDataOverlays(),
      ...(Array.isArray(registry?.overlays) ? registry.overlays : []),
    ]
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
      temperature_forecast: temperatureSettings(),
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

  function isTemperatureOverlay(overlay) {
    return overlay?.id === "temperature_forecast" || overlay?.source_type === "nws_temperature";
  }

  function temperatureSettings() {
    const product = String(state.temperatureForecast?.product || "temp");
    const period = String(state.temperatureForecast?.period || "now");
    return { product, period };
  }

  function setTemperatureSettings(next) {
    state.temperatureForecast = {
      ...temperatureSettings(),
      ...(next || {}),
    };
    localStorage.setItem(TEMPERATURE_FORECAST_KEY, JSON.stringify(state.temperatureForecast));
  }

  function temperatureTileTemplate(template) {
    const settings = temperatureSettings();
    const separator = String(template || "").includes("?") ? "&" : "?";
    const cacheBust = `${settings.product}-${settings.period}`;
    return `${template}${separator}product=${encodeURIComponent(settings.product)}&period=${encodeURIComponent(settings.period)}&v=${encodeURIComponent(cacheBust)}`;
  }

  function scheduleTemperatureReload() {
    clearTimeout(state.temperatureDebounce);
    state.temperatureDebounce = setTimeout(() => {
      boot().catch((error) => toast(error.message || "Temperature overlay reload failed.", true));
    }, 350);
  }

  async function loadTemperatureOptions() {
    if (state.temperatureOptions) return state.temperatureOptions;
    try {
      state.temperatureOptions = await fetchJson("/api/maps/overlays/temperature/options", { ok: false, products: [], periods: [], legend: [] });
    } catch (error) {
      state.temperatureOptions = { ok: false, products: [], periods: [], legend: [], error: error.message };
    }
    return state.temperatureOptions;
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

  function mvumRouteClassExpression() {
    const routeCode = ["to-string", ["coalesce", ["get", "route_type"], ["get", "route_type_label"], ["get", "type"], ""]];
    const bucket = ["to-string", ["coalesce", ["get", "style_bucket"], ""]];
    return [
      "case",
      ["in", bucket, ["literal", ["restricted", "closed"]]], "restricted",
      ["in", routeCode, ["literal", ["13", "14"]]], "restricted",
      ["in", bucket, ["literal", ["atv_only"]]], "atv_only",
      ["in", routeCode, ["literal", ["8", "17"]]], "atv_only",
      ["in", bucket, ["literal", ["motorcycle_only"]]], "motorcycle_only",
      ["in", routeCode, ["literal", ["9", "18"]]], "motorcycle_only",
      ["in", bucket, ["literal", ["high_clearance"]]], "high_clearance",
      ["in", routeCode, ["literal", ["5", "19"]]], "high_clearance",
      ["in", bucket, ["literal", ["seasonal"]]], "seasonal",
      ["in", routeCode, ["literal", ["3", "4", "10", "11"]]], "seasonal",
      ["in", bucket, ["literal", ["trail"]]], "trail",
      ["in", routeCode, ["literal", ["7", "15"]]], "trail",
      ["in", routeCode, ["literal", ["6", "12", "16"]]], "special",
      "open_motorized",
    ];
  }

  function mvumLinePaint(opacity, routeClass = "", part = "main") {
    const colorFor = (key) => MVUM_LINE_STYLES[key]?.color || MVUM_LINE_STYLES.unknown.color;
    const style = MVUM_LINE_STYLES[routeClass] || {};
    const isCasing = part === "casing";
    const paint = {
      "line-color": isCasing ? (style.casing || colorFor(routeClass)) : routeClass ? colorFor(routeClass) : [
        "match",
        mvumRouteClassExpression(),
        "restricted", colorFor("restricted"),
        "closed", colorFor("closed"),
        "seasonal", colorFor("seasonal"),
        "high_clearance", colorFor("high_clearance"),
        "atv_only", colorFor("atv_only"),
        "motorcycle_only", colorFor("motorcycle_only"),
        "trail", colorFor("trail"),
        "special", colorFor("special"),
        "open_motorized", colorFor("open_motorized"),
        colorFor("unknown"),
      ],
      "line-width": isCasing
        ? ["interpolate", ["linear"], ["zoom"], 8, 2.2, 12, 3.6, 16, 6.2]
        : ["interpolate", ["linear"], ["zoom"], 8, 1.1, 12, 1.8, 16, 3.1],
      "line-opacity": opacity,
    };
    if (!isCasing && routeClass && MVUM_LINE_STYLES[routeClass]?.dash) paint["line-dasharray"] = MVUM_LINE_STYLES[routeClass].dash;
    return paint;
  }

  function mvumRouteLineLayers(overlay, sourceId, sourceLayer = null, variant = "", opacity = 1) {
    const minzoom = Number(overlay.minzoom ?? overlay.metadata?.minzoom ?? 0);
    const maxzoom = Number(overlay.maxzoom ?? overlay.metadata?.maxzoom ?? 22);
    const classes = ["open_motorized", "high_clearance", "seasonal", "trail", "atv_only", "motorcycle_only", "special", "restricted"];
    const layers = [];
    for (const routeClass of classes) {
      const style = MVUM_LINE_STYLES[routeClass] || {};
      const filter = ["all",
        ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
        ["==", mvumRouteClassExpression(), routeClass],
      ];
      if (style.casing) {
        const casingLayer = {
          id: overlayLayerId(overlay, `mvum-line-${routeClass}-casing`, variant),
          type: "line",
          source: sourceId,
          minzoom,
          maxzoom,
          filter,
          paint: mvumLinePaint(opacity, routeClass, "casing"),
        };
        if (sourceLayer) casingLayer["source-layer"] = sourceLayer;
        layers.push(casingLayer);
      }
      const mainLayer = {
        id: overlayLayerId(overlay, `mvum-line-${routeClass}`, variant),
        type: "line",
        source: sourceId,
        minzoom,
        maxzoom,
        filter,
        paint: mvumLinePaint(opacity, routeClass),
      };
      if (sourceLayer) mainLayer["source-layer"] = sourceLayer;
      layers.push(mainLayer);
    }
    return layers;
  }

  function mvumAtvSymbolLayer(overlay, sourceId, sourceLayer = null, variant = "", opacity = 1) {
    const layer = {
      id: overlayLayerId(overlay, "mvum-atv-label", variant),
      type: "symbol",
      source: sourceId,
      minzoom: Math.max(Number(overlay.minzoom ?? overlay.metadata?.minzoom ?? 0), 11),
      maxzoom: Number(overlay.maxzoom ?? overlay.metadata?.maxzoom ?? 22),
      filter: ["all",
        ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
        ["==", mvumRouteClassExpression(), "atv_only"],
      ],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 340,
        "text-field": "ATV",
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 16, 12],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
      },
      paint: {
        "text-color": "#0b2816",
        "text-halo-color": "#a7f3d0",
        "text-halo-width": 1.4,
        "text-opacity": opacity,
      },
    };
    if (sourceLayer) layer["source-layer"] = sourceLayer;
    return layer;
  }

  function routeLinePaint() {
    return {
      "line-color": ["coalesce", ["get", "color"], ["match", ["get", "road_type"], "interstate", "#ff4f2e", "main_road", "#ff8a2a", "street", "#ffffff", "gravel", "#b08d57", "dirt", "#8a6a42", "high_clearance", "#f97316", "trail", "#555555", "#a855f7"]],
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

  function pointIconOverlayLayer(overlay, sourceId, options = {}, sourceLayer = null, variant = "") {
    const opacity = overlayOpacity(overlay);
    const minzoom = Number(overlay.minzoom ?? overlay.metadata?.minzoom ?? 0);
    const maxzoom = Number(overlay.maxzoom ?? overlay.metadata?.maxzoom ?? 22);
    const iconKeyExpression = options.iconKeyExpression || (options.iconKey ? ["literal", options.iconKey] : null);
    const layer = {
      id: overlayLayerId(overlay, options.suffix || "point-icon", variant),
      type: "symbol",
      source: sourceId,
      minzoom,
      maxzoom,
      filter: combineMapFilters(pointGeometryFilter(), iconKeyExpression ? poiKindFilterExpression(iconKeyExpression) : null),
      layout: {
        "icon-image": options.iconImage,
        "icon-size": options.iconSize || unifiedPoiBadgeIconSize(),
        "icon-anchor": poiIconAnchor(),
        "icon-offset": poiIconOffset(),
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-optional": false,
        "icon-padding": 2,
      },
      paint: {
        "icon-opacity": opacity,
      },
    };
    if (options.iconColor) layer.paint["icon-color"] = options.iconColor;
    if (options.iconHaloColor) layer.paint["icon-halo-color"] = options.iconHaloColor;
    if (options.iconHaloWidth !== undefined) layer.paint["icon-halo-width"] = options.iconHaloWidth;
    if (options.iconHaloBlur !== undefined) layer.paint["icon-halo-blur"] = options.iconHaloBlur;
    if (sourceLayer) layer["source-layer"] = sourceLayer;
    return layer;
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
        return [pointIconOverlayLayer(overlay, sourceId, {
          suffix: "hotspots",
          iconImage: overlayIconImageId("wildfire-flame"),
          iconSize: ["interpolate", ["linear"], ["zoom"], 3, 0.12, 8, 0.2, 13, 0.32, 17, 0.44],
          iconColor: "#e11d1d",
          iconHaloColor: "rgba(255, 244, 214, 0.94)",
          iconHaloWidth: ["interpolate", ["linear"], ["zoom"], 3, 0.35, 10, 0.65, 16, 1.0],
          iconHaloBlur: 0.25,
        }, null, variant)];
      }
      if (style === "ridb_recreation") {
        return [pointIconOverlayLayer(overlay, sourceId, {
          suffix: "ridb-point-icon",
          iconImage: ridbPointIconExpression(),
          iconKeyExpression: ridbPointIconExpression((key) => key),
        }, null, variant)];
      }
      if (style === "historic_places") {
        return [
          {
            id: overlayLayerId(overlay, "historic-fill", variant),
            type: "fill",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: {
              "fill-color": "#9a6a3d",
              "fill-opacity": opacity * 0.18,
            },
          },
          {
            id: overlayLayerId(overlay, "historic-line", variant),
            type: "line",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
            paint: {
              "line-color": "#68411f",
              "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 10, 1.2, 15, 2.2],
              "line-opacity": opacity * 0.88,
            },
          },
          staticPoiBadgeLayer(overlay, sourceId, "museum", { suffix: "historic-point-icon" }, null, variant),
        ];
      }
      if (style === "opencaching") {
        return [staticPoiBadgeLayer(overlay, sourceId, "waypoint", { suffix: "opencaching-point-icon" }, null, variant)];
      }
      if (style === "campflare_campgrounds" || style === "campflare_campsites" || style === "campflare_land_pois") {
        return [
          {
            id: overlayLayerId(overlay, "campflare-marker-icon", variant),
            type: "symbol",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: combineMapFilters(pointGeometryFilter(), poiKindFilterExpression(campflarePointIconExpression(style, (key) => key))),
            layout: {
              "icon-image": campflarePointIconExpression(style),
              "icon-size": unifiedPoiBadgeIconSize(),
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "icon-optional": false,
              "icon-padding": 2,
            },
            paint: {
              "icon-opacity": opacity,
            },
          },
        ];
      }
      if (style === "campflare_public_lands") {
        return [
          {
            id: overlayLayerId(overlay, "campflare-land-fill", variant),
            type: "fill",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: {
              "fill-color": "#9fce78",
              "fill-opacity": opacity * 0.26,
            },
          },
          {
            id: overlayLayerId(overlay, "campflare-land-line", variant),
            type: "line",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
            paint: {
              "line-color": "#517c31",
              "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 12, 1.6, 16, 2.2],
              "line-opacity": opacity,
            },
          },
          staticPoiBadgeLayer(overlay, sourceId, "waypoint", { suffix: "campflare-land-point" }, null, variant),
        ];
      }
      if (style === "campflare_notices") {
        return [
          {
            id: overlayLayerId(overlay, "campflare-notice-fill", variant),
            type: "fill",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: {
              "fill-color": ["match", ["get", "kind"], "fire", "#ef4444", "closure", "#f97316", "weather", "#38bdf8", "#facc15"],
              "fill-opacity": opacity * 0.3,
            },
          },
          staticPoiBadgeLayer(overlay, sourceId, "waypoint", { suffix: "campflare-notice-point" }, null, variant),
        ];
      }
      if (style === "stream_gauges") {
        return [staticPoiBadgeLayer(overlay, sourceId, "water", { suffix: "stream-gauge" }, null, variant)];
      }
      if (style === "drought_monitor") {
        return [
          {
            id: overlayLayerId(overlay, "drought-fill", variant),
            type: "fill",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: {
              "fill-color": ["match", ["to-string", ["coalesce", ["get", "dm"], ["get", "DM"], ["get", "drought_class"], ["get", "class"]]], "D0", "#fff3b0", "D1", "#facc15", "D2", "#f97316", "D3", "#dc2626", "D4", "#7f1d1d", "#facc15"],
              "fill-opacity": opacity * 0.42,
            },
          },
          {
            id: overlayLayerId(overlay, "drought-line", variant),
            type: "line",
            source: sourceId,
            minzoom,
            maxzoom,
            filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
            paint: {
              "line-color": "#7c2d12",
              "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 10, 1.4, 15, 2],
              "line-opacity": opacity,
            },
          },
        ];
      }
      if (style === "lightning_recent") {
        return [staticPoiBadgeLayer(overlay, sourceId, "waypoint", { suffix: "lightning" }, null, variant)];
      }
      if (style === "mvum_roads" || style === "mvum_trails" || overlay.category === "mvum") {
        return [
          ...mvumRouteLineLayers(overlay, sourceId, null, variant, opacity),
          mvumAtvSymbolLayer(overlay, sourceId, null, variant, opacity),
        ];
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
        staticPoiBadgeLayer(overlay, sourceId, "waypoint", { suffix: "point" }, null, variant),
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
      if (style === "padus_public_lands") {
        return [
          {
            id: overlayLayerId(overlay, "padus-fill", variant),
            type: "fill",
            source: sourceId,
            "source-layer": pmtilesSourceLayer,
            minzoom,
            maxzoom,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: {
              "fill-color": ["match", ["to-string", ["coalesce", ["get", "manager_type"], ["get", "agency"], ["get", "owner_type"]]], "Federal", "#7fbf7b", "State", "#b7d99a", "Local", "#c7e9b4", "Private", "#d8c9ef", "#9fcb8d"],
              "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, opacity * 0.16, 8, opacity * 0.28, 12, opacity * 0.42],
            },
          },
          {
            id: overlayLayerId(overlay, "padus-line", variant),
            type: "line",
            source: sourceId,
            "source-layer": pmtilesSourceLayer,
            minzoom: Math.max(7, minzoom),
            maxzoom,
            filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
            paint: {
              "line-color": "#39613b",
              "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.7, 12, 1.4, 16, 2.2],
              "line-opacity": opacity,
            },
          },
        ];
      }
      if (style === "public_lands_blm" || overlay.category === "public_lands") {
        return blmOverlayLayers(overlay, sourceId, pmtilesSourceLayer);
      }
      if (style === "nhd_water") {
        return [
          {
            id: overlayLayerId(overlay, "nhd-water-fill", variant),
            type: "fill",
            source: sourceId,
            "source-layer": pmtilesSourceLayer,
            minzoom,
            maxzoom,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: {
              "fill-color": "#79d4e5",
              "fill-opacity": opacity * 0.36,
            },
          },
          {
            id: overlayLayerId(overlay, "nhd-water-line", variant),
            type: "line",
            source: sourceId,
            "source-layer": pmtilesSourceLayer,
            minzoom,
            maxzoom,
            filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
            paint: {
              "line-color": ["case", ["==", ["to-string", ["coalesce", ["get", "flow_type"], ["get", "fcode"]]], "intermittent"], "#55c7df", "#159ec6"],
              "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 1.1, 15, 2.2],
              "line-opacity": opacity,
            },
          },
        ];
      }
      if (style === "connectivity_coverage" || style === "parcel_boundaries") {
        const color = style === "parcel_boundaries" ? "#fbbf24" : "#38bdf8";
        return [
          {
            id: overlayLayerId(overlay, "provider-line", variant),
            type: "line",
            source: sourceId,
            "source-layer": pmtilesSourceLayer,
            minzoom,
            maxzoom,
            filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
            paint: { "line-color": color, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 14, 2.2], "line-opacity": opacity },
          },
          {
            id: overlayLayerId(overlay, "provider-fill", variant),
            type: "fill",
            source: sourceId,
            "source-layer": pmtilesSourceLayer,
            minzoom,
            maxzoom,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: { "fill-color": color, "fill-opacity": opacity * 0.14 },
          },
        ];
      }
      if (style === "mvum_roads" || style === "mvum_trails" || overlay.category === "mvum") {
        return [
          ...mvumRouteLineLayers(overlay, sourceId, pmtilesSourceLayer, variant, opacity),
          mvumAtvSymbolLayer(overlay, sourceId, pmtilesSourceLayer, variant, opacity),
        ];
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
        staticPoiBadgeLayer(overlay, sourceId, "waypoint", { suffix: "point" }, pmtilesSourceLayer, variant),
      ];
    }
    return [];
  }

  function overlayLayerIds(overlay) {
    if (overlay.type === "map_detail") {
      const ids = (state.mapDetailLayersByOverlay?.[overlay.id] || []).map((layer) => layer.id);
      // Base POIs are rendered by a runtime symbol layer after the PMTiles style loads
      // so they can use OIAB's unified icon renderer. Keep that runtime layer attached
      // to the Map POIs overlay; otherwise routes/roads can be reordered above it.
      if (overlay.id === "map_detail_pois") ids.push("oiab-poi-icons");
      return ids;
    }
    if (overlay.type === "saved_data") {
      if (overlay.id === "saved_data_routes") return ["overland-track-lines"];
      if (overlay.id === "saved_data_pois") return ["overland-waypoint-icons", "overland-waypoint-labels"];
      return [];
    }
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

  function appendOverlaySourcesAndLayers(style, overlays, mapDetailLayersByOverlay = {}) {
    if (!overlays.length) return;
    style.sources = style.sources || {};
    style.layers = Array.isArray(style.layers) ? style.layers : [];
    const overlayLayers = [];
    // The layer menu is a visual stack: first row is topmost. MapLibre draws
    // later layers above earlier layers, so build render layers bottom-up.
    for (const overlay of overlays.slice().reverse()) {
      if (overlay.type === "map_detail") {
        const layers = (mapDetailLayersByOverlay[overlay.id] || []).map((layer) => applyOverlayOpacity(layer, overlayOpacity(overlay)));
        overlayLayers.push(...layers);
        continue;
      }
      if (overlay.type === "saved_data") continue;
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
        let tiles = overlay.cached_tile_url_template
          ? [`${overlay.cached_tile_url_template}?offline_only=${state.overlayRegistry?.offline_regions_only ? "1" : "0"}`]
          : Array.isArray(overlay.tiles) && overlay.tiles.length ? overlay.tiles : sourceUrl ? [sourceUrl] : [];
        if (isTemperatureOverlay(overlay)) {
          tiles = tiles.map((tile) => temperatureTileTemplate(tile));
        }
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
    const mapDetailLayersByOverlay = {};
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
      const mapDetailGroup = mapDetailLayerGroup(layer);
      const copy = clone(layer);
      copy.source = activeSourceId;
      if (mapDetailGroup) {
        copy.id = mapDetailLayerId(mapDetailGroup, layer.id);
        mapDetailLayersByOverlay[mapDetailGroup] = mapDetailLayersByOverlay[mapDetailGroup] || [];
        mapDetailLayersByOverlay[mapDetailGroup].push(copy);
        continue;
      }
      copy.id = layer.id;
      layers.push(copy);
    }
    state.mapDetailLayersByOverlay = mapDetailLayersByOverlay;
    style.sources = sources;
    style.layers = layers;
    appendOverlaySourcesAndLayers(style, selection.overlays || [], mapDetailLayersByOverlay);
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
    state.mapErrorsDismissed = false;
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
    state.mapErrorsDismissed = false;
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
    node.hidden = state.mapErrorsDismissed || state.tileErrors.length === 0;
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

  function mapTheme() {
    return localStorage.getItem(MAP_THEME_KEY) === "dark" ? "dark" : "light";
  }

  function applyMapTheme() {
    const root = $("mapRoot");
    if (root) root.dataset.mapTheme = mapTheme();
  }

  function collapseAttribution() {
    requestAnimationFrame(() => {
      document.querySelectorAll(".maplibregl-ctrl-attrib").forEach((node) => {
        node.classList.remove("maplibregl-compact-show");
      });
    });
  }

  function locationHeading(location = {}) {
    const candidates = [
      location.heading_deg,
      location.course_deg,
      location.bearing,
      location.stable?.heading_deg,
      location.stable?.course_deg,
    ];
    for (const value of candidates) {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) return ((numberValue % 360) + 360) % 360;
    }
    return null;
  }

  function applyFollowCamera(location, immediate = false) {
    if (!state.map || !state.follow || !location || !validCoord(location.lat, location.lon)) return;
    const speed = Number(location.speed_mph ?? location.stable?.speed_mph ?? 0);
    const heading = locationHeading(location);
    const options = {
      center: [Number(location.lon), Number(location.lat)],
      zoom: Math.max(state.map.getZoom(), 15),
      pitch: FOLLOW_PITCH,
      duration: immediate ? 0 : 650,
      essential: true,
    };
    if (heading !== null && speed >= FOLLOW_MIN_HEADING_SPEED_MPH) {
      options.bearing = heading;
    }
    state.map.easeTo(options);
  }

  function setFollowMode(enabled) {
    state.follow = Boolean(enabled);
    $("followToggle")?.classList.toggle("is-active", state.follow);
    if (!state.map) return;
    if (state.follow) {
      applyFollowCamera(state.currentLocation, true);
    } else {
      state.map.easeTo({ pitch: 0, bearing: 0, duration: 500, essential: true });
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
    collapseAttribution();
    state.map.on("error", logMapError);
    state.map.on("styleimagemissing", handleStyleImageMissing);
    state.map.on("moveend", saveMapView);
    state.map.on("load", async () => {
      collapseAttribution();
      applyMapTheme();
      applyBuildingDisplayMode();
      await loadPoiImages();
      await loadOverlayImages();
      addMilitaryHatchLayer();
      addBasePoiIconLayer();
      bindOverlayFeaturePopups();
      addOverlandSources();
      applyPoiKindFilters();
      loadOverlandData();
      pollLocation();
      pollTrack();
      maybeFitToSelection(state.packSelection);
      state.dataTimer = setInterval(loadOverlandData, 10000);
      state.locationTimer = setInterval(pollLocation, 1000);
      state.trackTimer = setInterval(pollTrack, 4000);
      state.packTimer = setInterval(checkPackChange, 30000);
    });
    state.map.on("idle", collapseAttribution);
    state.map.on("click", (event) => {
      if (state.offlineRegionDraw) return;
      if (state.inspectTile) {
        inspectTileAt(event.lngLat);
        return;
      }
      if (state.temperaturePickMode) {
        state.temperaturePickMode = false;
        openTemperatureForecast(event.lngLat);
        return;
      }
      if (state.addFromMap) {
        state.modalPoint = { lat: event.lngLat.lat, lon: event.lngLat.lng, source: "map_click" };
        state.addFromMap = false;
        $("addMapWaypoint").classList.remove("is-pending");
        openWaypointModal("Save map point");
        return;
      }
      handleMapFeatureTap(event);
    });
    for (const layerId of ["offline-region-icon-halo", "offline-region-icons"]) {
      state.map.on("mouseenter", layerId, () => {
        state.map.getCanvas().style.cursor = "pointer";
      });
      state.map.on("mouseleave", layerId, () => {
        state.map.getCanvas().style.cursor = "";
      });
    }
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
      state.map.on("mouseenter", layerId, () => {
        state.map.getCanvas().style.cursor = "pointer";
      });
      state.map.on("mouseleave", layerId, () => {
        state.map.getCanvas().style.cursor = "";
      });
    }
  }

  function isTouchLikeMapEvent(event) {
    const original = event?.originalEvent;
    return original?.pointerType === "touch"
      || original?.type?.startsWith?.("touch")
      || window.matchMedia?.("(pointer: coarse)")?.matches;
  }

  function interactiveTapLayerIds() {
    if (!state.map) return [];
    const overlayLayers = (state.packSelection?.overlays || []).flatMap(overlayLayerIds);
    return [
      "search-result-halo",
      "search-result-dot",
      "offline-region-icon-halo",
      "offline-region-icons",
      "overland-waypoint-icons",
      "overland-track-lines",
      "oiab-poi-icons",
      "pois",
      ...overlayLayers,
    ].filter((layerId, index, all) => all.indexOf(layerId) === index && state.map.getLayer(layerId));
  }

  function tapFeaturePriority(feature) {
    const layerId = feature?.layer?.id || "";
    if (layerId.startsWith("search-result")) return 110;
    if (layerId.startsWith("offline-region-icon")) return 105;
    if (layerId === "overland-waypoint-icons") return 100;
    if (layerId === "oiab-poi-icons" || layerId === "pois") return 95;
    if (feature?.geometry?.type === "Point") return 86;
    if (layerId === "overland-track-lines") return 82;
    if (feature?.geometry?.type === "LineString" || feature?.geometry?.type === "MultiLineString") return 72;
    return 45;
  }

  function handleMapFeatureTap(event) {
    if (!state.map || !event?.point) return false;
    const layers = interactiveTapLayerIds();
    if (!layers.length) return false;
    const radius = isTouchLikeMapEvent(event) ? 28 : 8;
    const bbox = [
      [event.point.x - radius, event.point.y - radius],
      [event.point.x + radius, event.point.y + radius],
    ];
    const features = state.map.queryRenderedFeatures(bbox, { layers })
      .filter((feature) => feature?.layer?.id);
    if (!features.length) return false;
    features.sort((a, b) => tapFeaturePriority(b) - tapFeaturePriority(a));
    return openTappedFeature(features[0], event);
  }

  function openTappedFeature(feature, event) {
    const layerId = feature?.layer?.id || "";
    const tappedEvent = { ...event, features: [feature] };
    if (layerId.startsWith("search-result")) {
      openSearchResult(feature.properties?.index);
      return true;
    }
    if (layerId.startsWith("offline-region-icon")) {
      const regionId = feature.properties?.id;
      if (regionId && regionId !== "__draft__") {
        openOfflineRegionById(regionId);
        return true;
      }
    }
    if (layerId === "overland-waypoint-icons") {
      showSavedPointPopup(tappedEvent);
      return true;
    }
    if (layerId === "overland-track-lines") {
      showSavedTrackPopup(tappedEvent);
      return true;
    }
    if (layerId === "oiab-poi-icons" || layerId === "pois") {
      showBasePoiPopup(tappedEvent);
      return true;
    }
    showOverlayPopup(tappedEvent);
    return true;
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
      if (overlay.type === "map_detail") return layerId.startsWith(`${overlay.id}-`);
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

  function normalizePoiIconLookupKey(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function resolvePoiIconKey(value, fallback = "waypoint") {
    const normalized = normalizePoiIconLookupKey(value);
    const dashed = normalized.replace(/_/g, "-");
    return MAP_KIND_TO_POI_ICON[normalized]
      || MAP_KIND_TO_POI_ICON[dashed]
      || WAYPOINT_CATEGORY_TO_POI_ICON[normalized]
      || WAYPOINT_CATEGORY_TO_POI_ICON[dashed]
      || (POI_ICON_KEYS.includes(normalized) ? normalized : "")
      || (POI_ICON_KEYS.includes(dashed) ? dashed : "")
      || fallback;
  }

  function basePoiIconKey(props = {}) {
    return resolvePoiIconKey(
      props.kind_detail
        || props.kind
        || props.amenity
        || props.shop
        || props.tourism
        || props.leisure
        || props.highway
        || props.name,
      "waypoint",
    );
  }

  function overlayPopupIconKey(props = {}, overlay = {}) {
    const category = String(overlay.category || overlay.style || "").toLowerCase();
    if (category.includes("wildfire")) return "hazard";
    if (category.includes("weather")) return "waypoint";
    if (category.includes("mvum")) return "trailhead";
    if (category.includes("historic") || overlay.style === "historic_places") return "museum";
    if (category.includes("geocaching") || overlay.style === "opencaching") return "waypoint";
    if (category.includes("camping") || category.includes("recreation")) {
      const kind = normalizePoiIconLookupKey(props.kind || props.site_type || props.facility_type || props.type);
      if (kind.includes("campground") || kind.includes("established")) return "campground";
      if (kind.includes("camp") || kind.includes("campsite")) return "campsite";
      return resolvePoiIconKey(kind, "waypoint");
    }
    return resolvePoiIconKey(
      props.kind
        || props.kind_detail
        || props.amenity
        || props.type
        || props.category
        || props.source_kind
        || props.class_label,
      "waypoint",
    );
  }

  function popupIconBadgeHtml(iconKey, colorKey = iconKey) {
    const resolved = resolvePoiIconKey(iconKey, "waypoint");
    const color = poiIconColor(colorKey || resolved);
    return `<span class="omv2-popup-icon-badge" style="--poi-bg:${escapeHtml(color)}"><img src="${escapeHtml(poiIconUrl(resolved))}" alt="" loading="lazy"></span>`;
  }

  function popupTitleHtml(title, iconKey, colorKey = iconKey) {
    return `<h3 class="omv2-poi-title">${popupIconBadgeHtml(iconKey, colorKey)}<span>${escapeHtml(title)}</span></h3>`;
  }

  function coordinateNavigationActionsHtml(coordText, title = "OIAB location") {
    const match = String(coordText || "").match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return "";
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
    const label = encodeURIComponent(title || "OIAB location");
    const coord = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    const apple = `https://maps.apple.com/?daddr=${encodeURIComponent(coord)}&q=${label}`;
    const google = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coord)}`;
    return `
      <a class="omv2-map-link omv2-map-link--apple" href="${apple}" target="_blank" rel="noopener" title="Navigate with Apple Maps" aria-label="Navigate with Apple Maps"></a>
      <a class="omv2-map-link omv2-map-link--google" href="${google}" target="_blank" rel="noopener" title="Navigate with Google Maps" aria-label="Navigate with Google Maps">G</a>
    `;
  }

  function coordinateActionButtonsHtml(coordText, title = "OIAB location") {
    if (!coordText) return "";
    return `
      <div class="omv2-poi-actions">
        <button type="button" data-copy-coords="${escapeHtml(coordText)}">Copy coordinates</button>
        ${coordinateNavigationActionsHtml(coordText, title)}
      </div>
    `;
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
        ${popupTitleHtml(name, basePoiIconKey(props))}
        ${details.length ? `<dl class="omv2-poi-details">${details.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${linkifyDetail(key, value)}</dd>`).join("")}</dl>` : `<p class="omv2-poi-empty">No additional details in this map pack.</p>`}
        ${technical ? `<details class="omv2-poi-technical"><summary>Technical details</summary><dl>${technical}</dl></details>` : ""}
        ${coordinateActionButtonsHtml(coordText, name)}
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
        ${popupTitleHtml(title, overlayPopupIconKey(props, overlay))}
        ${details.length ? `<dl class="omv2-poi-details">${details.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${linkifyDetail(key, value)}</dd>`).join("")}</dl>` : `<p class="omv2-poi-empty">No readable details in this overlay feature.</p>`}
        ${technical ? `<details class="omv2-poi-technical"><summary>All available fields</summary><dl>${technical}</dl></details>` : ""}
        ${coordinateActionButtonsHtml(coordText, title)}
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
        ${popupTitleHtml(title, waypointIconKey(props))}
        ${details.length ? `<dl class="omv2-poi-details">${details.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${linkifyDetail(key, value)}</dd>`).join("")}</dl>` : ""}
        <div class="omv2-poi-actions">
          ${coordText ? `<button type="button" data-copy-coords="${escapeHtml(coordText)}">Copy coordinates</button>` : ""}
          ${coordinateNavigationActionsHtml(coordText, title)}
          <button type="button" data-edit-map-item="${escapeHtml(itemId)}">Edit</button>
          <button type="button" data-delete-map-item="${escapeHtml(itemId)}" data-delete-map-label="${escapeHtml(title)}">Delete</button>
          <button type="button" data-open-map-data-manager>Open manager</button>
        </div>
      </article>
    `;
  }

  function linkifyDetail(key, value) {
    const label = String(key || "").toLowerCase();
    const text = String(value || "").trim();
    if ((label === "url" || label.includes("website") || label.includes("link")) && /^https?:\/\//i.test(text)) {
      const safe = escapeHtml(text);
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
      || props.facility_id
      || props.site_no
      || props.station_nm
      || props.route_id
      || props.id
      || (overlay.category === "wildfire" ? "Wildfire hotspot" : "")
      || (overlay.category === "weather" ? "Weather alert" : "")
      || (overlay.category === "water" ? "Water feature" : "")
      || (overlay.category === "camping_recreation" ? "Recreation site" : "")
      || (overlay.category === "historic" ? "Historic place" : "")
      || (overlay.category === "geocaching" ? "OpenCaching cache" : "")
      || (overlay.category === "mvum" ? "MVUM route" : "")
      || (overlay.category === "public_lands" ? "BLM public land" : "")
      || (overlay.style === "usgs_contours" ? "Contour line" : "")
      || "Overlay feature";
  }

  function forecastPeriodHtml(period = {}) {
    const temp = period.temperature != null ? `${period.temperature}°${period.temperatureUnit || "F"}` : "--";
    const wind = [period.windSpeed, period.windDirection].filter(Boolean).join(" ");
    const precip = period.probabilityOfPrecipitation?.value != null ? `${period.probabilityOfPrecipitation.value}% precip` : "";
    return `
      <li>
        <strong>${escapeHtml(period.name || period.startTime || "Forecast")}</strong>
        <span>${escapeHtml(temp)}${wind ? ` · ${escapeHtml(wind)}` : ""}${precip ? ` · ${escapeHtml(precip)}` : ""}</span>
        ${period.shortForecast ? `<small>${escapeHtml(period.shortForecast)}</small>` : ""}
      </li>
    `;
  }

  function forecastCardHtml(data, coords) {
    if (!data?.ok) {
      return `
        <article class="omv2-poi-card omv2-forecast-card">
          <p class="omv2-poi-kicker">Temperature Forecast</p>
          <h3>Forecast unavailable</h3>
          <p>${escapeHtml(data?.error || "NWS forecast lookup failed.")}</p>
        </article>
      `;
    }
    const grid = data.grid || {};
    const current = data.current || {};
    const place = [grid.city, grid.state].filter(Boolean).join(", ") || `${Number(coords.lat).toFixed(4)}, ${Number(coords.lng).toFixed(4)}`;
    const hourly = Array.isArray(data.next_12_hours) ? data.next_12_hours : [];
    const daily = Array.isArray(data.daily) ? data.daily : [];
    return `
      <article class="omv2-poi-card omv2-forecast-card">
        <p class="omv2-poi-kicker">NWS Temperature Forecast${data.stale ? " · cached" : ""}</p>
        <h3>${escapeHtml(place)}</h3>
        <dl>
          <div><dt>Grid</dt><dd>${escapeHtml([grid.office, grid.x, grid.y].filter(Boolean).join(" / ") || "NWS")}</dd></div>
          <div><dt>Now</dt><dd>${escapeHtml(current.temperature != null ? `${current.temperature}°${current.temperatureUnit || "F"}` : "--")}${current.shortForecast ? ` · ${escapeHtml(current.shortForecast)}` : ""}</dd></div>
          <div><dt>Updated</dt><dd>${escapeHtml(data.updated_at || "")}${data.stale ? " · stale/offline cache" : ""}</dd></div>
        </dl>
        <h4>Next 12 hours</h4>
        <ul class="omv2-forecast-list">${hourly.slice(0, 12).map(forecastPeriodHtml).join("")}</ul>
        <h4>Daily</h4>
        <ul class="omv2-forecast-list">${daily.slice(0, 8).map(forecastPeriodHtml).join("")}</ul>
      </article>
    `;
  }

  async function openTemperatureForecast(lngLat) {
    if (!state.map || !lngLat) return;
    const popup = new maplibregl.Popup({ className: "omv2-poi-popup", maxWidth: "430px" })
      .setLngLat(lngLat)
      .setHTML(`
        <article class="omv2-poi-card omv2-forecast-card">
          <p class="omv2-poi-kicker">Temperature Forecast</p>
          <h3>Loading NWS forecast...</h3>
        </article>
      `)
      .addTo(state.map);
    try {
      const url = `/api/maps/weather/forecast?lat=${encodeURIComponent(lngLat.lat)}&lon=${encodeURIComponent(lngLat.lng)}`;
      const data = await fetchJson(url, { ok: false, error: "Forecast unavailable." }, { cache: "no-store" });
      popup.setHTML(forecastCardHtml(data, lngLat));
    } catch (error) {
      popup.setHTML(forecastCardHtml({ ok: false, error: error.message }, lngLat));
    }
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
    if (overlay.style === "drought_monitor") {
      return compactDetails([
        ["Class", firstPresent(props, ["dm", "DM", "drought_class", "class"])],
        ["Intensity", firstPresent(props, ["intensity", "label", "name"])],
        ["Valid", firstPresent(props, ["valid_date", "date", "release_date"])],
        ["Source", "U.S. Drought Monitor"],
      ]);
    }
    if (String(overlay.style || "").startsWith("campflare_")) {
      return compactDetails([
        ["Name", firstPresent(props, ["name"])],
        ["Kind", firstPresent(props, ["kind_label", "kind", "source_kind"])],
        ["Status", firstPresent(props, ["status"])],
        ["Campground", firstPresent(props, ["campground_name", "campground_id"])],
        ["Loop", firstPresent(props, ["loop"])],
        ["Equipment", firstPresent(props, ["equipment"])],
        ["Amenities", firstPresent(props, ["amenities"])],
        ["Manager", firstPresent(props, ["manager"])],
        ["Address", firstPresent(props, ["address"])],
        ["Directions", firstPresent(props, ["directions"])],
        ["URL", firstPresent(props, ["url", "website", "reservation_url"])],
        ["Source", "Campflare"],
      ]);
    }
    if (overlay.style === "ridb_recreation" || category === "camping_recreation") {
      return compactDetails([
        ["Name", firstPresent(props, ["name", "FacilityName"])],
        ["Category", firstPresent(props, ["recreation_category"])],
        ["Type", firstPresent(props, ["type", "FacilityTypeDescription"])],
        ["Facility ID", firstPresent(props, ["facility_id", "FacilityID"])],
        ["Phone", firstPresent(props, ["phone", "FacilityPhone"])],
        ["Email", firstPresent(props, ["email", "FacilityEmail"])],
        ["URL", firstPresent(props, ["url", "FacilityReservationURL", "FacilityMapURL"])],
        ["Source", firstPresent(props, ["source"]) || "RIDB"],
      ]);
    }
    if (overlay.style === "historic_places" || category === "historic") {
      return compactDetails([
        ["Name", firstPresent(props, ["name"])],
        ["Reference #", firstPresent(props, ["refnum"])],
        ["Type", firstPresent(props, ["type"])],
        ["Status", firstPresent(props, ["status"])],
        ["Listed", firstPresent(props, ["listedDate"])],
        ["City", firstPresent(props, ["city"])],
        ["County", firstPresent(props, ["county"])],
        ["State", firstPresent(props, ["state"])],
        ["Accuracy", firstPresent(props, ["accuracyNote"])],
        ["URL", firstPresent(props, ["sourceUrl"])],
        ["Source", "National Park Service / NRHP"],
      ]);
    }
    if (overlay.style === "opencaching" || category === "geocaching") {
      return compactDetails([
        ["Code", firstPresent(props, ["code", "id"])],
        ["Name", firstPresent(props, ["name"])],
        ["Type", firstPresent(props, ["type"])],
        ["Status", firstPresent(props, ["status"])],
        ["Difficulty", firstPresent(props, ["difficulty"])],
        ["Terrain", firstPresent(props, ["terrain"])],
        ["Size", firstPresent(props, ["size"])],
        ["Owner", firstPresent(props, ["owner"])],
        ["Hidden", firstPresent(props, ["hiddenDate"])],
        ["Last found", firstPresent(props, ["lastFoundDate"])],
        ["Description", firstPresent(props, ["shortDescription"])],
        ["URL", firstPresent(props, ["url", "sourceUrl"])],
        ["Source", firstPresent(props, ["source"]) || "OpenCaching"],
      ]);
    }
    if (overlay.style === "stream_gauges" || category === "water") {
      return compactDetails([
        ["Name", firstPresent(props, ["name", "station_nm", "siteName"])],
        ["Site", firstPresent(props, ["site_no", "siteCode", "monitoringLocationIdentifier"])],
        ["Flow", firstPresent(props, ["flow_cfs", "00060", "value"])],
        ["Status", firstPresent(props, ["status", "siteStatus"])],
        ["Waterbody", firstPresent(props, ["gnis_name", "waterbody", "feature_name"])],
        ["Source", firstPresent(props, ["source"]) || "USGS"],
      ]);
    }
    if (overlay.style === "lightning_recent") {
      return compactDetails([
        ["Time", firstPresent(props, ["time", "timestamp", "date"])],
        ["Type", firstPresent(props, ["type", "event_type"])],
        ["Amplitude", firstPresent(props, ["amplitude", "peak_current"])],
        ["Source", firstPresent(props, ["source"])],
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
        ["Name", firstPresent(props, ["unit_name", "name", "NAME", "unit"])],
        ["Manager", firstPresent(props, ["manager_type", "manager", "owner_type"])],
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
    if (typeof value === "object") {
      return Object.entries(value || {})
        .filter(([, item]) => item !== undefined && item !== null && String(item).trim() !== "")
        .map(([key, item]) => `${humanizePoiKey(key)}: ${formatPoiValue(item)}`)
        .join(", ");
    }
    const text = String(value || "").trim();
    if (/^https?:\/\//i.test(text) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return text;
    return humanizePoiValue(text);
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
      id: "overland-waypoint-icons",
      type: "symbol",
      source: "overland-waypoints",
      filter: combineMapFilters(pointGeometryFilter(), poiKindFilterExpression(["coalesce", ["get", "marker_icon_key"], "waypoint"])),
      layout: {
        "icon-image": mapPoiMatchExpression("marker_icon_key", Object.fromEntries(
          POI_ICON_KEYS.map((key) => [key, key]),
        ), "waypoint", poiImageId),
        "icon-size": unifiedPoiBadgeIconSize(),
        "icon-anchor": poiIconAnchor(),
        "icon-offset": poiIconOffset(),
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
        "text-field": ["case", ["==", ["get", "draft"], 1], "+", "⚙"],
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
    applySavedDataOverlayState();
    applyOverlayLayerOrdering();
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
    if (overlay.type === "map_detail") {
      return overlay.summary || "map";
    }
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
    const active = overlays.filter((overlay) => overlay.enabled);
    const inactive = overlays.filter((overlay) => !overlay.enabled);
    const renderGroup = (title, group) => {
      if (!group.length) return;
      const wrap = document.createElement("div");
      wrap.className = "omv2-overlay-sort-group";
      wrap.dataset.overlayGroup = title.toLowerCase();
      const heading = document.createElement("div");
      heading.className = "omv2-overlay-section-title";
      heading.textContent = title;
      wrap.appendChild(heading);
      for (const overlay of group) renderOverlayControlRow(wrap, overlay);
      node.appendChild(wrap);
    };
    renderGroup("Active", active);
    renderGroup("Inactive", inactive);
  }

  function temperatureControlOptions(kind) {
    const defaults = kind === "products"
      ? [
        { id: "temp", label: "Near-term" },
        { id: "max", label: "Max" },
        { id: "min", label: "Min" },
        { id: "apparent", label: "Feels-like" },
      ]
      : [
        { id: "now", label: "Now" },
        { id: "plus6", label: "+6h" },
        { id: "plus12", label: "+12h" },
        { id: "tomorrow", label: "Tomorrow" },
        { id: "day3", label: "Day 3" },
        { id: "day5", label: "Day 5" },
        { id: "day7", label: "Day 7" },
      ];
    const remote = state.temperatureOptions?.[kind];
    return Array.isArray(remote) && remote.length ? remote : defaults;
  }

  function renderTemperatureControls(row, overlay) {
    const settings = temperatureSettings();
    const controls = document.createElement("div");
    controls.className = "omv2-temperature-controls";
    const products = temperatureControlOptions("products");
    const periods = temperatureControlOptions("periods");
    const legend = state.temperatureOptions?.legend || [];
    controls.innerHTML = `
      <select data-temperature-product aria-label="Temperature type">
        ${products.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === settings.product ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
      <select data-temperature-period aria-label="Forecast period">
        ${periods.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === settings.period ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
      <button type="button" data-temperature-gps title="Forecast at current GPS">GPS</button>
      <button type="button" data-temperature-tap title="Tap map for forecast">Tap</button>
      <div class="omv2-temperature-legend" aria-label="Temperature color legend">
        ${(legend.length ? legend : [
          { color: "#2563eb", label: "0°F" },
          { color: "#06b6d4", label: "20°F" },
          { color: "#22c55e", label: "40°F" },
          { color: "#facc15", label: "60°F" },
          { color: "#f97316", label: "80°F" },
          { color: "#dc2626", label: "100°F" },
        ]).map((item) => `<span><i style="background:${escapeHtml(item.color)}"></i>${escapeHtml(item.label)}</span>`).join("")}
      </div>
    `;
    controls.querySelector("[data-temperature-product]").addEventListener("change", (event) => {
      setTemperatureSettings({ product: event.target.value });
      scheduleTemperatureReload();
    });
    controls.querySelector("[data-temperature-period]").addEventListener("change", (event) => {
      setTemperatureSettings({ period: event.target.value });
      scheduleTemperatureReload();
    });
    controls.querySelector("[data-temperature-gps]").addEventListener("click", () => {
      const loc = state.currentLocation || {};
      if (!validCoord(Number(loc.lat), Number(loc.lon))) {
        toast("No current GPS position available for forecast.", true);
        return;
      }
      openTemperatureForecast({ lat: Number(loc.lat), lng: Number(loc.lon) });
    });
    controls.querySelector("[data-temperature-tap]").addEventListener("click", () => {
      state.temperaturePickMode = true;
      state.addFromMap = false;
      state.inspectTile = false;
      $("addMapWaypoint").classList.remove("is-pending");
      $("inspectTile").classList.remove("is-pending");
      $("overlaysPanel").hidden = true;
      toast("Tap the map for an NWS temperature forecast.");
    });
    row.appendChild(controls);
    if (!state.temperatureOptions) {
      loadTemperatureOptions().then(() => {
        if (!row.isConnected) return;
        renderOverlayControls();
      }).catch(() => {});
    }
  }

  function renderOverlayControlRow(node, overlay) {
      const row = document.createElement("div");
      row.className = "omv2-folder-row omv2-overlay-row";
      row.dataset.overlayId = overlay.id;
      row.innerHTML = `
        <label class="omv2-overlay-check">
          <input type="checkbox" ${overlay.enabled ? "checked" : ""}>
          <span>${escapeHtml(overlay.name || overlay.id)}</span>
        </label>
        <label class="omv2-overlay-opacity">
          <span>${Math.round(Number(overlay.opacity ?? 1) * 100)}%</span>
          <input type="range" min="0" max="1" step="0.05" value="${Number(overlay.opacity ?? 1)}">
        </label>
        ${overlay.category === "geopdf" ? `<button class="omv2-mini-button" type="button" data-zoom-overlay="${escapeHtml(overlay.id)}" title="Zoom to map">⌖</button>` : ""}
        <span class="omv2-overlay-order" aria-label="Layer order">
          <button type="button" data-overlay-move="up" title="Move up" aria-label="Move ${escapeHtml(overlay.name || overlay.id)} up">▲</button>
          <button type="button" data-overlay-move="down" title="Move down" aria-label="Move ${escapeHtml(overlay.name || overlay.id)} down">▼</button>
        </span>
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
      const zoomButton = row.querySelector("[data-zoom-overlay]");
      if (zoomButton) {
        zoomButton.addEventListener("click", () => zoomToOverlayBounds(overlay));
      }
      if (isTemperatureOverlay(overlay)) {
        renderTemperatureControls(row, overlay);
      }
      row.querySelectorAll("[data-overlay-move]").forEach((button) => {
        button.addEventListener("click", () => moveOverlayRowByButton(row, button.dataset.overlayMove));
      });
      node.appendChild(row);
  }

  async function moveOverlayRowByButton(row, direction) {
    const group = row.closest(".omv2-overlay-sort-group");
    if (!group) return;
    const rows = [...group.querySelectorAll(".omv2-overlay-row")];
    const index = rows.indexOf(row);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) return;
    const target = rows[targetIndex];
    if (direction === "up") group.insertBefore(row, target);
    else group.insertBefore(target, row);
    try {
      await moveOverlaysToOrder(overlayOrderFromDom());
    } catch (error) {
      renderOverlayControls();
      toast(error.message || "Overlay order update failed.", true);
    }
  }

  function overlayOrderFromDom() {
    return [...document.querySelectorAll("#overlayList .omv2-overlay-row")]
      .map((row) => row.dataset.overlayId)
      .filter(Boolean);
  }

  async function moveOverlaysToOrder(orderedIds) {
    const byId = new Map(normalizeOverlayRegistry(state.overlayRegistry)
      .filter((overlay) => overlay.available)
      .map((overlay) => [overlay.id, overlay]));
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    for (let index = 0; index < ordered.length; index += 1) {
      await setOverlayOrder(ordered[index].id, (index + 1) * 10);
    }
    state.overlayRegistry = await fetchJson(API.overlays);
    renderOverlayControls();
    await boot();
  }

  function zoomToOverlayBounds(overlay) {
    const bbox = Array.isArray(overlay.bounds) ? overlay.bounds : Array.isArray(overlay.metadata?.bounds) ? overlay.metadata.bounds : null;
    if (!state.map || !bbox || bbox.length !== 4) {
      toast("No bounds available for this overlay.", true);
      return;
    }
    state.map.fitBounds([[Number(bbox[0]), Number(bbox[1])], [Number(bbox[2]), Number(bbox[3])]], {
      padding: 64,
      duration: 650,
      maxZoom: 15,
    });
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
      const folderGroup = document.createElement("div");
      folderGroup.className = "omv2-manager-folder-group";
      folderGroup.dataset.folderName = folder.name;
      const folderRow = document.createElement("div");
      folderRow.className = "omv2-manager-folder";
      folderRow.innerHTML = `
        <button class="omv2-manager-expander" type="button" title="${open ? "Collapse folder" : "Expand folder"}" aria-label="${open ? "Collapse" : "Expand"} ${escapeHtml(folder.name)}" aria-expanded="${open ? "true" : "false"}"></button>
        <input type="checkbox" ${state.managerSelectedFolders.has(folder.name) ? "checked" : ""} title="Select folder">
        <span class="omv2-manager-name">${escapeHtml(folder.name)}</span>
        <span class="omv2-manager-meta">${folder.items.length}</span>
        <span class="omv2-manager-row-actions">
          <button class="omv2-manager-icon-button" type="button" data-folder-visible="${escapeHtml(folder.name)}" title="${folder.shown ? "Hide" : "Show"}">${folder.shown ? "◉" : "◎"}</button>
          <button class="omv2-manager-icon-button" type="button" data-folder-delete="${escapeHtml(folder.name)}" title="Delete folder">🗑</button>
        </span>
      `;
      const itemsNode = document.createElement("div");
      itemsNode.className = "omv2-manager-folder-items";
      itemsNode.hidden = !open;
      folderRow.querySelector(".omv2-manager-expander").addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextOpen = !state.managerOpenFolders.has(folder.name);
        if (nextOpen) state.managerOpenFolders.add(folder.name);
        else state.managerOpenFolders.delete(folder.name);
        folderGroup.classList.toggle("is-open", nextOpen);
        itemsNode.hidden = !nextOpen;
        const button = folderRow.querySelector(".omv2-manager-expander");
        button.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        button.setAttribute("aria-label", `${nextOpen ? "Collapse" : "Expand"} ${folder.name}`);
        button.title = nextOpen ? "Collapse folder" : "Expand folder";
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
      folderGroup.classList.toggle("is-open", open);
      folderGroup.appendChild(folderRow);
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
        itemsNode.appendChild(itemRow);
      }
      folderGroup.appendChild(itemsNode);
      root.appendChild(folderGroup);
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
    if ($("poiFilterPanel")) $("poiFilterPanel").hidden = true;
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
        if (overlay.type === "map_detail") return layerId.startsWith(`${overlay.id}-`);
        const sourceId = overlaySourceId(overlay);
        return source === sourceId
          || source.startsWith(`${sourceId}-`)
          || layerId.startsWith(`${sourceId}-`)
          || (overlay.source_layer && sourceLayer === overlay.source_layer);
      }) || null;
  }

  function featureKey(feature, title, point) {
    return `${feature.source || ""}:${feature.sourceLayer || feature.layer?.id || ""}:${title}:${point.map((value) => Number(value).toFixed(4)).join(",")}`;
  }

  function campflareFeatureIconKey(props = {}, style = "") {
    const sourceKind = normalizePoiIconLookupKey(props.source_kind);
    const kind = normalizePoiIconLookupKey(props.kind);
    if (sourceKind === "campsite") return "campsite";
    if (sourceKind === "campground") {
      if (kind === "dispersed") return "campsite";
      return "campground";
    }
    if (sourceKind === "poi") {
      return resolvePoiIconKey(kind || props.amenity || props.type, "waypoint");
    }
    if (style === "campflare_campsites") return "campsite";
    if (style === "campflare_campgrounds") return kind === "dispersed" ? "campsite" : "campground";
    if (style === "campflare_land_pois") return resolvePoiIconKey(kind || props.amenity || props.type, "waypoint");
    return "waypoint";
  }

  function featurePoiKind(feature, overlay = null, sourceType = "") {
    const props = feature?.properties || {};
    const geometryType = feature?.geometry?.type || feature?.geometry?.type || "";
    if (geometryType && geometryType !== "Point") return null;
    if (sourceType === "saved") return waypointIconKey(props);
    const style = overlay?.style || overlay?.category || "";
    if (style === "historic_places") return "museum";
    if (style === "opencaching") return "waypoint";
    if (style === "campflare_campgrounds" || style === "campflare_campsites" || style === "campflare_land_pois") {
      return campflareFeatureIconKey(props, style);
    }
    if (overlay) return overlayPopupIconKey(props, overlay);
    return basePoiIconKey(props);
  }

  function passesPoiKindFilter(feature, overlay = null, sourceType = "") {
    if (!poiKindFilterActive()) return true;
    const point = pointForFeature(feature);
    if (!point) return true;
    const iconKey = featurePoiKind(feature, overlay, sourceType);
    return !iconKey || state.poiKindFilter.has(iconKey);
  }

  function addSearchFeature(results, seen, feature, sourceLabel, sourceType, overlay = null) {
    if (!matchesSearch(feature, state.searchNeedles || [])) return;
    if (!passesPoiKindFilter(feature, overlay, sourceType)) return;
    const point = pointForFeature(feature);
    if (!point) return;
    if (state.searchBounds && !state.searchBounds.contains({ lng: Number(point[0]), lat: Number(point[1]) })) return;
    const title = searchResultTitle(feature, "Map item");
    const key = featureKey(feature, title, point);
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      feature,
      point,
      title,
      subtitle: searchResultSubtitle(feature, sourceLabel),
      source: sourceType,
      overlay,
    });
  }

  function querySourceFeatures(sourceId, sourceLayers = []) {
    if (!state.map || !sourceId || !state.map.getSource(sourceId)) return [];
    const layerNames = Array.from(new Set(sourceLayers.filter(Boolean)));
    const results = [];
    if (!layerNames.length) {
      try {
        results.push(...state.map.querySourceFeatures(sourceId));
      } catch {
        // Some source types require a source-layer; skip them below.
      }
    }
    for (const sourceLayer of layerNames) {
      try {
        results.push(...state.map.querySourceFeatures(sourceId, { sourceLayer }));
      } catch {
        // Missing source layers are expected for mixed overlay types.
      }
    }
    return results;
  }

  function searchLoadedSourceFeatures({ includeBase, includeOverlays, results, seen }) {
    const style = state.map?.getStyle();
    if (!style?.layers) return;
    const sourceLayersBySource = new Map();
    for (const layer of style.layers) {
      if (!layer.source || !layer["source-layer"]) continue;
      if (!sourceLayersBySource.has(layer.source)) sourceLayersBySource.set(layer.source, new Set());
      sourceLayersBySource.get(layer.source).add(layer["source-layer"]);
    }
    if (includeBase && state.packSelection?.base) {
      const baseSource = sourceIdFor(state.packSelection.base);
      const baseLayers = Array.from(sourceLayersBySource.get(baseSource) || []);
      for (const feature of querySourceFeatures(baseSource, baseLayers)) {
        addSearchFeature(results, seen, feature, feature.sourceLayer || "Map", "map");
      }
    }
    if (!includeOverlays) return;
    for (const overlay of normalizeOverlayRegistry(state.overlayRegistry).filter((item) => item.enabled)) {
      const sourceId = overlaySourceId(overlay);
      const layers = Array.from(sourceLayersBySource.get(sourceId) || []);
      if (overlay.source_layer) layers.push(overlay.source_layer);
      for (const feature of querySourceFeatures(sourceId, layers)) {
        addSearchFeature(results, seen, feature, overlay.name || overlay.id, "overlay", overlay);
      }
      for (const region of overlay.region_sources || []) {
        const regionSourceId = overlaySourceId(overlay, region.region_id || region.region_name || "region");
        const regionLayers = Array.from(sourceLayersBySource.get(regionSourceId) || []);
        if (overlay.source_layer) regionLayers.push(overlay.source_layer);
        for (const feature of querySourceFeatures(regionSourceId, regionLayers)) {
          addSearchFeature(results, seen, feature, overlay.name || overlay.id, "overlay", overlay);
        }
      }
    }
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
            ${coordinateActionButtonsHtml(title, "Coordinates")}
          </article>
        `)
        .addTo(state.map);
      return;
    }
    const needles = searchNeedles(q);
    state.searchNeedles = needles;
    const includeBase = $("searchBase")?.checked !== false;
    const includeOverlays = $("searchOverlays")?.checked !== false;
    const includeSaved = $("searchSaved")?.checked !== false;
    const bounds = state.map.getBounds();
    state.searchBounds = bounds;
    const results = [];
    const seen = new Set();
    if (includeSaved) {
      for (const feature of state.places.features || []) {
        if (!featureWithinBounds(feature, bounds)) continue;
        if (!passesPoiKindFilter(feature, null, "saved")) continue;
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
      if (!passesPoiKindFilter(feature, overlay, overlay ? "overlay" : "map")) continue;
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
    searchLoadedSourceFeatures({ includeBase, includeOverlays, results, seen });
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
    applySavedDataOverlayState();
    applyOverlayLayerOrdering();
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
        if (state.follow) applyFollowCamera(location);
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
    const autoEnabled = localStorage.getItem(MAP_AUTO_RECORDING_KEY) !== "false";
    $("trackModeTitle").textContent = state.manualRecording ? "Full recording active" : autoEnabled ? "Auto recording active" : "Track recording off";
    $("trackModeHint").textContent = state.manualRecording
      ? "Full recording keeps a single route active until you switch back to auto or off."
      : autoEnabled
        ? "Auto recording starts above 2 mph. Full recording records continuously until stopped."
        : "Recording is disabled. Choose auto or full recording to save tracks.";
    $("startManualTrack").classList.toggle("is-active", state.manualRecording);
    $("autoTrackMode").classList.toggle("is-active", autoEnabled && !state.manualRecording);
    $("stopManualTrack").classList.toggle("is-active", !autoEnabled && !state.manualRecording);
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

  async function setAutoTrackRecording(enabled) {
    localStorage.setItem(MAP_AUTO_RECORDING_KEY, JSON.stringify(Boolean(enabled)));
    const response = await fetch("/api/settings/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ map_auto_recording: Boolean(enabled) }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "Auto recording update failed.");
    }
    await pollTrack();
    return payload;
  }

  function openLegendModal() {
    const content = $("legendContent");
    if (content) {
      content.innerHTML = legendMarkup();
    }
    $("legendModal").hidden = false;
  }

  function closeLegendModal() {
    $("legendModal").hidden = true;
  }

  function legendMarkup() {
    const activeStyles = new Set((state.packSelection?.overlays || []).map((overlay) => overlay.style || overlay.id || overlay.category).filter(Boolean));
    const activeCategories = new Set((state.packSelection?.overlays || []).map((overlay) => overlay.category).filter(Boolean));
    const hasStyle = (...styles) => styles.some((style) => activeStyles.has(style));
    const hasCategory = (...categories) => categories.some((category) => activeCategories.has(category));
    const lines = [
      ["Interstate / Primary Road", "solid", "#ff7b24"],
      ["Main Road / Highway", "solid", "#ffd34f"],
      ["Street / Local Road", "solid", "#ffffff"],
      ["Service Road", "dash", "#cfcfcf"],
      ["Track / Unmaintained Road", "dash", "#777"],
      ["Trail / Path", "dot", "#555"],
      ["Railroad", "rail", "#8d8377"],
    ];
    if (hasCategory("mvum") || hasStyle("mvum_roads", "mvum_trails")) {
      for (const key of ["open_motorized", "high_clearance", "seasonal", "trail", "atv_only", "motorcycle_only", "special", "restricted"]) {
        const style = MVUM_LINE_STYLES[key];
        lines.push([style.label, "mvum", style.color, style.dash, style.symbol || "", style.casing || "", style.annotation || ""]);
      }
    }
    if (hasStyle("usgs_contours")) {
      lines.push(["Index Contour", "solid", "#4f4630"], ["Contour", "solid", "#7b7358"]);
    }
    const areas = [
      ["Forest / Woodland", "#b7d7ad"],
      ["Park / Protected Green Space", "#a9d8a7"],
      ["Waterway / Waterbody", "#5fd2df"],
      ["Wetland", "#a8d8ce"],
      ["Building / Structure", "#cec7b8"],
      ["School / Campus", "#eadfbe"],
      ["Industrial / Commercial", "#ddd1c7"],
      ["Restricted / Military", "#ffd4d4"],
    ];
    if (hasStyle("public_lands_blm")) areas.push(["BLM-Administered Land", "#d2bf75"]);
    if (hasStyle("public_lands_blm_wilderness")) {
      areas.push(["BLM Wilderness Area", "#e7b45a"], ["BLM Wilderness Study Area", "#8fb39a"]);
    }
    if (hasStyle("weather_alerts")) areas.push(["Weather Alert", "rgba(255, 211, 79, .42)"]);
    const pois = [
      ["gas-station-ev-station", "Fuel / EV", "#facc15"],
      ["parking", "Parking", "#60a5fa"],
      ["restaurant", "Restaurant", "#fb923c"],
      ["campsite", "Campsite", "#4ade80"],
      ["trailhead", "Trailhead", "#a3e635"],
      ["viewpoint", "Viewpoint", "#67e8f9"],
      ["restrooms", "Restrooms", "#c4b5fd"],
      ["medical-clinic-hospital", "Medical", "#f87171"],
      ["airport", "Airport", "#60a5fa"],
      ["waterfall", "Waterfall", "#67e8f9"],
    ];
    const overlayPois = [];
    if (hasStyle("wildfire_hotspots")) overlayPois.push(["overlay-flame", "Wildfire Hotspot", "#ef4444", "/maps-v2/icons/overlay-flame.svg", "legend-poi-flame"]);
    if (hasStyle("campflare_campgrounds", "campflare_campsites", "campflare_land_pois")) {
      overlayPois.push(
        ["campground", "Campflare Campground", "#fb923c"],
        ["campsite", "Campflare Campsite", "#38bdf8"],
        ["waypoint", "Campflare POI", "#a78bfa"],
      );
    }
    const lineStyle = ([, , color]) => `--c:${escapeHtml(color)}`;
    const mvumLegendSvg = (color, dash, symbol, casing, annotation) => {
      const dashAttr = Array.isArray(dash) && dash.length ? ` stroke-dasharray="${dash.map((value) => Number(value || 0) * 6).join(" ")}"` : "";
      const y = annotation ? 16 : 9;
      const viewHeight = annotation ? 22 : 16;
      const casingPath = casing
        ? `<path d="M2 ${y}H66" fill="none" stroke="${escapeHtml(casing)}" stroke-width="7" stroke-linecap="butt"/>`
        : "";
      const annotationText = annotation
        ? `<text x="2" y="8" fill="#f7f4df" font-size="8" font-style="italic" font-family="Trebuchet MS, sans-serif">${escapeHtml(annotation)}</text>`
        : "";
      const symbolText = symbol
        ? `<text x="54" y="${y + 3.2}" fill="${escapeHtml(color)}" stroke="#f7f4df" stroke-width="2.8" paint-order="stroke" font-size="9" font-weight="900" font-family="Trebuchet MS, sans-serif">${escapeHtml(symbol)}</text>`
        : "";
      return `<svg class="legend-line-svg ${annotation ? "legend-line-svg--annotated" : ""}" viewBox="0 0 74 ${viewHeight}" aria-hidden="true">
        ${annotationText}
        ${casingPath}
        <path d="M2 ${y}H66" fill="none" stroke="${escapeHtml(color)}" stroke-width="${casing ? 3.2 : 4}" stroke-linecap="${casing ? "butt" : "round"}"${dashAttr}/>
        ${symbolText}
      </svg>`;
    };
    const lineBadge = ([label, type, color, dash, symbol, casing, annotation]) => `
      <div class="legend-row">
        <span class="legend-line ${escapeHtml(type)}" style="${lineStyle([label, type, color, dash, symbol])}">
          ${type === "mvum" ? mvumLegendSvg(color, dash, symbol, casing, annotation) : ""}
        </span>
        <span>${escapeHtml(label)}</span>
      </div>`;
    const poiBadge = ([icon, label, color, url, extraClass]) => `
      <div class="legend-row">
        <span
          class="legend-poi legend-poi--${escapeHtml(state.poiIconStyle)} ${escapeHtml(extraClass || "")}"
          style="--poi-bg:${escapeHtml(color || poiIconColor(icon))};--poi-url:url('${escapeHtml(url || poiIconUrl(icon))}')"
        >
          <span class="legend-poi-glyph" aria-hidden="true"></span>
        </span>
        <span>${escapeHtml(label)}</span>
      </div>`;
    return `
      <section><h3>Roads & Lines</h3>${lines.map(lineBadge).join("")}</section>
      <section><h3>Areas & Overlays</h3>${areas.map(([label, color]) => `<div class="legend-row"><span class="legend-area" style="--c:${color}"></span><span>${escapeHtml(label)}</span></div>`).join("")}</section>
      <section><h3>Points of Interest</h3>${pois.map(poiBadge).join("")}</section>
      ${overlayPois.length ? `<section><h3>Active Overlay Symbols</h3>${overlayPois.map(poiBadge).join("")}</section>` : ""}
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
      button.innerHTML = `<span class="waypoint-type-badge" style="--poi-bg:${escapeHtml(poiIconColor(iconKey))}"><img src="${escapeHtml(poiIconUrl(iconKey))}" alt="" loading="lazy"></span><span>${escapeHtml(label)}</span>`;
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
    $("followToggle").addEventListener("click", () => setFollowMode(!state.follow));
    const rightControls = document.querySelector(".omv2-controls-right");
    if (rightControls) {
      const collapsed = localStorage.getItem(MAP_RIGHT_CONTROLS_COLLAPSED_KEY) === "true";
      rightControls.classList.toggle("is-collapsed", collapsed);
      $("rightControlsCollapse")?.addEventListener("click", () => {
        const next = !rightControls.classList.contains("is-collapsed");
        rightControls.classList.toggle("is-collapsed", next);
        localStorage.setItem(MAP_RIGHT_CONTROLS_COLLAPSED_KEY, JSON.stringify(next));
      });
    }
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
      renderPoiKindFilterPanel();
      $("searchInput").focus();
    });
    $("searchClose").addEventListener("click", closeSearch);
    $("poiFilterToggle")?.addEventListener("click", () => {
      renderPoiKindFilterPanel();
      $("poiFilterPanel").hidden = !$("poiFilterPanel").hidden;
    });
    $("poiFilterAllOn")?.addEventListener("click", () => setPoiKindFilter(POI_ICON_KEYS));
    $("poiFilterAllOff")?.addEventListener("click", () => setPoiKindFilter([]));
    $("poiFilterList")?.addEventListener("change", (event) => {
      const checkbox = event.target.closest('input[type="checkbox"][value]');
      if (!checkbox) return;
      const next = new Set(state.poiKindFilter);
      if (checkbox.checked) next.add(checkbox.value);
      else next.delete(checkbox.value);
      setPoiKindFilter(Array.from(next));
    });
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
        await setAutoTrackRecording(true);
        await setManualTrackRecording(true);
        closeTrackModeModal();
        toast("Full recording started.");
      } catch (error) {
        toast(error.message || "Track start failed.", true);
      }
    });
    $("autoTrackMode").addEventListener("click", async () => {
      try {
        await setManualTrackRecording(false);
        await setAutoTrackRecording(true);
        closeTrackModeModal();
        toast("Auto recording enabled.");
      } catch (error) {
        toast(error.message || "Auto recording update failed.", true);
      }
    });
    $("stopManualTrack").addEventListener("click", async () => {
      try {
        await setManualTrackRecording(false);
        await setAutoTrackRecording(false);
        closeTrackModeModal();
        toast("Track recording disabled.");
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
    $("closeMapErrors")?.addEventListener("click", () => {
      state.mapErrorsDismissed = true;
      $("mapErrorPanel").hidden = true;
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
        window.parent.postMessage({ type: "oiab:open-app", appId: "overland-settings", settingsSection: "maps" }, window.location.origin);
      } else if (window.top && window.top !== window) {
        window.top.postMessage({ type: "oiab:open-app", appId: "overland-settings", settingsSection: "maps" }, window.location.origin);
      } else {
        window.location.href = "/?headunit=1&settings=maps";
      }
    });
    $("overlaySettingsLink")?.addEventListener("click", (event) => {
      event.preventDefault();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "oiab:open-app", appId: "overland-settings", settingsSection: "maps" }, window.location.origin);
      } else if (window.top && window.top !== window) {
        window.top.postMessage({ type: "oiab:open-app", appId: "overland-settings", settingsSection: "maps" }, window.location.origin);
      } else {
        window.location.href = "/?headunit=1&settings=maps";
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
      if (!$("savedDataPanel").hidden || !$("overlaysPanel").hidden || !$("dataManagerPanel").hidden) {
        const floating = event.target.closest("#savedDataPanel, #overlaysPanel, #dataManagerPanel, #savedDataToggle, #overlaysToggle, [data-open-map-data-manager], .maplibregl-popup, .omv2-modal");
        if (!floating) {
          $("savedDataPanel").hidden = true;
          $("overlaysPanel").hidden = true;
          $("dataManagerPanel").hidden = true;
        }
      }
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
  renderPoiKindFilterPanel();
  populateIconSelect();
  window.addEventListener("storage", (event) => {
    if (event.key === MAP_3D_BUILDINGS_KEY) {
      state.show3dBuildings = JSON.parse(event.newValue || "false");
      applyBuildingDisplayMode();
    }
    if (event.key === MAP_THEME_KEY) applyMapTheme();
    if (event.key === POI_ICON_STYLE_KEY) {
      refreshPoiIconStyle().catch((error) => console.warn("[OIAB Maps v2] POI icon style refresh failed", error));
    }
  });
  applyMapTheme();
  boot();
})();
