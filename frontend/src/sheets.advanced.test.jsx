// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { EXDB, EXIDX, isAssisted, isCardio } from './lib/exercises.js'
import { exerciseDetailSheet } from './sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mounted = []
const open = ex => {
  exerciseDetailSheet(ex)
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const stepper = (host, label) => [...host.querySelectorAll('.stp-w')].find(el => el.querySelector('.stp-l')?.textContent === label)
const enter = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  act(() => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}

beforeEach(() => {
  document.body.innerHTML = ''
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: { ...structuredClone(DEF), unit: 'kg', loadKind: { '0585': { kind: 'single', _ts: 1 } } }, user: null })
})
afterEach(() => act(() => mounted.splice(0).forEach(root => root.unmount())))

describe('exercise advanced settings', () => {
  it('starts collapsed around loading, base weight and 1RM, but not primary exercise information', () => {
    const host = open(EXIDX['0585'])
    const advanced = host.querySelector('details.exercise-advanced')
    expect(advanced.open).toBe(false)
    expect(advanced.querySelector('summary').textContent).toBe('Advanced settings')
    expect([...advanced.querySelectorAll('h4')].map(el => el.textContent)).toContain('Plate loading')
    expect([...advanced.querySelectorAll('h4')].map(el => el.textContent)).toContain('Estimated 1RM')
    expect(stepper(advanced, 'Base weight (kg)')).toBeTruthy()
    expect(advanced.contains(host.querySelector('.exdetail-name'))).toBe(false)
    expect(advanced.contains(host.querySelector('.exmedia'))).toBe(false)
    expect(advanced.contains(host.querySelector('.steps-list'))).toBe(false)
    expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Add to my plan').closest('details')).toBeNull()
  })

  it('keeps stored loading and local 1RM calculator state mounted across disclosure toggles', () => {
    const ex = EXIDX['0585']
    const host = open(ex)
    const advanced = host.querySelector('details')
    advanced.open = true
    const base = stepper(advanced, 'Base weight (kg)').querySelector('input')
    const weight = stepper(advanced, 'Weight (kg)').querySelector('input')
    const reps = stepper(advanced, 'Reps').querySelector('input')
    enter(base, '12.5')
    enter(weight, '42.5')
    enter(reps, '8')
    const estimate = advanced.querySelector('.row.between b').textContent
    advanced.open = false
    expect(useStore.getState().S.barWeights[ex.id]).toBe(12.5)
    advanced.open = true
    expect(stepper(advanced, 'Weight (kg)').querySelector('input')).toBe(weight)
    expect([base.value, weight.value, reps.value]).toEqual(['12.5', '42.5', '8'])
    expect(advanced.querySelector('.row.between b').textContent).toBe(estimate)
    const reopened = open(ex).querySelector('details')
    expect(reopened.open).toBe(false)
    expect(stepper(reopened, 'Base weight (kg)').querySelector('input').value).toBe('12.5')
  })

  it('does not introduce a 1RM calculator for cardio or assisted exercises', () => {
    for (const ex of [EXDB.find(isCardio), EXDB.find(isAssisted)]) {
      expect(ex).toBeTruthy()
      expect([...open(ex).querySelectorAll('h4')].some(el => el.textContent === 'Estimated 1RM')).toBe(false)
    }
  })
})
