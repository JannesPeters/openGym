// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Media, { Thumb } from './Media.jsx'
import { EXIDX, registerCustom } from '../lib/exercises.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const css = readFileSync(process.cwd() + '/src/index.css', 'utf8')

const state = vi.hoisted(() => ({ S: { gifSize: 'full' } }))
vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: state.S, update: () => {} })
}))

let host, root, style
beforeEach(() => {
  state.S = { gifSize: 'full' }
  style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  style.remove()
  registerCustom([])
  vi.restoreAllMocks()
})

describe('catalogue media sizing', () => {
  it.each(['', 'list ex-grid', 'wthumb'])('never enlarges thumbnails in %s', className => {
    act(() => root.render(<div className={className}><div className="item"><Thumb ex={EXIDX['0001']} /></div></div>))
    expect(getComputedStyle(host.querySelector('img')).objectFit).toBe('scale-down')
  })

  it.each(['full', 'compact', 'mini'])('never enlarges the %s animation or paused still', size => {
    state.S.gifSize = size === 'mini' ? 'mini' : 'full'
    act(() => root.render(<Media ex={EXIDX['0001']} compact={size === 'compact'} minimizable />))
    expect(getComputedStyle(host.querySelector('video')).objectFit).toBe('scale-down')
    act(() => host.querySelector('.exmedia').click())
    expect(getComputedStyle(host.querySelector('img')).objectFit).toBe('scale-down')
  })

  it('keeps a failed animation fallback at natural size', () => {
    act(() => root.render(<Media ex={EXIDX['0001']} />))
    act(() => host.querySelector('video').dispatchEvent(new Event('error')))
    expect(getComputedStyle(host.querySelector('img')).objectFit).toBe('scale-down')
  })

  it('applies the same sizing to a variant inheriting catalogue artwork', () => {
    const ex = { id: 'variant', custom: true, baseExerciseId: '0001', n: 'Sit-up variant' }
    registerCustom([ex])
    act(() => root.render(<><Thumb ex={ex} /><Media ex={ex} /></>))
    for (const el of host.querySelectorAll('img, video')) {
      expect(getComputedStyle(el).objectFit).toBe('scale-down')
    }
  })
})
