(() => {
  const bestKey = "oiab-canyon-crawler-best";
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const state = {
    app: null,
    root: null,
    running: false,
    paused: false,
    width: 0,
    height: 0,
    score: 0,
    level: 1,
    lives: 3,
    mode: "solo",
    player: null,
    bullets: [],
    obstacles: [],
    crawlers: [],
    enemies: [],
    particles: [],
    keys: new Set(),
    autoFireTimer: 0,
    fireCooldown: 0,
    enemyTimer: 0,
    messageTimer: 0,
    audio: null,
  };

  function profile() {
    const saved = window.OIABPlayers?.get?.() || {};
    return { id: saved.id || "", name: saved.name || "Player" };
  }

  function show(el, visible) {
    if (el) el.hidden = !visible;
  }

  function audioContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!state.audio) state.audio = new AudioCtor();
    return state.audio;
  }

  function unlockAudio() {
    const ctx = audioContext();
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
  }

  function tone(frequency, duration = 0.1, type = "sine", gain = 0.04, endFrequency = null) {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    vol.gain.setValueAtTime(gain, now);
    vol.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(vol).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function noise(duration = 0.14, gain = 0.05, frequency = 700, type = "bandpass") {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const samples = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const vol = ctx.createGain();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, now);
    filter.Q.setValueAtTime(1.2, now);
    vol.gain.setValueAtTime(gain, now);
    vol.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.buffer = buffer;
    src.connect(filter).connect(vol).connect(ctx.destination);
    src.start(now);
  }

  function soundShoot() {
    tone(760, 0.045, "square", 0.022, 380);
  }

  function soundCrawlerHit(head = false) {
    tone(head ? 260 : 340, 0.08, "sawtooth", head ? 0.045 : 0.032, head ? 90 : 150);
    noise(head ? 0.16 : 0.08, head ? 0.05 : 0.03, head ? 420 : 660);
  }

  function soundEnemyHit(type) {
    const freq = type === "spider" ? 520 : type === "scorpion" ? 210 : 720;
    tone(freq, 0.1, type === "flea" ? "triangle" : "sawtooth", 0.038, freq * 0.55);
  }

  function soundObstacleHit(destroyed = false) {
    noise(destroyed ? 0.15 : 0.075, destroyed ? 0.045 : 0.025, destroyed ? 310 : 520, "lowpass");
  }

  function soundEggDrop() {
    tone(920, 0.055, "triangle", 0.026, 520);
    setTimeout(() => tone(420, 0.05, "sine", 0.018, 300), 45);
  }

  function soundLevelUp() {
    [390, 520, 780].forEach((freq, i) => setTimeout(() => tone(freq, 0.12, "triangle", 0.04), i * 85));
  }

  function soundDeath() {
    tone(230, 0.15, "sawtooth", 0.045, 95);
    noise(0.18, 0.05, 260, "lowpass");
  }

  function soundGameLoss() {
    [250, 165, 90].forEach((freq, i) => setTimeout(() => tone(freq, 0.2, "sawtooth", 0.045, freq * 0.65), i * 130));
  }

  function hud() {
    $("score").textContent = String(state.score);
    $("level").textContent = String(state.level);
    $("lives").textContent = String(state.lives);
    const remaining = crawlerSegmentsRemaining();
    $("modeText").textContent = state.running ? `${remaining} left` : "Ready";
  }

  function crawlerSegmentsRemaining() {
    return state.crawlers.reduce((total, crawler) => total + (crawler.segments?.length || 0), 0);
  }

  function message(text) {
    $("message").textContent = text;
    show($("message"), true);
    state.messageTimer = 1.8;
  }

  function makeApp() {
    if (state.app) return;
    state.app = new PIXI.Application({
      resizeTo: $("stage"),
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    $("stage").appendChild(state.app.view);
    state.root = new PIXI.Container();
    state.app.stage.addChild(state.root);
    state.app.ticker.add((ticker) => tick(frameSeconds(ticker)));
    resize();
    window.addEventListener("resize", resize);
  }

  function frameSeconds(ticker) {
    const seconds = typeof ticker === "number" ? ticker / 60 : Number(ticker?.deltaMS || 0) / 1000;
    return Number.isFinite(seconds) && seconds > 0 ? Math.min(0.033, seconds) : 1 / 60;
  }

  function resize() {
    state.width = $("stage").clientWidth || window.innerWidth;
    state.height = $("stage").clientHeight || window.innerHeight;
    if (state.player) {
      state.player.x = clamp(state.player.x, 20, state.width - 20);
      state.player.y = clamp(state.player.y, state.height * 0.62, state.height - 36);
    }
  }

  function clearStage() {
    for (const group of [state.bullets, state.obstacles, state.crawlers, state.enemies, state.particles]) {
      for (const item of group) safeDestroy(item.g);
      group.length = 0;
    }
    safeDestroy(state.player?.g);
    state.player = null;
    state.root?.removeChildren();
  }

  function graphicRover() {
    const g = new PIXI.Graphics();
    g.beginFill(0x233f32).drawRoundedRect(-16, -12, 32, 24, 7).endFill();
    g.beginFill(0x7ee58b).drawRoundedRect(-9, -17, 18, 10, 4).endFill();
    g.beginFill(0xffd451).drawCircle(-9, -14, 2.4).drawCircle(9, -14, 2.4).endFill();
    g.beginFill(0x101a14).drawCircle(-11, 11, 4).drawCircle(11, 11, 4).endFill();
    return g;
  }

  function obstacleGraphic(kind, health) {
    const g = new PIXI.Graphics();
    const alpha = 0.56 + health * 0.12;
    if (kind === "cactus") {
      g.lineStyle(4, 0x2d8b4a, alpha).moveTo(0, 12).lineTo(0, -12).moveTo(0, -2).lineTo(-9, -8).moveTo(0, 4).lineTo(9, -3);
    } else if (kind === "cone") {
      g.beginFill(0xff8c2a, alpha).drawPolygon([-10, 12, 0, -13, 10, 12]).endFill();
      g.lineStyle(2, 0xffffff, alpha).moveTo(-5, 2).lineTo(5, 2);
    } else if (kind === "crate") {
      g.lineStyle(3, 0x9b6f36, alpha).beginFill(0x6a4725, alpha).drawRoundedRect(-12, -12, 24, 24, 3).endFill().moveTo(-10, -10).lineTo(10, 10).moveTo(10, -10).lineTo(-10, 10);
    } else {
      g.beginFill(0x8b8a78, alpha).drawEllipse(0, 0, 13, 10).endFill();
      g.lineStyle(2, 0x4f5148, alpha).drawEllipse(0, 0, 13, 10);
    }
    return g;
  }

  function crawlerSegment(color, head = false) {
    const g = new PIXI.Graphics();
    g.beginFill(color).drawCircle(0, 0, head ? 13 : 11).endFill();
    g.lineStyle(2, 0x102016, 0.65).drawCircle(0, 0, head ? 13 : 11);
    if (head) {
      g.beginFill(0xf7fff0).drawCircle(-4, -3, 2.4).drawCircle(4, -3, 2.4).endFill();
      g.lineStyle(2, 0x102016).moveTo(-7, -9).lineTo(-12, -15).moveTo(7, -9).lineTo(12, -15);
    }
    return g;
  }

  function start() {
    unlockAudio();
    makeApp();
    clearStage();
    state.score = 0;
    state.level = 1;
    state.lives = state.mode === "coop" ? 4 : 3;
    state.running = true;
    state.paused = false;
    spawnPlayer();
    spawnLevel();
    hud();
    show($("startPanel"), false);
    show($("endPanel"), false);
    message("Destroy every crawler segment.");
  }

  function spawnPlayer() {
    const g = graphicRover();
    state.root.addChild(g);
    state.player = { g, x: state.width / 2, y: state.height - 54, speed: 390, invuln: 0 };
  }

  function spawnLevel() {
    for (const item of [...state.obstacles, ...state.enemies]) safeDestroy(item.g);
    for (const crawler of state.crawlers) {
      for (const segment of crawler.segments || []) safeDestroy(segment.g);
    }
    state.obstacles = [];
    state.crawlers = [];
    state.enemies = [];
    state.enemyTimer = Math.max(0.75, 1.4 - state.level * 0.05);
    const obstacleCount = Math.min(62, 20 + state.level * 5);
    const kinds = ["cactus", "boulder", "crate", "cone"];
    for (let i = 0; i < obstacleCount; i += 1) {
      const kind = kinds[i % kinds.length];
      const health = kind === "cone" ? 2 : Math.min(6, 3 + Math.floor(state.level / 2));
      const g = obstacleGraphic(kind, health);
      const item = { g, kind, x: rand(32, state.width - 32), y: rand(86, state.height * 0.66), health, r: 15 };
      g.position.set(item.x, item.y);
      state.root.addChild(g);
      state.obstacles.push(item);
    }
    const color = [0x7ee58b, 0xffd451, 0x66d9ef, 0xff8c76, 0xd680ff][(state.level - 1) % 5];
    const count = Math.min(30, 12 + state.level * 2);
    const segments = [];
    const spacing = 25;
    const perRow = Math.max(6, Math.floor((state.width - 76) / spacing));
    for (let i = 0; i < count; i += 1) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, count - row * perRow);
      const rowWidth = (rowCount - 1) * spacing;
      const startX = Math.max(38, (state.width - rowWidth) / 2);
      const head = i === 0;
      const g = crawlerSegment(color, head);
      const seg = { g, x: startX + col * spacing, y: 82 + row * 26, r: head ? 14 : 12, head, color };
      g.position.set(seg.x, seg.y);
      state.root.addChild(g);
      segments.push(seg);
    }
    state.crawlers.push({ segments, dir: 1, verticalDir: 1, speed: 96 + state.level * 13, drop: 24 + Math.min(12, state.level * 1.5) });
  }

  function splitCrawler(crawler, index) {
    const before = crawler.segments.slice(0, index);
    const after = crawler.segments.slice(index + 1);
    safeDestroy(crawler.segments[index].g);
    state.crawlers = state.crawlers.filter((item) => item !== crawler);
    for (const part of [before, after]) {
      if (!part.length) continue;
      part[0].head = true;
      redrawHead(part[0]);
      state.crawlers.push({
        segments: part,
        dir: Math.random() < 0.5 ? -1 : 1,
        verticalDir: crawler.verticalDir || 1,
        speed: crawler.speed + 16,
        drop: crawler.drop,
      });
    }
  }

  function redrawHead(seg) {
    const old = seg.g;
    const color = seg.color || 0x7ee58b;
    seg.g = crawlerSegment(color, true);
    seg.g.position.set(seg.x, seg.y);
    state.root.addChild(seg.g);
    safeDestroy(old);
  }

  function shoot() {
    if (!state.player || state.fireCooldown > 0) return;
    const g = new PIXI.Graphics();
    g.beginFill(0xffd451).drawRoundedRect(-2, -12, 4, 18, 3).endFill();
    const item = { g, x: state.player.x, y: state.player.y - 22, vy: -620, r: 5 };
    g.position.set(item.x, item.y);
    state.root.addChild(g);
    state.bullets.push(item);
    state.fireCooldown = 0.17;
    soundShoot();
  }

  function spawnEnemy() {
    const type = ["spider", "flea", "scorpion"][Math.floor(Math.random() * 3)];
    const g = new PIXI.Graphics();
    if (type === "spider") {
      g.lineStyle(2, 0xffd451).drawCircle(0, 0, 9).moveTo(-8, 4).lineTo(-16, 9).moveTo(8, 4).lineTo(16, 9);
    } else if (type === "flea") {
      g.beginFill(0x66d9ef).drawEllipse(0, 0, 8, 13).endFill();
    } else {
      g.lineStyle(3, 0xff6868).moveTo(-14, 0).lineTo(14, 0).lineTo(20, -8);
    }
    const item = { g, type, x: rand(30, state.width - 30), y: type === "flea" ? -10 : rand(state.height * 0.45, state.height * 0.72), vx: type === "scorpion" ? (Math.random() < 0.5 ? -130 : 130) : rand(-90, 90), vy: type === "flea" ? 160 : rand(-80, 80), r: 14 };
    g.position.set(item.x, item.y);
    state.root.addChild(g);
    state.enemies.push(item);
  }

  function enemyCap() {
    return Math.min(12, 3 + Math.ceil(state.level * 1.15));
  }

  function particles(x, y, color, count = 9) {
    for (let i = 0; i < count; i += 1) {
      const g = new PIXI.Graphics();
      g.beginFill(color).drawCircle(0, 0, rand(2, 4)).endFill();
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 230);
      const p = { g, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.28, 0.55) };
      g.position.set(x, y);
      state.root.addChild(g);
      state.particles.push(p);
    }
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function tick(dt) {
    if (!state.running || state.paused) return;
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) show($("message"), false);
    }
    updatePlayer(dt);
    updateBullets(dt);
    updateCrawlers(dt);
    updateEnemies(dt);
    updateParticles(dt);
    checkLevelClear();
    hud();
  }

  function updatePlayer(dt) {
    const p = state.player;
    if (!p) return;
    let dx = 0;
    let dy = 0;
    if (state.keys.has("ArrowLeft") || state.keys.has("a")) dx -= 1;
    if (state.keys.has("ArrowRight") || state.keys.has("d")) dx += 1;
    if (state.keys.has("ArrowUp") || state.keys.has("w")) dy -= 1;
    if (state.keys.has("ArrowDown") || state.keys.has("s")) dy += 1;
    if (dx || dy) {
      const n = Math.hypot(dx, dy) || 1;
      p.x = clamp(p.x + (dx / n) * p.speed * dt, 18, state.width - 18);
      p.y = clamp(p.y + (dy / n) * p.speed * dt, state.height * 0.58, state.height - 28);
      state.autoFireTimer = 0.18;
    }
    state.autoFireTimer = Math.max(0, state.autoFireTimer - dt);
    if (state.autoFireTimer > 0 || state.keys.has(" ")) shoot();
    p.invuln = Math.max(0, p.invuln - dt);
    p.g.position.set(p.x, p.y);
    p.g.alpha = p.invuln > 0 ? 0.48 + Math.sin(performance.now() / 70) * 0.25 : 1;
  }

  function updateBullets(dt) {
    for (const b of [...state.bullets]) {
      if (b.removed) continue;
      b.y += b.vy * dt;
      b.g.position.set(b.x, b.y);
      if (b.y < -20) {
        removeFrom(state.bullets, b);
        continue;
      }
      for (const o of [...state.obstacles]) {
        if (b.removed) break;
        if (dist(b, o) < b.r + o.r) {
          o.health -= 1;
          soundObstacleHit(o.health <= 0);
          safeDestroy(o.g);
          o.g = obstacleGraphic(o.kind, o.health);
          o.g.position.set(o.x, o.y);
          state.root.addChild(o.g);
          removeFrom(state.bullets, b);
          if (o.health <= 0) {
            state.score += 3;
            particles(o.x, o.y, 0x8b8a78, 6);
            removeFrom(state.obstacles, o);
          }
          break;
        }
      }
      for (const crawler of [...state.crawlers]) {
        if (b.removed) break;
        const idx = crawler.segments.findIndex((seg) => dist(b, seg) < b.r + seg.r);
        if (idx >= 0) {
          const seg = crawler.segments[idx];
          state.score += seg.head ? 50 : 10;
          particles(seg.x, seg.y, 0xffd451, seg.head ? 18 : 10);
          soundCrawlerHit(seg.head);
          removeFrom(state.bullets, b);
          splitCrawler(crawler, idx);
          break;
        }
      }
      for (const e of [...state.enemies]) {
        if (b.removed) break;
        if (dist(b, e) < b.r + e.r) {
          state.score += e.type === "spider" ? 220 : e.type === "scorpion" ? 150 : 90;
          particles(e.x, e.y, 0xff6868, 14);
          soundEnemyHit(e.type);
          removeFrom(state.enemies, e);
          removeFrom(state.bullets, b);
        }
      }
    }
  }

  function updateCrawlers(dt) {
    for (const crawler of state.crawlers) {
      let turn = false;
      const rowHeight = Math.max(20, crawler.drop || 24);
      const bottomY = state.height - 42;
      const upperReboundY = Math.max(76, bottomY - rowHeight * 10);
      for (const seg of crawler.segments) {
        const nx = seg.x + crawler.dir * crawler.speed * dt;
        if (nx < 14 || nx > state.width - 14 || state.obstacles.some((o) => Math.abs(o.x - nx) < 18 && Math.abs(o.y - seg.y) < 18)) {
          turn = true;
          break;
        }
      }
      if (turn) crawler.dir *= -1;
      let verticalBounce = false;
      for (const seg of crawler.segments) {
        seg.x += crawler.dir * crawler.speed * dt;
        if (turn) seg.y += rowHeight * (crawler.verticalDir || 1);
        if (seg.y >= bottomY) {
          seg.y = bottomY;
          crawler.verticalDir = -1;
          verticalBounce = true;
        } else if ((crawler.verticalDir || 1) < 0 && seg.y <= upperReboundY) {
          seg.y = upperReboundY;
          crawler.verticalDir = 1;
          verticalBounce = true;
        }
        seg.g.position.set(seg.x, seg.y);
        if (state.player && seg.y > state.height - 90 && dist(seg, state.player) < seg.r + 14) damage();
      }
      if (verticalBounce) {
        crawler.speed = Math.min(340, crawler.speed * 1.08 + 8);
        crawler.dir *= -1;
        message(crawler.verticalDir < 0 ? "Crawler rebounding." : "Crawler diving.");
      }
    }
  }

  function updateEnemies(dt) {
    state.enemyTimer -= dt;
    if (state.enemyTimer <= 0 && state.enemies.length < enemyCap()) {
      const count = Math.min(enemyCap() - state.enemies.length, 1 + Math.floor(state.level / 3));
      for (let i = 0; i < count; i += 1) spawnEnemy();
      state.enemyTimer = Math.max(0.55, 1.85 - state.level * 0.08);
    }
    for (const e of [...state.enemies]) {
      if (e.removed) continue;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < 10 || e.x > state.width - 10) e.vx *= -1;
      if (e.y > state.height + 20 || e.y < -30) {
        removeFrom(state.enemies, e);
        continue;
      }
      if (!e.g) continue;
      e.g.position.set(e.x, e.y);
      if (state.player && dist(e, state.player) < e.r + 14) damage();
      if (e.type === "flea" && Math.random() < dt * 1.1) {
        const health = Math.min(6, 3 + Math.floor(state.level / 3));
        const g = obstacleGraphic("cactus", health);
        const o = { g, kind: "cactus", x: e.x, y: e.y, health, r: 15 };
        g.position.set(o.x, o.y);
        state.root.addChild(g);
        state.obstacles.push(o);
        soundEggDrop();
      }
    }
  }

  function updateParticles(dt) {
    for (const p of [...state.particles]) {
      if (p.removed) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.g.alpha = clamp(p.life * 2.2, 0, 1);
      p.g.position.set(p.x, p.y);
      if (p.life <= 0) removeFrom(state.particles, p);
    }
  }

  function damage() {
    if (!state.player || state.player.invuln > 0) return;
    state.lives -= 1;
    state.player.invuln = 1.4;
    particles(state.player.x, state.player.y, 0xff6868, 22);
    soundDeath();
    message("Rover hit.");
    if (state.lives <= 0) endGame("Crawler overrun");
  }

  function checkLevelClear() {
    if (state.crawlers.some((c) => c.segments.length)) return;
    state.score += 400 + state.level * 75;
    state.level += 1;
    spawnLevel();
    soundLevelUp();
    message(`Level ${state.level}: ${crawlerSegmentsRemaining()} segments.`);
  }

  function removeFrom(list, item) {
    if (!item || item.removed) return;
    item.removed = true;
    const index = list.indexOf(item);
    if (index >= 0) list.splice(index, 1);
    safeDestroy(item.g);
    item.g = null;
  }

  function safeDestroy(displayObject) {
    if (!displayObject || displayObject.destroyed) return;
    try {
      displayObject.parent?.removeChild?.(displayObject);
      displayObject.destroy();
    } catch {
      // Pixi can throw if an object is destroyed twice in one collision frame.
    }
  }

  async function recordScore() {
    const player = profile();
    try {
      await fetch("/game-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record-canyon-crawler",
          game: "canyon-crawler",
          title: "Canyon Crawler",
          matchId: `canyon-${Date.now()}`,
          playerId: player.id,
          playerName: player.name,
          winnerId: player.id,
          winnerName: player.name,
          score: state.score,
          players: [{ id: player.id, name: player.name, score: state.score }],
          payload: { level: state.level, mode: state.mode },
        }),
      });
    } catch {
      // Offline/local play should never fail because score recording failed.
    }
  }

  function endGame(reason) {
    state.running = false;
    soundGameLoss();
    localStorage.setItem(bestKey, String(Math.max(Number(localStorage.getItem(bestKey) || 0), state.score)));
    recordScore();
    $("endTitle").textContent = reason;
    $("endSummary").textContent = `Score ${state.score}. Reached level ${state.level}. Best on this device: ${localStorage.getItem(bestKey) || state.score}.`;
    show($("endPanel"), true);
  }

  function pointerMove(event) {
    if (!state.running || !state.player) return;
    state.player.x = clamp(event.clientX, 18, state.width - 18);
    state.player.y = clamp(event.clientY, state.height * 0.58, state.height - 28);
    state.autoFireTimer = 0.2;
  }

  $("startButton").addEventListener("click", () => {
    unlockAudio();
    state.mode = $("runMode").value || "solo";
    start();
  });
  $("againButton").addEventListener("click", () => {
    show($("endPanel"), false);
    show($("startPanel"), true);
  });
  $("helpButton").addEventListener("click", () => {
    show($("startPanel"), false);
    show($("helpPanel"), true);
  });
  $("helpBack").addEventListener("click", () => {
    show($("helpPanel"), false);
    show($("startPanel"), true);
  });
  $("pauseButton").addEventListener("click", () => {
    state.paused = !state.paused;
    $("pauseButton").textContent = state.paused ? "▶" : "Ⅱ";
  });
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", (event) => {
    unlockAudio();
    state.keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener("keyup", (event) => state.keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  document.addEventListener("visibilitychange", () => { if (document.hidden) state.paused = true; });
  makeApp();
  hud();
})();
