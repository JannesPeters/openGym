import { describe, expect, it } from 'vitest'
import { buildCombinedEntries } from './session-merge.js'
import { chooseWorkoutOption } from './workout-options.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { routineChangesFromEntry, updateRoutineFromEntry } from './routines.js'
import { nextUnfinishedUnit, supersetFlowStep } from './supersetFlow.js'
import { setUnitsTotal } from './history.js'

const makeState = () => {
  const routines = [{ id: 'r', prog: 'off', ex: [{
    id: '0025', slotId: 'slot', sets: 3, reps: 10, weight: 20, sg: 'pair',
    alternatives: [{ id: '0009', sets: 2, reps: 12, weight: 45 }]
  }, { id: '0031', sets: 3, reps: 8, weight: 30, sg: 'pair' }] }]
  const state = { unit: 'kg', workouts: [], routines, exWeights: {} }
  state.active = { id: 'a', entries: buildCombinedEntries(state, ['r']).entries, cur: 0 }
  return state
}

describe('workout choices', () => {
  it.each(['custom', 'list', 'cards', 'compact', 'focus'])('only selects an exercise option in layouts with a current exercise (%s)', layout => {
    const state = makeState()
    state.active.workoutView = layout
    state.active.cur = 1
    chooseWorkoutOption(state, 0, '0025')
    expect(state.active.cur).toBe(layout === 'custom' ? 1 : 0)
    chooseWorkoutOption(state, 0, '0009', { add: true })
    expect(state.active.cur).toBe(layout === 'custom' ? 1 : 2)
  })

  it('starts with an unresolved slot that cannot be logged as the primary', () => {
    const state = makeState()
    expect(state.active.entries).toHaveLength(2)
    expect(state.active.entries[0]).toMatchObject({ choicePending: true, sets: [], slotId: 'slot' })
    expect(state.active.entries[0].target.alternatives).toBeUndefined()
    expect(buildCompletedWorkout(state.active).entries).toEqual([])
    expect(nextUnfinishedUnit(state.active.entries, [[0], [1]], 1)).toEqual([0])
    expect(supersetFlowStep(state.active.entries, [0, 1], 1).nextIdx).toBe(0)
    expect(setUnitsTotal([state.active.entries[0]])).toBe(1)
  })
  it('alternating options resumes each exercise independently', () => {
    const state = makeState()
    state.routines[0].prog = 'linear'
    state.routines[0].ex[0].inc = 2.5
    const start = id => {
      state.active = { id, entries: buildCombinedEntries(state, ['r']).entries, cur: 0 }
    }
    const finish = () => {
      state.active.entries[0].sets.forEach(set => { set.done = true })
      state.workouts.push(buildCompletedWorkout(state.active))
    }
    start('first-day')
    chooseWorkoutOption(state, 0, '0025')
    finish()
    start('machine-day')
    chooseWorkoutOption(state, 0, '0009')
    expect(state.active.entries[0].target.weight).toBe(45)
    finish()
    start('bench-day')
    chooseWorkoutOption(state, 0, '0025')
    expect(state.active.entries[0].target.weight).toBe(22.5)
    expect(state.active.entries[0].target.sets).toBe(3)
    expect(state.active.entries[0].target.reps).toBe(10)
  })
  it('keeps the workout snapshot when the saved group or routine policy changes', () => {
    const state = makeState()
    state.routines[0].prog = 'linear'
    state.routines[0].ex[0].alternatives[0].weight = 90
    chooseWorkoutOption(state, 0, '0009')
    expect(state.active.entries[0].target.weight).toBe(45)
    expect(state.active.entries[0].plan.policy).toBe('off')
  })
  it('builds only the chosen option with its own full targets and parent group', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0009')
    const entry = state.active.entries[0]
    expect(entry).toMatchObject({ id: '0009', rid: 'r', sg: 'pair', slotId: 'slot', target: { sets: 2, reps: 12, weight: 45 } })
    expect(entry.sets).toHaveLength(2)
    expect(entry.sets.every(set => set.w === 45)).toBe(true)
    expect(entry.target.choiceOptions).toBeUndefined()
    expect(entry.choicePending).toBeUndefined()
    expect(state.routines[0].ex[0].id).toBe('0025')
  })
  it('never swaps logged work, but adds the other option outside the superset', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0025')
    state.active.entries[0].sets[0].done = true
    const original = structuredClone(state.active.entries[0])
    expect(() => chooseWorkoutOption(state, 0, '0009')).toThrow('cannot be swapped')
    expect(chooseWorkoutOption(state, 0, '0009', { add: true })).toBe(2)
    expect(state.active.entries[0]).toEqual(original)
    expect(state.active.entries[2]).toMatchObject({ id: '0009', target: { sets: 2, reps: 12 } })
    expect(state.active.entries[2].sg).toBeUndefined()
    expect(state.active.entries[2].sets).toHaveLength(2)
  })
  it('inherits session-wide exclusion on addition, not an exclusion of only the first exercise', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0025')
    state.active.entries[0].noProg = true
    chooseWorkoutOption(state, 0, '0009', { add: true })
    expect(state.active.entries[2].noProg).toBeUndefined()
    state.active.noProg = true
    chooseWorkoutOption(state, 0, '0009', { add: true })
    expect(state.active.entries[2].noProg).toBe(true)
  })
  it('updates only the selected saved option and finishes without option snapshots', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0009')
    const entry = state.active.entries[0]
    entry.target.note = 'machine setting'
    expect(routineChangesFromEntry(state.routines[0], state.active.entries, 0)).toBeTruthy()
    updateRoutineFromEntry(state.routines[0], state.active.entries, 0)
    expect(state.routines[0].ex[0].note).toBeUndefined()
    expect(state.routines[0].ex[0].alternatives[0].note).toBe('machine setting')
    entry.sets[0].done = true
    const completed = buildCompletedWorkout(state.active).entries[0]
    expect(completed).toMatchObject({ id: '0009', rid: 'r', slotId: 'slot' })
    expect(completed.choiceOptions).toBeUndefined()
  })
})
