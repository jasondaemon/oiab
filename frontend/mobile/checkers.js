(() => {
  const storageKey = "iiab-overland-checkers";
  const profileStorageKey = "iiab-overland-player-profile";
  const $ = (id) => document.getElementById(id);
  const state = {
    playerId: "",
    playerName: "",
    gameId: "",
    mark: "",
    mode: "pvp",
    difficulty: "medium",
    forcedJumps: true,
    game: null,
    selected: null,
    poll: null,
  };

  function randomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanName(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function queryValue(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function loadProfileFromStorage() {
    try {
      return JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
    } catch {
      return {};
    }
  }

  function saveProfile(id, name) {
    localStorage.setItem(profileStorageKey, JSON.stringify({ id, name }));
  }

  function profileName() {
    const fromQuery = cleanName(queryValue("playerName"));
    const saved = loadProfileFromStorage();
    return fromQuery || cleanName(saved.name) || "Player";
  }

  function profileId() {
    const fromQuery = queryValue("playerId");
    const saved = loadProfileFromStorage();
    return fromQuery || saved.id || randomId();
  }

  function loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      state.playerId = profileId() || saved.playerId || randomId();
      state.playerName = profileName();
      state.gameId = saved.gameId || "";
      state.mark = saved.mark || "";
      state.mode = saved.mode || "pvp";
      state.difficulty = saved.difficulty || "medium";
      state.forcedJumps = saved.forcedJumps !== false;
    } catch {
      state.playerId = profileId();
      state.playerName = profileName();
    }
    saveProfile(state.playerId, state.playerName);
    $("playerNameLabel").textContent = state.playerName || "Player";
    const modeInput = document.querySelector(`input[name="gameMode"][value="${state.mode}"]`);
    if (modeInput) modeInput.checked = true;
    $("difficulty").value = state.difficulty || "medium";
    $("forcedJumps").checked = state.forcedJumps !== false;
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
      forcedJumps: state.forcedJumps,
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
    if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
  }

  async function loadOpenGames() {
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      const data = await response.json();
      renderOpenGames((Array.isArray(data.games) ? data.games : []).filter((game) => game.type === "checkers"));
    } catch (error) {
      $("openGames").innerHTML = `<div class="open-game"><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function renderOpenGames(games) {
    const target = $("openGames");
    if (!games.length) {
      target.innerHTML = '<div class="open-game"><span>No open checkers games. Create one and another device can join.</span></div>';
      return;
    }
    target.replaceChildren(...games.map((game) => {
      const row = document.createElement("div");
      row.className = "open-game";
      const names = (game.players || []).map((player) => `${player.name || "Player"} (${player.mark})`).join(" vs ");
      const rule = game.payload?.forcedJumps === false ? "optional jumps" : "forced jumps";
      row.innerHTML = `<div><strong>${escapeHtml(game.title || "Checkers")}</strong><span>${escapeHtml(names || "Waiting for player")} · ${escapeHtml(rule)}</span></div>`;
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
      const me = players.find((player) => player.mark === state.mark);
      const mustContinue = game.payload?.mustContinue;
      const jumpRequired = requiredJumpMoves(game).length > 0;
      headline = me ? (game.turn === state.mark ? "Your move." : `${turnName}'s move.`) : `Watching ${turnName}'s move.`;
      if (mustContinue !== null && mustContinue !== undefined) headline = game.turn === state.mark ? "Keep jumping." : `${turnName} must keep jumping.`;
      else if (jumpRequired && game.turn === state.mark) headline = "Jump required.";
      label = me ? (game.mode === "cpu" ? `${game.difficulty || "medium"} CPU` : `You are ${state.mark}`) : "observer";
    }
    $("gameState").textContent = label;
    $("gameStatus").textContent = headline;
    renderPlayers(players, game.turn);
    renderBoard();
  }

  function renderPlayers(players, turn) {
    const missing = players.length < 2 ? [{ name: "Waiting...", mark: "black" }] : [];
    $("players").replaceChildren(...players.concat(missing).map((player) => {
      const card = document.createElement("div");
      card.className = `player ${player.mark === turn ? "current" : ""}`;
      card.innerHTML = `<span>${escapeHtml(player.mark || "")}</span><strong>${escapeHtml(player.name || "Player")}</strong>`;
      return card;
    }));
  }

  function rowCol(index) {
    const row = Math.floor(index / 4);
    const col = (index % 4) * 2 + (row % 2 === 0 ? 1 : 0);
    return [row, col];
  }

  function indexAt(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    if ((row + col) % 2 === 0) return null;
    return row * 4 + Math.floor(col / 2);
  }

  function legalTargets(from) {
    return new Map((state.game?.payload?.legalMoves || []).filter((move) => move.from === from).map((move) => [move.to, move]));
  }

  function isCaptureMove(move) {
    return move?.capture !== undefined && move.capture !== null;
  }

  function requiredJumpMoves(game = state.game) {
    const payload = game?.payload || {};
    const moves = Array.isArray(payload.legalMoves) ? payload.legalMoves : [];
    const mustContinue = payload.mustContinue !== null && payload.mustContinue !== undefined;
    if (!mustContinue && payload.forcedJumps === false) return [];
    return moves.filter(isCaptureMove);
  }

  function canMove() {
    if (!state.game || state.game.status !== "active" || state.game.winner) return false;
    return state.game.turn === state.mark;
  }

  function pieceSide(piece) {
    if (String(piece || "").toLowerCase() === "r") return "red";
    if (String(piece || "").toLowerCase() === "b") return "black";
    return "";
  }

  function renderBoard() {
    const board = state.game?.payload?.board || [];
    const legal = legalTargets(state.selected);
    const requiredMoves = canMove() ? requiredJumpMoves() : [];
    const requiredFrom = new Set(requiredMoves.map((move) => move.from));
    const requiredTo = new Set(requiredMoves.map((move) => move.to));
    const last = state.game?.payload?.lastMove || {};
    const cells = [];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const index = indexAt(row, col);
        const button = document.createElement("button");
        const isLight = index === null;
        const piece = index === null ? "" : board[index] || "";
        const move = index === null ? null : legal.get(index);
        const isRequiredFrom = index !== null && requiredFrom.has(index);
        const isRequiredTo = index !== null && requiredTo.has(index);
        button.type = "button";
        button.className = `square ${isLight ? "light empty-light" : "dark playable"}${state.selected === index ? " selected" : ""}${move ? " legal" : ""}${isCaptureMove(move) ? " capture" : ""}${isRequiredFrom ? " required-jumper" : ""}${isRequiredTo ? " required-target" : ""}${last.from === index || last.to === index ? " last" : ""}`;
        button.disabled = isLight || !canMove();
        if (piece) {
          const disk = document.createElement("span");
          disk.className = `checker-piece ${pieceSide(piece)} ${piece === piece.toUpperCase() ? "king" : ""}`;
          button.append(disk);
        }
        if (!isLight) button.addEventListener("click", () => onSquare(index));
        cells.push(button);
      }
    }
    $("board").replaceChildren(...cells);
  }

  function onSquare(index) {
    if (!canMove()) return;
    const board = state.game?.payload?.board || [];
    const piece = board[index] || "";
    if (state.selected !== null && state.selected !== undefined) {
      const move = legalTargets(state.selected).get(index);
      if (move) {
        makeMove(state.selected, index);
        return;
      }
    }
    if (piece && pieceSide(piece) === state.mark) {
      state.selected = index;
      renderBoard();
    } else {
      state.selected = null;
      renderBoard();
    }
  }

  async function makeMove(from, to) {
    try {
      const data = await api({
        action: "move",
        gameId: state.gameId,
        playerId: state.playerId,
        from,
        to,
      });
      state.selected = null;
      showGame(data.game);
      message("");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function createGame() {
    try {
      const data = await api({
        action: "create",
        game: "checkers",
        playerId: state.playerId,
        playerName: nameValue(),
        mode: state.mode,
        difficulty: state.difficulty,
        forcedJumps: state.forcedJumps ? "1" : "0",
      });
      state.gameId = data.game.id;
      state.mark = data.mark;
      saveLocal();
      showGame(data.game);
      startPolling();
      message(state.mode === "cpu" ? "Computer checkers game started." : "Checkers game created. Another device can join from Open Games.");
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
      const data = await api({ action: "state", gameId: state.gameId, playerId: state.playerId });
      showGame(data.game);
    } catch (error) {
      leaveGame(false);
      message(error.message, true);
      await loadOpenGames();
    }
  }

  async function resetGame() {
    try {
      const data = await api({ action: "reset", gameId: state.gameId, playerId: state.playerId });
      state.selected = null;
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
    state.selected = null;
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
    state.forcedJumps = $("forcedJumps").checked;
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
  $("forcedJumps").addEventListener("change", updateModeUi);
  window.addEventListener("beforeunload", stopPolling);
  main();
})();
