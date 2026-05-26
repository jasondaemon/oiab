(() => {
  const state = {
    config: null,
    apps: [],
    dockIds: [],
  };

  const storageKey = "iiab-overland-dock-v1";
  const mapStateKey = "iiab-overland-map-hash-v1";
  const $ = (id) => document.getElementById(id);

function overlandDomain() {
  const host = window.location.hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host === "localhost") return "";
  const parts = host.split(".");
  if (parts.length > 2 && ["maps", "mobile", "music", "iiab", "files", "jellyfin", "monitor", "maps-admin", "minecraft-map", "minecraft-admin", "mindustry"].includes(parts[0])) {
    return parts.slice(1).join(".");
  }
  return host;
}

function resolveUrl(url) {
  const domain = overlandDomain();
  if (!domain && url.includes("{{overland_domain}}")) {
    const portFallbacks = {
      "files": 8448,
      "jellyfin": 8449,
      "monitor": 8445,
      "maps-admin": 8444,
      "minecraft-map": 8450,
      "minecraft-admin": 8452,
      "mindustry": 8447,
    };
    const match = url.match(/^https:\/\/([^/.]+)\.\{\{overland_domain\}\}\/?/);
    const port = match && portFallbacks[match[1]];
    if (port) return `https://${window.location.hostname}:${port}/`;
  }
  return url
    .replaceAll("{{host}}", window.location.hostname)
    .replaceAll("{{overland_domain}}", domain || window.location.hostname);
}

  function appById(id) {
    return state.apps.find((app) => app.id === id);
  }

  function savedDockIds() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(parsed)) {
        return parsed.filter((id) => appById(id));
      }
    } catch (_error) {
      return [];
    }
    return [];
  }

  function defaultDockIds() {
    const configured = Array.isArray(state.config.defaultDock) ? state.config.defaultDock : [];
    const fallback = state.apps.filter((app) => app.dock).map((app) => app.id);
    return (configured.length ? configured : fallback).filter((id) => appById(id));
  }

  function persistDock() {
    window.localStorage.setItem(storageKey, JSON.stringify(state.dockIds));
  }

  function savedMapHash() {
    const hash = window.localStorage.getItem(mapStateKey) || "";
    return hash.startsWith("#") && hash.length > 1 ? hash : "";
  }

  function mapUrlWithSavedState(url) {
    const resolved = resolveUrl(url);
    if (resolved.includes("#")) return resolved;
    return `${resolved}${savedMapHash()}`;
  }

  function persistMapHash() {
    const frame = $("mapFrame");
    try {
      const hash = frame.contentWindow && frame.contentWindow.location.hash;
      if (hash && hash.length > 1) {
        window.localStorage.setItem(mapStateKey, hash);
      }
    } catch (_error) {
      // The map is same-origin on the Pi. If that ever changes, fail closed.
    }
  }

  function openApp(app) {
    const url = resolveUrl(app.url);
    if (app.id === "maps") {
      $("mapFrame").src = mapUrlWithSavedState(url);
      return;
    }
    window.location.href = url;
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

  function renderDock() {
    const dockApps = $("dockApps");
    dockApps.replaceChildren();
    state.dockIds.map(appById).filter(Boolean).forEach((app) => {
      const button = document.createElement("button");
      button.className = "dock-app";
      button.type = "button";
      button.title = app.title;
      button.setAttribute("aria-label", app.title);
      button.append(iconFor(app));
      const label = document.createElement("span");
      label.textContent = app.title;
      button.append(label);
      button.addEventListener("click", () => openApp(app));
      dockApps.append(button);
    });
  }

  function appCard(app) {
    const card = document.createElement("a");
    card.className = "app-card";
    card.href = resolveUrl(app.url);
    card.append(iconFor(app));

    const text = document.createElement("div");
    const category = document.createElement("small");
    category.textContent = app.category || "App";
    const title = document.createElement("strong");
    title.textContent = app.title;
    const description = document.createElement("p");
    description.textContent = app.description || "";
    text.append(category, title, description);
    card.append(text);

    return card;
  }

  function renderApps(filter = "") {
    const needle = filter.trim().toLowerCase();
    const appsGrid = $("appsGrid");
    appsGrid.replaceChildren();
    state.apps
      .filter((app) => {
        if (!needle) return true;
        return [app.title, app.description, app.category].join(" ").toLowerCase().includes(needle);
      })
      .forEach((app) => appsGrid.append(appCard(app)));
  }

  function renderDockSettings() {
    const dockSettings = $("dockSettings");
    dockSettings.replaceChildren();
    state.apps.forEach((app) => {
      const label = document.createElement("label");
      label.className = "dock-choice";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.dockIds.includes(app.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked && !state.dockIds.includes(app.id)) {
          state.dockIds.push(app.id);
        } else if (!checkbox.checked) {
          state.dockIds = state.dockIds.filter((id) => id !== app.id);
        }
        persistDock();
        renderDock();
      });

      label.append(checkbox, iconFor(app), document.createTextNode(app.title));
      dockSettings.append(label);
    });
  }

  function wirePanels() {
    $("appsButton").addEventListener("click", () => {
      renderApps($("appSearch").value);
      $("appsDialog").showModal();
      $("appSearch").focus();
    });

    $("settingsButton").addEventListener("click", () => {
      renderDockSettings();
      $("settingsDialog").showModal();
    });

    $("appSearch").addEventListener("input", (event) => renderApps(event.target.value));

    $("resetDock").addEventListener("click", () => {
      state.dockIds = defaultDockIds();
      persistDock();
      renderDock();
      renderDockSettings();
    });

    $("minimizeDock").addEventListener("click", () => {
      $("dock").hidden = true;
      $("restoreDock").hidden = false;
    });

    $("restoreDock").addEventListener("click", () => {
      $("dock").hidden = false;
      $("restoreDock").hidden = true;
    });

    $("mapFrame").addEventListener("load", () => {
      persistMapHash();
    });

    window.addEventListener("beforeunload", persistMapHash);
  }

  async function loadConfig() {
    const response = await fetch("apps.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Could not load apps.json: ${response.status}`);
    }
    state.config = await response.json();
    state.apps = Array.isArray(state.config.apps) ? state.config.apps : [];
    state.dockIds = savedDockIds();
    if (!state.dockIds.length) {
      state.dockIds = defaultDockIds();
    }
    $("mapFrame").src = mapUrlWithSavedState(state.config.mapUrl || "/maps/");
  }

  async function main() {
    wirePanels();
    try {
      await loadConfig();
      renderDock();
      renderApps();
    } catch (error) {
      console.error(error);
      $("dockApps").textContent = "Overland config failed to load.";
    }
    window.setInterval(persistMapHash, 1200);
  }

  main();
})();
