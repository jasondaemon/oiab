(() => {
  const isAdmin = document.body && document.querySelector("#settingsPassword");
  const state = { scoreboard: null, activeGames: [], players: [], icons: [], view: "overall" };
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function message(text, error = false) {
    const target = $("message");
    if (!target) return;
    target.textContent = text || "";
    target.style.color = error ? "var(--red)" : "var(--gold)";
  }

  async function api(payload = { action: "scoreboard" }) {
    const response = await fetch("/game-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed: ${response.status}`);
    return data.scoreboard || data;
  }

  async function apiRaw(payload = {}) {
    const response = await fetch("/game-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
  }

  function rankRows(rows) {
    if (!rows || !rows.length) {
      return '<div class="gs-recent-row"><div></div><div><strong>No scores yet.</strong><span>Play a game to start rankings.</span></div></div>';
    }
    return rows.map((row, index) => {
      const scoreLine = Number(row.highScore || 0) > 0 ? `best ${row.highScore} · total ${row.totalScore || 0}` : `${row.winRate}%`;
      return `
      <article class="gs-rank-row">
        <div class="rank">${index + 1}</div>
        <div>
          <strong>${escapeHtml(row.name)}</strong>
          <span>${row.played} played · ${row.wins}W ${row.losses}L ${row.draws}D</span>
        </div>
        <div class="gs-statline">${row.points} pts · ${scoreLine}</div>
      </article>
    `;
    }).join("");
  }

  function renderScoreboard() {
    const board = state.scoreboard || {};
    if ($("matchCount")) $("matchCount").textContent = board.totals?.matches ?? 0;
    if ($("playerCount")) $("playerCount").textContent = board.totals?.players ?? 0;
    if ($("leaderName")) $("leaderName").textContent = board.overall?.[0]?.name || "-";
    if ($("rankings")) {
      const rows = state.view === "overall" ? board.overall : board.games?.[state.view];
      $("rankings").innerHTML = rankRows(rows || []);
    }
    if ($("recentGames")) {
      const recent = board.recent || [];
      $("recentGames").innerHTML = recent.length ? recent.map((match) => {
        const names = (match.players || []).map((player) => player.name).join(" vs ");
        const result = Number.isFinite(Number(match.score)) ? (match.draw ? `Tie at ${match.score}` : `${match.winner || "Player"} scored ${match.score}`) : match.draw ? "Draw" : `${match.winner || "Unknown"} won`;
        return `
          <article class="gs-recent-row">
            <div class="rank">#</div>
            <div>
              <strong>${escapeHtml(result)}</strong>
              <span>${escapeHtml(match.title || match.game)} · ${escapeHtml(names)}</span>
            </div>
            <div class="gs-statline">${escapeHtml(match.created || "")}</div>
          </article>
        `;
      }).join("") : '<div class="gs-recent-row"><div></div><div><strong>No completed games.</strong><span>Recent matches will show here.</span></div></div>';
    }
    renderAdmin();
  }

  function gameLabel(game) {
    const labels = {
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
      "dots-and-boxes": "Dots and Boxes",
      "connect-four": "Connect Four",
      burst: "Burst",
      battleship: "Battleship",
      hangman: "Hangman",
      "word-grid": "Word Grid",
      "pattern-match": "Pattern Match",
      trivia: "Trail Trivia",
      "tic-tac-toe": "Tic-Tac-Toe",
    };
    return labels[game.type] || game.title || "Game";
  }

  function renderActiveGames() {
    const target = $("activeGamesList");
    if (!target) return;
    const games = state.activeGames || [];
    if (!games.length) {
      target.innerHTML = '<div class="gs-recent-row"><div></div><div><strong>No active saved games.</strong><span>Open or stuck games will show here.</span></div></div>';
      return;
    }
    target.replaceChildren(...games.map((game) => {
      const row = document.createElement("article");
      row.className = "gs-active-row";
      const players = (game.players || []).map((player) => `${player.name || "Player"} (${player.mark || "-"})`).join(" vs ") || "No players";
      const meta = [game.status, game.mode, game.difficulty].filter(Boolean).join(" · ");
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(gameLabel(game))}</strong>
          <span>${escapeHtml(players)}</span>
          <small>${escapeHtml(meta)}${game.updated ? ` · ${escapeHtml(game.updated)}` : ""}</small>
        </div>
        <button class="gs-action danger compact" type="button">Clear</button>
      `;
      row.querySelector("button").addEventListener("click", () => clearActiveGame(game.id, gameLabel(game)));
      return row;
    }));
  }

  function iconPath(icon) {
    return `/mobile/player-icons/${encodeURIComponent(icon || "compass")}.svg`;
  }

  function renderServerPlayers() {
    const list = $("serverPlayersList");
    if (!list) return;
    const activePlayers = (state.players || []).filter((player) => player.active !== false);
    list.replaceChildren(...activePlayers.map((player) => {
      const row = document.createElement("article");
      row.className = "gs-identity-row";
      row.innerHTML = `
        <div class="rank"><img src="${iconPath(player.icon)}" alt="" style="width:32px;height:32px"></div>
        <div>
          <strong>${escapeHtml(player.name)}</strong>
          <span>${escapeHtml(player.id)} · ${escapeHtml(player.icon || "compass")}</span>
        </div>
        <button class="gs-action danger compact" type="button">Disable</button>
      `;
      row.querySelector("button").addEventListener("click", () => deleteServerPlayer(player.id, player.name));
      return row;
    }));
    const iconSelect = $("serverPlayerIcon");
    if (iconSelect) {
      iconSelect.innerHTML = (state.icons || []).map((icon) => `<option value="${escapeHtml(icon)}">${escapeHtml(icon)}</option>`).join("");
    }
  }

  function renderAdmin() {
    if (!isAdmin || !state.scoreboard) return;
    renderActiveGames();
    renderServerPlayers();
  }

  async function loadActiveGames() {
    if (!isAdmin) return;
    const data = await apiRaw({ action: "active-games" });
    state.activeGames = data.activeGames || [];
    renderActiveGames();
  }

  async function loadServerPlayers() {
    if (!isAdmin) return;
    const data = await apiRaw({ action: "players", includeInactive: true });
    state.players = data.players || [];
    state.icons = data.icons || [];
    renderServerPlayers();
  }

  async function load() {
    try {
      state.scoreboard = await api({ action: "scoreboard" });
      renderScoreboard();
      await Promise.all([loadActiveGames(), loadServerPlayers()]);
      message("");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function saveServerPlayer() {
    const name = $("serverPlayerName")?.value || "";
    const icon = $("serverPlayerIcon")?.value || "compass";
    try {
      const data = await apiRaw({ action: "save-player", player: { name, icon } });
      state.players = data.players || [];
      state.icons = data.icons || state.icons;
      if ($("serverPlayerName")) $("serverPlayerName").value = "";
      renderServerPlayers();
      message("Player saved.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function deleteServerPlayer(playerId, name) {
    if (!window.confirm(`Disable ${name || "this player"}?`)) return;
    try {
      const data = await apiRaw({ action: "delete-player", playerId });
      state.players = data.players || [];
      state.icons = data.icons || state.icons;
      renderServerPlayers();
      message("Player disabled.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function wipeScores() {
    const game = $("wipeGame")?.value || "tic-tac-toe";
    const label = game === "all" ? "all game" : game.replaceAll("-", " ");
    if (!window.confirm(`Wipe ${label} score history?`)) return;
    try {
      state.scoreboard = await api({
        action: "wipe",
        game,
        settingsPassword: $("settingsPassword")?.value || "",
      });
      renderScoreboard();
      message("Score data wiped.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function clearActiveGame(gameId, label) {
    if (!window.confirm(`Clear saved ${label || "game"}?`)) return;
    try {
      const data = await apiRaw({
        action: "clear-active-game",
        gameId,
        settingsPassword: $("settingsPassword")?.value || "",
      });
      state.activeGames = data.activeGames || [];
      renderActiveGames();
      message("Active game cleared.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function clearAllActiveGames() {
    if (!window.confirm("Clear all active saved games? Score history will remain.")) return;
    try {
      const data = await apiRaw({
        action: "clear-active-games",
        settingsPassword: $("settingsPassword")?.value || "",
      });
      state.activeGames = data.activeGames || [];
      renderActiveGames();
      message("All active games cleared.");
    } catch (error) {
      message(error.message, true);
    }
  }

  document.querySelectorAll(".gs-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view || "overall";
      document.querySelectorAll(".gs-tabs button").forEach((item) => item.classList.toggle("active", item === button));
      renderScoreboard();
    });
  });
  if ($("refreshScores")) $("refreshScores").addEventListener("click", load);
  if ($("saveServerPlayer")) $("saveServerPlayer").addEventListener("click", saveServerPlayer);
  if ($("wipeScores")) $("wipeScores").addEventListener("click", wipeScores);
  if ($("clearAllActiveGames")) $("clearAllActiveGames").addEventListener("click", clearAllActiveGames);
  load();
})();
