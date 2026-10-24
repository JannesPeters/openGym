import { buildPlannedEntry, builtOutOfProgression } from './session-start.js'
import { sessionHistory } from './backfill.js'
import { hasLoggedWork, optionConfig, cleanGroupName } from './exercise-options.js'
import { supersetUnits, unitOf } from './history.js'
import { uid } from './format.js'
import { activeWorkoutLayout } from './workout-layout.js'

export function addWorkoutChoiceGroup(state, configs, name) {
  const active = state.active
  if (!active) throw new Error('This workout is no longer available')
  if (configs.length < 2 || configs.some(cfg => !cfg.id) || new Set(configs.map(cfg => cfg.id)).size !== configs.length) {
    throw new Error('A new group needs at least two different exercise options')
  }
  const jay = activeWorkoutLayout(state) === 'custom'
  const source = jay ? active.entries.at(-1) : active.entries[active.cur]
  const routine = state.routines.find(r => r.id === source?.rid)
  const noProg = active.noProg === true || routine?.excludeFromProgression === true
  const choiceId = uid()
  const entry = {
    slotId: uid(), choiceId, choiceGroupId: choiceId,
    ...(cleanGroupName(name) ? { groupName: cleanGroupName(name) } : {}),
    choiceOptions: structuredClone(configs.map(optionConfig)),
    ...(source?.rid ? { rid: source.rid } : {}),
    ...(routine ? { choiceRoutine: {
      id: routine.id, ...(routine.prog ? { prog: routine.prog } : {}),
      ...(routine.excludeFromProgression ? { excludeFromProgression: true } : {}),
    } } : {}),
    ...(noProg ? { noProg: true } : {}),
  }
  const at = jay || !active.entries.length ? active.entries.length
    : unitOf(supersetUnits(active.entries), active.cur).at(-1) + 1
  active.entries.splice(at, 0, {
    ...buildOptionEntry(state, entry, entry.choiceOptions[0]),
    choicePending: true, sets: [],
  })
  if (!jay) active.cur = at
  return at
}

function buildOptionEntry(state, entry, config, { add = false } = {}) {
  const active = state.active
  const routine = entry.choiceRoutine || state.routines.find(r => r.id === entry.rid)
  const noProg = add ? active.noProg === true || routine?.excludeFromProgression === true : entry.noProg === true
  const built = buildPlannedEntry(sessionHistory(state), config, routine, { noProg: builtOutOfProgression({ noProg }, routine) })
  const next = {
    id: config.id, ...built,
    ...(entry.rid ? { rid: entry.rid } : {}),
    ...(entry.slotId ? { slotId: entry.slotId } : {}),
    ...(cleanGroupName(entry.groupName) ? { groupName: cleanGroupName(entry.groupName) } : {}),
    choiceOptions: entry.choiceOptions,
    ...(entry.choiceRoutine ? { choiceRoutine: entry.choiceRoutine } : {}),
    choiceId: add ? uid() : entry.choiceId,
    choiceGroupId: entry.choiceGroupId || entry.choiceId,
    ...(noProg ? { noProg: true } : {}),
    ...(!add && entry.sg ? { sg: entry.sg } : {})
  }
  if (!add && entry.sg) {
    for (const key of ['sg', 'sgName', 'sgRest']) if (entry.target?.[key] != null) next.target[key] = entry.target[key]
  }
  return next
}

export function workoutChoiceGroupIndices(entries, index) {
  const entry = entries?.[index]
  if (!entry?.choiceOptions) return []
  const sameLegacyChoice = candidate => candidate?.choiceOptions
    && candidate.slotId === entry.slotId
    && cleanGroupName(candidate.groupName) === cleanGroupName(entry.groupName)
    && candidate.choiceOptions.map(option => option.id).join('|') === entry.choiceOptions.map(option => option.id).join('|')
  const membersOf = groupId => entries.flatMap((candidate, i) =>
    candidate?.choiceGroupId === groupId
      || (!candidate?.choiceGroupId && candidate?.choiceId === groupId && sameLegacyChoice(candidate))
      ? [i] : [])

  if (entry.choiceGroupId) return membersOf(entry.choiceGroupId)
  if (entry.choiceId && entries.some(candidate =>
    candidate?.choiceGroupId === entry.choiceId && sameLegacyChoice(candidate))) {
    return membersOf(entry.choiceId)
  }

  const sameLegacyGroup = candidate => !candidate?.choiceGroupId && sameLegacyChoice(candidate)
  const legacyMembers = entries.flatMap((candidate, i) => sameLegacyGroup(candidate) ? [i] : [])
  if (entry.slotId && legacyMembers.length > 1) return legacyMembers

  let first = index
  let last = index
  while (first > 0 && sameLegacyGroup(entries[first - 1])) first--
  while (last + 1 < entries.length && sameLegacyGroup(entries[last + 1])) last++
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset)
}

export function setWorkoutChoiceGroup(state, index, exerciseIds) {
  const active = state.active
  if (!active) throw new Error('This workout is no longer available')
  const indices = workoutChoiceGroupIndices(active.entries, index)
  const current = indices.map(i => active.entries[i])
  const first = current[0]
  if (!first || first.choicePending) throw new Error('This exercise selection is no longer available')
  const options = first.choiceOptions
  if (!Array.isArray(exerciseIds) || !exerciseIds.length
    || new Set(exerciseIds).size !== exerciseIds.length
    || exerciseIds.some(id => !options.some(option => option.id === id))) {
    throw new Error('Choose at least one different exercise option')
  }

  const selected = new Set(exerciseIds)
  if (current.some(entry => hasLoggedWork(entry) && !selected.has(entry.id))) {
    throw new Error('Logged exercises cannot be removed')
  }
  const groupId = first.choiceGroupId || first.choiceId || first.slotId || uid()
  const unchanged = current.every(entry => selected.has(entry.id))
    && [...selected].every(id => current.some(entry => entry.id === id))
  if (unchanged) {
    current.forEach(entry => { entry.choiceGroupId = groupId })
    return false
  }

  const primaryIndex = indices.find(index => active.entries[index].choiceId === groupId) ?? indices[0]
  const primary = active.entries[primaryIndex]
  const primaryId = primary.id
  const selectedCurrent = indices.map(index => active.entries[index]).filter(entry => selected.has(entry.id))
  const replacement = !selected.has(primaryId)
    ? selectedCurrent.find(entry => entry !== primary && !entry.sg)
    : null
  const replacementIndex = replacement ? active.entries.indexOf(replacement) : -1
  const primaryOptionId = selected.has(primaryId) ? primaryId : replacement?.id ?? exerciseIds[0]
  const primaryConfig = options.find(option => option.id === primaryOptionId)
  const primaryEntry = replacement || (selected.has(primaryId) && primary) || buildOptionEntry(state, primary, primaryConfig)
  if (replacement) {
    const sg = primary.sg ?? primary.target?.sg
    if (sg != null) primaryEntry.sg = sg
    else delete primaryEntry.sg
    for (const key of ['sgName', 'sgRest']) {
      const value = primary[key] ?? primary.target?.[key]
      if (value != null) primaryEntry[key] = value
      else delete primaryEntry[key]
      if (value != null) primaryEntry.target[key] = value
      else delete primaryEntry.target[key]
    }
  }
  primaryEntry.choiceGroupId = groupId

  const currentEntry = active.entries[active.cur]
  const groupIndicesSet = new Set(indices)
  const retained = current.filter(entry => selected.has(entry.id) && entry !== primaryEntry)
  retained.forEach(entry => { entry.choiceGroupId = groupId })
  const rebuilt = []
  for (let i = 0; i < active.entries.length; i++) {
    if (i === primaryIndex) {
      rebuilt.push(primaryEntry)
      continue
    }
    if (groupIndicesSet.has(i)) {
      const candidate = active.entries[i]
      if (i !== replacementIndex && selected.has(candidate.id)) rebuilt.push(candidate)
      continue
    }
    rebuilt.push(active.entries[i])
  }

  const presentIds = new Set([primaryEntry, ...retained].map(entry => entry.id))
  const additions = options
    .filter(option => selected.has(option.id) && !presentIds.has(option.id))
    .map(option => ({
      ...buildOptionEntry(state, primary, option, { add: true }),
      choiceGroupId: groupId,
    }))
  active.entries.splice(0, active.entries.length, ...rebuilt)
  const retainedIndices = active.entries.flatMap((candidate, i) =>
    candidate.choiceGroupId === groupId ? [i] : [])
  const lastGroupIndex = retainedIndices.at(-1)
  if (additions.length && lastGroupIndex != null) {
    const lastUnit = unitOf(supersetUnits(active.entries), lastGroupIndex)
    active.entries.splice(lastUnit.at(-1) + 1, 0, ...additions)
  }

  const currentIndex = currentEntry ? active.entries.indexOf(currentEntry) : -1
  if (currentIndex >= 0) active.cur = currentIndex
  else active.cur = active.entries.findIndex(entry => entry.choiceGroupId === groupId)
  return true
}

export function resetWorkoutOption(state, index) {
  const entry = state.active?.entries?.[index]
  const config = entry?.choiceOptions?.[0]
  if (!config || entry.choicePending) throw new Error('This exercise selection is no longer available')
  state.active.entries[index] = {
    ...buildOptionEntry(state, entry, config),
    choiceId: uid(), choicePending: true, sets: [],
  }
}

export function resetWorkoutChoiceGroup(state, index) {
  const active = state.active
  if (!active) throw new Error('This workout is no longer available')
  const indices = workoutChoiceGroupIndices(active.entries, index)
  const entry = active.entries[indices[0]]
  const config = entry?.choiceOptions?.[0]
  if (!config || entry.choicePending) throw new Error('This exercise selection is no longer available')
  const choiceId = uid()
  const pending = {
    ...buildOptionEntry(state, entry, config),
    choiceId, choiceGroupId: choiceId, choicePending: true, sets: [],
  }
  const currentEntry = active.entries[active.cur]
  const at = indices[0]
  for (const i of indices.slice().reverse()) active.entries.splice(i, 1)
  active.entries.splice(at, 0, pending)
  const currentIndex = currentEntry ? active.entries.indexOf(currentEntry) : -1
  active.cur = currentIndex >= 0 ? currentIndex : at
  return at
}

export function chooseWorkoutOption(state, index, exerciseId, { add = false } = {}) {
  const active = state.active
  const entry = active?.entries?.[index]
  const config = entry?.choiceOptions?.find(option => option.id === exerciseId)
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
