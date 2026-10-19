import { useState } from 'react'
import { Button, Section, Row, Switch } from '../src/components/ui.jsx'
import Icon from '../src/components/Icon.jsx'

export default {
  title: 'Components/Surfaces',
  parameters: { docs: { description: { component: 'Cards and tags are existing CSS primitives (.card, .tag), not standalone React components. Grouped lists use the real Section and Row exports from ui.jsx.' } } }
}

export function Cards() {
  return <div className="og-stack og-narrow">
    <div className="card"><h2>Body weight</h2><div className="big">82.5 <span className="muted">kg</span></div><div className="divider" /><p className="small muted">Existing .card, .big and .divider styles</p></div>
    <div className="card"><h2>Upper body</h2><p>3 exercises / 9 sets</p><div className="og-wrap" style={{ marginBlock: 16 }}><span className="tag">barbell</span><span className="tag acc">strength</span></div><Button variant="tinted" icon="play">Start workout</Button></div>
  </div>
}

export function GroupedList() {
  const [enabled, setEnabled] = useState(true)
  const [selected, setSelected] = useState(false)
  return <div className="og-narrow">
    <Section title="Shared rows" footer="Static, subtitle, value, checkmark, switch and danger presentations. Selecting the workout row only toggles its checkmark here.">
      <Row icon="person" title="Account" subtitle="Secondary text" value="Local example" />
      <Row icon="dumbbell" title="Workout" value={selected ? 'Selected' : 'Choose'} accessory={selected ? 'check' : 'chevron'} onClick={() => setSelected(value => !value)} />
      <Row icon="bell" title="Reminders"><Switch checked={enabled} onChange={setEnabled} aria-label="Reminders" /></Row>
      <Row icon="trash" iconTint="var(--red)" title="Danger row" subtitle="Presentation only; nothing is deleted" danger />
    </Section>
  </div>
}

export function Tags() {
  return <div className="og-stack">
    <p className="og-note">Exercise metadata capitalizes by default. Units and sentences opt out with .nocap. Tags are informational, not buttons.</p>
    <div className="og-wrap">
      <span className="tag">barbell</span><span className="tag">upper body</span><span className="tag acc">strength</span>
      <span className="tag nocap">60 kg</span><span className="tag acc nocap"><Icon name="check" />Completed</span>
    </div>
  </div>
}
