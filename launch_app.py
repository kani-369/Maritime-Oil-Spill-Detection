"""Turnkey Web App Launcher for Kaggle & Cloud Notebooks.

Builds the React frontend (if not already built), starts the FastAPI backend,
and exposes a public URL using localtunnel or pyngrok so you can use the full
interactive 3-panel MapLibre UI directly in your browser while MambaMPD runs
on Kaggle's GPU!

Usage in Kaggle:
    !python launch_app.py
"""

import os
import sys
import time
import subprocess
import urllib.request

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
FRONTEND_DIST = os.path.join(FRONTEND_DIR, "dist")


def build_frontend_if_needed(force_rebuild: bool = False):
    """Ensure React frontend is built into static HTML/JS/CSS assets."""
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    src_modified = False
    if os.path.isfile(index_file):
        dist_mtime = os.path.getmtime(index_file)
        for root, _, files in os.walk(os.path.join(FRONTEND_DIR, "src")):
            for f in files:
                if os.path.getmtime(os.path.join(root, f)) > dist_mtime:
                    src_modified = True
                    break

    if force_rebuild or not os.path.isfile(index_file) or src_modified:
        print("📦 Building updated React + Tailwind + MapLibre frontend (takes ~20-30s on Kaggle)...")
        # Check npm
        try:
            subprocess.run(["npm", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        except Exception:
            print("❌ Node/npm not found. Please install nodejs or pre-build frontend.")
            return False

        # Run npm install and build
        print("  -> Running npm install...")
        subprocess.run(["npm", "install"], cwd=FRONTEND_DIR, check=True)
        print("  -> Running npm run build...")
        subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR, check=True)
        print("✅ Frontend build completed successfully!")
    else:
        print("✅ Pre-built frontend found in frontend/dist.")
    return True


def start_backend():
    """Launch FastAPI backend serving both API and frontend on port 8000."""
    print("🚀 Starting FastAPI backend on http://0.0.0.0:8000...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=ROOT_DIR,
    )
    time.sleep(3)
    return proc


def get_public_ip():
    """Get the public IP of the Kaggle VM (needed as localtunnel password)."""
    try:
        return urllib.request.urlopen("https://ipv4.icanhazip.com").read().decode("utf8").strip()
    except Exception:
        return "Check Kaggle VM IP"


def start_tunnel():
    """Expose port 8000 via localtunnel and display the clickable URL."""
    password = get_public_ip()
    print("\n" + "=" * 70)
    print("🌐 EXPOSING FULL WEB APP VIA LOCALTUNNEL")
    print("=" * 70)
    print(f"🔑 Tunnel Endpoint Password: {password}")
    print("   (When localtunnel opens for the first time, paste this IP if prompted)\n")

    cmd = ["npx", "-y", "localtunnel", "--port", "8000"]
    try:
        tunnel_proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        for line in tunnel_proc.stdout:
            print(line, end="", flush=True)
            if "your url is:" in line.lower():
                url = line.strip().split()[-1]
                print("\n" + "*" * 70, flush=True)
                print(f"🎉 CLICK HERE TO OPEN THE FULL APPLICATION IN YOUR BROWSER:", flush=True)
                print(f"👉 {url}", flush=True)
                print("*" * 70 + "\n", flush=True)
                break

        tunnel_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping application...")
    except Exception as e:
        print(f"Tunnel launch error: {e}")
        print("You can also run manually: !npx localtunnel --port 8000")


def main():
    force_rebuild = "--rebuild" in sys.argv
    print("=" * 70)
    print("🌊 MambaMPD Maritime Oil Spill Full-Stack Application Launcher")
    print("=" * 70)

    # 1. Build frontend if dist doesn't exist or if src was updated
    build_frontend_if_needed(force_rebuild=force_rebuild)

    # 2. Start combined server
    backend_proc = start_backend()

    # 3. Expose tunnel
    try:
        start_tunnel()
    finally:
        backend_proc.terminate()


if __name__ == "__main__":
    main()
