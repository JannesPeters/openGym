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
const button = text => buttons().find(node => node.textContent.trim() === text || node.getAttribute('aria-label') === text)
const pick = id => buttons().find(node => node.classList.contains('workout-choice-option')
  && node.querySelector('.tt')?.textContent === exerciseNameText(exOr(id)))
const openChoice = () => click(host.querySelector('.workout-choice-open'))
const openEditor = () => click(button('Change exercise'))
const click = node => act(() => node.click())
function Sheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)
}
function Options() {
  const entries = useStore(s => s.S.active?.entries || [])
  return entries.map((_, entryIdx) => <WorkoutOptions key={entryIdx} entryIdx={entryIdx} />)
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
  act(() => root.render(<><Options /><Sheets /></>))
})
afterEach(() => { act(() => root.unmount()); host.remove(); useUI.setState({ sheets: [] }) })

describe('workout option controls', () => {
  it('requires a real selection and persists the chosen exercise and available options', () => {
    expect(host.querySelector('[data-testid="workout-choice"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="workout-choice"] .list')).toBeNull()
    expect(host.querySelector('.workout-choice-open').textContent).toContain('2 options')
    openChoice()
    expect(useUI.getState().sheets.at(-1).kind).toBe('sheet')
    expect(host.querySelector('[role="dialog"]').getAttribute('aria-modal')).toBe('true')
    expect(host.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Choose exercise')
    click(pick('0289'))
    const entry = useStore.getState().S.active.entries[0]
    expect(entry).toMatchObject({ id: '0289', target: { sets: 2, reps: 12, weight: 45 } })
    expect(host.querySelector('[data-testid="workout-choice"]')).toBeNull()
    const saved = JSON.parse(localStorage.getItem('gym_state_v1')).active.entries[0]
    expect(saved.id).toBe('0289')
    expect(saved.groupInstance.options).toHaveLength(2)
    expect(saved.optionId).toBe(saved.groupInstance.options[1].id)
    expect(saved.entryId).not.toBe(saved.groupInstance.id)
    const change = button('Change exercise')
    expect(document.activeElement).toBe(change)
    openEditor()
    const current = host.querySelector('[role="dialog"] [aria-pressed="true"]')
    expect(current.querySelector('.tt').textContent).toBe(exerciseNameText(exOr('0289')))
    expect(current.textContent).toContain('Current')
    click(button('Close'))
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(button('Change exercise'))
  })
  it('edits multiple selected exercises and shows one group name with selection states', () => {
    act(() => useStore.getState().update(s => {
      s.routines[0].ex[0].groupName = 'Chest options'
      s.active.entries = buildCombinedEntries(s, ['r']).entries
    }))
    openChoice()
    click(pick('0025'))
    openEditor()
    click(pick('0289'))
    click(button('Done'))

    const entries = useStore.getState().S.active.entries
    expect(entries.map(item => item.id)).toEqual(['0025', '0289'])
    expect(entries[0].choiceGroupId).toBe(entries[1].choiceGroupId)
    expect(entries.map(item => item.sets.length)).toEqual([3, 2])
    expect(host.querySelectorAll('.workout-group-name')).toHaveLength(1)
    expect(host.querySelectorAll('.workout-choice-divider')).toHaveLength(2)

    openEditor()
    const selected = [...host.querySelectorAll('[data-workout-choice-option][aria-pressed="true"]')]
    expect(selected.map(node => node.dataset.workoutChoiceOption)).toEqual(['0025', '0289'])
    expect(selected.map(node => node.querySelector('.tag').textContent)).toEqual(['Current', 'Selected'])
    click(button('Close'))
    expect(useStore.getState().S.routines[0].ex).toHaveLength(1)
  })

  it('does not stop live timers when the group selection is unchanged', () => {
    openChoice()
    click(pick('0025'))
    const work = { left: 12, total: 20, endsAt: Date.now() + 12000 }
    const timer = { left: 30, total: 90, endsAt: Date.now() + 30000 }
    useUI.setState({ work, timer })
    openEditor()
    click(button('Done'))
    expect(useUI.getState().work).toEqual(work)
    expect(useUI.getState().timer).toEqual(timer)
  })

  it('locks logged exercises in the editor while allowing another group option', () => {
    openChoice()
    click(pick('0025'))
    act(() => useStore.getState().update(s => { s.active.entries[0].sets[0].done = true }))
    const original = structuredClone(useStore.getState().S.active.entries[0])
    openEditor()
    expect(pick('0025').getAttribute('aria-disabled')).toBe('true')
    click(pick('0289'))
    click(button('Done'))
    const entries = useStore.getState().S.active.entries
    expect(entries[0]).toEqual(original)
    expect(entries[1].sets).toHaveLength(2)
    expect(entries[1].target.weight).toBe(45)
    expect(useStore.getState().S.routines[0].ex).toHaveLength(1)
  })
  it('fails closed if the selected occurrence changes while the chooser is open', () => {
    openChoice()
    click(pick('0025'))
    openEditor()
    act(() => useStore.getState().update(s => { s.active.entries[0].entryId = 'other-occurrence' }))
    click(pick('0289'))
    click(button('Done'))
    expect(useStore.getState().S.active.entries[0].id).toBe('0025')
    expect(useUI.getState().toastMsg).toBeTruthy()
  })
})
