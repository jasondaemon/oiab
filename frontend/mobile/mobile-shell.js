(() => {
  const appConfigUrls = ["/api/apps", "/overland/apps.json", "/maps/overland/apps.json"];
  const defaultAppLayout = {
    schema: 1,
    settingsPassword: "",
    hiddenAppIds: ["legacy-home", "legacy-admin", "https-settings", "service-manager", "file-uploads", "map-packs", "map-data", "game-data", "audio-test", "minecraft"],
    folders: [],
  };
  let currentConfig = null;
  let currentLayout = defaultAppLayout;
  const profileStorageKey = "iiab-overland-player-profile";
  const nativeIds = new Set(["music", "web-emulator", "drums", "license-plates", "trivia"]);
  const standaloneUrls = {
    music: "/mobile/music.html",
    "web-emulator": "/mobile/emulator.html",
    drums: "/mobile/drums.html",
    "license-plates": "/mobile/license-plates.html",
    trivia: "/mobile/trivia.html",
    "overland-settings": "/mobile/settings.html",
    "gps-status": "/mobile/gps-status.html",
    "maps-v2": "/maps-v2/?mobile=1",
    "system-monitor": "/system-monitor/",
  };
  const mobileHiddenIds = new Set(defaultAppLayout.hiddenAppIds);
  const categoryOrder = [
    ["core", "Core Apps"],
    ["games", "Games"],
    ["media", "Media"],
    ["library", "Library"],
    ["learning", "Learning"],
    ["travel", "Travel"],
    ["tools", "Tools"],
  ];
  const hostPrefixes = [
    "mobile",
    "maps",
    "music",
    "iiab",
    "files",
    "jellyfin",
    "komga",
    "wiki",
    "monitor",
    "maps-admin",
    "minecraft-map",
    "minecraft-admin",
    "mindustry",
  ];

  const $ = (id) => document.getElementById(id);

  function randomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanName(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function playerProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
      return {
        id: saved.id || randomId(),
        name: cleanName(saved.name),
      };
    } catch {
      return { id: randomId(), name: "" };
    }
  }

  function savePlayerProfile(profile) {
    localStorage.setItem(profileStorageKey, JSON.stringify({
      id: profile.id || randomId(),
      name: cleanName(profile.name),
    }));
    renderPlayerProfile();
  }

  function renderPlayerProfile() {
    const profile = playerProfile();
    const button = $("editPlayerName");
    if (button) button.textContent = profile.name ? profile.name : "Set Name";
  }

  function openPlayerNameDialog(force = false) {
    const dialog = $("playerNameDialog");
    const input = $("playerNameInput");
    const error = $("playerNameError");
    const profile = playerProfile();
    input.value = profile.name || "";
    error.textContent = "";
    $("savePlayerName").onclick = () => {
      const name = cleanName(input.value);
      if (!name) {
        error.textContent = "Enter a name.";
        return;
      }
      savePlayerProfile({ id: profile.id, name });
      dialog.close();
    };
    input.onkeydown = (event) => {
      if (event.key === "Enter") $("savePlayerName").click();
    };
    dialog.showModal();
    input.focus();
    if (force) dialog.addEventListener("cancel", (event) => event.preventDefault(), { once: true });
  }

  function overlandDomain() {
    const host = window.location.hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host === "localhost") return "";
    const parts = host.split(".");
    if (parts.length > 2 && hostPrefixes.includes(parts[0])) {
      return parts.slice(1).join(".");
    }
    return host;
  }

  function resolveUrl(url) {
    const domain = overlandDomain();
    return String(url || "#")
      .replaceAll("{{host}}", window.location.hostname)
      .replaceAll("{{overland_domain}}", domain || window.location.hostname);
  }

  function launchUrl(app) {
    const profile = playerProfile();
    const join = (url) => {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}playerId=${encodeURIComponent(profile.id)}&playerName=${encodeURIComponent(profile.name || "Player")}`;
    };
    if (app.id === "maps" || app.id === "maps-v2") {
      return "/maps-v2/?mobile=1";
    }
    if (app.id === "tic-tac-toe") {
      return join("/mobile/tic-tac-toe.html");
    }
    if (app.id === "chess" || app.id === "checkers") {
      return join(`/mobile/${app.id}.html`);
    }
    if (app.id === "dots-and-boxes") {
      return join("/mobile/dots-and-boxes.html");
    }
    if (["minesweeper", "blockfall", "claimline", "sinkhole-city", "canyon-crawler", "orbit-run", "blank-slate", "starts-ends", "word-tile-arena", "connect-four", "burst", "battleship", "hangman", "word-grid", "pattern-match"].includes(app.id)) {
      return join(`/mobile/${app.id}.html`);
    }
    if (standaloneUrls[app.id]) {
      return standaloneUrls[app.id];
    }
    if (nativeIds.has(app.id) || app.native) {
      return `/maps/?openApp=${encodeURIComponent(app.id)}`;
    }
    return resolveUrl(app.url);
  }

  function iconFor(app) {
    const img = document.createElement("img");
    img.src = app.icon || "/js-menu/menu-files/images/main-logo.png";
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.src = "/js-menu/menu-files/images/main-logo.png";
    }, { once: true });
    return img;
  }

  function normalizeLayout(layout) {
    const source = layout && typeof layout === "object" ? layout : defaultAppLayout;
    return {
      schema: 1,
      settingsPassword: String(source.settingsPassword ?? defaultAppLayout.settingsPassword ?? ""),
      hiddenAppIds: [...new Set((Array.isArray(source.hiddenAppIds) ? source.hiddenAppIds : defaultAppLayout.hiddenAppIds).map(String).filter(Boolean))],
      folders: (Array.isArray(source.folders) ? source.folders : defaultAppLayout.folders).map((folder) => ({
        id: String(folder.id || "").trim() || `folder-${Math.random().toString(16).slice(2, 8)}`,
        title: String(folder.title || folder.id || "Folder").trim() || "Folder",
        icon: String(folder.icon || ""),
        protected: !!folder.protected,
        appIds: [...new Set((Array.isArray(folder.appIds) ? folder.appIds : []).map(String).filter(Boolean))],
      })),
    };
  }

  function appById(id) {
    return (currentConfig?.apps || []).find((app) => app.id === id);
  }

  function visibleApps() {
    const hidden = new Set([...(currentLayout.hiddenAppIds || []), ...mobileHiddenIds]);
    return (currentConfig?.apps || []).filter((app) => !hidden.has(app.id));
  }

  function appsForFolder(folder) {
    const hidden = new Set(currentLayout.hiddenAppIds || []);
    return (folder.appIds || []).map(appById).filter((app) => app && !hidden.has(app.id));
  }

  function looseApps() {
    const assigned = new Set((currentLayout.folders || []).flatMap((folder) => folder.appIds || []));
    return visibleApps().filter((app) => !assigned.has(app.id));
  }

  function sectionKey(app) {
    const id = String(app.id || "");
    const category = String(app.category || "").toLowerCase();
    if (id === "maps-v2" || id === "gps-status" || id === "overland-settings" || id === "system-monitor") return "core";
    if (category === "games") return "games";
    if (category === "media") return "media";
    if (category === "library") return "library";
    if (category === "learning") return "learning";
    if (category === "travel") return "travel";
    return "tools";
  }

  function appCard(app, game = false) {
    const card = document.createElement("a");
    card.className = game ? "app-card game-card" : "app-card";
    card.href = launchUrl(app);
    card.append(iconFor(app));

    const title = document.createElement("strong");
    title.textContent = app.title || app.id || "App";
    const category = document.createElement("small");
    category.textContent = app.category || "";
    card.append(title, category);
    return card;
  }

  function folderCard(folder) {
    const card = document.createElement("button");
    card.className = "app-card folder-card";
    card.type = "button";
    const img = document.createElement("img");
    img.src = folder.icon || "/maps/overland/overland-folder-settings.svg";
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.src = "/js-menu/menu-files/images/main-logo.png";
    }, { once: true });
    const title = document.createElement("strong");
    title.textContent = folder.title;
    card.append(img, title);
    card.addEventListener("click", () => openFolder(folder));
    return card;
  }

  function renderTopLevel() {
    const root = $("appsGrid");
    root.replaceChildren();
    const groups = new Map(categoryOrder.map(([key]) => [key, []]));
    visibleApps().forEach((app) => {
      const key = sectionKey(app);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(app);
    });
    categoryOrder.forEach(([key, title]) => {
      const apps = groups.get(key) || [];
      if (!apps.length) return;
      const section = document.createElement("section");
      section.className = "mobile-app-section";
      const heading = document.createElement("h3");
      heading.textContent = title;
      const grid = document.createElement("div");
      grid.className = "app-grid";
      apps.forEach((app) => grid.append(appCard(app)));
      section.append(heading, grid);
      root.append(section);
    });
  }

  function renderFolder(folder) {
    $("appsGrid").replaceChildren(...appsForFolder(folder).map((app) => appCard(app)));
  }

  function openFolder(folder) {
    if (!folder.protected) {
      renderFolder(folder);
      return;
    }
    requestPassword(folder, () => renderFolder(folder));
  }

  function ensurePasswordDialog() {
    let dialog = $("folderPasswordDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "folderPasswordDialog";
    dialog.className = "password-dialog";
    dialog.innerHTML = `
      <form method="dialog"><button class="password-close" aria-label="Close">×</button></form>
      <h2 id="folderPasswordTitle">Protected Folder</h2>
      <p>Enter the launcher password to open this folder.</p>
      <input id="folderPasswordInput" type="password" autocomplete="current-password" placeholder="Password">
      <div id="folderPasswordError" class="password-error"></div>
      <button id="folderPasswordSubmit" class="password-submit" type="button">Open Folder</button>
    `;
    document.body.append(dialog);
    return dialog;
  }

  function requestPassword(folder, onSuccess) {
    const dialog = ensurePasswordDialog();
    $("folderPasswordTitle").textContent = folder.title;
    $("folderPasswordInput").value = "";
    $("folderPasswordError").textContent = "";
    $("folderPasswordSubmit").onclick = () => {
      if ($("folderPasswordInput").value === String(currentLayout.settingsPassword || "")) {
        dialog.close();
        onSuccess();
      } else {
        $("folderPasswordError").textContent = "Incorrect password.";
      }
    };
    $("folderPasswordInput").onkeydown = (event) => {
      if (event.key === "Enter") $("folderPasswordSubmit").click();
    };
    dialog.showModal();
    $("folderPasswordInput").focus();
  }

  function render(config) {
    currentConfig = config;
    renderTopLevel();
  }

  function gameCard(game) {
    const card = document.createElement("a");
    card.className = "app-card game-card open-game-card";
    const profile = playerProfile();
    const gameUrl = {
      chess: "/mobile/chess.html",
      checkers: "/mobile/checkers.html",
      "blank-slate": "/mobile/blank-slate.html",
      "starts-ends": "/mobile/starts-ends.html",
      "word-tile-arena": "/mobile/word-tile-arena.html",
      "dots-and-boxes": "/mobile/dots-and-boxes.html",
      "connect-four": "/mobile/connect-four.html",
      burst: "/mobile/burst.html",
      battleship: "/mobile/battleship.html",
      hangman: "/mobile/hangman.html",
      "word-grid": "/mobile/word-grid.html",
      "pattern-match": "/mobile/pattern-match.html",
      "canyon-crawler": "/mobile/canyon-crawler.html",
      "orbit-run": "/mobile/orbit-run.html",
      minesweeper: "/mobile/minesweeper.html",
      claimline: "/mobile/claimline.html",
      blockfall: "/mobile/blockfall.html",
    }[game.type] || "/mobile/tic-tac-toe.html";
    card.href = `${gameUrl}?game=${encodeURIComponent(game.id)}&playerId=${encodeURIComponent(profile.id)}&playerName=${encodeURIComponent(profile.name || "Player")}`;
    const img = document.createElement("img");
    img.src = {
      chess: "/maps/overland/overland-chess.svg",
      checkers: "/maps/overland/overland-checkers.svg",
      "blank-slate": "/maps/overland/overland-blank-slate.svg",
      "starts-ends": "/maps/overland/overland-starts-ends.svg",
      "word-tile-arena": "/maps/overland/overland-word-tile-arena.svg",
      "dots-and-boxes": "/maps/overland/overland-dots-boxes.svg",
      "connect-four": "/maps/overland/overland-connect-four.svg",
      burst: "/maps/overland/overland-burst.svg",
      battleship: "/maps/overland/overland-battleship.svg",
      hangman: "/maps/overland/overland-hangman.svg",
      "word-grid": "/maps/overland/overland-word-grid.svg",
      "pattern-match": "/maps/overland/overland-pattern-match.svg",
      "canyon-crawler": "/maps/overland/overland-canyon-crawler.svg",
      "orbit-run": "/maps/overland/overland-orbit-run.svg",
      blockfall: "/maps/overland/overland-blockfall.svg",
    }[game.type] || "/mobile/tic-tac-toe.svg";
    img.alt = "";
    const title = document.createElement("strong");
    title.textContent = game.title || "Tic-Tac-Toe";
    const players = document.createElement("small");
    const names = Array.isArray(game.players) ? game.players.map((player) => player.name).filter(Boolean) : [];
    players.textContent = names.length ? names.join(" vs ") : "Waiting for player";
    card.append(img, title, players);
    return card;
  }

  async function loadOpenGames() {
    const panel = $("openGamesPanel");
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Open games: ${response.status}`);
      const data = await response.json();
      const games = Array.isArray(data.games) ? data.games : [];
      panel.hidden = games.length === 0;
      $("openGamesGrid").replaceChildren(...games.map(gameCard));
    } catch (error) {
      console.warn(error);
      panel.hidden = true;
    }
  }

  async function loadConfig() {
    let lastError = null;
    for (const url of appConfigUrls) {
      try {
        const response = await fetch(url, { cache: "no-cache" });
        if (response.ok) return response.json();
        lastError = new Error(`${url}: ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No app config URL succeeded.");
  }

  async function loadLayout() {
    try {
      const response = await fetch("/app-layout", { cache: "no-cache" });
      if (!response.ok) throw new Error(`app-layout: ${response.status}`);
      const data = await response.json();
      return normalizeLayout(data.layout);
    } catch (error) {
      console.warn(error);
      return normalizeLayout(defaultAppLayout);
    }
  }

  async function main() {
    try {
      renderPlayerProfile();
      if (!playerProfile().name) window.setTimeout(() => openPlayerNameDialog(true), 100);
      const [config, layout] = await Promise.all([loadConfig(), loadLayout()]);
      currentLayout = layout;
      render(config);
      loadOpenGames();
    } catch (error) {
      console.error(error);
      $("appsGrid").innerHTML = `<div class="empty-state"><strong>Apps unavailable.</strong><span>${error.message}</span></div>`;
    }
  }

  $("refreshApps").addEventListener("click", main);
  $("refreshGames").addEventListener("click", loadOpenGames);
  $("editPlayerName").addEventListener("click", () => openPlayerNameDialog(false));
  setInterval(loadOpenGames, 5000);
  main();
})();
