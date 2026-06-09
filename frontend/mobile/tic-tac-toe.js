(() => {
  const storageKey = "iiab-overland-tic-tac-toe";
  const $ = (id) => document.getElementById(id);
  const state = {
    playerId: "",
    playerName: "",
    gameId: "",
    mark: "",
    mode: "pvp",
    difficulty: "medium",
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
    } catch {
      state.playerId = profileId();
      state.playerName = profileName();
    }
    saveProfile(state.playerId, state.playerName);
    $("playerNameLabel").textContent = state.playerName || "Player";
    const modeInput = document.querySelector(`input[name="gameMode"][value="${state.mode}"]`);
    if (modeInput) modeInput.checked = true;
    $("difficulty").value = state.difficulty || "medium";
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

  async function api(payload = {}) {
    const response = await fetch("/mobile-games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
  }

  async function loadOpenGames() {
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      const data = await response.json();
      renderOpenGames(Array.isArray(data.games) ? data.games : []);
    } catch (error) {
      $("openGames").innerHTML = `<div class="open-game"><span>${error.message}</span></div>`;
    }
  }

  function renderOpenGames(games) {
    const target = $("openGames");
    if (!games.length) {
      target.innerHTML = '<div class="open-game"><span>No open games. Create one and another device can join.</span></div>';
      return;
    }
    target.replaceChildren(...games.map((game) => {
      const row = document.createElement("div");
      row.className = "open-game";
      const names = (game.players || []).map((player) => `${player.name || "Player"} (${player.mark})`).join(" vs ");
      row.innerHTML = `<div><strong>${escapeHtml(game.title || "Tic-Tac-Toe")}</strong><span>${escapeHtml(names || "Waiting for player")}</span></div>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Join";
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
      headline = me ? (game.turn === state.mark ? "Your turn." : `${turnName}'s turn.`) : `Watching ${turnName}'s turn.`;
      label = me ? (game.mode === "cpu" ? `${game.difficulty || "medium"} CPU` : `You are ${state.mark}`) : "observer";
    }
    $("gameState").textContent = label;
    $("gameStatus").textContent = headline;
    renderPlayers(players, game.turn);
    renderBoard(game);
  }

  function renderPlayers(players, turn) {
    const missing = players.length < 2 ? [{ name: "Waiting...", mark: "O" }] : [];
    $("players").replaceChildren(...players.concat(missing).map((player) => {
      const card = document.createElement("div");
      card.className = `player ${player.mark === turn ? "current" : ""}`;
      card.innerHTML = `<span>${escapeHtml(player.mark || "")}</span><strong>${escapeHtml(player.name || "Player")}</strong>`;
      return card;
    }));
  }

  function renderBoard(game) {
    const board = Array.isArray(game.board) ? game.board : Array(9).fill("");
    const winningLine = new Set(game.winningLine || []);
    $("board").replaceChildren(...board.map((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `cell ${winningLine.has(index) ? "win" : ""}`;
      button.textContent = value || "";
      button.disabled = Boolean(value) || game.status !== "active" || game.turn !== state.mark || Boolean(game.winner);
      button.addEventListener("click", () => makeMove(index));
      return button;
    }));
  }

  async function createGame() {
    try {
      const data = await api({
        action: "create",
        game: "tic-tac-toe",
        playerId: state.playerId,
        playerName: nameValue(),
        mode: state.mode,
        difficulty: state.difficulty,
      });
      state.gameId = data.game.id;
      state.mark = data.mark;
      saveLocal();
      showGame(data.game);
      startPolling();
      message(state.mode === "cpu" ? "Computer game started." : "Game created. Another device can join from Open Games.");
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
      message(data.observer || !state.mark ? "Opened as observer." : `Joined as ${state.mark}.`);
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

  async function makeMove(cell) {
    try {
      const data = await api({ action: "move", gameId: state.gameId, playerId: state.playerId, cell });
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
      message("Board reset.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function closeGame() {
    try {
      if (state.gameId) {
        await api({ action: "delete", gameId: state.gameId, playerId: state.playerId });
      }
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
    state.poll = setInterval(refreshCurrent, 1500);
  }

  function stopPolling() {
    if (state.poll) clearInterval(state.poll);
    state.poll = null;
  }

  function gameFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("game") || "";
  }

  function updateModeUi() {
    const selected = document.querySelector('input[name="gameMode"]:checked')?.value || "pvp";
    state.mode = selected;
    state.difficulty = $("difficulty").value || "medium";
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
  document.querySelectorAll('input[name="gameMode"]').forEach((input) => {
    input.addEventListener("change", updateModeUi);
  });
  $("difficulty").addEventListener("change", updateModeUi);
  window.addEventListener("beforeunload", stopPolling);
  main();
})();
