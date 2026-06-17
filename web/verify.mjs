// Headless runtime verification of the Reef viz against a running serve.py.
// Captures console/page errors and screenshots the key beats of replay mode.
import { chromium } from 'playwright'

const OUT = '/Users/ymuller/Documents/baby-claude/outputs'
const URL = 'http://localhost:8000/?mode=replay'

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle' })

// wait for boot (loader hidden)
await page.waitForFunction(
  () => document.getElementById('loader')?.classList.contains('hidden'),
  { timeout: 15000 },
).catch(() => errors.push('TIMEOUT: loader never hid (boot failed)'))

const beats = [
  { t: 1500, name: '01-start' },
  { t: 4000, name: '02-delegating' },
  { t: 7000, name: '03-working-minigame' },
  { t: 11000, name: '04-scoring' },
  { t: 15000, name: '05-replies' },
  { t: 19000, name: '06-chest' },
]
let elapsed = 0
for (const b of beats) {
  await page.waitForTimeout(b.t - elapsed)
  elapsed = b.t
  await page.screenshot({ path: `${OUT}/verify-${b.name}.png` })
}

// introspect scene state
const state = await page.evaluate(() => ({
  logEntries: document.querySelectorAll('#log li').length,
  chips: [...document.querySelectorAll('.chip')].map((c) => ({
    name: c.querySelector('.name')?.textContent,
    state: c.querySelector('.state')?.textContent,
  })),
  canvasW: document.getElementById('scene')?.width,
  canvasH: document.getElementById('scene')?.height,
  status: document.getElementById('status')?.textContent,
  labels: document.querySelectorAll('.label3d').length,
}))

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log('STATE:', JSON.stringify(state, null, 2))

await browser.close()
process.exit(errors.length ? 1 : 0)
