// @vitest-environment happy-dom
// Issue #71: choosing a body part after picking an equipment type used to reset the equipment
// filter to "all equipment", even when the new muscle group still had exercises for it. The
// per-body-part chips no longer clear the equipment selection; the eqOn fallback only drops it
// for the current view when the new body part has nothing under that equipment.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'
import { bindUI } from './components/ui.jsx'

const mounted = []

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const filterButton = (host, title) => [...host.querySelectorAll('.library-filters button')].find(b => b.textContent.split(' · ')[0] === title)
const choose = (host, title, label) => {
  act(() => filterButton(host, title).click())
  const menu = renderTop()
  if (title === 'Muscle') act(() => [...menu.querySelectorAll('.seg button')].find(b => b.textContent === 'List').click())
  act(() => [...menu.querySelectorAll('button')].find(b => b.textContent === label).click())
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  bindUI(useUI)
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('exercise picker equipment filter', () => {
  it('keeps the dumbbell filter when switching between compatible muscles', () => {
    exercisePicker(vi.fn())
    const host = renderTop()

    choose(host, 'Muscle', 'Forearms')
    choose(host, 'Equipment', 'dumbbell')
    expect(filterButton(host, 'Equipment').textContent).toBe('Equipment · dumbbell')
    choose(host, 'Muscle', 'Biceps')
    expect(filterButton(host, 'Muscle').textContent).toBe('Muscle · Biceps')
    expect(filterButton(host, 'Equipment').textContent).toBe('Equipment · dumbbell')
  })
})
