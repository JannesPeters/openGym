// @vitest-environment happy-dom
// Issue #294: "Progression" (with its "No automatic progression" choice) and the switch below it
// read like two settings for the same thing. They are not, and the screen now says how.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))

let root
let container

function renderRoutine(routine) {
  const S = clone(DEF)
  S.routines = [{ id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [], ...routine }]
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(
    <MemoryRouter initialEntries={['/routine/r1']}>
      <Routes><Route path="/routine/:id" element={<RoutineEdit />} /></Routes>
    </MemoryRouter>
  ))
}

const rowTitled = title => [...container.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  root = null
  container = null
})

describe('routine progression wording (#294)', () => {
  it('names the switch for what it is: a deload routine, whose workouts do not count', () => {
    renderRoutine({})
    expect(rowTitled('Exclude from automatic progression')).toBeUndefined()
    const row = rowTitled('Deload routine')
    expect(row).toBeTruthy()
    expect(row.querySelector('.lrow-s')).toBeNull()
    expect(row.querySelector('.routine-setting-details').getAttribute('aria-label')).toBe('Deload routine: Details')
    expect(row.querySelector('.lrow-i')).toBeNull()
    expect(rowTitled('Progression').querySelector('.lrow-i')).toBeNull()
    expect(rowTitled('Progression').querySelector('.lrow-c')).not.toBeNull()
    expect(row.querySelector('[role="switch"]')).not.toBeNull()
  })

  it('keeps the progression selector without the redundant explanatory block', () => {
    renderRoutine({ prog: 'off' })
    expect(rowTitled('Progression').textContent).toContain('No automatic progression')
    expect(container.querySelector('.sect-b + .small.dim')).toBeNull()
    expect(container.textContent).not.toContain('Applies to every exercise')
    act(() => root.unmount())
    container.remove()
    renderRoutine({})
    expect(rowTitled('Progression').textContent).toContain('Linear')
    expect(container.querySelector('.sect-b + .small.dim')).toBeNull()
  })

  it('keeps the Deload details entry without a main-row explanation', () => {
    renderRoutine({ excludeFromProgression: true })
    expect(rowTitled('Deload routine').querySelector('.routine-setting-details')).not.toBeNull()
    expect(container.textContent).not.toContain('do not count toward progression')
    expect(container.querySelector('.sect-b + .small.dim')).toBeNull()
  })

  it('the switch still writes the same routine flag the session builder reads', () => {
    renderRoutine({})
    act(() => rowTitled('Deload routine').querySelector('[role="switch"]').click())
    expect(useStore.getState().S.routines[0].excludeFromProgression).toBe(true)
    act(() => rowTitled('Deload routine').querySelector('[role="switch"]').click())
    expect(useStore.getState().S.routines[0].excludeFromProgression).toBeUndefined()
  })
})
