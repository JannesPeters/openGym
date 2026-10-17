// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WebUpdate from './WebUpdate.jsx'

const mock = vi.hoisted(() => ({ state: { checking: false, available: false } }))
vi.mock('../lib/web-update.js', () => ({
  getWebUpdate: () => mock.state, subscribeWebUpdate: () => () => {},
}))
let host, root, reload
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mock.state = { checking: false, available: false }
  reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })

it('stays hidden until an update is ready', () => {
  act(() => root.render(<WebUpdate />))
  expect(host.textContent).toBe('')
})

it('announces the update without reloading, and reloads only on explicit activation', () => {
  mock.state = { checking: false, available: true }
  localStorage.setItem('gym_state_v1', '{"workouts":[{"id":"saved"}]}')
  act(() => root.render(<WebUpdate />))
  expect(host.querySelector('[role="status"]').textContent).toContain('Finish editing')
  expect(reload).not.toHaveBeenCalled()
  act(() => host.querySelector('button').click())
  expect(reload).toHaveBeenCalledOnce()
  expect(localStorage.getItem('gym_state_v1')).toBe('{"workouts":[{"id":"saved"}]}')
  localStorage.removeItem('gym_state_v1')
})
