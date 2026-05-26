(() => {
  const profileStorageKey = "iiab-overland-player-profile";
  const colors = {
    P1: "#80f08a",
    P2: "#ffd34e",
    P3: "#68d7ff",
    P4: "#ff756f",
    P5: "#b88cff",
    P6: "#ffad5f",
  };
  const cellColors = {
    "1": "rgba(128,240,138,.42)",
    "2": "rgba(255,211,78,.42)",
    "3": "rgba(104,215,255,.42)",
    "4": "rgba(255,117,111,.42)",
    "5": "rgba(184,140,255,.42)",
    "6": "rgba(255,173,95,.42)",
    "#": "rgba(245,251,239,.48)",
  };
  const state = {
    profile: { id: "", name: "Player" },
    selectedMode: "solo",
    gameId: "",
    playerMark: "",
    game: null,
    pollTimer: null,
    inputTimer: null,
    direction: "right",
    drawing: false,
  };
  const $ = (id) => document.getElementById(id);
  const canvas = $("traceCanvas");
  const ctx = canvas.getContext("2d");

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

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  async function postGame(form) {
    const response = await fetch("/mobile-games", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || `Game request failed: ${response.status}`);
    return data;
  }

  function selectMode(mode) {
    state.selectedMode = mode;
    document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    $("startMode").textContent = mode === "solo" ? "Start Solo Score" : mode === "elimination" ? "Create Elimination" : "Create Timed Battle";
  }

  async function createGame() {
    const form = new URLSearchParams({
      action: "create",
      game: "claimline",
      mode: state.selectedMode,
      duration: $("duration").value || "120",
      playerId: state.profile.id,
      playerName: state.profile.name,
    });
    const data = await postGame(form);
    adoptGame(data);
    showGame();
    startTimers();
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
    startTimers();
  }

  function adoptGame(data) {
    state.game = data.game || null;
    state.gameId = state.game?.id || "";
    state.playerMark = data.mark || findMyMark(state.game) || state.playerMark;
  }

  function findMyMark(game) {
    return (game?.players || []).find((player) => player.id === state.profile.id)?.mark || "";
  }

  function showGame() {
    document.body.classList.add("playing");
    $("lobby").hidden = true;
    $("gamePanel").hidden = false;
    resizeCanvas();
  }

  function backToLobby() {
    stopTimers();
    state.gameId = "";
    state.game = null;
    document.body.classList.remove("playing");
    $("gamePanel").hidden = true;
    $("lobby").hidden = false;
    loadOpenGames();
  }

  function startTimers() {
    stopTimers();
    state.pollTimer = window.setInterval(pollState, 120);
    state.inputTimer = window.setInterval(sendInput, 120);
    pollState();
  }

  function stopTimers() {
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    if (state.inputTimer) window.clearInterval(state.inputTimer);
    state.pollTimer = null;
    state.inputTimer = null;
  }

  async function pollState() {
    if (!state.gameId) return;
    try {
      const data = await postGame(new URLSearchParams({ action: "state", gameId: state.gameId, playerId: state.profile.id }));
      state.game = data.game || state.game;
      render();
    } catch (error) {
      message(error.message || "Sync failed.", true);
    }
  }

  async function sendInput() {
    if (!state.gameId || !state.playerMark || state.game?.status !== "active") return;
    try {
      const data = await postGame(new URLSearchParams({
        action: "move",
        gameId: state.gameId,
        playerId: state.profile.id,
        direction: state.direction,
        draw: state.drawing ? "1" : "0",
      }));
      state.game = data.game || state.game;
      render();
    } catch (error) {
      message(error.message || "Input failed.", true);
    }
  }

  async function loadOpenGames() {
    try {
      const response = await fetch("/mobile-games", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Open games: ${response.status}`);
      const data = await response.json();
      const games = (data.games || []).filter((game) => game.type === "claimline");
      $("openGames").replaceChildren(...games.map(openGameCard));
    } catch (error) {
      $("openGames").textContent = "";
      message(error.message || "Could not load games.", true);
    }
  }

  function openGameCard(game) {
    const row = document.createElement("div");
    row.className = "open-game";
    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = game.title || "Territory Trace";
    const detail = document.createElement("span");
    detail.textContent = `${game.mode || "battle"} - ${(game.players || []).map((player) => player.name).join(" vs ") || "Waiting"}`;
    text.append(title, detail);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Join";
    button.addEventListener("click", () => joinGame(game.id));
    row.append(text, button);
    return row;
  }

  function render() {
    const game = state.game;
    const payload = game?.payload || {};
    const cols = payload.cols || 64;
    const rows = payload.rows || 40;
    const grid = String(payload.grid || "").padEnd(cols * rows, ".");
    const w = canvas.width;
    const h = canvas.height;
    const cell = Math.floor(Math.min(w / cols, h / rows));
    const ox = Math.floor((w - cell * cols) / 2);
    const oy = Math.floor((h - cell * rows) / 2);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,.36)";
    ctx.fillRect(ox, oy, cell * cols, cell * rows);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const value = grid[y * cols + x];
        if (value !== ".") {
          ctx.fillStyle = cellColors[value] || "rgba(245,251,239,.18)";
          ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        }
      }
    }
    drawTrails(payload, ox, oy, cell);
    drawHazards(payload, ox, oy, cell);
    drawPlayers(payload, ox, oy, cell);
    drawGrid(ox, oy, cols, rows, cell);
    updateHud();
  }

  function drawGrid(ox, oy, cols, rows, cell) {
    ctx.strokeStyle = "rgba(255,255,255,.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x += 4) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cell, oy);
      ctx.lineTo(ox + x * cell, oy + rows * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y += 4) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * cell);
      ctx.lineTo(ox + cols * cell, oy + y * cell);
      ctx.stroke();
    }
  }

  function drawTrails(payload, ox, oy, cell) {
    Object.entries(payload.trails || {}).forEach(([mark, trail]) => {
      ctx.fillStyle = colors[mark] || "#f5fbef";
      (trail || []).forEach((index) => {
        const x = index % payload.cols;
        const y = Math.floor(index / payload.cols);
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      });
    });
  }

  function drawHazards(payload, ox, oy, cell) {
    ctx.fillStyle = "#ff756f";
    (payload.hazards || []).forEach((hazard) => {
      ctx.beginPath();
      ctx.arc(ox + (hazard.x + 0.5) * cell, oy + (hazard.y + 0.5) * cell, Math.max(4, cell * 1.2), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlayers(payload, ox, oy, cell) {
    Object.entries(payload.states || {}).forEach(([mark, player]) => {
      if (player.alive === false) return;
      ctx.fillStyle = colors[mark] || "#f5fbef";
      ctx.strokeStyle = mark === state.playerMark ? "#fff" : "rgba(0,0,0,.7)";
      ctx.lineWidth = Math.max(2, cell * 0.3);
      ctx.beginPath();
      ctx.arc(ox + (player.x + 0.5) * cell, oy + (player.y + 0.5) * cell, Math.max(5, cell * 1.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  function updateHud() {
    const game = state.game;
    const payload = game?.payload || {};
    const now = Number(payload.now || Date.now() / 1000);
    const started = Number(payload.startedAt || 0);
    const duration = Number(payload.duration || 0);
    const remaining = started ? Math.max(0, started + duration - now) : duration;
    $("timer").textContent = game?.status === "complete" ? "Done" : formatTime(remaining);
    $("gameState").textContent = game?.status === "complete" ? "Complete" : game?.status === "waiting" ? "Waiting" : game?.mode === "solo" ? "Solo" : "Battle";
    $("gameStatus").textContent = game?.status === "waiting" ? "Waiting for another player." : game?.winner ? `${winnerName(game)} wins.` : payload.lastEvent || "Capture territory.";
    const players = game?.players || [];
    $("leaderboard").replaceChildren(...players.map((player) => {
      const ownership = payload.ownership?.[player.mark] || {};
      const info = payload.states?.[player.mark] || {};
      const row = document.createElement("div");
      row.innerHTML = `<span>${player.mark}</span><strong>${escapeHtml(player.name)} ${ownership.percent || 0}%</strong><small>${info.lives ?? 0} lives · ${info.score || 0} pts</small>`;
      row.style.borderLeft = `5px solid ${colors[player.mark] || "var(--green)"}`;
      return row;
    }));
  }

  function winnerName(game) {
    if (game.winner === "draw") return "Draw";
    return (game.players || []).find((player) => player.mark === game.winner)?.name || game.winner;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(rect.width * ratio));
    canvas.height = Math.max(240, Math.floor(rect.height * ratio));
    render();
  }

  function attachControls() {
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
    document.querySelectorAll("[data-dir]").forEach((button) => {
      const set = () => { state.direction = button.dataset.dir; };
      button.addEventListener("click", set);
      button.addEventListener("pointerdown", (event) => { event.preventDefault(); set(); });
    });
    const drawButton = $("drawButton");
    const setDraw = (on) => {
      state.drawing = on;
      drawButton.classList.toggle("active", on);
    };
    drawButton.addEventListener("pointerdown", (event) => { event.preventDefault(); setDraw(true); });
    drawButton.addEventListener("pointerup", () => setDraw(false));
    drawButton.addEventListener("pointercancel", () => setDraw(false));
    drawButton.addEventListener("pointerleave", () => setDraw(false));
    $("startMode").addEventListener("click", () => createGame().catch((error) => message(error.message || "Could not start.", true)));
    $("refreshGame").addEventListener("click", loadOpenGames);
    $("leaveGame").addEventListener("click", backToLobby);
    $("closeGame").addEventListener("click", async () => {
      if (state.gameId) {
        await postGame(new URLSearchParams({ action: "delete", gameId: state.gameId, playerId: state.profile.id })).catch(() => {});
      }
      backToLobby();
    });
    $("resetGame").addEventListener("click", async () => {
      if (!state.gameId) return;
      const data = await postGame(new URLSearchParams({ action: "reset", gameId: state.gameId, playerId: state.profile.id }));
      adoptGame(data);
      render();
    });
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === "arrowup") state.direction = "up";
      if (key === "arrowdown") state.direction = "down";
      if (key === "arrowleft") state.direction = "left";
      if (key === "arrowright") state.direction = "right";
      if (key === " ") setDraw(true);
    });
    document.addEventListener("keyup", (event) => {
      if (event.key === " ") setDraw(false);
    });
    window.addEventListener("resize", resizeCanvas);
  }

  function restoreFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get("game");
    if (gameId) joinGame(gameId).catch((error) => message(error.message || "Could not join.", true));
  }

  function main() {
    loadProfile();
    selectMode("solo");
    attachControls();
    loadOpenGames();
    restoreFromQuery();
    resizeCanvas();
  }

  main();
})();
