import { describe, expect, it } from 'vitest'
import { activeWorkoutLayout, DEFAULT_WORKOUT_LAYOUT, workoutLayout } from './workout-layout.js'

describe('workout layout preference', () => {
  it('defaults missing preferences to Custom', () => {
    expect(DEFAULT_WORKOUT_LAYOUT).toBe('custom')
    expect(workoutLayout()).toBe('custom')
    expect(activeWorkoutLayout({})).toBe('custom')
  })

  it.each(['custom', 'cards', 'list', 'compact', 'focus'])('preserves explicit %s choices', layout => {
    expect(workoutLayout(layout)).toBe(layout)
    expect(activeWorkoutLayout({ workoutView: layout })).toBe(layout)
    expect(activeWorkoutLayout({ workoutView: 'custom', active: { workoutView: layout } })).toBe(layout)
  })

  it('preserves the Cards fallback for unrecognized values', () => {
    expect(workoutLayout('grid')).toBe('cards')
  })
})
