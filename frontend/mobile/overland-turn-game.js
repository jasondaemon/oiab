(() => {
  const gameKind = document.body.dataset.game;
  const gameTitle = document.body.dataset.title || "Game";
  const storageKey = `iiab-overland-${gameKind}`;
  const profileStorageKey = "iiab-overland-player-profile";
  const $ = (id) => document.getElementById(id);
  const state = {
    playerId: "",
    playerName: "",
    gameId: "",
    mark: "",
    mode: "pvp",
    difficulty: "medium",
    game: null,
    poll: null,
    patternInput: [],
    patternLastKey: "",
    patternPlaying: false,
    patternFlashPad: -1,
    wordPath: [],
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

  function loadProfile() {
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
    const saved = loadProfile();
    return cleanName(queryValue("playerName")) || cleanName(saved.name) || "Player";
  }

  function profileId() {
    const saved = loadProfile();
    return queryValue("playerId") || saved.id || randomId();
  }

  function loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      state.playerId = profileId() || saved.playerId || randomId();
      state.playerName = profileName();
      state.gameId = queryValue("game") || saved.gameId || "";
      state.mark = saved.mark || "";
      state.mode = saved.mode || "pvp";
      state.difficulty = saved.difficulty || "medium";
    } catch {
      state.playerId = profileId();
      state.playerName = profileName();
    }
    saveProfile(state.playerId, state.playerName);
    $("playerNameLabel").textContent = state.playerName;
    const modeInput = document.querySelector(`input[name="gameMode"][value="${state.mode}"]`);
    if (modeInput) modeInput.checked = true;
    if ($("difficulty")) $("difficulty").value = state.difficulty || "medium";
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

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, "0")}`;
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
      renderOpenGames((Array.isArray(data.games) ? data.games : []).filter((game) => game.type === gameKind));
    } catch (error) {
      $("openGames").innerHTML = `<div class="open-game"><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function renderOpenGames(games) {
    const target = $("openGames");
    if (!games.length) {
      target.innerHTML = `<div class="open-game"><span>No open ${escapeHtml(gameTitle)} games.</span></div>`;
      return;
    }
    target.replaceChildren(...games.map((game) => {
      const row = document.createElement("div");
      row.className = "open-game";
      const names = (game.players || []).map((player) => `${player.name || "Player"} (${player.mark})`).join(" vs ");
      row.innerHTML = `<div><strong>${escapeHtml(game.title || gameTitle)}</strong><span>${escapeHtml(names || "Waiting for player")}</span></div>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open";
      button.addEventListener("click", () => joinGame(game.id));
      row.append(button);
      return row;
    }));
  }

  function canMove() {
    if (gameKind === "pattern-match") {
      return Boolean(state.game && state.game.status === "active" && state.mark && !state.game.winner && !state.patternPlaying);
    }
    if (gameKind === "word-grid") {
      const p = state.game?.payload || {};
      return Boolean(state.game && state.game.status === "active" && state.mark && !state.game.winner && !p.hidden && Number(p.timeRemaining || 0) > 0);
    }
    return state.game && state.game.status === "active" && !state.game.winner && state.game.turn === state.mark;
  }

  function showGame(game) {
    state.game = game;
    $("lobby").hidden = true;
    $("gamePanel").hidden = false;
    const resultClass = game.winner === "draw" ? "result-draw" : game.winner ? (game.winner === state.mark ? "result-win" : "result-loss") : "";
    document.body.classList.remove("result-win", "result-loss", "result-draw");
    $("gamePanel").classList.remove("result-win", "result-loss", "result-draw");
    if (resultClass) {
      document.body.classList.add(resultClass);
      $("gamePanel").classList.add(resultClass);
    }
    const players = game.players || [];
    const turnName = players.find((player) => player.mark === game.turn)?.name || game.turn;
    let headline = "Waiting for a second player.";
    let label = game.status || "waiting";
    if (game.winner === "draw") {
      headline = "Draw game.";
      label = "complete";
    } else if (gameKind === "pattern-match" && game.status === "complete") {
      const score = Number(game.payload?.score ?? game.payload?.scores?.[state.mark || "A"] ?? 0);
      headline = `Game over. Score ${score}.`;
      label = "complete";
    } else if (game.winner) {
      const winner = players.find((player) => player.mark === game.winner);
      headline = `${winner?.name || game.winner} wins.`;
      label = "complete";
    } else if (game.status === "active") {
      const observing = !state.mark || !players.some((player) => player.mark === state.mark);
      if (gameKind === "word-grid") {
        const p = game.payload || {};
        headline = p.hidden ? `Board reveals in ${p.startsIn || 0}...` : observing ? "Watching the round." : "Find as many words as you can.";
        label = observing ? "observer" : game.mode === "cpu" ? "solo" : `${p.timeRemaining || 0}s left`;
      } else if (gameKind === "pattern-match") {
        const p = game.payload || {};
        headline = state.patternPlaying ? "Watch the pattern." : `Repeat round ${p.round || (p.sequence || []).length || 1}.`;
        label = `score ${p.score || 0}`;
      } else {
        headline = observing ? `Watching ${turnName}'s turn.` : game.turn === state.mark ? "Your turn." : `${turnName}'s turn.`;
        label = observing ? "observer" : game.mode === "cpu" ? `${game.difficulty || "medium"} CPU` : `You are ${state.mark}`;
      }
    }
    $("gameState").textContent = label;
    $("gameStatus").textContent = headline;
    renderPlayers(players, game.turn, game.payload?.scores || game.scores || {});
    renderBoard();
  }

  function renderPlayers(players, turn, scores) {
    const soloGame = (gameKind === "word-grid" || gameKind === "pattern-match") && state.game?.mode === "cpu";
    const missing = players.length < 2 && !soloGame ? [{ name: "Waiting...", mark: "B" }] : [];
    $("players").replaceChildren(...players.concat(missing).map((player) => {
      const card = document.createElement("div");
      card.className = `player ${player.mark === turn ? "current" : ""}`;
      const score = scores[player.mark];
      card.innerHTML = `<span>${escapeHtml(player.mark || "")}${score !== undefined ? ` · ${score} pts` : ""}</span><strong>${escapeHtml(player.name || "Player")}</strong>`;
      return card;
    }));
  }

  function renderBoard() {
    const renderers = {
      "connect-four": renderConnectFour,
      battleship: renderBattleship,
      hangman: renderHangman,
      "word-grid": renderWordGrid,
      "pattern-match": renderPatternMatch,
    };
    renderers[gameKind]?.();
  }

  function renderConnectFour() {
    const board = state.game.board || Array(42).fill("");
    const win = new Set(state.game.winningLine || []);
    const cells = [];
    for (let col = 0; col < 7; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "connect-drop";
      button.textContent = "↓";
      button.disabled = !canMove() || board[col];
      button.addEventListener("click", () => makeMove({ column: col }));
      cells.push(button);
    }
    board.forEach((mark, index) => {
      const cell = document.createElement("div");
      cell.className = `connect-cell ${mark === "R" ? "red" : mark === "Y" ? "yellow" : ""} ${win.has(index) ? "win" : ""}`;
      cells.push(cell);
    });
    $("board").className = "board-area connect-board";
    $("board").replaceChildren(...cells);
  }

  function shipPartClass(index, groups) {
    const group = (groups || []).find((item) => Array.isArray(item) && item.includes(index));
    if (!group) return "";
    const cells = group.slice().sort((a, b) => a - b);
    const length = cells.length;
    if (length <= 1) return "ship-single";
    const horizontal = cells[1] - cells[0] === 1;
    const position = index === cells[0] ? "start" : index === cells[cells.length - 1] ? "end" : "mid";
    return `ship-${horizontal ? "h" : "v"} ship-${position} ship-len-${length}`;
  }

  function shipGrid(title, cells, clickEnemy = false) {
    const wrap = document.createElement("section");
    const h = document.createElement("h3");
    h.textContent = title;
    const grid = document.createElement("div");
    grid.className = "ship-grid";
    for (let i = 0; i < 36; i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      const value = cells(i);
      button.className = `ship-cell ${value.className || ""}`;
      button.textContent = value.text || "";
      button.disabled = !clickEnemy || !canMove() || value.done;
      if (clickEnemy) button.addEventListener("click", () => makeMove({ cell: i }));
      grid.append(button);
    }
    wrap.append(h, grid);
    return wrap;
  }

  function renderBattleship() {
    const p = state.game.payload || {};
    const ownShips = new Set(p.ownShips || []);
    const ownShipGroups = p.ownShipGroups || [];
    const opponentShips = new Set(p.opponentShips || []);
    const opponentShipGroups = p.opponentShipGroups || [];
    const ownHits = new Set(p.hitsOnMe || []);
    const enemyShots = new Set(p.opponentShots || []);
    const ownShots = new Set(p.ownShots || []);
    const hitsByMe = new Set(p.hitsByMe || []);
    const gameComplete = state.game.status === "complete";
    const area = document.createElement("div");
    area.className = "ship-wrap";
    area.append(
      shipGrid("Enemy Waters", (i) => ({
        className: `${opponentShips.has(i) ? `ship revealed ${shipPartClass(i, opponentShipGroups)}` : ""} ${hitsByMe.has(i) ? "hit" : ownShots.has(i) ? "miss" : ""}`,
        text: hitsByMe.has(i) ? "×" : ownShots.has(i) ? "•" : gameComplete && opponentShips.has(i) ? "" : "",
        done: ownShots.has(i),
      }), true),
      shipGrid("Your Fleet", (i) => ({
        className: `${ownShips.has(i) ? `ship ${shipPartClass(i, ownShipGroups)}` : ""} ${ownHits.has(i) ? "hit" : enemyShots.has(i) ? "miss" : ""}`,
        text: ownHits.has(i) ? "×" : enemyShots.has(i) ? "•" : "",
      })),
    );
    $("board").className = "board-area";
    $("board").replaceChildren(area);
  }

  function renderHangman() {
    const p = state.game.payload || {};
    const wrap = document.createElement("div");
    wrap.className = "hangman-wrap";
    const stage = document.createElement("div");
    stage.className = "hangman-stage";
    stage.innerHTML = hangmanFigure(Math.min(Number(p.wrong || 0), Number(p.maxWrong || 6)));
    const word = document.createElement("div");
    word.className = "word-display";
    renderHangmanWord(word, p);
    const letters = document.createElement("div");
    letters.className = "letter-grid";
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = letter;
      button.disabled = !canMove() || (p.guessed || []).includes(letter);
      button.addEventListener("click", () => makeMove({ letter }));
      letters.append(button);
    });
    wrap.append(stage, word, letters);
    $("board").className = "board-area";
    $("board").replaceChildren(wrap);
  }

  function renderHangmanWord(target, payload) {
    const source = payload.word ? payload.word.split("") : Array.isArray(payload.maskedChars) ? payload.maskedChars : String(payload.maskedWord || "_").split("");
    let group = document.createElement("span");
    group.className = "hangman-word";
    source.forEach((char) => {
      if (char === " ") {
        if (group.childElementCount) target.append(group);
        const gap = document.createElement("span");
        gap.className = "hangman-space";
        gap.setAttribute("aria-label", "space");
        target.append(gap);
        group = document.createElement("span");
        group.className = "hangman-word";
        return;
      }
      const tile = document.createElement("span");
      tile.className = `hangman-letter ${char === "_" ? "blank" : ""}`;
      tile.textContent = char;
      group.append(tile);
    });
    if (group.childElementCount) target.append(group);
  }

  function hangmanFigure(wrong) {
    const parts = [
      '<circle class="hangman-part" cx="134" cy="62" r="17"/>',
      '<line class="hangman-part" x1="134" y1="80" x2="134" y2="132"/>',
      '<line class="hangman-part" x1="134" y1="96" x2="104" y2="118"/>',
      '<line class="hangman-part" x1="134" y1="96" x2="164" y2="118"/>',
      '<line class="hangman-part" x1="134" y1="132" x2="108" y2="170"/>',
      '<line class="hangman-part" x1="134" y1="132" x2="160" y2="170"/>',
    ].slice(0, wrong).join("");
    return `<svg class="hangman-svg" viewBox="0 0 220 190" role="img" aria-label="Hangman wrong guesses ${wrong}">
      <line class="hangman-frame" x1="34" y1="178" x2="178" y2="178"/>
      <line class="hangman-frame" x1="58" y1="178" x2="58" y2="22"/>
      <line class="hangman-frame" x1="58" y1="22" x2="134" y2="22"/>
      <line class="hangman-frame" x1="134" y1="22" x2="134" y2="45"/>
      <line class="hangman-frame" x1="58" y1="54" x2="90" y2="22"/>
      ${parts}
    </svg>`;
  }

  function renderWordGrid() {
    const p = state.game.payload || {};
    const wrap = document.createElement("div");
    wrap.className = "word-grid-wrap";
    if (p.hidden) {
      const waiting = document.createElement("div");
      waiting.className = "word-countdown";
      waiting.innerHTML = p.waitingForPlayer
        ? "<strong>?</strong><span>Waiting for player two</span>"
        : `<strong>${Number(p.startsIn || 0) || 3}</strong><span>Board reveal</span>`;
      $("board").className = "board-area";
      $("board").replaceChildren(waiting);
      return;
    }
    const selectedWord = state.wordPath.map((index) => (p.letters || [])[index] || "").join("");
    const minLabel = `${Number(p.minWordLength || 3)}+`;
    const remaining = Math.max(0, Number(p.timeRemaining || 0));
    const roundSeconds = Math.max(1, Number(p.roundSeconds || 90));
    const timerPct = Math.max(0, Math.min(100, (remaining / roundSeconds) * 100));
    const timer = document.createElement("div");
    timer.className = `word-timer ${remaining <= 10 ? "danger" : remaining <= 30 ? "warning" : ""}`;
    timer.style.setProperty("--timer-pct", `${timerPct}%`);
    timer.innerHTML = `
      <div class="word-timer-readout">
        <span>Time</span>
        <strong>${formatDuration(remaining)}</strong>
      </div>
      <div class="word-timer-track" aria-hidden="true"><i></i></div>
      <div class="word-timer-rule">
        <span>Words</span>
        <strong>${escapeHtml(minLabel)} letters</strong>
      </div>`;
    const readout = document.createElement("div");
    readout.className = "word-builder";
    readout.innerHTML = `<strong>${escapeHtml(selectedWord || `Tap linked letters · ${minLabel} letters`)}</strong><button id="submitWord" type="button">Enter</button><button id="clearWord" type="button">Clear</button>`;
    const grid = document.createElement("div");
    grid.className = "word-grid";
    (p.letters || []).forEach((letter, index) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = `word-tile ${state.wordPath.includes(index) ? "selected" : ""}`;
      tile.textContent = letter;
      tile.disabled = !canMove() || !canSelectWordTile(index);
      tile.addEventListener("click", () => {
        if (state.wordPath.includes(index)) {
          if (state.wordPath[state.wordPath.length - 1] === index) state.wordPath.pop();
        } else {
          state.wordPath.push(index);
        }
        renderWordGrid();
      });
      grid.append(tile);
    });
    const mine = ((p.found || {})[state.mark] || []).slice().sort();
    const lists = document.createElement("div");
    lists.className = "word-lists";
    const marks = state.game.status === "complete" ? ["A", "B"] : [state.mark || "A"];
    marks.forEach((mark) => {
      const list = document.createElement("section");
      list.className = "word-list";
      const player = (state.game.players || []).find((item) => item.mark === mark);
      const words = mark === state.mark || state.game.status === "complete" ? ((p.found || {})[mark] || []).slice().sort() : [];
      list.innerHTML = `<h3>${escapeHtml(player?.name || mark)} · ${(p.scores || {})[mark] || 0} pts</h3><p>${escapeHtml(words.join(", ") || "No words yet.")}</p>`;
      lists.append(list);
    });
    if (state.game.status === "complete") {
      const valid = document.createElement("section");
      valid.className = "word-list word-valid-list";
      valid.innerHTML = `<h3>Valid words this round · ${(p.validWords || []).length}</h3><p>${escapeHtml((p.validWords || []).join(", ") || "No valid words found for this board.")}</p>`;
      lists.append(valid);
    }
    wrap.append(timer, readout, grid, lists);
    $("board").className = "board-area";
    $("board").replaceChildren(wrap);
    const minWordLength = Math.max(1, Math.min(3, Number(p.minWordLength || 3)));
    $("submitWord").disabled = !canMove() || selectedWord.length < minWordLength || mine.includes(selectedWord);
    $("clearWord").disabled = !state.wordPath.length;
    $("submitWord").addEventListener("click", () => makeMove({ word: selectedWord }));
    $("clearWord").addEventListener("click", () => {
      state.wordPath = [];
      renderWordGrid();
    });
  }

  function canSelectWordTile(index) {
    if (!state.wordPath.length) return true;
    if (state.wordPath.includes(index)) return state.wordPath[state.wordPath.length - 1] === index;
    const prev = state.wordPath[state.wordPath.length - 1];
    const pr = Math.floor(prev / 4);
    const pc = prev % 4;
    const nr = Math.floor(index / 4);
    const nc = index % 4;
    return Math.abs(pr - nr) <= 1 && Math.abs(pc - nc) <= 1;
  }

  function renderPatternMatch() {
    const p = state.game.payload || {};
    const wrap = document.createElement("div");
    wrap.className = "pattern-wrap";
    const readout = document.createElement("div");
    readout.className = "sequence-readout";
    const sequence = Array.isArray(p.sequence) ? p.sequence.map((item) => Number(item)).filter((item) => item >= 0 && item <= 3) : [];
    const input = state.patternInput.map((n) => n + 1).join(" ");
    readout.innerHTML = `
      <span>Round ${Number(p.round || sequence.length || 1)}</span>
      <strong>${escapeHtml(input || "Watch, then repeat")}</strong>
      <small>Score ${Number(p.score || 0)} · ${state.patternInput.length}/${sequence.length}</small>
    `;
    const grid = document.createElement("div");
    grid.className = "pattern-grid";
    [0, 1, 2, 3].forEach((pad) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pattern-pad ${state.patternFlashPad === pad ? "flash" : ""}`;
      button.dataset.pad = String(pad);
      button.setAttribute("aria-label", `Pad ${pad + 1}`);
      button.disabled = !canMove();
      button.addEventListener("click", () => {
        handlePatternTap(pad, sequence);
      });
      grid.append(button);
    });
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.innerHTML = '<button id="replayPattern" class="primary" type="button">Replay Pattern</button><button id="clearPattern" type="button">Clear Input</button>';
    wrap.append(readout, grid, actions);
    $("board").className = "board-area";
    $("board").replaceChildren(wrap);
    $("replayPattern").disabled = !canMove() && state.patternPlaying;
    $("clearPattern").disabled = !canMove() || !state.patternInput.length;
    $("replayPattern").addEventListener("click", () => flashPattern(sequence, p.speedMs));
    $("clearPattern").addEventListener("click", () => {
      state.patternInput = [];
      renderPatternMatch();
    });
    const key = sequence.join(",");
    if (state.game.status === "active" && key && key !== state.patternLastKey) {
      state.patternLastKey = key;
      state.patternInput = [];
      window.setTimeout(() => flashPattern(sequence, p.speedMs), 260);
    }
  }

  function handlePatternTap(pad, sequence) {
    if (!canMove()) return;
    playPatternTone(pad);
    state.patternFlashPad = pad;
    window.setTimeout(() => {
      if (state.patternFlashPad === pad) {
        state.patternFlashPad = -1;
        renderPatternMatch();
      }
    }, 150);
    state.patternInput.push(pad);
    const index = state.patternInput.length - 1;
    if (state.patternInput[index] !== sequence[index]) {
      makeMove({ pattern: state.patternInput.join("") });
      return;
    }
    if (state.patternInput.length >= sequence.length) {
      makeMove({ pattern: state.patternInput.join("") });
      return;
    }
    renderPatternMatch();
  }

  async function flashPattern(sequence, speedMs) {
    if (!sequence.length || state.patternPlaying) return;
    state.patternPlaying = true;
    renderPatternMatch();
    const hold = Math.max(230, Number(speedMs || 620));
    const gap = Math.max(80, Math.round(hold * 0.34));
    for (const pad of sequence) {
      state.patternFlashPad = Number(pad);
      playPatternTone(Number(pad));
      renderPatternMatch();
      await new Promise((resolve) => setTimeout(resolve, hold));
      state.patternFlashPad = -1;
      renderPatternMatch();
      await new Promise((resolve) => setTimeout(resolve, gap));
    }
    state.patternPlaying = false;
    state.patternFlashPad = -1;
    renderPatternMatch();
  }

  const patternToneCache = new Map();

  function patternToneUrl(pad) {
    const frequencies = [261.63, 329.63, 392.0, 523.25];
    const frequency = frequencies[pad] || frequencies[0];
    const key = String(frequency);
    if (patternToneCache.has(key)) return patternToneCache.get(key);
    const sampleRate = 22050;
    const duration = 0.24;
    const count = Math.floor(sampleRate * duration);
    const bytes = new Uint8Array(44 + count * 2);
    const view = new DataView(bytes.buffer);
    const write = (offset, value) => value.split("").forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    write(0, "RIFF");
    view.setUint32(4, 36 + count * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i += 1) {
      const fadeIn = Math.min(1, i / 600);
      const fadeOut = Math.min(1, (count - i) / 1400);
      const envelope = Math.min(fadeIn, fadeOut);
      const value = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.42 * envelope;
      view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, value)) * 32767, true);
    }
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const url = `data:audio/wav;base64,${btoa(binary)}`;
    patternToneCache.set(key, url);
    return url;
  }

  function playPatternTone(pad) {
    try {
      const audio = new Audio(patternToneUrl(pad));
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {
      // Visual feedback still carries gameplay if audio is unavailable.
    }
  }

  async function createGame() {
    try {
      if (gameKind === "pattern-match") state.mode = "cpu";
      const payload = { action: "create", game: gameKind, playerId: state.playerId, playerName: state.playerName, mode: state.mode, difficulty: state.difficulty };
      if (gameKind === "hangman" && state.mode === "pvp") {
        const phrase = $("hangmanPhrase")?.value?.trim() || "";
        if (!phrase) {
          message("Enter a secret word or phrase for the other player to guess.", true);
          return;
        }
        payload.word = phrase;
      }
      const data = await api(payload);
      if ($("hangmanPhrase")) $("hangmanPhrase").value = "";
      state.wordPath = [];
      state.gameId = data.game.id;
      state.mark = data.mark;
      saveLocal();
      showGame(data.game);
      startPolling();
      message(gameKind === "pattern-match" ? "Pattern run started." : state.mode === "cpu" ? `${gameTitle} vs computer started.` : `${gameTitle} created. Another device can join from Open Games.`);
    } catch (error) {
      message(error.message, true);
    }
  }

  async function joinGame(gameId) {
    try {
      const data = await api({ action: "join", gameId, playerId: state.playerId, playerName: state.playerName });
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
      const data = await api({ action: "state", gameId: state.gameId, playerId: state.playerId });
      showGame(data.game);
    } catch (error) {
      leaveGame(false);
      message(error.message, true);
      await loadOpenGames();
    }
  }

  async function makeMove(extra) {
    try {
      const data = await api({ action: "move", gameId: state.gameId, playerId: state.playerId, ...extra });
      if (gameKind === "pattern-match") state.patternInput = [];
      if (gameKind === "word-grid") state.wordPath = [];
      showGame(data.game);
      message("");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function resetGame() {
    try {
      const data = await api({ action: "reset", gameId: state.gameId, playerId: state.playerId });
      state.patternInput = [];
      state.wordPath = [];
      showGame(data.game);
      message("Game reset.");
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
    state.patternInput = [];
    state.wordPath = [];
    document.body.classList.remove("result-win", "result-loss", "result-draw");
    $("gamePanel").classList.remove("result-win", "result-loss", "result-draw");
    saveLocal();
    $("gamePanel").hidden = true;
    $("lobby").hidden = false;
    stopPolling();
    loadOpenGames();
    if (clearMessage) message("");
  }

  function updateModeUi() {
    state.mode = document.querySelector('input[name="gameMode"]:checked')?.value || "pvp";
    if (gameKind === "pattern-match") state.mode = "cpu";
    state.difficulty = $("difficulty")?.value || "medium";
    if ($("difficultyLabel")) $("difficultyLabel").hidden = state.mode !== "cpu" && gameKind !== "word-grid";
    if ($("hangmanPhraseLabel")) $("hangmanPhraseLabel").hidden = gameKind !== "hangman" || state.mode !== "pvp";
    saveLocal();
  }

  function startPolling() {
    stopPolling();
    state.poll = setInterval(refreshCurrent, 1500);
  }

  function stopPolling() {
    if (state.poll) clearInterval(state.poll);
    state.poll = null;
  }

  async function main() {
    loadLocal();
    if (state.gameId) {
      await joinGame(state.gameId);
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
  if ($("difficulty")) $("difficulty").addEventListener("change", updateModeUi);
  window.addEventListener("beforeunload", stopPolling);
  main();
})();
