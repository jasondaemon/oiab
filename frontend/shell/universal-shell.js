(() => {
  const CONFIG_URLS = ["/api/apps", "/overland/apps.json", "/maps/overland/apps.json"];
  const PROFILE_KEY = "iiab-overland-player-profile";
  const THEME_KEY = "iiab-overland-universal-theme-v1";
  const DOCK_KEY = "iiab-overland-universal-dock-v1";
  const MUSIC_KEY = "iiab-overland-universal-music-v1";
  const RECENT_KEY = "iiab-overland-universal-recents-v1";
  const SETTINGS_UNLOCK_KEY = "oiab-settings-unlock-until-v1";
  const MAP_3D_BUILDINGS_KEY = "omv2.show3dBuildings";
  const MAP_AUTO_RECORDING_KEY = "omv2.autoTrackRecording";
  const MAP_THEME_KEY = "omv2.mapTheme";
  const FALLBACK_ART = "/maps/overland/tunes.png";
  const NUMBER_FMT = new Intl.NumberFormat();
  const DEFAULT_LAYOUT = {
    schema: 1,
    settingsPassword: "314159",
    settingsPinTimeoutMinutes: 5,
    hiddenAppIds: ["legacy-home", "legacy-admin", "https-settings", "service-manager", "audio-test", "minecraft"],
    folders: [
      { id: "games", title: "Games", icon: "/maps/overland/overland-folder-games.svg", protected: false, appIds: ["scoreboard", "chess", "checkers", "minesweeper", "blockfall", "claimline", "sinkhole-city", "blank-slate", "starts-ends", "dice-roller", "word-tile-arena", "connect-four", "burst", "battleship", "dots-and-boxes", "hangman", "word-grid", "pattern-match", "web-emulator", "minecraft-map", "drums", "trivia", "tic-tac-toe", "license-plates"] },
    ],
  };
  const HOST_PREFIXES = ["mobile", "maps", "music", "iiab", "files", "jellyfin", "monitor", "maps-admin", "minecraft-map", "minecraft-admin", "mindustry"];
  const NATIVE_APP_URLS = {
    "web-emulator": "/mobile/emulator.html",
    drums: "/mobile/drums.html",
    "license-plates": "/mobile/license-plates.html",
    trivia: "/mobile/trivia.html",
    "overland-settings": "/mobile/admin.html",
  };
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
    ["place", "Other", "pin"],
  ];
  const MUSIC_VISUALIZER_TYPES = ["particles", "aurora", "bokeh", "liquid", "imagekaleidoscope", "imagefloat", "particula", "motion", "led", "mirror", "bars", "waveform", "radial", "rings", "tunnel", "kaleidoscope", "off"];
  const MUSIC_VISUALIZER_STYLES = ["drift", "pulse", "nebula"];
  const MUSIC_VISUALIZER_FOCUS = ["soft", "sharp", "dream"];
  const INTERNAL_SETTINGS_APP_IDS = new Set(["file-uploads", "map-packs", "map-data", "game-data", "service-manager"]);
  const SETTINGS_SECTION_BY_APP_ID = {
    "file-uploads": "file-manager",
    "map-packs": "maps",
    "map-data": "maps",
    "game-data": "game-data",
    "service-manager": "plugins",
    "https-settings": "system",
  };

  const $ = (id) => document.getElementById(id);
  const state = {
    config: null,
    apps: [],
    appById: new Map(),
    layout: DEFAULT_LAYOUT,
    dockIds: [],
    currentView: "dashboard",
    history: [],
    currentAppId: "",
    currentFolder: null,
    passwordFolder: null,
    passwordAction: null,
    gps: null,
    lastMovingHeading: null,
    music: {
      library: [],
      visible: [],
      currentId: "",
      filter: { artist: "", album: "", folder: "" },
      repeatMode: "off",
      shuffle: false,
      detailMode: false,
      visualizer: MUSIC_VISUALIZER_TYPES.includes(localStorage.getItem("overlandMusicVisualizer") || "") ? localStorage.getItem("overlandMusicVisualizer") : "particles",
      visualizerStyle: MUSIC_VISUALIZER_STYLES.includes(localStorage.getItem("overlandMusicVisualizerStyle") || "") ? localStorage.getItem("overlandMusicVisualizerStyle") : "drift",
      visualizerFocus: MUSIC_VISUALIZER_FOCUS.includes(localStorage.getItem("overlandMusicVisualizerFocus") || "") ? localStorage.getItem("overlandMusicVisualizerFocus") : "soft",
      visualizerImageId: localStorage.getItem("overlandMusicVisualizerImageId") || "",
      visualizerImages: [],
      visualizerImage: null,
      controlBusy: false,
      restoreTime: 0,
      visualSeed: Array.from({ length: 36 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 3 + Math.random() * 16,
        s: .18 + Math.random() * .52,
        p: Math.random() * Math.PI * 2,
      })),
      audioContext: null,
      audioSource: null,
      analyser: null,
      analyserUnavailable: false,
      frequencyData: new Uint8Array(64),
      waveformData: new Uint8Array(128),
      particles: [],
      particulaParticles: [],
    },
    storage: {
      settings: {},
      locations: [],
      browseRoots: [],
      configPath: "",
      browserKey: "",
      browserPath: "",
      browserParentPath: null,
      browserSelectedPath: "",
    },
    settingsSection: sessionStorage.getItem("oiab:settings-section") || "music",
    services: [],
    containers: { available: false, containers: [], error: "" },
    maps: {
      installed: { active: "", basemaps: [] },
      catalog: { packs: [] },
      overlays: { overlays: [] },
      geopdfs: { maps: [] },
    },
    gameData: {
      scoreboard: null,
      activeGames: [],
      players: [],
      icons: [],
    },
  };

  function iconSvg(name) {
    const paths = {
      home: "M4 12 12 5l8 7v8h-5v-5H9v5H4z",
      apps: "M4 5h6v6H4zm10 0h6v6h-6zM4 15h6v6H4zm10 0h6v6h-6z",
      settings: "M19.4 13.5a7.8 7.8 0 0 0 .1-1.5 7.8 7.8 0 0 0-.1-1.5l2-1.5-2-3.4-2.4 1a8.7 8.7 0 0 0-2.6-1.5L14 2h-4l-.4 2.6A8.7 8.7 0 0 0 7 6.1l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0-.1 1.5c0 .5 0 1 .1 1.5l-2 1.5 2 3.4 2.4-1a8.7 8.7 0 0 0 2.6 1.5L10 22h4l.4-2.6a8.7 8.7 0 0 0 2.6-1.5l2.4 1 2-3.4zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z",
      back: "M14 5 7 12l7 7 1.5-1.5L11 13h8v-2h-8l4.5-4.5z",
      play: "M8 5v14l11-7z",
      pause: "M7 5h4v14H7zm6 0h4v14h-4z",
      prev: "M6 6h2v12H6zm3 6 9 6V6z",
      next: "M16 6h2v12h-2zm-10 6 9 6V6z",
      repeat: "M7 7h9.2l-2-2L15.6 3.6 20 8l-4.4 4.4-1.4-1.4 1-1H7v3H5V9a2 2 0 0 1 2-2zm10 8H7.8l2 2-1.4 1.4L4 14l4.4-4.4L9.8 11l-2 2H17v-3h2v3a2 2 0 0 1-2 2z",
      repeatOne: "M7 7h9.2l-2-2L15.6 3.6 20 8l-4.4 4.4-1.4-1.4 1-1H7v3H5V9a2 2 0 0 1 2-2zm10 8H7.8l2 2-1.4 1.4L4 14l4.4-4.4L9.8 11l-2 2H17v-3h2v3a2 2 0 0 1-2 2zm-5-1h1v5h-2v-3.2l-1 .6-.8-1.4z",
      shuffle: "M16.6 4.6 20 8l-3.4 3.4-1.4-1.4 1-1H15c-2.3 0-3.4 1.4-4.7 3.7C8.9 15.2 7.4 17 4 17v-2c2.2 0 3.2-1.1 4.6-3.5C10 8.9 11.7 7 15 7h1.2l-1-1 1.4-1.4zM4 7c2 0 3.4.7 4.5 2.1l-1.2 1.7C6.4 9.6 5.5 9 4 9V7zm9.1 6.5c.7.9 1.5 1.5 2.9 1.5h.2l-1-1 1.4-1.4L20 16l-3.4 3.4-1.4-1.4 1-1H16c-2.1 0-3.4-.8-4.4-2.1l1.5-1.4z",
      waypoint: "M12 2a6 6 0 0 0-6 6c0 4.5 6 13 6 13s6-8.5 6-13a6 6 0 0 0-6-6zm0 8.4A2.4 2.4 0 1 1 12 5.6a2.4 2.4 0 0 1 0 4.8z",
      folder: "M3 6h7l2 2h9v11H3z",
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.apps}"/></svg>`;
  }

  function setButtonIcon(id, name) {
    const el = $(id);
    if (el) el.innerHTML = iconSvg(name);
  }

  function safeJson(value, fallback) {
    try {
      const parsed = JSON.parse(value || "");
      return parsed || fallback;
    } catch {
      return fallback;
    }
  }

  function randomId() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function profile() {
    const saved = safeJson(localStorage.getItem(PROFILE_KEY), {});
    return { id: saved.id || randomId(), name: String(saved.name || "Player").trim().slice(0, 24) || "Player" };
  }

  function overlandDomain() {
    const host = window.location.hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host === "localhost") return "";
    const parts = host.split(".");
    if (parts.length > 2 && HOST_PREFIXES.includes(parts[0])) return parts.slice(1).join(".");
    return host;
  }

  function resolveUrl(url) {
    const domain = overlandDomain() || window.location.hostname;
    return String(url || "#").replaceAll("{{host}}", window.location.hostname).replaceAll("{{overland_domain}}", domain);
  }

  function appUrl(app) {
    if (!app) return "#";
    if (app.id === "maps" || app.id === "maps-v2") return "/maps-v2/?shell=1";
    if (app.id === "music" || app.native === "music") return "#music";
    const nativeUrl = NATIVE_APP_URLS[app.id];
    let url = nativeUrl || resolveUrl(app.url);
    if (app.category === "Games" || nativeUrl) {
      const player = profile();
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}playerId=${encodeURIComponent(player.id)}&playerName=${encodeURIComponent(player.name)}`;
    }
    if (url.startsWith("/") && !url.startsWith("//")) {
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}shell=1`;
    }
    return url;
  }

  function isHidden(appId) {
    return INTERNAL_SETTINGS_APP_IDS.has(appId) || (state.layout.hiddenAppIds || []).includes(appId);
  }

  function loadTheme() {
    return {
      accent: "#83dc8c",
      background: "topo",
      opacity: 82,
      blur: 16,
      ...safeJson(localStorage.getItem(THEME_KEY), {}),
    };
  }

  function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    applyTheme(theme);
  }

  function applyTheme(theme = loadTheme()) {
    const root = document.documentElement;
    root.style.setProperty("--uo-accent", theme.accent || "#83dc8c");
    root.style.setProperty("--uo-panel-alpha", String(Math.max(55, Math.min(96, Number(theme.opacity || 82))) / 100));
    root.style.setProperty("--uo-blur", `${Math.max(0, Math.min(28, Number(theme.blur || 16)))}px`);
    const palettes = {
      topo: ["#173a25", "#09140f"],
      dark: ["#172027", "#05080b"],
      amber: ["#3a2b16", "#120d08"],
      blue: ["#142f3f", "#071018"],
    };
    const [a, b] = palettes[theme.background] || palettes.topo;
    root.style.setProperty("--uo-bg-a", a);
    root.style.setProperty("--uo-bg-b", b);
    const accent = $("themeAccent");
    const background = $("themeBackground");
    const opacity = $("themeOpacity");
    const blur = $("themeBlur");
    if (accent) accent.value = theme.accent || "#83dc8c";
    if (background) background.value = theme.background || "topo";
    if (opacity) opacity.value = String(theme.opacity || 82);
    if (blur) blur.value = String(theme.blur || 16);
  }

  function updateClock() {
    const now = new Date();
    $("sidebarTime").textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    $("sidebarDate").textContent = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  async function loadConfig() {
    let lastError = null;
    for (const url of CONFIG_URLS) {
      try {
        const response = await fetch(url, { cache: "no-cache" });
        if (response.ok) return response.json();
        lastError = new Error(`${url}: ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No app config found.");
  }

  async function loadLayout() {
    try {
      const response = await fetch("/app-layout", { cache: "no-cache" });
      if (!response.ok) throw new Error(`app-layout ${response.status}`);
      const data = await response.json();
      return data.layout || DEFAULT_LAYOUT;
    } catch (error) {
      console.warn(error);
      return DEFAULT_LAYOUT;
    }
  }

  function normalizeApps(config) {
    state.config = config;
    state.apps = Array.isArray(config.apps) ? config.apps : [];
    state.appById = new Map(state.apps.map((app) => [app.id, app]));
    const savedDock = safeJson(localStorage.getItem(DOCK_KEY), null);
    const defaults = Array.isArray(config.defaultDock) ? config.defaultDock : state.apps.filter((app) => app.dock).map((app) => app.id);
    state.dockIds = Array.isArray(savedDock) && savedDock.length ? savedDock : defaults;
  }

  function appButton(app) {
    const button = document.createElement("button");
    button.className = `uo-app-button${app.id === state.currentAppId ? " is-active" : ""}`;
    button.type = "button";
    button.title = app.title;
    button.setAttribute("aria-label", app.title);
    const img = document.createElement("img");
    img.src = resolveUrl(app.icon || "");
    img.alt = "";
    button.append(img);
    button.addEventListener("click", () => openApp(app));
    return button;
  }

  function renderDock() {
    const dock = $("sidebarApps");
    const recent = safeJson(localStorage.getItem(RECENT_KEY), []);
    const ordered = [...recent, ...state.dockIds];
    const seen = new Set();
    const apps = ordered
      .map((id) => state.appById.get(id))
      .filter(Boolean)
      .filter((app) => !isHidden(app.id))
      .filter((app) => {
        if (seen.has(app.id)) return false;
        seen.add(app.id);
        return true;
      });
    dock.replaceChildren(...apps.slice(0, 3).map(appButton));
  }

  function renderDockSettings() {
    const box = $("dockSettings");
    if (!box) return;
    const choices = state.apps.filter((app) => !isHidden(app.id)).map((app) => {
      const label = document.createElement("label");
      label.className = "uo-dock-choice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.dockIds.includes(app.id);
      checkbox.addEventListener("change", () => {
        state.dockIds = checkbox.checked
          ? [...new Set([...state.dockIds, app.id])]
          : state.dockIds.filter((id) => id !== app.id);
        localStorage.setItem(DOCK_KEY, JSON.stringify(state.dockIds));
        renderDock();
      });
      const img = document.createElement("img");
      img.src = resolveUrl(app.icon || "");
      img.alt = "";
      const span = document.createElement("span");
      span.textContent = app.title;
      label.append(checkbox, img, span);
      return label;
    });
    box.replaceChildren(...choices);
  }

  function unloadLeavingApp(nextAppId = "") {
    if (state.currentView === "app" && state.currentAppId === "jellyfin" && nextAppId !== "jellyfin") {
      const frame = $("appFrame");
      if (frame) frame.src = "about:blank";
    }
  }

  function setView(view, options = {}) {
    if (state.currentView === "app" && view !== "app") unloadLeavingApp("");
    if (!options.replace && state.currentView !== view) state.history.push(state.currentView);
    state.currentView = view;
    if (view !== "app" && view !== "music") state.currentAppId = "";
    $("dashboardView").hidden = view !== "dashboard";
    $("appViewport").hidden = view !== "app";
    $("musicView").hidden = view !== "music";
    $("appsView").hidden = view !== "apps";
    $("settingsView").hidden = view !== "settings";
    $("homeButton").classList.toggle("is-active", view === "dashboard");
    $("appsButton").classList.toggle("is-active", view === "apps");
    $("settingsButton").classList.toggle("is-active", view === "settings");
    renderDock();
  }

  function goBack() {
    const previous = state.history.pop();
    if (previous) setView(previous, { replace: true });
    else setView("dashboard", { replace: true });
  }

  function goHome() {
    const frame = $("appFrame");
    if (frame) frame.src = "about:blank";
    state.history = [];
    state.currentAppId = "";
    state.music.detailMode = false;
    updateMusicUi();
    setView("dashboard", { replace: true });
  }

  function openApp(app) {
    if (!app) return;
    if (app.id === "overland-settings") {
      openSettingsProtected();
      return;
    }
    const settingsSection = SETTINGS_SECTION_BY_APP_ID[app.id];
    if (settingsSection) {
      openSettingsProtected(settingsSection);
      return;
    }
    if (app.id === "music" || app.native === "music") {
      state.currentAppId = "music";
      saveRecent("music");
      renderDock();
      setView("music");
      return;
    }
    const url = appUrl(app);
    if (!url || url === "#") return;
    unloadLeavingApp(app.id);
    if (app.openMode === "external") {
      saveRecent(app.id);
      renderDock();
      window.open(url, "_blank", "noopener");
      return;
    }
    state.currentAppId = app.id;
    $("appTitle").textContent = app.title || "App";
    $("appFrame").src = url;
    $("openExternal").href = url;
    saveRecent(app.id);
    setView("app");
  }

  function saveRecent(appId) {
    const app = state.appById.get(appId);
    if (!app || isHidden(app.id) || INTERNAL_SETTINGS_APP_IDS.has(app.id)) return;
    const recent = safeJson(localStorage.getItem(RECENT_KEY), []);
    localStorage.setItem(RECENT_KEY, JSON.stringify([appId, ...recent.filter((id) => id !== appId)].slice(0, 3)));
  }

  function renderAppCard(app) {
    const card = document.createElement("button");
    card.className = "uo-app-card";
    card.type = "button";
    const img = document.createElement("img");
    img.src = resolveUrl(app.icon || "");
    img.alt = "";
    const title = document.createElement("strong");
    title.textContent = app.title;
    card.append(img, title);
    card.addEventListener("click", () => openApp(app));
    return card;
  }

  function openFolder(folder) {
    if (folder.protected && state.layout.settingsPassword) {
      state.passwordFolder = folder;
      state.passwordAction = null;
      $("passwordInput").value = "";
      $("passwordError").textContent = "";
      $("passwordTitle").textContent = folder.title;
      $("passwordDialog").showModal();
      $("passwordInput").focus();
      return;
    }
    state.currentFolder = folder;
    renderApps();
  }

  function settingsPinTimeoutMinutes() {
    const raw = Number(state.layout.settingsPinTimeoutMinutes ?? 5);
    if (!Number.isFinite(raw)) return 5;
    return Math.max(0, Math.min(120, raw));
  }

  function settingsPinUnlocked() {
    const until = Number(sessionStorage.getItem(SETTINGS_UNLOCK_KEY) || "0");
    return Number.isFinite(until) && until > Date.now();
  }

  function rememberSettingsUnlock() {
    const minutes = settingsPinTimeoutMinutes();
    if (minutes <= 0) {
      sessionStorage.removeItem(SETTINGS_UNLOCK_KEY);
      return;
    }
    sessionStorage.setItem(SETTINGS_UNLOCK_KEY, String(Date.now() + minutes * 60 * 1000));
  }

  function clearSettingsUnlock() {
    sessionStorage.removeItem(SETTINGS_UNLOCK_KEY);
  }

  function openSettingsSection(section = "music") {
    state.currentAppId = "overland-settings";
    state.settingsSection = section;
    saveRecent("overland-settings");
    renderDock();
    setView("settings");
    renderSettingsSections();
  }

  function openSettingsProtected(section = "music") {
    sessionStorage.removeItem("oiab:settings-section");
    if (!state.layout.settingsPassword || settingsPinUnlocked()) {
      openSettingsSection(section);
      return;
    }
    state.passwordFolder = null;
    state.passwordAction = () => {
      rememberSettingsUnlock();
      openSettingsSection(section);
    };
    $("passwordInput").value = "";
    $("passwordError").textContent = "";
    $("passwordTitle").textContent = "Settings";
    $("passwordDialog").showModal();
    $("passwordInput").focus();
  }

  function renderSettingsSections() {
    const active = state.settingsSection || "music";
    document.querySelectorAll("[data-settings-section]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.settingsSection === active);
    });
    document.querySelectorAll("[data-settings-page]").forEach((page) => {
      const isActive = page.dataset.settingsPage === active;
      page.hidden = !isActive;
      page.classList.toggle("is-active", isActive);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
    if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    if (n >= 1024) return `${NUMBER_FMT.format(Math.round(n / 1024))} KB`;
    return `${NUMBER_FMT.format(n)} B`;
  }

  function formatTimestamp(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function badge(label, kind = "") {
    return `<span class="uo-settings-badge${kind ? ` ${kind}` : ""}">${escapeHtml(label)}</span>`;
  }

  function setSettingsMessage(id, text, error = false) {
    const node = $(id);
    if (!node) return;
    node.textContent = text || "";
    node.style.color = error ? "#ff8f87" : "";
  }

  async function gameDataApiRaw(payload = {}) {
    const response = await fetch("/game-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Game data request failed: ${response.status}`);
    return data;
  }

  async function gameDataApi(payload = { action: "scoreboard" }) {
    const data = await gameDataApiRaw(payload);
    return data.scoreboard || data;
  }

  function gameDataLabel(game = {}) {
    const labels = {
      "tic-tac-toe": "Tic-Tac-Toe",
      chess: "Chess",
      checkers: "Checkers",
      minesweeper: "Minesweeper",
      blockfall: "Blockfall Battle",
      claimline: "Territory Trace",
      "sinkhole-city": "Sinkhole City",
      "canyon-crawler": "Canyon Crawler",
      "orbit-run": "Orbit Run",
      "word-tile-arena": "Word Tile Arena",
      "blank-slate": "Blank Slate",
      "starts-ends": "Starts / Ends",
      "dice-roller": "Dice Roller",
      "dots-and-boxes": "Dots and Boxes",
      "connect-four": "Connect Four",
      burst: "Burst",
      battleship: "Battleship",
      hangman: "Hangman",
      "word-grid": "Word Grid",
      "pattern-match": "Pattern Match",
      trivia: "Trail Trivia",
    };
    return labels[game.type] || labels[game.game] || game.title || game.type || "Game";
  }

  function gameDataIconPath(icon) {
    return `/mobile/player-icons/${encodeURIComponent(icon || "compass")}.svg`;
  }

  function gameDataIsCpuIdentity(player = {}) {
    const id = String(player.id || "").toLowerCase();
    const raw = `${player.id || ""} ${player.name || ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const name = String(player.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return (
      id.startsWith("cpu-") ||
      id.startsWith("computereasy") ||
      id.startsWith("computermedium") ||
      id.startsWith("computerhard") ||
      raw === "cpu" ||
      raw.startsWith("cpu ") ||
      raw === "computer" ||
      raw.startsWith("computer ") ||
      name === "computer" ||
      name.startsWith("computer ")
    );
  }

  function renderGameDataSummary() {
    const board = state.gameData.scoreboard || {};
    const matches = Number(board.totals?.matches || 0);
    const scoredPlayers = Number(board.totals?.players || 0);
    const serverPlayers = (state.gameData.players || []).filter((player) => player.active !== false).length;
    const activeGames = state.gameData.activeGames || [];
    const leader = board.overall?.[0]?.name || "No leader yet";
    if ($("gameDataSummary")) $("gameDataSummary").textContent = `${matches} completed matches · leader: ${leader}`;
    if ($("gameDataMatchesBadge")) $("gameDataMatchesBadge").textContent = `${matches} match${matches === 1 ? "" : "es"}`;
    if ($("gameDataPlayersBadge")) $("gameDataPlayersBadge").textContent = `${serverPlayers || scoredPlayers} player${(serverPlayers || scoredPlayers) === 1 ? "" : "s"}`;
    if ($("gameDataActiveBadge")) $("gameDataActiveBadge").textContent = `${activeGames.length} active`;
  }

  function renderGameDataServerPlayers() {
    const holder = $("gameDataServerPlayers");
    if (!holder) return;
    const players = (state.gameData.players || []).filter((player) => player.active !== false);
    if (!players.length) {
      holder.innerHTML = `<article class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">No server players configured yet.</p></div></article>`;
    } else {
      holder.innerHTML = players.map((player) => `
        <article class="uo-settings-item uo-game-data-row">
          <div class="uo-settings-item-main">
            <div class="uo-settings-item-head">
              <img class="uo-game-player-icon" src="${escapeHtml(gameDataIconPath(player.icon))}" alt="">
              <h3 class="uo-settings-item-title">${escapeHtml(player.name || "Player")}</h3>
              <div class="uo-settings-item-meta">
                ${badge(player.icon || "compass")}
                ${player.aliases?.length ? badge(`${player.aliases.length} aliases`) : ""}
              </div>
            </div>
            <p class="uo-settings-item-path">${escapeHtml(player.id || "")}</p>
          </div>
          <div class="uo-settings-item-actions">
            <button type="button" class="is-danger" data-game-player-delete="${escapeHtml(player.id || "")}" data-game-player-name="${escapeHtml(player.name || "this player")}">Disable</button>
          </div>
        </article>
      `).join("");
      holder.querySelectorAll("[data-game-player-delete]").forEach((button) => {
        button.addEventListener("click", () => deleteGameDataServerPlayer(button.dataset.gamePlayerDelete || "", button.dataset.gamePlayerName || "this player"));
      });
    }
    const iconSelect = $("gameDataPlayerIcon");
    if (iconSelect) {
      const icons = state.gameData.icons?.length ? state.gameData.icons : ["compass"];
      iconSelect.innerHTML = icons.map((icon) => `<option value="${escapeHtml(icon)}">${escapeHtml(icon)}</option>`).join("");
    }
    renderGameDataSummary();
  }

  function renderGameDataActiveGames() {
    const holder = $("gameDataActiveGames");
    if (!holder) return;
    const games = state.gameData.activeGames || [];
    if (!games.length) {
      holder.innerHTML = `<article class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">No active saved games.</p></div></article>`;
      renderGameDataSummary();
      return;
    }
    holder.innerHTML = games.map((game) => {
      const players = (game.players || []).map((player) => `${player.name || "Player"} (${player.mark || "-"})`).join(" vs ") || "No players";
      const meta = [game.status, game.mode, game.difficulty].filter(Boolean).join(" · ");
      return `
        <article class="uo-settings-item uo-game-data-row">
          <div class="uo-settings-item-main">
            <div class="uo-settings-item-head">
              <h3 class="uo-settings-item-title">${escapeHtml(gameDataLabel(game))}</h3>
              <div class="uo-settings-item-meta">
                ${game.status ? badge(game.status) : ""}
                ${game.mode ? badge(game.mode) : ""}
                ${game.difficulty ? badge(game.difficulty) : ""}
              </div>
            </div>
            <p class="uo-settings-item-subtitle">${escapeHtml(players)}</p>
            <p class="uo-settings-item-path">${escapeHtml(meta)}${game.updated ? ` · ${escapeHtml(formatTimestamp(game.updated))}` : ""}</p>
          </div>
          <div class="uo-settings-item-actions">
            <button type="button" class="is-danger" data-game-clear="${escapeHtml(game.id || "")}" data-game-label="${escapeHtml(gameDataLabel(game))}">Clear</button>
          </div>
        </article>
      `;
    }).join("");
    holder.querySelectorAll("[data-game-clear]").forEach((button) => {
      button.addEventListener("click", () => clearGameDataActiveGame(button.dataset.gameClear || "", button.dataset.gameLabel || "game"));
    });
    renderGameDataSummary();
  }

  function renderGameDataIdentities() {
    const holder = $("gameDataIdentities");
    if (!holder) return;
    const players = (state.gameData.scoreboard?.players || []).filter((player) => !gameDataIsCpuIdentity(player));
    if (!players.length) {
      holder.innerHTML = `<article class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">No tracked score identities yet.</p></div></article>`;
      return;
    }
    holder.innerHTML = players.map((player) => `
      <article class="uo-settings-item uo-game-data-row">
        <div class="uo-settings-item-main">
          <div class="uo-settings-item-head">
            <h3 class="uo-settings-item-title">${escapeHtml(player.name || "Player")}</h3>
            <div class="uo-settings-item-meta">
              ${badge(`${player.played || 0} played`)}
              ${badge(`${player.points || 0} pts`)}
            </div>
          </div>
          <p class="uo-settings-item-path">${escapeHtml(player.id || "")}${player.aliases?.length ? ` · aliases: ${escapeHtml(player.aliases.join(", "))}` : ""}</p>
        </div>
      </article>
    `).join("");
  }

  function renderGameDataSettings() {
    renderGameDataSummary();
    renderGameDataServerPlayers();
    renderGameDataActiveGames();
    renderGameDataIdentities();
  }

  async function loadGameDataSettings() {
    setSettingsMessage("gameDataMessage", "Loading game data...");
    try {
      const [scoreboard, activeData, playersData] = await Promise.all([
        gameDataApi({ action: "scoreboard" }),
        gameDataApiRaw({ action: "active-games" }),
        gameDataApiRaw({ action: "players", includeInactive: true }),
      ]);
      state.gameData.scoreboard = scoreboard;
      state.gameData.activeGames = activeData.activeGames || [];
      state.gameData.players = playersData.players || [];
      state.gameData.icons = playersData.icons || [];
      renderGameDataSettings();
      setSettingsMessage("gameDataMessage", "");
    } catch (error) {
      setSettingsMessage("gameDataMessage", error.message, true);
    }
  }

  async function saveGameDataServerPlayer() {
    const name = $("gameDataPlayerName")?.value || "";
    const icon = $("gameDataPlayerIcon")?.value || "compass";
    setSettingsMessage("gameDataMessage", "Saving player...");
    try {
      const data = await gameDataApiRaw({ action: "save-player", player: { name, icon } });
      state.gameData.players = data.players || [];
      state.gameData.icons = data.icons || state.gameData.icons;
      if ($("gameDataPlayerName")) $("gameDataPlayerName").value = "";
      renderGameDataServerPlayers();
      setSettingsMessage("gameDataMessage", "Player saved.");
    } catch (error) {
      setSettingsMessage("gameDataMessage", error.message, true);
    }
  }

  async function deleteGameDataServerPlayer(playerId, name) {
    if (!playerId || !window.confirm(`Disable ${name || "this player"}?`)) return;
    setSettingsMessage("gameDataMessage", "Disabling player...");
    try {
      const data = await gameDataApiRaw({ action: "delete-player", playerId });
      state.gameData.players = data.players || [];
      state.gameData.icons = data.icons || state.gameData.icons;
      renderGameDataServerPlayers();
      setSettingsMessage("gameDataMessage", "Player disabled.");
    } catch (error) {
      setSettingsMessage("gameDataMessage", error.message, true);
    }
  }

  async function clearGameDataActiveGame(gameId, label) {
    if (!gameId || !window.confirm(`Clear saved ${label || "game"}? Score history will remain.`)) return;
    setSettingsMessage("gameDataMessage", "Clearing active game...");
    try {
      const data = await gameDataApiRaw({ action: "clear-active-game", gameId, settingsPassword: "" });
      state.gameData.activeGames = data.activeGames || [];
      renderGameDataActiveGames();
      setSettingsMessage("gameDataMessage", "Active game cleared.");
    } catch (error) {
      setSettingsMessage("gameDataMessage", error.message, true);
    }
  }

  async function clearAllGameDataActiveGames() {
    if (!window.confirm("Clear all active saved games? Score history will remain.")) return;
    setSettingsMessage("gameDataMessage", "Clearing active games...");
    try {
      const data = await gameDataApiRaw({ action: "clear-active-games", settingsPassword: "" });
      state.gameData.activeGames = data.activeGames || [];
      renderGameDataActiveGames();
      setSettingsMessage("gameDataMessage", "All active games cleared.");
    } catch (error) {
      setSettingsMessage("gameDataMessage", error.message, true);
    }
  }

  async function wipeGameDataScores() {
    const game = $("gameDataWipeGame")?.value || "tic-tac-toe";
    const label = game === "all" ? "all games" : gameDataLabel({ type: game });
    if (!window.confirm(`Wipe ${label} score history? Active games and player profiles will remain.`)) return;
    setSettingsMessage("gameDataMessage", "Wiping score history...");
    try {
      state.gameData.scoreboard = await gameDataApi({ action: "wipe", game, settingsPassword: "" });
      renderGameDataSettings();
      setSettingsMessage("gameDataMessage", "Score data wiped.");
    } catch (error) {
      setSettingsMessage("gameDataMessage", error.message, true);
    }
  }

  function renderFolderCard(folder) {
    const card = document.createElement("button");
    card.className = "uo-app-card";
    card.type = "button";
    const img = document.createElement("img");
    img.src = resolveUrl(folder.icon || "/maps/overland/overland-folder-games.svg");
    img.alt = "";
    const title = document.createElement("strong");
    title.textContent = folder.title;
    card.append(img, title);
    card.addEventListener("click", () => openFolder(folder));
    return card;
  }

  function renderApps() {
    const folders = state.layout.folders || [];
    const hidden = new Set([...(state.layout.hiddenAppIds || []), ...INTERNAL_SETTINGS_APP_IDS]);
    const inFolders = new Set(folders.flatMap((folder) => folder.appIds || []));
    let cards = [];
    if (state.currentFolder) {
      $("appsTitle").textContent = state.currentFolder.title;
      cards = (state.currentFolder.appIds || []).map((id) => state.appById.get(id)).filter(Boolean).filter((app) => !hidden.has(app.id)).map(renderAppCard);
    } else {
      $("appsTitle").textContent = "Apps";
      const loose = state.apps.filter((app) => !hidden.has(app.id) && !inFolders.has(app.id)).map(renderAppCard);
      cards = [...folders.map(renderFolderCard), ...loose];
    }
    $("appsGrid").replaceChildren(...cards);
  }

  function gameCard(game) {
    const card = document.createElement("button");
    card.className = "uo-app-card";
    card.type = "button";
    const app = state.appById.get(game.type) || state.appById.get("tic-tac-toe");
    const img = document.createElement("img");
    img.src = resolveUrl(app?.icon || "/mobile/tic-tac-toe.svg");
    img.alt = "";
    const title = document.createElement("strong");
    title.textContent = game.title || app?.title || "Open Game";
    card.append(img, title);
    card.addEventListener("click", () => {
      const player = profile();
      const base = appUrl(app || { id: "tic-tac-toe", url: "/mobile/tic-tac-toe.html", category: "Games" }).split("?")[0];
      openApp({ id: app?.id || "tic-tac-toe", title: title.textContent, url: `${base}?game=${encodeURIComponent(game.id)}&playerId=${encodeURIComponent(player.id)}&playerName=${encodeURIComponent(player.name)}` });
    });
    return card;
  }

  async function loadOpenGames() {
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const games = Array.isArray(data.games) ? data.games : [];
      $("openGamesPanel").hidden = games.length === 0;
      $("openGamesGrid").replaceChildren(...games.map(gameCard));
    } catch (error) {
      $("openGamesPanel").hidden = true;
    }
  }

  async function loadServicesSettings() {
    setSettingsMessage("pluginsSettingsMessage", "Loading plugins...");
    try {
      const [response, containersResponse] = await Promise.all([
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/containers", { cache: "no-store" }),
      ]);
      if (!response.ok) throw new Error(`services ${response.status}`);
      const data = await response.json();
      state.services = Array.isArray(data?.services) ? data.services : [];
      const containersData = await containersResponse.json().catch(() => ({}));
      state.containers = {
        available: Boolean(containersData?.available),
        containers: Array.isArray(containersData?.containers) ? containersData.containers : [],
        error: String(containersData?.error || ""),
      };
      renderServicesSettings();
      renderContainerSettings();
      setSettingsMessage("pluginsSettingsMessage", "");
    } catch (error) {
      console.warn(error);
      state.services = [];
      state.containers = { available: false, containers: [], error: error.message };
      renderServicesSettings();
      renderContainerSettings();
      setSettingsMessage("pluginsSettingsMessage", error.message, true);
    }
    const minecraft = state.services.find((service) => String(service?.id || "") === "minecraft");
    if ($("settingsNavMinecraft")) $("settingsNavMinecraft").hidden = !(minecraft?.installed || minecraft?.enabled || minecraft?.running);
  }

  function renderServicesSettings() {
    const holder = $("pluginsServices");
    if (!holder) return;
    if (!state.services.length) {
      holder.innerHTML = `<div class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">No plugin manifests were returned.</p></div></div>`;
      return;
    }
    holder.innerHTML = state.services.map((service) => {
      const installed = Boolean(service.installed);
      const enabled = Boolean(service.enabled);
      const running = Boolean(service.running || service.active || service.state === "active" || service.state === "running");
      const launcher = service.launcher_url ? `<a href="${escapeHtml(service.launcher_url)}"${String(service.id) === "minecraft" ? ` data-open-app="minecraft"` : ""}>Open</a>` : "";
      const adminLauncher = service.admin_url ? `<a href="${escapeHtml(service.admin_url)}">Admin</a>` : "";
      return `
        <article class="uo-settings-item">
          <div class="uo-settings-item-main">
            <div class="uo-settings-item-head">
              <h3 class="uo-settings-item-title">${escapeHtml(service.name || service.label || service.id)}</h3>
              <div class="uo-settings-item-meta">
                ${badge(installed ? "Installed" : "Available", installed ? "is-good" : "")}
                ${badge(enabled ? "Enabled" : "Disabled", enabled ? "is-good" : "")}
                ${badge(running ? "Running" : "Stopped", running ? "is-good" : "")}
                ${badge(service.runtime || "manual")}
              </div>
            </div>
            <p class="uo-settings-item-subtitle">${escapeHtml(service.description || "")}</p>
            ${service.notes ? `<p class="uo-settings-item-subtitle">${escapeHtml(service.notes)}</p>` : ""}
            ${service.data_path ? `<p class="uo-settings-item-path">Data: ${escapeHtml(service.data_path)}</p>` : ""}
            ${service.content_path ? `<p class="uo-settings-item-path">Content: ${escapeHtml(service.content_path)}</p>` : ""}
          </div>
          <div class="uo-settings-item-actions">
            <button type="button" data-service-action="install" data-service-id="${escapeHtml(service.id)}" class="is-primary"${installed ? " disabled" : ""}>Install</button>
            <button type="button" data-service-action="enable" data-service-id="${escapeHtml(service.id)}"${installed && !enabled ? "" : " disabled"}>Enable</button>
            <button type="button" data-service-action="disable" data-service-id="${escapeHtml(service.id)}"${enabled ? "" : " disabled"}>Disable</button>
            <button type="button" data-service-action="start" data-service-id="${escapeHtml(service.id)}"${installed && !running ? "" : " disabled"}>Start</button>
            <button type="button" data-service-action="stop" data-service-id="${escapeHtml(service.id)}"${running ? "" : " disabled"}>Stop</button>
            <button type="button" data-service-action="restart" data-service-id="${escapeHtml(service.id)}"${running ? "" : " disabled"}>Restart</button>
            <button type="button" data-service-action="remove" data-service-id="${escapeHtml(service.id)}" class="is-danger">Remove</button>
            ${launcher}
            ${adminLauncher}
          </div>
        </article>
      `;
    }).join("");
    holder.querySelectorAll("[data-service-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const serviceId = button.dataset.serviceId || "";
        const action = button.dataset.serviceAction || "";
        setSettingsMessage("pluginsSettingsMessage", `${action} ${serviceId}...`);
        try {
          const response = await fetch(`/api/services/${encodeURIComponent(serviceId)}/${encodeURIComponent(action)}`, { method: "POST" });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
          state.services = Array.isArray(data?.services) ? data.services : state.services;
          renderServicesSettings();
          const minecraft = state.services.find((service) => String(service?.id || "") === "minecraft");
          if ($("settingsNavMinecraft")) $("settingsNavMinecraft").hidden = !(minecraft?.installed || minecraft?.enabled || minecraft?.running);
          setSettingsMessage("pluginsSettingsMessage", `${serviceId} ${action} complete.`);
        } catch (error) {
          setSettingsMessage("pluginsSettingsMessage", error.message, true);
        }
      });
    });
    holder.querySelectorAll("[data-open-app]").forEach((link) => {
      link.addEventListener("click", (event) => {
        const app = state.appById.get(link.dataset.openApp);
        if (!app) return;
        event.preventDefault();
        openApp(app);
      });
    });
  }

  function renderContainerSettings() {
    const holder = $("pluginsContainers");
    if (!holder) return;
    if (!state.containers.available) {
      holder.innerHTML = `<div class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">${escapeHtml(state.containers.error || "Docker control is disabled.")}</p></div></div>`;
      return;
    }
    if (!state.containers.containers.length) {
      holder.innerHTML = `<div class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">No containers reported.</p></div></div>`;
      return;
    }
    holder.innerHTML = state.containers.containers.map((container) => {
      const running = String(container.state || "") === "running";
      const ports = Array.isArray(container.ports) ? container.ports.map((port) => port?.PublicPort ? `${port.PublicPort}:${port.PrivatePort}/${port.Type}` : `${port.PrivatePort}/${port.Type}`).join(", ") : "";
      return `
        <article class="uo-settings-item">
          <div class="uo-settings-item-main">
            <div class="uo-settings-item-head">
              <h3 class="uo-settings-item-title">${escapeHtml(container.name || "container")}</h3>
              <div class="uo-settings-item-meta">
                ${badge(container.state || "unknown", running ? "is-good" : "is-warn")}
                ${badge(container.status || "--")}
                ${badge(container.image || "image")}
              </div>
            </div>
            <p class="uo-settings-item-path">${escapeHtml(ports || "No published ports")}</p>
          </div>
          <div class="uo-settings-item-actions">
            <button type="button" data-container-action="start" data-container-name="${escapeHtml(container.name || "")}"${running ? " disabled" : ""}>Start</button>
            <button type="button" data-container-action="stop" data-container-name="${escapeHtml(container.name || "")}"${running ? "" : " disabled"}>Stop</button>
            <button type="button" data-container-action="restart" data-container-name="${escapeHtml(container.name || "")}"${running ? "" : " disabled"}>Restart</button>
          </div>
        </article>
      `;
    }).join("");
    holder.querySelectorAll("[data-container-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const name = button.dataset.containerName || "";
        const action = button.dataset.containerAction || "";
        setSettingsMessage("pluginsSettingsMessage", `${action} ${name}...`);
        try {
          const response = await fetch(`/api/containers/${encodeURIComponent(name)}/${encodeURIComponent(action)}`, { method: "POST" });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
          state.containers = {
            available: Boolean(data?.available),
            containers: Array.isArray(data?.containers) ? data.containers : [],
            error: String(data?.error || ""),
          };
          renderContainerSettings();
          setSettingsMessage("pluginsSettingsMessage", `${name} ${action} complete.`);
        } catch (error) {
          setSettingsMessage("pluginsSettingsMessage", error.message, true);
        }
      });
    });
  }

  async function loadMapsSettings() {
    setSettingsMessage("mapsPacksMessage", "Loading map packs...");
    setSettingsMessage("mapsOverlaysMessage", "Loading overlays...");
    setSettingsMessage("mapsOfflineRegionsMessage", "Loading offline regions...");
    setSettingsMessage("geopdfMessage", "Loading GeoPDF maps...");
    try {
      const [installedResponse, catalogResponse, overlaysResponse, geopdfResponse] = await Promise.all([
        fetch("/api/maps/packs/installed", { cache: "no-store" }),
        fetch("/api/maps/packs/catalog", { cache: "no-store" }),
        fetch("/api/maps/overlays", { cache: "no-store" }),
        fetch("/api/geopdf", { cache: "no-store" }),
      ]);
      const installed = await installedResponse.json().catch(() => ({}));
      const catalog = await catalogResponse.json().catch(() => ({}));
      const overlays = await overlaysResponse.json().catch(() => ({}));
      const geopdfs = await geopdfResponse.json().catch(() => ({}));
      if (!installedResponse.ok || installed.ok === false) throw new Error(installed.error || `packs ${installedResponse.status}`);
      if (!catalogResponse.ok || catalog.ok === false) throw new Error(catalog.error || `catalog ${catalogResponse.status}`);
      if (!overlaysResponse.ok || overlays.ok === false) throw new Error(overlays.error || `overlays ${overlaysResponse.status}`);
      if (!geopdfResponse.ok || geopdfs.ok === false) throw new Error(geopdfs.error || `geopdf ${geopdfResponse.status}`);
      state.maps.installed = installed;
      state.maps.catalog = catalog;
      state.maps.overlays = overlays;
      state.maps.geopdfs = geopdfs;
      renderMapsSettings();
      setSettingsMessage("mapsPacksMessage", "");
      setSettingsMessage("mapsOverlaysMessage", "");
      setSettingsMessage("mapsOfflineRegionsMessage", "");
      setSettingsMessage("geopdfMessage", "");
    } catch (error) {
      renderMapsSettings();
      setSettingsMessage("mapsPacksMessage", error.message, true);
      setSettingsMessage("mapsOverlaysMessage", error.message, true);
      setSettingsMessage("mapsOfflineRegionsMessage", error.message, true);
      setSettingsMessage("geopdfMessage", error.message, true);
    }
  }

  function renderMapsSettings() {
    renderMapPackSummary();
    renderInstalledMapPacks();
    renderCatalogMapPacks();
    renderOverlaySummary();
    renderMapOverlays();
    renderGeoPdfMaps();
    renderOfflineRegionSummary();
    renderOfflineRegions();
  }

  function renderMapPackSummary() {
    const holder = $("mapsActivePackSummary");
    if (!holder) return;
    const activeId = String(state.maps.installed?.active || "");
    const activePack = (state.maps.installed?.basemaps || []).find((pack) => String(pack.id || "") === activeId || pack.active);
    const installedCount = (state.maps.installed?.basemaps || []).filter((pack) => pack.installed || pack.exists || pack.active).length;
    if (!activePack) {
      holder.hidden = false;
      holder.innerHTML = `<strong>No active basemap</strong><span class="uo-settings-item-subtitle">Rescan local packs or install one from the catalog below.</span>`;
      return;
    }
    holder.hidden = false;
    holder.innerHTML = `
      <strong>${escapeHtml(activePack.name || activePack.id)}</strong>
      <div class="uo-settings-item-meta">
        ${badge("Active", "is-good")}
        ${badge(`${installedCount} installed`)}
        ${activePack.size_bytes ? badge(formatBytes(activePack.size_bytes)) : ""}
      </div>
      <span class="uo-settings-item-subtitle">${escapeHtml(activePack.attribution || "")}</span>
    `;
  }

  function renderInstalledMapPacks() {
    const holder = $("mapsInstalledPacks");
    if (!holder) return;
    const installedPacks = (state.maps.installed?.basemaps || []).filter((pack) => pack.installed || pack.exists || pack.active);
    if (!installedPacks.length) {
      holder.innerHTML = "";
      return;
    }
    holder.innerHTML = installedPacks.map((pack) => `
      <article class="uo-settings-item">
        <div class="uo-settings-item-main">
          <div class="uo-settings-item-head">
            <h3 class="uo-settings-item-title">${escapeHtml(pack.name || pack.id)}</h3>
            <div class="uo-settings-item-meta">
              ${badge(pack.active ? "Active" : "Installed", pack.active ? "is-good" : "")}
              ${pack.region_type ? badge(pack.region_type) : ""}
              ${pack.size_bytes ? badge(formatBytes(pack.size_bytes)) : ""}
            </div>
          </div>
          <p class="uo-settings-item-subtitle">${escapeHtml(pack.attribution || "")}</p>
          ${pack.path ? `<p class="uo-settings-item-path">${escapeHtml(pack.path)}</p>` : ""}
        </div>
        <div class="uo-settings-item-actions">
          <button type="button" data-pack-action="set-active" data-pack-id="${escapeHtml(pack.id || "")}" class="is-primary"${pack.active ? " disabled" : ""}>Set Active</button>
          <button type="button" data-pack-action="remove" data-pack-id="${escapeHtml(pack.id || "")}" class="is-danger">Remove</button>
        </div>
      </article>
    `).join("");
    bindPackActionButtons(holder);
  }

  function renderCatalogMapPacks() {
    const holder = $("mapsCatalogPacks");
    if (!holder) return;
    const installedIds = new Set((state.maps.installed?.basemaps || []).filter((pack) => pack.installed || pack.exists || pack.active).map((pack) => String(pack.id)));
    const catalog = Array.isArray(state.maps.catalog?.packs) ? state.maps.catalog.packs.filter((pack) => !pack.hidden) : [];
    const groups = [
      ["World", catalog.filter((pack) => pack.region_type === "world" && !installedIds.has(String(pack.id)))],
      ["United States", catalog.filter((pack) => pack.region_type === "country" && !installedIds.has(String(pack.id)))],
      ["States", catalog.filter((pack) => pack.region_type === "state" && !installedIds.has(String(pack.id)))],
      ["Other", catalog.filter((pack) => !["world", "country", "state"].includes(String(pack.region_type || "")) && !installedIds.has(String(pack.id)))],
    ].filter(([, packs]) => packs.length);
    const renderPackCard = (pack) => {
      const installable = Boolean(pack.install_available);
      return `
        <article class="uo-settings-item">
          <div class="uo-settings-item-main">
            <div class="uo-settings-item-head">
              <h4 class="uo-settings-item-title">${escapeHtml(pack.name || pack.id)}</h4>
              <div class="uo-settings-item-meta">
                ${badge(installable ? "Installable" : "Manual", installable ? "is-good" : "is-warn")}
                ${pack.recommended ? badge("Recommended", "is-good") : ""}
                ${pack.size_bytes ? badge(formatBytes(pack.size_bytes)) : ""}
              </div>
            </div>
            <p class="uo-settings-item-subtitle">${escapeHtml(pack.description || "")}</p>
          </div>
          <div class="uo-settings-item-actions">
            <button type="button" data-pack-action="install" data-pack-id="${escapeHtml(pack.id || "")}" class="is-primary"${installable ? "" : " disabled"}>${installable ? "Install" : "Manual"}</button>
          </div>
        </article>
      `;
    };
    holder.innerHTML = groups.map(([label, packs]) => {
      if (label === "States") {
        return `
          <details class="uo-settings-collapsible">
            <summary class="uo-settings-collapsible-summary">
              <span class="uo-settings-item-title">${escapeHtml(label)}</span>
              <span class="uo-settings-item-meta">${badge(`${packs.length} available`)}</span>
            </summary>
            <section class="uo-settings-item-grid">
              ${packs.map(renderPackCard).join("")}
            </section>
          </details>
        `;
      }
      return `
        <section class="uo-settings-item-grid">
          <h3 class="uo-settings-item-title">${escapeHtml(label)}</h3>
          ${packs.map(renderPackCard).join("")}
        </section>
      `;
    }).join("");
    bindPackActionButtons(holder);
  }

  function bindPackActionButtons(root) {
    root.querySelectorAll("[data-pack-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.packAction || "";
        const packId = button.dataset.packId || "";
        setSettingsMessage("mapsPacksMessage", `${action} ${packId}...`);
        try {
          const response = await fetch(`/api/maps/packs/${encodeURIComponent(action)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: packId }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
          await loadMapsSettings();
          setSettingsMessage("mapsPacksMessage", `${packId} ${action} complete.`);
        } catch (error) {
          setSettingsMessage("mapsPacksMessage", error.message, true);
        }
      });
    });
  }

  function renderOverlaySummary() {
    const holder = $("mapsOverlaySummary");
    if (!holder) return;
    const overlays = Array.isArray(state.maps.overlays?.overlays) ? state.maps.overlays.overlays : [];
    const enabled = overlays.filter((overlay) => overlay.enabled).length;
    const cached = overlays.filter((overlay) => overlay.cache_status === "cached").length;
    const onlineOnly = overlays.filter((overlay) => overlay.online_required).length;
    holder.hidden = false;
    holder.innerHTML = `
      <strong>${enabled} overlay${enabled === 1 ? "" : "s"} enabled</strong>
      <div class="uo-settings-item-meta">
        ${badge(`${cached} cached`)}
        ${badge(`${onlineOnly} online only`)}
        ${badge(`${overlays.length} total`)}
        ${badge(state.maps.overlays?.offline_regions_only ? "Offline regions only" : "Online fallback")}
      </div>
      <span class="uo-settings-item-subtitle">Visibility and opacity stay in the map layer menu. Data acquisition and refresh live here.</span>
    `;
  }

  function renderOfflineRegionSummary() {
    const holder = $("mapsOfflineRegionsSummary");
    if (!holder) return;
    const regions = Array.isArray(state.maps.overlays?.offline_regions) ? state.maps.overlays.offline_regions : [];
    const items = regions.flatMap((region) => Array.isArray(region.items) ? region.items : []);
    const cachedTiles = items.reduce((sum, item) => sum + Number(item.cached_tiles || 0), 0);
    const sizeBytes = items.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
    holder.hidden = false;
    holder.innerHTML = `
      <strong>${regions.length} offline region${regions.length === 1 ? "" : "s"}</strong>
      <div class="uo-settings-item-meta">
        ${badge(`${cachedTiles.toLocaleString()} tiles`)}
        ${sizeBytes ? badge(formatBytes(sizeBytes)) : ""}
        ${badge(state.maps.overlays?.offline_regions_only ? "Offline regions only" : "Online fallback")}
      </div>
      <label class="uo-switch-row">
        <span>
          <strong>Show only offline regions</strong>
          <small>Hide online raster fallback so you can verify cached coverage.</small>
        </span>
        <input id="mapsOfflineOnlyRegions" type="checkbox" ${state.maps.overlays?.offline_regions_only ? "checked" : ""}>
      </label>
    `;
    holder.querySelector("#mapsOfflineOnlyRegions")?.addEventListener("change", async (event) => {
      try {
        const response = await fetch("/api/maps/overlays/offline-only", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: event.target.checked }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || "Offline region toggle failed");
        state.maps.overlays = data;
        renderOverlaySummary();
        renderMapOverlays();
        renderOfflineRegionSummary();
        renderOfflineRegions();
        setSettingsMessage("mapsOfflineRegionsMessage", event.target.checked ? "Offline-only testing enabled." : "Online fallback restored.");
      } catch (error) {
        event.target.checked = !event.target.checked;
        setSettingsMessage("mapsOfflineRegionsMessage", error.message, true);
      }
    });
  }

  function renderMapOverlays() {
    const holder = $("mapsOverlaysList");
    if (!holder) return;
    const overlays = Array.isArray(state.maps.overlays?.overlays) ? state.maps.overlays.overlays : [];
    if (!overlays.length) {
      holder.innerHTML = `<div class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">No overlays registered.</p></div></div>`;
      return;
    }
    const availabilityBadge = (overlay) => {
      if (overlay.online_required) return badge("Online", "is-warn");
      if (overlay.cache_mode === "offline_pack") {
        return overlay.exists || overlay.cache_status === "cached"
          ? badge("Offline ready", "is-good")
          : badge("Offline build needed", "is-warn");
      }
      return badge("Offline ready", "is-good");
    };
    const providerFields = (overlay) => {
      const fields = Array.isArray(overlay.provider_fields) ? [...overlay.provider_fields] : [];
      if (overlay.source_url_env && !fields.some((field) => field?.key === "source_url")) {
        fields.push({
          key: "source_url",
          label: "Source URL",
          type: "url",
          env: overlay.source_url_env,
          value: overlay.configured_source_url || "",
          configured: Boolean(overlay.source_url_configured),
          help: "Use a direct GeoJSON, PMTiles, raster tile, or source package URL supported by this overlay."
        });
      }
      if (overlay.api_key_env && !fields.some((field) => field?.key === "api_key")) {
        fields.push({
          key: "api_key",
          label: "API Key",
          type: "password",
          env: overlay.api_key_env,
          secret: true,
          configured: Boolean(overlay.key_configured),
          help: "Stored locally in OIAB settings. Leave blank to keep the current saved/environment value."
        });
      }
      if (!fields.length) return "";
      return `
        <form class="uo-overlay-provider-form" data-overlay-settings-form data-overlay-id="${escapeHtml(overlay.id || "")}">
          <div class="uo-overlay-provider-grid">
            ${fields.map((field) => {
              const key = String(field.key || "");
              const label = String(field.label || key || "Setting");
              const type = field.secret ? "password" : String(field.type || "text");
              const placeholder = field.secret && field.configured
                ? "Configured; enter a new value to replace"
                : String(field.placeholder || field.env || "");
              return `
                <label class="uo-overlay-provider-field">
                  <span>
                    <strong>${escapeHtml(label)}</strong>
                    ${field.env ? `<small>${escapeHtml(field.env)}</small>` : ""}
                  </span>
                  <input
                    name="${escapeHtml(key)}"
                    type="${escapeHtml(type)}"
                    value="${escapeHtml(field.value || "")}"
                    placeholder="${escapeHtml(placeholder)}"
                    data-secret="${field.secret ? "true" : "false"}"
                    autocomplete="off"
                  >
                </label>
                ${field.help ? `<p class="uo-settings-item-subtitle">${escapeHtml(field.help)}</p>` : ""}
                ${field.source_url ? `<p class="uo-settings-item-subtitle"><a href="${escapeHtml(field.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(field.source_label || "Open provider instructions")}</a></p>` : ""}
              `;
            }).join("")}
          </div>
          <div class="uo-settings-item-actions">
            <button type="submit" class="is-primary">Save Source Settings</button>
          </div>
        </form>
      `;
    };
    const overlayControls = (overlay) => {
      const overlayId = String(overlay.id || "");
      const actionAvailable = Boolean(
        overlay.refresh_available ||
        overlay.refresh_action ||
        ["firms_active_hotspots", "nws_active_alerts", "mvum_roads_us", "mvum_trails_us", "blm_sma_cached", "blm_wilderness_wsa_cached"].includes(overlayId)
      );
      const missingSource = overlay.source_url_env && !overlay.source_url_configured && !(overlay.exists || overlay.cache_status === "cached");
      const missingKey = overlay.api_key_env && !overlay.key_configured && !(overlay.exists || overlay.cache_status === "cached");
      const missingTools = (overlay.missing_required_tools || overlay.missing_tools || []).length > 0 && !(overlay.exists || overlay.cache_status === "cached");
      const blocked = missingSource || missingKey || missingTools || overlay.install_status === "not_implemented";
      const actionLabel = overlay.exists || overlay.cache_status === "cached" ? "Update" : "Download";
      return `
        ${actionAvailable ? `<button type="button" data-overlay-action="refresh" data-overlay-id="${escapeHtml(overlay.id || "")}" class="is-primary" ${blocked ? "disabled" : ""}>${actionLabel}</button>` : ""}
        ${(overlay.exists || overlay.cache_status === "cached" || overlay.size_bytes) ? `<button type="button" data-overlay-action="clear-cache" data-overlay-id="${escapeHtml(overlay.id || "")}">Clear Cache</button>` : ""}
      `;
    };
    const categoryLabel = (category) => ({
      public_lands: "Land & Boundaries",
      water: "Water",
      topo: "Topo",
      weather: "Weather & Forecasts",
      wildfire: "Fire & Smoke",
      sky_satellite: "Sky & Satellite",
      imagery: "Sky & Satellite",
      camping_recreation: "Camping & Recreation",
      connectivity: "Connectivity",
      geopdf: "GeoPDF Maps",
      user: "User / Imported"
    })[category || "user"] || String(category || "User / Imported").replace(/_/g, " ");
    const overlayMeta = (overlay) => `
      ${badge(overlay.category || "overlay")}
      ${badge(overlay.cache_status || "unknown", overlay.cache_status === "cached" ? "is-good" : overlay.cache_status === "failed" ? "is-bad" : overlay.cache_status === "stale" ? "is-warn" : "")}
      ${badge(overlay.enabled ? "Enabled" : "Disabled", overlay.enabled ? "is-good" : "")}
      ${availabilityBadge(overlay)}
      ${overlay.size_bytes ? badge(formatBytes(overlay.size_bytes)) : ""}
    `;
    const overlayDetail = (overlay) => {
      const overlayId = String(overlay.id || "");
      return `
        <p class="uo-settings-item-subtitle">${escapeHtml(overlay.description || "")}</p>
        ${overlay.warning ? `<p class="uo-settings-item-subtitle is-warn">${escapeHtml(overlay.warning)}</p>` : ""}
        ${overlayId === "usgs_topographic_contours" ? `
          <p class="uo-settings-item-subtitle">Generated by Offline Data Regions.</p>
        ` : ""}
        ${(overlay.source_url_env && !overlay.source_url_configured && !(overlay.exists || overlay.cache_status === "cached")) ? `
          <p class="uo-settings-item-subtitle is-warn">${escapeHtml(overlay.source_url_env)} is not configured.</p>
        ` : ""}
        ${(overlay.api_key_env && !overlay.key_configured && !(overlay.exists || overlay.cache_status === "cached")) ? `
          <p class="uo-settings-item-subtitle is-warn">${escapeHtml(overlay.api_key_env)} is required for live refresh.</p>
        ` : ""}
        ${((overlay.missing_required_tools || overlay.missing_tools || []).length && !(overlay.exists || overlay.cache_status === "cached")) ? `
          <p class="uo-settings-item-subtitle is-warn">Missing tools: ${escapeHtml((overlay.missing_required_tools || overlay.missing_tools || []).join(", "))}.</p>
        ` : ""}
        ${(overlay.last_fetch_at || overlay.error_message) ? `
          <p class="uo-settings-item-subtitle">
            ${overlay.last_fetch_at ? `Updated ${escapeHtml(formatTimestamp(overlay.last_fetch_at))}. ` : ""}
            ${overlay.error_message ? `Error: ${escapeHtml(overlay.error_message)}` : ""}
          </p>` : ""}
        ${providerFields(overlay)}
      `;
    };
    const enabledCell = (overlay) => badge(overlay.enabled ? "Enabled" : "Disabled", overlay.enabled ? "is-good" : "");
    const statusCell = (overlay) => {
      const status = overlay.cache_status || overlay.install_status || "unknown";
      const tone = status === "cached" || status === "ready" || status === "installed"
        ? "is-good"
        : status === "failed"
          ? "is-bad"
          : status === "stale" || String(status).includes("needed") || String(status).includes("missing") || String(status).includes("not_configured")
            ? "is-warn"
            : "";
      return badge(status, tone);
    };
    const availabilityCell = (overlay) => availabilityBadge(overlay);
    const sizeCell = (overlay) => overlay.size_bytes ? escapeHtml(formatBytes(overlay.size_bytes)) : "—";
    const sourceInfo = (overlay) => {
      const links = Array.isArray(overlay.source_links) ? overlay.source_links : [];
      const instructions = overlay.source_instructions || overlay.metadata?.source_instructions || "";
      if (!instructions && !links.length) return "";
      return `
        <div class="uo-overlay-source-help">
          ${instructions ? `<p>${escapeHtml(instructions)}</p>` : ""}
          ${links.length ? `
            <div class="uo-overlay-source-links">
              ${links.map((link) => {
                const href = String(link?.url || "").trim();
                if (!href) return "";
                return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label || href)}</a>`;
              }).join("")}
            </div>
          ` : ""}
        </div>
      `;
    };
    const overlayItem = (overlay) => `
      <article class="uo-overlay-row">
        <div class="uo-overlay-cell uo-overlay-name">
          <strong>${escapeHtml(overlay.name || overlay.id)}</strong>
          <small>${escapeHtml(overlay.id || "")}</small>
        </div>
        <div class="uo-overlay-cell">${enabledCell(overlay)}</div>
        <div class="uo-overlay-cell">${statusCell(overlay)}</div>
        <div class="uo-overlay-cell">${availabilityCell(overlay)}</div>
        <div class="uo-overlay-cell uo-overlay-size">${sizeCell(overlay)}</div>
        <div class="uo-overlay-cell uo-overlay-actions">${overlayControls(overlay)}</div>
        <div class="uo-overlay-cell uo-overlay-detail-cell">
          <details class="uo-overlay-details">
            <summary>Details & Source</summary>
            <div class="uo-overlay-details-body">${sourceInfo(overlay)}${overlayDetail(overlay)}</div>
          </details>
        </div>
      </article>
    `;
    const topoIds = new Set(["usgs_topo", "usgs_topographic_contours"]);
    const topoOverlays = overlays.filter((overlay) => topoIds.has(String(overlay.id || "")));
    const remainingOverlays = overlays.filter((overlay) => !topoIds.has(String(overlay.id || "")));
    const categoryOrder = ["public_lands", "water", "weather", "wildfire", "sky_satellite", "imagery", "camping_recreation", "connectivity", "geopdf", "user"];
    const categoryKeys = [
      ...categoryOrder,
      ...[...new Set(remainingOverlays.map((overlay) => overlay.category || "user"))].filter((category) => !categoryOrder.includes(category)).sort()
    ];
    const groupedOverlays = categoryKeys
      .map((category) => [category, remainingOverlays.filter((overlay) => (overlay.category || "user") === category)])
      .filter(([, items]) => items.length);
    const topoGroup = topoOverlays.length ? `
      <section class="uo-overlay-table-section">
        <div class="uo-settings-card-head">
          <div><span class="uo-kicker">Topographic Layers</span></div>
          <div class="uo-settings-item-meta">${badge("topo")}${badge(`${topoOverlays.length} layer${topoOverlays.length === 1 ? "" : "s"}`)}</div>
        </div>
        <div class="uo-overlay-table">
          <div class="uo-overlay-table-head">
            <span>Overlay</span><span>Enabled</span><span>Status</span><span>Availability</span><span>Size</span><span>Actions</span><span>Settings</span>
          </div>
          ${topoOverlays.map(overlayItem).join("")}
        </div>
      </section>
    ` : "";
    holder.innerHTML = [
      topoGroup,
      ...groupedOverlays.map(([category, items]) => `
        <section class="uo-overlay-table-section">
          <div class="uo-settings-card-head">
            <div>
              <span class="uo-kicker">${escapeHtml(categoryLabel(category))}</span>
            </div>
            <div class="uo-settings-item-meta">${badge(`${items.length} overlay${items.length === 1 ? "" : "s"}`)}</div>
          </div>
          <div class="uo-overlay-table">
            <div class="uo-overlay-table-head">
              <span>Overlay</span><span>Enabled</span><span>Status</span><span>Availability</span><span>Size</span><span>Actions</span><span>Settings</span>
            </div>
            ${items.map(overlayItem).join("")}
          </div>
        </section>
      `)
    ].join("");
    holder.querySelectorAll("[data-overlay-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const overlayId = button.dataset.overlayId || "";
        const action = button.dataset.overlayAction || "";
        setSettingsMessage("mapsOverlaysMessage", `${action} ${overlayId}...`);
        try {
          if (action === "clear-cache") {
            const response = await fetch("/api/maps/overlays/clear-cache", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: overlayId }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
          } else if (action === "refresh") {
            const path = overlayId === "firms_active_hotspots"
              ? "/api/maps/overlays/wildfire/refresh"
              : overlayId === "nws_active_alerts"
                ? "/api/maps/overlays/weather/alerts/refresh"
                : overlayId === "blm_wilderness_wsa_cached"
                  ? "/api/maps/overlays/blm-wilderness/refresh"
                  : overlayId === "blm_sma_cached"
                    ? "/api/maps/overlays/blm/refresh"
                    : overlayId === "mvum_roads_us"
                      ? "/api/maps/overlays/mvum/roads/install"
                      : overlayId === "mvum_trails_us"
                        ? "/api/maps/overlays/mvum/trails/install"
                        : `/api/maps/overlays/${encodeURIComponent(overlayId)}/refresh`;
            const response = await fetch(path, { method: "POST" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
          }
          await loadMapsSettings();
          setSettingsMessage("mapsOverlaysMessage", `${overlayId} ${action} complete.`);
        } catch (error) {
          setSettingsMessage("mapsOverlaysMessage", error.message, true);
        }
      });
    });
    holder.querySelectorAll("[data-overlay-settings-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const overlayId = form.dataset.overlayId || "";
        const settings = {};
        form.querySelectorAll("input[name]").forEach((input) => {
          const key = input.name;
          const value = String(input.value || "").trim();
          if (input.dataset.secret === "true" && !value) return;
          settings[key] = value;
        });
        setSettingsMessage("mapsOverlaysMessage", `Saving ${overlayId} source settings...`);
        try {
          const response = await fetch("/api/maps/overlays/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: overlayId, settings }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || "Could not save overlay source settings");
          state.maps.overlays = data;
          renderOverlaySummary();
          renderMapOverlays();
          setSettingsMessage("mapsOverlaysMessage", `${overlayId} source settings saved.`);
        } catch (error) {
          setSettingsMessage("mapsOverlaysMessage", error.message, true);
        }
      });
    });
  }

  function geopdfStatusBadge(map) {
    const status = String(map.processing_status || map.status || map.metadata?.processing_status || "unknown");
    if (status === "complete") return badge("Ready", "is-good");
    if (status === "processing" || status === "pending") return badge(status, "is-warn");
    if (status === "failed") return badge("Failed", "is-bad");
    return badge(status);
  }

  function renderGeoPdfMaps() {
    const holder = $("geopdfList");
    if (!holder) return;
    const maps = Array.isArray(state.maps.geopdfs?.maps) ? state.maps.geopdfs.maps : [];
    if (!maps.length) {
      holder.innerHTML = `
        <article class="uo-settings-item">
          <div class="uo-settings-item-main">
            <p class="uo-settings-item-subtitle">No GeoPDF maps imported yet. Choose a georeferenced PDF and import it here.</p>
          </div>
        </article>
      `;
      return;
    }
    holder.innerHTML = maps.map((map) => {
      const id = String(map.id || "");
      const name = String(map.display_name || map.original_filename || id);
      const bounds = Array.isArray(map.bounds) ? map.bounds.map((value) => Number(value).toFixed(5)).join(", ") : "";
      const error = map.error_message || map.error || "";
      const updated = map.updated_at || map.updated || map.created_at || "";
      return `
        <article class="uo-settings-item">
          <div class="uo-settings-item-main">
            <div class="uo-settings-item-head">
              <h3 class="uo-settings-item-title">${escapeHtml(name)}</h3>
              <div class="uo-settings-item-meta">
                ${geopdfStatusBadge(map)}
                ${map.size_bytes ? badge(formatBytes(map.size_bytes)) : ""}
                ${map.minZoom != null && map.maxZoom != null ? badge(`z${map.minZoom}-${map.maxZoom}`) : ""}
              </div>
            </div>
            ${bounds ? `<p class="uo-settings-item-subtitle">Bounds: ${escapeHtml(bounds)}</p>` : ""}
            ${updated ? `<p class="uo-settings-item-subtitle">Updated ${escapeHtml(formatTimestamp(updated))}</p>` : ""}
            ${error ? `<p class="uo-settings-item-subtitle is-warn">Error: ${escapeHtml(error)}</p>` : ""}
          </div>
          <div class="uo-settings-item-actions">
            <button type="button" data-geopdf-action="rebuild" data-geopdf-id="${escapeHtml(id)}">Rebuild</button>
            <button type="button" data-geopdf-action="delete" data-geopdf-id="${escapeHtml(id)}" class="is-danger">Delete</button>
          </div>
        </article>
      `;
    }).join("");
    holder.querySelectorAll("[data-geopdf-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const mapId = button.dataset.geopdfId || "";
        const action = button.dataset.geopdfAction || "";
        if (!mapId) return;
        if (action === "delete" && !window.confirm("Delete this GeoPDF overlay and its tile cache?")) return;
        setSettingsMessage("geopdfMessage", `${action} ${mapId}...`);
        try {
          const response = await fetch(`/api/geopdf/${encodeURIComponent(mapId)}/${encodeURIComponent(action)}`, { method: "POST" });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
          await loadMapsSettings();
          setSettingsMessage("geopdfMessage", action === "rebuild" ? "GeoPDF rebuild started." : "GeoPDF deleted.");
        } catch (error) {
          setSettingsMessage("geopdfMessage", error.message, true);
        }
      });
    });
  }

  async function importGeoPdf(event) {
    event.preventDefault();
    const input = $("geopdfImportFile");
    const button = $("geopdfImportButton");
    const file = input?.files?.[0];
    if (!file) {
      setSettingsMessage("geopdfMessage", "Choose a georeferenced PDF first.", true);
      return;
    }
    const body = new FormData();
    body.append("file", file);
    if (button) button.disabled = true;
    setSettingsMessage("geopdfMessage", `Importing ${file.name}...`);
    try {
      const response = await fetch("/api/geopdf/import", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `GeoPDF import failed (${response.status})`);
      if (input) input.value = "";
      await loadMapsSettings();
      setSettingsMessage("geopdfMessage", "GeoPDF processing started. It will appear as an overlay when ready.");
    } catch (error) {
      setSettingsMessage("geopdfMessage", error.message, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderOfflineRegions() {
    const holder = $("mapsOfflineRegionsList");
    if (!holder) return;
    const regions = Array.isArray(state.maps.overlays?.offline_regions) ? state.maps.overlays.offline_regions : [];
    if (!regions.length) {
      holder.innerHTML = `<div class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">No offline regions saved yet. Draw a bbox on the map with the offline cache button to create one.</p></div></div>`;
      return;
    }
    holder.innerHTML = regions.map((region) => {
      const items = Array.isArray(region.items) ? region.items : [];
      const sizeBytes = items.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
      const tileCount = items.reduce((sum, item) => sum + Number(item.cached_tiles || 0), 0);
      const bbox = Array.isArray(region.bbox) ? region.bbox.map((value) => Number(value).toFixed(4)).join(", ") : "";
      return `
        <article class="uo-settings-item">
          <div class="uo-settings-item-main">
            <div class="uo-settings-item-head">
              <h3 class="uo-settings-item-title">${escapeHtml(region.name || region.id)}</h3>
              <div class="uo-settings-item-meta">
                ${badge(`${items.length} overlay${items.length === 1 ? "" : "s"}`)}
                ${badge(`${tileCount.toLocaleString()} tiles`)}
                ${sizeBytes ? badge(formatBytes(sizeBytes)) : ""}
              </div>
            </div>
            <p class="uo-settings-item-subtitle">${escapeHtml(bbox)}</p>
            <div class="uo-settings-item-meta">
              ${items.map((item) => badge(`${item.overlay_name}: ${item.status || "pending"}`, item.status === "cached" ? "is-good" : item.status === "failed" ? "is-bad" : item.status === "refreshing" ? "is-warn" : "")).join("")}
            </div>
            <p class="uo-settings-item-subtitle">Updated ${escapeHtml(formatTimestamp(region.updated_at))}</p>
          </div>
          <div class="uo-settings-item-actions">
            <button type="button" data-offline-region-action="refresh" data-region-id="${escapeHtml(region.id)}" class="is-primary">Update Cache</button>
            <button type="button" data-offline-region-action="delete" data-region-id="${escapeHtml(region.id)}">Clear Cache</button>
          </div>
        </article>
      `;
    }).join("");
    holder.querySelectorAll("[data-offline-region-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const regionId = String(button.dataset.regionId || "");
        const action = String(button.dataset.offlineRegionAction || "");
        const region = regions.find((item) => String(item.id || "") === regionId);
        if (!region) return;
        setSettingsMessage("mapsOfflineRegionsMessage", `${action} ${region.name || regionId}...`);
        try {
          const response = await fetch(action === "delete" ? "/api/maps/overlays/regions/delete" : "/api/maps/overlays/regions/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              region_id: region.id,
              name: region.name,
              bbox: region.bbox,
              overlay_ids: (Array.isArray(region.items) ? region.items : []).map((item) => item.overlay_id).filter(Boolean),
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
          state.maps.overlays = data;
          renderOverlaySummary();
          renderMapOverlays();
          renderOfflineRegionSummary();
          renderOfflineRegions();
          setSettingsMessage("mapsOfflineRegionsMessage", `${region.name || regionId} ${action === "delete" ? "cleared" : "update started"}.`);
        } catch (error) {
          setSettingsMessage("mapsOfflineRegionsMessage", error.message, true);
        }
      });
    });
  }

  function normalizeTrack(raw) {
    return {
      id: String(raw.id || raw.audioUrl || raw.path || ""),
      title: raw.title || raw.name || "Unknown Track",
      artist: raw.artist || "Unknown Artist",
      album: raw.album || "Unknown Album",
      folder: raw.playlist || raw.folder || "All Music",
      audioUrl: raw.audioUrl || raw.url || raw.path || "",
      coverUrl: raw.coverUrl || raw.artwork || raw.cover || FALLBACK_ART,
    };
  }

  async function loadMusicLibrary(refresh = false) {
    $("trackList").textContent = "Loading music library...";
    const response = await fetch(refresh ? "/music-api/library?refresh=1" : "/music-api/library", { cache: "no-store" });
    if (!response.ok) throw new Error(`music library ${response.status}`);
    const data = await response.json();
    const tracks = Array.isArray(data.tracks) ? data.tracks : Array.isArray(data.library) ? data.library : [];
    state.music.library = tracks.map(normalizeTrack).filter((track) => track.id && track.audioUrl);
    buildMusicFilters();
    applyMusicFilter();
    restoreMusicState();
  }

  function option(value, label) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    return opt;
  }

  function uniqueSorted(items) {
    return [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function buildMusicFilters() {
    const filters = [
      [$("artistFilter"), "artist", "Artists"],
      [$("albumFilter"), "album", "Albums"],
      [$("folderFilter"), "folder", "Folders"],
    ];
    for (const [select, key, label] of filters) {
      select.replaceChildren(option("", label), ...uniqueSorted(state.music.library.map((track) => track[key])).map((value) => option(value, value)));
      select.value = state.music.filter[key] || "";
      select.onchange = () => {
        state.music.filter = { artist: "", album: "", folder: "", [key]: select.value };
        buildMusicFilters();
        applyMusicFilter();
        persistMusicState();
      };
    }
  }

  function applyMusicFilter() {
    const active = Object.entries(state.music.filter).find(([, value]) => value);
    state.music.visible = active ? state.music.library.filter((track) => track[active[0]] === active[1]) : state.music.library;
    renderTrackList();
  }

  function renderTrackList() {
    const list = $("trackList");
    if (!state.music.visible.length) {
      list.textContent = "No music found. Use File Uploads to add MP3 files.";
      return;
    }
    const rows = state.music.visible.map((track) => {
      const row = document.createElement("button");
      row.className = `uo-track-row${track.id === state.music.currentId ? " is-active" : ""}`;
      row.type = "button";
      const img = document.createElement("img");
      img.src = track.coverUrl || FALLBACK_ART;
      img.alt = "";
      const text = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = track.title;
      const meta = document.createElement("span");
      meta.textContent = `${track.artist} - ${track.album}`;
      text.append(title, meta);
      row.append(img, text);
      row.addEventListener("click", () => playTrack(track.id));
      return row;
    });
    list.replaceChildren(...rows);
  }

  function currentTrack() {
    return state.music.library.find((track) => track.id === state.music.currentId) || null;
  }

  function setAudioTrack(track, autoplay = true) {
    const audio = $("globalAudio");
    if (!track) return;
    state.music.currentId = track.id;
    if (audio.src !== new URL(track.audioUrl, window.location.href).href) {
      audio.src = track.audioUrl;
      audio.load();
    }
    updateMusicUi();
    persistMusicState();
    if (autoplay) {
      ensureMusicAnalyser().finally(() => audio.play().catch((error) => console.warn(error)));
    }
  }

  function setMusicDetailMode(enabled) {
    state.music.detailMode = Boolean(enabled);
    updateMusicUi();
  }

  function playTrack(trackId) {
    const track = state.music.library.find((item) => item.id === trackId);
    setAudioTrack(track, true);
  }

  async function playPause() {
    const audio = $("globalAudio");
    if (state.music.controlBusy) return;
    state.music.controlBusy = true;
    if (!audio.src) {
      const first = state.music.visible[0] || state.music.library[0];
      if (first) setAudioTrack(first, true);
      state.music.controlBusy = false;
      return;
    }
    try {
      if (audio.paused) {
        await ensureMusicAnalyser();
        await audio.play();
      }
      else audio.pause();
    } catch (error) {
      console.warn(error);
    } finally {
      setTimeout(() => {
        state.music.controlBusy = false;
        updateMusicUi();
      }, 220);
    }
  }

  function nextTrack(direction = 1, wrap = true) {
    const list = state.music.visible.length ? state.music.visible : state.music.library;
    if (!list.length) return;
    if (state.music.shuffle && direction > 0 && list.length > 1) {
      const current = state.music.currentId;
      const choices = list.filter((track) => track.id !== current);
      setAudioTrack(choices[Math.floor(Math.random() * choices.length)], true);
      return;
    }
    const currentIndex = Math.max(0, list.findIndex((track) => track.id === state.music.currentId));
    const nextIndex = currentIndex + direction;
    if (!wrap && (nextIndex < 0 || nextIndex >= list.length)) return;
    const next = list[(nextIndex + list.length) % list.length];
    setAudioTrack(next, true);
  }

  function cycleRepeat() {
    const order = ["off", "one", "all"];
    state.music.repeatMode = order[(order.indexOf(state.music.repeatMode) + 1) % order.length];
    updateMusicUi();
    persistMusicState();
  }

  function toggleShuffle() {
    state.music.shuffle = !state.music.shuffle;
    updateMusicUi();
    persistMusicState();
  }

  function handleTrackEnded() {
    const audio = $("globalAudio");
    if (state.music.repeatMode === "one") {
      audio.currentTime = 0;
      audio.play().catch((error) => console.warn(error));
      return;
    }
    nextTrack(1, state.music.repeatMode === "all");
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }

  function updateMusicUi() {
    const audio = $("globalAudio");
    const track = currentTrack();
    const title = track?.title || "No track selected";
    const meta = track ? `${track.artist} - ${track.album}` : "Choose music from the library.";
    const art = track?.coverUrl || FALLBACK_ART;
    $("dashMusicTitle").textContent = title;
    $("dashMusicMeta").textContent = meta;
    $("dashMusicArt").src = art;
    $("musicTitle").textContent = title;
    $("musicMeta").textContent = meta;
    $("musicArt").src = art;
    $("musicDetailTitle").textContent = title;
    $("musicDetailArtist").textContent = track?.artist || "Unknown Artist";
    $("musicDetailAlbum").textContent = track?.album || "Unknown Album";
    $("musicDetailArt").src = art;
    $("dashPlay").innerHTML = iconSvg(audio.paused ? "play" : "pause");
    $("musicPlay").innerHTML = iconSvg(audio.paused ? "play" : "pause");
    const repeatIcon = state.music.repeatMode === "one" ? "repeatOne" : "repeat";
    const repeatLabel = state.music.repeatMode === "off" ? "Repeat off" : state.music.repeatMode === "one" ? "Repeat one" : "Repeat all";
    for (const id of ["dashRepeat", "musicRepeat"]) {
      const button = $(id);
      if (!button) continue;
      button.innerHTML = iconSvg(repeatIcon);
      button.classList.toggle("is-active", state.music.repeatMode !== "off");
      button.title = repeatLabel;
      button.setAttribute("aria-label", repeatLabel);
    }
    for (const id of ["dashShuffle", "musicShuffle"]) {
      const button = $(id);
      if (!button) continue;
      button.innerHTML = iconSvg("shuffle");
      button.classList.toggle("is-active", state.music.shuffle);
      button.title = state.music.shuffle ? "Shuffle on" : "Shuffle off";
      button.setAttribute("aria-label", button.title);
    }
    const value = audio.duration ? Math.round((audio.currentTime / audio.duration) * 1000) : 0;
    $("dashMusicProgress").value = value;
    $("musicSeek").value = value;
    $("musicElapsed").textContent = formatTime(audio.currentTime);
    $("musicDuration").textContent = formatTime(audio.duration);
    $("musicDetailProgress").value = value;
    $("musicDetailElapsed").textContent = formatTime(audio.currentTime);
    $("musicDetailDuration").textContent = formatTime(audio.duration);
    $("musicView").classList.toggle("is-detail-mode", state.music.detailMode);
    const musicLayout = document.querySelector("#musicView .uo-music-layout");
    if (musicLayout) musicLayout.hidden = state.music.detailMode;
    $("musicDetailView").hidden = !state.music.detailMode;
    renderTrackList();
  }

  function persistMusicState() {
    const audio = $("globalAudio");
    localStorage.setItem(MUSIC_KEY, JSON.stringify({
      currentId: state.music.currentId,
      currentTime: audio.currentTime || 0,
      filter: state.music.filter,
      repeatMode: state.music.repeatMode,
      shuffle: state.music.shuffle,
    }));
  }

  function restoreMusicState() {
    const saved = safeJson(localStorage.getItem(MUSIC_KEY), {});
    state.music.filter = { artist: "", album: "", folder: "", ...(saved.filter || {}) };
    state.music.repeatMode = ["off", "one", "all"].includes(saved.repeatMode) ? saved.repeatMode : "off";
    state.music.shuffle = Boolean(saved.shuffle);
    state.music.restoreTime = Number(saved.currentTime || 0);
    buildMusicFilters();
    applyMusicFilter();
    const track = state.music.library.find((item) => item.id === saved.currentId);
    if (track) setAudioTrack(track, false);
  }

  function persistVisualizerSettings() {
    localStorage.setItem("overlandMusicVisualizer", state.music.visualizer);
    localStorage.setItem("overlandMusicVisualizerStyle", state.music.visualizerStyle);
    localStorage.setItem("overlandMusicVisualizerFocus", state.music.visualizerFocus);
    localStorage.setItem("overlandMusicVisualizerImageId", state.music.visualizerImageId || "");
  }

  async function loadVisualizerImages(force = false) {
    if (state.music.visualizerImages.length && !force) return state.music.visualizerImages;
    const response = await fetch("/music-api/visualizer-images", { cache: "no-store" });
    if (!response.ok) throw new Error(`visualizer images ${response.status}`);
    const data = await response.json();
    state.music.visualizerImages = Array.isArray(data.images) ? data.images : [];
    if (!state.music.visualizerImages.some((image) => image.id === state.music.visualizerImageId)) {
      state.music.visualizerImageId = state.music.visualizerImages[0]?.id || "";
    }
    state.music.visualizerImages = state.music.visualizerImages.map((image) => {
      if (image?.url) {
        const img = new Image();
        img.src = image.url;
        return { ...image, _img: img };
      }
      return image;
    });
    state.music.visualizerImage = state.music.visualizerImages.find((image) => image.id === state.music.visualizerImageId) || null;
    persistVisualizerSettings();
    const select = $("musicVisualizerImage");
    if (select) {
      select.replaceChildren(
        new Option(state.music.visualizerImages.length ? "Select image" : "Upload images to media/visualizers", ""),
        ...state.music.visualizerImages.map((image) => new Option(image.name || image.filename || image.id, image.id)),
      );
      select.value = state.music.visualizerImageId || "";
    }
    return state.music.visualizerImages;
  }

  async function ensureMusicAnalyser() {
    const audio = $("globalAudio");
    if (!audio || state.music.analyser || state.music.analyserUnavailable) return state.music.analyser;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      state.music.analyserUnavailable = true;
      return null;
    }
    try {
      const context = state.music.audioContext || new AudioContextClass();
      state.music.audioContext = context;
      if (!state.music.audioSource) {
        state.music.audioSource = context.createMediaElementSource(audio);
        state.music.audioSource.connect(context.destination);
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      state.music.audioSource.connect(analyser);
      state.music.analyser = analyser;
      if (context.state !== "running") await context.resume().catch(() => {});
    } catch (error) {
      console.warn("Music visualizer analyser unavailable", error);
      state.music.analyserUnavailable = true;
      state.music.analyser = null;
    }
    return state.music.analyser;
  }

  function activeMusicAnalyser() {
    const analyser = state.music.analyser;
    if (!analyser) return null;
    if (state.music.audioContext?.state === "suspended") state.music.audioContext.resume().catch(() => {});
    return analyser;
  }

  function ensureMusicParticles() {
    const desired = state.music.visualizerStyle === "pulse" ? 18 : state.music.visualizerStyle === "nebula" ? 52 : 36;
    if (state.music.particles.length === desired) return;
    state.music.particles = Array.from({ length: desired }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: state.music.visualizerStyle === "pulse" ? 2 + Math.random() * 5 : .8 + Math.random() * 2.4,
      vx: -.0008 + Math.random() * .0016,
      vy: -.0008 + Math.random() * .0016,
      hue: particleHue(),
    }));
  }

  function musicVisualizerFrameData(audio) {
    const frequencyData = state.music.frequencyData;
    const waveformData = state.music.waveformData;
    let energy = audio && !audio.paused ? .35 : .12;
    const analyser = activeMusicAnalyser();
    if (analyser) {
      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(waveformData);
      energy = frequencyData.reduce((sum, value) => sum + value, 0) / (frequencyData.length * 255);
    } else if (audio && !audio.paused) {
      const t = audio.currentTime || performance.now() / 1000;
      energy = .28 + Math.sin(t * 2.7) * .08 + Math.sin(t * 7.9) * .04;
      for (let i = 0; i < frequencyData.length; i += 1) {
        frequencyData[i] = Math.max(0, Math.min(255, 72 + Math.sin(t * (1.2 + i * .035) + i * .7) * 44 + Math.sin(t * 4.1 + i * .19) * 24));
      }
      for (let i = 0; i < waveformData.length; i += 1) {
        waveformData[i] = Math.max(0, Math.min(255, 128 + Math.sin(t * 5.2 + i * .14) * 42));
      }
    } else {
      frequencyData.fill(0);
      waveformData.fill(128);
    }
    return { frequencyData, waveformData, energy: Math.max(.02, Math.min(1, energy)) };
  }

  function drawMusicCanvas(canvasId) {
    const canvas = $(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * pixelRatio));
    const height = Math.max(1, Math.floor(rect.height * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (state.music.visualizer === "off") {
      ctx.clearRect(0, 0, width, height);
      return;
    }
    ensureMusicParticles();
    const audio = $("globalAudio");
    const { frequencyData, waveformData, energy } = musicVisualizerFrameData(audio);
    const mode = state.music.visualizer;
    if (mode === "motion") {
      ctx.clearRect(0, 0, width, height);
      drawMotionSpectrum(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "aurora") {
      drawAuroraWash(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "bokeh") {
      ctx.clearRect(0, 0, width, height);
      drawBokehField(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "liquid") {
      drawLiquidColor(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "imagekaleidoscope") {
      ctx.clearRect(0, 0, width, height);
      drawImageKaleidoscope(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "imagefloat") {
      drawImageFloat(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "led") {
      ctx.clearRect(0, 0, width, height);
      drawLedBands(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "mirror") {
      ctx.clearRect(0, 0, width, height);
      drawMirrorSpectrum(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "bars") {
      ctx.clearRect(0, 0, width, height);
      drawBars(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "particula") {
      drawParticulaSphere(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "waveform") {
      ctx.clearRect(0, 0, width, height);
      drawWaveform(ctx, width, height, pixelRatio, waveformData, energy);
    } else if (mode === "radial") {
      ctx.clearRect(0, 0, width, height);
      drawRadial(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "rings") {
      ctx.clearRect(0, 0, width, height);
      drawRings(ctx, width, height, pixelRatio, energy);
    } else if (mode === "tunnel") {
      ctx.clearRect(0, 0, width, height);
      drawTunnel(ctx, width, height, pixelRatio, frequencyData, energy);
    } else if (mode === "kaleidoscope") {
      ctx.clearRect(0, 0, width, height);
      drawKaleidoscope(ctx, width, height, pixelRatio, frequencyData, energy);
    } else {
      ctx.clearRect(0, 0, width, height);
      drawParticles(ctx, width, height, pixelRatio, energy);
    }
  }

  function drawParticles(ctx, width, height, pixelRatio, energy) {
      state.music.particles.forEach(particle => {
          const speed = state.music.visualizerStyle === "nebula" ? 1.8 : 1
          particle.x = (particle.x + particle.vx * speed * (1 + energy * 3) + 1) % 1
          particle.y = (particle.y + particle.vy * speed * (1 + energy * 3) + 1) % 1
          const radius = (particle.r + energy * (state.music.visualizerStyle === "pulse" ? 16 : 7)) * pixelRatio
          const x = particle.x * width
          const y = particle.y * height
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 8)
          gradient.addColorStop(0, `hsla(${particle.hue}, 90%, 62%, ${.18 + energy * .2})`)
          gradient.addColorStop(1, `hsla(${particle.hue}, 90%, 62%, 0)`)
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x, y, radius * 8, 0, Math.PI * 2)
          ctx.fill()
      })
  }

  function drawAuroraWash(ctx, width, height, pixelRatio, data, energy) {
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = `rgba(0, 0, 0, ${.045 + energy * .035})`
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = "lighter"
      const time = Date.now() / 1000
      for (let band = 0; band < 9; band += 1) {
          const sample = data[(band * 5) % data.length] / 255 || energy
          const yBase = height * (.15 + band * .085)
          const hue = particleHue((band / 9 + time * .025) % 1)
          const alpha = .055 + sample * .16
          const amplitude = height * (.08 + sample * .12)
          ctx.beginPath()
          for (let step = 0; step <= 42; step += 1) {
              const x = (step / 42) * width
              const y = yBase + Math.sin(step * .62 + time * (.7 + band * .06)) * amplitude + Math.cos(step * .23 + band) * amplitude * .45
              if (step === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
          }
          ctx.lineWidth = (28 + sample * 64) * pixelRatio
          ctx.strokeStyle = `hsla(${hue}, 94%, ${58 + sample * 18}%, ${alpha})`
          ctx.stroke()
      }
      ctx.globalCompositeOperation = "source-over"
  }

  function drawBokehField(ctx, width, height, pixelRatio, data, energy) {
      const time = Date.now() / 1000
      const count = state.music.visualizerStyle === "nebula" ? 80 : 46
      for (let index = 0; index < count; index += 1) {
          const seed = Math.sin(index * 91.7) * 10000
          const x = ((Math.sin(seed) * 43758.5453 + time * (.012 + index % 5 * .002)) % 1 + 1) % 1
          const y = ((Math.cos(seed * 1.37) * 24634.6345 + time * (.008 + index % 7 * .0015)) % 1 + 1) % 1
          const sample = data[index % data.length] / 255 || energy
          const radius = (20 + (index % 9) * 9 + sample * 70) * pixelRatio
          const hue = particleHue((index / count + sample * .12) % 1)
          const gradient = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, radius)
          gradient.addColorStop(0, `hsla(${hue}, 92%, ${60 + sample * 18}%, ${.1 + sample * .18})`)
          gradient.addColorStop(1, `hsla(${hue}, 92%, 54%, 0)`)
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x * width, y * height, radius, 0, Math.PI * 2)
          ctx.fill()
      }
  }

  function drawLiquidColor(ctx, width, height, pixelRatio, data, energy) {
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = `rgba(0, 0, 0, ${.055 + energy * .025})`
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = "lighter"
      const time = Date.now() / 1000
      const blobs = state.music.visualizerStyle === "pulse" ? 7 : 11
      for (let index = 0; index < blobs; index += 1) {
          const sample = data[(index * 6) % data.length] / 255 || energy
          const x = width * (.5 + Math.sin(time * (.13 + index * .017) + index * 1.8) * (.24 + sample * .08))
          const y = height * (.5 + Math.cos(time * (.11 + index * .013) + index * 2.2) * (.26 + sample * .08))
          const radius = (Math.min(width, height) * (.18 + sample * .22)) * pixelRatio
          const hue = particleHue((index / blobs + time * .035) % 1)
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
          gradient.addColorStop(0, `hsla(${hue}, 90%, ${58 + sample * 20}%, ${.1 + sample * .18})`)
          gradient.addColorStop(.42, `hsla(${hue + 18}, 90%, 54%, ${.05 + sample * .1})`)
          gradient.addColorStop(1, `hsla(${hue}, 90%, 45%, 0)`)
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fill()
      }
      ctx.globalCompositeOperation = "source-over"
  }

  function drawImageKaleidoscope(ctx, width, height, pixelRatio, data, energy) {
      const image = (state.music.visualizerImage?._img || state.music.visualizerImage)
      if (!image?.complete || !image.naturalWidth) {
          drawBokehField(ctx, width, height, pixelRatio, data, energy)
          return
      }
      const time = Date.now() / 1000
      const segments = state.music.visualizerStyle === "pulse" ? 8 : state.music.visualizerStyle === "nebula" ? 14 : 10
      const radius = Math.hypot(width, height)
      const sample = data[4] / 255 || energy
      const zoom = 1.25 + sample * .45 + Math.sin(time * .23) * .08
      const crop = Math.min(image.naturalWidth, image.naturalHeight) / zoom
      const sx = (image.naturalWidth - crop) * (.5 + Math.sin(time * .07) * .16)
      const sy = (image.naturalHeight - crop) * (.5 + Math.cos(time * .06) * .16)

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = `rgba(0,0,0,${.05 + energy * .04})`
      ctx.fillRect(-width / 2, -height / 2, width, height)
      ctx.globalCompositeOperation = "lighter"
      for (let index = 0; index < segments; index += 1) {
          ctx.save()
          ctx.rotate((Math.PI * 2 * index) / segments + time * (.025 + energy * .04))
          if (index % 2) ctx.scale(1, -1)
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.arc(0, 0, radius, -Math.PI / segments, Math.PI / segments)
          ctx.closePath()
          ctx.clip()
          ctx.globalAlpha = .16 + sample * .12
          ctx.drawImage(image, sx, sy, crop, crop, -radius * .08, -radius * .5, radius, radius)
          ctx.restore()
      }
      ctx.globalCompositeOperation = "source-over"
      const vignette = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * .52)
      vignette.addColorStop(0, `rgba(255,255,255,${.035 + sample * .035})`)
      vignette.addColorStop(.6, "rgba(0,0,0,0)")
      vignette.addColorStop(1, "rgba(0,0,0,.3)")
      ctx.fillStyle = vignette
      ctx.fillRect(-width / 2, -height / 2, width, height)
      ctx.restore()
  }

  function drawImageFloat(ctx, width, height, pixelRatio, data, energy) {
      const image = (state.music.visualizerImage?._img || state.music.visualizerImage)
      if (!image?.complete || !image.naturalWidth) {
          drawBokehField(ctx, width, height, pixelRatio, data, energy)
          return
      }
      const time = Date.now() / 1000
      const count = state.music.visualizerStyle === "nebula" ? 38 : state.music.visualizerStyle === "pulse" ? 18 : 26
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = `rgba(0,0,0,${.045 + energy * .03})`
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = "lighter"
      for (let index = 0; index < count; index += 1) {
          const seed = Math.sin(index * 73.17) * 10000
          const sample = data[(index * 3) % data.length] / 255 || energy
          const drift = state.music.visualizerStyle === "pulse" ? .18 : state.music.visualizerStyle === "nebula" ? .34 : .24
          const x = width * (((Math.sin(seed) * 43758.54) % 1 + 1) % 1)
              + Math.sin(time * (.19 + index * .006) + seed) * width * drift
          const y = height * (((Math.cos(seed * 1.31) * 24634.63) % 1 + 1) % 1)
              + Math.cos(time * (.15 + index * .005) + seed) * height * drift
          const size = Math.min(width, height) * (.055 + (index % 5) * .012 + sample * .075)
          const rotation = time * (.05 + sample * .12) + index
          ctx.save()
          ctx.translate((x % width + width) % width, (y % height + height) % height)
          ctx.rotate(rotation)
          ctx.globalAlpha = .055 + sample * .18
          const drawSize = size * (state.music.visualizerStyle === "pulse" ? 1 + energy * 1.1 : 1 + sample * .55)
          ctx.drawImage(image, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
          ctx.restore()
      }
      ctx.globalCompositeOperation = "source-over"
  }

  // Inspired by Humprt/particula's MIT-licensed audio-reactive particle sphere,
  // adapted here as a local 2D canvas renderer to avoid CDN/Three.js dependencies.
  function drawParticulaSphere(ctx, width, height, pixelRatio, data, energy) {
      if (!state.music.particulaParticles.length) {
          state.music.particulaParticles = makeSphereParticles(2200)
      }
      const cx = width * .5
      const cy = height * .5
      const shortest = Math.min(width, height)
      const baseRadius = shortest * .2
      const haloRadius = shortest * .38
      const time = Date.now() / 1000
      const rotY = time * (.09 + energy * .2)
      const rotX = Math.sin(time * .13) * .32
      const cosY = Math.cos(rotY)
      const sinY = Math.sin(rotY)
      const cosX = Math.cos(rotX)
      const sinX = Math.sin(rotX)

      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = `rgba(0, 0, 0, ${state.music.visualizerStyle === "pulse" ? .18 : .1})`
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = "lighter"

      state.music.particulaParticles.forEach((particle, index) => {
          const band = data[index % data.length] / 255 || energy * .35
          const low = data[index % 9] / 255 || energy
          const turbulence = Math.sin(time * (.55 + particle.seed) + particle.seed * 19 + band * 8)
          const filament = Math.sin(time * .42 + particle.theta * 7 + particle.phi * 5)
          const spiral = time * (.16 + energy * .42) + particle.seed * 6
          const shellMix = particle.core ? baseRadius : haloRadius
          const radius = shellMix * particle.shell + (band * shortest * .12) + turbulence * shortest * .02
          const swirl = particle.core ? .18 + energy * .3 : .5 + low * .35
          let x = particle.x * radius + Math.cos(particle.theta + spiral) * shortest * .04 * swirl * filament
          let y = particle.y * radius + Math.sin(particle.phi * 3 + spiral) * shortest * .035 * swirl * turbulence
          let z = particle.z * radius + Math.sin(particle.theta - spiral) * shortest * .04 * swirl

          const xz = x * cosY - z * sinY
          const zz = x * sinY + z * cosY
          const yz = y * cosX - zz * sinX
          const z2 = y * sinX + zz * cosX
          const perspective = 1.25 / (1.25 + z2 / shortest)
          const screenX = cx + xz * perspective
          const screenY = cy + yz * perspective
          const depth = Math.max(.03, Math.min(1, (z2 / shortest + .68)))
          const size = Math.max(.36, (particle.size + band * 1.6 + low * 1.1) * pixelRatio * perspective)
          const hue = particle.particulaHue + band * 18
          const alpha = (particle.core ? .2 : .05) + depth * (particle.core ? .42 : .18) + band * .18
          ctx.fillStyle = `hsla(${hue}, 96%, ${particle.core ? 62 + band * 20 : 42 + band * 22}%, ${Math.min(.78, alpha)})`
          ctx.beginPath()
          ctx.arc(screenX, screenY, size, 0, Math.PI * 2)
          ctx.fill()

          if (particle.core && band + energy > .45) {
              const glow = size * (4 + band * 7)
              const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glow)
              gradient.addColorStop(0, `hsla(${hue}, 96%, 68%, ${.12 + band * .18})`)
              gradient.addColorStop(1, `hsla(${hue}, 96%, 52%, 0)`)
              ctx.fillStyle = gradient
              ctx.beginPath()
              ctx.arc(screenX, screenY, glow, 0, Math.PI * 2)
              ctx.fill()
          }
      })
      ctx.globalCompositeOperation = "source-over"
  }

  function makeSphereParticles(count) {
      return Array.from({length: count}, (_, index) => {
          const t = (index + .5) / count
          const inclination = Math.acos(1 - 2 * t)
          const azimuth = Math.PI * (1 + Math.sqrt(5)) * index
          const core = Math.random() > .32
          const shell = core ? .2 + Math.random() * .9 : .85 + Math.random() * .95
          const palette = Math.random()
          return {
              x: Math.sin(inclination) * Math.cos(azimuth),
              y: Math.sin(inclination) * Math.sin(azimuth),
              z: Math.cos(inclination),
              theta: azimuth,
              phi: inclination,
              shell,
              core,
              size: core ? .32 + Math.random() * 1.1 : .16 + Math.random() * .78,
              particulaHue: palette < .58 ? 28 + Math.random() * 25 : palette < .82 ? 278 + Math.random() * 32 : 348 + Math.random() * 30,
              seed: Math.random(),
          }
      })
  }

  function drawBars(ctx, width, height, pixelRatio, data, energy) {
      const bars = Math.min(48, data.length)
      const gap = 4 * pixelRatio
      const barWidth = Math.max(8 * pixelRatio, (width - gap * (bars - 1)) / bars)
      ctx.fillStyle = `rgba(0,0,0,${.05 + energy * .04})`
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = "lighter"
      for (let index = 0; index < bars; index += 1) {
          const value = easedBand(data, index, bars)
          const barHeight = height * (.22 + value * .88)
          const x = index * (barWidth + gap)
          const hue = particleHue(index / bars)
          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height)
          gradient.addColorStop(0, `hsla(${hue}, 94%, 66%, ${.04 + value * .16})`)
          gradient.addColorStop(.5, `hsla(${hue}, 94%, 54%, ${.08 + value * .18})`)
          gradient.addColorStop(1, `hsla(${hue}, 94%, 38%, 0)`)
          ctx.fillStyle = gradient
          roundRect(ctx, x, height - barHeight, barWidth, barHeight, 12 * pixelRatio)
          ctx.fill()
      }
      ctx.globalCompositeOperation = "source-over"
  }

  function drawMotionSpectrum(ctx, width, height, pixelRatio, data, energy) {
      const bands = 64
      const pad = width * .035
      const areaWidth = width - pad * 2
      const gap = 3 * pixelRatio
      const barWidth = Math.max(6 * pixelRatio, areaWidth / bands - gap)
      drawAnalyzerBackdrop(ctx, width, height, energy)
      ctx.globalCompositeOperation = "lighter"
      for (let index = 0; index < bands; index += 1) {
          const sample = easedBand(data, index, bands)
          const x = pad + index * (barWidth + gap)
          const h = Math.max(height * .18, Math.pow(sample, .68) * height * .9)
          const hue = particleHue(index / bands)
          const top = (height - h) * .5
          const grad = ctx.createLinearGradient(0, top, 0, top + h)
          grad.addColorStop(0, `hsla(${hue}, 98%, 68%, 0)`)
          grad.addColorStop(.5, `hsla(${hue}, 92%, 58%, ${.06 + sample * .24})`)
          grad.addColorStop(1, `hsla(${hue}, 92%, 38%, 0)`)
          ctx.fillStyle = grad
          roundRect(ctx, x, top, barWidth, h, 9 * pixelRatio)
          ctx.fill()
      }
      ctx.globalCompositeOperation = "source-over"
  }

  function drawLedBands(ctx, width, height, pixelRatio, data, energy) {
      const bands = 34
      const ledRows = 22
      const pad = width * .045
      const areaWidth = width - pad * 2
      const rowGap = 4 * pixelRatio
      const colGap = 6 * pixelRatio
      const cellWidth = Math.max(5 * pixelRatio, areaWidth / bands - colGap)
      const cellHeight = Math.max(5 * pixelRatio, height * .9 / ledRows - rowGap)
      const top = height * .05
      drawAnalyzerBackdrop(ctx, width, height, energy)
      ctx.globalCompositeOperation = "lighter"
      for (let index = 0; index < bands; index += 1) {
          const value = easedBand(data, index, bands)
          const lit = Math.max(1, Math.round(value * ledRows))
          const x = pad + index * (cellWidth + colGap)
          for (let row = 0; row < ledRows; row += 1) {
              const active = row < lit
              const y = top + (ledRows - row - 1) * (cellHeight + rowGap)
              const level = row / ledRows
              const hue = level > .76 ? 12 : level > .58 ? 42 : particleHue(index / bands)
              ctx.fillStyle = active
                  ? `hsla(${hue}, 96%, ${54 + level * 18}%, ${.035 + value * .2})`
                  : `rgba(255,255,255,${.012 + energy * .008})`
              roundRect(ctx, x, y, cellWidth, cellHeight, 3 * pixelRatio)
              ctx.fill()
          }
      }
      ctx.globalCompositeOperation = "source-over"
  }

  function drawMirrorSpectrum(ctx, width, height, pixelRatio, data, energy) {
      const bands = 70
      const pad = width * .035
      const areaWidth = width - pad * 2
      const center = height * .5
      const maxHeight = height * .56
      const gap = 3 * pixelRatio
      const barWidth = Math.max(5 * pixelRatio, areaWidth / bands - gap)
      drawAnalyzerBackdrop(ctx, width, height, energy)
      ctx.globalCompositeOperation = "lighter"
      for (let index = 0; index < bands; index += 1) {
          const value = easedBand(data, index, bands)
          const h = Math.max(2 * pixelRatio, Math.pow(value, .72) * maxHeight)
          const x = pad + index * (barWidth + gap)
          const hue = particleHue(index / bands)
          const gradTop = ctx.createLinearGradient(0, center - h, 0, center)
          gradTop.addColorStop(0, `hsla(${hue}, 96%, 60%, 0)`)
          gradTop.addColorStop(1, `hsla(${hue}, 96%, ${48 + value * 24}%, ${.06 + value * .24})`)
          ctx.fillStyle = gradTop
          roundRect(ctx, x, center - h, barWidth, h, 8 * pixelRatio)
          ctx.fill()
          const gradBottom = ctx.createLinearGradient(0, center, 0, center + h)
          gradBottom.addColorStop(0, `hsla(${hue}, 96%, ${48 + value * 24}%, ${.06 + value * .22})`)
          gradBottom.addColorStop(1, `hsla(${hue}, 96%, 60%, 0)`)
          ctx.fillStyle = gradBottom
          roundRect(ctx, x, center, barWidth, h, 8 * pixelRatio)
          ctx.fill()
      }
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = `rgba(255,255,255,${.035 + energy * .08})`
      ctx.lineWidth = pixelRatio
      ctx.beginPath()
      ctx.moveTo(pad, center)
      ctx.lineTo(width - pad, center)
      ctx.stroke()
  }

  function drawAnalyzerBackdrop(ctx, width, height, energy) {
      const bg = ctx.createRadialGradient(width * .5, height * .52, 0, width * .5, height * .52, Math.max(width, height) * .65)
      bg.addColorStop(0, `rgba(255,255,255,${.035 + energy * .035})`)
      bg.addColorStop(.55, "rgba(255,255,255,.018)")
      bg.addColorStop(1, "rgba(0,0,0,.18)")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)
  }

  function easedBand(data, index, total) {
      const normalized = index / Math.max(1, total - 1)
      const sourceIndex = Math.min(data.length - 1, Math.floor(Math.pow(normalized, 1.7) * (data.length - 1)))
      const value = data[sourceIndex] / 255
      return Math.max(.015, value)
  }

  function drawRings(ctx, width, height, pixelRatio, energy) {
      const cx = width * .5
      const cy = height * .52
      const time = Date.now() / 1000
      const maxRadius = Math.hypot(width, height) * .42
      for (let index = 0; index < 7; index += 1) {
          const phase = ((time * (.09 + energy * .24) + index / 7) % 1)
          const radius = (phase * maxRadius) + 32 * pixelRatio
          const alpha = Math.max(0, (1 - phase) * (.18 + energy * .36))
          ctx.strokeStyle = `hsla(${particleHue(index / 7)}, 96%, 64%, ${alpha})`
          ctx.lineWidth = (1.4 + energy * 5) * pixelRatio
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.stroke()
      }
  }

  function drawWaveform(ctx, width, height, pixelRatio, data, energy) {
      const mid = height * .5
      const amplitude = height * (.12 + energy * .25)
      ctx.lineWidth = (2 + energy * 5) * pixelRatio
      ctx.strokeStyle = `hsla(${particleHue(.7)}, 96%, 68%, .78)`
      ctx.shadowColor = `hsla(${particleHue(.45)}, 96%, 58%, .52)`
      ctx.shadowBlur = 18 * pixelRatio
      ctx.beginPath()
      data.forEach((value, index) => {
          const x = (index / (data.length - 1)) * width
          const y = mid + ((value - 128) / 128) * amplitude
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.shadowBlur = 0
  }

  function drawRadial(ctx, width, height, pixelRatio, data, energy) {
      const cx = width * .5
      const cy = height * .5
      const baseRadius = Math.min(width, height) * (.12 + energy * .08)
      const bars = Math.min(96, data.length)
      ctx.lineCap = "round"
      for (let index = 0; index < bars; index += 1) {
          const value = data[index % data.length] / 255
          const angle = (index / bars) * Math.PI * 2 - Math.PI / 2
          const inner = baseRadius + 12 * pixelRatio
          const outer = inner + (height * .18 * Math.max(value, energy * .2))
          const hue = particleHue(index / bars)
          ctx.strokeStyle = `hsla(${hue}, 96%, 64%, ${.35 + value * .6})`
          ctx.lineWidth = (2 + value * 5) * pixelRatio
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
          ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
          ctx.stroke()
      }
  }

  function drawTunnel(ctx, width, height, pixelRatio, data, energy) {
      const cx = width * .5
      const cy = height * .5
      const time = Date.now() / 1000
      const count = 90
      for (let index = 0; index < count; index += 1) {
          const value = data[index % data.length] / 255 || energy
          const depth = ((index / count + time * (.04 + energy * .08)) % 1)
          const angle = index * 2.399 + time * .35
          const radius = depth * Math.min(width, height) * .72
          const x = cx + Math.cos(angle) * radius
          const y = cy + Math.sin(angle) * radius
          const size = (1.5 + value * 5 + depth * 4) * pixelRatio
          ctx.fillStyle = `hsla(${particleHue(depth)}, 96%, ${58 + value * 20}%, ${Math.max(.06, 1 - depth)})`
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()
      }
  }

  function drawKaleidoscope(ctx, width, height, pixelRatio, data, energy) {
      const shortest = Math.min(width, height)
      const cell = Math.max(8 * pixelRatio, shortest / 42)
      const cols = Math.ceil(width / cell)
      const rows = Math.ceil(height / cell)
      const centerCol = cols / 2
      const centerRow = rows / 2
      const time = Date.now() / 620
      ctx.save()
      ctx.globalCompositeOperation = state.music.visualizerStyle === "nebula" ? "lighter" : "source-over"
      for (let row = 0; row <= centerRow; row += 1) {
          for (let col = 0; col <= centerCol; col += 1) {
              const distance = Math.hypot(col - centerCol, row - centerRow)
              const value = data[(Math.floor(distance * 2 + time) + row + col) % data.length] / 255 || energy
              const pulse = Math.sin(time * .9 + distance * .38)
              const alpha = Math.max(.05, Math.min(.68, value * .5 + energy * .34 + pulse * .08))
              const hue = particleHue((distance % 24) / 24)
              const size = cell * (.45 + value * .55)
              const x = col * cell
              const y = row * cell
              ctx.fillStyle = `hsla(${hue}, 96%, ${48 + value * 26}%, ${alpha})`
              drawMirroredPixel(ctx, x, y, width, height, size)
          }
      }
      ctx.restore()
  }

  function drawMirroredPixel(ctx, x, y, width, height, size) {
      const points = [
          [x, y],
          [width - x, y],
          [x, height - y],
          [width - x, height - y],
          [y, x],
          [width - y, x],
          [y, height - x],
          [width - y, height - x],
      ]
      points.forEach(([px, py]) => {
          ctx.fillRect(px - size / 2, py - size / 2, size, size)
      })
  }

  function roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.arcTo(x + width, y, x + width, y + height, radius)
      ctx.arcTo(x + width, y + height, x, y + height, radius)
      ctx.arcTo(x, y + height, x, y, radius)
      ctx.arcTo(x, y, x + width, y, radius)
      ctx.closePath()
  }

  function particleHue(offset=0) {
      if (Number.isFinite(offset) && offset > 0) {
          const bases = {
              amber: [15, 38],
              ocean: [190, 218],
              night: [206, 268],
              leather: [18, 30],
              brightgreen: [92, 118],
              caution: [20, 34],
              crimson: [354, 12],
              forest: [46, 134],
          }
          const pair = bases[(loadTheme().background || "forest")] || bases.forest
          return pair[0] + (pair[1] - pair[0]) * offset
      }
      if ((loadTheme().background || "forest") === "amber") return Math.random() > .45 ? 38 : 15
      if ((loadTheme().background || "forest") === "ocean") return Math.random() > .45 ? 190 : 218
      if ((loadTheme().background || "forest") === "night") return Math.random() > .45 ? 268 : 206
      if ((loadTheme().background || "forest") === "leather") return Math.random() > .45 ? 30 : 18
      if ((loadTheme().background || "forest") === "brightgreen") return Math.random() > .45 ? 118 : 92
      if ((loadTheme().background || "forest") === "caution") return Math.random() > .45 ? 34 : 20
      if ((loadTheme().background || "forest") === "crimson") return Math.random() > .45 ? 354 : 12
      return Math.random() > .55 ? 46 : 134
  }


  function animationLoop() {
    drawMusicCanvas("dashMusicCanvas");
    drawMusicCanvas("musicVisualizer");
    drawMusicCanvas("musicVisualizerPreview");
    requestAnimationFrame(animationLoop);
  }

  async function loadGps() {
    try {
      const response = await fetch("/maps-location-current", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      state.gps = await response.json();
      updateGpsUi();
    } catch {
      state.gps = null;
      updateGpsUi();
    }
  }

  function updateGpsUi() {
    const gps = state.gps;
    const valid = Boolean(gps?.valid && (gps.stable?.lat || gps.lat) && (gps.stable?.lon || gps.lon));
    $("gpsPill").textContent = valid ? "GPS" : "GPS?";
    $("gpsPill").classList.toggle("is-warn", !valid);
    $("dashGpsSource").textContent = valid ? (gps.active_source || gps.source || "GPS").replaceAll("_", " ").toUpperCase() : "No GPS lock";
    const stable = gps?.stable || gps || {};
    const speed = Math.round(Number(stable.speed_mph || gps?.speed_mph || 0));
    const rawHeading = Number(stable.heading_deg ?? gps?.heading_deg);
    const stationary = stable.stationary === true || speed < 2;
    if (!stationary && Number.isFinite(rawHeading)) state.lastMovingHeading = rawHeading;
    const heading = stationary ? state.lastMovingHeading : rawHeading;
    $("dashSpeed").textContent = String(speed);
    $("dashHeading").textContent = Number.isFinite(heading) ? `${Math.round(heading)}°` : "--°";
    if (Number.isFinite(heading)) $("dashCompassNeedle").style.setProperty("--heading", `${heading}deg`);
    $("dashGpsMeta").textContent = valid
      ? `${Number(stable.lat).toFixed(5)}, ${Number(stable.lon).toFixed(5)}`
      : "USB GPS preferred, browser fallback retained.";
  }

  function bestLocation() {
    const gps = state.gps;
    if (gps?.valid) {
      const stable = gps.stable || gps;
      const raw = gps.raw || {};
      if (Number.isFinite(Number(stable.lat)) && Number.isFinite(Number(stable.lon))) {
        return { source: gps.active_source || gps.source || "usb_gps", stable, raw, lat: Number(stable.lat), lon: Number(stable.lon) };
      }
    }
    return null;
  }

  function browserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) reject(new Error("Browser geolocation is unavailable."));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });
    });
  }

  function dateStamp() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async function saveWaypoint(type, label, icon) {
    const message = $("waypointMessage");
    message.textContent = "Saving...";
    let loc = bestLocation();
    if (!loc) {
      const position = await browserLocation();
      loc = {
        source: "browser",
        stable: { accuracy_m: position.coords.accuracy, timestamp: new Date(position.timestamp).toISOString() },
        raw: {},
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
    }
    const form = new FormData();
    form.set("name", `${label} - ${dateStamp()}`);
    form.set("lat", String(loc.lat));
    form.set("lon", String(loc.lon));
    form.set("folder", "Quick Save");
    form.set("category", type);
    form.set("icon", icon);
    form.set("color", "#ffd34e");
    form.set("source", loc.source);
    form.set("notes", `Saved from Overland In A Box using ${loc.source}.`);
    if (loc.stable.accuracy_m) form.set("accuracy_m", String(loc.stable.accuracy_m));
    if (loc.stable.hdop) form.set("hdop", String(loc.stable.hdop));
    if (loc.stable.heading_deg) form.set("heading_deg", String(loc.stable.heading_deg));
    if (loc.stable.speed_mph) form.set("speed_mph", String(loc.stable.speed_mph));
    if (loc.stable.timestamp) form.set("location_timestamp", String(loc.stable.timestamp));
    if (loc.stable.stabilized != null) form.set("stabilized", String(loc.stable.stabilized));
    if (loc.stable.stationary != null) form.set("stationary", String(loc.stable.stationary));
    if (loc.stable.stabilization_mode) form.set("stabilization_mode", String(loc.stable.stabilization_mode));
    if (loc.raw.lat) form.set("raw_lat", String(loc.raw.lat));
    if (loc.raw.lon) form.set("raw_lon", String(loc.raw.lon));
    if (loc.raw.accuracy_m) form.set("raw_accuracy_m", String(loc.raw.accuracy_m));
    if (loc.raw.hdop) form.set("raw_hdop", String(loc.raw.hdop));
    const response = await fetch("/maps-quick-save", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Save failed: ${response.status}`);
    message.textContent = `Saved ${label}.`;
    $("quickWaypointStatus").textContent = `Saved ${label} at ${dateStamp()}.`;
    setTimeout(() => $("waypointDialog").close(), 650);
  }

  function renderWaypointDialog() {
    const buttons = WAYPOINT_TYPES.map(([type, label, icon]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => saveWaypoint(type, label, icon).catch((error) => {
        $("waypointMessage").textContent = error.message;
      }));
      return button;
    });
    $("waypointTypes").replaceChildren(...buttons);
  }

  function setupEvents() {
    setButtonIcon("homeButton", "home");
    setButtonIcon("appsButton", "apps");
    setButtonIcon("settingsButton", "settings");
    setButtonIcon("backButton", "back");
    setButtonIcon("appsBack", "back");
    setButtonIcon("settingsBack", "back");
    setButtonIcon("dashPrev", "prev");
    setButtonIcon("dashPlay", "play");
    setButtonIcon("dashNext", "next");
    setButtonIcon("dashRepeat", "repeat");
    setButtonIcon("dashShuffle", "shuffle");
    setButtonIcon("musicPrev", "prev");
    setButtonIcon("musicPlay", "play");
    setButtonIcon("musicNext", "next");
    setButtonIcon("musicRepeat", "repeat");
    setButtonIcon("musicShuffle", "shuffle");
    setButtonIcon("quickWaypointPanel", "waypoint");

    $("homeButton").addEventListener("click", goHome);
    $("appsButton").addEventListener("click", () => { state.currentFolder = null; renderApps(); loadOpenGames(); setView("apps"); });
    $("settingsButton").addEventListener("click", openSettingsProtected);
    $("backButton").addEventListener("click", goBack);
    $("appsBack").addEventListener("click", () => {
      if (state.currentFolder) {
        state.currentFolder = null;
        renderApps();
      } else goBack();
    });
    $("settingsBack").addEventListener("click", goBack);
    document.querySelectorAll("[data-open-app]").forEach((link) => {
      link.addEventListener("click", (event) => {
        const app = state.appById.get(link.dataset.openApp);
        if (!app) return;
        event.preventDefault();
        openApp(app);
      });
    });
    document.querySelectorAll("[data-settings-section]").forEach((button) => {
      button.addEventListener("click", () => {
        state.settingsSection = button.dataset.settingsSection || "music";
        renderSettingsSections();
        if (state.settingsSection === "game-data") {
          loadGameDataSettings().catch((error) => setSettingsMessage("gameDataMessage", error.message, true));
        }
      });
    });
    $("gameDataRefresh")?.addEventListener("click", () => loadGameDataSettings().catch((error) => setSettingsMessage("gameDataMessage", error.message, true)));
    $("gameDataSavePlayer")?.addEventListener("click", saveGameDataServerPlayer);
    $("gameDataClearAllActive")?.addEventListener("click", clearAllGameDataActiveGames);
    $("gameDataWipeScores")?.addEventListener("click", wipeGameDataScores);
    document.querySelectorAll("[data-system-action]").forEach((link) => {
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        const action = link.dataset.systemAction || "";
        const label = action === "shutdown" ? "shut down" : "reboot";
        if (!window.confirm(`Really ${label} the Pi?`)) return;
        try {
          const response = await fetch(`/api/system/${action}`, { method: "POST" });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `${label} failed`);
        } catch (error) {
          window.alert(error.message || `${label} failed`);
        }
      });
    });
    $("appFrame").addEventListener("load", () => {
      try {
        const url = new URL($("appFrame").contentWindow.location.href);
        if (url.origin === window.location.origin && ["/", "/index.html", "/mobile/", "/mobile/index.html"].includes(url.pathname)) goHome();
      } catch {
        // Cross-origin services are allowed in the app frame when they support it.
      }
    });
    $("dashMapPanel").addEventListener("click", (event) => {
      if (event.target.closest("iframe")) return;
      openApp(state.appById.get("maps-v2") || state.appById.get("maps"));
    });
    $("dashMusicArtButton").addEventListener("click", (event) => {
      event.stopPropagation();
      setMusicDetailMode(false);
      state.currentAppId = "music";
      saveRecent("music");
      renderDock();
      setView("music");
    });
    $("dashMusicPanel").addEventListener("click", (event) => {
      if (event.target.closest("button") || event.target.closest("progress")) return;
      setMusicDetailMode(false);
      state.currentAppId = "music";
      saveRecent("music");
      renderDock();
      setView("music");
    });
    $("musicArtButton").addEventListener("click", (event) => {
      event.stopPropagation();
      setMusicDetailMode(true);
    });
    $("musicDetailArtButton").addEventListener("click", (event) => {
      event.stopPropagation();
      setMusicDetailMode(false);
    });
    $("quickWaypointPanel").addEventListener("click", () => {
      $("waypointMessage").textContent = "";
      $("waypointDialog").showModal();
    });
    $("passwordSubmit").addEventListener("click", () => {
      if ($("passwordInput").value === state.layout.settingsPassword) {
        $("passwordDialog").close();
        if (typeof state.passwordAction === "function") {
          const action = state.passwordAction;
          state.passwordAction = null;
          action();
        } else {
          state.currentFolder = state.passwordFolder;
          state.passwordFolder = null;
          renderApps();
        }
      } else $("passwordError").textContent = "Incorrect password.";
    });

    for (const id of ["dashPlay", "musicPlay"]) $(id).addEventListener("click", (event) => { event.stopPropagation(); playPause(); });
    for (const id of ["dashPrev", "musicPrev"]) $(id).addEventListener("click", (event) => { event.stopPropagation(); nextTrack(-1); });
    for (const id of ["dashNext", "musicNext"]) $(id).addEventListener("click", (event) => { event.stopPropagation(); nextTrack(1); });
    for (const id of ["dashRepeat", "musicRepeat"]) $(id).addEventListener("click", (event) => { event.stopPropagation(); cycleRepeat(); });
    for (const id of ["dashShuffle", "musicShuffle"]) $(id).addEventListener("click", (event) => { event.stopPropagation(); toggleShuffle(); });
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === "oiab:home") {
        goHome();
        return;
      }
      if (data.type !== "oiab:open-app") return;
      if (String(data.appId || "") === "overland-settings") {
        openSettingsProtected(data.settingsSection || "music");
        return;
      }
      const app = state.appById.get(String(data.appId || ""));
      if (app) openApp(app);
    });
    $("musicSeek").addEventListener("input", () => {
      const audio = $("globalAudio");
      if (audio.duration) audio.currentTime = (Number($("musicSeek").value) / 1000) * audio.duration;
    });
    $("musicDetailProgress").addEventListener("click", () => {
      setMusicDetailMode(false);
    });
    $("globalAudio").addEventListener("loadedmetadata", () => {
      if (state.music.restoreTime) {
        $("globalAudio").currentTime = Math.min(state.music.restoreTime, $("globalAudio").duration || state.music.restoreTime);
        state.music.restoreTime = 0;
      }
      updateMusicUi();
    });
    for (const eventName of ["play", "pause", "timeupdate", "ended", "durationchange"]) {
      $("globalAudio").addEventListener(eventName, () => {
        if (eventName === "ended") handleTrackEnded();
        updateMusicUi();
        if (eventName === "timeupdate") persistMusicState();
      });
    }
    $("rebuildMusicLibrary")?.addEventListener("click", async () => {
      const message = $("musicSettingsMessage");
      if (message) message.textContent = "Rebuilding music library...";
      try {
        await loadMusicLibrary(true);
        await loadVisualizerImages(true).catch(() => {});
        syncMusicSettingsUi();
        if (message) message.textContent = "Music library rebuilt.";
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    });
    $("musicVisualizerMode")?.addEventListener("change", () => {
      state.music.visualizer = $("musicVisualizerMode").value || "particles";
      persistVisualizerSettings();
    });
    $("musicVisualizerStyle")?.addEventListener("change", () => {
      state.music.visualizerStyle = $("musicVisualizerStyle").value || "drift";
      persistVisualizerSettings();
    });
    $("musicVisualizerFocus")?.addEventListener("change", () => {
      state.music.visualizerFocus = $("musicVisualizerFocus").value || "soft";
      persistVisualizerSettings();
    });
    $("musicVisualizerImage")?.addEventListener("change", () => {
      state.music.visualizerImageId = $("musicVisualizerImage").value || "";
      state.music.visualizerImage = state.music.visualizerImages.find((image) => image.id === state.music.visualizerImageId) || null;
      persistVisualizerSettings();
    });
    for (const [id, key] of [["themeAccent", "accent"], ["themeBackground", "background"], ["themeOpacity", "opacity"], ["themeBlur", "blur"]]) {
      $(id).addEventListener("input", () => saveTheme({ ...loadTheme(), [key]: $(id).value }));
    }
    if ($("map3dBuildings")) {
      $("map3dBuildings").checked = JSON.parse(localStorage.getItem(MAP_3D_BUILDINGS_KEY) || "false");
      $("map3dBuildings").addEventListener("change", () => {
        localStorage.setItem(MAP_3D_BUILDINGS_KEY, JSON.stringify($("map3dBuildings").checked));
      });
    }
    if ($("mapColorScheme")) {
      $("mapColorScheme").value = localStorage.getItem(MAP_THEME_KEY) === "dark" ? "dark" : "light";
      $("mapColorScheme").addEventListener("change", () => {
        localStorage.setItem(MAP_THEME_KEY, $("mapColorScheme").value === "dark" ? "dark" : "light");
      });
    }
    if ($("mapAutoRecording")) {
      $("mapAutoRecording").checked = JSON.parse(localStorage.getItem(MAP_AUTO_RECORDING_KEY) || "true");
      $("mapAutoRecording").addEventListener("change", async () => {
        const enabled = $("mapAutoRecording").checked;
        localStorage.setItem(MAP_AUTO_RECORDING_KEY, JSON.stringify(enabled));
        try {
          await fetch("/api/settings/app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ map_auto_recording: enabled }),
          });
        } catch (error) {
          console.warn(error);
        }
      });
    }
    if ($("saveSettingsPin")) {
      $("saveSettingsPin").addEventListener("click", async () => {
        const pin = String($("settingsPinInput")?.value || "").trim();
        const timeout = Number($("settingsPinTimeout")?.value ?? 5);
        const message = $("settingsPinMessage");
        if (pin && !/^\d{6}$/.test(pin)) {
          if (message) message.textContent = "PIN must be exactly 6 digits.";
          return;
        }
        if (!Number.isFinite(timeout) || timeout < 0 || timeout > 120) {
          if (message) message.textContent = "PIN timeout must be between 0 and 120 minutes.";
          return;
        }
        try {
          const body = { settings_pin_timeout_minutes: timeout };
          if (pin) body.settings_pin = pin;
          const response = await fetch("/api/settings/app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `settings ${response.status}`);
          if (pin) state.layout.settingsPassword = pin;
          state.layout.settingsPinTimeoutMinutes = timeout;
          clearSettingsUnlock();
          if (message) message.textContent = "PIN settings saved.";
          if ($("settingsPinInput")) $("settingsPinInput").value = "";
        } catch (error) {
          if (message) message.textContent = error.message;
        }
      });
    }
    if ($("saveNetworkSettings")) {
      $("saveNetworkSettings").addEventListener("click", saveNetworkSettings);
    }
    if ($("installRaspapButton")) $("installRaspapButton").addEventListener("click", () => runRaspapAction("install"));
    if ($("enableRaspapButton")) $("enableRaspapButton").addEventListener("click", () => runRaspapAction("enable"));
    if ($("disableRaspapButton")) $("disableRaspapButton").addEventListener("click", () => runRaspapAction("disable"));
    if ($("refreshRaspapButton")) $("refreshRaspapButton").addEventListener("click", () => runRaspapAction("refresh"));
    if ($("saveStorageSettings")) {
      $("saveStorageSettings").addEventListener("click", saveStorageSettings);
    }
    $("mapsRescanPacks")?.addEventListener("click", async () => {
      setSettingsMessage("mapsPacksMessage", "Rescanning local PMTiles...");
      try {
        const response = await fetch("/api/maps/packs/rescan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `rescan failed`);
        await loadMapsSettings();
        setSettingsMessage("mapsPacksMessage", "Map packs rescanned.");
      } catch (error) {
        setSettingsMessage("mapsPacksMessage", error.message, true);
      }
    });
    $("mapsRescanOverlays")?.addEventListener("click", async () => {
      setSettingsMessage("mapsOverlaysMessage", "Rescanning local overlays...");
      try {
        const response = await fetch("/api/maps/overlays/rescan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `overlay rescan failed`);
        await loadMapsSettings();
        setSettingsMessage("mapsOverlaysMessage", "Overlays rescanned.");
      } catch (error) {
        setSettingsMessage("mapsOverlaysMessage", error.message, true);
      }
    });
    $("geopdfImportForm")?.addEventListener("submit", importGeoPdf);
    $("storageBrowserRoots")?.addEventListener("change", () => browseStoragePath($("storageBrowserRoots").value));
    $("storageBrowserUp")?.addEventListener("click", () => {
      if (state.storage.browserParentPath) browseStoragePath(state.storage.browserParentPath);
    });
    $("storageBrowserChoose")?.addEventListener("click", () => {
      if (!state.storage.browserKey || !state.storage.browserPath) return;
      state.storage.settings[state.storage.browserKey] = state.storage.browserSelectedPath || state.storage.browserPath;
      const location = state.storage.locations.find((entry) => entry.key === state.storage.browserKey);
      if (location) location.value = state.storage.settings[state.storage.browserKey];
      renderStorageSettings();
      $("storageBrowserDialog").close();
      if ($("storageSettingsMessage")) $("storageSettingsMessage").textContent = `${location?.title || state.storage.browserKey} updated. Save Storage Paths to persist.`;
    });
    if ($("resetDock")) $("resetDock").addEventListener("click", () => {
      localStorage.removeItem(DOCK_KEY);
      state.dockIds = state.config.defaultDock || [];
      renderDockSettings();
      renderDock();
    });
    renderSettingsSections();
  }

  async function init() {
    applyTheme();
    setupEvents();
    renderWaypointDialog();
    updateClock();
    setInterval(updateClock, 1000);
    const [config, layout] = await Promise.all([loadConfig(), loadLayout()]);
    state.layout = layout;
    normalizeApps(config);
    loadAppSettings().catch((error) => console.warn(error));
    loadNetworkSettings().catch((error) => console.warn(error));
    loadServicesSettings().catch((error) => console.warn(error));
    loadMapsSettings().catch((error) => console.warn(error));
    loadGameDataSettings().catch((error) => setSettingsMessage("gameDataMessage", error.message, true));
    loadStorageSettings().catch((error) => {
      const message = $("storageSettingsMessage");
      if (message) message.textContent = error.message;
    });
    $("dashMapFrame").src = "/maps-v2/?shell=1";
    renderDock();
    renderApps();
    renderDockSettings();
    const initialSettingsSection = sessionStorage.getItem("oiab:settings-section") || new URLSearchParams(window.location.search).get("settings");
    if (initialSettingsSection) {
      state.settingsSection = initialSettingsSection;
      openSettingsProtected(initialSettingsSection);
    }
    loadOpenGames();
    setInterval(loadOpenGames, 7000);
    loadGps();
    setInterval(loadGps, 1500);
    loadMusicLibrary(false).catch((error) => $("trackList").textContent = error.message);
    loadVisualizerImages(false).then(() => syncMusicSettingsUi()).catch((error) => {
      const message = $("musicSettingsMessage");
      if (message) message.textContent = error.message;
    });
    animationLoop();
  }

  async function loadAppSettings() {
    const response = await fetch("/api/settings/app", { cache: "no-store" });
    if (!response.ok) throw new Error(`settings ${response.status}`);
    const data = await response.json();
    const enabled = data?.settings?.map_auto_recording !== false;
    localStorage.setItem(MAP_AUTO_RECORDING_KEY, JSON.stringify(enabled));
    if ($("mapAutoRecording")) $("mapAutoRecording").checked = enabled;
    const pin = data?.settings?.settings_pin;
    if (pin) state.layout.settingsPassword = String(pin);
    const timeout = Number(data?.settings?.settings_pin_timeout_minutes ?? 5);
    if (Number.isFinite(timeout)) state.layout.settingsPinTimeoutMinutes = Math.max(0, Math.min(120, timeout));
    if ($("settingsPinTimeout")) $("settingsPinTimeout").value = String(state.layout.settingsPinTimeoutMinutes);
  }

  const NETWORK_FIELD_MAP = {
    OIAB_ETH_IFACE: "networkEthIface",
    OIAB_AP_IFACE: "networkApIface",
    OIAB_WAN_WIFI_IFACE: "networkWanIface",
    OIAB_AP_SSID: "networkApSsid",
    OIAB_AP_PASSPHRASE: "networkApPassphrase",
    OIAB_AP_COUNTRY: "networkApCountry",
    OIAB_AP_CHANNEL: "networkApChannel",
    OIAB_AP_SUBNET: "networkApSubnet",
    OIAB_AP_IP: "networkApIp",
    OIAB_DHCP_RANGE: "networkDhcpRange",
  };

  function renderStorageSettings() {
    const holder = $("storageLocations");
    if (!holder) return;
    const rows = state.storage.locations.map((location) => {
      const row = document.createElement("div");
      row.className = "uo-storage-row";
      const label = document.createElement("label");
      const title = document.createElement("strong");
      title.textContent = location.title || location.key;
      const note = document.createElement("small");
      note.textContent = location.description || "";
      const value = document.createElement("div");
      value.className = "uo-storage-value";
      value.title = location.value || "";
      value.textContent = location.value || location.default || "--";
      label.append(title, note, value);

      const browse = document.createElement("button");
      browse.type = "button";
      browse.textContent = "Browse";
      browse.addEventListener("click", () => openStorageBrowser(location.key));
      row.append(label, browse);
      return row;
    });
    holder.replaceChildren(...rows);
  }

  async function loadStorageSettings() {
    const response = await fetch("/api/settings/storage", { cache: "no-store" });
    if (!response.ok) throw new Error(`storage settings ${response.status}`);
    const data = await response.json();
    state.storage.settings = { ...(data?.settings || {}) };
    state.storage.locations = Array.isArray(data?.locations) ? data.locations.map((location) => ({ ...location })) : [];
    state.storage.browseRoots = Array.isArray(data?.browse_roots) ? data.browse_roots : [];
    state.storage.configPath = data?.config_path || "";
    renderStorageSettings();
    if ($("storageSettingsMessage")) {
      $("storageSettingsMessage").textContent = state.storage.configPath ? `Saved at ${state.storage.configPath}. Apply with a redeploy/recreate.` : "";
    }
    const fileManagerRoot = state.storage.settings.OIAB_FILEBROWSER_ROOT || data?.settings?.OIAB_FILEBROWSER_ROOT || "";
    if ($("fileManagerRootNote")) {
      $("fileManagerRootNote").textContent = fileManagerRoot ? `Current root: ${fileManagerRoot}` : "";
    }
  }

  async function saveStorageSettings() {
    const message = $("storageSettingsMessage");
    try {
      const response = await fetch("/api/settings/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: state.storage.settings }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `storage settings ${response.status}`);
      state.storage.settings = { ...(data?.settings || {}) };
      state.storage.locations = Array.isArray(data?.locations) ? data.locations.map((location) => ({ ...location })) : [];
      state.storage.browseRoots = Array.isArray(data?.browse_roots) ? data.browse_roots : state.storage.browseRoots;
      state.storage.configPath = data?.config_path || state.storage.configPath;
      renderStorageSettings();
      if (message) message.textContent = `Saved at ${state.storage.configPath}. Recreate OIAB to apply new bind mounts.`;
    } catch (error) {
      if (message) message.textContent = error.message;
    }
  }

  function syncStorageBrowserUi(data) {
    state.storage.browserPath = data.current_path || "";
    state.storage.browserParentPath = data.parent_path || null;
    state.storage.browserSelectedPath = data.current_path || "";
    const roots = Array.isArray(data.roots) ? data.roots : state.storage.browseRoots;
    state.storage.browseRoots = roots;
    if ($("storageBrowserCurrentPath")) $("storageBrowserCurrentPath").textContent = state.storage.browserPath;
    const rootSelect = $("storageBrowserRoots");
    if (rootSelect) {
      rootSelect.replaceChildren(...roots.map((root) => new Option(root, root)));
      const selectedRoot = roots.find((root) => state.storage.browserPath === root || state.storage.browserPath.startsWith(`${root}/`)) || roots[0] || "";
      rootSelect.value = selectedRoot;
    }
    if ($("storageBrowserUp")) $("storageBrowserUp").disabled = !state.storage.browserParentPath;
    const list = $("storageBrowserList");
    if (!list) return;
    const rows = (data.directories || []).map((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "uo-storage-browser-item";
      button.innerHTML = `<span><strong>${entry.name}</strong><small>${entry.path}</small></span><span>Open</span>`;
      button.addEventListener("click", () => browseStoragePath(entry.path));
      return button;
    });
    const current = document.createElement("button");
    current.type = "button";
    current.className = "uo-storage-browser-item is-current";
    current.innerHTML = `<span><strong>Use current folder</strong><small>${state.storage.browserPath}</small></span><span>Selected</span>`;
    current.addEventListener("click", () => {
      state.storage.browserSelectedPath = state.storage.browserPath;
      if ($("storageBrowserMessage")) $("storageBrowserMessage").textContent = `Selected ${state.storage.browserSelectedPath}`;
    });
    list.replaceChildren(current, ...rows);
  }

  async function browseStoragePath(path) {
    const message = $("storageBrowserMessage");
    if (message) message.textContent = "Loading folders...";
    try {
      const response = await fetch(`/api/settings/storage/browse?path=${encodeURIComponent(path || "")}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `browse ${response.status}`);
      syncStorageBrowserUi(data);
      if (message) message.textContent = "";
    } catch (error) {
      if (message) message.textContent = error.message;
    }
  }

  async function openStorageBrowser(key) {
    const location = state.storage.locations.find((entry) => entry.key === key);
    state.storage.browserKey = key;
    if ($("storageBrowserTitle")) $("storageBrowserTitle").textContent = location ? `Choose ${location.title}` : "Choose Folder";
    if ($("storageBrowserNote")) $("storageBrowserNote").textContent = location?.description || "Select a host directory for this data location.";
    $("storageBrowserDialog").showModal();
    await browseStoragePath(state.storage.settings[key] || location?.value || state.storage.browseRoots[0] || "/srv");
  }

  async function loadNetworkSettings() {
    const response = await fetch("/api/settings/network", { cache: "no-store" });
    if (!response.ok) throw new Error(`network settings ${response.status}`);
    const data = await response.json();
    const settings = data?.settings || {};
    for (const [key, id] of Object.entries(NETWORK_FIELD_MAP)) {
      if ($(id)) $(id).value = settings[key] || "";
    }
    if ($("openRaspapLink")) $("openRaspapLink").href = data?.raspap?.launch_url || "/raspap-launch";
    if ($("networkRaspapMessage")) {
      const summary = data?.raspap?.summary || "RaspAP is the preferred network UI for AP and uplink control.";
      const configured = data?.raspap?.configured_url ? ` Configured URL: ${data.raspap.configured_url}.` : ` Launch URL: ${data?.raspap?.launch_url || "/raspap-launch"}.`;
      const status = data?.raspap?.installed
        ? ` Installed: yes. Helper: ${data?.raspap?.enabled ? "enabled" : "disabled"}. Mode: ${data?.raspap?.mode || "unknown"}. Hotspot: ${data?.raspap?.hotspot_active ? "active" : "inactive"}. Wi-Fi radio: ${data?.raspap?.wifi_radio || "unknown"}.`
        : " Installed: no.";
      $("networkRaspapMessage").textContent = `${summary} Protected admin UI.${configured}${status} ${data?.raspap?.message || ""}`.trim();
    }
    if ($("installRaspapButton")) $("installRaspapButton").disabled = !!data?.raspap?.installed;
    if ($("enableRaspapButton")) $("enableRaspapButton").disabled = !data?.raspap?.installed || !!data?.raspap?.enabled;
    if ($("disableRaspapButton")) $("disableRaspapButton").disabled = !data?.raspap?.installed || !data?.raspap?.enabled;
    if ($("networkSettingsMessage")) {
      $("networkSettingsMessage").textContent = data?.config_path ? `Saved at ${data.config_path}` : "";
    }
  }

  async function runRaspapAction(action) {
    const message = $("networkRaspapMessage");
    if (message) message.textContent = `${action} in progress...`;
    try {
      const response = await fetch("/api/settings/raspap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data?.result?.stderr || data?.result?.error || data.error || `RaspAP ${action} ${response.status}`);
      await loadNetworkSettings();
    } catch (error) {
      if (message) message.textContent = error.message;
    }
  }

  function syncMusicSettingsUi() {
    if ($("musicVisualizerMode")) $("musicVisualizerMode").value = state.music.visualizer || "particles";
    if ($("musicVisualizerStyle")) $("musicVisualizerStyle").value = state.music.visualizerStyle || "drift";
    if ($("musicVisualizerFocus")) $("musicVisualizerFocus").value = state.music.visualizerFocus || "soft";
    if ($("musicVisualizerImage")) $("musicVisualizerImage").value = state.music.visualizerImageId || "";
  }

  async function saveNetworkSettings() {
    const message = $("networkSettingsMessage");
    const settings = {};
    for (const [key, id] of Object.entries(NETWORK_FIELD_MAP)) {
      settings[key] = String($(id)?.value || "").trim();
    }
    try {
      const response = await fetch("/api/settings/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `network settings ${response.status}`);
      if (message) message.textContent = `Saved. Host manager reads ${data.config_path}.`;
    } catch (error) {
      if (message) message.textContent = error.message;
    }
  }

  init().catch((error) => {
    console.error(error);
    $("dashGpsSource").textContent = "Shell failed to load";
    $("dashGpsMeta").textContent = error.message;
  });
})();
