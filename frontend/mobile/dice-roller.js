(() => {
  const storageKey = "oiab-dice-roller-v1";
  const historyKey = "oiab-dice-roller-history-v1";
  const $ = (id) => document.getElementById(id);
  const supportedSides = [4, 6, 8, 10, 12, 20, 100];
  const supportedSideSet = new Set(supportedSides);
  const standardShapes = new Map([[4, "d4"], [6, "d6"], [8, "d8"], [10, "d10"], [12, "d12"], [20, "d20"], [100, "d10"]]);
  const webglShapes = new Set(supportedSides);
  const maxWebglDice = 24;
  const maxDiceBoxDice = 36;
  const speedMs = { fast: 700, normal: 950, dramatic: 1200 };
  const rollSoundPaths = [
    "./vendor/dice-box-threejs/sounds/dicehit/dicehit_plastic1.mp3",
    "./vendor/dice-box-threejs/sounds/dicehit/dicehit_plastic4.mp3",
    "./vendor/dice-box-threejs/sounds/surfaces/surface_felt1.mp3",
    "./vendor/dice-box-threejs/sounds/surfaces/surface_felt4.mp3",
  ];
  const webglDice = new Map();
  let THREE = null;
  let threeLoadStarted = false;
  let threeLoadFailed = false;
  let DiceBox = null;
  let diceBoxLoadStarted = false;
  let diceBoxLoadFailed = false;
  let diceBoxInstance = null;
  const state = {
    rows: [],
    settings: { theme: "classic", sound: true, haptics: true, speed: "normal" },
    history: [],
    rolling: false,
    audioContext: null,
    audioBuffers: [],
    audioLoadPromise: null,
  };

  function clampNumber(value, min, max, fallback) {
    const number = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function randomInt(min, max) {
    const range = max - min + 1;
    if (range <= 0) return min;
    if (window.crypto?.getRandomValues) {
      const bucket = Math.floor(0xffffffff / range) * range;
      const value = new Uint32Array(1);
      do {
        window.crypto.getRandomValues(value);
      } while (value[0] >= bucket);
      return min + (value[0] % range);
    }
    return min + Math.floor(Math.random() * range);
  }

  function cleanLabel(value) {
    return String(value || "").replace(/[\x00-\x1f]+/g, "").trim().slice(0, 24);
  }

  function normalizeSides(value, fallback = 6) {
    const sides = clampNumber(value, 2, 100, fallback);
    return supportedSideSet.has(sides) ? sides : fallback;
  }

  function uid() {
    return `dice-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function defaultRows() {
    return [{ id: uid(), count: 1, sides: 20, label: "" }];
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (Array.isArray(saved.rows) && saved.rows.length) {
        state.rows = saved.rows.map((row) => ({
          id: String(row.id || uid()),
          count: clampNumber(row.count, 1, 50, 1),
          sides: normalizeSides(row.sides, 6),
          label: cleanLabel(row.label),
          dropLowest: !!row.dropLowest,
        }));
      } else {
        state.rows = defaultRows();
      }
      state.settings = {
        theme: ["classic", "neon", "overland", "contrast", "minimal"].includes(saved.settings?.theme) ? saved.settings.theme : "classic",
        sound: saved.settings?.sound !== false,
        haptics: saved.settings?.haptics !== false,
        speed: ["fast", "normal", "dramatic"].includes(saved.settings?.speed) ? saved.settings.speed : "normal",
      };
    } catch {
      state.rows = defaultRows();
    }
    try {
      const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
      state.history = Array.isArray(history) ? history.slice(0, 20) : [];
    } catch {
      state.history = [];
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify({ rows: state.rows, settings: state.settings }));
  }

  function saveHistory() {
    localStorage.setItem(historyKey, JSON.stringify(state.history.slice(0, 20)));
  }

  function message(text, error = false) {
    $("message").textContent = text || "";
    $("message").style.color = error ? "var(--danger)" : "var(--accent)";
  }

  function rowFormula(row) {
    const suffix = row.dropLowest ? " drop lowest" : "";
    return `${row.count}D${row.sides}${suffix}`;
  }

  function formulaText(rows = state.rows) {
    return rows.map(rowFormula).join(" + ") || "No dice";
  }

  function shapeFor(sides) {
    return standardShapes.get(Number(sides)) || "custom";
  }

  function applySettings() {
    document.querySelector(".dr-shell").dataset.theme = state.settings.theme;
    $("themeSelect").value = state.settings.theme;
    $("speedSelect").value = state.settings.speed;
    $("soundToggle").checked = !!state.settings.sound;
    $("hapticsToggle").checked = !!state.settings.haptics;
  }

  function renderRows() {
    $("formulaLabel").textContent = formulaText();
    const sideOptions = supportedSides.map((sides) => `<option value="${sides}">D${sides}</option>`).join("");
    $("diceRows").replaceChildren(...state.rows.map((row) => {
      const card = document.createElement("article");
      card.className = "dice-row";
      card.dataset.id = row.id;
      card.innerHTML = `
        <label class="field-control"><span>Dice</span>
          <input data-field="count" type="number" inputmode="numeric" min="1" max="50" value="${row.count}" aria-label="Dice count">
        </label>
        <label class="field-control"><span>Sides</span>
          <select data-field="sides" aria-label="Dice sides">${sideOptions}</select>
        </label>
        <label class="field-control"><span>Label</span>
          <input data-field="label" type="text" maxlength="24" value="${escapeHtml(row.label)}" placeholder="Label" aria-label="Dice label">
        </label>
        <button class="row-remove" type="button" aria-label="Remove dice row">×</button>
      `;
      card.querySelector('[data-field="sides"]').value = String(normalizeSides(row.sides, 6));
      card.querySelectorAll("input").forEach((input) => {
        input.addEventListener("change", () => updateRow(row.id, input.dataset.field, input.value));
        input.addEventListener("input", () => {
          if (input.dataset.field === "label") updateRow(row.id, "label", input.value, false);
        });
      });
      card.querySelector('[data-field="sides"]').addEventListener("change", (event) => updateRow(row.id, "sides", event.target.value));
      card.querySelector(".row-remove").addEventListener("click", () => removeRow(row.id));
      return card;
    }));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function updateRow(id, field, value, rerender = true) {
    const row = state.rows.find((item) => item.id === id);
    if (!row) return;
    if (field === "count") row.count = clampNumber(value, 1, 50, row.count);
    if (field === "sides") row.sides = normalizeSides(value, row.sides);
    if (field === "label") row.label = cleanLabel(value);
    saveState();
    if (rerender) renderRows();
    else $("formulaLabel").textContent = formulaText();
  }

  function addRow(count = 1, sides = 6, label = "") {
    state.rows.push({ id: uid(), count: clampNumber(count, 1, 50, 1), sides: normalizeSides(sides, 6), label: cleanLabel(label) });
    saveState();
    renderRows();
  }

  function removeRow(id) {
    state.rows = state.rows.filter((row) => row.id !== id);
    if (!state.rows.length) state.rows = defaultRows();
    saveState();
    renderRows();
  }

  function setRows(rows) {
    state.rows = rows.map((row) => ({
      id: uid(),
      count: clampNumber(row.count, 1, 50, 1),
      sides: normalizeSides(row.sides, 6),
      label: cleanLabel(row.label),
      dropLowest: !!row.dropLowest,
    }));
    saveState();
    renderRows();
  }

  function rollRows(rows) {
    return rows.map((row) => {
      const dice = Array.from({ length: row.count }, () => randomInt(1, row.sides));
      let droppedIndexes = [];
      if (row.dropLowest && dice.length > 1) {
        const lowest = Math.min(...dice);
        droppedIndexes = [dice.indexOf(lowest)];
      }
      const subtotal = dice.reduce((sum, value, index) => sum + (droppedIndexes.includes(index) ? 0 : value), 0);
      return { ...row, dice, droppedIndexes, subtotal };
    });
  }

  function flattenDice(results) {
    return results.flatMap((row, rowIndex) => row.dice.map((value, dieIndex) => ({
      id: `${row.id}-${dieIndex}`,
      rowIndex,
      dieIndex,
      sides: row.sides,
      value,
      label: row.label,
      dropped: row.droppedIndexes.includes(dieIndex),
    })));
  }

  function renderDicePlaceholders(flatDice) {
    const duration = speedMs[state.settings.speed] || speedMs.normal;
    const useWebgl = !!THREE && flatDice.filter((die) => webglShapes.has(Number(die.sides))).length <= maxWebglDice;
    document.documentElement.style.setProperty("--roll-duration", `${duration}ms`);
    disposeWebglDice();
    $("diceStage").replaceChildren(...flatDice.map((die) => {
      const card = document.createElement("div");
      const webglDie = useWebgl && webglShapes.has(Number(die.sides));
      card.className = `die rolling ${webglDie ? "webgl-die" : ""} ${die.dropped ? "dropped" : ""}`;
      card.dataset.id = die.id;
      card.dataset.shape = shapeFor(die.sides);
      card.innerHTML = dieMarkup(die.sides, randomInt(1, die.sides), useWebgl);
      return card;
    }));
    setupWebglDice(flatDice, useWebgl);
  }

  function showDiceBoxStage(show) {
    const box = $("diceBoxStage");
    const fallback = $("diceStage");
    box.hidden = !show;
    box.setAttribute("aria-hidden", show ? "false" : "true");
    fallback.hidden = show;
  }

  function waitForVisibleDiceBoxStage() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const rect = $("diceBoxStage").getBoundingClientRect();
          resolve(rect.width > 0 && rect.height > 0);
        });
      });
    });
  }

  function loadDiceBox() {
    if (DiceBox || diceBoxLoadStarted || diceBoxLoadFailed) return Promise.resolve(!!DiceBox);
    diceBoxLoadStarted = true;
    window.oiabDiceBoxStatus = "loading";
    return import("./vendor/dice-box-threejs/dice-box-threejs.es.js?v=0.0.12")
      .then((module) => {
        DiceBox = module.default || null;
        diceBoxLoadFailed = !DiceBox;
        window.oiabDiceBoxStatus = DiceBox ? "loaded" : "missing-export";
        return !!DiceBox;
      })
      .catch((error) => {
        console.warn("[OIAB Dice] DiceBox module load failed", error);
        DiceBox = null;
        diceBoxLoadFailed = true;
        window.oiabDiceBoxStatus = "failed";
        return false;
      });
  }

  async function getDiceBox() {
    if (!(await loadDiceBox())) return null;
    if (diceBoxInstance?.initialized) {
      const canvas = $("diceBoxStage").querySelector("canvas");
      if (!canvas || (canvas.width > 0 && canvas.height > 0)) return diceBoxInstance;
      try {
        diceBoxInstance.clearDice?.();
      } catch (error) {
        console.warn("[OIAB Dice] DiceBox zero-size cleanup failed", error);
      }
      $("diceBoxStage").replaceChildren();
      diceBoxInstance = null;
    }
    try {
      diceBoxInstance = new DiceBox("#diceBoxStage", {
        assetPath: "./vendor/dice-box-threejs/",
        sounds: false,
        shadows: true,
        theme_surface: "green-felt",
        theme_colorset: state.settings.theme === "neon" ? "rainbow" : "white",
        theme_material: state.settings.theme === "overland" ? "wood" : "glass",
        gravity_multiplier: 420,
        light_intensity: 0.78,
        strength: state.settings.speed === "dramatic" ? 1.25 : state.settings.speed === "fast" ? 0.75 : 1,
      });
      await diceBoxInstance.initialize();
      return diceBoxInstance;
    } catch (error) {
      console.warn("[OIAB Dice] DiceBox unavailable", error);
      diceBoxLoadFailed = true;
      window.oiabDiceBoxStatus = "failed-init";
      diceBoxInstance = null;
      return null;
    }
  }

  function canUseDiceBox(flatDice) {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      && flatDice.length > 0
      && flatDice.length <= maxDiceBoxDice
      && flatDice.every((die) => supportedSideSet.has(Number(die.sides)));
  }

  function diceBoxNotation(flatDice) {
    const groups = [];
    const values = [];
    supportedSides.forEach((sides) => {
      const dice = flatDice.filter((die) => Number(die.sides) === sides);
      if (!dice.length) return;
      groups.push(`${dice.length}d${sides}`);
      values.push(...dice.map((die) => die.value));
    });
    return `${groups.join("+")}@${values.join(",")}`;
  }

  async function animateDiceBox(flatDice) {
    if (!canUseDiceBox(flatDice)) return false;
    showDiceBoxStage(true);
    const hasLayout = await waitForVisibleDiceBoxStage();
    if (!hasLayout) return false;
    const box = await getDiceBox();
    if (!box) return false;
    $("diceBoxStage").classList.add("is-rolling");
    try {
      await box.roll(diceBoxNotation(flatDice));
      return true;
    } catch (error) {
      console.warn("[OIAB Dice] DiceBox roll failed", error);
      showDiceBoxStage(false);
      return false;
    } finally {
      $("diceBoxStage").classList.remove("is-rolling");
    }
  }

  function loadThree() {
    if (THREE || threeLoadStarted || threeLoadFailed) return;
    if (window.THREE) {
      THREE = window.THREE;
      window.oiabDiceThreeStatus = "loaded";
      return;
    }
    threeLoadStarted = true;
    window.oiabDiceThreeStatus = "loading";
    const script = document.createElement("script");
    script.src = "./vendor/three.min.js?v=r150-oiab-3d";
    script.async = true;
    script.onload = () => {
      THREE = window.THREE || null;
      window.oiabDiceThreeStatus = THREE ? "loaded" : "missing-global";
      if (!THREE) threeLoadFailed = true;
    };
    script.onerror = () => {
      THREE = null;
      threeLoadFailed = true;
      window.oiabDiceThreeStatus = "failed";
    };
    document.head.appendChild(script);
  }

  function dieMarkup(sides, value, useWebgl = true) {
    if (useWebgl && webglShapes.has(Number(sides))) {
      return `
        <canvas class="die-webgl" width="220" height="220" aria-hidden="true"></canvas>
        <span class="die-glow" aria-hidden="true"></span>
        <span class="die-result-badge">${value}</span>
        <span class="die-type">D${sides}</span>
      `;
    }
    if (Number(sides) === 6) {
      const face = `<span class="die-value">${value}</span>`;
      return `
        <span class="die-cube" aria-hidden="true">
          <span class="cube-face cube-front">${face}</span>
          <span class="cube-face cube-back">${face}</span>
          <span class="cube-face cube-right">${face}</span>
          <span class="cube-face cube-left">${face}</span>
          <span class="cube-face cube-top">${face}</span>
          <span class="cube-face cube-bottom">${face}</span>
        </span>
        <span class="die-type">D6</span>
      `;
    }
    if (standardShapes.has(Number(sides))) {
      return `
        <span class="die-facets" aria-hidden="true">
          <span class="facet facet-a"></span>
          <span class="facet facet-b"></span>
          <span class="facet facet-c"></span>
          <span class="facet facet-d"></span>
          <span class="facet facet-e"></span>
          <span class="facet facet-f"></span>
        </span>
        <span class="die-value">${value}</span>
        <span class="die-type">D${sides}</span>
      `;
    }
    return `<span class="die-facets custom-facets" aria-hidden="true"><span class="facet facet-a"></span><span class="facet facet-c"></span><span class="facet facet-e"></span></span><span class="die-value">${value}</span><span class="die-type">D${sides}</span>`;
  }

  function disposeWebglDice() {
    webglDice.forEach((item) => {
      cancelAnimationFrame(item.frameId);
      item.geometry?.dispose();
      item.edgesGeometry?.dispose();
      item.edgesMaterial?.dispose();
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      materials.forEach((material) => {
        material?.map?.dispose?.();
        material?.dispose?.();
      });
      item.renderer?.dispose();
      item.renderer?.forceContextLoss?.();
    });
    webglDice.clear();
  }

  function cssColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function makeDiceGeometry(sides) {
    if (sides === 4) return new THREE.TetrahedronGeometry(0.98, 0);
    if (sides === 6) return new THREE.BoxGeometry(1.18, 1.18, 1.18);
    if (sides === 8) return new THREE.OctahedronGeometry(1.02, 0);
    if (sides === 10) return makePentagonalBipyramidGeometry();
    if (sides === 12) return new THREE.DodecahedronGeometry(1.02, 0);
    if (sides === 20) return new THREE.IcosahedronGeometry(1.04, 0);
    return new THREE.IcosahedronGeometry(1, 0);
  }

  function makePentagonalBipyramidGeometry() {
    const vertices = [];
    const indices = [];
    vertices.push(0, 0.95, 0);
    vertices.push(0, -0.95, 0);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2 + Math.PI / 10;
      vertices.push(Math.cos(angle), 0, Math.sin(angle));
    }
    for (let i = 0; i < 5; i += 1) {
      const current = 2 + i;
      const next = 2 + ((i + 1) % 5);
      indices.push(0, current, next);
      indices.push(1, next, current);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeDieFaceTexture(value, sides, dieBg, dieText, dieBorder) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.3, dieBg);
    gradient.addColorStop(1, "#9aa58b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.arc(72, 54, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dieBorder;
    ctx.lineWidth = 16;
    ctx.strokeRect(16, 16, 224, 224);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 5;
    ctx.strokeRect(28, 28, 200, 200);
    ctx.fillStyle = dieText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 112px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(String(value), 128, 124);
    ctx.globalAlpha = 0.78;
    ctx.font = "900 32px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`D${sides}`, 128, 208);
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function setupWebglDice(flatDice, useWebgl) {
    if (!useWebgl) return;
    const dieBg = cssColor("--die-bg", "#f5fbef");
    const dieText = cssColor("--die-text", "#07130d");
    const dieBorder = cssColor("--die-border", "#80f08a");
    flatDice.forEach((die) => {
      if (!webglShapes.has(Number(die.sides))) return;
      const card = document.querySelector(`.die[data-id="${CSS.escape(die.id)}"]`);
      const canvas = card?.querySelector(".die-webgl");
      if (!canvas) return;
      try {
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(220, 220, false);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 10);
        camera.position.set(0, 0, 3.25);
        const geometry = makeDiceGeometry(Number(die.sides));
        const material = Number(die.sides) === 6
          ? Array.from({ length: 6 }, () => new THREE.MeshStandardMaterial({
            map: makeDieFaceTexture(die.value, die.sides, dieBg, dieText, dieBorder),
            roughness: 0.36,
            metalness: 0.04,
          }))
          : new THREE.MeshStandardMaterial({
            color: new THREE.Color(dieBg),
            roughness: 0.36,
            metalness: 0.08,
            flatShading: true,
          });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.setScalar(Number(die.sides) === 6 ? 1.08 : 1.22);
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(dieText), transparent: true, opacity: 0.9 });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        edges.scale.copy(mesh.scale);
        mesh.rotation.set(-0.52, 0.72, -0.12);
        edges.rotation.copy(mesh.rotation);
        scene.add(mesh, edges);
        scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const key = new THREE.DirectionalLight(0xffffff, 3.2);
        key.position.set(-3.2, 4.2, 4.8);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x80f08a, 1.15);
        fill.position.set(3, -2, 2.5);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffd34e, 0.85);
        rim.position.set(3.6, 2.2, -2.4);
        scene.add(rim);
        renderer.render(scene, camera);
        webglDice.set(die.id, { renderer, scene, camera, mesh, edges, geometry, material, edgesGeometry, edgesMaterial, frameId: 0 });
      } catch {
        card.classList.add("webgl-failed");
      }
    });
  }

  function animateWebglDice(flatDice, duration) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
    const start = performance.now();
    let stopped = false;
    const animate = (now) => {
      if (stopped) return;
      const progress = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      flatDice.forEach((die, index) => {
        const item = webglDice.get(die.id);
        if (!item) return;
        const spin = 1 + index * 0.13;
        item.mesh.rotation.x = -0.35 + ease * Math.PI * 4.6 * spin;
        item.mesh.rotation.y = 0.55 + ease * Math.PI * 5.2 * spin;
        item.mesh.rotation.z = 0.08 + Math.sin(progress * Math.PI * 5 + index) * 0.42;
        item.edges.rotation.copy(item.mesh.rotation);
        item.renderer.render(item.scene, item.camera);
      });
      if (progress < 1) {
        const first = flatDice.find((die) => webglDice.has(die.id));
        const item = first ? webglDice.get(first.id) : null;
        if (item) item.frameId = requestAnimationFrame(animate);
      }
    };
    const first = flatDice.find((die) => webglDice.has(die.id));
    const item = first ? webglDice.get(first.id) : null;
    if (item) item.frameId = requestAnimationFrame(animate);
    return () => {
      stopped = true;
      flatDice.forEach((die, index) => {
        const item = webglDice.get(die.id);
        if (!item) return;
        item.mesh.rotation.set(-0.52 + index * 0.07, 0.72 + index * 0.09, -0.12);
        item.edges.rotation.copy(item.mesh.rotation);
        item.renderer.render(item.scene, item.camera);
      });
    };
  }

  function cycleRollingFaces(flatDice, duration) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
    const timer = window.setInterval(() => {
      flatDice.forEach((die) => {
        const card = document.querySelector(`.die[data-id="${CSS.escape(die.id)}"]`);
        const values = card?.querySelectorAll(".die-value, .die-result-badge");
        values?.forEach((value) => {
          value.textContent = randomInt(1, die.sides);
        });
      });
    }, Math.max(45, Math.min(95, Math.floor(duration / 12))));
    return () => window.clearInterval(timer);
  }

  function settleDice(flatDice) {
    flatDice.forEach((die) => {
      const card = document.querySelector(`.die[data-id="${CSS.escape(die.id)}"]`);
      if (!card) return;
      card.classList.remove("rolling");
      card.querySelectorAll(".die-value, .die-result-badge").forEach((value) => {
        value.textContent = die.value;
      });
      if (die.dropped) card.classList.add("dropped");
    });
  }

  function renderTotals(results, total) {
    $("grandTotal").textContent = total;
    $("rowTotals").replaceChildren(...results.map((row) => {
      const item = document.createElement("div");
      item.className = "row-total";
      const kept = row.dice.map((value, index) => row.droppedIndexes.includes(index) ? `(${value})` : String(value)).join(", ");
      item.innerHTML = `<div><strong>${escapeHtml(row.label || rowFormula(row))}</strong><span>${escapeHtml(kept)}</span></div><div class="history-score">${row.subtotal}</div>`;
      return item;
    }));
  }

  function clearRollSummary() {
    const overlay = $("rollSummaryOverlay");
    overlay.hidden = true;
    overlay.textContent = "";
  }

  function renderRollSummary(results, total) {
    const parts = [];
    results.forEach((row) => {
      if (row.sides > 0) {
        row.dice.forEach((value, index) => {
          const isDropped = row.droppedIndexes.includes(index);
          const label = `D${row.sides}=${value}`;
          parts.push(isDropped ? `(${label})` : label);
        });
        return;
      }
      row.dice.forEach((value) => parts.push(value >= 0 ? `+${value}` : String(value)));
    });
    const visible = parts.slice(0, 10);
    if (parts.length > visible.length) visible.push(`+${parts.length - visible.length} more`);
    visible.push(`Total ${total}`);
    const overlay = $("rollSummaryOverlay");
    overlay.textContent = visible.join(" · ");
    overlay.hidden = false;
  }

  function renderHistory() {
    if (!state.history.length) {
      $("historyList").innerHTML = '<div class="history-item"><span>No rolls yet.</span></div>';
      return;
    }
    $("historyList").replaceChildren(...state.history.map((entry) => {
      const item = document.createElement("article");
      item.className = "history-item";
      item.innerHTML = `<div><strong>${escapeHtml(entry.formula)}</strong><span>${escapeHtml(entry.time)} · ${escapeHtml(entry.details)}</span></div><button class="history-score" type="button" data-copy="${escapeHtml(String(entry.total))}">${entry.total}</button>`;
      item.querySelector("button").addEventListener("click", () => copyResult(entry));
      return item;
    }));
  }

  async function copyResult(entry) {
    const text = `${entry.formula} = ${entry.total} (${entry.details})`;
    try {
      await navigator.clipboard.writeText(text);
      message("Copied roll result.");
    } catch {
      message(text);
    }
  }

  function addHistory(results, total, formula) {
    const details = results.map((row) => `${row.label ? `${row.label}: ` : ""}${row.dice.join(", ")}${row.dropLowest ? " drop lowest" : ""}`).join(" | ");
    state.history.unshift({
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      formula,
      details,
      total,
    });
    state.history = state.history.slice(0, 20);
    saveHistory();
    renderHistory();
  }

  function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    const ctx = state.audioContext || new AudioContextClass();
    state.audioContext = ctx;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  }

  function loadRollSounds(ctx) {
    if (state.audioBuffers.length) return Promise.resolve(state.audioBuffers);
    if (state.audioLoadPromise) return state.audioLoadPromise;
    state.audioLoadPromise = Promise.all(rollSoundPaths.map(async (path) => {
      const response = await window.fetch(path);
      if (!response.ok) throw new Error(`Could not load ${path}`);
      const data = await response.arrayBuffer();
      return ctx.decodeAudioData(data.slice(0));
    })).then((buffers) => {
      state.audioBuffers = buffers.filter(Boolean);
      return state.audioBuffers;
    }).catch(() => {
      state.audioBuffers = [];
      return state.audioBuffers;
    });
    return state.audioLoadPromise;
  }

  async function playRollSound() {
    if (!state.settings.sound) return;
    try {
      const ctx = ensureAudioContext();
      if (!ctx || !window.fetch) return;
      const buffers = await loadRollSounds(ctx);
      if (!buffers.length) return;
      const gain = ctx.createGain();
      gain.gain.value = 0.24;
      gain.connect(ctx.destination);
      const hit = buffers[randomInt(0, Math.min(1, buffers.length - 1))];
      const surface = buffers[Math.min(buffers.length - 1, randomInt(2, buffers.length - 1))] || hit;
      [hit, surface].forEach((buffer, index) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.92 + Math.random() * 0.18;
        source.connect(gain);
        source.start(ctx.currentTime + index * 0.04);
      });
    } catch {
      // Sound is optional.
    }
  }

  function vibrate() {
    if (state.settings.haptics && navigator.vibrate) navigator.vibrate([18, 24, 18]);
  }

  async function rollCurrentRows(rows = state.rows, formula = formulaText(rows)) {
    if (state.rolling) return;
    const validRows = rows.map((row) => ({
      ...row,
      count: clampNumber(row.count, 1, 50, 1),
      sides: normalizeSides(row.sides, 6),
      label: cleanLabel(row.label),
    }));
    const dieCount = validRows.reduce((sum, row) => sum + row.count, 0);
    if (!dieCount || dieCount > 120) {
      message("Rolls are limited to 120 dice at once.", true);
      return;
    }
    state.rolling = true;
    $("rollButton").disabled = true;
    clearRollSummary();
    const results = rollRows(validRows);
    const flatDice = flattenDice(results);
    const total = results.reduce((sum, row) => sum + row.subtotal, 0);
    renderTotals(results, total);
    void playRollSound();
    vibrate();
    const usedDiceBox = await animateDiceBox(flatDice);
    if (!usedDiceBox) {
      showDiceBoxStage(false);
      renderDicePlaceholders(flatDice);
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 190 : (speedMs[state.settings.speed] || speedMs.normal);
      const stopFaceCycle = cycleRollingFaces(flatDice, duration);
      const stopWebglAnimation = animateWebglDice(flatDice, duration);
      await new Promise((resolve) => setTimeout(resolve, duration));
      stopFaceCycle();
      stopWebglAnimation();
      settleDice(flatDice);
    }
    renderRollSummary(results, total);
    addHistory(results, total, formula);
    if (!THREE && flatDice.some((die) => webglShapes.has(Number(die.sides)))) window.setTimeout(loadThree, 80);
    state.rolling = false;
    $("rollButton").disabled = false;
    message(`Rolled ${formula}.`);
  }

  function parseFormula(text) {
    const raw = String(text || "").replace(/\s+/g, "").toLowerCase();
    if (!raw) throw new Error("Enter a formula.");
    const rows = [];
    let modifier = 0;
    const normalized = raw.replaceAll("-", "+-");
    for (const part of normalized.split("+").filter(Boolean)) {
      const diceMatch = part.match(/^(\d*)d(\d{1,4})$/);
      if (diceMatch) {
        const sides = Number.parseInt(diceMatch[2], 10);
        if (!supportedSideSet.has(sides)) throw new Error(`D${sides} is not available. Use D4, D6, D8, D10, D12, D20, or D100.`);
        rows.push({ id: uid(), count: clampNumber(diceMatch[1] || "1", 1, 50, 1), sides, label: "" });
        continue;
      }
      if (/^-?\d+$/.test(part)) {
        modifier += clampNumber(part, -10000, 10000, 0);
        continue;
      }
      throw new Error(`Cannot parse "${part}".`);
    }
    if (!rows.length && !modifier) throw new Error("Formula needs dice or a modifier.");
    return { rows, modifier, formula: raw.toUpperCase() };
  }

  async function rollFormula() {
    try {
      const parsed = parseFormula($("formulaInput").value);
      const results = rollRows(parsed.rows);
      if (parsed.modifier) {
        results.push({ id: uid(), count: 1, sides: 0, label: `Modifier ${parsed.modifier >= 0 ? "+" : ""}${parsed.modifier}`, dice: [parsed.modifier], droppedIndexes: [], subtotal: parsed.modifier });
      }
      await rollResolvedResults(results, parsed.formula);
    } catch (error) {
      message(error.message, true);
    }
  }

  async function rollResolvedResults(results, formula) {
    if (state.rolling) return;
    state.rolling = true;
    $("rollButton").disabled = true;
    clearRollSummary();
    const diceResults = results.filter((row) => row.sides > 0);
    const flatDice = flattenDice(diceResults);
    const total = results.reduce((sum, row) => sum + row.subtotal, 0);
    renderTotals(results, total);
    void playRollSound();
    vibrate();
    const usedDiceBox = await animateDiceBox(flatDice);
    if (!usedDiceBox) {
      showDiceBoxStage(false);
      renderDicePlaceholders(flatDice);
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 190 : (speedMs[state.settings.speed] || speedMs.normal);
      const stopFaceCycle = cycleRollingFaces(flatDice, duration);
      const stopWebglAnimation = animateWebglDice(flatDice, duration);
      await new Promise((resolve) => setTimeout(resolve, duration));
      stopFaceCycle();
      stopWebglAnimation();
      settleDice(flatDice);
    }
    renderRollSummary(results, total);
    addHistory(results, total, formula);
    if (!THREE && flatDice.some((die) => webglShapes.has(Number(die.sides)))) window.setTimeout(loadThree, 80);
    state.rolling = false;
    $("rollButton").disabled = false;
    message(`Rolled ${formula}.`);
  }

  function bind() {
    $("settingsToggle").addEventListener("click", () => {
      const panel = $("settingsPanel");
      const shouldOpen = panel.hidden;
      panel.hidden = !shouldOpen;
      panel.classList.toggle("is-visible", shouldOpen);
    });
    $("themeSelect").addEventListener("change", (event) => {
      state.settings.theme = event.target.value;
      diceBoxInstance = null;
      applySettings();
      saveState();
    });
    $("speedSelect").addEventListener("change", (event) => {
      state.settings.speed = event.target.value;
      diceBoxInstance = null;
      saveState();
    });
    $("soundToggle").addEventListener("change", (event) => {
      state.settings.sound = event.target.checked;
      saveState();
    });
    $("hapticsToggle").addEventListener("change", (event) => {
      state.settings.haptics = event.target.checked;
      saveState();
    });
    $("addRow").addEventListener("click", () => addRow());
    $("rollButton").addEventListener("click", () => rollCurrentRows());
    $("rollFormula").addEventListener("click", rollFormula);
    $("clearHistory").addEventListener("click", () => {
      state.history = [];
      saveHistory();
      renderHistory();
      message("History cleared.");
    });
    document.querySelectorAll("[data-quick-side]").forEach((button) => {
      button.addEventListener("click", () => addRow(1, button.dataset.quickSide));
    });
    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = button.dataset.preset;
        if (preset === "1d20") setRows([{ count: 1, sides: 20 }]);
        if (preset === "2d6") setRows([{ count: 2, sides: 6 }]);
        if (preset === "4d6drop") setRows([{ count: 4, sides: 6, label: "Ability", dropLowest: true }]);
        if (preset === "1d100") setRows([{ count: 1, sides: 100 }]);
      });
    });
  }

  loadState();
  applySettings();
  renderRows();
  renderHistory();
  bind();
  window.setTimeout(loadDiceBox, 250);
  window.setTimeout(loadThree, 350);
})();
