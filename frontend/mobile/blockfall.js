(() => {
  const COLS = 10;
  const ROWS = 20;
  const HIDDEN = 2;
  const TOTAL_ROWS = ROWS + HIDDEN;
  const profileStorageKey = "iiab-overland-player-profile";
  const localStorageKey = "iiab-overland-blockfall";
  const musicStorageKey = "iiab-overland-blockfall-music";
  const audioBase = "/mobile/blockfall-sounds/";
  const musicTracks = {
    music1: { label: "Music 1", src: `${audioBase}MUSIC-1.mp3` },
    music2: { label: "Music 2", src: `${audioBase}MUSIC-2.mp3` },
    music3: { label: "Music 3", src: `${audioBase}MUSIC-3.mp3` },
    adventure: { label: "Adventure", src: `${audioBase}adventure.mp3` },
    casey: { label: "Casey", src: `${audioBase}casey.mp3` },
    midnight: { label: "Midnight Run", src: `${audioBase}midnightrun.mp3` },
    grid: { label: "The Grid", src: `${audioBase}thegrid.mp3` },
  };
  const soundEffects = {
    rotate: `${audioBase}rotate_piece.mp3`,
    clear: `${audioBase}clear_line.mp3`,
    lose: `${audioBase}lose.mp3`,
    move: `${audioBase}move_piece.mp3`,
    four: `${audioBase}4_lines.mp3`,
    garbage: `${audioBase}garbage.mp3`,
    land: `${audioBase}land.mp3`,
  };
  const colors = {
    I: "#68d7ff",
    O: "#ffd34e",
    T: "#b88cff",
    S: "#80f08a",
    Z: "#ff756f",
    J: "#6aa4ff",
    L: "#ffad5f",
    G: "#6b7469",
  };
  const shapeData = {
    I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
    O: [[[1, 0], [2, 0], [1, 1], [2, 1]]],
    T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
    S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]]],
    Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]]],
    J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
    L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
  };
  const lineScores = [0, 100, 300, 500, 800];
  const state = {
    profile: { id: "", name: "Player" },
    selectedMode: "endless",
    duration: 120,
    gameId: "",
    playerMark: "",
    remoteGame: null,
    battlePoll: null,
    publishTimer: null,
    running: false,
    paused: false,
    over: false,
    mode: "endless",
    board: [],
    piece: null,
    nextShape: "I",
    holdShape: "",
    holdUsed: false,
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    maxCombo: 0,
    pendingGarbage: 0,
    garbageSentSinceSync: 0,
    garbageAppliedSinceSync: 0,
    startTime: 0,
    timeLimit: 0,
    lastTick: 0,
    dropAccumulator: 0,
    raf: 0,
    lastPublish: 0,
    matchId: "",
    scoreRecorded: false,
    musicChoice: "",
    musicAudio: null,
    clearAnimation: null,
  };
  const $ = (id) => document.getElementById(id);
  const boardCanvas = $("boardCanvas");
  const boardCtx = boardCanvas.getContext("2d");
  const nextCtx = $("nextCanvas").getContext("2d");
  const holdCtx = $("holdCanvas").getContext("2d");

  function randomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanName(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
      state.profile = { id: saved.id || randomId(), name: cleanName(saved.name) || "Player" };
    } catch {
      state.profile = { id: randomId(), name: "Player" };
    }
    localStorage.setItem(profileStorageKey, JSON.stringify(state.profile));
    $("playerNameLabel").textContent = state.profile.name;
  }

  function message(text, error = false) {
    $("message").textContent = text || "";
    $("message").style.color = error ? "var(--red)" : "var(--gold)";
  }

  function initAudio() {
    state.musicChoice = localStorage.getItem(musicStorageKey) || "";
    if (!musicTracks[state.musicChoice]) state.musicChoice = "";
    $("musicSelect").value = state.musicChoice;
    state.musicAudio = new Audio();
    state.musicAudio.loop = true;
    state.musicAudio.volume = 0.45;
  }

  function playEffect(name, volume = 0.72) {
    const src = soundEffects[name];
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  }

  function setMusic(choice, preview = false) {
    state.musicChoice = musicTracks[choice] ? choice : "";
    localStorage.setItem(musicStorageKey, state.musicChoice);
    if (!state.musicAudio) return;
    state.musicAudio.pause();
    state.musicAudio.currentTime = 0;
    if (!state.musicChoice) return;
    state.musicAudio.src = musicTracks[state.musicChoice].src;
    state.musicAudio.volume = preview ? 0.55 : 0.28;
    state.musicAudio.play().catch(() => {});
  }

  function startGameplayMusic() {
    if (!state.musicAudio || !state.musicChoice) return;
    state.musicAudio.src = musicTracks[state.musicChoice].src;
    state.musicAudio.volume = 0.28;
    state.musicAudio.play().catch(() => {});
  }

  function stopMusic() {
    if (!state.musicAudio) return;
    state.musicAudio.pause();
    state.musicAudio.currentTime = 0;
  }

  function emptyBoard() {
    return Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(""));
  }

  function shuffle(values) {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function nextFromBag() {
    if (!state.bag.length) state.bag = shuffle(Object.keys(shapeData));
    return state.bag.pop();
  }

  function newPiece(shape = nextFromBag()) {
    return { shape, rot: 0, x: shape === "I" ? 3 : 3, y: 0 };
  }

  function pieceCells(piece = state.piece) {
    if (!piece) return [];
    const rotations = shapeData[piece.shape];
    return rotations[piece.rot % rotations.length].map(([x, y]) => [piece.x + x, piece.y + y]);
  }

  function collides(piece = state.piece, board = state.board) {
    return pieceCells(piece).some(([x, y]) => x < 0 || x >= COLS || y >= TOTAL_ROWS || (y >= 0 && board[y]?.[x]));
  }

  function spawn() {
    state.holdUsed = false;
    state.piece = newPiece(state.nextShape);
    state.nextShape = nextFromBag();
    if (collides(state.piece)) {
      endGame("Top out");
      return false;
    }
    return true;
  }

  function resetEngine(mode, duration = 0) {
    state.mode = mode;
    state.board = emptyBoard();
    state.bag = [];
    state.nextShape = nextFromBag();
    state.holdShape = "";
    state.holdUsed = false;
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.combo = -1;
    state.maxCombo = 0;
    state.pendingGarbage = 0;
    state.garbageSentSinceSync = 0;
    state.garbageAppliedSinceSync = 0;
    state.running = true;
    state.paused = false;
    state.over = false;
    state.startTime = performance.now();
    state.timeLimit = duration ? Number(duration) * 1000 : 0;
    state.lastTick = performance.now();
    state.dropAccumulator = 0;
    state.matchId = `blockfall-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    state.scoreRecorded = false;
    state.clearAnimation = null;
    spawn();
    startGameplayMusic();
    document.body.classList.add("playing");
    $("lobby").hidden = true;
    $("gamePanel").hidden = false;
    $("overlay").hidden = true;
    $("resumeGame").hidden = false;
    updateStatus();
    resizeCanvases();
    saveLocal();
    requestAnimationFrame(loop);
  }

  function visiblePreview() {
    return state.board.slice(HIDDEN).map((row) => row.map(Boolean));
  }

  function move(dx, dy, scoreDrop = false) {
    if (!canAct()) return false;
    const next = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
    if (collides(next)) return false;
    state.piece = next;
    if (scoreDrop && dy > 0) state.score += 1;
    if (dx || scoreDrop) playEffect("move", 0.48);
    updateStatus();
    return true;
  }

  function rotate(dir = 1) {
    if (!canAct()) return;
    const rotations = shapeData[state.piece.shape].length;
    const base = { ...state.piece, rot: (state.piece.rot + dir + rotations) % rotations };
    const kicks = [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, -1], [1, -1], [-1, -1]];
    for (const [kx, ky] of kicks) {
      const kicked = { ...base, x: base.x + kx, y: base.y + ky };
      if (!collides(kicked)) {
        state.piece = kicked;
        playEffect("rotate", 0.58);
        updateStatus();
        return;
      }
    }
  }

  function hardDrop() {
    if (!canAct()) return;
    let rows = 0;
    while (move(0, 1, false)) rows += 1;
    state.score += rows * 2;
    lockPiece();
  }

  function holdPiece() {
    if (!canAct() || state.holdUsed) return;
    const current = state.piece.shape;
    if (state.holdShape) {
      state.piece = newPiece(state.holdShape);
      state.holdShape = current;
    } else {
      state.holdShape = current;
      state.piece = newPiece(state.nextShape);
      state.nextShape = nextFromBag();
    }
    state.holdUsed = true;
    if (collides(state.piece)) endGame("Top out");
    updateStatus();
  }

  function lockPiece() {
    if (!state.piece || state.over) return;
    pieceCells().forEach(([x, y]) => {
      if (y >= 0 && y < TOTAL_ROWS && x >= 0 && x < COLS) state.board[y][x] = state.piece.shape;
    });
    const fullLines = findFullLines();
    state.piece = null;
    if (fullLines.length) {
      state.clearAnimation = {
        lines: fullLines,
        start: performance.now(),
        duration: fullLines.length >= 4 ? 620 : 420,
        tetris: fullLines.length >= 4,
      };
      const garbage = garbageForClear(fullLines.length);
      if (garbage) state.garbageSentSinceSync += garbage;
      playEffect(fullLines.length >= 4 ? "four" : "clear", fullLines.length >= 4 ? 0.84 : 0.68);
    } else {
      playEffect("land", 0.54);
      applyQueuedGarbage();
      spawn();
      saveLocal();
    }
    updateStatus();
  }

  function findFullLines() {
    const lines = [];
    for (let y = 0; y < state.board.length; y += 1) {
      if (state.board[y].every(Boolean)) lines.push(y);
    }
    return lines;
  }

  function finishLineClear() {
    if (!state.clearAnimation) return;
    const lines = [...state.clearAnimation.lines].sort((a, b) => b - a);
    const cleared = lines.length;
    lines.forEach((y) => {
      state.board.splice(y, 1);
      state.board.unshift(Array(COLS).fill(""));
    });
    if (cleared) {
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.lines += cleared;
      state.level = 1 + Math.floor(state.lines / 10);
      state.score += lineScores[cleared] || 0;
      if (state.combo > 0) state.score += 50 * state.combo;
    } else {
      state.combo = -1;
    }
    state.clearAnimation = null;
    spawn();
    updateStatus();
    saveLocal();
  }

  function garbageForClear(lines) {
    let amount = lines === 2 ? 1 : lines === 3 ? 2 : lines >= 4 ? 4 : 0;
    if (amount && state.combo >= 2) amount += 1;
    return amount;
  }

  function applyQueuedGarbage() {
    if (!state.pendingGarbage) return;
    const amount = Math.min(8, state.pendingGarbage);
    state.pendingGarbage -= amount;
    state.garbageAppliedSinceSync += amount;
    for (let i = 0; i < amount; i += 1) {
      const hole = Math.floor(Math.random() * COLS);
      state.board.shift();
      state.board.push(Array.from({ length: COLS }, (_, x) => (x === hole ? "" : "G")));
    }
    playEffect("garbage", 0.76);
    if (state.board.slice(0, HIDDEN).some((row) => row.some(Boolean))) endGame("Garbage top out");
  }

  function canAct() {
    return state.running && !state.paused && !state.over && !state.clearAnimation && state.piece;
  }

  function dropInterval() {
    return Math.max(120, 850 - (state.level - 1) * 55);
  }

  function loop(now) {
    if (!state.running) return;
    const dt = now - state.lastTick;
    state.lastTick = now;
    if (!state.paused && !state.over) {
      if (state.clearAnimation && now - state.clearAnimation.start >= state.clearAnimation.duration) {
        finishLineClear();
      } else if (state.timeLimit && now - state.startTime >= state.timeLimit) {
        endGame("Timer complete");
      } else {
        state.dropAccumulator += dt;
        if (state.dropAccumulator >= dropInterval()) {
          state.dropAccumulator = 0;
          if (!move(0, 1)) lockPiece();
        }
      }
    }
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  function elapsedSeconds() {
    return Math.max(0, Math.floor((performance.now() - state.startTime) / 1000));
  }

  function timeText() {
    if (state.timeLimit) {
      const remaining = Math.max(0, Math.ceil((state.timeLimit - (performance.now() - state.startTime)) / 1000));
      return formatTime(remaining);
    }
    return formatTime(elapsedSeconds());
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function pauseGame(show = true) {
    if (!state.running || state.over) return;
    state.paused = show;
    if (show) showOverlay("Paused", "Resume when ready.", true);
    else $("overlay").hidden = true;
    updateStatus();
  }

  function endGame(reason = "Game over") {
    if (state.over) return;
    state.over = true;
    state.running = false;
    playEffect("lose", 0.82);
    stopMusic();
    document.body.classList.remove("playing");
    updateStatus(reason);
    showOverlay(state.mode.includes("battle") ? "Battle Over" : "Game Over", `${reason}. Score ${state.score}.`, false);
    if (state.mode === "endless" || state.mode === "timed") recordSoloScore();
    if (state.mode.includes("battle")) publishBattleUpdate(true);
    saveLocal();
  }

  function showOverlay(title, text, resumable) {
    $("overlayTitle").textContent = title;
    $("overlayText").textContent = text || "";
    $("resumeGame").hidden = !resumable;
    $("overlay").hidden = false;
  }

  async function recordSoloScore() {
    if (state.scoreRecorded) return;
    state.scoreRecorded = true;
    const form = new URLSearchParams({
      action: "record-blockfall",
      matchId: state.matchId,
      playerId: state.profile.id,
      playerName: state.profile.name,
      mode: state.mode,
      score: String(state.score),
      lines: String(state.lines),
      level: String(state.level),
      maxCombo: String(state.maxCombo),
      duration: String(state.timeLimit ? Math.round(state.timeLimit / 1000) : 0),
      survival: String(elapsedSeconds()),
    });
    try {
      const response = await fetch("/game-stats", { method: "POST", body: form });
      if (!response.ok) throw new Error(`Score failed: ${response.status}`);
      message("Score recorded.");
    } catch (error) {
      message(error.message || "Score failed.", true);
    }
  }

  function updateStatus(extra = "") {
    $("score").textContent = String(state.score);
    $("lines").textContent = String(state.lines);
    $("level").textContent = String(state.level);
    $("timeLeft").textContent = timeText();
    $("garbageCount").textContent = String(state.pendingGarbage);
    $("garbagePanel").hidden = !state.mode.includes("battle");
    const modeLabel = state.mode === "timed" ? "Timed Solo" : state.mode === "endless" ? "Solo Endless" : state.mode === "timed-battle" ? "Timed Battle" : "Battle";
    $("gameState").textContent = state.paused ? "Paused" : state.over ? "Complete" : modeLabel;
    $("gameStatus").textContent = extra || (state.mode.includes("battle") && state.remoteGame?.status === "waiting" ? "Waiting for another player." : "");
    renderOpponents();
  }

  function saveLocal() {
    if (state.mode.includes("battle")) return;
    localStorage.setItem(localStorageKey, JSON.stringify({
      mode: state.mode,
      score: state.score,
      lines: state.lines,
      level: state.level,
      maxCombo: state.maxCombo,
      over: state.over,
      recorded: state.scoreRecorded,
    }));
  }

  function resizeCanvases() {
    const rect = boardCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    boardCanvas.width = Math.max(220, Math.floor(rect.width * ratio));
    boardCanvas.height = Math.max(440, Math.floor(rect.height * ratio));
    [nextCtx, holdCtx].forEach((ctx) => {
      const canvas = ctx.canvas;
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.max(80, Math.floor(box.width * ratio));
      canvas.height = Math.max(80, Math.floor(box.height * ratio));
    });
    draw();
  }

  function drawCell(ctx, x, y, size, fill, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    ctx.restore();
  }

  function draw() {
    const w = boardCanvas.width;
    const h = boardCanvas.height;
    const cell = Math.floor(Math.min(w / COLS, h / ROWS));
    const ox = Math.floor((w - cell * COLS) / 2);
    const oy = Math.floor((h - cell * ROWS) / 2);
    boardCtx.clearRect(0, 0, w, h);
    boardCtx.fillStyle = "rgba(0,0,0,.32)";
    boardCtx.fillRect(ox, oy, cell * COLS, cell * ROWS);
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const value = state.board[r + HIDDEN]?.[c];
        boardCtx.strokeStyle = "rgba(255,255,255,.06)";
        boardCtx.strokeRect(ox + c * cell, oy + r * cell, cell, cell);
        if (value) drawCell(boardCtx, ox + c * cell, oy + r * cell, cell, colors[value] || colors.G);
      }
    }
    if (state.piece && !state.over) {
      const ghost = ghostPiece();
      pieceCells(ghost).forEach(([x, y]) => {
        if (y >= HIDDEN) drawCell(boardCtx, ox + x * cell, oy + (y - HIDDEN) * cell, cell, "#f5fbef", 0.18);
      });
      pieceCells().forEach(([x, y]) => {
        if (y >= HIDDEN) drawCell(boardCtx, ox + x * cell, oy + (y - HIDDEN) * cell, cell, colors[state.piece.shape] || colors.G);
      });
    }
    drawLineClearAnimation(ox, oy, cell);
    drawMini(nextCtx, state.nextShape);
    drawMini(holdCtx, state.holdShape);
  }

  function drawLineClearAnimation(ox, oy, cell) {
    const animation = state.clearAnimation;
    if (!animation) return;
    const elapsed = performance.now() - animation.start;
    const progress = Math.min(1, elapsed / animation.duration);
    const pulse = Math.sin(progress * Math.PI * (animation.tetris ? 8 : 6)) * 0.5 + 0.5;
    const wipeColumns = Math.ceil((COLS / 2) * progress);
    boardCtx.save();
    animation.lines.forEach((boardY, index) => {
      const visibleY = boardY - HIDDEN;
      if (visibleY < 0 || visibleY >= ROWS) return;
      const y = oy + visibleY * cell;
      const fill = animation.tetris
        ? `rgba(255, 211, 78, ${0.42 + pulse * 0.42})`
        : `rgba(245, 251, 239, ${0.38 + pulse * 0.34})`;
      boardCtx.fillStyle = fill;
      boardCtx.fillRect(ox, y, cell * COLS, cell);
      boardCtx.strokeStyle = animation.tetris ? "rgba(255, 211, 78, .96)" : "rgba(255,255,255,.88)";
      boardCtx.lineWidth = Math.max(2, cell * 0.08);
      boardCtx.strokeRect(ox + 1, y + 1, cell * COLS - 2, cell - 2);
      boardCtx.fillStyle = "rgba(4,12,8,.82)";
      for (let step = 0; step < wipeColumns; step += 1) {
        const left = Math.floor(COLS / 2) - 1 - step;
        const right = Math.ceil(COLS / 2) + step;
        if (left >= 0) boardCtx.fillRect(ox + left * cell, y, cell, cell);
        if (right < COLS) boardCtx.fillRect(ox + right * cell, y, cell, cell);
      }
      if (animation.tetris) {
        const sparkX = ox + ((index % 2 ? 0.78 : 0.22) + progress * 0.08) * cell * COLS;
        boardCtx.fillStyle = `rgba(255, 255, 255, ${0.35 + pulse * 0.35})`;
        boardCtx.beginPath();
        boardCtx.arc(sparkX, y + cell / 2, Math.max(3, cell * 0.16), 0, Math.PI * 2);
        boardCtx.fill();
      }
    });
    if (animation.tetris) {
      boardCtx.globalAlpha = 0.65 + pulse * 0.25;
      boardCtx.fillStyle = "#ffd34e";
      boardCtx.font = `900 ${Math.max(18, cell * 0.74)}px "Avenir Next", sans-serif`;
      boardCtx.textAlign = "center";
      boardCtx.textBaseline = "middle";
      boardCtx.shadowColor = "rgba(255,211,78,.9)";
      boardCtx.shadowBlur = 18;
      boardCtx.fillText("4 LINE CLEAR", ox + (cell * COLS) / 2, oy + cell * ROWS * 0.44);
    }
    boardCtx.restore();
  }

  function drawMini(ctx, shape) {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!shape) return;
    const cells = shapeData[shape][0];
    const size = Math.floor(Math.min(canvas.width, canvas.height) / 5);
    const ox = Math.floor((canvas.width - size * 4) / 2);
    const oy = Math.floor((canvas.height - size * 4) / 2);
    cells.forEach(([x, y]) => drawCell(ctx, ox + x * size, oy + y * size, size, colors[shape]));
  }

  function ghostPiece() {
    const ghost = { ...state.piece };
    while (!collides({ ...ghost, y: ghost.y + 1 })) ghost.y += 1;
    return ghost;
  }

  function renderOpponents() {
    const box = $("opponents");
    if (!state.mode.includes("battle") || !state.remoteGame?.payload) {
      box.replaceChildren();
      return;
    }
    const players = Array.isArray(state.remoteGame.players) ? state.remoteGame.players : [];
    const states = state.remoteGame.payload.states || {};
    const cards = players.filter((player) => player.mark !== state.playerMark).map((player) => {
      const card = document.createElement("div");
      const info = states[player.mark] || {};
      card.className = `opponent-card ${info.alive === false ? "dead" : ""}`;
      const label = document.createElement("span");
      label.textContent = player.mark || "";
      const name = document.createElement("strong");
      name.textContent = player.name || player.mark;
      const score = document.createElement("small");
      score.textContent = `${info.score || 0} pts`;
      const canvas = document.createElement("canvas");
      canvas.width = 60;
      canvas.height = 120;
      card.append(label, name, canvas, score);
      drawPreview(canvas.getContext("2d"), info.preview || []);
      return card;
    });
    box.replaceChildren(...cards);
  }

  function drawPreview(ctx, preview) {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cell = Math.floor(Math.min(canvas.width / COLS, canvas.height / ROWS));
    const ox = Math.floor((canvas.width - cell * COLS) / 2);
    const oy = Math.floor((canvas.height - cell * ROWS) / 2);
    ctx.fillStyle = "rgba(0,0,0,.26)";
    ctx.fillRect(ox, oy, cell * COLS, cell * ROWS);
    preview.slice(0, ROWS).forEach((row, r) => {
      row.slice(0, COLS).forEach((filled, c) => {
        if (filled) drawCell(ctx, ox + c * cell, oy + r * cell, cell, "rgba(128,240,138,.78)");
      });
    });
  }

  function startSolo(mode) {
    stopBattleTimers();
    state.gameId = "";
    state.playerMark = "";
    const duration = mode === "timed" ? Number($("duration").value || 120) : 0;
    resetEngine(mode, duration);
  }

  async function createBattle(mode) {
    stopBattleTimers();
    const duration = mode === "timed-battle" ? Number($("duration").value || 120) : 0;
    const form = new URLSearchParams({
      action: "create",
      game: "blockfall",
      mode,
      duration: String(duration),
      playerId: state.profile.id,
      playerName: state.profile.name,
    });
    const data = await postMobileGame(form);
    adoptRemoteGame(data);
    resetEngine(mode, duration);
    state.running = false;
    showOverlay("Waiting", "Battle starts when another player joins.", false);
    startBattleTimers();
  }

  async function joinBattle(gameId) {
    stopBattleTimers();
    const form = new URLSearchParams({
      action: "join",
      gameId,
      playerId: state.profile.id,
      playerName: state.profile.name,
    });
    const data = await postMobileGame(form);
    adoptRemoteGame(data);
    const mode = data.game.mode === "timed-battle" ? "timed-battle" : "battle";
    const duration = Number(data.game.payload?.duration || 0);
    resetEngine(mode, duration);
    startBattleTimers();
  }

  function adoptRemoteGame(data) {
    state.remoteGame = data.game || null;
    state.gameId = state.remoteGame?.id || "";
    state.playerMark = data.mark || findMyMark(state.remoteGame) || "";
  }

  function findMyMark(game) {
    return (game?.players || []).find((player) => player.id === state.profile.id)?.mark || "";
  }

  function startBattleTimers() {
    stopBattleTimers();
    state.battlePoll = window.setInterval(pollBattleState, 1000);
    state.publishTimer = window.setInterval(() => publishBattleUpdate(false), 1200);
    pollBattleState();
  }

  function stopBattleTimers() {
    if (state.battlePoll) window.clearInterval(state.battlePoll);
    if (state.publishTimer) window.clearInterval(state.publishTimer);
    state.battlePoll = null;
    state.publishTimer = null;
  }

  async function pollBattleState() {
    if (!state.gameId) return;
    try {
      const form = new URLSearchParams({ action: "state", gameId: state.gameId, playerId: state.profile.id });
      const data = await postMobileGame(form);
      state.remoteGame = data.game || state.remoteGame;
      const payload = state.remoteGame?.payload || {};
      const queued = Number(payload.yourGarbage || 0);
      if (queued > state.pendingGarbage) state.pendingGarbage = queued;
      if (state.remoteGame?.status === "active") {
        const startedAt = Number(payload.startedAt || 0) * 1000;
        if (!state.running && startedAt && Date.now() >= startedAt) {
          $("overlay").hidden = true;
          state.running = true;
          state.startTime = performance.now();
          state.lastTick = performance.now();
          requestAnimationFrame(loop);
        } else if (!state.running && startedAt) {
          showOverlay("Get Ready", `Starting in ${Math.max(1, Math.ceil((startedAt - Date.now()) / 1000))}...`, false);
        }
      }
      if (state.remoteGame?.status === "complete" && !state.over) {
        const winner = state.remoteGame.winner || "";
        endGame(winner === state.playerMark ? "You win" : winner === "draw" ? "Draw" : "You are out");
      }
      updateStatus();
    } catch (error) {
      message(error.message || "Battle sync failed.", true);
    }
  }

  async function publishBattleUpdate(final = false) {
    if (!state.gameId || !state.playerMark || !state.remoteGame || state.remoteGame.status === "complete") return;
    const form = new URLSearchParams({
      action: "move",
      gameId: state.gameId,
      playerId: state.profile.id,
      score: String(state.score),
      lines: String(state.lines),
      level: String(state.level),
      alive: final || state.over ? "0" : "1",
      preview: JSON.stringify(visiblePreview()),
      garbageSent: String(state.garbageSentSinceSync),
      garbageApplied: String(state.garbageAppliedSinceSync),
    });
    state.garbageSentSinceSync = 0;
    state.garbageAppliedSinceSync = 0;
    try {
      const data = await postMobileGame(form);
      state.remoteGame = data.game || state.remoteGame;
    } catch (error) {
      message(error.message || "Battle update failed.", true);
    }
  }

  async function postMobileGame(form) {
    const response = await fetch("/mobile-games", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || `Mobile game request failed: ${response.status}`);
    return data;
  }

  async function loadOpenGames() {
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Open games: ${response.status}`);
      const data = await response.json();
      const games = (data.games || []).filter((game) => game.type === "blockfall");
      $("openGames").replaceChildren(...games.map(openGameCard));
    } catch (error) {
      $("openGames").textContent = "";
      message(error.message || "Could not load battles.", true);
    }
  }

  function openGameCard(game) {
    const row = document.createElement("div");
    row.className = "open-game";
    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = game.title || "Blockfall Battle";
    const detail = document.createElement("span");
    detail.textContent = `${game.mode || "battle"} - ${(game.players || []).map((player) => player.name).join(" vs ") || "Waiting"}`;
    text.append(title, detail);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Join";
    button.addEventListener("click", () => joinBattle(game.id));
    row.append(text, button);
    return row;
  }

  function selectMode(mode) {
    state.selectedMode = mode;
    document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    const timed = mode === "timed" || mode === "timed-battle";
    $("durationWrap").hidden = !timed;
    $("startMode").textContent = mode === "endless" ? "Start Solo Endless" : mode === "timed" ? "Start Timed Run" : mode === "battle" ? "Create Battle" : "Create Timed Battle";
  }

  function handleControl(control) {
    if (control === "left") move(-1, 0);
    if (control === "right") move(1, 0);
    if (control === "rotate") rotate(1);
    if (control === "soft") move(0, 1, true);
    if (control === "hard") hardDrop();
    if (control === "hold") holdPiece();
    if (control === "pause") pauseGame(!state.paused);
  }

  function attachControls() {
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
    $("musicSelect").addEventListener("change", () => setMusic($("musicSelect").value, true));
    $("startMode").addEventListener("click", () => {
      if (state.selectedMode === "endless" || state.selectedMode === "timed") startSolo(state.selectedMode);
      else createBattle(state.selectedMode).catch((error) => message(error.message || "Could not create battle.", true));
    });
    $("refreshGame").addEventListener("click", loadOpenGames);
    $("leaveGame").addEventListener("click", backToLobby);
    $("closeGame").addEventListener("click", backToLobby);
    $("resumeGame").addEventListener("click", () => pauseGame(false));
    $("playAgain").addEventListener("click", () => {
      if (state.mode.includes("battle") && state.gameId) resetBattle();
      else startSolo(state.mode === "timed" ? "timed" : "endless");
    });
    document.querySelectorAll("[data-control]").forEach((button) => {
      const fire = () => handleControl(button.dataset.control);
      button.addEventListener("click", fire);
      button.addEventListener("pointerdown", (event) => event.preventDefault());
    });
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowdown", "arrowup", " ", "x", "z", "c", "shift", "p", "escape"].includes(key)) event.preventDefault();
      if (key === "arrowleft") move(-1, 0);
      if (key === "arrowright") move(1, 0);
      if (key === "arrowdown") move(0, 1, true);
      if (key === "arrowup" || key === "x") rotate(1);
      if (key === "z") rotate(-1);
      if (key === " ") hardDrop();
      if (key === "c" || key === "shift") holdPiece();
      if (key === "p" || key === "escape") pauseGame(!state.paused);
    });
    window.addEventListener("resize", resizeCanvases);
  }

  async function resetBattle() {
    if (!state.gameId) return;
    try {
      const data = await postMobileGame(new URLSearchParams({ action: "reset", gameId: state.gameId, playerId: state.profile.id }));
      adoptRemoteGame(data);
      const duration = Number(data.game?.payload?.duration || 0);
      resetEngine(data.game?.mode || "battle", duration);
      if (data.game?.status === "waiting") {
        state.running = false;
        showOverlay("Waiting", "Battle starts when another player joins.", false);
      }
      startBattleTimers();
    } catch (error) {
      message(error.message || "Reset failed.", true);
    }
  }

  function backToLobby() {
    stopBattleTimers();
    state.running = false;
    state.paused = false;
    state.gameId = "";
    state.remoteGame = null;
    stopMusic();
    document.body.classList.remove("playing");
    $("gamePanel").hidden = true;
    $("lobby").hidden = false;
    $("overlay").hidden = true;
    loadOpenGames();
  }

  function restoreFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get("game");
    if (gameId) joinBattle(gameId).catch((error) => message(error.message || "Could not join battle.", true));
  }

  function main() {
    loadProfile();
    initAudio();
    selectMode("endless");
    attachControls();
    loadOpenGames();
    restoreFromQuery();
    resizeCanvases();
    window.setInterval(() => {
      if (state.running && !state.over) updateStatus();
    }, 250);
  }

  main();
})();
