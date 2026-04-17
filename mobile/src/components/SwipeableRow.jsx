import { useRef, useEffect } from 'react'

export default function SwipeableRow({ children, rightActions, actionsWidth = 90 }) {
  const rowRef = useRef(null)
  const contentRef = useRef(null)
  const snapped = useRef(false)

  useEffect(() => {
    const row = rowRef.current, content = contentRef.current
    if (!row || !content) return
    const g = { active: false, startX: 0, startY: 0, curX: 0, dir: null }

    const translate = (x, animated = false) => {
      if (animated) {
        content.style.transition = 'transform 0.2s ease-out'
        setTimeout(() => { if (content) content.style.transition = '' }, 220)
      }
      content.style.transform = `translateX(${x}px)`
      g.curX = x
    }

    const snap = (reveal) => {
      snapped.current = reveal
      translate(reveal ? -actionsWidth : 0, true)
    }

    const onStart = (e) => {
      g.active = true
      g.startX = e.touches[0].clientX
      g.startY = e.touches[0].clientY
      g.curX = snapped.current ? -actionsWidth : 0
      g.dir = null
      if (content) content.style.transition = ''
    }

    const onMove = (e) => {
      if (!g.active) return
      const dx = e.touches[0].clientX - g.startX
      const dy = e.touches[0].clientY - g.startY
      if (!g.dir) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        g.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      if (g.dir === 'v') { g.active = false; return }
      e.preventDefault()
      translate(Math.max(-actionsWidth, Math.min(0, (snapped.current ? -actionsWidth : 0) + dx)))
    }

    const onEnd = () => {
      if (!g.active || g.dir !== 'h') return
      g.active = false
      snap(g.curX < -actionsWidth * 0.35)
    }

    row.addEventListener('touchstart', onStart, { passive: true })
    row.addEventListener('touchmove', onMove, { passive: false })
    row.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      row.removeEventListener('touchstart', onStart)
      row.removeEventListener('touchmove', onMove)
      row.removeEventListener('touchend', onEnd)
    }
  }, [actionsWidth])

  return (
    <div ref={rowRef} className="relative overflow-hidden">
      <div className="absolute right-0 inset-y-0 flex" style={{ width: actionsWidth }}>
        {rightActions}
      </div>
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  )
}
