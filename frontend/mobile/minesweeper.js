(() => {
  const profileStorageKey = "iiab-overland-player-profile";
  const storageKey = "iiab-overland-minesweeper";
  const difficulties = {
    easy: { rows: 9, cols: 9, mines: 10, base: 1200 },
    medium: { rows: 16, cols: 16, mines: 40, base: 3600 },
    hard: { rows: 16, cols: 30, mines: 99, base: 7200 },
  };
  const state = {
    playerId: "",
    playerName: "Player",
    difficulty: "easy",
    rows: 9,
    cols: 9,
    mines: 10,
    cells: [],
    started: false,
    complete: false,
    won: false,
    flagMode: false,
    startTime: 0,
    elapsed: 0,
    timer: null,
    matchId: "",
    scoreRecorded: false,
  };
  const $ = (id) => document.getElementById(id);

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
      return { id: saved.id || randomId(), name: cleanName(saved.name) || "Player" };
    } catch {
      return { id: randomId(), name: "Player" };
    }
  }

  function saveProfile() {
    localStorage.setItem(profileStorageKey, JSON.stringify({ id: state.playerId, name: state.playerName }));
    $("playerName").textContent = state.playerName;
  }

  function saveLocal() {
    localStorage.setItem(storageKey, JSON.stringify({
      difficulty: state.difficulty,
      rows: state.rows,
      cols: state.cols,
      mines: state.mines,
      cells: state.cells,
      started: state.started,
      complete: state.complete,
      won: state.won,
      startTime: state.startTime,
      elapsed: state.elapsed,
      matchId: state.matchId,
      scoreRecorded: state.scoreRecorded,
    }));
  }

  function loadLocal() {
    const profile = loadProfile();
    state.playerId = profile.id;
    state.playerName = profile.name;
    saveProfile();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved && Array.isArray(saved.cells) && saved.cells.length && difficulties[saved.difficulty]) {
        Object.assign(state, {
          difficulty: saved.difficulty,
          rows: Number(saved.rows) || difficulties[saved.difficulty].rows,
          cols: Number(saved.cols) || difficulties[saved.difficulty].cols,
          mines: Number(saved.mines) || difficulties[saved.difficulty].mines,
          cells: saved.cells,
          started: !!saved.started,
          complete: !!saved.complete,
          won: !!saved.won,
          startTime: Number(saved.startTime) || 0,
          elapsed: Number(saved.elapsed) || 0,
          matchId: saved.matchId || randomMatchId(),
          scoreRecorded: !!saved.scoreRecorded,
        });
        if (state.started && !state.complete) startTimer(false);
        return;
      }
    } catch {
      // Ignore broken local games and start fresh.
    }
    newGame("easy");
  }

  function randomMatchId() {
    return `minesweeper-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function configFor(difficulty = state.difficulty) {
    return difficulties[difficulty] || difficulties.easy;
  }

  function newGame(difficulty = state.difficulty) {
    const config = configFor(difficulty);
    stopTimer();
    Object.assign(state, {
      difficulty,
      rows: config.rows,
      cols: config.cols,
      mines: config.mines,
      cells: Array.from({ length: config.rows * config.cols }, (_, index) => ({
        index,
        mine: false,
        open: false,
        flagged: false,
        adjacent: 0,
        exploded: false,
        badFlag: false,
      })),
      started: false,
      complete: false,
      won: false,
      flagMode: false,
      startTime: 0,
      elapsed: 0,
      matchId: randomMatchId(),
      scoreRecorded: false,
    });
    document.body.classList.remove("result-win", "result-loss");
    updateDifficultyButtons();
    updateFlagMode();
    updateStatus("Reveal a square to start.");
    saveLocal();
    render();
  }

  function startTimer(reset = true) {
    if (reset) {
      state.startTime = Date.now() - state.elapsed * 1000;
    }
    stopTimer();
    state.timer = window.setInterval(() => {
      if (!state.complete && state.started) {
        state.elapsed = Math.max(0, Math.floor((Date.now() - state.startTime) / 1000));
        updateReadout();
        saveLocal();
      }
    }, 500);
  }

  function stopTimer() {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = null;
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function neighbors(index) {
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;
    const out = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) out.push(nr * state.cols + nc);
      }
    }
    return out;
  }

  function placeMines(safeIndex) {
    const forbidden = new Set([safeIndex, ...neighbors(safeIndex)]);
    const candidates = state.cells.map((cell) => cell.index).filter((index) => !forbidden.has(index));
    for (let placed = 0; placed < state.mines && candidates.length; placed += 1) {
      const pick = Math.floor(Math.random() * candidates.length);
      const index = candidates.splice(pick, 1)[0];
      state.cells[index].mine = true;
    }
    state.cells.forEach((cell) => {
      cell.adjacent = cell.mine ? 0 : neighbors(cell.index).filter((index) => state.cells[index].mine).length;
    });
  }

  function reveal(index) {
    const cell = state.cells[index];
    if (!cell || cell.open || cell.flagged || state.complete) return;
    if (!state.started) {
      placeMines(index);
      state.started = true;
      state.startTime = Date.now();
      startTimer(false);
    }
    if (cell.mine) {
      cell.open = true;
      cell.exploded = true;
      loseGame();
      return;
    }
    const queue = [index];
    const seen = new Set();
    while (queue.length) {
      const currentIndex = queue.shift();
      if (seen.has(currentIndex)) continue;
      seen.add(currentIndex);
      const current = state.cells[currentIndex];
      if (!current || current.mine || current.flagged) continue;
      current.open = true;
      if (current.adjacent === 0) {
        neighbors(currentIndex).forEach((next) => {
          const nextCell = state.cells[next];
          if (nextCell && !nextCell.open && !nextCell.flagged && !nextCell.mine) queue.push(next);
        });
      }
    }
    checkWin();
  }

  function toggleFlag(index) {
    const cell = state.cells[index];
    if (!cell || cell.open || state.complete) return;
    cell.flagged = !cell.flagged;
  }

  function loseGame() {
    state.complete = true;
    state.won = false;
    stopTimer();
    state.cells.forEach((cell) => {
      if (cell.mine) cell.open = true;
      if (cell.flagged && !cell.mine) cell.badFlag = true;
    });
    document.body.classList.remove("result-win");
    document.body.classList.add("result-loss");
    updateStatus("Mine hit. Field lost.");
  }

  function checkWin() {
    const safeCount = state.cells.filter((cell) => !cell.mine).length;
    const openSafe = state.cells.filter((cell) => !cell.mine && cell.open).length;
    if (safeCount !== openSafe) return;
    state.complete = true;
    state.won = true;
    stopTimer();
    state.cells.forEach((cell) => {
      if (cell.mine) cell.flagged = true;
    });
    document.body.classList.remove("result-loss");
    document.body.classList.add("result-win");
    updateStatus(`Cleared in ${formatTime(state.elapsed)}. Score ${scoreValue()}.`);
    recordScore();
  }

  function scoreValue() {
    if (!state.won) return 0;
    const config = configFor();
    const boardBonus = state.rows * state.cols + state.mines * 10;
    return Math.max(1, config.base + boardBonus - state.elapsed * 8);
  }

  async function recordScore() {
    if (state.scoreRecorded || !state.won) return;
    try {
      const response = await fetch("/game-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record-minesweeper",
          matchId: state.matchId,
          playerId: state.playerId,
          playerName: state.playerName,
          difficulty: state.difficulty,
          elapsed: state.elapsed,
          score: scoreValue(),
          rows: state.rows,
          cols: state.cols,
          mines: state.mines,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `Score record failed: ${response.status}`);
      state.scoreRecorded = true;
      updateStatus(`Cleared in ${formatTime(state.elapsed)}. Score ${scoreValue()} recorded.`);
      saveLocal();
    } catch (error) {
      updateStatus(`Score could not be recorded: ${error.message}`);
    }
  }

  function updateStatus(text) {
    $("status").textContent = text || "";
  }

  function updateDifficultyButtons() {
    document.querySelectorAll("[data-difficulty]").forEach((button) => {
      button.classList.toggle("active", button.dataset.difficulty === state.difficulty);
    });
  }

  function updateFlagMode() {
    $("flagMode").classList.toggle("active", state.flagMode);
    $("flagMode").setAttribute("aria-pressed", String(state.flagMode));
    $("flagMode").textContent = state.flagMode ? "Flag On" : "Flag";
  }

  function updateReadout() {
    const flags = state.cells.filter((cell) => cell.flagged).length;
    $("mineCount").textContent = state.mines;
    $("flagCount").textContent = flags;
    $("timer").textContent = formatTime(state.elapsed);
    $("score").textContent = scoreValue();
  }

  function cellLabel(cell) {
    if (cell.flagged && !cell.open) return "";
    if (!cell.open) return "";
    if (cell.mine) return cell.badFlag ? "x" : "M";
    return cell.adjacent ? String(cell.adjacent) : "";
  }

  function render() {
    updateDifficultyButtons();
    updateFlagMode();
    updateReadout();
    const board = $("board");
    const available = Math.max(30, Math.min(
      Math.floor((window.innerWidth - 42) / state.cols),
      Math.floor((window.innerHeight - 270) / Math.min(state.rows, 16)),
      52,
    ));
    board.style.setProperty("--cols", state.cols);
    board.style.setProperty("--cell-size", `${available}px`);
    board.replaceChildren(...state.cells.map((cell) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "ms-cell",
        cell.open ? "open" : "",
        cell.flagged && !cell.open ? "flagged" : "",
        cell.mine && cell.open ? "mine" : "",
        cell.badFlag ? "bad-flag" : "",
        cell.open && cell.adjacent ? `n${cell.adjacent}` : "",
      ].filter(Boolean).join(" ");
      button.textContent = cellLabel(cell);
      button.setAttribute("aria-label", `row ${Math.floor(cell.index / state.cols) + 1}, column ${(cell.index % state.cols) + 1}`);
      button.addEventListener("click", () => {
        if (state.flagMode) toggleFlag(cell.index);
        else reveal(cell.index);
        if (!state.complete) updateStatus(state.flagMode ? "Flag mode. Tap suspected mines." : "Reveal mode. Tap safe squares.");
        saveLocal();
        render();
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(cell.index);
        saveLocal();
        render();
      });
      return button;
    }));
  }

  function openNameDialog() {
    const dialog = $("nameDialog");
    $("nameInput").value = state.playerName;
    dialog.showModal();
    $("nameInput").focus();
  }

  function saveName() {
    state.playerName = cleanName($("nameInput").value) || "Player";
    saveProfile();
    $("nameDialog").close();
  }

  document.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => newGame(button.dataset.difficulty || "easy"));
  });
  $("flagMode").addEventListener("click", () => {
    state.flagMode = !state.flagMode;
    updateFlagMode();
    updateStatus(state.flagMode ? "Flag mode. Tap suspected mines." : "Reveal mode. Tap safe squares.");
  });
  $("newGame").addEventListener("click", () => newGame());
  $("newGameTop").addEventListener("click", () => newGame());
  $("playerName").addEventListener("click", openNameDialog);
  $("saveName").addEventListener("click", saveName);
  $("nameInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveName();
  });
  window.addEventListener("resize", render);
  window.addEventListener("beforeunload", () => {
    stopTimer();
    saveLocal();
  });

  loadLocal();
  if (state.complete) document.body.classList.add(state.won ? "result-win" : "result-loss");
  render();
})();
