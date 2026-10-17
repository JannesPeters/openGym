import { uid } from './format.js'
import { hasCompletedWork } from './workout-model.js'

export function optionConfig(slot) {
  const { alternatives, slotId, sg, sgName, sgRest, choiceId, choiceRoutine, choiceOptions, choicePending, ...config } = slot || {}
  return config
}

export function optionsOf(slot) {
  return [optionConfig(slot), ...(Array.isArray(slot?.alternatives) ? slot.alternatives.map(optionConfig) : [])]
}

export const hasOptions = slot => Array.isArray(slot?.alternatives) && slot.alternatives.length > 0
export const hasLoggedWork = entry => (entry?.sets || []).some(hasCompletedWork)

export function mapOptions(slot, map) {
  const out = { ...slot, ...map(optionConfig(slot)) }
  if (hasOptions(slot)) out.alternatives = slot.alternatives.map(config => map(optionConfig(config)))
  return out
}

export function saveOption(slot, optionId, config) {
  if (slot.id === optionId) {
    const kept = Object.fromEntries(['slotId', 'sg', 'sgName', 'sgRest', 'alternatives'].filter(key => slot[key] != null).map(key => [key, slot[key]]))
    return { ...kept, ...optionConfig(config) }
  }
  return { ...slot, alternatives: (slot.alternatives || []).map(option => option.id === optionId ? optionConfig(config) : option) }
}

export function addOption(slot, config) {
  if (optionsOf(slot).some(option => option.id === config.id)) throw new Error('This exercise is already an option')
  return { ...slot, slotId: slot.slotId || uid(), alternatives: [...(slot.alternatives || []), optionConfig(config)] }
}

export function removeOption(slot, id) {
  if (!optionsOf(slot).some(option => option.id === id)) return slot
  const remaining = optionsOf(slot).filter(option => option.id !== id)
  if (!remaining.length) return null
  const out = Object.fromEntries(['slotId', 'sg', 'sgName', 'sgRest'].filter(key => slot[key] != null).map(key => [key, slot[key]]))
  return { ...out, ...remaining[0], id: remaining[0].id, ...(remaining.length > 1 ? { alternatives: remaining.slice(1) } : {}) }
}

export function freshSlotIds(exercises) {
  return exercises.map(slot => slot.slotId ? { ...slot, slotId: uid() } : slot)
}
