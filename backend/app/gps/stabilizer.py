from __future__ import annotations

from dataclasses import dataclass
from math import atan2, cos, radians, sin, sqrt
from time import time
from typing import Any


GPS_STALE_SECONDS = 5
GPS_MAX_HDOP = 3.0
GPS_MAX_ACCURACY_M = 75
GPS_STATIONARY_SPEED_MPH = 2.0
GPS_STATIONARY_DRIFT_RADIUS_M = 20
GPS_STATIONARY_EXIT_CONFIRM_FIXES = 3
GPS_MOVING_SMOOTHING_ALPHA = 0.30
GPS_MIN_DISPLAY_MOVE_M = 5
GPS_TRACK_MIN_SPEED_MPH = 2.0
GPS_TRACK_MIN_DISTANCE_M = 10
GPS_TRACK_MIN_INTERVAL_SECONDS = 1


def meters_between(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    radius = 6371000
    lat1 = radians(a_lat)
    lat2 = radians(b_lat)
    d_lat = radians(b_lat - a_lat)
    d_lon = radians(b_lon - a_lon)
    h = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lon / 2) ** 2
    return 2 * radius * atan2(sqrt(h), sqrt(max(0, 1 - h)))


def valid_coord(lat: Any, lon: Any) -> bool:
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (TypeError, ValueError):
        return False
    return -90 <= lat_f <= 90 and -180 <= lon_f <= 180


@dataclass
class StabilizerState:
    stable: dict[str, Any] | None = None
    stationary_anchor: tuple[float, float] | None = None
    moving_confirm_count: int = 0
    mode: str = "uninitialized"


class LocationStabilizer:
    def __init__(self) -> None:
        self.state = StabilizerState()

    def reject_reason(self, raw: dict[str, Any]) -> str | None:
        if not valid_coord(raw.get("lat"), raw.get("lon")):
            return "invalid_coordinates"
        age = raw.get("age_seconds")
        if isinstance(age, (int, float)) and age > GPS_STALE_SECONDS:
            return "stale"
        fix_mode = raw.get("fix_mode")
        if isinstance(fix_mode, (int, float)) and fix_mode < 2:
            return "no_fix"
        hdop = raw.get("hdop")
        if isinstance(hdop, (int, float)) and hdop > GPS_MAX_HDOP:
            return "poor_hdop"
        accuracy = raw.get("accuracy_m")
        if isinstance(accuracy, (int, float)) and accuracy > GPS_MAX_ACCURACY_M:
            return "poor_accuracy"
        return None

    def update(self, raw: dict[str, Any], source: str = "usb_gps") -> dict[str, Any]:
        now = time()
        reason = self.reject_reason(raw)
        if reason:
            return {
                "source": source,
                "active_source": source,
                "available": True,
                "valid": False,
                "reason": reason,
                "raw": raw,
                "stable": self.state.stable,
                "timestamp": raw.get("timestamp"),
            }

        lat = float(raw["lat"])
        lon = float(raw["lon"])
        speed_mph = float(raw.get("speed_mph") or 0)
        previous = self.state.stable
        distance_from_anchor = None

        if self.state.stationary_anchor:
            distance_from_anchor = meters_between(lat, lon, *self.state.stationary_anchor)

        stationary_candidate = speed_mph < GPS_STATIONARY_SPEED_MPH
        if previous is None:
            stable_lat, stable_lon = lat, lon
            self.state.stationary_anchor = (lat, lon) if stationary_candidate else None
            self.state.mode = "stationary_lock" if stationary_candidate else "moving_smooth"
        elif stationary_candidate and (self.state.stationary_anchor is None or (distance_from_anchor is not None and distance_from_anchor <= GPS_STATIONARY_DRIFT_RADIUS_M)):
            anchor = self.state.stationary_anchor or (float(previous["lat"]), float(previous["lon"]))
            self.state.stationary_anchor = anchor
            stable_lat, stable_lon = anchor
            self.state.mode = "stationary_lock"
            self.state.moving_confirm_count = 0
        else:
            self.state.moving_confirm_count += 1
            if self.state.mode == "stationary_lock" and self.state.moving_confirm_count < GPS_STATIONARY_EXIT_CONFIRM_FIXES:
                anchor = self.state.stationary_anchor or (float(previous["lat"]), float(previous["lon"]))
                stable_lat, stable_lon = anchor
            else:
                stable_lat = float(previous["lat"]) * (1 - GPS_MOVING_SMOOTHING_ALPHA) + lat * GPS_MOVING_SMOOTHING_ALPHA
                stable_lon = float(previous["lon"]) * (1 - GPS_MOVING_SMOOTHING_ALPHA) + lon * GPS_MOVING_SMOOTHING_ALPHA
                self.state.stationary_anchor = None
                self.state.mode = "moving_smooth"

        raw_offset = meters_between(stable_lat, stable_lon, lat, lon)
        stable = {
            **raw,
            "lat": stable_lat,
            "lon": stable_lon,
            "speed_mph": 0 if self.state.mode == "stationary_lock" else raw.get("speed_mph", 0),
            "speed_mps": 0 if self.state.mode == "stationary_lock" else raw.get("speed_mps", 0),
            "stationary": self.state.mode == "stationary_lock",
            "stabilized": True,
            "stabilization_mode": self.state.mode,
            "distance_from_raw_m": round(raw_offset, 2),
            "emitted_at": now,
        }
        self.state.stable = stable
        return {
            "source": source,
            "active_source": source,
            "available": True,
            "valid": True,
            "raw": raw,
            "stable": stable,
            "lat": stable["lat"],
            "lon": stable["lon"],
            "alt_m": stable.get("alt_m"),
            "speed_mps": stable.get("speed_mps"),
            "speed_mph": stable.get("speed_mph"),
            "heading_deg": stable.get("heading_deg"),
            "accuracy_m": stable.get("accuracy_m"),
            "hdop": stable.get("hdop"),
            "satellites_used": stable.get("satellites_used"),
            "satellites_visible": stable.get("satellites_visible"),
            "fix_mode": stable.get("fix_mode"),
            "timestamp": stable.get("timestamp"),
            "age_seconds": stable.get("age_seconds"),
            "stationary": stable.get("stationary"),
            "stabilization_mode": stable.get("stabilization_mode"),
        }


STABILIZER = LocationStabilizer()
