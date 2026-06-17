// The 2D overlay: per-specialist status chips and the scrolling event log that
// mirrors the real CLI stream, so the audience sees the cute layer IS the swarm.

import { SPECIALISTS, specialistByKey } from './config.js'

const EV_LABEL = {
  spawn: 'spawn', running: 'running', delegate: 'delegate',
  reply: 'reply', message: 'lead', tool: 'tool', idle: 'done', error: 'error',
}

export class Hud {
  constructor() {
    this.chipsEl = document.getElementById('chips')
    this.logEl = document.getElementById('log')
    this.statusEl = document.getElementById('status')
    this.chips = {}
    this._build()
  }

  _build() {
    // coordinator chip first
    this._addChip('coordinator', 'Onboarding Lead', '#ff8fab')
    for (const s of SPECIALISTS) {
      this._addChip(s.key, `${s.icon} ${s.label}`, '#' + s.color.toString(16).padStart(6, '0'))
    }
  }

  _addChip(key, name, color) {
    const el = document.createElement('div')
    el.className = 'chip'
    el.style.setProperty('--accent', color)
    el.innerHTML = `<span class="dot"></span><span class="name">${name}</span><span class="state">idle</span>`
    this.chipsEl.appendChild(el)
    this.chips[key] = el
  }

  setStatus(key, state) {
    const el = this.chips[key]
    if (!el) return
    el.classList.remove('running', 'done')
    if (state) el.classList.add(state)
    el.querySelector('.state').textContent = state || 'idle'
  }

  setActive(key) {
    for (const k in this.chips) this.chips[k].classList.toggle('active', k === key)
  }

  pushLog(ev) {
    if (ev.type === 'start' || ev.type === 'reset') return
    const li = document.createElement('li')
    li.className = 'fresh'
    const label = EV_LABEL[ev.type] || ev.type
    let who = ev.agent || ''
    if (ev.type === 'tool') who = `${ev.agent || ''} · ${ev.tool}`
    if (ev.type === 'message') who = truncate(ev.text, 48)
    if (ev.type === 'error') who = ev.text
    li.innerHTML = `<span class="ev">[${label}]</span><span class="who"></span>`
    li.querySelector('.who').textContent = who
    this.logEl.appendChild(li)
    this.logEl.scrollTop = this.logEl.scrollHeight
    // cap log length
    while (this.logEl.children.length > 120) this.logEl.removeChild(this.logEl.firstChild)
  }

  setStatusText(text) { this.statusEl.textContent = text }

  reset() {
    this.logEl.innerHTML = ''
    for (const k in this.chips) {
      this.chips[k].classList.remove('running', 'done', 'active')
      this.chips[k].querySelector('.state').textContent = 'idle'
    }
  }
}

function truncate(s, n) {
  s = (s || '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}
