import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { exerciseNameText } from '../lib/format.js'
import { exLine } from '../lib/history.js'
import { speedUnitOf } from '../lib/speed.js'
import { activeProfile, exAvailable } from '../lib/equipment.js'
import { t } from '../lib/i18n.js'
import { hasLoggedWork } from '../lib/exercise-options.js'
import { chooseWorkoutOption, resetWorkoutOption } from '../lib/workout-options.js'
import { activeWorkoutLayout } from '../lib/workout-layout.js'
import { confirmSheet } from '../sheets.jsx'
import { Button } from './ui.jsx'

export default function WorkoutOptions({ entryIdx, headerAction }) {
  const state = useStore(s => s.S)
  const entry = state.active?.entries[entryIdx]
  if (!entry?.choiceOptions) return null
  const activeId = state.active.id
  const choiceId = entry.choiceId
  const choose = (id, add, close) => {
    const current = useStore.getState().S.active
    const live = current?.entries[entryIdx]
    if (current?.id !== activeId || live?.choiceId !== choiceId || !live.choiceOptions?.some(option => option.id === id)) {
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
    useStore.getState().update(s => { chooseWorkoutOption(s, entryIdx, id, { add }) }, true)
    close?.()
  }
  const options = (add, close) => {
    const profile = activeProfile(state)
    return <div className="list">{entry.choiceOptions.filter(option => !add || option.id !== entry.id).map(option => {
      const ex = exOr(option.id)
      return <button type="button" className="item" style={{ width: '100%', textAlign: 'start' }} key={option.id}
        onClick={() => choose(option.id, add, close)}>
        <span className="grow item-open"><span className="tt">{exerciseNameText(ex)}</span>
          <span className="ss">{exLine(option, state.unit, speedUnitOf(state))}</span>
          <span className="small dim">{t(ex.eq || '')}</span>
          {profile && !exAvailable(state, ex) && <span className="small" style={{ color: 'var(--orange)' }}>{t('Not in your equipment profile')}</span>}
        </span>
      </button>
    })}</div>
  }
  const open = add => useUI.getState().openSheet(close => <>
    <h3>{t(add ? 'Add another exercise from this group' : 'Choose exercise')}</h3>
    {add && <p className="small dim">{t('Adds its own full planned sets. Your existing exercises stay unchanged.')}</p>}
    {options(add, close)}
  </>)
  const reset = () => confirmSheet({
    title: t('Clear selection'),
    message: t('The sets you logged for this exercise in this session will be lost.'),
    confirmText: t('Clear selection'), danger: true,
    onConfirm: () => {
      const state = useStore.getState().S
      const live = state.active?.entries[entryIdx]
      if (state.active?.id !== activeId || !live || live.choiceId !== choiceId || live.id !== entry.id
        || live.choicePending || activeWorkoutLayout(state) !== 'custom') {
        useUI.getState().toast(t('Too late, that one’s gone'))
        return
      }
      useUI.getState().stopWork()
      useUI.getState().stopRest()
      useStore.getState().update(s => { resetWorkoutOption(s, entryIdx) }, true)
    },
  })
  if (entry.choicePending) return <div className="card" data-testid="workout-choice">
    {headerAction ? <div className="row between"><h2>{t('Choose exercise')}</h2>{headerAction}</div> : <h2>{t('Choose exercise')}</h2>}
    <p className="small dim">{t('Choose one option for this slot. Each exercise keeps its own progress.')}</p>
    {options(false)}
  </div>
  return <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
    {!hasLoggedWork(entry) && <Button size="sm" variant="ghost" onClick={() => open(false)}>{t('Change exercise')}</Button>}
    <Button size="sm" variant="ghost" icon="plus" onClick={() => open(true)}>{t('Add another exercise from this group')}</Button>
    {activeWorkoutLayout(state) === 'custom' && <Button size="sm" variant="ghost" icon="reset" onClick={reset}>{t('Clear selection')}</Button>}
  </div>
}
