(() => {
  const apiUrl = "/mobile-games";
  const audioPaths = {
    background: "/mobile/assets/gridcycles/background.mp3",
    crash: "/mobile/assets/gridcycles/crash.mp3",
    start: "/mobile/assets/gridcycles/start.mp3",
    roundOver: "/mobile/assets/gridcycles/round-over.mp3",
  };
  const DIRS = {
    up: [0, -1],
    right: [1, 0],
    down: [0, 1],
    left: [-1, 0],
  };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
  const MARKS = ["A", "B", "C", "D"];
  const COLORS = { A: "#67e8f9", B: "#ffcf4d", C: "#ff6b7a", D: "#8bff8f" };
  const $ = (id) => document.getElementById(id);
  const canvas = $("gridCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const state = {
    player: null,
    game: null,
    localGame: false,
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
    bgSource: null,
    bgGain: null,
    bgWanted: false,
    backgroundCanvas: null,
    backgroundCtx: null,
    backgroundKey: "",
    trailCanvas: null,
    trailCtx: null,
    trailKey: "",
    lastFrameAt: 0,
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
    state.lastPlayers = JSON.parse(JSON.stringify(game?.payload?.players || {}));
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
    state.bgWanted = true;
    if (!state.audioUnlocked || state.bgSource) return;
    const context = ensureAudioContext();
    if (!context) return;
    context.resume?.().catch(() => {});
    loadAudioBuffers().then((buffers) => {
      if (state.bgSource || !state.audioUnlocked || !state.bgWanted) return;
      const buffer = buffers.background;
      if (!buffer) {
        if (state.bgAudio) state.bgAudio.play().catch(() => {});
        return;
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = .28;
      source.connect(gain).connect(context.destination);
      source.start();
      state.bgSource = source;
      state.bgGain = gain;
      source.onended = () => {
        if (state.bgSource === source) state.bgSource = null;
      };
    }).catch(() => {
      if (state.bgAudio) state.bgAudio.play().catch(() => {});
    });
  }

  function stopBackground() {
    state.bgWanted = false;
    if (state.bgSource) {
      const source = state.bgSource;
      state.bgSource = null;
      source.onended = null;
      try { source.stop(); } catch (_error) {}
    }
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

  function tickMsForDifficulty(difficulty, kidMode = false) {
    if (kidMode) return 150;
    return { easy: 135, medium: 105, hard: 86, expert: 72 }[difficulty] || 105;
  }

  function localNow() {
    return Date.now();
  }

  function validTurn(current, proposed) {
    return proposed in DIRS && proposed !== OPPOSITE[current];
  }

  function directionToFurthestWall(x, y, gridW, gridH) {
    const distances = {
      left: x,
      right: gridW - 1 - x,
      up: y,
      down: gridH - 1 - y,
    };
    return Object.entries(distances).sort((a, b) => b[1] - a[1])[0][0];
  }

  function startPositions(gridW, gridH, marks) {
    const margin = 4;
    const minGap = 10;
    const maxX = Math.max(margin, gridW - margin - 1);
    const maxY = Math.max(margin, gridH - margin - 1);
    const placed = [];
    const result = {};
    const fallbacks = [[margin, margin], [maxX, maxY], [maxX, margin], [margin, maxY]];
    for (const mark of marks) {
      let chosen = null;
      for (let attempt = 0; attempt < 600; attempt += 1) {
        const x = margin + Math.floor(Math.random() * Math.max(1, maxX - margin + 1));
        const y = margin + Math.floor(Math.random() * Math.max(1, maxY - margin + 1));
        if (placed.every(([px, py]) => Math.abs(x - px) + Math.abs(y - py) >= minGap)) {
          chosen = [x, y];
          break;
        }
      }
      if (!chosen) chosen = fallbacks[placed.length % fallbacks.length];
      placed.push(chosen);
      result[mark] = [chosen[0], chosen[1], directionToFurthestWall(chosen[0], chosen[1], gridW, gridH)];
    }
    return result;
  }

  function pruneFadingTrails(data, now = localNow()) {
    data.fadingTrails = (data.fadingTrails || []).filter((trail) => now - Number(trail.startedAt || 0) < Number(trail.durationMs || 2000) + 120);
  }

  function releaseCrashedTrails(data, crashed, now = localNow()) {
    if (!data || !crashed?.size) {
      if (data) pruneFadingTrails(data, now);
      return;
    }
    data.fadingTrails = data.fadingTrails || [];
    data.occupied = data.occupied || {};
    for (const mark of [...crashed].sort()) {
      const cells = [];
      for (const [key, owner] of Object.entries(data.occupied)) {
        if (owner !== mark) continue;
        const [x, y] = key.split(",").map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) cells.push([x, y]);
        delete data.occupied[key];
      }
      if (cells.length) {
        data.fadingTrails.push({
          mark,
          color: data.players?.[mark]?.color || COLORS[mark] || "#ffffff",
          startedAt: now,
          durationMs: 2000,
          cells,
        });
      }
    }
    pruneFadingTrails(data, now);
    state.trailKey = "";
  }

  function createLocalGame() {
    clearInterval(state.polling);
    clearTimeout(state.pollTimer);
    const difficulty = $("difficulty").value || "medium";
    const mode = $("gameMode").value || "classic";
    const kidMode = mode === "kid";
    const settings = {
      gridW: 80,
      gridH: 45,
      tickMs: tickMsForDifficulty(difficulty, kidMode),
      roundsToWin: Math.max(1, Math.min(9, Number($("roundsToWin").value || 3))),
      mode,
      kidMode,
      duration: Math.max(30, Math.min(300, Number($("duration").value || 90))),
      lowPerf: false,
    };
    const playerName = state.player?.name || "Player";
    const players = [
      { id: state.player?.id || "local-player", name: playerName, mark: "A" },
      { id: `cpu-gridcycles-b-${difficulty}`, name: "Computer B", mark: "B", isBot: true },
      { id: `cpu-gridcycles-c-${difficulty}`, name: "Computer C", mark: "C", isBot: true },
    ];
    const game = {
      id: `local-gridcycles-${Math.random().toString(16).slice(2, 8)}`,
      type: "gridcycles",
      title: "Local GridCycles",
      status: "active",
      mode: "cpu",
      difficulty,
      players,
      payload: {
        phase: "lobby",
        settings,
        players: {},
        occupied: {},
        fadingTrails: [],
        round: 1,
        winner: null,
        scores: {},
        roundWinners: [],
        countdownUntil: 0,
        startedAt: 0,
        lastTick: 0,
        tick: 0,
        lagPauses: 0,
        events: [],
      },
    };
    syncLocalPlayers(game);
    state.localGame = true;
    setGame(game, { mark: "A", observer: false });
    startLocalRound(2600);
    showMessage("Local solo round started.");
  }

  function syncLocalPlayers(game) {
    const data = game.payload || {};
    const players = data.players || {};
    const scores = data.scores || {};
    for (const player of game.players || []) {
      if (!player?.mark) continue;
      players[player.mark] = {
        ...(players[player.mark] || {}),
        id: player.id || player.mark,
        name: player.name || player.mark,
        mark: player.mark,
        color: players[player.mark]?.color || COLORS[player.mark] || "#fff",
        isBot: !!player.isBot,
      };
      scores[player.mark] = Number(scores[player.mark] || 0);
    }
    data.players = players;
    data.scores = scores;
  }

  function startLocalRound(countdownMs = 2600) {
    const game = state.game;
    if (!game) return;
    const previousPhase = phase();
    syncLocalPlayers(game);
    const data = game.payload;
    const settings = data.settings || {};
    const gridW = Number(settings.gridW || 80);
    const gridH = Number(settings.gridH || 45);
    const marks = (game.players || []).map((player) => player.mark).filter(Boolean);
    const positions = startPositions(gridW, gridH, marks);
    data.occupied = {};
    data.fadingTrails = [];
    for (const mark of marks) {
      const [x, y, dir] = positions[mark];
      data.players[mark] = {
        ...(data.players[mark] || {}),
        x,
        y,
        dir,
        nextDir: dir,
        alive: true,
        distance: 0,
        survivalMs: 0,
        crashedAt: 0,
        shield: !!settings.kidMode,
      };
      data.occupied[`${x},${y}`] = mark;
    }
    data.phase = "countdown";
    data.countdownUntil = localNow() + countdownMs;
    data.countdownRemainingMs = countdownMs;
    data.startedAt = 0;
    data.lastTick = data.countdownUntil;
    data.tick = 0;
    data.winner = null;
    data.events = [];
    game.status = "active";
    state.lastPlayers = {};
    state.visualPlayers = {};
    state.trailKey = "";
    setGame(game);
    handleAudioTransition(previousPhase, phase());
  }

  function localOpenCell(data, x, y) {
    const settings = data.settings || {};
    return x >= 0 && y >= 0 && x < Number(settings.gridW || 80) && y < Number(settings.gridH || 45) && !data.occupied?.[`${x},${y}`];
  }

  function localFloodScore(data, startX, startY, limit) {
    if (!localOpenCell(data, startX, startY)) return -1;
    const seen = new Set([`${startX},${startY}`]);
    const queue = [[startX, startY]];
    while (queue.length && seen.size < limit) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (!seen.has(key) && localOpenCell(data, nx, ny)) {
          seen.add(key);
          queue.push([nx, ny]);
        }
      }
    }
    return seen.size;
  }

  function localBotDirection(data, mark, difficulty) {
    const bot = data.players?.[mark] || {};
    const human = data.players?.A || {};
    const current = bot.dir || "right";
    const x = Number(bot.x || 0);
    const y = Number(bot.y || 0);
    const humanDir = human.dir || "right";
    const [hdx, hdy] = DIRS[humanDir] || [0, 0];
    const projectedHuman = {
      x: Number(human.x || 0) + hdx * ({ easy: 2, medium: 4, hard: 7, expert: 10 }[difficulty] || 4),
      y: Number(human.y || 0) + hdy * ({ easy: 2, medium: 4, hard: 7, expert: 10 }[difficulty] || 4),
    };
    const lookahead = { easy: 16, medium: 48, hard: 100, expert: 160 }[difficulty] || 48;
    const aggression = { easy: 0, medium: 10, hard: 28, expert: 48 }[difficulty] || 10;
    const mistakeRate = { easy: .32, medium: .12, hard: .04, expert: .015 }[difficulty] ?? .12;
    const choices = [];
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      if (dir === OPPOSITE[current]) continue;
      const nx = x + dx;
      const ny = y + dy;
      const space = localFloodScore(data, nx, ny, lookahead);
      if (space < 0) continue;
      const distanceToHuman = Math.abs(nx - projectedHuman.x) + Math.abs(ny - projectedHuman.y);
      const directPressure = Math.max(0, 24 - distanceToHuman) * aggression;
      const laneCut = ((dx !== 0 && Math.abs(ny - projectedHuman.y) <= 2) || (dy !== 0 && Math.abs(nx - projectedHuman.x) <= 2)) ? aggression * 1.7 : 0;
      const forwardBias = dir === current ? 4 : 0;
      const turnBias = dir !== current && difficulty !== "easy" ? 3 : 0;
      choices.push({ dir, score: space + directPressure + laneCut + forwardBias + turnBias });
    }
    if (!choices.length) return current;
    choices.sort((a, b) => b.score - a.score);
    if (Math.random() < mistakeRate && choices.length > 1) {
      return choices[Math.min(choices.length - 1, Math.floor(Math.random() * 3))].dir;
    }
    return choices[0].dir;
  }

  function finishLocalRound(crashed) {
    const game = state.game;
    const data = payload();
    const previousPhase = phase();
    const living = Object.entries(data.players || {}).filter(([, player]) => player?.alive).map(([mark]) => mark);
    let winner = living.length === 1 ? living[0] : null;
    if (!living.length) {
      const distances = Object.fromEntries(Object.entries(data.players || {}).map(([mark, player]) => [mark, Number(player?.distance || 0)]));
      const top = Math.max(...Object.values(distances), 0);
      const leaders = Object.entries(distances).filter(([, value]) => value === top).map(([mark]) => mark);
      winner = leaders.length === 1 ? leaders[0] : "draw";
    }
    data.phase = "roundOver";
    data.winner = winner || "draw";
    data.roundWinners = [...(data.roundWinners || []), data.winner];
    if (winner && winner !== "draw") data.scores[winner] = Number(data.scores[winner] || 0) + 1;
    data.events = [{ type: "crash", marks: [...crashed].sort(), at: localNow() }];
    const roundsToWin = Number(data.settings?.roundsToWin || 3);
    if (winner && winner !== "draw" && Number(data.scores[winner] || 0) >= roundsToWin) {
      data.phase = "gameOver";
      game.status = "complete";
      game.winner = winner;
    }
    setGame(game);
    handleAudioTransition(previousPhase, phase());
  }

  function advanceLocalTick() {
    const game = state.game;
    const data = payload();
    const difficulty = game?.difficulty || "medium";
    for (const [mark, player] of Object.entries(data.players || {})) {
      if (player?.alive && player.isBot) player.nextDir = localBotDirection(data, mark, difficulty);
    }
    const intents = {};
    const targetCounts = {};
    for (const [mark, player] of Object.entries(data.players || {})) {
      if (!player?.alive) continue;
      let dir = player.nextDir || player.dir || "right";
      if (!validTurn(player.dir || dir, dir)) dir = player.dir || dir;
      const [dx, dy] = DIRS[dir];
      const nx = Number(player.x || 0) + dx;
      const ny = Number(player.y || 0) + dy;
      const key = `${nx},${ny}`;
      intents[mark] = { x: nx, y: ny, dir, key };
      targetCounts[key] = Number(targetCounts[key] || 0) + 1;
    }
    const gridW = Number(data.settings?.gridW || 80);
    const gridH = Number(data.settings?.gridH || 45);
    const crashed = new Set();
    for (const [mark, move] of Object.entries(intents)) {
      const player = data.players[mark];
      if (move.x < 0 || move.y < 0 || move.x >= gridW || move.y >= gridH || data.occupied?.[move.key] || targetCounts[move.key] > 1) {
        if (player.shield) {
          player.shield = false;
          player.nextDir = OPPOSITE[player.dir || "right"] || "left";
        } else {
          crashed.add(mark);
        }
      }
    }
    const now = localNow();
    for (const mark of crashed) {
      if (data.players[mark]) {
        data.players[mark].alive = false;
        data.players[mark].crashedAt = now;
      }
    }
    releaseCrashedTrails(data, crashed, now);
    for (const [mark, move] of Object.entries(intents)) {
      const player = data.players[mark];
      if (!player?.alive) continue;
      player.x = move.x;
      player.y = move.y;
      player.dir = move.dir;
      player.nextDir = move.dir;
      player.distance = Number(player.distance || 0) + 1;
      player.survivalMs = Math.max(0, now - Number(data.startedAt || now));
      data.occupied[move.key] = mark;
    }
    data.tick = Number(data.tick || 0) + 1;
    const mode = data.settings?.mode || "classic";
    const timedOut = mode === "timed" && data.startedAt && now >= Number(data.startedAt) + Number(data.settings?.duration || 90) * 1000;
    const alive = Object.values(data.players || {}).filter((player) => player?.alive);
    if (alive.length <= 1 || timedOut) {
      if (timedOut) {
        for (const player of Object.values(data.players || {})) player.alive = false;
        releaseCrashedTrails(data, new Set(Object.keys(data.players || {})), now);
      }
      finishLocalRound(crashed);
    }
  }

  function advanceLocalGame() {
    if (!state.localGame || !state.game) return;
    const data = payload();
    const now = localNow();
    if (data.phase === "countdown") {
      data.countdownRemainingMs = Math.max(0, Number(data.countdownUntil || 0) - now);
      if (now >= Number(data.countdownUntil || 0)) {
        const previousPhase = phase();
        data.phase = "running";
        data.startedAt = now;
        data.lastTick = now;
        setGame(state.game);
        handleAudioTransition(previousPhase, phase());
      }
      return;
    }
    if (data.phase !== "running") return;
    const tickMs = Math.max(55, Math.min(180, Number(data.settings?.tickMs || 105)));
    const elapsed = now - Number(data.lastTick || now);
    if (elapsed < tickMs) return;
    if (elapsed > tickMs * 5) {
      data.lastTick = now;
      data.lagPauses = Number(data.lagPauses || 0) + 1;
      return;
    }
    advanceLocalTick();
    data.lastTick = now;
    setGame(state.game);
  }

  async function loadOpenGames() {
    const data = await post({ action: "status", ...playerPayload() });
    const games = (data.games || []).filter((game) => game.type === "gridcycles");
    renderOpenGames(games);
    if (state.game && !state.localGame) {
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
    if (mode === "cpu") {
      createLocalGame();
      return;
    }
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
    state.localGame = false;
    setGame(data.game, { mark: data.mark });
    startPolling();
  }

  async function joinGame(gameId) {
    const data = await post({ action: "join", gameId, ...playerPayload() });
    state.localGame = false;
    setGame(data.game, { mark: data.mark, observer: data.observer });
    startPolling();
  }

  async function gameMove(extra) {
    if (!state.game) return;
    if (state.localGame) {
      const action = String(extra.gridcyclesAction || "input").toLowerCase();
      if (action === "start" || action === "next") {
        startLocalRound();
        return;
      }
      if (action === "input") {
        const player = currentPlayerState();
        const dir = String(extra.dir || "").toLowerCase();
        if (player && dir in DIRS && validTurn(player.dir || "right", dir) && validTurn(player.nextDir || player.dir || "right", dir)) {
          player.nextDir = dir;
          setGame(state.game);
        }
      }
      return;
    }
    const data = await post({ action: "move", gameId: state.game.id, ...playerPayload(), ...extra });
    setGame(data.game);
  }

  async function closeCurrentGame() {
    if (!state.game) return;
    if (state.localGame) {
      clearInterval(state.polling);
      clearTimeout(state.pollTimer);
      state.game = null;
      state.localGame = false;
      state.mark = "";
      state.observer = false;
      state.lastPlayers = {};
      state.visualPlayers = {};
      state.particles = [];
      stopBackground();
      updateUi();
      showMessage("Local game closed.");
      return;
    }
    const gameId = state.game.id;
    const action = state.mark === "A" ? "close" : "leave";
    const data = await post({ action, gameId, ...playerPayload() });
    clearInterval(state.polling);
    clearTimeout(state.pollTimer);
    state.game = null;
    state.localGame = false;
    state.mark = "";
    state.observer = false;
    state.lastPlayers = {};
    state.visualPlayers = {};
    state.particles = [];
    stopBackground();
    updateUi();
    renderOpenGames((data.games || []).filter((game) => game.type === "gridcycles"));
    showMessage(data.closed ? "Room closed." : "Left room.");
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
    els.roomCode.textContent = state.localGame ? "LOCAL" : String(game.id || "").split("-").slice(-2).join("-").toUpperCase();
    els.roomTitle.textContent = roomTitle(game, data);
    els.roomStatus.textContent = roomStatus(game, data);
    els.start.hidden = !(phase() === "lobby" && state.mark === "A");
    els.addBot.hidden = state.localGame || !(phase() === "lobby" && state.mark === "A" && (game.players || []).length < 4);
    els.next.hidden = !(phase() === "roundOver" && state.mark === "A" && game.status !== "complete");
    els.close.textContent = state.localGame ? "Close" : (state.mark === "A" ? "Close Room" : "Leave");
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
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.floor(rect.width * dpr));
    const height = Math.max(240, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      state.backgroundKey = "";
      state.trailKey = "";
    }
  }

  function render() {
    const now = performance.now();
    if (state.lastFrameAt && now - state.lastFrameAt > 260) {
      // A long browser stall means interpolation targets are stale. Snap heads
      // back to canonical state instead of visually easing across many cells.
      state.visualPlayers = {};
    }
    state.lastFrameAt = now;
    advanceLocalGame();
    resizeCanvas();
    const data = payload();
    if (data.phase === "countdown") renderCountdown(data);
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
    drawTrails(data, cell, gridW, gridH);
    drawFadingTrails(data, cell);
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

  function ensureCacheCanvas(kind, w, h) {
    const canvasKey = `${kind}Canvas`;
    const ctxKey = `${kind}Ctx`;
    if (!state[canvasKey]) {
      state[canvasKey] = document.createElement("canvas");
      state[ctxKey] = state[canvasKey].getContext("2d", { alpha: true });
    }
    if (state[canvasKey].width !== w || state[canvasKey].height !== h) {
      state[canvasKey].width = w;
      state[canvasKey].height = h;
      state[`${kind}Key`] = "";
    }
    return { canvas: state[canvasKey], context: state[ctxKey] };
  }

  function drawBackground(w, h, cell, gridW, gridH) {
    const ox = state.offsetX;
    const oy = state.offsetY;
    const arenaW = cell * gridW;
    const arenaH = cell * gridH;
    const key = `${w}:${h}:${cell}:${gridW}:${gridH}:${ox}:${oy}`;
    const cache = ensureCacheCanvas("background", w, h);
    const bctx = cache.context;
    if (state.backgroundKey !== key) {
      bctx.clearRect(0, 0, w, h);
      bctx.fillStyle = "#040b07";
      bctx.fillRect(0, 0, w, h);
      const grd = bctx.createRadialGradient(w * .5, h * .45, 0, w * .5, h * .45, Math.max(w, h) * .7);
      grd.addColorStop(0, "#123923");
      grd.addColorStop(1, "#050f09");
      bctx.fillStyle = grd;
      bctx.fillRect(ox, oy, arenaW, arenaH);
      bctx.strokeStyle = "rgba(126,229,139,.13)";
      bctx.lineWidth = 1;
      bctx.beginPath();
      const step = cell * 4;
      for (let x = ox; x <= ox + arenaW; x += step) {
        bctx.moveTo(x, oy);
        bctx.lineTo(x, oy + arenaH);
      }
      for (let y = oy; y <= oy + arenaH; y += step) {
        bctx.moveTo(ox, y);
        bctx.lineTo(ox + arenaW, y);
      }
      bctx.stroke();
      bctx.strokeStyle = "rgba(255,255,255,.22)";
      bctx.lineWidth = 2;
      bctx.strokeRect(ox, oy, arenaW, arenaH);
      state.backgroundKey = key;
    }
    ctx.drawImage(cache.canvas, 0, 0);
  }

  function drawTrails(data, cell, gridW, gridH) {
    const occupied = data.occupied || {};
    const players = data.players || {};
    const ox = state.offsetX;
    const oy = state.offsetY;
    const entries = Object.entries(occupied);
    const key = `${canvas.width}:${canvas.height}:${cell}:${gridW}:${gridH}:${ox}:${oy}:${data.round || 1}:${data.tick || entries.length}:${entries.length}`;
    const cache = ensureCacheCanvas("trail", canvas.width, canvas.height);
    const tctx = cache.context;
    if (state.trailKey !== key) {
      tctx.clearRect(0, 0, cache.canvas.width, cache.canvas.height);
      for (const [pos, mark] of entries) {
        const [x, y] = pos.split(",").map(Number);
        const color = players[mark]?.color || "#fff";
        const px = ox + x * cell;
        const py = oy + y * cell;
        // Cheap two-pass glow. Avoid per-cell shadowBlur; it becomes the main
        // stutter source once a round has hundreds of occupied cells.
        tctx.fillStyle = color;
        tctx.globalAlpha = .22;
        tctx.fillRect(px, py, cell, cell);
        tctx.globalAlpha = .86;
        tctx.fillRect(px + 1, py + 1, Math.max(1, cell - 2), Math.max(1, cell - 2));
      }
      tctx.globalAlpha = 1;
      state.trailKey = key;
    }
    ctx.drawImage(cache.canvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawFadingTrails(data, cell) {
    const trails = data.fadingTrails || [];
    if (!trails.length) return;
    const now = localNow();
    const ox = state.offsetX;
    const oy = state.offsetY;
    for (const trail of trails) {
      const duration = Math.max(1, Number(trail.durationMs || 2000));
      const age = now - Number(trail.startedAt || now);
      const progress = Math.max(0, Math.min(1, age / duration));
      const alpha = Math.pow(1 - progress, 1.35);
      if (alpha <= 0) continue;
      const scale = Math.max(.08, 1 - progress * .92);
      const size = Math.max(1, cell * scale);
      const inset = (cell - size) / 2;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = trail.color || "#ffffff";
      ctx.shadowColor = trail.color || "#ffffff";
      ctx.shadowBlur = 10 * alpha;
      for (const cellPos of trail.cells || []) {
        const [x, y] = cellPos;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        ctx.fillRect(ox + x * cell + inset, oy + y * cell + inset, size, size);
      }
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
    els.refresh.addEventListener("click", () => {
      if (state.localGame) {
        showMessage("Local game is running in this browser.");
        return;
      }
      (state.game ? pollState() : loadOpenGames()).catch((error) => showMessage(error.message));
    });
    els.start.addEventListener("click", () => gameMove({ gridcyclesAction: "start" }).catch((error) => showMessage(error.message)));
    els.addBot.addEventListener("click", () => gameMove({ gridcyclesAction: "add-bot" }).catch((error) => showMessage(error.message)));
    els.next.addEventListener("click", () => gameMove({ gridcyclesAction: "next" }).catch((error) => showMessage(error.message)));
    els.reset.addEventListener("click", () => {
      if (state.localGame) {
        if (state.game) {
          state.game.payload.round = 1;
          state.game.round = 1;
          state.game.payload.scores = {};
          state.game.payload.roundWinners = [];
          state.game.status = "active";
          startLocalRound();
        }
        return;
      }
      post({ action: "reset", gameId: state.game?.id, ...playerPayload() }).then((data) => setGame(data.game)).catch((error) => showMessage(error.message));
    });
    els.close.addEventListener("click", () => closeCurrentGame().catch((error) => showMessage(error.message)));
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
