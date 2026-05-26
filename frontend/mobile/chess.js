import { Chess } from "./vendor/chess.js";

(() => {
  const storageKey = "iiab-overland-chess";
  const profileStorageKey = "iiab-overland-player-profile";
  const pieceGlyphs = {
    wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
    bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
  };
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const $ = (id) => document.getElementById(id);
  const state = {
    playerId: "",
    playerName: "",
    gameId: "",
    mark: "",
    mode: "pvp",
    difficulty: "medium",
    game: null,
    chess: new Chess(),
    selected: "",
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
    if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
  }

  async function loadOpenGames() {
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      const data = await response.json();
      renderOpenGames((Array.isArray(data.games) ? data.games : []).filter((game) => game.type === "chess"));
    } catch (error) {
      $("openGames").innerHTML = `<div class="open-game"><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function renderOpenGames(games) {
    const target = $("openGames");
    if (!games.length) {
      target.innerHTML = '<div class="open-game"><span>No open chess games. Create one and another device can join.</span></div>';
      return;
    }
    target.replaceChildren(...games.map((game) => {
      const row = document.createElement("div");
      row.className = "open-game";
      const names = (game.players || []).map((player) => `${player.name || "Player"} (${player.mark})`).join(" vs ");
      row.innerHTML = `<div><strong>${escapeHtml(game.title || "Chess")}</strong><span>${escapeHtml(names || "Waiting for player")}</span></div>`;
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

  function loadChess(fen) {
    state.chess = fen && fen !== "start" ? new Chess(fen) : new Chess();
  }

  function showGame(game) {
    state.game = game;
    loadChess(game.fen);
    $("lobby").hidden = true;
    $("gamePanel").hidden = false;
    const players = game.players || [];
    const currentSide = game.turn === "w" ? "white" : "black";
    const turnName = players.find((player) => player.mark === currentSide)?.name || currentSide;
    let headline = "Waiting for a second player.";
    let label = game.status || "waiting";
    if (game.winner === "draw") {
      headline = "Draw game.";
      label = "complete";
    } else if (game.winner) {
      const winner = players.find((player) => player.mark === game.winner);
      headline = `${winner?.name || game.winner} wins.`;
      label = game.result || "complete";
    } else if (game.status === "active") {
      const me = players.find((player) => player.mark === state.mark);
      headline = me ? (currentSide === state.mark ? "Your move." : `${turnName}'s move.`) : `Watching ${turnName}'s move.`;
      label = me ? (game.check ? "check" : game.mode === "cpu" ? `${game.difficulty || "medium"} CPU` : `You are ${state.mark}`) : "observer";
    }
    $("gameState").textContent = label;
    $("gameStatus").textContent = headline;
    renderPlayers(players, currentSide);
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

  function boardSquares() {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
    return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
  }

  function legalTargets(from) {
    if (!from) return new Map();
    return new Map(state.chess.moves({ square: from, verbose: true }).map((move) => [move.to, move]));
  }

  function renderBoard() {
    const legal = legalTargets(state.selected);
    $("board").replaceChildren(...boardSquares().map((square) => {
      const piece = state.chess.get(square);
      const button = document.createElement("button");
      const file = square.charCodeAt(0) - 97;
      const rank = Number(square[1]);
      const isLight = (file + rank) % 2 === 1;
      const move = legal.get(square);
      button.type = "button";
      button.className = `square ${isLight ? "light" : "dark"}${state.selected === square ? " selected" : ""}${move ? " legal" : ""}${move?.captured ? " capture" : ""}`;
      button.textContent = piece ? pieceGlyphs[`${piece.color}${piece.type}`] : "";
      button.disabled = !canMove();
      button.addEventListener("click", () => onSquare(square));
      return button;
    }));
  }

  function canMove() {
    if (!state.game || state.game.status !== "active" || state.game.winner) return false;
    const side = state.game.turn === "w" ? "white" : "black";
    return side === state.mark;
  }

  function onSquare(square) {
    if (!canMove()) return;
    const piece = state.chess.get(square);
    const ownColor = state.mark === "white" ? "w" : "b";
    if (state.selected) {
      const move = legalTargets(state.selected).get(square);
      if (move) {
        makeMove(move);
        return;
      }
    }
    if (piece && piece.color === ownColor) {
      state.selected = square;
      renderBoard();
    } else {
      state.selected = "";
      renderBoard();
    }
  }

  function gameResult(chess, movedColor) {
    if (chess.isCheckmate()) {
      return { status: "complete", winner: movedColor === "w" ? "white" : "black", result: movedColor === "w" ? "1-0" : "0-1" };
    }
    if (chess.isDraw()) {
      return { status: "complete", winner: "draw", result: "1/2-1/2" };
    }
    return { status: "active", winner: "", result: "" };
  }

  async function submitMove(move, playerId = state.playerId) {
    const beforeTurn = state.chess.turn();
    const applied = state.chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    if (!applied) return;
    const result = gameResult(state.chess, beforeTurn);
    const data = await api({
      action: "move",
      gameId: state.gameId,
      playerId,
      move: `${applied.from}${applied.to}${applied.promotion || ""}`,
      fen: state.chess.fen(),
      turn: state.chess.turn(),
      check: state.chess.isCheck(),
      ...result,
    });
    state.selected = "";
    showGame(data.game);
    return data.game;
  }

  async function makeMove(move) {
    try {
      const game = await submitMove(move);
      message("");
      if (game?.status === "active" && game.mode === "cpu" && game.turn === "b") {
        window.setTimeout(cpuTurn, 260);
      }
    } catch (error) {
      message(error.message, true);
    }
  }

  function chooseCpuMove(chess, difficulty) {
    const moves = chess.moves({ verbose: true });
    if (!moves.length) return null;
    if (difficulty === "easy") return moves[Math.floor(Math.random() * moves.length)];
    const captures = moves.filter((move) => move.captured);
    const checks = moves.filter((move) => {
      const test = new Chess(chess.fen());
      test.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
      return test.isCheck();
    });
    if (difficulty === "medium") {
      const pool = captures.length ? captures : checks.length ? checks : moves;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    let best = null;
    let bestScore = -999;
    for (const move of moves) {
      const test = new Chess(chess.fen());
      test.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
      let score = evaluateBoard(test);
      if (test.isCheckmate()) score += 100;
      if (test.isCheck()) score += 2;
      if (move.captured) score += pieceValues[move.captured] || 0;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best || moves[Math.floor(Math.random() * moves.length)];
  }

  function evaluateBoard(chess) {
    let score = 0;
    for (const row of chess.board()) {
      for (const piece of row) {
        if (!piece) continue;
        const value = pieceValues[piece.type] || 0;
        score += piece.color === "b" ? value : -value;
      }
    }
    return score;
  }

  async function cpuTurn() {
    try {
      loadChess(state.game.fen);
      const move = chooseCpuMove(state.chess, state.game.difficulty || "medium");
      if (!move) return;
      await submitMove(move, `cpu-${state.game.difficulty || "medium"}`);
    } catch (error) {
      message(error.message, true);
    }
  }

  async function createGame() {
    try {
      const data = await api({
        action: "create",
        game: "chess",
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
      message(state.mode === "cpu" ? "Computer chess game started." : "Chess game created. Another device can join from Open Games.");
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
    state.selected = "";
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
  window.addEventListener("beforeunload", stopPolling);
  main();
})();
