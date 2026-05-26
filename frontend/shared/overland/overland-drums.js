(() => {
    const assetBase = "/maps/overland/drums/"
    const pieces = [
        {id: "crash", label: "Crash", key: "1", sample: "crash.wav", x: 2.2, y: 7.2, w: 25.4, h: 33.4},
        {id: "splash", label: "Splash", key: "2", sample: "splash.wav", x: 28.4, y: 3.7, w: 16.0, h: 20.7},
        {id: "ride", label: "Ride", key: "3", sample: "ride.wav", x: 73.0, y: 11.3, w: 24.4, h: 36.0},
        {id: "hihat", label: "Hi-Hat", key: "Q", sample: "hihat.wav", x: 4.0, y: 47.7, w: 24.6, h: 26.6},
        {id: "snare", label: "Snare", key: "W", sample: "snare.wav", x: 23.5, y: 57.6, w: 24.2, h: 31.0},
        {id: "kick", label: "Kick", key: "E", sample: "kick.wav", x: 43.5, y: 52.0, w: 20.0, h: 22.0},
        {id: "high-tom", label: "High Tom", key: "A", sample: "high-tom.wav", x: 30.4, y: 29.8, w: 17.8, h: 24.1},
        {id: "mid-tom", label: "Mid Tom", key: "S", sample: "mid-tom.wav", x: 47.9, y: 29.8, w: 18.4, h: 24.1},
        {id: "floor-tom", label: "Floor Tom", key: "D", sample: "floor-tom.wav", x: 66.0, y: 55.6, w: 26.8, h: 32.0},
    ]
    const audioPool = new Map()

    function ensureUi() {
        let root = document.getElementById("odrRoot")
        if (root) return root
        root = document.createElement("section")
        root.id = "odrRoot"
        root.className = "odr-root"
        root.hidden = true
        root.innerHTML = `
            <div class="odr-stage">
                <img class="odr-kit" src="${assetBase}kit.png" alt="Playable labeled drum kit">
                <div class="odr-hit-layer" aria-label="Playable drum kit"></div>
                <div class="odr-toolbar">
                    <button id="odrFullscreen" class="odr-icon-button" type="button" title="Fullscreen">⛶</button>
                    <button id="odrClose" class="odr-icon-button" type="button" title="Close drums">×</button>
                </div>
                <div id="odrStatus" class="odr-status">Tap a drum or use keys 1 2 3 Q W E A S D</div>
            </div>`
        document.body.append(root)

        const hitLayer = root.querySelector(".odr-hit-layer")
        pieces.forEach(piece => {
            const button = document.createElement("button")
            button.type = "button"
            button.className = "odr-hit"
            button.style.left = `${piece.x}%`
            button.style.top = `${piece.y}%`
            button.style.width = `${piece.w}%`
            button.style.height = `${piece.h}%`
            button.setAttribute("aria-label", `Play ${piece.label}`)
            button.dataset.drum = piece.id
            button.innerHTML = `<span>${piece.label}</span>`
            button.addEventListener("pointerdown", event => {
                event.preventDefault()
                play(piece.id)
            })
            hitLayer.append(button)
        })

        document.getElementById("odrClose").addEventListener("click", close)
        document.getElementById("odrFullscreen").addEventListener("click", () => {
            if (root.requestFullscreen) root.requestFullscreen()
        })
        document.addEventListener("keydown", event => {
            if (root.hidden || event.repeat) return
            const piece = pieces.find(item => item.key.toLowerCase() === event.key.toLowerCase())
            if (!piece) return
            event.preventDefault()
            play(piece.id)
        })
        preload()
        return root
    }

    function preload() {
        pieces.forEach(piece => {
            if (audioPool.has(piece.id)) return
            const audio = new Audio(assetBase + piece.sample)
            audio.preload = "auto"
            audioPool.set(piece.id, audio)
        })
    }

    function play(id) {
        const piece = pieces.find(item => item.id === id)
        const baseAudio = piece && audioPool.get(id)
        if (!piece || !baseAudio) return
        const audio = baseAudio.cloneNode(true)
        audio.volume = 1
        const status = document.getElementById("odrStatus")
        if (status) status.textContent = piece.label
        markHit(id)
        audio.play().catch(error => {
            if (status) status.textContent = `Audio blocked: ${error.message || error}`
        })
        audio.addEventListener("ended", () => audio.remove(), {once: true})
    }

    function markHit(id) {
        const button = document.querySelector(`.odr-hit[data-drum="${CSS.escape(id)}"]`)
        if (!button) return
        button.classList.remove("odr-hit--active")
        void button.offsetWidth
        button.classList.add("odr-hit--active")
    }

    function open() {
        const root = ensureUi()
        root.hidden = false
        preload()
    }

    function close() {
        const root = document.getElementById("odrRoot")
        if (root) root.hidden = true
    }

    window.overlandDrums = {open, close, play}
})()
