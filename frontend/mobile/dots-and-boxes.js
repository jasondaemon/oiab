(() => {
  const storageKey = "iiab-overland-dots-and-boxes";
  const $ = (id) => document.getElementById(id);
  const state = {
    playerId: "",
    playerName: "",
    gameId: "",
    mark: "",
    mode: "pvp",
    difficulty: "medium",
    boardSize: 4,
    game: null,
    poll: null,
  };

  function cleanName(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function queryValue(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function loadProfileFromStorage() {
    const player = window.OIABPlayers?.get?.() || {};
    return { id: player.id || "", name: player.name || "" };
  }

  function saveProfile(id, name) {
    if (id && name && window.OIABPlayers?.set) window.OIABPlayers.set({ id, name });
  }

  function profileName() {
    const fromQuery = cleanName(queryValue("playerName"));
    const saved = loadProfileFromStorage();
    return fromQuery || cleanName(saved.name) || "Player";
  }

  function profileId() {
    const fromQuery = queryValue("playerId");
    const saved = loadProfileFromStorage();
    return fromQuery || saved.id || "";
  }

  function loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      state.playerId = profileId() || saved.playerId || "";
      state.playerName = profileName();
      state.gameId = saved.gameId || "";
      state.mark = saved.mark || "";
      state.mode = saved.mode || "pvp";
      state.difficulty = saved.difficulty || "medium";
      state.boardSize = normalizeBoardSize(saved.boardSize || 4);
    } catch {
      state.playerId = profileId();
      state.playerName = profileName();
    }
    saveProfile(state.playerId, state.playerName);
    $("playerNameLabel").textContent = state.playerName || "Player";
    const modeInput = document.querySelector(`input[name="gameMode"][value="${state.mode}"]`);
    if (modeInput) modeInput.checked = true;
    $("difficulty").value = state.difficulty || "medium";
    $("boardSize").value = String(state.boardSize || 4);
    updateModeUi();
  }

  function saveLocal() {
    localStorage.setItem(storageKey, JSON.stringify({
      playerId: state.playerId,
      playerName: state.playerName,
      gameId: state.gameId,
      mark: state.mark,
      mode: state.mode,
      difficulty: state.difficulty,
      boardSize: state.boardSize,
    }));
  }

  function message(text, error = false) {
    $("message").textContent = text || "";
    $("message").style.color = error ? "var(--red)" : "var(--gold)";
  }

  function nameValue() {
    const name = state.playerName || profileName() || "Player";
    state.playerName = name;
    saveLocal();
    return name;
  }

  function normalizeBoardSize(value) {
    const size = Number.parseInt(value, 10);
    if (!Number.isFinite(size)) return 4;
    return Math.max(3, Math.min(6, size));
  }

  async function api(payload = {}) {
    const response = await fetch("/mobile-games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
  }

  async function loadOpenGames() {
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      const data = await response.json();
      renderOpenGames((Array.isArray(data.games) ? data.games : []).filter((game) => game.type === "dots-and-boxes"));
    } catch (error) {
      $("openGames").innerHTML = `<div class="open-game"><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function renderOpenGames(games) {
    const target = $("openGames");
    if (!games.length) {
      target.innerHTML = '<div class="open-game"><span>No saved dots games. Create one and another device can join.</span></div>';
      return;
    }
    target.replaceChildren(...games.map((game) => {
      const row = document.createElement("div");
      row.className = "open-game";
      const names = (game.players || []).map((player) => `${player.name || "Player"} (${player.mark})`).join(" vs ");
      const sizeLabel = `${Number(game.size || 4)}x${Number(game.size || 4)}`;
      row.innerHTML = `<div><strong>${escapeHtml(game.title || "Dots and Boxes")} · ${escapeHtml(sizeLabel)}</strong><span>${escapeHtml(names || "Waiting for player")}</span></div>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open";
      button.addEventListener("click", () => joinGame(game.id));
      row.append(button);
      return row;
    }));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showGame(game) {
    state.game = game;
    $("lobby").hidden = true;
    $("gamePanel").hidden = false;
    const players = game.players || [];
    const me = players.find((player) => player.mark === state.mark);
    const turnName = players.find((player) => player.mark === game.turn)?.name || game.turn;
    let headline = "Waiting for a second player.";
    let label = game.status || "waiting";
    if (game.winner === "draw") {
      headline = "Draw game.";
      label = "complete";
    } else if (game.winner) {
      const winner = players.find((player) => player.mark === game.winner);
      headline = `${winner?.name || game.winner} wins.`;
      label = "complete";
    } else if (game.status === "active") {
      headline = me ? (game.turn === state.mark ? "Your turn. Complete a box to go again." : `${turnName}'s turn.`) : `Watching ${turnName}'s turn.`;
      label = me ? (game.mode === "cpu" ? `${game.difficulty || "medium"} CPU` : `You are ${state.mark}`) : "observer";
    }
    $("gameState").textContent = label;
    $("gameStatus").textContent = headline;
    renderPlayers(players, game.turn, game.scores || {});
    renderBoard(game);
  }

  function renderPlayers(players, turn, scores) {
    const missing = players.length < 2 ? [{ name: "Waiting...", mark: "B" }] : [];
    $("players").replaceChildren(...players.concat(missing).map((player) => {
      const card = document.createElement("div");
      card.className = `player ${player.mark === turn ? "current" : ""}`;
      card.innerHTML = `<span>${escapeHtml(player.mark || "")} · ${scores[player.mark] || 0} boxes</span><strong>${escapeHtml(player.name || "Player")}</strong>`;
      return card;
    }));
  }

  function renderBoard(game) {
    const size = Number(game.size || 4);
    const edges = Array.isArray(game.edges) ? game.edges : [];
    const boxes = Array.isArray(game.boxes) ? game.boxes : [];
    const lastEdge = game.lastMove?.edge;
    const board = $("board");
    board.style.setProperty("--dots-cells", String(size * 2 + 1));
    board.style.gridTemplateColumns = `repeat(${size * 2 + 1}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${size * 2 + 1}, 1fr)`;
    board.dataset.size = String(size);
    const nodes = [];
    const horizontalCount = (size + 1) * size;
    for (let gridRow = 0; gridRow < size * 2 + 1; gridRow += 1) {
      for (let gridCol = 0; gridCol < size * 2 + 1; gridCol += 1) {
        if (gridRow % 2 === 0 && gridCol % 2 === 0) {
          const dot = document.createElement("div");
          dot.className = "dot";
          nodes.push(dot);
        } else if (gridRow % 2 === 0) {
          const edge = (gridRow / 2) * size + Math.floor(gridCol / 2);
          nodes.push(edgeButton(edge, "h", edges[edge], edge === lastEdge));
        } else if (gridCol % 2 === 0) {
          const edge = horizontalCount + Math.floor(gridRow / 2) * (size + 1) + (gridCol / 2);
          nodes.push(edgeButton(edge, "v", edges[edge], edge === lastEdge));
        } else {
          const boxIndex = Math.floor(gridRow / 2) * size + Math.floor(gridCol / 2);
          const box = document.createElement("div");
          const owner = boxes[boxIndex] || "";
          box.className = `box ${owner ? `owner-${owner.toLowerCase()}` : ""}`;
          box.textContent = owner;
          nodes.push(box);
        }
      }
    }
    board.replaceChildren(...nodes);
  }

  function edgeButton(index, orientation, owner, last) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `edge ${orientation} ${owner ? `owner-${owner.toLowerCase()}` : ""} ${last ? "last" : ""}`;
    button.disabled = Boolean(owner) || !canMove();
    button.setAttribute("aria-label", `Draw line ${index + 1}`);
    button.addEventListener("click", () => makeMove(index));
    return button;
  }

  function canMove() {
    if (!state.game || state.game.status !== "active" || state.game.winner) return false;
    return state.game.turn === state.mark;
  }

  async function createGame() {
    try {
      const data = await api({
        action: "create",
        game: "dots-and-boxes",
        playerId: state.playerId,
        playerName: nameValue(),
        mode: state.mode,
        difficulty: state.difficulty,
        size: state.boardSize,
      });
      state.gameId = data.game.id;
      state.mark = data.mark;
      saveLocal();
      showGame(data.game);
      startPolling();
      message(state.mode === "cpu" ? "Computer dots game started." : "Dots game created. Another device can join from Open Games.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function joinGame(gameId) {
    try {
      const data = await api({ action: "join", gameId, playerId: state.playerId, playerName: nameValue() });
      state.gameId = data.game.id;
      state.mark = data.mark;
      saveLocal();
      showGame(data.game);
      startPolling();
      message(data.observer || !state.mark ? "Opened as observer." : `Opened as ${state.mark}.`);
    } catch (error) {
      message(error.message, true);
    }
  }

  async function refreshCurrent() {
    if (!state.gameId) {
      await loadOpenGames();
      return;
    }
    try {
      const data = await api({ action: "state", gameId: state.gameId });
      showGame(data.game);
    } catch (error) {
      leaveGame(false);
      message(error.message, true);
      await loadOpenGames();
    }
  }

  async function makeMove(edge) {
    try {
      const data = await api({ action: "move", gameId: state.gameId, playerId: state.playerId, edge });
      showGame(data.game);
      message("");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function resetGame() {
    try {
      const data = await api({ action: "reset", gameId: state.gameId, playerId: state.playerId });
      showGame(data.game);
      message("New board started.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function closeGame() {
    try {
      if (state.gameId) await api({ action: "delete", gameId: state.gameId, playerId: state.playerId });
      leaveGame();
      message("Game closed.");
    } catch (error) {
      message(error.message, true);
    }
  }

  function leaveGame(clearMessage = true) {
    state.gameId = "";
    state.mark = "";
    state.game = null;
    saveLocal();
    $("gamePanel").hidden = true;
    $("lobby").hidden = false;
    stopPolling();
    loadOpenGames();
    if (clearMessage) message("");
  }

  function startPolling() {
    stopPolling();
    state.poll = setInterval(refreshCurrent, 1800);
  }

  function stopPolling() {
    if (state.poll) clearInterval(state.poll);
    state.poll = null;
  }

  function gameFromUrl() {
    return new URLSearchParams(window.location.search).get("game") || "";
  }

  function updateModeUi() {
    state.mode = document.querySelector('input[name="gameMode"]:checked')?.value || "pvp";
    state.difficulty = $("difficulty").value || "medium";
    state.boardSize = normalizeBoardSize($("boardSize").value);
    $("difficultyLabel").hidden = state.mode !== "cpu";
    saveLocal();
  }

  async function main() {
    loadLocal();
    const requestedGame = gameFromUrl();
    if (requestedGame) {
      await joinGame(requestedGame);
    } else if (state.gameId) {
      await refreshCurrent();
      startPolling();
    } else {
      await loadOpenGames();
    }
  }

  $("createGame").addEventListener("click", createGame);
  $("refreshGame").addEventListener("click", () => state.gameId ? refreshCurrent() : loadOpenGames());
  $("leaveGame").addEventListener("click", () => leaveGame());
  $("resetGame").addEventListener("click", resetGame);
  $("closeGame").addEventListener("click", closeGame);
  document.querySelectorAll('input[name="gameMode"]').forEach((input) => input.addEventListener("change", updateModeUi));
  $("difficulty").addEventListener("change", updateModeUi);
  $("boardSize").addEventListener("change", updateModeUi);
  window.addEventListener("beforeunload", stopPolling);
  main();
})();
