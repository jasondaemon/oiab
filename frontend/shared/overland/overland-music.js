/* IIAB Overland native music player. */

(() => {
    const defaultIcon = "/maps/overland/tunes.png"
    const playerStateKey = "overlandMusicPlayerStateV1"
    const visualizerTypes = ["particles", "aurora", "bokeh", "liquid", "imagekaleidoscope", "imagefloat", "particula", "motion", "led", "mirror", "bars", "waveform", "radial", "rings", "tunnel", "kaleidoscope", "off"]
    const legacyVisualizer = localStorage.getItem("overlandMusicVisualizer") || "particles"
    localStorage.removeItem("overlandMusicVisualizerAudioSource")
    localStorage.removeItem("overlandMusicWebAudioAnalyser")
    const savedPlayerState = readSavedPlayerState()
    const state = {
        library: null,
        libraryLoadedAt: 0,
        libraryKey: "",
        libraryRefreshTimer: null,
        filterType: savedPlayerState.filterType || "folder",
        filterId: savedPlayerState.filterId || "all",
        trackIds: [],
        currentId: savedPlayerState.currentId || null,
        currentTime: Number(savedPlayerState.currentTime) || 0,
        wasPlaying: !!savedPlayerState.wasPlaying,
        restoredAudio: false,
        saveTimer: null,
        currentCover: "",
        audio: null,
        audioContext: null,
        analyser: null,
        source: null,
        micContext: null,
        micAnalyser: null,
        micStream: null,
        micSource: null,
        animation: null,
        particleAnimation: null,
        particles: [],
        particulaParticles: [],
        visualizerImage: null,
        visualizerImages: [],
        visualizerImageId: localStorage.getItem("overlandMusicVisualizerImageId") || "",
        visualizerAudioSource: "simulated",
        repeatMode: ["off", "one", "all"].includes(savedPlayerState.repeatMode) ? savedPlayerState.repeatMode : "off",
        shuffle: !!savedPlayerState.shuffle,
        visualizer: visualizerTypes.includes(legacyVisualizer) ? legacyVisualizer : legacyVisualizer === "off" ? "off" : "particles",
        visualizerStyle: localStorage.getItem("overlandMusicVisualizerStyle") || (legacyVisualizer === "pulse" ? "pulse" : "drift"),
        visualizerFocus: localStorage.getItem("overlandMusicVisualizerFocus") || "soft",
        theme: localStorage.getItem("overlandMusicTheme") || "forest",
        restoreFromVisualizer: null,
    }

    function byId(id) {
        return document.getElementById(id)
    }

    function trackById(id) {
        return (state.library?.tracks || []).find(track => track.id === id)
    }

    function currentTrack() {
        return trackById(state.currentId)
    }

    function musicIcon() {
        return state.currentCover || defaultIcon
    }

    function readSavedPlayerState() {
        try {
            return JSON.parse(localStorage.getItem(playerStateKey) || "{}") || {}
        } catch (error) {
            console.warn("Ignoring invalid saved music player state", error)
            return {}
        }
    }

    function savePlayerState(options={}) {
        if (state.saveTimer) {
            clearTimeout(state.saveTimer)
            state.saveTimer = null
        }
        if (!options.immediate) {
            state.saveTimer = window.setTimeout(() => savePlayerState({immediate: true}), 750)
            return
        }
        const audioTime = state.audio && Number.isFinite(state.audio.currentTime) ? state.audio.currentTime : state.currentTime
        const payload = {
            version: 1,
            savedAt: Date.now(),
            currentId: state.currentId,
            currentTime: Math.max(0, Math.floor(audioTime || 0)),
            wasPlaying: !!state.audio && !state.audio.paused && !state.audio.ended,
            filterType: state.filterType,
            filterId: state.filterId,
            repeatMode: state.repeatMode,
            shuffle: state.shuffle,
        }
        localStorage.setItem(playerStateKey, JSON.stringify(payload))
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) return "0:00"
        const minutes = Math.floor(seconds / 60)
        const remainder = Math.floor(seconds % 60).toString().padStart(2, "0")
        return `${minutes}:${remainder}`
    }

    function isWide() {
        const visual = window.visualViewport
        const width = Math.round(visual?.width || window.innerWidth || document.documentElement.clientWidth || 0)
        const height = Math.round(visual?.height || window.innerHeight || document.documentElement.clientHeight || 0)
        const landscape = width >= height

        if (width >= 1100) return true
        if (!landscape) return false

        // Android head units often report a smaller CSS viewport than their
        // physical 720p panel. Keep those landscape screens in split view.
        return width >= 700 && height >= 420
    }

    function resizeMap() {
        window.setTimeout(() => {
            if (window.mb?.map?.resize) window.mb.map.resize()
        }, 80)
    }

    function setOpen(open) {
        const panel = byId("omPlayer")
        if (!panel) return
        panel.hidden = !open
        document.body.classList.toggle("od-music-side", open && isWide() && !panel.classList.contains("is-full"))
        document.body.classList.toggle("od-music-full", open && (!isWide() || panel.classList.contains("is-full")))
        applyPlayerSettings()
        if (open) {
            startParticleVisualizer()
        } else {
            stopParticleVisualizer()
        }
        resizeMap()
    }

    function closePlayer() {
        closeLibrary()
        setOpen(false)
    }

    function openPlayer() {
        setOpen(true)
        loadLibrary().catch(error => {
            console.error(error)
            renderMessage("Music library failed to load. Check the music service and try reopening Music.")
        })
    }

    function toggleFull() {
        const panel = byId("omPlayer")
        panel.classList.toggle("is-full")
        setOpen(!panel.hidden)
    }

    function createShell() {
        if (byId("omPlayer")) return
        const panel = document.createElement("section")
        panel.id = "omPlayer"
        panel.className = "om-player"
        panel.hidden = true
        panel.innerHTML = `
            <canvas id="omParticles" class="om-particles" aria-hidden="true"></canvas>
            <div class="om-top">
                <div class="om-actions">
                    <button id="omFullscreen" class="om-window-button" type="button" title="Toggle full screen" aria-label="Toggle full screen">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h6v2H8.4l3.3 3.3-1.4 1.4L7 8.4V11H5V5zm8 0h6v6h-2V8.4l-3.3 3.3-1.4-1.4L15.6 7H13V5zM5 13h2v2.6l3.3-3.3 1.4 1.4L8.4 17H11v2H5v-6zm12 0h2v6h-6v-2h2.6l-3.3-3.3 1.4-1.4 3.3 3.3V13z"/></svg>
                    </button>
                    <button id="omVisualizerOnly" class="om-window-button" type="button" title="Visualizer only" aria-label="Visualizer only">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h2V9H4v8zm4 0h2V5H8v12zm4 0h2v-7h-2v7zm4 0h2V3h-2v14zm4 0h2v-5h-2v5z"/></svg>
                    </button>
                    <button id="omSettingsButton" class="om-window-button" type="button" title="Music settings" aria-label="Music settings">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a8.2 8.2 0 0 0-2.6-1.5L14 2h-4l-.4 2.5A8.2 8.2 0 0 0 7 6L4.6 5 2.6 8.5l2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a8.2 8.2 0 0 0 2.6 1.5L10 22h4l.4-2.5A8.2 8.2 0 0 0 17 18l2.4 1 2-3.5-2-1.5zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"/></svg>
                    </button>
                    <button id="omClose" class="om-window-button" type="button" title="Minimize" aria-label="Minimize">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v2H6z"/></svg>
                    </button>
                </div>
            </div>
            <div class="om-now">
                <div class="om-cover"><img id="omCover" src="${defaultIcon}" alt=""></div>
                <div class="om-stack">
                    <div class="om-track">
                        <h2 id="omTrackTitle">No track selected</h2>
                        <p id="omArtistName">Choose music from the library.</p>
                        <p id="omAlbumName"></p>
                        <div class="om-controls">
                            <button id="omPrev" class="om-control-button" type="button" title="Previous" aria-label="Previous">${iconSvg("prev")}</button>
                            <button id="omPlay" class="om-control-button om-control-button--play" type="button" title="Play" aria-label="Play">${iconSvg("play")}</button>
                            <button id="omNext" class="om-control-button" type="button" title="Next" aria-label="Next">${iconSvg("next")}</button>
                            <button id="omRepeat" class="om-control-button" type="button" title="Repeat off" aria-label="Repeat off">${iconSvg("repeat")}</button>
                            <button id="omShuffle" class="om-control-button" type="button" title="Shuffle off" aria-label="Shuffle off">${iconSvg("shuffle")}</button>
                            <button id="omLibraryButton" class="om-control-button om-control-button--library" type="button" title="Open library" aria-label="Open library">${iconSvg("list")}</button>
                        </div>
                    </div>
                    <div class="om-progress">
                        <span id="omElapsed">0:00</span>
                        <input id="omSeek" type="range" min="0" max="1000" value="0" aria-label="Seek">
                        <span id="omDuration">0:00</span>
                    </div>
                    <div id="omQueuePreview" class="om-queue-preview" aria-label="Upcoming songs"></div>
                </div>
            </div>
            <aside id="omLibrary" class="om-library-modal" hidden>
                <div class="om-library-head">
                    <button id="omLibraryClose" class="om-window-button" type="button" title="Close library" aria-label="Close library">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5zm11.2 0L19 6.4 6.4 19 5 17.6 17.6 5z"/></svg>
                    </button>
                </div>
                <div class="om-browser">
                        <div class="om-filter-strip" aria-label="Music library filters">
                            <label class="om-filter om-filter--artist" title="Artist">
                                <span class="om-filter-icon">${iconSvg("person")}</span>
                                <span class="om-filter-label">Artists</span>
                                <select id="omArtistFilter" class="om-filter-select" aria-label="Artist"></select>
                            </label>
                            <label class="om-filter om-filter--album" title="Album">
                                <span class="om-filter-icon">${iconSvg("record")}</span>
                                <span class="om-filter-label">Albums</span>
                                <select id="omAlbumFilter" class="om-filter-select" aria-label="Album"></select>
                            </label>
                            <label class="om-filter om-filter--folder" title="Folder">
                                <span class="om-filter-icon">${iconSvg("folder")}</span>
                                <span class="om-filter-label">Folders</span>
                                <select id="omFolderFilter" class="om-filter-select" aria-label="Folder"></select>
                            </label>
                        </div>
                        <div id="omTrackList" class="om-track-list"></div>
                </div>
            </aside>
            <aside id="omSettings" class="om-settings" hidden>
                <div class="om-settings-head">
                    <div>
                        <strong>Music Settings</strong>
                        <span>Display, visualizer, and library controls</span>
                    </div>
                    <button id="omSettingsClose" class="om-window-button" type="button" title="Close settings" aria-label="Close settings">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5zm11.2 0L19 6.4 6.4 19 5 17.6 17.6 5z"/></svg>
                    </button>
                </div>
                <div class="om-settings-grid">
                    <section class="om-settings-card">
                        <h3>Visualizer</h3>
                        <label class="om-setting-field">
                            <span>Type</span>
                            <select id="omVisualizerSelect">
                                <option value="particles">Floating Particles</option>
                                <option value="aurora">Aurora Wash</option>
                                <option value="bokeh">Bokeh Field</option>
                                <option value="liquid">Liquid Color</option>
                                <option value="imagekaleidoscope">Image Kaleidoscope</option>
                                <option value="imagefloat">Image Float</option>
                                <option value="particula">Particula Sphere</option>
                                <option value="motion">Motion Wash</option>
                                <option value="led">LED Glow Grid</option>
                                <option value="mirror">Mirror Wash</option>
                                <option value="bars">Spectrum Atmosphere</option>
                                <option value="waveform">Oscilloscope Wave</option>
                                <option value="radial">Radial Spectrum</option>
                                <option value="rings">Wave Rings</option>
                                <option value="tunnel">Star Tunnel</option>
                                <option value="kaleidoscope">Kaleidoscope Pixels</option>
                                <option value="off">Off</option>
                            </select>
                        </label>
                        <label class="om-setting-field">
                            <span>Colorway</span>
                            <select id="omThemeSelect">
                                <option value="forest">Forest</option>
                                <option value="amber">Amber</option>
                                <option value="ocean">Ocean</option>
                                <option value="night">Night Drive</option>
                                <option value="leather">Leather</option>
                                <option value="brightgreen">Bright Green</option>
                                <option value="caution">Caution Orange</option>
                                <option value="crimson">Crimson Red</option>
                            </select>
                        </label>
                    </section>
                    <section class="om-settings-card">
                        <h3>Options</h3>
                        <label class="om-setting-field">
                            <span>Style</span>
                            <select id="omVisualizerStyleSelect">
                                <option value="drift">Drift</option>
                                <option value="pulse">Pulse</option>
                                <option value="nebula">Nebula</option>
                            </select>
                        </label>
                        <label class="om-setting-field">
                            <span>Focus</span>
                            <select id="omVisualizerFocusSelect">
                                <option value="sharp">Sharp</option>
                                <option value="soft">Soft Focus</option>
                                <option value="dream">Dream Blur</option>
                            </select>
                        </label>
                        <label class="om-setting-field">
                            <span>Image</span>
                            <select id="omVisualizerImageSelect">
                                <option value="">No image found</option>
                            </select>
                        </label>
                        <button id="omRefreshVisualizerImages" class="om-settings-action om-settings-action--secondary" type="button">Refresh Image List</button>
                    </section>
                    <section class="om-settings-card">
                        <span class="om-section-title">Scan Library</span>
                        <p>Use this after adding music. Normal player opens use the cached inventory and will not rescan automatically.</p>
                        <button id="omRefreshLibrary" class="om-settings-action" type="button">Rebuild Music Library</button>
                        <p id="omSettingsStatus" class="om-settings-status"></p>
                    </section>
                </div>
            </aside>
            <audio id="omAudio" preload="metadata"></audio>
        `
        document.body.append(panel)
        state.audio = byId("omAudio")
        applyPlayerSettings()
        wirePlayer()
        renderModeButtons()
    }

    function wirePlayer() {
        byId("omClose").addEventListener("click", closePlayer)
        byId("omFullscreen").addEventListener("click", toggleFull)
        byId("omVisualizerOnly").addEventListener("click", event => {
            event.stopPropagation()
            openVisualizerOnly()
        })
        byId("omSettingsButton").addEventListener("click", toggleSettings)
        byId("omSettingsClose").addEventListener("click", () => setSettingsOpen(false))
        byId("omVisualizerSelect").addEventListener("change", event => setVisualizer(event.target.value))
        byId("omVisualizerStyleSelect").addEventListener("change", event => setVisualizerStyle(event.target.value))
        byId("omVisualizerFocusSelect").addEventListener("change", event => setVisualizerFocus(event.target.value))
        byId("omVisualizerImageSelect").addEventListener("change", event => selectVisualizerImage(event.target.value))
        byId("omRefreshVisualizerImages").addEventListener("click", () => loadVisualizerImages({force: true}).catch(console.error))
        byId("omThemeSelect").addEventListener("change", event => setTheme(event.target.value))
        byId("omRefreshLibrary").addEventListener("click", refreshLibraryFromSettings)
        byId("omPlay").addEventListener("click", togglePlay)
        byId("omPrev").addEventListener("click", previousTrack)
        byId("omNext").addEventListener("click", nextTrack)
        byId("omRepeat").addEventListener("click", toggleRepeat)
        byId("omShuffle").addEventListener("click", toggleShuffle)
        byId("omLibraryButton").addEventListener("click", openLibrary)
        byId("omLibraryClose").addEventListener("click", closeLibrary)
        byId("omCover")?.closest(".om-cover")?.addEventListener("click", event => {
            const panel = byId("omPlayer")
            if (!panel) return
            event.stopPropagation()
            if (panel.classList.contains("is-visualizer-only")) {
                closeVisualizerOnly(event)
                return
            }
            if (panel.classList.contains("is-full")) openVisualizerOnly()
            else {
                panel.classList.add("is-full")
                setOpen(true)
            }
        })
        byId("omArtistFilter").addEventListener("change", event => setLibraryFilter("artist", event.target.value))
        byId("omAlbumFilter").addEventListener("change", event => setLibraryFilter("album", event.target.value))
        byId("omFolderFilter").addEventListener("change", event => setLibraryFilter("folder", event.target.value))
        byId("omSeek").addEventListener("input", event => {
            if (!state.audio.duration) return
            state.audio.currentTime = (Number(event.target.value) / 1000) * state.audio.duration
            state.currentTime = state.audio.currentTime
            savePlayerState()
        })
        state.audio.addEventListener("play", () => {
            setPlayIcon(true)
            setupVisualizer()
            startParticleVisualizer()
            notifyDock()
            savePlayerState({immediate: true})
        })
        state.audio.addEventListener("pause", () => {
            setPlayIcon(false)
            notifyDock()
            savePlayerState({immediate: true})
        })
        state.audio.addEventListener("ended", handleTrackEnded)
        state.audio.addEventListener("timeupdate", () => {
            state.currentTime = state.audio.currentTime
            renderProgress()
            savePlayerState()
        })
        state.audio.addEventListener("loadedmetadata", () => {
            restoreAudioPosition()
            renderProgress()
        })
        window.addEventListener("pagehide", () => savePlayerState({immediate: true}))
        window.addEventListener("beforeunload", () => savePlayerState({immediate: true}))
        window.addEventListener("resize", () => setOpen(!byId("omPlayer").hidden))
    }

    function applyPlayerSettings() {
        const panel = byId("omPlayer")
        if (!panel) return
        panel.dataset.visualizer = state.visualizer
        panel.dataset.visualizerStyle = state.visualizerStyle
        panel.dataset.visualizerFocus = state.visualizerFocus
        panel.dataset.theme = state.theme
        const visualizerSelect = byId("omVisualizerSelect")
        const visualizerStyleSelect = byId("omVisualizerStyleSelect")
        const visualizerFocusSelect = byId("omVisualizerFocusSelect")
        const visualizerImageSelect = byId("omVisualizerImageSelect")
        const themeSelect = byId("omThemeSelect")
        if (visualizerSelect) visualizerSelect.value = state.visualizer
        if (visualizerStyleSelect) visualizerStyleSelect.value = state.visualizerStyle
        if (visualizerFocusSelect) visualizerFocusSelect.value = state.visualizerFocus
        if (visualizerImageSelect) visualizerImageSelect.value = state.visualizerImageId
        if (themeSelect) themeSelect.value = state.theme
        updateOptionAvailability()
        if (state.visualizer === "off") {
            stopParticleVisualizer()
        }
    }

    function updateOptionAvailability() {
        const imageModes = ["imagekaleidoscope", "imagefloat"]
        const styleModes = ["particles", "aurora", "bokeh", "liquid", "imagekaleidoscope", "imagefloat", "particula", "kaleidoscope"]
        const focusModes = visualizerTypes.filter(type => type !== "off")
        setFieldEnabled("omVisualizerStyleSelect", styleModes.includes(state.visualizer))
        setFieldEnabled("omVisualizerFocusSelect", focusModes.includes(state.visualizer))
        setFieldEnabled("omVisualizerImageSelect", imageModes.includes(state.visualizer))
        const refreshButton = byId("omRefreshVisualizerImages")
        if (refreshButton) refreshButton.disabled = !imageModes.includes(state.visualizer)
    }

    function setFieldEnabled(id, enabled) {
        const control = byId(id)
        const field = control?.closest(".om-setting-field")
        if (!control || !field) return
        control.disabled = !enabled
        field.classList.toggle("is-disabled", !enabled)
    }

    function setVisualizer(value) {
        state.visualizer = visualizerTypes.includes(value) ? value : "particles"
        localStorage.setItem("overlandMusicVisualizer", state.visualizer)
        applyPlayerSettings()
        stopParticleVisualizer()
        if (state.visualizer !== "off" && !byId("omPlayer")?.hidden) {
            startParticleVisualizer()
        }
    }

    function setVisualizerStyle(value) {
        state.visualizerStyle = ["drift", "pulse", "nebula"].includes(value) ? value : "drift"
        localStorage.setItem("overlandMusicVisualizerStyle", state.visualizerStyle)
        applyPlayerSettings()
        if (state.visualizer !== "off" && !byId("omPlayer")?.hidden) {
            stopParticleVisualizer()
            startParticleVisualizer()
        }
    }

    function setVisualizerFocus(value) {
        state.visualizerFocus = ["sharp", "soft", "dream"].includes(value) ? value : "soft"
        localStorage.setItem("overlandMusicVisualizerFocus", state.visualizerFocus)
        applyPlayerSettings()
    }

    async function loadVisualizerImages(options={}) {
        if (state.visualizerImages.length && !options.force) return
        const select = byId("omVisualizerImageSelect")
        if (select) {
            select.replaceChildren(new Option("Loading images...", ""))
        }
        const response = await fetch("/music-api/visualizer-images", {cache: "no-store"})
        if (!response.ok) throw new Error(`Visualizer image list failed: ${response.status}`)
        const payload = await response.json()
        state.visualizerImages = payload.images || []
        renderVisualizerImageSelect()
        if (state.visualizerImageId) {
            const selected = state.visualizerImages.find(image => image.id === state.visualizerImageId)
            if (selected) loadVisualizerImage(selected.url)
        }
    }

    function renderVisualizerImageSelect() {
        const select = byId("omVisualizerImageSelect")
        if (!select) return
        select.replaceChildren()
        if (!state.visualizerImages.length) {
            select.append(new Option("Upload images to media/visualizers", ""))
            state.visualizerImageId = ""
            state.visualizerImage = null
            return
        }
        state.visualizerImages.forEach(image => {
            select.append(new Option(image.name, image.id))
        })
        if (!state.visualizerImages.some(image => image.id === state.visualizerImageId)) {
            state.visualizerImageId = state.visualizerImages[0].id
            localStorage.setItem("overlandMusicVisualizerImageId", state.visualizerImageId)
        }
        select.value = state.visualizerImageId
        const selected = state.visualizerImages.find(image => image.id === state.visualizerImageId)
        if (selected) loadVisualizerImage(selected.url)
    }

    function selectVisualizerImage(id) {
        state.visualizerImageId = id
        localStorage.setItem("overlandMusicVisualizerImageId", id)
        const selected = state.visualizerImages.find(image => image.id === id)
        if (selected) {
            loadVisualizerImage(selected.url)
            setVisualizer("imagekaleidoscope")
        }
    }

    function loadVisualizerImage(src) {
        if (!src) return
        const image = new Image()
        image.onload = () => {
            state.visualizerImage = image
        }
        image.src = src
    }

    function setTheme(value) {
        state.theme = ["forest", "amber", "ocean", "night", "leather", "brightgreen", "caution", "crimson"].includes(value) ? value : "forest"
        localStorage.setItem("overlandMusicTheme", state.theme)
        applyPlayerSettings()
        if (state.visualizer !== "off" && !byId("omPlayer")?.hidden) {
            stopParticleVisualizer()
            startParticleVisualizer()
        }
    }

    function toggleSettings() {
        setSettingsOpen(byId("omSettings")?.hidden !== false)
    }

    function setSettingsOpen(open) {
        const settings = byId("omSettings")
        const button = byId("omSettingsButton")
        const panel = byId("omPlayer")
        if (!settings) return
        if (open) closeLibrary()
        if (open) {
            panel?.classList.add("is-full")
        }
        settings.hidden = !open
        button?.classList.toggle("is-active", open)
        panel?.classList.toggle("is-settings-open", open)
        if (open) setOpen(true)
        else if (panel && !panel.classList.contains("is-visualizer-only")) setOpen(!panel.hidden)
    }

    async function openLibrary() {
        const library = byId("omLibrary")
        const panel = byId("omPlayer")
        if (!library) return
        byId("omSettings").hidden = true
        byId("omSettingsButton")?.classList.remove("is-active")
        panel?.classList.remove("is-settings-open")
        library.hidden = false
        panel?.classList.add("is-library-open")
        if (!state.library) {
            renderMessage("Loading music library...")
            await loadLibrary(false, {quiet: true, preserveScroll: true})
        } else {
            renderFilters()
            renderTracks({preserveScroll: true})
        }
    }

    function closeLibrary() {
        const library = byId("omLibrary")
        const panel = byId("omPlayer")
        if (!library) return
        library.hidden = true
        panel?.classList.remove("is-library-open")
    }

    function openVisualizerOnly() {
        const panel = byId("omPlayer")
        if (!panel) return
        state.restoreFromVisualizer = {
            full: panel.classList.contains("is-full"),
            settings: byId("omSettings")?.hidden === false,
        }
        panel.classList.add("is-full", "is-visualizer-only")
        setSettingsOpen(false)
        setOpen(true)
        startParticleVisualizer()
    }

    function closeVisualizerOnly(event) {
        const panel = byId("omPlayer")
        if (!panel || !panel.classList.contains("is-visualizer-only")) return
        event?.preventDefault()
        event?.stopPropagation()
        const restore = state.restoreFromVisualizer || {full: true, settings: false}
        panel.classList.remove("is-visualizer-only")
        panel.classList.toggle("is-full", !!restore.full)
        setSettingsOpen(!!restore.settings)
        setOpen(true)
        state.restoreFromVisualizer = null
    }

    async function refreshLibraryFromSettings() {
        const status = byId("omSettingsStatus")
        const button = byId("omRefreshLibrary")
        if (status) status.textContent = "Rebuilding library..."
        if (button) button.disabled = true
        try {
            await loadLibrary(true, {quiet: true, refresh: true, preserveScroll: true})
            if (status) status.textContent = `Library ready: ${state.library?.tracks?.length || 0} tracks.`
        } catch (error) {
            console.error(error)
            if (status) status.textContent = "Library rebuild failed."
        } finally {
            if (button) button.disabled = false
        }
    }

    function showSettingsStatus(message) {
        const status = byId("omSettingsStatus")
        if (status) status.textContent = message
    }

    function iconSvg(name) {
        const paths = {
            prev: "M6 5h2v14H6V5zm3.5 7L19 5.5v13L9.5 12z",
            play: "M8 5v14l11-7L8 5z",
            pause: "M7 5h4v14H7V5zm6 0h4v14h-4V5z",
            next: "M16 5h2v14h-2V5zM5 5.5 14.5 12 5 18.5v-13z",
            repeat: "M7 7h9.2l-2-2L15.6 3.6 20 8l-4.4 4.4L14.2 11l2-2H7v3H5V9a2 2 0 0 1 2-2zm10 8H7.8l2 2-1.4 1.4L4 14l4.4-4.4L9.8 11l-2 2H17v-3h2v3a2 2 0 0 1-2 2z",
            shuffle: "M16.6 4.6 20 8l-3.4 3.4-1.4-1.4 1-1H15c-2.3 0-3.4 1.4-4.7 3.7C8.9 15.2 7.4 17 4 17v-2c2.2 0 3.2-1.1 4.6-3.5C10 8.9 11.7 7 15 7h1.2l-1-1 1.4-1.4zM4 7c2 0 3.4.7 4.5 2.1l-1.2 1.7C6.4 9.6 5.5 9 4 9V7zm9.1 6.5c.7.9 1.5 1.5 2.9 1.5h.2l-1-1 1.4-1.4L20 16l-3.4 3.4-1.4-1.4 1-1H16c-2.1 0-3.4-.8-4.4-2.1l1.5-1.4z",
            person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0v1H5v-1z",
            record: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 12.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm0-2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z",
            folder: "M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10z",
            list: "M4 6.5A1.5 1.5 0 1 1 7 6.5a1.5 1.5 0 0 1-3 0zM9 5.5h11v2H9v-2zM4 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm5-1h11v2H9v-2zm-5 6.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm5-1h11v2H9v-2z",
        }
        return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`
    }

    async function loadLibrary(force=false, options={}) {
        const quiet = !!options.quiet
        if (state.library && !force) return
        const hadLibrary = !!state.library
        const previousKey = state.libraryKey
        if (!hadLibrary && !quiet) {
            renderMessage("Loading music library...")
        }
        const response = await fetch(options.refresh ? "/music-api/library?refresh=1" : "/music-api/library", {cache: "no-store"})
        if (!response.ok) throw new Error(`Music library failed: ${response.status}`)
        const library = await response.json()
        const nextKey = libraryContentKey(library)
        state.library = library
        state.libraryKey = nextKey
        state.libraryLoadedAt = Date.now()
        state.trackIds = activeTrackIds()
        if (!hadLibrary || nextKey !== previousKey || options.refresh) {
            renderFilters()
            renderTracks({preserveScroll: !!(hadLibrary || options.preserveScroll)})
        }
        await restoreSavedTrack()
        if (state.library.status?.scanning) {
            if (!state.library.tracks?.length) {
                renderMessage("Indexing music library...")
                scheduleLibraryRefresh()
            }
        }
    }

    function libraryContentKey(library) {
        return [
            (library.tracks || []).map(track => `${track.id}:${track.mtime || ""}:${track.size || ""}`).join("|"),
            (library.playlists || []).map(playlist => `${playlist.id}:${playlist.trackIds?.length || 0}`).join("|"),
        ].join("::")
    }

    function scheduleLibraryRefresh() {
        if (state.libraryRefreshTimer) return
        state.libraryRefreshTimer = window.setTimeout(() => {
            state.libraryRefreshTimer = null
            loadLibrary(true, {quiet: true}).catch(console.error)
        }, 5000)
    }

    function renderMessage(message) {
        const list = byId("omTrackList")
        if (!list) return
        list.replaceChildren()
        const node = document.createElement("div")
        node.className = "om-empty"
        node.textContent = message
        list.append(node)
    }

    function setLibraryFilter(type, id) {
        state.filterType = type
        state.filterId = id || "all"
        renderFilters()
        renderTracks({preserveScroll: false})
        renderQueuePreview()
        savePlayerState({immediate: true})
    }

    function renderFilters() {
        renderFilterSelect("omArtistFilter", "artist", buildMetadataGroups("artist", "All Artists", "Unknown Artist"))
        renderFilterSelect("omAlbumFilter", "album", buildMetadataGroups("album", "All Albums", "Unknown Album"))
        renderFilterSelect("omFolderFilter", "folder", buildFolderGroups())
    }

    function renderFilterSelect(selectId, type, groups) {
        const select = byId(selectId)
        if (!select) return
        select.replaceChildren()
        groups.forEach(group => {
            const option = document.createElement("option")
            option.value = group.id
            option.textContent = group.label
            select.append(option)
        })
        select.value = state.filterType === type ? state.filterId : "all"
        select.closest(".om-filter")?.classList.toggle("is-active", state.filterType === type)
    }

    function buildMetadataGroups(field, allLabel, unknownLabel) {
        const groups = new Map()
        ;(state.library?.tracks || []).forEach(track => {
            const value = String(track[field] || unknownLabel).trim() || unknownLabel
            const id = `meta:${field}:${value.toLowerCase()}`
            if (!groups.has(id)) groups.set(id, {id, name: value, trackIds: []})
            groups.get(id).trackIds.push(track.id)
        })
        return [
            {id: "all", name: allLabel, trackIds: (state.library?.tracks || []).map(track => track.id)},
            ...Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: "base"})),
        ].map(group => ({...group, label: `${group.name} (${group.trackIds.length})`}))
    }

    function buildFolderGroups() {
        return (state.library?.playlists || []).map(group => ({...group, label: `${group.name} (${group.trackIds.length})`}))
    }

    function activeTrackIds() {
        if (!state.library) return []
        if (state.filterType === "folder") {
            return ((state.library.playlists || []).find(list => list.id === state.filterId) || state.library.playlists?.[0] || {trackIds: []}).trackIds
        }
        const field = state.filterType
        if (state.filterId === "all") return (state.library.tracks || []).map(track => track.id)
        return (state.library.tracks || [])
            .filter(track => `meta:${field}:${String(track[field] || (field === "artist" ? "Unknown Artist" : "Unknown Album")).trim().toLowerCase()}` === state.filterId)
            .map(track => track.id)
    }

    function renderTracks(options={}) {
        const list = byId("omTrackList")
        const scrollTop = options.preserveScroll ? list.scrollTop : 0
        list.replaceChildren()
        state.trackIds = activeTrackIds()
        if (!state.trackIds.length) {
            const empty = document.createElement("div")
            empty.className = "om-empty"
            empty.textContent = "No audio files found. Upload MP3s to the configured music library using File Manager, then reopen this player."
            list.append(empty)
            return
        }
        state.trackIds.map(trackById).filter(Boolean).forEach(track => {
            const button = document.createElement("button")
            button.className = `om-track-row${track.id === state.currentId ? " is-active" : ""}`
            button.type = "button"
            button.dataset.trackId = track.id
            button.innerHTML = `
                <img src="${track.coverUrl || defaultIcon}" alt="">
                <span><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.album || track.playlist || "Music")}</span></span>
            `
            button.addEventListener("click", () => playTrack(track.id))
            list.append(button)
        })
        if (options.preserveScroll) {
            list.scrollTop = scrollTop
        }
        renderQueuePreview()
    }

    function queuePreviewIds(limit=8) {
        if (!state.trackIds.length) return []
        const currentIndex = state.trackIds.indexOf(state.currentId)
        const start = currentIndex >= 0 ? currentIndex + 1 : 0
        const ids = []
        for (let i = 0; i < state.trackIds.length && ids.length < limit; i += 1) {
            const id = state.trackIds[(start + i) % state.trackIds.length]
            if (id !== state.currentId) ids.push(id)
        }
        return ids
    }

    function renderQueuePreview() {
        const list = byId("omQueuePreview")
        if (!list) return
        list.replaceChildren()
        if (!state.library || !state.trackIds.length) {
            const empty = document.createElement("div")
            empty.className = "om-queue-empty"
            empty.textContent = "Open the library to choose music."
            list.append(empty)
            return
        }
        queuePreviewIds().map(trackById).filter(Boolean).forEach(track => {
            const button = document.createElement("button")
            button.className = "om-queue-row"
            button.type = "button"
            button.dataset.trackId = track.id
            button.textContent = `${track.title || "Unknown title"} - ${track.artist || "Unknown artist"}`
            button.addEventListener("click", () => playTrack(track.id))
            list.append(button)
        })
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[ch]))
    }

    async function selectTrack(id, options={}) {
        if (!state.library) {
            await loadLibrary()
        }
        const track = trackById(id)
        if (!track) return null
        state.currentId = id
        state.currentTime = Number(options.position) || 0
        state.restoredAudio = false
        state.currentCover = track.coverUrl || ""
        state.audio.src = track.audioUrl
        byId("omTrackTitle").textContent = track.title
        byId("omTrackTitle").classList.toggle("is-marquee", String(track.title || "").length > 20)
        byId("omArtistName").textContent = track.artist || track.playlist || "Unknown artist"
        byId("omAlbumName").textContent = track.album || ""
        byId("omCover").src = track.coverUrl || defaultIcon
        updateActiveTrackRow()
        renderQueuePreview()
        notifyDock()
        savePlayerState({immediate: true})
        return track
    }

    async function playTrack(id, options={}) {
        const track = await selectTrack(id, options)
        if (!track) return
        try {
            await state.audio.play()
        } catch (error) {
            console.warn("Playback did not start", error)
        }
    }

    async function restoreSavedTrack() {
        if (state.restoredAudio || !state.currentId || !state.library) return
        const track = await selectTrack(state.currentId, {position: state.currentTime})
        if (!track) {
            state.currentId = null
            state.currentTime = 0
            savePlayerState({immediate: true})
            return
        }
        state.restoredAudio = true
        renderProgress()
        if (state.wasPlaying) {
            try {
                await state.audio.play()
            } catch {
                setPlayIcon(false)
            }
        }
    }

    function restoreAudioPosition() {
        if (!state.currentTime || !state.audio.duration) return
        const safePosition = Math.min(state.currentTime, Math.max(0, state.audio.duration - 1))
        if (Number.isFinite(safePosition) && Math.abs(state.audio.currentTime - safePosition) > 1) {
            state.audio.currentTime = safePosition
        }
    }

    function updateActiveTrackRow() {
        const list = byId("omTrackList")
        if (!list) return
        list.querySelectorAll(".om-track-row").forEach(row => {
            row.classList.toggle("is-active", row.dataset.trackId === state.currentId)
        })
    }

    function setPlayIcon(playing) {
        const button = byId("omPlay")
        if (!button) return
        button.innerHTML = iconSvg(playing ? "pause" : "play")
        button.title = playing ? "Pause" : "Play"
        button.setAttribute("aria-label", playing ? "Pause" : "Play")
    }

    function toggleRepeat() {
        const order = ["off", "one", "all"]
        state.repeatMode = order[(order.indexOf(state.repeatMode) + 1) % order.length]
        renderModeButtons()
        savePlayerState({immediate: true})
    }

    function toggleShuffle() {
        state.shuffle = !state.shuffle
        renderModeButtons()
        savePlayerState({immediate: true})
    }

    function renderModeButtons() {
        const repeat = byId("omRepeat")
        const shuffle = byId("omShuffle")
        if (repeat) {
            repeat.classList.toggle("is-active", state.repeatMode !== "off")
            repeat.dataset.mode = state.repeatMode
            repeat.title = state.repeatMode === "off" ? "Repeat off" : state.repeatMode === "one" ? "Repeat one" : "Repeat all"
            repeat.setAttribute("aria-label", repeat.title)
        }
        if (shuffle) {
            shuffle.classList.toggle("is-active", state.shuffle)
            shuffle.title = state.shuffle ? "Shuffle on" : "Shuffle off"
            shuffle.setAttribute("aria-label", shuffle.title)
        }
    }

    function togglePlay() {
        if (!state.currentId) {
            const first = state.trackIds[0] || state.library?.tracks?.[0]?.id
            if (first) return playTrack(first)
            byId("omTrackTitle")?.classList.remove("is-marquee")
            return loadLibrary()
        }
        if (state.audio.paused) {
            state.audio.play()
        } else {
            state.audio.pause()
        }
    }

    function nextTrack() {
        if (!state.trackIds.length) return
        if (state.shuffle && state.trackIds.length > 1) {
            let next = state.currentId
            while (next === state.currentId) {
                next = state.trackIds[Math.floor(Math.random() * state.trackIds.length)]
            }
            return playTrack(next)
        }
        const current = Math.max(0, state.trackIds.indexOf(state.currentId))
        playTrack(state.trackIds[(current + 1) % state.trackIds.length])
    }

    function handleTrackEnded() {
        if (state.repeatMode === "one") {
            state.audio.currentTime = 0
            state.audio.play()
            return
        }
        const current = state.trackIds.indexOf(state.currentId)
        if (state.repeatMode === "off" && current === state.trackIds.length - 1) {
            setPlayIcon(false)
            notifyDock()
            return
        }
        nextTrack()
    }

    function previousTrack() {
        if (!state.trackIds.length) return
        const current = Math.max(0, state.trackIds.indexOf(state.currentId))
        playTrack(state.trackIds[(current - 1 + state.trackIds.length) % state.trackIds.length])
    }

    function renderProgress() {
        byId("omElapsed").textContent = formatTime(state.audio.currentTime)
        byId("omDuration").textContent = formatTime(state.audio.duration)
        byId("omSeek").value = state.audio.duration ? Math.round((state.audio.currentTime / state.audio.duration) * 1000) : 0
    }

    function setupVisualizer() {
        // Intentionally no-op: MP3 playback must stay on the native
        // HTMLAudioElement path. Routing the media element through WebAudio
        // makes Dasaita output go silent even when AudioContext reports running.
    }

    async function startMicrophoneAnalyser() {
        if (state.micAnalyser) {
            if (state.micContext?.state !== "running") await state.micContext.resume()
            return state.micAnalyser
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("getUserMedia is not available")
        }
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if (!AudioContext) {
            throw new Error("AudioContext is not available")
        }
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            },
            video: false,
        })
        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 128
        source.connect(analyser)
        if (ctx.state !== "running") await ctx.resume()
        state.micStream = stream
        state.micContext = ctx
        state.micSource = source
        state.micAnalyser = analyser
        showSettingsStatus("Microphone visualizer is active.")
        return analyser
    }

    function activeAnalyser() {
        return null
    }

    function startParticleVisualizer() {
        if (state.visualizer === "off") return
        if (state.particleAnimation) return
        const canvas = byId("omParticles")
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        const particleCount = state.visualizerStyle === "pulse" ? 18 : state.visualizerStyle === "nebula" ? 52 : 36
        state.particles = Array.from({length: particleCount}, () => ({
            x: Math.random(),
            y: Math.random(),
            r: state.visualizerStyle === "pulse" ? 2 + Math.random() * 5 : .8 + Math.random() * 2.4,
            vx: -.0008 + Math.random() * .0016,
            vy: -.0008 + Math.random() * .0016,
            hue: particleHue(),
        }))
        const frequencyData = new Uint8Array(64)
        const waveformData = new Uint8Array(128)
        const draw = () => {
            const rect = canvas.getBoundingClientRect()
            const pixelRatio = window.devicePixelRatio || 1
            const width = Math.max(1, Math.floor(rect.width * pixelRatio))
            const height = Math.max(1, Math.floor(rect.height * pixelRatio))
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width
                canvas.height = height
            }
            let energy = state.audio && !state.audio.paused ? .35 : .12
            const analyser = activeAnalyser()
            if (analyser) {
                analyser.getByteFrequencyData(frequencyData)
                analyser.getByteTimeDomainData(waveformData)
                energy = frequencyData.reduce((sum, value) => sum + value, 0) / (frequencyData.length * 255)
            } else if (state.audio && !state.audio.paused) {
                const t = state.audio.currentTime || performance.now() / 1000
                energy = .28 + Math.sin(t * 2.7) * .08 + Math.sin(t * 7.9) * .04
                for (let i = 0; i < frequencyData.length; i += 1) {
                    frequencyData[i] = Math.max(0, Math.min(255, 72 + Math.sin(t * (1.2 + i * .035) + i * .7) * 44 + Math.sin(t * 4.1 + i * .19) * 24))
                }
                for (let i = 0; i < waveformData.length; i += 1) {
                    waveformData[i] = Math.max(0, Math.min(255, 128 + Math.sin(t * 5.2 + i * .14) * 42))
                }
            }
            if (state.visualizer === "motion") {
                ctx.clearRect(0, 0, width, height)
                drawMotionSpectrum(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "aurora") {
                drawAuroraWash(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "bokeh") {
                ctx.clearRect(0, 0, width, height)
                drawBokehField(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "liquid") {
                drawLiquidColor(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "imagekaleidoscope") {
                ctx.clearRect(0, 0, width, height)
                drawImageKaleidoscope(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "imagefloat") {
                drawImageFloat(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "led") {
                ctx.clearRect(0, 0, width, height)
                drawLedBands(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "mirror") {
                ctx.clearRect(0, 0, width, height)
                drawMirrorSpectrum(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "bars") {
                ctx.clearRect(0, 0, width, height)
                drawBars(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "particula") {
                drawParticulaSphere(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "waveform") {
                ctx.clearRect(0, 0, width, height)
                drawWaveform(ctx, width, height, pixelRatio, waveformData, energy)
            } else if (state.visualizer === "radial") {
                ctx.clearRect(0, 0, width, height)
                drawRadial(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "rings") {
                ctx.clearRect(0, 0, width, height)
                drawRings(ctx, width, height, pixelRatio, energy)
            } else if (state.visualizer === "tunnel") {
                ctx.clearRect(0, 0, width, height)
                drawTunnel(ctx, width, height, pixelRatio, frequencyData, energy)
            } else if (state.visualizer === "kaleidoscope") {
                ctx.clearRect(0, 0, width, height)
                drawKaleidoscope(ctx, width, height, pixelRatio, frequencyData, energy)
            } else {
                ctx.clearRect(0, 0, width, height)
                drawParticles(ctx, width, height, pixelRatio, energy)
            }
            state.particleAnimation = requestAnimationFrame(draw)
        }
        draw()
    }

    function drawParticles(ctx, width, height, pixelRatio, energy) {
        state.particles.forEach(particle => {
            const speed = state.visualizerStyle === "nebula" ? 1.8 : 1
            particle.x = (particle.x + particle.vx * speed * (1 + energy * 3) + 1) % 1
            particle.y = (particle.y + particle.vy * speed * (1 + energy * 3) + 1) % 1
            const radius = (particle.r + energy * (state.visualizerStyle === "pulse" ? 16 : 7)) * pixelRatio
            const x = particle.x * width
            const y = particle.y * height
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 8)
            gradient.addColorStop(0, `hsla(${particle.hue}, 90%, 62%, ${.18 + energy * .2})`)
            gradient.addColorStop(1, `hsla(${particle.hue}, 90%, 62%, 0)`)
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(x, y, radius * 8, 0, Math.PI * 2)
            ctx.fill()
        })
    }

    function drawAuroraWash(ctx, width, height, pixelRatio, data, energy) {
        ctx.globalCompositeOperation = "source-over"
        ctx.fillStyle = `rgba(0, 0, 0, ${.045 + energy * .035})`
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = "lighter"
        const time = Date.now() / 1000
        for (let band = 0; band < 9; band += 1) {
            const sample = data[(band * 5) % data.length] / 255 || energy
            const yBase = height * (.15 + band * .085)
            const hue = particleHue((band / 9 + time * .025) % 1)
            const alpha = .055 + sample * .16
            const amplitude = height * (.08 + sample * .12)
            ctx.beginPath()
            for (let step = 0; step <= 42; step += 1) {
                const x = (step / 42) * width
                const y = yBase + Math.sin(step * .62 + time * (.7 + band * .06)) * amplitude + Math.cos(step * .23 + band) * amplitude * .45
                if (step === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            }
            ctx.lineWidth = (28 + sample * 64) * pixelRatio
            ctx.strokeStyle = `hsla(${hue}, 94%, ${58 + sample * 18}%, ${alpha})`
            ctx.stroke()
        }
        ctx.globalCompositeOperation = "source-over"
    }

    function drawBokehField(ctx, width, height, pixelRatio, data, energy) {
        const time = Date.now() / 1000
        const count = state.visualizerStyle === "nebula" ? 80 : 46
        for (let index = 0; index < count; index += 1) {
            const seed = Math.sin(index * 91.7) * 10000
            const x = ((Math.sin(seed) * 43758.5453 + time * (.012 + index % 5 * .002)) % 1 + 1) % 1
            const y = ((Math.cos(seed * 1.37) * 24634.6345 + time * (.008 + index % 7 * .0015)) % 1 + 1) % 1
            const sample = data[index % data.length] / 255 || energy
            const radius = (20 + (index % 9) * 9 + sample * 70) * pixelRatio
            const hue = particleHue((index / count + sample * .12) % 1)
            const gradient = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, radius)
            gradient.addColorStop(0, `hsla(${hue}, 92%, ${60 + sample * 18}%, ${.1 + sample * .18})`)
            gradient.addColorStop(1, `hsla(${hue}, 92%, 54%, 0)`)
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(x * width, y * height, radius, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    function drawLiquidColor(ctx, width, height, pixelRatio, data, energy) {
        ctx.globalCompositeOperation = "source-over"
        ctx.fillStyle = `rgba(0, 0, 0, ${.055 + energy * .025})`
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = "lighter"
        const time = Date.now() / 1000
        const blobs = state.visualizerStyle === "pulse" ? 7 : 11
        for (let index = 0; index < blobs; index += 1) {
            const sample = data[(index * 6) % data.length] / 255 || energy
            const x = width * (.5 + Math.sin(time * (.13 + index * .017) + index * 1.8) * (.24 + sample * .08))
            const y = height * (.5 + Math.cos(time * (.11 + index * .013) + index * 2.2) * (.26 + sample * .08))
            const radius = (Math.min(width, height) * (.18 + sample * .22)) * pixelRatio
            const hue = particleHue((index / blobs + time * .035) % 1)
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
            gradient.addColorStop(0, `hsla(${hue}, 90%, ${58 + sample * 20}%, ${.1 + sample * .18})`)
            gradient.addColorStop(.42, `hsla(${hue + 18}, 90%, 54%, ${.05 + sample * .1})`)
            gradient.addColorStop(1, `hsla(${hue}, 90%, 45%, 0)`)
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.globalCompositeOperation = "source-over"
    }

    function drawImageKaleidoscope(ctx, width, height, pixelRatio, data, energy) {
        const image = state.visualizerImage
        if (!image?.complete || !image.naturalWidth) {
            drawBokehField(ctx, width, height, pixelRatio, data, energy)
            return
        }
        const time = Date.now() / 1000
        const segments = state.visualizerStyle === "pulse" ? 8 : state.visualizerStyle === "nebula" ? 14 : 10
        const radius = Math.hypot(width, height)
        const sample = data[4] / 255 || energy
        const zoom = 1.25 + sample * .45 + Math.sin(time * .23) * .08
        const crop = Math.min(image.naturalWidth, image.naturalHeight) / zoom
        const sx = (image.naturalWidth - crop) * (.5 + Math.sin(time * .07) * .16)
        const sy = (image.naturalHeight - crop) * (.5 + Math.cos(time * .06) * .16)

        ctx.save()
        ctx.translate(width / 2, height / 2)
        ctx.globalCompositeOperation = "source-over"
        ctx.fillStyle = `rgba(0,0,0,${.05 + energy * .04})`
        ctx.fillRect(-width / 2, -height / 2, width, height)
        ctx.globalCompositeOperation = "lighter"
        for (let index = 0; index < segments; index += 1) {
            ctx.save()
            ctx.rotate((Math.PI * 2 * index) / segments + time * (.025 + energy * .04))
            if (index % 2) ctx.scale(1, -1)
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.arc(0, 0, radius, -Math.PI / segments, Math.PI / segments)
            ctx.closePath()
            ctx.clip()
            ctx.globalAlpha = .16 + sample * .12
            ctx.drawImage(image, sx, sy, crop, crop, -radius * .08, -radius * .5, radius, radius)
            ctx.restore()
        }
        ctx.globalCompositeOperation = "source-over"
        const vignette = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * .52)
        vignette.addColorStop(0, `rgba(255,255,255,${.035 + sample * .035})`)
        vignette.addColorStop(.6, "rgba(0,0,0,0)")
        vignette.addColorStop(1, "rgba(0,0,0,.3)")
        ctx.fillStyle = vignette
        ctx.fillRect(-width / 2, -height / 2, width, height)
        ctx.restore()
    }

    function drawImageFloat(ctx, width, height, pixelRatio, data, energy) {
        const image = state.visualizerImage
        if (!image?.complete || !image.naturalWidth) {
            drawBokehField(ctx, width, height, pixelRatio, data, energy)
            return
        }
        const time = Date.now() / 1000
        const count = state.visualizerStyle === "nebula" ? 38 : state.visualizerStyle === "pulse" ? 18 : 26
        ctx.globalCompositeOperation = "source-over"
        ctx.fillStyle = `rgba(0,0,0,${.045 + energy * .03})`
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = "lighter"
        for (let index = 0; index < count; index += 1) {
            const seed = Math.sin(index * 73.17) * 10000
            const sample = data[(index * 3) % data.length] / 255 || energy
            const drift = state.visualizerStyle === "pulse" ? .18 : state.visualizerStyle === "nebula" ? .34 : .24
            const x = width * (((Math.sin(seed) * 43758.54) % 1 + 1) % 1)
                + Math.sin(time * (.19 + index * .006) + seed) * width * drift
            const y = height * (((Math.cos(seed * 1.31) * 24634.63) % 1 + 1) % 1)
                + Math.cos(time * (.15 + index * .005) + seed) * height * drift
            const size = Math.min(width, height) * (.055 + (index % 5) * .012 + sample * .075)
            const rotation = time * (.05 + sample * .12) + index
            ctx.save()
            ctx.translate((x % width + width) % width, (y % height + height) % height)
            ctx.rotate(rotation)
            ctx.globalAlpha = .055 + sample * .18
            const drawSize = size * (state.visualizerStyle === "pulse" ? 1 + energy * 1.1 : 1 + sample * .55)
            ctx.drawImage(image, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
            ctx.restore()
        }
        ctx.globalCompositeOperation = "source-over"
    }

    // Inspired by Humprt/particula's MIT-licensed audio-reactive particle sphere,
    // adapted here as a local 2D canvas renderer to avoid CDN/Three.js dependencies.
    function drawParticulaSphere(ctx, width, height, pixelRatio, data, energy) {
        if (!state.particulaParticles.length) {
            state.particulaParticles = makeSphereParticles(2200)
        }
        const cx = width * .5
        const cy = height * .5
        const shortest = Math.min(width, height)
        const baseRadius = shortest * .2
        const haloRadius = shortest * .38
        const time = Date.now() / 1000
        const rotY = time * (.09 + energy * .2)
        const rotX = Math.sin(time * .13) * .32
        const cosY = Math.cos(rotY)
        const sinY = Math.sin(rotY)
        const cosX = Math.cos(rotX)
        const sinX = Math.sin(rotX)

        ctx.globalCompositeOperation = "source-over"
        ctx.fillStyle = `rgba(0, 0, 0, ${state.visualizerStyle === "pulse" ? .18 : .1})`
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = "lighter"

        state.particulaParticles.forEach((particle, index) => {
            const band = data[index % data.length] / 255 || energy * .35
            const low = data[index % 9] / 255 || energy
            const turbulence = Math.sin(time * (.55 + particle.seed) + particle.seed * 19 + band * 8)
            const filament = Math.sin(time * .42 + particle.theta * 7 + particle.phi * 5)
            const spiral = time * (.16 + energy * .42) + particle.seed * 6
            const shellMix = particle.core ? baseRadius : haloRadius
            const radius = shellMix * particle.shell + (band * shortest * .12) + turbulence * shortest * .02
            const swirl = particle.core ? .18 + energy * .3 : .5 + low * .35
            let x = particle.x * radius + Math.cos(particle.theta + spiral) * shortest * .04 * swirl * filament
            let y = particle.y * radius + Math.sin(particle.phi * 3 + spiral) * shortest * .035 * swirl * turbulence
            let z = particle.z * radius + Math.sin(particle.theta - spiral) * shortest * .04 * swirl

            const xz = x * cosY - z * sinY
            const zz = x * sinY + z * cosY
            const yz = y * cosX - zz * sinX
            const z2 = y * sinX + zz * cosX
            const perspective = 1.25 / (1.25 + z2 / shortest)
            const screenX = cx + xz * perspective
            const screenY = cy + yz * perspective
            const depth = Math.max(.03, Math.min(1, (z2 / shortest + .68)))
            const size = Math.max(.36, (particle.size + band * 1.6 + low * 1.1) * pixelRatio * perspective)
            const hue = particle.particulaHue + band * 18
            const alpha = (particle.core ? .2 : .05) + depth * (particle.core ? .42 : .18) + band * .18
            ctx.fillStyle = `hsla(${hue}, 96%, ${particle.core ? 62 + band * 20 : 42 + band * 22}%, ${Math.min(.78, alpha)})`
            ctx.beginPath()
            ctx.arc(screenX, screenY, size, 0, Math.PI * 2)
            ctx.fill()

            if (particle.core && band + energy > .45) {
                const glow = size * (4 + band * 7)
                const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glow)
                gradient.addColorStop(0, `hsla(${hue}, 96%, 68%, ${.12 + band * .18})`)
                gradient.addColorStop(1, `hsla(${hue}, 96%, 52%, 0)`)
                ctx.fillStyle = gradient
                ctx.beginPath()
                ctx.arc(screenX, screenY, glow, 0, Math.PI * 2)
                ctx.fill()
            }
        })
        ctx.globalCompositeOperation = "source-over"
    }

    function makeSphereParticles(count) {
        return Array.from({length: count}, (_, index) => {
            const t = (index + .5) / count
            const inclination = Math.acos(1 - 2 * t)
            const azimuth = Math.PI * (1 + Math.sqrt(5)) * index
            const core = Math.random() > .32
            const shell = core ? .2 + Math.random() * .9 : .85 + Math.random() * .95
            const palette = Math.random()
            return {
                x: Math.sin(inclination) * Math.cos(azimuth),
                y: Math.sin(inclination) * Math.sin(azimuth),
                z: Math.cos(inclination),
                theta: azimuth,
                phi: inclination,
                shell,
                core,
                size: core ? .32 + Math.random() * 1.1 : .16 + Math.random() * .78,
                particulaHue: palette < .58 ? 28 + Math.random() * 25 : palette < .82 ? 278 + Math.random() * 32 : 348 + Math.random() * 30,
                seed: Math.random(),
            }
        })
    }

    function drawBars(ctx, width, height, pixelRatio, data, energy) {
        const bars = Math.min(48, data.length)
        const gap = 4 * pixelRatio
        const barWidth = Math.max(8 * pixelRatio, (width - gap * (bars - 1)) / bars)
        ctx.fillStyle = `rgba(0,0,0,${.05 + energy * .04})`
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = "lighter"
        for (let index = 0; index < bars; index += 1) {
            const value = easedBand(data, index, bars)
            const barHeight = height * (.22 + value * .88)
            const x = index * (barWidth + gap)
            const hue = particleHue(index / bars)
            const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height)
            gradient.addColorStop(0, `hsla(${hue}, 94%, 66%, ${.04 + value * .16})`)
            gradient.addColorStop(.5, `hsla(${hue}, 94%, 54%, ${.08 + value * .18})`)
            gradient.addColorStop(1, `hsla(${hue}, 94%, 38%, 0)`)
            ctx.fillStyle = gradient
            roundRect(ctx, x, height - barHeight, barWidth, barHeight, 12 * pixelRatio)
            ctx.fill()
        }
        ctx.globalCompositeOperation = "source-over"
    }

    function drawMotionSpectrum(ctx, width, height, pixelRatio, data, energy) {
        const bands = 64
        const pad = width * .035
        const areaWidth = width - pad * 2
        const gap = 3 * pixelRatio
        const barWidth = Math.max(6 * pixelRatio, areaWidth / bands - gap)
        drawAnalyzerBackdrop(ctx, width, height, energy)
        ctx.globalCompositeOperation = "lighter"
        for (let index = 0; index < bands; index += 1) {
            const sample = easedBand(data, index, bands)
            const x = pad + index * (barWidth + gap)
            const h = Math.max(height * .18, Math.pow(sample, .68) * height * .9)
            const hue = particleHue(index / bands)
            const top = (height - h) * .5
            const grad = ctx.createLinearGradient(0, top, 0, top + h)
            grad.addColorStop(0, `hsla(${hue}, 98%, 68%, 0)`)
            grad.addColorStop(.5, `hsla(${hue}, 92%, 58%, ${.06 + sample * .24})`)
            grad.addColorStop(1, `hsla(${hue}, 92%, 38%, 0)`)
            ctx.fillStyle = grad
            roundRect(ctx, x, top, barWidth, h, 9 * pixelRatio)
            ctx.fill()
        }
        ctx.globalCompositeOperation = "source-over"
    }

    function drawLedBands(ctx, width, height, pixelRatio, data, energy) {
        const bands = 34
        const ledRows = 22
        const pad = width * .045
        const areaWidth = width - pad * 2
        const rowGap = 4 * pixelRatio
        const colGap = 6 * pixelRatio
        const cellWidth = Math.max(5 * pixelRatio, areaWidth / bands - colGap)
        const cellHeight = Math.max(5 * pixelRatio, height * .9 / ledRows - rowGap)
        const top = height * .05
        drawAnalyzerBackdrop(ctx, width, height, energy)
        ctx.globalCompositeOperation = "lighter"
        for (let index = 0; index < bands; index += 1) {
            const value = easedBand(data, index, bands)
            const lit = Math.max(1, Math.round(value * ledRows))
            const x = pad + index * (cellWidth + colGap)
            for (let row = 0; row < ledRows; row += 1) {
                const active = row < lit
                const y = top + (ledRows - row - 1) * (cellHeight + rowGap)
                const level = row / ledRows
                const hue = level > .76 ? 12 : level > .58 ? 42 : particleHue(index / bands)
                ctx.fillStyle = active
                    ? `hsla(${hue}, 96%, ${54 + level * 18}%, ${.035 + value * .2})`
                    : `rgba(255,255,255,${.012 + energy * .008})`
                roundRect(ctx, x, y, cellWidth, cellHeight, 3 * pixelRatio)
                ctx.fill()
            }
        }
        ctx.globalCompositeOperation = "source-over"
    }

    function drawMirrorSpectrum(ctx, width, height, pixelRatio, data, energy) {
        const bands = 70
        const pad = width * .035
        const areaWidth = width - pad * 2
        const center = height * .5
        const maxHeight = height * .56
        const gap = 3 * pixelRatio
        const barWidth = Math.max(5 * pixelRatio, areaWidth / bands - gap)
        drawAnalyzerBackdrop(ctx, width, height, energy)
        ctx.globalCompositeOperation = "lighter"
        for (let index = 0; index < bands; index += 1) {
            const value = easedBand(data, index, bands)
            const h = Math.max(2 * pixelRatio, Math.pow(value, .72) * maxHeight)
            const x = pad + index * (barWidth + gap)
            const hue = particleHue(index / bands)
            const gradTop = ctx.createLinearGradient(0, center - h, 0, center)
            gradTop.addColorStop(0, `hsla(${hue}, 96%, 60%, 0)`)
            gradTop.addColorStop(1, `hsla(${hue}, 96%, ${48 + value * 24}%, ${.06 + value * .24})`)
            ctx.fillStyle = gradTop
            roundRect(ctx, x, center - h, barWidth, h, 8 * pixelRatio)
            ctx.fill()
            const gradBottom = ctx.createLinearGradient(0, center, 0, center + h)
            gradBottom.addColorStop(0, `hsla(${hue}, 96%, ${48 + value * 24}%, ${.06 + value * .22})`)
            gradBottom.addColorStop(1, `hsla(${hue}, 96%, 60%, 0)`)
            ctx.fillStyle = gradBottom
            roundRect(ctx, x, center, barWidth, h, 8 * pixelRatio)
            ctx.fill()
        }
        ctx.globalCompositeOperation = "source-over"
        ctx.strokeStyle = `rgba(255,255,255,${.035 + energy * .08})`
        ctx.lineWidth = pixelRatio
        ctx.beginPath()
        ctx.moveTo(pad, center)
        ctx.lineTo(width - pad, center)
        ctx.stroke()
    }

    function drawAnalyzerBackdrop(ctx, width, height, energy) {
        const bg = ctx.createRadialGradient(width * .5, height * .52, 0, width * .5, height * .52, Math.max(width, height) * .65)
        bg.addColorStop(0, `rgba(255,255,255,${.035 + energy * .035})`)
        bg.addColorStop(.55, "rgba(255,255,255,.018)")
        bg.addColorStop(1, "rgba(0,0,0,.18)")
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, width, height)
    }

    function easedBand(data, index, total) {
        const normalized = index / Math.max(1, total - 1)
        const sourceIndex = Math.min(data.length - 1, Math.floor(Math.pow(normalized, 1.7) * (data.length - 1)))
        const value = data[sourceIndex] / 255
        return Math.max(.015, value)
    }

    function drawRings(ctx, width, height, pixelRatio, energy) {
        const cx = width * .5
        const cy = height * .52
        const time = Date.now() / 1000
        const maxRadius = Math.hypot(width, height) * .42
        for (let index = 0; index < 7; index += 1) {
            const phase = ((time * (.09 + energy * .24) + index / 7) % 1)
            const radius = (phase * maxRadius) + 32 * pixelRatio
            const alpha = Math.max(0, (1 - phase) * (.18 + energy * .36))
            ctx.strokeStyle = `hsla(${particleHue(index / 7)}, 96%, 64%, ${alpha})`
            ctx.lineWidth = (1.4 + energy * 5) * pixelRatio
            ctx.beginPath()
            ctx.arc(cx, cy, radius, 0, Math.PI * 2)
            ctx.stroke()
        }
    }

    function drawWaveform(ctx, width, height, pixelRatio, data, energy) {
        const mid = height * .5
        const amplitude = height * (.12 + energy * .25)
        ctx.lineWidth = (2 + energy * 5) * pixelRatio
        ctx.strokeStyle = `hsla(${particleHue(.7)}, 96%, 68%, .78)`
        ctx.shadowColor = `hsla(${particleHue(.45)}, 96%, 58%, .52)`
        ctx.shadowBlur = 18 * pixelRatio
        ctx.beginPath()
        data.forEach((value, index) => {
            const x = (index / (data.length - 1)) * width
            const y = mid + ((value - 128) / 128) * amplitude
            if (index === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        })
        ctx.stroke()
        ctx.shadowBlur = 0
    }

    function drawRadial(ctx, width, height, pixelRatio, data, energy) {
        const cx = width * .5
        const cy = height * .5
        const baseRadius = Math.min(width, height) * (.12 + energy * .08)
        const bars = Math.min(96, data.length)
        ctx.lineCap = "round"
        for (let index = 0; index < bars; index += 1) {
            const value = data[index % data.length] / 255
            const angle = (index / bars) * Math.PI * 2 - Math.PI / 2
            const inner = baseRadius + 12 * pixelRatio
            const outer = inner + (height * .18 * Math.max(value, energy * .2))
            const hue = particleHue(index / bars)
            ctx.strokeStyle = `hsla(${hue}, 96%, 64%, ${.35 + value * .6})`
            ctx.lineWidth = (2 + value * 5) * pixelRatio
            ctx.beginPath()
            ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
            ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
            ctx.stroke()
        }
    }

    function drawTunnel(ctx, width, height, pixelRatio, data, energy) {
        const cx = width * .5
        const cy = height * .5
        const time = Date.now() / 1000
        const count = 90
        for (let index = 0; index < count; index += 1) {
            const value = data[index % data.length] / 255 || energy
            const depth = ((index / count + time * (.04 + energy * .08)) % 1)
            const angle = index * 2.399 + time * .35
            const radius = depth * Math.min(width, height) * .72
            const x = cx + Math.cos(angle) * radius
            const y = cy + Math.sin(angle) * radius
            const size = (1.5 + value * 5 + depth * 4) * pixelRatio
            ctx.fillStyle = `hsla(${particleHue(depth)}, 96%, ${58 + value * 20}%, ${Math.max(.06, 1 - depth)})`
            ctx.beginPath()
            ctx.arc(x, y, size, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    function drawKaleidoscope(ctx, width, height, pixelRatio, data, energy) {
        const shortest = Math.min(width, height)
        const cell = Math.max(8 * pixelRatio, shortest / 42)
        const cols = Math.ceil(width / cell)
        const rows = Math.ceil(height / cell)
        const centerCol = cols / 2
        const centerRow = rows / 2
        const time = Date.now() / 620
        ctx.save()
        ctx.globalCompositeOperation = state.visualizerStyle === "nebula" ? "lighter" : "source-over"
        for (let row = 0; row <= centerRow; row += 1) {
            for (let col = 0; col <= centerCol; col += 1) {
                const distance = Math.hypot(col - centerCol, row - centerRow)
                const value = data[(Math.floor(distance * 2 + time) + row + col) % data.length] / 255 || energy
                const pulse = Math.sin(time * .9 + distance * .38)
                const alpha = Math.max(.05, Math.min(.68, value * .5 + energy * .34 + pulse * .08))
                const hue = particleHue((distance % 24) / 24)
                const size = cell * (.45 + value * .55)
                const x = col * cell
                const y = row * cell
                ctx.fillStyle = `hsla(${hue}, 96%, ${48 + value * 26}%, ${alpha})`
                drawMirroredPixel(ctx, x, y, width, height, size)
            }
        }
        ctx.restore()
    }

    function drawMirroredPixel(ctx, x, y, width, height, size) {
        const points = [
            [x, y],
            [width - x, y],
            [x, height - y],
            [width - x, height - y],
            [y, x],
            [width - y, x],
            [y, height - x],
            [width - y, height - x],
        ]
        points.forEach(([px, py]) => {
            ctx.fillRect(px - size / 2, py - size / 2, size, size)
        })
    }

    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.arcTo(x + width, y, x + width, y + height, radius)
        ctx.arcTo(x + width, y + height, x, y + height, radius)
        ctx.arcTo(x, y + height, x, y, radius)
        ctx.arcTo(x, y, x + width, y, radius)
        ctx.closePath()
    }

    function particleHue(offset=0) {
        if (Number.isFinite(offset) && offset > 0) {
            const bases = {
                amber: [15, 38],
                ocean: [190, 218],
                night: [206, 268],
                leather: [18, 30],
                brightgreen: [92, 118],
                caution: [20, 34],
                crimson: [354, 12],
                forest: [46, 134],
            }
            const pair = bases[state.theme] || bases.forest
            return pair[0] + (pair[1] - pair[0]) * offset
        }
        if (state.theme === "amber") return Math.random() > .45 ? 38 : 15
        if (state.theme === "ocean") return Math.random() > .45 ? 190 : 218
        if (state.theme === "night") return Math.random() > .45 ? 268 : 206
        if (state.theme === "leather") return Math.random() > .45 ? 30 : 18
        if (state.theme === "brightgreen") return Math.random() > .45 ? 118 : 92
        if (state.theme === "caution") return Math.random() > .45 ? 34 : 20
        if (state.theme === "crimson") return Math.random() > .45 ? 354 : 12
        return Math.random() > .55 ? 46 : 134
    }

    function stopParticleVisualizer() {
        if (state.particleAnimation) {
            cancelAnimationFrame(state.particleAnimation)
            state.particleAnimation = null
        }
        state.particulaParticles = []
        const canvas = byId("omParticles")
        const ctx = canvas?.getContext("2d")
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
    }

    function notifyDock() {
        window.dispatchEvent(new CustomEvent("overland-music-state", {detail: {icon: musicIcon(), playing: !state.audio?.paused}}))
    }

    window.overlandMusic = {
        open: openPlayer,
        close: closePlayer,
        icon: musicIcon,
    }

    function main() {
        createShell()
        loadVisualizerImages().catch(console.error)
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", main)
    } else {
        main()
    }
})()
