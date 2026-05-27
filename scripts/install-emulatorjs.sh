#!/usr/bin/env bash
set -euo pipefail

DEST="${OIAB_EMULATORJS_DIR:-${OVERLAND_EMULATORJS_DIR:-${OIAB_DATA_DIR:-/data/oiab}/services/emulatorjs/data}}"
BASE_URL="${OIAB_EMULATORJS_URL:-${OVERLAND_EMULATORJS_URL:-https://cdn.emulatorjs.org/stable/data}}"

export DEST BASE_URL

python - <<'PY'
import os
import re
import shutil
import stat
import sys
import tempfile
import urllib.request
from pathlib import Path

dest = Path(os.environ["DEST"])
base_url = os.environ["BASE_URL"].rstrip("/")

cores = [
    "beetle_vb",
    "desmume",
    "fbneo",
    "fceumm",
    "gambatte",
    "genesis_plus_gx",
    "mame2003",
    "mednafen_wswan",
    "mgba",
    "mupen64plus_next",
    "pcsx_rearmed",
    "snes9x",
    "stella2014",
]
root_files = [
    "emulator.min.css",
    "emulator.min.js",
    "loader.js",
    "version.json",
]
compression_files = [
    "extract7z.js",
    "extractzip.js",
    "libunrar.js",
    "libunrar.wasm",
]


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "OIAB-EmulatorJS-Installer/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def download(relative: str, target: Path) -> None:
    if target.exists() and target.stat().st_size > 0:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    url = f"{base_url}/{relative}"
    print(f"Downloading {relative}", flush=True)
    payload = fetch_bytes(url)
    if not payload:
        raise RuntimeError(f"Empty response for {url}")
    fd, tmp_name = tempfile.mkstemp(prefix=target.name, suffix=".part", dir=str(target.parent))
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
        tmp.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
        tmp.replace(target)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


dest.mkdir(parents=True, exist_ok=True)
(dest / "cores").mkdir(parents=True, exist_ok=True)
(dest / "compression").mkdir(parents=True, exist_ok=True)

for name in root_files:
    download(name, dest / name)

download("cores/cores.json", dest / "cores" / "cores.json")
for name in compression_files:
    download(f"compression/{name}", dest / "compression" / name)

try:
    core_index = fetch_bytes(f"{base_url}/cores/").decode("utf-8", errors="replace")
except Exception as exc:
    raise RuntimeError(f"Could not read EmulatorJS core index: {exc}") from exc

hrefs = re.findall(r'href=["\']([^"\']+)["\']', core_index)
for core in cores:
    pattern = re.compile(rf"^{re.escape(core)}(?:-|\.).*\.data$")
    matches = sorted({href for href in hrefs if pattern.match(href)})
    if not matches:
        print(f"Warning: no .data core match found for {core}", file=sys.stderr)
    for name in matches:
        download(f"cores/{name}", dest / "cores" / name)

loader = dest / "loader.js"
if not loader.exists():
    raise RuntimeError(f"Install failed; loader.js missing at {loader}")

print(f"EmulatorJS runtime installed at {dest}")
PY
