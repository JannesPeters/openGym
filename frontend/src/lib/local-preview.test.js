// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { claimPreviewOrigin, buildLocalPreviewState } from './local-preview.js'

beforeEach(() => localStorage.clear())

describe('local preview isolation', () => {
  it('claims only an empty loopback origin and accepts its own reloads', () => {
    claimPreviewOrigin(localStorage, 'localhost')
    localStorage.setItem('gym_state_v1', '{"workouts":[]}')
    expect(() => claimPreviewOrigin(localStorage, 'localhost')).not.toThrow()
    expect(localStorage.getItem('gym_state_v1')).toBe('{"workouts":[]}')
  })

  it.each(['gym_state_v1', 'gym_guest', 'unrelated-data'])('refuses existing %s without any writes', key => {
    localStorage.setItem(key, 'keep me')
    const before = { ...localStorage }
    expect(() => claimPreviewOrigin(localStorage, 'localhost')).toThrow('already contains browser data')
    expect({ ...localStorage }).toEqual(before)
  })

  it.each(['gym_user', 'gym_owner'])('refuses account data even with a preview marker (%s)', key => {
    claimPreviewOrigin(localStorage, 'localhost')
    localStorage.setItem(key, 'real account')
    const before = { ...localStorage }
    expect(() => claimPreviewOrigin(localStorage, 'localhost')).toThrow('already contains browser data')
    expect({ ...localStorage }).toEqual(before)
  })

  it('refuses non-local hosts before writing anything', () => {
    expect(() => claimPreviewOrigin(localStorage, 'gym.example.com')).toThrow('loopback')
    expect(localStorage.length).toBe(0)
  })

  it('is deterministic across the same day, with independent objects and intact references', async () => {
    const a = await buildLocalPreviewState(new Date('2026-10-18T08:00:00'))
    const b = await buildLocalPreviewState(new Date('2026-10-18T23:00:00'))
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.workouts.length).toBeGreaterThan(25)
    expect(a.bodyweight.length).toBeGreaterThan(20)
    expect(a.measurements.length).toBeGreaterThanOrEqual(5)
    expect(a).toMatchObject({ showHistoryCard: true, workoutView: 'custom' })
    const routineIds = a.routines.map(r => r.id)
    expect(a.workouts.every(w => routineIds.includes(w.routineId))).toBe(true)
    expect(Object.values(a.week).every(id => routineIds.includes(id))).toBe(true)
    expect(Object.values(a.dayPlan).every(id => routineIds.includes(id))).toBe(true)
    expect(new Set([...routineIds, ...a.workouts.map(w => w.id)]).size).toBe(routineIds.length + a.workouts.length)
    expect(a.routines[0].ex[0].alternatives).toHaveLength(1)
    a.routines[0].ex[0].alternatives[0].weight = 999
    expect(b.routines[0].ex[0].alternatives[0].weight).toBe(20)
    expect(localStorage.length).toBe(0)
  })
})
