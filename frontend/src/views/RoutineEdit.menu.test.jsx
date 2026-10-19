// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import Modals from '../components/Modals.jsx'
import { bindUI } from '../components/ui.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../components/Media.jsx', () => ({ default: () => null, Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

bindUI(useUI)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
const fixture = () => ({ id: 'r1', name: 'Push day', emoji: 'dumbbell', ex: [{ id: '0025', sets: 3, mode: 'reps', reps: 5, weight: 80 }] })
const more = () => host.querySelector('button[aria-label="More"]')
const dialog = () => host.querySelector('[role="dialog"]')
const action = label => [...dialog().querySelectorAll('.menu-item')].find(item => item.textContent === label)
const exerciseMenu = index => host.querySelector(`[data-ex-index="${index}"] [data-exercise-menu]`)
const openExerciseMenu = index => act(() => exerciseMenu(index).click())
const moveAction = label => [...dialog().querySelectorAll('.menu-item')].find(item => item.querySelector('.tt').textContent === label)
const key = (el, key, shiftKey = false) => act(() => el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })))

function mount(ex = fixture().ex) {
  useStore.setState({ S: { ...structuredClone(DEF), routines: [{ ...fixture(), ex }] }, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={['/plan/r/r1']}>
    <Routes>
      <Route path="/plan/r/:id" element={<RoutineEdit />} />
      <Route path="/plan/r/:id/exercise/:index/:exerciseId" element={<h1>Full-screen exercise</h1>} />
      <Route path="/plan" element={<div>Plan</div>} />
    </Routes>
    <Modals />
  </MemoryRouter>))
}

beforeEach(() => {
  useUI.setState({ sheets: [] })
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}])
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

describe('routine action menu', () => {
  it('edits the standalone name field and icon below a non-editable routine header', () => {
    mount()
    const header = host.querySelector('.hdr')
    const details = host.querySelector('.routine-details')
    expect(header.querySelector('input')).toBeNull()
    expect(header.textContent).toBe('Push day')
    expect(header.querySelector('[aria-label="Pick an icon"]')).toBeNull()
    expect(header.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const input = host.querySelector('.routine-name-field input')
    expect(input.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(input.labels[0].textContent.trim()).toBe('Name')
    act(() => {
      Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, 'Pull day')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(useStore.getState().S.routines[0].name).toBe('Pull day')
    expect(header.querySelector('h1').textContent).toBe('Pull day')
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].name).toBe('Pull day')
    const picker = [...details.querySelectorAll('button')].find(button => button.textContent === 'Pick an icon')
    act(() => picker.click())
    const icon = host.querySelector('.glyph-cell:not(.on)')
    const selected = icon.getAttribute('aria-label')
    act(() => icon.click())
    expect(useStore.getState().S.routines[0].emoji).toBe(selected)
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].emoji).toBe(selected)
    expect(picker.querySelector('.lrow-i [data-icon]').getAttribute('data-icon')).toBe(selected)
    expect(header.querySelector('[aria-label="More"]')).not.toBeNull()
  })

  it('opens the three actions from the header with keyboard access and restores focus on Escape', () => {
    mount()
    expect(host.textContent).not.toContain('Copy routine')
    const trigger = more()
    expect(trigger.closest('.hdr')).not.toBeNull()
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    act(() => trigger.click())
    expect(dialog().getAttribute('aria-label')).toBe('Push day')
    expect([...dialog().querySelectorAll('.menu-item')].map(item => item.textContent)).toEqual(['Copy routine', 'Print / Save as PDF', 'Delete routine'])
    expect(document.activeElement).toBe(action('Copy routine'))
    expect(action('Delete routine').classList.contains('danger')).toBe(true)
    key(action('Copy routine'), 'Tab', true)
    expect(document.activeElement).toBe(action('Delete routine'))
    key(action('Delete routine'), 'Tab')
    expect(document.activeElement).toBe(action('Copy routine'))
    key(document.activeElement, 'Escape')
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('omits the requested explanations and visible exercise heading without removing the list label or controls', () => {
    mount()
    expect(host.textContent).not.toContain('Tap the link button')
    expect(host.textContent).not.toContain('Applies to every exercise')
    expect(host.querySelector('.routine-ex-h h4')).toBeNull()
    expect(host.querySelector('.routine-list').getAttribute('aria-label')).toBe('Exercises')
    expect(host.querySelector('.routine-ex-h button').textContent).toBe('Add exercise')
    const muscles = host.querySelector('.card[aria-label="What this session hits"]')
    expect(muscles).not.toBeNull()
    expect(muscles.querySelector('h2')).toBeNull()
    expect(muscles.querySelector('.mchips')).not.toBeNull()
  })

  it('keeps empty-routine printing disabled and out of the tab order', () => {
    mount([])
    act(() => more().click())
    expect(action('Print / Save as PDF').getAttribute('aria-disabled')).toBe('true')
    expect(action('Print / Save as PDF').hasAttribute('tabindex')).toBe(false)
    act(() => action('Print / Save as PDF').click())
    expect(dialog()).not.toBeNull()
  })

  it('opens Deload details separately from its compact switch and restores focus', () => {
    mount()
    const explanation = 'Its workouts do not count toward progression. They still show in history and statistics.'
    const trigger = host.querySelector('.routine-setting-details')
    const toggle = host.querySelector('[role="switch"]')
    expect(host.textContent).not.toContain(explanation)
    expect(toggle.classList.contains('compact')).toBe(true)
    act(() => trigger.click())
    expect(dialog().textContent).toContain(explanation)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    const done = [...dialog().querySelectorAll('button')].find(button => button.textContent === 'Done')
    expect(document.activeElement).toBe(done)
    act(() => done.click())
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(trigger)
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(dialog()).toBeNull()
  })

  describe('per-exercise action menu', () => {
    const entries = () => ['0025', '0009', '0025'].map((id, index) => ({ ...fixture().ex[0], id, note: `Occurrence ${index}` }))

    it('keeps the menu separate from full-screen exercise navigation', () => {
      mount()
      openExerciseMenu(0)
      expect(host.querySelector('.routine-list')).not.toBeNull()
      key(document.activeElement, 'Escape')
      act(() => host.querySelector('.item-open').click())
      expect(host.querySelector('h1').textContent).toBe('Full-screen exercise')
      expect(dialog()).toBeNull()
    })

    it('offers state-aware first, middle and last actions without opening the exercise configuration', () => {
      mount(entries())
      openExerciseMenu(0)
      expect([...dialog().querySelectorAll('.tt')].map(item => item.textContent)).toEqual(['Move up', 'Move down'])
      expect(moveAction('Move up').getAttribute('aria-disabled')).toBe('true')
      expect(document.activeElement).toBe(moveAction('Move down'))
      key(document.activeElement, 'Escape')
      openExerciseMenu(1)
      expect(action('Superset with exercise above')).toBeTruthy()
      expect(moveAction('Move up').hasAttribute('aria-disabled')).toBe(false)
      expect(moveAction('Move down').hasAttribute('aria-disabled')).toBe(false)
      key(document.activeElement, 'Escape')
      openExerciseMenu(2)
      expect(moveAction('Move down').getAttribute('aria-disabled')).toBe('true')
      expect(useUI.getState().sheets).toHaveLength(1)
      expect(host.querySelector('.center')).toBeNull()
    })

    it('links and unlinks the selected exercise with state-aware wording', () => {
      mount(entries())
      openExerciseMenu(1)
      key(action('Superset with exercise above'), 'Enter')
      const linked = useStore.getState().S.routines[0].ex
      expect(linked[0].sg).toBeTruthy()
      expect(linked[1].sg).toBe(linked[0].sg)
      expect(document.activeElement).toBe(exerciseMenu(1))
      openExerciseMenu(1)
      const unlink = [...dialog().querySelectorAll('.menu-item')].find(item => item.textContent.startsWith('Unlink superset on'))
      expect(unlink).toBeTruthy()
      expect(moveAction('Move down').querySelector('.ss').textContent).toBe('Move out of the superset')
      key(unlink, ' ')
      expect(useStore.getState().S.routines[0].ex.every(entry => !entry.sg)).toBe(true)
    })

    it('restores focus to the moved occurrence, including duplicate exercise ids', () => {
      mount(entries())
      openExerciseMenu(2)
      key(moveAction('Move up'), 'Enter')
      expect(useStore.getState().S.routines[0].ex.map(entry => entry.note)).toEqual(['Occurrence 0', 'Occurrence 2', 'Occurrence 1'])
      expect(document.activeElement).toBe(exerciseMenu(1))
      expect(dialog()).toBeNull()
    })
  })

  it('copies the routine through keyboard activation', () => {
    mount()
    act(() => more().click())
    key(action('Copy routine'), 'Enter')
    const routines = useStore.getState().S.routines
    expect(routines).toHaveLength(2)
    expect(routines[1].id).not.toBe('r1')
    expect(routines[1].ex).toEqual(fixture().ex)
    expect(dialog()).toBeNull()
  })

  it('requires confirmation before deletion and leaves the routine untouched on cancel', () => {
    mount()
    act(() => more().click())
    key(action('Delete routine'), ' ')
    expect(host.querySelector('.center').textContent).toContain('Delete routine?')
    expect(useStore.getState().S.routines).toHaveLength(1)
    const cancel = [...host.querySelectorAll('.center button')].find(button => button.textContent === 'Cancel')
    act(() => cancel.click())
    expect(useStore.getState().S.routines).toEqual([fixture()])
  })
})
