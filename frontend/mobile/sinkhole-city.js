(() => {
  const profileStorageKey = "iiab-overland-player-profile";
  const storageKey = "oiab-sinkhole-city-best";
  const durationMs = 120000;
  const world = { width: 2600, height: 1800 };
  const tiers = [
    { name: "small", min: 7, max: 16, score: 18, growth: .18 },
    { name: "medium", min: 17, max: 27, score: 48, growth: .36 },
    { name: "large", min: 28, max: 43, score: 120, growth: .74 },
    { name: "huge", min: 44, max: 76, score: 310, growth: 1.45 },
  ];
  const environments = [
    {
      id: "campsite",
      name: "Basecamp",
      catalog: {
        small: ["rock", "cone", "trash", "shrub", "chair", "cooler", "lantern", "campfire", "backpack"],
        medium: ["picnic", "sign", "mailbox", "tent", "bike", "stove", "barrel", "campTable"],
        large: ["jeep", "trailer", "tree", "foodtruck", "cabin", "outhouse", "pump"],
        huge: ["rv", "lodge", "boulder", "watertower", "bridge", "giantsign"],
      },
    },
    {
      id: "city",
      name: "Metro Sink",
      catalog: {
        small: ["cone", "trash", "hydrant", "parkingMeter", "streetlight", "newspaperBox", "bench"],
        medium: ["trafficLight", "mailbox", "bike", "scooter", "dumpster", "busStop", "roadBarrier"],
        large: ["car", "taxi", "van", "foodtruck", "bus", "storefront", "utilityTruck"],
        huge: ["building", "skyscraper", "parkingGarage", "bridge", "billboard", "watertower"],
      },
    },
    {
      id: "space",
      name: "Orbit Collapse",
      catalog: {
        small: ["starRock", "meteor", "probe", "moonBuggy", "spaceDebris", "smallPlanet"],
        medium: ["satellite", "capsule", "lander", "asteroid", "comet", "spaceBuoy"],
        large: ["spaceship", "xwing", "shuttle", "stationModule", "largeAsteroid", "moon"],
        huge: ["spaceStation", "enterprise", "deathstar", "planet", "wormholeGate", "mothership"],
      },
    },
    {
      id: "underwater",
      name: "Deep Sink",
      catalog: {
        small: ["fish", "shell", "starfish", "urchin", "seaweed", "bubbleCluster", "crab"],
        medium: ["coral", "jellyfish", "turtle", "ray", "anchor", "treasureChest"],
        large: ["shark", "dolphin", "submarine", "reef", "shipwreck", "octopus"],
        huge: ["whale", "giantSquid", "sunkenShip", "kelpForest", "seaStack", "underseaBase"],
      },
    },
    {
      id: "alien",
      name: "Alien World",
      catalog: {
        small: ["crystal", "spore", "alienRock", "glowPod", "crawler", "tinyUfo", "tentacleBud"],
        medium: ["crystalCluster", "mushroomTower", "alienShrub", "hoverDrone", "eggSac", "plasmaVent"],
        large: ["walker", "ufo", "monolith", "alienTree", "crawlerQueen", "bioDome"],
        huge: ["mothership", "alienTemple", "megaCrystal", "hiveTower", "leviathan", "portal"],
      },
    },
  ];
  const sfxBase = "/mobile/assets/sinkhole-city/sfx";
  const soundFiles = {
    ui: "ui_select.mp3",
    countdownTick: "countdown_tick.mp3",
    countdownGo: "countdown_go.mp3",
    grow: "grow_up.mp3",
    gameOver: "game_over.mp3",
    small: "swallow_small.mp3",
    medium: "swallow_medium.mp3",
    large: "swallow_large.mp3",
    huge: "swallow_huge.mp3",
  };
  const ranks = [
    { min: 0, label: "Pothole" },
    { min: 34, label: "Sinkhole" },
    { min: 48, label: "Street Eater" },
    { min: 68, label: "Block Crusher" },
    { min: 92, label: "City Collapse" },
  ];
  const cpuProfiles = {
    easy: {
      speedScale: .7,
      vision: 560,
      reactionMs: 720,
      targetLimit: 10,
      edibleMargin: .69,
      largeBias: .35,
      wanderMs: 1050,
      mistakeRate: .36,
      chaseRatio: 1.32,
      fleeRatio: 1.04,
      chaseRange: 300,
      fleeRange: 300,
    },
    medium: {
      speedScale: .92,
      vision: 980,
      reactionMs: 360,
      targetLimit: 22,
      edibleMargin: .76,
      largeBias: .95,
      wanderMs: 760,
      mistakeRate: .12,
      chaseRatio: 1.16,
      fleeRatio: 1.08,
      chaseRange: 520,
      fleeRange: 390,
    },
    hard: {
      speedScale: 1.08,
      vision: 1800,
      reactionMs: 150,
      targetLimit: 60,
      edibleMargin: .8,
      largeBias: 1.65,
      wanderMs: 520,
      mistakeRate: 0,
      chaseRatio: 1.04,
      fleeRatio: 1.02,
      chaseRange: 760,
      fleeRange: 560,
    },
  };

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const $ = (id) => document.getElementById(id);
  const state = {
    profile: loadProfile(),
    mode: "menu",
    seed: 6205,
    dpr: 1,
    width: 1,
    height: 1,
    objects: [],
    particles: [],
    player: null,
    opponents: [],
    camera: { x: 0, y: 0, shake: 0 },
    input: { x: 0, y: 0, keys: new Set(), pointerId: null, originX: 0, originY: 0 },
    last: 0,
    startAt: 0,
    pausedAt: 0,
    scoreRecorded: false,
    best: Number(localStorage.getItem(storageKey) || 0),
    audioReady: false,
    audioLoading: null,
    audioContext: null,
    soundBuffers: {},
    soundLastAt: {},
    matchMode: "solo",
    battleVariant: "objects",
    cpuDifficulty: "medium",
    remoteGameId: "",
    remoteMark: "",
    remotePoll: null,
    remotePublishAt: 0,
    remoteEatenPublished: new Set(),
    environment: environments[0],
  };
  const backgroundMusic = new Audio(`${sfxBase}/background.mp3`);
  backgroundMusic.preload = "auto";
  backgroundMusic.loop = true;
  backgroundMusic.volume = .28;

  function unlockAudio() {
    if (state.audioReady || state.audioLoading) return state.audioLoading;
    state.audioLoading = (async () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioContext = state.audioContext || new AudioContextClass();
        state.audioContext = audioContext;
        if (audioContext.state === "suspended") await audioContext.resume();
        const entries = Object.entries(soundFiles);
        await Promise.all(entries.map(async ([key, file]) => {
          if (state.soundBuffers[key]) return;
          const response = await fetch(`${sfxBase}/${file}`, { cache: "force-cache" });
          if (!response.ok) throw new Error(`SFX ${file} failed: ${response.status}`);
          const bytes = await response.arrayBuffer();
          state.soundBuffers[key] = await audioContext.decodeAudioData(bytes.slice(0));
        }));
        state.audioReady = true;
      } catch {
        state.audioReady = false;
      }
    })();
    try {
      backgroundMusic.load();
    } catch {
      // Background audio is optional.
    }
    return state.audioLoading;
  }

  function playSound(name, volume = null) {
    const buffer = state.soundBuffers[name];
    const audioContext = state.audioContext;
    if (!buffer || !audioContext || audioContext.state === "closed") return;
    const now = performance.now();
    const minGap = name === "small" ? 55 : name === "medium" ? 70 : name === "large" ? 90 : name === "huge" ? 125 : 35;
    if (now - (state.soundLastAt[name] || 0) < minGap) return;
    state.soundLastAt[name] = now;
    try {
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      gain.gain.value = volume ?? (name.startsWith("countdown") ? .72 : .82);
      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start();
    } catch {
      // Audio failures must never block gameplay.
    }
  }

  function startBackgroundMusic() {
    try {
      backgroundMusic.currentTime = 0;
      backgroundMusic.play().catch(() => {});
    } catch {
      // Background audio is optional.
    }
  }

  function stopBackgroundMusic() {
    try {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    } catch {
      // Ignore optional audio teardown failures.
    }
  }

  function randomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanName(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function playerColor(mark) {
    return {
      A: "#7ee58b",
      B: "#ffd451",
      C: "#62d8ff",
      D: "#ff8fcd",
      P1: "#7ee58b",
      P2: "#ffd451",
    }[String(mark || "A")] || "#f7fff0";
  }

  function spawnForMark(mark) {
    return {
      A: { x: 420, y: 420 },
      B: { x: world.width - 420, y: world.height - 420 },
      C: { x: world.width - 420, y: 420 },
      D: { x: 420, y: world.height - 420 },
    }[String(mark || "A")] || { x: 420, y: 420 };
  }

  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
      return { id: saved.id || randomId(), name: cleanName(saved.name) || "Player" };
    } catch {
      return { id: randomId(), name: "Player" };
    }
  }

  function rng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function environmentForSeed(seed) {
    return environments[Math.abs(Number(seed || 0)) % environments.length] || environments[0];
  }

  function resize() {
    state.dpr = Math.min(2, window.devicePixelRatio || 1);
    state.width = Math.max(1, window.innerWidth);
    state.height = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function rankFor(radius) {
    return ranks.reduce((best, rank) => (radius >= rank.min ? rank : best), ranks[0]);
  }

  function createPlayer(options = {}) {
    return {
      id: options.id || state.profile.id,
      name: options.name || state.profile.name,
      mark: options.mark || "A",
      isLocal: options.isLocal !== false,
      isCpu: Boolean(options.isCpu),
      x: options.x ?? 420,
      y: options.y ?? 420,
      vx: 0,
      vy: 0,
      radius: 24,
      targetRadius: 24,
      score: 0,
      combo: 0,
      maxCombo: 0,
      comboUntil: 0,
      swallowed: 0,
      lastRank: "Pothole",
      alive: true,
      pulse: 0,
      color: options.color || "#7ee58b",
      respawnUntil: 0,
      aiTargetId: "",
    };
  }

  function makeObject(id, type, tier, x, y, radius, rotation = 0) {
    const config = tiers.find((item) => item.name === tier);
    const fixedFacing = new Set([
      "cone", "trash", "chair", "cooler", "lantern", "campfire", "backpack", "picnic", "campTable", "sign", "mailbox", "tent", "stove", "barrel",
      "hydrant", "parkingMeter", "streetlight", "trafficLight", "busStop", "newspaperBox", "bench", "dumpster", "roadBarrier",
      "cabin", "building", "lodge", "skyscraper", "parkingGarage", "storefront", "underseaBase", "bioDome", "alienTemple", "hiveTower",
      "pump", "watertower", "giantsign", "billboard", "portal", "wormholeGate",
    ]);
    return {
      id,
      type,
      tier,
      x,
      y,
      radius,
      width: radius * (1.55 + (id % 5) * .08),
      height: radius * (1.05 + (id % 3) * .1),
      rotation: fixedFacing.has(type) ? 0 : rotation,
      visualScale: tier === "small" ? 1.28 : tier === "medium" ? 1.18 : tier === "large" ? 1.1 : 1.04,
      scoreValue: Math.round(config.score * (radius / config.min)),
      growthValue: config.growth * (radius / config.min),
      swallowed: false,
      swallowProgress: 0,
      swallowStartX: x,
      swallowStartY: y,
      swallowTurns: 1.1 + (id % 5) * .28,
      swallowDir: id % 2 ? 1 : -1,
      reject: 0,
    };
  }

  function generateWorld(seed = state.seed) {
    const rand = rng(seed);
    state.environment = environmentForSeed(seed);
    const objects = [];
    let id = 1;
    const add = (tier, count, zones = null) => {
      const config = tiers.find((item) => item.name === tier);
      const names = state.environment.catalog[tier];
      for (let i = 0; i < count; i += 1) {
        const zone = zones ? zones[Math.floor(rand() * zones.length)] : null;
        const x = zone ? zone.x + rand() * zone.w : 120 + rand() * (world.width - 240);
        const y = zone ? zone.y + rand() * zone.h : 120 + rand() * (world.height - 240);
        const radius = config.min + rand() * (config.max - config.min);
        const type = names[Math.floor(rand() * names.length)];
        objects.push(makeObject(id, type, tier, x, y, radius, rand() * Math.PI * 2));
        id += 1;
      }
    };
    const starterZones = [
      { x: 210, y: 210, w: 680, h: 430 },
      { x: 280, y: 680, w: 520, h: 380 },
    ];
    add("small", 105, starterZones);
    add("small", 120);
    add("medium", 88);
    add("large", 54);
    add("huge", 25);
    state.objects = objects;
  }

  async function startSolo() {
    const audioLoad = unlockAudio();
    await Promise.race([
      audioLoad || Promise.resolve(),
      new Promise((resolve) => window.setTimeout(resolve, 450)),
    ]);
    playSound("ui");
    stopRemotePoll();
    state.matchMode = "solo";
    state.battleVariant = "objects";
    state.opponents = [];
    state.mode = "countdown";
    state.seed = Date.now() & 0xfffffff;
    state.player = createPlayer();
    state.particles = [];
    state.scoreRecorded = false;
    generateWorld(state.seed);
    hidePanels();
    startBackgroundMusic();
    countdown(3);
  }

  async function startCpuBattle() {
    const audioLoad = unlockAudio();
    await Promise.race([
      audioLoad || Promise.resolve(),
      new Promise((resolve) => window.setTimeout(resolve, 450)),
    ]);
    playSound("ui");
    stopRemotePoll();
    state.matchMode = "cpu";
    state.cpuDifficulty = $("cpuDifficulty").value || "medium";
    state.battleVariant = $("cpuVariant").value || "objects";
    state.mode = "countdown";
    state.seed = Date.now() & 0xfffffff;
    state.player = createPlayer({ mark: "A", color: "#7ee58b", x: 420, y: 420 });
    state.opponents = [
      createPlayer({ id: `cpu-${state.cpuDifficulty}`, name: `CPU ${state.cpuDifficulty}`, mark: "B", isLocal: false, isCpu: true, color: "#ffd451", x: world.width - 420, y: world.height - 420 }),
    ];
    state.particles = [];
    state.scoreRecorded = false;
    generateWorld(state.seed);
    hidePanels();
    startBackgroundMusic();
    countdown(3);
  }

  function countdown(value) {
    $("countdownScreen").hidden = false;
    $("countdownScreen").textContent = value > 0 ? String(value) : "Go";
    if (value < 0) {
      $("countdownScreen").hidden = true;
      state.mode = "playing";
      state.startAt = performance.now();
      state.last = state.startAt;
      requestAnimationFrame(loop);
      return;
    }
    playSound(value > 0 ? "countdownTick" : "countdownGo");
    window.setTimeout(() => countdown(value - 1), value === 0 ? 450 : 650);
  }

  function hidePanels() {
    ["startScreen", "howScreen", "multiplayerScreen", "cpuScreen", "endScreen"].forEach((id) => { $(id).hidden = true; });
  }

  function showStart() {
    state.mode = "menu";
    hidePanels();
    $("startScreen").hidden = false;
  }

  function showHow() {
    unlockAudio();
    playSound("ui");
    hidePanels();
    $("howScreen").hidden = false;
  }

  function showMultiplayer() {
    unlockAudio();
    playSound("ui");
    hidePanels();
    $("multiplayerScreen").hidden = false;
    refreshOpenGames();
  }

  function showCpu() {
    unlockAudio();
    playSound("ui");
    hidePanels();
    $("cpuScreen").hidden = false;
  }

  async function mobileGamesApi(payload = {}) {
    const response = await fetch("/mobile-games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
  }

  function playerPayload() {
    return { playerId: state.profile.id, playerName: state.profile.name };
  }

  async function refreshOpenGames() {
    const target = $("openGames");
    if (!target) return;
    target.innerHTML = '<div class="sh-open-game"><div><strong>Loading games...</strong><span>Checking the local lobby.</span></div></div>';
    try {
      const data = await mobileGamesApi({ action: "status", ...playerPayload() });
      const games = (data.games || []).filter((game) => game.type === "sinkhole-city" && game.status !== "complete");
      if (!games.length) {
        target.innerHTML = '<div class="sh-open-game"><div><strong>No open games.</strong><span>Create one from this screen.</span></div></div>';
        return;
      }
      target.replaceChildren(...games.map((game) => {
        const row = document.createElement("div");
        row.className = "sh-open-game";
        const names = (game.players || []).map((player) => player.name || player.mark).join(", ") || "Waiting";
        const variant = game.payload?.variant === "swallow" ? "PvP swallow" : "object battle";
        row.innerHTML = `<div><strong>${escapeHtml(variant)}</strong><span>${escapeHtml(names)}</span></div>`;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = game.status === "waiting" ? "Join" : "Watch";
        button.addEventListener("click", () => joinRemoteGame(game.id));
        row.append(button);
        return row;
      }));
    } catch (error) {
      target.innerHTML = `<div class="sh-open-game"><div><strong>Lobby error</strong><span>${escapeHtml(error.message || error)}</span></div></div>`;
    }
  }

  async function createRemoteGame() {
    unlockAudio();
    playSound("ui");
    const data = await mobileGamesApi({ action: "create", game: "sinkhole-city", variant: $("multiVariant").value || "objects", ...playerPayload() });
    await enterRemoteGame(data.game, data.mark || "A");
  }

  async function joinRemoteGame(gameId) {
    unlockAudio();
    playSound("ui");
    const data = await mobileGamesApi({ action: "join", gameId, ...playerPayload() });
    await enterRemoteGame(data.game, data.mark || "");
  }

  async function enterRemoteGame(game, mark) {
    if (!game) return;
    stopRemotePoll();
    state.matchMode = "remote";
    state.remoteGameId = game.id;
    state.remoteMark = mark || "A";
    state.battleVariant = game.payload?.variant || "objects";
    state.seed = Number(game.payload?.seed || Date.now()) & 0xfffffff;
    state.player = createPlayer({ mark: state.remoteMark || "A", color: playerColor(state.remoteMark || "A"), x: spawnForMark(state.remoteMark || "A").x, y: spawnForMark(state.remoteMark || "A").y });
    state.opponents = [];
    state.particles = [];
    state.scoreRecorded = false;
    generateWorld(state.seed);
    hidePanels();
    if (state.remoteMark === "A" && game.status === "waiting") {
      await mobileGamesApi({ action: "move", gameId: state.remoteGameId, sinkholeAction: "start", ...playerPayload() });
    }
    startBackgroundMusic();
    state.mode = "playing";
    state.startAt = performance.now();
    state.last = state.startAt;
    state.remotePoll = window.setInterval(pollRemoteState, 500);
    requestAnimationFrame(loop);
  }

  function stopRemotePoll() {
    if (state.remotePoll) window.clearInterval(state.remotePoll);
    state.remotePoll = null;
    state.remoteGameId = "";
    state.remoteMark = "";
  }

  async function pollRemoteState() {
    if (!state.remoteGameId) return;
    try {
      await publishRemoteSnapshot(false);
      const data = await mobileGamesApi({ action: "state", gameId: state.remoteGameId, ...playerPayload() });
      const game = data.game;
      const payload = game?.payload || {};
      if (!payload) return;
      applyRemoteEaten(payload.eaten || {});
      const players = game.players || [];
      const states = payload.states || {};
      state.opponents = players
        .filter((player) => player.mark !== state.remoteMark)
        .map((player) => remoteActor(player, states[player.mark]))
        .filter(Boolean);
      if (game.status === "complete" && state.mode !== "ended") endGame();
    } catch {
      // Multiplayer polling should not break local play.
    }
  }

  function remoteActor(player, snapshot) {
    const fallback = spawnForMark(player.mark || "B");
    return {
      id: player.id || player.mark,
      name: player.name || player.mark || "Player",
      mark: player.mark || "B",
      isLocal: false,
      isCpu: false,
      x: Number(snapshot?.x ?? fallback.x),
      y: Number(snapshot?.y ?? fallback.y),
      vx: 0,
      vy: 0,
      radius: Number(snapshot?.radius ?? 24),
      targetRadius: Number(snapshot?.radius ?? 24),
      score: Number(snapshot?.score ?? 0),
      combo: 0,
      maxCombo: Number(snapshot?.maxCombo ?? 0),
      swallowed: Number(snapshot?.swallowed ?? 0),
      lastRank: rankFor(Number(snapshot?.radius ?? 24)).label,
      color: playerColor(player.mark || "B"),
      alive: true,
      pulse: 0,
    };
  }

  function applyRemoteEaten(eaten) {
    const ids = new Set(Object.keys(eaten || {}));
    if (!ids.size) return;
    for (const obj of state.objects) {
      if (!obj.swallowed && ids.has(String(obj.id))) {
        obj.swallowed = true;
        obj.swallowProgress = 1;
      }
    }
  }

  async function publishRemoteSnapshot(force) {
    if (state.matchMode !== "remote" || !state.remoteGameId || !state.player) return;
    const now = performance.now();
    if (!force && now < state.remotePublishAt) return;
    state.remotePublishAt = now + 260;
    const eaten = state.objects
      .filter((obj) => obj.swallowedBy === state.remoteMark && !state.remoteEatenPublished.has(obj.id))
      .map((obj) => {
        state.remoteEatenPublished.add(obj.id);
        return obj.id;
      });
    const p = state.player;
    await mobileGamesApi({
      action: "move",
      gameId: state.remoteGameId,
      sinkholeAction: force && state.mode === "ended" ? "complete" : "snapshot",
      stateJson: JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y), radius: Math.round(p.radius), score: p.score, swallowed: p.swallowed, maxCombo: p.maxCombo }),
      eatenJson: JSON.stringify(eaten),
      ...playerPayload(),
    });
  }

  function togglePause() {
    if (state.mode === "playing") {
      playSound("ui", .55);
      state.mode = "paused";
      state.pausedAt = performance.now();
      $("pauseButton").textContent = "▶";
      backgroundMusic.pause();
      return;
    }
    if (state.mode === "paused") {
      unlockAudio();
      playSound("ui", .55);
      const delta = performance.now() - state.pausedAt;
      state.startAt += delta;
      state.last = performance.now();
      state.mode = "playing";
      $("pauseButton").textContent = "Ⅱ";
      backgroundMusic.play().catch(() => {});
      requestAnimationFrame(loop);
    }
  }

  function elapsed(now = performance.now()) {
    return Math.max(0, now - state.startAt);
  }

  function timeLeft(now = performance.now()) {
    return Math.max(0, durationMs - elapsed(now));
  }

  function formatTime(ms) {
    const total = Math.ceil(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function loop(now) {
    if (state.mode !== "playing") {
      render(now || performance.now());
      return;
    }
    const dt = Math.min(.034, Math.max(.001, (now - state.last) / 1000 || .016));
    state.last = now;
    update(dt, now);
    render(now);
    if (timeLeft(now) <= 0) return endGame();
    if (state.battleVariant === "objects" && state.objects.length === 0) return endGame("cleared");
    requestAnimationFrame(loop);
  }

  function inputVector() {
    let x = state.input.x;
    let y = state.input.y;
    if (state.input.keys.has("arrowleft") || state.input.keys.has("a")) x -= 1;
    if (state.input.keys.has("arrowright") || state.input.keys.has("d")) x += 1;
    if (state.input.keys.has("arrowup") || state.input.keys.has("w")) y -= 1;
    if (state.input.keys.has("arrowdown") || state.input.keys.has("s")) y += 1;
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  function update(dt, now) {
    const p = state.player;
    updateActor(p, inputVector(), dt, now);
    for (const opponent of state.opponents) {
      if (opponent.isCpu) updateActor(opponent, cpuInput(opponent, now), dt, now);
      else {
        opponent.radius += (opponent.targetRadius - opponent.radius) * Math.min(1, dt * 5);
        opponent.pulse = (opponent.pulse || 0) + dt * 4;
      }
    }

    for (const obj of state.objects) {
      if (obj.swallowed) {
        obj.swallowProgress += dt * 5.6;
        continue;
      }
      obj.reject = Math.max(0, obj.reject - dt * 3);
      for (const actor of actors()) {
        const dx = obj.x - actor.x;
        const dy = obj.y - actor.y;
        const dist = Math.hypot(dx, dy);
        const canEat = obj.radius <= actor.radius * .78;
        const overlap = dist < Math.max(12, actor.radius * .78);
        if (overlap && canEat) {
          eatObject(actor, obj, now);
          break;
        } else if (overlap && !canEat && actor.isLocal) {
          obj.reject = 1;
        }
      }
    }
    if (state.battleVariant === "swallow") updatePlayerSwallows(now);
    state.objects = state.objects.filter((obj) => obj.swallowProgress < 1);
    updateParticles(dt);
    state.camera.x += (p.x - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (p.y - state.camera.y) * Math.min(1, dt * 5);
    state.camera.shake = Math.max(0, state.camera.shake - dt * 9);
    updateHud(now);
  }

  function actors() {
    return [state.player, ...state.opponents].filter(Boolean);
  }

  function updateActor(actor, input, dt, now) {
    if (!actor || now < (actor.respawnUntil || 0)) return;
    const profile = actor.isCpu ? cpuProfiles[state.cpuDifficulty] || cpuProfiles.medium : null;
    const speed = Math.max(actor.isCpu ? 145 : 170, 300 - actor.radius * 1.25) * (profile?.speedScale || 1);
    actor.vx += (input.x * speed - actor.vx) * Math.min(1, dt * 8);
    actor.vy += (input.y * speed - actor.vy) * Math.min(1, dt * 8);
    actor.x = Math.max(0, Math.min(world.width, actor.x + actor.vx * dt));
    actor.y = Math.max(0, Math.min(world.height, actor.y + actor.vy * dt));
    actor.radius += (actor.targetRadius - actor.radius) * Math.min(1, dt * 5);
    const currentRank = rankFor(actor.radius).label;
    if (currentRank !== actor.lastRank) {
      actor.lastRank = currentRank;
      if (actor.isLocal) playSound("grow");
    }
    actor.pulse += dt * 4;
    if (now > actor.comboUntil) actor.combo = 0;
  }

  function cpuInput(cpu, now) {
    const profile = cpuProfiles[state.cpuDifficulty] || cpuProfiles.medium;
    const player = state.player;
    if (state.battleVariant === "swallow" && player) {
      const distToPlayer = Math.hypot(player.x - cpu.x, player.y - cpu.y);
      if (player.radius > cpu.radius * profile.fleeRatio && distToPlayer < profile.fleeRange) {
        cpu.cpuTarget = null;
        cpu.cpuNextThinkAt = now + profile.reactionMs;
        return normalize(cpu.x - player.x, cpu.y - player.y);
      }
      if (cpu.radius > player.radius * profile.chaseRatio && distToPlayer < profile.chaseRange) {
        cpu.cpuTarget = null;
        cpu.cpuNextThinkAt = now + profile.reactionMs;
        return normalize(player.x - cpu.x, player.y - cpu.y);
      }
    }
    if (!cpu.cpuTarget || cpu.cpuTarget.swallowed || now >= (cpu.cpuNextThinkAt || 0)) {
      cpu.cpuTarget = chooseCpuTarget(cpu, profile);
      cpu.cpuNextThinkAt = now + profile.reactionMs;
    }
    if (!cpu.cpuTarget) {
      if (!cpu.cpuWanderUntil || now >= cpu.cpuWanderUntil) {
        const angle = now / profile.wanderMs + (cpu.mark || "B").charCodeAt(0);
        cpu.cpuWander = { x: Math.cos(angle), y: Math.sin(angle * .7) };
        cpu.cpuWanderUntil = now + profile.wanderMs;
      }
      return cpu.cpuWander || { x: 0, y: 0 };
    }
    return normalize(cpu.cpuTarget.x - cpu.x, cpu.cpuTarget.y - cpu.y);
  }

  function chooseCpuTarget(cpu, profile) {
    const candidates = [];
    for (const obj of state.objects) {
      if (obj.swallowed || obj.radius > cpu.radius * profile.edibleMargin) continue;
      const dist = Math.hypot(obj.x - cpu.x, obj.y - cpu.y);
      if (dist > profile.vision) continue;
      const value = obj.scoreValue + obj.growthValue * 42 + obj.radius * profile.largeBias;
      const travelCost = dist / Math.max(1, 300 - cpu.radius * 1.25);
      const score = state.cpuDifficulty === "hard"
        ? value / Math.max(.28, travelCost)
        : dist - value * profile.largeBias;
      candidates.push({ obj, score, dist });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => state.cpuDifficulty === "hard" ? b.score - a.score : a.score - b.score);
    const limit = Math.min(profile.targetLimit, candidates.length);
    const pool = candidates.slice(0, limit);
    if (profile.mistakeRate > 0 && Math.random() < profile.mistakeRate) {
      return pool[Math.floor(Math.random() * pool.length)]?.obj || candidates[0].obj;
    }
    return candidates[0].obj;
  }

  function normalize(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function updatePlayerSwallows(now) {
    const list = actors();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (now < (a.respawnUntil || 0) || now < (b.respawnUntil || 0)) continue;
        const radiusDelta = a.radius - b.radius;
      if (Math.abs(radiusDelta) <= 0.01) continue;
        const winner = radiusDelta > 0 ? a : b;
        const loser = radiusDelta > 0 ? b : a;
        const dist = Math.hypot(loser.x - winner.x, loser.y - winner.y);
        if (dist < Math.max(18, winner.radius * .62)) {
          swallowActor(winner, loser, now);
        }
      }
    }
  }

  function swallowActor(actor, other, now) {
    actor.score += Math.round(350 + other.score * .08);
    actor.targetRadius = Math.min(118, actor.targetRadius + Math.max(2, other.radius * .05));
    actor.swallowed += 1;
    if (actor.isLocal) {
      playSound("huge");
      state.camera.shake = 8;
    }
    respawnActor(other, now);
  }

  function respawnActor(actor, now) {
    const spot = spawnForMark(actor.mark);
    actor.x = spot.x;
    actor.y = spot.y;
    actor.vx = 0;
    actor.vy = 0;
    actor.radius = Math.max(20, actor.radius * .72);
    actor.targetRadius = actor.radius;
    actor.respawnUntil = now + 900;
  }

  function eatObject(actor, obj, now) {
    obj.swallowed = true;
    obj.swallowedBy = actor.mark || "A";
    obj.swallowTarget = actor;
    obj.swallowStartX = obj.x;
    obj.swallowStartY = obj.y;
    obj.swallowProgress = 0;
    actor.combo = now < actor.comboUntil ? actor.combo + 1 : 1;
    actor.maxCombo = Math.max(actor.maxCombo, actor.combo);
    actor.comboUntil = now + 1400;
    const comboBonus = Math.max(0, actor.combo - 1) * 8;
    actor.score += obj.scoreValue + comboBonus;
    actor.targetRadius = Math.min(118, actor.targetRadius + obj.growthValue);
    actor.swallowed += 1;
    if (actor.isLocal) playSound(obj.tier);
    if (actor.isLocal && (obj.tier === "large" || obj.tier === "huge")) state.camera.shake = obj.tier === "huge" ? 7 : 4;
    burstParticles(obj.x, obj.y, obj.tier);
  }

  function burstParticles(x, y, tier) {
    const count = tier === "huge" ? 18 : tier === "large" ? 13 : 8;
    const colors = ["#7ee58b", "#ffd451", "#62d8ff", "#ffffff"];
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 170;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: .55 + Math.random() * .35,
        max: .9,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 5,
      });
    }
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= .92;
      particle.vy *= .92;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function updateHud(now = performance.now()) {
    const p = state.player || createPlayer();
    $("timeText").textContent = formatTime(timeLeft(now));
    $("scoreText").textContent = String(p.score);
    $("sizeText").textContent = rankFor(p.radius).label;
    $("comboText").hidden = p.combo < 2 || now > p.comboUntil;
    if (!$("comboText").hidden) $("comboText").textContent = `Combo x${p.combo}`;
  }

  function endGame(reason = "timer") {
    if (state.mode === "ended") return;
    state.mode = "ended";
    stopBackgroundMusic();
    playSound("gameOver");
    const p = state.player;
    const standings = actors().sort((a, b) => (b.score || 0) - (a.score || 0));
    const winner = standings[0] || p;
    const rank = rankFor(p.radius).label;
    $("endRank").textContent = reason === "cleared"
      ? "Board cleared"
      : winner === p ? `${rank} wins` : `${winner.name || winner.mark} wins`;
    $("finalScore").textContent = String(p.score);
    $("finalSize").textContent = `${Math.round(p.radius)}`;
    $("finalEaten").textContent = String(p.swallowed);
    $("scoreCompare").innerHTML = "<strong>High Scores</strong><span>Loading rankings...</span>";
    $("endScreen").hidden = false;
    localStorage.setItem(storageKey, String(Math.max(state.best, p.score)));
    publishRemoteSnapshot(true).finally(stopRemotePoll);
    recordScore();
  }

  async function recordScore() {
    if (state.scoreRecorded || !state.player) return;
    state.scoreRecorded = true;
    const p = state.player;
    try {
      const response = await fetch("/game-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record-sinkhole-city",
          title: "Sinkhole City",
          matchId: `sinkhole-${state.seed}`,
          playerId: state.profile.id,
          playerName: state.profile.name,
          score: p.score,
          players: actors().map((actor) => ({
            id: actor.id || actor.mark,
            name: actor.name || actor.mark || "Player",
            mark: actor.mark || "",
            score: Math.round(actor.score || 0),
          })),
          winner: (actors().sort((a, b) => (b.score || 0) - (a.score || 0))[0] || p).name || "",
          winnerId: (actors().sort((a, b) => (b.score || 0) - (a.score || 0))[0] || p).id || "",
          radius: Math.round(p.radius),
          swallowed: p.swallowed,
          maxCombo: p.maxCombo,
          rank: rankFor(p.radius).label,
          duration: 120,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `Score failed: ${response.status}`);
      $("scoreMessage").textContent = "Score recorded.";
      renderScoreComparison(data.scoreboard, p.score);
    } catch (error) {
      $("scoreMessage").textContent = error.message || "Score could not be recorded.";
      loadScoreComparison(p.score);
    }
  }

  async function loadScoreComparison(finalScore) {
    try {
      const response = await fetch("/game-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scoreboard" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `Scoreboard failed: ${response.status}`);
      renderScoreComparison(data.scoreboard, finalScore);
    } catch (error) {
      $("scoreCompare").innerHTML = `<strong>High Scores</strong><span>${escapeHtml(error.message || "Scores unavailable.")}</span>`;
    }
  }

  function renderScoreComparison(scoreboard, finalScore) {
    const rows = scoreboard?.games?.["sinkhole-city"] || [];
    const playerId = state.profile.id;
    const currentIndex = rows.findIndex((row) => row.id === playerId || row.name === state.profile.name);
    const preview = rows.slice(0, 5);
    const placement = currentIndex >= 0 ? `You are #${currentIndex + 1} for Sinkhole City.` : `This score would place around #${scorePlacement(rows, finalScore)}.`;
    $("scoreCompare").innerHTML = `
      <strong>High Scores</strong>
      <span>${escapeHtml(placement)}</span>
      <ol>
        ${preview.length ? preview.map((row, index) => `
          <li class="${index === currentIndex ? "current" : ""}">${escapeHtml(row.name || "Player")} · ${Number(row.highScore || row.totalScore || 0)} best</li>
        `).join("") : `<li class="current">${escapeHtml(state.profile.name)} · ${Number(finalScore || 0)} best</li>`}
      </ol>
    `;
  }

  function scorePlacement(rows, score) {
    const value = Number(score || 0);
    const index = (rows || []).findIndex((row) => value > Number(row.highScore || 0));
    return index >= 0 ? index + 1 : (rows || []).length + 1;
  }

  function render(now = performance.now()) {
    const shake = state.camera.shake ? (Math.random() - .5) * state.camera.shake : 0;
    const camX = Math.max(state.width / 2, Math.min(world.width - state.width / 2, state.camera.x || 420));
    const camY = Math.max(state.height / 2, Math.min(world.height - state.height / 2, state.camera.y || 420));
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.save();
    ctx.translate(state.width / 2 - camX + shake, state.height / 2 - camY - shake);
    drawTown();
    drawObjects(now, false);
    drawParticles();
    drawPlayers(now);
    drawObjects(now, true);
    ctx.restore();
    if (state.mode === "paused") drawPaused();
  }

  function drawTown() {
    const env = state.environment?.id || "campsite";
    if (env === "city") return drawCityWorld();
    if (env === "space") return drawSpaceWorld();
    if (env === "underwater") return drawUnderwaterWorld();
    if (env === "alien") return drawAlienWorld();
    drawCampsiteWorld();
  }

  function drawCampsiteWorld() {
    ctx.fillStyle = "#b9d5b3";
    ctx.fillRect(0, 0, world.width, world.height);
    drawSoftBlobs("#9fd69b", 9, 240, 230, 285, 410);
    ctx.strokeStyle = "#f3f2df";
    ctx.lineWidth = 46;
    ctx.lineCap = "round";
    drawRoads();
    ctx.strokeStyle = "#f6a231";
    ctx.lineWidth = 8;
    drawRoads();
    drawRiver("rgba(33, 136, 232, .55)", 34);
    drawGrid("rgba(4, 63, 40, .22)", 160);
  }

  function drawCityWorld() {
    ctx.fillStyle = "#87938c";
    ctx.fillRect(0, 0, world.width, world.height);
    drawGrid("rgba(28, 35, 33, .35)", 130);
    ctx.strokeStyle = "#2d3432";
    ctx.lineWidth = 72;
    drawRoads();
    ctx.strokeStyle = "#f5f1de";
    ctx.lineWidth = 54;
    drawRoads();
    ctx.strokeStyle = "#f6a231";
    ctx.lineWidth = 5;
    drawRoads();
    ctx.fillStyle = "rgba(55, 63, 60, .42)";
    for (let y = 170; y < world.height; y += 310) {
      for (let x = 210; x < world.width; x += 360) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((x + y) % 9 - 4) * .03);
        rect("#737d75", 120 + (x % 5) * 15, 88 + (y % 4) * 18, true);
        ctx.restore();
      }
    }
  }

  function drawSpaceWorld() {
    const grd = ctx.createRadialGradient(world.width * .55, world.height * .45, 140, world.width * .5, world.height * .5, world.width);
    grd.addColorStop(0, "#182a4b");
    grd.addColorStop(.55, "#071126");
    grd.addColorStop(1, "#01030a");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, world.width, world.height);
    ctx.fillStyle = "rgba(255,255,255,.8)";
    for (let i = 0; i < 170; i += 1) {
      const x = (i * 419) % world.width;
      const y = (i * 233) % world.height;
      ctx.globalAlpha = .28 + (i % 7) * .09;
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(117, 210, 255, .18)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.ellipse(620 + i * 310, 820, 560 + i * 80, 110 + i * 12, -.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawUnderwaterWorld() {
    const grd = ctx.createLinearGradient(0, 0, 0, world.height);
    grd.addColorStop(0, "#43bdd0");
    grd.addColorStop(.55, "#146c7d");
    grd.addColorStop(1, "#073442");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, world.width, world.height);
    drawRiver("rgba(173, 245, 255, .20)", 70);
    ctx.strokeStyle = "rgba(199, 248, 236, .18)";
    ctx.lineWidth = 4;
    for (let y = 160; y < world.height; y += 220) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= world.width; x += 260) ctx.quadraticCurveTo(x + 110, y - 55, x + 260, y);
      ctx.stroke();
    }
    drawSoftBlobs("rgba(37, 131, 93, .55)", 12, 180, 1360, 245, -230);
  }

  function drawAlienWorld() {
    const grd = ctx.createLinearGradient(0, 0, world.width, world.height);
    grd.addColorStop(0, "#47265f");
    grd.addColorStop(.45, "#214c52");
    grd.addColorStop(1, "#473f16");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, world.width, world.height);
    drawSoftBlobs("rgba(126, 229, 139, .22)", 11, 260, 280, 280, 330);
    drawSoftBlobs("rgba(255, 116, 216, .16)", 9, 350, 1440, 260, -260);
    ctx.strokeStyle = "rgba(255, 212, 81, .16)";
    ctx.lineWidth = 5;
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.moveTo(120 + i * 270, 0);
      ctx.bezierCurveTo(240 + i * 220, 430, 10 + i * 280, 920, 240 + i * 260, world.height);
      ctx.stroke();
    }
    drawGrid("rgba(255,255,255,.06)", 180);
  }

  function drawSoftBlobs(fill, count, startX, startY, stepX, stepY) {
    ctx.fillStyle = fill;
    for (let i = 0; i < count; i += 1) {
      ctx.beginPath();
      ctx.ellipse(startX + i * stepX, startY + (i % 3) * stepY, 170, 90, .25 + i * .03, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRiver(stroke, width) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(140, 1500);
    ctx.bezierCurveTo(590, 1320, 720, 980, 1180, 930);
    ctx.bezierCurveTo(1630, 880, 1740, 460, 2450, 360);
    ctx.stroke();
  }

  function drawGrid(stroke, size) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    for (let x = 0; x <= world.width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, world.height);
      ctx.stroke();
    }
    for (let y = 0; y <= world.height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(world.width, y);
      ctx.stroke();
    }
  }

  function drawRoads() {
    ctx.beginPath();
    ctx.moveTo(120, 340);
    ctx.lineTo(900, 340);
    ctx.lineTo(1180, 620);
    ctx.lineTo(2220, 620);
    ctx.moveTo(460, 120);
    ctx.lineTo(460, 1540);
    ctx.moveTo(1180, 120);
    ctx.lineTo(1020, 740);
    ctx.lineTo(1050, 1660);
    ctx.moveTo(180, 1110);
    ctx.lineTo(860, 990);
    ctx.lineTo(1580, 1180);
    ctx.lineTo(2450, 1100);
    ctx.moveTo(1600, 190);
    ctx.lineTo(1660, 760);
    ctx.lineTo(2140, 1550);
    ctx.stroke();
  }

  function drawObjects(now, swallowedOnly = false) {
    const items = [...state.objects].sort((a, b) => a.y - b.y);
    for (const obj of items) {
      if (swallowedOnly !== Boolean(obj.swallowed)) continue;
      const p = state.player;
      const canEat = p && obj.radius <= p.radius * .78;
      ctx.save();
      if (obj.swallowed) {
        const t = obj.swallowProgress;
        const target = obj.swallowTarget || p;
        const eased = 1 - Math.pow(1 - Math.min(1, t), 2.2);
        const sx = obj.swallowStartX ?? obj.x;
        const sy = obj.swallowStartY ?? obj.y;
        const dx = sx - target.x;
        const dy = sy - target.y;
        const dist = Math.hypot(dx, dy);
        const baseAngle = Math.atan2(dy, dx);
        const spin = obj.swallowDir * obj.swallowTurns * Math.PI * 2 * eased;
        const orbit = dist * (1 - eased);
        const x = target.x + Math.cos(baseAngle + spin) * orbit;
        const y = target.y + Math.sin(baseAngle + spin) * orbit;
        drawSwallowTrail(target.x, target.y, sx, sy, baseAngle, dist, obj, eased);
        ctx.translate(x, y);
        ctx.rotate(obj.rotation + obj.swallowDir * t * 13);
        const scale = Math.max(0, Math.pow(1 - t, 1.35));
        ctx.scale(scale, scale);
      } else {
        const bounce = obj.reject ? Math.sin(now / 35) * obj.reject * 3 : 0;
        ctx.translate(obj.x, obj.y + bounce);
        ctx.rotate(obj.rotation);
      }
      ctx.scale(obj.visualScale || 1, obj.visualScale || 1);
      drawObjectShape(obj);
      if (!canEat && obj.reject > 0) {
        ctx.strokeStyle = `rgba(255, 90, 90, ${obj.reject})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, obj.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawSwallowTrail(targetX, targetY, startX, startY, baseAngle, dist, obj, eased) {
    if (eased <= .04 || dist < 16) return;
    ctx.save();
    ctx.lineWidth = Math.max(2, obj.radius * .13);
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(126, 229, 139, ${Math.max(0, .28 * (1 - eased))})`;
    ctx.beginPath();
    for (let i = 0; i <= 8; i += 1) {
      const k = i / 8;
      const localEase = Math.max(0, eased - k * .055);
      const spin = obj.swallowDir * obj.swallowTurns * Math.PI * 2 * localEase;
      const orbit = dist * (1 - localEase);
      const x = targetX + Math.cos(baseAngle + spin) * orbit;
      const y = targetY + Math.sin(baseAngle + spin) * orbit;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 212, 81, ${Math.max(0, .45 * (1 - eased))})`;
    for (let i = 2; i <= 8; i += 3) {
      const k = i / 8;
      const localEase = Math.max(0, eased - k * .055);
      const spin = obj.swallowDir * obj.swallowTurns * Math.PI * 2 * localEase;
      const orbit = dist * (1 - localEase);
      ctx.beginPath();
      ctx.arc(targetX + Math.cos(baseAngle + spin) * orbit, targetY + Math.sin(baseAngle + spin) * orbit, Math.max(1.5, obj.radius * .08), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawObjectShape(obj) {
    const r = obj.radius;
    ctx.lineWidth = Math.max(2, r * .12);
    ctx.strokeStyle = "rgba(0,0,0,.28)";
    if (["rock", "boulder", "alienRock", "starRock", "asteroid", "largeAsteroid", "meteor"].includes(obj.type)) return blob(obj.type.includes("Asteroid") || obj.type === "meteor" ? "#786d7f" : "#7d8171", r);
    if (["cone", "trafficCone"].includes(obj.type)) return cone(r);
    if (obj.type === "trash" || obj.type === "barrel") return can(obj.type === "barrel" ? "#9d5e32" : "#56645c", r);
    if (["shrub", "tree", "alienShrub", "alienTree", "kelpForest", "seaweed"].includes(obj.type)) return shrub(obj.type.includes("Tree") || obj.type === "tree" || obj.type === "kelpForest" ? r * 1.2 : r);
    if (obj.type === "chair") return rect("#3ba7d8", r * 1.4, r, true);
    if (obj.type === "cooler") return rect("#59c7df", r * 1.5, r, true);
    if (obj.type === "lantern") return lantern(r);
    if (["campfire"].includes(obj.type)) return campfire(r);
    if (["backpack"].includes(obj.type)) return backpack(r);
    if (["picnic", "campTable"].includes(obj.type)) return picnic(r);
    if (["sign", "giantsign", "billboard", "roadBarrier"].includes(obj.type)) return sign(r, ["giantsign", "billboard"].includes(obj.type));
    if (obj.type === "mailbox") return rect("#4c7be8", r * 1.5, r, true);
    if (obj.type === "tent") return tent(r);
    if (obj.type === "bike") return bike(r);
    if (obj.type === "scooter") return scooter(r);
    if (obj.type === "stove") return rect("#30383a", r * 1.6, r, true);
    if (["car", "foodtruck", "jeep", "taxi", "van", "bus", "utilityTruck"].includes(obj.type)) return vehicleColor(obj.type, r);
    if (obj.type === "trailer" || obj.type === "rv") return vehicle("#e9e4d4", r * 1.2, obj.type);
    if (["cabin", "building", "lodge", "skyscraper", "parkingGarage", "storefront", "underseaBase", "bioDome", "alienTemple", "hiveTower"].includes(obj.type)) return buildingForType(obj.type, r);
    if (obj.type === "outhouse") return rect("#7b573d", r * 1.1, r * 1.5, true);
    if (obj.type === "pump") return pump(r);
    if (["hydrant", "parkingMeter", "streetlight", "trafficLight", "busStop", "newspaperBox", "bench", "dumpster"].includes(obj.type)) return streetFixture(obj.type, r);
    if (obj.type === "watertower") return waterTower(r);
    if (obj.type === "bridge") return bridge(r);
    if (["fish", "shark", "whale", "dolphin"].includes(obj.type)) return fishShape(obj.type, r);
    if (["coral", "jellyfish", "turtle", "ray", "anchor", "treasureChest", "reef", "shipwreck", "octopus", "giantSquid", "sunkenShip", "seaStack", "shell", "starfish", "urchin", "bubbleCluster", "crab"].includes(obj.type)) return seaObject(obj.type, r);
    if (["satellite", "probe", "capsule", "lander", "spaceBuoy", "spaceship", "xwing", "shuttle", "stationModule", "spaceStation", "enterprise", "deathstar", "planet", "smallPlanet", "moon", "moonBuggy", "spaceDebris", "comet", "wormholeGate"].includes(obj.type)) return spaceObject(obj.type, r);
    if (["crystal", "crystalCluster", "megaCrystal", "spore", "glowPod", "crawler", "crawlerQueen", "tinyUfo", "ufo", "hoverDrone", "tentacleBud", "mushroomTower", "eggSac", "plasmaVent", "walker", "monolith", "mothership", "leviathan", "portal"].includes(obj.type)) return alienObject(obj.type, r);
    rect("#d9bb84", r * 1.6, r * 1.1, true);
  }

  function vehicleColor(type, r) {
    const fill = {
      foodtruck: "#ffcf54",
      jeep: "#526d3f",
      taxi: "#ffd451",
      van: "#9aa7b6",
      bus: "#e89b30",
      utilityTruck: "#e9e4d4",
    }[type] || "#d85b4c";
    vehicle(fill, type === "bus" || type === "foodtruck" ? r * 1.16 : r, type);
    if (type === "jeep") {
      ctx.strokeStyle = "#1f2d1b";
      ctx.beginPath();
      ctx.arc(-r * .74, -r * .52, r * .18, 0, Math.PI * 2);
      ctx.arc(r * .74, -r * .52, r * .18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function buildingForType(type, r) {
    if (type === "skyscraper") {
      rect("#88939c", r * 1.25, r * 2.7, true);
      ctx.fillStyle = "#cce6ff";
      for (let y = -1; y <= 1; y += 1) {
        ctx.fillRect(-r * .28, y * r * .55, r * .18, r * .22);
        ctx.fillRect(r * .1, y * r * .55, r * .18, r * .22);
      }
      return;
    }
    if (type === "bioDome" || type === "underseaBase") {
      ctx.fillStyle = type === "bioDome" ? "#7ee58b" : "#7ed8e5";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.25, r, 0, Math.PI, 0);
      ctx.lineTo(r * 1.2, r * .75);
      ctx.lineTo(-r * 1.2, r * .75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    if (type === "alienTemple" || type === "hiveTower") {
      ctx.fillStyle = type === "hiveTower" ? "#8f5fe8" : "#5cd3bd";
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.25);
      ctx.lineTo(r * 1.25, r);
      ctx.lineTo(-r * 1.25, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    building(type === "building" || type === "lodge" || type === "parkingGarage" ? r * 1.25 : r);
  }

  function streetFixture(type, r) {
    if (type === "hydrant") return hydrant(r);
    if (type === "parkingMeter") return parkingMeter(r);
    if (type === "streetlight") return streetlight(r);
    if (type === "trafficLight") return trafficLight(r);
    if (type === "dumpster") return rect("#466c55", r * 1.9, r * 1.05, true);
    if (type === "bench") return picnic(r * .8);
    if (type === "busStop") return sign(r, false);
    rect("#386a96", r * 1.5, r, true);
  }

  function campfire(r) {
    ctx.fillStyle = "#714320";
    ctx.fillRect(-r * .75, r * .45, r * 1.5, r * .22);
    ctx.fillStyle = "#ff7f2a";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * .8, -r * .2, r * .35, r * .5, 0, r * .55);
    ctx.bezierCurveTo(-r * .7, r * .12, -r * .45, -r * .45, 0, -r);
    ctx.fill();
    ctx.fillStyle = "#ffd451";
    ctx.beginPath();
    ctx.moveTo(0, -r * .55);
    ctx.lineTo(r * .28, r * .35);
    ctx.lineTo(-r * .28, r * .35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function backpack(r) {
    rect("#7157d8", r * 1.1, r * 1.35, true);
    ctx.strokeStyle = "#f4f1dc";
    ctx.beginPath();
    ctx.arc(0, -r * .42, r * .35, Math.PI, 0);
    ctx.moveTo(-r * .35, r * .1);
    ctx.lineTo(r * .35, r * .1);
    ctx.stroke();
  }

  function hydrant(r) {
    rect("#d9362e", r * .72, r * 1.25, true);
    ctx.fillStyle = "#d9362e";
    ctx.beginPath();
    ctx.arc(0, -r * .7, r * .38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-r * .62, -r * .18, r * 1.24, r * .28);
  }

  function parkingMeter(r) {
    ctx.strokeStyle = "#26331f";
    ctx.lineWidth = Math.max(2, r * .18);
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(0, -r * .25);
    ctx.stroke();
    ctx.fillStyle = "#bec7c1";
    ctx.beginPath();
    ctx.arc(0, -r * .55, r * .48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#26331f";
    ctx.fillRect(-r * .08, -r * .74, r * .16, r * .35);
  }

  function streetlight(r) {
    ctx.strokeStyle = "#26331f";
    ctx.lineWidth = Math.max(2, r * .16);
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(0, -r * 1.05);
    ctx.quadraticCurveTo(r * .55, -r * 1.05, r * .65, -r * .62);
    ctx.stroke();
    ctx.fillStyle = "#ffd451";
    ctx.beginPath();
    ctx.arc(r * .65, -r * .55, r * .2, 0, Math.PI * 2);
    ctx.fill();
  }

  function trafficLight(r) {
    rect("#26331f", r * .58, r * 1.55, true);
    ["#ff5d5d", "#ffd451", "#7ee58b"].forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -r * .48 + index * r * .48, r * .16, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function scooter(r) {
    ctx.strokeStyle = "#26331f";
    ctx.lineWidth = Math.max(2, r * .15);
    ctx.beginPath();
    ctx.arc(-r * .45, r * .5, r * .22, 0, Math.PI * 2);
    ctx.arc(r * .55, r * .5, r * .22, 0, Math.PI * 2);
    ctx.moveTo(-r * .45, r * .35);
    ctx.lineTo(r * .35, r * .35);
    ctx.lineTo(r * .2, -r * .65);
    ctx.stroke();
  }

  function fishShape(type, r) {
    const fill = { shark: "#7f8f99", whale: "#536c85", dolphin: "#6aa6bd" }[type] || "#ff9c42";
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * .52, 0, 0, Math.PI * 2);
    ctx.moveTo(-r * 1.05, 0);
    ctx.lineTo(-r * 1.65, -r * .55);
    ctx.lineTo(-r * 1.45, 0);
    ctx.lineTo(-r * 1.65, r * .55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#eef";
    ctx.beginPath();
    ctx.arc(r * .55, -r * .12, r * .11, 0, Math.PI * 2);
    ctx.fill();
    if (type === "shark") {
      ctx.fillStyle = "#dfe8ec";
      ctx.beginPath();
      ctx.moveTo(0, -r * .45);
      ctx.lineTo(r * .25, -r * 1.0);
      ctx.lineTo(r * .45, -r * .35);
      ctx.fill();
    }
  }

  function seaObject(type, r) {
    if (type === "coral" || type === "reef") {
      ctx.strokeStyle = "#ff7f9a";
      ctx.lineWidth = Math.max(3, r * .18);
      ctx.beginPath();
      for (let i = -2; i <= 2; i += 1) {
        ctx.moveTo(0, r);
        ctx.quadraticCurveTo(i * r * .25, 0, i * r * .42, -r * (.55 + Math.abs(i) * .12));
      }
      ctx.stroke();
      return;
    }
    if (type === "jellyfish") {
      ctx.fillStyle = "rgba(229, 151, 255, .78)";
      ctx.beginPath();
      ctx.ellipse(0, -r * .25, r, r * .62, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#e597ff";
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * r * .25, r * .15);
        ctx.quadraticCurveTo(i * r * .42, r * .65, i * r * .12, r * 1.1);
        ctx.stroke();
      }
      return;
    }
    if (type === "turtle") return turtle(r);
    if (type === "ray") return ray(r);
    if (type === "anchor") return anchor(r);
    if (type === "treasureChest") return rect("#8b5e32", r * 1.6, r, true);
    if (type === "octopus" || type === "giantSquid") return octopus(r);
    if (type === "shipwreck" || type === "sunkenShip") return vehicle("#7b573d", r * 1.2, "wreck");
    if (type === "starfish") return starShape("#f39a54", r, 5);
    if (type === "shell") return shell(r);
    if (type === "crab") return crab(r);
    if (type === "bubbleCluster") return bubbles(r);
    blob("#7ed8e5", r);
  }

  function spaceObject(type, r) {
    if (type === "satellite" || type === "probe") {
      rect("#c9cfd4", r, r * .65, true);
      ctx.fillStyle = "#4169e1";
      ctx.fillRect(-r * 1.7, -r * .28, r * 1.0, r * .56);
      ctx.fillRect(r * .7, -r * .28, r * 1.0, r * .56);
      ctx.strokeRect(-r * 1.7, -r * .28, r * 1.0, r * .56);
      ctx.strokeRect(r * .7, -r * .28, r * 1.0, r * .56);
      return;
    }
    if (["spaceship", "shuttle", "enterprise", "xwing", "mothership"].includes(type)) return spaceship(type, r);
    if (type === "deathstar") return deathStar(r);
    if (["planet", "smallPlanet", "moon"].includes(type)) return planet(type, r);
    if (type === "comet") {
      blob("#86c7ff", r);
      ctx.strokeStyle = "rgba(134,199,255,.45)";
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(-r * 3, -r * .65);
      ctx.moveTo(-r, 0);
      ctx.lineTo(-r * 3, r * .65);
      ctx.stroke();
      return;
    }
    if (type === "wormholeGate") return portalShape(r);
    if (type === "moonBuggy") return vehicle("#d5d7d9", r * .8, "buggy");
    rect("#9aa7b6", r * 1.5, r, true);
  }

  function alienObject(type, r) {
    if (["crystal", "crystalCluster", "megaCrystal"].includes(type)) return crystal(type, r);
    if (["tinyUfo", "ufo", "hoverDrone"].includes(type)) return ufo(r);
    if (type === "portal") return portalShape(r);
    if (type === "mushroomTower") return mushroom(r);
    if (type === "walker" || type === "crawler" || type === "crawlerQueen" || type === "leviathan") return alienCreature(type, r);
    if (type === "monolith") return rect("#2b2736", r, r * 2.2, true);
    if (type === "plasmaVent") return campfire(r);
    if (type === "eggSac" || type === "spore" || type === "glowPod") return blob(type === "glowPod" ? "#9effd0" : "#d7a3ff", r);
    blob("#9effd0", r);
  }

  function turtle(r) {
    ctx.fillStyle = "#5aa55d";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * .9, r * .65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#79c984";
    for (const [x, y] of [[1, 0], [-.85, -.45], [-.85, .45], [.15, -.75], [.15, .75]]) {
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, r * .24, r * .18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function ray(r) {
    ctx.fillStyle = "#6c8190";
    ctx.beginPath();
    ctx.moveTo(r * 1.25, 0);
    ctx.quadraticCurveTo(0, -r * 1.1, -r * 1.1, 0);
    ctx.quadraticCurveTo(0, r * 1.1, r * 1.25, 0);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * .9, 0);
    ctx.lineTo(-r * 1.8, r * .18);
    ctx.stroke();
  }

  function anchor(r) {
    ctx.strokeStyle = "#27343c";
    ctx.lineWidth = Math.max(2, r * .18);
    ctx.beginPath();
    ctx.arc(0, -r * .8, r * .22, 0, Math.PI * 2);
    ctx.moveTo(0, -r * .55);
    ctx.lineTo(0, r * .55);
    ctx.moveTo(-r * .7, -r * .08);
    ctx.lineTo(r * .7, -r * .08);
    ctx.moveTo(-r * .85, r * .15);
    ctx.quadraticCurveTo(-r * .55, r * .9, 0, r * .9);
    ctx.quadraticCurveTo(r * .55, r * .9, r * .85, r * .15);
    ctx.stroke();
  }

  function octopus(r) {
    ctx.fillStyle = "#a66ce0";
    ctx.beginPath();
    ctx.ellipse(0, -r * .25, r * .82, r * .9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#a66ce0";
    ctx.lineWidth = Math.max(2, r * .16);
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * r * .18, r * .35);
      ctx.quadraticCurveTo(i * r * .35, r * .8, i * r * .55, r * 1.05);
      ctx.stroke();
    }
  }

  function shell(r) {
    ctx.fillStyle = "#f0d6b4";
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * .78, 0, Math.PI, 0);
    ctx.lineTo(r, r * .55);
    ctx.lineTo(-r, r * .55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#b08b69";
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, -r * .72);
      ctx.lineTo(i * r * .35, r * .52);
      ctx.stroke();
    }
  }

  function crab(r) {
    ctx.fillStyle = "#e95b48";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * .8, r * .55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#e95b48";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * .75, -r * .15);
      ctx.lineTo(side * r * 1.25, -r * .55);
      ctx.moveTo(side * r * .75, r * .15);
      ctx.lineTo(side * r * 1.25, r * .55);
      ctx.stroke();
    }
  }

  function bubbles(r) {
    ctx.strokeStyle = "rgba(218, 250, 255, .75)";
    ctx.lineWidth = Math.max(1.5, r * .09);
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc((i - 2) * r * .28, Math.sin(i) * r * .35, r * (.16 + i * .035), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function spaceship(type, r) {
    if (type === "xwing") {
      ctx.fillStyle = "#e7e9ec";
      rect("#e7e9ec", r * 1.7, r * .45, true);
      ctx.strokeStyle = "#d85b4c";
      ctx.beginPath();
      ctx.moveTo(-r * .2, 0);
      ctx.lineTo(-r * 1.2, -r);
      ctx.moveTo(-r * .2, 0);
      ctx.lineTo(-r * 1.2, r);
      ctx.moveTo(r * .2, 0);
      ctx.lineTo(r * 1.2, -r);
      ctx.moveTo(r * .2, 0);
      ctx.lineTo(r * 1.2, r);
      ctx.stroke();
      return;
    }
    if (type === "enterprise") {
      ctx.fillStyle = "#d9dde2";
      ctx.beginPath();
      ctx.ellipse(-r * .45, 0, r * .78, r * .5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      rect("#d9dde2", r * 1.45, r * .28, true);
      ctx.fillStyle = "#d9dde2";
      ctx.fillRect(r * .35, -r * .8, r * .75, r * .22);
      ctx.fillRect(r * .35, r * .58, r * .75, r * .22);
      ctx.strokeRect(r * .35, -r * .8, r * .75, r * .22);
      ctx.strokeRect(r * .35, r * .58, r * .75, r * .22);
      return;
    }
    ctx.fillStyle = type === "mothership" ? "#8f5fe8" : "#c9cfd4";
    ctx.beginPath();
    ctx.moveTo(r * 1.35, 0);
    ctx.lineTo(-r * .85, -r * .7);
    ctx.lineTo(-r * .45, 0);
    ctx.lineTo(-r * .85, r * .7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#62d8ff";
    ctx.fillRect(-r * .25, -r * .18, r * .55, r * .36);
  }

  function deathStar(r) {
    ctx.fillStyle = "#a9adb2";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#70757b";
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.arc(r * .35, -r * .35, r * .23, 0, Math.PI * 2);
    ctx.stroke();
  }

  function planet(type, r) {
    ctx.fillStyle = type === "moon" ? "#c7c1b2" : "#68b88c";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (type !== "moon") {
      ctx.strokeStyle = "rgba(255, 212, 81, .75)";
      ctx.lineWidth = Math.max(2, r * .12);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.45, r * .36, .22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function portalShape(r) {
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeStyle = `rgba(${126 + i * 24}, ${229 - i * 20}, 255, ${.75 - i * .12})`;
      ctx.lineWidth = Math.max(2, r * (.16 - i * .02));
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (1.05 - i * .14), r * (.78 - i * .09), i * .42, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function crystal(type, r) {
    ctx.fillStyle = type === "megaCrystal" ? "#62d8ff" : "#9f7cff";
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.2);
    ctx.lineTo(r * .72, -r * .2);
    ctx.lineTo(r * .45, r);
    ctx.lineTo(-r * .45, r);
    ctx.lineTo(-r * .72, -r * .2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (type !== "crystal") {
      ctx.save();
      ctx.translate(r * .72, r * .2);
      ctx.scale(.65, .65);
      crystal("crystal", r);
      ctx.restore();
    }
  }

  function ufo(r) {
    ctx.fillStyle = "#a9adb2";
    ctx.beginPath();
    ctx.ellipse(0, r * .1, r * 1.35, r * .42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(126, 229, 255, .82)";
    ctx.beginPath();
    ctx.ellipse(0, -r * .35, r * .62, r * .48, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
  }

  function mushroom(r) {
    ctx.fillStyle = "#ff74d8";
    ctx.beginPath();
    ctx.ellipse(0, -r * .38, r, r * .55, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    rect("#a7ffd5", r * .48, r * 1.15, true);
  }

  function alienCreature(type, r) {
    ctx.fillStyle = type === "leviathan" ? "#3bd6b0" : "#8f5fe8";
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * .62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd451";
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(i * r * .35, -r * .18, r * .12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = ctx.fillStyle;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * .65, r * .25);
      ctx.lineTo(side * r * 1.2, r * .82);
      ctx.stroke();
    }
  }

  function starShape(fill, r, points = 5) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const rr = i % 2 ? r * .45 : r;
      const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function rect(fill, w, h, stroke = false) {
    ctx.fillStyle = fill;
    roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * .18);
    ctx.fill();
    if (stroke) ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function blob(fill, r) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const rr = r * (.74 + (i % 5) * .045 + Math.sin(i * 1.7) * .055);
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = Math.max(1, r * .08);
    ctx.beginPath();
    ctx.moveTo(-r * .35, -r * .22);
    ctx.quadraticCurveTo(0, -r * .52, r * .38, -r * .18);
    ctx.stroke();
  }

  function cone(r) {
    ctx.fillStyle = "#ff8a21";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * .75, r);
    ctx.lineTo(-r * .75, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#f4f1dc";
    ctx.lineWidth = Math.max(1.5, r * .12);
    for (const y of [-.25, .35]) {
      ctx.beginPath();
      ctx.moveTo(-r * (.32 + y * .18), r * y);
      ctx.lineTo(r * (.32 + y * .18), r * y);
      ctx.stroke();
    }
    ctx.fillStyle = "#222";
    ctx.fillRect(-r * .9, r * .88, r * 1.8, r * .18);
  }

  function can(fill, r) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(0, -r * .55, r * .7, r * .28, 0, 0, Math.PI * 2);
    ctx.rect(-r * .7, -r * .55, r * 1.4, r * 1.2);
    ctx.ellipse(0, r * .65, r * .7, r * .28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = Math.max(1, r * .07);
    ctx.beginPath();
    ctx.moveTo(-r * .45, -r * .1);
    ctx.lineTo(r * .45, -r * .1);
    ctx.moveTo(-r * .45, r * .3);
    ctx.lineTo(r * .45, r * .3);
    ctx.stroke();
  }

  function shrub(r) {
    ctx.fillStyle = "#4fae58";
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.arc(Math.cos(i * 1.7) * r * .38, Math.sin(i * 2.3) * r * .32, r * (.28 + (i % 3) * .055), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(21, 76, 28, .75)";
    ctx.lineWidth = Math.max(1, r * .08);
    ctx.stroke();
  }

  function lantern(r) {
    rect("#ffd451", r, r * 1.2, true);
    ctx.strokeStyle = "#26331f";
    ctx.beginPath();
    ctx.arc(0, -r * .55, r * .45, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillRect(-r * .22, -r * .18, r * .44, r * .52);
    ctx.strokeRect(-r * .22, -r * .18, r * .44, r * .52);
  }

  function picnic(r) {
    rect("#8b5e32", r * 2, r * .45, true);
    ctx.fillStyle = "#67401f";
    ctx.fillRect(-r * .9, r * .35, r * 1.8, r * .25);
    ctx.strokeStyle = "#4b2f18";
    ctx.lineWidth = Math.max(1.5, r * .1);
    ctx.beginPath();
    ctx.moveTo(-r * .7, r * .58);
    ctx.lineTo(-r * 1.0, r * 1.05);
    ctx.moveTo(r * .7, r * .58);
    ctx.lineTo(r * 1.0, r * 1.05);
    ctx.moveTo(-r * .7, -r * .15);
    ctx.lineTo(r * .7, -r * .15);
    ctx.stroke();
  }

  function sign(r, giant = false) {
    rect(giant ? "#ffd451" : "#f4f1dc", r * 2, r * .9, true);
    ctx.strokeStyle = giant ? "#7a4b19" : "#4b5f50";
    ctx.lineWidth = Math.max(1.5, r * .09);
    ctx.beginPath();
    ctx.moveTo(-r * .7, -r * .12);
    ctx.lineTo(r * .7, -r * .12);
    ctx.moveTo(-r * .55, r * .18);
    ctx.lineTo(r * .55, r * .18);
    ctx.stroke();
    ctx.strokeStyle = "#5b4632";
    ctx.beginPath();
    ctx.moveTo(0, r * .45);
    ctx.lineTo(0, r * (giant ? 1.6 : 1.25));
    ctx.stroke();
  }

  function tent(r) {
    ctx.fillStyle = "#8f7ce8";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 1.2, r);
    ctx.lineTo(-r * 1.2, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.moveTo(-r * .48, r * .2);
    ctx.lineTo(0, -r * .25);
    ctx.lineTo(r * .48, r * .2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(38,51,31,.45)";
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, r);
    ctx.lineTo(-r * 1.45, r * 1.25);
    ctx.moveTo(r * 1.2, r);
    ctx.lineTo(r * 1.45, r * 1.25);
    ctx.stroke();
  }

  function bike(r) {
    ctx.strokeStyle = "#26331f";
    ctx.lineWidth = Math.max(2, r * .16);
    ctx.beginPath();
    ctx.arc(-r * .55, r * .35, r * .34, 0, Math.PI * 2);
    ctx.arc(r * .55, r * .35, r * .34, 0, Math.PI * 2);
    ctx.moveTo(-r * .55, r * .35);
    ctx.lineTo(0, -r * .25);
    ctx.lineTo(r * .55, r * .35);
    ctx.lineTo(-r * .05, r * .35);
    ctx.closePath();
    ctx.moveTo(0, -r * .25);
    ctx.lineTo(r * .18, -r * .62);
    ctx.moveTo(r * .18, -r * .62);
    ctx.lineTo(r * .55, -r * .62);
    ctx.moveTo(-r * .05, -r * .1);
    ctx.lineTo(-r * .34, -r * .32);
    ctx.stroke();
  }

  function vehicle(fill, r, type = "car") {
    const long = ["bus", "foodtruck", "rv", "trailer", "wreck"].includes(type);
    rect(fill, r * (long ? 2.85 : 2.25), r * 1.18, true);
    ctx.fillStyle = "rgba(220,245,255,.72)";
    const windowCount = long ? 4 : 2;
    for (let i = 0; i < windowCount; i += 1) {
      const x = -r * (long ? 1.05 : .55) + i * r * .55;
      ctx.fillRect(x, -r * .48, r * .38, r * .32);
      ctx.strokeRect(x, -r * .48, r * .38, r * .32);
    }
    ctx.fillStyle = "#1a1d1b";
    for (const x of [-(long ? 1.05 : .8), long ? .85 : .45]) {
      ctx.beginPath();
      ctx.arc(x * r, r * .61, r * .22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#c9cfd4";
      ctx.beginPath();
      ctx.arc(x * r, r * .61, r * .09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1d1b";
    }
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.fillRect(r * .78, -r * .12, r * .2, r * .24);
    ctx.fillStyle = "rgba(255,212,81,.7)";
    ctx.fillRect(r * (long ? 1.23 : .94), r * .16, r * .16, r * .14);
  }

  function building(r) {
    rect("#c9bda8", r * 2.2, r * 1.65, true);
    ctx.fillStyle = "#e8dfcb";
    for (let y = -1; y <= 1; y += 1) {
      for (let x = -1; x <= 1; x += 1) {
        ctx.fillRect(x * r * .5 - r * .12, y * r * .38 - r * .1, r * .24, r * .2);
        ctx.strokeRect(x * r * .5 - r * .12, y * r * .38 - r * .1, r * .24, r * .2);
      }
    }
    ctx.fillStyle = "#73543a";
    ctx.fillRect(-r * .12, r * .44, r * .24, r * .38);
  }

  function pump(r) {
    rect("#e95b48", r, r * 1.6, true);
    ctx.fillStyle = "#f4f1dc";
    ctx.fillRect(-r * .25, -r * .45, r * .5, r * .38);
    ctx.strokeStyle = "#26331f";
    ctx.beginPath();
    ctx.moveTo(r * .45, -r * .28);
    ctx.quadraticCurveTo(r * 1.05, -r * .05, r * .72, r * .55);
    ctx.stroke();
  }

  function waterTower(r) {
    ctx.fillStyle = "#65b8cc";
    ctx.beginPath();
    ctx.ellipse(0, -r * .45, r, r * .62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * .55, r * .2);
    ctx.lineTo(-r * .85, r * 1.3);
    ctx.moveTo(r * .55, r * .2);
    ctx.lineTo(r * .85, r * 1.3);
    ctx.stroke();
  }

  function bridge(r) {
    rect("#8d8070", r * 2.8, r * .8, true);
    ctx.strokeStyle = "#f3f2df";
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, -r * .35);
    ctx.lineTo(r * 1.2, r * .35);
    ctx.moveTo(-r * 1.2, r * .35);
    ctx.lineTo(r * 1.2, -r * .35);
    ctx.stroke();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayers(now) {
    for (const actor of [...state.opponents, state.player].filter(Boolean)) drawPlayer(actor, now);
  }

  function drawPlayer(p, now) {
    const respawning = now < (p.respawnUntil || 0);
    const wobble = Math.sin((now || 0) / 180 + (p.mark || "").charCodeAt(0)) * 1.5;
    const r = Math.max(8, p.radius + wobble) * (respawning ? .72 + Math.sin(now / 80) * .08 : 1);
    const grd = ctx.createRadialGradient(p.x, p.y, r * .15, p.x, p.y, r * 1.15);
    grd.addColorStop(0, "#000000");
    grd.addColorStop(.58, "#020503");
    grd.addColorStop(.72, "#17261c");
    grd.addColorStop(.84, p.color || "#7ee58b");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(247,255,240,.28)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * .92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "900 15px Trebuchet MS";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,.72)";
    ctx.fillStyle = p.color || "#f7fff0";
    const label = `${p.name || p.mark} ${p.score || 0}`;
    ctx.strokeText(label, p.x, p.y - r - 12);
    ctx.fillText(label, p.x, p.y - r - 12);
    ctx.restore();
  }

  function drawPaused() {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#f7fff0";
    ctx.textAlign = "center";
    ctx.font = "900 64px Trebuchet MS";
    ctx.fillText("Paused", state.width / 2, state.height / 2);
  }

  function pointerDown(event) {
    if (state.mode !== "playing") return;
    state.input.pointerId = event.pointerId;
    state.input.originX = event.clientX;
    state.input.originY = event.clientY;
    $("joystick").hidden = false;
    $("joystick").style.left = `${event.clientX}px`;
    $("joystick").style.top = `${event.clientY}px`;
    pointerMove(event);
    canvas.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (state.input.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.input.originX;
    const dy = event.clientY - state.input.originY;
    const max = 48;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(max, len);
    state.input.x = (dx / len) * (clamped / max);
    state.input.y = (dy / len) * (clamped / max);
    $("joystickKnob").style.transform = `translate(${(dx / len) * clamped}px, ${(dy / len) * clamped}px)`;
  }

  function pointerUp(event) {
    if (state.input.pointerId !== event.pointerId) return;
    state.input.pointerId = null;
    state.input.x = 0;
    state.input.y = 0;
    $("joystickKnob").style.transform = "";
    $("joystick").hidden = true;
  }

  function bind() {
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.mode === "playing") togglePause();
    });
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d", " "].includes(key)) event.preventDefault();
      if (key === " " || key === "escape") return togglePause();
      state.input.keys.add(key);
    });
    document.addEventListener("keyup", (event) => state.input.keys.delete(event.key.toLowerCase()));
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    $("soloButton").addEventListener("click", startSolo);
    $("cpuButton").addEventListener("click", showCpu);
    $("startCpuButton").addEventListener("click", startCpuBattle);
    $("cpuBackButton").addEventListener("click", () => { playSound("ui"); showStart(); });
    $("againButton").addEventListener("click", () => { playSound("ui"); showStart(); });
    $("howButton").addEventListener("click", showHow);
    $("howBackButton").addEventListener("click", () => { playSound("ui"); showStart(); });
    $("multiButton").addEventListener("click", showMultiplayer);
    $("createMultiButton").addEventListener("click", () => createRemoteGame().catch((error) => {
      $("openGames").innerHTML = `<div class="sh-open-game"><div><strong>Create failed</strong><span>${escapeHtml(error.message || error)}</span></div></div>`;
    }));
    $("refreshMultiButton").addEventListener("click", refreshOpenGames);
    $("multiBackButton").addEventListener("click", () => { playSound("ui"); showStart(); });
    $("pauseButton").addEventListener("click", () => { unlockAudio(); togglePause(); });
  }

  function init() {
    resize();
    generateWorld();
    state.player = createPlayer();
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    bind();
    updateHud();
    render();
  }

  init();
})();
