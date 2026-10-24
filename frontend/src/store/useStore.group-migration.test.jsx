// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(async () => ({})), setRemoteAuth: vi.fn() }))
const key = 'gym_state_v1'
const legacy = () => ({
  routines: [{ id: 'r', ex: [{ id: '0025', slotId: 'slot', sets: 3, reps: 5, weight: 60,
    alternatives: [{ id: '0289', sets: 2, reps: 8, weight: 30 }] }] }],
  workouts: [], customEx: [],
})
beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  const { api } = await import('../lib/api.js')
  api.mockReset().mockResolvedValue({})
})

it('validates on load, keeps an exact owner-scoped original, and persists one canonical version', async () => {
  const raw = JSON.stringify(legacy())
  localStorage.setItem('gym_owner', 'account')
  localStorage.setItem(key, raw)
  const { useStore } = await import('./useStore.js')
  expect(useStore.getState().loadError).toBeNull()
  expect(useStore.getState().S.stateVersion).toBe(2)
  expect(localStorage.getItem(key)).toBe(raw)
  expect(localStorage.getItem(key + '_pre_groups_v1:account')).toBe(raw)
  useStore.getState().update(state => { state.exerciseGroups[0].name = 'Shared' }, false)
  const saved = JSON.parse(localStorage.getItem(key))
  expect(saved.stateVersion).toBe(2)
  expect(saved.routines[0].ex[0].kind).toBe('group')
  expect(saved.routines[0].ex[0].id).toBeUndefined()
  expect(localStorage.getItem(key + '_pre_groups_v1:account')).toBe(raw)
})

it.each(['future', 'invalid'])('blocks %s data without writes or a success-shaped empty profile', async kind => {
  const data = kind === 'future' ? { ...legacy(), stateVersion: 99 }
    : { ...legacy(), stateVersion: 2, exerciseGroups: [{ id: 'bad', name: 'Bad', options: [{ id: 'same' }, { id: 'same' }] }] }
  const raw = JSON.stringify(data)
  localStorage.setItem(key, raw)
  const { useStore } = await import('./useStore.js')
  expect(useStore.getState().loadError).toBeInstanceOf(Error)
  await useStore.getState().boot()
  expect(() => useStore.getState().update(state => { state.routines = [] })).toThrow()
  expect(localStorage.getItem(key)).toBe(raw)
  expect(localStorage.length).toBe(1)
})

it('converts a guest profile with an unavailable API, saves recovery first, and does not migrate again on reload', async () => {
  const raw = JSON.stringify(legacy())
  localStorage.setItem(key, raw)
  localStorage.setItem('gym_guest', '1')
  const { api } = await import('../lib/api.js')
  api.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
  const writes = vi.spyOn(localStorage, 'setItem')
  try {
    let { useStore } = await import('./useStore.js')
    await useStore.getState().boot()
    expect(useStore.getState().ready).toBe(true)
    expect(useStore.getState().isGuest()).toBe(true)
    expect(useStore.getState().S.routines[0].ex[0].kind).toBe('group')
    expect(localStorage.getItem(key)).toBe(raw)
    expect(localStorage.getItem(key + '_pre_groups_v1:guest')).toBe(raw)
    useStore.getState().update(state => { state.exerciseGroups[0].name = 'Checked' })
    const saved = JSON.parse(localStorage.getItem(key))
    expect(saved.stateVersion).toBe(2)
    const backupWrite = writes.mock.calls.findIndex(([name]) => name === key + '_pre_groups_v1:guest')
    const convertedWrite = writes.mock.calls.findIndex(([name]) => name === key)
    expect(backupWrite).toBeGreaterThanOrEqual(0)
    expect(convertedWrite).toBeGreaterThan(backupWrite)
    vi.resetModules()
    ;({ useStore } = await import('./useStore.js'))
    await useStore.getState().boot()
    expect(useStore.getState().isGuest()).toBe(true)
    expect(useStore.getState().S.exerciseGroups).toEqual(saved.exerciseGroups)
    expect(useStore.getState().S.routines).toEqual(saved.routines)
    expect(localStorage.getItem(key + '_pre_groups_v1:guest')).toBe(raw)
    expect(api.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
  } finally { writes.mockRestore() }
})

it('leaves guest data intact and blocks saving if its pre-migration recovery copy cannot be stored', async () => {
  const raw = JSON.stringify(legacy())
  localStorage.setItem(key, raw)
  localStorage.setItem('gym_guest', '1')
  const write = localStorage.setItem.bind(localStorage)
  const writes = vi.spyOn(localStorage, 'setItem').mockImplementation((name, value) => {
    if (name === key + '_pre_groups_v1:guest') throw new DOMException('Recovery backup cannot be stored', 'QuotaExceededError')
    return write(name, value)
  })
  try {
    const { useStore } = await import('./useStore.js')
    await useStore.getState().boot()
    expect(useStore.getState().loadError?.message).toBe('Recovery backup cannot be stored')
    expect(() => useStore.getState().update(state => { state.routines = [] })).toThrow('Recovery backup')
    expect(localStorage.getItem(key)).toBe(raw)
    expect(localStorage.getItem('gym_guest')).toBe('1')
    expect(localStorage.getItem(key + '_pre_groups_v1:guest')).toBeNull()
  } finally { writes.mockRestore() }
})
