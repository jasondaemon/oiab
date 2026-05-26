from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from .config import REPO_ROOT


MANIFEST_DIR = REPO_ROOT / "services" / "manifests"


def parse_simple_yaml(path: Path) -> dict[str, Any]:
    data: dict[str, Any] = {}
    current_list_key: str | None = None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("- ") and current_list_key:
            data.setdefault(current_list_key, []).append(stripped[2:].strip().strip('"'))
            continue
        if ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not value:
            data[key] = []
            current_list_key = key
            continue
        current_list_key = None
        if value.lower() in {"true", "false"}:
            data[key] = value.lower() == "true"
        else:
            data[key] = value.strip('"')
    return data


def systemctl_state(unit: str | None) -> str:
    if not unit:
        return "unknown"
    try:
        result = subprocess.run(["systemctl", "is-active", unit], text=True, capture_output=True, timeout=1.5, check=False)
        return result.stdout.strip() or result.stderr.strip() or "unknown"
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"


def list_services() -> list[dict[str, Any]]:
    services = []
    for path in sorted(MANIFEST_DIR.glob("*.yml")):
        item = parse_simple_yaml(path)
        unit = item.get("systemd_unit")
        installed = Path(str(item.get("installed_marker") or "")).exists() if item.get("installed_marker") else False
        services.append(
            {
                **item,
                "manifest": path.name,
                "installed": installed,
                "state": systemctl_state(str(unit) if unit else None),
                "optional": True,
            }
        )
    return services

