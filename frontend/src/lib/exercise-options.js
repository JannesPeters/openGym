import { uid } from './format.js'
import { hasCompletedWork } from './workout-model.js'
import { isGroup, resolvedOptions, prescriptionOf } from '../../../api/coach/core/exercise-groups.js'

export const GROUP_NAME_MAX = 60
export const cleanGroupName = name => typeof name === 'string' ? name.trim().slice(0, GROUP_NAME_MAX) : ''

export function optionConfig(slot) {
  return prescriptionOf(slot)
}

export function optionsOf(slot, state) {
  if (isGroup(slot)) return resolvedOptions(slot, state)
  return [optionConfig(slot), ...(Array.isArray(slot?.alternatives) ? slot.alternatives.map(optionConfig) : [])]
}

export const hasOptions = slot => isGroup(slot) || (Array.isArray(slot?.alternatives) && slot.alternatives.length > 0)
export const hasLoggedWork = entry => (entry?.sets || []).some(hasCompletedWork)

export function mapOptions(slot, map) {
  if (isGroup(slot)) return { ...slot, optionConfigs: Object.fromEntries(Object.entries(slot.optionConfigs).map(([key, config]) => [key, map(config)])) }
  const out = { ...slot, ...map(optionConfig(slot)) }
  if (hasOptions(slot)) out.alternatives = slot.alternatives.map(config => map(optionConfig(config)))
  return out
}

export function saveOption(slot, optionId, config) {
  if (isGroup(slot)) {
    const key = slot.optionConfigs[optionId] ? optionId : Object.keys(slot.optionConfigs).find(key => slot.optionConfigs[key].id === optionId)
    if (!key) throw new Error('This exercise option is no longer available')
    if (slot.optionConfigs[key].id !== config.id) throw new Error('Change group membership separately from routine settings.')
    return { ...slot, optionConfigs: { ...slot.optionConfigs, [key]: optionConfig(config) } }
  }
  if (slot.id === optionId) {
    const kept = Object.fromEntries(['slotId', 'groupName', 'sg', 'sgName', 'sgRest', 'alternatives'].filter(key => slot[key] != null).map(key => [key, slot[key]]))
    return { ...kept, ...optionConfig(config) }
  }
  return { ...slot, alternatives: (slot.alternatives || []).map(option => option.id === optionId ? optionConfig(config) : option) }
}

export function addOption(slot, config) {
  if (isGroup(slot)) throw new Error('Add options to the shared group definition.')
  if (optionsOf(slot).some(option => option.id === config.id)) throw new Error('This exercise is already an option')
  return { ...slot, slotId: slot.slotId || uid(), alternatives: [...(slot.alternatives || []), optionConfig(config)] }
}

export function removeOption(slot, id) {
  if (isGroup(slot)) throw new Error('Remove options from the shared group definition.')
  if (!optionsOf(slot).some(option => option.id === id)) return slot
  const remaining = optionsOf(slot).filter(option => option.id !== id)
  if (!remaining.length) return null
  const out = Object.fromEntries(['slotId', 'groupName', 'sg', 'sgName', 'sgRest'].filter(key => slot[key] != null).map(key => [key, slot[key]]))
  return { ...out, ...remaining[0], id: remaining[0].id, ...(remaining.length > 1 ? { alternatives: remaining.slice(1) } : {}) }
}

export function freshSlotIds(exercises) {
  return exercises.map(slot => slot.slotId ? { ...slot, slotId: uid() } : slot)
}
