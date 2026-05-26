from __future__ import annotations

import json
import socket
from datetime import datetime, timezone
from time import time
from typing import Any

from .stabilizer import STABILIZER


def parse_iso(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def read_gpsd(timeout: float = 1.1) -> dict[str, Any]:
    try:
        with socket.create_connection(("127.0.0.1", 2947), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(b'?WATCH={"enable":true,"json":true};\n?POLL;\n')
            chunks: list[bytes] = []
            deadline = time() + timeout
            while time() < deadline:
                try:
                    chunk = sock.recv(8192)
                except socket.timeout:
                    break
                if not chunk:
                    break
                chunks.append(chunk)
                if b"\n" in chunk and b'"class":"POLL"' in b"".join(chunks):
                    break
    except OSError:
        return {"source": "usb_gps", "available": False, "valid": False, "reason": "gpsd_unavailable"}

    payload = b"".join(chunks).decode("utf-8", errors="replace")
    tpv: dict[str, Any] = {}
    sky: dict[str, Any] = {}
    devices: list[dict[str, Any]] = []
    for line in payload.splitlines():
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        cls = item.get("class")
        if cls == "TPV":
            tpv = item
        elif cls == "SKY":
            sky = item
        elif cls == "DEVICES":
            devices = item.get("devices") or []
        elif cls == "POLL":
            if item.get("tpv"):
                tpv = item["tpv"][-1]
            if item.get("sky"):
                sky = item["sky"][-1]

    if not tpv:
        return {"source": "usb_gps", "available": True, "valid": False, "reason": "no_tpv"}

    ts = parse_iso(tpv.get("time"))
    now = time()
    satellites = sky.get("satellites") or []
    used = len([sat for sat in satellites if sat.get("used")])
    visible = len(satellites)
    mode = int(tpv.get("mode") or 0)
    raw = {
        "lat": tpv.get("lat"),
        "lon": tpv.get("lon"),
        "alt_m": tpv.get("altHAE", tpv.get("altMSL", tpv.get("alt"))),
        "speed_mps": tpv.get("speed"),
        "speed_mph": (float(tpv.get("speed") or 0) * 2.2369362921),
        "heading_deg": tpv.get("track"),
        "accuracy_m": tpv.get("eph") or tpv.get("epx"),
        "hdop": sky.get("hdop"),
        "satellites_used": used or None,
        "satellites_visible": visible or None,
        "fix_mode": mode,
        "timestamp": tpv.get("time") or datetime.now(timezone.utc).isoformat(),
        "age_seconds": round(now - ts, 3) if ts else None,
        "receiver": {
            "device": (devices[0].get("path") if devices else tpv.get("device")) or "--",
            "driver": (devices[0].get("driver") if devices else None) or "--",
            "chipset": (devices[0].get("subtype") if devices else None) or "--",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        "satellites": satellites,
        "raw_tpv": tpv,
        "raw_sky": sky,
    }
    if raw["lat"] is None or raw["lon"] is None:
        return {"source": "usb_gps", "available": True, "valid": False, "reason": "no_fix", "raw": raw}
    return STABILIZER.update(raw, "usb_gps")

