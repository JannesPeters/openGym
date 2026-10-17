import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class Worker extends EventTarget {
  constructor(state = 'activated') { super(); this.state = state }
  change(state) { this.state = state; this.dispatchEvent(new Event('statechange')) }
}

let updates, sw, registration, stop, doc, win, reload
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  sw = new EventTarget()
  sw.controller = new Worker()
  registration = { active: sw.controller, installing: null, update: vi.fn(async () => {}) }
  sw.register = vi.fn(async () => registration)
  doc = new EventTarget()
  doc.visibilityState = 'visible'
  win = new EventTarget()
  reload = vi.fn()
  vi.stubGlobal('navigator', { serviceWorker: sw })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', win)
  vi.stubGlobal('location', { protocol: 'https:', reload })
  updates = await import('./web-update.js')
})
afterEach(() => {
  stop?.()
  stop = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
const start = async () => {
  stop = updates.startWebUpdates()
  await updates.checkForWebUpdate()
  registration.update.mockClear()
}

describe('web app update lifecycle', () => {
  it('registers the same relative worker with HTTP-cache bypass, without treating startup as an update', async () => {
    await start()
    expect(sw.register).toHaveBeenCalledExactlyOnceWith('sw.js', { updateViaCache: 'none' })
    expect(updates.getWebUpdate()).toEqual({ checking: false, available: false })
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not offer a reload when a first install claims an uncontrolled document', async () => {
    sw.controller = null
    await start()
    sw.controller = registration.active
    sw.dispatchEvent(new Event('controllerchange'))
    expect(updates.getWebUpdate().available).toBe(false)
  })

  it('notifies subscribers when a new worker takes control, but never reloads an editing screen', async () => {
    await start()
    const listener = vi.fn()
    const unsubscribe = updates.subscribeWebUpdate(listener)
    sw.controller = new Worker()
    sw.dispatchEvent(new Event('controllerchange'))
    expect(listener).toHaveBeenCalledOnce()
    expect(updates.getWebUpdate().available).toBe(true)
    expect(reload).not.toHaveBeenCalled()
    unsubscribe()
    sw.controller = new Worker()
    sw.dispatchEvent(new Event('controllerchange'))
    expect(listener).toHaveBeenCalledOnce()
  })

  it('checks on foreground and pageshow, coalesces rapid events, and skips hidden pages', async () => {
    await start()
    vi.advanceTimersByTime(60_000)
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    win.dispatchEvent(new Event('pageshow'))
    await updates.checkForWebUpdate()
    expect(registration.update).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(60_000)
    win.dispatchEvent(new Event('pageshow'))
    await updates.checkForWebUpdate()
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('explicit checks and reconnection do not wait for the foreground throttle', async () => {
    await start()
    await updates.checkForWebUpdate()
    expect(registration.update).toHaveBeenCalledOnce()
    win.dispatchEvent(new Event('online'))
    await updates.checkForWebUpdate()
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('shares in-flight checks and waits for activation rather than saying up to date during install', async () => {
    await start()
    const worker = new Worker('installing')
    registration.update.mockImplementation(async () => { registration.installing = worker })
    const check = updates.checkForWebUpdate()
    expect(updates.checkForWebUpdate()).toBe(check)
    await Promise.resolve()
    worker.change('installed')
    expect(updates.getWebUpdate()).toEqual({ checking: true, available: false })
    registration.active = worker
    worker.change('activated')
    await expect(check).resolves.toBe(true)
    expect(registration.update).toHaveBeenCalledOnce()
    expect(updates.getWebUpdate()).toEqual({ checking: false, available: true })
    expect(reload).not.toHaveBeenCalled()
  })

  it('surfaces a failed install and leaves the running build usable', async () => {
    await start()
    const previous = registration.active
    const worker = new Worker('installing')
    registration.update.mockImplementation(async () => { registration.installing = worker })
    const check = updates.checkForWebUpdate()
    await Promise.resolve()
    worker.change('redundant')
    await expect(check).rejects.toThrow('could not be installed')
    expect(updates.getWebUpdate()).toEqual({ checking: false, available: false })
    expect(registration.active).toBe(previous)
    expect(reload).not.toHaveBeenCalled()
  })

  it('logs background failures and retries registration when the network returns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sw.register.mockRejectedValueOnce(new Error('offline'))
    stop = updates.startWebUpdates()
    await expect(updates.checkForWebUpdate()).rejects.toThrow('offline')
    expect(warn).toHaveBeenCalledWith('openGym: could not check for web app updates', expect.any(Error))
    win.dispatchEvent(new Event('online'))
    await updates.checkForWebUpdate()
    expect(sw.register).toHaveBeenCalledTimes(2)
    expect(updates.getWebUpdate().available).toBe(false)
  })

  it('does not mistake finding an existing registration for a successful network check', async () => {
    registration.update.mockRejectedValueOnce(new Error('offline'))
    await expect(updates.checkForWebUpdate()).rejects.toThrow('offline')
    expect(sw.register).toHaveBeenCalledOnce()
    expect(registration.update).toHaveBeenCalledOnce()
    expect(updates.getWebUpdate()).toEqual({ checking: false, available: false })
  })

  it('removes resume listeners on cleanup and does not register on unsupported origins', async () => {
    await start()
    stop()
    vi.advanceTimersByTime(60_000)
    doc.dispatchEvent(new Event('visibilitychange'))
    win.dispatchEvent(new Event('online'))
    expect(registration.update).not.toHaveBeenCalled()
    location.protocol = 'http:'
    expect(updates.webUpdatesSupported()).toBe(false)
    await expect(updates.checkForWebUpdate()).rejects.toThrow('require HTTPS')
    updates.startWebUpdates()
    expect(sw.register).toHaveBeenCalledOnce()
  })
})
