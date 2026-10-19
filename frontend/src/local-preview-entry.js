import { claimPreviewOrigin } from './lib/local-preview.js'

try {
  await claimPreviewOrigin(localStorage, location.hostname)
  await import('./main.jsx')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  document.getElementById('root').textContent = `Local preview could not start: ${message}`
  console.error(error)
}
