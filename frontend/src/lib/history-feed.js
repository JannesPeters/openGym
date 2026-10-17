import { dayNoteOf } from './day-notes.js'

// Saved workouts are ordered by day, then start. Reverse the stored order within a day,
// matching History even for older workouts without timestamps.
export function historyRows(S) {
  const trained = new Set((S.workouts || []).map(w => w?.d))
  const notes = Object.keys(S.dayNotes || {}).filter(d => !trained.has(d)).map(d => ({ d, note: dayNoteOf(S, d) })).filter(x => x.note)
  const rows = [...(S.workouts || []).map(w => ({ d: w.d, w })), ...notes]
  return rows.map((r, i) => [r, i]).sort((a, b) => (a[0].d < b[0].d ? 1 : a[0].d > b[0].d ? -1 : b[1] - a[1])).map(([r]) => r)
}

export const recentWorkouts = S => historyRows(S).filter(r => r.w).slice(0, 5).map(r => r.w)
