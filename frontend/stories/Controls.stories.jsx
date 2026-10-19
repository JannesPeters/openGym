import { useState } from 'react'
import { TextField, TextArea, SearchField, NumberField, Switch, Segmented, Stepper, Slider, Check } from '../src/components/ui.jsx'

export default {
  title: 'Components/Controls',
  parameters: { docs: { description: { component: 'Existing controlled components from ui.jsx. Examples keep their state inside the story and reset when you navigate away. SelectRow, SelectButton and MultiSelectRow are omitted: their sheets require bindUI and the app modal host.' } } }
}

export function TextFields() {
  const [name, setName] = useState('Upper body')
  const [notes, setNotes] = useState('')
  return <div className="og-stack og-narrow">
    <label className="og-label">Routine name<TextField value={name} onChange={event => setName(event.target.value)} /></label>
    <label className="og-label">Notes<TextArea value={notes} onChange={event => setNotes(event.target.value)} placeholder="How did it feel?" /></label>
    <label className="og-label">Disabled field<TextField value="Read-only example" disabled /></label>
  </div>
}

export function Search() {
  const [query, setQuery] = useState('')
  return <div className="og-stack og-narrow">
    <SearchField aria-label="Find an exercise" placeholder="Find an exercise" value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery('')} />
    <p className="og-note" role="status">{query ? `Search text: ${query}` : 'Type to reveal the clear button. No catalogue or network search is started.'}</p>
  </div>
}

export function Numbers() {
  const [weight, setWeight] = useState(62.5)
  const [effort, setEffort] = useState(null)
  return <div className="og-stack og-narrow">
    <label className="og-label">Weight (kg)<NumberField className="og-number" aria-label="Weight in kg" value={weight} onChange={setWeight} /></label>
    <label className="og-label">Optional reps in reserve<NumberField className="og-number" value={effort} onChange={setEffort} decimal={false} nullable placeholder="Not logged" /></label>
    <p className="og-note">Decimals accept a comma or a period. Clearing the optional field keeps null, distinct from 0.</p>
  </div>
}

export function Switches() {
  const [checked, setChecked] = useState(true)
  return <div className="og-stack">
    <div className="og-wrap"><Switch checked={checked} onChange={setChecked} aria-label="Reminders" /><span>Reminders {checked ? 'on' : 'off'}</span></div>
    <div className="og-wrap"><Switch compact checked={checked} onChange={setChecked} aria-label="Compact reminders" /><span>Compact</span></div>
    <div className="og-wrap"><Switch checked={false} onChange={setChecked} disabled aria-label="Disabled off" /><Switch checked onChange={setChecked} disabled aria-label="Disabled on" /><span>Disabled states</span></div>
  </div>
}

export function SegmentedControl() {
  const [value, setValue] = useState('cards')
  return <div className="og-stack og-narrow">
    <Segmented value={value} onChange={setValue} options={[{ value: 'cards', label: 'Cards', icon: 'layout' }, { value: 'list', label: 'List', icon: 'list' }, { value: 'compact', label: 'Compact', icon: 'compact' }]} />
    <p className="og-note" role="status">Selected: {value}</p>
  </div>
}

export function Steppers() {
  const [weight, setWeight] = useState(62.5)
  const [reps, setReps] = useState(8)
  return <div className="og-stack og-narrow">
    <Stepper label="Weight" ariaLabel="weight" unit="kg" value={weight} onChange={setWeight} step={2.5} min={0} max={200} />
    <Stepper label="Reps" ariaLabel="reps" value={reps} onChange={setReps} decimal={false} min={1} max={30} />
    <Stepper label="Disabled" ariaLabel="disabled weight" unit="kg" value={weight} onChange={setWeight} disabled />
    <p className="og-note">Tap or hold +/-. Typed values clamp on blur; weight is bounded to 0-200 kg and reps to 1-30.</p>
  </div>
}

export function Sliders() {
  const [value, setValue] = useState(90)
  return <div className="og-stack og-narrow">
    <p>Rest duration: <output>{value} seconds</output></p>
    <Slider value={value} onChange={setValue} min={0} max={180} step={15} />
    <Slider value={60} onChange={setValue} min={0} max={180} disabled />
    <p className="og-note">Drag the track or focus it and use the arrow keys. Direction follows the toolbar. Second slider is disabled.</p>
  </div>
}

export function Checkboxes() {
  const [checked, setChecked] = useState(false)
  return <div className="og-wrap"><Check checked={checked} onChange={setChecked} label="Set complete" /><span>{checked ? 'Set complete' : 'Mark set complete'}</span></div>
}
