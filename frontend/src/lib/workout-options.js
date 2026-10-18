import { buildPlannedEntry, builtOutOfProgression } from './session-start.js'
import { sessionHistory } from './backfill.js'
import { hasLoggedWork } from './exercise-options.js'
import { supersetUnits, unitOf } from './history.js'
import { uid } from './format.js'
import { activeWorkoutLayout } from './workout-layout.js'

function buildOptionEntry(state, entry, config, { add = false } = {}) {
  const active = state.active
  const routine = entry.choiceRoutine || state.routines.find(r => r.id === entry.rid)
  const noProg = add ? active.noProg === true || routine?.excludeFromProgression === true : entry.noProg === true
  const built = buildPlannedEntry(sessionHistory(state), config, routine, { noProg: builtOutOfProgression({ noProg }, routine) })
  const next = {
    id: config.id, ...built,
    ...(entry.rid ? { rid: entry.rid } : {}),
    ...(entry.slotId ? { slotId: entry.slotId } : {}),
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
