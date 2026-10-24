import { describe, expect, it } from 'vitest'
import { buildCombinedEntries } from './session-merge.js'
import {
  addWorkoutChoiceGroup, chooseWorkoutOption, resetWorkoutChoiceGroup, resetWorkoutOption, setWorkoutChoiceGroup,
  workoutChoiceGroupIndices,
} from './workout-options.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { routineChangesFromEntry, updateRoutineFromEntry } from './routines.js'
import { nextUnfinishedUnit, supersetFlowStep } from './supersetFlow.js'
import { setUnitsTotal } from './history.js'
import { migrateExerciseGroups, groupOf, workoutOptions } from './exercise-groups.js'
import { optionsOf } from './exercise-options.js'

const makeState = () => {
  const routines = [{ id: 'r', prog: 'off', ex: [{
    id: '0025', slotId: 'slot', sets: 3, reps: 10, weight: 20, sg: 'pair',
    alternatives: [{ id: '0009', sets: 2, reps: 12, weight: 45 }]
  }, { id: '0031', sets: 3, reps: 8, weight: 30, sg: 'pair' }] }]
  const state = migrateExerciseGroups({ unit: 'kg', workouts: [], routines, exWeights: {} })
  state.active = { id: 'a', entries: buildCombinedEntries(state, ['r']).entries, cur: 0 }
  return state
}

describe('workout choices', () => {
  it('carries a routine group name through reload, selection, added options, reset and finish', () => {
    let state = makeState()
    state.exerciseGroups[0].name = 'Chest options'
    state.active.entries = buildCombinedEntries(state, ['r']).entries
    state = JSON.parse(JSON.stringify(state))
    expect(state.active.entries[0].groupInstance.name).toBe('Chest options')
    expect(state.active.entries[0].groupInstance.id).not.toBe(state.active.entries[0].entryId)
    expect(state.active.entries[0].target.groupName).toBeUndefined()
    expect(workoutOptions(state.active.entries[0]).every(option => !option.groupName)).toBe(true)
    chooseWorkoutOption(state, 0, '0009')
    chooseWorkoutOption(state, 0, '0025', { add: true })
    expect(state.active.entries[0].groupInstance.id).toBe(state.active.entries[2].groupInstance.id)
    expect(state.active.entries[0].groupInstance.name).toBe('Chest options')
    expect(state.active.entries[2].groupInstance.name).toBe('Chest options')
    resetWorkoutOption(state, 0)
    expect(state.active.entries[0].groupInstance.name).toBe('Chest options')
    chooseWorkoutOption(state, 0, '0025')
    state.active.entries[0].sets[0].done = true
    const completed = buildCompletedWorkout(state.active).entries[0]
    expect(completed.groupName).toBe('Chest options')
    expect(completed.choiceGroupId).toBeUndefined()
  })
  it('names workout-only groups without writing to the routine or changing legacy unnamed entries', () => {
    const state = makeState()
    const routines = structuredClone(state.routines)
    const at = addWorkoutChoiceGroup(state, [{ id: '0025', sets: 3 }, { id: '0009', sets: 2 }], '  Upper body  ')
    expect(state.active.entries[at].groupInstance.name).toBe('Upper body')
    expect(state.active.entries[at].groupInstance.id).not.toBe(state.active.entries[at].entryId)
    expect(state.active.entries[0].groupInstance.name).toBe('')
    expect(state.routines).toEqual(routines)
    chooseWorkoutOption(state, at, '0009')
    expect(state.active.entries[at].groupInstance.name).toBe('Upper body')
    expect(state.active.entries[at].target.groupName).toBeUndefined()
  })
  const newOptions = () => [
    { id: '0025', sets: 3, reps: 8, weight: 60, sg: 'must-not-inherit', slotId: 'old' },
    { id: '0009', sets: 2, reps: 12, weight: 25 },
  ]
  it.each(['custom', 'cards', 'list', 'compact', 'focus'])('adds an independent choice slot without splitting a superset (%s)', layout => {
    const state = makeState()
    state.active.workoutView = layout
    const before = structuredClone(state)
    const configs = newOptions()
    const at = addWorkoutChoiceGroup(state, configs)
    expect(at).toBe(2)
    expect(state.active.entries.slice(0, 2)).toEqual(before.active.entries)
    expect(state.routines).toEqual(before.routines)
    const entry = state.active.entries[at]
    expect(entry).toMatchObject({ choicePending: true, sets: [], rid: 'r', groupInstance: { routine: { id: 'r', prog: 'off' } } })
    expect(entry.sg).toBeUndefined()
    expect(entry.target.sg).toBeUndefined()
    expect(entry.slotId).not.toBe('slot')
    expect(entry.slotId).not.toBe('old')
    expect(entry.entryId).not.toBe(before.active.entries[0].entryId)
    configs[1].weight = 999
    expect(workoutOptions(entry)[1].weight).toBe(25)
    chooseWorkoutOption(state, at, '0009')
    expect(state.active.entries[at].sets).toHaveLength(2)
    expect(state.active.entries[at].sets.every(s => s.w === 25 && s.r === 12)).toBe(true)
    expect(routineChangesFromEntry(state.routines[0], state.active.entries, at)).toBeFalsy()
    resetWorkoutOption(state, at)
    expect(state.active.entries[at].choicePending).toBe(true)
  })

  it('works in an empty freestyle editor and saves only the chosen logged option', () => {
    const state = makeState()
    state.active = { id: 'saved-edit', editingWorkoutId: 'saved', entries: [], cur: 0, workoutView: 'custom' }
    addWorkoutChoiceGroup(state, newOptions())
    const entry = state.active.entries[0]
    expect(entry.rid).toBeUndefined()
    expect(entry.choiceRoutine).toBeUndefined()
    expect(buildCompletedWorkout(state.active).entries).toEqual([])
    chooseWorkoutOption(state, 0, '0009')
    state.active.entries[0].sets[0].done = true
    const saved = buildCompletedWorkout(state.active).entries
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ id: '0009', slotId: entry.slotId })
    expect(saved[0].choiceOptions).toBeUndefined()
    expect(saved[0].sets.filter(set => set.done)).toHaveLength(1)
  })

  it.each(['session', 'routine'])('inherits %s progression exclusion without copying a per-exercise exclusion', kind => {
    const state = makeState()
    if (kind === 'session') state.active.noProg = true
    else state.routines[0].excludeFromProgression = true
    addWorkoutChoiceGroup(state, newOptions())
    expect(state.active.entries[2].noProg).toBe(true)
    chooseWorkoutOption(state, 2, '0009')
    expect(state.active.entries[2].noProg).toBe(true)
  })

  it('does not mutate data when a draft is invalid or its workout is gone', () => {
    const state = makeState()
    const before = structuredClone(state)
    expect(() => addWorkoutChoiceGroup(state, [])).toThrow('at least one')
    expect(() => addWorkoutChoiceGroup(state, [newOptions()[0], newOptions()[0]])).toThrow('at least one')
    expect(state).toEqual(before)
    state.active = null
    expect(() => addWorkoutChoiceGroup(state, newOptions())).toThrow('no longer available')
  })
  it('keeps a multi-exercise choice group together and protects logged selections', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0025')
    chooseWorkoutOption(state, 0, '0009', { add: true })
    const groupId = state.active.entries[0].groupInstance.id
    expect(state.active.entries[2].groupInstance.id).toBe(groupId)

    state.active.entries[0].sets[0].done = true
    expect(() => setWorkoutChoiceGroup(state, 0, ['0009'])).toThrow('Logged exercises cannot be removed')
    setWorkoutChoiceGroup(state, 0, ['0025', '0009'])
    expect(state.active.entries.map(entry => entry.id)).toEqual(['0025', '0031', '0009'])
    expect([state.active.entries[0], state.active.entries[2]].map(entry => entry.groupInstance.id)).toEqual([groupId, groupId])
    expect(state.active.entries[0].sets[0].done).toBe(true)

    setWorkoutChoiceGroup(state, 0, ['0025'])
    expect(state.active.entries.map(entry => entry.id)).toEqual(['0025', '0031'])
    expect(state.active.entries[0].sets[0].done).toBe(true)
    expect(() => setWorkoutChoiceGroup(state, 0, [])).toThrow('Choose at least one')
  })
  it('rejoins a non-adjacent member with the original instance identity', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0025')
    const original = state.active.entries[0]
    const groupId = original.groupInstance.id
    chooseWorkoutOption(state, 0, '0009', { add: true })

    expect(state.active.entries[2].groupInstance.id).toBe(groupId)
    expect(workoutChoiceGroupIndices(state.active.entries, 0)).toEqual([0, 2])
    setWorkoutChoiceGroup(state, 0, ['0025', '0009'])
    expect(state.active.entries.map(entry => entry.id)).toEqual(['0025', '0031', '0009'])
    expect([state.active.entries[0], state.active.entries[2]].map(entry => entry.groupInstance.id)).toEqual([groupId, groupId])
  })
  it('groups non-adjacent legacy selections by their routine slot', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0025')
    chooseWorkoutOption(state, 0, '0009', { add: true })
    delete state.active.entries[0].choiceGroupId
    delete state.active.entries[2].choiceGroupId

    expect(workoutChoiceGroupIndices(state.active.entries, 0)).toEqual([0, 2])
    setWorkoutChoiceGroup(state, 0, ['0025', '0009'])
    expect(state.active.entries.map(entry => entry.id)).toEqual(['0025', '0031', '0009'])
  })
  it('keeps separate group occurrences distinct when their group identities differ', () => {
    const state = makeState()
    const first = structuredClone(state.active.entries[0])
    const second = structuredClone(first)
    first.groupInstance.id = 'occurrence-one'
    second.groupInstance.id = 'occurrence-two'
    second.entryId = 'choice-two'
    second.id = '0009'
    state.active.entries = [first, second]

    expect(workoutChoiceGroupIndices(state.active.entries, 0)).toEqual([0])
    expect(workoutChoiceGroupIndices(state.active.entries, 1)).toEqual([1])
  })
  it('changes a grouped option without splitting its existing superset partner', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0025')
    chooseWorkoutOption(state, 0, '0009', { add: true })
    expect(workoutChoiceGroupIndices(state.active.entries, 0)).toEqual([0, 2])

    setWorkoutChoiceGroup(state, 0, ['0009'])
    expect(state.active.entries.map(entry => entry.id)).toEqual(['0009', '0031'])
    expect(state.active.entries[0].sg).toBeTruthy()
    expect(state.active.entries[0].sg).toBe(state.active.entries[1].sg)
    expect(state.active.entries[0].sets).toHaveLength(2)
    expect(state.active.entries[0].groupInstance.id).toBeTruthy()
    expect(state.active.entries[1].groupInstance).toBeUndefined()
  })
  it('clears a selected group back to one pending slot after confirmation', () => {
    const state = makeState()
    state.active.workoutView = 'custom'
    chooseWorkoutOption(state, 0, '0025')
    chooseWorkoutOption(state, 0, '0009', { add: true })
    state.active.entries[2].sets[0].done = true
    resetWorkoutChoiceGroup(state, 0)
    expect(state.active.entries.map(entry => entry.id)).toEqual([undefined, '0031'])
    expect(state.active.entries[0]).toMatchObject({ choicePending: true, groupInstance: { options: expect.any(Array) }, sets: [] })
    expect(state.active.entries[0].groupInstance.id).not.toBe(state.active.entries[0].entryId)
    expect(state.active.cur).toBe(0)
  })

  it.each([false, true])('clears selected sets and restores the original pending slot (logged: %s)', logged => {
    const state = makeState()
    state.active.workoutView = 'custom'
    state.active.cur = 1
    chooseWorkoutOption(state, 0, '0009')
    chooseWorkoutOption(state, 0, '0025', { add: true })
    const entry = state.active.entries[0]
    entry.sets[0].done = logged
    entry.sets[0].w = 99
    entry.note = 'session-only note'
    entry.noProg = true
    entry.target.sgName = 'Pair'
    entry.target.sgRest = 45
    const before = structuredClone(state)
    resetWorkoutOption(state, 0)
    expect(state.active.entries[0]).toMatchObject({
      rid: 'r', slotId: 'slot', sg: 'pair', choicePending: true, sets: [], noProg: true,
      target: { sgName: 'Pair', sgRest: 45 },
      groupInstance: before.active.entries[0].groupInstance,
    })
    expect(state.active.entries[0].id).toBeUndefined()
    expect(state.active.entries[0].entryId).not.toBe(before.active.entries[0].entryId)
    expect(state.active.entries[0].note).toBeUndefined()
    expect(state.active.entries.slice(1)).toEqual(before.active.entries.slice(1))
    expect(state.routines).toEqual(before.routines)
    expect(state.active.cur).toBe(1)
    chooseWorkoutOption(state, 0, '0009')
    expect(state.active.entries[0].sets).toHaveLength(2)
    expect(state.active.entries[0].sets.every(set => set.w === 45 && !set.done)).toBe(true)
  })

  it('rejects resetting pending or missing choices without changing state', () => {
    const state = makeState()
    const before = structuredClone(state)
    expect(() => resetWorkoutOption(state, 0)).toThrow('no longer available')
    expect(() => resetWorkoutOption(state, 1)).toThrow('no longer available')
    expect(state).toEqual(before)
  })

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
    state.routines[0].ex[0].optionConfigs[state.exerciseGroups[0].options[0].id].inc = 2.5
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
    state.routines[0].ex[0].optionConfigs[state.exerciseGroups[0].options[1].id].weight = 90
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
    expect(optionsOf(state.routines[0].ex[0], state)[0].id).toBe('0025')
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
  it('updates only the selected placement config and preserves the historical instance snapshot', () => {
    const state = makeState()
    chooseWorkoutOption(state, 0, '0009')
    const entry = state.active.entries[0]
    entry.target.note = 'machine setting'
    expect(routineChangesFromEntry(state.routines[0], state.active.entries, 0)).toBeTruthy()
    updateRoutineFromEntry(state.routines[0], state.active.entries, 0)
    expect(state.routines[0].ex[0].note).toBeUndefined()
    expect(optionsOf(state.routines[0].ex[0], state)[1].note).toBe('machine setting')
    entry.sets[0].done = true
    const completed = buildCompletedWorkout(state.active).entries[0]
    expect(completed).toMatchObject({ id: '0009', rid: 'r', slotId: 'slot' })
    expect(completed.choiceOptions).toBeUndefined()
    expect(completed.groupInstance.id).toBe(entry.groupInstance.id)
  })
})
