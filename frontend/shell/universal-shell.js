(() => {
  const CONFIG_URLS = ["/api/apps", "/overland/apps.json", "/maps/overland/apps.json"];
  const PROFILE_KEY = "iiab-overland-player-profile";
  const THEME_KEY = "iiab-overland-universal-theme-v1";
  const DOCK_KEY = "iiab-overland-universal-dock-v1";
  const MUSIC_KEY = "iiab-overland-universal-music-v1";
  const RECENT_KEY = "iiab-overland-universal-recents-v1";
  const FALLBACK_ART = "/maps/overland/tunes.png";
  const DEFAULT_LAYOUT = {
    schema: 1,
    settingsPassword: "",
    hiddenAppIds: ["legacy-home", "legacy-admin"],
    folders: [
      { id: "games", title: "Games", icon: "/maps/overland/overland-folder-games.svg", protected: false, appIds: ["scoreboard", "chess", "checkers", "minesweeper", "blockfall", "claimline", "blank-slate", "word-tile-arena", "connect-four", "battleship", "dots-and-boxes", "hangman", "word-grid", "pattern-match", "web-emulator", "drums", "trivia", "tic-tac-toe", "license-plates", "minecraft-map"] },
      { id: "reading", title: "Reading", icon: "/maps/overland/overland-folder-reading.svg", protected: false, appIds: ["wikipedia", "ted-kids", "kolibri", "books", "minecraft-wiki", "pokemon-wiki", "survivor-library", "medical-library", "military-medicine"] },
      { id: "settings", title: "Settings", icon: "/maps/overland/overland-folder-settings.svg", protected: true, appIds: ["overland-settings", "system-monitor", "file-uploads", "audio-test", "game-data", "https-setup", "minecraft-admin", "mindustry-admin", "maps-admin"] },
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
    gps: null,
    music: {
      library: [],
      visible: [],
      currentId: "",
      filter: { artist: "", album: "", folder: "" },
      restoreTime: 0,
      visualSeed: Array.from({ length: 36 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 3 + Math.random() * 16,
        s: .18 + Math.random() * .52,
        p: Math.random() * Math.PI * 2,
      })),
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
    if (app.id === "maps" || app.id === "maps-v2") return "/maps-v2/";
    if (app.id === "music" || app.native === "music") return "#music";
    const nativeUrl = NATIVE_APP_URLS[app.id];
    let url = nativeUrl || resolveUrl(app.url);
    if (app.category === "Games" || nativeUrl) {
      const player = profile();
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}playerId=${encodeURIComponent(player.id)}&playerName=${encodeURIComponent(player.name)}`;
    }
    return url;
  }

  function isHidden(appId) {
    return (state.layout.hiddenAppIds || []).includes(appId);
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
    const pinned = state.dockIds.map((id) => state.appById.get(id)).filter(Boolean).filter((app) => !isHidden(app.id));
    dock.replaceChildren(...pinned.slice(0, 8).map(appButton));
  }

  function renderDockSettings() {
    const box = $("dockSettings");
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

  function setView(view, options = {}) {
    if (!options.replace && state.currentView !== view) state.history.push(state.currentView);
    state.currentView = view;
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

  function openApp(app) {
    if (!app) return;
    if (app.id === "music" || app.native === "music") {
      state.currentAppId = "music";
      renderDock();
      setView("music");
      return;
    }
    const url = appUrl(app);
    if (!url || url === "#") return;
    state.currentAppId = app.id;
    $("appTitle").textContent = app.title || "App";
    $("appFrame").src = url;
    $("openExternal").href = url;
    saveRecent(app.id);
    setView("app");
  }

  function saveRecent(appId) {
    const recent = safeJson(localStorage.getItem(RECENT_KEY), []);
    localStorage.setItem(RECENT_KEY, JSON.stringify([appId, ...recent.filter((id) => id !== appId)].slice(0, 8)));
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
    const hidden = new Set(state.layout.hiddenAppIds || []);
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
      list.textContent = "No music found. Use File Uploads to add MP3 files, then Scan Library.";
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

  function playTrack(trackId) {
    const track = state.music.library.find((item) => item.id === trackId);
    setAudioTrack(track, true);
  }

  function playPause() {
    const audio = $("globalAudio");
    if (!audio.src) {
      const first = state.music.visible[0] || state.music.library[0];
      if (first) setAudioTrack(first, true);
      return;
    }
    if (audio.paused) audio.play().catch((error) => console.warn(error));
    else audio.pause();
  }

  function nextTrack(direction = 1) {
    const list = state.music.visible.length ? state.music.visible : state.music.library;
    if (!list.length) return;
    const currentIndex = Math.max(0, list.findIndex((track) => track.id === state.music.currentId));
    const next = list[(currentIndex + direction + list.length) % list.length];
    setAudioTrack(next, true);
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
    $("dashPlay").innerHTML = iconSvg(audio.paused ? "play" : "pause");
    $("musicPlay").innerHTML = iconSvg(audio.paused ? "play" : "pause");
    const value = audio.duration ? Math.round((audio.currentTime / audio.duration) * 1000) : 0;
    $("dashMusicProgress").value = value;
    $("musicSeek").value = value;
    $("musicElapsed").textContent = formatTime(audio.currentTime);
    $("musicDuration").textContent = formatTime(audio.duration);
    renderTrackList();
  }

  function persistMusicState() {
    const audio = $("globalAudio");
    localStorage.setItem(MUSIC_KEY, JSON.stringify({
      currentId: state.music.currentId,
      currentTime: audio.currentTime || 0,
      filter: state.music.filter,
    }));
  }

  function restoreMusicState() {
    const saved = safeJson(localStorage.getItem(MUSIC_KEY), {});
    state.music.filter = { artist: "", album: "", folder: "", ...(saved.filter || {}) };
    state.music.restoreTime = Number(saved.currentTime || 0);
    buildMusicFilters();
    applyMusicFilter();
    const track = state.music.library.find((item) => item.id === saved.currentId);
    if (track) setAudioTrack(track, false);
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
    const pulse = audio.paused ? .32 : .62 + Math.sin(Date.now() / 180) * .18;
    for (const particle of state.music.visualSeed) {
      particle.p += particle.s * .01;
      const x = ((particle.x + Math.sin(particle.p) * .06 + 1) % 1) * width;
      const y = ((particle.y + Math.cos(particle.p * .7) * .06 + 1) % 1) * height;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, particle.r * dpr * (1 + pulse));
      gradient.addColorStop(0, `rgba(131, 220, 140, ${.22 * pulse})`);
      gradient.addColorStop(1, "rgba(131, 220, 140, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, particle.r * dpr * (1 + pulse), 0, Math.PI * 2);
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
    $("dashGpsMeta").textContent = valid
      ? `${Number(stable.lat).toFixed(5)}, ${Number(stable.lon).toFixed(5)} - ${Math.round(Number(stable.speed_mph || 0))} mph`
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
    setButtonIcon("musicBack", "back");
    setButtonIcon("dashPrev", "prev");
    setButtonIcon("dashPlay", "play");
    setButtonIcon("dashNext", "next");
    setButtonIcon("musicPrev", "prev");
    setButtonIcon("musicPlay", "play");
    setButtonIcon("musicNext", "next");

    $("homeButton").addEventListener("click", () => setView("dashboard"));
    $("appsButton").addEventListener("click", () => { state.currentFolder = null; renderApps(); loadOpenGames(); setView("apps"); });
    $("settingsButton").addEventListener("click", () => { renderDockSettings(); setView("settings"); });
    $("backButton").addEventListener("click", goBack);
    $("appsBack").addEventListener("click", () => {
      if (state.currentFolder) {
        state.currentFolder = null;
        renderApps();
      } else goBack();
    });
    $("settingsBack").addEventListener("click", goBack);
    $("musicBack").addEventListener("click", goBack);
    $("dashMapPanel").addEventListener("click", () => openApp(state.appById.get("maps")));
    $("dashMusicPanel").addEventListener("click", (event) => {
      if (event.target.closest("button") || event.target.closest("progress")) return;
      state.currentAppId = "music";
      setView("music");
    });
    $("quickWaypointPanel").addEventListener("click", () => {
      $("waypointMessage").textContent = "";
      $("waypointDialog").showModal();
    });
    $("passwordSubmit").addEventListener("click", () => {
      if ($("passwordInput").value === state.layout.settingsPassword) {
        $("passwordDialog").close();
        state.currentFolder = state.passwordFolder;
        state.passwordFolder = null;
        renderApps();
      } else $("passwordError").textContent = "Incorrect password.";
    });

    for (const id of ["dashPlay", "musicPlay"]) $(id).addEventListener("click", (event) => { event.stopPropagation(); playPause(); });
    for (const id of ["dashPrev", "musicPrev"]) $(id).addEventListener("click", (event) => { event.stopPropagation(); nextTrack(-1); });
    for (const id of ["dashNext", "musicNext"]) $(id).addEventListener("click", (event) => { event.stopPropagation(); nextTrack(1); });
    $("musicSeek").addEventListener("input", () => {
      const audio = $("globalAudio");
      if (audio.duration) audio.currentTime = (Number($("musicSeek").value) / 1000) * audio.duration;
    });
    $("musicLibraryRefresh").addEventListener("click", () => loadMusicLibrary(true).catch((error) => $("trackList").textContent = error.message));
    $("globalAudio").addEventListener("loadedmetadata", () => {
      if (state.music.restoreTime) {
        $("globalAudio").currentTime = Math.min(state.music.restoreTime, $("globalAudio").duration || state.music.restoreTime);
        state.music.restoreTime = 0;
      }
      updateMusicUi();
    });
    for (const eventName of ["play", "pause", "timeupdate", "ended", "durationchange"]) {
      $("globalAudio").addEventListener(eventName, () => {
        if (eventName === "ended") nextTrack(1);
        updateMusicUi();
        if (eventName === "timeupdate") persistMusicState();
      });
    }
    for (const [id, key] of [["themeAccent", "accent"], ["themeBackground", "background"], ["themeOpacity", "opacity"], ["themeBlur", "blur"]]) {
      $(id).addEventListener("input", () => saveTheme({ ...loadTheme(), [key]: $(id).value }));
    }
    $("resetDock").addEventListener("click", () => {
      localStorage.removeItem(DOCK_KEY);
      state.dockIds = state.config.defaultDock || [];
      renderDockSettings();
      renderDock();
    });
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
    $("dashMapFrame").src = "/maps-v2/";
    renderDock();
    renderApps();
    renderDockSettings();
    loadOpenGames();
    setInterval(loadOpenGames, 7000);
    loadGps();
    setInterval(loadGps, 1500);
    loadMusicLibrary(false).catch((error) => $("trackList").textContent = error.message);
    animationLoop();
  }

  init().catch((error) => {
    console.error(error);
    $("dashGpsSource").textContent = "Shell failed to load";
    $("dashGpsMeta").textContent = error.message;
  });
})();
