// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { buildLocalPreviewState, claimPreviewOrigin } from './local-preview.js'

const emptyDatabases = { databases: async () => [] }
const snapshot = storage => Array.from({ length: storage.length }, (_, i) => {
  const key = storage.key(i)
  return [key, storage.getItem(key)]
})

beforeEach(() => localStorage.clear())

describe('local preview isolation', () => {
  it('claims an empty loopback origin and accepts its own reloads without changing saved data', async () => {
    await claimPreviewOrigin(localStorage, 'localhost', emptyDatabases)
    localStorage.setItem('gym_demo_seeded_v1', '1')
    localStorage.setItem('gym_state_v1', '{"workouts":[]}')
    const before = snapshot(localStorage)
    await expect(claimPreviewOrigin(localStorage, 'localhost', emptyDatabases)).resolves.toBeUndefined()
    expect(snapshot(localStorage)).toEqual(before)
  })

  it.each(['gym_state_v1', 'gym_guest', 'unrelated-data'])('refuses existing %s without any writes', async key => {
    localStorage.setItem(key, 'keep me')
    const before = snapshot(localStorage)
    await expect(claimPreviewOrigin(localStorage, 'localhost', emptyDatabases)).rejects.toThrow('already contains browser data')
    expect(snapshot(localStorage)).toEqual(before)
  })

  it.each(['gym_user', 'gym_owner'])('refuses account data even with a preview marker (%s)', async key => {
    await claimPreviewOrigin(localStorage, 'localhost', emptyDatabases)
    localStorage.setItem(key, 'real account')
    const before = snapshot(localStorage)
    await expect(claimPreviewOrigin(localStorage, 'localhost', emptyDatabases)).rejects.toThrow('already contains browser data')
    expect(snapshot(localStorage)).toEqual(before)
  })

  it('refuses a partially initialized preview profile rather than reseeding over it', async () => {
    await claimPreviewOrigin(localStorage, 'localhost', emptyDatabases)
    localStorage.setItem('gym_state_v1', '{"workouts":[{"id":"keep"}]}')
    const before = snapshot(localStorage)
    await expect(claimPreviewOrigin(localStorage, 'localhost', emptyDatabases)).rejects.toThrow('already contains browser data')
    expect(snapshot(localStorage)).toEqual(before)
  })

  it('refuses an origin with existing IndexedDB databases before claiming it', async () => {
    const indexedDB = { databases: async () => [{ name: 'opengym-media' }] }
    await expect(claimPreviewOrigin(localStorage, 'localhost', indexedDB)).rejects.toThrow('already contains browser databases')
    expect(localStorage.length).toBe(0)
  })

  it('fails closed when existing database storage cannot be checked', async () => {
    await expect(claimPreviewOrigin(localStorage, 'localhost', {})).rejects.toThrow('cannot verify existing database storage')
    expect(localStorage.length).toBe(0)
  })

  it('refuses non-local hosts before writing anything', async () => {
    await expect(claimPreviewOrigin(localStorage, 'gym.example.com', emptyDatabases)).rejects.toThrow('loopback')
    expect(localStorage.length).toBe(0)
  })
})

describe('local preview seed', () => {
  it('is repeatable for a local date and supplies a progressive, annotated history without touching storage', async () => {
    const a = await buildLocalPreviewState(new Date('2026-10-18T08:00:00'))
    const b = await buildLocalPreviewState(new Date('2026-10-18T23:00:00'))
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.workouts.length).toBeGreaterThan(25)
    expect(a.bodyweight.length).toBeGreaterThan(20)
    expect(a.measurements.length).toBeGreaterThanOrEqual(5)
    expect(a.showHistoryCard).toBe(true)
    expect(a.workouts.some(workout => workout.note)).toBe(true)
    expect(a.workouts.some(workout => workout.entries.some(entry => entry.note))).toBe(true)
    expect(a.routines.every(routine => routine.ex.some(slot =>
      slot.groupName && Array.isArray(slot.alternatives) && slot.alternatives.length >= 2
    ))).toBe(true)

    const bench = a.workouts.flatMap(workout => workout.entries
      .filter(entry => entry.id === '0025')
      .map(entry => entry.sets[0].w))
    const dips = a.workouts.flatMap(workout => workout.entries
      .filter(entry => entry.id === '0251')
      .map(entry => entry.sets[0].r))
    expect(bench.at(-1)).toBeGreaterThan(bench[0])
    expect(dips.at(-1)).toBeGreaterThan(dips[0])

    const routineIds = a.routines.map(routine => routine.id)
    expect(a.workouts.every(workout => routineIds.includes(workout.routineId))).toBe(true)
    expect(Object.values(a.week).every(id => routineIds.includes(id))).toBe(true)
    expect(Object.values(a.dayPlan).every(id => routineIds.includes(id))).toBe(true)
    expect(new Set([...routineIds, ...a.workouts.map(workout => workout.id)]).size)
      .toBe(routineIds.length + a.workouts.length)
    expect(localStorage.length).toBe(0)
  })
})
