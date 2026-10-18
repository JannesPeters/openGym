const OWNER_KEY = 'gym_local_preview_v1'

// Called before importing the app: even its module initialization may persist browser state.
export function claimPreviewOrigin(storage, hostname) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new Error('Local previews must run on a loopback origin.')
  }
  if (storage.getItem('gym_user') || storage.getItem('gym_owner')
    || (storage.getItem(OWNER_KEY) !== '1' && storage.length > 0)) {
    throw new Error('Preview refused: this origin already contains browser data. Use a fresh localhost port; no data was changed.')
  }
  storage.setItem(OWNER_KEY, '1')
}

export async function buildLocalPreviewState(now = new Date()) {
  const { buildDemoState } = await import('./demoSeed.js')
  let id = 0
  const clock = new Date(now)
  clock.setHours(12, 0, 0, 0)
  const state = buildDemoState({ now: clock, idFactory: () => `preview-${++id}` })
  // A real choice group to exercise Jay's pending-selection UI without changing the public demo.
  state.routines[0].ex[0].slotId = 'preview-bench'
  state.routines[0].ex[0].alternatives = [{ id: '0289', sets: 3, reps: 10, weight: 20 }]
  for (const routine of state.routines) {
    for (const ex of routine.ex) ex.weight = state.exWeights[ex.id]?.w || 0
  }
  return { ...state, workoutView: 'custom', showHistoryCard: true, lang: 'en' }
}
