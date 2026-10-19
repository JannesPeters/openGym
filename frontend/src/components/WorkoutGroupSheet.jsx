import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exercisePicker, exConfigSheet } from '../sheets.jsx'
import { exOr } from '../lib/exercises.js'
import { exerciseNameText } from '../lib/format.js'
import { defaultConfig, exLine } from '../lib/history.js'
import { speedUnitOf } from '../lib/speed.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

export default function WorkoutGroupSheet({ onCreate, close, routine = null }) {
  const [options, setOptions] = useState([])
  const state = useStore(s => s.S)
  const add = () => {
    const picker = exercisePicker((ex, quick) => {
      picker.close()
      const commit = cfg => {
        if (options.some(option => option.id === ex.id)) {
          useUI.getState().toast(t('“{0}” already exists', exerciseNameText(ex)))
          return
        }
        setOptions(current => [...current, { ...cfg, id: ex.id }])
      }
      if (quick) commit(defaultConfig(ex.id))
      else exConfigSheet(ex, null, commit, null, routine, null, null, routine ? t('Add to routine') : t('Add to this workout'))
    })
  }
  return <>
    <h3>{t('Create new group')}</h3>
    <p className="small dim">{t('Choose at least two exercise options.')}</p>
    <div className="list">
      {options.map(option => <div className="item" key={option.id}>
        <span className="grow item-open">
          <span className="tt">{exerciseNameText(exOr(option.id))}</span>
          <span className="ss">{exLine(option, state.unit, speedUnitOf(state))}</span>
        </span>
        <Button size="sm" variant="ghost" icon="xmark" aria-label={t('Remove')}
          onClick={() => setOptions(current => current.filter(item => item.id !== option.id))} />
      </div>)}
    </div>
    <div style={{ height: 12 }} />
    <Button icon="plus" onClick={add}>{t('Add exercise')}</Button>
    <div style={{ height: 12 }} />
    <Button variant="primary" disabled={options.length < 2} onClick={() => {
      if (onCreate(options)) close()
    }}>{t('Create new group')}</Button>
  </>
}
