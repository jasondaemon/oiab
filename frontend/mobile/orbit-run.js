(() => {
  const bestKey = "oiab-orbit-run-best";
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const state = {
    app: null,
    root: null,
    bg: null,
    width: 0,
    height: 0,
    cx: 0,
    cy: 0,
    ring: 0,
    running: false,
    paused: false,
    score: 0,
    level: 1,
    wave: 0,
    lives: 3,
    mode: "arcade",
    angle: -Math.PI / 2,
    autoFireTimer: 0,
    fireCooldown: 0,
    spawnTimer: 0,
    boss: null,
    keys: new Set(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    audio: null,
  };

  const themes = [
    { name: "Spaceship", bg: 0x071527, ship: 0x66d9ef, enemy: 0xff6868 },
    { name: "FJ Vortex", bg: 0x2b2112, ship: 0xffd451, enemy: 0x7ee58b },
    { name: "Storm Boat", bg: 0x082733, ship: 0x7ee5ff, enemy: 0xd680ff },
    { name: "Mountain Tundra", bg: 0x14251c, ship: 0xffffff, enemy: 0xff8c2a },
    { name: "Neon Jet", bg: 0x090414, ship: 0xff5bd8, enemy: 0x7ee58b },
    { name: "Lunar Rover", bg: 0x111318, ship: 0xd9d9c7, enemy: 0xffd451 },
  ];

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

  function tone(frequency, duration = 0.1, type = "sine", gain = 0.045, endFrequency = null) {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    vol.gain.setValueAtTime(gain, now);
    vol.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(vol).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function noise(duration = 0.16, gain = 0.055, frequency = 900) {
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
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, now);
    filter.Q.setValueAtTime(1.6, now);
    vol.gain.setValueAtTime(gain, now);
    vol.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.buffer = buffer;
    src.connect(filter).connect(vol).connect(ctx.destination);
    src.start(now);
  }

  function soundShoot() {
    tone(860, 0.055, "square", 0.025, 420);
  }

  function soundExplode() {
    noise(0.22, 0.075, 520);
    tone(140, 0.16, "sawtooth", 0.03, 58);
  }

  function soundLifeLost() {
    tone(260, 0.12, "triangle", 0.05, 120);
    setTimeout(() => tone(150, 0.16, "triangle", 0.045, 80), 85);
  }

  function soundLevelUp() {
    [420, 560, 760].forEach((freq, i) => setTimeout(() => tone(freq, 0.12, "triangle", 0.04), i * 85));
  }

  function soundGameOver() {
    [280, 190, 120].forEach((freq, i) => setTimeout(() => tone(freq, 0.18, "sawtooth", 0.045, freq * 0.72), i * 120));
  }

  function hud() {
    $("score").textContent = String(state.score);
    $("level").textContent = String(state.level);
    $("lives").textContent = String(state.lives);
    $("wave").textContent = String(state.wave);
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
    state.cx = state.width / 2;
    state.cy = state.height / 2;
    state.ring = Math.max(110, Math.min(state.width, state.height) * 0.39);
  }

  function clearStage() {
    for (const list of [state.bullets, state.enemyBullets, state.enemies, state.particles]) {
      for (const item of list) safeDestroy(item.g);
      list.length = 0;
    }
    safeDestroy(state.boss?.g);
    state.boss = null;
    state.root?.removeChildren();
  }

  function theme() {
    return themes[(state.level - 1) % themes.length];
  }

  function drawBackground() {
    safeDestroy(state.bg);
    const t = theme();
    const g = new PIXI.Graphics();
    g.beginFill(t.bg).drawRect(0, 0, state.width, state.height).endFill();
    for (let i = 0; i < 8; i += 1) {
      g.lineStyle(1 + i * 0.15, 0x7ee58b, 0.08 + i * 0.015).drawCircle(state.cx, state.cy, (i + 1) * state.ring / 8);
    }
    for (let i = 0; i < 32; i += 1) {
      const a = i / 32 * Math.PI * 2;
      g.lineStyle(1, 0xffffff, 0.045).moveTo(state.cx, state.cy).lineTo(state.cx + Math.cos(a) * state.ring * 1.4, state.cy + Math.sin(a) * state.ring * 1.4);
    }
    state.bg = g;
    state.root.addChildAt(g, 0);
  }

  function shipGraphic() {
    const g = new PIXI.Graphics();
    const t = theme();
    g.beginFill(t.ship).drawPolygon([0, -18, -12, 14, 0, 8, 12, 14]).endFill();
    g.lineStyle(2, 0x071109, 0.7).drawPolygon([0, -18, -12, 14, 0, 8, 12, 14]);
    g.beginFill(0xffd451).drawCircle(0, 0, 3).endFill();
    return g;
  }

  function enemyGraphic(type = "drone") {
    const g = new PIXI.Graphics();
    const t = theme();
    if (type === "boss") {
      g.beginFill(t.enemy).drawCircle(0, 0, 38).endFill();
      g.lineStyle(5, 0xffd451, 0.8).drawCircle(0, 0, 51);
      g.beginFill(0x071109).drawCircle(-11, -6, 5).drawCircle(11, -6, 5).endFill();
    } else {
      g.beginFill(t.enemy).drawPolygon([0, -13, 12, 4, 5, 13, -5, 13, -12, 4]).endFill();
      g.lineStyle(2, 0xf7fff0, 0.45).drawCircle(0, 0, 12);
    }
    return g;
  }

  function start() {
    unlockAudio();
    makeApp();
    clearStage();
    state.mode = $("runMode").value || "arcade";
    state.score = 0;
    state.level = 1;
    state.wave = 0;
    state.lives = state.mode === "kids" ? 5 : state.mode === "challenge" ? 1 : 3;
    state.angle = -Math.PI / 2;
    state.autoFireTimer = 0;
    state.running = true;
    state.paused = false;
    drawBackground();
    spawnPlayer();
    state.spawnTimer = 0.6;
    show($("startPanel"), false);
    show($("endPanel"), false);
    hud();
  }

  function spawnPlayer() {
    const g = shipGraphic();
    state.player = { g, invuln: 1 };
    state.root.addChild(g);
    positionPlayer();
  }

  function positionPlayer() {
    if (!state.player) return;
    const x = state.cx + Math.cos(state.angle) * state.ring;
    const y = state.cy + Math.sin(state.angle) * state.ring;
    state.player.g.position.set(x, y);
    state.player.g.rotation = state.angle + Math.PI / 2;
    state.player.g.alpha = state.player.invuln > 0 ? 0.55 + Math.sin(performance.now() / 80) * 0.2 : 1;
  }

  function shoot() {
    if (state.fireCooldown > 0 || !state.player) return;
    const g = new PIXI.Graphics();
    g.beginFill(0xffd451).drawCircle(0, 0, 4).endFill();
    const x = state.cx + Math.cos(state.angle) * (state.ring - 18);
    const y = state.cy + Math.sin(state.angle) * (state.ring - 18);
    const item = { g, x, y, vx: -Math.cos(state.angle) * 560, vy: -Math.sin(state.angle) * 560, r: 5 };
    g.position.set(x, y);
    state.root.addChild(g);
    state.bullets.push(item);
    state.fireCooldown = state.mode === "kids" ? 0.13 : 0.18;
    soundShoot();
  }

  function spawnEnemy() {
    state.wave += 1;
    if (state.level % 5 === 0 && !state.boss && state.wave % 8 === 0) {
      const g = enemyGraphic("boss");
      state.boss = { g, x: state.cx, y: state.cy, hp: 18 + state.level * 2, shieldAngle: 0, r: 48, shoot: 1.2 };
      g.position.set(state.cx, state.cy);
      state.root.addChild(g);
      return;
    }
    const count = state.mode === "kids" ? 1 : 1 + Math.floor(state.level / 3);
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, Math.PI * 2);
      const g = enemyGraphic();
      const item = { g, a, radius: 8, spin: rand(-1.2, 1.2), speed: 48 + state.level * 8, r: 13, shoot: rand(1.1, 2.8) };
      g.position.set(state.cx, state.cy);
      state.root.addChild(g);
      state.enemies.push(item);
    }
  }

  function enemyShoot(e) {
    const x = e.x ?? (state.cx + Math.cos(e.a) * e.radius);
    const y = e.y ?? (state.cy + Math.sin(e.a) * e.radius);
    const dx = x - state.cx;
    const dy = y - state.cy;
    const n = Math.hypot(dx, dy) || 1;
    const g = new PIXI.Graphics();
    g.beginFill(0xff6868).drawCircle(0, 0, 5).endFill();
    const b = { g, x, y, vx: dx / n * 245, vy: dy / n * 245, r: 6 };
    g.position.set(x, y);
    state.root.addChild(g);
    state.enemyBullets.push(b);
  }

  function particles(x, y, color, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const g = new PIXI.Graphics();
      g.beginFill(color).drawCircle(0, 0, rand(2, 4)).endFill();
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 260);
      const p = { g, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.6) };
      g.position.set(x, y);
      state.root.addChild(g);
      state.particles.push(p);
    }
  }

  function tick(dt) {
    if (!state.running || state.paused) return;
    if (!state.bg || state.bg.width !== state.width) drawBackground();
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateParticles(dt);
    maybeAdvance();
    hud();
  }

  function updatePlayer(dt) {
    let dir = 0;
    if (state.keys.has("ArrowLeft") || state.keys.has("a")) dir -= 1;
    if (state.keys.has("ArrowRight") || state.keys.has("d")) dir += 1;
    state.angle += dir * (state.mode === "kids" ? 3.6 : 3.2) * dt;
    if (dir) state.autoFireTimer = 0.18;
    state.autoFireTimer = Math.max(0, state.autoFireTimer - dt);
    if (state.autoFireTimer > 0 || state.keys.has(" ")) shoot();
    if (state.player) state.player.invuln = Math.max(0, state.player.invuln - dt);
    positionPlayer();
  }

  function updateBullets(dt) {
    for (const b of [...state.bullets]) {
      if (b.removed) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.g.position.set(b.x, b.y);
      if (Math.hypot(b.x - state.cx, b.y - state.cy) < 8) {
        removeFrom(state.bullets, b);
        continue;
      }
      for (const e of [...state.enemies]) {
        if (b.removed) break;
        const ex = state.cx + Math.cos(e.a) * e.radius;
        const ey = state.cy + Math.sin(e.a) * e.radius;
        if (Math.hypot(b.x - ex, b.y - ey) < b.r + e.r) {
          state.score += 25;
          particles(ex, ey, theme().enemy, 12);
          soundExplode();
          removeFrom(state.enemies, e);
          removeFrom(state.bullets, b);
          break;
        }
      }
      if (b.removed) continue;
      if (state.boss && Math.hypot(b.x - state.boss.x, b.y - state.boss.y) < b.r + state.boss.r) {
        state.boss.hp -= 1;
        state.score += 35;
        particles(b.x, b.y, 0xffd451, 5);
        removeFrom(state.bullets, b);
        if (state.boss.hp <= 0) {
          state.score += 1000 + state.level * 100;
          particles(state.boss.x, state.boss.y, 0xffd451, 40);
          soundExplode();
          safeDestroy(state.boss.g);
          state.boss = null;
        }
      }
    }
    for (const b of [...state.enemyBullets]) {
      if (b.removed) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.g.position.set(b.x, b.y);
      if (b.x < -20 || b.x > state.width + 20 || b.y < -20 || b.y > state.height + 20) {
        removeFrom(state.enemyBullets, b);
        continue;
      }
      if (state.player && state.player.invuln <= 0 && Math.hypot(b.x - state.player.g.x, b.y - state.player.g.y) < b.r + 13) damage();
    }
  }

  function updateEnemies(dt) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnTimer = Math.max(0.58, (state.mode === "kids" ? 2.0 : 1.45) - state.level * 0.035);
    }
    for (const e of [...state.enemies]) {
      e.radius += e.speed * dt;
      e.a += e.spin * dt;
      const x = state.cx + Math.cos(e.a) * e.radius;
      const y = state.cy + Math.sin(e.a) * e.radius;
      e.g.position.set(x, y);
      e.g.rotation = e.a;
      e.shoot -= dt;
      if (e.shoot <= 0) {
        enemyShoot(e);
        e.shoot = rand(1.1, 2.7);
      }
      if (state.player && state.player.invuln <= 0 && Math.hypot(x - state.player.g.x, y - state.player.g.y) < e.r + 15) damage();
      if (e.radius > state.ring + 44) removeFrom(state.enemies, e);
    }
  }

  function updateBoss(dt) {
    if (!state.boss) return;
    const b = state.boss;
    b.shieldAngle += dt * 1.6;
    b.shoot -= dt;
    b.g.rotation = b.shieldAngle;
    if (b.shoot <= 0) {
      for (let i = 0; i < 6; i += 1) enemyShoot({ x: b.x + Math.cos(i / 6 * Math.PI * 2) * 32, y: b.y + Math.sin(i / 6 * Math.PI * 2) * 32 });
      b.shoot = 1.2;
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

  function maybeAdvance() {
    if (state.wave > state.level * 8 + 10 && !state.enemies.length && !state.boss) {
      state.score += 250 + state.level * 50;
      state.level += 1;
      state.wave = 0;
      drawBackground();
      soundLevelUp();
    }
  }

  function damage() {
    if (!state.player || state.player.invuln > 0) return;
    state.lives -= 1;
    particles(state.player.g.x, state.player.g.y, 0xff6868, 28);
    soundLifeLost();
    state.player.invuln = 1.8;
    if (state.lives <= 0) endGame();
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
          action: "record-orbit-run",
          game: "orbit-run",
          title: "Orbit Run",
          matchId: `orbit-${Date.now()}`,
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
      // Local play must continue if scoring is temporarily unavailable.
    }
  }

  function endGame() {
    state.running = false;
    soundGameOver();
    localStorage.setItem(bestKey, String(Math.max(Number(localStorage.getItem(bestKey) || 0), state.score)));
    recordScore();
    $("endTitle").textContent = "Orbit Complete";
    $("endSummary").textContent = `Score ${state.score}. Reached stage ${state.level}. Best on this device: ${localStorage.getItem(bestKey) || state.score}.`;
    show($("endPanel"), true);
  }

  function pointerControl(event) {
    const dx = event.clientX - state.cx;
    const dy = event.clientY - state.cy;
    if (Math.hypot(dx, dy) > 30) {
      state.angle = Math.atan2(dy, dx);
      state.autoFireTimer = 0.2;
    }
  }

  $("startButton").addEventListener("click", start);
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
  window.addEventListener("pointermove", (event) => { if (state.running) pointerControl(event); });
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
