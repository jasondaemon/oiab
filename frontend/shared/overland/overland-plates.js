(() => {
    const states = [
        {code: "AK", name: "Alaska", row: 1, col: 1},
        {code: "ME", name: "Maine", row: 1, col: 12},
        {code: "VT", name: "Vermont", row: 2, col: 10},
        {code: "NH", name: "New Hampshire", row: 2, col: 11},
        {code: "WA", name: "Washington", row: 3, col: 1},
        {code: "MT", name: "Montana", row: 3, col: 2},
        {code: "ND", name: "North Dakota", row: 3, col: 3},
        {code: "MN", name: "Minnesota", row: 3, col: 4},
        {code: "WI", name: "Wisconsin", row: 3, col: 5},
        {code: "MI", name: "Michigan", row: 3, col: 6},
        {code: "NY", name: "New York", row: 3, col: 9},
        {code: "MA", name: "Massachusetts", row: 3, col: 10},
        {code: "RI", name: "Rhode Island", row: 3, col: 11},
        {code: "OR", name: "Oregon", row: 4, col: 1},
        {code: "ID", name: "Idaho", row: 4, col: 2},
        {code: "SD", name: "South Dakota", row: 4, col: 3},
        {code: "IA", name: "Iowa", row: 4, col: 4},
        {code: "IL", name: "Illinois", row: 4, col: 5},
        {code: "IN", name: "Indiana", row: 4, col: 6},
        {code: "OH", name: "Ohio", row: 4, col: 7},
        {code: "PA", name: "Pennsylvania", row: 4, col: 8},
        {code: "NJ", name: "New Jersey", row: 4, col: 9},
        {code: "CT", name: "Connecticut", row: 4, col: 10},
        {code: "WY", name: "Wyoming", row: 5, col: 2},
        {code: "NE", name: "Nebraska", row: 5, col: 3},
        {code: "MO", name: "Missouri", row: 5, col: 4},
        {code: "KY", name: "Kentucky", row: 5, col: 5},
        {code: "WV", name: "West Virginia", row: 5, col: 6},
        {code: "VA", name: "Virginia", row: 5, col: 7},
        {code: "MD", name: "Maryland", row: 5, col: 8},
        {code: "DE", name: "Delaware", row: 5, col: 9},
        {code: "CA", name: "California", row: 6, col: 1},
        {code: "NV", name: "Nevada", row: 6, col: 2},
        {code: "UT", name: "Utah", row: 6, col: 3},
        {code: "CO", name: "Colorado", row: 6, col: 4},
        {code: "KS", name: "Kansas", row: 6, col: 5},
        {code: "AR", name: "Arkansas", row: 6, col: 6},
        {code: "TN", name: "Tennessee", row: 6, col: 7},
        {code: "NC", name: "North Carolina", row: 6, col: 8},
        {code: "SC", name: "South Carolina", row: 6, col: 9},
        {code: "AZ", name: "Arizona", row: 7, col: 2},
        {code: "NM", name: "New Mexico", row: 7, col: 3},
        {code: "OK", name: "Oklahoma", row: 7, col: 5},
        {code: "LA", name: "Louisiana", row: 7, col: 6},
        {code: "MS", name: "Mississippi", row: 7, col: 7},
        {code: "AL", name: "Alabama", row: 7, col: 8},
        {code: "GA", name: "Georgia", row: 7, col: 9},
        {code: "TX", name: "Texas", row: 8, col: 4, wide: true},
        {code: "FL", name: "Florida", row: 8, col: 10, wide: true},
        {code: "HI", name: "Hawaii", row: 9, col: 1},
        {code: "DC", name: "District of Columbia", row: 9, col: 8},
    ]

    const stateByCode = new Map(states.map(state => [state.code, state]))
    const tracker = {
        data: {states: {}, seenCount: 0, totalCount: states.length},
        selected: "",
    }

    function ensureUi() {
        let root = document.getElementById("opRoot")
        if (root) return root
        root = document.createElement("section")
        root.id = "opRoot"
        root.className = "op-root"
        root.hidden = true
        root.innerHTML = `
            <div class="op-shell">
                <header class="op-toolbar">
                    <div>
                        <h2>License Plates</h2>
                        <span id="opUpdated">Shared tracker saved on this Pi</span>
                    </div>
                    <div class="op-actions">
                        <button id="opRefresh" class="op-button" type="button">Refresh</button>
                        <button id="opReset" class="op-button op-button--danger" type="button">Reset</button>
                        <button id="opClose" class="op-icon-button" type="button" title="Close">×</button>
                    </div>
                </header>
                <main class="op-content">
                    <section class="op-map-card">
                        <div class="op-progress">
                            <strong id="opProgressText">0 / 51</strong>
                            <span id="opPercent">0%</span>
                            <div class="op-progress-bar"><span id="opProgressBar"></span></div>
                        </div>
                        <div id="opMap" class="op-map" aria-label="US license plate state map"></div>
                    </section>
                    <aside class="op-detail">
                        <button id="opDetailClose" class="op-detail-close" type="button" title="Close state details">×</button>
                        <div id="opDetailEmpty" class="op-empty">Tap a state to mark a plate as seen.</div>
                        <div id="opDetailBody" hidden>
                            <span class="op-kicker">Selected</span>
                            <h3 id="opStateName"></h3>
                            <div class="op-state-code" id="opStateCode"></div>
                            <dl class="op-stats">
                                <div><dt>Seen</dt><dd id="opStateSeen">No</dd></div>
                                <div><dt>Count</dt><dd id="opStateCount">0</dd></div>
                                <div><dt>First</dt><dd id="opFirstSeen">-</dd></div>
                                <div><dt>Last</dt><dd id="opLastSeen">-</dd></div>
                            </dl>
                            <div class="op-detail-actions">
                                <button id="opToggle" class="op-button op-button--primary" type="button">Toggle Seen</button>
                                <button id="opIncrement" class="op-button" type="button">+ Another</button>
                            </div>
                            <label class="op-notes-label" for="opNotes">Notes</label>
                            <textarea id="opNotes" class="op-notes" rows="5" placeholder="Optional notes for this plate"></textarea>
                            <button id="opSaveNotes" class="op-button" type="button">Save Notes</button>
                        </div>
                    </aside>
                </main>
                <div id="opMessage" class="op-message" hidden></div>
                <dialog id="opResetDialog" class="op-reset-dialog">
                    <form method="dialog">
                        <button class="op-reset-close" aria-label="Close reset dialog">×</button>
                    </form>
                    <h3>Reset Plate Tracker</h3>
                    <p>Enter the Settings folder password to erase all license plate sightings.</p>
                    <input id="opResetPassword" type="password" autocomplete="current-password" placeholder="Settings password">
                    <div id="opResetError" class="op-reset-error"></div>
                    <div class="op-reset-actions">
                        <button id="opResetCancel" class="op-button" type="button">Cancel</button>
                        <button id="opResetConfirm" class="op-button op-button--danger" type="button">Reset Tracker</button>
                    </div>
                </dialog>
            </div>`
        document.body.append(root)
        buildMap()
        document.getElementById("opClose").addEventListener("click", close)
        document.getElementById("opDetailClose").addEventListener("click", clearSelection)
        document.getElementById("opRefresh").addEventListener("click", load)
        document.getElementById("opReset").addEventListener("click", reset)
        document.getElementById("opToggle").addEventListener("click", () => mutate("toggle"))
        document.getElementById("opIncrement").addEventListener("click", () => mutate("increment"))
        document.getElementById("opSaveNotes").addEventListener("click", saveNotes)
        return root
    }

    function resetPasswordFromDialog() {
        const dialog = document.getElementById("opResetDialog")
        const input = document.getElementById("opResetPassword")
        const error = document.getElementById("opResetError")
        if (!dialog?.showModal) {
            const fallback = window.prompt("Enter the Settings folder password to reset license plates.")
            return Promise.resolve(fallback || "")
        }
        input.value = ""
        error.textContent = ""
        return new Promise(resolve => {
            const cleanup = () => {
                confirm.onclick = null
                cancel.onclick = null
                input.onkeydown = null
                dialog.removeEventListener("close", onClose)
            }
            const finish = value => {
                cleanup()
                if (dialog.open) dialog.close()
                resolve(value)
            }
            const confirm = document.getElementById("opResetConfirm")
            const cancel = document.getElementById("opResetCancel")
            const onClose = () => {
                cleanup()
                resolve("")
            }
            confirm.onclick = () => {
                const value = input.value
                if (!value) {
                    error.textContent = "Password is required."
                    return
                }
                finish(value)
            }
            cancel.onclick = () => finish("")
            input.onkeydown = event => {
                if (event.key === "Enter") {
                    event.preventDefault()
                    confirm.click()
                }
            }
            dialog.addEventListener("close", onClose, {once: true})
            dialog.showModal()
            input.focus()
        })
    }

    function buildMap() {
        const map = document.getElementById("opMap")
        map.replaceChildren()
        states.forEach(state => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "op-state"
            button.dataset.state = state.code
            button.style.gridColumn = `${state.col} / span ${state.wide ? 2 : 1}`
            button.style.gridRow = String(state.row)
            button.setAttribute("aria-label", state.name)
            button.innerHTML = `<strong>${state.code}</strong><span>${state.name}</span>`
            button.addEventListener("click", () => selectAndToggle(state.code))
            map.append(button)
        })
    }

    async function request(payload = null) {
        const options = payload ? {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        } : {cache: "no-store"}
        const response = await fetch("/license-plates", options)
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.error || "License plate tracker request failed.")
        tracker.data = data
        render()
        return data
    }

    async function load() {
        try {
            await request()
            message("Tracker refreshed.")
        } catch (error) {
            message(error.message, true)
        }
    }

    async function selectAndToggle(code) {
        tracker.selected = code
        document.getElementById("opRoot")?.classList.add("op-root--detail-open")
        render()
        await mutate("toggle")
    }

    function clearSelection() {
        tracker.selected = ""
        document.getElementById("opRoot")?.classList.remove("op-root--detail-open")
        render()
    }

    async function mutate(action) {
        if (!tracker.selected) return
        try {
            await request({action, state: tracker.selected})
            message(`${stateByCode.get(tracker.selected).name} saved.`)
        } catch (error) {
            message(error.message, true)
        }
    }

    async function saveNotes() {
        if (!tracker.selected) return
        try {
            await request({action: "note", state: tracker.selected, notes: document.getElementById("opNotes").value})
            message("Notes saved.")
        } catch (error) {
            message(error.message, true)
        }
    }

    async function reset() {
        const resetPassword = await resetPasswordFromDialog()
        if (!resetPassword) return
        tracker.selected = ""
        try {
            await request({action: "reset", resetPassword})
            message("Tracker reset.")
        } catch (error) {
            message(error.message, true)
        }
    }

    function render() {
        const records = tracker.data.states || {}
        const seenCount = Number(tracker.data.seenCount || 0)
        const total = states.length
        const percent = total ? Math.round((seenCount / total) * 100) : 0
        document.getElementById("opProgressText").textContent = `${seenCount} / ${total}`
        document.getElementById("opPercent").textContent = `${percent}%`
        document.getElementById("opProgressBar").style.width = `${percent}%`
        document.getElementById("opUpdated").textContent = tracker.data.updated ? `Saved ${tracker.data.updated}` : "Shared tracker saved on this Pi"
        states.forEach(state => {
            const button = document.querySelector(`.op-state[data-state="${CSS.escape(state.code)}"]`)
            const record = records[state.code] || {}
            button.classList.toggle("op-state--seen", !!record.seen)
            button.classList.toggle("op-state--selected", tracker.selected === state.code)
            button.title = `${state.name}${record.count ? ` (${record.count})` : ""}`
        })
        renderDetail()
    }

    function renderDetail() {
        const empty = document.getElementById("opDetailEmpty")
        const body = document.getElementById("opDetailBody")
        if (!tracker.selected) {
            empty.hidden = false
            body.hidden = true
            document.getElementById("opRoot")?.classList.remove("op-root--detail-open")
            return
        }
        const state = stateByCode.get(tracker.selected)
        const record = (tracker.data.states || {})[tracker.selected] || {}
        empty.hidden = true
        body.hidden = false
        document.getElementById("opStateName").textContent = state.name
        document.getElementById("opStateCode").textContent = state.code
        document.getElementById("opStateSeen").textContent = record.seen ? "Yes" : "No"
        document.getElementById("opStateCount").textContent = String(record.count || 0)
        document.getElementById("opFirstSeen").textContent = record.firstSeen || "-"
        document.getElementById("opLastSeen").textContent = record.lastSeen || "-"
        document.getElementById("opNotes").value = record.notes || ""
        document.getElementById("opToggle").textContent = record.seen ? "Mark Unseen" : "Mark Seen"
    }

    function message(text, error = false) {
        const node = document.getElementById("opMessage")
        node.textContent = text
        node.classList.toggle("op-message--error", error)
        node.hidden = false
        clearTimeout(message.timer)
        message.timer = setTimeout(() => { node.hidden = true }, 2200)
    }

    async function open() {
        const root = ensureUi()
        root.hidden = false
        if (!tracker.data.updated) await load()
        render()
    }

    function close() {
        const root = document.getElementById("opRoot")
        if (root) root.hidden = true
    }

    window.overlandPlates = {open, close, load}
})()
