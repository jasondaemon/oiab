(() => {
  const CONFIG_URLS = ["/api/apps", "/overland/apps.json", "/maps/overland/apps.json"];
  const PROFILE_KEY = "iiab-overland-player-profile";
  const THEME_KEY = "iiab-overland-universal-theme-v1";
  const DOCK_KEY = "iiab-overland-universal-dock-v1";
  const MUSIC_KEY = "iiab-overland-universal-music-v1";
  const RECENT_KEY = "iiab-overland-universal-recents-v1";
  const MAP_3D_BUILDINGS_KEY = "omv2.show3dBuildings";
  const MAP_AUTO_RECORDING_KEY = "omv2.autoTrackRecording";
  const FALLBACK_ART = "/maps/overland/tunes.png";
  const NUMBER_FMT = new Intl.NumberFormat();
  const DEFAULT_LAYOUT = {
    schema: 1,
    settingsPassword: "314159",
    hiddenAppIds: ["legacy-home", "legacy-admin", "https-settings", "service-manager", "audio-test", "minecraft"],
    folders: [
      { id: "games", title: "Games", icon: "/maps/overland/overland-folder-games.svg", protected: false, appIds: ["scoreboard", "chess", "checkers", "minesweeper", "blockfall", "claimline", "blank-slate", "word-tile-arena", "connect-four", "battleship", "dots-and-boxes", "hangman", "word-grid", "pattern-match", "web-emulator", "minecraft-map", "drums", "trivia", "tic-tac-toe", "license-plates"] },
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
  const MUSIC_VISUALIZER_TYPES = ["particles", "bars", "waveform", "radial", "imagefloat", "off"];
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
    settingsSection: "music",
    services: [],
    containers: { available: false, containers: [], error: "" },
    maps: {
      installed: { active: "", basemaps: [] },
      catalog: { packs: [] },
      overlays: { overlays: [] },
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

  function openSettingsProtected(section = "music") {
    if (state.layout.settingsPassword) {
      state.passwordFolder = null;
      state.passwordAction = () => {
        state.currentAppId = "overland-settings";
        state.settingsSection = section;
        saveRecent("overland-settings");
        renderDock();
        setView("settings");
        renderSettingsSections();
      };
      $("passwordInput").value = "";
      $("passwordError").textContent = "";
      $("passwordTitle").textContent = "Settings";
      $("passwordDialog").showModal();
      $("passwordInput").focus();
      return;
    }
    state.currentAppId = "overland-settings";
    state.settingsSection = section;
    saveRecent("overland-settings");
    renderDock();
    setView("settings");
    renderSettingsSections();
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
      const response = await fetch("/api/services", { cache: "no-store" });
      if (!response.ok) throw new Error(`services ${response.status}`);
      const data = await response.json();
      state.services = Array.isArray(data?.services) ? data.services : [];
      const containersResponse = await fetch("/api/containers", { cache: "no-store" });
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
    try {
      const [installedResponse, catalogResponse, overlaysResponse] = await Promise.all([
        fetch("/api/maps/packs/installed", { cache: "no-store" }),
        fetch("/api/maps/packs/catalog", { cache: "no-store" }),
        fetch("/api/maps/overlays", { cache: "no-store" }),
      ]);
      const installed = await installedResponse.json().catch(() => ({}));
      const catalog = await catalogResponse.json().catch(() => ({}));
      const overlays = await overlaysResponse.json().catch(() => ({}));
      if (!installedResponse.ok || installed.ok === false) throw new Error(installed.error || `packs ${installedResponse.status}`);
      if (!catalogResponse.ok || catalog.ok === false) throw new Error(catalog.error || `catalog ${catalogResponse.status}`);
      if (!overlaysResponse.ok || overlays.ok === false) throw new Error(overlays.error || `overlays ${overlaysResponse.status}`);
      state.maps.installed = installed;
      state.maps.catalog = catalog;
      state.maps.overlays = overlays;
      renderMapsSettings();
      setSettingsMessage("mapsPacksMessage", "");
      setSettingsMessage("mapsOverlaysMessage", "");
    } catch (error) {
      renderMapsSettings();
      setSettingsMessage("mapsPacksMessage", error.message, true);
      setSettingsMessage("mapsOverlaysMessage", error.message, true);
    }
  }

  function renderMapsSettings() {
    renderMapPackSummary();
    renderInstalledMapPacks();
    renderCatalogMapPacks();
    renderOverlaySummary();
    renderMapOverlays();
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
    holder.innerHTML = groups.map(([label, packs]) => `
      <section class="uo-settings-item-grid">
        <h3 class="uo-settings-item-title">${escapeHtml(label)}</h3>
        ${packs.map((pack) => {
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
        }).join("")}
      </section>
    `).join("");
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
      </div>
      <span class="uo-settings-item-subtitle">Visibility and opacity stay in the map layer menu. Data acquisition and refresh live here.</span>
    `;
  }

  function renderMapOverlays() {
    const holder = $("mapsOverlaysList");
    if (!holder) return;
    const overlays = Array.isArray(state.maps.overlays?.overlays) ? state.maps.overlays.overlays : [];
    if (!overlays.length) {
      holder.innerHTML = `<div class="uo-settings-item"><div class="uo-settings-item-main"><p class="uo-settings-item-subtitle">No overlays registered.</p></div></div>`;
      return;
    }
    holder.innerHTML = overlays.map((overlay) => {
      const canRefresh = ["firms_active_hotspots", "nws_active_alerts", "mvum_roads_us", "mvum_trails_us"].includes(String(overlay.id || ""));
      const isInstall = ["mvum_roads_us", "mvum_trails_us"].includes(String(overlay.id || ""));
      const actionLabel = isInstall ? (overlay.exists || overlay.cache_status === "cached" ? "Update" : "Download") : "Refresh";
      return `
        <article class="uo-settings-item">
          <div class="uo-settings-item-main">
            <div class="uo-settings-item-head">
              <h3 class="uo-settings-item-title">${escapeHtml(overlay.name || overlay.id)}</h3>
              <div class="uo-settings-item-meta">
                ${badge(overlay.category || "overlay")}
                ${badge(overlay.cache_status || "unknown", overlay.cache_status === "cached" ? "is-good" : overlay.cache_status === "failed" ? "is-bad" : overlay.cache_status === "stale" ? "is-warn" : "")}
                ${badge(overlay.enabled ? "Enabled" : "Disabled", overlay.enabled ? "is-good" : "")}
                ${overlay.online_required ? badge("Online", "is-warn") : badge("Offline ready", "is-good")}
                ${overlay.size_bytes ? badge(formatBytes(overlay.size_bytes)) : ""}
              </div>
            </div>
            <p class="uo-settings-item-subtitle">${escapeHtml(overlay.description || "")}</p>
            ${(overlay.last_fetch_at || overlay.error_message) ? `
              <p class="uo-settings-item-subtitle">
                ${overlay.last_fetch_at ? `Updated ${escapeHtml(formatTimestamp(overlay.last_fetch_at))}. ` : ""}
                ${overlay.error_message ? `Error: ${escapeHtml(overlay.error_message)}` : ""}
              </p>` : ""}
          </div>
          <div class="uo-settings-item-actions">
            ${canRefresh ? `<button type="button" data-overlay-action="${isInstall ? "install" : "refresh"}" data-overlay-id="${escapeHtml(overlay.id || "")}" class="is-primary">${actionLabel}</button>` : ""}
            ${(overlay.exists || overlay.cache_status === "cached" || overlay.size_bytes) ? `<button type="button" data-overlay-action="clear-cache" data-overlay-id="${escapeHtml(overlay.id || "")}">Clear Cache</button>` : ""}
          </div>
        </article>
      `;
    }).join("");
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
          } else if (action === "install") {
            const path = overlayId === "mvum_roads_us" ? "/api/maps/overlays/mvum/roads/install" : "/api/maps/overlays/mvum/trails/install";
            const response = await fetch(path, { method: "POST" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.ok === false) throw new Error(data.error || `${action} failed`);
          } else if (action === "refresh") {
            const path = overlayId === "firms_active_hotspots" ? "/api/maps/overlays/wildfire/refresh" : "/api/maps/overlays/weather/alerts/refresh";
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
    if (autoplay) audio.play().catch((error) => console.warn(error));
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
      if (audio.paused) await audio.play();
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

  function drawMusicCanvas(canvasId) {
    const canvas = $(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);
    const audio = $("globalAudio");
    const pulse = audio.paused ? .26 : .56 + Math.sin(Date.now() / 180) * .18;
    if (state.music.visualizer === "off") return;
    if (state.music.visualizer.startsWith("image") && state.music.visualizerImage?.url) {
      const image = state.music.visualizerImage._img;
      if (image?.complete) {
        ctx.globalAlpha = state.music.visualizerFocus === "dream" ? 0.3 : 0.22;
        ctx.drawImage(image, 0, 0, width, height);
        ctx.globalAlpha = 1;
      }
    }
    if (state.music.visualizer === "bars") {
      const bars = 28;
      for (let i = 0; i < bars; i += 1) {
        const sample = .2 + Math.abs(Math.sin(Date.now() / 260 + i * .45)) * pulse;
        const barHeight = height * sample * (state.music.visualizerStyle === "pulse" ? .82 : .66);
        const barWidth = width / bars;
        ctx.fillStyle = `rgba(131,220,140,${0.2 + sample * 0.4})`;
        ctx.fillRect(i * barWidth + barWidth * 0.18, height - barHeight, barWidth * 0.64, barHeight);
      }
      return;
    }
    if (state.music.visualizer === "waveform") {
      ctx.strokeStyle = "rgba(131,220,140,0.8)";
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      for (let i = 0; i <= 80; i += 1) {
        const x = (i / 80) * width;
        const y = height * 0.5 + Math.sin(Date.now() / 220 + i * .22) * height * 0.13 * (1 + pulse);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }
    if (state.music.visualizer === "radial") {
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < 48; i += 1) {
        const angle = (Math.PI * 2 * i) / 48 + Date.now() / 2200;
        const inner = Math.min(width, height) * 0.12;
        const outer = inner + Math.abs(Math.sin(Date.now() / 240 + i * .33)) * Math.min(width, height) * 0.2 * (1 + pulse);
        ctx.strokeStyle = `rgba(131,220,140,${0.18 + pulse * 0.55})`;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.stroke();
      }
      return;
    }
    for (const particle of state.music.visualSeed) {
      particle.p += particle.s * (state.music.visualizerStyle === "nebula" ? .018 : .01);
      const x = ((particle.x + Math.sin(particle.p) * .06 + 1) % 1) * width;
      const y = ((particle.y + Math.cos(particle.p * .7) * .06 + 1) % 1) * height;
      const radius = particle.r * dpr * (1 + pulse * (state.music.visualizerFocus === "sharp" ? 1.5 : 1));
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(131, 220, 140, ${.18 + .18 * pulse})`);
      gradient.addColorStop(1, "rgba(131, 220, 140, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function animationLoop() {
    drawMusicCanvas("dashMusicCanvas");
    drawMusicCanvas("musicVisualizer");
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
      });
    });
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
        const message = $("settingsPinMessage");
        if (!/^\d{6}$/.test(pin)) {
          if (message) message.textContent = "PIN must be exactly 6 digits.";
          return;
        }
        try {
          const response = await fetch("/api/settings/app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings_pin: pin }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `settings ${response.status}`);
          state.layout.settingsPassword = pin;
          if (message) message.textContent = "PIN saved.";
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
    loadStorageSettings().catch((error) => {
      const message = $("storageSettingsMessage");
      if (message) message.textContent = error.message;
    });
    $("dashMapFrame").src = "/maps-v2/?shell=1";
    renderDock();
    renderApps();
    renderDockSettings();
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
