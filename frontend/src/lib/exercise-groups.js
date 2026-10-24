import { uid } from './format.js'
import { defaultConfig } from './history.js'
import { EXIDX } from './exercises.js'
import { optionConfig, cleanGroupName } from './exercise-options.js'
export {
  STATE_VERSION, isGroup, groupOf, migrateExerciseGroups, validateGroupState, validateGroupStart,
  workoutOptions, workoutGroupId, workoutGroupName,
} from '../../../api/coach/core/exercise-groups.js'
import { isGroup, groupOf, validateGroupStart } from '../../../api/coach/core/exercise-groups.js'

export const groupUses = (state, id) => state.routines.flatMap(routine => (routine.ex || [])
  .filter(slot => isGroup(slot) && slot.groupId === id).map(slot => ({ routineId: routine.id, name: routine.name, slotId: slot.slotId })))

export function createExerciseGroup(state, configs = [], name = '') {
  if (new Set(configs.map(config => config.id)).size !== configs.length) throw new Error('This exercise is already an option')
  const group = { id: uid(), name: cleanGroupName(name), options: configs.map(config => ({ id: uid(), exerciseId: config.id })) }
  state.exerciseGroups ||= []
  state.exerciseGroups.push(group)
  return group
}

export function placeExerciseGroup(state, groupId, configs) {
  const group = (state.exerciseGroups || []).find(group => group.id === groupId)
  if (!group || group.archived) throw new Error('This exercise group is not available for reuse.')
  return {
    kind: 'group', slotId: uid(), groupId,
    optionConfigs: Object.fromEntries(group.options.map(option => [option.id, {
      ...optionConfig(configs?.find(config => config.id === option.exerciseId) || defaultConfig(option.exerciseId)),
      id: option.exerciseId,
    }])),
  }
}

export function addGroupOption(state, groupId, exerciseId) {
  const group = (state.exerciseGroups || []).find(group => group.id === groupId)
  if (!group) throw new Error('This exercise group is missing.')
  if (group.options.some(option => option.exerciseId === exerciseId)) throw new Error('This exercise is already an option')
  const option = { id: uid(), exerciseId }
  group.options.push(option)
  for (const routine of state.routines) for (const slot of routine.ex || []) {
    if (!isGroup(slot) || slot.groupId !== groupId) continue
    slot.optionConfigs[option.id] = { ...defaultConfig(exerciseId), id: exerciseId }
  }
  return option
}

export function removeGroupOption(state, groupId, optionId) {
  const group = (state.exerciseGroups || []).find(group => group.id === groupId)
  if (!group) throw new Error('This exercise group is missing.')
  group.options = group.options.filter(option => option.id !== optionId)
}

export function copyPlacementGroup(state, slot) {
  const source = groupOf(state, slot)
  if (!source) throw new Error('This exercise group is missing.')
  const copy = { ...structuredClone(source), id: uid(), archived: false }
  delete copy._ts; delete copy._f; delete copy._u
  state.exerciseGroups.push(copy)
  slot.groupId = copy.id
  return copy
}

export function groupStartOptions(slot, state) {
  return validateGroupStart(slot, state, id => !!EXIDX[id] || (state.customEx || []).some(ex => ex.id === id))
}

export function snapshotGroup(slot, state, routine, instanceId = uid()) {
  const group = groupOf(state, slot)
  const configs = groupStartOptions(slot, state)
  return {
    id: instanceId, groupId: group.id, slotId: slot.slotId, rid: routine.id, name: group.name,
    options: configs.map(config => ({ id: config.optionId, exerciseId: config.id, config: optionConfig(config) })),
    routine: { id: routine.id, ...(routine.prog ? { prog: routine.prog } : {}),
      ...(routine.excludeFromProgression ? { excludeFromProgression: true } : {}) },
  }
}
