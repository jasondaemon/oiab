(() => {
  const storageKey = "iiab-overland-blank-slate";
  const profileStorageKey = "iiab-overland-player-profile";
  const $ = (id) => document.getElementById(id);
  const state = {
    playerId: "",
    playerName: "",
    gameId: "",
    mark: "",
    game: null,
    poll: null,
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
      renderOpenGames((Array.isArray(data.games) ? data.games : []).filter((game) => game.type === "blank-slate"));
    } catch (error) {
      $("openGames").innerHTML = `<div class="open-game"><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function renderOpenGames(games) {
    const target = $("openGames");
    if (!games.length) {
      target.innerHTML = '<div class="open-game"><span>No open Blank Slate games. Create one and others can join.</span></div>';
      return;
    }
    target.replaceChildren(...games.map((game) => {
      const row = document.createElement("div");
      row.className = "open-game";
      const names = (game.players || []).map((player) => player.name || "Player").join(", ");
      const payload = game.payload || {};
      row.innerHTML = `<div><strong>${escapeHtml(game.title || "Blank Slate")}</strong><span>${escapeHtml(names || "Waiting")} · round ${payload.round || 1} · ${(game.players || []).length}/${payload.maxPlayers || 8}</span></div>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open";
      button.addEventListener("click", () => joinGame(game.id));
      row.append(button);
      return row;
    }));
  }

  function showGame(game) {
    state.game = game;
    $("lobby").hidden = true;
    $("gamePanel").hidden = false;
    const payload = game.payload || {};
    const players = game.players || [];
    const me = players.find((player) => player.mark === state.mark);
    const winner = players.find((player) => player.mark === game.winner);
    const locked = new Set(payload.locked || []);
    const needed = Math.max(0, Number(payload.minPlayers || 3) - players.length);
    let label = game.status || "waiting";
    let headline = needed > 0 ? `Waiting for ${needed} more player${needed === 1 ? "" : "s"}.` : "Write your answer.";
    if (!me && game.status !== "waiting") {
      label = "observer";
      headline = "Watching this round.";
    }
    if (payload.phase === "revealed") {
      label = "revealed";
      headline = "Answers revealed.";
    }
    if (game.winner) {
      label = "complete";
      headline = `${winner?.name || "Player"} wins.`;
    }
    $("gameState").textContent = label;
    $("gameStatus").textContent = headline;
    $("roundLabel").textContent = `Round ${payload.round || 1}`;
    $("cueText").textContent = payload.cue || "____";
    renderPlayers(players, payload, locked);
    renderAnswerPanel(payload, me, locked);
    renderReveal(players, payload);
  }

  function renderPlayers(players, payload, locked) {
    const scores = payload.scores || {};
    const selector = payload.selectorMark || "";
    $("players").replaceChildren(...players.map((player) => {
      const card = document.createElement("article");
      const mark = player.mark || "";
      card.className = `player ${selector === mark ? "selector" : ""} ${locked.has(mark) ? "locked" : ""}`;
      const selectorText = selector === mark ? "selector" : "";
      const lockedText = locked.has(mark) ? "locked" : "writing";
      card.innerHTML = `<span>${escapeHtml(mark)} · ${escapeHtml(selectorText || lockedText)}</span><strong>${escapeHtml(player.name || "Player")}</strong><small>${Number(scores[mark] || 0)} / ${payload.targetScore || 25} pts</small>`;
      return card;
    }));
  }

  function renderAnswerPanel(payload, me, locked) {
    const collecting = payload.phase !== "revealed" && !state.game?.winner;
    const canAnswer = collecting && me && state.game?.status === "active" && !locked.has(me.mark);
    $("answerPanel").hidden = !collecting || !me || state.game?.status !== "active";
    $("answerInput").disabled = !canAnswer;
    $("lockAnswer").disabled = !canAnswer;
    if (payload.myAnswer && document.activeElement !== $("answerInput")) {
      $("answerInput").value = payload.myAnswer;
    } else if (!payload.myAnswer && locked.has(me?.mark)) {
      $("answerInput").value = "";
    }
    $("lockAnswer").textContent = locked.has(me?.mark) ? "Locked" : "Lock In";
  }

  function renderReveal(players, payload) {
    const revealed = payload.phase === "revealed" || state.game?.winner;
    $("revealPanel").hidden = !revealed;
    if (!revealed) return;
    const answers = payload.answers || {};
    const roundScores = payload.roundScores || {};
    $("answersList").replaceChildren(...players.map((player) => {
      const mark = player.mark || "";
      const row = document.createElement("article");
      row.className = "answer-row";
      row.innerHTML = `<div><strong>${escapeHtml(player.name || "Player")}</strong><span>${escapeHtml(answers[mark] || "No answer")}</span></div><div class="answer-points">+${Number(roundScores[mark] || 0)}</div>`;
      return row;
    }));
    $("nextRound").hidden = Boolean(state.game?.winner);
  }

  async function createGame() {
    try {
      const data = await api({
        action: "create",
        game: "blank-slate",
        playerId: state.playerId,
        playerName: state.playerName,
      });
      state.gameId = data.game.id;
      state.mark = data.mark || "P1";
      saveLocal();
      showGame(data.game);
      message("Blank Slate game created. 3 players minimum.");
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
      message(data.observer ? "Observing this game." : "Joined Blank Slate.");
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

  async function lockAnswer() {
    const answer = $("answerInput").value.trim();
    if (!answer) {
      message("Enter an answer.", true);
      return;
    }
    try {
      const data = await api({
        action: "move",
        gameId: state.gameId,
        playerId: state.playerId,
        answer,
      });
      showGame(data.game);
      message("Answer locked.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function nextRound() {
    try {
      const data = await api({
        action: "next-round",
        gameId: state.gameId,
        playerId: state.playerId,
      });
      $("answerInput").value = "";
      showGame(data.game);
      message("New round started.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function resetGame() {
    if (!window.confirm("Reset this Blank Slate game?")) return;
    try {
      const data = await api({ action: "reset", gameId: state.gameId, playerId: state.playerId });
      $("answerInput").value = "";
      showGame(data.game);
      message("Game reset.");
    } catch (error) {
      message(error.message, true);
    }
  }

  async function closeGame() {
    if (!window.confirm("Close this Blank Slate game?")) return;
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

  function startPolling() {
    stopPolling();
    state.poll = window.setInterval(refreshGame, 2200);
  }

  function stopPolling() {
    if (state.poll) window.clearInterval(state.poll);
    state.poll = null;
  }

  function bind() {
    $("createGame").addEventListener("click", createGame);
    $("refreshGame").addEventListener("click", refreshGame);
    $("lockAnswer").addEventListener("click", lockAnswer);
    $("answerInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") lockAnswer();
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
