import { Button, Row, Section, Switch } from '../src/components/ui.jsx'
import Icon from '../src/components/Icon.jsx'
import { useState } from 'react'

export default {
  title: 'Design system/Foundations',
  parameters: {
    docs: { description: { component: 'Live examples of the existing app stylesheet, not a separate UI kit. Use the theme, accent and direction toolbar controls on every story. No backend, account or exercise media is needed.' } }
  }
}

export function Overview() {
  const [reminders, setReminders] = useState(true)
  return <div className="og-stack">
    <header className="og-intro">
      <h1>openGym design system</h1>
      <p>The actual shared controls and CSS primitives, in isolation. Change dark/light mode, all eight accents and layout direction in the toolbar.</p>
    </header>
    <div className="card">
      <h2>Card / training summary</h2>
      <div className="big">Ready to train</div>
      <p className="small muted" style={{ marginBlock: 12 }}>Neutral surfaces, a single accent, hairline separators and quiet motion.</p>
      <div className="og-wrap"><span className="tag">strength</span><span className="tag acc">upper body</span></div>
    </div>
    <Section title="Grouped rows" footer="This switch uses story-local state; it does not change your app settings.">
      <Row icon="bell" title="Reminders" subtitle="A reusable control inside a real shared row">
        <Switch checked={reminders} onChange={setReminders} aria-label="Reminders" />
      </Row>
      <Row icon="dumbbell" title="Workout" value="3 exercises" />
    </Section>
    <Button variant="primary" icon="play" onClick={() => setReminders(value => !value)}>Try the controls</Button>
    <p className="og-note"><Icon name="lock" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> No app store, local workout data, API, authentication or service worker is started here. Store-bound pickers, modals and full screens are intentionally outside this initial gallery.</p>
  </div>
}

const colorGroups = {
  Surfaces: ['bg', 'bg-el', 'surface', 'surface-2', 'surface-3'],
  Labels: ['label', 'label-2', 'label-3', 'label-4'],
  Accent: ['acc', 'acc-2', 'on-acc', 'acc-soft', 'acc-line'],
  Palette: ['blue', 'green', 'red', 'orange', 'yellow', 'teal', 'indigo', 'pink', 'purple', 'mint', 'brown', 'grey'],
  Separators: ['sep', 'sep-op']
}

export function Colors() {
  return <div className="og-stack">
    <header className="og-intro"><h1>Color tokens</h1><p>Every swatch reads the live CSS custom property. Theme and accent values are defined only in src/index.css.</p></header>
    {Object.entries(colorGroups).map(([title, tokens]) => <Section key={title} title={title}>
      <div className="og-grid" style={{ padding: 12 }}>{tokens.map(token => <div key={token}>
        <div className="og-swatch" style={{ background: `var(--${token})` }} />
        <code className="og-token">--{token}</code>
      </div>)}</div>
    </Section>)}
  </div>
}

export function Typography() {
  return <div className="og-stack">
    <header className="og-intro"><h1>Typography in use</h1><p>The app uses the system font stack. It has no canonical heading/type-scale tokens: these are existing contextual classes, not a new scale.</p></header>
    <div className="hdr"><div><h1>Page heading</h1><p className="sub">.hdr h1 / .hdr .sub</p></div></div>
    <div className="card"><h2>Card label / .card h2</h2><div className="big">82.5 kg</div><p className="small muted" style={{ marginTop: 8 }}>Card metric / .card .big</p></div>
    <p>Body copy / system font, 17px, tabular numbers: 0123456789</p>
    <p className="muted">Secondary label / .muted</p>
    <p className="dim">Tertiary label / .dim</p>
    <p className="small">Caption / .small</p>
    <Section title="Section heading / .sect-t" footer="Footer / .sect-f"><Row title="Row title" subtitle="Row subtitle" value="Value" /></Section>
  </div>
}

export function GeometryAndMotion() {
  return <div className="og-stack">
    <header className="og-intro"><h1>Geometry and motion</h1><p>Radii, spacing and motion come from the existing root tokens. Press a button to see the shared active treatment; the stylesheet respects reduced motion.</p></header>
    <div className="og-grid">{['r-sm', 'r', 'r-lg', 'r-xl', 'r-card'].map(token => <div key={token}>
      <div className="og-radius" style={{ borderRadius: `var(--${token})` }} /><code className="og-token">--{token}</code>
    </div>)}</div>
    <div className="og-sample"><p className="small">Inset uses <code>--pad</code></p><div style={{ padding: 'var(--pad)' }}><Button variant="tinted">Press and hold</Button></div></div>
    <div className="divider" />
    <p className="og-note">Separator: --hair / --sep. Motion: --fast (140ms), --med (220ms), --ease. Icon strokes: --icon-stroke.</p>
  </div>
}
