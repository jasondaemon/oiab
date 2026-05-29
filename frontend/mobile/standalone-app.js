(() => {
  const app = document.body.dataset.standaloneApp || "";

  function goHome() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "oiab:home" }, window.location.origin);
      return;
    }
    window.location.href = "/";
  }

  function forceMusicFullscreen() {
    const panel = document.getElementById("omPlayer");
    if (!panel) return;
    panel.classList.add("is-full");
    document.body.classList.add("od-music-full");
    document.body.classList.remove("od-music-side");
  }

  function showError(text) {
    document.body.innerHTML = `<div class="standalone-error">${text}</div>`;
  }

  function openApp() {
    if (app === "music" && window.overlandMusic) {
      window.overlandMusic.open();
      forceMusicFullscreen();
      window.setTimeout(forceMusicFullscreen, 120);
      return;
    }
    if (app === "license-plates" && window.overlandPlates) {
      window.overlandPlates.open();
      return;
    }
    if (app === "trivia" && window.overlandTrivia) {
      window.overlandTrivia.open();
      return;
    }
    if (app === "drums" && window.overlandDrums) {
      window.overlandDrums.open();
      return;
    }
    if (app === "emulator" && window.overlandEmulator) {
      window.overlandEmulator.open();
      return;
    }
    showError("This app did not load correctly.");
  }

  document.addEventListener("click", (event) => {
    const close = event.target.closest?.("#opClose, #otClose, #omClose, #odrClose, #oeClose");
    if (!close) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    goHome();
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", openApp, { once: true });
  } else {
    openApp();
  }
})();
