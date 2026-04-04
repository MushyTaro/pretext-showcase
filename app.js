/**
 * pretext showcase — app.js
 *
 * Demonstrates @chenglou/pretext:
 *  - prepare(text, font)  → one-time segmentation + canvas measurement
 *  - layout(prepared, maxWidth, lineHeight) → pure arithmetic, zero DOM reflow
 *
 * We import from esm.sh so the page is fully static (no build step).
 */

import { prepare, layout } from 'https://esm.sh/@chenglou/pretext@0.0.4'

// ── Wait for fonts ─────────────────────────────────────────────────────────
// prepare() uses canvas measureText with the same font string as CSS.
// Fonts must be loaded first so canvas sees the real metrics.
await document.fonts.ready

// ─────────────────────────────────────────────────────────────────────────────
// PLAYGROUND
// ─────────────────────────────────────────────────────────────────────────────

function initPlayground() {
  const pgText     = /** @type {HTMLTextAreaElement} */ (document.getElementById('pg-text'))
  const pgWidth    = /** @type {HTMLInputElement} */    (document.getElementById('pg-width'))
  const pgLh       = /** @type {HTMLInputElement} */    (document.getElementById('pg-lh'))
  const pgFs       = /** @type {HTMLInputElement} */    (document.getElementById('pg-fs'))
  const pgWidthVal = document.getElementById('pg-width-val')
  const pgLhVal    = document.getElementById('pg-lh-val')
  const pgFsVal    = document.getElementById('pg-fs-val')
  const pgPreview  = document.getElementById('pg-preview')
  const pgRuler    = document.getElementById('pg-height-ruler')
  const pgRulerLbl = document.getElementById('pg-ruler-label')
  const mLines     = document.getElementById('m-lines')
  const mHeight    = document.getElementById('m-height')
  const mTime      = document.getElementById('m-time')

  let lastText = null
  let lastFont = null
  let prepared = null

  function update() {
    const text      = pgText.value
    const maxWidth  = Number(pgWidth.value)
    const lh        = Number(pgLh.value)
    const fs        = Number(pgFs.value)
    const font      = `${fs}px Inter, sans-serif`

    pgWidthVal.textContent = maxWidth
    pgLhVal.textContent    = lh
    pgFsVal.textContent    = fs

    // Apply CSS to preview — this does NOT trigger a layout read, only a write.
    pgPreview.style.maxWidth   = maxWidth + 'px'
    pgPreview.style.lineHeight = lh + 'px'
    pgPreview.style.fontSize   = fs + 'px'
    pgPreview.textContent      = text

    // Re-prepare only when text or font changes (expensive step, ~0.04ms per text)
    if (text !== lastText || font !== lastFont) {
      prepared  = prepare(text, font)
      lastText  = text
      lastFont  = font
    }

    // layout() — pure arithmetic, zero DOM access, run 100× to get a stable average
    const t0 = performance.now()
    let result
    for (let i = 0; i < 100; i++) {
      result = layout(prepared, maxWidth, lh)
    }
    const avgUs = ((performance.now() - t0) / 100 * 1000).toFixed(2)

    const { height, lineCount } = result

    mLines.textContent  = lineCount
    mHeight.textContent = height.toFixed(1) + 'px'
    mTime.textContent   = avgUs + 'μs'

    // Visual ruler showing pretext's calculated height
    pgRuler.style.height    = height + 'px'
    pgRulerLbl.textContent  = height.toFixed(0) + 'px'
  }

  pgText.addEventListener('input', update)
  pgWidth.addEventListener('input', update)
  pgLh.addEventListener('input', update)
  pgFs.addEventListener('input', update)

  update()
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT BUBBLES — shrink-wrap demo
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_FONT = '15px Inter, sans-serif'
const CHAT_LH   = 23

/**
 * Binary-search the tightest maxWidth that keeps the same line count.
 * cap = the reference width used to determine the target line count.
 * For long texts that span multiple lines at `cap`, we find the minimum
 * width that still produces that many lines — no wasted horizontal space.
 */
function shrinkWrapWidth(prepared, cap = 560) {
  const { lineCount } = layout(prepared, cap, CHAT_LH)
  let lo = 1, hi = cap
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (layout(prepared, mid, CHAT_LH).lineCount <= lineCount) hi = mid
    else lo = mid
  }
  return Math.ceil(hi)
}

const SEED_MESSAGES = [
  { side: 'left',  sender: 'Alice', text: 'Hey! Have you tried pretext yet?' },
  { side: 'right', sender: 'Bob',   text: "Not yet — what does it actually do? I keep seeing it mentioned." },
  { side: 'left',  sender: 'Alice', text: "It measures text height without touching the DOM at all. No getBoundingClientRect, no offsetHeight — just canvas measureText plus pure arithmetic. Runs at about 0.0002ms per call so you can use it on every animation frame." },
  { side: 'right', sender: 'Bob',   text: "That's wild. So no reflow?" },
  { side: 'left',  sender: 'Alice', text: "Zero. And these chat bubbles are shrink-wrapped to their tightest possible width using a binary search on layout() — try adding one below!" },
]

function initChatBubbles() {
  const win    = document.getElementById('chat-window')
  const input  = /** @type {HTMLInputElement} */ (document.getElementById('chat-input'))
  const sendBtn = document.getElementById('chat-send')
  let nextSide = 'right'

  function addBubble(text, side, sender) {
    const HPAD = 28   // left+right padding inside bubble (14px each side)
    // Cap at 80% of the chat window width (or 560px max) so long messages
    // wrap sensibly rather than measuring as a single 1500px-wide line.
    const cap = Math.min(Math.floor((win.clientWidth || 640) * 0.8), 560)
    const prepared = prepare(text, CHAT_FONT)
    const w = shrinkWrapWidth(prepared, cap) + HPAD

    const row = document.createElement('div')
    row.className = `bubble-row ${side}`

    const senderEl = document.createElement('div')
    senderEl.className = 'bubble-sender'
    senderEl.textContent = sender

    const bubble = document.createElement('div')
    bubble.className = 'bubble'
    bubble.textContent = text
    bubble.style.width    = w + 'px'
    bubble.style.maxWidth = w + 'px'
    // Override font to match prepare() — important so CSS and canvas agree
    bubble.style.fontSize   = '15px'
    bubble.style.fontFamily = 'Inter, sans-serif'

    const badge = document.createElement('div')
    badge.className = 'bubble-width-badge'
    badge.textContent = `width: ${w}px`

    row.appendChild(senderEl)
    row.appendChild(bubble)
    row.appendChild(badge)
    win.appendChild(row)

    // Scroll to bottom
    win.scrollTop = win.scrollHeight
  }

  // Seed messages
  SEED_MESSAGES.forEach(({ side, sender, text }) => addBubble(text, side, sender))

  function send() {
    const text = input.value.trim()
    if (!text) return
    const side   = nextSide
    const sender = side === 'right' ? 'Bob' : 'Alice'
    addBubble(text, side, sender)
    nextSide = side === 'right' ? 'left' : 'right'
    input.value = ''
    input.focus()
  }

  sendBtn.addEventListener('click', send)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send() })
}

// ─────────────────────────────────────────────────────────────────────────────
// RIPPLE — text wave physics demo
// ─────────────────────────────────────────────────────────────────────────────

const RIPPLE_WORDS = (
  'pretext measures text without DOM reflow — prepare runs once per string ' +
  'then layout is pure arithmetic at zero point zero zero zero two milliseconds ' +
  'per call safe to use on every animation frame even with hundreds of elements ' +
  'no getBoundingClientRect no offsetHeight no scrollHeight just canvas and math'
).split(' ')

const RIPPLE_FONT = '16px Inter, sans-serif'
const WORD_LH     = 24
const ROW_H       = 40    // vertical spacing between rows
const PAD_X       = 24
const PAD_Y       = 20

function initRipple() {
  const stage = document.getElementById('ripple-stage')

  // Prepare each word once
  const wordData = RIPPLE_WORDS.map(w => ({
    text: w,
    prepared: prepare(w, RIPPLE_FONT),
    el: null,
    bx: 0, by: 0,   // base position
  }))

  // Create span elements
  wordData.forEach(wd => {
    const el = document.createElement('span')
    el.className   = 'ripple-word'
    el.textContent = wd.text
    stage.appendChild(el)
    wd.el = el
  })

  // Wave grid
  const CELL = 20
  let COLS = 1, ROWS = 1
  let cur = new Float32Array(1), prv = new Float32Array(1)
  const DAMP = 0.97

  function resizeGrid(stageW, stageH) {
    COLS = Math.ceil(stageW / CELL) + 2
    ROWS = Math.ceil(stageH / CELL) + 2
    cur = new Float32Array(COLS * ROWS)
    prv = new Float32Array(COLS * ROWS)
  }

  function idx(c, r) { return r * COLS + c }

  function stepWave() {
    const next = new Float32Array(COLS * ROWS)
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        const avg = (cur[idx(c-1,r)] + cur[idx(c+1,r)] +
                     cur[idx(c,r-1)] + cur[idx(c,r+1)]) / 2
        next[idx(c,r)] = DAMP * (avg - prv[idx(c,r)])
      }
    }
    prv = cur
    cur = next
  }

  function inject(px, py, energy) {
    const c = Math.round(px / CELL)
    const r = Math.round(py / CELL)
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
      cur[idx(c, r)] += energy
    }
  }

  // Layout words — uses shrinkWrapWidth() to measure each word's pixel width
  // without reading the DOM (zero reflow).
  function layoutWords() {
    const stageW = stage.clientWidth
    const stageH = stage.clientHeight
    resizeGrid(stageW, stageH)

    let cx = PAD_X, cy = PAD_Y
    wordData.forEach(wd => {
      const wPx = shrinkWrapWidth(wd.prepared) + 4  // +4px slight padding

      if (cx + wPx + 8 > stageW - PAD_X && cx > PAD_X) {
        cx = PAD_X
        cy += ROW_H
      }

      wd.bx = cx
      wd.by = cy
      wd.el.style.left = cx + 'px'
      wd.el.style.top  = cy + 'px'
      cx += wPx + 8
    })
  }

  // Animation loop
  let idleT = 0
  function frame(ts) {
    idleT += 0.016

    // Idle wave: inject gently in a sine pattern
    if (idleT % 1.2 < 0.016) {
      const stageW = stage.clientWidth
      const stageH = stage.clientHeight
      const cx = (Math.sin(idleT * 0.7) * 0.4 + 0.5) * stageW
      const cy = (Math.cos(idleT * 0.5) * 0.3 + 0.5) * stageH
      inject(cx, cy, 0.8)
    }

    stepWave()

    wordData.forEach(wd => {
      const c = Math.floor(wd.bx / CELL)
      const r = Math.floor(wd.by / CELL)
      const h = (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? cur[idx(c, r)] : 0
      const hR = (c+1 < COLS) ? cur[idx(c+1, r)] : 0
      const hD = (r+1 < ROWS) ? cur[idx(c, r+1)] : 0
      const dx = (h - hR) * 12
      const dy = (h - hD) * 12
      wd.el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`
    })

    requestAnimationFrame(frame)
  }

  // Mouse interaction
  stage.addEventListener('mousemove', e => {
    const rect = stage.getBoundingClientRect()
    inject(e.clientX - rect.left, e.clientY - rect.top, 1.5)
  }, { passive: true })

  stage.addEventListener('click', e => {
    const rect = stage.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        inject(cx + dc * CELL, cy + dr * CELL, 6)
      }
    }
  })

  const ro = new ResizeObserver(() => layoutWords())
  ro.observe(stage)

  layoutWords()
  requestAnimationFrame(frame)
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE SHOWCASE
// ─────────────────────────────────────────────────────────────────────────────

// Each entry carries the fontFamily used for both CSS rendering AND canvas
// measurement so the two always agree. Noto fonts are loaded from Google
// Fonts in index.html; document.fonts.load() below waits for each one.
const LANGUAGES = [
  {
    name: 'English',
    text: 'The quick brown fox jumps over the lazy dog. Sphinx of black quartz, judge my vow.',
    fontFamily: 'Inter, sans-serif',
  },
  {
    name: 'Japanese',
    text: '吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。',
    fontFamily: '"Noto Sans JP", sans-serif',
  },
  {
    name: 'Arabic (RTL)',
    text: 'في البدء كانت الكلمة، وكانت الكلمة عند الله، وكان الله هو الكلمة.',
    fontFamily: '"Noto Sans Arabic", sans-serif',
  },
  {
    name: 'Chinese (Simplified)',
    text: '我本来想去图书馆，但是天气太热了，所以我就待在家里看书了。',
    fontFamily: '"Noto Sans SC", sans-serif',
  },
  {
    name: 'Hindi (Devanagari)',
    text: 'मेरा नाम है और मैं एक विद्यार्थी हूँ जो हिन्दी सीख रहा है।',
    fontFamily: '"Noto Sans Devanagari", sans-serif',
  },
  {
    name: 'Korean (Hangul)',
    text: '안녕하세요! 저는 프론트엔드 개발자입니다. 텍스트 레이아웃에 관심이 있어요.',
    fontFamily: '"Noto Sans KR", sans-serif',
  },
  {
    name: 'Emoji + ZWJ Sequences',
    text: '👨‍💻 Building cool stuff 🚀 with text layout 📐 and zero reflow ⚡ — supporting all scripts 🌍 including 👨‍👩‍👧‍👦 families.',
    fontFamily: 'Inter, sans-serif',
  },
  {
    name: 'Mixed Bidi',
    text: 'Hello مرحبا world! English and العربية mixed in one paragraph without special cases.',
    fontFamily: '"Noto Sans Arabic", Inter, sans-serif',
  },
]

async function initLanguages() {
  const grid = document.getElementById('lang-grid')
  const LH = 26
  const W  = 280

  // Build DOM first so font references exist in the document,
  // then explicitly load each font before measuring.
  const entries = []

  LANGUAGES.forEach(({ name, text, fontFamily }) => {
    const card = document.createElement('div')
    card.className = 'lang-card'

    const nameEl = document.createElement('div')
    nameEl.className = 'lang-name'
    nameEl.textContent = name

    const textEl = document.createElement('div')
    textEl.className = 'lang-text'
    textEl.style.fontFamily = fontFamily
    textEl.textContent = text

    const metricsEl = document.createElement('div')
    metricsEl.className = 'lang-metrics'
    metricsEl.innerHTML = '<span>…</span><span>…</span>'

    card.appendChild(nameEl)
    card.appendChild(textEl)
    card.appendChild(metricsEl)
    grid.appendChild(card)

    entries.push({ text, fontFamily, metricsEl })
  })

  // Wait for every unique font to actually download before running prepare().
  // document.fonts.load() returns a promise that resolves once the font file
  // is available for canvas — this is the key step that was missing.
  await Promise.all(
    [...new Set(LANGUAGES.map(l => l.fontFamily))].map(ff =>
      document.fonts.load(`16px ${ff}`).catch(() => {})
    )
  )

  // Now measure with the same font used for CSS rendering.
  entries.forEach(({ text, fontFamily, metricsEl }) => {
    const font = `16px ${fontFamily}`
    const p = prepare(text, font)
    const { height, lineCount } = layout(p, W, LH)
    metricsEl.innerHTML =
      `<span>${lineCount} line${lineCount !== 1 ? 's' : ''}</span><span>${height.toFixed(0)}px</span>`
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO COUNTER (just a fun zero — stays at 0 to make the point)
// ─────────────────────────────────────────────────────────────────────────────

function initCounter() {
  // The reflow counter stays at 0 — that's the whole point of pretext.
  // (The counter reading itself isn't measurable since it's a write, not a read.)
  const el = document.getElementById('reflow-counter')
  if (el) el.textContent = '0'
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────

initCounter()
initPlayground()
initChatBubbles()
initRipple()
initLanguages()
