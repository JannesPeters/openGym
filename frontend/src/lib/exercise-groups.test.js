import { describe, expect, it } from 'vitest'
import {
  createExerciseGroup, placeExerciseGroup, addGroupOption, removeGroupOption, copyPlacementGroup,
  migrateExerciseGroups, validateGroupState, groupOf, workoutOptions,
} from './exercise-groups.js'
import { optionsOf } from './exercise-options.js'
import { copyRoutine, routineChangesFromEntry, routineSlotIndex } from './routines.js'
import { buildCombinedEntries } from './session-merge.js'
import { chooseWorkoutOption, setWorkoutChoiceGroup, resetWorkoutChoiceGroup } from './workout-options.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { buildPlanBundle, parsePlan, mergePlan, planPrintHTML } from './plan-share.js'
import { mergeStates, stampChange, resetIdsOf, sinceReset, stampReplace } from './sync-merge.js'
import { convertStateUnit } from './units.js'
import { syncFingerprint, countChanges } from './sync-changes.js'
import { canonicalPlan, hashPlan, applyChangeSet, currentValue, revertLast } from './coach.js'
import { canonicalPlan as serverPlan, cleanPlan } from '../../../api/coach/core/payload.js'
import { hashPlan as serverHash } from '../../../api/coach/core/plan-hash.js'
import { validateReview } from '../../../api/coach/core/validate.js'
import { EXIDX, canonicalExId } from './exercises.js'

const legacy = () => ({
  unit: 'kg', workouts: [], exWeights: {}, week: {}, customEx: [
    { id: 'variant', baseExerciseId: '0025', variantLabel: 'Pause', n: 'Pause bench', bp: 'chest', custom: true },
  ],
  routines: [{ id: 'heavy', name: 'Heavy', prog: 'off', ex: [{
    id: '0025', slotId: 'slot', groupName: 'Press', sets: 3, reps: 5, weight: 60,
    sg: 'ss', sgName: 'Round', sgRest: 50,
    alternatives: [{ id: 'variant', sets: 2, reps: 8, weight: 40, restSec: 75 }],
  }, { id: '0289', sg: 'ss', sets: 2, reps: 10, weight: 20 }] }],
})
const reusable = () => {
  const state = migrateExerciseGroups(legacy())
  const group = state.exerciseGroups[0]
  state.routines.push({ id: 'light', name: 'Light', prog: 'off', ex: [placeExerciseGroup(state, group.id)] })
  state.routines[0].ex.push(placeExerciseGroup(state, group.id))
  return state
}
const start = state => {
  state.active = { id: 'session', cur: 0, ...buildCombinedEntries(state, ['heavy', 'light']) }
  delete state.active.routines
  return state
}

describe('reusable exercise groups', () => {
  it('migrates all options symmetrically with deterministic, stable identities and no input mutation', () => {
    const old = legacy(), original = structuredClone(old)
    const state = migrateExerciseGroups(old)
    expect(old).toEqual(original)
    expect(state.stateVersion).toBe(2)
    expect(migrateExerciseGroups(state)).toBe(state)
    expect(migrateExerciseGroups(JSON.parse(JSON.stringify(old)))).toEqual(state)
    const slot = state.routines[0].ex[0], group = groupOf(state, slot)
    expect(slot).toMatchObject({ kind: 'group', slotId: 'slot', sg: 'ss', sgName: 'Round', sgRest: 50 })
    expect(slot).not.toHaveProperty('id')
    expect(slot).not.toHaveProperty('alternatives')
    expect(group.options.map(option => option.exerciseId)).toEqual(['0025', 'variant'])
    expect(optionsOf(slot, state)).toMatchObject([{ id: '0025', sets: 3, weight: 60 }, { id: 'variant', sets: 2, weight: 40, restSec: 75 }])
    const duplicate = legacy()
    duplicate.routines.push({ ...structuredClone(duplicate.routines[0]), id: 'other' })
    expect(migrateExerciseGroups(duplicate).exerciseGroups).toHaveLength(2)
  })
  it('reuses membership and names across routines/repeated placements without sharing prescriptions', () => {
    const state = reusable(), group = state.exerciseGroups[0]
    const heavy = state.routines[0].ex[0], repeated = state.routines[0].ex[2], light = state.routines[1].ex[0]
    expect(new Set([heavy, repeated, light].map(slot => slot.groupId)).size).toBe(1)
    expect(new Set([heavy, repeated, light].map(slot => slot.slotId)).size).toBe(3)
    light.optionConfigs[group.options[0].id].weight = 10
    expect(heavy.optionConfigs[group.options[0].id].weight).toBe(60)
    group.name = 'Renamed'
    group.options.reverse()
    for (const slot of [heavy, repeated, light]) {
      expect(groupOf(state, slot).name).toBe('Renamed')
      expect(optionsOf(slot, state).map(config => config.id)).toEqual(['variant', '0025'])
    }
    const removed = group.options[0].id
    removeGroupOption(state, group.id, removed)
    expect(optionsOf(heavy, state)).toMatchObject([{ id: '0025', weight: 60 }])
    expect(heavy.optionConfigs[removed].weight).toBe(40)
    const added = addGroupOption(state, group.id, 'variant')
    expect(added.id).not.toBe(removed)
    expect(heavy.optionConfigs[added.id].weight).not.toBe(60)
    expect(light.optionConfigs[group.options[0].id].weight).toBe(10)
  })
  it('keeps draft/one-option identity, validates setup/start, archives safely and copies independently', () => {
    const state = reusable(), group = state.exerciseGroups[0], slot = state.routines[1].ex[0]
    const copy = copyPlacementGroup(state, slot)
    expect(copy.id).not.toBe(group.id)
    copy.name = 'Independent'
    expect(group.name).toBe('Press')
    group.archived = true
    expect(() => placeExerciseGroup(state, group.id)).toThrow('not available')
    expect(() => buildCombinedEntries(state, ['heavy'])).not.toThrow()
    const duplicate = copyRoutine(state.routines[0])
    expect(duplicate.ex[0].groupId).toBe(group.id)
    expect(duplicate.ex[0].slotId).not.toBe('slot')
    removeGroupOption(state, copy.id, copy.options[0].id)
    expect(slot.kind).toBe('group')
    expect(optionsOf(slot, state)).toHaveLength(1)
    removeGroupOption(state, copy.id, copy.options[0].id)
    expect(validateGroupState(state)).toBe(state)
    expect(() => buildCombinedEntries(state, ['light'])).toThrow('empty')
    const draft = createExerciseGroup(state)
    expect(draft.options).toEqual([])
    addGroupOption(state, copy.id, '0025')
    delete slot.optionConfigs[copy.options[0].id]
    expect(() => buildCombinedEntries(state, ['light'])).toThrow('settings configured')
    slot.optionConfigs[copy.options[0].id] = { id: 'missing', sets: 3 }
    expect(() => buildCombinedEntries(state, ['light'])).toThrow('settings configured')
  })
  it('rejects an unresolved snapshot option at selection without changing its sets or identity', () => {
    const state = start(reusable())
    state.customEx = []
    const before = structuredClone(state)
    expect(() => chooseWorkoutOption(state, 0, 'variant')).toThrow('missing')
    expect(state).toEqual(before)
    chooseWorkoutOption(state, 0, '0025')
    const selected = structuredClone(state)
    expect(() => setWorkoutChoiceGroup(state, 0, ['0025', 'variant'])).toThrow('missing')
    expect(state).toEqual(selected)
  })
  it('snapshots repeated/combined uses, explicit selection and history independently from shared edits', () => {
    const state = start(reusable())
    const pending = state.active.entries.filter(entry => entry.groupInstance)
    expect(routineSlotIndex(state.routines[0], state.active.entries, 0)).toBe(-1)
    expect(routineChangesFromEntry(state.routines[0], state.active.entries, 0)).toBeNull()
    expect(new Set(pending.map(entry => entry.groupInstance.id)).size).toBe(3)
    expect(pending.every(entry => entry.id == null && !entry.optionId && !entry.sets.length)).toBe(true)
    const snapshot = structuredClone(pending[0].groupInstance)
    state.exerciseGroups[0].name = 'Changed after start'
    state.exerciseGroups[0].options.reverse()
    state.routines[0].ex[0].optionConfigs[snapshot.options[0].id].weight = 1
    chooseWorkoutOption(state, 0, 'variant')
    expect(state.active.entries[0]).toMatchObject({ id: 'variant', target: { weight: 40 }, optionId: snapshot.options[1].id, sg: 'ss' })
    state.active.entries[0].sets[0].done = true
    setWorkoutChoiceGroup(state, 0, ['0025', 'variant'])
    expect(state.active.entries[0].sets[0].done).toBe(true)
    expect(state.active.entries[0].groupInstance).toEqual(snapshot)
    expect(state.active.entries[1].id).toBe('0289')
    expect(state.active.entries[2].id).toBe('0025')
    expect(state.active.entries[2].sg).toBeUndefined()
    expect(() => setWorkoutChoiceGroup(state, 0, ['0025'])).toThrow('Logged')
    const completed = buildCompletedWorkout(state.active)
    expect(completed.entries[0].groupInstance).toEqual(snapshot)
    expect(completed.entries[0].id).toBe('variant')
    const instanceId = state.active.entries[0].groupInstance.id
    resetWorkoutChoiceGroup(state, 0)
    expect(state.active.entries[0].groupInstance.id).toBe(instanceId)
    expect(state.active.entries[0].id).toBeUndefined()
    expect(state.active.entries[0].sets).toEqual([])
    expect(completed.entries[0].sets[0].done).toBe(true)
  })
  it('preserves already active snapshots, selected sets and old history without inventing provenance', () => {
    const state = legacy()
    const options = [{ id: '0025', sets: 4, reps: 9, weight: 33 }, { id: 'variant', sets: 1, reps: 3, weight: 9 }]
    state.active = { id: 'old', entries: [
      { id: 'variant', rid: 'heavy', slotId: 'slot', choiceId: 'selected', choiceGroupId: 'instance', groupName: 'Old name',
        choiceOptions: options, target: options[1], sets: [{ w: 9, r: 3, done: true }] },
      { id: '0025', rid: 'heavy', slotId: 'slot', choiceId: 'another', choiceGroupId: 'instance', groupName: 'Old name',
        choiceOptions: options, target: options[0], sets: [{ w: 33, r: 9, done: false }] },
    ] }
    state.workouts = [{ id: 'history', entries: [{ id: 'variant', groupName: 'Past name', sets: [{ w: 50, r: 8, done: true }] }] }]
    const migrated = migrateExerciseGroups(state)
    expect(migrated.active.entries[0]).toMatchObject({ id: 'variant', entryId: 'selected', groupInstance: { id: 'instance', name: 'Old name' } })
    expect(migrated.active.entries[0].sets).toEqual(state.active.entries[0].sets)
    expect(workoutOptions(migrated.active.entries[0])).toMatchObject([{ weight: 33 }, { weight: 9 }])
    expect(migrated.workouts).toEqual(state.workouts)
    expect(migrateExerciseGroups(migrated)).toBe(migrated)
    const older = structuredClone(state)
    older.active.entries.forEach(entry => { delete entry.choiceGroupId })
    const upgraded = migrateExerciseGroups(older)
    expect(upgraded.active.entries[0].groupInstance.id).toBe(upgraded.active.entries[1].groupInstance.id)
    const detached = structuredClone(state)
    detached.routines = []
    expect(migrateExerciseGroups(detached).active.entries[0].groupInstance).toMatchObject({ rid: 'heavy', routine: { id: 'heavy' } })
  })
  it('archives a definition when an offline new routine survives a reset that removed its former use', () => {
    const base = migrateExerciseGroups(legacy())
    const offline = structuredClone(base)
    offline.routines.push({ id: 'new-offline-routine', name: 'Offline', ex: [placeExerciseGroup(offline, base.exerciseGroups[0].id)] })
    stampChange(base, offline, 100)
    const reset = { stateVersion: 2, exerciseGroups: [], routines: [], workouts: [], resetAt: 200, resetIds: resetIdsOf(base) }
    const merged = mergeStates(reset, offline)
    expect(merged.routines.map(routine => routine.id)).toEqual(['new-offline-routine'])
    expect(merged.exerciseGroups[0].archived).toBe(true)
    expect(() => validateGroupState(merged)).not.toThrow()
    expect(() => buildCombinedEntries(merged, ['new-offline-routine'])).not.toThrow()
  })
  it('round trips full and shared data, retains reuse/variants, prints every equal option and rejects unsupported versions', () => {
    const state = reusable()
    const bundle = buildPlanBundle(state)
    expect(bundle.opengym_plan).toBe(3)
    expect(bundle.exerciseGroups).toHaveLength(1)
    const parsed = parsePlan(JSON.stringify(bundle), 'lb')
    const recipient = { unit: 'lb', routines: [], customEx: [], week: {}, workouts: [] }
    mergePlan(recipient, parsed)
    expect(recipient.exerciseGroups).toHaveLength(1)
    expect(recipient.routines[0].ex[0].groupId).toBe(recipient.routines[1].ex[0].groupId)
    expect(recipient.routines[0].ex[0].groupId).not.toBe(state.exerciseGroups[0].id)
    const variantId = recipient.customEx[0].id
    expect(recipient.customEx[0].baseExerciseId).toBe('0025')
    expect(optionsOf(recipient.routines[0].ex[0], recipient)).toMatchObject([{ weight: 132.5 }, { id: variantId, weight: 88 }])
    expect(planPrintHTML(state)).toContain('Press')
    expect(planPrintHTML(state)).not.toContain('undefined')
    expect(() => migrateExerciseGroups({ ...state, stateVersion: 999 })).toThrow('newer version')
    bundle.exerciseGroups[0].options[0].exerciseId = 'missing'
    expect(() => parsePlan(bundle)).toThrow('missing')
    expect(migrateExerciseGroups(JSON.parse(JSON.stringify(state)))).toEqual(state)
    const alias = Object.getOwnPropertyNames(EXIDX).find(id => canonicalExId(id) !== id)
    expect(alias).toBeDefined()
    const drawings = { unit: 'kg', routines: [], week: {}, customEx: [] }
    const definition = createExerciseGroup(drawings, [{ id: alias, sets: 3, reps: 8, weight: 40 }], 'Drawing reference')
    drawings.routines.push({ id: 'drawing-routine', ex: [placeExerciseGroup(drawings, definition.id, [{ id: alias, sets: 3, reps: 8, weight: 40 }])] })
    const imported = parsePlan(buildPlanBundle(drawings))
    expect(imported.exerciseGroups[0].options[0].exerciseId).toBe(canonicalExId(alias))
    expect(optionsOf(imported.routines[0].ex[0], imported)[0]).toMatchObject({ id: canonicalExId(alias), weight: 40 })
    expect(optionsOf(imported.routines[0].ex[0], imported)[0].needsConfig).toBeUndefined()
  })
  it('stamps/merges definitions independently of routine settings and includes them in resets/replacements/counts', () => {
    const base = reusable(), left = structuredClone(base), right = structuredClone(base)
    left.exerciseGroups[0].name = 'Left'
    stampChange(base, left, 100)
    const oid = right.exerciseGroups[0].options[0].id
    right.routines[1].ex[0].optionConfigs[oid].weight = 12
    stampChange(base, right, 200)
    const merged = mergeStates(left, right)
    expect(merged.exerciseGroups[0].name).toBe('Left')
    expect(merged.routines[1].ex[0].optionConfigs[oid].weight).toBe(12)
    expect(countChanges(left, syncFingerprint(base))).toBeGreaterThan(0)
    const ids = resetIdsOf(base)
    expect(ids.exerciseGroups).toContain(base.exerciseGroups[0].id)
    expect(sinceReset(base, 500, ids).exerciseGroups).toEqual([])
    const empty = { stateVersion: 2, exerciseGroups: [], routines: [], workouts: [] }
    stampReplace(empty, [left], 500)
    expect(empty.deleted.exerciseGroups[left.exerciseGroups[0].id]).toBe(500)
    expect(mergeStates(empty, left).exerciseGroups).toEqual([])
    const converted = convertStateUnit(start(base), 'lb')
    expect(converted.active.entries[0].groupInstance.options[0].config.weight).toBe(132.5)
    expect(optionsOf(converted.routines[0].ex[0], converted)[0].weight).toBe(132.5)
  })
  it('keeps Coach group plans/hashes equal and only allows unambiguous placement-specific config changes', () => {
    const state = reusable()
    const plan = canonicalPlan(state)
    expect(plan).toEqual(serverPlan(state))
    expect(hashPlan(plan)).toBe(serverHash(serverPlan(state)))
    const cleaned = cleanPlan(state)
    const grouped = cleaned.routines[0].ex[0]
    expect(grouped).not.toHaveProperty('id')
    expect(grouped.options.map(option => option.id)).toEqual(['0025', 'variant'])
    const change = { id: 'c', type: 'sets', target: { routineId: 'light', exId: '0025' }, before: 3, after: 4, why: 'Adjust this routine only.' }
    const checked = validateReview({ changes: [change] }, cleaned)
    expect(checked.ok).toBe(true)
    expect(currentValue(state, change)).toBe(3)
    applyChangeSet(state, { id: 'proposal', kind: 'review', changes: checked.proposal.changes }, ['c'])
    expect(optionsOf(state.routines[1].ex[0], state)[0].sets).toBe(4)
    expect(optionsOf(state.routines[0].ex[0], state)[0].sets).toBe(3)
    expect(validateReview({ changes: [{ ...change, target: { routineId: 'heavy', exId: '0025' } }] }, cleaned).ok).toBe(false)
    expect(validateReview({ changes: [{ ...change, type: 'remove-exercise', after: null }] }, cleaned).ok).toBe(false)
    expect(hashPlan(canonicalPlan(state))).not.toBe(hashPlan(plan))
  })
  it('migrates legacy Coach undo snapshots in their own namespace before they can write a plan', () => {
    const old = legacy()
    old.coach = { snapshots: [{ routines: structuredClone(old.routines), week: {}, label: 'Before' }], log: [] }
    old.routines[0].ex[0].groupName = 'Live name'
    const state = migrateExerciseGroups(old)
    expect(state.coach.snapshots[0].routines[0].ex[0].kind).toBe('group')
    expect(state.coach.snapshots[0].exerciseGroups[0].name).toBe('Press')
    expect(state.exerciseGroups[0].name).toBe('Live name')
    expect(revertLast(state)).toBe(true)
    expect(validateGroupState(state)).toBe(state)
    expect(state.exerciseGroups[0].name).toBe('Press')
    expect(migrateExerciseGroups(state)).toBe(state)
    expect(() => validateGroupState({
      stateVersion: 2, routines: [], exerciseGroups: [],
      coach: { snapshots: [{ routines: [{ id: 'old', ex: [{ kind: 'group', slotId: 's', groupId: 'missing', optionConfigs: {} }] }] }] },
    })).toThrow('missing definition')
  })
})
