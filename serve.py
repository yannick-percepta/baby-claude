"""
serve.py — web host for the "Reef" visualisation of the Card C onboarding swarm.

Endpoints
---------
GET  /                  -> the built three.js app (web/dist), if present
WS   /ws                -> kicks off a live swarm run and streams normalised
                           events (see swarm_events.py) as JSON text frames
GET  /api/roster        -> buddy roster + new-hire profile + team directory
GET  /api/events/latest -> the most recent recorded run (for replay mode)
GET  /api/health        -> readiness of the live path (keys / coordinator / env)

Run:
    pip install -r requirements.txt
    python serve.py            # http://localhost:8000

During frontend development, run `npm run dev` in web/ (Vite proxies /api and
/ws here) — see web/vite.config.js.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

import uvicorn
from anthropic import Anthropic
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from swarm_events import (
    EVENTS_PATH,
    load_profile,
    stream_onboarding_events,
)

ROOT = Path(__file__).parent
WEB_DIR = ROOT / "web"
DIST_DIR = WEB_DIR / "dist"
# Build-free by default: serve the source dir (with its import map). If someone
# runs an optional `vite build`, prefer the optimised dist/ output instead.
STATIC_DIR = DIST_DIR if DIST_DIR.exists() else WEB_DIR

ROSTER_PATH = ROOT / "synthetic-data" / "buddy-roster.json"
PROFILE_PATH = ROOT / "synthetic-data" / "onboarding" / "new-hire-profile.md"
TEAM_DIR_PATH = ROOT / "synthetic-data" / "onboarding" / "team-directory.json"
# Anchor the recording to the repo root so it resolves regardless of cwd.
EVENTS_FILE = ROOT / EVENTS_PATH

app = FastAPI(title="Reef — Onboarding Swarm Visualisation")


# --------------------------------------------------------------------------- #
# JSON / data APIs
# --------------------------------------------------------------------------- #

@app.get("/api/health")
def health() -> JSONResponse:
    return JSONResponse({
        "api_key": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "coordinator": (ROOT / ".onboarding_coordinator_id").exists(),
        "environment": (ROOT / ".environment_id").exists(),
        "has_recording": EVENTS_FILE.exists(),
    })


@app.get("/api/roster")
def roster() -> JSONResponse:
    """Everything the buddy-match minigame + welcome beat need, by real name."""
    data: dict = {}
    if ROSTER_PATH.exists():
        data["roster"] = json.loads(ROSTER_PATH.read_text())
    if PROFILE_PATH.exists():
        data["new_hire_profile"] = PROFILE_PATH.read_text()
    if TEAM_DIR_PATH.exists():
        data["team_directory"] = json.loads(TEAM_DIR_PATH.read_text())
    return JSONResponse(data)


@app.get("/api/events/latest")
def events_latest() -> JSONResponse:
    """The most recently recorded run, as an array of normalised events."""
    if not EVENTS_FILE.exists():
        return JSONResponse({"events": [], "recorded": False})
    events = [
        json.loads(line)
        for line in EVENTS_FILE.read_text().splitlines()
        if line.strip()
    ]
    return JSONResponse({"events": events, "recorded": True})


# --------------------------------------------------------------------------- #
# Live WebSocket bridge
# --------------------------------------------------------------------------- #

def _run_swarm_into_queue(loop: asyncio.AbstractEventLoop,
                          queue: "asyncio.Queue[dict | None]") -> None:
    """Runs the blocking swarm generator in a thread, feeding the async queue.

    Pushes a terminal None when the generator is exhausted (or errors), so the
    consumer knows to stop.
    """
    def put(ev: dict | None) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, ev)

    try:
        coordinator_id = (ROOT / ".onboarding_coordinator_id").read_text().strip()
        environment_id = (ROOT / ".environment_id").read_text().strip()
        client = Anthropic()
        profile = load_profile(ROOT / "synthetic-data" / "new-hire-profile.md")
        for ev in stream_onboarding_events(
            client, coordinator_id, environment_id, profile,
            record_path=EVENTS_FILE,
        ):
            put(ev)
    except Exception as exc:  # forward, don't hang the socket
        put({"type": "error", "text": f"{type(exc).__name__}: {exc}"})
    finally:
        put(None)


@app.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket.accept()

    missing = [
        name for name, ok in (
            ("ANTHROPIC_API_KEY", bool(os.environ.get("ANTHROPIC_API_KEY"))),
            (".onboarding_coordinator_id", (ROOT / ".onboarding_coordinator_id").exists()),
            (".environment_id", (ROOT / ".environment_id").exists()),
        ) if not ok
    ]
    if missing:
        await websocket.send_json({
            "type": "error",
            "text": "Live mode unavailable; missing: " + ", ".join(missing)
                    + ". Use replay mode (?mode=replay).",
        })
        await websocket.close()
        return

    loop = asyncio.get_running_loop()
    queue: "asyncio.Queue[dict | None]" = asyncio.Queue()
    loop.run_in_executor(None, _run_swarm_into_queue, loop, queue)

    try:
        while True:
            ev = await queue.get()
            if ev is None:
                break
            await websocket.send_json(ev)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass


# --------------------------------------------------------------------------- #
# Static frontend (mounted last so it doesn't shadow the API routes)
# --------------------------------------------------------------------------- #

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="app")
else:
    @app.get("/")
    def no_web() -> JSONResponse:
        return JSONResponse({"error": f"missing web dir: {STATIC_DIR}"}, status_code=503)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
