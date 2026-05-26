(() => {
  const state = {
    last: null,
    browserWatchId: null,
    browserPosition: null,
    usbValidUntil: 0,
    pollTimer: null,
    trackTimer: null,
  };

  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const coordFmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 });

  function metersToFeet(value) {
    return value * 3.280839895;
  }

  function sourceLabel(source) {
    return source === "usb_gps" ? "USB GPS" : "Browser GPS";
  }

  function fixLabel(mode) {
    if (mode >= 3) return "3D Fix";
    if (mode >= 2) return "2D Fix";
    if (mode === 1) return "No Fix";
    return "Unknown";
  }

  function directionLabel(deg) {
    if (!Number.isFinite(deg)) return "--";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return `${Math.round(deg)}° ${dirs[Math.round(deg / 45) % 8]}`;
  }

  function formatCoords(point) {
    if (Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon))) {
      return `${coordFmt.format(Number(point.lat))}, ${coordFmt.format(Number(point.lon))}`;
    }
    return "--";
  }

  function speedText(point) {
    return Number.isFinite(Number(point.speed_mph)) ? `${fmt.format(Number(point.speed_mph))} mph` : "--";
  }

  function altitudeText(point) {
    return Number.isFinite(Number(point.alt_m)) ? `${fmt.format(metersToFeet(Number(point.alt_m)))} ft` : "--";
  }

  function accuracyText(point) {
    return Number.isFinite(Number(point.accuracy_m)) ? `${fmt.format(Number(point.accuracy_m))} m` : "--";
  }

  function hdopText(point) {
    return Number.isFinite(Number(point.hdop)) ? fmt.format(Number(point.hdop)) : "--";
  }

  function ageText(point) {
    return Number.isFinite(Number(point.age_seconds)) ? `${fmt.format(Number(point.age_seconds))} sec` : "--";
  }

  function locationPoint(value, fallback = {}) {
    const point = value && typeof value === "object" ? value : {};
    return {...fallback, ...point};
  }

  function browserSnapshot(position) {
    const coords = position.coords || {};
    const timestamp = position.timestamp || Date.now();
    const speedMps = Number.isFinite(coords.speed) ? coords.speed : 0;
    const point = {
      source: "browser",
      available: true,
      valid: Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude),
      fix_mode: null,
      timestamp: new Date(timestamp).toISOString(),
      age_seconds: Math.max(0, (Date.now() - timestamp) / 1000),
      lat: coords.latitude,
      lon: coords.longitude,
      alt_m: Number.isFinite(coords.altitude) ? coords.altitude : null,
      speed_mps: speedMps,
      speed_mph: speedMps * 2.2369362921,
      heading_deg: Number.isFinite(coords.heading) ? coords.heading : null,
      accuracy_m: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
      hdop: null,
      satellites_used: null,
      satellites_visible: null,
      reason: "",
      stationary: speedMps * 2.2369362921 < 2,
      stabilized: false,
      stabilization_mode: "browser_raw",
      distance_from_raw_m: 0,
    };
    return {...point, active_source: "browser", raw: point, stable: point};
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function renderSatBars(data) {
    const holder = $("gpsSatBars");
    if (!holder) return;
    holder.replaceChildren();
    const visible = Math.max(0, Number(data.satellites_visible || 0));
    const used = Math.max(0, Number(data.satellites_used || 0));
    const total = Math.max(visible, used, 12);
    const bars = Math.min(24, total);
    for (let i = 0; i < bars; i += 1) {
      const bar = document.createElement("i");
      const active = i < used;
      const visibleOnly = i < visible;
      bar.className = active ? "" : "unused";
      const height = visibleOnly ? 22 + ((i * 17) % 68) : 12;
      bar.style.height = `${height}px`;
      bar.title = active ? "Satellite used in fix" : visibleOnly ? "Satellite visible" : "No satellite";
      holder.append(bar);
    }
  }

  function render(data) {
    state.last = data;
    const stable = locationPoint(data.stable, data);
    const raw = locationPoint(data.raw, data);
    const valid = !!data.valid;
    const source = data.active_source || data.source || stable.source || "usb_gps";
    const badge = $("gpsLockBadge");
    badge.classList.toggle("valid", valid);
    badge.classList.toggle("bad", !valid);
    badge.textContent = valid ? "Locked" : data.available === false ? "Offline" : "No Fix";
    setText("gpsSource", sourceLabel(source));

    const age = Number(stable.age_seconds ?? data.age_seconds);
    const sourceAgeText = Number.isFinite(age) ? `${fmt.format(age)}s old` : "--";
    setText("gpsUpdated", valid ? `${fixLabel(Number(stable.fix_mode || data.fix_mode || 0))} · ${stable.stabilization_mode || "stable"} · ${sourceAgeText}` : `${data.reason || stable.reason || "Waiting for location"} · ${sourceAgeText}`);

    setText("gpsSpeed", Number.isFinite(Number(stable.speed_mph)) ? fmt.format(Number(stable.speed_mph)) : "--");
    const heading = Number(stable.heading_deg);
    setText("gpsHeading", directionLabel(heading));
    $("gpsNeedle").style.transform = `rotate(${Number.isFinite(heading) ? heading : 0}deg)`;

    setText("gpsLatLon", formatCoords(stable));
    setText("gpsAltitude", altitudeText(stable));
    setText("gpsAccuracy", accuracyText(stable));
    setText("gpsHdop", hdopText(stable));
    setText("gpsFixMode", stable.fix_mode ? fixLabel(Number(stable.fix_mode)) : source === "browser" ? "Browser" : "--");
    setText("gpsAge", Number.isFinite(age) ? `${fmt.format(age)} sec` : "--");

    setText("gpsStableLatLon", formatCoords(stable));
    setText("gpsStableSpeed", speedText(stable));
    setText("gpsStableHeading", directionLabel(Number(stable.heading_deg)));
    setText("gpsStableAltitude", altitudeText(stable));
    setText("gpsStableAccuracy", accuracyText(stable));
    setText("gpsStableHdop", hdopText(stable));
    setText("gpsStableMode", stable.stabilization_mode || "--");
    setText("gpsStableStationary", stable.stationary ? "Yes" : "No");
    setText("gpsStableRawDistance", Number.isFinite(Number(stable.distance_from_raw_m)) ? `${fmt.format(Number(stable.distance_from_raw_m))} m` : "--");
    setText("gpsStableAge", ageText(stable));

    try {
      setText("gpsRawLatLon", formatCoords(raw));
      setText("gpsRawSpeed", speedText(raw));
      setText("gpsRawHeading", directionLabel(Number(raw.heading_deg)));
      setText("gpsRawAltitude", altitudeText(raw));
      setText("gpsRawAccuracy", accuracyText(raw));
      setText("gpsRawHdop", hdopText(raw));
      setText("gpsRawFixMode", raw.fix_mode ? fixLabel(Number(raw.fix_mode)) : source === "browser" ? "Browser" : "--");
      setText("gpsRawSatellites", raw.satellites_used !== null && raw.satellites_used !== undefined ? `${raw.satellites_used}/${raw.satellites_visible ?? "?"}` : source === "browser" ? "phone assisted" : "--");
      setText("gpsRawAge", ageText(raw));
    } catch (error) {
      setText("gpsRawLatLon", `Raw render failed: ${error.message || error}`);
    }

    const used = raw.satellites_used;
    const visible = raw.satellites_visible;
    setText("gpsSatCount", used !== null && used !== undefined ? `${used}/${visible ?? "?"} used` : source === "browser" ? "phone assisted" : "--");
    renderSatBars(raw);

    setText("gpsReceiverState", data.available === false ? "gpsd unavailable" : valid ? "active" : (data.reason || "waiting"));
    setText("gpsDevice", data.device || (source === "browser" ? "Mobile device browser" : "--"));
    setText("gpsDriver", data.driver || (source === "browser" ? "Browser Geolocation API" : "--"));
    setText("gpsChipset", data.chipset || "--");
    setText("gpsTimestamp", data.timestamp || "--");
    setText("gpsRaw", JSON.stringify(data, null, 2));
  }

  function renderTrackStatus(track) {
    const card = $("gpsTrackCard");
    if (!card) return;
    const status = String(track?.status || "inactive").toLowerCase();
    const active = status === "recording";
    card.classList.toggle("is-active", active);
    setText("gpsTrackStatus", active ? "Active" : "Inactive");
    if (!track || !track.id) {
      setText("gpsTrackDetail", "Recorded tracks appear in the Recorded folder.");
      return;
    }
    const points = Number(track.points || 0);
    const distance = Number(track.distance_m || 0);
    const folder = "Recorded";
    const pieces = [
      `${points} point${points === 1 ? "" : "s"}`,
      Number.isFinite(distance) && distance > 0 ? `${fmt.format(distance)} m` : "",
      track.source ? String(track.source).replace("_", " ") : "",
    ].filter(Boolean);
    setText("gpsTrackDetail", `${pieces.join(" · ")} · folder: ${folder}`);
  }

  async function pollTrackStatus() {
    try {
      const response = await fetch(`/maps-tracks-current?_=${Date.now()}`, {
        cache: "no-store",
        headers: {"Cache-Control": "no-cache"},
      });
      if (!response.ok) throw new Error(`Track endpoint ${response.status}`);
      const data = await response.json();
      renderTrackStatus(data.track || {});
    } catch (error) {
      renderTrackStatus({status: "inactive", error: error.message});
    }
  }

  function ensureBrowserFallback() {
    if (state.browserWatchId !== null || !("geolocation" in navigator) || !window.isSecureContext) return;
    state.browserWatchId = navigator.geolocation.watchPosition(
      (position) => {
        state.browserPosition = browserSnapshot(position);
        if (Date.now() > state.usbValidUntil) render(state.browserPosition);
      },
      (error) => {
        if (Date.now() > state.usbValidUntil) {
          render({
            source: "browser",
            available: false,
            valid: false,
            reason: error.message || "browser_location_unavailable",
            timestamp: new Date().toISOString(),
            age_seconds: 0,
          });
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  async function pollUsbGps() {
    try {
      const response = await fetch(`/maps-location-current?_=${Date.now()}`, {
        cache: "no-store",
        headers: {"Cache-Control": "no-cache"},
      });
      if (!response.ok) throw new Error(`GPS endpoint ${response.status}`);
      const data = await response.json();
      if (data.valid) {
        state.usbValidUntil = Date.now() + 3500;
        render(data);
      } else if (Date.now() > state.usbValidUntil) {
        render(data);
        ensureBrowserFallback();
      }
    } catch (error) {
      if (Date.now() > state.usbValidUntil) {
        render({
          source: "usb_gps",
          available: false,
          valid: false,
          reason: error.message,
          timestamp: new Date().toISOString(),
          age_seconds: 0,
        });
        ensureBrowserFallback();
      }
    }
  }

  function goBack() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "overland-close-overlay" }, "*");
      return;
    }
    window.location.href = "/mobile/";
  }

  async function copyCoords() {
    if (!state.last || !Number.isFinite(Number(state.last.lat)) || !Number.isFinite(Number(state.last.lon))) return;
    const text = `${state.last.lat}, ${state.last.lon}`;
    try {
      await navigator.clipboard.writeText(text);
      $("gpsCopyCoords").textContent = "Copied";
      window.setTimeout(() => { $("gpsCopyCoords").textContent = "Copy coordinates"; }, 1400);
    } catch (_error) {
      $("gpsCopyCoords").textContent = text;
    }
  }

  function main() {
    $("gpsBack").addEventListener("click", goBack);
    $("gpsRefresh").addEventListener("click", pollUsbGps);
    $("gpsCopyCoords").addEventListener("click", copyCoords);
    pollUsbGps();
    pollTrackStatus();
    state.pollTimer = window.setInterval(pollUsbGps, 1000);
    state.trackTimer = window.setInterval(pollTrackStatus, 2000);
    window.addEventListener("pagehide", () => {
      if (state.pollTimer) window.clearInterval(state.pollTimer);
      if (state.trackTimer) window.clearInterval(state.trackTimer);
      if (state.browserWatchId !== null) navigator.geolocation.clearWatch(state.browserWatchId);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();
