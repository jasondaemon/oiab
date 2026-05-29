#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("OIAB_DATA_DIR", "/data/oiab"))
CONFIG_DIR = DATA_DIR / "config"
CERT_DIR = DATA_DIR / "certs"
ENV_PATH = Path(os.environ.get("OIAB_HTTPS_ENV", CONFIG_DIR / "https.env"))
TOKEN_PATH = Path(os.environ.get("OIAB_CLOUDFLARE_TOKEN_FILE", CONFIG_DIR / "cloudflare.ini"))
GEN_CERT = REPO_ROOT / "scripts" / "generate-cert.sh"
HOST_RE = re.compile(r"^[a-zA-Z0-9_.-]+$")


def respond(payload, code=0):
    sys.stdout.write(json.dumps(payload, indent=2) + "\n")
    raise SystemExit(code)


def parse_env():
    values = {
        "domain": os.environ.get("OIAB_HOSTNAME", "overland.daemonadventures.net"),
        "piLanIp": os.environ.get("OIAB_PI_LAN_IP", "192.168.8.2"),
        "certDomains": f"{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')},*.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "email": os.environ.get("OIAB_ACME_EMAIL", ""),
        "mapsHost": f"maps.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "mobileHost": f"mobile.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "musicHost": f"music.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "filesHost": f"files.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "jellyfinHost": f"jellyfin.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "komgaHost": f"komga.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "kiwixHost": f"wiki.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "monitorHost": f"monitor.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "minecraftMapHost": f"minecraft-map.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
        "minecraftAdminHost": f"minecraft-admin.{os.environ.get('OIAB_HOSTNAME', 'overland.daemonadventures.net')}",
    }
    if ENV_PATH.exists():
      for line in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
          stripped = line.strip()
          if not stripped or stripped.startswith("#") or "=" not in stripped:
              continue
          key, value = stripped.split("=", 1)
          key = key.strip()
          value = value.strip().strip('"').strip("'")
          if key in values:
              values[key] = value
    return values


def write_env(values):
    domain = str(values.get("domain") or "").strip().lower()
    if not domain or not HOST_RE.fullmatch(domain):
        raise ValueError("domain must be a valid DNS hostname")
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Managed by OIAB HTTPS settings",
    ]
    ordered = [
        "domain", "piLanIp", "certDomains", "email", "mapsHost", "mobileHost", "musicHost",
        "filesHost", "jellyfinHost", "komgaHost", "kiwixHost", "monitorHost",
        "minecraftMapHost", "minecraftAdminHost",
    ]
    for key in ordered:
        lines.append(f"{key}={str(values.get(key, '')).strip()}")
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def save_token(token):
    token = str(token or "").strip()
    if not token:
        raise ValueError("Cloudflare token is empty.")
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(f"dns_cloudflare_api_token = {token}\n", encoding="utf-8")
    os.chmod(TOKEN_PATH, 0o600)


def cert_status():
    crt = CERT_DIR / "oiab.crt"
    key = CERT_DIR / "oiab.key"
    if crt.exists() and key.exists():
        return {
            "ok": True,
            "stdout": f"Certificate present:\n{crt}\n{key}",
            "stderr": "",
        }
    return {
        "ok": False,
        "stdout": "",
        "stderr": "Certificate files are missing. Run Issue / Renew Cert to generate a local certificate.",
    }


def run_generate_cert():
    env = os.environ.copy()
    env["OIAB_DATA_DIR"] = str(DATA_DIR)
    values = parse_env()
    env["OIAB_HOSTNAME"] = values.get("domain") or env.get("OIAB_HOSTNAME", "overland.daemonadventures.net")
    proc = subprocess.run([str(GEN_CERT)], capture_output=True, text=True, env=env, timeout=180, check=False)
    return {
        "ok": proc.returncode == 0,
        "stdout": proc.stdout[-12000:],
        "stderr": proc.stderr[-12000:],
        "returncode": proc.returncode,
    }


def status_payload():
    values = parse_env()
    return {
        "config": values,
        "tokenConfigured": TOKEN_PATH.exists() and TOKEN_PATH.stat().st_size > 0,
        "trustedSiteEnabled": (CERT_DIR / "oiab.crt").exists() and (CERT_DIR / "oiab.key").exists(),
        "certificate": cert_status(),
    }


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    action = payload.get("action", "status")
    try:
        if action == "status":
            respond({"ok": True, **status_payload()})
        if action == "save-config":
            values = parse_env()
            values.update(payload.get("config") or {})
            write_env(values)
            respond({"ok": True, **status_payload()})
        if action == "save-token":
            save_token(payload.get("token"))
            respond({"ok": True, **status_payload()})
        if action == "renew":
            result = run_generate_cert()
            respond({"ok": result["ok"], "renew": result, **status_payload()}, 0 if result["ok"] else 1)
        if action == "dns":
            values = parse_env()
            dns = f"Create DNS records for {values['domain']} and any desired subdomains, pointing to {values['piLanIp']} on the local network."
            respond({"ok": True, "dns": {"ok": True, "stdout": dns, "stderr": ""}, **status_payload()})
        if action == "pretrip":
            cert = cert_status()
            checks = [
                f"Certificate present: {'yes' if cert['ok'] else 'no'}",
                f"Cloudflare token configured: {'yes' if TOKEN_PATH.exists() else 'no'}",
                f"Domain: {parse_env().get('domain', '')}",
            ]
            respond({"ok": True, "pretrip": {"ok": cert["ok"], "stdout": "\n".join(checks), "stderr": cert["stderr"]}, **status_payload()})
        raise ValueError(f"Unsupported action: {action}")
    except Exception as exc:
        respond({"ok": False, "error": str(exc)}, code=1)


if __name__ == "__main__":
    main()
