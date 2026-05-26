(() => {
  const isAdmin = document.body && document.querySelector("#settingsPassword");
  const state = { scoreboard: null, activeGames: [], view: "overall" };
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
      "word-tile-arena": "Word Tile Arena",
      "blank-slate": "Blank Slate",
      "dots-and-boxes": "Dots and Boxes",
      "connect-four": "Connect Four",
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

  function playerOptions(players, selected = "") {
    return (players || []).map((player) => {
      const label = player.aliases?.length ? `${player.name} (${player.aliases.slice(0, 2).join(", ")})` : player.name;
      return `<option value="${escapeHtml(player.id)}" ${player.id === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function isCpuIdentity(player = {}) {
    const id = String(player.id || "").toLowerCase();
    const raw = `${player.id || ""} ${player.name || ""}`.toLowerCase();
    const normalized = raw.replace(/[^a-z0-9]+/g, " ").trim();
    const normalizedName = String(player.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return (
      id.startsWith("cpu-") ||
      id.startsWith("computermedium") ||
      id.startsWith("computereasy") ||
      id.startsWith("computerhard") ||
      normalized === "cpu" ||
      normalized.startsWith("cpu ") ||
      normalized === "computer" ||
      normalized.startsWith("computer ") ||
      normalizedName === "computer" ||
      normalizedName.startsWith("computer ")
    );
  }

  function renderAdmin() {
    if (!isAdmin || !state.scoreboard) return;
    const players = (state.scoreboard.players || []).filter((player) => !isCpuIdentity(player));
    if ($("sourcePlayer")) $("sourcePlayer").innerHTML = playerOptions(players);
    if ($("targetPlayer")) $("targetPlayer").innerHTML = playerOptions(players, players[1]?.id || players[0]?.id || "");
    if ($("identityList")) {
      $("identityList").innerHTML = players.length ? players.map((player) => `
        <article class="gs-identity-row">
          <div class="rank">ID</div>
          <div>
            <strong>${escapeHtml(player.name)}</strong>
            <span>${escapeHtml(player.id)}${player.aliases?.length ? ` · aliases: ${escapeHtml(player.aliases.join(", "))}` : ""}</span>
          </div>
        </article>
      `).join("") : '<div class="gs-recent-row"><div></div><div><strong>No identities yet.</strong><span>Play a tracked game first.</span></div></div>';
    }
    renderActiveGames();
  }

  async function loadActiveGames() {
    if (!isAdmin) return;
    const data = await apiRaw({ action: "active-games" });
    state.activeGames = data.activeGames || [];
    renderActiveGames();
  }

  async function load() {
    try {
      state.scoreboard = await api({ action: "scoreboard" });
      renderScoreboard();
      await loadActiveGames();
      message("");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function mergePlayers() {
    const sourceId = $("sourcePlayer")?.value || "";
    const targetId = $("targetPlayer")?.value || "";
    if (!sourceId || !targetId || sourceId === targetId) {
      message("Choose two different identities.", true);
      return;
    }
    try {
      state.scoreboard = await api({
        action: "merge",
        sourceId,
        targetId,
        settingsPassword: $("settingsPassword")?.value || "",
      });
      renderScoreboard();
      message("Identities merged.");
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
    if (!$("settingsPassword")?.value) {
      message("Enter the settings password first.", true);
      return;
    }
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
    if (!$("settingsPassword")?.value) {
      message("Enter the settings password first.", true);
      return;
    }
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
  if ($("mergePlayers")) $("mergePlayers").addEventListener("click", mergePlayers);
  if ($("wipeScores")) $("wipeScores").addEventListener("click", wipeScores);
  if ($("clearAllActiveGames")) $("clearAllActiveGames").addEventListener("click", clearAllActiveGames);
  load();
})();
