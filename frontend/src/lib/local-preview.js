const OWNER_KEY = 'gym_local_preview_v1'
const STATE_KEY = 'gym_state_v1'
const SEEDED_KEY = 'gym_demo_seeded_v1'

export async function claimPreviewOrigin(storage, hostname, idb = globalThis.indexedDB) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new Error('Local previews must run on a loopback origin.')
  }

  const owned = storage.getItem(OWNER_KEY) === '1'
  if (storage.getItem('gym_user') || storage.getItem('gym_owner')
    || (!owned && storage.length > 0)
    || (owned && storage.getItem(STATE_KEY) && !storage.getItem(SEEDED_KEY))) {
    throw new Error('Preview refused: this origin already contains browser data. Use a fresh localhost port; no data was changed.')
  }

  if (!owned && idb) {
    if (typeof idb.databases !== 'function') {
      throw new Error('Preview refused: this browser cannot verify existing database storage. Use a fresh browser profile; no data was changed.')
    }
    if ((await idb.databases()).length) {
      throw new Error('Preview refused: this origin already contains browser databases. Use a fresh localhost port; no data was changed.')
    }
  }

  storage.setItem(OWNER_KEY, '1')
}

const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
const WEEK_MS = 7 * 86400000
const repsAtWeek = week => Math.min(16, 8 + Math.floor(week / 2))

const SESSION_NOTES = [
  'Good energy today; the main lifts moved smoothly.',
  'Short on time, so I kept the work focused and skipped the extra sets.',
  'A little stiff at first; the longer warm-up helped.',
  'Deload week: everything felt controlled and well short of failure.',
  'Small load increase felt solid. Keep the setup consistent next time.'
]

export async function buildLocalPreviewState(now = new Date()) {
  const { buildDemoState } = await import('./demoSeed.js')
  let id = 0
  const clock = new Date(now)
  clock.setHours(12, 0, 0, 0)
  const state = buildDemoState({ now: clock, idFactory: () => `preview-${++id}` })

  const today = new Date(clock)
  const start = new Date(today)
  start.setDate(start.getDate() - 12 * 7)
  const weekOf = iso => Math.floor((dayNumber(new Date(`${iso}T12:00:00`)) - dayNumber(start)) / WEEK_MS)
  const currentReps = repsAtWeek(Math.floor((dayNumber(today) - dayNumber(start)) / WEEK_MS))
  for (const routine of state.routines) {
    const cfg = routine.ex.find(entry => entry.id === '0251')
    if (cfg) cfg.reps = currentReps
  }

  for (const [i, workout] of state.workouts.entries()) {
    if (i % 8 === 2) workout.note = SESSION_NOTES[Math.floor(i / 8) % SESSION_NOTES.length]

    const dips = workout.entries.find(entry => entry.id === '0251')
    if (dips) {
      const targetReps = repsAtWeek(weekOf(workout.d))
      for (const set of dips.sets) set.r = Math.max(4, targetReps - Math.max(0, 10 - set.r))
    }

    const bench = workout.entries.find(entry => entry.id === '0025')
    if (bench && i % 6 === 3) bench.note = 'Pause briefly at the chest and keep both feet planted.'
    workout.vol = workout.entries.reduce((total, entry) =>
      total + entry.sets.reduce((volume, set) => volume + set.w * set.r, 0), 0)
  }

  return { ...state, showHistoryCard: true, lang: 'en' }
}
