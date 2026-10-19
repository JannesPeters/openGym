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
  const entry = {
    slotId: uid(), choiceId: uid(),
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
    ...(noProg ? { noProg: true } : {}),
    ...(!add && entry.sg ? { sg: entry.sg } : {})
  }
  if (!add && entry.sg) {
    for (const key of ['sg', 'sgName', 'sgRest']) if (entry.target?.[key] != null) next.target[key] = entry.target[key]
  }
  return next
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
