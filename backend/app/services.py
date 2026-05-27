from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from .config import REPO_ROOT, Settings


MANIFEST_DIR = REPO_ROOT / "services" / "manifests"


def plugin_state_file(settings: Settings) -> Path:
    target = settings.data_dir / "config" / "plugins.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def read_plugin_state(settings: Settings) -> dict[str, Any]:
    path = plugin_state_file(settings)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_plugin_state(settings: Settings, data: dict[str, Any]) -> None:
    path = plugin_state_file(settings)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


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


def resolve_marker(settings: Settings | None, value: str | None) -> Path:
    raw = str(value or "")
    if settings and raw.startswith("/data/oiab/"):
        return settings.data_dir / raw.removeprefix("/data/oiab/")
    return Path(raw)


def service_action(settings: Settings, service_id: str, action: str) -> dict[str, Any]:
    manifests = {str(item.get("id")): item for item in (parse_simple_yaml(path) for path in MANIFEST_DIR.glob("*.yml"))}
    manifest = manifests.get(service_id)
    state = read_plugin_state(settings)
    service_state = state.setdefault(service_id, {})
    if action in {"enable", "disable", "options"}:
        if not manifest:
            return {"ok": False, "error": f"Unknown plugin: {service_id}"}
        service_state["enabled"] = action == "enable"
        if action == "enable":
            service_state["installed"] = True
        write_plugin_state(settings, state)
        return {"ok": True, "service": service_id, "action": action, "enabled": service_state["enabled"]}
    if action == "install" and manifest and manifest.get("runtime") in {"asset", "manual"}:
        marker = resolve_marker(settings, str(manifest.get("installed_marker") or settings.data_dir / "services" / service_id))
        installer = str(manifest.get("installer_script") or "")
        stdout = ""
        stderr = ""
        returncode = 0
        if installer:
            script = (REPO_ROOT / installer).resolve()
            if REPO_ROOT not in script.parents:
                return {"ok": False, "error": f"Invalid installer script path: {installer}"}
            if not script.exists():
                return {"ok": False, "error": f"Installer script is missing: {script}"}
            env = dict(os.environ)
            env.setdefault("OIAB_DATA_DIR", str(settings.data_dir))
            env.setdefault("OIAB_EMULATORJS_DIR", str(settings.data_dir / "services" / service_id / "data"))
            result = subprocess.run([str(script)], cwd=REPO_ROOT, env=env, text=True, capture_output=True, timeout=900, check=False)
            stdout = result.stdout[-4000:]
            stderr = result.stderr[-4000:]
            returncode = result.returncode
            if result.returncode != 0:
                return {
                    "ok": False,
                    "service": service_id,
                    "action": action,
                    "returncode": result.returncode,
                    "stdout": stdout,
                    "stderr": stderr,
                }
        else:
            marker.mkdir(parents=True, exist_ok=True)
        service_state.update({"installed": True, "enabled": True})
        write_plugin_state(settings, state)
        return {
            "ok": True,
            "service": service_id,
            "action": action,
            "returncode": returncode,
            "stdout": stdout or f"Marked {manifest.get('name') or service_id} installed at {marker}.",
            "stderr": stderr,
        }
    if action == "remove" and manifest and manifest.get("runtime") in {"asset", "manual"}:
        service_state.update({"installed": False, "enabled": False})
        write_plugin_state(settings, state)
        return {"ok": True, "service": service_id, "action": action}
    if not settings.allow_docker_control:
        return {
            "ok": False,
            "error": "Docker service control is disabled. Run the displayed install command on the host, or set OIAB_ALLOW_DOCKER_CONTROL=true where Docker Compose is available.",
            "allow_docker_control": False,
            "install_command": manifest.get("install_command") if manifest else "",
        }
    if action not in {"install", "start", "stop", "restart", "remove"}:
        return {"ok": False, "error": f"Unsupported service action: {action}"}
    compose_profile = str(manifest.get("compose_profile") or service_id) if manifest else service_id
    compose_service = str(manifest.get("compose_service") or service_id) if manifest else service_id
    if action in {"install", "start", "restart"}:
        cmd = ["docker", "compose", "--profile", compose_profile, "up", "-d", compose_service]
    elif action == "stop":
        cmd = ["docker", "compose", "stop", compose_service]
    else:
        cmd = ["docker", "compose", "rm", "-sf", compose_service]
    result = subprocess.run(cmd, cwd=REPO_ROOT, text=True, capture_output=True, timeout=120, check=False)
    if result.returncode == 0 and action in {"install", "start", "restart"}:
        service_state.update({"installed": True, "enabled": True})
        write_plugin_state(settings, state)
    if result.returncode == 0 and action == "stop":
        service_state["enabled"] = False
        write_plugin_state(settings, state)
    if result.returncode == 0 and action == "remove":
        service_state.update({"installed": False, "enabled": False})
        write_plugin_state(settings, state)
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
    plugin_state = read_plugin_state(settings) if settings else {}
    for path in sorted(MANIFEST_DIR.glob("*.yml")):
        item = parse_simple_yaml(path)
        service_id = str(item.get("id") or "")
        saved = plugin_state.get(service_id, {}) if isinstance(plugin_state.get(service_id), dict) else {}
        unit = item.get("systemd_unit")
        marker = resolve_marker(settings, str(item.get("installed_marker") or ""))
        state = docker_compose_state(service_id) if item.get("runtime") == "docker" else systemctl_state(str(unit) if unit else None)
        installed = (
            docker_compose_exists(service_id)
            if item.get("runtime") == "docker"
            else marker_has_content(marker)
        )
        if item.get("runtime") in {"asset", "manual"}:
            installed = bool(saved.get("installed")) or marker.exists()
            state = "active" if bool(saved.get("enabled")) and installed else "inactive"
        if not installed and item.get("installed_marker"):
            installed = marker_has_content(marker)
        if saved.get("installed") is True:
            installed = True
        if saved.get("installed") is False:
            installed = False
        active = state in {"active", "running"}
        enabled = bool(saved.get("enabled", active if installed else False)) and installed
        services.append(
            {
                **item,
                "label": item.get("name") or item.get("id"),
                "manifest": path.name,
                "installed": installed,
                "state": state,
                "active": active,
                "running": active,
                "enabled": enabled,
                "optional": True,
                "data_path": str(marker) if item.get("installed_marker") else "",
                "allow_docker_control": bool(settings.allow_docker_control) if settings else False,
            }
        )
    return services
