// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, freshState, restoredStateFor, useStore } from '../store/useStore.js'
import Home from './Home.jsx'
import Settings from './Settings.jsx'
import { workoutDetailSheet } from '../sheets.jsx'
import { buildLocalPreviewState } from '../lib/local-preview.js'

const nav = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../sheets.jsx', async importOriginal => ({
  ...await importOriginal(), workoutDetailSheet: vi.fn(),
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  nav.mockClear()
  vi.mocked(workoutDetailSheet).mockClear()
  useStore.setState({ S: { ...freshState(), lang: 'en' }, user: null, ready: false })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear() })

const mountHome = () => act(() => root.render(<Home />))
const mountSettings = () => act(() => root.render(<Settings page="look" />))
const switchFor = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title).querySelector('[role="switch"]')
const workout = (id, d = '2026-10-10') => ({ id, d, name: id, entries: [], vol: 0, start: 100, end: 200 })

describe('Home display settings', () => {
  it('preserves the combined-widget-on, history-off defaults for fresh and legacy profiles', () => {
    expect(freshState()).toMatchObject({ showWeekCard: true, showHistoryCard: false })
    expect(DEF).toMatchObject({ showWeekCard: true, showHistoryCard: false })
    expect(DEF).not.toHaveProperty('showTodayCard')
    useStore.setState(s => ({ S: { ...s.S, showWeekCard: undefined, showHistoryCard: undefined } }))
    mountHome()
    expect(host.querySelector('.week')).toBeTruthy()
    expect(host.querySelector('.today-row')).toBeTruthy()
    expect(host.textContent).not.toContain('Recent workouts')
    mountSettings()
    expect(switchFor('Week & Today').getAttribute('aria-checked')).toBe('true')
    expect([...host.querySelectorAll('.lrow-t')].some(el => el.textContent === 'Today' || el.textContent === 'This week')).toBe(false)
    expect(switchFor('Recent workouts').getAttribute('aria-checked')).toBe('false')
  })

  it('persists independent toggles and restores them without changing saved workouts', () => {
    const workouts = [workout('Saved session')]
    const week = { 1: 'r1' }
    const dayPlan = { '2026-10-18': 'r1' }
    useStore.setState(s => ({ S: { ...s.S, workouts, week, dayPlan } }))
    mountSettings()
    act(() => switchFor('Week & Today').click())
    expect(useStore.getState().S).toMatchObject({ showWeekCard: false, showHistoryCard: false })
    act(() => switchFor('Recent workouts').click())
    const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
    expect(saved).toMatchObject({ showWeekCard: false, showHistoryCard: true, workouts, week, dayPlan })
    const restored = restoredStateFor(freshState(), saved)
    act(() => useStore.setState({ S: restored }))
    mountHome()
    expect(host.querySelector('.week')).toBeNull()
    expect(host.textContent).toContain('Recent workouts')
    expect(host.textContent).toContain('Saved session')
    expect(host.querySelector('.today-row')).toBeNull()
    expect(host.textContent).not.toContain('Choose a different workout')
    mountSettings()
    expect(switchFor('Week & Today').getAttribute('aria-checked')).toBe('false')
    act(() => switchFor('Week & Today').click())
    act(() => switchFor('Recent workouts').click())
    expect(useStore.getState().S).toMatchObject({ showWeekCard: true, showHistoryCard: false, workouts, week, dayPlan })
    mountHome()
    expect(host.querySelector('.week')).toBeTruthy()
    expect(host.querySelector('.today-row')).toBeTruthy()
    expect(host.textContent).not.toContain('Recent workouts')
  })

  it('hides the rotation overview too, but keeps an active session reachable with the widget off', () => {
    useStore.setState(s => ({ S: { ...s.S, scheduleMode: 'rotation', showWeekCard: false, active: { name: 'In progress', entries: [] } } }))
    mountHome()
    expect(host.textContent).not.toContain('No rotation yet.')
    expect(host.textContent).toContain('Resume')
    act(() => host.querySelector('.today-row').click())
    expect(nav).toHaveBeenCalledWith('/workout')
    act(() => useStore.getState().update(s => { s.active = null }))
    expect(host.querySelector('.today-row')).toBeNull()
    expect(host.textContent).not.toContain('Choose a different workout')
  })

  it.each([[true, true], [true, false], [false, true], [false, false]])(
    'keeps combined-widget=%s and history=%s independent',
    (showWeekCard, showHistoryCard) => {
      useStore.setState(s => ({ S: { ...s.S, showWeekCard, showHistoryCard } }))
      mountHome()
      expect(!!host.querySelector('.week')).toBe(showWeekCard)
      expect(!!host.querySelector('.today-row')).toBe(showWeekCard)
      expect(host.textContent.includes('Choose a different workout')).toBe(showWeekCard)
      expect(host.textContent.includes('Recent workouts')).toBe(showHistoryCard)
      expect([...host.querySelectorAll('.card')].every(card => card.textContent.trim())).toBe(true)
      if (showWeekCard) expect(host.querySelector('.week').closest('.card')).toBe(host.querySelector('.today-row').closest('.card'))
    },
  )

  it.each([[true, true], [true, false], [false, true], [false, false]])(
    'uses the week preference for earlier preview settings week=%s, Today=%s',
    (showWeekCard, showTodayCard) => {
      useStore.setState(s => ({ S: { ...s.S, showWeekCard, showTodayCard } }))
      mountHome()
      expect(!!host.querySelector('.week')).toBe(showWeekCard)
      expect(!!host.querySelector('.today-row')).toBe(showWeekCard)
    },
  )

  it('keeps an open saved-workout editor accessible with the combined widget off', () => {
    useStore.setState(s => ({ S: { ...s.S, showWeekCard: false, active: { name: 'Saved session', editingWorkoutId: 'w1', entries: [] } } }))
    mountHome()
    expect(host.querySelector('.today-row').textContent).toContain('Edit')
    act(() => host.querySelector('.today-row').click())
    expect(nav).toHaveBeenCalledWith('/workout')
  })

  it('shows five newest workouts as existing rows and opens workout details or full history', () => {
    const workouts = Array.from({ length: 7 }, (_, i) => workout(`Session ${i}`, `2026-10-${10 + i}`))
    useStore.setState(s => ({ S: { ...s.S, showHistoryCard: true, workouts } }))
    mountHome()
    const rows = [...host.querySelectorAll('.list .item')]
    expect(rows.map(row => row.querySelector('.tt').textContent)).toEqual(['Session 6', 'Session 5', 'Session 4', 'Session 3', 'Session 2'])
    const heading = [...host.querySelectorAll('h2')].find(h => h.textContent === 'Recent workouts')
    const card = heading.closest('.card')
    expect(card.classList.contains('home-recent')).toBe(true)
    expect(heading.classList.contains('big')).toBe(true)
    expect(heading.style.fontSize).toBe('22px')
    expect(card.firstElementChild).toBe(heading)
    expect(card.lastElementChild.querySelector('button').textContent).toBe('History')
    act(() => rows[0].click())
    expect(workoutDetailSheet).toHaveBeenCalledWith(workouts[6])
    act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'History').click())
    expect(nav).toHaveBeenCalledWith('/history')
  })

  it('shows the existing history empty state only when enabled', () => {
    useStore.setState(s => ({ S: { ...s.S, showHistoryCard: true } }))
    mountHome()
    expect(host.textContent).toContain('No workouts yet. Your first one will land here.')
    const empty = [...host.querySelectorAll('.empty')].find(el => el.textContent === 'No workouts yet. Your first one will land here.')
    expect(empty.nextElementSibling.querySelector('button').textContent).toBe('History')
    expect(empty.closest('.home-recent').querySelectorAll('.item')).toHaveLength(0)
    act(() => empty.nextElementSibling.querySelector('button').click())
    expect(nav).toHaveBeenCalledWith('/history')
    act(() => useStore.getState().update(s => { s.showHistoryCard = false }))
    expect(host.textContent).not.toContain('No workouts yet. Your first one will land here.')
    expect(useStore.getState().S.workouts).toEqual([])
  })

  it('shows five real seeded sessions inside the recent-workouts surface', async () => {
    const preview = await buildLocalPreviewState(new Date('2026-10-18T12:00:00'))
    useStore.setState(s => ({ S: { ...s.S, ...preview } }))
    mountHome()
    const rows = [...host.querySelectorAll('.home-recent .item')]
    expect(rows).toHaveLength(5)
    expect(rows.map(row => row.querySelector('.tt').textContent)).toEqual(preview.workouts.slice(-5).reverse().map(w => w.name))
    act(() => rows[0].click())
    expect(workoutDetailSheet).toHaveBeenCalledWith(preview.workouts.at(-1))
  })
})
