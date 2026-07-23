import { useRef, useState } from 'react'

function SwipeableCard({ children, actions = [], onSwipe }) {
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)
  const isDragging = useRef(false)

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    isDragging.current = true
  }

  const handleTouchMove = (e) => {
    if (!isDragging.current) return
    const diff = startX.current - e.touches[0].clientX
    const clamped = Math.max(-80, Math.min(80, diff))
    setOffset(clamped)
  }

  const handleTouchEnd = () => {
    isDragging.current = false
    if (Math.abs(offset) > 40 && actions.length > 0) {
      const action = offset > 0 ? actions[0] : actions[actions.length - 1]
      if (action?.onClick) action.onClick()
    }
    setOffset(0)
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {actions.length > 0 && (
        <div className="absolute inset-0 flex">
          {actions.map((action, i) => (
            <div
              key={i}
              className={`flex-1 flex items-center justify-center ${action.bgColor || 'bg-slate-200'} text-white text-xs font-bold`}
            >
              {action.label}
            </div>
          ))}
        </div>
      )}
      <div
        className="relative bg-white transition-transform"
        style={{ transform: `translateX(${-offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

export default SwipeableCard
