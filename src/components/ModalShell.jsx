import { useEffect } from 'react'
import ReactDOM from 'react-dom'

function ModalShell({ children, panelClassName = 'max-w-lg' }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const layout = document.querySelector('.layout-container')
    const previousLayoutOverflow = layout?.style.overflow || ''
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    if (layout) layout.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      if (layout) layout.style.overflow = previousLayoutOverflow
    }
  }, [])

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-md sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        className={`relative my-auto w-full overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-[0_32px_90px_rgba(15,23,42,0.28),0_8px_30px_rgba(124,58,237,0.12)] ring-1 ring-violet-100/70 backdrop-blur-xl ${panelClassName}`}
      >
        <div
          className="premium-modal-scroll max-h-[calc(100dvh-1.5rem)] space-y-5 overflow-x-hidden overflow-y-auto p-4 sm:max-h-[calc(100dvh-3rem)] sm:space-y-6 sm:p-8"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ModalShell
