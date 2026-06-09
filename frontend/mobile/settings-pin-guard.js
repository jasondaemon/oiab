(() => {
  const UNLOCK_KEY = "oiab-settings-unlock-until-v1";

  function injectStyles() {
    if (document.getElementById("oiab-settings-pin-style")) return;
    const style = document.createElement("style");
    style.id = "oiab-settings-pin-style";
    style.textContent = `
      html.oiab-settings-locked body > :not(.oiab-pin-gate) { visibility: hidden !important; }
      .oiab-pin-gate {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: grid;
        place-items: center;
        padding: max(20px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left));
        background:
          radial-gradient(circle at 30% 20%, rgba(125, 255, 145, .16), transparent 36%),
          linear-gradient(135deg, #062213, #143a23 52%, #07180f);
        color: #f2fff2;
        font-family: inherit;
      }
      .oiab-pin-card {
        width: min(420px, 100%);
        border: 1px solid rgba(138, 255, 157, .28);
        border-radius: 28px;
        padding: 22px;
        background: rgba(4, 24, 14, .9);
        box-shadow: 0 24px 70px rgba(0, 0, 0, .45);
      }
      .oiab-pin-card h1 {
        margin: 0 0 6px;
        font-size: clamp(2rem, 12vw, 3.8rem);
        line-height: .9;
      }
      .oiab-pin-card p {
        margin: 0 0 18px;
        color: rgba(242, 255, 242, .74);
      }
      .oiab-pin-card input,
      .oiab-pin-card button {
        width: 100%;
        min-height: 54px;
        border-radius: 18px;
        font: inherit;
        font-weight: 900;
      }
      .oiab-pin-card input {
        box-sizing: border-box;
        margin-bottom: 12px;
        border: 1px solid rgba(242, 255, 242, .2);
        padding: 0 16px;
        color: #f2fff2;
        background: rgba(255, 255, 255, .08);
        letter-spacing: .2em;
        text-align: center;
      }
      .oiab-pin-card button {
        border: 0;
        color: #062213;
        background: #7ee58b;
      }
      .oiab-pin-error {
        min-height: 1.2em;
        margin-top: 12px;
        color: #ffb2a8;
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);
  }

  function pinUnlocked() {
    const until = Number(sessionStorage.getItem(UNLOCK_KEY) || "0");
    return Number.isFinite(until) && until > Date.now();
  }

  function rememberUnlock(minutes) {
    const safeMinutes = Math.max(0, Math.min(120, Number(minutes) || 0));
    if (safeMinutes <= 0) {
      sessionStorage.removeItem(UNLOCK_KEY);
      return;
    }
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now() + safeMinutes * 60 * 1000));
  }

  async function loadSettings() {
    const response = await fetch("/api/settings/app", { cache: "no-store" });
    if (!response.ok) throw new Error(`settings ${response.status}`);
    const data = await response.json();
    return data?.settings || {};
  }

  function showGate(settings, done) {
    injectStyles();
    document.documentElement.classList.add("oiab-settings-locked");
    const gate = document.createElement("section");
    gate.className = "oiab-pin-gate";
    gate.innerHTML = `
      <form class="oiab-pin-card" autocomplete="off">
        <h1>Settings</h1>
        <p>Enter the six-digit OIAB settings PIN.</p>
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" aria-label="Settings PIN">
        <button type="submit">Open Settings</button>
        <div class="oiab-pin-error" role="status"></div>
      </form>
    `;
    document.body.appendChild(gate);
    const form = gate.querySelector("form");
    const input = gate.querySelector("input");
    const error = gate.querySelector(".oiab-pin-error");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (String(input.value || "") === String(settings.settings_pin || "")) {
        rememberUnlock(settings.settings_pin_timeout_minutes ?? 5);
        gate.remove();
        document.documentElement.classList.remove("oiab-settings-locked");
        done();
      } else {
        error.textContent = "Incorrect PIN.";
        input.select();
      }
    });
    setTimeout(() => input.focus(), 50);
  }

  async function requireSettingsPin(done = () => {}) {
    injectStyles();
    document.documentElement.classList.add("oiab-settings-locked");
    try {
      const settings = await loadSettings();
      if (!settings.settings_pin || pinUnlocked()) {
        document.documentElement.classList.remove("oiab-settings-locked");
        done();
        return;
      }
      showGate(settings, done);
    } catch (error) {
      showGate({ settings_pin: "__blocked__", settings_pin_timeout_minutes: 0 }, () => {});
      const message = document.querySelector(".oiab-pin-error");
      if (message) message.textContent = `Settings lock unavailable: ${error.message}`;
    }
  }

  window.OIABSettingsPinGuard = { requireSettingsPin };
})();
