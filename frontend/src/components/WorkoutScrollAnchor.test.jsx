import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WorkoutScrollAnchor from './WorkoutScrollAnchor.jsx'

let root, container, dom, scrollY, pageHeight
const height = () => pageHeight + (parseFloat(container.firstChild?.style.paddingBottom) || 0)
const tileTop = key => container.querySelector(`[data-unit-key="${key}"]`).getBoundingClientRect().top

beforeEach(() => {
  dom = parseHTML('<html><body><div id="root"></div></body></html>').window
  globalThis.window = dom
  globalThis.document = dom.document
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  scrollY = 800; pageHeight = 2400
  dom.innerHeight = 600; dom.scrollX = 0
  Object.defineProperty(dom, 'scrollY', { configurable: true, get: () => Math.min(scrollY, Math.max(0, height() - 600)) })
  Object.defineProperty(document.body, 'scrollHeight', { configurable: true, get: height })
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: height })
  dom.scrollTo = vi.fn(({ top }) => { scrollY = top })
  dom.Element.prototype.getBoundingClientRect = function () {
    if (this.className === 'whdr') return { top: 0, bottom: 80 }
    const offset = document.body.style.position === 'fixed' ? parseFloat(document.body.style.top) : -window.scrollY
    const top = Number(this.dataset.top || 0) + offset + (parseFloat(this.style.marginTop) || 0)
    const height = this.motionHeight ?? Number(this.dataset.height || 0)
    return { top, bottom: top + height, height }
  }
  container = document.getElementById('root')
  root = createRoot(container)
})

afterEach(async () => { await act(async () => { root.unmount() }) })

async function render(collapsed, tiles, nextHeight = pageHeight, animate = false) {
  // Changing height during commit models the browser clamping scrollY when the page shrinks.
  const committed = el => { if (el) pageHeight = nextHeight }
  await act(async () => {
    root.render(<WorkoutScrollAnchor collapsed={collapsed} animate={animate}>
      <div className="whdr" />
      <div className="workout-list" ref={committed}>
        {tiles.map(([key, top, height]) => <section className="wl-unit" key={key} data-unit-key={key} data-top={top} data-height={height} />)}
      </div>
    </WorkoutScrollAnchor>)
  })
}

it('keeps the visible tile at the same pixel when a completed tile above it collapses', async () => {
  await render('', [['0', 100, 700], ['1', 800, 650]])
  const top = tileTop('1')
  await render('0', [['0', 100, 200], ['1', 300, 650]])
  expect(tileTop('1')).toBe(top)
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 300, left: 0, behavior: 'instant' })
})

it('keeps a partly visible next tile still when the topmost tile itself is collapsing', async () => {
  scrollY = 600
  await render('', [['0', 100, 700], ['1', 800, 650]])
  const top = tileTop('1')
  await render('0', [['0', 100, 200], ['1', 300, 650]])
  expect(tileTop('1')).toBe(top)
})

it('reserves only enough space to avoid a page-end clamp, then reclaims it on expansion', async () => {
  await render('', [['0', 100, 700], ['1', 800, 400]], 1400)
  const top = tileTop('1')
  await render('0', [['0', 100, 100], ['1', 200, 400]], 700)
  expect(tileTop('1')).toBe(top)
  expect(container.firstChild.style.paddingBottom).toBe('100px')
  await render('', [['0', 100, 700], ['1', 800, 400]], 1400)
  expect(tileTop('1')).toBe(top)
  expect(container.firstChild.style.paddingBottom).toBe('')
})

it('closes the gap at the page start when shrinking would require a negative scroll offset', async () => {
  scrollY = 400
  await render('', [['0', 100, 700], ['1', 800, 650]])
  await render('0', [['0', 100, 100], ['1', 200, 650]])
  expect(tileTop('1')).toBe(200)
  expect(window.scrollY).toBe(0)
  expect(container.querySelector('[data-unit-key="1"]').style.marginTop).toBeFalsy()
  const firstTop = tileTop('0')
  await render('', [['0', 100, 700], ['1', 800, 650]])
  expect(tileTop('0')).toBe(firstTop)
  expect(container.querySelector('[data-unit-key="1"]').style.marginTop).toBeFalsy()
})

it('does not insert space when collapsing from the page start', async () => {
  scrollY = 0
  await render('', [['0', 100, 300], ['1', 400, 650]])
  await render('0', [['0', 100, 100], ['1', 200, 650]])
  expect(tileTop('1') - (tileTop('0') + 100)).toBe(0)
  expect(container.querySelector('[data-unit-key="1"]').style.marginTop).toBeFalsy()
  expect(container.firstChild.style.paddingBottom).toBeFalsy()
})

it('closes the gap at the page start while the Layout sheet locks the body', async () => {
  document.body.style.position = 'fixed'; document.body.style.top = '-400px'
  await render('', [['0', 100, 700], ['1', 800, 650]])
  await render('0', [['0', 100, 100], ['1', 200, 650]])
  expect(tileTop('1')).toBe(200)
  expect(document.body.style.top).toBe('0px')
  expect(container.querySelector('[data-unit-key="1"]').style.marginTop).toBeFalsy()
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it('updates the locked body offset while the Layout sheet is open', async () => {
  document.body.style.position = 'fixed'; document.body.style.top = '-800px'
  await render('', [['0', 100, 700], ['1', 800, 650]])
  const top = tileTop('1')
  await render('0', [['0', 100, 200], ['1', 300, 650]])
  expect(tileTop('1')).toBe(top)
  expect(document.body.style.top).toBe('-300px')
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it('does not scroll when a collapse below the viewport leaves its top unchanged', async () => {
  await render('', [['0', 100, 700], ['1', 800, 650], ['2', 1500, 700]])
  await render('2', [['0', 100, 700], ['1', 800, 650], ['2', 1500, 100]])
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it('ignores unrelated updates and mounting a restored collapsed session', async () => {
  await render('0', [['0', 100, 100], ['1', 200, 1000]])
  await render('0', [['0', 100, 100], ['1', 200, 1000]])
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it('cancels an older sheet correction when restoring the workout anchor', async () => {
  const cancel = vi.fn()
  window.addEventListener('workout-scroll-anchor', cancel)
  await render('', [['0', 100, 700], ['1', 800, 650]])
  await render('0', [['0', 100, 200], ['1', 300, 650]])
  expect(cancel).toHaveBeenCalledOnce()
})

function motionSupport(reduce = false) {
  const animations = []
  const frames = new Map()
  let id = 0
  const preference = { matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  dom.matchMedia = vi.fn(() => preference)
  dom.requestAnimationFrame = vi.fn(callback => { frames.set(++id, callback); return id })
  dom.cancelAnimationFrame = vi.fn(id => frames.delete(id))
  dom.Element.prototype.animate = vi.fn(function (keyframes, options) {
    const animation = { cancel: vi.fn(() => { delete this.motionHeight }), onfinish: null, oncancel: null }
    animations.push({ element: this, keyframes, options, animation })
    return animation
  })
  return { animations, frames, preference }
}

it('animates measured collapse and expansion heights only when enabled, without a fixed maximum', async () => {
  const { animations } = motionSupport()
  await render('', [['0', 100, 2300]], 3000, true)
  expect(animations).toHaveLength(0)
  await render('0', [['0', 100, 96]], 3000, true)
  const tile = container.querySelector('.wl-unit')
  expect(animations[0].keyframes).toEqual([{ height: '2300px' }, { height: '96px' }])
  expect(animations[0].options).toMatchObject({ duration: 200 })
  expect(tile.style.overflow).toBe('clip')
  animations[0].animation.onfinish()
  expect(tile.style.overflow).toBeFalsy()
  expect(tile.style.height).toBeFalsy()
  await render('', [['0', 100, 4800]], 5500, true)
  expect(animations[1].keyframes).toEqual([{ height: '96px' }, { height: '4800px' }])
  animations[1].animation.onfinish()
  expect(tile.style.overflow).toBeFalsy()
  expect(tile.style.height).toBeFalsy()
})

it('does not animate other layouts or reduced-motion preferences', async () => {
  const { animations, preference } = motionSupport(true)
  await render('', [['0', 100, 700]])
  await render('0', [['0', 100, 100]])
  expect(animations).toHaveLength(0)
  await render('', [['0', 100, 700]], 2400, true)
  expect(animations).toHaveLength(0)
  preference.matches = false
  await render('0', [['0', 100, 100]], 2400, true)
  expect(animations).toHaveLength(1)
})

it('reverses from the painted height and cancels the previous transition', async () => {
  const { animations } = motionSupport()
  await render('', [['0', 100, 700]], 2400, true)
  await render('0', [['0', 100, 100]], 2400, true)
  container.querySelector('.wl-unit').motionHeight = 380
  await render('', [['0', 100, 700]], 2400, true)
  expect(animations[0].animation.cancel).toHaveBeenCalledOnce()
  expect(animations[0].animation.onfinish).toBeNull()
  expect(animations[1].keyframes).toEqual([{ height: '380px' }, { height: '700px' }])
})

it('retargets growing set content during expansion and releases clipping afterward', async () => {
  const { animations } = motionSupport()
  await render('0', [['0', 100, 100]], 2400, true)
  await render('', [['0', 100, 700]], 2400, true)
  container.querySelector('.wl-unit').motionHeight = 260
  await render('', [['0', 100, 1100]], 2400, true)
  expect(animations[1].keyframes).toEqual([{ height: '260px' }, { height: '1100px' }])
  animations[1].animation.onfinish()
  expect(container.querySelector('.wl-unit').style.overflow).toBeFalsy()
})

it('cancels active motion when reduced motion is enabled, or the layout is changed', async () => {
  const { animations, preference, frames } = motionSupport()
  await render('', [['0', 100, 700]], 2400, true)
  await render('0', [['0', 100, 100]], 2400, true)
  preference.matches = true
  preference.addEventListener.mock.calls[0][1]()
  expect(animations[0].animation.cancel).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
  expect(container.querySelector('.wl-unit').style.overflow).toBeFalsy()
  preference.matches = false
  await render('', [['0', 100, 700]], 2400, true)
  await render('', [['0', 100, 700]], 2400, false)
  expect(animations[1].animation.cancel).toHaveBeenCalledOnce()
  expect(container.querySelector('.wl-unit').style.overflow).toBeFalsy()
})

it('releases scroll anchoring for a user gesture and cleans up motion on unmount', async () => {
  const { animations, frames, preference } = motionSupport()
  await render('', [['0', 100, 700], ['1', 800, 650]], 2400, true)
  await render('0', [['0', 100, 100], ['1', 200, 650]], 2400, true)
  window.dispatchEvent(new Event('wheel'))
  scrollY = 50
  const [id, callback] = frames.entries().next().value
  frames.delete(id)
  callback()
  expect(window.scrollY).toBe(50)
  await act(async () => { root.render(null) })
  expect(animations[0].animation.cancel).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
  expect(preference.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
})
