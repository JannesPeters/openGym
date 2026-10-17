import { useCallback, useLayoutEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ExerciseBrowser from '../components/ExerciseBrowser.jsx'
import Icon from '../components/Icon.jsx'
import { CustomExForm, deleteCustomEx, ExConfig } from '../sheets.jsx'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXIDX, exOr } from '../lib/exercises.js'
import { exerciseNameText } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { cleanupSg, defaultConfig } from '../lib/history.js'
import { replaceSlotExercise } from '../lib/routines.js'
import { removeRoutineExercise } from './RoutineEdit.jsx'

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
  const replacing = search.has('slot')
  const slotIndex = editing ? Number(index) : Number(search.get('slot'))
  const original = editing ? exerciseId : search.get('original')
  const slot = editing || replacing ? routine?.ex[slotIndex] : null
  const validSlot = Number.isInteger(slotIndex) && slotIndex >= 0 && slot?.id === original
  const targetId = custom ? search.get('customId') || exerciseId : exerciseId
  const ex = EXIDX[targetId] || S.customEx?.find(e => e.id === targetId) || (editing && !custom ? exOr(targetId) : null)
  const heading = useRef(null)
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }) }, [loc.pathname])
  const remember = useCallback(state => { rememberEntry(browsers, entryKey, state) }, [entryKey])
  const rememberDraft = useCallback(state => { rememberEntry(drafts, entryKey, state) }, [entryKey])
  const back = () => loc.state?.planBack ? nav(-1) : nav(root, { replace: true })
  const open = path => nav(path, { state: {
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
      if (editing || replacing) {
        const current = r.ex[slotIndex]
        if (!current || current.id !== original) return
        r.ex[slotIndex] = cfg
          ? { id: target.id, sg: current.sg, ...(current.sg ? { sgName: current.sgName, sgRest: current.sgRest } : {}), ...cfg }
          : replaceSlotExercise(current, target.id, live, id)
        cleanupSg(r.ex)
      } else r.ex.push({ id: target.id, ...(cfg || defaultConfig(target.id)) })
      done = true
    })
    if (!done) { notify(t('Too late, that one’s gone')); return false }
    notify(replacing ? t('Replaced with “{0}”', exerciseNameText(target))
      : editing ? t('Saved') : t('“{0}” added to {1}', exerciseNameText(target), routine.name))
    if (replacing) {
      const depth = exerciseId ? loc.state?.planReturn : loc.state?.planBack ? 1 : 0
      if (depth) nav(-depth)
      else nav(root, { replace: true })
    }
    return true
  }

  if (!routine) return <Navigate to="/plan" replace />
  if ((editing || replacing) && !validSlot) return <Navigate to={root} replace />
  if (exerciseId && !ex) return <Navigate to={root} replace />
  const title = custom ? t(ex ? 'Edit' : 'Create your own exercise')
    : t(editing ? 'Edit' : replacing ? 'Replace exercise' : 'Add exercise')
  return <div className="narrow plan-exercise-page">
    <div className="hdr">
      <button className="iconbtn" aria-label={t('Back')} onClick={back}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}>
        <h1 ref={heading} tabIndex={-1} style={{ fontSize: 22 }}>{title}</h1>
        <div className="small dim">{routine.name}</div>
      </div>
    </div>
    {custom ? <CustomExForm key={entryKey} existing={ex} prefill={loc.state?.query} close={() => {}}
      onDone={created => {
        if (ex) back()
        else nav(`${picker}/${encodeURIComponent(created.id)}${loc.search}`, { replace: true, state: loc.state })
      }}
      onDelete={target => deleteCustomEx(target, () => nav(root, { replace: true }))} />
      : exerciseId ? <ExConfig key={entryKey} ex={ex} existing={editing ? slot : replacing ? replaceSlotExercise(slot, ex.id, S, id) : null}
        routine={routine} allowVariants close={() => {}} draft={drafts.get(entryKey)} onDraftChange={rememberDraft}
        onSave={(cfg, selected) => { if (save(selected || ex, cfg) && !replacing) back() }}
        saveLabel={replacing ? t('Replace') : undefined}
        onCustomEdit={target => {
          const params = new URLSearchParams(search)
          params.set('customId', target.id)
          open(`${loc.pathname}/custom?${params}`)
        }}
        onDelete={editing ? () => { removeRoutineExercise(id, slotIndex); back() } : undefined}
        onReplace={editing ? () => nav(`${picker}?slot=${slotIndex}&original=${encodeURIComponent(original)}`, { replace: true, state: loc.state }) : undefined} />
        : <ExerciseBrowser key={entryKey} picking routineId={id} like={replacing ? original : undefined}
          initialState={browsers.get(entryKey)} onStateChange={remember}
          onOpen={target => open(`${picker}/${encodeURIComponent(target.id)}${loc.search}`)}
          onAdd={target => {
            if (replacing && target.id === original) { back(); return }
            save(target)
          }}
          onCreate={query => nav(`${picker}/new${loc.search}`, { state: {
            planBack: loc.pathname + loc.search, planReturn: loc.state?.planBack ? 2 : 0, query,
          } })} />}
  </div>
}
