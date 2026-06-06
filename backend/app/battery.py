from __future__ import annotations

import os
import stat
import threading
import time
from datetime import datetime
from typing import Any


X1206_SOURCE = "x1206"
DEFAULT_I2C_BUS = 1
DEFAULT_I2C_ADDRESS = 0x36
DEFAULT_CACHE_SECONDS = 6.0

_CACHE_LOCK = threading.Lock()
_CACHE: dict[str, Any] | None = None
_CACHE_TIME = 0.0
_SAMPLES: list[tuple[float, float]] = []


def swap_word(value: int) -> int:
    return ((int(value) & 0xFF) << 8) | ((int(value) >> 8) & 0xFF)


def clamp_percentage(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def percentage_from_raw(raw_word: int) -> float:
    return clamp_percentage(swap_word(raw_word) / 256.0)


def voltage_from_raw(raw_word: int) -> float:
    return swap_word(raw_word) * 78.125 / 1_000_000.0


def _load_smbus() -> Any:
    try:
        from smbus2 import SMBus  # type: ignore

        return SMBus
    except Exception:
        pass
    try:
        from smbus import SMBus  # type: ignore

        return SMBus
    except Exception as exc:
        raise RuntimeError("I2C Python library unavailable") from exc


def _safe_error(exc: BaseException) -> str:
    message = str(exc).strip() or exc.__class__.__name__
    message = message.replace("\n", " ")
    if len(message) > 140:
        message = message[:137] + "..."
    return message


def _status_from_trend(percentage: float, now: float) -> tuple[str, str, bool | None]:
    _SAMPLES.append((now, percentage))
    cutoff = now - 90.0
    while len(_SAMPLES) > 8 or (_SAMPLES and _SAMPLES[0][0] < cutoff):
        _SAMPLES.pop(0)
    if len(_SAMPLES) < 2:
        return "unknown", "Battery available", None
    first = _SAMPLES[0][1]
    delta = percentage - first
    if delta > 0.15:
        return "charging", "Charging", True
    if delta < -0.15:
        return "discharging", "On battery", False
    return "unknown", "Battery available", None


def read_x1206_battery_uncached() -> dict[str, Any]:
    bus_number = int(os.environ.get("OIAB_X1206_I2C_BUS", os.environ.get("OIAB_I2C_BUS", DEFAULT_I2C_BUS)))
    address_text = os.environ.get("OIAB_X1206_I2C_ADDRESS", os.environ.get("OIAB_I2C_ADDRESS", hex(DEFAULT_I2C_ADDRESS)))
    address = int(str(address_text), 0)
    device_path = os.environ.get("OIAB_I2C_DEVICE", f"/dev/i2c-{bus_number}")
    try:
        device_stat = os.stat(device_path)
        if not stat.S_ISCHR(device_stat.st_mode) or os.major(device_stat.st_rdev) != 89:
            return {"available": False, "source": X1206_SOURCE, "error": f"I2C device not mapped: {device_path}"}
    except OSError as exc:
        return {"available": False, "source": X1206_SOURCE, "error": _safe_error(exc)}
    try:
        SMBus = _load_smbus()
        bus = SMBus(bus_number)
    except Exception as exc:
        return {"available": False, "source": X1206_SOURCE, "error": _safe_error(exc)}

    try:
        raw_voltage = bus.read_word_data(address, 0x02)
        raw_percentage = bus.read_word_data(address, 0x04)
    except Exception as exc:
        return {"available": False, "source": X1206_SOURCE, "error": _safe_error(exc)}
    finally:
        close = getattr(bus, "close", None)
        if callable(close):
            try:
                close()
            except Exception:
                pass

    now = time.time()
    percentage = percentage_from_raw(raw_percentage)
    voltage = voltage_from_raw(raw_voltage)
    status, label, external_power = _status_from_trend(percentage, now)
    result: dict[str, Any] = {
        "available": True,
        "source": X1206_SOURCE,
        "percentage": round(percentage),
        "percentageExact": round(percentage, 2),
        "voltage": round(voltage, 3),
        "chargingStatus": status,
        "label": label,
        "updatedAt": datetime.now().isoformat(),
    }
    if external_power is not None:
        result["externalPower"] = external_power
    return result


def read_x1206_battery() -> dict[str, Any]:
    global _CACHE, _CACHE_TIME
    cache_seconds = float(os.environ.get("OIAB_X1206_CACHE_SECONDS", DEFAULT_CACHE_SECONDS))
    now = time.monotonic()
    with _CACHE_LOCK:
        if _CACHE is not None and now - _CACHE_TIME < cache_seconds:
            return dict(_CACHE)
        result = read_x1206_battery_uncached()
        _CACHE = dict(result)
        _CACHE_TIME = now
        return result
