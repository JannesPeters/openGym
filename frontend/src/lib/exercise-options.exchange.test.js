import { describe, expect, it } from 'vitest'
import { buildPlanBundle, mergePlan, parsePlan } from './plan-share.js'
import { convertStateUnit } from './units.js'
import { mergeStates, stampChange } from './sync-merge.js'
import { canonicalPlan, hashPlan } from './coach.js'
import { canonicalPlan as serverCanonical } from '../../../api/coach/core/payload.js'
import { hashPlan as serverHash } from '../../../api/coach/core/plan-hash.js'
import { keepUnknown } from '../../../api/sync-stamps.js'

const state = () => ({
  unit: 'kg', week: {}, workouts: [], customEx: [{
    id: 'custom-machine', n: 'My machine', bp: 'chest', eq: 'leverage machine', custom: true
  }],
  routines: [{ id: 'r', name: 'Push', ex: [{
    id: '0025', slotId: 'slot', sets: 3, reps: 10, weight: 20,
    alternatives: [{ id: 'custom-machine', sets: 2, reps: 12, weight: 45, inc: 2.5 }]
  }] }]
})

describe('exercise option exchange', () => {
  it('shares every option and referenced custom exercise with remapped IDs and converted loads', () => {
    const bundle = buildPlanBundle(state())
    expect(bundle.opengym_plan).toBe(2)
    expect(bundle.customEx.map(ex => ex.id)).toEqual(['custom-machine'])
    const destination = { unit: 'lb', routines: [], customEx: [], week: {} }
    mergePlan(destination, parsePlan(bundle, 'lb'))
    const slot = destination.routines[0].ex[0]
    expect(slot.slotId).not.toBe('slot')
    expect(slot.alternatives[0]).toMatchObject({ sets: 2, reps: 12, weight: 99, inc: 5.5 })
    expect(slot.alternatives[0].id).toBe(destination.customEx[0].id)
  })
  it('converts saved and active snapshot option weights', () => {
    const s = state()
    s.active = { entries: [{ id: '0025', sets: [], choiceOptions: [s.routines[0].ex[0].alternatives[0]] }] }
    const converted = convertStateUnit(s, 'lb')
    expect(converted.routines[0].ex[0].alternatives[0].weight).toBe(99)
    expect(converted.active.entries[0].choiceOptions[0].weight).toBe(99)
    expect(s.routines[0].ex[0].alternatives[0].weight).toBe(45)
  })
  it('reports dropped options and promotes the remaining valid option', () => {
    const bundle = buildPlanBundle(state())
    bundle.routines[0].ex[0].id = 'missing'
    const parsed = parsePlan(bundle)
    expect(parsed.dropped).toBe(1)
    expect(parsed.routines[0].ex[0]).toMatchObject({ id: 'custom-machine', sets: 2, weight: 45 })
    expect(parsed.routines[0].ex[0].alternatives).toBeUndefined()
    bundle.routines[0].ex[0].alternatives[0].alternatives = []
    expect(() => parsePlan(bundle)).toThrow()
    expect(() => parsePlan({ ...bundle, opengym_plan: 999 })).toThrow('newer version')
  })
  it('preserves nested options through routine sync and unstamped older writers', () => {
    const before = state()
    const next = structuredClone(before)
    next.routines[0].ex[0].alternatives[0].weight = 50
    stampChange(before, next, 100)
    expect(mergeStates(next, before).routines[0].ex[0].alternatives[0].weight).toBe(50)
    const oldWriter = state()
    delete oldWriter.routines[0].ex[0].alternatives
    keepUnknown(before, oldWriter)
    expect(oldWriter.routines[0].ex[0].alternatives).toEqual(before.routines[0].ex[0].alternatives)
  })
  it('keeps client/server hashes in parity and detects alternative target changes', () => {
    const s = state()
    const canonical = canonicalPlan(s)
    expect(canonical).toEqual(serverCanonical(s))
    expect(hashPlan(canonical)).toBe(serverHash(serverCanonical(s)))
    s.routines[0].ex[0].alternatives[0].weight = 50
    expect(hashPlan(canonicalPlan(s))).not.toBe(hashPlan(canonical))
  })
})
