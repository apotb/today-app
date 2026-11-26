#!/usr/bin/env python3
"""Xcode build step. Debug loads the Vite dev server. Release bundles the web app."""

import json
import os
import socket
import subprocess
import sys
from pathlib import Path

SRCROOT = Path(os.environ.get("SRCROOT", Path(__file__).resolve().parents[1] / "ios" / "App"))
REPO_ROOT = SRCROOT.parent.parent
CONFIG_PATH = SRCROOT / "App" / "capacitor.config.json"
CONFIGURATION = os.environ.get("CONFIGURATION", "Debug")
PLATFORM = os.environ.get("PLATFORM_NAME", "")
PORT = os.environ.get("IOS_DEV_PORT", "5173")
RELEASE_API = "https://today-app-api.onrender.com/api"

FALLBACK = {
    "appId": "com.apotb.today",
    "appName": "Today",
    "webDir": "dist",
    "backgroundColor": "#f2f8f2",
    "ios": {"contentInset": "never", "backgroundColor": "#f2f8f2"},
    "plugins": {"CapacitorHttp": {"enabled": True}},
    "packageClassList": ["GeolocationPlugin"],
}


def lan_host():
    override = os.environ.get("IOS_DEV_HOST")
    if override:
        return override
    for iface in ("en0", "en1"):
        try:
            ip = subprocess.check_output(["ipconfig", "getifaddr", iface], text=True).strip()
        except subprocess.CalledProcessError:
            continue
        if ip:
            return ip
    return None


def port_open(host, port):
    try:
        with socket.create_connection((host, int(port)), timeout=0.4):
            return True
    except OSError:
        return False


def load_config():
    if not CONFIG_PATH.exists():
        return dict(FALLBACK)
    return json.loads(CONFIG_PATH.read_text())


def write_config(config):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent="\t") + "\n")


def bundle_release():
    env = os.environ.copy()
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + env.get("PATH", "")
    env["VITE_API_BASE"] = RELEASE_API
    print(f"Release build: bundling the web app against {RELEASE_API}")
    subprocess.run(["npm", "run", "build"], cwd=REPO_ROOT, env=env, check=True)
    cap = REPO_ROOT / "node_modules" / ".bin" / "cap"
    subprocess.run([str(cap), "copy", "ios"], cwd=REPO_ROOT, env=env, check=True)


def main():
    if CONFIGURATION != "Debug":
        bundle_release()
        config = load_config()
        config.pop("server", None)
        write_config(config)
        print("Release build: iOS app uses the bundled web files.")
        return

    config = load_config()

    host = "localhost" if PLATFORM == "iphonesimulator" else lan_host()
    if not host:
        print("No LAN address found. Connect to Wi-Fi or set IOS_DEV_HOST.", file=sys.stderr)
        sys.exit(1)

    url = f"http://{host}:{PORT}"
    config["server"] = {"url": url, "cleartext": True}
    write_config(config)
    print(f"Debug build: iOS app loads {url}")
    if not port_open("127.0.0.1" if host == "localhost" else host, PORT):
        print("Vite is not running on that address. Start it with npm run dev.", file=sys.stderr)


if __name__ == "__main__":
    main()
