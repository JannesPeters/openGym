// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RoutineMuscleMap from './RoutineMuscleMap.jsx'
import Modals from './Modals.jsx'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('./BodyMap.jsx', () => ({
  default: ({ load, body }) => <div className="bodymap" data-load={JSON.stringify(load)} data-body={body} />,
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
const trigger = () => host.querySelector('[aria-haspopup="dialog"]')
const dialog = () => host.querySelector('[role="dialog"]')
const close = () => dialog().querySelector('button')
const key = (element, key, shiftKey = false) => act(() => element.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })))
beforeEach(() => {
  useUI.setState({ sheets: [] })
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}])
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<>
    <RoutineMuscleMap body="female" routine={{ ex: [{ id: '0025', sets: 3, alternatives: [{ id: '0289', sets: 5 }] }] }} />
    <Modals />
  </>))
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

it('opens the same map, muscle chips and choice explanation in a labelled full-screen dialog', () => {
  const inline = host.querySelector('.routine-muscle-card')
  expect(inline.getAttribute('aria-label')).toBe('What this session hits')
  expect(trigger().getAttribute('aria-label')).toBe('Expand: What this session hits')
  expect(inline.querySelector('p')).toBeNull()
  act(() => trigger().click())
  expect(useUI.getState().sheets[0].kind).toBe('viewer')
  expect(dialog().getAttribute('aria-label')).toBe('What this session hits')
  expect(dialog().getAttribute('aria-modal')).toBe('true')
  const maps = host.querySelectorAll('.bodymap')
  expect(maps).toHaveLength(2)
  expect(maps[1].dataset.load).toBe(maps[0].dataset.load)
  expect(maps[1].dataset.body).toBe('female')
  expect(dialog().querySelector('.mchips').textContent).toBe(inline.querySelector('.mchips').textContent)
  expect(dialog().querySelector('p').textContent).toBe(
    'Planned muscle coverage uses the first option in each group. Your workout statistics use the exercises you actually perform.',
  )
  expect(document.activeElement).toBe(close())
  act(() => close().click())
  expect(dialog()).toBeNull()
  expect(document.activeElement).toBe(trigger())
})

it('contains keyboard focus and closes with Escape without navigating away', () => {
  const route = window.location.href
  act(() => trigger().click())
  key(close(), 'Tab')
  expect(document.activeElement).toBe(close())
  key(close(), 'Tab', true)
  expect(document.activeElement).toBe(close())
  key(close(), 'Escape')
  expect(dialog()).toBeNull()
  expect(document.activeElement).toBe(trigger())
  expect(window.location.href).toBe(route)
})
