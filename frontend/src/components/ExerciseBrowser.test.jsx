// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExerciseBrowser from './ExerciseBrowser.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { CATALOGUE } from '../lib/exercises.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
const a = CATALOGUE[0], b = CATALOGUE[1], c = CATALOGUE[2]
const row = ex => [...host.querySelectorAll('.item:not(.ex-new)')].find(el => el.querySelector('.tt').textContent === ex.n)
const marked = ex => !!row(ex).querySelector('[aria-label="Chosen"]')
const render = props => act(() => root.render(<ExerciseBrowser onOpen={vi.fn()} onAdd={vi.fn()} onCreate={vi.fn()} {...props} />))

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  const S = structuredClone(DEF)
  S.routines = [{ id: 'one', name: 'One', ex: [{ id: a.id }] }, { id: 'two', name: 'Two', ex: [{ id: b.id }] }]
  S.workouts = [{ entries: [{ id: c.id }] }]
  useStore.setState({ S, user: null })
  useUI.setState({ sheets: [] })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('shared exercise browsing contexts', () => {
  it('marks only the current routine, updates live and changes scope when switching routines', () => {
    render({ picking: true, embedded: true, routineId: 'one' })
    expect(marked(a)).toBe(true)
    expect(marked(b)).toBe(false)
    expect(marked(c)).toBe(false)
    expect(row(a).querySelector('[aria-label="Chosen"]').title).toBe('One')
    render({ picking: true, embedded: true, routineId: 'two' })
    expect(marked(a)).toBe(false)
    expect(marked(b)).toBe(true)
    act(() => useStore.setState(s => ({ S: { ...s.S, routines: s.S.routines.map(r =>
      r.id === 'two' ? { ...r, ex: [...r.ex, { id: a.id }] } : r) } })))
    expect(marked(a)).toBe(true)
    act(() => useStore.setState(s => ({ S: { ...s.S, routines: s.S.routines.map(r =>
      r.id === 'two' ? { ...r, ex: r.ex.filter(ex => ex.id !== b.id) } : r) } })))
    expect(marked(b)).toBe(false)
    act(() => useStore.setState(s => ({ S: { ...s.S, routines: s.S.routines.filter(r => r.id !== 'two') } })))
    expect(marked(a)).toBe(false)
    expect(marked(c)).toBe(false)
  })

  it('keeps configuration and quick-add actions distinct, including repeat adds', () => {
    const onOpen = vi.fn(), onAdd = vi.fn()
    render({ picking: true, embedded: true, routineId: 'one', onOpen, onAdd })
    act(() => row(a).click())
    expect(onOpen).toHaveBeenCalledWith(a)
    const button = row(a).querySelector('button')
    expect(button.getAttribute('aria-label')).toMatch(/^Add “/)
    act(() => { button.click(); button.click() })
    expect(onAdd).toHaveBeenCalledTimes(2)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('shares simplified create rows and persistent list/card switching in a sheet', () => {
    const onCreate = vi.fn()
    render({ picking: true, embedded: true, onCreate })
    expect(host.querySelector('.picker-search .search-row')).toBeTruthy()
    expect(host.querySelector('.ex-new .ss,.ex-new > .chev')).toBeNull()
    act(() => host.querySelector('.ex-new').click())
    expect(onCreate).toHaveBeenCalledWith('')
    act(() => useStore.setState(s => ({ S: { ...s.S, exerciseView: 'cards' } })))
    expect(host.querySelector('.list.ex-grid')).toBeTruthy()
    expect(host.querySelectorAll('.library-filters [aria-haspopup]')).toHaveLength(3)
  })

  it('keeps a variant separately selectable and separately marked from its base', () => {
    const variant = { ...a, id: 'custom-variant', baseExerciseId: a.id, variantLabel: 'Gym80', custom: true }
    act(() => useStore.setState(s => ({ S: { ...s.S, customEx: [variant] } })))
    render({ picking: true, routineId: 'one' })
    const variantRow = [...host.querySelectorAll('.item')].find(el => el.querySelector('.ex-variant-meta'))
    expect(variantRow).toBeTruthy()
    expect(variantRow.querySelector('[aria-label="Chosen"]')).toBeNull()
    expect(marked(a)).toBe(true)
    expect(variantRow.querySelector('button').getAttribute('aria-label')).toContain('Gym80')
  })
})
