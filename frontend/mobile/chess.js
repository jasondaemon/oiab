import { Chess } from "./vendor/chess.js";

(() => {
  const storageKey = "iiab-overland-chess";
  const profileStorageKey = "iiab-overland-player-profile";
  const pieceGlyphs = {
    wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
    bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
  };
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const pieceScores = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const cpuProfiles = {
    easy: { depth: 1, maxNodes: 350, randomMoveChance: 0.32, scoreNoise: 100, topBand: 180 },
    medium: { depth: 2, maxNodes: 2600, randomMoveChance: 0.06, scoreNoise: 28, topBand: 45 },
    hard: { depth: 3, maxNodes: 14000, randomMoveChance: 0, scoreNoise: 0, topBand: 8 },
  };
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
    board: null,
    orientation: "white",
    selected: "",
    poll: null,
    undoStack: [],
    redoStack: [],
    lastMove: null,
    theme: "classic",
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
      state.theme = saved.theme || "classic";
    } catch {
      state.playerId = profileId();
      state.playerName = profileName();
    }
    saveProfile(state.playerId, state.playerName);
    $("playerNameLabel").textContent = state.playerName || "Player";
    const modeInput = document.querySelector(`input[name="gameMode"][value="${state.mode}"]`);
    if (modeInput) modeInput.checked = true;
    $("difficulty").value = state.difficulty || "medium";
    if ($("boardTheme")) $("boardTheme").value = state.theme || "classic";
    document.body.dataset.boardTheme = state.theme || "classic";
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
      theme: state.theme,
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

  function ensureBoard() {
    if (state.board || !window.Chessboard) return;
    state.board = window.Chessboard("board", {
      draggable: false,
      position: "start",
      pieceTheme: "/mobile/vendor/chessboardjs/img/chesspieces/wikipedia/{piece}.png",
    });
    window.addEventListener("resize", () => state.board?.resize?.());
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
    renderSidePanels();
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

  function legalTargets(from) {
    if (!from) return new Map();
    return new Map(state.chess.moves({ square: from, verbose: true }).map((move) => [move.to, move]));
  }

  function renderBoard() {
    ensureBoard();
    if (state.board) {
      state.board.orientation(state.orientation);
      state.board.position(state.chess.fen(), false);
      window.setTimeout(() => {
        bindBoardTapHandlers();
        updateBoardHighlights();
      }, 0);
    }
  }

  function canMove() {
    if (!state.game || state.game.status !== "active" || state.game.winner) return false;
    const side = state.game.turn === "w" ? "white" : "black";
    return side === state.mark;
  }

  function bindBoardTapHandlers() {
    window.jQuery?.("#board .square-55d63").each((_, squareEl) => {
      const square = squareFromClass(squareEl);
      if (!square || squareEl.dataset.tapBound === "true") return;
      squareEl.dataset.tapBound = "true";
      squareEl.setAttribute("role", "button");
      squareEl.setAttribute("aria-label", `Square ${square}`);
      squareEl.addEventListener("click", () => onSquareTap(square));
    });
  }

  function squareFromClass(element) {
    for (const className of element.classList || []) {
      if (/^square-[a-h][1-8]$/.test(className)) return className.slice("square-".length);
    }
    return "";
  }

  function onSquareTap(square) {
    if (!canMove()) return;
    const piece = state.chess.get(square);
    const ownColor = state.mark === "white" ? "w" : "b";
    if (state.selected) {
      if (square === state.selected) {
        state.selected = "";
        updateBoardHighlights();
        return;
      }
      const move = legalTargets(state.selected).get(square);
      if (move) {
        if (needsPromotion(move)) {
          choosePromotion().then((promotion) => {
            if (promotion) makeMove({ ...move, promotion });
          });
        } else {
          makeMove(move);
        }
        return;
      }
    }
    state.selected = piece?.color === ownColor ? square : "";
    updateBoardHighlights();
  }

  function needsPromotion(move) {
    const piece = state.chess.get(move.from);
    return piece?.type === "p" && (move.to.endsWith("8") || move.to.endsWith("1"));
  }

  function choosePromotion() {
    const dialog = $("promotionDialog");
    if (!dialog?.showModal) return Promise.resolve("q");
    return new Promise((resolve) => {
      const handler = () => {
        dialog.removeEventListener("close", handler);
        resolve(["q", "r", "b", "n"].includes(dialog.returnValue) ? dialog.returnValue : "q");
      };
      dialog.addEventListener("close", handler);
      dialog.showModal();
    });
  }

  function removeBoardHighlights() {
    window.jQuery?.("#board .square-55d63").removeClass("highlight-source highlight-target highlight-capture highlight-last highlight-check");
  }

  function addSquareClass(square, className) {
    if (!square) return;
    window.jQuery?.(`#board .square-${square}`).addClass(className);
  }

  function updateBoardHighlights() {
    if (!window.jQuery) return;
    removeBoardHighlights();
    if (state.lastMove) {
      addSquareClass(state.lastMove.from, "highlight-last");
      addSquareClass(state.lastMove.to, "highlight-last");
    }
    if (state.selected) {
      addSquareClass(state.selected, "highlight-source");
      for (const [square, move] of legalTargets(state.selected).entries()) {
        addSquareClass(square, move.captured ? "highlight-capture" : "highlight-target");
      }
    }
    if (state.chess.isCheck()) {
      const color = state.chess.turn();
      for (const square of Object.keys(state.board?.position() || {})) {
        const piece = state.chess.get(square);
        if (piece?.type === "k" && piece.color === color) addSquareClass(square, "highlight-check");
      }
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
    state.undoStack.push(state.chess.fen());
    state.redoStack = [];
    const applied = state.chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    if (!applied) return;
    state.lastMove = { from: applied.from, to: applied.to };
    const result = gameResult(state.chess, beforeTurn);
    const data = await api({
      action: "move",
      gameId: state.gameId,
      playerId,
      move: applied.san || `${applied.from}${applied.to}${applied.promotion || ""}`,
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
    const profile = cpuProfiles[difficulty] || cpuProfiles.medium;
    const cpuColor = chess.turn();
    if (Math.random() < profile.randomMoveChance) return randomChoice(moves);

    const budget = { nodes: 0, maxNodes: profile.maxNodes };
    const candidates = [];
    for (const move of orderMoves(chess, moves)) {
      const test = new Chess(chess.fen());
      applyVerboseMove(test, move);
      const rawScore = minimax(test, profile.depth - 1, -Infinity, Infinity, cpuColor, budget);
      const score = rawScore + ((Math.random() - 0.5) * profile.scoreNoise);
      candidates.push({ move, score });
      if (budget.nodes >= budget.maxNodes) break;
    }
    candidates.sort((left, right) => right.score - left.score);
    const bestScore = candidates[0]?.score ?? 0;
    const pool = candidates.filter((item) => bestScore - item.score <= profile.topBand);
    return (randomChoice(pool) || candidates[0] || { move: randomChoice(moves) }).move;
  }

  function minimax(chess, depth, alpha, beta, cpuColor, budget) {
    budget.nodes += 1;
    if (depth <= 0 || budget.nodes >= budget.maxNodes || chess.isGameOver()) {
      return evaluatePosition(chess, cpuColor, depth);
    }

    const maximizing = chess.turn() === cpuColor;
    const moves = orderMoves(chess, chess.moves({ verbose: true }));
    if (!moves.length) return evaluatePosition(chess, cpuColor, depth);

    if (maximizing) {
      let best = -Infinity;
      for (const move of moves) {
        const test = new Chess(chess.fen());
        applyVerboseMove(test, move);
        best = Math.max(best, minimax(test, depth - 1, alpha, beta, cpuColor, budget));
        alpha = Math.max(alpha, best);
        if (beta <= alpha || budget.nodes >= budget.maxNodes) break;
      }
      return best;
    }

    let best = Infinity;
    for (const move of moves) {
      const test = new Chess(chess.fen());
      applyVerboseMove(test, move);
      best = Math.min(best, minimax(test, depth - 1, alpha, beta, cpuColor, budget));
      beta = Math.min(beta, best);
      if (beta <= alpha || budget.nodes >= budget.maxNodes) break;
    }
    return best;
  }

  function evaluatePosition(chess, cpuColor, depth = 0) {
    if (chess.isCheckmate()) return chess.turn() === cpuColor ? -100000 - depth : 100000 + depth;
    if (chess.isDraw()) return 0;

    let score = 0;
    let cpuBishops = 0;
    let opponentBishops = 0;
    const board = chess.board();
    for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
      const row = board[rowIndex];
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        const piece = row[colIndex];
        if (!piece) continue;
        const sign = piece.color === cpuColor ? 1 : -1;
        score += sign * ((pieceScores[piece.type] || 0) + pieceSquareBonus(piece, rowIndex, colIndex));
        if (piece.type === "b") {
          if (piece.color === cpuColor) cpuBishops += 1;
          else opponentBishops += 1;
        }
      }
    }
    if (cpuBishops >= 2) score += 35;
    if (opponentBishops >= 2) score -= 35;
    if (chess.isCheck()) score += chess.turn() === cpuColor ? -35 : 35;
    return score;
  }

  function applyVerboseMove(chess, move) {
    return chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
  }

  function randomChoice(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function orderMoves(chess, moves) {
    return moves
      .map((move) => ({ move, priority: movePriority(chess, move) }))
      .sort((left, right) => right.priority - left.priority)
      .map((item) => item.move);
  }

  function movePriority(chess, move) {
    let score = 0;
    if (move.captured) score += 1000 + ((pieceScores[move.captured] || 0) - ((pieceScores[move.piece] || 0) / 10));
    if (move.promotion) score += pieceScores[move.promotion] || 800;
    const test = new Chess(chess.fen());
    applyVerboseMove(test, move);
    if (test.isCheckmate()) score += 100000;
    else if (test.isCheck()) score += 120;
    return score;
  }

  const pieceSquareTables = {
    p: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5, 5, 10, 25, 25, 10, 5, 5],
      [0, 0, 0, 20, 20, 0, 0, 0],
      [5, -5, -10, 0, 0, -10, -5, 5],
      [5, 10, 10, -20, -20, 10, 10, 5],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    n: [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20, 0, 5, 5, 0, -20, -40],
      [-30, 5, 10, 15, 15, 10, 5, -30],
      [-30, 0, 15, 20, 20, 15, 0, -30],
      [-30, 5, 15, 20, 20, 15, 5, -30],
      [-30, 0, 10, 15, 15, 10, 0, -30],
      [-40, -20, 0, 0, 0, 0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50],
    ],
    b: [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10, 5, 0, 0, 0, 0, 5, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10, 0, 10, 10, 10, 10, 0, -10],
      [-10, 5, 5, 10, 10, 5, 5, -10],
      [-10, 0, 5, 10, 10, 5, 0, -10],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20],
    ],
    r: [
      [0, 0, 0, 5, 5, 0, 0, 0],
      [5, 10, 10, 10, 10, 10, 10, 5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [0, 0, 0, 5, 5, 0, 0, 0],
    ],
    q: [
      [-20, -10, -10, -5, -5, -10, -10, -20],
      [-10, 0, 5, 0, 0, 0, 0, -10],
      [-10, 5, 5, 5, 5, 5, 0, -10],
      [0, 0, 5, 5, 5, 5, 0, -5],
      [-5, 0, 5, 5, 5, 5, 0, -5],
      [-10, 0, 5, 5, 5, 5, 0, -10],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-20, -10, -10, -5, -5, -10, -10, -20],
    ],
    k: [
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-20, -30, -30, -40, -40, -30, -30, -20],
      [-10, -20, -20, -20, -20, -20, -20, -10],
      [20, 20, 0, 0, 0, 0, 20, 20],
      [20, 30, 10, 0, 0, 10, 30, 20],
    ],
  };

  function pieceSquareBonus(piece, rowIndex, colIndex) {
    const table = pieceSquareTables[piece.type];
    if (!table) return 0;
    const row = piece.color === "w" ? rowIndex : 7 - rowIndex;
    return table[row]?.[colIndex] || 0;
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
      state.undoStack = [];
      state.redoStack = [];
      state.lastMove = null;
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

  function materialCounts() {
    const counts = { w: { p: 8, n: 2, b: 2, r: 2, q: 1 }, b: { p: 8, n: 2, b: 2, r: 2, q: 1 } };
    for (const row of state.chess.board()) {
      for (const piece of row) {
        if (piece && counts[piece.color]?.[piece.type] !== undefined) counts[piece.color][piece.type] -= 1;
      }
    }
    return counts;
  }

  function capturedGlyphs(color, missing) {
    return Object.entries(missing)
      .flatMap(([type, count]) => Array.from({ length: Math.max(0, count) }, () => type))
      .map((type) => pieceGlyphs[`${color}${type}`] || "")
      .join(" ");
  }

  function renderSidePanels() {
    const missing = materialCounts();
    if ($("capturedWhite")) $("capturedWhite").textContent = `White lost: ${capturedGlyphs("w", missing.w) || "none"}`;
    if ($("capturedBlack")) $("capturedBlack").textContent = `Black lost: ${capturedGlyphs("b", missing.b) || "none"}`;
    const history = Array.isArray(state.game?.history) ? state.game.history : [];
    if ($("moveHistory")) {
      $("moveHistory").replaceChildren(...history.map((move, index) => {
        const item = document.createElement("li");
        item.textContent = `${index + 1}. ${move}`;
        return item;
      }));
    }
    if ($("moveCount")) {
      $("moveCount").textContent = `${history.length} ${history.length === 1 ? "move" : "moves"}`;
    }
  }

  async function copyText(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      message(`${label} copied.`);
    } catch {
      message(`${label}: ${value}`);
    }
  }

  async function localFenUpdate(fen, note) {
    if (!state.gameId || !canMove()) {
      message("Undo/redo is only available on your active turn.", true);
      return;
    }
    loadChess(fen);
    const data = await api({
      action: "move",
      gameId: state.gameId,
      playerId: state.playerId,
      move: note,
      fen: state.chess.fen(),
      turn: state.chess.turn(),
      check: state.chess.isCheck(),
      status: "active",
    });
    showGame(data.game);
  }

  async function undoMove() {
    const previous = state.undoStack.pop();
    if (!previous) {
      message("No local move to undo.", true);
      return;
    }
    state.redoStack.push(state.chess.fen());
    await localFenUpdate(previous, "undo");
  }

  async function redoMove() {
    const next = state.redoStack.pop();
    if (!next) {
      message("No local move to redo.", true);
      return;
    }
    state.undoStack.push(state.chess.fen());
    await localFenUpdate(next, "redo");
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
  $("settingsToggle").addEventListener("click", () => {
    const panel = $("settingsPanel");
    panel.hidden = !panel.hidden;
  });
  $("leaveGame").addEventListener("click", () => leaveGame());
  $("resetGame").addEventListener("click", resetGame);
  $("closeGame").addEventListener("click", closeGame);
  $("flipBoard").addEventListener("click", () => {
    state.orientation = state.orientation === "white" ? "black" : "white";
    state.board?.orientation(state.orientation);
  });
  $("undoMove").addEventListener("click", undoMove);
  $("redoMove").addEventListener("click", redoMove);
  $("copyFen").addEventListener("click", () => copyText(state.chess.fen(), "FEN"));
  $("copyPgn").addEventListener("click", () => copyText((state.game?.history || []).join(" "), "PGN"));
  $("boardTheme").addEventListener("change", () => {
    state.theme = $("boardTheme").value || "classic";
    document.body.dataset.boardTheme = state.theme;
    saveLocal();
  });
  document.querySelectorAll('input[name="gameMode"]').forEach((input) => input.addEventListener("change", updateModeUi));
  $("difficulty").addEventListener("change", updateModeUi);
  window.addEventListener("beforeunload", stopPolling);
  main();
})();
