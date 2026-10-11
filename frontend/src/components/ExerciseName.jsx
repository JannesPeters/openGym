import { exerciseNameClass, exerciseTitleFor } from '../lib/i18n.js'
import { variantLabelOf } from '../lib/exercises.js'

export default function ExerciseName({ ex, className, style }) {
  const label = variantLabelOf(ex)
  const classes = [className, exerciseNameClass(ex)].filter(Boolean).join(' ')
  return <span className={classes || undefined} style={style}>
    {exerciseTitleFor(ex)}
    {label && <><span> </span><span className="tag ex-variant-meta">{label}</span></>}
  </span>
}
