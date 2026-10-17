import { describe, expect, it } from 'vitest'
import { addOption, hasLoggedWork, mapOptions, optionConfig, optionsOf, removeOption, saveOption } from './exercise-options.js'

describe('routine exercise options', () => {
  const first = { id: '0025', sets: 3, reps: 10, weight: 20, note: 'bench', sg: 'pair' }
  const second = { id: '0009', sets: 2, reps: 12, weight: 45 }
  it('keeps independent configurations and only one parent superset', () => {
    const slot = addOption(first, second)
    expect(slot.slotId).toBeTruthy()
    expect(optionsOf(slot)).toEqual([optionConfig(first), second])
    expect(slot.alternatives[0].sg).toBeUndefined()
    expect(() => addOption(slot, second)).toThrow('already an option')
  })
  it('edits only the selected option and converts every option', () => {
    const slot = addOption(first, second)
    const saved = saveOption(slot, second.id, { ...second, sets: 4 })
    expect(saved.sets).toBe(3)
    expect(saved.alternatives[0].sets).toBe(4)
    expect(mapOptions(saved, cfg => ({ ...cfg, weight: cfg.weight * 2 })).alternatives[0].weight).toBe(90)
  })
  it('promotes an option without inheriting the old option settings', () => {
    const slot = addOption(first, second)
    const promoted = removeOption(slot, first.id)
    expect(promoted).toMatchObject({ ...second, sg: 'pair', slotId: slot.slotId })
    expect(promoted.note).toBeUndefined()
    expect(promoted.alternatives).toBeUndefined()
    expect(removeOption(promoted, second.id)).toBeNull()
  })
  it('recognizes partial side work as logged work', () => {
    expect(hasLoggedWork({ sets: [{ sides: { L: { done: true }, R: { done: false } } }] })).toBe(true)
  })
})
