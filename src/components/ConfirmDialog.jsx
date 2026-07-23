import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'

export default function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, loading = false, variant = 'danger' }) {
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !loading) onCancel?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, loading, onCancel])

  if (!open) return null

  const isDanger = variant === 'danger'
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={loading ? undefined : onCancel} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
        <div className={`h-1.5 w-full ${isDanger ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-violet-500 to-purple-600'}`} />
        <div className="p-5 sm:p-6">
          <button type="button" onClick={onCancel} disabled={loading} aria-label="Close confirmation" className="absolute right-4 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
            <X size={18} />
          </button>
          <div className="flex items-start gap-4 pr-8">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-violet-100 text-violet-600'}`}>
              {isDanger ? <Trash2 size={21} /> : <AlertTriangle size={21} />}
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-base font-extrabold text-slate-900 sm:text-lg">{title}</h3>
              <p id="confirm-dialog-description" className="mt-2 break-words text-sm leading-relaxed text-slate-600 whitespace-pre-line">{description}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
