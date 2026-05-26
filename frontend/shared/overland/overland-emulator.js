(() => {
    const state = {
        games: [],
        systems: [],
        filter: "all",
        search: "",
        activePath: "",
        ready: false,
    }

    function ensureUi() {
        let root = document.getElementById("oeRoot")
        if (root) return root
        root = document.createElement("section")
        root.id = "oeRoot"
        root.className = "oe-root"
        root.hidden = true
        root.innerHTML = `
            <aside class="oe-sidebar">
                <div class="oe-header">
                    <h2 class="oe-title">Arcade</h2>
                    <div class="oe-actions">
                        <button id="oeFullscreen" class="oe-icon-button" type="button" title="Fullscreen game">⛶</button>
                        <button id="oeClose" class="oe-icon-button" type="button" title="Close emulator">×</button>
                    </div>
                </div>
                <div class="oe-tools">
                    <input id="oeSearch" type="search" placeholder="Search ROMs">
                    <select id="oeSystem"></select>
                </div>
                <div id="oeList" class="oe-list"></div>
            </aside>
            <main class="oe-play-area">
                <div id="oeEmpty" class="oe-empty">
                    <div class="oe-empty-card">
                        <h3>Choose a ROM</h3>
                        <p>Games run in this browser. Bluetooth or USB gamepads should work if the client browser exposes the Gamepad API.</p>
                    </div>
                </div>
            </main>`
        document.body.append(root)
        document.getElementById("oeClose").addEventListener("click", close)
        document.getElementById("oeFullscreen").addEventListener("click", fullscreenGame)
        document.getElementById("oeSearch").addEventListener("input", event => {
            state.search = event.target.value.toLowerCase()
            renderList()
        })
        document.getElementById("oeSystem").addEventListener("change", event => {
            state.filter = event.target.value
            renderList()
        })
        return root
    }

    function formatSize(bytes) {
        let value = Number(bytes || 0)
        for (const unit of ["B", "KB", "MB", "GB"]) {
            if (value < 1024 || unit === "GB") return `${value.toFixed(unit === "B" ? 0 : 1)} ${unit}`
            value /= 1024
        }
        return `${value.toFixed(1)} GB`
    }

    async function loadLibrary() {
        const response = await fetch("/roms-api/library", {cache: "no-store"})
        const data = await response.json()
        if (!data.ok) throw new Error(data.error || "Could not load ROM library.")
        state.games = data.games || []
        state.systems = data.systems || []
        state.ready = !!data.emulatorReady
        renderSystems()
        renderList()
        if (!state.ready) showInstallerMessage()
    }

    function renderSystems() {
        const select = document.getElementById("oeSystem")
        select.replaceChildren()
        select.append(new Option(`All Systems (${state.games.length})`, "all"))
        state.systems.forEach(system => {
            select.append(new Option(`${system.title} (${system.count})`, system.id))
        })
        select.value = state.filter
    }

    function visibleGames() {
        return state.games.filter(game => {
            if (state.filter !== "all" && game.system !== state.filter) return false
            if (state.search && !`${game.name} ${game.systemTitle} ${game.filename}`.toLowerCase().includes(state.search)) return false
            return true
        })
    }

    function renderList() {
        const list = document.getElementById("oeList")
        list.replaceChildren()
        visibleGames().forEach(game => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = `oe-game${game.path === state.activePath ? " oe-game--active" : ""}`
            button.innerHTML = `
                <span class="oe-badge">${game.system.slice(0, 3)}</span>
                <span>
                    <span class="oe-game-title">${escapeHtml(game.name)}</span>
                    <span class="oe-game-meta">${escapeHtml(game.systemTitle)} · ${formatSize(game.size)}</span>
                </span>
                <span class="oe-game-meta">${escapeHtml(game.core || "core?")}</span>`
            button.addEventListener("click", () => playGame(game))
            list.append(button)
        })
        if (!list.children.length) {
            const empty = document.createElement("div")
            empty.className = "oe-empty-card"
            empty.style.margin = "12px"
            empty.textContent = "No ROMs match this filter."
            list.append(empty)
        }
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#039;",
        }[char]))
    }

    function showInstallerMessage() {
        const empty = document.getElementById("oeEmpty")
        empty.hidden = false
        empty.innerHTML = `
            <div class="oe-empty-card">
                <h3>Emulator runtime is not installed yet</h3>
                <p>The ROM library is wired up, but the offline EmulatorJS runtime has not been cached on this Pi.</p>
                <p>Run once while online:</p>
                <code>sudo overland-install-emulatorjs</code>
            </div>`
    }

    function playGame(game) {
        if (!state.ready) {
            showInstallerMessage()
            return
        }
        if (!game.core) {
            showMessage("This ROM folder does not have a mapped browser emulator core yet.")
            return
        }
        state.activePath = game.path
        renderList()
        const area = document.querySelector(".oe-play-area")
        area.replaceChildren()
        const iframe = document.createElement("iframe")
        iframe.id = "oeFrame"
        iframe.className = "oe-frame"
        iframe.allow = "fullscreen; gamepad; autoplay"
        iframe.srcdoc = emulatorDocument(game)
        area.append(iframe)
    }

    function emulatorDocument(game) {
        const gameUrl = new URL(game.url, window.location.origin).href
        const dataPath = new URL("/maps/emulatorjs/data/", window.location.origin).href
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body,#game{width:100%;height:100%;margin:0;background:#000;overflow:hidden}</style>
</head>
<body>
<div id="game"></div>
<script>
window.EJS_player = "#game";
window.EJS_gameUrl = ${JSON.stringify(gameUrl)};
window.EJS_core = ${JSON.stringify(game.core)};
window.EJS_gameName = ${JSON.stringify(game.name)};
window.EJS_pathtodata = ${JSON.stringify(dataPath)};
window.EJS_startOnLoaded = true;
window.EJS_fullscreenOnLoaded = false;
window.EJS_color = "#83dc8c";
window.EJS_backgroundColor = "#000";
window.EJS_VirtualGamepadSettings = {left: "bottom", right: "bottom"};
</script>
<script src="${dataPath}loader.js"></script>
</body>
</html>`
    }

    function showMessage(message) {
        const empty = document.getElementById("oeEmpty")
        if (!empty) return
        empty.hidden = false
        empty.innerHTML = `<div class="oe-empty-card"><h3>${escapeHtml(message)}</h3></div>`
    }

    function fullscreenGame() {
        const frame = document.getElementById("oeFrame")
        const target = frame || document.getElementById("oeRoot")
        if (target && target.requestFullscreen) target.requestFullscreen()
    }

    async function open() {
        const root = ensureUi()
        root.hidden = false
        if (!state.games.length) {
            try {
                await loadLibrary()
            } catch (error) {
                showMessage(error.message || "Could not load ROM library.")
            }
        }
    }

    function close() {
        const root = document.getElementById("oeRoot")
        if (root) root.hidden = true
    }

    window.overlandEmulator = {open, close}
})()
