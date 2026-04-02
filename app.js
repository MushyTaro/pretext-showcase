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
// MASONRY
// ─────────────────────────────────────────────────────────────────────────────

const MASONRY_QUOTES = [
  'Calling getBoundingClientRect() forces the browser to flush all pending layout work. For 500 elements, that can cost 30ms+ per frame.',
  "Canvas measureText gives you the same glyph advance widths the browser's own text engine uses — without touching the DOM.",
  'pretext separates the expensive work (prepare, once per text) from the cheap work (layout, ~0.0002ms, safe on every resize).',
  'True masonry layout requires knowing each card\'s height before placing it. Without pretext, you\'re guessing or causing reflow.',
  'Virtualized lists are impossible to implement correctly unless you know element heights before they\'re rendered.',
  'Intl.Segmenter handles CJK character-by-character breaking, Thai word segmentation, and Arabic shaping transparently.',
  'Emoji at small font sizes measure wider in canvas than in DOM on macOS. pretext auto-detects and corrects this per font.',
  'Mixed bidirectional text (Arabic + English + Hebrew on one line) just works. No special cases in your code.',
  'layout() is so cheap you can run it inside requestAnimationFrame without dropping frames — even for hundreds of elements.',
  "Server-side text height calculation is the final piece for eliminating layout shift when new content loads.",
  'The web has had text rendering for 30 years. pretext is one of the first libraries to get sub-pixel text height right, for every script.',
  "prepare() runs once. layout() runs on every resize. That's the entire mental model.",
  'Shrink-wrapping chat bubbles to their exact text width is trivial with walkLineRanges() — you binary-search the tightest fit.',
  'Text layout is 90% boring Unicode rules and 10% browser quirks that will keep you up at night.',
]

function initMasonry() {
  const root      = document.getElementById('masonry-root')
  const FONT      = '15px Inter, sans-serif'
  const LH        = 22
  const PAD       = 16
  const GAP       = 10
  const MAX_COL   = 360

  // Prepare all texts once upfront
  const cards = MASONRY_QUOTES.map(text => ({
    text,
    prepared: prepare(text, FONT),
    el: null,
  }))

  function renderMasonry() {
    const W = root.clientWidth
    let colCount, colWidth

    if      (W < 480)  { colCount = 1; colWidth = W - GAP * 2 }
    else if (W < 780)  { colCount = 2; colWidth = (W - GAP * 3) / 2 }
    else               { colCount = 3; colWidth = (W - GAP * 4) / 3 }

    colWidth = Math.min(MAX_COL, Math.floor(colWidth))

    const textWidth    = colWidth - PAD * 2
    const contentWidth = colCount * colWidth + (colCount - 1) * GAP
    const offsetLeft   = Math.max(GAP, (W - contentWidth) / 2)

    const colHeights = Array(colCount).fill(GAP)

    const positions = cards.map(({ prepared }) => {
      // Find shortest column
      let shortest = 0
      for (let c = 1; c < colCount; c++) {
        if (colHeights[c] < colHeights[shortest]) shortest = c
      }

      // layout() — zero DOM, pure arithmetic
      const { height } = layout(prepared, textWidth, LH)
      const cardH      = height + PAD * 2

      const x = offsetLeft + shortest * (colWidth + GAP)
      const y = colHeights[shortest]

      colHeights[shortest] += cardH + GAP

      return { x, y, w: colWidth, h: cardH }
    })

    const totalH = Math.max(...colHeights) + GAP
    root.style.height = totalH + 'px'

    cards.forEach((card, i) => {
      const pos = positions[i]

      if (!card.el) {
        card.el = document.createElement('div')
        card.el.className    = 'masonry-card'
        card.el.textContent  = card.text
        card.el.style.animationDelay = (i * 40) + 'ms'
        root.appendChild(card.el)
      }

      const el = card.el
      el.style.left   = pos.x + 'px'
      el.style.top    = pos.y + 'px'
      el.style.width  = pos.w + 'px'
      // Height driven by content; pretext told us what it would be
    })
  }

  const ro = new ResizeObserver(renderMasonry)
  ro.observe(root)
  renderMasonry()
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
initMasonry()
initLanguages()
