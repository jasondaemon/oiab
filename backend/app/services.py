from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from .config import REPO_ROOT, Settings


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


def docker_compose_state(service_id: str) -> str:
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "--status", "running", "--format", "json", service_id],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            timeout=2.5,
            check=False,
        )
        return "active" if result.stdout.strip() else "inactive"
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"


def docker_compose_exists(service_id: str) -> bool:
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "-a", "--format", "json", service_id],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            timeout=2.5,
            check=False,
        )
        return bool(result.stdout.strip())
    except (OSError, subprocess.TimeoutExpired):
        return False


def marker_has_content(marker: Path) -> bool:
    try:
        if not marker.exists():
            return False
        if marker.is_file():
            return marker.stat().st_size > 0
        return any(marker.iterdir())
    except OSError:
        return False


def service_action(settings: Settings, service_id: str, action: str) -> dict[str, Any]:
    if not settings.allow_docker_control:
        return {
            "ok": False,
            "error": "Docker service control is disabled. Set OIAB_ALLOW_DOCKER_CONTROL=true on the host to enable install/start/stop/remove.",
            "allow_docker_control": False,
        }
    if action not in {"install", "start", "stop", "restart", "remove"}:
        return {"ok": False, "error": f"Unsupported service action: {action}"}
    if action in {"install", "start", "restart"}:
        cmd = ["docker", "compose", "--profile", service_id, "up", "-d", service_id]
    elif action == "stop":
        cmd = ["docker", "compose", "stop", service_id]
    else:
        cmd = ["docker", "compose", "rm", "-sf", service_id]
    result = subprocess.run(cmd, cwd=REPO_ROOT, text=True, capture_output=True, timeout=120, check=False)
    return {
        "ok": result.returncode == 0,
        "service": service_id,
        "action": action,
        "returncode": result.returncode,
        "stdout": result.stdout[-4000:],
        "stderr": result.stderr[-4000:],
    }


def list_services(settings: Settings | None = None) -> list[dict[str, Any]]:
    services = []
    for path in sorted(MANIFEST_DIR.glob("*.yml")):
        item = parse_simple_yaml(path)
        unit = item.get("systemd_unit")
        marker = Path(str(item.get("installed_marker") or ""))
        state = docker_compose_state(str(item.get("id"))) if item.get("runtime") == "docker" else systemctl_state(str(unit) if unit else None)
        installed = (
            docker_compose_exists(str(item.get("id")))
            if item.get("runtime") == "docker"
            else marker_has_content(marker)
        )
        if not installed and item.get("installed_marker"):
            installed = marker_has_content(marker)
        active = state in {"active", "running"}
        services.append(
            {
                **item,
                "label": item.get("name") or item.get("id"),
                "manifest": path.name,
                "installed": installed,
                "state": state,
                "active": active,
                "running": active,
                "optional": True,
                "data_path": str(marker) if item.get("installed_marker") else "",
                "allow_docker_control": bool(settings.allow_docker_control) if settings else False,
            }
        )
    return services
