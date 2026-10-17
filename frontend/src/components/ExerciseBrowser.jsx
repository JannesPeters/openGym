import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { EXIDX, allExercises, equipmentOf, byCategory, searchExercises, similarExercises, groupExerciseVariants } from '../lib/exercises.js'
import { MUSCLES, MUSCLE_NAME, musclesOf, targetMuscleOf } from '../lib/muscles.js'
import { activeProfile, exAvailable } from '../lib/equipment.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum, exCount } from '../lib/format.js'
import { t, exerciseNameClass, exerciseNameFor } from '../lib/i18n.js'
import { Thumb } from './Media.jsx'
import ExerciseName from './ExerciseName.jsx'
import Icon from './Icon.jsx'
import ExerciseViewToggle from './ExerciseViewToggle.jsx'
import { Button, SelectButton, Segmented } from './ui.jsx'
import BodyMap from './BodyMap.jsx'
import { tappable, useSheetKeyboard } from '../lib/use-sheet-keyboard.js'
import { useAutoMore } from '../lib/use-auto-more.js'
import { isFav, sortFavouritesFirst, sortYoursFirst, usageOf } from '../lib/favourites.js'
import { sameMuscleFirst, swapMuscleOf } from '../lib/similar-exercises.js'

function MuscleFilterMenu({ value, body, onChange, close }) {
  const [view, setView] = useState('diagram')
  const pick = muscle => { close(); onChange(muscle) }
  return <>
    <h3>{t('Muscle')}</h3>
    <Segmented value={view} onChange={setView} options={[
      { value: 'diagram', label: t('Diagram') }, { value: 'list', label: t('List') },
    ]} />
    <Button size="sm" variant={!value ? 'tinted' : 'plain'} aria-pressed={!value}
      style={{ margin: '12px 0 8px' }} onClick={() => pick('')}>{t('All')}</Button>
    {view === 'diagram' ? <BodyMap body={body} selected={value} onMuscle={pick} /> :
      <div className="sect-b">{MUSCLES.map(m => <button key={m} className="lrow tap"
        aria-pressed={value === m} onClick={() => pick(m)}>
        <span className="lrow-m"><span className="lrow-t">{t(MUSCLE_NAME[m])}</span></span>
        {value === m && <Icon name="check" className="lrow-k" />}
      </button>)}</div>}
  </>
}

export default function ExerciseBrowser({ onOpen, onAdd, onCreate, picking = false, embedded = false, routineId, like, initialState = {}, onStateChange }) {
  const S = useStore(s => s.S)
  const all = allExercises(S)
  const usage = useMemo(() => usageOf(S), [S.routines, S.workouts])
  const profile = activeProfile(S)
  const likeEx = like ? EXIDX[like] || all.find(e => e.id === like) : null
  const likeTg = swapMuscleOf(likeEx) && sameMuscleFirst(all, likeEx).length ? swapMuscleOf(likeEx) : ''
  const [scope, setScope] = useState(() => initialState.scope ?? (likeTg && sameMuscleFirst(all, likeEx).some(e => !profile || exAvailable(S, e)) ? 'same' : ''))
  const [q, setQ] = useState(initialState.q || '')
  const [eq, setEq] = useState(initialState.eq || '')
  const [cat, setCat] = useState(initialState.cat || '')
  const [muscle, setMuscle] = useState(initialState.muscle || '')
  const [showAll, setShowAll] = useState(initialState.showAll || false)
  const pageSize = picking ? 50 : 40
  const [shown, setShown] = useState(initialState.shown || pageSize)
  useEffect(() => {
    onStateChange?.({ scope, q, eq, cat, muscle, showAll, shown })
  }, [scope, q, eq, cat, muscle, showAll, shown, onStateChange])
  const moreRef = useAutoMore(() => setShown(s => s + pageSize))
  const searchRef = useRef(null)
  const onSearchFocus = useSheetKeyboard(searchRef)
  const scoped = scope === 'same' ? sameMuscleFirst(all, likeEx)
    : scope === 'chosen' ? all.filter(e => usage[e.id])
    : scope === 'favourites' ? all.filter(e => isFav(S, e.id)) : all
  let searched = searchExercises(scoped, q)
  if (scope === 'chosen') searched = [...searched].sort((a, b) => usage[b.id] - usage[a.id] || exerciseNameFor(a).localeCompare(exerciseNameFor(b)))
  const inMuscle = muscle ? searched.filter(e => musclesOf(e)[muscle]) : searched
  // Kind of exercise (strength, stretching, cardio...), the same fallback as equipment below: a
  // choice the search or muscle has narrowed away is ignored for now, never a dead end.
  const { opts: catOpts, on: catOn, list: base } = byCategory(inMuscle, cat)
  const eqFiltered = (profile && !showAll) ? base.filter(e => exAvailable(S, e)) : base
  const eqOpts = equipmentOf(eqFiltered)
  // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
  const eqOn = eqOpts.includes(eq) ? eq : ''
  // Favourites float to the top of whatever the filters left (issue #6), the rest keeps its order;
  // while searching, the exercises you have logged or planned follow right after them.
  const narrowedList = eqOn ? eqFiltered.filter(e => e.eq === eqOn) : eqFiltered
  const ranked = q.trim() ? sortYoursFirst(narrowedList, S, usage) : sortFavouritesFirst(narrowedList, S)
  const f = groupExerciseVariants(scope === 'same' ? sameMuscleFirst(ranked, likeEx) : ranked)
  const routine = routineId ? S.routines.find(r => r.id === routineId) : null
  const selected = new Set((routine?.ex || []).map(e => e.id))
  const chosenCount = Object.keys(usage).length
  const favCount = (S.favEx || []).length
  const special = scope === 'chosen' || scope === 'favourites'
  // A live count at the end of the search field while a search or filter narrows the list
  // (idea and first version: GitLab !31) — how many are left, before scrolling to find out.
  const filtered = !!(eqOn || catOn || muscle || scope)
  const narrowed = !!(q.trim() || filtered)
  // Close but not exact (a typo too many, most of the words, a similar name), under the results
  // once they are all on screen, so a search almost never ends on "No match".
  // Worked out a beat behind the typing (useDeferredValue): the list itself never waits for it.
  const qLate = useDeferredValue(q)
  const similar = q.trim() && qLate === q && !special && f.length <= shown
    ? similarExercises(scoped.filter(e =>
      (!muscle || musclesOf(e)[muscle]) &&
      (!catOn || e.cat === catOn) && (!eqOn || e.eq === eqOn) &&
      (!profile || showAll || exAvailable(S, e))), q, f, f.length ? 12 : 30)
    : []
  const row = e => {
    const best = picking ? 0 : bestWeightFor(S, e.id)
    return <div key={e.id} className="item" {...tappable(() => onOpen(e))}>
      <Thumb ex={e} />
      <div className="grow"><div className={`tt ${exerciseNameClass(e)}`}>{isFav(S, e.id) && <Icon name="starFill" className="fav-star" />}<ExerciseName ex={e} /></div><div className="ss capitalize">{t(MUSCLE_NAME[targetMuscleOf(e)] || targetMuscleOf(e))} · {t(e.eq)}</div></div>
      {!picking && best > 0 && <span className="tag acc">{fmtNum(best)}</span>}
      {picking && (routineId ? selected.has(e.id) : usage[e.id]) && <span className="tag acc"
        aria-label={t('Chosen')} title={routine?.name || t('Chosen')}>
        <Icon name={routineId ? 'check' : 'starFill'} />{routineId && t('Chosen')}
      </span>}
      <Button size="sm" variant="tinted" icon="plus" aria-label={picking ? t('Add “{0}”', exerciseNameFor(e)) : t('Plan')}
        onClick={ev => { ev.stopPropagation(); onAdd(e) }} />
    </div>
  }

  return <>
    <div className={embedded ? 'picker-search' : undefined}>
    <div className="search-row" style={{ marginBottom: 10 }}><div className={'search' + (narrowed ? ' has-count' : '') + (q ? ' has-clear' : '')}><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input ref={searchRef} className="input" placeholder={embedded ? t('Search {0} exercises…', all.length) : t('Search…')} value={q}
        onFocus={embedded ? onSearchFocus : undefined} onChange={e => { setQ(e.target.value); setShown(pageSize) }} />
      {narrowed && <span className="search-count" role="status" aria-label={exCount(f.length)}>{fmtNum(f.length)}</span>}
      {q && <button className="clear" onClick={() => { setQ(''); setShown(pageSize) }} aria-label={t('Clear')}><Icon name="xmark" /></button>}</div>
      <ExerciseViewToggle /></div></div>
    {profile && <div className="small dim row" style={{ margin: '-4px 2px 10px', gap: 6, alignItems: 'center' }}>
      <Icon name="kettlebell" style={{ fontSize: 13 }} />
      {showAll ? t('Showing all equipment') : t('Showing what you have in "{0}"', profile.name)}
      <button className="chip nocap" style={{ marginInlineStart: 'auto', padding: '3px 10px', fontSize: 12 }} onClick={() => setShowAll(v => !v)}>
        {showAll ? t('Filter by "{0}"', profile.name) : t('Show all equipment')}
      </button>
    </div>}
    <div className="library-filters" role="group" aria-label={t('Filters')}>
      <SelectButton title={t('Muscle')} value={muscle}
        options={MUSCLES.map(m => ({ value: m, label: t(MUSCLE_NAME[m]) }))}
        renderSheet={close => <MuscleFilterMenu value={muscle} body={S.body} close={close}
          onChange={value => { setMuscle(value); setScope(''); setShown(pageSize) }} />} />
      <SelectButton title={t('Type')} value={catOn}
        options={[{ value: '', label: t('Any type') }, ...catOpts.map(x => ({ value: x, label: t(x) }))]}
        onChange={value => { setCat(value); setShown(pageSize) }} />
      <SelectButton title={t('Equipment')} value={eqOn}
        options={[{ value: '', label: t('Any equipment') }, ...eqOpts.map(x => ({ value: x, label: t(x) }))]}
        onChange={value => { setEq(value); setShown(pageSize) }} />
      {picking && likeTg && <Button size="sm" variant={scope === 'same' ? 'tinted' : 'plain'}
        aria-pressed={scope === 'same'} onClick={() => { setScope(scope === 'same' ? '' : 'same'); setMuscle(''); setShown(pageSize) }}>
        {t('Same muscle: {0}', t(MUSCLE_NAME[likeTg] || likeTg))}
      </Button>}
      {picking && favCount > 0 && <Button size="sm" variant={scope === 'favourites' ? 'tinted' : 'plain'} icon="starFill"
        aria-pressed={scope === 'favourites'} onClick={() => { setScope(scope === 'favourites' ? '' : 'favourites'); setEq(''); setShown(pageSize) }}>
        {t('Favourites')} ({favCount})
      </Button>}
      {picking && chosenCount > 0 && <Button size="sm" variant={scope === 'chosen' ? 'tinted' : 'plain'}
        aria-pressed={scope === 'chosen'} onClick={() => { setScope(scope === 'chosen' ? '' : 'chosen'); setEq(''); setShown(pageSize) }}>
        {t('Chosen')} ({chosenCount})
      </Button>}
      {filtered && <Button size="sm" variant="ghost"
        onClick={() => { setCat(''); setEq(''); setMuscle(''); setScope(''); setShown(pageSize) }}>{t('Reset')}</Button>}
    </div>
    <div className={'list' + (S.exerciseView === 'cards' ? ' ex-grid' : '')}>
      {!special && <div className="item ex-new" {...tappable(() => onCreate(q.trim()))}>
        <div className="thumb thumb-x"><Icon name="plusCircle" /></div>
        <div className="grow"><div className="tt">{t('Create your own exercise')}</div></div>
      </div>}
      {f.slice(0, shown).map(row)}
      {f.length === 0 && !similar.length && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>
        {scope === 'chosen' ? t('Nothing picked yet. Add some exercises and they’ll show up here.')
          : scope === 'favourites' ? t('No favourites yet. Tap the star on an exercise to add one.') : t('No match')}
      </div>}
      {similar.length > 0 && <h4 className="sec similar-label">{f.length ? t('Similar exercises') : t('No exact match. These come close:')}</h4>}
      {similar.map(row)}
    </div>
    {f.length > shown && <><div style={{ height: 10 }} /><Button ref={moreRef} onClick={() => setShown(s => s + pageSize)}>{t('Show more')}</Button></>}
  </>
}
