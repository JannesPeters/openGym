// @vitest-environment happy-dom
import React, { act } from 'react'
import { LANGS, DERIVED_LOCALES } from '../lib/i18n-core.js'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { _setLangState } from '../lib/i18n-core.js'
import de from '../locales/de.js'
import { buildPlanBundle, parsePlan } from '../lib/plan-share.js'
import { bindUI } from '../components/ui.jsx'
import { useUI } from '../store/useUI.js'

const mocks = vi.hoisted(() => ({ exConfigSheet: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', async importOriginal => ({
  ...await importOriginal(), glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: mocks.exConfigSheet, confirmSheet: vi.fn()
}))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
bindUI(useUI)
const clone = value => JSON.parse(JSON.stringify(value))
const custom = id => ({ id, n: id, bp: 'chest', eq: 'body weight', tg: 'chest', custom: true })
const entry = (id, setup, sg) => ({
  id, sets: 3, reps: 5, weight: setup, note: `setup-${setup}`,
  ...(sg ? { sg } : {})
})

let root
let container
function MenuSheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(sheet => <React.Fragment key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</React.Fragment>)
}

function setRoutine(ex) {
  const S = clone(DEF)
  S.routines = [{ id: 'r1', name: 'Move test', emoji: 'dumbbell', ex }]
  S.customEx = ['c1', 'c2', 'c3', 'c4'].map(custom)
  useStore.setState({ S, user: null })
}

function renderRoutine() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(
    <MemoryRouter initialEntries={['/routine/r1']}>
      <Routes><Route path="/routine/:id" element={<RoutineEdit />} /></Routes><MenuSheets />
    </MemoryRouter>
  ))
}

function itemFor(name) {
  return [...container.querySelectorAll('.item')].find(item => item.textContent.includes(name))
}

function moveButton(name, direction) {
  act(() => useUI.setState({ sheets: [] }))
  act(() => itemFor(name).querySelector('[data-exercise-menu]').click())
  return [...container.querySelectorAll('.menu-item')].find(item => item.querySelector('.tt').textContent === direction)
}
const disabled = action => action.getAttribute('aria-disabled') === 'true'
const actionTitle = action => action.querySelector('.ss')?.textContent || action.querySelector('.tt').textContent
const clickMove = (name, direction) => {
  const action = moveButton(name, direction)
  act(() => action.click())
}

function pointerActivateArea(button) {
  act(() => {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  localStorage.clear()
  mocks.exConfigSheet.mockClear()
  useUI.setState({ sheets: [] })
  _setLangState('en', null, null, null)
  root = null
  container = null
})

afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  _setLangState('en', null, null, null)
})

describe('routine move controls', () => {
  // #377: the arrows on a superset row move that one exercise, not the whole superset.
  it('moves a superset member inside its superset and persists complete occurrences', () => {
    setRoutine([
      entry('c1', 10, 'g'),
      entry('c2', 20, 'g'),
      entry('c3', 30, 'g'),
      entry('c4', 40)
    ])
    renderRoutine()

    clickMove('setup-10', 'Move down')

    const moved = useStore.getState().S.routines[0].ex
    expect(moved).toEqual([
      entry('c2', 20, 'g'),
      entry('c1', 10, 'g'),
      entry('c3', 30, 'g'),
      entry('c4', 40)
    ])
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].ex).toEqual(moved)
  })

  it('takes the last member out of its superset, where it stands, and the next press moves it on', () => {
    setRoutine([
      entry('c1', 10, 'g'),
      entry('c2', 20, 'g'),
      entry('c3', 30, 'g'),
      entry('c4', 40)
    ])
    renderRoutine()
    expect(actionTitle(moveButton('setup-30', 'Move down'))).toBe('Move out of the superset')
    expect(actionTitle(moveButton('setup-20', 'Move down'))).toBe('Move down')

    clickMove('setup-30', 'Move down')
    expect(useStore.getState().S.routines[0].ex).toEqual([
      entry('c1', 10, 'g'),
      entry('c2', 20, 'g'),
      entry('c3', 30),
      entry('c4', 40)
    ])

    clickMove('setup-30', 'Move down')
    expect(useStore.getState().S.routines[0].ex).toEqual([
      entry('c1', 10, 'g'),
      entry('c2', 20, 'g'),
      entry('c4', 40),
      entry('c3', 30)
    ])
  })

  it('a superset member on the first row can still leave upward; a superset of two dissolves', () => {
    setRoutine([
      entry('c1', 10, 'g'),
      entry('c2', 20, 'g'),
      entry('c3', 30)
    ])
    renderRoutine()
    const up = moveButton('setup-10', 'Move up')
    expect(disabled(up)).toBe(false)
    expect(actionTitle(up)).toBe('Move out of the superset')

    act(() => up.click())
    expect(useStore.getState().S.routines[0].ex).toEqual([
      entry('c1', 10),
      entry('c2', 20),
      entry('c3', 30)
    ])
    expect(disabled(moveButton('setup-10', 'Move up'))).toBe(true)
  })

  it('a single exercise jumps a whole superset and does not join it', () => {
    setRoutine([
      entry('c3', 30),
      entry('c1', 10, 'g'),
      entry('c2', 20, 'g')
    ])
    renderRoutine()

    clickMove('setup-30', 'Move down')
    expect(useStore.getState().S.routines[0].ex).toEqual([
      entry('c1', 10, 'g'),
      entry('c2', 20, 'g'),
      entry('c3', 30)
    ])
  })

  it('moves the selected duplicate occurrence without aliasing its configuration', () => {
    setRoutine([
      entry('c1', 10),
      entry('c2', 20),
      entry('c1', 30)
    ])
    renderRoutine()

    clickMove('setup-30', 'Move up')

    expect(useStore.getState().S.routines[0].ex).toEqual([
      entry('c1', 10),
      entry('c1', 30),
      entry('c2', 20)
    ])
  })

  it('moves a standalone occurrence down with every configuration field intact', () => {
    const selected = {
      ...entry('c1', 10),
      mode: 'reps', prog: 'double', repsMin: 4, repsMax: 12,
      side: true, warmupSets: 2,
      intensifier: { type: 'restpause', pauseSec: 20 }
    }
    setRoutine([selected, entry('c2', 20), entry('c3', 30)])
    renderRoutine()

    clickMove('setup-10', 'Move down')

    expect(useStore.getState().S.routines[0].ex).toEqual([
      entry('c2', 20), selected, entry('c3', 30)
    ])
  })

  it('disables unit-boundary directions without cleaning or persisting state', () => {
    setRoutine([
      entry('c1', 10, 'orphan'),
      entry('c2', 20)
    ])
    renderRoutine()
    const before = useStore.getState().S

    expect(disabled(moveButton('c1', 'Move up'))).toBe(true)
    expect(disabled(moveButton('c2', 'Move down'))).toBe(true)
    clickMove('c1', 'Move up')

    expect(useStore.getState().S).toBe(before)
    expect(useStore.getState().S.routines[0].ex[0].sg).toBe('orphan')
    expect(localStorage.getItem('gym_state_v1')).toBeNull()
  })

  it('keeps pointer activation in both disabled boundary areas isolated from the routine row', () => {
    setRoutine([
      entry('c1', 10, 'orphan'),
      entry('c2', 20)
    ])
    renderRoutine()
    const before = useStore.getState().S
    const firstUp = moveButton('c1', 'Move up')
    const lastDown = moveButton('c2', 'Move down')

    expect(disabled(firstUp)).toBe(true)
    expect(disabled(lastDown)).toBe(true)
    pointerActivateArea(lastDown)
    pointerActivateArea(moveButton('c1', 'Move up'))

    expect(mocks.exConfigSheet).not.toHaveBeenCalled()
    expect(useStore.getState().S).toBe(before)
    expect(useStore.getState().S.routines[0].ex[0].sg).toBe('orphan')
    expect(localStorage.getItem('gym_state_v1')).toBeNull()
  })

  it('uses localized accessible names and titles, retains button focus, and does not open config', () => {
    _setLangState('de', de, null, null)
    setRoutine([entry('c1', 10), entry('c2', 20)])
    renderRoutine()
    const button = moveButton('c2', 'Nach oben')

    expect(actionTitle(button)).toBe('Nach oben')
    button.focus()
    act(() => button.click())

    expect(document.activeElement?.tagName).toBe('BUTTON')
    expect(mocks.exConfigSheet).not.toHaveBeenCalled()
  })

  it('retains reordered occurrence order and grouping through plan export and import', () => {
    setRoutine([
      entry('c1', 10, 'g'),
      entry('c2', 20, 'g'),
      entry('c3', 30)
    ])
    renderRoutine()
    clickMove('setup-10', 'Move down')

    const parsed = parsePlan(JSON.stringify(buildPlanBundle(useStore.getState().S, 'Move test')))
    expect(parsed.routines[0].ex).toEqual([
      entry('c2', 20, 'g'),
      entry('c1', 10, 'g'),
      entry('c3', 30)
    ])
  })
})

describe('routine move-control locale coverage', () => {
  const packs = import.meta.glob('../locales/*.js', { eager: true, import: 'default' })

  it('defines both accessible names in every non-English locale pack', () => {
    expect(Object.keys(packs)).toHaveLength(Object.keys(LANGS).filter(c => c !== 'en' && !DERIVED_LOCALES[c]).length)
    Object.entries(packs).forEach(([path, pack]) => {
      expect(pack, `${path} is missing Move up`).toHaveProperty('Move up')
      expect(pack, `${path} is missing Move down`).toHaveProperty('Move down')
    })
  })
})
