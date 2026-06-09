(() => {
  const storageKey = "oiab-starts-ends";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const clickUrl = "/mobile/assets/starts-ends/click.mp3";
  const $ = (id) => document.getElementById(id);
  const state = {
    playerId: "",
    playerName: "",
    gameId: "",
    mark: "",
    game: null,
    poll: null,
    spinTimer: null,
    tabletopTimer: null,
    spinKey: "",
    tabletopSpinEndsAt: 0,
    audioContext: null,
    clickBuffer: null,
    clickLoading: null,
    audioUnlocked: false,
    lastClickAt: 0,
  };

  function cleanName(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function queryValue(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function loadProfile() {
    const player = window.OIABPlayers?.get?.() || {};
    return { id: player.id || "", name: player.name || "" };
  }

  function saveProfile(id, name) {
    if (id && name && window.OIABPlayers?.set) window.OIABPlayers.set({ id, name });
  }

  function profileName() {
    const saved = loadProfile();
    return cleanName(queryValue("playerName")) || cleanName(saved.name) || "Player";
  }

  function profileId() {
    const saved = loadProfile();
    return queryValue("playerId") || saved.id || "";
  }

  function loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      state.playerId = profileId() || saved.playerId || "";
      state.playerName = profileName();
      state.gameId = queryValue("game") || saved.gameId || "";
      state.mark = saved.mark || "";
    } catch {
      state.playerId = profileId();
      state.playerName = profileName();
    }
    saveProfile(state.playerId, state.playerName);
    $("playerNameLabel").textContent = state.playerName;
  }

  function saveLocal() {
    localStorage.setItem(storageKey, JSON.stringify({
      playerId: state.playerId,
      playerName: state.playerName,
      gameId: state.gameId,
      mark: state.mark,
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

  function message(text, error = false) {
    $("message").textContent = text || "";
    $("message").style.color = error ? "var(--red)" : "var(--gold)";
  }

  async function loadClickBuffer() {
    if (state.clickBuffer) return state.clickBuffer;
    if (state.clickLoading) return state.clickLoading;
    state.clickLoading = (async () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      const context = state.audioContext || new AudioContextClass();
      state.audioContext = context;
      const response = await fetch(clickUrl, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Click sound failed: ${response.status}`);
      const bytes = await response.arrayBuffer();
      state.clickBuffer = await context.decodeAudioData(bytes.slice(0));
      return state.clickBuffer;
    })().catch(() => null);
    return state.clickLoading;
  }

  async function unlockAudio() {
    if (state.audioUnlocked) return;
    state.audioUnlocked = true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!state.audioContext && AudioContextClass) {
      state.audioContext = new AudioContextClass();
    }
    if (state.audioContext?.state === "suspended") {
      await state.audioContext.resume().catch(() => {});
    }
    loadClickBuffer();
  }

  function playClick() {
    if (!state.audioUnlocked) return;
    const now = performance.now();
    if (now - state.lastClickAt < 65) return;
    state.lastClickAt = now;
    try {
      const context = state.audioContext;
      const buffer = state.clickBuffer;
      if (!context || !buffer) {
        loadClickBuffer();
        return;
      }
      if (context.state === "suspended") context.resume().catch(() => {});
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0.38;
      source.buffer = buffer;
      source.connect(gain).connect(context.destination);
      source.start();
    } catch {
      // Browser audio policies can still reject playback; the game should continue silently.
    }
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
      renderOpenGames((Array.isArray(data.games) ? data.games : []).filter((game) => game.type === "starts-ends"));
    } catch (error) {
      $("openGames").innerHTML = `<div class="open-game"><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function renderOpenGames(games) {
    const target = $("openGames");
    if (!games.length) {
      target.innerHTML = '<div class="open-game"><span>No open Starts / Ends games. Create one and others can join.</span></div>';
      return;
    }
    target.replaceChildren(...games.map((game) => {
      const row = document.createElement("div");
      row.className = "open-game";
      const names = (game.players || []).map((player) => player.name || "Player").join(", ");
      const payload = game.payload || {};
      const round = payload.roundNumber ? `round ${payload.roundNumber}/${payload.totalRounds || 10}` : "not started";
      row.innerHTML = `<div><strong>${escapeHtml(game.title || "Starts / Ends")}</strong><span>${escapeHtml(names || "Waiting")} · ${round}</span></div>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open";
      button.addEventListener("click", () => joinGame(game.id));
      row.append(button);
      return row;
    }));
  }

  function playerByMark(mark) {
    return (state.game?.players || []).find((player) => player.mark === mark);
  }

  function showGame(game) {
    state.game = game;
    $("lobby").hidden = true;
    $("gamePanel").hidden = false;
    const payload = game.payload || {};
    const players = game.players || [];
    const me = players.find((player) => player.mark === state.mark);
    const phase = payload.phase || "lobby";
    const isHost = state.mark === "P1";
    const roundText = payload.roundNumber ? `Round ${payload.roundNumber}/${payload.totalRounds || 10}` : "Lobby";
    let status = "Waiting for players.";
    if (phase === "spinning") status = "Letters are spinning.";
    if (phase === "accepting") status = `Enter a ${payload.minWordLength || 5}+ letter word.`;
    if (phase === "round_complete") {
      const winner = playerByMark(payload.roundWinnerMark);
      status = `${winner?.name || payload.roundWinnerMark || "Player"} won the round with ${payload.winningWord || ""}.`;
    }
    if (phase === "game_complete" || game.status === "complete") {
      const winner = playerByMark(game.winner);
      status = game.winner === "draw" ? "Game ended in a draw." : `${winner?.name || game.winner || "Player"} wins the game.`;
    }
    $("gameState").textContent = roundText;
    $("gameStatus").textContent = status;
    renderPlayers(players, payload);
    renderLetters(payload);
    renderGuessPanel(payload, me);
    renderRoundPanel(payload, isHost, game);
    renderGuesses(payload);
    $("startGame").hidden = !(isHost && (phase === "lobby" || (!payload.roundNumber && game.status === "waiting")));
  }

  function renderPlayers(players, payload) {
    const scores = payload.scores || {};
    const winnerMark = payload.roundWinnerMark || state.game?.winner || "";
    $("players").replaceChildren(...players.map((player) => {
      const mark = player.mark || "";
      const card = document.createElement("article");
      card.className = `player ${winnerMark === mark ? "winner" : ""}`;
      card.innerHTML = `<span>${escapeHtml(mark)}</span><strong>${escapeHtml(player.name || "Player")}</strong><small>${Number(scores[mark] || 0)} point${Number(scores[mark] || 0) === 1 ? "" : "s"}</small>`;
      return card;
    }));
  }

  function randomLetter() {
    return letters[Math.floor(Math.random() * letters.length)] || "A";
  }

  function stopSpin() {
    if (state.spinTimer) window.clearInterval(state.spinTimer);
    state.spinTimer = null;
    document.querySelectorAll(".letter-card").forEach((card) => card.classList.remove("spinning"));
  }

  function stopTabletopSpin(finalStart = "", finalEnd = "") {
    if (state.tabletopTimer) window.clearInterval(state.tabletopTimer);
    state.tabletopTimer = null;
    state.tabletopSpinEndsAt = 0;
    $("tabletopPanel").querySelectorAll(".letter-card").forEach((card) => card.classList.remove("spinning"));
    if (finalStart) $("tabletopStartLetter").textContent = finalStart;
    if (finalEnd) $("tabletopEndLetter").textContent = finalEnd;
    $("spinTabletop").disabled = false;
  }

  function startTabletopSpin() {
    unlockAudio();
    stopTabletopSpin();
    const finalStart = randomLetter();
    const finalEnd = randomLetter();
    $("spinTabletop").disabled = true;
    $("tabletopPanel").querySelectorAll(".letter-card").forEach((card) => card.classList.add("spinning"));
    state.tabletopSpinEndsAt = performance.now() + 2100;
    state.tabletopTimer = window.setInterval(() => {
      $("tabletopStartLetter").textContent = randomLetter();
      $("tabletopEndLetter").textContent = randomLetter();
      playClick();
      if (performance.now() >= state.tabletopSpinEndsAt) {
        stopTabletopSpin(finalStart, finalEnd);
      }
    }, 70);
  }

  function renderLetters(payload) {
    const phase = payload.phase || "lobby";
    const key = `${payload.roundNumber || 0}:${payload.startLetter || ""}:${payload.endLetter || ""}:${phase}`;
    if (phase === "spinning") {
      document.querySelectorAll(".letter-card").forEach((card) => card.classList.add("spinning"));
      if (state.spinKey !== key) {
        state.spinKey = key;
        stopSpin();
        document.querySelectorAll(".letter-card").forEach((card) => card.classList.add("spinning"));
        state.spinTimer = window.setInterval(() => {
          $("startLetter").textContent = randomLetter();
          $("endLetter").textContent = randomLetter();
          playClick();
        }, 70);
      }
      return;
    }
    stopSpin();
    state.spinKey = key;
    $("startLetter").textContent = payload.startLetter || "?";
    $("endLetter").textContent = payload.endLetter || "?";
  }

  function renderGuessPanel(payload, me) {
    const canGuess = state.game?.status === "active" && payload.phase === "accepting" && me;
    const skipped = !!payload.skips?.[me?.mark || state.mark || ""];
    $("guessPanel").hidden = !me || ["lobby", "round_complete", "game_complete"].includes(payload.phase || "lobby");
    $("wordInput").disabled = !canGuess || skipped;
    $("submitWord").disabled = !canGuess || skipped;
    $("skipRound").disabled = !canGuess || skipped;
    $("submitWord").textContent = payload.phase === "spinning" ? "Wait" : "Submit";
    $("skipRound").textContent = skipped ? "Skipped" : "Skip";
  }

  function renderRoundPanel(payload, isHost, game) {
    const complete = payload.phase === "round_complete" || payload.phase === "game_complete" || game.status === "complete";
    $("roundPanel").hidden = !complete;
    if (!complete) return;
    const winner = playerByMark(payload.roundWinnerMark);
    const examples = (payload.examples || []).slice(0, 5).join(", ");
    const ready = payload.ready || {};
    const readyCount = Object.keys(ready).length;
    const playerCount = Array.isArray(game.players) ? game.players.length : 0;
    const title = payload.roundOutcome === "skipped" ? "Everyone skipped." : (payload.winningWord || "Round complete");
    const detail = payload.roundOutcome === "skipped" ? "No points awarded." : escapeHtml(winner?.name || payload.roundWinnerMark || "");
    $("roundResult").innerHTML = `<strong>${escapeHtml(title)}</strong><span>${detail}${examples ? ` · examples: ${escapeHtml(examples)}` : ""}${playerCount ? ` · ready ${readyCount}/${playerCount}` : ""}</span>`;
    const gameComplete = payload.phase === "game_complete" || game.status === "complete";
    $("nextRound").hidden = gameComplete;
    $("nextRound").disabled = !!ready[state.mark];
    $("nextRound").textContent = ready[state.mark] ? "Ready" : "Next Round";
  }

  function renderGuesses(payload) {
    const guesses = Array.isArray(payload.guesses) ? payload.guesses.slice().reverse() : [];
    const target = $("guessHistory");
    if (!guesses.length) {
      target.innerHTML = '<div class="guess-row"><span>No guesses yet.</span></div>';
      return;
    }
    target.replaceChildren(...guesses.map((guess) => {
      const row = document.createElement("div");
      row.className = `guess-row ${guess.valid ? "valid" : "invalid"}`;
      row.innerHTML = `<div><strong>${escapeHtml(guess.name || guess.mark || "Player")} · ${escapeHtml(guess.skipped ? "Skip" : guess.word || "")}</strong><span>${escapeHtml(guess.reason || "")}</span></div><div class="guess-badge">${guess.valid ? "Win" : (guess.skipped ? "Skip" : "No")}</div>`;
      return row;
    }));
  }

  async function createGame() {
    try {
      const data = await api({
        action: "create",
        game: "starts-ends",
        playerId: state.playerId,
        playerName: state.playerName,
        difficulty: $("difficulty").value,
        rounds: $("rounds").value,
      });
      state.gameId = data.game.id;
      state.mark = data.mark || "P1";
      saveLocal();
      showGame(data.game);
      message("Game created. Share the open game for players to join.");
      await loadOpenGames();
      startPolling();
    } catch (error) {
      message(error.message, true);
    }
  }

  async function joinGame(gameId = state.gameId) {
    if (!gameId) return;
    try {
      const data = await api({
        action: "join",
        gameId,
        playerId: state.playerId,
        playerName: state.playerName,
      });
      state.gameId = gameId;
      state.mark = data.mark || state.mark || "";
      saveLocal();
      showGame(data.game);
      startPolling();
      message(data.observer ? "Observing this game." : "Joined Starts / Ends.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function refreshGame() {
    if (!state.gameId) {
      await loadOpenGames();
      return;
    }
    try {
      const data = await api({ action: "state", gameId: state.gameId, playerId: state.playerId });
      showGame(data.game);
    } catch (error) {
      message(error.message, true);
      stopPolling();
      $("lobby").hidden = false;
      $("gamePanel").hidden = true;
      state.gameId = "";
      state.mark = "";
      saveLocal();
      await loadOpenGames();
    }
  }

  async function gameMove(extra) {
    const data = await api({
      action: "move",
      gameId: state.gameId,
      playerId: state.playerId,
      ...extra,
    });
    showGame(data.game);
    return data;
  }

  async function startGame() {
    try {
      await gameMove({ startsEndsAction: "start" });
      message("Round started.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function submitWord() {
    const word = $("wordInput").value.trim();
    if (!word) {
      message("Enter a word.", true);
      return;
    }
    try {
      await gameMove({ startsEndsAction: "guess", word });
      $("wordInput").value = "";
      message("Guess submitted.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function nextRound() {
    try {
      await gameMove({ startsEndsAction: "next" });
      $("wordInput").value = "";
      message("Ready for the next round.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function skipRound() {
    try {
      await gameMove({ startsEndsAction: "skip" });
      $("wordInput").value = "";
      message("Skipped this round.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function resetGame() {
    if (!window.confirm("Reset this Starts / Ends game?")) return;
    try {
      const data = await api({ action: "reset", gameId: state.gameId, playerId: state.playerId });
      $("wordInput").value = "";
      showGame(data.game);
      message("Game reset.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function closeGame() {
    if (!window.confirm("Close this Starts / Ends game?")) return;
    try {
      await api({ action: "delete", gameId: state.gameId, playerId: state.playerId });
      stopPolling();
      state.gameId = "";
      state.mark = "";
      state.game = null;
      saveLocal();
      $("lobby").hidden = false;
      $("gamePanel").hidden = true;
      await loadOpenGames();
      message("Game closed.");
    } catch (error) {
      message(error.message, true);
    }
  }

  function leaveGame() {
    stopPolling();
    state.gameId = "";
    state.mark = "";
    state.game = null;
    saveLocal();
    $("lobby").hidden = false;
    $("gamePanel").hidden = true;
    loadOpenGames();
  }

  function openTabletop() {
    stopPolling();
    stopSpin();
    $("lobby").hidden = true;
    $("gamePanel").hidden = true;
    $("tabletopPanel").hidden = false;
    message("Tabletop spinner mode.");
  }

  function leaveTabletop() {
    stopTabletopSpin();
    $("tabletopPanel").hidden = true;
    $("lobby").hidden = false;
    $("gamePanel").hidden = true;
    loadOpenGames();
    message("");
  }

  function startPolling() {
    stopPolling();
    state.poll = window.setInterval(refreshGame, 900);
  }

  function stopPolling() {
    if (state.poll) window.clearInterval(state.poll);
    state.poll = null;
  }

  function bind() {
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    $("tabletopMode").addEventListener("click", openTabletop);
    $("leaveTabletop").addEventListener("click", leaveTabletop);
    $("spinTabletop").addEventListener("click", startTabletopSpin);
    $("createGame").addEventListener("click", createGame);
    $("refreshGame").addEventListener("click", refreshGame);
    $("startGame").addEventListener("click", startGame);
    $("submitWord").addEventListener("click", submitWord);
    $("skipRound").addEventListener("click", skipRound);
    $("wordInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") submitWord();
    });
    $("nextRound").addEventListener("click", nextRound);
    $("resetGame").addEventListener("click", resetGame);
    $("closeGame").addEventListener("click", closeGame);
    $("leaveGame").addEventListener("click", leaveGame);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopPolling();
      else if (state.gameId) {
        refreshGame();
        startPolling();
      }
    });
  }

  loadLocal();
  bind();
  loadOpenGames().then(() => {
    if (state.gameId) joinGame(state.gameId);
  });
})();
