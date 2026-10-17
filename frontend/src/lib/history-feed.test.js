import { describe, expect, it } from 'vitest'
import { historyRows, recentWorkouts } from './history-feed.js'

describe('Home recent workouts', () => {
  it('matches History order, including multiple sessions and missing start times', () => {
    const S = {
      workouts: [
        { id: 'older', d: '2026-10-01' },
        { id: 'morning', d: '2026-10-15', start: 100 },
        { id: 'evening', d: '2026-10-15', start: 200 },
        { id: 'imported', d: '2026-10-12' },
      ],
      dayNotes: { '2026-10-16': { tag: 'rest' }, '2026-10-15': { tag: 'travel' } },
    }
    const before = structuredClone(S)
    expect(recentWorkouts(S).map(w => w.id)).toEqual(['evening', 'morning', 'imported', 'older'])
    expect(recentWorkouts(S)).toEqual(historyRows(S).filter(r => r.w).map(r => r.w))
    expect(S).toEqual(before)
  })

  it('shows at most five saved workouts, excluding day notes and the active workout', () => {
    const S = {
      workouts: Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, d: `2026-10-${10 + i}` })),
      dayNotes: { '2026-10-18': { tag: 'rest' } },
      active: { id: 'active', d: '2026-10-19' },
    }
    expect(recentWorkouts(S).map(w => w.id)).toEqual(['w7', 'w6', 'w5', 'w4', 'w3'])
  })

  it('returns an empty list before a first saved workout', () => {
    expect(recentWorkouts({})).toEqual([])
    expect(recentWorkouts({ workouts: [], dayNotes: { '2026-10-10': { tag: 'rest' } } })).toEqual([])
  })
})
