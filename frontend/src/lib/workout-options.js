import { buildPlannedEntry, builtOutOfProgression } from './session-start.js'
import { sessionHistory } from './backfill.js'
import { hasLoggedWork, optionConfig, cleanGroupName } from './exercise-options.js'
import { supersetUnits, unitOf } from './history.js'
import { uid } from './format.js'
import { activeWorkoutLayout } from './workout-layout.js'
import { migrateExerciseGroups, workoutOptions, workoutGroupId } from './exercise-groups.js'
import { EXIDX } from './exercises.js'

function requireAvailableOption(state, id) {
  if (!EXIDX[id] && !(state.customEx || []).some(exercise => exercise.id === id)) {
    throw new Error('An exercise in this group is missing. Update the group before starting.')
  }
}

function normalizeActive(state) {
  if (state.active?.entries.some(entry => entry.choiceOptions && !entry.groupInstance)) {
    state.active = migrateExerciseGroups(state).active
  }
}

export function addWorkoutChoiceGroup(state, configs, name) {
  const active = state.active
  if (!active) throw new Error('This workout is no longer available')
  if (!configs.length || configs.some(cfg => !cfg.id) || new Set(configs.map(cfg => cfg.id)).size !== configs.length) {
    throw new Error('A group needs at least one different exercise option')
  }
  configs.forEach(config => requireAvailableOption(state, config.id))
  const jay = activeWorkoutLayout(state) === 'custom'
  const source = jay ? active.entries.at(-1) : active.entries[active.cur]
  const routine = state.routines.find(r => r.id === source?.rid)
  const noProg = active.noProg === true || routine?.excludeFromProgression === true
  const slotId = uid()
  const instance = {
    id: uid(), slotId, name: cleanGroupName(name),
    ...(source?.rid ? { rid: source.rid } : {}),
    options: configs.map(config => ({
      id: uid(), exerciseId: config.id, config: optionConfig(config),
      prescription: buildPlannedEntry(sessionHistory(state), config, routine, { noProg }),
    })),
    ...(routine ? { routine: {
      id: routine.id, ...(routine.prog ? { prog: routine.prog } : {}),
      ...(routine.excludeFromProgression ? { excludeFromProgression: true } : {}),
    } } : {}),
  }
  const at = jay || !active.entries.length ? active.entries.length
    : unitOf(supersetUnits(active.entries), active.cur).at(-1) + 1
  active.entries.splice(at, 0, {
    entryId: uid(), slotId, groupInstance: instance, target: {}, choicePending: true, sets: [],
    ...(source?.rid ? { rid: source.rid } : {}), ...(noProg ? { noProg: true } : {}),
  })
  if (!jay) active.cur = at
  return at
}

function buildOptionEntry(state, entry, config, { add = false } = {}) {
  requireAvailableOption(state, config.id)
  const instance = entry.groupInstance
  if (!instance || !instance.options.some(option => option.id === config.optionId && option.exerciseId === config.id)) {
    throw new Error('This exercise option is no longer available')
  }
  const routine = instance.routine
  const noProg = add ? state.active.noProg === true || routine?.excludeFromProgression === true : entry.noProg === true
  const frozen = instance.options.find(option => option.id === config.optionId)
  const built = frozen.prescription ? structuredClone(frozen.prescription)
    : buildPlannedEntry(sessionHistory(state), config, routine, { noProg: builtOutOfProgression({ noProg }, routine) })
  const next = {
    id: config.id, ...built, entryId: add ? uid() : entry.entryId,
    groupInstance: instance, optionId: config.optionId,
    ...(entry.rid ? { rid: entry.rid } : {}), ...(entry.slotId ? { slotId: entry.slotId } : {}),
    ...(noProg ? { noProg: true } : {}), ...(!add && entry.sg ? { sg: entry.sg } : {}),
  }
  if (!add && entry.sg) {
    for (const key of ['sg', 'sgName', 'sgRest']) {
      const value = entry[key] ?? entry.target?.[key]
      if (value != null) { next.target[key] = value; if (key !== 'sg') next[key] = value }
    }
  }
  return next
}

export function workoutChoiceGroupIndices(entries, index) {
  const entry = entries?.[index]
  const id = workoutGroupId(entry)
  if (!id) return []
  return entries.flatMap((candidate, i) => workoutGroupId(candidate) === id ? [i] : [])
}

export function setWorkoutChoiceGroup(state, index, exerciseIds) {
  normalizeActive(state)
  const active = state.active
  if (!active) throw new Error('This workout is no longer available')
  const indices = workoutChoiceGroupIndices(active.entries, index)
  const current = indices.map(i => active.entries[i])
  const first = current[0]
  if (!first || first.choicePending) throw new Error('This exercise selection is no longer available')
  const options = workoutOptions(first)
  if (!Array.isArray(exerciseIds) || !exerciseIds.length || new Set(exerciseIds).size !== exerciseIds.length
    || exerciseIds.some(id => !options.some(option => option.id === id))) throw new Error('Choose at least one different exercise option')
  const selected = new Set(exerciseIds)
  exerciseIds.forEach(id => requireAvailableOption(state, id))
  if (current.some(entry => hasLoggedWork(entry) && !selected.has(entry.id))) throw new Error('Logged exercises cannot be removed')
  if (current.every(entry => selected.has(entry.id)) && [...selected].every(id => current.some(entry => entry.id === id))) return false

  // The execution anchor owns this placement's superset relationship, not a preferred option.
  const anchor = current.find(entry => entry.sg) || first
  const anchorIndex = active.entries.indexOf(anchor)
  const keptAnchor = selected.has(anchor.id) ? anchor : current.find(entry => selected.has(entry.id))
  const nextAnchor = keptAnchor || buildOptionEntry(state, anchor, options.find(option => option.id === exerciseIds[0]))
  if (nextAnchor !== anchor) {
    for (const key of ['sg', 'sgName', 'sgRest']) {
      const value = anchor[key] ?? anchor.target?.[key]
      if (value != null) { nextAnchor[key] = value; nextAnchor.target[key] = value }
    }
  }
  const oldCurrent = active.entries[active.cur]
  const members = new Set(indices)
  const rebuilt = active.entries.flatMap((entry, i) => {
    if (i === anchorIndex) return [nextAnchor]
    if (!members.has(i)) return [entry]
    return entry !== nextAnchor && selected.has(entry.id) ? [entry] : []
  })
  const present = new Set(current.filter(entry => selected.has(entry.id)).map(entry => entry.id))
  present.add(nextAnchor.id)
  const additions = options.filter(option => selected.has(option.id) && !present.has(option.id))
    .map(option => buildOptionEntry(state, anchor, option, { add: true }))
  active.entries.splice(0, active.entries.length, ...rebuilt)
  const lastIndex = workoutChoiceGroupIndices(active.entries, active.entries.indexOf(nextAnchor)).at(-1)
  const lastUnit = unitOf(supersetUnits(active.entries), lastIndex)
  active.entries.splice(lastUnit.at(-1) + 1, 0, ...additions)
  const at = active.entries.indexOf(oldCurrent)
  active.cur = at >= 0 ? at : active.entries.indexOf(nextAnchor)
  return true
}

function pendingFrom(entry) {
  const meta = Object.fromEntries(['sg', 'sgName', 'sgRest'].map(key => [key, entry[key] ?? entry.target?.[key]]).filter(([, value]) => value != null))
  return { entryId: uid(), groupInstance: entry.groupInstance, ...meta, target: { ...meta }, sets: [], choicePending: true,
    ...(entry.rid ? { rid: entry.rid } : {}), ...(entry.slotId ? { slotId: entry.slotId } : {}),
    ...(entry.noProg ? { noProg: true } : {}) }
}

export function resetWorkoutOption(state, index) {
  normalizeActive(state)
  const entry = state.active?.entries[index]
  if (!entry?.groupInstance || entry.choicePending) throw new Error('This exercise selection is no longer available')
  state.active.entries[index] = pendingFrom(entry)
}

export function resetWorkoutChoiceGroup(state, index) {
  normalizeActive(state)
  const active = state.active
  if (!active) throw new Error('This workout is no longer available')
  const indices = workoutChoiceGroupIndices(active.entries, index)
  const current = indices.map(i => active.entries[i])
  const entry = current.find(entry => entry.sg) || current[0]
  if (!entry?.groupInstance || entry.choicePending) throw new Error('This exercise selection is no longer available')
  const oldCurrent = active.entries[active.cur]
  const at = indices[0]
  for (const i of indices.slice().reverse()) active.entries.splice(i, 1)
  active.entries.splice(at, 0, pendingFrom(entry))
  const currentIndex = active.entries.indexOf(oldCurrent)
  active.cur = currentIndex >= 0 ? currentIndex : at
  return at
}

export function chooseWorkoutOption(state, index, exerciseId, { add = false } = {}) {
  normalizeActive(state)
  const active = state.active
  const entry = active?.entries[index]
  const config = workoutOptions(entry)?.find(option => option.id === exerciseId)
  if (!config) throw new Error('This exercise option is no longer available')
  if (!add && hasLoggedWork(entry)) throw new Error('Logged exercises cannot be swapped')
  if (add && entry.choicePending) throw new Error('Choose an exercise first')
  const next = buildOptionEntry(state, entry, config, { add })
  const at = add ? unitOf(supersetUnits(active.entries), index).at(-1) + 1 : index
  if (add) active.entries.splice(at, 0, next)
  else active.entries[index] = next
  if (activeWorkoutLayout(state) !== 'custom') active.cur = at
  else if (add && at <= active.cur) active.cur++
  return at
}
