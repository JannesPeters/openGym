import { Component, createRef } from 'react'

// A layout-effect cleanup is too late to measure the old DOM. React's snapshot lifecycle
// brackets the collapse itself, including changes made while the Layout sheet locks the body.
export default class WorkoutScrollAnchor extends Component {
  root = createRef()
  motions = new Map()

  componentDidMount() {
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    this.reducedMotion?.addEventListener?.('change', this.motionPreferenceChanged)
  }

  componentWillUnmount() {
    this.reducedMotion?.removeEventListener?.('change', this.motionPreferenceChanged)
    this.stopMotion()
  }

  motionPreferenceChanged = () => {
    if (!this.reducedMotion.matches) return
    const anchor = this.motionAnchor
    this.stopMotion()
    this.restoreAnchor(anchor)
  }

  releaseAnchor = () => { this.motionAnchor = null }

  stopMotion() {
    if (this.frame != null) window.cancelAnimationFrame(this.frame)
    this.frame = null
    window.removeEventListener('wheel', this.releaseAnchor)
    window.removeEventListener('touchmove', this.releaseAnchor)
    window.removeEventListener('keydown', this.releaseAnchor)
    for (const [element, { animation, overflow }] of this.motions) {
      animation.onfinish = animation.oncancel = null
      animation.cancel()
      element.style.overflow = overflow
    }
    this.motions.clear()
    this.motionAnchor = null
  }

  getSnapshotBeforeUpdate(prev) {
    if (prev.collapsed === this.props.collapsed && !this.motions.size) return null
    const root = this.root.current
    const heights = new Map([...root.querySelectorAll('.wl-unit')].map(element => [element, element.getBoundingClientRect().height]))
    const top = Math.max(0, root.querySelector('.whdr')?.getBoundingClientRect().bottom || 0)
    const collapsing = new Set(this.props.collapsed.split(',').filter(k => !prev.collapsed.split(',').includes(k)))
    const visible = [...root.querySelectorAll('.wl-unit')].filter(el => {
      const rect = el.getBoundingClientRect()
      return rect.bottom > top && rect.top < window.innerHeight
    })
    // If the content at the top is itself disappearing, hold the next surviving tile in
    // place instead. A summary already collapsed is a perfectly good anchor too.
    const anchor = visible.find(el => !collapsing.has(el.dataset.unitKey)) || visible[0]
    return { anchor, top: anchor?.getBoundingClientRect().top, heights }
  }

  componentDidUpdate(prev, state, snapshot) {
    if (!this.props.animate && this.motions.size) this.stopMotion()
    if (!snapshot) return
    // Cancel before measuring the new natural height. Reversals start at the currently painted
    // height from the snapshot, not the previous animation's destination.
    this.stopMotion()
    if (this.props.animate && !this.reducedMotion?.matches) {
      for (const [element, from] of snapshot.heights) {
        if (!element.isConnected || typeof element.animate !== 'function') continue
        const to = element.getBoundingClientRect().height
        if (!from || !to || Math.abs(from - to) < 1) continue
        const overflow = element.style.overflow
        element.style.overflow = 'clip'
        const animation = element.animate([{ height: `${from}px` }, { height: `${to}px` }], {
          duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)',
        })
        this.motions.set(element, { animation, overflow })
        animation.onfinish = animation.oncancel = () => {
          element.style.overflow = overflow
          this.motions.delete(element)
          if (!this.motions.size) {
            this.restoreAnchor(this.motionAnchor)
            this.stopMotion()
          }
        }
      }
    }
    this.motionAnchor = this.motions.size ? snapshot : null
    this.restoreAnchor(snapshot)
    if (this.motions.size) {
      // Keep the same visible exercise in place throughout the height change, not just at its
      // destination. A deliberate user scroll releases the anchor without stopping the motion.
      window.addEventListener('wheel', this.releaseAnchor, { passive: true })
      window.addEventListener('touchmove', this.releaseAnchor, { passive: true })
      window.addEventListener('keydown', this.releaseAnchor)
      const follow = () => {
        this.restoreAnchor(this.motionAnchor)
        this.frame = this.motions.size ? window.requestAnimationFrame(follow) : null
      }
      this.frame = window.requestAnimationFrame(follow)
    }
  }

  restoreAnchor(snapshot) {
    if (!snapshot?.anchor) return
    const root = this.root.current
    if (!snapshot.anchor.isConnected) { root.style.paddingBottom = ''; return }
    const body = document.body
    const locked = body.style.position === 'fixed'
    const delta = snapshot.anchor.getBoundingClientRect().top - snapshot.top
    const y = locked ? -(parseFloat(body.style.top) || 0) : window.scrollY
    const target = Math.max(0, y + delta)
    // At the page start, let the list close up rather than inserting a gap to hold
    // the next tile at a position that would require a negative scroll offset.
    // Collapsing near the page end can clamp scrollY before we restore it. Keep only the
    // trailing space needed to hold this viewport; a later expansion can reclaim it.
    const oldSpace = parseFloat(root.style.paddingBottom) || 0
    const height = Math.max(body.scrollHeight, document.documentElement.scrollHeight) - oldSpace
    const space = Math.max(0, target + window.innerHeight - height)
    root.style.paddingBottom = space ? `${space}px` : ''
    if (locked) body.style.top = `${-target}px`
    else if (delta || oldSpace !== space) {
      // Cancel a sheet's delayed keyboard correction before it can undo this newer anchor.
      window.dispatchEvent(new Event('workout-scroll-anchor'))
      window.scrollTo({ top: target, left: window.scrollX, behavior: 'instant' })
    }
  }

  render() {
    return <div ref={this.root} className="narrow" style={{ overflowAnchor: this.props.enabled ? 'none' : undefined }}>{this.props.children}</div>
  }
}
