(() => {
  const storageKey = "oiab.serverPlayer.v1";
  const playerEvent = "oiab:server-player-selected";
  const $ = (id) => document.getElementById(id);

  function cleanName(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function validPlayer(player) {
    return !!(player && player.id && cleanName(player.name));
  }

  function storedPlayer() {
    try {
      const player = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return validPlayer(player) ? player : null;
    } catch {
      return null;
    }
  }

  function iconPath(icon) {
    return `/mobile/player-icons/${encodeURIComponent(icon || "compass")}.svg`;
  }

  function setPlayer(player) {
    const selected = {
      id: String(player.id || "").trim(),
      name: cleanName(player.name),
      icon: String(player.icon || "compass").trim() || "compass",
    };
    if (!validPlayer(selected)) throw new Error("Choose a server player.");
    localStorage.setItem(storageKey, JSON.stringify(selected));
    updateLabels(selected);
    window.dispatchEvent(new CustomEvent(playerEvent, { detail: selected }));
    return selected;
  }

  function updateLabels(player = storedPlayer()) {
    if (!validPlayer(player)) return;
    document.querySelectorAll("#playerNameLabel,[data-player-name-label]").forEach((target) => {
      target.textContent = player.name;
    });
    const launcherButton = $("editPlayerName");
    if (launcherButton) launcherButton.textContent = player.name;
  }

  async function fetchPlayers({ includeInactive = false } = {}) {
    const response = await fetch("/game-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "players", includeInactive }),
      cache: "no-cache",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Server players unavailable: ${response.status}`);
    return (Array.isArray(data.players) ? data.players : []).filter((player) => {
      return player && player.active !== false && player.id !== "player-cpu";
    });
  }

  function buildDialog(players, { reloadOnSelect = false } = {}) {
    ensureStyles();
    const existing = $("serverPlayerDialog");
    if (existing) existing.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "serverPlayerDialog";
    dialog.className = "server-player-dialog";
    dialog.innerHTML = `
      <h2>Choose Player</h2>
      <p>Select the server player profile for this device. Players are managed in Settings.</p>
      <div class="server-player-choices"></div>
      <p class="server-player-error" role="alert"></p>
    `;
    const choices = dialog.querySelector(".server-player-choices");
    const error = dialog.querySelector(".server-player-error");
    players.forEach((player) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "server-player-choice";
      button.innerHTML = `<img src="${iconPath(player.icon)}" alt=""><span>${player.name}</span>`;
      button.addEventListener("click", () => {
        try {
          setPlayer(player);
          dialog.close();
          dialog.remove();
          if (reloadOnSelect) window.location.reload();
        } catch (err) {
          error.textContent = err.message;
        }
      });
      choices.append(button);
    });
    if (!players.length) {
      error.textContent = "No active server players are configured. Add players in Settings > Game Data.";
    }
    document.body.append(dialog);
    return dialog;
  }

  function ensureStyles() {
    if ($("serverPlayerStyles")) return;
    const style = document.createElement("style");
    style.id = "serverPlayerStyles";
    style.textContent = `
      .server-player-dialog {
        width: min(440px, calc(100vw - 28px));
        padding: 24px;
        color: #eef7eb;
        background: linear-gradient(180deg, rgba(255,255,255,.08), transparent 34%), rgba(7,19,13,.97);
        border: 1px solid rgba(233,247,232,.22);
        border-radius: 24px;
        box-shadow: 0 18px 54px rgba(0,0,0,.34);
      }
      .server-player-dialog::backdrop { background: rgba(0,0,0,.58); backdrop-filter: blur(8px); }
      .server-player-dialog h2 { margin: 0 0 8px; font: 850 1.55rem/1.05 "Avenir Next", system-ui, sans-serif; }
      .server-player-dialog p { margin: 0 0 14px; color: rgba(238,247,235,.78); line-height: 1.35; }
      .server-player-choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 10px; margin-top: 12px; }
      .server-player-choice {
        display: grid;
        min-height: 108px;
        justify-items: center;
        align-content: center;
        gap: 8px;
        padding: 10px;
        color: #eef7eb;
        background: rgba(255,255,255,.095);
        border: 1px solid rgba(233,247,232,.22);
        border-radius: 18px;
        cursor: pointer;
        font: 850 1rem/1.1 "Avenir Next", system-ui, sans-serif;
      }
      .server-player-choice:active { transform: scale(.98); background: rgba(233,247,232,.24); }
      .server-player-choice img { width: 54px; height: 54px; object-fit: contain; }
      .server-player-error { min-height: 22px; color: #ff7b72; font-weight: 750; }
    `;
    document.head.append(style);
  }

  async function requirePlayer(options = {}) {
    const current = storedPlayer();
    if (current && !options.force) {
      updateLabels(current);
      return current;
    }
    const players = await fetchPlayers();
    return new Promise((resolve) => {
      const dialog = buildDialog(players, options);
      dialog.addEventListener("close", () => resolve(storedPlayer()), { once: true });
      dialog.addEventListener("cancel", (event) => event.preventDefault());
      dialog.showModal();
    });
  }

  function currentPlayer() {
    const player = storedPlayer();
    return player;
  }

  window.OIABPlayers = {
    storageKey,
    event: playerEvent,
    get: currentPlayer,
    set: setPlayer,
    fetch: fetchPlayers,
    require: requirePlayer,
    change: () => requirePlayer({ force: true }),
  };

  const current = currentPlayer();
  if (current) updateLabels(current);
  document.addEventListener("DOMContentLoaded", () => {
    const player = currentPlayer();
    if (player) updateLabels(player);
    const shouldRequire = document.body?.dataset?.requireServerPlayer === "true" || !!$("playerNameLabel");
    if (shouldRequire && !player) {
      requirePlayer({ reloadOnSelect: true }).catch((error) => console.warn(error));
    }
  });
})();
