import { useLayoutEffect } from 'react'
import '../src/index.css'
import './preview.css'

function Preview({ children, theme, accent, direction }) {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.accent = accent
    root.dir = direction
    root.lang = 'en'
    return () => {
      delete root.dataset.theme
      delete root.dataset.accent
      root.removeAttribute('dir')
      root.removeAttribute('lang')
    }
  }, [theme, accent, direction])
  return <main className="og-preview">{children}</main>
}

export default {
  initialGlobals: { theme: 'dark', accent: 'lime', direction: 'ltr' },
  globalTypes: {
    theme: {
      description: 'App color theme',
      toolbar: { icon: 'mirror', dynamicTitle: true, items: ['dark', 'light'] }
    },
    accent: {
      description: 'App accent color',
      toolbar: { icon: 'paintbrush', dynamicTitle: true, items: ['lime', 'sky', 'orange', 'violet', 'pink', 'red', 'teal', 'gold'] }
    },
    direction: {
      description: 'Layout direction (sample text stays English)',
      toolbar: { icon: 'globe', dynamicTitle: true, items: ['ltr', 'rtl'] }
    }
  },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    options: { storySort: { order: ['Design system', 'Components'] } },
    docs: { toc: true }
  },
  decorators: [
    (Story, context) => (
      <Preview theme={context.globals.theme} accent={context.globals.accent} direction={context.globals.direction}>
        <Story />
      </Preview>
    )
  ]
}
