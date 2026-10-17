export const DEFAULT_WORKOUT_LAYOUT = 'custom'

export function workoutLayout(value) {
  if (!value) return DEFAULT_WORKOUT_LAYOUT
  return ['custom', 'cards', 'list', 'compact', 'focus'].includes(value) ? value : 'cards'
}

export function activeWorkoutLayout(S) {
  return workoutLayout(S.active?.workoutView || S.workoutView)
}
