// @vitest-environment happy-dom
// The live result count in the exercise search (idea: GitLab !31, sagnikpatra301): the Library
// and the exercise picker show how many exercises are left once a search or a filter narrows
// the list, and say it in words to a screen reader.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'
import Library from './views/Library.jsx'
import { CATALOGUE, searchExercises } from './lib/exercises.js'
import { musclesOf } from './lib/muscles.js'
import { bindUI } from './components/ui.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mounted = []
function mount(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(node))
  return host
}
const renderTopSheet = () => {
  const sheet = useUI.getState().sheets.at(-1)
  return mount(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
function type(el, value) {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const chooseMuscle = (host, label) => {
  act(() => [...host.querySelectorAll('.library-filters button')].find(b => b.textContent.startsWith('Muscle')).click())
  const menu = renderTopSheet()
  act(() => [...menu.querySelectorAll('.seg button')].find(b => b.textContent === 'List').click())
  act(() => [...menu.querySelectorAll('button')].find(b => b.textContent === label).click())
}
const count = host => host.querySelector('.search .search-count')

beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '' })
  bindUI(useUI)
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

// The screens run the same search over the same catalogue, so the expected numbers come from it.
const matches = q => searchExercises(CATALOGUE, q).length

describe('exercise search result count', () => {
  for (const [where, open] of [
    ['Library', () => mount(<MemoryRouter><Library /></MemoryRouter>)],
    ['exercise picker', () => { exercisePicker(vi.fn()); return renderTopSheet() }],
  ]) {
    it(`${where}: appears with a search, follows it, and goes when the search is cleared`, () => {
      const host = open()
      const input = host.querySelector('.search input')
      expect(count(host)).toBeNull()
      expect(host.querySelector('.search').classList.contains('has-count')).toBe(false)

      act(() => type(input, 'bench press'))
      const n = matches('bench press')
      expect(n).toBeGreaterThan(1)
      expect(count(host).textContent).toBe(String(n))
      expect(count(host).getAttribute('aria-label')).toBe(`${n} exercises`)
      expect(host.querySelector('.search').classList.contains('has-count')).toBe(true)

      act(() => type(input, 'bench press dumbbell incline'))
      expect(Number(count(host).textContent)).toBe(matches('bench press dumbbell incline'))

      act(() => type(input, ''))
      expect(count(host)).toBeNull()
    })

    it(`${where}: counts a muscle filter too, and reads "1 exercise" for one`, () => {
      const host = open()
      chooseMuscle(host, 'Traps')
      expect(Number(count(host).textContent)).toBe(CATALOGUE.filter(e => musclesOf(e).trapezius).length)
      const one = CATALOGUE.find(e => searchExercises(CATALOGUE, e.n).length === 1)
      chooseMuscle(host, 'All')
      act(() => type(host.querySelector('.search input'), one.n))
      expect(count(host).textContent).toBe('1')
      expect(count(host).getAttribute('aria-label')).toBe('1 exercise')
    })
  }
})
