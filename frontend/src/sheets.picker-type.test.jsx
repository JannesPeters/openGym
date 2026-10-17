// @vitest-environment happy-dom
// Issue #521: the workout's "Add exercise" picker showed the Muscle and Equipment chip rows but not
// the Type row the Exercise browser has (strength, calisthenics, stretching...). Same row, same
// fallback: a type the muscle group narrows away is ignored for that view, not forgotten.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { EXDB } from './lib/exercises.js'
import { exerciseNameFor } from './lib/i18n.js'
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
const openMenu = (host, title) => {
  act(() => filterButton(host, title).click())
  return renderTop()
}
const choose = (host, title, label) => {
  const menu = openMenu(host, title)
  if (title === 'Muscle') act(() => [...menu.querySelectorAll('.seg button')].find(b => b.textContent === 'List').click())
  act(() => [...menu.querySelectorAll('button')].find(b => b.textContent === label).click())
}
// Every row's add button carries the exercise's name, so it tells which exercises are listed.
const listed = host => [...host.querySelectorAll('.list .item button[aria-label]')]
  .map(b => b.getAttribute('aria-label'))

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

describe('exercise picker type filter', () => {
  it('shares the Library menu buttons with Type between Muscle and Equipment', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    expect([...host.querySelectorAll('.library-filters [aria-haspopup]')].map(b => b.textContent)).toEqual(['Muscle', 'Type', 'Equipment'])
    expect(host.querySelector('.chips')).toBeNull()
    const menu = openMenu(host, 'Type')
    expect(menu.querySelector('[aria-pressed="true"]').textContent).toBe('Any type')
    expect([...menu.querySelectorAll('button')].some(b => b.textContent === 'stretching')).toBe(true)
  })

  it('narrows the list to the picked type', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    choose(host, 'Type', 'stretching')
    expect(filterButton(host, 'Type').textContent).toBe('Type · stretching')
    const names = listed(host)
    expect(names.length).toBeGreaterThan(0)
    const catOf = new Map(EXDB.map(e => [`Add “${exerciseNameFor(e)}”`, e.cat]))
    expect(names.filter(n => catOf.get(n) !== 'stretching')).toEqual([])
  })

  it('keeps the type across a muscle group that has none of it, and picks it back up', () => {
    useStore.setState(s => ({ S: { ...s.S, customEx: [
      { id: 'type-test-a', n: 'typetest wrist curl', tg: 'forearms', bp: 'lower arms', eq: 'dumbbell', cat: 'strength', custom: true },
      { id: 'type-test-b', n: 'typetest yoga', tg: 'lats', bp: 'back', eq: 'body weight', cat: 'yoga', custom: true },
    ] } }))
    exercisePicker(vi.fn())
    const host = renderTop()
    const input = host.querySelector('.search input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    act(() => { setter.call(input, 'typetest'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    choose(host, 'Type', 'yoga')
    choose(host, 'Muscle', 'Forearms')
    expect(filterButton(host, 'Type').textContent).toBe('Type')
    expect(listed(host).length).toBeGreaterThan(0)
    choose(host, 'Muscle', 'Upper back')
    expect(filterButton(host, 'Type').textContent).toBe('Type · yoga')
  })
})
