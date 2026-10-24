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
import { exerciseTitleFor } from '../lib/i18n.js'
import { migrateExerciseGroups, groupOf, placeExerciseGroup } from '../lib/exercise-groups.js'
import { optionsOf } from '../lib/exercise-options.js'

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
function mount(ex = original, exerciseGroups = []) {
  useStore.setState({ S: migrateExerciseGroups({ ...structuredClone(DEF), exerciseGroups, routines: [{ id: 'r1', name: 'Push day', ex: structuredClone(ex) }] }), user: null })
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
  expect(exercisePicker.mock.lastCall[1]).toEqual({ detailLabel: 'Add to routine' })
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

it('renders the routine name as a standalone text field outside the settings list', () => {
  mount()
  const input = host.querySelector('.routine-name-field input')
  expect(input.labels[0].textContent).toBe('Name')
  expect(input.type).toBe('text')
  expect(input.name).toBe('name')
  expect(input.classList.contains('field')).toBe(true)
  expect(input.closest('.lrow, .sect-b')).toBeNull()
  expect(host.querySelector('.routine-details input')).toBeNull()
})

it('exposes a distinct new-group action above the saved routine list and persists an independent slot', () => {
  mount()
  const initial = structuredClone(useStore.getState().S.routines[0].ex)
  const originalRows = [...host.querySelectorAll('.routine-list .item-open')]
  expect(originalRows[0].querySelector('.tt').textContent).toBe('Exercise group')
  expect(originalRows[0].querySelector('.workout-group-name').textContent).toBe('2 options')
  expect(originalRows[1].querySelector('.tt').textContent).toBe(exerciseTitleFor(exOr('0009')))
  expect(originalRows[1].querySelector('.workout-group-name')).toBeNull()
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
  expect(button(draft(), 'Create new group').disabled).toBe(false)
  add('0025')
  expect(button(draft(), 'Create new group').disabled).toBe(false)
  add('0289', false)
  expect(exConfigSheet.mock.lastCall[4].id).toBe('r1')
  expect(exConfigSheet.mock.lastCall[7]).toBe('Add to routine')
  act(() => exConfigSheet.mock.lastCall[2]({ id: '0289', sets: 4, reps: 9, mode: 'reps', weight: 22 }))
  expect(pickerClose).toHaveBeenCalledTimes(2)
  expect(useStore.getState().S.routines[0].ex).toEqual(initial)
  click(button(draft(), 'Create new group'))
  const exercises = useStore.getState().S.routines[0].ex
  expect(exercises.slice(0, 3)).toEqual(initial)
  expect(exercises).toHaveLength(4)
  expect(exercises[3].slotId).toBeTruthy()
  expect(exercises[3].slotId).not.toBe('old-choice')
  expect(exercises[3].sg).toBeUndefined()
  expect(groupOf(useStore.getState().S, exercises[3]).name).toBe('Chest options')
  expect(optionsOf(exercises[3], useStore.getState().S)[1]).toMatchObject({ id: '0289', sets: 4, reps: 9, mode: 'reps', weight: 22 })
  expect(exercises[3].id).toBeUndefined()
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].ex).toEqual(exercises)
  expect(draft()).toBeNull()
  expect(host.textContent).toContain('Exercise group')
  expect(host.textContent).toContain('Chest options')
  const namedGroup = host.querySelector('[data-ex-index="3"] .item-open')
  expect(namedGroup.querySelector('.tt').textContent).toBe('Chest options')
  expect(namedGroup.querySelector('.ss').textContent.toLowerCase()).toContain(exerciseTitleFor(exOr('0025')).toLowerCase())
  expect(namedGroup.querySelector('.workout-group-name').textContent).toBe('2 options')
  const reloaded = JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].ex
  const groups = JSON.parse(localStorage.getItem('gym_state_v1')).exerciseGroups
  act(() => root.unmount())
  host.remove()
  mount(reloaded, groups)
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

it('reuses one definition with local configs and exposes affected uses, independent copying and archiving', () => {
  mount()
  const definitionId = useStore.getState().S.exerciseGroups[0].id
  act(() => useStore.getState().update(s => {
    s.exerciseGroups[0].name = 'Shared press'
    s.routines.push({ id: 'light', name: 'Light', ex: [placeExerciseGroup(s, definitionId)] })
  }))
  click(host.querySelector('[data-row-open]'))
  expect(draft().textContent).toContain('Push day, Light')
  const option = draft().querySelector('.list .item-open')
  click(option)
  const config = exConfigSheet.mock.lastCall
  act(() => config[2]({ sets: 5, reps: 6, weight: 55 }))
  const live = useStore.getState().S
  expect(optionsOf(live.routines[0].ex[0], live)[0].weight).toBe(55)
  expect(optionsOf(live.routines[1].ex[0], live)[0].weight).not.toBe(55)
  click(button(draft(), 'Make independent copy'))
  const copied = useStore.getState().S.routines[0].ex[0].groupId
  expect(copied).not.toBe(definitionId)
  expect(useStore.getState().S.routines[1].ex[0].groupId).toBe(definitionId)
  click(host.querySelector('[data-row-open]'))
  expect(draft().textContent).toContain('Changes affect future sessions in: Push day')
  click(button(draft(), 'Archive group'))
  expect(useStore.getState().S.exerciseGroups.find(group => group.id === copied).archived).toBe(true)
  click(button(draft(), 'Done'))
  click(button(host.querySelector('.routine-ex-h'), 'Reuse exercise group'))
  expect(draft().textContent).toContain('Archived')
  expect(draft().querySelector('.list button[disabled]')).toBeTruthy()
  click(button(draft(), 'Restore'))
  expect(useStore.getState().S.exerciseGroups.find(group => group.id === copied).archived).toBe(false)
})
