// @vitest-environment happy-dom
// Favourites (issue #6): the Library floats starred exercises to the top of the current
// result list — after the search and body-part filters, without reordering the rest.
import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Library from './Library.jsx'
import { EXDB } from '../lib/exercises.js'
import { MUSCLES, MUSCLE_NAME, musclesOf } from '../lib/muscles.js'
import { bindUI } from '../components/ui.jsx'
import { CASED_NAME_LANGS, EXERCISE_NAME_LANGS, _setLangState } from '../lib/i18n-core.js'
import { addToRoutineSheet, customExSheet, exerciseDetailSheet } from '../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({ S: state.S, user: null, update: mut => { const next = structuredClone(state.S); mut(next); state.S = next } })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({ exerciseDetailSheet: vi.fn(), addToRoutineSheet: vi.fn(), customExSheet: vi.fn() }))

const mounted = []
function render() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<Library />))
  return host
}
const names = host => [...host.querySelectorAll('.item .tt')].map(el => el.textContent).slice(1)   // drop "Create your own"
const cssSource = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const openFilter = (host, title) => {
  const button = [...host.querySelectorAll('.library-filters button')].find(b => b.textContent.split(' · ')[0] === title)
  act(() => button.click())
  return [...document.querySelectorAll('.test-filter-menu')].at(-1)
}
const chooseFilter = (host, title, label) => {
  const menu = openFilter(host, title)
  if (title === 'Muscle') act(() => [...menu.querySelectorAll('.seg button')].find(b => b.textContent === 'List').click())
  const option = [...menu.querySelectorAll('button')].find(b => b.textContent === label)
  expect(option, `${title}: ${label}`).toBeTruthy()
  act(() => option.click())
}
const search = (host, text) => {
  const input = host.querySelector('.search input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  act(() => { setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
}

beforeEach(() => {
  mocks.S = { unit: 'kg', lang: 'en', routines: [], workouts: [], customEx: [], exWeights: {}, equipProfiles: [], activeEquipId: null, equipFilterOn: false }
  document.body.innerHTML = ''
  bindUI({ getState: () => ({ openSheet: content => {
    const menu = document.createElement('div')
    menu.className = 'test-filter-menu'
    document.body.appendChild(menu)
    const root = createRoot(menu)
    mounted.push(root)
    root.render(content(() => root.render(null)))
  } }) })
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('Library favourites', () => {
  it('puts favourites first, marked with a star, and leaves the rest in catalogue order', () => {
    const plain = names(render())
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
    const fav = [plain[6], plain[2]]
    mocks.S.favEx = fav.map(n => EXDB.find(e => e.n === n).id)
    const host = render()
    const shown = names(host)
    expect(shown.slice(0, 2)).toEqual(plain.filter(n => fav.includes(n)))
    expect(shown.slice(2)).toEqual(plain.filter(n => !fav.includes(n)))
    const rows = [...host.querySelectorAll('.item')].slice(1)
    expect(rows[0].querySelector('.fav-star')).not.toBeNull()
    expect(rows[2].querySelector('.fav-star')).toBeNull()
  })

  it('keeps the title readable without the duplicate By muscle entry point', () => {
    expect(cssSource).toContain('.hdr>div{min-width:0}')
    expect(cssSource).toContain('.hdr>.btn{flex:none}')
    expect(cssSource).toMatch(/@media \(max-width:420px\)\{\.hdr h1\{font-size:30px\}\}/)
    const h1 = cssSource.match(/^\.hdr h1\{([^}]*)\}/m)
    expect(h1?.[1]).toContain('overflow-wrap:break-word')
    expect(h1[1]).not.toContain('overflow-wrap:anywhere')
    expect(h1[1]).not.toContain('hyphens:auto')
    expect(render().querySelector('.hdr button')).toBeNull()
  })

  it('keeps a favourite on top inside a muscle filter, but never pulls one in from elsewhere', () => {
    const chest = EXDB.filter(e => musclesOf(e).chest)
    const legs = EXDB.find(e => !musclesOf(e).chest)
    mocks.S.favEx = [chest[4].id, legs.id]
    const host = render()
    chooseFilter(host, 'Muscle', 'Chest')
    const shown = names(host)
    expect(shown[0]).toBe(chest[4].n)
    expect(shown).not.toContain(legs.n)
  })
})

// #290 took the title-casing off every translated name; the packs stored lower-case then read
// lower-case down the whole list. Only German's own casing is left alone.
describe('Library exercise-name casing per language', () => {
  const packs = import.meta.glob('../exercise-names/*.js', { eager: true, import: 'default' })
  afterEach(() => _setLangState('en', {}, null, null))

  for (const lang of EXERCISE_NAME_LANGS) {
    it(`${lang}: every translated row is ${CASED_NAME_LANGS.includes(lang) ? 'left in its own casing' : 'title-cased'}`, () => {
      const pack = packs[`../exercise-names/${lang}.js`]
      _setLangState(lang, {}, null, pack)
      // Starred so they render on the first page: a partial pack may not cover the first rows.
      mocks.S.favEx = Object.keys(pack).slice(0, 3)
      const rows = [...render().querySelectorAll('.item .tt')].slice(1)   // drop "Create your own"
      expect(rows.length).toBeGreaterThan(0)
      const translated = rows.filter(el => Object.values(pack).some(n => el.textContent.startsWith(n)))
      expect(translated.length, lang).toBeGreaterThan(0)
      for (const el of translated) expect(el.classList.contains('capitalize'), `${lang}: ${el.textContent}`).toBe(!CASED_NAME_LANGS.includes(lang))
    })
  }
})

describe('Library simplified rows and header', () => {
  it('omits the header count and new-exercise explanation, preserving exercise metadata', () => {
    const host = render()
    expect(host.querySelector('.hdr .sub')).toBeNull()
    expect(host.querySelector('.lib-count')).toBeNull()
    expect(host.querySelector('.ex-new .ss')).toBeNull()
    expect(host.querySelector('.ex-new .tt').textContent).toBe('Create your own exercise')
    expect(host.querySelector('.ex-new > .chev')).toBeNull()
    expect(host.querySelector('.ex-new [data-icon="plusCircle"]')).not.toBeNull()
    expect(host.querySelector('.item:not(.ex-new) .ss').textContent).toBeTruthy()
    expect(cssSource).not.toContain('.sub.lib-count')
  })

  it('keeps the icon-only Plan action accessible without opening exercise details', () => {
    const host = render()
    const button = host.querySelector('.item:not(.ex-new) .btn')
    expect(button.getAttribute('aria-label')).toBe('Plan')
    expect(button.querySelector('[data-icon="plus"]')).not.toBeNull()
    expect(button.querySelector('span')).toBeNull()
    const detailCalls = exerciseDetailSheet.mock.calls.length
    const planCalls = addToRoutineSheet.mock.calls.length
    act(() => button.click())
    expect(addToRoutineSheet.mock.calls.length).toBe(planCalls + 1)
    expect(exerciseDetailSheet.mock.calls.length).toBe(detailCalls)
  })

  it('retains the filtered search result count', () => {
    const host = render()
    const input = host.querySelector('.search input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    act(() => { setter.call(input, 'face pull'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(host.querySelector('.search-count').textContent).toMatch(/^\d+$/)
  })

  it('keeps the new-exercise action after removing its trailing icon', () => {
    const host = render()
    const calls = customExSheet.mock.calls.length
    act(() => host.querySelector('.ex-new').click())
    expect(customExSheet.mock.calls.length).toBe(calls + 1)
  })
})

describe('Library filter menus', () => {
  it('shows three wrapping filter buttons without expanded chips or duplicate muscle entry points', () => {
    const host = render()
    expect([...host.querySelectorAll('.library-filters button')].map(b => b.textContent)).toEqual(['Muscle', 'Type', 'Equipment'])
    expect(host.querySelectorAll('[aria-haspopup="dialog"]')).toHaveLength(3)
    expect(host.querySelector('.chips')).toBeNull()
    expect(document.querySelector('.test-filter-menu')).toBeNull()
    expect(cssSource).toMatch(/\.library-filters\{[^}]*flex-wrap:wrap/)
  })

  it('shows the selected muscle on its button, checks it in the list and clears with All', () => {
    const host = render()
    chooseFilter(host, 'Muscle', 'Chest')
    const selected = names(host)
    expect(selected.length).toBeGreaterThan(0)
    expect(selected.every(name => EXDB.some(ex => ex.n === name && musclesOf(ex).chest))).toBe(true)
    expect(host.querySelector('.library-filters button').textContent).toBe('Muscle · Chest')
    const menu = openFilter(host, 'Muscle')
    act(() => [...menu.querySelectorAll('.seg button')].find(b => b.textContent === 'List').click())
    expect(menu.querySelector('.sect-b [aria-pressed="true"]').textContent).toBe('Chest')
    expect(names(host)).toEqual(selected)
    act(() => [...menu.querySelectorAll('button')].find(b => b.textContent === 'All').click())
    expect(host.querySelector('.library-filters button').textContent).toBe('Muscle')
    expect(names(host)[0]).toBe(EXDB[0].n)
  })

  it('uses the existing muscle map names and includes supporting muscles', () => {
    const host = render()
    const menu = openFilter(host, 'Muscle')
    expect(menu.querySelector('.seg [aria-pressed="true"]').textContent).toBe('Diagram')
    act(() => [...menu.querySelectorAll('.seg button')].find(b => b.textContent === 'List').click())
    expect([...menu.querySelectorAll('.sect-b button')].map(b => b.textContent)).toEqual(MUSCLES.map(m => MUSCLE_NAME[m]))
    act(() => [...menu.querySelectorAll('button')].find(b => b.textContent === 'Triceps').click())
    const shown = names(host)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.every(name => EXDB.some(e => e.n === name && musclesOf(e).triceps))).toBe(true)
    expect(shown.some(name => EXDB.some(e => e.n === name && musclesOf(e).triceps < 1))).toBe(true)
    expect(host.querySelector('.search-count')).not.toBeNull()
    chooseFilter(host, 'Muscle', 'All')
    expect(names(host)[0]).toBe(EXDB[0].n)
  })

  it('combines all filters with search and resets filters without clearing the query', () => {
    mocks.S.customEx = [
      { id: 'filter-a', n: 'filterfixture dumbbell press', bp: 'chest', eq: 'dumbbell', cat: 'strength', tg: 'pectorals', sm: ['triceps'], custom: true },
      { id: 'filter-b', n: 'filterfixture barbell press', bp: 'chest', eq: 'barbell', cat: 'strength', tg: 'pectorals', custom: true },
      { id: 'filter-c', n: 'filterfixture dumbbell stretch', bp: 'chest', eq: 'dumbbell', cat: 'stretching', tg: 'pectorals', custom: true },
      { id: 'filter-d', n: 'filterfixture dumbbell row', bp: 'back', eq: 'dumbbell', cat: 'strength', tg: 'lats', custom: true },
    ]
    const host = render()
    search(host, 'filterfixture')
    chooseFilter(host, 'Type', 'strength')
    chooseFilter(host, 'Equipment', 'dumbbell')
    chooseFilter(host, 'Muscle', 'Chest')
    expect(names(host)).toEqual(['filterfixture dumbbell press'])
    expect([...host.querySelectorAll('.library-filters [aria-haspopup]')].map(b => b.textContent)).toEqual([
      'Muscle · Chest', 'Type · strength', 'Equipment · dumbbell',
    ])
    expect(host.querySelector('.search-count').textContent).toBe('1')
    act(() => [...host.querySelectorAll('.library-filters button')].find(b => b.textContent === 'Reset').click())
    expect(host.querySelector('.search input').value).toBe('filterfixture')
    expect(names(host).sort()).toEqual(mocks.S.customEx.map(e => e.n).sort())
    expect(host.querySelectorAll('.library-filters .tinted')).toHaveLength(0)
  })

  it('keeps equipment choices when selecting and clearing a compatible muscle', () => {
    const host = render()
    chooseFilter(host, 'Equipment', 'dumbbell')
    chooseFilter(host, 'Muscle', 'Chest')
    expect(host.querySelector('.library-filters').textContent).toContain('Equipment · dumbbell')
    chooseFilter(host, 'Muscle', 'All')
    expect(host.querySelector('.library-filters').textContent).toContain('Equipment · dumbbell')
  })
})

describe('Library exercise variants', () => {
  it('shows the machine label as separate metadata, not as part of the exercise title', () => {
    const base = { id: 'custom-base', n: 'lever chest press', bp: 'chest', tg: 'pectorals', eq: 'leverage machine', custom: true }
    const variant = {
      id: 'custom-gym80', n: 'lever chest press (Gym80)', bp: 'chest', tg: 'chest', eq: 'leverage machine',
      baseExerciseId: base.id, variantLabel: 'Gym80', custom: true,
    }
    mocks.S.customEx = [base, variant]
    const rows = [...render().querySelectorAll('.item')]
    const row = rows.find(el => el.querySelector('.ex-variant-meta'))
    const baseRow = rows.find(el => el.querySelector('.tt')?.textContent === 'lever chest press')
    expect(row.querySelector('.tt').textContent).toBe('lever chest press Gym80')
    expect(row.querySelector('.ex-variant-meta').textContent).toBe('Gym80')
    expect(row.querySelector('.tt').textContent).not.toContain('(')
    expect(baseRow.querySelector('.ss').textContent).toContain('Chest')
    expect(row.querySelector('.ss').textContent).toContain('Chest')
    expect(row.querySelector('.ss').textContent).not.toContain('Pectorals')
  })
})

describe('Library similar exercises', () => {
  const search = (host, text) => {
    const input = host.querySelector('.search input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    act(() => { setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
  }
  const label = host => host.querySelector('.similar-label')?.textContent || null

  it('offers what comes close instead of "No match" when nothing matches exactly', () => {
    const host = render()
    search(host, 'dumbbell curl qwxz')
    expect(label(host)).toBe('No exact match. These come close:')
    expect(host.textContent).not.toContain('No match')
    expect(names(host).slice(0, 5).some(n => /dumbbell.*curl/.test(n))).toBe(true)
  })

  it('lists similar ones under a short result list, without repeating a result', () => {
    const host = render()
    search(host, 'face pull')
    expect(label(host)).toBe('Similar exercises')
    const all = names(host)
    expect(new Set(all).size).toBe(all.length)
  })
})
