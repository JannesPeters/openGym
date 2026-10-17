// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkoutOptions from './WorkoutOptions.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { buildCombinedEntries } from '../lib/session-merge.js'
import { exerciseNameText } from '../lib/format.js'
import { exOr } from '../lib/exercises.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), appBase: () => '/', beacon: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
const buttons = () => [...host.querySelectorAll('button')]
const button = text => buttons().find(node => node.textContent.trim() === text)
const pick = id => buttons().find(node => node.querySelector('.tt')?.textContent === exerciseNameText(exOr(id)))
const click = node => act(() => node.click())
function Sheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)
}
beforeEach(() => {
  localStorage.clear()
  const state = { ...structuredClone(DEF), routines: [{ id: 'r', name: 'Push', prog: 'off', ex: [{
    id: '0025', slotId: 'slot', sets: 3, reps: 10, weight: 20,
    alternatives: [{ id: '0289', sets: 2, reps: 12, weight: 45 }]
  }] }] }
  state.active = { id: 'a', cur: 0, entries: buildCombinedEntries(state, ['r']).entries }
  useStore.setState({ S: state, user: null })
  useUI.setState({ sheets: [], timer: null, work: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<><WorkoutOptions entryIdx={0} /><Sheets /></>))
})
afterEach(() => { act(() => root.unmount()); host.remove(); useUI.setState({ sheets: [] }) })

describe('workout option controls', () => {
  it('requires a real selection and persists the chosen exercise and available options', () => {
    expect(host.querySelector('[data-testid="workout-choice"]')).toBeTruthy()
    click(pick('0289'))
    const entry = useStore.getState().S.active.entries[0]
    expect(entry).toMatchObject({ id: '0289', target: { sets: 2, reps: 12, weight: 45 } })
    expect(host.querySelector('[data-testid="workout-choice"]')).toBeNull()
    const saved = JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0]
    expect(saved.id).toBe('0289')
    expect(saved.choiceOptions).toHaveLength(2)
  })
  it('locks changing after a logged set while allowing an additional full exercise', () => {
    click(pick('0025'))
    act(() => useStore.getState().update(s => { s.active.entries[0].sets[0].done = true }))
    expect(button('Change exercise')).toBeUndefined()
    const original = structuredClone(useStore.getState().S.active.entries[0])
    click(button('Add another exercise from this group'))
    click(pick('0289'))
    const entries = useStore.getState().S.active.entries
    expect(entries[0]).toEqual(original)
    expect(entries[1].sets).toHaveLength(2)
    expect(entries[1].target.weight).toBe(45)
    expect(useStore.getState().S.routines[0].ex).toHaveLength(1)
  })
  it('fails closed if the selected occurrence changes while the chooser is open', () => {
    click(pick('0025'))
    click(button('Change exercise'))
    act(() => useStore.getState().update(s => { s.active.entries[0].choiceId = 'other-occurrence' }))
    click(pick('0289'))
    expect(useStore.getState().S.active.entries[0].id).toBe('0025')
    expect(useUI.getState().toastMsg).toBeTruthy()
  })
})
