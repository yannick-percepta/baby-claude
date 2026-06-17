# 🦈 The Reef — live 3D visualization of the onboarding swarm

A three.js underwater scene that animates **Card C (Hire-to-Onboard)** in real
time: a **mama Claude shark** (the *Onboarding Lead* coordinator) directs four
**baby Claude sharks** (the specialists) to onboard a **sea-lion new hire**.
Every movement is driven by the *actual* swarm event stream — the HUD on the
right mirrors the real CLI log, so the cute layer **is** the swarm.

## Run it (no Node required)

The app is build-free — it loads three.js from `web/vendor/` via an import map,
so the only thing you need is the Python server:

```bash
pip install -r requirements.txt        # from the repo root
python serve.py                        # -> http://localhost:8000
```

Open **http://localhost:8000**. Two modes (toggle bottom-left, or `?mode=`):

| Mode | What it does |
| --- | --- |
| **Replay** (default) | Plays the most recent recorded run from `outputs/onboarding-events.jsonl`. Deterministic — perfect for a stage demo. Pause / restart / scrub / speed. |
| **Live** | Opens a WebSocket to `serve.py`, kicks off a real swarm run, and animates events as they arrive. Needs `ANTHROPIC_API_KEY` + a created coordinator/environment. Every live run is also recorded, so today's live run is tomorrow's replay. |

No recording yet? Either run the real swarm (`python run_onboarding.py`) or
generate a synthetic one for offline dev:

```bash
python make_sample_events.py           # writes outputs/onboarding-events.jsonl
```

## What you're watching (event → animation)

| Swarm event | On screen |
| --- | --- |
| `spawn` | a baby Claude wakes and detaches from mama |
| `running` | the baby darts to its coral station; status chip → running |
| `delegate` | a glowing task-pulse flies mama → baby; camera cuts to it |
| `tool` | a bubble-burst + tool name over the working baby |
| `message` | mama's thought bubble streams the coordinator's text |
| `reply` | the baby swims home carrying a glowing scroll; chip → done |
| `idle` | scrolls fuse into the day-1-pack treasure chest; sea lion celebrates 🎉 |

### The Buddy Match minigame (the highlight)

When the Buddy Match specialist runs, the 9 candidates from
`synthetic-data/buddy-roster.json` appear as labelled fish, then the real
playbook plays out: ineligible candidates fade away with their reason (at
capacity, on leave, below seniority floor), the hire's manager is flagged, the
rest brighten by score, and the winner (**Lena Hoffmann**) is spotlit and paired
with the sea lion. Logic lives in `src/buddyLogic.js` (mirrors
`skills/buddy-match-playbook`).

## Assets

- `web/models/shark.gltf` — the provided great-white/megalodon model (rigged,
  embedded texture, **Swim** + **Bite** clips). One mesh, cloned + tinted for
  mama and the four babies.
- The **sea lion** is a primitive stand-in until a real model is dropped into
  `web/models/`; swap the body in `src/actors/SeaLion.js` when it arrives.

## Optional: Vite build

Node isn't required, but if you want an optimised bundle:

```bash
cd web && npm install && npm run build   # outputs web/dist, which serve.py prefers
```

## Verify

```bash
cd web && node verify.mjs                # headless Chromium check vs a running serve.py
```
Captures console errors and screenshots the key beats to `outputs/verify-*.png`.

## Layout

```
web/
  index.html            import map + HUD/controls markup
  src/
    main.js             bootstrap: scene, actors, render loop, transport
    config.js           specialists, stations, colours, agent-name aliases
    director.js         event → actor/camera/minigame/chest mapping
    EventSource.js      WebSocketSource (live) | ReplaySource (recorded)
    buddyLogic.js       deterministic buddy-match playbook
    hud.js              status chips + event log
    scene/reef.js       water, caustics, god-rays, particles, seabed
    scene/camera.js     auto-orbit + focus-on-active-specialist
    actors/             Shark, SeaLion, RosterFish, Chest, models loader
  vendor/               three.js + addons (build-free runtime)
  models/shark.gltf     the shark asset
```
