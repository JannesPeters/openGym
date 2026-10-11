// @vitest-environment happy-dom
// QA 1.3.11, Library: an imported custom exercise named like a catalogue one could not be saved
// unchanged, the detail sheet tagged muscles the catalogue credits with nothing (#359), and a long
// name could push the favourite star off a 320 px screen.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'

import { EXIDX, registerCustom } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { _setLangState } from './lib/i18n-core.js'
import { bindUI } from './components/ui.jsx'
import { customExSheet, detailTags, exerciseDetailSheet, exerciseVariantSheet, exConfigSheet } from './sheets.jsx'

bindUI(useUI)

const mounted = []
const S = () => useStore.getState().S

function render(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const renderTop = () => {
  const sheet = useUI.getState().sheets.at(-1)
  return render(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
}
const click = (host, sel, text) => {
  const el = [...host.querySelectorAll(sel)].find(e => e.textContent.trim() === text)
  if (!el) throw new Error(`nothing with text "${text}"`)
  act(() => el.click())
}
const type = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
function seed(ex) {
  useStore.setState(s => ({ S: { ...s.S, customEx: [ex] } }))
  registerCustom([ex])
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null, config: null })
  registerCustom([])
  _setLangState('en', null, null, null)
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  registerCustom([])
})

describe('editing a custom exercise named like a catalogue one', () => {
  const trap = () => ({ id: 'cx9', n: 'trap bar deadlift', bp: 'upper legs', eq: 'custom', custom: true, desc: '' })

  it('saves it unchanged', () => {
    expect(Object.values(EXIDX).some(e => e.id !== 'cx9' && e.n.toLowerCase() === 'trap bar deadlift')).toBe(true)
    seed(trap())
    customExSheet(trap())
    const form = renderTop()
    type(form.querySelector('textarea'), 'Hex bar')
    click(form, 'button', 'Save')
    expect(useUI.getState().toastMsg).toBe('Saved')
    expect(S().customEx[0]).toMatchObject({ n: 'trap bar deadlift', desc: 'Hex bar' })
  })

  it('still refuses a rename onto another exercise', () => {
    const own = { id: 'cx8', n: 'My row', bp: 'back', eq: 'barbell', custom: true }
    seed(own)
    customExSheet(own)
    const form = renderTop()
    type(form.querySelector('input.input'), 'Trap Bar Deadlift')
    click(form, 'button', 'Save')
    expect(useUI.getState().toastMsg).toMatch(/already exists/)
    expect(S().customEx[0].n).toBe('My row')
  })

  it('caps the name at 80 characters', () => {
    customExSheet(null)
    expect(renderTop().querySelector('input.input').maxLength).toBe(80)
  })

  it('creates a separately tracked variant from a catalogue exercise', () => {
    exerciseVariantSheet(EXIDX['0576'])
    const form = renderTop()
    const input = form.querySelector('input.input')
    expect(input.maxLength).toBe(40)
    type(input, 'Nautilus')
    click(form, 'button', 'Create variant')
    const [variant] = S().customEx
    expect(variant).toMatchObject({
      id: expect.any(String), n: 'lever chest press (Nautilus)', baseExerciseId: '0576',
      variantLabel: 'Nautilus', bp: 'chest', eq: 'leverage machine', custom: true,
    })
    expect(variant.id).not.toBe('0576')
  })

  it('keeps custom variant names in sync when their base exercise is renamed', () => {
    const base = { id: 'cx-base', n: 'Lever Chest Press', bp: 'chest', eq: 'leverage machine', custom: true }
    const variant = {
      id: 'cx-variant', n: 'Lever Chest Press (Nautilus)', bp: 'chest', eq: 'leverage machine',
      baseExerciseId: base.id, variantLabel: 'Nautilus', custom: true,
    }
    useStore.setState(s => ({ S: { ...s.S, customEx: [base, variant] } }))
    registerCustom([base, variant])
    customExSheet(base)
    const form = renderTop()
    type(form.querySelector('input.input'), 'Chest Press')
    click(form, 'button', 'Save')
    expect(S().customEx[1].n).toBe('Chest Press (Nautilus)')
  })
})

describe('the exercise detail sheet', () => {
  it('shows the same canonical muscle metadata for catalogue and machine variants', () => {
    const base = EXIDX['1301']
    expect(base.tg).toBe('pectorals')
    const variant = {
      ...base, id: 'cx-variant', n: 'machine inner chest press (Gym80)',
      tg: 'chest', baseExerciseId: base.id, variantLabel: 'Gym80', custom: true,
    }
    expect(detailTags(variant).map(tag => tag.label)).toEqual(detailTags(base).map(tag => tag.label))
  })

  it('shows family variants near the exercise name and switches details in place', () => {
    const base = EXIDX['0576']
    const variant = {
      id: 'cx-variant', n: 'lever chest press (Nautilus)', bp: 'chest', eq: 'leverage machine',
      baseExerciseId: base.id, variantLabel: 'Nautilus', custom: true,
    }
    seed(variant)
    exerciseDetailSheet(base)
    const detail = renderTop()
    const selector = detail.querySelector('.chips[role="group"]')
    expect([...selector.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Original', 'Nautilus'])
    expect(selector.querySelectorAll('button')[1].getAttribute('aria-label')).toBe('lever chest press · Nautilus')

    act(() => selector.querySelectorAll('button')[1].click())
    expect(detail.querySelector('h3').textContent).toBe(`${base.n} Nautilus`)
    expect(selector.querySelector('[aria-pressed="true"]').textContent).toBe('Nautilus')
    act(() => selector.querySelectorAll('button')[0].click())
    expect(detail.querySelector('h3').textContent).toBe(base.n)
    expect(selector.querySelector('[aria-pressed="true"]').textContent).toBe('Original')
    expect(useUI.getState().sheets).toHaveLength(1)
  })

  it('does not tag a muscle the exercise gets no credit for', () => {
    const bench = EXIDX['0025']
    expect(bench.muscleWeights.biceps).toBe(0)
    exerciseDetailSheet(bench)
    const tags = [...renderTop().querySelectorAll('.tag')].map(t => t.textContent.trim())
    expect(tags).toEqual(expect.arrayContaining(['Triceps']))
    expect(tags).not.toContain('Biceps')
  })

  it('lets a long name wrap instead of pushing the star out', () => {
    exerciseDetailSheet(EXIDX['0025'])
    expect(renderTop().querySelector('h3').classList.contains('exdetail-name')).toBe(true)
  })
})

describe('routine exercise variants', () => {
  it('shows variants in the exercise settings and saves the selected exercise id', () => {
    const base = EXIDX['0576']
    const variant = {
      id: 'cx-variant', n: 'lever chest press (Nautilus)', bp: 'chest', eq: 'leverage machine',
      baseExerciseId: base.id, variantLabel: 'Nautilus', custom: true,
    }
    seed(variant)
    let saved
    exConfigSheet(base, null, (config, selectedEx) => { saved = { config, selectedEx } }, null, null, null, null, null, true)
    const form = renderTop()
    const selector = form.querySelector('.chips[role="group"]')
    expect([...selector.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Original', 'Nautilus'])
    act(() => selector.querySelectorAll('button')[1].click())
    click(form, 'button', 'Add to routine')
    expect(saved.selectedEx.id).toBe(variant.id)
    expect(saved.config).toMatchObject({ sets: 3, mode: 'reps' })
  })
})
