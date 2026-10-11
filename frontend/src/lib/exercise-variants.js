export const EXERCISE_NAME_MAX = 80
export const VARIANT_LABEL_MAX = 40

export function baseExerciseIdOf(ex) {
  const id = typeof ex?.baseExerciseId === 'string' ? ex.baseExerciseId.trim() : ''
  return id && id !== ex.id ? id : null
}

export const variantLabelOf = ex => baseExerciseIdOf(ex) && typeof ex.variantLabel === 'string'
  ? ex.variantLabel.trim().slice(0, VARIANT_LABEL_MAX)
  : ''

// The stored name is also a snapshot when a custom base is renamed or deleted.
export function variantBaseName(ex) {
  const name = typeof ex?.n === 'string' ? ex.n : ''
  const label = variantLabelOf(ex)
  const suffix = ` (${label})`
  return label && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name
}

export function variantName(baseName, label) {
  const name = baseName.trim()
  const variant = label.trim().slice(0, VARIANT_LABEL_MAX)
  return variant
    ? `${name.slice(0, EXERCISE_NAME_MAX - variant.length - 3).trimEnd()} (${variant})`
    : name.slice(0, EXERCISE_NAME_MAX)
}

// Group only the rows already admitted by search, equipment and favourites/chosen filters.
export function groupExerciseVariants(exercises) {
  if (!exercises.some(baseExerciseIdOf)) return exercises
  const groups = new Map()
  for (const ex of exercises) {
    const baseId = baseExerciseIdOf(ex)
    const key = baseId || ex.id
    if (!groups.has(key)) groups.set(key, [])
    if (baseId) groups.get(key).push(ex)
    else groups.get(key).unshift(ex)
  }
  return [...groups.values()].flat()
}

export function referencedCustomExercises(customs, exerciseIds) {
  const entries = (Array.isArray(customs) ? customs : []).filter(ex => ex && typeof ex === 'object' && ex.id != null)
  const index = new Map(entries.map(ex => [ex.id, ex]))
  const used = new Set(exerciseIds)
  for (const id of used) {
    const baseId = baseExerciseIdOf(index.get(id))
    if (baseId && index.has(baseId)) used.add(baseId)
  }
  return entries.filter(ex => used.has(ex.id))
}
