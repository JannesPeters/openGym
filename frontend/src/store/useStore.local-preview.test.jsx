// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api.js'
import { useStore, freshState } from './useStore.js'
import { claimPreviewOrigin, buildLocalPreviewState } from '../lib/local-preview.js'

vi.mock('../lib/demo.js', () => ({ DEMO: true, LOCAL_PREVIEW: true, DEMO_SEEDED: 'gym_demo_seeded_v1' }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(api).mockClear()
  useStore.setState({ S: freshState(), user: null, ready: false })
  claimPreviewOrigin(localStorage, 'localhost')
})
afterEach(() => {
  localStorage.clear()
  useStore.setState({ S: freshState(), user: null, ready: false })
})

describe('local preview boot and reset', () => {
  it('seeds an isolated guest once without contacting the API', async () => {
    await useStore.getState().boot()
    expect(useStore.getState().ready).toBe(true)
    expect(useStore.getState().isGuest()).toBe(true)
    expect(useStore.getState().S.workouts.length).toBeGreaterThan(25)
    expect(useStore.getState().S.workoutView).toBe('custom')
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).showHistoryCard).toBe(true)
    expect(localStorage.getItem('gym_demo_seeded_v1')).toBe('1')
    expect(api).not.toHaveBeenCalled()
  })

  it('keeps preview edits and an empty example across boot, and explicitly restores the seed', async () => {
    await useStore.getState().boot()
    useStore.getState().update(s => { s.workouts = []; s.showHistoryCard = true })
    await useStore.getState().boot()
    expect(useStore.getState().S.workouts).toEqual([])
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts).toEqual([])
    await useStore.getState().resetDemo()
    const expected = await buildLocalPreviewState()
    expect(useStore.getState().S.workouts).toEqual(expected.workouts)
    expect(useStore.getState().S.routines).toEqual(expected.routines)
    expect(api).not.toHaveBeenCalled()
  })
})
