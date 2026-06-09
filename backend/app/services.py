from __future__ import annotations

import json
import os
import socket
import sqlite3
import subprocess
import time
from pathlib import Path
from typing import Any

from .config import REPO_ROOT, Settings


MANIFEST_DIR = REPO_ROOT / "services" / "manifests"
DOCKER_SOCKET = Path(os.environ.get("OIAB_DOCKER_SOCKET", "/var/run/docker.sock"))


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


def docker_socket_request(method: str, path: str) -> tuple[int, Any]:
    if not DOCKER_SOCKET.exists():
        return 503, {"ok": False, "error": f"Docker socket not mounted: {DOCKER_SOCKET}"}
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(60)
            sock.connect(str(DOCKER_SOCKET))
            request = f"{method} {path} HTTP/1.1\r\nHost: docker\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            sock.sendall(request.encode("utf-8"))
            chunks: list[bytes] = []
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                chunks.append(chunk)
        raw = b"".join(chunks)
        header, _, body = raw.partition(b"\r\n\r\n")
        status_line = header.splitlines()[0].decode("utf-8", errors="replace") if header else "HTTP/1.1 500"
        status = int(status_line.split()[1])
        headers = {}
        for line in header.splitlines()[1:]:
            if b":" in line:
                key, value = line.split(b":", 1)
                headers[key.decode("utf-8", errors="replace").lower()] = value.decode("utf-8", errors="replace").strip().lower()
        if headers.get("transfer-encoding") == "chunked":
            decoded = bytearray()
            rest = body
            while rest:
                size_raw, _, rest = rest.partition(b"\r\n")
                try:
                    size = int(size_raw.split(b";", 1)[0], 16)
                except ValueError:
                    break
                if size == 0:
                    break
                decoded.extend(rest[:size])
                rest = rest[size + 2 :]
            body = bytes(decoded)
        if body:
            try:
                return status, json.loads(body.decode("utf-8"))
            except json.JSONDecodeError:
                return status, body.decode("utf-8", errors="replace")
        return status, {}
    except OSError as exc:
        return 503, {"ok": False, "error": str(exc)}


def docker_containers(settings: Settings) -> dict[str, Any]:
    if not settings.allow_docker_control:
        return {"ok": True, "available": False, "error": "Docker control disabled.", "containers": []}
    status, payload = docker_socket_request("GET", "/v1.43/containers/json?all=1")
    if status >= 400:
        return {"ok": False, "available": False, "error": payload.get("error") if isinstance(payload, dict) else str(payload), "containers": []}
    containers = []
    for item in payload if isinstance(payload, list) else []:
        containers.append(
            {
                "id": str(item.get("Id") or "")[:12],
                "name": str((item.get("Names") or [""])[0]).lstrip("/"),
                "image": item.get("Image"),
                "state": item.get("State"),
                "status": item.get("Status"),
                "ports": item.get("Ports") or [],
            }
        )
    return {"ok": True, "available": True, "containers": sorted(containers, key=lambda item: item["name"])}


def docker_container_action(settings: Settings, container: str, action: str) -> dict[str, Any]:
    if not settings.allow_docker_control:
        return {"ok": False, "error": "Docker control disabled."}
    if action not in {"start", "stop", "restart"}:
        return {"ok": False, "error": f"Unsupported container action: {action}"}
    suffix = "?t=1" if action == "restart" else ""
    status, payload = docker_socket_request("POST", f"/v1.43/containers/{container}/{action}{suffix}")
    if status in {204, 304} or (action == "start" and status == 304):
        return {"ok": True, "container": container, "action": action}
    if status < 300:
        return {"ok": True, "container": container, "action": action, "response": payload}
    return {"ok": False, "container": container, "action": action, "error": payload.get("message") if isinstance(payload, dict) else str(payload)}


def docker_container_lookup(settings: Settings, container: str | None) -> dict[str, Any] | None:
    if not container or not settings.allow_docker_control:
        return None
    snapshot = docker_containers(settings)
    for item in snapshot.get("containers", []):
        if item.get("name") == container or item.get("id") == container:
            return item
    return None


def crafty_set_flags(settings: Settings, *, auto_start: bool, crash_detection: bool) -> dict[str, Any]:
    if not settings.crafty_db.exists():
        return {"ok": False, "error": f"Crafty DB not found: {settings.crafty_db}"}
    try:
        with sqlite3.connect(settings.crafty_db) as conn:
            cursor = conn.execute(
                """
                update servers
                set auto_start = ?, crash_detection = ?
                where server_name = ?
                """,
                (1 if auto_start else 0, 1 if crash_detection else 0, settings.crafty_server_name),
            )
            conn.commit()
        return {"ok": cursor.rowcount > 0, "updated": cursor.rowcount, "server": settings.crafty_server_name}
    except sqlite3.Error as exc:
        return {"ok": False, "error": str(exc), "server": settings.crafty_server_name}


def crafty_server_info(settings: Settings) -> dict[str, Any]:
    if not settings.crafty_db.exists():
        return {"ok": False, "error": f"Crafty DB not found: {settings.crafty_db}"}
    try:
        with sqlite3.connect(settings.crafty_db) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                """
                select server_id, server_name, auto_start, crash_detection, show_status
                from servers
                where server_name = ?
                order by created desc
                limit 1
                """,
                (settings.crafty_server_name,),
            ).fetchone()
        return {"ok": bool(row), **(dict(row) if row else {"server_name": settings.crafty_server_name})}
    except sqlite3.Error as exc:
        return {"ok": False, "error": str(exc), "server_name": settings.crafty_server_name}


def minecraft_crafty_action(settings: Settings, container: str, action: str) -> dict[str, Any]:
    if action == "stop":
        flags = crafty_set_flags(settings, auto_start=False, crash_detection=False)
        restart = docker_container_action(settings, container, "restart")
        return {"ok": bool(restart.get("ok")), "craftyFlags": flags, "craftyRestart": restart}
    if action in {"start", "restart", "install"}:
        flags = crafty_set_flags(settings, auto_start=True, crash_detection=True)
        restart = docker_container_action(settings, container, "restart")
        return {"ok": bool(restart.get("ok")), "craftyFlags": flags, "craftyRestart": restart}
    if action == "remove":
        return minecraft_crafty_action(settings, container, "stop")
    return {"ok": False, "error": f"Unsupported Minecraft action: {action}"}


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
    external_container = str(manifest.get("external_container") or "") if manifest else ""
    if external_container and action in {"install", "start", "stop", "restart", "remove"}:
        if not settings.allow_docker_control:
            return {"ok": False, "error": "Docker service control is disabled."}
        if service_id == "minecraft":
            result = minecraft_crafty_action(settings, external_container, action)
        else:
            container_action = "start" if action == "install" else ("stop" if action == "remove" else action)
            result = docker_container_action(settings, external_container, container_action)
        if result.get("ok") and action in {"install", "start", "restart"}:
            service_state.update({"installed": True, "enabled": True})
            write_plugin_state(settings, state)
        if result.get("ok") and action in {"stop", "remove"}:
            service_state["enabled"] = False
            if action == "remove":
                service_state["installed"] = False
            write_plugin_state(settings, state)
        return {"ok": bool(result.get("ok")), "service": service_id, "action": action, "result": result}
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
        external_container = str(item.get("external_container") or "")
        marker = resolve_marker(settings, str(item.get("installed_marker") or ""))
        container = docker_container_lookup(settings, external_container) if settings and external_container else None
        if container:
            state = str(container.get("state") or "unknown")
            installed = True
        else:
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
        minecraft = {}
        if service_id == "minecraft" and settings:
            minecraft = crafty_server_info(settings)
            if minecraft.get("ok"):
                server_enabled = bool(minecraft.get("auto_start")) or bool(minecraft.get("crash_detection"))
                state = "running" if server_enabled else "inactive"
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
                "container": container or {},
                "minecraft": minecraft,
                "optional": not bool(item.get("core")),
                "data_path": str(marker) if item.get("installed_marker") else "",
                "allow_docker_control": bool(settings.allow_docker_control) if settings else False,
            }
        )
    return services


def list_service_visibility(settings: Settings | None = None) -> list[dict[str, Any]]:
    """Return plugin visibility without probing Docker or systemd.

    This is used by the app launcher during shell boot. The full plugin
    settings page can afford live container checks, but the launcher must not
    block on Docker/socket timeouts after storage or network changes.
    """
    services = []
    plugin_state = read_plugin_state(settings) if settings else {}
    for path in sorted(MANIFEST_DIR.glob("*.yml")):
        item = parse_simple_yaml(path)
        service_id = str(item.get("id") or "")
        saved = plugin_state.get(service_id, {}) if isinstance(plugin_state.get(service_id), dict) else {}
        marker = resolve_marker(settings, str(item.get("installed_marker") or ""))
        installed = marker_has_content(marker) if item.get("installed_marker") else bool(item.get("core"))
        if item.get("runtime") in {"asset", "manual"}:
            installed = bool(saved.get("installed")) or installed
        if saved.get("installed") is True:
            installed = True
        if saved.get("installed") is False:
            installed = False
        enabled = bool(saved.get("enabled", installed)) and installed
        services.append(
            {
                **item,
                "label": item.get("name") or item.get("id"),
                "manifest": path.name,
                "installed": installed,
                "enabled": enabled,
                "active": enabled,
                "running": False,
                "optional": not bool(item.get("core")),
                "data_path": str(marker) if item.get("installed_marker") else "",
                "allow_docker_control": bool(settings.allow_docker_control) if settings else False,
            }
        )
    return services
