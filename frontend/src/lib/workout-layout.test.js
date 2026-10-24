import { describe, expect, it } from 'vitest'
import { activeWorkoutLayout, DEFAULT_WORKOUT_LAYOUT, workoutLayout, workoutMediaSize } from './workout-layout.js'

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

describe('workout media size preference', () => {
  it('uses a compact default in Jay’s layout and Full in other layouts', () => {
    expect(workoutMediaSize({ gifSize: 'default' })).toBe('mini')
    for (const layout of ['cards', 'list', 'compact', 'focus']) {
      expect(workoutMediaSize({ gifSize: 'default', workoutView: layout })).toBe('full')
    }
  })

  it('preserves explicit media choices in every layout', () => {
    for (const layout of ['custom', 'cards', 'list', 'compact', 'focus']) {
      expect(workoutMediaSize({ gifSize: 'full', workoutView: layout })).toBe('full')
      expect(workoutMediaSize({ gifSize: 'mini', workoutView: layout })).toBe('mini')
      expect(workoutMediaSize({ gifSize: 'off', workoutView: layout })).toBe('off')
    }
  })

  it('treats unknown saved values as Full', () => {
    expect(workoutMediaSize({ gifSize: 'huge', workoutView: 'custom' })).toBe('full')
  })
})
