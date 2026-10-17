// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), appBase: () => '/', beacon: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null, default: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

import RoutineEdit from './RoutineEdit.jsx'
import PlanExercises from './PlanExercises.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { EXIDX } from '../lib/exercises.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host, navigate, location
const clone = value => structuredClone(value)
const entries = [{ id: '0025', sets: 3, reps: 5, weight: 80, mode: 'reps' }]
function Navigation() {
  navigate = useNavigate()
  location = useLocation()
  return null
}
function mount(path = '/plan/r/r1', extra = {}) {
  const S = { ...clone(DEF), routines: [{ id: 'r1', name: 'Push', ex: clone(entries) }], ...extra }
  useStore.setState({ S, user: null })
  useUI.setState({ sheets: [], toastMsg: '' })
  bindUI(useUI)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={[path]}>
    <Navigation />
    <Routes>
      <Route path="/plan" element={<h1>Plan</h1>} />
      <Route path="/plan/r/:id" element={<RoutineEdit />} />
      <Route path="/plan/r/:id/exercises" element={<PlanExercises />} />
      <Route path="/plan/r/:id/exercises/new" element={<PlanExercises custom />} />
      <Route path="/plan/r/:id/exercises/:exerciseId" element={<PlanExercises />} />
      <Route path="/plan/r/:id/exercises/:exerciseId/custom" element={<PlanExercises custom />} />
      <Route path="/plan/r/:id/exercise/:index/:exerciseId" element={<PlanExercises editing />} />
      <Route path="/plan/r/:id/exercise/:index/:exerciseId/custom" element={<PlanExercises editing custom />} />
    </Routes>
  </MemoryRouter>))
}
const click = node => act(() => node.click())
const button = text => [...host.querySelectorAll('button')].find(node => node.textContent.trim() === text)
const input = (node, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value)
  node.dispatchEvent(new Event('input', { bubbles: true }))
})
const stored = () => useStore.getState().S.routines[0].ex
const row = name => [...host.querySelectorAll('.item')].find(node => node.querySelector('.tt')?.textContent.toLowerCase() === name.toLowerCase())
const back = () => click(host.querySelector('button[aria-label="Back"]'))

beforeEach(() => { localStorage.clear() })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Plan full-screen exercise navigation', () => {
  it('adds an independently configured alternative without adding a routine row', () => {
    mount('/plan/r/r1/exercise/0/0025')
    click(button('Add alternative'))
    const params = location.search
    expect(params).toContain('alternative=')
    act(() => navigate('/plan/r/r1/exercises/0289' + params))
    click(button('Add alternative'))
    expect(location.pathname).toBe('/plan/r/r1')
    expect(stored()).toHaveLength(1)
    expect(stored()[0]).toMatchObject({ id: '0025', sets: 3, reps: 5, weight: 80 })
    expect(stored()[0].alternatives).toHaveLength(1)
    expect(stored()[0].alternatives[0].id).toBe('0289')
    expect(stored()[0].alternatives[0].weight).not.toBe(80)
    expect(host.textContent).toContain('Choose one')
  })

  it('preserves options on primary save and edits only the selected option', () => {
    const group = { ...entries[0], slotId: 's', alternatives: [{ id: '0289', sets: 2, reps: 12, weight: 45 }] }
    mount('/plan/r/r1/exercise/0/0025?slotKey=s', { routines: [{ id: 'r1', name: 'Push', ex: [group] }] })
    click(button('Save'))
    expect(stored()[0].alternatives).toEqual(group.alternatives)
    act(() => navigate('/plan/r/r1/exercise/0/0025?slotKey=s&option=0289'))
    click(button('Save'))
    expect(stored()[0]).toMatchObject({ id: '0025', reps: 5, weight: 80, alternatives: [{ id: '0289', sets: 2, reps: 12, weight: 45 }] })
  })

  it('rejects grouped edit routes when another occurrence moved into that position', () => {
    mount('/plan/r/r1/exercise/0/0025?slotKey=old', { routines: [{ id: 'r1', name: 'Push', ex: [{ ...entries[0], slotId: 'new' }] }] })
    expect(location.pathname).toBe('/plan/r/r1')
    expect(stored()[0].slotId).toBe('new')
  })

  it('uses routed pages, keeps search and chosen markers, and returns to the routine through history', () => {
    mount()
    click(button('Add exercise'))
    expect(location.pathname).toBe('/plan/r/r1/exercises')
    expect(document.activeElement).toBe(host.querySelector('h1'))
    input(host.querySelector('.search input'), 'bench press')
    const bench = row('Barbell Bench Press')
    expect(bench.querySelector('[aria-label="Chosen"]')).toBeTruthy()
    click(bench.querySelector('button'))
    expect(stored()).toHaveLength(2)
    click(bench)
    expect(location.pathname).toBe('/plan/r/r1/exercises/0025')
    expect(host.querySelector('.search')).toBeNull()
    expect(useUI.getState().sheets).toHaveLength(0)
    back()
    expect(host.querySelector('.search input').value).toBe('bench press')
    act(() => navigate(1))
    click(button('Add to routine'))
    expect(stored()).toHaveLength(3)
    expect(host.querySelector('.search input').value).toBe('bench press')
    back()
    expect(location.pathname).toBe('/plan/r/r1')
    expect(host.querySelectorAll('[data-routine-row]')).toHaveLength(3)
  })

  it('saves edits, preserves duplicate occurrence context, and removes with Undo', () => {
    mount('/plan/r/r1', { routines: [{ id: 'r1', name: 'Push', ex: [...clone(entries), { ...entries[0], reps: 9 }] }] })
    click(host.querySelectorAll('.item-open')[1])
    expect(location.pathname).toBe('/plan/r/r1/exercise/1/0025')
    click(button('Save'))
    expect(stored()[1].reps).toBe(9)
    click(host.querySelectorAll('.item-open')[1])
    click(button('Remove from routine'))
    expect(location.pathname).toBe('/plan/r/r1')
    expect(stored()).toHaveLength(1)
    act(() => useUI.getState().runToastAction())
    expect(stored()[1].reps).toBe(9)
  })

  it('keeps variant selection and configuration when returning from the custom exercise editor', () => {
    const variant = { ...EXIDX['0025'], id: 'cvariant', custom: true, baseExerciseId: '0025', variantLabel: 'Gym80' }
    mount('/plan/r/r1', { customEx: [variant] })
    click(button('Add exercise'))
    input(host.querySelector('.search input'), 'bench press')
    click(row('Barbell Bench Press'))
    click(host.querySelector('[aria-label="Variants"] button[aria-label*="Gym80"]'))
    click(button('Edit or delete this exercise'))
    expect(location.pathname).toBe('/plan/r/r1/exercises/0025/custom')
    back()
    expect(host.querySelector('[aria-label="Variants"] [aria-pressed="true"]').textContent).toBe('Gym80')
    click(button('Add to routine'))
    expect(stored().at(-1).id).toBe('cvariant')
  })

  it('provides safe explicit Back for deep links and rejects stale slots/deleted routines', () => {
    mount('/plan/r/r1/exercises/0025')
    back()
    expect(location.pathname).toBe('/plan/r/r1')
    act(() => navigate('/plan/r/r1/exercise/0/0289'))
    expect(location.pathname).toBe('/plan/r/r1')
    act(() => navigate('/plan/r/missing/exercises'))
    expect(location.pathname).toBe('/plan')
  })

  it('returns a deep-linked replacement to its routine without walking unrelated history', () => {
    mount('/plan/r/r1/exercises/0289?slot=0&original=0025')
    click(button('Replace'))
    expect(location.pathname).toBe('/plan/r/r1')
    expect(stored()[0]).toMatchObject({ id: '0289', sets: 3, reps: 5 })
  })

  it('keeps missing exercises editable and removable rather than trapping an unresolved slot', () => {
    mount('/plan/r/r1', { routines: [{ id: 'r1', name: 'Push', ex: [{ ...entries[0], id: 'missing-exercise' }] }] })
    click(host.querySelector('.item-open'))
    expect(location.pathname).toBe('/plan/r/r1/exercise/0/missing-exercise')
    click(button('Remove from routine'))
    expect(location.pathname).toBe('/plan/r/r1')
    expect(stored()).toHaveLength(0)
  })
})
