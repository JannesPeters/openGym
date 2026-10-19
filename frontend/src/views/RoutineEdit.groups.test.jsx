// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import Modals from '../components/Modals.jsx'
import { bindUI } from '../components/ui.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exercisePicker, exConfigSheet } from '../sheets.jsx'
import { exOr } from '../lib/exercises.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', async importOriginal => ({
  ...await importOriginal(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(),
}))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

bindUI(useUI)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host, pickerClose
const original = [
  { id: '0025', sets: 3, reps: 5, mode: 'reps', weight: 80, slotId: 'old-choice', alternatives: [{ id: '0289', sets: 4, reps: 8, mode: 'reps' }] },
  { id: '0009', sets: 3, reps: 8, mode: 'reps', sg: 'existing' },
  { id: '0025', sets: 3, reps: 8, mode: 'reps', sg: 'existing' },
]
const button = (scope, label) => [...scope.querySelectorAll('button')].find(item => item.textContent.trim() === label)
const draft = () => host.querySelector('.sheet')
const click = element => act(() => element.click())
function mount(ex = original) {
  useStore.setState({ S: { ...structuredClone(DEF), routines: [{ id: 'r1', name: 'Push day', ex: structuredClone(ex) }] }, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={['/plan/r/r1']}><Routes>
    <Route path="/plan/r/:id" element={<RoutineEdit />} />
    <Route path="/plan" element={<h1>Plan</h1>} />
  </Routes><Modals /></MemoryRouter>))
}
function add(id, quick = true) {
  click(button(draft(), 'Add exercise'))
  act(() => exercisePicker.mock.lastCall[0](exOr(id), quick))
}
beforeEach(() => {
  vi.clearAllMocks()
  useUI.setState({ sheets: [] })
  pickerClose = vi.fn()
  exercisePicker.mockReturnValue({ close: pickerClose })
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

it('exposes a distinct new-group action above the saved routine list and persists an independent slot', () => {
  mount()
  const header = host.querySelector('.routine-ex-h')
  expect(button(header, 'Add exercise')).toBeTruthy()
  const create = button(header, 'Create new group')
  expect(create.compareDocumentPosition(host.querySelector('.routine-list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  click(create)
  const name = draft().querySelector('input')
  expect(name.labels[0].textContent).toBe('Group name')
  act(() => {
    Object.getOwnPropertyDescriptor(name.constructor.prototype, 'value').set.call(name, '  Chest options  ')
    name.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(button(draft(), 'Create new group').disabled).toBe(true)
  add('0025')
  expect(button(draft(), 'Create new group').disabled).toBe(true)
  add('0289', false)
  expect(exConfigSheet.mock.lastCall[4].id).toBe('r1')
  expect(exConfigSheet.mock.lastCall[7]).toBe('Add to routine')
  act(() => exConfigSheet.mock.lastCall[2]({ id: '0289', sets: 4, reps: 9, mode: 'reps', weight: 22 }))
  expect(pickerClose).toHaveBeenCalledTimes(2)
  expect(useStore.getState().S.routines[0].ex).toEqual(original)
  click(button(draft(), 'Create new group'))
  const exercises = useStore.getState().S.routines[0].ex
  expect(exercises.slice(0, 3)).toEqual(original)
  expect(exercises).toHaveLength(4)
  expect(exercises[3].slotId).toBeTruthy()
  expect(exercises[3].slotId).not.toBe('old-choice')
  expect(exercises[3].sg).toBeUndefined()
  expect(exercises[3].groupName).toBe('Chest options')
  expect(exercises[3].alternatives[0].groupName).toBeUndefined()
  expect(exercises[3].alternatives).toEqual([{ id: '0289', sets: 4, reps: 9, mode: 'reps', weight: 22 }])
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].ex).toEqual(exercises)
  expect(draft()).toBeNull()
  expect(host.textContent).toContain('Choose one')
  expect(host.textContent).toContain('Chest options')
  const reloaded = JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].ex
  act(() => root.unmount())
  host.remove()
  mount(reloaded)
  expect(host.querySelector('.routine-list').textContent).toContain('Chest options')
  expect(useStore.getState().S.routines[0].ex).toEqual(exercises)
})

it('supports empty routines and cancelling a populated draft without persisting it', () => {
  mount([])
  click(button(host.querySelector('.routine-ex-h'), 'Create new group'))
  add('0025')
  add('0289')
  click(host.querySelector('.mback'))
  expect(useStore.getState().S.routines[0].ex).toEqual([])
})

it('does not recreate a routine deleted while its draft is open', () => {
  mount()
  click(button(host.querySelector('.routine-ex-h'), 'Create new group'))
  add('0025')
  add('0289')
  act(() => useStore.getState().update(state => { state.routines = [] }))
  click(button(draft(), 'Create new group'))
  expect(useStore.getState().S.routines).toEqual([])
})
