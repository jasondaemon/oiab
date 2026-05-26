/* IIAB Overland offline trivia game. */

(() => {
    const storageKey = "iiab-overland-trivia-v2"
    const legacyStorageKey = "iiab-overland-trivia-v1"
    const profileStorageKey = "iiab-overland-player-profile"
    const questionBase = "/maps/overland/trivia/questions/"
    const difficultyLevels = [
        {id: "easy", label: "Easy", points: 100},
        {id: "medium", label: "Medium", points: 300},
        {id: "hard", label: "Hard", points: 500},
    ]
    const pointSlots = [
        {id: "p100", difficulty: "easy", label: "Easy", points: 100},
        {id: "p200", difficulty: "medium", label: "Medium", points: 200},
        {id: "p300", difficulty: "medium", label: "Medium", points: 300},
        {id: "p400", difficulty: "hard", label: "Hard", points: 400},
        {id: "p500", difficulty: "hard", label: "Hard", points: 500},
    ]
    const boardCategoryCount = 6
    const minPartyPlayers = 1
    const maxPartyPlayers = 4
    const devMode = ["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.search.includes("triviaDebug=1")

    const trivia = {
        manifest: null,
        categories: [],
        byId: new Map(),
        loaded: false,
        selectedCategory: "",
        state: defaultState(),
        recordingResult: false,
    }

    function warn(...args) {
        if (devMode) console.warn("[overland-trivia]", ...args)
    }

    function defaultState() {
        return {
            version: 2,
            mode: "party",
            gameId: randomId("trivia"),
            started: false,
            players: [
                {id: playerIdFromName("Player 1", 0), name: "Player 1", score: 0},
                {id: playerIdFromName("Player 2", 1), name: "Player 2", score: 0},
            ],
            currentPlayerIndex: 0,
            usedQuestionIds: [],
            board: [],
            activeQuestionId: "",
            activeQuestionPoints: 0,
            activeQuestionSlot: "",
            answerResult: null,
            hostSet: [],
            resultRecorded: false,
        }
    }

    function ensureUi() {
        let root = document.getElementById("otRoot")
        if (root) return root
        root = document.createElement("section")
        root.id = "otRoot"
        root.className = "ot-root"
        root.hidden = true
        root.innerHTML = `
            <div class="ot-shell">
                <header class="ot-toolbar">
                    <div>
                        <h2>Trail Trivia</h2>
                        <span id="otStatus">Offline family trivia</span>
                    </div>
                    <div class="ot-toolbar-actions">
                        <button id="otNewGame" class="ot-button" type="button">New Game</button>
                        <button id="otClose" class="ot-icon-button" type="button" title="Close">×</button>
                    </div>
                </header>
                <main id="otMain" class="ot-main"></main>
                <div id="otMessage" class="ot-message" hidden></div>
            </div>`
        document.body.append(root)
        document.getElementById("otClose").addEventListener("click", close)
        document.getElementById("otNewGame").addEventListener("click", () => renderResetConfirm())
        return root
    }

    async function open() {
        ensureUi().hidden = false
        loadState()
        render()
        if (!trivia.loaded) {
            await loadQuestions()
            render()
        }
    }

    function close() {
        const root = document.getElementById("otRoot")
        if (root) root.hidden = true
    }

    async function loadQuestions() {
        try {
            const manifest = await fetchJson(`${questionBase}manifest.json`)
            const files = Array.isArray(manifest.categories) ? manifest.categories : []
            const categories = []
            const ids = new Set()
            const skipped = []
            trivia.byId.clear()

            for (const entry of files) {
                if (!entry?.file) continue
                let data = null
                try {
                    data = await fetchJson(`${questionBase}${entry.file}`)
                } catch (error) {
                    skipped.push(`${entry.file}: ${error.message}`)
                    warn("category file skipped", entry.file, error)
                    continue
                }
                const valid = []
                for (const item of Array.isArray(data.questions) ? data.questions : []) {
                    const question = normalizeQuestion(item, data.category || entry.category)
                    if (!question) continue
                    if (ids.has(question.id)) {
                        warn("duplicate question id skipped", question.id)
                        continue
                    }
                    ids.add(question.id)
                    valid.push(question)
                    trivia.byId.set(question.id, question)
                }
                categories.push({
                    name: data.category || entry.category || entry.file.replace(/\.json$/, ""),
                    file: entry.file,
                    questions: valid,
                    buckets: bucketQuestions(valid),
                })
            }

            trivia.manifest = manifest
            trivia.categories = categories.filter(category => category.questions.length)
            trivia.loaded = true
            if (!trivia.selectedCategory && trivia.categories.length) trivia.selectedCategory = trivia.categories[0].name
            message(skipped.length ? `${validQuestionCount()} questions loaded. ${skipped.length} file(s) skipped.` : `${validQuestionCount()} questions loaded.`)
        } catch (error) {
            message(`Trivia questions failed to load: ${error.message}`, true)
        }
    }

    async function fetchJson(url) {
        const response = await fetch(url, {cache: "no-store"})
        if (!response.ok) throw new Error(`${url} returned ${response.status}`)
        return response.json()
    }

    function normalizeQuestion(item, fallbackCategory) {
        if (!item || typeof item !== "object") return null
        const answers = Array.isArray(item.answers) ? item.answers.map(value => String(value ?? "").trim()) : []
        const difficulty = String(item.difficulty || "").toLowerCase()
        const points = difficultyLevels.find(diff => diff.id === difficulty)?.points
        if (!item.id || !item.question || !item.category && !fallbackCategory || !["easy", "medium", "hard"].includes(difficulty)) {
            warn("malformed question skipped", item)
            return null
        }
        if (answers.length !== 4 || answers.some(answer => !answer) || !Number.isInteger(item.correct) || item.correct < 0 || item.correct > 3) {
            warn("malformed answers skipped", item.id)
            return null
        }
        return {
            id: String(item.id),
            category: String(item.category || fallbackCategory),
            difficulty,
            points: Number(item.points || points),
            question: String(item.question),
            answers,
            correct: item.correct,
            explanation: String(item.explanation || ""),
        }
    }

    function bucketQuestions(questions) {
        const buckets = {easy: [], medium: [], hard: []}
        questions.forEach(question => buckets[question.difficulty]?.push(question))
        return buckets
    }

    function validQuestionCount() {
        return trivia.categories.reduce((sum, category) => sum + category.questions.length, 0)
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || "null"
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === "object") {
                trivia.state = sanitizeState(parsed)
                return
            }
        } catch (error) {
            warn("state load failed", error)
        }
        trivia.state = defaultState()
    }

    function sanitizeState(value) {
        const state = {...defaultState(), ...value}
        state.mode = ["party", "solo", "host"].includes(value.mode) ? value.mode : "party"
        state.gameId = String(value.gameId || randomId("trivia")).slice(0, 80)
        state.players = sanitizePlayers(value.players, state.mode)
        state.currentPlayerIndex = Math.max(0, Math.min(Number(state.currentPlayerIndex || 0), Math.max(0, state.players.length - 1)))
        state.usedQuestionIds = Array.isArray(value.usedQuestionIds) ? [...new Set(value.usedQuestionIds.map(String))] : []
        state.board = Array.isArray(value.board) ? value.board.map(sanitizeBoardCategory).filter(Boolean) : []
        state.activeQuestionId = String(value.activeQuestionId || "")
        state.activeQuestionPoints = Math.max(0, Number(value.activeQuestionPoints || 0))
        state.activeQuestionSlot = String(value.activeQuestionSlot || "")
        state.answerResult = value.answerResult && typeof value.answerResult === "object" ? value.answerResult : null
        state.hostSet = Array.isArray(value.hostSet) ? value.hostSet.map(String).slice(0, 4) : []
        state.resultRecorded = Boolean(value.resultRecorded)
        state.started = Boolean(value.started)
        return state
    }

    function sanitizePlayers(players, mode) {
        if (mode === "host") return []
        const fallback = mode === "solo" ? [profilePlayer()] : defaultState().players
        const maxPlayers = mode === "solo" ? 1 : maxPartyPlayers
        const cleaned = Array.isArray(players) ? players.slice(0, maxPlayers).map((player, index) => ({
            id: String(player?.id || playerIdFromName(player?.name || `Player ${index + 1}`, index)).slice(0, 80),
            name: String(player?.name || `Player ${index + 1}`).slice(0, 28),
            score: Number(player?.score || 0),
        })) : fallback
        if (mode === "solo") return cleaned.length ? [cleaned[0]] : [profilePlayer()]
        return cleaned.length >= minPartyPlayers ? cleaned : [profilePlayer()]
    }

    function sanitizeBoardCategory(category) {
        if (!category || typeof category !== "object") return null
        const slots = {}
        pointSlots.forEach(slot => {
            slots[slot.id] = String(category.slots?.[slot.id] || "")
        })
        return {
            name: String(category.name || ""),
            slots,
        }
    }

    function saveState() {
        localStorage.setItem(storageKey, JSON.stringify(trivia.state))
        localStorage.removeItem(legacyStorageKey)
    }

    function resetState() {
        localStorage.removeItem(storageKey)
        localStorage.removeItem(legacyStorageKey)
        trivia.state = defaultState()
        render()
        message("Trivia game reset.")
    }

    function render() {
        const root = ensureUi()
        const main = document.getElementById("otMain")
        const modeLabel = trivia.state.mode === "host" ? "Question host" : trivia.state.mode === "solo" ? "Solo run" : `${currentPlayer().name}'s turn`
        document.getElementById("otStatus").textContent = trivia.state.started ? modeLabel : "Offline family trivia"
        document.getElementById("otNewGame").hidden = !trivia.state.started

        if (!trivia.loaded) {
            main.innerHTML = `<div class="ot-loading">Loading offline trivia questions...</div>`
            return root
        }
        if (!trivia.state.started) {
            renderSetup(main)
            return root
        }
        if (trivia.state.mode === "host") {
            renderHost(main)
            return root
        }
        if (trivia.state.activeQuestionId) {
            renderQuestion(main)
            return root
        }
        renderBoard(main)
        return root
    }

    function renderSetup(main) {
        const activeMode = ["party", "solo", "host"].includes(trivia.state.mode) ? trivia.state.mode : "party"
        main.innerHTML = `
            <section class="ot-setup">
                <div class="ot-setup-card">
                    <span class="ot-kicker">Setup</span>
                    <h3>Choose Mode</h3>
                    <div class="ot-mode-grid" id="otModeGrid">
                        ${modeCard("party", "Family Board", "1-4 players. Correct keeps the turn. Wrong loses points and passes.")}
                        ${modeCard("solo", "Solo Run", "One player. Score as many points as possible on a full board.")}
                        ${modeCard("host", "Car Host", "One person reads four questions and answers. No scoring.")}
                    </div>
                    <div id="otModeSetup"></div>
                    <button id="otStart" class="ot-button ot-button--primary" type="button">Start Trivia</button>
                </div>
                <aside class="ot-pack-card">
                    <span class="ot-kicker">Question Pack</span>
                    <strong>${validQuestionCount().toLocaleString()}</strong>
                    <span>${trivia.categories.length} categories · easy / medium / hard</span>
                    <small>Manage JSON files in File Uploads at /data/trivia/questions.</small>
                </aside>
            </section>`

        const setup = {mode: activeMode, count: Math.max(minPartyPlayers, Math.min(trivia.state.players.length || 2, maxPartyPlayers))}
        const setupTarget = document.getElementById("otModeSetup")
        const modeGrid = document.getElementById("otModeGrid")

        function drawModeSetup() {
            modeGrid.querySelectorAll(".ot-mode-card").forEach(button => {
                button.classList.toggle("ot-mode-card--selected", button.dataset.mode === setup.mode)
            })
            if (setup.mode === "party") {
                setupTarget.innerHTML = `
                    <div class="ot-count-picker" id="otCountPicker"></div>
                    <div class="ot-name-grid" id="otNameGrid"></div>`
                drawPartyFields()
                return
            }
            if (setup.mode === "solo") {
                const player = profilePlayer()
                setupTarget.innerHTML = `
                    <div class="ot-solo-card">
                        <span class="ot-kicker">Solo Player</span>
                        <strong>${escapeHtml(player.name)}</strong>
                        <span>Uses your mobile launcher name for score tracking.</span>
                    </div>`
                return
            }
            setupTarget.innerHTML = `
                <div class="ot-solo-card">
                    <span class="ot-kicker">Question Host</span>
                    <strong>No Score Tracking</strong>
                    <span>Shows four questions from different categories with answers visible for a passenger-led round.</span>
                </div>`
        }

        function drawPartyFields() {
            const countPicker = document.getElementById("otCountPicker")
            const nameGrid = document.getElementById("otNameGrid")
            countPicker.replaceChildren()
            for (let count = minPartyPlayers; count <= maxPartyPlayers; count += 1) {
                const button = document.createElement("button")
                button.type = "button"
                button.className = `ot-count-button${count === setup.count ? " ot-count-button--selected" : ""}`
                button.textContent = String(count)
                button.addEventListener("click", () => {
                    setup.count = count
                    drawPartyFields()
                })
                countPicker.append(button)
            }

            nameGrid.replaceChildren()
            for (let index = 0; index < setup.count; index += 1) {
                const label = document.createElement("label")
                label.textContent = `Player ${index + 1}`
                const input = document.createElement("input")
                input.type = "text"
                input.maxLength = 28
                input.value = trivia.state.players[index]?.name || (index === 0 ? profilePlayer().name : `Player ${index + 1}`)
                input.dataset.playerIndex = String(index)
                label.append(input)
                nameGrid.append(label)
            }
        }

        modeGrid.querySelectorAll(".ot-mode-card").forEach(button => {
            button.addEventListener("click", () => {
                setup.mode = button.dataset.mode || "party"
                drawModeSetup()
            })
        })

        drawModeSetup()
        document.getElementById("otStart").addEventListener("click", () => {
            if (setup.mode === "host") {
                trivia.state = {
                    ...defaultState(),
                    mode: "host",
                    gameId: randomId("trivia-host"),
                    started: true,
                    players: [],
                    hostSet: buildHostSet(),
                }
            } else if (setup.mode === "solo") {
                trivia.state = {
                    ...defaultState(),
                    mode: "solo",
                    gameId: randomId("trivia-solo"),
                    started: true,
                    players: [profilePlayer()],
                }
                trivia.state.board = buildBoard()
            } else {
                const inputs = Array.from(document.querySelectorAll("#otNameGrid input"))
                trivia.state = {
                    ...defaultState(),
                    mode: "party",
                    gameId: randomId("trivia-party"),
                    started: true,
                    players: inputs.map((input, index) => {
                        const name = input.value.trim() || `Player ${index + 1}`
                        return {id: playerIdFromName(name, index), name, score: 0}
                    }),
                }
                trivia.state.board = buildBoard()
            }
            saveState()
            render()
        })
    }

    function modeCard(id, title, text) {
        return `
            <button class="ot-mode-card" data-mode="${id}" type="button">
                <strong>${title}</strong>
                <span>${text}</span>
            </button>`
    }

    function renderBoard(main) {
        if (!trivia.state.board.length || !boardHasLiveSlots()) {
            trivia.state.board = buildBoard()
            trivia.state.usedQuestionIds = []
            trivia.state.resultRecorded = false
            saveState()
        }
        const answeredCount = boardSlots().filter(slot => trivia.state.usedQuestionIds.includes(slot.questionId)).length
        const totalSlots = boardSlots().length
        const allAnswered = totalSlots > 0 && answeredCount >= totalSlots
        if (allAnswered) recordCompletedGame()
        const turnMessage = trivia.state.mode === "solo"
            ? allAnswered ? "Solo board complete. Start a new run for a fresh board." : "Wrong answers subtract points, but the run continues."
            : allAnswered ? "Board complete. Start a new game for a fresh board." : "Correct keeps the turn. Wrong loses points and passes it."
        main.innerHTML = `
            <section class="ot-game">
                <aside class="ot-scoreboard" id="otScoreboard"></aside>
                <section class="ot-board-wrap">
                    <div class="ot-turn-card">
                        <span class="ot-kicker">${trivia.state.mode === "solo" ? "Solo Run" : "Current Turn"}</span>
                        <strong>${escapeHtml(currentPlayer().name)}</strong>
                        <span>${turnMessage}</span>
                    </div>
                    <div class="ot-board" id="otBoard"></div>
                </section>
            </section>`
        renderScoreboard()
        const board = document.getElementById("otBoard")
        trivia.state.board.forEach(category => {
            const card = document.createElement("article")
            card.className = "ot-category"
            const title = document.createElement("h3")
            title.textContent = category.name
            card.append(title)
            pointSlots.forEach(slot => {
                const questionId = category.slots[slot.id]
                const used = questionId && trivia.state.usedQuestionIds.includes(questionId)
                const button = document.createElement("button")
                button.type = "button"
                button.className = `ot-tile${used ? " ot-tile--used" : ""}${!questionId ? " ot-tile--empty" : ""}`
                button.disabled = !questionId || used
                button.innerHTML = questionId
                    ? `<strong>${slot.points}</strong><span>${used ? "answered" : slot.label}</span>`
                    : `<strong>${slot.points}</strong><span>empty</span>`
                button.addEventListener("click", () => chooseQuestion(questionId, slot))
                card.append(button)
            })
            board.append(card)
        })
        if (allAnswered) {
            message(trivia.state.resultRecorded ? "Board complete. Score saved." : "Board complete. Saving score...")
        }
    }

    function renderScoreboard() {
        const scoreboard = document.getElementById("otScoreboard")
        if (!scoreboard) return
        scoreboard.replaceChildren()
        trivia.state.players.forEach((player, index) => {
            const row = document.createElement("div")
            row.className = `ot-score${index === trivia.state.currentPlayerIndex ? " ot-score--active" : ""}`
            row.innerHTML = `<span>${escapeHtml(player.name)}</span><strong>${player.score.toLocaleString()}</strong>`
            scoreboard.append(row)
        })
    }

    function buildBoard() {
        const eligible = trivia.categories.filter(category => category.questions.length && pointSlots.some(slot => category.buckets[slot.difficulty]?.length))
        const complete = eligible.filter(category => pointSlots.every(slot => category.buckets[slot.difficulty]?.length))
        const source = complete.length >= boardCategoryCount ? complete : eligible
        return shuffle(source)
            .slice(0, Math.min(boardCategoryCount, source.length))
            .map(category => {
                const slots = {}
                const categoryUsed = new Set()
                pointSlots.forEach(slot => {
                    const bucket = shuffle(category.buckets[slot.difficulty] || []).filter(question => !categoryUsed.has(question.id))
                    slots[slot.id] = bucket.length ? bucket[0].id : ""
                    if (slots[slot.id]) categoryUsed.add(slots[slot.id])
                })
                return {name: category.name, slots}
            })
    }

    function buildHostSet() {
        const source = shuffle(trivia.categories.filter(category => category.questions.length)).slice(0, 4)
        return source.map(category => shuffle(category.questions)[0]?.id).filter(Boolean)
    }

    function boardSlots() {
        return trivia.state.board.flatMap(category => pointSlots
            .map(slot => ({category: category.name, slot: slot.id, difficulty: slot.difficulty, points: slot.points, questionId: category.slots[slot.id]}))
            .filter(slot => slot.questionId))
    }

    function boardHasLiveSlots() {
        return boardSlots().some(slot => trivia.byId.has(slot.questionId))
    }

    function chooseQuestion(questionId, slot = null) {
        if (!questionId || trivia.state.usedQuestionIds.includes(questionId)) return
        const question = trivia.byId.get(questionId)
        if (!question) return
        const resolvedSlot = slot || boardSlots().find(item => item.questionId === questionId)
        trivia.state.activeQuestionId = question.id
        trivia.state.activeQuestionPoints = Number(resolvedSlot?.points || question.points || 0)
        trivia.state.activeQuestionSlot = String(resolvedSlot?.slot || "")
        trivia.state.answerResult = null
        trivia.state.usedQuestionIds = [...new Set([...trivia.state.usedQuestionIds, question.id])]
        saveState()
        render()
    }

    function renderQuestion(main) {
        const question = trivia.byId.get(trivia.state.activeQuestionId)
        if (!question) {
            trivia.state.activeQuestionId = ""
            trivia.state.activeQuestionPoints = 0
            trivia.state.activeQuestionSlot = ""
            trivia.state.answerResult = null
            saveState()
            renderBoard(main)
            return
        }
        const result = trivia.state.answerResult
        const points = activeQuestionPoints(question)
        main.innerHTML = `
            <section class="ot-question-screen">
                <aside class="ot-scoreboard" id="otScoreboard"></aside>
                <article class="ot-question-card">
                    <div class="ot-question-meta">
                        <span>${escapeHtml(question.category)}</span>
                        <strong>${points}</strong>
                        <span>${escapeHtml(currentPlayer().name)}</span>
                    </div>
                    <h3>${escapeHtml(question.question)}</h3>
                    <div class="ot-answers" id="otAnswers"></div>
                    <div id="otFeedback" class="ot-feedback" ${result ? "" : "hidden"}></div>
                </article>
            </section>`
        renderScoreboard()
        const answers = document.getElementById("otAnswers")
        question.answers.forEach((answer, index) => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "ot-answer"
            button.disabled = Boolean(result)
            button.textContent = answer
            if (result) {
                if (index === question.correct) button.classList.add("ot-answer--correct")
                if (index === result.chosen && index !== question.correct) button.classList.add("ot-answer--wrong")
            }
            button.addEventListener("click", () => answerQuestion(index))
            answers.append(button)
        })
        if (result) renderFeedback(question, result)
    }

    function answerQuestion(chosen) {
        const question = trivia.byId.get(trivia.state.activeQuestionId)
        if (!question || trivia.state.answerResult) return
        const points = activeQuestionPoints(question)
        const correct = chosen === question.correct
        if (correct) {
            trivia.state.players[trivia.state.currentPlayerIndex].score += points
        } else {
            trivia.state.players[trivia.state.currentPlayerIndex].score -= points
        }
        trivia.state.answerResult = {chosen, correct}
        saveState()
        render()
    }

    function renderFeedback(question, result) {
        const feedback = document.getElementById("otFeedback")
        if (!feedback) return
        feedback.hidden = false
        const nextName = trivia.state.mode === "solo" ? currentPlayer().name : trivia.state.players[(trivia.state.currentPlayerIndex + 1) % trivia.state.players.length].name
        const keepText = trivia.state.mode === "solo" ? "Keep going." : `${escapeHtml(currentPlayer().name)} keeps the turn.`
        const missText = trivia.state.mode === "solo" ? "Keep going." : `Next turn: ${escapeHtml(nextName)}.`
        const points = activeQuestionPoints(question)
        feedback.className = `ot-feedback ${result.correct ? "ot-feedback--correct" : "ot-feedback--wrong"}`
        feedback.innerHTML = `
            <strong>${result.correct ? "Correct" : `Wrong · Correct answer: ${escapeHtml(question.answers[question.correct])}`}</strong>
            <p>${escapeHtml(question.explanation || "No explanation provided.")}</p>
            <span>${result.correct ? `+${points}. ${keepText}` : `-${points}. ${missText}`}</span>
            <button id="otContinue" class="ot-button ot-button--primary" type="button">Continue</button>`
        document.getElementById("otContinue").addEventListener("click", continueAfterAnswer)
    }

    function continueAfterAnswer() {
        if (trivia.state.mode === "party" && trivia.state.answerResult && !trivia.state.answerResult.correct) {
            trivia.state.currentPlayerIndex = (trivia.state.currentPlayerIndex + 1) % trivia.state.players.length
        }
        trivia.state.activeQuestionId = ""
        trivia.state.activeQuestionPoints = 0
        trivia.state.activeQuestionSlot = ""
        trivia.state.answerResult = null
        saveState()
        render()
    }

    function activeQuestionPoints(question) {
        return Math.max(0, Number(trivia.state.activeQuestionPoints || question?.points || 0))
    }

    function renderHost(main) {
        if (!trivia.state.hostSet.length) {
            trivia.state.hostSet = buildHostSet()
            saveState()
        }
        const questions = trivia.state.hostSet.map(id => trivia.byId.get(id)).filter(Boolean)
        main.innerHTML = `
            <section class="ot-host-screen">
                <div class="ot-host-head">
                    <div>
                        <span class="ot-kicker">Question Host</span>
                        <h3>Read Aloud Round</h3>
                    </div>
                    <button id="otNewHostSet" class="ot-button ot-button--primary" type="button">New 4 Questions</button>
                </div>
                <div class="ot-host-grid" id="otHostGrid"></div>
            </section>`
        const grid = document.getElementById("otHostGrid")
        questions.forEach(question => {
            const card = document.createElement("article")
            card.className = "ot-host-card"
            card.innerHTML = `
                <span>${escapeHtml(question.category)} · ${question.points}</span>
                <h4>${escapeHtml(question.question)}</h4>
                <strong>${escapeHtml(question.answers[question.correct])}</strong>
                <p>${escapeHtml(question.explanation || "")}</p>`
            grid.append(card)
        })
        if (!questions.length) {
            grid.innerHTML = `<article class="ot-host-card"><h4>No questions loaded.</h4><p>Check the trivia JSON files.</p></article>`
        }
        document.getElementById("otNewHostSet").addEventListener("click", () => {
            trivia.state.hostSet = buildHostSet()
            saveState()
            render()
        })
    }

    async function recordCompletedGame() {
        if (trivia.state.mode === "host" || trivia.state.resultRecorded || trivia.recordingResult) return
        trivia.recordingResult = true
        const payload = {
            action: "record-trivia",
            matchId: trivia.state.gameId,
            mode: trivia.state.mode,
            players: trivia.state.players.map(player => ({
                id: player.id,
                name: player.name,
                score: Number(player.score || 0),
            })),
            usedCount: trivia.state.usedQuestionIds.length,
            boardSize: boardSlots().length,
        }
        try {
            await gameStatsApi(payload)
            trivia.state.resultRecorded = true
            saveState()
            message("Board complete. Score saved.")
        } catch (error) {
            warn("score save failed", error)
            message(`Board complete, but score save failed: ${error.message}`, true)
        } finally {
            trivia.recordingResult = false
        }
    }

    async function gameStatsApi(payload) {
        const endpoints = ["/game-stats", "/api/game-stats"]
        let lastError = null
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(payload),
                })
                const data = await response.json().catch(() => ({}))
                if (!response.ok || data.ok === false) throw new Error(data.error || `${endpoint} returned ${response.status}`)
                return data
            } catch (error) {
                lastError = error
            }
        }
        throw lastError || new Error("Game stats endpoint failed.")
    }

    function renderResetConfirm() {
        const main = document.getElementById("otMain")
        main.innerHTML = `
            <section class="ot-reset">
                <div class="ot-reset-card">
                    <span class="ot-kicker">Reset Game</span>
                    <h3>Clear the current trivia game?</h3>
                    <p>This only clears Trail Trivia local game state on this browser.</p>
                    <div class="ot-reset-actions">
                        <button id="otCancelReset" class="ot-button" type="button">Cancel</button>
                        <button id="otConfirmReset" class="ot-button ot-button--danger" type="button">Reset Game</button>
                    </div>
                </div>
            </section>`
        document.getElementById("otCancelReset").addEventListener("click", render)
        document.getElementById("otConfirmReset").addEventListener("click", resetState)
    }

    function currentPlayer() {
        return trivia.state.players[trivia.state.currentPlayerIndex] || trivia.state.players[0] || profilePlayer()
    }

    function profilePlayer() {
        const profile = readProfile()
        const id = profile.id || randomId("player")
        const name = String(profile.name || queryValue("playerName") || "Player").slice(0, 28)
        saveProfile({id, name})
        return {id, name, score: 0}
    }

    function readProfile() {
        try {
            const profile = JSON.parse(localStorage.getItem(profileStorageKey) || "{}")
            const queryId = queryValue("playerId")
            const queryName = queryValue("playerName")
            return {
                id: queryId || String(profile.id || ""),
                name: queryName || String(profile.name || ""),
            }
        } catch (error) {
            return {id: queryValue("playerId"), name: queryValue("playerName")}
        }
    }

    function saveProfile(profile) {
        if (!profile?.id) return
        localStorage.setItem(profileStorageKey, JSON.stringify({
            id: String(profile.id),
            name: String(profile.name || "Player").slice(0, 28),
        }))
    }

    function queryValue(name) {
        return new URLSearchParams(window.location.search).get(name) || ""
    }

    function playerIdFromName(name, index = 0) {
        const slug = String(name || `Player ${index + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `player-${index + 1}`
        return `trivia-name-${slug}`
    }

    function randomId(prefix = "trivia") {
        if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    }

    function message(text, isError = false) {
        const node = document.getElementById("otMessage")
        if (!node) return
        node.textContent = text
        node.classList.toggle("ot-message--error", isError)
        node.hidden = false
        clearTimeout(message.timer)
        message.timer = setTimeout(() => {
            node.hidden = true
        }, 2400)
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#039;",
        }[char]))
    }

    function shuffle(items) {
        const copy = items.slice()
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1))
            ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
        }
        return copy
    }

    window.overlandTrivia = {open, close, loadQuestions}
})()
