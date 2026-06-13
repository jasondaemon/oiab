/* IIAB Overland native map dock. */

(() => {
    const state = {
        config: null,
        apps: [],
        dockIds: [],
        appLayout: null,
    }

    const dockStorageKey = "iiab-overland-dock-v1"
    const musicDockMigrationKey = "iiab-overland-music-dock-added-v1"
    const mapStateKey = "iiab-overland-map-hash-v1"
    const configUrls = ["/maps/overland/apps.json", "/overland/apps.json"]
    const defaultAppLayout = {
        schema: 1,
        settingsPassword: "",
        hiddenAppIds: ["legacy-home", "legacy-admin"],
        folders: [
            {id: "games", title: "Games", icon: "/maps/overland/overland-folder-games.svg", protected: false, appIds: ["scoreboard", "chess", "checkers", "minesweeper", "blockfall", "claimline", "sinkhole-city", "canyon-crawler", "orbit-run", "blank-slate", "starts-ends", "dice-roller", "gridcycles", "word-tile-arena", "connect-four", "burst", "battleship", "dots-and-boxes", "hangman", "word-grid", "pattern-match", "web-emulator", "minecraft-map", "drums", "trivia", "tic-tac-toe", "license-plates"]},
            {id: "reading", title: "Reading", icon: "/maps/overland/overland-folder-reading.svg", protected: false, appIds: ["wikipedia", "books", "komga"]},
            {id: "settings", title: "Settings", icon: "/maps/overland/overland-folder-settings.svg", protected: true, appIds: ["overland-settings", "gps-status", "file-uploads", "map-packs", "service-manager", "game-data", "audio-test"]},
        ],
    }

    function overlandDomain() {
        const host = window.location.hostname
        if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host === "localhost") return ""
        const parts = host.split(".")
        if (parts.length > 2 && ["maps", "mobile", "music", "iiab", "files", "jellyfin", "monitor", "maps-admin", "minecraft-map", "minecraft-admin", "mindustry"].includes(parts[0])) {
            return parts.slice(1).join(".")
        }
        return host
    }

    function resolveUrl(url) {
        const value = String(url || "")
        const domain = overlandDomain()
        if (!domain && value.includes("{{overland_domain}}")) {
            const portFallbacks = {
                "files": 8448,
                "jellyfin": 8449,
                "monitor": 8445,
                "maps-admin": 8444,
                "minecraft-map": 8450,
                "minecraft-admin": 8452,
                "mindustry": 8447,
            }
            const match = value.match(/^https:\/\/([^/.]+)\.\{\{overland_domain\}\}\/?/)
            const port = match && portFallbacks[match[1]]
            if (port) return `https://${window.location.hostname}:${port}/`
        }
        return value
            .replaceAll("{{host}}", window.location.hostname)
            .replaceAll("{{overland_domain}}", domain || window.location.hostname)
    }

    function appById(id) {
        return state.apps.find(app => app.id === id)
    }

    function normalizeAppLayout(layout) {
        const source = layout && typeof layout === "object" ? layout : defaultAppLayout
        const folders = Array.isArray(source.folders) ? source.folders : defaultAppLayout.folders
        const hidden = Array.isArray(source.hiddenAppIds) ? source.hiddenAppIds : defaultAppLayout.hiddenAppIds
        return {
            schema: 1,
            settingsPassword: String(source.settingsPassword ?? defaultAppLayout.settingsPassword ?? ""),
            hiddenAppIds: [...new Set(hidden.map(String).filter(Boolean))],
            folders: folders.map(folder => ({
                id: String(folder.id || "").trim() || `folder-${Math.random().toString(16).slice(2, 8)}`,
                title: String(folder.title || folder.id || "Folder").trim() || "Folder",
                icon: String(folder.icon || ""),
                protected: !!folder.protected,
                appIds: [...new Set((Array.isArray(folder.appIds) ? folder.appIds : []).map(String).filter(Boolean))],
            })),
        }
    }

    function visibleApps() {
        const hidden = new Set((state.appLayout?.hiddenAppIds || []).filter(Boolean))
        return state.apps.filter(app => !hidden.has(app.id))
    }

    function appsForFolder(folder) {
        const hidden = new Set((state.appLayout?.hiddenAppIds || []).filter(Boolean))
        return (folder.appIds || []).map(appById).filter(app => app && !hidden.has(app.id))
    }

    function assignedFolderAppIds() {
        return new Set((state.appLayout?.folders || []).flatMap(folder => folder.appIds || []))
    }

    function looseApps() {
        const assigned = assignedFolderAppIds()
        return visibleApps().filter(app => !assigned.has(app.id))
    }

    function dockDisabledFromUrl() {
        const params = new URLSearchParams(window.location.search)
        const dock = String(params.get("dock") || "").toLowerCase()
        return dock === "0" || dock === "false" || params.get("noDock") === "1"
    }

    function standaloneAdminMode() {
        return document.body?.dataset?.standaloneApp === "admin" || new URLSearchParams(window.location.search).get("adminStandalone") === "1"
    }

    function iconFor(app) {
        const img = document.createElement("img")
        img.src = app.id === "music" && window.overlandMusic?.icon ? window.overlandMusic.icon() : (app.icon || "/js-menu/menu-files/images/main-logo.png")
        img.alt = ""
        img.loading = "lazy"
        img.addEventListener("error", () => {
            img.src = "/js-menu/menu-files/images/main-logo.png"
        }, {once: true})
        return img
    }

    function savedDockIds() {
        try {
            const parsed = JSON.parse(localStorage.getItem(dockStorageKey) || "[]")
            if (Array.isArray(parsed)) {
                return parsed.filter(id => appById(id))
            }
        } catch (_error) {
            return []
        }
        return []
    }

    function defaultDockIds() {
        const configured = Array.isArray(state.config.defaultDock) ? state.config.defaultDock : []
        const fallback = state.apps.filter(app => app.dock).map(app => app.id)
        return (configured.length ? configured : fallback).filter(id => appById(id))
    }

    function persistDock() {
        localStorage.setItem(dockStorageKey, JSON.stringify(state.dockIds))
    }

    function openApp(app) {
        if (app.id === "maps") {
            closeDialogs()
            return
        }
        if (app.id === "overland-settings") {
            closeDialogs()
            openSettingsDialog()
            return
        }
        if (app.native === "music" || app.id === "music") {
            closeDialogs()
            if (window.overlandMusic?.open) {
                window.overlandMusic.open()
            }
            return
        }
        if (app.native === "emulator" || app.id === "web-emulator") {
            closeDialogs()
            if (window.overlandEmulator?.open) {
                window.overlandEmulator.open()
            }
            return
        }
        if (app.native === "drums" || app.id === "drums") {
            closeDialogs()
            if (window.overlandDrums?.open) {
                window.overlandDrums.open()
            }
            return
        }
        if (app.native === "plates" || app.id === "license-plates") {
            closeDialogs()
            if (window.overlandPlates?.open) {
                window.overlandPlates.open()
            }
            return
        }
        if (app.native === "trivia" || app.id === "trivia") {
            closeDialogs()
            if (window.overlandTrivia?.open) {
                window.overlandTrivia.open()
            }
            return
        }
        if (app.openMode === "overlay") {
            closeDialogs()
            openWebOverlay(app)
            return
        }
        window.location.href = resolveUrl(app.url)
    }

    function ensureWebOverlay() {
        let overlay = document.getElementById("odWebOverlay")
        if (overlay) return overlay
        overlay = document.createElement("section")
        overlay.id = "odWebOverlay"
        overlay.className = "od-web-overlay"
        overlay.hidden = true
        overlay.innerHTML = `
            <div class="od-web-toolbar">
                <div class="od-web-title">
                    <img id="odWebIcon" alt="">
                    <span id="odWebTitle"></span>
                </div>
                <div class="od-web-actions">
                    <button id="odWebFullscreen" class="od-web-button" type="button" title="Fullscreen">⛶</button>
                    <button id="odWebClose" class="od-web-button" type="button" title="Close">×</button>
                </div>
            </div>
            <iframe id="odWebFrame" class="od-web-frame" title="Overland app"></iframe>`
        document.body.append(overlay)
        document.getElementById("odWebClose").addEventListener("click", closeWebOverlay)
        document.getElementById("odWebFullscreen").addEventListener("click", () => {
            if (overlay.requestFullscreen) overlay.requestFullscreen()
        })
        return overlay
    }

    function openWebOverlay(app) {
        const overlay = ensureWebOverlay()
        const icon = document.getElementById("odWebIcon")
        const title = document.getElementById("odWebTitle")
        const frame = document.getElementById("odWebFrame")
        icon.src = app.icon || "/js-menu/menu-files/images/main-logo.png"
        icon.onerror = () => { icon.src = "/js-menu/menu-files/images/main-logo.png" }
        title.textContent = app.title || "Overland App"
        frame.src = resolveUrl(app.url)
        overlay.hidden = false
    }

    function closeWebOverlay() {
        const overlay = document.getElementById("odWebOverlay")
        const frame = document.getElementById("odWebFrame")
        if (frame) frame.src = "about:blank"
        if (overlay) overlay.hidden = true
    }

    function closeDialogs() {
        document.querySelectorAll(".od-panel[open]").forEach(dialog => dialog.close())
    }

    function openSettingsDialog() {
        renderDockSettings()
        document.getElementById("odHttpsPanel").hidden = true
        document.getElementById("odDockPanel").hidden = true
        document.getElementById("odMapsPanel").hidden = true
        document.getElementById("odLauncherPanel").hidden = true
        document.getElementById("odServicesPanel").hidden = true
        document.getElementById("odContentPanel").hidden = true
        document.getElementById("odSettingsDialog").showModal()
    }

    function createSvg(viewBox, html, className = "") {
        const wrapper = document.createElement("span")
        wrapper.innerHTML = `<svg viewBox="${viewBox}" aria-hidden="true" class="${className}">${html}</svg>`
        return wrapper.firstElementChild
    }

    function createShell() {
        if (document.getElementById("odDock")) return

        const restoreButton = document.createElement("button")
        restoreButton.id = "odRestoreDock"
        restoreButton.className = "od-restore"
        restoreButton.type = "button"
        restoreButton.hidden = true
        restoreButton.setAttribute("aria-label", "Show quick dock")
        restoreButton.append(createSvg("0 0 48 48", `
            <rect x="7" y="28" width="34" height="10" rx="5"></rect>
            <circle cx="16" cy="33" r="2"></circle>
            <circle cx="24" cy="33" r="2"></circle>
            <circle cx="32" cy="33" r="2"></circle>
        `))

        const dock = document.createElement("section")
        dock.id = "odDock"
        dock.className = "od-dock"
        dock.setAttribute("aria-label", "Quick access dock")
        dock.innerHTML = `
            <div class="od-dock-main">
                <button id="odMinimizeDock" class="od-control" type="button" aria-label="Minimize dock">
                    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 22h24v4H12z"></path></svg>
                </button>
                <button id="odAppsButton" class="od-control od-control--apps" type="button" aria-label="Open apps">
                    <svg viewBox="0 0 48 48" aria-hidden="true" class="od-apps-folder-icon">
                        <path class="od-folder-shape" d="M6 14c0-2.2 1.8-4 4-4h11l4 5h13c2.2 0 4 1.8 4 4v15c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V14z"></path>
                        <rect x="16" y="22" width="5" height="5" rx="1"></rect>
                        <rect x="23" y="22" width="5" height="5" rx="1"></rect>
                        <rect x="30" y="22" width="5" height="5" rx="1"></rect>
                        <rect x="16" y="29" width="5" height="5" rx="1"></rect>
                        <rect x="23" y="29" width="5" height="5" rx="1"></rect>
                        <rect x="30" y="29" width="5" height="5" rx="1"></rect>
                    </svg>
                </button>
                <div id="odDockApps" class="od-dock-apps" aria-label="Pinned apps"></div>
                <button id="odSettingsButton" class="od-control" type="button" aria-label="Open settings">
                    <svg viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M27.9 6l1.3 5.1c1.1.4 2.1.8 3 1.4l4.6-2.7 4 6.9-4 3.4c.1.6.2 1.2.2 1.9s-.1 1.3-.2 1.9l4 3.4-4 6.9-4.6-2.7c-.9.6-1.9 1-3 1.4L27.9 42h-7.8l-1.3-5.1c-1.1-.4-2.1-.8-3-1.4l-4.6 2.7-4-6.9 4-3.4c-.1-.6-.2-1.2-.2-1.9s.1-1.3.2-1.9l-4-3.4 4-6.9 4.6 2.7c.9-.6 1.9-1 3-1.4L20.1 6h7.8zM24 17a7 7 0 100 14 7 7 0 000-14z"></path>
                    </svg>
                </button>
            </div>
        `

        const appsDialog = document.createElement("dialog")
        appsDialog.id = "odAppsDialog"
        appsDialog.className = "od-panel od-launchpad"
        appsDialog.innerHTML = `
            <form method="dialog"><button class="od-panel-close od-launchpad-close" aria-label="Close apps">x</button></form>
            <div id="odAppsNav" class="od-apps-nav"></div>
            <div id="odAppsGrid" class="od-apps-grid"></div>
        `

        const passwordDialog = document.createElement("dialog")
        passwordDialog.id = "odFolderPasswordDialog"
        passwordDialog.className = "od-folder-password od-panel"
        passwordDialog.innerHTML = `
            <form method="dialog"><button class="od-web-button od-folder-password-close" aria-label="Close password">x</button></form>
            <h2 id="odFolderPasswordTitle">Protected Folder</h2>
            <p>Enter the launcher password to open this folder.</p>
            <input id="odFolderPasswordInput" type="password" autocomplete="current-password" placeholder="Password">
            <div id="odFolderPasswordError" class="od-folder-password-error"></div>
            <button id="odFolderPasswordSubmit" class="od-soft-button" type="button">Open Folder</button>
        `

        const settingsDialog = document.createElement("dialog")
        settingsDialog.id = "odSettingsDialog"
        settingsDialog.className = "od-panel od-settings-panel"
        settingsDialog.innerHTML = `
            <div class="od-settings-frame">
                <div class="od-settings-toolbar">
                    <div class="od-settings-title">
                        <span>IIAB Overland Admin</span>
                        <small>Offline platform, services, maps, storage, and dock behavior</small>
                    </div>
                    <form method="dialog">
                        <button class="od-web-button od-settings-close" aria-label="Close settings">x</button>
                    </form>
                </div>
                <div class="od-settings-scroll">
                <section class="od-settings-section">
                    <div class="od-admin-card-grid">
                        <a class="od-admin-card" href="/admin/#ControlServer">
                            <strong>Control Server</strong>
                            <span>Reboot/power controls, network controls, Bluetooth, Tailscale, and server warnings.</span>
                        </a>
                        <a class="od-admin-card" href="/admin/#Configure">
                            <strong>Configure IIAB</strong>
                            <span>Configure installed IIAB services and platform options.</span>
                        </a>
                        <a class="od-admin-card" href="/admin/#InstallContent">
                            <strong>Install Content</strong>
                            <span>Install ZIMs, OER2Go/RACHEL modules, map packs, and other offline content.</span>
                        </a>
                        <a class="od-admin-card" href="/admin/#ContentMenus">
                            <strong>Content Menus</strong>
                            <span>Edit the IIAB home/menu definitions that feed available content.</span>
                        </a>
                        <a class="od-admin-card" href="/admin/#Util">
                            <strong>Utilities</strong>
                            <span>Diagnostics, logs, maintenance tools, and admin utilities.</span>
                        </a>
                        <a class="od-admin-card" href="/admin/">
                            <strong>Full Legacy Admin Console</strong>
                            <span>Open the upstream console directly for functions not yet rebuilt in Overland.</span>
                        </a>
                        <button id="odOpenHttpsPanel" class="od-admin-card" type="button">
                            <strong>Trusted HTTPS</strong>
                            <span>Configure Let's Encrypt DNS-01, certificate renewal, and local router DNS guidance.</span>
                        </button>
                        <button id="odOpenDockPanel" class="od-admin-card" type="button">
                            <strong>Dock Settings</strong>
                            <span>Choose which apps stay pinned to the quick-access dock.</span>
                        </button>
                        <button id="odOpenLauncherPanel" class="od-admin-card" type="button">
                            <strong>App Launcher</strong>
                            <span>Create folders, hide app icons, and set the Settings folder password.</span>
                        </button>
                        <button id="odOpenMapsPanel" class="od-admin-card" type="button">
                            <strong>Maps Settings</strong>
                            <span>Map-level preferences and maintenance actions.</span>
                        </button>
                        <button id="odOpenServicesPanel" class="od-admin-card" type="button">
                            <strong>Service State</strong>
                            <span>Turn local game, media, IIAB, and Overland services on or off.</span>
                        </button>
                        <button id="odOpenContentPanel" class="od-admin-card" type="button">
                            <strong>IIAB Content</strong>
                            <span>View installed ZIM content and refresh the Kiwix library index.</span>
                        </button>
                    </div>
                </section>
                </div>
                <section id="odHttpsPanel" class="od-settings-subpanel" hidden>
                    <div class="od-settings-toolbar od-settings-subtoolbar">
                        <div class="od-settings-title">
                            <span>Trusted HTTPS</span>
                            <small>Let’s Encrypt DNS-01 certificates for local Overland hostnames</small>
                        </div>
                        <button id="odHttpsBack" class="od-web-button" type="button" aria-label="Back to admin">x</button>
                    </div>
                    <div class="od-settings-scroll od-settings-subscroll">
                        <section class="od-settings-section" id="odHttpsSection">
                            <div class="od-section-heading">
                                <h2>Certificate Settings</h2>
                                <p>Configure trusted HTTPS without exposing this Pi publicly.</p>
                            </div>
                            <div class="od-https-grid">
                                <label>Base Domain <input id="odHttpsDomain" placeholder="overland.daemonadventures.net"></label>
                                <label>Pi LAN IP <input id="odHttpsPiIp" placeholder="192.168.8.2"></label>
                                <label>Certificate Domains <input id="odHttpsCertDomains" placeholder="overland.daemonadventures.net,*.overland.daemonadventures.net,mobile.daemonadventures.net"></label>
                                <label>ACME Email <input id="odHttpsEmail" placeholder="you@example.com"></label>
                                <label>Maps Host <input id="odHttpsMapsHost" placeholder="maps.overland.daemonadventures.net"></label>
                                <label>Mobile Host <input id="odHttpsMobileHost" placeholder="mobile.daemonadventures.net"></label>
                                <label>IIAB Host <input id="odHttpsIiabHost" placeholder="iiab.overland.daemonadventures.net"></label>
                                <label>Files Host <input id="odHttpsFilesHost" placeholder="files.overland.daemonadventures.net"></label>
                                <label>Jellyfin Host <input id="odHttpsJellyfinHost" placeholder="jellyfin.overland.daemonadventures.net"></label>
                                <label>Cloudflare API Token <input id="odHttpsToken" type="password" autocomplete="new-password" placeholder="Paste token to save or replace"></label>
                            </div>
                            <div class="od-settings-actions">
                                <button id="odHttpsSaveConfig" class="od-soft-button" type="button">Save HTTPS Config</button>
                                <button id="odHttpsSaveToken" class="od-soft-button" type="button">Save Cloudflare Token</button>
                                <button id="odHttpsIssueCert" class="od-soft-button" type="button">Issue / Renew Cert</button>
                                <button id="odHttpsPretrip" class="od-soft-button" type="button">Run Pre-Trip Check</button>
                                <button id="odHttpsDns" class="od-soft-button" type="button">Show Router DNS</button>
                            </div>
                            <pre id="odHttpsOutput" class="od-https-output">Loading HTTPS status...</pre>
                        </section>
                    </div>
                </section>
                <section id="odDockPanel" class="od-settings-subpanel" hidden>
                    <div class="od-settings-toolbar od-settings-subtoolbar">
                        <div class="od-settings-title">
                            <span>Dock Settings</span>
                            <small>Choose the apps pinned to the bottom quick-access dock</small>
                        </div>
                        <button id="odDockBack" class="od-web-button" type="button" aria-label="Back to admin">x</button>
                    </div>
                    <div class="od-settings-scroll od-settings-subscroll">
                        <section class="od-settings-section">
                            <div class="od-section-heading">
                                <h2>Dock Apps</h2>
                                <p>Fresh/reset default: Music, Media Server, System Monitor, and Wikipedia.</p>
                            </div>
                            <div id="odDockSettings" class="od-dock-settings"></div>
                            <div class="od-settings-actions">
                                <button id="odResetDock" class="od-soft-button" type="button">Reset Dock</button>
                            </div>
                        </section>
                    </div>
                </section>
                <section id="odMapsPanel" class="od-settings-subpanel" hidden>
                    <div class="od-settings-toolbar od-settings-subtoolbar">
                        <div class="od-settings-title">
                            <span>Maps Settings</span>
                            <small>Map-level preferences and maintenance actions</small>
                        </div>
                        <button id="odMapsBack" class="od-web-button" type="button" aria-label="Back to admin">x</button>
                    </div>
                    <div class="od-settings-scroll od-settings-subscroll">
                        <section class="od-settings-section">
                            <div class="od-section-heading">
                                <h2>Map View</h2>
                                <p>Waypoints, folders, imports, exports, and regions are handled directly in the map UI.</p>
                            </div>
                            <div class="od-admin-card-grid">
                                <button id="odResetMapView" class="od-admin-card od-admin-card--danger" type="button">
                                    <strong>Reset Saved Map View</strong>
                                    <span>Clear saved position, zoom, style, terrain, and active full-quality region for this browser.</span>
                                </button>
                            </div>
                        </section>
                    </div>
                </section>
                <section id="odLauncherPanel" class="od-settings-subpanel" hidden>
                    <div class="od-settings-toolbar od-settings-subtoolbar">
                        <div class="od-settings-title">
                            <span>App Launcher</span>
                            <small>Shared app folders and hidden icons for map and mobile launchers</small>
                        </div>
                        <button id="odLauncherBack" class="od-web-button" type="button" aria-label="Back to admin">x</button>
                    </div>
                    <div class="od-settings-scroll od-settings-subscroll">
                        <section class="od-settings-section">
                            <div class="od-launcher-editor-head">
                                <label>Settings Folder Password <input id="odLauncherPassword" type="text" autocomplete="off"></label>
                                <div class="od-settings-actions">
                                    <button id="odAddLauncherFolder" class="od-soft-button" type="button">Add Folder</button>
                                    <button id="odSaveLauncherLayout" class="od-soft-button" type="button">Save Layout</button>
                                    <button id="odResetLauncherLayout" class="od-soft-button od-soft-button--danger" type="button">Reset Defaults</button>
                                </div>
                            </div>
                            <div id="odLauncherMessage" class="od-admin-message" hidden></div>
                            <h2>Folders</h2>
                            <div id="odLauncherFolders" class="od-launcher-folders"></div>
                            <h2>Apps</h2>
                            <div id="odLauncherApps" class="od-launcher-apps"></div>
                        </section>
                    </div>
                </section>
                <section id="odServicesPanel" class="od-settings-subpanel" hidden>
                    <div class="od-settings-toolbar od-settings-subtoolbar">
                        <div class="od-settings-title">
                            <span>Service State</span>
                            <small>Start, stop, or restart local appliance services</small>
                        </div>
                        <button id="odServicesBack" class="od-web-button" type="button" aria-label="Back to admin">x</button>
                    </div>
                    <div class="od-settings-scroll od-settings-subscroll">
                        <section class="od-settings-section">
                            <div class="od-service-panel-actions">
                                <button id="odRefreshServices" class="od-soft-button" type="button">Refresh Services</button>
                            </div>
                            <div id="odServicesStatus" class="od-admin-status">Loading services...</div>
                            <div class="od-system-actions">
                                <button id="odSystemReboot" class="od-system-button" type="button">
                                    <strong>Reboot IIAB</strong>
                                    <span>Restart the Raspberry Pi</span>
                                </button>
                                <button id="odSystemShutdown" class="od-system-button od-system-button--danger" type="button">
                                    <strong>Shutdown IIAB</strong>
                                    <span>Power off the Raspberry Pi cleanly</span>
                                </button>
                            </div>
                        </section>
                    </div>
                </section>
                <section id="odContentPanel" class="od-settings-subpanel" hidden>
                    <div class="od-settings-toolbar od-settings-subtoolbar">
                        <div class="od-settings-title">
                            <span>IIAB Content</span>
                            <small>Installed offline content and Kiwix library maintenance</small>
                        </div>
                        <button id="odContentBack" class="od-web-button" type="button" aria-label="Back to admin">x</button>
                    </div>
                    <div class="od-settings-scroll od-settings-subscroll">
                        <section class="od-settings-section">
                            <div class="od-section-heading">
                                <h2>Kiwix / ZIM Library</h2>
                                <p>Install workflows will move here next. For now this shows installed content and can rebuild the Kiwix library index.</p>
                            </div>
                            <div class="od-settings-actions">
                                <button id="odRefreshContent" class="od-soft-button" type="button">Refresh Status</button>
                                <button id="odRefreshKiwix" class="od-soft-button" type="button">Rebuild Kiwix Library</button>
                            </div>
                            <div id="odContentStatus" class="od-admin-status">Loading content...</div>
                        </section>
                    </div>
                </section>
            </div>
        `

        document.body.append(restoreButton, dock, appsDialog, passwordDialog, settingsDialog)
    }

    function renderDock() {
        const dockApps = document.getElementById("odDockApps")
        dockApps.replaceChildren()
        state.dockIds.map(appById).filter(Boolean).forEach(app => {
            const button = document.createElement("button")
            button.className = "od-app"
            button.type = "button"
            button.title = app.title
            button.setAttribute("aria-label", app.title)
            button.append(iconFor(app))
            button.addEventListener("click", () => openApp(app))
            dockApps.append(button)
        })
    }

    function appCard(app) {
        const card = document.createElement("a")
        card.className = "od-app-card"
        card.href = resolveUrl(app.url)
        if (app.native === "music" || app.id === "music" || app.native === "emulator" || app.id === "web-emulator" || app.native === "drums" || app.id === "drums" || app.native === "plates" || app.id === "license-plates" || app.native === "trivia" || app.id === "trivia" || app.openMode === "overlay") {
            card.addEventListener("click", event => {
                event.preventDefault()
                openApp(app)
            })
        }
        card.append(iconFor(app))

        const title = document.createElement("span")
        title.textContent = app.title
        card.append(title)
        return card
    }

    function folderCard(folder) {
        const card = document.createElement("button")
        card.className = "od-app-card od-folder-card"
        card.type = "button"
        card.title = folder.title
        const img = document.createElement("img")
        img.src = folder.icon || "/maps/overland/overland-settings.svg"
        img.alt = ""
        img.addEventListener("error", () => {
            img.src = "/maps/overland/overland-folder-settings.svg"
        }, {once: true})
        const title = document.createElement("span")
        title.textContent = folder.title
        card.append(img, title)
        card.addEventListener("click", () => openFolder(folder))
        return card
    }

    function renderApps(folder=null) {
        const appsGrid = document.getElementById("odAppsGrid")
        const nav = document.getElementById("odAppsNav")
        appsGrid.replaceChildren()
        nav.replaceChildren()
        if (folder) {
            const back = document.createElement("button")
            back.className = "od-apps-back"
            back.type = "button"
            back.textContent = "‹ All Apps"
            back.addEventListener("click", () => renderApps())
            const title = document.createElement("strong")
            title.textContent = folder.title
            nav.append(back, title)
            appsForFolder(folder).forEach(app => appsGrid.append(appCard(app)))
        } else {
            const folders = state.appLayout?.folders || []
            folders.forEach(folder => {
                if (appsForFolder(folder).length) appsGrid.append(folderCard(folder))
            })
            looseApps().forEach(app => appsGrid.append(appCard(app)))
        }
    }

    function openFolder(folder) {
        if (!folder.protected) {
            renderApps(folder)
            return
        }
        requestFolderPassword(folder, () => renderApps(folder))
    }

    function requestFolderPassword(folder, onSuccess) {
        const dialog = document.getElementById("odFolderPasswordDialog")
        const input = document.getElementById("odFolderPasswordInput")
        const error = document.getElementById("odFolderPasswordError")
        document.getElementById("odFolderPasswordTitle").textContent = folder.title
        input.value = ""
        error.textContent = ""
        const submit = document.getElementById("odFolderPasswordSubmit")
        submit.onclick = () => {
            if (input.value === String(state.appLayout?.settingsPassword || "")) {
                dialog.close()
                onSuccess()
                return
            }
            error.textContent = "Incorrect password."
        }
        input.onkeydown = event => {
            if (event.key === "Enter") submit.click()
        }
        dialog.showModal()
        input.focus()
    }

    function openRequestedAppFromUrl() {
        const params = new URLSearchParams(window.location.search)
        if (params.get("openSettings") === "1") {
            params.delete("openSettings")
            const nextUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}${window.location.hash || ""}`
            window.history.replaceState(null, "", nextUrl)
            window.setTimeout(openSettingsDialog, 350)
            return
        }
        const requested = params.get("openApp") || params.get("app")
        if (!requested) return
        const app = appById(requested)
        if (!app || app.id === "maps") return
        params.delete("openApp")
        params.delete("app")
        const nextUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}${window.location.hash || ""}`
        window.history.replaceState(null, "", nextUrl)
        window.setTimeout(() => openApp(app), 350)
    }

    function renderDockSettings() {
        const dockSettings = document.getElementById("odDockSettings")
        dockSettings.replaceChildren()
        state.apps.forEach(app => {
            const label = document.createElement("label")
            label.className = "od-dock-choice"

            const checkbox = document.createElement("input")
            checkbox.type = "checkbox"
            checkbox.checked = state.dockIds.includes(app.id)
            checkbox.addEventListener("change", () => {
                if (checkbox.checked && !state.dockIds.includes(app.id)) {
                    state.dockIds.push(app.id)
                } else if (!checkbox.checked) {
                    state.dockIds = state.dockIds.filter(id => id !== app.id)
                }
                persistDock()
                renderDock()
            })

            label.append(checkbox, iconFor(app), document.createTextNode(app.title))
            dockSettings.append(label)
        })
    }

    function resetMapView() {
        localStorage.removeItem(mapStateKey)
        window.location.href = "/maps/"
    }

    function openPlacesAdmin() {
        document.getElementById("odSettingsDialog").close()
        if (typeof window.openTrailerPlacesManager === "function") {
            window.openTrailerPlacesManager()
        } else {
            window.alert("Places Manager is still loading. Try again in a moment.")
        }
    }

    function httpsFieldMap() {
        return {
            OVERLAND_DOMAIN: "odHttpsDomain",
            OVERLAND_PI_LAN_IP: "odHttpsPiIp",
            OVERLAND_CERT_DOMAINS: "odHttpsCertDomains",
            ACME_EMAIL: "odHttpsEmail",
            OVERLAND_MAPS_HOST: "odHttpsMapsHost",
            OVERLAND_MOBILE_HOST: "odHttpsMobileHost",
            OVERLAND_IIAB_HOST: "odHttpsIiabHost",
            OVERLAND_FILES_HOST: "odHttpsFilesHost",
            OVERLAND_JELLYFIN_HOST: "odHttpsJellyfinHost",
        }
    }

    function setHttpsOutput(message) {
        const output = document.getElementById("odHttpsOutput")
        if (output) output.textContent = typeof message === "string" ? message : JSON.stringify(message, null, 2)
    }

    function cleanHttpsDomain(value) {
        return String(value || "")
            .trim()
            .replace(/^https?:\/\//i, "")
            .split("/")[0]
            .replace(/\.+$/, "")
            .toLowerCase()
    }

    function defaultishHttpsValue(value) {
        const text = String(value || "").trim().toLowerCase()
        return !text || text.includes("example.com") || text === "mobile.overland.daemonadventures.net"
    }

    function siblingHttpsHost(domain, prefix) {
        const parts = String(domain || "").split(".")
        return parts.length > 2 ? `${prefix}.${parts.slice(1).join(".")}` : `${prefix}.${domain}`
    }

    function applyHttpsDomainDefaults() {
        const domainField = document.getElementById("odHttpsDomain")
        const domain = cleanHttpsDomain(domainField?.value)
        if (!domain) return
        if (domainField) domainField.value = domain

        const certField = document.getElementById("odHttpsCertDomains")
        const certValue = certField?.value || ""
        if (certField && defaultishHttpsValue(certValue)) {
            certField.value = `${domain},*.${domain},${siblingHttpsHost(domain, "mobile")}`
        } else if (certField) {
            const parts = certValue.split(",").map(part => part.trim().toLowerCase()).filter(Boolean)
            if (parts.includes(`*.${domain}`) && !parts.includes(domain)) {
                certField.value = [domain, ...parts].join(",")
            }
        }

        const hostDefaults = {
            odHttpsMapsHost: "maps",
            odHttpsMobileHost: "mobile",
            odHttpsIiabHost: "iiab",
            odHttpsFilesHost: "files",
            odHttpsJellyfinHost: "jellyfin",
        }
        Object.entries(hostDefaults).forEach(([id, prefix]) => {
            const field = document.getElementById(id)
            if (field && defaultishHttpsValue(field.value)) {
                field.value = id === "odHttpsMobileHost" ? siblingHttpsHost(domain, "mobile") : `${prefix}.${domain}`
            }
        })
    }

    async function httpsAdmin(action, payload={}) {
        setHttpsOutput(`${action}...`)
        const response = await fetch("/overland-https-admin", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action, ...payload}),
        })
        const data = await response.json()
        if (!data.ok) throw new Error(data.error || "HTTPS admin action failed.")
        return data
    }

    function renderHttpsStatus(data) {
        const config = data.config || {}
        Object.entries(httpsFieldMap()).forEach(([key, id]) => {
            const field = document.getElementById(id)
            if (field) field.value = config[key] || ""
        })
        applyHttpsDomainDefaults()
        const certificate = data.certificate || {}
        const lines = [
            `Token configured: ${data.tokenConfigured ? "yes" : "no"}`,
            `Trusted HTTPS enabled: ${data.trustedSiteEnabled ? "yes" : "not yet"}`,
        ]
        if (certificate.ok) {
            lines.push("", "Certificate:", certificate.stdout || "")
        } else {
            lines.push("", "Certificate not issued yet.", certificate.stderr || certificate.stdout || "")
        }
        setHttpsOutput(lines.join("\n").trim())
    }

    async function loadHttpsStatus() {
        try {
            renderHttpsStatus(await httpsAdmin("status"))
        } catch (error) {
            setHttpsOutput(error.message)
        }
    }

    async function saveHttpsConfig() {
        applyHttpsDomainDefaults()
        const config = {}
        Object.entries(httpsFieldMap()).forEach(([key, id]) => {
            config[key] = document.getElementById(id)?.value || ""
        })
        try {
            renderHttpsStatus(await httpsAdmin("save-config", {config}))
        } catch (error) {
            setHttpsOutput(error.message)
        }
    }

    async function saveHttpsToken() {
        const tokenField = document.getElementById("odHttpsToken")
        try {
            renderHttpsStatus(await httpsAdmin("save-token", {token: tokenField?.value || ""}))
            if (tokenField) tokenField.value = ""
        } catch (error) {
            setHttpsOutput(error.message)
        }
    }

    async function renewHttpsCert() {
        try {
            const data = await httpsAdmin("renew")
            if (data.renew) setHttpsOutput((data.renew.stdout || "") + "\n" + (data.renew.stderr || ""))
            else renderHttpsStatus(data)
        } catch (error) {
            setHttpsOutput(error.message)
        }
    }

    async function showHttpsDns() {
        try {
            const data = await httpsAdmin("dns")
            setHttpsOutput(data.dns?.stdout || data.dns?.stderr || "No DNS output.")
        } catch (error) {
            setHttpsOutput(error.message)
        }
    }

    async function runHttpsPretrip() {
        try {
            const data = await httpsAdmin("pretrip")
            setHttpsOutput(data.pretrip?.stdout || data.pretrip?.stderr || "No pre-trip output.")
        } catch (error) {
            setHttpsOutput(error.message)
        }
    }

    async function overlandAdmin(action, payload={}) {
        const response = await fetch("/overland-admin", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action, ...payload}),
        })
        const data = await response.json()
        if (!data.ok) throw new Error(data.error || "Overland admin action failed.")
        return data
    }

    async function appLayoutApi(action, payload={}) {
        const response = await fetch("/app-layout", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action, ...payload}),
        })
        const data = await response.json()
        if (!data.ok) throw new Error(data.error || "App layout action failed.")
        return data.layout || defaultAppLayout
    }

    async function fetchAppLayout() {
        try {
            const response = await fetch("/app-layout", {cache: "no-cache"})
            if (!response.ok) throw new Error(`app-layout: ${response.status}`)
            const data = await response.json()
            return normalizeAppLayout(data.layout)
        } catch (error) {
            console.warn("Using default app layout", error)
            return normalizeAppLayout(defaultAppLayout)
        }
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;",
        }[char]))
    }

    function serviceIsActive(service) {
        const state = String(service?.active || service?.status || "")
        return state === "active" || state === "running"
    }

    function serviceIcon(id) {
        const iconMap = {
            minecraft: "/js-menu/menu-files/images/DnD-Emblem.png",
            terraria: "/maps/overland/overland-emulator.svg",
            mindustry: "/js-menu/menu-files/images/trailer-mindustry-admin.svg",
            jellyfin: "/maps/overland/jellyfin.png",
            filebrowser: "/js-menu/menu-files/images/en-file_share.png",
            komga: "/js-menu/menu-files/images/bookshelf.png",
            kiwix: "/js-menu/menu-files/images/220px-Wikipedia-logo-v2.svg.png",
            kolibri: "/js-menu/menu-files/images/kolibri.png",
        }
        const src = iconMap[id] || "/js-menu/menu-files/images/main-logo.png"
        return `<img src="${escapeHtml(src)}" alt="" loading="lazy">`
    }

    function serviceBadge(active) {
        const text = String(active || "unknown")
        const good = text === "active" || text === "running"
        return `<span class="od-state-badge ${good ? "od-state-badge--on" : "od-state-badge--off"}" title="${escapeHtml(text)}"></span>`
    }

    function renderServices(data) {
        const target = document.getElementById("odServicesStatus")
        const services = data.services || []
        if (!services.length) {
            target.textContent = "No services reported."
            return
        }
        target.innerHTML = services.map(service => {
            const active = serviceIsActive(service)
            return `
            <article class="od-service-row ${active ? "od-service-row--active" : "od-service-row--inactive"}">
                <div class="od-service-main">
                    <div class="od-service-icon ${active ? "od-service-icon--active" : "od-service-icon--inactive"}">${serviceIcon(service.id)}</div>
                    <strong>${escapeHtml(service.label)}</strong>
                </div>
                <div class="od-service-state">${serviceBadge(service.active)}${service.health ? `<small>${escapeHtml(service.health)}</small>` : ""}</div>
                <div class="od-service-actions">
                    <button type="button" data-service="${escapeHtml(service.id)}" data-action="start" ${active ? "disabled" : ""}>Start</button>
                    <button type="button" data-service="${escapeHtml(service.id)}" data-action="stop" ${active ? "" : "disabled"}>Stop</button>
                    <button type="button" data-service="${escapeHtml(service.id)}" data-action="restart" ${active ? "" : "disabled"}>Restart</button>
                </div>
            </article>
        `}).join("")
        target.querySelectorAll("[data-service][data-action]").forEach(button => {
            button.addEventListener("click", async () => {
                button.disabled = true
                target.insertAdjacentHTML("afterbegin", `<div class="od-admin-message">Running ${button.dataset.action} on ${button.dataset.service}...</div>`)
                try {
                    renderServices(await overlandAdmin("service", {
                        service: button.dataset.service,
                        serviceAction: button.dataset.action,
                    }))
                } catch (error) {
                    target.insertAdjacentHTML("afterbegin", `<div class="od-admin-message od-admin-message--error">${error.message}</div>`)
                    button.disabled = false
                }
            })
        })
    }

    async function loadServices() {
        const target = document.getElementById("odServicesStatus")
        target.textContent = "Loading services..."
        try {
            renderServices(await overlandAdmin("status"))
        } catch (error) {
            target.textContent = error.message
        }
    }

    function renderContent(data) {
        const target = document.getElementById("odContentStatus")
        const content = data.content || {}
        const zims = content.zims || []
        target.innerHTML = `
            <div class="od-content-summary">
                <div><strong>${content.zimCount || 0}</strong><span>ZIM files</span></div>
                <div><strong>${content.zimBytesHuman || "0 B"}</strong><span>ZIM storage</span></div>
                <div><strong>${content.storage?.usedPct ?? "?"}%</strong><span>${content.storage?.usedHuman || ""} used</span></div>
                <div><strong>${content.libraryXmlExists ? "Ready" : "Missing"}</strong><span>Kiwix library.xml</span></div>
            </div>
            <div class="od-content-list">
                ${zims.map(item => `<div><strong>${item.stem}</strong><span>${item.sizeHuman}</span></div>`).join("") || "<p>No ZIM files found.</p>"}
            </div>
        `
    }

    async function loadContent() {
        const target = document.getElementById("odContentStatus")
        target.textContent = "Loading content..."
        try {
            renderContent(await overlandAdmin("content-status"))
        } catch (error) {
            target.textContent = error.message
        }
    }

    async function refreshKiwix() {
        const target = document.getElementById("odContentStatus")
        target.textContent = "Rebuilding Kiwix library..."
        try {
            renderContent(await overlandAdmin("refresh-kiwix"))
        } catch (error) {
            target.textContent = error.message
        }
    }

    async function runSystemAction(systemAction) {
        const label = systemAction === "reboot" ? "reboot" : "shutdown"
        if (!window.confirm(`Confirm ${label} of the IIAB Overland Raspberry Pi?`)) return
        const target = document.getElementById("odServicesStatus")
        target.insertAdjacentHTML("afterbegin", `<div class="od-admin-message">Sending ${label} command...</div>`)
        try {
            await overlandAdmin("system", {systemAction})
            target.insertAdjacentHTML("afterbegin", `<div class="od-admin-message">${label} command sent. This interface may disconnect.</div>`)
        } catch (error) {
            target.insertAdjacentHTML("afterbegin", `<div class="od-admin-message od-admin-message--error">${error.message}</div>`)
        }
    }

    function setLauncherMessage(message, error=false) {
        const target = document.getElementById("odLauncherMessage")
        target.hidden = false
        target.textContent = message
        target.classList.toggle("od-admin-message--error", error)
    }

    function folderSelect(currentId) {
        const select = document.createElement("select")
        select.append(new Option("Loose / top level", ""))
        ;(state.appLayout?.folders || []).forEach(folder => {
            select.append(new Option(folder.title, folder.id))
        })
        select.value = currentId || ""
        return select
    }

    function appFolderId(appId) {
        const folder = (state.appLayout?.folders || []).find(item => (item.appIds || []).includes(appId))
        return folder?.id || ""
    }

    function renderLauncherSettings() {
        const layout = normalizeAppLayout(state.appLayout)
        state.appLayout = layout
        document.getElementById("odLauncherPassword").value = layout.settingsPassword || ""
        const foldersTarget = document.getElementById("odLauncherFolders")
        foldersTarget.replaceChildren()
        layout.folders.forEach((folder, index) => {
            const row = document.createElement("article")
            row.className = "od-launcher-folder-row"
            row.innerHTML = `
                <label>Folder Name <input data-field="title" value="${escapeHtml(folder.title)}"></label>
                <label>Icon URL <input data-field="icon" value="${escapeHtml(folder.icon || "")}"></label>
                <label class="od-launcher-check"><input data-field="protected" type="checkbox" ${folder.protected ? "checked" : ""}> Password gate</label>
                <button class="od-soft-button od-soft-button--danger" type="button">Delete</button>
            `
            row.querySelector('[data-field="title"]').addEventListener("input", event => {
                folder.title = event.target.value
            })
            row.querySelector('[data-field="icon"]').addEventListener("input", event => {
                folder.icon = event.target.value
            })
            row.querySelector('[data-field="protected"]').addEventListener("change", event => {
                folder.protected = event.target.checked
            })
            row.querySelector("button").addEventListener("click", () => {
                layout.folders.splice(index, 1)
                state.appLayout = layout
                renderLauncherSettings()
            })
            foldersTarget.append(row)
        })

        const appsTarget = document.getElementById("odLauncherApps")
        appsTarget.replaceChildren()
        state.apps.forEach(app => {
            const row = document.createElement("article")
            row.className = "od-launcher-app-row"
            const hidden = document.createElement("input")
            hidden.type = "checkbox"
            hidden.checked = layout.hiddenAppIds.includes(app.id)
            hidden.addEventListener("change", () => {
                if (hidden.checked && !layout.hiddenAppIds.includes(app.id)) {
                    layout.hiddenAppIds.push(app.id)
                } else if (!hidden.checked) {
                    layout.hiddenAppIds = layout.hiddenAppIds.filter(id => id !== app.id)
                }
            })
            const select = folderSelect(appFolderId(app.id))
            select.addEventListener("change", () => {
                layout.folders.forEach(folder => {
                    folder.appIds = (folder.appIds || []).filter(id => id !== app.id)
                })
                const folder = layout.folders.find(item => item.id === select.value)
                if (folder && !folder.appIds.includes(app.id)) folder.appIds.push(app.id)
            })
            const main = document.createElement("div")
            main.className = "od-launcher-app-main"
            main.append(iconFor(app), document.createElement("strong"))
            main.querySelector("strong").textContent = app.title || app.id
            row.append(main, select)
            const hideLabel = document.createElement("label")
            hideLabel.className = "od-launcher-check"
            hideLabel.append(hidden, document.createTextNode("Hide"))
            row.append(hideLabel)
            appsTarget.append(row)
        })
    }

    async function saveLauncherLayout() {
        const layout = normalizeAppLayout(state.appLayout)
        layout.settingsPassword = document.getElementById("odLauncherPassword").value
        try {
            state.appLayout = normalizeAppLayout(await appLayoutApi("save", {layout}))
            renderApps()
            renderLauncherSettings()
            setLauncherMessage("App launcher layout saved.")
        } catch (error) {
            setLauncherMessage(error.message, true)
        }
    }

    async function resetLauncherLayout() {
        try {
            state.appLayout = normalizeAppLayout(await appLayoutApi("reset"))
            renderApps()
            renderLauncherSettings()
            setLauncherMessage("App launcher layout reset.")
        } catch (error) {
            setLauncherMessage(error.message, true)
        }
    }

    function addLauncherFolder() {
        const layout = normalizeAppLayout(state.appLayout)
        const folder = {
            id: `folder-${Date.now().toString(36)}`,
            title: "New Folder",
            icon: "/maps/overland/overland-settings.svg",
            protected: false,
            appIds: [],
        }
        layout.folders.push(folder)
        state.appLayout = layout
        renderLauncherSettings()
    }

    function wireDock() {
        document.getElementById("odAppsButton").addEventListener("click", () => {
            renderApps()
            document.getElementById("odAppsDialog").showModal()
        })

        document.getElementById("odSettingsButton").addEventListener("click", () => {
            openSettingsDialog()
        })

        document.getElementById("odResetDock").addEventListener("click", () => {
            state.dockIds = defaultDockIds()
            persistDock()
            renderDock()
            renderDockSettings()
        })
        document.getElementById("odResetMapView").addEventListener("click", resetMapView)
        document.getElementById("odOpenHttpsPanel").addEventListener("click", () => {
            document.getElementById("odHttpsPanel").hidden = false
            loadHttpsStatus()
        })
        document.getElementById("odHttpsBack").addEventListener("click", () => {
            document.getElementById("odHttpsPanel").hidden = true
        })
        document.getElementById("odOpenDockPanel").addEventListener("click", () => {
            renderDockSettings()
            document.getElementById("odDockPanel").hidden = false
        })
        document.getElementById("odDockBack").addEventListener("click", () => {
            document.getElementById("odDockPanel").hidden = true
        })
        document.getElementById("odOpenLauncherPanel").addEventListener("click", () => {
            renderLauncherSettings()
            document.getElementById("odLauncherPanel").hidden = false
        })
        document.getElementById("odLauncherBack").addEventListener("click", () => {
            document.getElementById("odLauncherPanel").hidden = true
        })
        document.getElementById("odAddLauncherFolder").addEventListener("click", addLauncherFolder)
        document.getElementById("odSaveLauncherLayout").addEventListener("click", saveLauncherLayout)
        document.getElementById("odResetLauncherLayout").addEventListener("click", resetLauncherLayout)
        document.getElementById("odOpenMapsPanel").addEventListener("click", () => {
            document.getElementById("odMapsPanel").hidden = false
        })
        document.getElementById("odMapsBack").addEventListener("click", () => {
            document.getElementById("odMapsPanel").hidden = true
        })
        document.getElementById("odOpenServicesPanel").addEventListener("click", () => {
            document.getElementById("odServicesPanel").hidden = false
            loadServices()
        })
        document.getElementById("odServicesBack").addEventListener("click", () => {
            document.getElementById("odServicesPanel").hidden = true
        })
        document.getElementById("odRefreshServices").addEventListener("click", loadServices)
        document.getElementById("odSystemReboot").addEventListener("click", () => runSystemAction("reboot"))
        document.getElementById("odSystemShutdown").addEventListener("click", () => runSystemAction("shutdown"))
        document.getElementById("odOpenContentPanel").addEventListener("click", () => {
            document.getElementById("odContentPanel").hidden = false
            loadContent()
        })
        document.getElementById("odContentBack").addEventListener("click", () => {
            document.getElementById("odContentPanel").hidden = true
        })
        document.getElementById("odRefreshContent").addEventListener("click", loadContent)
        document.getElementById("odRefreshKiwix").addEventListener("click", refreshKiwix)
        document.getElementById("odHttpsSaveConfig").addEventListener("click", saveHttpsConfig)
        document.getElementById("odHttpsSaveToken").addEventListener("click", saveHttpsToken)
        document.getElementById("odHttpsIssueCert").addEventListener("click", renewHttpsCert)
        document.getElementById("odHttpsPretrip").addEventListener("click", runHttpsPretrip)
        document.getElementById("odHttpsDns").addEventListener("click", showHttpsDns)
        document.getElementById("odHttpsDomain").addEventListener("change", applyHttpsDomainDefaults)

        document.getElementById("odMinimizeDock").addEventListener("click", () => {
            document.getElementById("odDock").hidden = true
            document.getElementById("odRestoreDock").hidden = false
        })

        document.getElementById("odRestoreDock").addEventListener("click", () => {
            document.getElementById("odDock").hidden = false
            document.getElementById("odRestoreDock").hidden = true
        })

        window.addEventListener("overland-music-state", renderDock)
        window.addEventListener("message", event => {
            if (event.data && event.data.type === "overland-close-overlay") {
                closeWebOverlay()
            }
        })
    }

    async function fetchConfig() {
        let lastError = null
        for (const url of configUrls) {
            try {
                const response = await fetch(url, {cache: "no-cache"})
                if (response.ok) return response.json()
                lastError = new Error(`${url}: ${response.status}`)
            } catch (error) {
                lastError = error
            }
        }
        throw lastError || new Error("No Overland app config URL succeeded")
    }

    async function main() {
        const adminMode = standaloneAdminMode()
        if (dockDisabledFromUrl() && !adminMode) return
        if (adminMode) document.body.classList.add("od-admin-standalone")
        createShell()
        wireDock()
        try {
            state.config = await fetchConfig()
            state.apps = Array.isArray(state.config.apps) ? state.config.apps : []
            state.appLayout = await fetchAppLayout()
            state.dockIds = savedDockIds()
            if (!state.dockIds.length) {
                state.dockIds = defaultDockIds()
            }
            if (!localStorage.getItem(musicDockMigrationKey) && appById("music") && !state.dockIds.includes("music")) {
                state.dockIds.splice(Math.min(1, state.dockIds.length), 0, "music")
                persistDock()
                localStorage.setItem(musicDockMigrationKey, "1")
            }
            renderDock()
            renderApps()
            if (adminMode) {
                document.getElementById("odDock").hidden = true
                document.getElementById("odRestoreDock").hidden = true
                const settingsDialog = document.getElementById("odSettingsDialog")
                settingsDialog.addEventListener("close", () => {
                    if (document.body.dataset.standaloneApp === "admin") window.location.href = "/mobile/"
                }, {once: true})
                openSettingsDialog()
                return
            }
            openRequestedAppFromUrl()
        } catch (error) {
            console.error("Overland dock failed to load", error)
            document.getElementById("odDockApps").textContent = "Apps unavailable"
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", main)
    } else {
        main()
    }
})()
