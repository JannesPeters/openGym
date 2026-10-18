import { claimPreviewOrigin } from './lib/local-preview.js'

try {
  claimPreviewOrigin(localStorage, location.hostname)
  await import('./main.jsx')
} catch (error) {
  document.getElementById('root').textContent = `Local preview could not start: ${error.message}`
  console.error(error)
}
