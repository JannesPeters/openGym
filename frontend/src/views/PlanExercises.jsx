import { useCallback, useLayoutEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ExerciseBrowser from '../components/ExerciseBrowser.jsx'
import Icon from '../components/Icon.jsx'
import { CustomExForm, deleteCustomEx, ExConfig, exerciseDetailSheet } from '../sheets.jsx'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXIDX, exOr } from '../lib/exercises.js'
import { exerciseNameText, uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { cleanupSg, defaultConfig, exLine } from '../lib/history.js'
import { speedUnitOf } from '../lib/speed.js'
import { onSheetEntry } from '../lib/nav.js'
import { replaceSlotExercise } from '../lib/routines.js'
import { removeRoutineExercise } from './RoutineEdit.jsx'
import { addOption, hasOptions, optionsOf, removeOption, saveOption, cleanGroupName } from '../lib/exercise-options.js'

// One snapshot per history entry: returning to a picker restores its filters and loaded rows.
const browsers = new Map()
const drafts = new Map()
const rememberEntry = (cache, key, value) => {
  cache.set(key, value)
  if (cache.size > 40) cache.delete(cache.keys().next().value)
}

export default function PlanExercises({ editing = false, custom = false }) {
  const { id, index, exerciseId } = useParams()
  const loc = useLocation()
  const entryKey = loc.pathname + loc.search + ':' + loc.key
  const nav = useNavigate()
  const [search] = useSearchParams()
  const S = useStore(s => s.S)
  const routine = S.routines.find(r => r.id === id)
  const root = `/plan/r/${encodeURIComponent(id)}`
  const picker = `${root}/exercises`
  const addingOption = search.has('alternative')
  const replacing = !addingOption && search.has('slot')
  const optionId = search.get('option')
  const slotIndex = editing ? Number(index) : Number(search.get('slot'))
  const original = editing ? exerciseId : search.get('original')
  const slot = editing || replacing || addingOption ? routine?.ex[slotIndex] : null
  const validSlot = Number.isInteger(slotIndex) && slotIndex >= 0 && slot?.id === original
    && (!search.has('alternative') || slot.slotId === search.get('alternative'))
    && (!search.has('slotKey') || slot.slotId === search.get('slotKey'))
  const selectedOption = optionId ? optionsOf(slot).find(option => option.id === optionId) : slot
  const targetId = custom ? search.get('customId') || exerciseId : exerciseId
  const ex = EXIDX[targetId] || S.customEx?.find(e => e.id === targetId) || (editing && !custom ? exOr(targetId) : null)
  const heading = useRef(null)
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }) }, [loc.pathname])
  const remember = useCallback(state => { rememberEntry(browsers, entryKey, state) }, [entryKey])
  const rememberDraft = useCallback(state => { rememberEntry(drafts, entryKey, state) }, [entryKey])
  const back = () => loc.state?.planBack ? nav(-1) : nav(root, { replace: true })
  const open = (path, replace = false) => nav(path, { replace, state: {
    planBack: loc.pathname + loc.search,
    planReturn: loc.state?.planBack ? 2 : 0,
  } })
  const notify = message => useUI.getState().toast(message)
  const update = fn => useStore.getState().update(s => {
    const live = s.routines.find(r => r.id === id)
    if (live) fn(live, s)
  })
  const save = (target, cfg) => {
    let done = false
    update((r, live) => {
      if (editing || replacing || addingOption) {
        const current = r.ex[slotIndex]
        if (!current || current.id !== original || (addingOption && current.slotId !== search.get('alternative'))
          || (search.has('slotKey') && current.slotId !== search.get('slotKey'))) return
        if ((addingOption || replacing || target.id !== (optionId || current.id))
          && optionsOf(current).some(option => option.id === target.id && option.id !== (addingOption ? null : optionId || current.id))) return
        if (addingOption) r.ex[slotIndex] = addOption(current, { id: target.id, ...(cfg || defaultConfig(target.id)) })
        else if (optionId || hasOptions(current)) {
          if (optionId && !optionsOf(current).some(option => option.id === optionId)) return
          r.ex[slotIndex] = saveOption(current, optionId || current.id, cfg
            ? { id: target.id, ...cfg }
            : replaceSlotExercise(optionId ? optionsOf(current).find(option => option.id === optionId) : current, target.id, live, id))
        } else r.ex[slotIndex] = cfg
          ? { id: target.id, sg: current.sg, ...(current.sg ? { sgName: current.sgName, sgRest: current.sgRest } : {}), ...cfg }
          : replaceSlotExercise(current, target.id, live, id)
        cleanupSg(r.ex)
      } else r.ex.push({ id: target.id, ...(cfg || defaultConfig(target.id)) })
      done = true
    })
    if (!done) { notify(t('This exercise is already an option or the slot has changed.')); return false }
    notify(replacing ? t('Replaced with “{0}”', exerciseNameText(target))
      : editing ? t('Saved') : t('“{0}” added to {1}', exerciseNameText(target), routine.name))
    if (replacing) {
      const depth = exerciseId ? loc.state?.planReturn : loc.state?.planBack ? 1 : 0
      if (depth) nav(-depth)
      else nav(root, { replace: true })
    }
    if (addingOption) nav(root, { replace: onSheetEntry() })
    return true
  }

  if (!routine) return <Navigate to="/plan" replace />
  if ((editing || replacing || addingOption) && (!validSlot || !selectedOption)) return <Navigate to={root} replace />
  if (exerciseId && !ex) return <Navigate to={root} replace />
  const title = custom ? t(ex ? 'Edit' : 'Create your own exercise')
    : t(editing ? 'Edit' : addingOption ? 'Add alternative' : replacing ? 'Replace exercise' : 'Add exercise')
  return <div className="narrow plan-exercise-page">
    <div className="hdr">
      <button className="iconbtn" aria-label={t('Back')} onClick={back}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}>
        <h1 ref={heading} tabIndex={-1} style={{ fontSize: 22 }}>{title}</h1>
        <div className="small dim">{routine.name}</div>
      </div>
    </div>
      {editing && !custom && !optionId && <div className="card" style={{ marginBottom: 16 }}>
        <h2>{cleanGroupName(slot.groupName) || t('Exercise alternatives')}</h2>
        <p className="small dim">{t('Choose one during your workout. Each option keeps its own settings and progress.')}</p>
        {hasOptions(slot) && <div className="list">{optionsOf(slot).map(option => <div className="item" key={option.id}>
          <button className="grow item-open" onClick={() => {
            const params = new URLSearchParams(search)
            params.set('option', option.id)
            params.set('slotKey', slot.slotId)
            open(`${root}/exercise/${slotIndex}/${encodeURIComponent(original)}?${params}`)
          }}><span className="tt">{exerciseNameText(exOr(option.id))}</span>
            <span className="ss">{exLine(option, S.unit, speedUnitOf(S))}</span></button>
          <button className="iconbtn" aria-label={t('Remove {0}', exerciseNameText(exOr(option.id)))} onClick={() => {
            let removed = false
            update(r => {
              const current = r.ex[slotIndex]
              if (current?.id !== original || current.slotId !== slot.slotId) return
              const next = removeOption(current, option.id)
              if (next) r.ex[slotIndex] = next
              else r.ex.splice(slotIndex, 1)
              cleanupSg(r.ex)
              removed = true
            })
            if (!removed) notify(t('Too late, that one’s gone'))
            nav(root)
          }}>-</button>
        </div>)}</div>}
        <button className="btn ghost" onClick={() => {
          let key = slot.slotId
          if (!key) {
            update(r => {
              if (r.ex[slotIndex]?.id === original) {
                r.ex[slotIndex] = { ...r.ex[slotIndex], slotId: uid() }
                key = r.ex[slotIndex].slotId
              }
            })
          }
          if (key) open(`${picker}?slot=${slotIndex}&original=${encodeURIComponent(original)}&alternative=${encodeURIComponent(key)}`)
          else notify(t('Too late, that one’s gone'))
        }}>{t('Add alternative')}</button>
      </div>}
    {custom ? <CustomExForm key={entryKey} existing={ex} prefill={loc.state?.query} close={() => {}}
      onDone={created => {
        if (ex) back()
        else nav(`${picker}/${encodeURIComponent(created.id)}${loc.search}`, { replace: true, state: loc.state })
      }}
      onDelete={target => deleteCustomEx(target, () => nav(root, { replace: true }))} />
      : exerciseId ? <ExConfig key={entryKey} ex={optionId ? exOr(optionId) : ex} existing={editing ? selectedOption : replacing ? replaceSlotExercise(slot, ex.id, S, id) : null}
        routine={routine} allowVariants close={() => {}} draft={drafts.get(entryKey)} onDraftChange={rememberDraft}
        onSave={(cfg, selected) => { if (save(selected || (optionId ? exOr(optionId) : ex), cfg) && !replacing && !addingOption) back() }}
        saveLabel={addingOption ? t('Add alternative') : replacing ? t('Replace') : undefined}
        onCustomEdit={target => {
          const params = new URLSearchParams(search)
          params.set('customId', target.id)
          open(`${loc.pathname}/custom?${params}`)
        }}
        onDelete={editing && !optionId ? () => {
          const current = useStore.getState().S.routines.find(r => r.id === id)?.ex[slotIndex]
          if (current?.id !== original || (slot.slotId && current.slotId !== slot.slotId)) { notify(t('Too late, that one’s gone')); return }
          removeRoutineExercise(id, slotIndex)
          back()
        } : undefined}
        onReplace={editing && !optionId ? () => {
          const params = new URLSearchParams({ slot: slotIndex, original })
          if (slot.slotId) params.set('slotKey', slot.slotId)
          nav(`${picker}?${params}`, { replace: true, state: loc.state })
        } : undefined} />
        : <ExerciseBrowser key={entryKey} picking routineId={id} like={replacing || addingOption ? original : undefined}
          initialState={browsers.get(entryKey)} onStateChange={remember}
          onOpen={target => {
            const configure = (selected, replace = false) => open(`${picker}/${encodeURIComponent(selected.id)}${loc.search}`, replace)
            if (replacing) configure(target)
            else exerciseDetailSheet(target, {
              addLabel: t(addingOption ? 'Add alternative' : 'Add to routine'),
              onAdd: selected => save(selected),
              onEditBeforeAdd: selected => configure(selected, onSheetEntry()),
            })
          }}
          onAdd={target => {
            if (replacing && target.id === original) { back(); return }
            save(target)
          }}
          onCreate={query => nav(`${picker}/new${loc.search}`, { state: {
            planBack: loc.pathname + loc.search, planReturn: loc.state?.planBack ? 2 : 0, query,
          } })} />}
  </div>
}
