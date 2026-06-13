(() => {
  const apiUrl = "/mobile-games";
  const audioPaths = {
    background: "/mobile/assets/gridcycles/background.mp3",
    crash: "/mobile/assets/gridcycles/crash.mp3",
    start: "/mobile/assets/gridcycles/start.mp3",
    roundOver: "/mobile/assets/gridcycles/round-over.mp3",
  };
  const $ = (id) => document.getElementById(id);
  const canvas = $("gridCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const state = {
    player: null,
    game: null,
    mark: "",
    observer: false,
    cell: 10,
    offsetX: 0,
    offsetY: 0,
    lastInput: "",
    lastInputAt: 0,
    polling: null,
    pollTimer: 0,
    pollInFlight: false,
    raf: 0,
    swipeStart: null,
    lastPlayers: {},
    visualPlayers: {},
    particles: [],
    audioContext: null,
    audioBuffers: {},
    audioLoadPromise: null,
    audioUnlocked: false,
    bgAudio: null,
  };

  const els = {
    lobby: $("lobbyPanel"),
    room: $("roomPanel"),
    openGames: $("openGames"),
    players: $("playersList"),
    roomCode: $("roomCode"),
    roomTitle: $("roomTitle"),
    roomStatus: $("roomStatus"),
    start: $("startGame"),
    addBot: $("addBot"),
    next: $("nextRound"),
    reset: $("resetGame"),
    close: $("closeGame"),
    refresh: $("refreshGame"),
    countdown: $("countdown"),
    round: $("roundLabel"),
    status: $("statusLabel"),
    score: $("scoreLabel"),
    message: $("message"),
  };

  function showMessage(text) {
    els.message.textContent = text || "";
    els.message.hidden = !text;
    if (text) setTimeout(() => {
      if (els.message.textContent === text) els.message.hidden = true;
    }, 2400);
  }

  async function post(body) {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-cache",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Game request failed: ${response.status}`);
    return data;
  }

  function playerPayload() {
    const player = state.player || {};
    return {
      playerId: player.id || "player",
      playerName: player.name || "Player",
    };
  }

  function payload() {
    return state.game?.payload || {};
  }

  function phase() {
    return payload().phase || "lobby";
  }

  function currentPlayerState() {
    return payload().players?.[state.mark] || null;
  }

  function setGame(game, extra = {}) {
    const previousPhase = phase();
    captureCrashes(game);
    updateVisualPlayers(game);
    state.game = game;
    state.mark = extra.mark || state.mark || (game?.players || []).find((player) => player.id === state.player?.id)?.mark || "";
    state.observer = !!extra.observer;
    state.lastPlayers = { ...(game?.payload?.players || {}) };
    updateUi();
    handleAudioTransition(previousPhase, phase());
  }

  function captureCrashes(nextGame) {
    const nextPlayers = nextGame?.payload?.players || {};
    for (const [mark, nextPlayer] of Object.entries(nextPlayers)) {
      const previous = state.lastPlayers?.[mark];
      if (previous?.alive !== false && nextPlayer?.alive === false) {
        spawnCrash(nextPlayer.x ?? previous.x ?? 0, nextPlayer.y ?? previous.y ?? 0, nextPlayer.color || previous.color || "#fff");
        playCue("crash", { volume: .72 });
      }
    }
  }

  function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!state.audioContext) state.audioContext = new AudioContextClass();
    return state.audioContext;
  }

  async function unlockAudio() {
    if (state.audioUnlocked) return;
    state.audioUnlocked = true;
    const context = ensureAudioContext();
    if (context?.state === "suspended") await context.resume().catch(() => {});
    if (!state.bgAudio) {
      const audio = new Audio(audioPaths.background);
      audio.loop = true;
      audio.volume = .34;
      audio.preload = "auto";
      state.bgAudio = audio;
    }
    loadAudioBuffers().catch(() => {});
    if (state.game && ["countdown", "running"].includes(phase())) startBackground();
  }

  async function loadAudioBuffers() {
    const context = ensureAudioContext();
    if (!context) return {};
    if (Object.keys(state.audioBuffers).length) return state.audioBuffers;
    if (state.audioLoadPromise) return state.audioLoadPromise;
    state.audioLoadPromise = Promise.all(Object.entries(audioPaths)
      .filter(([name]) => name !== "background")
      .map(async ([name, path]) => {
        const response = await fetch(path, { cache: "force-cache" });
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        return [name, await context.decodeAudioData(buffer)];
      }))
      .then((entries) => {
        state.audioBuffers = Object.fromEntries(entries.filter(Boolean));
        return state.audioBuffers;
      })
      .catch(() => {
        state.audioBuffers = {};
        return state.audioBuffers;
      });
    return state.audioLoadPromise;
  }

  async function playCue(name, options = {}) {
    if (!state.audioUnlocked) return;
    const context = ensureAudioContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume().catch(() => {});
    const buffers = await loadAudioBuffers();
    const buffer = buffers[name];
    if (!buffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = Number(options.volume ?? .55);
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  function startBackground() {
    if (!state.audioUnlocked || !state.bgAudio) return;
    state.bgAudio.play().catch(() => {});
  }

  function stopBackground() {
    if (!state.bgAudio) return;
    state.bgAudio.pause();
  }

  function handleAudioTransition(previousPhase, nextPhase) {
    if (previousPhase === nextPhase) return;
    if (nextPhase === "countdown") {
      playCue("start", { volume: .62 });
      startBackground();
    }
    if (nextPhase === "roundOver" || nextPhase === "gameOver") {
      playCue("roundOver", { volume: .58 });
      stopBackground();
    }
    if (nextPhase === "running") startBackground();
    if (nextPhase === "lobby") stopBackground();
  }

  function updateVisualPlayers(nextGame) {
    const now = performance.now();
    const players = nextGame?.payload?.players || {};
    const tickMs = Number(nextGame?.payload?.settings?.tickMs || 105);
    for (const [mark, player] of Object.entries(players)) {
      if (!player?.alive) continue;
      const prior = state.visualPlayers[mark];
      const nextX = Number(player.x || 0);
      const nextY = Number(player.y || 0);
      if (!prior) {
        state.visualPlayers[mark] = {
          startX: nextX,
          startY: nextY,
          targetX: nextX,
          targetY: nextY,
          startAt: now,
          duration: tickMs,
        };
        continue;
      }
      if (prior.targetX !== nextX || prior.targetY !== nextY) {
        const current = interpolateVisual(prior, now);
        state.visualPlayers[mark] = {
          startX: current.x,
          startY: current.y,
          targetX: nextX,
          targetY: nextY,
          startAt: now,
          duration: Math.max(55, Math.min(150, tickMs)),
        };
      }
    }
    for (const mark of Object.keys(state.visualPlayers)) {
      if (!players[mark]?.alive) delete state.visualPlayers[mark];
    }
  }

  function interpolateVisual(visual, now = performance.now()) {
    const progress = Math.max(0, Math.min(1, (now - visual.startAt) / Math.max(1, visual.duration)));
    const eased = 1 - Math.pow(1 - progress, 3);
    return {
      x: visual.startX + (visual.targetX - visual.startX) * eased,
      y: visual.startY + (visual.targetY - visual.startY) * eased,
    };
  }

  async function loadOpenGames() {
    const data = await post({ action: "status", ...playerPayload() });
    const games = (data.games || []).filter((game) => game.type === "gridcycles");
    renderOpenGames(games);
    if (state.game) {
      const latest = games.find((game) => game.id === state.game.id);
      if (latest) setGame(latest);
    }
  }

  function renderOpenGames(games) {
    els.openGames.innerHTML = "";
    if (!games.length) {
      els.openGames.innerHTML = `<div class="gridcycles-open-game"><span>No open GridCycles rooms.</span></div>`;
      return;
    }
    games.forEach((game) => {
      const row = document.createElement("div");
      row.className = "gridcycles-open-game";
      const count = (game.players || []).length;
      row.innerHTML = `
        <span><strong>${game.title || "GridCycles"}</strong><br>${count}/4 players · ${game.status}</span>
        <button type="button">${game.status === "complete" ? "View" : "Join"}</button>
      `;
      row.querySelector("button").addEventListener("click", () => joinGame(game.id));
      els.openGames.append(row);
    });
  }

  async function createGame(mode) {
    const data = await post({
      action: "create",
      game: "gridcycles",
      mode,
      gridMode: $("gameMode").value,
      difficulty: $("difficulty").value,
      roundsToWin: $("roundsToWin").value,
      duration: $("duration").value,
      botCount: mode === "cpu" ? 2 : 0,
      ...playerPayload(),
    });
    setGame(data.game, { mark: data.mark });
    startPolling();
  }

  async function joinGame(gameId) {
    const data = await post({ action: "join", gameId, ...playerPayload() });
    setGame(data.game, { mark: data.mark, observer: data.observer });
    startPolling();
  }

  async function gameMove(extra) {
    if (!state.game) return;
    const data = await post({ action: "move", gameId: state.game.id, ...playerPayload(), ...extra });
    setGame(data.game);
  }

  async function pollState() {
    if (!state.game) return;
    if (state.pollInFlight) return;
    state.pollInFlight = true;
    try {
      const data = await post({ action: "state", gameId: state.game.id, ...playerPayload() });
      if (data.game) setGame(data.game);
    } catch (error) {
      showMessage(error.message);
    } finally {
      state.pollInFlight = false;
    }
  }

  function startPolling() {
    clearInterval(state.polling);
    clearTimeout(state.pollTimer);
    const loop = async () => {
      await pollState();
      const fast = phase() === "running" || phase() === "countdown";
      state.pollTimer = setTimeout(loop, fast ? 85 : 260);
    };
    loop();
  }

  function updateUi() {
    const game = state.game;
    const data = payload();
    const inGame = !!game;
    const activePlay = inGame && ["running", "countdown"].includes(data.phase);
    els.lobby.hidden = inGame;
    els.room.hidden = !inGame || activePlay;
    if (!inGame) {
      els.round.textContent = "1";
      els.status.textContent = "Lobby";
      els.score.textContent = "0";
      els.countdown.hidden = true;
      return;
    }
    const myState = currentPlayerState();
    const playerScores = data.scores || {};
    els.round.textContent = String(data.round || game.round || 1);
    els.status.textContent = statusText(game, data);
    els.score.textContent = String(playerScores[state.mark] ?? myState?.distance ?? 0);
    els.roomCode.textContent = String(game.id || "").split("-").slice(-2).join("-").toUpperCase();
    els.roomTitle.textContent = roomTitle(game, data);
    els.roomStatus.textContent = roomStatus(game, data);
    els.start.hidden = !(phase() === "lobby" && state.mark === "A");
    els.addBot.hidden = !(phase() === "lobby" && state.mark === "A" && (game.players || []).length < 4);
    els.next.hidden = !(phase() === "roundOver" && state.mark === "A" && game.status !== "complete");
    renderPlayers(game, data);
    renderCountdown(data);
  }

  function statusText(game, data) {
    if (game.status === "complete" || data.phase === "gameOver") return "Done";
    if (data.phase === "countdown") return "Ready";
    if (data.phase === "running") return "Running";
    if (data.phase === "roundOver") return "Round";
    return "Lobby";
  }

  function roomTitle(game, data) {
    if (game.status === "complete" || data.phase === "gameOver") return winnerText(data.winner, "Game over");
    if (data.phase === "roundOver") return winnerText(data.winner, "Round over");
    if (data.phase === "running") return "Stay alive.";
    if (data.phase === "countdown") return "Get ready.";
    return "Ready?";
  }

  function roomStatus(game, data) {
    if (data.phase === "lobby") return "Add players or bots, then start the round.";
    if (data.phase === "roundOver") return state.mark === "A" ? "Host can start the next round." : "Waiting for host.";
    if (game.status === "complete") return "Final score recorded.";
    return "No 180-degree turns. Trails are permanent.";
  }

  function winnerText(mark, fallback) {
    if (!mark) return fallback;
    if (mark === "draw") return "Draw.";
    const player = (state.game?.players || []).find((item) => item.mark === mark);
    return `${player?.name || mark} wins.`;
  }

  function renderPlayers(game, data) {
    els.players.innerHTML = "";
    const players = data.players || {};
    (game.players || []).forEach((player) => {
      const row = document.createElement("div");
      const pState = players[player.mark] || {};
      row.className = "gridcycles-player-row";
      row.innerHTML = `
        <span class="gridcycles-color" style="color:${pState.color || "#fff"};background:${pState.color || "#fff"}"></span>
        <strong>${player.name || player.mark}</strong>
        <span>${data.scores?.[player.mark] || 0} · ${pState.alive === false ? "out" : "alive"}</span>
      `;
      els.players.append(row);
    });
  }

  function renderCountdown(data) {
    if (data.phase !== "countdown") {
      els.countdown.hidden = true;
      return;
    }
    const remaining = Math.max(0, data.countdownRemainingMs || 0);
    els.countdown.textContent = remaining <= 600 ? "GO" : String(Math.ceil((remaining - 500) / 1000));
    els.countdown.hidden = false;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.floor(rect.width * dpr));
    const height = Math.max(240, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function render() {
    resizeCanvas();
    const data = payload();
    const settings = data.settings || { gridW: 80, gridH: 45 };
    const gridW = settings.gridW || 80;
    const gridH = settings.gridH || 45;
    const w = canvas.width;
    const h = canvas.height;
    const cell = Math.max(4, Math.floor(Math.min(w / gridW, h / gridH)));
    state.cell = cell;
    state.offsetX = Math.floor((w - cell * gridW) / 2);
    state.offsetY = Math.floor((h - cell * gridH) / 2);
    drawBackground(w, h, cell, gridW, gridH);
    drawTrails(data, cell);
    drawHeads(data, cell);
    drawParticles(cell);
    state.raf = requestAnimationFrame(render);
  }

  function spawnCrash(x, y, color) {
    const now = performance.now();
    for (let index = 0; index < 64; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.4 + Math.random() * 8.4;
      state.particles.push({
        x: Number(x) + .5,
        y: Number(y) + .5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: .28 + Math.random() * .7,
        color,
        born: now,
        life: 3000,
      });
    }
  }

  function drawBackground(w, h, cell, gridW, gridH) {
    ctx.fillStyle = "#040b07";
    ctx.fillRect(0, 0, w, h);
    const ox = state.offsetX;
    const oy = state.offsetY;
    const arenaW = cell * gridW;
    const arenaH = cell * gridH;
    const grd = ctx.createRadialGradient(w * .5, h * .45, 0, w * .5, h * .45, Math.max(w, h) * .7);
    grd.addColorStop(0, "#123923");
    grd.addColorStop(1, "#050f09");
    ctx.fillStyle = grd;
    ctx.fillRect(ox, oy, arenaW, arenaH);
    ctx.strokeStyle = "rgba(126,229,139,.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = cell * 4;
    for (let x = ox; x <= ox + arenaW; x += step) {
      ctx.moveTo(x, oy);
      ctx.lineTo(x, oy + arenaH);
    }
    for (let y = oy; y <= oy + arenaH; y += step) {
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + arenaW, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, arenaW, arenaH);
  }

  function drawTrails(data, cell) {
    const occupied = data.occupied || {};
    const players = data.players || {};
    const ox = state.offsetX;
    const oy = state.offsetY;
    for (const [key, mark] of Object.entries(occupied)) {
      const [x, y] = key.split(",").map(Number);
      const color = players[mark]?.color || "#fff";
      ctx.fillStyle = color;
      ctx.globalAlpha = .78;
      ctx.shadowColor = color;
      ctx.shadowBlur = cell > 7 ? 8 : 0;
      ctx.fillRect(ox + x * cell + 1, oy + y * cell + 1, Math.max(1, cell - 2), Math.max(1, cell - 2));
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawHeads(data, cell) {
    const players = data.players || {};
    const ox = state.offsetX;
    const oy = state.offsetY;
    Object.values(players).forEach((player) => {
      if (!player?.alive) return;
      const color = player.color || "#fff";
      const visual = state.visualPlayers[player.mark];
      const current = visual ? interpolateVisual(visual) : { x: Number(player.x || 0), y: Number(player.y || 0) };
      const cx = ox + (current.x + .5) * cell;
      const cy = oy + (current.y + .5) * cell;
      ctx.fillStyle = "#fff";
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, cell * .72), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(3, cell * .46), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function drawParticles(cell) {
    if (!state.particles.length) return;
    const now = performance.now();
    const ox = state.offsetX;
    const oy = state.offsetY;
    state.particles = state.particles.filter((particle) => {
      const age = now - particle.born;
      if (age > particle.life) return false;
      const t = age / 1000;
      const fade = 1 - age / particle.life;
      const px = ox + (particle.x + particle.vx * t) * cell;
      const py = oy + (particle.y + particle.vy * t) * cell;
      const size = Math.max(2, particle.size * cell * (1 + t * .28));
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 12 * fade;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
      return true;
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function sendDir(dir) {
    if (!state.game || state.observer || phase() !== "running") return;
    const now = performance.now();
    if (state.lastInput === dir && now - state.lastInputAt < 80) return;
    state.lastInput = dir;
    state.lastInputAt = now;
    gameMove({ gridcyclesAction: "input", dir }).catch((error) => showMessage(error.message));
  }

  function handleKey(event) {
    const keyMap = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
      i: "up", I: "up", k: "down", K: "down", j: "left", J: "left", l: "right", L: "right",
    };
    const dir = keyMap[event.key];
    if (!dir) return;
    event.preventDefault();
    sendDir(dir);
  }

  function pointerPos(event) {
    const touch = event.changedTouches?.[0] || event.touches?.[0] || event;
    return { x: touch.clientX, y: touch.clientY };
  }

  function startSwipe(event) {
    state.swipeStart = pointerPos(event);
    event.preventDefault();
  }

  function endSwipe(event) {
    if (!state.swipeStart) return;
    const end = pointerPos(event);
    const dx = end.x - state.swipeStart.x;
    const dy = end.y - state.swipeStart.y;
    state.swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    sendDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    event.preventDefault();
  }

  function bindEvents() {
    $("soloGame").addEventListener("click", () => createGame("cpu").catch((error) => showMessage(error.message)));
    $("createGame").addEventListener("click", () => createGame("pvp").catch((error) => showMessage(error.message)));
    els.refresh.addEventListener("click", () => (state.game ? pollState() : loadOpenGames()).catch((error) => showMessage(error.message)));
    els.start.addEventListener("click", () => gameMove({ gridcyclesAction: "start" }).catch((error) => showMessage(error.message)));
    els.addBot.addEventListener("click", () => gameMove({ gridcyclesAction: "add-bot" }).catch((error) => showMessage(error.message)));
    els.next.addEventListener("click", () => gameMove({ gridcyclesAction: "next" }).catch((error) => showMessage(error.message)));
    els.reset.addEventListener("click", () => post({ action: "reset", gameId: state.game?.id, ...playerPayload() }).then((data) => setGame(data.game)).catch((error) => showMessage(error.message)));
    els.close.addEventListener("click", () => {
      clearInterval(state.polling);
      clearTimeout(state.pollTimer);
      state.game = null;
      stopBackground();
      updateUi();
      loadOpenGames().catch((error) => showMessage(error.message));
    });
    document.querySelectorAll("#dpad [data-dir]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        sendDir(button.dataset.dir);
      });
    });
    window.addEventListener("keydown", handleKey, { passive: false });
    window.addEventListener("keydown", () => unlockAudio().catch(() => {}), { once: true, passive: true });
    document.addEventListener("pointerdown", () => unlockAudio().catch(() => {}), { once: true, passive: true });
    document.addEventListener("touchstart", () => unlockAudio().catch(() => {}), { once: true, passive: true });
    canvas.addEventListener("pointerdown", startSwipe, { passive: false });
    canvas.addEventListener("pointerup", endSwipe, { passive: false });
    canvas.addEventListener("touchstart", startSwipe, { passive: false });
    canvas.addEventListener("touchend", endSwipe, { passive: false });
    document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  }

  async function init() {
    state.player = await window.OIABPlayers.require();
    bindEvents();
    await loadOpenGames();
    updateUi();
    render();
    setInterval(() => {
      if (!state.game) loadOpenGames().catch(() => {});
    }, 7000);
  }

  init().catch((error) => showMessage(error.message));
})();
