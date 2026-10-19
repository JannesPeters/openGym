// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { EXIDX, registerCustom } from './lib/exercises.js'
import { bindUI } from './components/ui.jsx'
import Modals from './components/Modals.jsx'
import { exerciseDetailSheet, exercisePicker } from './sheets.jsx'

vi.mock('./lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('./components/Media.jsx', () => ({ default: () => null, Thumb: () => null }))
vi.mock('./components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
const top = () => [...host.querySelectorAll('.sheet')].at(-1)
const button = label => [...top().querySelectorAll('button')].find(node => node.textContent.trim() === label)
const click = node => act(() => node.click())
const type = (node, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value)
  node.dispatchEvent(new Event('input', { bubbles: true }))
})
const benchRow = () => [...top().querySelectorAll('.item')].find(node => node.querySelector('.tt')?.textContent === EXIDX['0025'].n)

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null })
  useUI.setState({ sheets: [], toastMsg: '' })
  registerCustom([])
  bindUI(useUI)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Modals />))
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  registerCustom([])
})

describe('add pickers share the Library exercise details', () => {
  it.each(['Add to routine', 'Add to this workout'])('keeps %s contextual and preserves the picker search', label => {
    const pick = vi.fn()
    act(() => exercisePicker(pick, { detailLabel: label }))
    type(top().querySelector('.search input'), 'bench press')
    click(benchRow())
    expect(top().querySelector('.exdetail-name').textContent).toBe(EXIDX['0025'].n)
    expect(top().querySelector('.fav-btn')).toBeTruthy()
    expect(button('Create variant')).toBeTruthy()
    expect(button('Add to my plan')).toBeUndefined()
    expect(pick).not.toHaveBeenCalled()
    click(button(label))
    expect(pick).toHaveBeenCalledExactlyOnceWith(EXIDX['0025'], true)
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(top().querySelector('.search input').value).toBe('bench press')
    expect(useStore.getState().S.routines).toEqual([])
  })

  it.each(['Add to routine', 'Add to this workout'])('only configures %s through the explicit edit action', label => {
    const pick = vi.fn()
    act(() => exercisePicker(pick, { detailLabel: label }))
    type(top().querySelector('.search input'), 'bench press')
    click(benchRow())
    expect(pick).not.toHaveBeenCalled()
    click(button('Edit details before adding'))
    expect(pick).toHaveBeenCalledExactlyOnceWith(EXIDX['0025'])
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(top().querySelector('.search input').value).toBe('bench press')
  })

  it('keeps quick-add immediate without opening details', () => {
    const pick = vi.fn()
    act(() => exercisePicker(pick, { detailLabel: 'Add to this workout' }))
    type(top().querySelector('.search input'), 'bench press')
    click(benchRow().querySelector('button'))
    expect(pick).toHaveBeenCalledExactlyOnceWith(EXIDX['0025'], true)
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(top().querySelector('.exdetail-name')).toBeNull()
  })

  it('leaves other picker selection flows unchanged', () => {
    const pick = vi.fn()
    act(() => exercisePicker(pick))
    type(top().querySelector('.search input'), 'bench press')
    click(benchRow())
    expect(pick).toHaveBeenCalledExactlyOnceWith(EXIDX['0025'])
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('passes the variant selected in shared details to the original add target', () => {
    const variant = { ...EXIDX['0025'], id: 'cdetail', custom: true, baseExerciseId: '0025', variantLabel: 'Gym80' }
    useStore.setState(s => ({ S: { ...s.S, customEx: [variant] } }))
    registerCustom([variant])
    const pick = vi.fn()
    act(() => exerciseDetailSheet(EXIDX['0025'], { onAdd: pick, addLabel: 'Add to this workout' }))
    click(top().querySelector('[aria-label="Variants"] button[aria-label*="Gym80"]'))
    click(button('Add to this workout'))
    expect(pick).toHaveBeenCalledExactlyOnceWith(EXIDX[variant.id])
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('retains the add target when creating and editing a variant from shared details', () => {
    const pick = vi.fn()
    const configure = vi.fn()
    act(() => exerciseDetailSheet(EXIDX['0025'], { onAdd: pick, onEditBeforeAdd: configure, addLabel: 'Add to this workout' }))
    click(button('Create variant'))
    type(top().querySelector('input.input'), 'Gym80')
    click(button('Create variant'))
    expect(button('Add to this workout')).toBeTruthy()
    expect(pick).not.toHaveBeenCalled()
    click(button('Edit'))
    type(top().querySelector('input.input'), 'Gym80 edited')
    click(button('Save'))
    expect(button('Add to this workout')).toBeTruthy()
    click(button('Edit details before adding'))
    expect(pick).not.toHaveBeenCalled()
    expect(configure).toHaveBeenCalledOnce()
    expect(configure.mock.lastCall[0]).toMatchObject({ baseExerciseId: '0025', variantLabel: 'Gym80 edited' })
    expect(useStore.getState().S.routines).toEqual([])
  })
})
