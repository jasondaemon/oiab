(() => {
  const state = {
    profile: { id: "", name: "Player" },
    game: null,
    gameId: "",
    playerMark: "",
    selectedTileId: "",
    tentative: [],
    exchangeMode: false,
    exchangeIds: new Set(),
    zoom: 1,
    pollTimer: null,
  };
  const tileValues = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, _: 0 };
  const $ = (id) => document.getElementById(id);

  function cleanName(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function loadProfile() {
    const saved = window.OIABPlayers?.get?.() || {};
    state.profile = { id: saved.id || "", name: cleanName(saved.name) || "Player" };
    $("playerNameLabel").textContent = state.profile.name;
  }

  function message(text, error = false) {
    $("message").textContent = text || "";
    $("message").style.color = error ? "var(--red)" : "var(--gold)";
  }

  async function postGame(form) {
    const response = await fetch("/mobile-games", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || `Game request failed: ${response.status}`);
    return data;
  }

  function adoptGame(data) {
    state.game = data.game || null;
    state.gameId = state.game?.id || "";
    state.playerMark = data.mark || state.game?.payload?.myMark || findMyMark(state.game) || state.playerMark;
  }

  function findMyMark(game) {
    return (game?.players || []).find((player) => player.id === state.profile.id)?.mark || "";
  }

  async function loadOpenGames() {
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Open games: ${response.status}`);
      const data = await response.json();
      const games = (data.games || []).filter((game) => game.type === "word-tile-arena");
      $("openGames").replaceChildren(...games.map(openGameCard));
    } catch (error) {
      message(error.message || "Could not load games.", true);
    }
  }

  function openGameCard(game) {
    const row = document.createElement("div");
    row.className = "open-game";
    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = game.title || "Word Tile Arena";
    const detail = document.createElement("span");
    detail.textContent = `${game.status || "waiting"} - ${(game.players || []).map((player) => player.name).join(" / ") || "Waiting"}`;
    text.append(title, detail);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Join";
    button.addEventListener("click", () => joinGame(game.id));
    row.append(text, button);
    return row;
  }

  async function createGame() {
    const data = await postGame(new URLSearchParams({
      action: "create",
      game: "word-tile-arena",
      playerId: state.profile.id,
      playerName: state.profile.name,
    }));
    adoptGame(data);
    showGame();
  }

  async function joinGame(gameId) {
    const data = await postGame(new URLSearchParams({
      action: "join",
      gameId,
      playerId: state.profile.id,
      playerName: state.profile.name,
    }));
    adoptGame(data);
    showGame();
  }

  function showGame() {
    $("lobby").hidden = true;
    $("gamePanel").hidden = false;
    state.tentative = [];
    startPolling();
    render();
    centerBoard();
  }

  function backToLobby() {
    stopPolling();
    state.gameId = "";
    state.game = null;
    state.playerMark = "";
    state.tentative = [];
    $("gamePanel").hidden = true;
    $("lobby").hidden = false;
    loadOpenGames();
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = window.setInterval(pollState, 1500);
    pollState();
  }

  function stopPolling() {
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  async function pollState() {
    if (!state.gameId) return;
    try {
      const data = await postGame(new URLSearchParams({ action: "state", gameId: state.gameId, playerId: state.profile.id }));
      state.game = data.game || state.game;
      state.playerMark = state.game?.payload?.myMark || findMyMark(state.game) || state.playerMark;
      render();
    } catch (error) {
      message(error.message || "Sync failed.", true);
    }
  }

  function tileNode(tile, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tile ${className}`.trim();
    const letter = tile.blank && !tile.assigned ? "?" : (tile.letter === "_" ? (tile.assigned || "?") : tile.letter);
    button.textContent = letter;
    const value = document.createElement("small");
    value.textContent = tile.blank ? "0" : (tile.value ?? tileValues[tile.letter] ?? 0);
    button.append(value);
    return button;
  }

  function boardCell(x, y, cell, premium, latestSet) {
    const div = document.createElement("button");
    div.type = "button";
    div.className = `cell ${String(premium || "").toLowerCase()} ${latestSet.has(`${x},${y}`) ? "latest" : ""}`.trim();
    div.dataset.x = x;
    div.dataset.y = y;
    div.textContent = premium === "STAR" ? "★" : (premium || "");
    const tentative = state.tentative.find((item) => item.x === x && item.y === y);
    if (tentative) {
      const node = tileNode({ letter: tentative.letter, assigned: tentative.letter, blank: tentative.blank, value: tentative.value }, "tentative");
      node.addEventListener("click", (event) => {
        event.stopPropagation();
        returnTentative(tentative.tileId);
      });
      div.replaceChildren(node);
    } else if (cell) {
      div.replaceChildren(tileNode(cell));
    }
    div.addEventListener("click", () => placeSelectedTile(x, y));
    return div;
  }

  function renderBoard() {
    const payload = state.game?.payload || {};
    const board = payload.board || [];
    const latest = payload.lastMove?.action === "play" ? new Set((payload.lastMove.coords || []).map((item) => `${item.x},${item.y}`)) : new Set();
    const frag = document.createDocumentFragment();
    for (let y = 0; y < 15; y += 1) {
      for (let x = 0; x < 15; x += 1) {
        frag.append(boardCell(x, y, board[y * 15 + x], payload.premiums?.[`${x},${y}`], latest));
      }
    }
    const boardEl = $("board");
    boardEl.style.transform = `scale(${state.zoom})`;
    boardEl.replaceChildren(frag);
  }

  function renderRack() {
    const rack = state.game?.payload?.rack || [];
    const usedIds = new Set(state.tentative.map((item) => item.tileId));
    const frag = document.createDocumentFragment();
    rack.filter((tile) => !usedIds.has(tile.id)).forEach((tile) => {
      const node = tileNode(tile, `${state.selectedTileId === tile.id ? "selected" : ""} ${state.exchangeIds.has(tile.id) ? "exchange" : ""}`);
      node.addEventListener("click", () => {
        if (state.exchangeMode) {
          if (state.exchangeIds.has(tile.id)) state.exchangeIds.delete(tile.id);
          else state.exchangeIds.add(tile.id);
        } else {
          state.selectedTileId = state.selectedTileId === tile.id ? "" : tile.id;
        }
        renderRack();
      });
      frag.append(node);
    });
    $("rack").replaceChildren(frag);
  }

  function renderScores() {
    const payload = state.game?.payload || {};
    const players = payload.players || [];
    $("scoreboard").replaceChildren(...players.map((player) => {
      const card = document.createElement("article");
      card.className = `score-card ${state.game?.turn === player.mark ? "active" : ""}`;
      card.innerHTML = `<span>${player.mark}</span><strong>${escapeHtml(player.name)}</strong><b>${player.score || 0}</b>`;
      return card;
    }));
  }

  function render() {
    const game = state.game;
    const payload = game?.payload || {};
    $("gameState").textContent = (game?.status || "waiting").toUpperCase();
    const myTurn = game?.turn && state.playerMark && game.turn === state.playerMark;
    $("gameStatus").textContent = game?.status === "waiting" ? "Waiting for players." : game?.status === "complete" ? `Finished: ${winnerLabel()}` : myTurn ? "Your turn." : `${nameForMark(game?.turn)} is playing.`;
    $("bagCount").textContent = payload.tileBagCount ?? 0;
    $("startGame").hidden = !(game?.status === "waiting" && state.playerMark === (payload.hostMark || "P1"));
    $("submitMove").disabled = !myTurn || !state.tentative.length;
    $("recallTiles").disabled = !state.tentative.length;
    $("passTurn").disabled = !myTurn;
    $("exchangeTiles").disabled = !myTurn;
    renderScores();
    renderBoard();
    renderRack();
    renderPreview();
  }

  function winnerLabel() {
    const winner = state.game?.winner || "";
    if (winner === "draw") return "draw";
    return `${nameForMark(winner)} wins`;
  }

  function nameForMark(mark) {
    return (state.game?.payload?.players || []).find((player) => player.mark === mark)?.name || mark || "Player";
  }

  function escapeHtml(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function renderPreview() {
    if (state.exchangeMode) {
      $("movePreview").textContent = `Exchange mode: selected ${state.exchangeIds.size} tile(s). Tap Exchange again to submit.`;
      return;
    }
    const word = state.tentative.map((item) => item.letter).join("");
    $("movePreview").textContent = word ? `Tentative tiles: ${word}` : "Select a rack tile, then tap a board square.";
  }

  async function placeSelectedTile(x, y) {
    if (!state.selectedTileId || state.game?.turn !== state.playerMark) return;
    const payload = state.game?.payload || {};
    const board = payload.board || [];
    if (board[y * 15 + x] || state.tentative.some((item) => item.x === x && item.y === y)) return;
    const tile = (payload.rack || []).find((item) => item.id === state.selectedTileId);
    if (!tile) return;
    let letter = tile.letter;
    if (tile.blank) {
      letter = await chooseBlankLetter();
      if (!letter) return;
    }
    state.tentative.push({ x, y, tileId: tile.id, letter, blank: !!tile.blank, value: tile.value || 0 });
    state.selectedTileId = "";
    render();
  }

  function chooseBlankLetter() {
    const dialog = $("blankDialog");
    const input = $("blankLetter");
    input.value = "";
    if (!dialog.showModal) {
      const fallback = window.prompt("Blank tile letter");
      return Promise.resolve(String(fallback || "").trim().toUpperCase().slice(0, 1).replace(/[^A-Z]/g, ""));
    }
    return new Promise((resolve) => {
      const close = () => {
        dialog.removeEventListener("close", close);
        resolve(dialog.returnValue === "ok" ? input.value.trim().toUpperCase().slice(0, 1).replace(/[^A-Z]/g, "") : "");
      };
      dialog.addEventListener("close", close);
      dialog.showModal();
      input.focus();
    });
  }

  function returnTentative(tileId) {
    state.tentative = state.tentative.filter((item) => item.tileId !== tileId);
    render();
  }

  async function submitMove() {
    try {
      const data = await postGame(new URLSearchParams({
        action: "move",
        wordAction: "play",
        gameId: state.gameId,
        playerId: state.profile.id,
        placements: JSON.stringify(state.tentative),
      }));
      state.tentative = [];
      adoptGame(data);
      render();
      message("Move accepted.");
    } catch (error) {
      message(error.message || "Move rejected.", true);
    }
  }

  async function startGame() {
    try {
      const data = await postGame(new URLSearchParams({ action: "move", wordAction: "start", gameId: state.gameId, playerId: state.profile.id }));
      adoptGame(data);
      render();
      centerBoard();
    } catch (error) {
      message(error.message || "Could not start game.", true);
    }
  }

  async function exchangeTiles() {
    if (!state.exchangeMode) {
      state.exchangeMode = true;
      state.selectedTileId = "";
      render();
      return;
    }
    try {
      const data = await postGame(new URLSearchParams({
        action: "move",
        wordAction: "exchange",
        gameId: state.gameId,
        playerId: state.profile.id,
        tileIds: JSON.stringify([...state.exchangeIds]),
      }));
      state.exchangeMode = false;
      state.exchangeIds.clear();
      adoptGame(data);
      render();
    } catch (error) {
      message(error.message || "Exchange failed.", true);
    }
  }

  async function passTurn() {
    try {
      const data = await postGame(new URLSearchParams({ action: "move", wordAction: "pass", gameId: state.gameId, playerId: state.profile.id }));
      adoptGame(data);
      render();
    } catch (error) {
      message(error.message || "Pass failed.", true);
    }
  }

  function recallTiles() {
    state.tentative = [];
    state.selectedTileId = "";
    render();
  }

  function centerBoard() {
    const viewport = $("boardViewport");
    const center = 7 * 42 * state.zoom;
    viewport.scrollLeft = Math.max(0, center - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, center - viewport.clientHeight / 2);
  }

  function latestMove() {
    const coords = state.game?.payload?.lastMove?.coords || [];
    if (!coords.length) {
      centerBoard();
      return;
    }
    const viewport = $("boardViewport");
    const avgX = coords.reduce((sum, item) => sum + Number(item.x || 0), 0) / coords.length;
    const avgY = coords.reduce((sum, item) => sum + Number(item.y || 0), 0) / coords.length;
    viewport.scrollLeft = Math.max(0, avgX * 42 * state.zoom - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, avgY * 42 * state.zoom - viewport.clientHeight / 2);
  }

  async function closeGame() {
    try {
      await postGame(new URLSearchParams({ action: "delete", gameId: state.gameId, playerId: state.profile.id }));
      backToLobby();
    } catch (error) {
      message(error.message || "Close failed.", true);
    }
  }

  function wire() {
    $("createGame").addEventListener("click", createGame);
    $("refreshGame").addEventListener("click", () => (state.gameId ? pollState() : loadOpenGames()));
    $("startGame").addEventListener("click", startGame);
    $("submitMove").addEventListener("click", submitMove);
    $("recallTiles").addEventListener("click", recallTiles);
    $("exchangeTiles").addEventListener("click", exchangeTiles);
    $("passTurn").addEventListener("click", passTurn);
    $("leaveGame").addEventListener("click", backToLobby);
    $("closeGame").addEventListener("click", closeGame);
    $("centerBoard").addEventListener("click", centerBoard);
    $("latestMove").addEventListener("click", latestMove);
    $("zoomIn").addEventListener("click", () => { state.zoom = Math.min(1.6, state.zoom + 0.1); renderBoard(); });
    $("zoomOut").addEventListener("click", () => { state.zoom = Math.max(0.75, state.zoom - 0.1); renderBoard(); });
    $("blankConfirm").addEventListener("click", (event) => {
      if (!$("blankLetter").value.trim().match(/^[a-zA-Z]$/)) {
        event.preventDefault();
      }
    });
  }

  loadProfile();
  wire();
  const params = new URLSearchParams(window.location.search);
  const requestedGame = params.get("game");
  if (requestedGame) {
    joinGame(requestedGame).catch((error) => {
      message(error.message || "Could not join game.", true);
      loadOpenGames();
    });
  } else {
    loadOpenGames();
  }
})();
