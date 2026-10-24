import BodyMap from './BodyMap.jsx'
import { Button, SheetDialog } from './ui.jsx'
import { useUI } from '../store/useUI.js'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import { hasOptions } from '../lib/exercise-options.js'
import { t } from '../lib/i18n.js'
import { useStore } from '../store/useStore.js'

export default function RoutineMuscleMap({ routine, body, state }) {
  const stored = useStore(s => s.S)
  const load = loadOfRoutine(routine, {}, state || stored)
  const { worked } = rankOf(load)
  const title = t('What this session hits')
  const chips = <div className="mchips">
    {worked.slice(0, 6).map(m => <span key={m} className="mchip">{t(MUSCLE_NAME[m])}</span>)}
  </div>
  const note = routine.ex.some(hasOptions) && <p className="small dim">
    {t('Planned muscle coverage averages all options in each group. Your workout statistics use the exercises you actually perform.')}
  </p>
  const expand = event => {
    const trigger = event.currentTarget
    useUI.getState().openSheet(close => <div className="routine-muscle-viewer">
      <SheetDialog title={title} trigger={trigger}>
        <div className="routine-muscle-bar">
          <h2>{title}</h2>
          <Button size="sm" icon="xmark" onClick={close}>{t('Close')}</Button>
        </div>
        <BodyMap load={load} body={body} />
        {chips}
        {note}
      </SheetDialog>
    </div>, { kind: 'viewer' })
  }
  return <div className="card routine-muscle-card" role="group" aria-label={title}>
    <BodyMap load={load} body={body} />
    <div className="routine-muscle-summary">
      <Button size="sm" variant="ghost" icon="expand" aria-haspopup="dialog"
        aria-label={`${t('Expand')}: ${title}`} onClick={expand}>{t('Expand')}</Button>
      {chips}
    </div>
  </div>
}
