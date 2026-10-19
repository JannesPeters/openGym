import { Button } from '../src/components/ui.jsx'
import Icon from '../src/components/Icon.jsx'
import { useState } from 'react'

export default {
  title: 'Components/Buttons',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Start workout', variant: 'primary', disabled: false },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'tinted', 'plain', 'ghost', 'danger'] },
    size: { control: 'select', options: [undefined, 'sm', 'xs'] },
    icon: { control: 'select', options: [undefined, 'play', 'plus', 'check', 'trash'] },
    trailingIcon: { control: 'select', options: [undefined, 'chevronRight', 'chevronDown'] },
    onClick: { action: 'clicked' }
  },
  parameters: { docs: { description: { component: 'Button is the shared React control from ui.jsx. Icon-only buttons below use the existing .iconbtn CSS primitive and Icon, exactly as the app does.' } } }
}

export const Playground = {}

export const Variants = {
  render: args => <div className="og-stack">
    {['primary', 'tinted', 'plain', 'ghost', 'danger'].map(variant => <Button key={variant} {...args} variant={variant}>{variant}</Button>)}
    <Button {...args} disabled>Disabled</Button>
  </div>
}

export const Sizes = {
  render: args => <div className="og-stack">
    <Button {...args}>Default / full width</Button>
    <div className="og-wrap"><Button {...args} size="sm">Small</Button><Button {...args} size="xs">Extra small</Button></div>
    <Button {...args} icon="plus" trailingIcon="chevronRight">With icons</Button>
  </div>
}

export const IconButtons = {
  render: function IconButtonsStory() {
    const [selected, setSelected] = useState(false)
    return <div className="og-stack">
      <p className="og-note">These are real .iconbtn elements, not a separate IconButton component. The selected button is interactive.</p>
      <div className="og-wrap">
        <button className="iconbtn" aria-label="Add exercise"><Icon name="plus" /></button>
        <button className="iconbtn" aria-label="Edit routine"><Icon name="pencil" /></button>
        <button className={'iconbtn' + (selected ? ' on-ss' : '')} aria-label="Select exercise" aria-pressed={selected} onClick={() => setSelected(value => !value)}><Icon name="check" /></button>
        <button className="iconbtn" aria-label="Delete routine" disabled><Icon name="trash" /></button>
      </div>
    </div>
  }
}
