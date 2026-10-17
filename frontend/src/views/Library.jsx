import ExerciseBrowser from '../components/ExerciseBrowser.jsx'
import { t } from '../lib/i18n.js'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'

export default function Library() {
  return <>
    <div className="hdr lib-hdr"><div><h1>{t('Exercises')}</h1></div></div>
    <ExerciseBrowser onOpen={exerciseDetailSheet} onAdd={addToRoutineSheet}
      onCreate={query => customExSheet(null, exerciseDetailSheet, query)} />
  </>
}
