import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { exerciseNameText } from '../lib/format.js'
import { exLine } from '../lib/history.js'
import { speedUnitOf } from '../lib/speed.js'
import { activeProfile, exAvailable } from '../lib/equipment.js'
import { t } from '../lib/i18n.js'
import { hasLoggedWork } from '../lib/exercise-options.js'
import { workoutOptions, workoutGroupId, workoutGroupName } from '../lib/exercise-groups.js'
import {
  chooseWorkoutOption, resetWorkoutChoiceGroup, setWorkoutChoiceGroup, workoutChoiceGroupIndices,
} from '../lib/workout-options.js'
import { activeWorkoutLayout } from '../lib/workout-layout.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from './Icon.jsx'
import { Button, SheetDialog } from './ui.jsx'

function WorkoutChoiceEditor({
  title, name, options, selectedIds, lockedIds, currentId, state, trigger, returnFocus, close, onApply,
}) {
  const [selected, setSelected] = useState(() => new Set(selectedIds))
  const profile = activeProfile(state)
  const toggle = id => setSelected(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return <SheetDialog title={title} trigger={trigger} returnFocus={returnFocus}>
    <div className="workout-choice-picker-bar">
      <div>
        <h3>{title}</h3>
        {name && <div className="small dim">{t('Choose exercise')}</div>}
      </div>
      <Button size="sm" icon="xmark" onClick={close}>{t('Close')}</Button>
    </div>
    <div className="small dim">{t('{0} options', options.length)}</div>
    <div className="list workout-choice-editor-list">{options.map(option => {
      const ex = exOr(option.id)
      const on = selected.has(option.id)
      const locked = lockedIds.has(option.id)
      return <button type="button" className={'item workout-choice-option' + (on ? ' is-selected' : '')}
        data-workout-choice-option={option.id} style={{ width: '100%', textAlign: 'start' }} key={option.id}
        aria-pressed={on} aria-disabled={locked || undefined}
        onClick={() => { if (!locked) toggle(option.id) }}>
        <span className="grow item-open"><span className="tt">{exerciseNameText(ex)}</span>
          <span className="ss">{exLine(option, state.unit, speedUnitOf(state))}</span>
          {activeWorkoutLayout(state) !== 'custom' && <span className="small dim">{t(ex.eq || '')}</span>}
          {profile && !exAvailable(state, ex) && <span className="small" style={{ color: 'var(--orange)' }}>{t('Not in your equipment profile')}</span>}
        </span>
        {on && <span className="tag acc">{t(option.id === currentId ? 'Current' : 'Selected')}</span>}
      </button>
    })}</div>
    <div className="row between workout-choice-editor-footer">
      <span className="small dim">{t('{0} selected', selected.size)}</span>
      <Button size="sm" disabled={!selected.size} onClick={() => onApply([...selected])}>{t('Done')}</Button>
    </div>
  </SheetDialog>
}

const groupSignature = entries => entries.map(entry =>
  `${entry.entryId || entry.choiceId}:${entry.id}:${workoutOptions(entry)?.map(option => option.id).join(',') || ''}`,
).join('|')

function liveGroupIndices(active, groupId) {
  const entries = active?.entries || []
  const index = entries.findIndex(entry => workoutGroupId(entry) === groupId)
  return index < 0 ? [] : workoutChoiceGroupIndices(entries, index)
}

export default function WorkoutOptions({ entryIdx, headerAction }) {
  const state = useStore(s => s.S)
  const entry = state.active?.entries[entryIdx]
  const name = workoutGroupName(entry)
  if (!entry) return null
  if (!workoutOptions(entry)) return name ? <div className="small dim workout-group-name">{name}</div> : null

  const groupIndices = workoutChoiceGroupIndices(state.active.entries, entryIdx)
  const firstIndex = groupIndices[0] ?? entryIdx
  const groupEntries = groupIndices.map(index => state.active.entries[index])
  const first = groupEntries[0] || entry
  const activeId = state.active.id
  const choiceId = entry.entryId || entry.choiceId
  const groupId = workoutGroupId(first)
  const initialSignature = groupSignature(groupEntries)
  const layout = activeWorkoutLayout(state)
  const stacked = ['custom', 'list', 'compact'].includes(layout)
  const returnFocus = () => [...document.querySelectorAll('[data-workout-choice-trigger]')]
    .find(button => button.dataset.workoutChoiceTrigger === String(groupId))
  const currentGroup = active => {
    const indices = liveGroupIndices(active, groupId)
    const members = indices.map(index => active.entries[index])
    return active?.id === activeId && groupSignature(members) === initialSignature ? indices : []
  }

  const choose = (id, add, close) => {
    const current = useStore.getState().S.active
    const live = current?.entries[entryIdx]
    const indices = currentGroup(current)
    if (current?.id !== activeId || !indices.includes(entryIdx)
      || (live?.entryId || live?.choiceId) !== choiceId || !workoutOptions(live)?.some(option => option.id === id)) {
      useUI.getState().toast(t('Too late, that one’s gone'))
      close?.()
      return
    }
    if (!add && hasLoggedWork(live)) {
      useUI.getState().toast(t('Logged exercises cannot be swapped. Add another option instead.'))
      close?.()
      return
    }
    useUI.getState().stopWork()
    useUI.getState().stopRest()
    try { useStore.getState().update(s => { chooseWorkoutOption(s, entryIdx, id, { add }) }, true) }
    catch (error) { useUI.getState().toast(t(error.message)); return }
    close?.()
  }

  const options = (add, close) => {
    const profile = activeProfile(state)
    const selectedIds = new Set(groupEntries.filter(member => !member.choicePending).map(member => member.id))
    return <div className="list">{workoutOptions(entry).filter(option => !add || !selectedIds.has(option.id)).map(option => {
      const ex = exOr(option.id)
      const current = !add && !entry.choicePending && option.id === entry.id
      return <button type="button" className="item workout-choice-option" data-workout-choice-option={option.id}
        style={{ width: '100%', textAlign: 'start' }} key={option.id}
        aria-pressed={current}
        onClick={() => current ? close?.() : choose(option.id, add, close)}>
        <span className="grow item-open"><span className="tt">{exerciseNameText(ex)}</span>
          <span className="ss">{exLine(option, state.unit, speedUnitOf(state))}</span>
          {activeWorkoutLayout(state) !== 'custom' && <span className="small dim">{t(ex.eq || '')}</span>}
          {profile && !exAvailable(state, ex) && <span className="small" style={{ color: 'var(--orange)' }}>{t('Not in your equipment profile')}</span>}
        </span>
        {current && <span className="tag acc">{t('Current')}</span>}
      </button>
    })}</div>
  }

  const openPending = trigger => useUI.getState().openSheet(close => {
    const snapshot = useStore.getState().S
    const live = snapshot.active?.entries[entryIdx]
    if (snapshot.active?.id !== activeId || (live?.entryId || live?.choiceId) !== choiceId || !live.choicePending) {
      useUI.getState().toast(t('Too late, that one’s gone'))
      close()
      return null
    }
    const title = name || t('Choose exercise')
    return <SheetDialog title={title} trigger={trigger} returnFocus={returnFocus}>
      <div className="workout-choice-picker-bar">
        <h3>{title}</h3>
        <Button size="sm" icon="xmark" onClick={close}>{t('Close')}</Button>
      </div>
      <div className="small dim">{t('{0} options', workoutOptions(live).length)}</div>
      {options(false, close)}
    </SheetDialog>
  })

  const openAdd = () => useUI.getState().openSheet(close => {
    if (!currentGroup(useStore.getState().S.active).includes(entryIdx)) {
      useUI.getState().toast(t('Too late, that one’s gone'))
      close()
      return null
    }
    return <>
      <h3>{t('Add another exercise from this group')}</h3>
      {name && <p className="small dim workout-group-name">{name}</p>}
      <p className="small dim">{t('Adds its own full planned sets. Your existing exercises stay unchanged.')}</p>
      {options(true, close)}
    </>
  })

  const openEditor = trigger => {
    const snapshot = useStore.getState().S
    const indices = currentGroup(snapshot.active)
    if (!indices.includes(entryIdx)) {
      useUI.getState().toast(t('Too late, that one’s gone'))
      return
    }
    const members = indices.map(index => snapshot.active.entries[index])
    const selectedIds = members.map(member => member.id)
    const lockedIds = new Set(members.filter(hasLoggedWork).map(member => member.id))
    const currentEntry = snapshot.active.entries[snapshot.active.cur]
    const currentId = indices.includes(snapshot.active.cur) ? currentEntry?.id : null
    const title = name || t('Choose exercise')
    useUI.getState().openSheet(close => <WorkoutChoiceEditor title={title} name={name}
      options={workoutOptions(members[0])} selectedIds={selectedIds} lockedIds={lockedIds} currentId={currentId}
      state={state} trigger={trigger} returnFocus={returnFocus} close={close}
      onApply={ids => {
        const latest = useStore.getState().S
        const latestIndices = currentGroup(latest.active)
        if (!latestIndices.length || activeWorkoutLayout(latest) !== layout) {
          useUI.getState().toast(t('Too late, that one’s gone'))
          close()
          return
        }
        const current = latestIndices.map(index => latest.active.entries[index])
        if (current.some(member => hasLoggedWork(member) && !ids.includes(member.id))) {
          useUI.getState().toast(t('Logged exercises cannot be swapped. Add another option instead.'))
          close()
          return
        }
        const selectionChanged = current.some(member => !ids.includes(member.id))
          || ids.some(id => !current.some(member => member.id === id))
        if (selectionChanged) {
          useUI.getState().stopWork()
          useUI.getState().stopRest()
        }
        try { useStore.getState().update(s => { setWorkoutChoiceGroup(s, latestIndices[0], ids) }, true) }
        catch (error) { useUI.getState().toast(t(error.message)); return }
        close()
      }} />)
  }

  const reset = () => confirmSheet({
    title: t('Clear selection'),
    message: t('Clearing this group will discard all sets logged for its exercises in this workout.'),
    confirmText: t('Clear selection'), danger: true,
    onConfirm: () => {
      const latest = useStore.getState().S
      const indices = currentGroup(latest.active)
      if (!indices.length || activeWorkoutLayout(latest) !== 'custom') {
        useUI.getState().toast(t('Too late, that one’s gone'))
        return
      }
      useUI.getState().stopWork()
      useUI.getState().stopRest()
      useStore.getState().update(s => { resetWorkoutChoiceGroup(s, indices[0]) }, true)
    },
  })

  const groupOffset = groupIndices.indexOf(entryIdx)
  if (entryIdx !== firstIndex && stacked) {
    return groupOffset > 0 && groupIndices[groupOffset - 1] === entryIdx - 1
      ? <div className="workout-choice-divider workout-choice-divider-continuation"
        role="separator" aria-orientation="horizontal" />
      : null
  }

  if (entry.choicePending) return <div className="card workout-choice" data-testid="workout-choice">
    {headerAction ? <div className="row between workout-choice-head"><h2>{name || t('Choose exercise')}</h2>{headerAction}</div> : <h2>{name || t('Choose exercise')}</h2>}
    <p className="small dim workout-choice-description">{t('Choose one option for this slot. Each exercise keeps its own progress.')}</p>
    <button type="button" className="item workout-choice-open" data-workout-choice-trigger={groupId}
      aria-haspopup="dialog" onClick={event => openPending(event.currentTarget)}>
      <span className="grow item-open">
        <span className="tt">{t('Choose exercise')}</span>
        <span className="ss">{t('{0} options', workoutOptions(entry).length)}</span>
      </span>
      <Icon name="chevronRight" />
    </button>
  </div>

  return <>
    <div className="workout-choice-actions" role="group" aria-label={name || t('Choose exercise')}>
      {name && <div className="small dim workout-group-name">{name}</div>}
      <Button size="xs" variant="ghost" icon="swap" className="workout-choice-action"
        data-workout-choice-trigger={groupId} aria-haspopup="dialog"
        aria-label={t('Change exercise')} title={t('Change exercise')}
        onClick={event => openEditor(event.currentTarget)}>{t('Change')}</Button>
      <Button size="xs" variant="ghost" icon="plus" className="workout-choice-action"
        data-workout-choice-trigger={groupId} aria-haspopup="dialog"
        aria-label={t('Add another exercise from this group')} title={t('Add another exercise from this group')}
        onClick={openAdd}>{t('Add')}</Button>
      {activeWorkoutLayout(state) === 'custom' && <Button size="xs" variant="ghost" icon="reset"
        className="workout-choice-action workout-choice-action-clear"
        aria-label={t('Clear selection')} title={t('Clear selection')} onClick={reset}>{t('Clear')}</Button>}
    </div>
    <div className="workout-choice-divider" role="separator" aria-orientation="horizontal" />
  </>
}
