const CHECK_INTERVAL_MS = 60_000
const listeners = new Set()
let state = { checking: false, available: false }
let registration = null
let pending = null
let lastCheck = -Infinity
let stop = null

export const webUpdatesSupported = () => typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator && typeof location !== 'undefined' && location.protocol === 'https:'
export const getWebUpdate = () => state
export const subscribeWebUpdate = listener => { listeners.add(listener); return () => listeners.delete(listener) }
const setState = patch => {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function waitForActivation(worker) {
  if (!worker) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const changed = () => {
      if (worker.state !== 'activated' && worker.state !== 'redundant') return
      worker.removeEventListener('statechange', changed)
      if (worker.state === 'redundant') reject(new Error('Web app update could not be installed'))
      else resolve()
    }
    worker.addEventListener('statechange', changed)
    changed()
  })
}

export function checkForWebUpdate() {
  if (pending) return pending
  if (!webUpdatesSupported()) return Promise.reject(new Error('Web app updates require HTTPS and service worker support'))
  const previous = navigator.serviceWorker.controller
  lastCheck = Date.now()
  setState({ checking: true })
  pending = (async () => {
    if (!registration) registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    // Finding an existing registration does not guarantee a successful network check.
    await registration.update()
    await waitForActivation(registration.installing)
    if (previous && registration.active && registration.active !== previous) setState({ available: true })
    return state.available
  })().finally(() => {
    pending = null
    setState({ checking: false })
  })
  return pending
}

export function startWebUpdates() {
  if (stop) return stop
  if (!webUpdatesSupported()) return () => {}
  const sw = navigator.serviceWorker
  let controller = sw.controller
  const changed = () => {
    const next = sw.controller
    if (controller && next && next !== controller) setState({ available: true })
    controller = next
  }
  const check = () => {
    checkForWebUpdate().catch(error => console.warn('openGym: could not check for web app updates', error))
  }
  const resumed = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck >= CHECK_INTERVAL_MS) check()
  }
  sw.addEventListener('controllerchange', changed)
  document.addEventListener('visibilitychange', resumed)
  window.addEventListener('pageshow', resumed)
  window.addEventListener('online', check)
  stop = () => {
    sw.removeEventListener('controllerchange', changed)
    document.removeEventListener('visibilitychange', resumed)
    window.removeEventListener('pageshow', resumed)
    window.removeEventListener('online', check)
    stop = null
  }
  check()
  return stop
}
