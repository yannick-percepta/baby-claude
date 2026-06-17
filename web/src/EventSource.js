// Two interchangeable sources of normalised swarm events. The scene consumes
// either one through the same shape:
//
//   source.onEvent = (ev) => { ... }   // normalised event dicts
//   source.onState = (s) => { ... }    // {playing, t, duration} for the HUD
//   source.start() / source.stop()
//
// WebSocketSource streams a live run from serve.py's /ws.
// ReplaySource plays a recorded events array, honouring each event's `t`
// (seconds), with pause / restart / speed / seek.

export class WebSocketSource {
  constructor(url = `ws://${location.host}/ws`) {
    this.url = url
    this.onEvent = () => {}
    this.onState = () => {}
    this.ws = null
    this.t0 = 0
    this.live = true
  }

  start() {
    this.t0 = performance.now()
    this.ws = new WebSocket(this.url)
    this.ws.onmessage = (e) => {
      let ev
      try { ev = JSON.parse(e.data) } catch { return }
      this.onEvent(ev)
      const t = (performance.now() - this.t0) / 1000
      this.onState({ playing: true, t, duration: t })
    }
    this.ws.onclose = () => {
      const t = (performance.now() - this.t0) / 1000
      this.onState({ playing: false, t, duration: t, ended: true })
    }
    this.ws.onerror = () => {
      this.onEvent({ type: 'error', text: 'WebSocket connection failed — is serve.py running?' })
    }
  }

  // Live has no meaningful pause/seek; these are no-ops so the UI stays simple.
  setPlaying() {}
  setSpeed() {}
  seek() {}

  stop() {
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null }
  }
}

export class ReplaySource {
  constructor(events) {
    this.events = (events || []).slice().sort((a, b) => (a.t || 0) - (b.t || 0))
    this.duration = this.events.length ? this.events[this.events.length - 1].t : 0
    this.onEvent = () => {}
    this.onState = () => {}
    this.live = false

    this.playing = true
    this.speed = 1
    this.cursor = 0 // index of next event to fire
    this.clock = 0 // seconds of playback elapsed
    this._raf = null
    this._last = 0
  }

  start() {
    this._last = performance.now()
    this._loop()
  }

  _loop = () => {
    const now = performance.now()
    const dt = (now - this._last) / 1000
    this._last = now
    if (this.playing) {
      this.clock += dt * this.speed
      while (this.cursor < this.events.length && this.events[this.cursor].t <= this.clock) {
        this.onEvent(this.events[this.cursor])
        this.cursor++
      }
      if (this.cursor >= this.events.length) this.playing = false
    }
    this.onState({
      playing: this.playing,
      t: Math.min(this.clock, this.duration),
      duration: this.duration,
      ended: this.cursor >= this.events.length,
    })
    this._raf = requestAnimationFrame(this._loop)
  }

  setPlaying(p) {
    if (p && this.cursor >= this.events.length) { this.restart(); return }
    this.playing = p
  }

  setSpeed(s) { this.speed = s }

  restart() {
    this.cursor = 0
    this.clock = 0
    this.playing = true
    this.onEvent({ type: 'reset' })
  }

  // Jump to time `t`: reset, then fire every event up to t instantly (the
  // scene snaps actors to the implied state via its `instant` flag).
  seek(t) {
    this.onEvent({ type: 'reset' })
    this.cursor = 0
    this.clock = t
    while (this.cursor < this.events.length && this.events[this.cursor].t <= t) {
      this.onEvent({ ...this.events[this.cursor], instant: true })
      this.cursor++
    }
    this.playing = this.cursor < this.events.length
  }

  stop() { if (this._raf) cancelAnimationFrame(this._raf) }
}

// Fetch the most recent recorded run from serve.py (replay mode).
export async function fetchLatestEvents() {
  try {
    const res = await fetch('/api/events/latest')
    const data = await res.json()
    return data.events || []
  } catch {
    return []
  }
}
