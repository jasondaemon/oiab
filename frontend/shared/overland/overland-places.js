/* IIAB Overland Places overlay. Extracted from the generated IIAB Maps page. */
/* global mb, maplibregl */

            // Load locally managed Trailer Places from Maps Admin.
            // This is intentionally separate from IIAB's downloaded map packs.
            let showTrailerPlacesTimeout = null
            const trailerOverlandMapStateKey = "iiab-overland-map-hash-v1"

            try {
                const storedMapHash = localStorage.getItem(trailerOverlandMapStateKey)
                if (!window.location.hash && storedMapHash && storedMapHash.startsWith("#")) {
                    history.replaceState({}, "", storedMapHash)
                }
            } catch (_error) {
                // Ignore storage failures. The map will use its normal default state.
            }

            function trailerPersistOverlandMapHash() {
                if (window.location.hash && window.location.hash.length > 1) {
                    try {
                        localStorage.setItem(trailerOverlandMapStateKey, window.location.hash)
                    } catch (_error) {
                        // Ignore storage failures. The map remains usable without persistence.
                    }
                }
            }

            window.addEventListener("hashchange", trailerPersistOverlandMapHash)
            window.addEventListener("pagehide", trailerPersistOverlandMapHash)
            window.setInterval(trailerPersistOverlandMapHash, 1000)

            function trailerPlaceHtmlEscape(value) {
                const div = document.createElement("div")
                div.textContent = value || ""
                return div.innerHTML
            }

            function trailerPlaceAttrEscape(value) {
                return trailerPlaceHtmlEscape(value).replace(/"/g, "&quot;")
            }

            function trailerPlaceColor(value) {
                return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#ffcc33"
            }

            function trailerPlaceMarker(value) {
                return String(value || "").replace(/[\x00-\x1f]/g, "").trim().slice(0, 3)
            }

            const trailerPlaceIconDefs = {
                pin: {label: "Waypoint", path: "M12 2a6 6 0 0 0-6 6c0 4.5 6 12 6 12s6-7.5 6-12a6 6 0 0 0-6-6zm0 8.2A2.2 2.2 0 1 1 12 5.8a2.2 2.2 0 0 1 0 4.4z"},
                camp: {label: "Camp", path: "M4 19h16L12 5 4 19zm8-9.5 3.8 6.5H8.2L12 9.5zM3 21h18v-2H3v2z"},
                lookout: {label: "Lookout / View", path: "M12 6c4.5 0 8.2 3.1 10 6-1.8 2.9-5.5 6-10 6s-8.2-3.1-10-6c1.8-2.9 5.5-6 10-6zm0 2.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5z"},
                museum: {label: "Museum", path: "M3 9l9-5 9 5v2H3V9zm2 4h2v6h2v-6h2v6h2v-6h2v6h2v-6h2v8H5v-8z"},
                trailhead: {label: "Trailhead", path: "M6 4h9l3 3-3 3H8v11H6V4zm6 9a3 3 0 1 1-2.1 5.1L7 21l-1.4-1.4 2.9-2.9A3 3 0 0 1 12 13z"},
                water: {label: "Water", path: "M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11zm-3 11a3 3 0 0 0 6 0h-2a1 1 0 0 1-2 0H9z"},
                fuel: {label: "Fuel", path: "M6 3h8a2 2 0 0 1 2 2v16H4V5a2 2 0 0 1 2-2zm1 3v5h6V6H7zm10 .5 3 3V18a2 2 0 0 1-2 2h-1v-2h1V11l-2-2 1-2.5z"},
                food: {label: "Food", path: "M7 3h2v7h1V3h2v7h1V3h2v6a5 5 0 0 1-3 4.6V21h-2v-7.4A5 5 0 0 1 7 9V3zm10 0h2v18h-2v-7h-2V8a5 5 0 0 1 2-5z"},
                parking: {label: "Parking", path: "M6 3h7a5 5 0 0 1 0 10H9v8H6V3zm3 3v4h4a2 2 0 0 0 0-4H9z"},
                home: {label: "Home", path: "M3 11 12 4l9 7-1.3 1.6L18 11.3V20h-5v-5h-2v5H6v-8.7l-1.7 1.3L3 11z"},
                medical: {label: "Medical", path: "M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z"},
                library: {label: "Library", path: "M4 5h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4v14h-4a4 4 0 0 0-4 2 4 4 0 0 0-4-2H4V5zm2 3v8h2a6 6 0 0 1 3 1V9a2 2 0 0 0-2-2H6z"},
                store: {label: "Store", path: "M4 4h16l1 6a4 4 0 0 1-2 3.5V20H5v-6.5A4 4 0 0 1 3 10l1-6zm3 10v4h10v-4H7z"},
                star: {label: "Favorite", path: "M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3z"},
            }
            const trailerPlaceCategoryDefs = [
                {value: "waypoint", label: "Waypoint", icon: "pin"},
                {value: "camp", label: "Camp", icon: "camp"},
                {value: "lookout", label: "Lookout / View", icon: "lookout"},
                {value: "museum", label: "Museum", icon: "museum"},
                {value: "trailhead", label: "Trailhead", icon: "trailhead"},
                {value: "water", label: "Water", icon: "water"},
                {value: "fuel", label: "Fuel", icon: "fuel"},
                {value: "food", label: "Food", icon: "food"},
                {value: "parking", label: "Parking", icon: "parking"},
                {value: "home", label: "Home", icon: "home"},
                {value: "medical", label: "Medical", icon: "medical"},
                {value: "library", label: "Library", icon: "library"},
                {value: "store", label: "Store", icon: "store"},
                {value: "favorite", label: "Favorite", icon: "star"},
            ]

            function trailerPlaceIconKey(feature) {
                const props = feature.properties || {}
                const explicit = String(props.icon || "").toLowerCase()
                if (trailerPlaceIconDefs[explicit]) {
                    return explicit
                }
                const haystack = [
                    props.category || "",
                    props.name || "",
                    props.notes || "",
                    props.folder || "",
                ].join(" ").toLowerCase()
                if (/camp|rv|tent/.test(haystack)) return "camp"
                if (/lookout|view|overlook|vista|point|peak/.test(haystack)) return "lookout"
                if (/museum|historic|monument|visitor center/.test(haystack)) return "museum"
                if (/trail|trailhead|hike/.test(haystack)) return "trailhead"
                if (/water|spring|river|lake/.test(haystack)) return "water"
                if (/fuel|gas|diesel/.test(haystack)) return "fuel"
                if (/food|restaurant|cafe|diner/.test(haystack)) return "food"
                if (/parking|park\b/.test(haystack)) return "parking"
                if (/home/.test(haystack)) return "home"
                if (/medical|hospital|clinic|first aid/.test(haystack)) return "medical"
                if (/library|book/.test(haystack)) return "library"
                if (/store|shop|market/.test(haystack)) return "store"
                if (/favorite|star/.test(haystack)) return "star"
                return "pin"
            }

            function trailerPlaceIconOptions(selected) {
                return Object.entries(trailerPlaceIconDefs).map(([key, def]) => {
                    const selectedAttr = key === selected ? " selected" : ""
                    return `<option value="${key}"${selectedAttr}>${trailerPlaceHtmlEscape(def.label)}</option>`
                }).join("")
            }

            function trailerPlaceCategoryOptions(selected) {
                const known = new Set(trailerPlaceCategoryDefs.map(item => item.value))
                const custom = selected && !known.has(selected) ? [{value: selected, label: selected, icon: trailerPlaceCategoryIcon(selected)}] : []
                return [...custom, ...trailerPlaceCategoryDefs].map(item => {
                    const selectedAttr = item.value === selected ? " selected" : ""
                    return `<option value="${trailerPlaceAttrEscape(item.value)}" data-icon="${trailerPlaceAttrEscape(item.icon)}"${selectedAttr}>${trailerPlaceHtmlEscape(item.label)}</option>`
                }).join("")
            }

            function trailerPlaceCategoryIcon(category) {
                const found = trailerPlaceCategoryDefs.find(item => item.value === category)
                if (found) return found.icon
                return trailerPlaceIconDefs[category] ? category : "pin"
            }

            function trailerPlaceBlackIconSvg(iconKey) {
                const icon = trailerPlaceIconDefs[iconKey] || trailerPlaceIconDefs.pin
                return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="${icon.path}"/></svg>`
            }

            function updateTrailerPlaceEditorIconPreview() {
                const editor = ensureTrailerPlaceEditor()
                const preview = editor.querySelector("[data-category-icon-preview]")
                const iconKey = editor.querySelector("[name='icon']").value || "pin"
                preview.innerHTML = trailerPlaceBlackIconSvg(iconKey)
            }

            function trailerPlaceIconSvg(path) {
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ffffff" d="${path}"/></svg>`
            }

            function fetchTrailerPlacesSnapshotJson() {
                return fetch("/maps-data", {cache: "no-store"})
                    .then(response => response.ok ? response.json() : null)
                    .then(snapshot => {
                        if (snapshot && snapshot.places && snapshot.places.features) {
                            trailerPlacesAdminSnapshot = snapshot
                            return snapshot.places
                        }
                        return fetch("trailer-places.geojson", {cache: "no-store"})
                            .then(response => response.ok ? response.json() : null)
                    })
            }

            function trailerPlaceFolders() {
                const folders = new Set((trailerPlacesAdminSnapshot && trailerPlacesAdminSnapshot.folders) || [])
                if (trailerPlacesGeojson && trailerPlacesGeojson.features) {
                    trailerPlacesGeojson.features.forEach(feature => folders.add(String(trailerPlaceFolder(feature) || "Unfiled")))
                }
                return [...folders].filter(Boolean).sort((a, b) => a.localeCompare(b))
            }

            function trailerPlaceRecentFolders() {
                try {
                    return JSON.parse(localStorage.getItem("trailerPlaceRecentFolders") || "[]")
                } catch (error) {
                    return []
                }
            }

            function refreshTrailerPlaceFolderData() {
                return fetchTrailerPlacesSnapshotJson()
                    .then(geojson => {
                        if (geojson && geojson.features) {
                            trailerPlacesGeojson = geojson
                            return true
                        }
                        return false
                    })
                    .catch(() => false)
            }

            function saveTrailerPlaceRecentFolder(folder) {
                const normalized = String(folder || "").trim().replace(/^\/+|\/+$/g, "")
                if (!normalized) {
                    return
                }
                const merged = [normalized, ...trailerPlaceRecentFolders().filter(item => item !== normalized)].slice(0, 5)
                localStorage.setItem("trailerPlaceRecentFolders", JSON.stringify(merged))
            }

            function renderTrailerFolderChoices(formId) {
                const form = document.getElementById(formId)
                if (!form) {
                    return
                }
                try {
                    const query = form.querySelector("[data-folder-search]").value.trim().toLowerCase()
                    const recentBox = form.querySelector("[data-recent-folders]")
                    const allBox = form.querySelector("[data-all-folders]")
                    recentBox.style.color = "#172016"
                    allBox.style.color = "#172016"
                    const renderButton = (folder, recent=false) => {
                        const button = document.createElement("button")
                        button.type = "button"
                        button.textContent = folder
                        button.className = "op-folder-choice" + (recent ? " op-folder-choice--recent" : "")
                        button.addEventListener("click", () => setTrailerPlaceFolder(form, folder))
                        return button
                    }
                    recentBox.innerHTML = ""
                    trailerPlaceRecentFolders()
                        .map(folder => String(folder || ""))
                        .filter(folder => folder && (!query || folder.toLowerCase().includes(query)))
                        .slice(0, 5)
                        .forEach(folder => recentBox.appendChild(renderButton(folder, true)))
                    if (!recentBox.children.length) {
                        recentBox.textContent = "No recent folders."
                    }
                    allBox.innerHTML = ""
                    trailerPlaceFolders()
                        .filter(folder => !query || folder.toLowerCase().includes(query))
                        .forEach(folder => allBox.appendChild(renderButton(folder)))
                    if (!allBox.children.length) {
                        allBox.textContent = query ? "No matches. Press Enter to use the typed folder." : "No folders found."
                    }
                } catch (error) {
                    const allBox = form.querySelector("[data-all-folders]")
                    if (allBox) {
                        allBox.textContent = "Folder list failed: " + error.message
                    }
                }
            }

            function registerTrailerPlaceIcons() {
                const promises = Object.entries(trailerPlaceIconDefs).map(([key, def]) => new Promise(resolve => {
                    const imageId = "trailer-place-icon-" + key
                    if (mb.map.hasImage(imageId)) {
                        resolve()
                        return
                    }
                    const image = new Image(24, 24)
                    image.onload = () => {
                        if (!mb.map.hasImage(imageId)) {
                            mb.map.addImage(imageId, image, {pixelRatio: 1})
                        }
                        resolve()
                    }
                    image.onerror = resolve
                    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(trailerPlaceIconSvg(def.path))
                }))
                return Promise.all(promises)
            }

            function installTrailerMissingImageFallback() {
                if (!mb || !mb.map || mb.map._trailerMissingImageFallbackInstalled) {
                    return
                }
                mb.map._trailerMissingImageFallbackInstalled = true
                mb.map.on("styleimagemissing", event => {
                    const imageId = event && event.id
                    if (!imageId || mb.map.hasImage(imageId)) {
                        return
                    }
                    const size = 2
                    const data = new Uint8Array(size * size * 4)
                    for (let index = 0; index < data.length; index += 4) {
                        data[index] = 255
                        data[index + 1] = 255
                        data[index + 2] = 255
                        data[index + 3] = 0
                    }
                    mb.map.addImage(imageId, {width: size, height: size, data: data}, {pixelRatio: 1})
                })
            }

            function trailerPlaceFeatureId(feature) {
                const props = feature.properties || {}
                return String(feature.id || props._trailer_id || props.id || "")
            }

            let trailerPlaceEditor = null
            let trailerPlaceEditorFeature = null
            function ensureTrailerPlaceEditor() {
                if (trailerPlaceEditor) {
                    return trailerPlaceEditor
                }
                trailerPlaceEditor = document.createElement("div")
                trailerPlaceEditor.id = "trailer-place-editor"
                trailerPlaceEditor.className = "op-editor op-panel"
                trailerPlaceEditor.innerHTML = `
                    <div class="op-editor-header" style="align-items:center;margin-bottom:8px">
                        <strong class="op-editor-title">Edit Waypoint</strong>
                        <button type="button" data-editor-close class="op-close-button op-editor-close">&times;</button>
                    </div>
                    <input type="hidden" name="_feature_id">
                    <input type="hidden" name="lat">
                    <input type="hidden" name="lon">
                    <label class="op-field">Name<br><input name="name" class="op-input"></label>
                    <label class="op-field">Category</label>
                    <div class="op-editor-grid">
                        <div data-category-icon-preview class="op-editor-icon-preview"></div>
                        <select name="category" class="op-select"></select>
                    </div>
                    <label class="op-field">Description<br><textarea name="notes" rows="3" class="op-textarea"></textarea></label>
                    <div class="op-editor-color-row">
                        <label class="op-field" style="margin-top:0">Color<br><input type="color" name="color" style="width:64px;height:34px"></label>
                        <input type="hidden" name="icon">
                    </div>
                    <input type="hidden" name="folder">
                    <div class="op-editor-folder-box">
                        <div><strong>Folder:</strong> <span data-folder-current></span></div>
                        <button type="button" data-editor-change-folder class="op-button op-button--muted" style="margin-top:6px;padding:5px 9px">Change Folder</button>
                        <div data-editor-folder-picker class="op-editor-folder-picker">
                            <input data-editor-folder-search placeholder="Search folders or type a new folder" class="op-input">
                            <div style="margin-top:6px;font-weight:700">Recent</div>
                            <div data-editor-recent-folders class="op-scroll-list-sm"></div>
                            <div style="margin-top:6px;font-weight:700">All folders</div>
                            <div data-editor-all-folders class="op-scroll-list-md"></div>
                            <div class="op-text-small" style="margin-top:5px;color:#516051">Click an existing folder, or type a new folder and press Enter.</div>
                        </div>
                    </div>
                    <button type="button" data-editor-save class="op-button op-save-button">Save</button>
                    <div data-editor-status class="op-status"></div>`
                document.body.appendChild(trailerPlaceEditor)
                trailerPlaceEditor.querySelector("[data-editor-close]").addEventListener("click", () => {
                    trailerPlaceEditor.style.display = "none"
                })
                trailerPlaceEditor.querySelector("[data-editor-change-folder]").addEventListener("click", event => {
                    event.preventDefault()
                    event.stopPropagation()
                    const picker = trailerPlaceEditor.querySelector("[data-editor-folder-picker]")
                    picker.style.display = picker.style.display === "none" ? "block" : "none"
                    if (picker.style.display === "block") {
                        trailerPlaceEditor.querySelector("[data-editor-status]").textContent = "Loading folders..."
                        renderTrailerPlaceEditorFolders()
                        if (trailerPlaceFolders().length === 0) {
                            refreshTrailerPlaceFolderData().then(() => {
                                renderTrailerPlaceEditorFolders()
                                trailerPlaceEditor.querySelector("[data-editor-status]").textContent = "Choose a folder, or type a new one and press Enter."
                            })
                        } else {
                            trailerPlaceEditor.querySelector("[data-editor-status]").textContent = "Choose a folder, or type a new one and press Enter."
                        }
                        trailerPlaceEditor.querySelector("[data-editor-folder-search]").focus()
                    }
                })
                trailerPlaceEditor.querySelector("[data-editor-folder-search]").addEventListener("input", renderTrailerPlaceEditorFolders)
                trailerPlaceEditor.querySelector("[data-editor-folder-search]").addEventListener("keydown", event => {
                    if (event.key === "Enter") {
                        event.preventDefault()
                        setTrailerPlaceEditorFolder(event.currentTarget.value)
                        renderTrailerPlaceEditorFolders()
                    }
                })
                trailerPlaceEditor.querySelector("[data-editor-save]").addEventListener("click", event => {
                    event.preventDefault()
                    event.stopPropagation()
                    saveTrailerPlaceEditor()
                })
                trailerPlaceEditor.querySelector("[name='category']").addEventListener("change", event => {
                    const option = event.currentTarget.selectedOptions[0]
                    trailerPlaceEditor.querySelector("[name='icon']").value = option ? option.dataset.icon || trailerPlaceCategoryIcon(event.currentTarget.value) : "pin"
                    updateTrailerPlaceEditorIconPreview()
                })
                return trailerPlaceEditor
            }

            function setTrailerPlaceEditorFolder(folder) {
                const editor = ensureTrailerPlaceEditor()
                const normalized = String(folder || "").trim().replace(/^\/+|\/+$/g, "")
                if (!normalized) {
                    return
                }
                editor.querySelector("[name='folder']").value = normalized
                editor.querySelector("[data-folder-current]").textContent = normalized
                editor.querySelector("[data-editor-folder-picker]").style.display = "none"
                editor.querySelector("[data-editor-folder-search]").value = ""
                saveTrailerPlaceRecentFolder(normalized)
                editor.querySelector("[data-editor-status]").textContent = "Folder set to " + normalized + ". Click Save to apply."
            }

            function renderTrailerPlaceEditorFolders() {
                const editor = ensureTrailerPlaceEditor()
                const query = editor.querySelector("[data-editor-folder-search]").value.trim().toLowerCase()
                const recentBox = editor.querySelector("[data-editor-recent-folders]")
                const allBox = editor.querySelector("[data-editor-all-folders]")
                const knownFolders = trailerPlaceFolders()
                const makeButton = (folder, recent=false) => {
                    const button = document.createElement("button")
                    button.type = "button"
                    button.textContent = folder
                    button.className = "op-folder-choice" + (recent ? " op-folder-choice--recent" : "")
                    button.addEventListener("click", () => setTrailerPlaceEditorFolder(folder))
                    return button
                }
                recentBox.innerHTML = ""
                trailerPlaceRecentFolders()
                    .map(folder => String(folder || ""))
                    .filter(folder => knownFolders.includes(folder))
                    .filter(folder => folder && (!query || folder.toLowerCase().includes(query)))
                    .slice(0, 5)
                    .forEach(folder => recentBox.appendChild(makeButton(folder, true)))
                if (!recentBox.children.length) {
                    recentBox.textContent = "No recent folders."
                }
                allBox.innerHTML = ""
                const folders = knownFolders
                    .filter(folder => !query || folder.toLowerCase().includes(query))
                folders.forEach(folder => allBox.appendChild(makeButton(folder)))
                if (!allBox.children.length) {
                    allBox.textContent = query ? "No matches. Press Enter to use the typed folder." : "No folders found."
                }
            }

            function openTrailerPlaceEditor(feature) {
                const props = feature.properties || {}
                const featureId = trailerPlaceFeatureId(feature)
                if (!featureId) {
                    new maplibregl.Popup()
                        .setLngLat(feature.geometry.coordinates.slice())
                        .setHTML("<strong>Waypoint cannot be edited</strong><p>This point has no feature ID.</p>")
                        .addTo(mb.map)
                    return
                }
                const editor = ensureTrailerPlaceEditor()
                editor.dataset.mode = "edit"
                trailerPlaceEditorFeature = feature
                editor.querySelector("[name='_feature_id']").value = featureId
                editor.querySelector("[name='lat']").value = ""
                editor.querySelector("[name='lon']").value = ""
                editor.querySelector("[name='name']").value = props.name || "Trailer Place"
                editor.querySelector("[name='category']").innerHTML = trailerPlaceCategoryOptions(props.category || "waypoint")
                editor.querySelector("[name='notes']").value = props.notes || ""
                editor.querySelector("[name='color']").value = trailerPlaceColor(props.color)
                editor.querySelector("[name='icon']").value = props.icon || trailerPlaceCategoryIcon(props.category || "waypoint")
                updateTrailerPlaceEditorIconPreview()
                editor.querySelector("[name='folder']").value = props.folder || "Unfiled"
                editor.querySelector("[data-folder-current]").textContent = props.folder || "Unfiled"
                editor.querySelector("[data-editor-folder-picker]").style.display = "none"
                editor.querySelector("[data-editor-folder-search]").value = ""
                editor.querySelector("[data-editor-status]").textContent = ""
                editor.style.display = "block"
            }

            function openNewTrailerPlaceEditor(lngLat, options = {}) {
                const editor = ensureTrailerPlaceEditor()
                trailerPlaceEditorFeature = null
                editor.dataset.mode = "new"
                editor.querySelector("[name='_feature_id']").value = ""
                editor.querySelector("[name='lat']").value = lngLat.lat.toFixed(6)
                editor.querySelector("[name='lon']").value = lngLat.lng.toFixed(6)
                const category = options.category || "waypoint"
                editor.querySelector("[name='name']").value = options.name || "Waypoint " + new Date().toLocaleString()
                editor.querySelector("[name='category']").innerHTML = trailerPlaceCategoryOptions(category)
                editor.querySelector("[name='notes']").value = options.notes || ""
                editor.querySelector("[name='color']").value = options.color || "#ffcc33"
                editor.querySelector("[name='icon']").value = options.icon || trailerPlaceCategoryIcon(category)
                updateTrailerPlaceEditorIconPreview()
                editor.querySelector("[name='folder']").value = options.folder || "Unfiled"
                editor.querySelector("[data-folder-current]").textContent = options.folder || "Unfiled"
                editor.querySelector("[data-editor-folder-picker]").style.display = "none"
                editor.querySelector("[data-editor-folder-search]").value = ""
                editor.querySelector("[data-editor-status]").textContent = options.status || `New waypoint at ${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}. Edit details and click Save.`
                editor.style.display = "block"
            }

            function saveTrailerPlaceEditor() {
                const editor = ensureTrailerPlaceEditor()
                const status = editor.querySelector("[data-editor-status]")
                const featureId = editor.querySelector("[name='_feature_id']").value
                if (!featureId && editor.dataset.mode !== "new") {
                    status.textContent = "No waypoint is selected."
                    return
                }
                const saveButton = editor.querySelector("[data-editor-save]")
                saveButton.disabled = true
                saveButton.style.opacity = ".65"
                status.textContent = "Saving..."
                const payload = {
                    id: featureId,
                    name: editor.querySelector("[name='name']").value,
                    category: editor.querySelector("[name='category']").value,
                    notes: editor.querySelector("[name='notes']").value,
                    folder: editor.querySelector("[name='folder']").value,
                    color: editor.querySelector("[name='color']").value,
                    icon: editor.querySelector("[name='icon']").value,
                    marker: "",
                }
                if (editor.dataset.mode === "new") {
                    payload.lat = editor.querySelector("[name='lat']").value
                    payload.lon = editor.querySelector("[name='lon']").value
                }
                const endpoint = editor.dataset.mode === "new" ? "/maps-quick-save" : "/maps-place-update"
                fetch(endpoint, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(payload),
                })
                    .then(response => response.json().then(data => ({ok: response.ok, data: data})))
                    .then(result => {
                        if (!result.ok || !result.data.ok) {
                            throw new Error(result.data.error || "Save failed.")
                        }
                        if (editor.dataset.mode === "new") {
                            editor.dataset.mode = "edit"
                            editor.querySelector("[name='_feature_id']").value = result.data.id || ""
                            status.textContent = "Saved new waypoint."
                            return refreshTrailerPlaces()
                        }
                        updateTrailerPlaceFeatureFromPayload(featureId, payload)
                        status.textContent = "Saved."
                    })
                    .catch(error => {
                        status.textContent = "Save failed: " + error.message
                    })
                    .finally(() => {
                        saveButton.disabled = false
                        saveButton.style.opacity = "1"
                    })
            }

            function trailerPlaceEditPopup(feature, coordinates) {
                openTrailerPlaceEditor(feature)
            }

            function updateTrailerPlaceFeatureFromPayload(featureId, payload) {
                if (!trailerPlacesGeojson || !trailerPlacesGeojson.features) {
                    return
                }
                const feature = trailerPlacesGeojson.features.find(item => String(item.id || "") === String(featureId))
                if (!feature) {
                    return
                }
                feature.properties = {
                    ...(feature.properties || {}),
                    name: payload.name,
                    category: payload.category,
                    notes: payload.notes,
                    folder: payload.folder || "Unfiled",
                    color: payload.color,
                    icon: payload.icon,
                }
                delete feature.properties.marker
                saveTrailerPlaceRecentFolder(feature.properties.folder)
                installTrailerPlacesFolderControl(trailerPlacesGeojson)
                updateTrailerPlacesSource()
            }

            function setTrailerPlaceFolder(form, folder) {
                const normalized = String(folder || "").trim().replace(/^\/+|\/+$/g, "")
                if (!normalized) {
                    return
                }
                form.elements.folder.value = normalized
                form.querySelector("[data-folder-current]").textContent = normalized
                saveTrailerPlaceRecentFolder(normalized)
                const status = document.getElementById(form.id + "-status")
                if (status) {
                    status.textContent = "Folder set to " + normalized + ". Click Save to apply."
                }
            }

            function saveTrailerPlaceEdit(featureId, formId) {
                const form = document.getElementById(formId)
                const status = document.getElementById(formId + "-status")
                if (!form) {
                    return
                }
                if (status) {
                    status.textContent = "Save handler fired. Saving..."
                }
                const payload = {
                    id: featureId,
                    name: form.querySelector("[name='name']").value,
                    category: form.querySelector("[name='category']").value,
                    notes: form.querySelector("[name='notes']").value,
                    folder: form.querySelector("[name='folder']").value,
                    color: form.querySelector("[name='color']").value,
                    icon: form.querySelector("[name='icon']").value,
                    marker: "",
                }
                fetch("/maps-place-update", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(payload),
                })
                    .then(response => response.json().then(data => ({ok: response.ok, data: data})))
                    .then(result => {
                        if (!result.ok || !result.data.ok) {
                            throw new Error(result.data.error || "Save failed.")
                        }
                        if (status) {
                            status.textContent = "Saved."
                        }
                        updateTrailerPlaceFeatureFromPayload(featureId, payload)
                    })
                    .catch(error => {
                        if (status) {
                            status.textContent = "Save failed: " + error.message
                        }
                    })
            }

            function toggleTrailerPlaceFolderPicker(form) {
                const folderPicker = form.querySelector("[data-folder-picker]")
                const folderSearch = form.querySelector("[data-folder-search]")
                folderPicker.style.display = folderPicker.style.display === "none" ? "block" : "none"
                if (folderPicker.style.display === "block") {
                    const allBox = form.querySelector("[data-all-folders]")
                    if (allBox) {
                        allBox.textContent = "Loading folders..."
                        allBox.style.color = "#172016"
                    }
                    refreshTrailerPlaceFolderData().then(() => renderTrailerFolderChoices(form.id))
                    folderSearch.focus()
                } else {
                    renderTrailerFolderChoices(form.id)
                }
                const status = document.getElementById(form.id + "-status")
                if (status) {
                    status.textContent = folderPicker.style.display === "block" ? "Choose a folder, or type a new one and press Enter." : ""
                }
            }

            function useTypedTrailerPlaceFolder(form) {
                const folderSearch = form.querySelector("[data-folder-search]")
                const typed = folderSearch.value.trim().replace(/^\/+|\/+$/g, "")
                if (!typed) {
                    return
                }
                setTrailerPlaceFolder(form, typed)
                renderTrailerFolderChoices(form.id)
            }

            let trailerPlaceClickHandlerMap = null
            function installTrailerPlaceClickHandler() {
                if (!mb || !mb.map || trailerPlaceClickHandlerMap === mb.map) {
                    return
                }
                trailerPlaceClickHandlerMap = mb.map
                mb.map.on("click", e => {
                    if (e.originalEvent && e.originalEvent.trailerPlacePopupHandled) {
                        return
                    }
                    if (trailerAddWaypointClickMode) {
                        stopTrailerMapWaypointMode()
                        openNewTrailerPlaceEditor(e.lngLat)
                        return
                    }
                    if (trailerMapPoiPickMode) {
                        stopTrailerMapPoiPickMode()
                        chooseRenderedMapPoi(e)
                        return
                    }
                    if (!e.originalEvent || !e.originalEvent.shiftKey) {
                        return
                    }
                    openNewTrailerPlaceEditor(e.lngLat)
                })
            }

            let trailerPlacesGeojson = null
            let trailerPlacesVisibleFolders = null
            let trailerPlacesKnownFolders = new Set()
            let trailerPlacesFolderControl = null
            let trailerPlacesFolderPopover = null
            let trailerMapPoiPickMode = false
            let trailerPlacesFolderCloseHandlerInstalled = false
            function trailerPlaceFolder(feature) {
                return (feature.properties && feature.properties.folder) || "Unfiled"
            }

            function trailerPlacesFilteredGeojson() {
                if (!trailerPlacesGeojson || !trailerPlacesVisibleFolders) {
                    return {type: "FeatureCollection", features: []}
                }
                return {
                    type: "FeatureCollection",
                    features: trailerPlacesGeojson.features
                        .filter(feature => trailerPlacesVisibleFolders.has(trailerPlaceFolder(feature)))
                        .map(feature => ({
                            ...feature,
                            properties: {
                                ...(feature.properties || {}),
                                _trailer_id: String(feature.id || (feature.properties && feature.properties._trailer_id) || ""),
                                icon_key: trailerPlaceIconKey(feature),
                                icon_image: "trailer-place-icon-" + trailerPlaceIconKey(feature),
                            },
                        })),
                }
            }

            function updateTrailerPlacesSource() {
                if (!mb || !mb.map || !mb.map.getSource("trailer-places")) {
                    return
                }
                mb.map.getSource("trailer-places").setData(trailerPlacesFilteredGeojson())
            }

            let trailerPlacesAdminSnapshot = null
            let trailerPlacesManagerModal = null
            let trailerPlacesManagerSelection = {features: new Set(), folders: new Set()}
            let trailerPlacesManagerOpenFolders = new Set()
            let trailerAddWaypointClickMode = false

            function trailerPlaceApiJson(url, payload) {
                return fetch(url, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(payload),
                })
                    .then(response => response.json().then(data => ({ok: response.ok, data: data})))
                    .then(result => {
                        if (!result.ok || !result.data.ok) {
                            throw new Error(result.data.error || "Request failed.")
                        }
                        return result.data
                    })
            }

            function applyTrailerPlacesSnapshot(snapshot) {
                if (!snapshot || !snapshot.places || !snapshot.places.features) {
                    return
                }
                trailerPlacesAdminSnapshot = snapshot
                trailerPlacesGeojson = snapshot.places
                installTrailerPlacesFolderControl(trailerPlacesGeojson)
                updateTrailerPlacesSource()
                renderTrailerPlacesManager()
            }

            function fetchTrailerPlacesAdminData() {
                return fetch("/maps-data", {cache: "no-store"})
                    .then(response => response.json().then(data => ({ok: response.ok, data: data})))
                    .then(result => {
                        if (!result.ok) {
                            throw new Error(result.data.error || "Could not load map data.")
                        }
                        applyTrailerPlacesSnapshot(result.data)
                        return result.data
                    })
            }

            function trailerFeatureId(feature) {
                return String(feature.id || (feature.properties && feature.properties._trailer_id) || "")
            }

            function trailerAdminFolders() {
                const folders = new Set((trailerPlacesAdminSnapshot && trailerPlacesAdminSnapshot.folders) || trailerPlaceFolders())
                if (trailerPlacesGeojson && trailerPlacesGeojson.features) {
                    trailerPlacesGeojson.features.forEach(feature => folders.add(trailerPlaceFolder(feature)))
                }
                return [...folders].filter(Boolean).sort((a, b) => a.localeCompare(b))
            }

            function trailerAdminFolderOptions(selected) {
                const folders = trailerAdminFolders()
                const normalized = selected || "Unfiled"
                const options = folders.includes(normalized) ? folders : [normalized, ...folders]
                return options.map(folder => `<option value="${trailerPlaceAttrEscape(folder)}"${folder === normalized ? " selected" : ""}>${trailerPlaceHtmlEscape(folder)}</option>`).join("")
            }

            function buildTrailerAdminTree() {
                const root = {name: "", path: "", children: {}, features: []}
                const ensureFolder = folder => {
                    let node = root
                    const parts = String(folder || "Unfiled").split("/").filter(Boolean)
                    let path = ""
                    parts.forEach(part => {
                        path = path ? path + "/" + part : part
                        node.children[part] = node.children[part] || {name: part, path: path, children: {}, features: []}
                        node = node.children[part]
                    })
                    return node
                }
                trailerAdminFolders().forEach(ensureFolder)
                if (trailerPlacesGeojson && trailerPlacesGeojson.features) {
                    trailerPlacesGeojson.features.forEach(feature => ensureFolder(trailerPlaceFolder(feature)).features.push(feature))
                }
                return root
            }

            function trailerAdminFolderCount(node) {
                return node.features.length + Object.values(node.children).reduce((sum, child) => sum + trailerAdminFolderCount(child), 0)
            }

            function trailerAdminRowEscape(value) {
                return trailerPlaceHtmlEscape(value || "")
            }

            function trailerAdminFeatureSummary(feature) {
                const geometry = feature.geometry || {}
                const coords = geometry.coordinates || []
                if (geometry.type === "Point" && coords.length >= 2) {
                    return "Point " + Number(coords[1]).toFixed(5) + ", " + Number(coords[0]).toFixed(5)
                }
                if (geometry.type === "LineString") {
                    return "Route with " + coords.length + " point(s)"
                }
                return geometry.type || "Feature"
            }

            function trailerAdminFeatureCategory(feature) {
                const geometry = feature.geometry || {}
                if (geometry.type === "LineString") {
                    return "Route"
                }
                if (geometry.type === "Point") {
                    const props = feature.properties || {}
                    return props.category || trailerPlaceIconDefs[trailerPlaceIconKey(feature)].label || "Waypoint"
                }
                return geometry.type || "Feature"
            }

            function trailerAdminCategoryCell(feature) {
                const geometry = feature.geometry || {}
                const category = trailerAdminFeatureCategory(feature)
                if (geometry.type !== "Point") {
                    return trailerAdminRowEscape(category)
                }
                const icon = trailerPlaceIconDefs[trailerPlaceIconKey(feature)] || trailerPlaceIconDefs.pin
                return `<span class="op-category-cell"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="${icon.path}"/></svg><span>${trailerAdminRowEscape(category)}</span></span>`
            }

            function trailerAdminActionButton(action, type, id, title) {
                const icons = {
                    show: "M12 5c5 0 9 5.5 10 7-1 1.5-5 7-10 7S3 13.5 2 12c1-1.5 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
                    hide: "M3.3 2 22 20.7 20.7 22l-3.1-3.1A12.7 12.7 0 0 1 12 20C7 20 3 14.5 2 13c.5-.8 2-2.9 4.2-4.7L2 3.3 3.3 2zm5 8.5A4 4 0 0 0 13.5 15.7l-1.7-1.7A2 2 0 0 1 10 12.2l-1.7-1.7zM12 4c5 0 9 5.5 10 7-.4.7-1.7 2.5-3.5 4.1L16 12.6A4 4 0 0 0 10.4 7L8.6 5.2A12.6 12.6 0 0 1 12 4z",
                    rename: "M4 17.25V21h3.75L18.8 9.95l-3.75-3.75L4 17.25zm13.7-9.15 1.4-1.4a1 1 0 0 0 0-1.4l-.4-.4a1 1 0 0 0-1.4 0l-1.4 1.4 1.8 1.8z",
                    move: "M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2h7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10zm10 3.5v2h-3v2h3v2l4-3-4-3z",
                    delete: "M7 21a2 2 0 0 1-2-2V8h14v11a2 2 0 0 1-2 2H7zM9 4h6l1 2h4v2H4V6h4l1-2z",
                }
                return `<button type="button" data-admin-action="${action}" data-admin-type="${type}" data-admin-id="${trailerPlaceAttrEscape(id)}" title="${trailerPlaceAttrEscape(title)}" class="op-action-button"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="${icons[action]}"/></svg></button>`
            }

            function trailerAdminFolderVisibility(folderPath) {
                if (!trailerPlacesVisibleFolders) {
                    return true
                }
                const folders = trailerAdminFolders().filter(folder => folder === folderPath || folder.startsWith(folderPath + "/"))
                if (!folders.length) {
                    return true
                }
                return folders.some(folder => trailerPlacesVisibleFolders.has(folder))
            }

            function renderTrailerAdminTreeNode(node, depth=0) {
                const parts = []
                Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name)).forEach(child => {
                    const path = trailerPlaceAttrEscape(child.path)
                    const visible = trailerAdminFolderVisibility(child.path)
                    const openAttr = trailerPlacesManagerOpenFolders.has(child.path) ? " open" : ""
                    parts.push(`
                        <details data-admin-folder="${path}"${openAttr}>
                            <summary class="op-tree-folder-row op-tree-summary">
                                <span class="op-tree-name" style="margin-left:${depth * 16}px">
                                    <button type="button" data-admin-folder-caret class="op-tree-caret">▶</button>
                                    <input type="checkbox" data-admin-select-folder="${path}" style="width:auto" onclick="event.stopPropagation()"> <span>${trailerAdminRowEscape(child.name)}</span>
                                </span>
                                <span>Folder</span>
                                <span>${trailerAdminFolderCount(child)} item(s) · ${visible ? "shown" : "hidden"}</span>
                                <span class="op-tree-actions">
                                    ${trailerAdminActionButton(visible ? "show" : "hide", "folder", child.path, visible ? "Hide folder on map" : "Show folder on map")}
                                    ${trailerAdminActionButton("rename", "folder", child.path, "Rename folder")}
                                    ${trailerAdminActionButton("move", "folder", child.path, "Move folder")}
                                    ${trailerAdminActionButton("delete", "folder", child.path, "Delete folder")}
                                </span>
                            </summary>
                            ${renderTrailerAdminTreeNode(child, depth + 1)}
                        </details>`)
                })
                node.features.sort((a, b) => ((a.properties || {}).name || "").localeCompare((b.properties || {}).name || "")).forEach(feature => {
                    const props = feature.properties || {}
                    const featureId = trailerFeatureId(feature)
                    const generated = props.generated || props.readonly
                    const mutableActions = generated ? "" : `
                                ${trailerAdminActionButton("rename", "feature", featureId, "Rename item")}
                                ${trailerAdminActionButton("move", "feature", featureId, "Move item")}`
                    parts.push(`
                        <div class="op-tree-file-row" style="margin-left:${(depth + 1) * 16}px">
                            <label class="op-tree-name">
                                <span style="display:inline-block;width:18px"></span><input type="checkbox" data-admin-select-feature="${trailerPlaceAttrEscape(featureId)}" style="width:auto"> <span>${trailerAdminRowEscape(props.name || "Unnamed")}</span>
                            </label>
                            <span>${trailerAdminCategoryCell(feature)}</span>
                            <span title="${trailerPlaceAttrEscape(props.notes || props.source || "")}">${trailerAdminRowEscape(trailerAdminFeatureSummary(feature))}</span>
                            <span class="op-tree-actions">
                                ${mutableActions}
                                ${trailerAdminActionButton("delete", "feature", featureId, "Delete item")}
                            </span>
                        </div>`)
                })
                return parts.join("")
            }

            function ensureTrailerPlacesManagerModal() {
                if (trailerPlacesManagerModal) {
                    return trailerPlacesManagerModal
                }
                trailerPlacesManagerModal = document.createElement("div")
                trailerPlacesManagerModal.id = "trailer-places-manager-modal"
                trailerPlacesManagerModal.className = "op-manager-modal"
                trailerPlacesManagerModal.innerHTML = `
                    <div class="op-manager-panel op-modal-panel">
                        <div class="op-manager-header">
                            <div>
                                <h2>Trailer Places Manager</h2>
                                <p class="op-text-muted" style="margin:0">Manage folders, waypoints, routes, and imports directly from the map.</p>
                            </div>
                            <button type="button" data-admin-close class="op-close-button op-manager-close">&times;</button>
                        </div>
                        <div data-admin-status class="op-status" style="font-weight:800"></div>
                        <div class="op-toolbar">
                            <button type="button" data-admin-add-folder class="op-button">Add Folder</button>
                            <button type="button" data-admin-move-selected class="op-button">Move Selected</button>
                            <button type="button" data-admin-export-selected class="op-button op-button--info">Export Selected</button>
                            <button type="button" data-admin-delete-selected class="op-button op-button--danger">Delete Selected</button>
                        </div>
                        <details open class="op-section">
                            <summary>Import GPX / GeoJSON / KML</summary>
                            <form data-admin-import-form class="op-form-grid">
                                <label>Folder<br><select name="folder" data-admin-folder-select class="op-select"></select></label>
                                <label>File<br><input type="file" name="import_file" accept=".gpx,.json,.geojson,.kml" style="width:100%;box-sizing:border-box"></label>
                                <button type="submit" class="op-button">Import</button>
                            </form>
                        </details>
                        <details class="op-section">
                            <summary>Add Waypoint By Coordinates</summary>
                            <form data-admin-add-waypoint-form class="op-form-grid">
                                <label>Name<br><input name="name" required class="op-input"></label>
                                <label>Folder<br><select name="folder" data-admin-folder-select class="op-select"></select></label>
                                <label>Category<br><select name="category" class="op-select"></select></label>
                                <input type="hidden" name="icon" value="pin">
                                <label>Latitude<br><input name="lat" required class="op-input"></label>
                                <label>Longitude<br><input name="lon" required class="op-input"></label>
                                <label style="grid-column:1/-1">Notes<br><textarea name="notes" rows="2" class="op-textarea"></textarea></label>
                                <button type="button" data-admin-use-center class="op-button op-button--muted">Use Map Center</button>
                                <button type="submit" class="op-button">Add Waypoint</button>
                            </form>
                        </details>
                        <div class="op-table-wrap">
                            <div class="op-table-header">
                                <span>Name</span><span>Category</span><span>Info</span><span>Actions</span>
                            </div>
                            <div data-admin-tree class="op-tree"></div>
                        </div>
                        <details open class="op-section" style="margin-top:12px">
                            <summary>Offline Map Regions</summary>
                            <p class="op-text-muted" style="margin:8px 0">Paste the safe IIAB extract command from the map grid tool, or delete installed regions below.</p>
                            <label class="op-field--strong">IIAB Extract Command<br>
                                <textarea data-region-command rows="2" placeholder="oiab-map-extract extract canada_region1 -117.629636521,54.548372958,-110.835097244,57.0967409" class="op-textarea" style="margin-top:4px"></textarea>
                            </label>
                            <button type="button" data-region-start-download class="op-button" style="margin-top:8px">Start Region Download</button>
                            <div class="op-region-header" style="margin-top:12px;border-radius:8px 8px 0 0">
                                <span>Region</span><span>Bounds</span><span>Actions</span>
                            </div>
                            <div data-region-list class="op-region-list"></div>
                            <div data-region-jobs class="op-text-muted" style="margin-top:10px"></div>
                        </details>
                    </div>`
                document.body.appendChild(trailerPlacesManagerModal)
                trailerPlacesManagerModal.querySelector("[data-admin-close]").addEventListener("click", closeTrailerPlacesManager)
                trailerPlacesManagerModal.addEventListener("click", event => {
                    if (event.target === trailerPlacesManagerModal) {
                        closeTrailerPlacesManager()
                    }
                })
                trailerPlacesManagerModal.querySelector("[data-admin-add-folder]").addEventListener("click", addTrailerAdminFolder)
                trailerPlacesManagerModal.querySelector("[data-admin-move-selected]").addEventListener("click", () => moveTrailerAdminSelected())
                trailerPlacesManagerModal.querySelector("[data-admin-export-selected]").addEventListener("click", exportTrailerAdminSelected)
                trailerPlacesManagerModal.querySelector("[data-admin-delete-selected]").addEventListener("click", () => deleteTrailerAdminSelected())
                trailerPlacesManagerModal.querySelector("[data-admin-import-form]").addEventListener("submit", importTrailerAdminFile)
                trailerPlacesManagerModal.querySelector("[data-admin-add-waypoint-form]").addEventListener("submit", addTrailerAdminWaypoint)
                trailerPlacesManagerModal.querySelector("[data-admin-use-center]").addEventListener("click", useMapCenterForAdminWaypoint)
                trailerPlacesManagerModal.querySelector("[data-region-start-download]").addEventListener("click", startTrailerRegionDownload)
                trailerPlacesManagerModal.querySelector("[data-admin-add-waypoint-form] [name='category']").addEventListener("change", event => {
                    const option = event.currentTarget.selectedOptions[0]
                    trailerPlacesManagerModal.querySelector("[data-admin-add-waypoint-form] [name='icon']").value = option ? option.dataset.icon || trailerPlaceCategoryIcon(event.currentTarget.value) : "pin"
                })
                return trailerPlacesManagerModal
            }

            function setTrailerAdminStatus(message) {
                const modal = ensureTrailerPlacesManagerModal()
                modal.querySelector("[data-admin-status]").textContent = message || ""
            }

            function renderTrailerPlacesManager() {
                if (!trailerPlacesManagerModal || trailerPlacesManagerModal.style.display === "none") {
                    return
                }
                const tree = trailerPlacesManagerModal.querySelector("[data-admin-tree]")
                trailerPlacesManagerModal.querySelectorAll("[data-admin-folder-select]").forEach(select => {
                    const current = select.value || "Unfiled"
                    select.innerHTML = trailerAdminFolderOptions(current)
                })
                const addWaypointCategory = trailerPlacesManagerModal.querySelector("[data-admin-add-waypoint-form] [name='category']")
                if (addWaypointCategory && !addWaypointCategory.options.length) {
                    addWaypointCategory.innerHTML = trailerPlaceCategoryOptions("waypoint")
                    trailerPlacesManagerModal.querySelector("[data-admin-add-waypoint-form] [name='icon']").value = "pin"
                }
                renderTrailerRegionsManager()
                tree.innerHTML = renderTrailerAdminTreeNode(buildTrailerAdminTree()) || "<p>No folders or places yet.</p>"
                tree.querySelectorAll("details[data-admin-folder]").forEach(details => {
                    details.addEventListener("toggle", () => {
                        if (details.open) {
                            trailerPlacesManagerOpenFolders.add(details.dataset.adminFolder)
                        } else {
                            trailerPlacesManagerOpenFolders.delete(details.dataset.adminFolder)
                        }
                    })
                    const caret = details.querySelector(":scope > summary [data-admin-folder-caret]")
                    if (caret) {
                        caret.addEventListener("click", event => {
                            event.preventDefault()
                            event.stopPropagation()
                            details.open = !details.open
                        })
                    }
                })
                tree.querySelectorAll("[data-admin-select-feature]").forEach(input => {
                    input.checked = trailerPlacesManagerSelection.features.has(input.dataset.adminSelectFeature)
                    input.addEventListener("change", () => {
                        if (input.checked) trailerPlacesManagerSelection.features.add(input.dataset.adminSelectFeature)
                        else trailerPlacesManagerSelection.features.delete(input.dataset.adminSelectFeature)
                    })
                })
                tree.querySelectorAll("[data-admin-select-folder]").forEach(input => {
                    input.checked = trailerPlacesManagerSelection.folders.has(input.dataset.adminSelectFolder)
                    input.addEventListener("change", () => {
                        if (input.checked) trailerPlacesManagerSelection.folders.add(input.dataset.adminSelectFolder)
                        else trailerPlacesManagerSelection.folders.delete(input.dataset.adminSelectFolder)
                    })
                })
                tree.querySelectorAll("[data-admin-action]").forEach(button => {
                    button.addEventListener("click", event => {
                        event.preventDefault()
                        event.stopPropagation()
                        runTrailerAdminRowAction(button.dataset.adminAction, button.dataset.adminType, button.dataset.adminId)
                    })
                })
            }

            function renderTrailerRegionsManager() {
                if (!trailerPlacesManagerModal) return
                const regions = (trailerPlacesAdminSnapshot && trailerPlacesAdminSnapshot.regions) || {}
                const regionList = trailerPlacesManagerModal.querySelector("[data-region-list]")
                const jobsBox = trailerPlacesManagerModal.querySelector("[data-region-jobs]")
                const regionNames = Object.keys(regions).sort((a, b) => a.localeCompare(b))
                if (!regionNames.length) {
                    regionList.innerHTML = `<div class="op-text-muted" style="padding:10px">No full-quality map regions are installed yet.</div>`
                } else {
                    regionList.innerHTML = regionNames.map(name => {
                        const info = regions[name] || {}
                        const bbox = Array.isArray(info.bbox) ? info.bbox.join(", ") : (info.bbox || "")
                        return `
                            <div class="op-region-row">
                                <strong>${trailerAdminRowEscape(name)}</strong>
                                <span style="overflow:hidden;text-overflow:ellipsis">${trailerAdminRowEscape(bbox)}</span>
                                <span style="text-align:right"><button type="button" data-region-delete="${trailerPlaceAttrEscape(name)}" class="op-button op-button--danger" style="padding:6px 10px">Delete</button></span>
                            </div>`
                    }).join("")
                    regionList.querySelectorAll("[data-region-delete]").forEach(button => {
                        button.addEventListener("click", () => deleteTrailerRegion(button.dataset.regionDelete))
                    })
                }
                const jobs = ((trailerPlacesAdminSnapshot && trailerPlacesAdminSnapshot.jobs) || []).slice(0, 4)
                jobsBox.innerHTML = jobs.length ? "<strong>Recent region jobs</strong>" + jobs.map(job => `<div style="margin-top:4px"><code>${trailerAdminRowEscape(job.id || "")}</code> - ${trailerAdminRowEscape(job.status || "")}</div>`).join("") : ""
            }

            function openTrailerPlacesManager() {
                const modal = ensureTrailerPlacesManagerModal()
                modal.style.display = "flex"
                setTrailerAdminStatus("Loading map data...")
                fetchTrailerPlacesAdminData()
                    .then(() => setTrailerAdminStatus(""))
                    .catch(error => setTrailerAdminStatus("Load failed: " + error.message))
            }

            function closeTrailerPlacesManager() {
                if (trailerPlacesManagerModal) {
                    trailerPlacesManagerModal.style.display = "none"
                }
            }
            window.openTrailerPlacesManager = openTrailerPlacesManager

            function afterTrailerAdminMutation(result) {
                setTrailerAdminStatus(result.message || "Saved.")
                if (result.snapshot) {
                    applyTrailerPlacesSnapshot(result.snapshot)
                } else {
                    fetchTrailerPlacesAdminData()
                }
                return refreshTrailerPlaces()
            }

            function runTrailerAdminAction(payload) {
                setTrailerAdminStatus("Saving...")
                return trailerPlaceApiJson("/maps-manage-places", payload)
                    .then(afterTrailerAdminMutation)
                    .catch(error => {
                        setTrailerAdminStatus("Failed: " + error.message)
                        throw error
                    })
            }

            function showTrailerAdminDialog(options) {
                return new Promise(resolve => {
                    const overlay = document.createElement("div")
                    overlay.className = "op-dialog-overlay"
                    overlay.innerHTML = `
                        <div data-dialog-panel class="op-dialog-panel">
                            <div class="op-dialog-header">
                                <div>
                                    <h3 class="op-dialog-title">${trailerPlaceHtmlEscape(options.title || "Map Action")}</h3>
                                    ${options.message ? `<p class="op-text-muted" style="margin:7px 0 0">${trailerPlaceHtmlEscape(options.message)}</p>` : ""}
                                </div>
                                <button type="button" data-dialog-close class="op-close-button op-dialog-close">&times;</button>
                            </div>
                            <div data-dialog-body class="op-dialog-body"></div>
                        </div>`
                    const panel = overlay.querySelector("[data-dialog-panel]")
                    const body = overlay.querySelector("[data-dialog-body]")
                    const finish = value => {
                        overlay.remove()
                        resolve(value)
                    }
                    overlay.querySelector("[data-dialog-close]").addEventListener("click", () => finish(null))
                    overlay.addEventListener("click", event => {
                        if (event.target === overlay) {
                            finish(null)
                        }
                    })
                    if (options.bodyHtml) {
                        body.innerHTML = options.bodyHtml
                    }
                    if (typeof options.setup === "function") {
                        options.setup(panel, body, finish)
                    }
                    document.body.appendChild(overlay)
                    const focusTarget = panel.querySelector("input, select, textarea, button:not([data-dialog-close])")
                    if (focusTarget) {
                        focusTarget.focus()
                    }
                })
            }

            function showTrailerAdminTextDialog(title, label, defaultValue, placeholder) {
                return showTrailerAdminDialog({
                    title: title,
                    bodyHtml: `
                        <label class="op-field--strong">${trailerPlaceHtmlEscape(label)}<br>
                            <input data-dialog-input value="${trailerPlaceAttrEscape(defaultValue || "")}" placeholder="${trailerPlaceAttrEscape(placeholder || "")}" class="op-input" style="margin-top:5px">
                        </label>
                        <div class="op-dialog-actions">
                            <button type="button" data-dialog-cancel class="op-button op-button--muted">Cancel</button>
                            <button type="button" data-dialog-save class="op-button">Save</button>
                        </div>`,
                    setup: (panel, body, finish) => {
                        const input = panel.querySelector("[data-dialog-input]")
                        const save = () => {
                            const value = input.value.trim().replace(/^\/+|\/+$/g, "")
                            if (!value) {
                                input.focus()
                                return
                            }
                            finish(value)
                        }
                        panel.querySelector("[data-dialog-save]").addEventListener("click", save)
                        panel.querySelector("[data-dialog-cancel]").addEventListener("click", () => finish(null))
                        input.addEventListener("keydown", event => {
                            if (event.key === "Enter") {
                                event.preventDefault()
                                save()
                            }
                        })
                    },
                })
            }

            function showTrailerAdminConfirmDialog(title, message, confirmLabel) {
                return showTrailerAdminDialog({
                    title: title,
                    message: message,
                    bodyHtml: `
                        <div class="op-dialog-actions">
                            <button type="button" data-dialog-cancel class="op-button op-button--muted">Cancel</button>
                            <button type="button" data-dialog-confirm class="op-button op-button--danger">${trailerPlaceHtmlEscape(confirmLabel || "Delete")}</button>
                        </div>`,
                    setup: (panel, body, finish) => {
                        panel.querySelector("[data-dialog-cancel]").addEventListener("click", () => finish(false))
                        panel.querySelector("[data-dialog-confirm]").addEventListener("click", () => finish(true))
                    },
                })
            }

            function showTrailerAdminExportDialog(count) {
                return showTrailerAdminDialog({
                    title: "Export Map Data",
                    message: "Export " + count + " selected item(s).",
                    bodyHtml: `
                        <div style="display:grid;gap:8px">
                            <button type="button" data-export-format="geojson" class="op-dialog-choice">
                                <strong>GeoJSON</strong><br><span class="op-text-muted">Best for backup and re-import into this map.</span>
                            </button>
                            <button type="button" data-export-format="gpx" class="op-dialog-choice">
                                <strong>GPX</strong><br><span class="op-text-muted">Best for GPS apps and route/waypoint exchange.</span>
                            </button>
                        </div>
                        <div class="op-dialog-actions" style="margin-top:12px">
                            <button type="button" data-dialog-cancel class="op-button op-button--muted">Cancel</button>
                        </div>`,
                    setup: (panel, body, finish) => {
                        panel.querySelectorAll("[data-export-format]").forEach(button => {
                            button.addEventListener("click", () => finish(button.dataset.exportFormat))
                        })
                        panel.querySelector("[data-dialog-cancel]").addEventListener("click", () => finish(null))
                    },
                })
            }

            function showTrailerAdminFolderPickerDialog(title, message) {
                return showTrailerAdminDialog({
                    title: title,
                    message: message,
                    bodyHtml: `
                        <label class="op-field--strong">Search or new folder<br>
                            <input data-folder-search value="" placeholder="Trips/Day 2 or Local Waypoints" class="op-input" style="margin-top:5px">
                        </label>
                        <div style="margin-top:10px;font-weight:900">Recent</div>
                        <div data-recent-folders style="max-height:110px;overflow:auto"></div>
                        <div style="margin-top:10px;font-weight:900">All folders</div>
                        <div data-all-folders style="max-height:190px;overflow:auto;border:1px solid #e0e9e0;border-radius:10px;padding:4px"></div>
                        <div class="op-dialog-actions" style="justify-content:space-between;margin-top:12px">
                            <button type="button" data-dialog-cancel class="op-button op-button--muted">Cancel</button>
                            <button type="button" data-use-typed-folder class="op-button">Use Typed Folder</button>
                        </div>`,
                    setup: (panel, body, finish) => {
                        const input = panel.querySelector("[data-folder-search]")
                        const recentBox = panel.querySelector("[data-recent-folders]")
                        const allBox = panel.querySelector("[data-all-folders]")
                        const renderButton = folder => {
                            const button = document.createElement("button")
                            button.type = "button"
                            button.textContent = folder
                            button.className = "op-folder-choice"
                            button.addEventListener("click", () => finish(folder))
                            return button
                        }
                        const render = () => {
                            const query = input.value.trim().toLowerCase()
                            const folders = trailerAdminFolders().filter(folder => !query || folder.toLowerCase().includes(query))
                            const recent = trailerPlaceRecentFolders().filter(folder => trailerAdminFolders().includes(folder)).filter(folder => !query || folder.toLowerCase().includes(query)).slice(0, 5)
                            recentBox.innerHTML = ""
                            recent.forEach(folder => recentBox.appendChild(renderButton(folder)))
                            if (!recentBox.children.length) {
                                recentBox.textContent = "No recent folders."
                            }
                            allBox.innerHTML = ""
                            folders.forEach(folder => allBox.appendChild(renderButton(folder)))
                            if (!allBox.children.length) {
                                allBox.textContent = query ? "No matching folders. Use the typed folder to create it." : "No folders yet."
                            }
                        }
                        const useTyped = () => {
                            const value = input.value.trim().replace(/^\/+|\/+$/g, "")
                            if (!value) {
                                input.focus()
                                return
                            }
                            finish(value)
                        }
                        input.addEventListener("input", render)
                        input.addEventListener("keydown", event => {
                            if (event.key === "Enter") {
                                event.preventDefault()
                                useTyped()
                            }
                        })
                        panel.querySelector("[data-use-typed-folder]").addEventListener("click", useTyped)
                        panel.querySelector("[data-dialog-cancel]").addEventListener("click", () => finish(null))
                        render()
                    },
                })
            }

            function addTrailerAdminFolder() {
                showTrailerAdminTextDialog("Add Folder", "Folder path", "", "Local Waypoints").then(folder => {
                    if (folder === null) return
                    runTrailerAdminAction({action: "add_folder", folder: folder})
                })
            }

            function moveTrailerAdminSelected(extraSelection) {
                const currentSelection = extraSelection || {
                    feature_ids: [...trailerPlacesManagerSelection.features],
                    folder_paths: [...trailerPlacesManagerSelection.folders],
                }
                if (!currentSelection.feature_ids.length && !currentSelection.folder_paths.length) {
                    setTrailerAdminStatus("Select at least one folder or item first.")
                    return
                }
                const count = currentSelection.feature_ids.length + currentSelection.folder_paths.length
                showTrailerAdminFolderPickerDialog("Move Selected", "Choose a destination folder for " + count + " selected item(s).").then(target => {
                    if (target === null) return
                    saveTrailerPlaceRecentFolder(target)
                    runTrailerAdminAction({action: "move_selected", target_folder: target, ...currentSelection})
                })
            }

            function deleteTrailerAdminSelected(extraSelection) {
                const currentSelection = extraSelection || {
                    feature_ids: [...trailerPlacesManagerSelection.features],
                    folder_paths: [...trailerPlacesManagerSelection.folders],
                }
                if (!currentSelection.feature_ids.length && !currentSelection.folder_paths.length) {
                    setTrailerAdminStatus("Select at least one folder or item first.")
                    return
                }
                const count = currentSelection.feature_ids.length + currentSelection.folder_paths.length
                showTrailerAdminConfirmDialog("Delete Map Data", "Delete " + count + " selected folder/item record(s)? This cannot be undone.", "Delete").then(confirmed => {
                    if (!confirmed) return
                    runTrailerAdminAction({action: "delete_selected", ...currentSelection}).then(() => {
                        trailerPlacesManagerSelection = {features: new Set(), folders: new Set()}
                    })
                })
            }

            function trailerAdminFolderMatches(folder, selectedFolder) {
                return folder === selectedFolder || folder.startsWith(selectedFolder + "/")
            }

            function selectedTrailerAdminFeatures() {
                const featureIds = trailerPlacesManagerSelection.features
                const folderPaths = [...trailerPlacesManagerSelection.folders]
                if ((!featureIds || !featureIds.size) && !folderPaths.length) {
                    return []
                }
                const source = trailerPlacesGeojson && trailerPlacesGeojson.features ? trailerPlacesGeojson.features : []
                return source.filter(feature => {
                    const featureId = trailerFeatureId(feature)
                    const folder = trailerPlaceFolder(feature)
                    return featureIds.has(featureId) || folderPaths.some(selectedFolder => trailerAdminFolderMatches(folder, selectedFolder))
                })
            }

            function downloadTrailerAdminFile(filename, contentType, text) {
                const blob = new Blob([text], {type: contentType})
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = filename
                document.body.appendChild(link)
                link.click()
                link.remove()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
            }

            function trailerAdminExportFilename(extension) {
                const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
                return "trailer-places-export-" + stamp + "." + extension
            }

            function exportTrailerAdminGeojson(features) {
                const collection = {
                    type: "FeatureCollection",
                    features: features.map(feature => JSON.parse(JSON.stringify(feature))),
                }
                downloadTrailerAdminFile(
                    trailerAdminExportFilename("geojson"),
                    "application/geo+json;charset=utf-8",
                    JSON.stringify(collection, null, 2) + "\n"
                )
            }

            function trailerAdminXmlEscape(value) {
                return String(value || "")
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&apos;")
            }

            function exportTrailerAdminGpx(features) {
                const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="Trailer Pi Maps" xmlns="http://www.topografix.com/GPX/1/1">']
                features.forEach(feature => {
                    const geometry = feature.geometry || {}
                    const props = feature.properties || {}
                    if (geometry.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
                        const lon = geometry.coordinates[0]
                        const lat = geometry.coordinates[1]
                        lines.push(`  <wpt lat="${lat}" lon="${lon}">`)
                        lines.push(`    <name>${trailerAdminXmlEscape(props.name || "Waypoint")}</name>`)
                        if (props.notes) lines.push(`    <desc>${trailerAdminXmlEscape(props.notes)}</desc>`)
                        if (props.category) lines.push(`    <type>${trailerAdminXmlEscape(props.category)}</type>`)
                        lines.push("  </wpt>")
                    } else if (geometry.type === "LineString" && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
                        lines.push("  <trk>")
                        lines.push(`    <name>${trailerAdminXmlEscape(props.name || "Route")}</name>`)
                        if (props.notes) lines.push(`    <desc>${trailerAdminXmlEscape(props.notes)}</desc>`)
                        lines.push("    <trkseg>")
                        geometry.coordinates.forEach(coord => {
                            if (Array.isArray(coord) && coord.length >= 2) {
                                lines.push(`      <trkpt lat="${coord[1]}" lon="${coord[0]}"></trkpt>`)
                            }
                        })
                        lines.push("    </trkseg>")
                        lines.push("  </trk>")
                    }
                })
                lines.push("</gpx>")
                downloadTrailerAdminFile(trailerAdminExportFilename("gpx"), "application/gpx+xml;charset=utf-8", lines.join("\n") + "\n")
            }

            function exportTrailerAdminSelected() {
                const features = selectedTrailerAdminFeatures()
                if (!features.length) {
                    setTrailerAdminStatus("Select at least one folder, waypoint, or route to export.")
                    return
                }
                showTrailerAdminExportDialog(features.length).then(format => {
                    if (!format) return
                    if (format === "geojson") {
                        exportTrailerAdminGeojson(features)
                        setTrailerAdminStatus("Exported " + features.length + " selected item(s) as GeoJSON.")
                        return
                    }
                    if (format === "gpx") {
                        exportTrailerAdminGpx(features)
                        setTrailerAdminStatus("Exported " + features.length + " selected item(s) as GPX.")
                    }
                })
            }

            function startTrailerRegionDownload() {
                const command = trailerPlacesManagerModal.querySelector("[data-region-command]").value.trim()
                if (!command) {
                    setTrailerAdminStatus("Paste the IIAB tile-extract command first.")
                    return
                }
                runTrailerAdminAction({action: "extract_region_command", command: command}).then(() => {
                    trailerPlacesManagerModal.querySelector("[data-region-command]").value = ""
                })
            }

            function deleteTrailerRegion(name) {
                showTrailerAdminConfirmDialog("Delete Offline Region", "Delete offline map region '" + name + "'?", "Delete Region").then(confirmed => {
                    if (!confirmed) return
                    runTrailerAdminAction({action: "delete_region", name: name})
                })
            }

            function runTrailerAdminRowAction(action, type, id) {
                if (action === "show" || action === "hide") {
                    toggleTrailerAdminFolderVisibility(id, action === "hide")
                    return
                }
                if (action === "move") {
                    moveTrailerAdminSelected(type === "folder" ? {feature_ids: [], folder_paths: [id]} : {feature_ids: [id], folder_paths: []})
                    return
                }
                if (action === "delete") {
                    deleteTrailerAdminSelected(type === "folder" ? {feature_ids: [], folder_paths: [id]} : {feature_ids: [id], folder_paths: []})
                    return
                }
                if (action === "rename") {
                    showTrailerAdminTextDialog(type === "folder" ? "Rename Folder" : "Rename Item", type === "folder" ? "Folder path" : "Item name", id, "").then(value => {
                        if (value === null) return
                        runTrailerAdminAction(type === "folder" ? {action: "rename_folder", old_folder: id, new_folder: value} : {action: "rename_feature", feature_id: id, new_name: value})
                    })
                }
            }

            function toggleTrailerAdminFolderVisibility(folderPath, show) {
                if (!trailerPlacesVisibleFolders) {
                    trailerPlacesVisibleFolders = new Set(trailerAdminFolders())
                }
                const affectedFolders = trailerAdminFolders().filter(folder => folder === folderPath || folder.startsWith(folderPath + "/"))
                affectedFolders.forEach(folder => {
                    if (show) {
                        trailerPlacesVisibleFolders.add(folder)
                    } else {
                        trailerPlacesVisibleFolders.delete(folder)
                    }
                })
                updateTrailerPlacesSource()
                renderTrailerPlacesManager()
                const state = show ? "shown" : "hidden"
                setTrailerAdminStatus("Folder " + folderPath + " is now " + state + " on the map.")
                installTrailerPlacesFolderControl(trailerPlacesGeojson || {features: []})
            }

            function importTrailerAdminFile(event) {
                event.preventDefault()
                const form = event.currentTarget
                const data = new FormData(form)
                if (!data.get("import_file") || !data.get("import_file").name) {
                    setTrailerAdminStatus("Choose a GPX, GeoJSON/JSON, or KML file first.")
                    return
                }
                setTrailerAdminStatus("Importing...")
                fetch("/maps-import-places", {method: "POST", body: data})
                    .then(response => response.json().then(payload => ({ok: response.ok, data: payload})))
                    .then(result => {
                        if (!result.ok || !result.data.ok) throw new Error(result.data.error || "Import failed.")
                        form.reset()
                        afterTrailerAdminMutation(result.data)
                    })
                    .catch(error => setTrailerAdminStatus("Import failed: " + error.message))
            }

            function addTrailerAdminWaypoint(event) {
                event.preventDefault()
                const form = event.currentTarget
                const formData = new FormData(form)
                runTrailerAdminAction({
                    action: "add_place",
                    name: formData.get("name"),
                    folder: formData.get("folder"),
                    category: formData.get("category"),
                    icon: formData.get("icon"),
                    lat: formData.get("lat"),
                    lon: formData.get("lon"),
                    notes: formData.get("notes"),
                }).then(() => form.reset())
            }

            function useMapCenterForAdminWaypoint() {
                const form = trailerPlacesManagerModal.querySelector("[data-admin-add-waypoint-form]")
                const center = mb.map.getCenter()
                form.elements.lat.value = center.lat.toFixed(6)
                form.elements.lon.value = center.lng.toFixed(6)
                setTrailerAdminStatus("Map center copied into the waypoint form.")
            }

            function startTrailerMapWaypointMode() {
                trailerAddWaypointClickMode = true
                stopTrailerMapPoiPickMode()
                const button = document.getElementById("trailer-add-waypoint-mode")
                if (button) {
                    button.style.background = "#ffcc33"
                    button.style.color = "#071008"
                    button.setAttribute("aria-pressed", "true")
                }
                closeTrailerPlacesManager()
                showTrailerMapToast("Click the map where the new waypoint should go.")
            }

            function stopTrailerMapWaypointMode() {
                trailerAddWaypointClickMode = false
                const button = document.getElementById("trailer-add-waypoint-mode")
                if (button) {
                    button.style.background = "#fff"
                    button.style.color = "#222"
                    button.setAttribute("aria-pressed", "false")
                }
            }

            function startTrailerMapPoiPickMode() {
                trailerMapPoiPickMode = true
                stopTrailerMapWaypointMode()
                const button = document.getElementById("trailer-pick-map-poi")
                if (button) {
                    button.style.background = "#ffcc33"
                    button.style.color = "#071008"
                    button.setAttribute("aria-pressed", "true")
                }
                closeTrailerPlacesManager()
                showTrailerMapToast("Click a built-in map place to save it as a waypoint.")
            }

            function stopTrailerMapPoiPickMode() {
                trailerMapPoiPickMode = false
                const button = document.getElementById("trailer-pick-map-poi")
                if (button) {
                    button.style.background = "#fff"
                    button.style.color = "#222"
                    button.setAttribute("aria-pressed", "false")
                }
            }

            function renderedMapPoiName(feature) {
                const props = feature.properties || {}
                return String(props.name || props.name_en || props["name:en"] || props.ref || "").trim()
            }

            function renderedMapPoiCategory(feature) {
                const props = feature.properties || {}
                const text = [props.class, props.subclass, props.type, props.name].join(" ").toLowerCase()
                if (/restaurant|cafe|fast_food|bar|pub|food/.test(text)) return "food"
                if (/shop|supermarket|mall|marketplace|commercial|retail/.test(text)) return "store"
                if (/parking/.test(text)) return "parking"
                if (/fuel|gas/.test(text)) return "fuel"
                if (/hospital|clinic|doctors|dentist|pharmacy/.test(text)) return "medical"
                if (/library/.test(text)) return "library"
                if (/museum|gallery|monument|attraction|tourism/.test(text)) return "museum"
                if (/camp|caravan|rv/.test(text)) return "camp"
                if (/viewpoint|lookout|peak/.test(text)) return "lookout"
                if (/water|drinking_water|spring/.test(text)) return "water"
                if (/trail|path|hiking/.test(text)) return "trailhead"
                return "waypoint"
            }

            function renderedMapPoiLngLat(feature, fallbackLngLat) {
                const geometry = feature.geometry || {}
                if (geometry.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
                    return {lng: Number(geometry.coordinates[0]), lat: Number(geometry.coordinates[1])}
                }
                return fallbackLngLat
            }

            function renderedMapPoiNotes(feature) {
                const props = feature.properties || {}
                const pieces = ["Saved from built-in IIAB map POI."]
                if (props.class) pieces.push("Class: " + props.class + ".")
                if (props.subclass) pieces.push("Subclass: " + props.subclass + ".")
                if (feature.layer && feature.layer.id) pieces.push("Map layer: " + feature.layer.id + ".")
                return pieces.join(" ")
            }

            function queryRenderedMapPois(event) {
                const point = event.point
                const box = [[point.x - 18, point.y - 18], [point.x + 18, point.y + 18]]
                const features = mb.map.queryRenderedFeatures(box)
                const seen = new Set()
                return features
                    .filter(feature => {
                        const layerId = feature.layer && feature.layer.id ? feature.layer.id : ""
                        const sourceLayer = feature.sourceLayer || feature.sourceLayerId || ""
                        if (layerId.startsWith("trailer-")) return false
                        if (!/poi/i.test(layerId) && !/poi/i.test(sourceLayer)) return false
                        return renderedMapPoiName(feature).length > 1
                    })
                    .map(feature => {
                        const name = renderedMapPoiName(feature)
                        const props = feature.properties || {}
                        const key = [name, props.class || "", props.subclass || ""].join("|")
                        if (seen.has(key)) return null
                        seen.add(key)
                        return feature
                    })
                    .filter(Boolean)
                    .slice(0, 12)
            }

            function chooseRenderedMapPoi(event) {
                const pois = queryRenderedMapPois(event)
                if (!pois.length) {
                    showTrailerMapToast("No selectable map POI found there. Try zooming in or clicking directly on the label/icon.")
                    return
                }
                showTrailerAdminDialog({
                    title: "Save Map Place",
                    message: "Choose a built-in map place to copy into Trailer Places.",
                    bodyHtml: `
                        <div data-poi-list style="display:grid;gap:7px"></div>
                        <div style="display:flex;justify-content:flex-end;margin-top:12px">
                            <button type="button" data-dialog-cancel style="border:0;border-radius:999px;background:#e4ece4;padding:8px 12px;font-weight:900;cursor:pointer">Cancel</button>
                        </div>`,
                    setup: (panel, body, finish) => {
                        const list = panel.querySelector("[data-poi-list]")
                        pois.forEach((feature, index) => {
                            const props = feature.properties || {}
                            const category = renderedMapPoiCategory(feature)
                            const button = document.createElement("button")
                            button.type = "button"
                            button.style.cssText = "display:grid;grid-template-columns:28px 1fr;gap:8px;align-items:center;width:100%;text-align:left;border:1px solid #b8c7b8;border-radius:12px;background:#fff;padding:9px;cursor:pointer;color:#172016"
                            button.innerHTML = `
                                <span style="display:grid;place-items:center;color:#172016">${trailerPlaceBlackIconSvg(trailerPlaceCategoryIcon(category))}</span>
                                <span><strong>${trailerPlaceHtmlEscape(renderedMapPoiName(feature))}</strong><br><span style="color:#405542">${trailerPlaceHtmlEscape([props.class, props.subclass].filter(Boolean).join(" / ") || "map place")}</span></span>`
                            button.addEventListener("click", () => finish(index))
                            list.appendChild(button)
                        })
                        panel.querySelector("[data-dialog-cancel]").addEventListener("click", () => finish(null))
                    },
                }).then(index => {
                    if (index === null || !pois[index]) return
                    const feature = pois[index]
                    const category = renderedMapPoiCategory(feature)
                    const lngLat = renderedMapPoiLngLat(feature, event.lngLat)
                    openNewTrailerPlaceEditor(lngLat, {
                        name: renderedMapPoiName(feature),
                        category: category,
                        icon: trailerPlaceCategoryIcon(category),
                        folder: "Local Waypoints",
                        notes: renderedMapPoiNotes(feature),
                        status: "Copied from built-in map POI. Edit details and click Save.",
                    })
                })
            }

            function installTrailerPlacesFolderControl(geojson) {
                const folders = trailerPlaceFolders()
                if (trailerPlacesVisibleFolders === null) {
                    trailerPlacesVisibleFolders = new Set(folders)
                } else {
                    folders.forEach(folder => {
                        if (!trailerPlacesKnownFolders.has(folder)) {
                            trailerPlacesVisibleFolders.add(folder)
                        }
                    })
                }
                trailerPlacesKnownFolders = new Set(folders)
                if (trailerPlacesFolderControl) {
                    trailerPlacesFolderControl.remove()
                }
                if (trailerPlacesFolderPopover) {
                    trailerPlacesFolderPopover.remove()
                }
                trailerPlacesFolderControl = document.createElement("div")
                trailerPlacesFolderControl.className = "maplibregl-ctrl maplibregl-ctrl-group op-map-control"
                trailerPlacesFolderControl.innerHTML = `
                    <button id="trailer-folder-toggle" type="button" title="Show trailer folders" aria-label="Show trailer folders" aria-expanded="false" class="op-map-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path fill="currentColor" d="M3 5.5A2.5 2.5 0 0 1 5.5 3h4.2l2 2H18.5A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-11zm2.5-.5a.5.5 0 0 0-.5.5V7h14.8a.5.5 0 0 0-.5-.5h-8.4l-2-2H5.5zM5 9v7.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V9H5z"/>
                        </svg>
                    </button>
                    <button id="trailer-places-manage" type="button" title="Manage map data" aria-label="Manage map data" class="op-map-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path fill="currentColor" d="M4 5h6l2 2h8v3H4V5zm0 5h16v8.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5V10zm7 2v2H8v2h3v2h2v-2h3v-2h-3v-2h-2z"/>
                        </svg>
                    </button>
                    <button id="trailer-add-waypoint-mode" type="button" title="Click map to add waypoint" aria-label="Click map to add waypoint" class="op-map-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
                            <path fill="currentColor" d="M11 5h2v8h-2zM8 8h8v2H8z"/>
                        </svg>
                    </button>
                    <button id="trailer-pick-map-poi" type="button" title="Save a built-in map place" aria-label="Save a built-in map place" class="op-map-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
                            <path fill="currentColor" d="M17.5 3.5h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3z"/>
                        </svg>
                    </button>`
                trailerPlacesFolderPopover = document.createElement("div")
                trailerPlacesFolderPopover.id = "trailer-folder-popover"
                trailerPlacesFolderPopover.className = "op-folder-popover"
                trailerPlacesFolderPopover.innerHTML = "<strong>Trailer Folders</strong>"
                folders.forEach(folder => {
                    const label = document.createElement("label")
                    const checkbox = document.createElement("input")
                    checkbox.type = "checkbox"
                    checkbox.checked = trailerPlacesVisibleFolders.has(folder)
                    checkbox.style.marginRight = "6px"
                    checkbox.addEventListener("change", () => {
                        if (checkbox.checked) {
                            trailerPlacesVisibleFolders.add(folder)
                        } else {
                            trailerPlacesVisibleFolders.delete(folder)
                        }
                        updateTrailerPlacesSource()
                    })
                    label.appendChild(checkbox)
                    label.appendChild(document.createTextNode(folder))
                    trailerPlacesFolderPopover.appendChild(label)
                })
                document.body.appendChild(trailerPlacesFolderControl)
                document.body.appendChild(trailerPlacesFolderPopover)
                document.getElementById("trailer-folder-toggle").addEventListener("click", event => {
                    event.stopPropagation()
                    const open = trailerPlacesFolderPopover.style.display !== "block"
                    trailerPlacesFolderPopover.style.display = open ? "block" : "none"
                    event.currentTarget.setAttribute("aria-expanded", open ? "true" : "false")
                })
                document.getElementById("trailer-places-manage").addEventListener("click", event => {
                    event.stopPropagation()
                    openTrailerPlacesManager()
                })
                document.getElementById("trailer-add-waypoint-mode").addEventListener("click", event => {
                    event.stopPropagation()
                    startTrailerMapWaypointMode()
                })
                document.getElementById("trailer-pick-map-poi").addEventListener("click", event => {
                    event.stopPropagation()
                    startTrailerMapPoiPickMode()
                })
                if (!trailerPlacesFolderCloseHandlerInstalled) {
                    trailerPlacesFolderCloseHandlerInstalled = true
                    document.addEventListener("click", event => {
                        if (!trailerPlacesFolderPopover || !trailerPlacesFolderControl) {
                            return
                        }
                        if (trailerPlacesFolderPopover.contains(event.target) || trailerPlacesFolderControl.contains(event.target)) {
                            return
                        }
                        trailerPlacesFolderPopover.style.display = "none"
                        const button = document.getElementById("trailer-folder-toggle")
                        if (button) {
                            button.setAttribute("aria-expanded", "false")
                        }
                    })
                }
            }

            let trailerLocationControl = null
            let trailerLocationWatchId = null
            let trailerLocationMarker = null
            let trailerLocationAccuracy = null
            let trailerLastPosition = null
            let trailerActiveLocationSource = ""
            let trailerUsbGpsPollTimer = null
            let trailerUsbGpsValidUntil = 0
            let trailerFollowLocation = false
            let trailerBrowserFallbackStarted = false
            let trailerAutoTrackActive = false
            let trailerAutoTrackSlowSince = 0
            let trailerAutoTrackLastPostAt = 0
            let trailerAutoTrackLastPoint = null
            let trailerAutoTrackLastPlacesRefreshAt = 0
            let trailerLocationToastTimer = null
            const trailerRouteDraftKey = "trailerRouteDraftV1"
            let trailerRouteRecording = false
            let trailerRouteDraft = null
            let trailerRouteRecoveryBar = null
            let trailerFullscreenHandlerInstalled = false
            function installTrailerLocationControl() {
                if (!mb || !mb.map || trailerLocationControl) {
                    return
                }
                trailerLocationControl = document.createElement("div")
                trailerLocationControl.className = "maplibregl-ctrl maplibregl-ctrl-group op-location-control"
                trailerLocationControl.innerHTML = `
                    <button id="trailer-locate-button" type="button" title="Locate me" aria-label="Locate me" class="op-map-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path fill="currentColor" d="M12 2 5 21l7-4 7 4-7-19zm0 5.7 3.2 8.7-3.2-1.8-3.2 1.8L12 7.7z"/>
                        </svg>
                    </button>
                    <button id="trailer-save-waypoint-button" type="button" title="Save current location as waypoint" aria-label="Save waypoint" class="op-map-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
                            <path fill="currentColor" d="M11 5h2v8h-2zM8 8h8v2H8z"/>
                        </svg>
                    </button>
                    <button id="trailer-record-route-button" type="button" title="Record route from GPS" aria-label="Record route" class="op-map-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path fill="currentColor" d="M6 4a3 3 0 0 0-3 3c0 2.2 3 5.5 3 5.5S9 9.2 9 7a3 3 0 0 0-3-3zm0 4.2A1.2 1.2 0 1 1 6 5.8a1.2 1.2 0 0 1 0 2.4zM18 11.5a3 3 0 0 0-3 3c0 2.2 3 5.5 3 5.5s3-3.3 3-5.5a3 3 0 0 0-3-3zm0 4.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zM8.8 13.2l1.4-1.4 3.8 3.8-1.4 1.4-3.8-3.8z"/>
                        </svg>
                    </button>
                    <button id="trailer-fullscreen-button" type="button" title="Enter fullscreen" aria-label="Enter fullscreen" aria-pressed="false" class="op-map-button">
                        <svg data-fullscreen-enter viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path fill="currentColor" d="M4 4h7v2H7.4l4.1 4.1-1.4 1.4L6 7.4V11H4V4zm9 0h7v7h-2V7.4l-4.1 4.1-1.4-1.4L16.6 6H13V4zM4 13h2v3.6l4.1-4.1 1.4 1.4L7.4 18H11v2H4v-7zm14 0h2v7h-7v-2h3.6l-4.1-4.1 1.4-1.4 4.1 4.1V13z"/>
                        </svg>
                        <svg data-fullscreen-exit viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="display:none">
                            <path fill="currentColor" d="M9 3h2v7H4V8h3.6L3.5 3.9 4.9 2.5 9 6.6V3zm4 0h2v3.6l4.1-4.1 1.4 1.4L16.4 8H20v2h-7V3zM4 14h7v7H9v-3.6l-4.1 4.1-1.4-1.4L7.6 16H4v-2zm9 0h7v2h-3.6l4.1 4.1-1.4 1.4-4.1-4.1V21h-2v-7z"/>
                        </svg>
                    </button>`
                document.body.appendChild(trailerLocationControl)
                document.getElementById("trailer-locate-button").addEventListener("click", toggleTrailerLocation)
                document.getElementById("trailer-save-waypoint-button").addEventListener("click", saveQuickWaypoint)
                document.getElementById("trailer-record-route-button").addEventListener("click", toggleTrailerRouteRecording)
                document.getElementById("trailer-fullscreen-button").addEventListener("click", toggleTrailerFullscreen)
                installTrailerFullscreenListeners()
                updateTrailerFullscreenButton()
                recoverTrailerRouteDraft()
                startTrailerUsbGpsPolling()
            }

            function trailerFullscreenElement() {
                return document.fullscreenElement || document.webkitFullscreenElement || null
            }

            function trailerRequestFullscreen(element) {
                if (element.requestFullscreen) {
                    return element.requestFullscreen()
                }
                if (element.webkitRequestFullscreen) {
                    return element.webkitRequestFullscreen()
                }
                return Promise.reject(new Error("Fullscreen is not supported by this browser."))
            }

            function trailerExitFullscreen() {
                if (document.exitFullscreen) {
                    return document.exitFullscreen()
                }
                if (document.webkitExitFullscreen) {
                    return document.webkitExitFullscreen()
                }
                return Promise.reject(new Error("Fullscreen exit is not supported by this browser."))
            }

            function resizeTrailerMapAfterFullscreenChange() {
                setTimeout(() => {
                    try {
                        if (mb && mb.map) {
                            mb.map.resize()
                        }
                    } catch (_error) {
                        // The map will recover on its next normal render.
                    }
                }, 150)
            }

            function updateTrailerFullscreenButton() {
                const button = document.getElementById("trailer-fullscreen-button")
                if (!button) {
                    return
                }
                const active = !!trailerFullscreenElement()
                button.setAttribute("aria-pressed", active ? "true" : "false")
                button.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen")
                button.title = active ? "Exit fullscreen" : "Enter fullscreen"
                const enterIcon = button.querySelector("[data-fullscreen-enter]")
                const exitIcon = button.querySelector("[data-fullscreen-exit]")
                if (enterIcon && exitIcon) {
                    enterIcon.style.display = active ? "none" : ""
                    exitIcon.style.display = active ? "" : "none"
                }
                button.classList.toggle("op-map-button--active", active)
                resizeTrailerMapAfterFullscreenChange()
            }

            function installTrailerFullscreenListeners() {
                if (trailerFullscreenHandlerInstalled) {
                    return
                }
                trailerFullscreenHandlerInstalled = true
                document.addEventListener("fullscreenchange", updateTrailerFullscreenButton)
                document.addEventListener("webkitfullscreenchange", updateTrailerFullscreenButton)
                window.addEventListener("resize", resizeTrailerMapAfterFullscreenChange)
            }

            function toggleTrailerFullscreen() {
                const root = document.documentElement
                const promise = trailerFullscreenElement() ? trailerExitFullscreen() : trailerRequestFullscreen(root)
                promise
                    .then(updateTrailerFullscreenButton)
                    .catch(error => {
                        showTrailerMapToast(error && error.message ? error.message : "Fullscreen is not available in this browser.")
                    })
            }

            function showTrailerMapToast(message) {
                let toast = document.getElementById("trailer-map-toast")
                if (!toast) {
                    toast = document.createElement("div")
                    toast.id = "trailer-map-toast"
                    toast.className = "op-toast"
                    document.body.appendChild(toast)
                }
                toast.textContent = message
                toast.style.display = "block"
                clearTimeout(trailerLocationToastTimer)
                trailerLocationToastTimer = setTimeout(() => {
                    toast.style.display = "none"
                }, 3500)
            }

            function showTrailerLocationHelp(title, details) {
                let modal = document.getElementById("trailer-location-help")
                if (!modal) {
                    modal = document.createElement("div")
                    modal.id = "trailer-location-help"
                    modal.className = "op-location-help-modal"
                    modal.style.display = "none"
                    modal.innerHTML = `
                        <div class="op-location-help-panel">
                            <div style="display:flex;gap:16px;align-items:flex-start;justify-content:space-between">
                                <h2 id="trailer-location-help-title" style="margin:0 0 8px;font-size:21px">Location Help</h2>
                                <button id="trailer-location-help-close" type="button" class="op-close-button op-manager-close" aria-label="Close">&times;</button>
                            </div>
                            <p id="trailer-location-help-details" style="margin:8px 0 14px"></p>
                            <details open class="op-location-help-section">
                                <summary>iPhone / iPad</summary>
                                <p>Use the HTTPS map URL, trust the Trailer Pi certificate, then enable location for the browser app.</p>
                                <p>Settings -> Privacy & Security -> Location Services -> browser app -> While Using the App.</p>
                            </details>
                            <details class="op-location-help-section">
                                <summary>Android</summary>
                                <p>Use the HTTPS map URL, trust the Trailer Pi certificate if prompted, then allow Location for the browser.</p>
                                <p>Settings -> Apps -> browser app -> Permissions -> Location -> Allow while using.</p>
                            </details>
                            <details class="op-location-help-section">
                                <summary>macOS / Windows</summary>
                                <p>Use the HTTPS map URL, trust the Trailer Pi certificate, allow browser location permission, and make sure OS location services are enabled.</p>
                            </details>
                            <p style="margin:14px 0 0"><a href="/trailer-pi-ca.crt" download>Download Trailer Pi certificate</a></p>
                            <p style="margin:8px 0 0">Maps URL: <code>https://192.168.8.2/maps/</code></p>
                        </div>`
                    document.body.appendChild(modal)
                    document.getElementById("trailer-location-help-close").addEventListener("click", () => {
                        modal.style.display = "none"
                    })
                    modal.addEventListener("click", event => {
                        if (event.target === modal) {
                            modal.style.display = "none"
                        }
                    })
                }
                document.getElementById("trailer-location-help-title").textContent = title
                document.getElementById("trailer-location-help-details").textContent = details
                modal.style.display = "flex"
            }

            function setTrailerLocationStatus(message, options={}) {
                const locateButton = document.getElementById("trailer-locate-button")
                if (locateButton) {
                    locateButton.title = message
                }
                if (options.modal) {
                    showTrailerLocationHelp(options.title || "Location is not available", message)
                } else if (options.toast) {
                    showTrailerMapToast(message)
                }
            }

            function setTrailerLocationButton(active) {
                const button = document.getElementById("trailer-locate-button")
                if (button) {
                    button.style.background = active ? "#3aa7ff" : "#fff"
                    button.style.color = active ? "#fff" : "#222"
                    button.setAttribute("aria-pressed", active ? "true" : "false")
                }
            }

            function trailerGpsStatusLabel(location) {
                if (!location) return "No location"
                const source = location.source === "usb_gps" ? "USB GPS" : "Browser GPS"
                const parts = [source]
                if (location.stabilization_mode) parts.push(String(location.stabilization_mode).replace(/_/g, " "))
                if (location.stationary) parts.push("stationary")
                if (location.fix_mode) parts.push("fix " + location.fix_mode)
                if (location.satellites_used !== undefined && location.satellites_used !== null) {
                    parts.push(String(location.satellites_used) + "/" + String(location.satellites_visible || "?") + " sats")
                }
                if (location.accuracy_m !== undefined && location.accuracy_m !== null) {
                    parts.push(Math.round(location.accuracy_m) + "m")
                }
                if (location.speed_mph !== undefined && location.speed_mph !== null) {
                    parts.push(Number(location.speed_mph).toFixed(1) + " mph")
                }
                return parts.join(" · ")
            }

            function positionFromGpsStatus(data) {
                const stable = data.stable || data
                const raw = data.raw || null
                const timestamp = stable.timestamp ? Date.parse(stable.timestamp) : data.timestamp ? Date.parse(data.timestamp) : Date.now()
                const accuracy = Number(stable.accuracy_m || data.accuracy_m || 0)
                return {
                    source: data.active_source || data.source || stable.source || "usb_gps",
                    fixMode: stable.fix_mode || data.fix_mode || 0,
                    satellitesUsed: stable.satellites_used,
                    satellitesVisible: stable.satellites_visible,
                    hdop: stable.hdop,
                    ageSeconds: Number(stable.age_seconds || data.age_seconds || 0),
                    rawLocation: raw,
                    stableLocation: stable,
                    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
                    coords: {
                        latitude: Number(stable.lat),
                        longitude: Number(stable.lon),
                        altitude: stable.alt_m,
                        accuracy: accuracy,
                        speed: stable.speed_mps,
                        heading: stable.heading_deg,
                    },
                }
            }

            function positionFromBrowser(position) {
                const coords = position.coords || {}
                const timestamp = position.timestamp || Date.now()
                const speedMps = typeof coords.speed === "number" && Number.isFinite(coords.speed) ? coords.speed : 0
                const point = {
                    source: "browser",
                    lat: coords.latitude,
                    lon: coords.longitude,
                    alt_m: typeof coords.altitude === "number" && Number.isFinite(coords.altitude) ? coords.altitude : null,
                    speed_mps: speedMps,
                    speed_mph: speedMps * 2.2369362921,
                    heading_deg: typeof coords.heading === "number" && Number.isFinite(coords.heading) ? coords.heading : null,
                    accuracy_m: typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy) ? coords.accuracy : null,
                    hdop: null,
                    timestamp: new Date(timestamp).toISOString(),
                    age_seconds: Math.max(0, (Date.now() - timestamp) / 1000),
                    stationary: speedMps * 2.2369362921 < 2,
                    stabilized: false,
                    stabilization_mode: "browser_raw",
                    distance_from_raw_m: 0,
                }
                return {coords: position.coords, timestamp: timestamp, source: "browser", rawLocation: point, stableLocation: point}
            }

            function locationSnapshotFromPosition(position) {
                const coords = position.coords || {}
                const timestamp = position.timestamp || Date.now()
                const source = position.source || "browser"
                const stable = position.stableLocation || {}
                const raw = position.rawLocation || null
                const speedMps = typeof coords.speed === "number" && Number.isFinite(coords.speed) ? coords.speed : 0
                return {
                    source: source,
                    lat: coords.latitude,
                    lon: coords.longitude,
                    timestamp: new Date(timestamp).toISOString(),
                    age_seconds: Math.max(0, (Date.now() - timestamp) / 1000),
                    speed_mps: speedMps,
                    speed_mph: speedMps * 2.2369362921,
                    heading_deg: typeof coords.heading === "number" && Number.isFinite(coords.heading) ? coords.heading : null,
                    accuracy_m: typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy) ? coords.accuracy : null,
                    hdop: position.hdop,
                    fix_mode: position.fixMode,
                    satellites_used: position.satellitesUsed,
                    satellites_visible: position.satellitesVisible,
                    stationary: !!stable.stationary,
                    stabilized: !!stable.stabilized,
                    stabilization_mode: stable.stabilization_mode || "",
                    distance_from_raw_m: stable.distance_from_raw_m,
                    raw_lat: raw && Number.isFinite(Number(raw.lat)) ? Number(raw.lat) : null,
                    raw_lon: raw && Number.isFinite(Number(raw.lon)) ? Number(raw.lon) : null,
                    raw_accuracy_m: raw && Number.isFinite(Number(raw.accuracy_m)) ? Number(raw.accuracy_m) : null,
                    raw_hdop: raw && Number.isFinite(Number(raw.hdop)) ? Number(raw.hdop) : null,
                }
            }

            function startTrailerUsbGpsPolling() {
                if (trailerUsbGpsPollTimer) return
                pollTrailerUsbGps()
                trailerUsbGpsPollTimer = window.setInterval(pollTrailerUsbGps, 1000)
            }

            function pollTrailerUsbGps() {
                fetch("/maps-location-current", {cache: "no-store"})
                    .then(response => response.ok ? response.json() : Promise.reject(new Error("GPS status " + response.status)))
                    .then(data => {
                        if (data && data.valid && typeof data.lat === "number" && typeof data.lon === "number") {
                            trailerUsbGpsValidUntil = Date.now() + 3500
                            const position = positionFromGpsStatus(data)
                            updateTrailerLocation(position, {source: "usb_gps", follow: trailerFollowLocation, silent: true})
                        } else if (Date.now() > trailerUsbGpsValidUntil && !trailerBrowserFallbackStarted) {
                            ensureTrailerBrowserLocationWatch({fallback: true})
                        }
                    })
                    .catch(() => {
                        if (Date.now() > trailerUsbGpsValidUntil && !trailerBrowserFallbackStarted) {
                            ensureTrailerBrowserLocationWatch({fallback: true})
                        }
                    })
            }

            function ensureTrailerBrowserLocationWatch(options = {}) {
                if (trailerLocationWatchId !== null) {
                    return true
                }
                if (!("geolocation" in navigator)) {
                    if (!options.fallback) {
                        setTrailerLocationStatus("This browser does not support location.", {modal: true, title: "Location is not supported"})
                    }
                    return false
                }
                if (!window.isSecureContext) {
                    if (!options.fallback) {
                        redirectToTrustedHttpsForLocation()
                    }
                    return false
                }
                trailerBrowserFallbackStarted = true
                if (!options.fallback) {
                    setTrailerLocationStatus("Requesting location permission...", {toast: true})
                }
                trailerLocationWatchId = navigator.geolocation.watchPosition(
                    position => {
                        if (Date.now() <= trailerUsbGpsValidUntil) {
                            return
                        }
                        updateTrailerLocation(positionFromBrowser(position), {source: "browser", follow: trailerFollowLocation})
                    },
                    error => {
                        trailerLocationWatchId = null
                        trailerBrowserFallbackStarted = false
                        if (Date.now() > trailerUsbGpsValidUntil) {
                            setTrailerLocationButton(false)
                        }
                        if (options.fallback) {
                            return
                        }
                        const details = trailerLocationErrorMessage(error)
                        setTrailerLocationStatus(details.message, {modal: true, title: details.title})
                    },
                    {enableHighAccuracy: true, maximumAge: 5000, timeout: 15000}
                )
                return true
            }

            function mapPathForTrustedHttps() {
                return "/maps/" + (window.location.search || "") + (window.location.hash || "")
            }

            async function redirectToTrustedHttpsForLocation() {
                if (window.isSecureContext) {
                    return false
                }
                setTrailerLocationStatus("Checking trusted HTTPS configuration...", {toast: true})
                try {
                    const response = await fetch("/overland-https-admin", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({action: "status"}),
                    })
                    const data = await response.json()
                    const host = data && data.config && data.config.OVERLAND_MAPS_HOST
                    if (data.ok && data.trustedSiteEnabled && data.certificate && data.certificate.ok && host) {
                        window.location.href = "https://" + host + mapPathForTrustedHttps()
                        return true
                    }
                    setTrailerLocationStatus(
                        "Location requires HTTPS. Trusted HTTPS is not fully configured yet, so use the Settings gear -> Trusted HTTPS section first.",
                        {modal: true, title: "Location requires HTTPS"}
                    )
                } catch (error) {
                    setTrailerLocationStatus(
                        "Location requires HTTPS, but the trusted HTTPS status could not be checked: " + (error && error.message ? error.message : "unknown error"),
                        {modal: true, title: "Location requires HTTPS"}
                    )
                }
                return false
            }

            async function toggleTrailerLocation() {
                if (trailerFollowLocation) {
                    trailerFollowLocation = false
                    setTrailerLocationButton(false)
                    setTrailerLocationStatus("Map follow stopped. Location marker remains active when a source is available.", {toast: true})
                    return
                }
                trailerFollowLocation = true
                setTrailerLocationButton(true)
                if (Date.now() <= trailerUsbGpsValidUntil && trailerLastPosition) {
                    updateTrailerLocation(trailerLastPosition, {follow: true})
                    setTrailerLocationStatus("Following USB GPS.", {toast: true})
                    return
                }
                if (!ensureTrailerBrowserLocationWatch()) {
                    trailerFollowLocation = false
                    setTrailerLocationButton(false)
                }
            }

            function trailerLocationErrorMessage(error) {
                if (error.code === error.PERMISSION_DENIED) {
                    return {
                        title: "Location permission was denied",
                        message: "Location was denied by the browser or operating system. Enable Location Services for this browser/app, then reload the map and try again.",
                    }
                }
                if (error.code === error.POSITION_UNAVAILABLE) {
                    return {
                        title: "Location is unavailable",
                        message: "Location is unavailable. Check device Location Services, WiFi/GPS availability, and browser app permission.",
                    }
                }
                if (error.code === error.TIMEOUT) {
                    return {
                        title: "Location timed out",
                        message: "Location request timed out. Try again outdoors/near a window or disable low-power/location restrictions.",
                    }
                }
                return {
                    title: "Location error",
                    message: "Location unavailable: " + (error && error.message ? error.message : "Unknown error"),
                }
            }

            function requestTrailerCurrentLocation() {
                if (trailerLastPosition && trailerActiveLocationSource === "usb_gps" && Date.now() <= trailerUsbGpsValidUntil) {
                    return Promise.resolve(trailerLastPosition)
                }
                if (!("geolocation" in navigator)) {
                    setTrailerLocationStatus("This browser does not support location.", {modal: true, title: "Location is not supported"})
                    return Promise.reject(new Error("Location is not supported"))
                }
                if (!window.isSecureContext) {
                    redirectToTrustedHttpsForLocation()
                    return Promise.reject(new Error("Location requires HTTPS"))
                }
                setTrailerLocationStatus("Requesting current location...", {toast: true})
                setTrailerLocationButton(true)
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        position => {
                            updateTrailerLocation(positionFromBrowser(position), {source: "browser", follow: trailerFollowLocation})
                            resolve(position)
                        },
                        error => {
                            const details = trailerLocationErrorMessage(error)
                            setTrailerLocationButton(false)
                            setTrailerLocationStatus(details.message, {modal: true, title: details.title})
                            reject(error)
                        },
                        {enableHighAccuracy: true, maximumAge: 5000, timeout: 15000}
                    )
                })
            }

            function updateTrailerLocation(position, options = {}) {
                trailerLastPosition = position
                trailerActiveLocationSource = options.source || position.source || "browser"
                const lon = position.coords.longitude
                const lat = position.coords.latitude
                const accuracy = position.coords.accuracy || 0
                const snapshot = locationSnapshotFromPosition(position)
                const point = {
                    type: "Feature",
                    geometry: {type: "Point", coordinates: [lon, lat]},
                    properties: {
                        accuracy: accuracy,
                        source: trailerActiveLocationSource,
                        heading: snapshot.heading_deg,
                        speed_mph: snapshot.speed_mph,
                    },
                }
                const circle = {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [accuracyCircle(lon, lat, accuracy)],
                    },
                    properties: {},
                }
                if (!mb.map.getSource("trailer-current-location")) {
                    mb.map.addSource("trailer-current-location", {type: "geojson", data: point})
                    mb.map.addLayer({
                        id: "trailer-current-location-dot",
                        type: "circle",
                        source: "trailer-current-location",
                        paint: {
                            "circle-radius": 8,
                            "circle-color": "#3aa7ff",
                            "circle-stroke-color": "#ffffff",
                            "circle-stroke-width": 3,
                        },
                    })
                    mb.map.addLayer({
                        id: "trailer-current-location-heading",
                        type: "symbol",
                        source: "trailer-current-location",
                        layout: {
                            "text-field": "▲",
                            "text-size": 16,
                            "text-rotate": ["coalesce", ["get", "heading"], 0],
                            "text-allow-overlap": true,
                            "text-ignore-placement": true,
                            "text-offset": [0, -1.1],
                        },
                        paint: {
                            "text-color": "#ffffff",
                            "text-halo-color": "#1f7ac5",
                            "text-halo-width": 1.5,
                        },
                    })
                } else {
                    mb.map.getSource("trailer-current-location").setData(point)
                }
                if (!mb.map.getSource("trailer-current-location-accuracy")) {
                    mb.map.addSource("trailer-current-location-accuracy", {type: "geojson", data: circle})
                    mb.map.addLayer({
                        id: "trailer-current-location-accuracy-fill",
                        type: "fill",
                        source: "trailer-current-location-accuracy",
                        paint: {"fill-color": "#3aa7ff", "fill-opacity": 0.18},
                    })
                } else {
                    mb.map.getSource("trailer-current-location-accuracy").setData(circle)
                }
                if (options.follow || trailerFollowLocation) {
                    mb.map.flyTo({center: [lon, lat], zoom: Math.max(mb.map.getZoom(), 13), essential: true})
                }
                const status = `Located: ${lat.toFixed(5)}, ${lon.toFixed(5)} (${trailerGpsStatusLabel(snapshot)})`
                setTrailerLocationStatus(status, options.toast ? {toast: true} : {})
                recordTrailerRoutePoint(position)
                maybeRecordTrailerAutoTrack(position)
            }

            function trailerRouteDefaultName(startedAt) {
                return "Route " + new Date(startedAt || Date.now()).toLocaleString()
            }

            function loadTrailerRouteDraft() {
                try {
                    return JSON.parse(localStorage.getItem(trailerRouteDraftKey) || "null")
                } catch (error) {
                    return null
                }
            }

            function saveTrailerRouteDraft() {
                if (trailerRouteDraft) {
                    localStorage.setItem(trailerRouteDraftKey, JSON.stringify(trailerRouteDraft))
                }
            }

            function clearTrailerRouteDraft() {
                trailerRouteDraft = null
                localStorage.removeItem(trailerRouteDraftKey)
                updateTrailerRouteLine()
                hideTrailerRouteRecoveryBar()
            }

            function setTrailerRouteButton(active) {
                const button = document.getElementById("trailer-record-route-button")
                if (!button) return
                button.style.background = active ? "#ff7b72" : "#fff"
                button.style.color = active ? "#fff" : "#222"
                button.setAttribute("aria-pressed", active ? "true" : "false")
                button.title = active ? "Stop and save route" : "Record route from GPS"
            }

            function recoverTrailerRouteDraft() {
                const draft = loadTrailerRouteDraft()
                if (!draft || !Array.isArray(draft.points) || draft.points.length < 2) {
                    hideTrailerRouteRecoveryBar()
                    return
                }
                trailerRouteDraft = draft
                updateTrailerRouteLine()
                showTrailerRouteRecoveryBar()
            }

            function showTrailerRouteRecoveryBar() {
                const draft = trailerRouteDraft || loadTrailerRouteDraft()
                if (!draft || !Array.isArray(draft.points) || draft.points.length < 2) {
                    hideTrailerRouteRecoveryBar()
                    return
                }
                if (!trailerRouteRecoveryBar) {
                    trailerRouteRecoveryBar = document.createElement("div")
                    trailerRouteRecoveryBar.id = "trailer-route-recovery"
                    trailerRouteRecoveryBar.className = "op-route-recovery"
                    trailerRouteRecoveryBar.innerHTML = `
                        <div class="op-route-recovery-row">
                            <div>
                                <strong>Unsaved Route</strong>
                                <div data-route-recovery-detail style="margin-top:2px;color:#d8eadb"></div>
                            </div>
                            <div class="op-route-recovery-actions">
                                <button type="button" data-route-continue class="op-button">Continue</button>
                                <button type="button" data-route-save class="op-button op-button--info">Save</button>
                                <button type="button" data-route-delete class="op-button op-button--danger">Delete</button>
                            </div>
                        </div>`
                    document.body.appendChild(trailerRouteRecoveryBar)
                    trailerRouteRecoveryBar.querySelector("[data-route-continue]").addEventListener("click", continueTrailerRecoveredRoute)
                    trailerRouteRecoveryBar.querySelector("[data-route-save]").addEventListener("click", saveTrailerRecordedRoute)
                    trailerRouteRecoveryBar.querySelector("[data-route-delete]").addEventListener("click", deleteTrailerRecoveredRoute)
                }
                trailerRouteRecoveryBar.querySelector("[data-route-recovery-detail]").textContent = draft.points.length + " point(s), last updated " + new Date(draft.updated_at || draft.started_at || Date.now()).toLocaleString()
                trailerRouteRecoveryBar.style.display = "block"
            }

            function hideTrailerRouteRecoveryBar() {
                if (trailerRouteRecoveryBar) {
                    trailerRouteRecoveryBar.style.display = "none"
                }
            }

            function continueTrailerRecoveredRoute() {
                const draft = loadTrailerRouteDraft()
                if (!draft || !Array.isArray(draft.points) || draft.points.length < 2) {
                    hideTrailerRouteRecoveryBar()
                    return
                }
                trailerRouteDraft = draft
                trailerRouteRecording = true
                setTrailerRouteButton(true)
                hideTrailerRouteRecoveryBar()
                updateTrailerRouteLine()
                if (trailerLocationWatchId === null) {
                    toggleTrailerLocation()
                }
                setTrailerLocationStatus("Route recording continued.", {toast: true})
            }

            function deleteTrailerRecoveredRoute() {
                if (!window.confirm("Delete the unsaved route draft?")) {
                    return
                }
                trailerRouteRecording = false
                setTrailerRouteButton(false)
                clearTrailerRouteDraft()
                setTrailerLocationStatus("Unsaved route draft deleted.", {toast: true})
            }

            function toggleTrailerRouteRecording() {
                if (trailerRouteRecording) {
                    trailerRouteRecording = false
                    setTrailerRouteButton(false)
                    saveTrailerRecordedRoute()
                    return
                }
                const existing = loadTrailerRouteDraft()
                if (existing && Array.isArray(existing.points) && existing.points.length >= 2) {
                    trailerRouteDraft = existing
                    updateTrailerRouteLine()
                    showTrailerRouteRecoveryBar()
                    setTrailerLocationStatus("Use the unsaved route bar to continue, save, or delete the draft.", {toast: true})
                    return
                }
                if (!trailerRouteDraft) {
                    const startedAt = new Date().toISOString()
                    trailerRouteDraft = {
                        name: trailerRouteDefaultName(startedAt),
                        folder: "Quick Save",
                        started_at: startedAt,
                        updated_at: startedAt,
                        points: [],
                    }
                    saveTrailerRouteDraft()
                }
                trailerRouteRecording = true
                setTrailerRouteButton(true)
                hideTrailerRouteRecoveryBar()
                if (trailerLocationWatchId === null) {
                    toggleTrailerLocation()
                }
                setTrailerLocationStatus("Route recording started. Points are saved locally as you travel.", {toast: true})
            }

            function distanceMeters(a, b) {
                const earthRadius = 6371000
                const lat1 = a[1] * Math.PI / 180
                const lat2 = b[1] * Math.PI / 180
                const dLat = (b[1] - a[1]) * Math.PI / 180
                const dLon = (b[0] - a[0]) * Math.PI / 180
                const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
                return 2 * earthRadius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
            }

            function recordTrailerRoutePoint(position) {
                if (!trailerRouteRecording || !trailerRouteDraft) {
                    return
                }
                const point = [position.coords.longitude, position.coords.latitude]
                const now = Date.now()
                const last = trailerRouteDraft.points[trailerRouteDraft.points.length - 1]
                if (last) {
                    const elapsed = now - (last.t || 0)
                    const moved = distanceMeters([last.lon, last.lat], point)
                    if (elapsed < 3000 || moved < 10) {
                        return
                    }
                }
                trailerRouteDraft.points.push({
                    lon: point[0],
                    lat: point[1],
                    t: now,
                    accuracy: Math.round(position.coords.accuracy || 0),
                })
                trailerRouteDraft.updated_at = new Date(now).toISOString()
                saveTrailerRouteDraft()
                updateTrailerRouteLine()
                if (!trailerRouteRecording) {
                    showTrailerRouteRecoveryBar()
                }
            }

            function maybeRecordTrailerAutoTrack(position) {
                const snapshot = locationSnapshotFromPosition(position)
                if (!Number.isFinite(snapshot.lat) || !Number.isFinite(snapshot.lon)) {
                    return
                }
                const maxAge = snapshot.source === "usb_gps" ? 5 : 15
                if (snapshot.age_seconds > maxAge) {
                    return
                }
                if (snapshot.accuracy_m !== null && snapshot.accuracy_m > 100) {
                    return
                }
                const speed = Number(snapshot.speed_mph || 0)
                const now = Date.now()
                if (snapshot.stationary || speed <= 2) {
                    if (trailerAutoTrackActive && !trailerAutoTrackSlowSince) {
                        trailerAutoTrackSlowSince = now
                    }
                    if (trailerAutoTrackActive && trailerAutoTrackSlowSince && now - trailerAutoTrackSlowSince > 30000) {
                        trailerAutoTrackActive = false
                        trailerAutoTrackSlowSince = 0
                        fetch("/maps-track-stop", {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({reason: "speed_below_threshold"}),
                        })
                            .then(() => refreshTrailerPlaces())
                            .catch(() => {})
                    }
                    return
                }
                trailerAutoTrackSlowSince = 0
                if (now - trailerAutoTrackLastPostAt < 1000) {
                    return
                }
                if (trailerAutoTrackLastPoint) {
                    const moved = distanceMeters([trailerAutoTrackLastPoint.lon, trailerAutoTrackLastPoint.lat], [snapshot.lon, snapshot.lat])
                    if (moved < 10 && speed < 3) {
                        return
                    }
                }
                trailerAutoTrackLastPostAt = now
                trailerAutoTrackLastPoint = {lon: snapshot.lon, lat: snapshot.lat}
                trailerAutoTrackActive = true
                fetch("/maps-track-point", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        lat: String(snapshot.lat),
                        lon: String(snapshot.lon),
                        source: snapshot.source,
                        timestamp: snapshot.timestamp,
                        age_seconds: String(snapshot.age_seconds),
                        speed_mph: String(speed),
                        heading_deg: snapshot.heading_deg === null ? "" : String(snapshot.heading_deg),
                        accuracy_m: snapshot.accuracy_m === null ? "" : String(snapshot.accuracy_m),
                        hdop: snapshot.hdop === undefined || snapshot.hdop === null ? "" : String(snapshot.hdop),
                        raw_lat: snapshot.raw_lat === null ? "" : String(snapshot.raw_lat),
                        raw_lon: snapshot.raw_lon === null ? "" : String(snapshot.raw_lon),
                        raw_accuracy_m: snapshot.raw_accuracy_m === null ? "" : String(snapshot.raw_accuracy_m),
                        raw_hdop: snapshot.raw_hdop === null ? "" : String(snapshot.raw_hdop),
                        stabilized: snapshot.stabilized ? "true" : "false",
                        stationary: snapshot.stationary ? "true" : "false",
                        stabilization_mode: snapshot.stabilization_mode || "",
                    }),
                })
                    .then(response => response.ok ? response.json() : null)
                    .then(result => {
                        if (!result || !result.recorded) return
                        if (now - trailerAutoTrackLastPlacesRefreshAt < 5000) return
                        trailerAutoTrackLastPlacesRefreshAt = now
                        return refreshTrailerPlaces()
                    })
                    .catch(() => {})
            }

            function trailerRouteGeojson() {
                const coords = trailerRouteDraft && trailerRouteDraft.points ? trailerRouteDraft.points.map(point => [point.lon, point.lat]) : []
                return {
                    type: "Feature",
                    geometry: {type: "LineString", coordinates: coords},
                    properties: {},
                }
            }

            function updateTrailerRouteLine() {
                if (!mb || !mb.map) return
                const data = trailerRouteGeojson()
                if (!mb.map.getSource("trailer-route-draft")) {
                    mb.map.addSource("trailer-route-draft", {type: "geojson", data: data})
                    mb.map.addLayer({
                        id: "trailer-route-draft-line",
                        type: "line",
                        source: "trailer-route-draft",
                        paint: {
                            "line-color": "#ff3355",
                            "line-width": 4,
                            "line-opacity": 0.9,
                        },
                    })
                } else {
                    mb.map.getSource("trailer-route-draft").setData(data)
                }
            }

            function saveTrailerRecordedRoute() {
                const draft = trailerRouteDraft || loadTrailerRouteDraft()
                if (!draft || !Array.isArray(draft.points) || draft.points.length < 2) {
                    setTrailerLocationStatus("Route was not saved because it has fewer than two points.", {toast: true})
                    return
                }
                const name = window.prompt("Route name:", draft.name || trailerRouteDefaultName(draft.started_at))
                if (name === null) return
                const coords = draft.points.map(point => [point.lon, point.lat])
                const meters = coords.reduce((sum, point, index) => index ? sum + distanceMeters(coords[index - 1], point) : 0, 0)
                const notes = "Recorded from browser GPS. Points: " + coords.length + ". Approx distance: " + Math.round(meters) + " m. Started: " + (draft.started_at || "") + "."
                trailerPlaceApiJson("/maps-manage-places", {
                    action: "add_route",
                    name: name.trim() || trailerRouteDefaultName(draft.started_at),
                    folder: "Quick Save",
                    notes: notes,
                    coordinates: coords,
                })
                    .then(result => {
                        clearTrailerRouteDraft()
                        trailerRouteRecording = false
                        setTrailerRouteButton(false)
                        setTrailerLocationStatus(result.message || "Saved route to Quick Save.", {toast: true})
                        return refreshTrailerPlaces()
                    })
                    .catch(error => setTrailerLocationStatus("Route save failed: " + error.message, {modal: true, title: "Route save failed"}))
            }

            function saveQuickWaypoint() {
                if (!trailerLastPosition) {
                    requestTrailerCurrentLocation()
                        .then(() => saveQuickWaypoint())
                        .catch(() => {})
                    return
                }
                const name = window.prompt("Waypoint name:", "Waypoint " + new Date().toLocaleString())
                if (name === null) {
                    return
                }
                const trimmedName = name.trim()
                if (!trimmedName) {
                    setTrailerLocationStatus("Waypoint was not saved because no name was entered.", {toast: true})
                    return
                }
                const lat = trailerLastPosition.coords.latitude
                const lon = trailerLastPosition.coords.longitude
                const accuracy = Math.round(trailerLastPosition.coords.accuracy || 0)
                const snapshot = locationSnapshotFromPosition(trailerLastPosition)
                const sourceLabel = snapshot.source === "usb_gps" ? "USB GPS" : "browser location"
                setTrailerLocationStatus("Saving waypoint...", {toast: true})
                fetch("/maps-quick-save", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        name: trimmedName,
                        folder: "Quick Save",
                        category: "quick-save",
                        lat: String(lat),
                        lon: String(lon),
                        notes: "Quick saved from IIAB Maps using " + sourceLabel + ". Accuracy: " + accuracy + "m. Timestamp: " + snapshot.timestamp + ".",
                        source: snapshot.source,
                        accuracy_m: snapshot.accuracy_m === null ? "" : String(snapshot.accuracy_m),
                        hdop: snapshot.hdop === undefined || snapshot.hdop === null ? "" : String(snapshot.hdop),
                        speed_mph: String(snapshot.speed_mph || 0),
                        heading_deg: snapshot.heading_deg === null ? "" : String(snapshot.heading_deg),
                        raw_lat: snapshot.raw_lat === null ? "" : String(snapshot.raw_lat),
                        raw_lon: snapshot.raw_lon === null ? "" : String(snapshot.raw_lon),
                        raw_accuracy_m: snapshot.raw_accuracy_m === null ? "" : String(snapshot.raw_accuracy_m),
                        raw_hdop: snapshot.raw_hdop === null ? "" : String(snapshot.raw_hdop),
                        stabilized: snapshot.stabilized ? "true" : "false",
                        stationary: snapshot.stationary ? "true" : "false",
                        stabilization_mode: snapshot.stabilization_mode || "",
                        location_timestamp: snapshot.timestamp,
                    }),
                })
                    .then(response => response.json().then(data => ({ok: response.ok, data: data})))
                    .then(result => {
                        if (!result.ok || !result.data.ok) {
                            throw new Error(result.data.error || "Save failed.")
                        }
                        setTrailerLocationStatus("Saved waypoint to Quick Save.", {toast: true})
                        return refreshTrailerPlaces()
                    })
                    .catch(error => {
                        setTrailerLocationStatus("Waypoint save failed: " + error.message, {modal: true, title: "Waypoint save failed"})
                    })
            }

            function refreshTrailerPlaces() {
                return fetchTrailerPlacesSnapshotJson()
                    .then(geojson => {
                        if (!geojson || !geojson.features) {
                            return
                        }
                        trailerPlacesGeojson = geojson
                        installTrailerPlacesFolderControl(geojson)
                        if (mb.map.getSource("trailer-places")) {
                            updateTrailerPlacesSource()
                        } else {
                            showTrailerPlaces()
                        }
                    })
            }

            if (!window.trailerPlaceFolderDelegatesInstalled) {
                window.trailerPlaceFolderDelegatesInstalled = true
                document.addEventListener("click", event => {
                    const changeButton = event.target.closest("[data-change-folder]")
                    if (changeButton) {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleTrailerPlaceFolderPicker(changeButton.closest("form"))
                        return
                    }
                    const useTypedButton = event.target.closest("[data-use-typed-folder]")
                    if (useTypedButton) {
                        event.preventDefault()
                        event.stopPropagation()
                        useTypedTrailerPlaceFolder(useTypedButton.closest("form"))
                    }
                    const saveButton = event.target.closest("[data-save-waypoint]")
                    if (saveButton) {
                        event.preventDefault()
                        event.stopPropagation()
                        const form = saveButton.closest("form")
                        saveTrailerPlaceEdit(form.elements._feature_id.value, form.id)
                    }
                })
                document.addEventListener("pointerup", event => {
                    const saveButton = event.target.closest("[data-save-waypoint]")
                    if (!saveButton) {
                        return
                    }
                    event.preventDefault()
                    event.stopPropagation()
                    const form = saveButton.closest("form")
                    saveTrailerPlaceEdit(form.elements._feature_id.value, form.id)
                })
                document.addEventListener("input", event => {
                    const folderSearch = event.target.closest("[data-folder-search]")
                    if (!folderSearch) {
                        return
                    }
                    renderTrailerFolderChoices(folderSearch.closest("form").id)
                })
            }

            function accuracyCircle(lon, lat, radiusMeters) {
                const points = []
                const steps = 64
                const earthRadius = 6378137
                const latRad = lat * Math.PI / 180
                for (let index = 0; index <= steps; index++) {
                    const angle = 2 * Math.PI * index / steps
                    const dx = radiusMeters * Math.cos(angle)
                    const dy = radiusMeters * Math.sin(angle)
                    points.push([
                        lon + (dx / (earthRadius * Math.cos(latRad))) * 180 / Math.PI,
                        lat + (dy / earthRadius) * 180 / Math.PI,
                    ])
                }
                return points
            }

            function showTrailerPlaces() {
                clearTimeout(showTrailerPlacesTimeout)

                const styleLoaded = (mb && mb.map && mb.map.style && mb.map.style.loaded());
                if (!styleLoaded) {
                    showTrailerPlacesTimeout = setTimeout(showTrailerPlaces, 300)
                    return
                }
                installTrailerPlaceClickHandler()
                installTrailerLocationControl()
                installTrailerMissingImageFallback()
                if (mb.map.getSource("trailer-places")) {
                    return
                }

                fetchTrailerPlacesSnapshotJson()
                    .then(geojson => {
                        if (!geojson || !geojson.features || geojson.features.length === 0 || mb.map.getSource("trailer-places")) {
                            return
                        }
                        trailerPlacesGeojson = geojson
                        installTrailerPlacesFolderControl(geojson)
                        return registerTrailerPlaceIcons().then(() => {
                        mb.map.addSource("trailer-places", {
                            type: "geojson",
                            data: trailerPlacesFilteredGeojson(),
                        })
                        mb.map.addLayer({
                            id: "trailer-places-line",
                            type: "line",
                            source: "trailer-places",
                            filter: ["==", ["geometry-type"], "LineString"],
                            paint: {
                                "line-color": "#ff8c33",
                                "line-width": 4,
                                "line-opacity": 0.85,
                            },
                        })
                        mb.map.addLayer({
                            id: "trailer-places-circle",
                            type: "circle",
                            source: "trailer-places",
                            filter: ["==", ["geometry-type"], "Point"],
                            paint: {
                                "circle-radius": 14,
                                "circle-color": ["coalesce", ["get", "color"], "#ffcc33"],
                                "circle-stroke-color": "#1a1a1a",
                                "circle-stroke-width": 2,
                            },
                        })
                        mb.map.addLayer({
                            id: "trailer-places-marker",
                            type: "symbol",
                            source: "trailer-places",
                            filter: ["==", ["geometry-type"], "Point"],
                            layout: {
                                "icon-image": ["get", "icon_image"],
                                "icon-size": 0.9,
                                "icon-allow-overlap": true,
                                "icon-ignore-placement": true,
                            },
                        })
                        mb.map.addLayer({
                            id: "trailer-places-label",
                            type: "symbol",
                            source: "trailer-places",
                            filter: ["==", ["geometry-type"], "Point"],
                            layout: {
                                "text-field": ["get", "name"],
                                "text-offset": [0, 1.65],
                                "text-anchor": "top",
                                "text-size": 13,
                                "text-font": ["Noto Sans Regular"],
                            },
                            paint: {
                                "text-color": "#ffffff",
                                "text-halo-color": "#1a1a1a",
                                "text-halo-width": 2,
                            },
                        })
                        mb.map.addLayer({
                            id: "trailer-places-line-label",
                            type: "symbol",
                            source: "trailer-places",
                            filter: ["==", ["geometry-type"], "LineString"],
                            layout: {
                                "symbol-placement": "line",
                                "text-field": ["get", "name"],
                                "text-size": 13,
                                "text-font": ["Noto Sans Regular"],
                            },
                            paint: {
                                "text-color": "#ffffff",
                                "text-halo-color": "#1a1a1a",
                                "text-halo-width": 2,
                            },
                        })
                        mb.map.on("click", "trailer-places-circle", e => {
                            if (e.originalEvent.trailerPlacePopupHandled) {
                                return
                            }
                            e.originalEvent.trailerPlacePopupHandled = true
                            const feature = e.features[0]
                            const coordinates = e.features[0].geometry.coordinates.slice()
                            trailerPlaceEditPopup(feature, coordinates)
                        })
                        mb.map.on("click", "trailer-places-marker", e => {
                            if (e.originalEvent.trailerPlacePopupHandled) {
                                return
                            }
                            e.originalEvent.trailerPlacePopupHandled = true
                            const feature = e.features[0]
                            const coordinates = e.features[0].geometry.coordinates.slice()
                            trailerPlaceEditPopup(feature, coordinates)
                        })
                        mb.map.on("click", "trailer-places-label", e => {
                            if (e.originalEvent.trailerPlacePopupHandled) {
                                return
                            }
                            e.originalEvent.trailerPlacePopupHandled = true
                            const feature = e.features[0]
                            const coordinates = e.features[0].geometry.coordinates.slice()
                            trailerPlaceEditPopup(feature, coordinates)
                        })
                        mb.map.on("click", "trailer-places-line", e => {
                            const props = e.features[0].properties
                            const name = trailerPlaceHtmlEscape(props.name || "Trailer Route")
                            const category = "Route"
                            const notes = props.notes ? `<p>${trailerPlaceHtmlEscape(props.notes)}</p>` : ""
                            new maplibregl.Popup()
                                .setLngLat(e.lngLat)
                                .setHTML(`<strong>${name}</strong><br><em>Category: ${category}</em>${notes}`)
                                .addTo(mb.map)
                        })
                        mb.map.on("mouseenter", "trailer-places-circle", () => {
                            mb.map.getCanvas().style.cursor = "pointer"
                        })
                        mb.map.on("mouseenter", "trailer-places-marker", () => {
                            mb.map.getCanvas().style.cursor = "pointer"
                        })
                        mb.map.on("mouseenter", "trailer-places-label", () => {
                            mb.map.getCanvas().style.cursor = "pointer"
                        })
                        mb.map.on("mouseenter", "trailer-places-line", () => {
                            mb.map.getCanvas().style.cursor = "pointer"
                        })
                        mb.map.on("mouseleave", "trailer-places-circle", () => {
                            mb.map.getCanvas().style.cursor = ""
                        })
                        mb.map.on("mouseleave", "trailer-places-marker", () => {
                            mb.map.getCanvas().style.cursor = ""
                        })
                        mb.map.on("mouseleave", "trailer-places-label", () => {
                            mb.map.getCanvas().style.cursor = ""
                        })
                        mb.map.on("mouseleave", "trailer-places-line", () => {
                            mb.map.getCanvas().style.cursor = ""
                        })
                        })
                    })
                    .catch(error => console.log("Trailer Places failed to load", error))
            }

window.showTrailerPlaces = showTrailerPlaces
