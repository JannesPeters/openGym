import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { exerciseNameText } from '../lib/format.js'
import { defaultConfig, exLine } from '../lib/history.js'
import { speedUnitOf } from '../lib/speed.js'
import { t } from '../lib/i18n.js'
import { optionsOf, GROUP_NAME_MAX, cleanGroupName } from '../lib/exercise-options.js'
import { groupOf, groupUses, addGroupOption, removeGroupOption, copyPlacementGroup, placeExerciseGroup } from '../lib/exercise-groups.js'
import { confirmSheet, exercisePicker, exConfigSheet } from '../sheets.jsx'
import { Button, TextField } from './ui.jsx'

export default function RoutineGroupSheet({ routineId, slotId, close }) {
  const state = useStore(s => s.S)
  const routine = state.routines.find(r => r.id === routineId)
  const slot = routine?.ex.find(slot => slot.slotId === slotId)
  const group = groupOf(state, slot)
  const [name, setName] = useState(group?.name || '')
  const update = mut => {
    try { useStore.getState().update(mut); return true }
    catch (error) { useUI.getState().toast(t(error.message)); return false }
  }
  if (!routine) return null
  if (!slotId) return <>
    <h3>{t('Reuse exercise group')}</h3>
    <p className="small dim">{t('Membership and name are shared. This routine gets its own exercise settings.')}</p>
    <div className="list">{(state.exerciseGroups || []).map(group => <div className="item" key={group.id}>
      <button type="button" className="grow item-open" disabled={group.archived} onClick={() => {
        if (update(s => {
          const live = s.routines.find(r => r.id === routineId)
          if (!live) throw new Error('This workout is no longer available')
          live.ex.push(placeExerciseGroup(s, group.id))
        })) close()
      }}><span className="tt">{group.name || t('Exercise group')}</span>
        <span className="ss">{group.archived ? t('Archived') : t('{0} options', group.options.length)}</span></button>
      {group.archived && <Button size="sm" variant="ghost" onClick={() => update(s => {
        s.exerciseGroups.find(item => item.id === group.id).archived = false
      })}>{t('Restore')}</Button>}
    </div>)}</div>
    <Button onClick={close}>{t('Close')}</Button>
  </>
  if (!slot || !group) return <><h3>{t('Too late, that one’s gone')}</h3><Button onClick={close}>{t('Close')}</Button></>
  const uses = groupUses(state, group.id)
  const names = [...new Set(uses.map(use => use.name))].join(', ')
  const sharedEdit = mut => {
    const apply = () => update(s => {
      if (s.routines.find(r => r.id === routineId)?.ex.find(item => item.slotId === slotId)?.groupId !== group.id) {
        throw new Error('This exercise selection is no longer available')
      }
      mut(s, s.exerciseGroups.find(item => item.id === group.id))
    })
    if (uses.length > 1) confirmSheet({
      title: t('Edit shared group'), message: t('Changes affect future sessions in: {0}', names),
      confirmText: t('Save'), onConfirm: apply,
    })
    else apply()
  }
  const editConfig = option => exConfigSheet(exOr(option.id), option.needsConfig ? defaultConfig(option.id) : option,
    config => update(s => {
      const live = s.routines.find(r => r.id === routineId)?.ex.find(item => item.slotId === slotId)
      if (!live || live.groupId !== group.id) throw new Error('This exercise selection is no longer available')
      if (!groupOf(s, live).options.some(item => item.id === option.optionId && item.exerciseId === option.id)) throw new Error('This exercise option is no longer available')
      live.optionConfigs[option.optionId] = { ...config, id: option.id }
    }), null, routine)
  const add = () => {
    const picker = exercisePicker(ex => {
      picker.close()
      sharedEdit(s => { addGroupOption(s, group.id, ex.id) })
    }, { detailLabel: t('Add shared option') })
  }
  return <>
    <h3>{group.name || t('Exercise group')}</h3>
    <p className="small dim">{t('Changes affect future sessions in: {0}', names)}</p>
    <label><span className="small dim">{t('Group name')}</span>
      <TextField value={name} maxLength={GROUP_NAME_MAX} onChange={event => setName(event.target.value)} />
    </label>
    <Button size="sm" variant="ghost" disabled={cleanGroupName(name) === group.name}
      onClick={() => sharedEdit((s, definition) => { definition.name = cleanGroupName(name) })}>{t('Save shared name')}</Button>
    <p className="small dim">{t('Exercise settings below belong only to this routine. New shared options start with their own exercise defaults in every routine.')}</p>
    {!group.options.length && <p role="status">{t('This exercise group is empty. Add an option before starting.')}</p>}
    <div className="list">{optionsOf(slot, state).map((option, index) => <div className="item" key={option.optionId}>
      <button type="button" className="grow item-open" onClick={() => editConfig(option)}>
        <span className="tt">{exerciseNameText(exOr(option.id))}</span>
        <span className="ss">{option.needsConfig ? t('Configure') : exLine(option, state.unit, speedUnitOf(state))}</span>
      </button>
      <Button size="xs" variant="ghost" icon="chevronUp" disabled={index === 0} aria-label={t('Move up')}
        onClick={() => sharedEdit((s, definition) => {
          const at = definition.options.findIndex(item => item.id === option.optionId)
          if (at > 0) [definition.options[at - 1], definition.options[at]] = [definition.options[at], definition.options[at - 1]]
        })} />
      <Button size="xs" variant="ghost" icon="chevronDown" disabled={index === group.options.length - 1} aria-label={t('Move down')}
        onClick={() => sharedEdit((s, definition) => {
          const at = definition.options.findIndex(item => item.id === option.optionId)
          if (at >= 0 && at < definition.options.length - 1) [definition.options[at + 1], definition.options[at]] = [definition.options[at], definition.options[at + 1]]
        })} />
      <Button size="xs" variant="ghost" icon="minus" aria-label={t('Remove {0}', exerciseNameText(exOr(option.id)))}
        onClick={() => sharedEdit(s => removeGroupOption(s, group.id, option.optionId))} />
    </div>)}</div>
    <Button size="sm" icon="plus" onClick={add}>{t('Add shared option')}</Button>
    <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
      <Button size="sm" variant="ghost" icon="copy" onClick={() => {
        if (update(s => {
          const live = s.routines.find(r => r.id === routineId)?.ex.find(item => item.slotId === slotId)
          if (!live || live.groupId !== group.id) throw new Error('This exercise selection is no longer available')
          copyPlacementGroup(s, live)
        })) close()
      }}>{t('Make independent copy')}</Button>
      <Button size="sm" variant="ghost" onClick={() => sharedEdit((s, definition) => { definition.archived = !definition.archived })}>
        {group.archived ? t('Restore') : t('Archive group')}
      </Button>
      <Button size="sm" onClick={close}>{t('Done')}</Button>
    </div>
  </>
}
